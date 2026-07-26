"""
Generate an entity-relationship PDF for the Furnish Hope database.

What it does
------------
1. Introspects the LIVE Postgres schema (tables, columns, primary keys,
   foreign keys) using information_schema.
2. Groups tables into hand-curated themes (Clients, Donations, Inventory,
   etc). Each theme becomes one landscape page.
3. Per theme, emits a Graphviz DOT graph: one record-shaped node per
   table with every column listed (PK gets a key icon, FK columns are
   annotated with their target table). Edges connect FK columns to the
   referenced table.
4. When an FK crosses theme boundaries, the source column is annotated
   with the target table name so the reader can follow the link without
   needing a giant single-page graph.
5. Renders each theme to its own PDF page with `dot`, then merges them
   into docs/FurnishHopeERD.pdf with a cover page.

Re-run any time the schema changes:

    cd C:\\Users\\prest\\furnish-hope
    python scripts/generate_erd_pdf.py

Requires: graphviz binary on PATH, plus pip packages: psycopg2, graphviz, pypdf
"""

from __future__ import annotations

import os
import sys
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras
from graphviz import Digraph
from pypdf import PdfReader, PdfWriter

# -------------------------------------------------------------------- config

DB_HOST = os.environ.get("PGHOST", "localhost")
DB_PORT = int(os.environ.get("PGPORT", "5432"))
DB_NAME = os.environ.get("PGDATABASE", "furnish_hope")
DB_USER = os.environ.get("PGUSER", "postgres")
DB_PASS = os.environ.get("PGPASSWORD", "postgres")

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = REPO_ROOT / "docs"
BUILD_DIR = REPO_ROOT / "build" / "erd"
OUT_PDF = OUT_DIR / "FurnishHopeERD.pdf"

# -------------------------------------------------------------- theme groups

