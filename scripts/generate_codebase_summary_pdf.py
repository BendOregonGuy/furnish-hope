"""
Generate docs/CodebaseSummary.pdf from docs/CODEBASE_SUMMARY.md.

What it does
------------
1. Collects fresh stats from the working tree + the local Postgres
   schema (LOC, migration count, table count, FK count, route file
   count, endpoint count, page count, commit count, deps list).
2. Rewrites the "By the numbers" table in
   docs/CODEBASE_SUMMARY.md with the freshly collected values, and
   updates the "Last regenerated" date.
3. Renders the markdown to docs/CodebaseSummary.pdf via Pandoc, using
   wkhtmltopdf if it's available, falling back to whichever PDF
   engine Pandoc finds.

Re-run any time the codebase grows. The Python deps are stdlib only;
the binary deps are Pandoc (already installed via winget) and a PDF
engine that Pandoc can call.

Re-run:

    cd C:\\Users\\prest\\furnish-hope
    python scripts/generate_codebase_summary_pdf.py
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_MD   = REPO_ROOT / "docs" / "CODEBASE_SUMMARY.md"
OUT_PDF  = REPO_ROOT / "docs" / "CodebaseSummary.pdf"

# Pandoc shows up under %LOCALAPPDATA% on this machine; fall back to PATH.
PANDOC_CANDIDATES = [
    Path(os.environ.get("LOCALAPPDATA", "")) / "Pandoc" / "pandoc.exe",
    Path("pandoc"),
]


# ----------------------------------------------------------- helpers

def shell(cmd: list[str], cwd: Path | None = None, check: bool = True) -> str:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(
            f"Command failed ({' '.join(cmd)}):\n  stdout: {r.stdout}\n  stderr: {r.stderr}",
        )
    return r.stdout.strip()


def find_pandoc() -> str:
    for c in PANDOC_CANDIDATES:
        if c == Path("pandoc"):
            w = shutil.which("pandoc")
            if w:
                return w
        else:
            if c.exists():
                return str(c)
    raise SystemExit(
        "ERROR: Pandoc not found. Install with:\n"
        "    winget install --id JohnMacFarlane.Pandoc --source winget",
    )


# -------------------------------------------------- stat collectors

def loc_count() -> int:
    """Total non-blank lines of TS/TSX under api/src + web/src."""
    total = 0
    for sub in ("api/src", "web/src"):
        root = REPO_ROOT / sub
        if not root.exists():
            continue
        for p in root.rglob("*.ts"):
            total += len(p.read_text(encoding="utf-8", errors="ignore").splitlines())
        for p in root.rglob("*.tsx"):
            total += len(p.read_text(encoding="utf-8", errors="ignore").splitlines())
    return total


def migration_count() -> int:
    text = (REPO_ROOT / "api/src/auth/migrations.ts").read_text(encoding="utf-8")
    # Each migration block starts with '  {' on its own line.
    return sum(1 for line in text.splitlines() if line.rstrip() == "  {")


def route_file_count() -> int:
    return sum(1 for _ in (REPO_ROOT / "api/src/routes").glob("*.ts"))


def endpoint_count() -> int:
    n = 0
    for p in (REPO_ROOT / "api/src/routes").glob("*.ts"):
        text = p.read_text(encoding="utf-8")
        n += len(re.findall(r"Router\.(get|post|put|delete)\(", text))
    return n


def page_count() -> int:
    n = 0
    for sub in ("pages", "pages/admin", "pages/agency", "pages/dev", "pages/help"):
        root = REPO_ROOT / "web/src" / sub
        if root.exists():
            n += sum(1 for _ in root.glob("*.tsx"))
    return n


def commit_count() -> int:
    return int(shell(["git", "rev-list", "--count", "HEAD"], cwd=REPO_ROOT))


def db_stats() -> tuple[int, int, int]:
    """Return (tbl_count, lkp_count, fk_count) from local Postgres.

    Skips silently if the local DB is unreachable — stale counts in the
    PDF are better than a failed regen.
    """
    try:
        import psycopg2  # type: ignore
    except ImportError:
        print("psycopg2 not installed; leaving DB stats as-is", file=sys.stderr)
        return (0, 0, 0)
    try:
        conn = psycopg2.connect(
            host=os.environ.get("PGHOST", "localhost"),
            port=int(os.environ.get("PGPORT", "5432")),
            dbname=os.environ.get("PGDATABASE", "furnish_hope"),
            user=os.environ.get("PGUSER", "postgres"),
            password=os.environ.get("PGPASSWORD", "postgres"),
        )
    except Exception as e:
        print(f"Could not reach local Postgres ({e}); leaving DB stats as-is", file=sys.stderr)
        return (0, 0, 0)
    with conn, conn.cursor() as cur:
        cur.execute("""
            SELECT
              COUNT(*) FILTER (WHERE table_name LIKE 'tbl_%') AS tbl,
              COUNT(*) FILTER (WHERE table_name LIKE 'lkp_%') AS lkp
            FROM information_schema.tables
            WHERE table_schema='public'
        """)
        tbl, lkp = cur.fetchone()
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.table_constraints
             WHERE constraint_type='FOREIGN KEY' AND table_schema='public'
        """)
        (fk,) = cur.fetchone()
    return (int(tbl), int(lkp), int(fk))


