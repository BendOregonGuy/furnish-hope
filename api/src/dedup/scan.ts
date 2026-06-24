/**
 * Nightly client-dedup scan.
 *
 * Scores every pair of clients using the same SQL fragment the interactive
 * "do you mean...?" search uses, then INSERTs pairs whose score >= the
 * admin-tunable `dedupe_match_threshold` setting into
 * `tbl_potential_duplicate` with status='pending'. Pairs that already exist
 * in the table (pending OR resolved) are silently skipped via ON CONFLICT
 * on the (client_id_a, client_id_b) unique index — so re-running the scan
 * never produces phantom work.
 *
 * Cost: O(N^2/2) over `tbl_client`. With a few thousand clients this is
 * sub-second. We'd switch to a blocking-key approach (block by lower(last_name)
 * first) above ~50k clients.
 */

import { query, queryOne } from '../db/pool.js';

export interface ScanSummary {
  scanned_pairs: number;
  newly_flagged: number;
  threshold: number;
  duration_ms: number;
}

/**
 * The pairwise scoring SQL. Joins every pair (a, b) where a.client_id <
 * b.client_id once, applies the same signals as the interactive search
 * (exact-name / trigram-name / DOB / phone / email / address), and emits
 * pairs whose score >= the input threshold.
 *
 * Phone is normalized to digits-only on both sides; email is lowered;
 * names are lowered. NULL signals (e.g. b.mobile_phone IS NULL) never
 * fire — we only count concrete overlaps as evidence.
 */
const SCORING_SQL = `
  WITH pairs AS (
    SELECT
      ca.client_id      AS client_id_a,
      cb.client_id      AS client_id_b,
      conta.first_name  AS a_first,
      conta.last_name   AS a_last,
      conta.birth_date  AS a_dob,
      conta.mobile_phone AS a_phone,
      conta.email       AS a_email,
      conta.address_id  AS a_addr,
      contb.first_name  AS b_first,
      contb.last_name   AS b_last,
      contb.birth_date  AS b_dob,
      contb.mobile_phone AS b_phone,
      contb.email       AS b_email,
      contb.address_id  AS b_addr
    FROM tbl_client ca
    JOIN tbl_client cb        ON cb.client_id > ca.client_id
    JOIN tbl_contact conta    ON conta.contact_id = ca.contact_id
    JOIN tbl_contact contb    ON contb.contact_id = cb.contact_id
  ),
  scored AS (
    SELECT
      client_id_a,
      client_id_b,
      (CASE WHEN LOWER(a_first) = LOWER(b_first)
            AND LOWER(a_last) = LOWER(b_last) THEN TRUE ELSE FALSE END) AS sig_exact_name,
      (CASE WHEN similarity(LOWER(a_first || ' ' || a_last),
                            LOWER(b_first || ' ' || b_last)) > 0.5 THEN TRUE ELSE FALSE END) AS sig_trgm_name,
      (CASE WHEN a_dob IS NOT NULL AND a_dob = b_dob THEN TRUE ELSE FALSE END) AS sig_dob,
      (CASE WHEN COALESCE(REGEXP_REPLACE(a_phone, '[^0-9]', '', 'g'), '') <> ''
            AND REGEXP_REPLACE(a_phone, '[^0-9]', '', 'g')
              = REGEXP_REPLACE(COALESCE(b_phone, ''), '[^0-9]', '', 'g')
            THEN TRUE ELSE FALSE END) AS sig_phone,
      (CASE WHEN COALESCE(LOWER(a_email), '') <> ''
            AND LOWER(a_email) = LOWER(COALESCE(b_email, ''))
            THEN TRUE ELSE FALSE END) AS sig_email,
      (CASE WHEN a_addr IS NOT NULL AND a_addr = b_addr THEN TRUE ELSE FALSE END) AS sig_address
    FROM pairs
  )
  SELECT
    client_id_a,
    client_id_b,
    LEAST(100,
      (CASE WHEN sig_exact_name THEN 40 ELSE 0 END) +
      (CASE WHEN sig_trgm_name  THEN 25 ELSE 0 END) +
      (CASE WHEN sig_dob        THEN 20 ELSE 0 END) +
      (CASE WHEN sig_phone      THEN 20 ELSE 0 END) +
      (CASE WHEN sig_email      THEN 15 ELSE 0 END) +
      (CASE WHEN sig_address    THEN 10 ELSE 0 END)
    )::int AS match_score,
    ARRAY_TO_STRING(
      ARRAY_REMOVE(ARRAY[
        CASE WHEN sig_exact_name THEN 'Exact name'         END,
        CASE WHEN sig_trgm_name  THEN 'Similar name'       END,
        CASE WHEN sig_dob        THEN 'Same date of birth' END,
        CASE WHEN sig_phone      THEN 'Same phone'         END,
        CASE WHEN sig_email      THEN 'Same email'         END,
        CASE WHEN sig_address    THEN 'Same address'       END
      ], NULL),
      '; '
    ) AS match_reasons
  FROM scored
  WHERE (
    (CASE WHEN sig_exact_name THEN 40 ELSE 0 END) +
    (CASE WHEN sig_trgm_name  THEN 25 ELSE 0 END) +
    (CASE WHEN sig_dob        THEN 20 ELSE 0 END) +
    (CASE WHEN sig_phone      THEN 20 ELSE 0 END) +
    (CASE WHEN sig_email      THEN 15 ELSE 0 END) +
    (CASE WHEN sig_address    THEN 10 ELSE 0 END)
  ) >= $1
`;