# Tables in the order they should appear in the final PDF. Each entry is
# (theme_label, summary_text, [table_names_in_order]). Order within a
# theme controls left-to-right node placement in the rendered graph.
THEMES: list[tuple[str, str, list[str]]] = [
    (
        "Contacts & Addresses",
        "Shared people + place rows that almost every other theme joins to. "
        "tbl_contact is the polymorphic identity row used by clients, donors, "
        "facility_staff, agency contacts, vendors, etc.",
        [
            "tbl_contact",
            "tbl_address",
            "lkp_contact_type",
            "lkp_gender",
            "lkp_ethnicity",
            "lkp_citizen_status",
            "lkp_address_type",
            "lkp_city",
            "lkp_county",
            "lkp_state",
            "lkp_communication_method",
        ],
    ),
    (
        "Clients & Households",
        "The client lifecycle — referral, intake, packing list (provisioning "
        "request) with its per-child rows + room/item template, visit, waiver, "
        "and delivery. Container pickup tables live here too.",
        [
            "tbl_client",
            "tbl_client_client_type",
            "tbl_referral",
            "tbl_client_provisioning_request",
            "tbl_client_request_items",
            "tbl_request_item_inv_matches",
            "tbl_request_child",
            "tbl_packing_template_room",
            "tbl_packing_template_item",
            "tbl_client_visit",
            "tbl_client_waiver",
            "tbl_waiver_template",
            "tbl_client_deliveries",
            "tbl_client_delivery_container",
            "tbl_delivery_items",
            "tbl_delivery_staff",
            "tbl_delivery_vehicle",
            "tbl_delivery_receipt",
            "tbl_potential_duplicate",
            "lkp_client_type",
            "lkp_client_status",
            "lkp_delivery_status",
            "lkp_delivery_vehicle_type",
            "lkp_rental_agency",
            "lkp_visit_mode",
            "lkp_visit_status",
            "lkp_fulfillment_method",
            "lkp_request_receipt_origin",
            "lkp_howtheyfoundus",
        ],
    ),
    (
        "Donors, Donations & QuickBooks",
        "Donor records, individual gifts, designations, pledges, and the QBO sync "
        "trail. Donation pickups (warehouse intake) also live here.",
        [
            "tbl_donor",
            "tbl_donation",
            "tbl_donation_item",
            "tbl_donation_designation",
            "tbl_donation_check",
            "tbl_donation_securities",
            "tbl_donation_pickup",
            "tbl_pledge",
            "tbl_quickbooks_connection",
            "tbl_quickbooks_account_mapping",
            "tbl_quickbooks_donor_link",
            "tbl_quickbooks_donation_sync",
            "tbl_receipt_counter",
            "lkp_donor_type",
            "lkp_donor_stage",
            "lkp_donation_type",
            "lkp_pickup_status",
            "lkp_pledge_status",
            "lkp_payment_method",
            "lkp_solicitation_method",
            "lkp_restriction_type",
            "lkp_acknowledgement_status",
            "lkp_fund",
            "lkp_source_type",
        ],
    ),
    (
        "Inventory & Storage",
        "Items currently in the warehouse, where they're stored, and how they "
        "get reserved against open client requests.",
        [
            "tbl_corp_facility_inventory_item",
            "tbl_inventory_reservation",
            "tbl_item_category_value",
            "lkp_item_category",
            "lkp_item_condition",
            "lkp_item_size",
            "lkp_item_weight",
            "lkp_storage_location",
            "lkp_reservation_status",
            "lkp_disposition_reason",
        ],
    ),
    (
        "Facilities & Vehicles",
        "Corporate org and physical sites (warehouses, showrooms), plus the "
        "company vehicle fleet and its maintenance log.",
        [
            "tbl_corporate",
            "tbl_corp_facility",
            "tbl_vehicle",
            "tbl_vehicle_maintenance",
            "tbl_vehicle_mileage",
            "lkp_corp_type",
            "lkp_facility_type",
            "lkp_vehicle_type",
            "lkp_vehicle_make",
            "lkp_vehicle_model",
            "lkp_vehicle_fuel_type",
            "lkp_vehicle_weight_class",
            "lkp_maintenance_type",
        ],
    ),
    (
        "Staff, Volunteers & Shifts",
        "Facility staff + volunteer rosters, the public volunteer-signup queue, "
        "shift templates, generated shifts, and individual signups + hours.",
        [
            "tbl_facility_staff",
            "tbl_facility_staff_statuses",
            "tbl_volunteer_profile",
            "tbl_volunteer_skill",
            "tbl_volunteer_hours",
            "tbl_volunteer_signup",
            "tbl_volunteer_shift",
            "tbl_volunteer_shift_signup",
            "tbl_shift_template",
            "tbl_holiday",
            "tbl_staff_type",
            "tbl_staff_types",
            "lkp_staff_role",
            "lkp_role_pay_type",
            "lkp_facility_staff_status",
            "lkp_shift_type",
            "lkp_shift_status",
            "lkp_skill",
            "lkp_volunteer_activity_type",
            "lkp_status_change_reason",
            "lkp_background_check_status",
        ],
    ),
    (
        "Fundraising: Campaigns, Events, Grants",
        "Multi-gift campaigns, fundraising events with attendees and sponsors, "
        "and grant tracking.",
        [
            "tbl_campaign",
            "tbl_event",
            "tbl_event_attendee",
            "tbl_event_sponsor",
            "tbl_grant",
            "lkp_campaign_type",
            "lkp_campaign_status",
            "lkp_event_type",
            "lkp_rsvp_status",
            "lkp_sponsor_level",
        ],
    ),
    (
        "Vendors",
        "Outside service providers Furnish Hope works with (plumbers, "
        "landscapers, suppliers) and the log of their service calls.",
        [
            "tbl_vendor",
            "tbl_vendor_service",
            "lkp_vendor_type",
            "lkp_vendor_specialty",
            "lkp_vendor_service_status",
        ],
    ),
    (
        "Partner Agencies",
        "Outside agencies that refer households to Furnish Hope. Includes the "
        "self-serve application queue (pending → approved → agency), the "
        "populations-served join, and the one-time caseworker invitations that "
        "seed agency user accounts.",
        [
            "tbl_agency",
            "tbl_agency_contact",
            "tbl_agency_client_type",
            "tbl_agency_application",
            "tbl_agency_application_caseworker",
            "tbl_agency_application_client_type",
            "tbl_caseworker_invitation",
            "lkp_agency_type",
        ],
    ),
    (
        "Communications, Files & Notes",
        "Email accounts, cached IMAP messages, templates, the outbound/inbound "
        "messaging layer (SMS + email with templates and triggers), the generic "
        "per-entity attachment table, and free-form notes.",
        [
            "tbl_email_account",
            "tbl_email_sync_state",
            "tbl_email_message",
            "tbl_email_attachment",
            "tbl_email_template",
            "tbl_communication_log",
            "tbl_message",
            "tbl_message_notification",
            "tbl_message_undeliverable",
            "tbl_message_template",
            "tbl_message_template_form",
            "tbl_message_template_recipient_type",
            "tbl_message_template_sender_role",
            "tbl_message_trigger",
            "tbl_message_trigger_recipient",
            "tbl_note",
            "tbl_entity_attachment",
            "tbl_attachment",
            "tbl_attachment_blob",
            "lkp_attachment_entity_type",
            "lkp_note_entity_type",
        ],
    ),
    (
        "System: Auth, Audit, Issues, Settings",
        "App-wide infrastructure: user accounts, audit log, app settings, "
        "the in-app issue tracker + developer broadcasts, org branding, "
        "and the user-manual screenshot store.",
        [
            "tbl_user_account",
            "tbl_audit_log",
            "tbl_app_setting",
            "tbl_app_issue",
            "tbl_app_broadcast",
            "tbl_app_broadcast_dismissal",
            "tbl_org_branding",
            "tbl_manual_screenshot",
        ],
    ),
]