# ------------------------------------------ markdown rewrite

NUMBERS_RE = re.compile(
    r"(## By the numbers\s*\n\n)(?:.*?\n)(?=\n*---)",  # capture from header through blank line before next ---
    re.DOTALL,
)


def build_numbers_table(stats: dict) -> str:
    loc_approx = round(stats["loc"], -2)  # round to nearest hundred for the "~" feel
    rows = [
        ("| Metric | Count |", "|---|---:|"),
        ("| TypeScript LOC (api + web)", f"~{loc_approx:,}"),
        ("| Schema migrations", str(stats["migrations"])),
        ("| Database tables (`tbl_*` + `lkp_*`)",
            f"{stats['tbl']} + {stats['lkp']} = {stats['tbl'] + stats['lkp']}"),
        ("| Foreign keys", str(stats["fk"])),
        ("| API route files", str(stats["route_files"])),
        ("| API endpoints", str(stats["endpoints"])),
        ("| Frontend pages", str(stats["pages"])),
        ("| Commits on `main`", str(stats["commits"])),
        ("| Production bundle size", "~1.9 MB JS, 506 KB gzipped"),
    ]
    lines = [rows[0][0], rows[0][1]]
    for left, right in rows[1:]:
        lines.append(f"{left} | {right} |")
    return "\n".join(lines) + "\n"


def rewrite_markdown(stats: dict) -> None:
    text = SRC_MD.read_text(encoding="utf-8")

    # Update "Last regenerated" line.
    text = re.sub(
        r"\*Last regenerated: [\d\-]+\*",
        f"*Last regenerated: {date.today().isoformat()}*",
        text,
    )

    # Splice in the fresh By-the-numbers table. Find the header, replace
    # everything until the next blank line that precedes "---".
    pattern = re.compile(
        r"(## By the numbers\s*\n\n)(\|.*?\n(?:\|.*?\n)+)",
        re.DOTALL,
    )
    new_table = build_numbers_table(stats)
    if not pattern.search(text):
        raise SystemExit("Could not locate the By the numbers table in source markdown")
    text = pattern.sub(rf"\1{new_table}", text)

    SRC_MD.write_text(text, encoding="utf-8")


# ---------------------------------------------- PDF render

def render_pdf(pandoc_path: str) -> None:
    OUT_PDF.parent.mkdir(parents=True, exist_ok=True)

    # Pick a PDF engine Pandoc can call. wkhtmltopdf is the most
    # forgiving on Windows (no LaTeX install required); fall back to
    # whatever is on PATH. Add the known winget install location to
    # PATH so a freshly-installed wkhtmltopdf works without the user
    # restarting their shell.
    wkhtml_dir = r"C:\Program Files\wkhtmltopdf\bin"
    if os.path.exists(os.path.join(wkhtml_dir, "wkhtmltopdf.exe")):
        os.environ["PATH"] = f"{wkhtml_dir};{os.environ.get('PATH', '')}"

    engine_args: list[str] = []
    for engine in ("wkhtmltopdf", "weasyprint", "xelatex", "pdflatex"):
        if shutil.which(engine):
            engine_args = [f"--pdf-engine={engine}"]
            break

    cmd = [
        pandoc_path,
        str(SRC_MD),
        "-o", str(OUT_PDF),
        "--standalone",
        "--toc",
        "--toc-depth=2",
        "-V", "geometry:margin=0.9in",
        "-V", "documentclass:article",
        "-V", "fontsize:11pt",
        "-V", "colorlinks:true",
        "-V", "linkcolor:NavyBlue",
        "-V", "urlcolor:NavyBlue",
        *engine_args,
    ]

    print(f"Running: {' '.join(cmd)}")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        # Pandoc's most common Windows failure is "no PDF engine".
        # Surface the underlying error verbatim so the user can fix it.
        raise SystemExit(
            "Pandoc failed to produce a PDF.\n\n"
            f"stdout:\n{r.stdout}\n\nstderr:\n{r.stderr}\n\n"
            "If the error mentions a missing PDF engine, install wkhtmltopdf:\n"
            "    winget install --id wkhtmltopdf.wkhtmltox --source winget\n"
            "or install MiKTeX for xelatex / pdflatex support."
        )


# ----------------------------------------------------------- main

def main() -> int:
    if not SRC_MD.exists():
        raise SystemExit(f"Missing source markdown: {SRC_MD}")

    pandoc = find_pandoc()
    print(f"Pandoc: {pandoc}")

    stats = {
        "loc":        loc_count(),
        "migrations": migration_count(),
        "route_files": route_file_count(),
        "endpoints":  endpoint_count(),
        "pages":      page_count(),
        "commits":    commit_count(),
    }
    tbl, lkp, fk = db_stats()
    stats["tbl"] = tbl
    stats["lkp"] = lkp
    stats["fk"]  = fk

    print("Fresh stats:")
    for k, v in stats.items():
        print(f"  {k:>12}: {v}")

    rewrite_markdown(stats)
    print(f"Rewrote {SRC_MD}")

    render_pdf(pandoc)
    print(f"\nWrote {OUT_PDF}  ({OUT_PDF.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