/** Read the admin-tunable threshold (0-100). Falls back to 70 if missing
 *  or unparseable. */
export async function readThreshold(): Promise<number> {
  const row = await queryOne<{ setting_value: string }>(
    `SELECT setting_value FROM tbl_app_setting WHERE setting_key = 'dedupe_match_threshold'`,
  );
  const n = Number(row?.setting_value ?? '70');
  if (!Number.isFinite(n) || n < 0 || n > 100) return 70;
  return Math.round(n);
}

/** Scan every (a, b) pair, INSERT new pending rows. Returns counters
 *  for telemetry / the manual-trigger UI's success message. */
export async function runScan(threshold?: number): Promise<ScanSummary> {
  const t0 = Date.now();
  const thr = threshold ?? await readThreshold();

  // We do scoring + insert in one round trip: INSERT ... SELECT pulls
  // from the scoring SQL and conflict-skips on the unique pair index.
  const insertResult = await query<{ inserted: number }>(`
    WITH candidates AS (${SCORING_SQL}),
    inserted AS (
      INSERT INTO tbl_potential_duplicate
        (client_id_a, client_id_b, match_score, match_reasons, status)
      SELECT client_id_a, client_id_b, match_score, match_reasons, 'pending'
      FROM candidates
      ON CONFLICT (client_id_a, client_id_b) DO NOTHING
      RETURNING potential_duplicate_id
    )
    SELECT (SELECT COUNT(*) FROM candidates)::int AS scanned,
           (SELECT COUNT(*) FROM inserted)::int   AS inserted
  `, [thr]) as any[];

  const row = insertResult[0] ?? { scanned: 0, inserted: 0 };
  return {
    scanned_pairs: row.scanned ?? 0,
    newly_flagged: row.inserted ?? 0,
    threshold: thr,
    duration_ms: Date.now() - t0,
  };
}

/** Targeted scan for a single client — finds matches of that client
 *  against ALL others. Used by the "Check for duplicates" button on
 *  ClientDetail. Returns the candidates inline (does NOT auto-write to
 *  the queue — staff picks which ones are real). */