# ------------------------------------------------------------ introspection

def fetch_schema(cur) -> tuple[
    dict[str, list[dict]],
    dict[str, list[str]],
    list[tuple[str, str, str, str]],
]:
    """Return (columns_by_table, pks_by_table, fks).

    columns_by_table[tbl] -> [{name, type, nullable}, ...] in ordinal order
    pks_by_table[tbl] -> [col1, col2, ...]
    fks -> [(src_table, src_col, ref_table, ref_col), ...]
    """
    cur.execute("""
        SELECT
          c.table_name,
          c.column_name,
          c.data_type,
          c.character_maximum_length,
          c.is_nullable,
          c.ordinal_position
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND (c.table_name LIKE 'tbl_%' OR c.table_name LIKE 'lkp_%')
        ORDER BY c.table_name, c.ordinal_position
    """)
    columns_by_table: dict[str, list[dict]] = defaultdict(list)
    for r in cur.fetchall():
        type_str = r["data_type"]
        if r["character_maximum_length"]:
            type_str = f"{type_str}({r['character_maximum_length']})"
        columns_by_table[r["table_name"]].append({
            "name": r["column_name"],
            "type": type_str,
            "nullable": r["is_nullable"] == "YES",
        })

    cur.execute("""
        SELECT
          tc.table_name,
          kcu.column_name,
          kcu.ordinal_position
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.table_schema    = tc.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type = 'PRIMARY KEY'
          AND (tc.table_name LIKE 'tbl_%' OR tc.table_name LIKE 'lkp_%')
        ORDER BY tc.table_name, kcu.ordinal_position
    """)
    pks_by_table: dict[str, list[str]] = defaultdict(list)
    for r in cur.fetchall():
        pks_by_table[r["table_name"]].append(r["column_name"])

    cur.execute("""
        SELECT
          tc.table_name        AS src_table,
          kcu.column_name      AS src_col,
          ccu.table_name       AS ref_table,
          ccu.column_name      AS ref_col
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.table_schema    = tc.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema    = tc.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND (tc.table_name LIKE 'tbl_%' OR tc.table_name LIKE 'lkp_%')
        ORDER BY tc.table_name, kcu.ordinal_position
    """)
    fks: list[tuple[str, str, str, str]] = []
    for r in cur.fetchall():
        fks.append((r["src_table"], r["src_col"], r["ref_table"], r["ref_col"]))

    return columns_by_table, pks_by_table, fks


# -------------------------------------------------------------- rendering

# Color palette tuned for print: light fills + clear headers.
HEADER_COLOR_TBL = "#C7704A"  # terracotta
HEADER_COLOR_LKP = "#7C8B5E"  # sage
HEADER_TEXT      = "#FAF7F1"
ROW_BG_ZEBRA     = "#F4ECE1"
ROW_BG           = "#FFFFFF"
PK_COLOR         = "#8A4523"  # deeper terracotta for PK icon
FK_COLOR         = "#3B4D2B"  # deeper sage for FK arrow
EXTERNAL_COLOR   = "#5B6478"  # slate for cross-theme references
EDGE_COLOR       = "#2A241D"
LABEL_FONT       = "Helvetica"


def esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def table_html_label(
    tbl: str,
    cols: list[dict],
    pks: list[str],
    fks_from_tbl: list[tuple[str, str, str]],  # (src_col, ref_table, ref_col)
    theme_tables: set[str],
) -> str:
    """Render a table as a Graphviz HTML-like label."""
    is_lkp = tbl.startswith("lkp_")
    header_color = HEADER_COLOR_LKP if is_lkp else HEADER_COLOR_TBL

    rows = []
    # Header row — table name, full width.
    rows.append(
        f'<TR><TD BGCOLOR="{header_color}" COLSPAN="3" PORT="__head__">'
        f'<FONT COLOR="{HEADER_TEXT}" FACE="{LABEL_FONT}-Bold" POINT-SIZE="13">'
        f' {esc(tbl)} </FONT></TD></TR>'
    )

    fk_by_col = {col: (ref_tbl, ref_col) for col, ref_tbl, ref_col in fks_from_tbl}

    for idx, col in enumerate(cols):
        bg = ROW_BG_ZEBRA if idx % 2 == 0 else ROW_BG
        name = col["name"]
        is_pk = name in pks
        is_fk = name in fk_by_col

        # Left badge cell — PK / FK marker.
        if is_pk and is_fk:
            badge = f'<FONT COLOR="{PK_COLOR}" FACE="{LABEL_FONT}-Bold">PK/FK</FONT>'
        elif is_pk:
            badge = f'<FONT COLOR="{PK_COLOR}" FACE="{LABEL_FONT}-Bold">PK</FONT>'
        elif is_fk:
            badge = f'<FONT COLOR="{FK_COLOR}" FACE="{LABEL_FONT}-Bold">FK</FONT>'
        else:
            badge = " "

        # Column name + cross-theme target hint if applicable.
        name_html = f'<FONT FACE="{LABEL_FONT}" POINT-SIZE="11">{esc(name)}</FONT>'
        if is_fk:
            ref_tbl, _ref_col = fk_by_col[name]
            if ref_tbl not in theme_tables:
                # External (cross-theme) reference: annotate with the
                # target table so the reader can follow it across pages.
                name_html += (
                    f'<BR ALIGN="LEFT"/><FONT COLOR="{EXTERNAL_COLOR}" '
                    f'POINT-SIZE="9" FACE="{LABEL_FONT}-Oblique">→ {esc(ref_tbl)}</FONT>'
                )

        type_str = col["type"]
        nullable_mark = "" if not col["nullable"] else ""  # keep compact
        type_html = (
            f'<FONT COLOR="#776A57" POINT-SIZE="9" FACE="{LABEL_FONT}">'
            f'{esc(type_str)}{nullable_mark}</FONT>'
        )

        rows.append(
            f'<TR><TD BGCOLOR="{bg}" ALIGN="LEFT" PORT="{esc(name)}">'
            f'<TABLE BORDER="0" CELLBORDER="0" CELLPADDING="0" CELLSPACING="0">'
            f'<TR><TD ALIGN="LEFT" WIDTH="38">{badge}</TD>'
            f'<TD ALIGN="LEFT">{name_html}</TD>'
            f'<TD ALIGN="RIGHT">{type_html}</TD></TR>'
            f'</TABLE>'
            f'</TD></TR>'
        )

    table_html = (
        f'<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" '
        f'COLOR="{EDGE_COLOR}">'
        f'{"".join(rows)}'
        f'</TABLE>'
    )
    return f"<{table_html}>"