export async function scanOneClient(clientId: number, threshold?: number) {
  const thr = threshold ?? await readThreshold();
  const rows = await query(`
    WITH input AS (
      SELECT contact.first_name, contact.last_name, contact.birth_date,
             contact.mobile_phone, contact.email, contact.address_id
        FROM tbl_client c JOIN tbl_contact contact ON contact.contact_id = c.contact_id
       WHERE c.client_id = $1
    ),
    scored AS (
      SELECT
        cb.client_id,
        contb.first_name, contb.last_name, contb.birth_date,
        contb.mobile_phone, contb.email,
        addr.address, city.city,
        (CASE WHEN LOWER(input.first_name) = LOWER(contb.first_name)
              AND LOWER(input.last_name)  = LOWER(contb.last_name) THEN TRUE ELSE FALSE END) AS sig_exact_name,
        (CASE WHEN similarity(LOWER(input.first_name || ' ' || input.last_name),
                              LOWER(contb.first_name || ' ' || contb.last_name)) > 0.5 THEN TRUE ELSE FALSE END) AS sig_trgm_name,
        (CASE WHEN input.birth_date IS NOT NULL AND input.birth_date = contb.birth_date THEN TRUE ELSE FALSE END) AS sig_dob,
        (CASE WHEN COALESCE(REGEXP_REPLACE(input.mobile_phone, '[^0-9]', '', 'g'), '') <> ''
              AND REGEXP_REPLACE(input.mobile_phone, '[^0-9]', '', 'g')
                = REGEXP_REPLACE(COALESCE(contb.mobile_phone, ''), '[^0-9]', '', 'g')
              THEN TRUE ELSE FALSE END) AS sig_phone,
        (CASE WHEN COALESCE(LOWER(input.email), '') <> ''
              AND LOWER(input.email) = LOWER(COALESCE(contb.email, ''))
              THEN TRUE ELSE FALSE END) AS sig_email,
        (CASE WHEN input.address_id IS NOT NULL AND input.address_id = contb.address_id THEN TRUE ELSE FALSE END) AS sig_address
      FROM input, tbl_client cb
      JOIN tbl_contact contb ON contb.contact_id = cb.contact_id
      LEFT JOIN tbl_address addr ON addr.address_id = contb.address_id
      LEFT JOIN lkp_city city    ON city.city_id    = addr.city_id
      WHERE cb.client_id <> $1
    )
    SELECT
      client_id, first_name, last_name, birth_date, mobile_phone, email, address, city,
      LEAST(100,
        (CASE WHEN sig_exact_name THEN 40 ELSE 0 END) +
        (CASE WHEN sig_trgm_name  THEN 25 ELSE 0 END) +
        (CASE WHEN sig_dob        THEN 20 ELSE 0 END) +
        (CASE WHEN sig_phone      THEN 20 ELSE 0 END) +
        (CASE WHEN sig_email      THEN 15 ELSE 0 END) +
        (CASE WHEN sig_address    THEN 10 ELSE 0 END)
      )::int AS match_score,
      ARRAY_TO_STRING(
        ARRAY_REMOVE(ARRAY[
          CASE WHEN sig_exact_name THEN 'Exact name'         END,
          CASE WHEN sig_trgm_name  THEN 'Similar name'       END,
          CASE WHEN sig_dob        THEN 'Same date of birth' END,
          CASE WHEN sig_phone      THEN 'Same phone'         END,
          CASE WHEN sig_email      THEN 'Same email'         END,
          CASE WHEN sig_address    THEN 'Same address'       END
        ], NULL),
        '; '
      ) AS match_reasons
    FROM scored
    WHERE (
      (CASE WHEN sig_exact_name THEN 40 ELSE 0 END) +
      (CASE WHEN sig_trgm_name  THEN 25 ELSE 0 END) +
      (CASE WHEN sig_dob        THEN 20 ELSE 0 END) +
      (CASE WHEN sig_phone      THEN 20 ELSE 0 END) +
      (CASE WHEN sig_email      THEN 15 ELSE 0 END) +
      (CASE WHEN sig_address    THEN 10 ELSE 0 END)
    ) >= $2
    ORDER BY match_score DESC, client_id DESC
    LIMIT 10
  `, [clientId, thr]);
  return rows;
}