def render_theme(
    theme_label: str,
    theme_intro: str,
    theme_tables: list[str],
    cols_by_tbl: dict[str, list[dict]],
    pks_by_tbl: dict[str, list[str]],
    fks: list[tuple[str, str, str, str]],
    out_basename: str,
) -> Path:
    """Render one theme to a single-page PDF; return its path."""
    theme_set = set(theme_tables)
    g = Digraph(
        name=f"erd_{out_basename}",
        format="pdf",
        engine="dot",
    )
    # Landscape, generous, clear arrows.
    g.attr(
        "graph",
        rankdir="LR",
        splines="spline",
        overlap="false",
        nodesep="0.45",
        ranksep="0.9",
        pad="0.4",
        bgcolor="#FAF7F1",
        fontname=LABEL_FONT,
        labelloc="t",
        labeljust="l",
        label=(
            f'<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0">'
            f'<TR><TD ALIGN="LEFT"><FONT FACE="{LABEL_FONT}-Bold" POINT-SIZE="20">'
            f'{esc(theme_label)}</FONT></TD></TR>'
            f'<TR><TD ALIGN="LEFT"><FONT FACE="{LABEL_FONT}" POINT-SIZE="11" '
            f'COLOR="#5C5247">{esc(theme_intro)}</FONT></TD></TR>'
            f'<TR><TD HEIGHT="6"></TD></TR>'
            f"</TABLE>>"
        ),
    )
    g.attr("node", shape="plaintext", fontname=LABEL_FONT)
    g.attr("edge", color=EDGE_COLOR, arrowhead="vee", arrowsize="0.8", penwidth="1.2")

    # Build per-table FK lists (src_col, ref_table, ref_col) for ones that
    # originate FROM this table (any target).
    fks_from: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for src_tbl, src_col, ref_tbl, ref_col in fks:
        fks_from[src_tbl].append((src_col, ref_tbl, ref_col))

    for tbl in theme_tables:
        cols = cols_by_tbl.get(tbl)
        if not cols:
            continue  # table doesn't exist in DB; skip silently
        pks = pks_by_tbl.get(tbl, [])
        label = table_html_label(tbl, cols, pks, fks_from[tbl], theme_set)
        g.node(tbl, label=label)

    # Edges — only when BOTH ends live in this theme (cross-theme links
    # are annotated inside the source row instead).
    for src_tbl, src_col, ref_tbl, _ref_col in fks:
        if src_tbl in theme_set and ref_tbl in theme_set and src_tbl != ref_tbl:
            g.edge(
                f"{src_tbl}:{src_col}",
                f"{ref_tbl}:__head__",
                tailport="e",
                headport="w",
            )

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    out_stem = BUILD_DIR / out_basename
    rendered = g.render(filename=str(out_stem), cleanup=True)
    return Path(rendered)


# ---------------------------------------------------------- cover page

def render_cover(theme_pdfs: list[tuple[str, Path]]) -> Path:
    """Render the cover page: title, generated-on note, and a list of
    themed sections with one-line summaries pulled from THEMES."""
    summary_by_label = {label: summary for label, summary, _ in THEMES}

    g = Digraph(name="erd_cover", format="pdf", engine="dot")
    g.attr(
        "graph",
        rankdir="TB",
        bgcolor="#FAF7F1",
        nodesep="0.3",
        ranksep="0.3",
        pad="0.6",
        margin="0.3",
    )
    g.attr("node", shape="plaintext", fontname=LABEL_FONT)

    rows: list[str] = []
    rows.append(
        f'<TR><TD ALIGN="LEFT"><FONT FACE="{LABEL_FONT}-Bold" POINT-SIZE="28">'
        f'Furnish Hope &#8211; Database ERD</FONT></TD></TR>'
    )
    rows.append(
        f'<TR><TD ALIGN="LEFT"><FONT FACE="{LABEL_FONT}-Oblique" POINT-SIZE="13" '
        f'COLOR="#5C5247">A page per theme, in the order shown below.</FONT></TD></TR>'
    )
    rows.append('<TR><TD HEIGHT="20"></TD></TR>')
    rows.append(
        f'<TR><TD ALIGN="LEFT"><FONT FACE="{LABEL_FONT}-Bold" POINT-SIZE="12" '
        f'COLOR="#3B4D2B">Reading the diagrams</FONT></TD></TR>'
    )
    rows.append(
        f'<TR><TD ALIGN="LEFT"><FONT POINT-SIZE="11" COLOR="#3D3530">'
        f'&#x2022; <B>Orange header</B> = data table (tbl_*). '
        f'<B>Green header</B> = lookup table (lkp_*).<BR ALIGN="LEFT"/>'
        f'&#x2022; <B>PK</B> badge marks the primary key; <B>FK</B> badge marks a foreign key.<BR ALIGN="LEFT"/>'
        f'&#x2022; A small italic <FONT COLOR="#5B6478">&#8594; tbl_other</FONT> under an FK '
        f'column means that reference points OUT of this theme&#8217;s page.<BR ALIGN="LEFT"/>'
        f'&#x2022; Arrows are drawn only for relationships within the same theme; '
        f'cross-theme links are listed inline.<BR ALIGN="LEFT"/>'
        f'</FONT></TD></TR>'
    )
    rows.append('<TR><TD HEIGHT="14"></TD></TR>')
    rows.append(
        f'<TR><TD ALIGN="LEFT"><FONT FACE="{LABEL_FONT}-Bold" POINT-SIZE="12" '
        f'COLOR="#3B4D2B">Contents</FONT></TD></TR>'
    )
    for idx, (label, _pdf) in enumerate(theme_pdfs, start=1):
        summary = summary_by_label.get(label, "")
        rows.append(
            f'<TR><TD ALIGN="LEFT">'
            f'<TABLE BORDER="0" CELLBORDER="0" CELLPADDING="3" CELLSPACING="0">'
            f'<TR>'
            f'<TD VALIGN="TOP" WIDTH="30"><FONT FACE="{LABEL_FONT}-Bold" POINT-SIZE="11">'
            f'{idx}.</FONT></TD>'
            f'<TD VALIGN="TOP">'
            f'<FONT FACE="{LABEL_FONT}-Bold" POINT-SIZE="12">{esc(label)}</FONT>'
            f'<BR ALIGN="LEFT"/><FONT POINT-SIZE="10" COLOR="#5C5247">{esc(summary)}</FONT>'
            f'</TD></TR>'
            f'</TABLE>'
            f'</TD></TR>'
        )

    label_html = (
        f'<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">'
        f'{"".join(rows)}'
        f"</TABLE>>"
    )
    g.node("cover", label=label_html)

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    out_stem = BUILD_DIR / "00_cover"
    rendered = g.render(filename=str(out_stem), cleanup=True)
    return Path(rendered)


# ------------------------------------------------------------------- main

def main() -> int:
    if not shutil.which("dot"):
        # Fall back to the explicit install path used by the winget package.
        fallback = r"C:\Program Files\Graphviz\bin"
        if os.path.exists(os.path.join(fallback, "dot.exe")):
            os.environ["PATH"] = f"{fallback};{os.environ.get('PATH', '')}"
        else:
            print(
                "ERROR: the Graphviz 'dot' binary is not on PATH. Install with:\n"
                "    winget install --id Graphviz.Graphviz --source winget",
                file=sys.stderr,
            )
            return 2

    print(f"Connecting to postgres://{DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME} ...")
    with psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS,
    ) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cols_by_tbl, pks_by_tbl, fks = fetch_schema(cur)

    print(f"  found {len(cols_by_tbl)} tables, {len(fks)} foreign keys")

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    theme_pdfs: list[tuple[str, Path]] = []
    seen_tables: set[str] = set()
    for idx, (label, intro, tables) in enumerate(THEMES, start=1):
        slug = f"{idx:02d}_{label.lower().replace('&', 'and').replace(',', '').replace(' ', '_')}"
        existing = [t for t in tables if t in cols_by_tbl]
        if not existing:
            print(f"  [{idx:02d}] {label}: no tables — skipped")
            continue
        print(f"  [{idx:02d}] {label}: {len(existing)} tables -> {slug}.pdf")
        seen_tables.update(existing)
        pdf_path = render_theme(label, intro, existing, cols_by_tbl, pks_by_tbl, fks, slug)
        theme_pdfs.append((label, pdf_path))

    # Sanity check: did we leave any tables un-themed?
    missing = sorted(set(cols_by_tbl.keys()) - seen_tables)
    if missing:
        print(f"\nWARNING: {len(missing)} table(s) not assigned to any theme:")
        for t in missing:
            print(f"    {t}")

    cover_pdf = render_cover(theme_pdfs)

    # Merge cover + theme pages.
    writer = PdfWriter()
    for src in [cover_pdf] + [p for _, p in theme_pdfs]:
        reader = PdfReader(str(src))
        for page in reader.pages:
            writer.add_page(page)
    with OUT_PDF.open("wb") as fh:
        writer.write(fh)

    print(f"\nWrote {OUT_PDF}  ({OUT_PDF.stat().st_size // 1024} KB, {len(theme_pdfs) + 1} pages)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
