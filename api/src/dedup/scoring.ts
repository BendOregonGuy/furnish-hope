/**
 * Shared scoring logic for the "do you mean…?" search and the nightly
 * dedup scan. Both consumers join tbl_client + tbl_contact + tbl_address
 * and let SQL compute a 0-100 score per candidate.
 *
 * Signals (additive, capped at 100):
 *   +40  exact lowered first+last match
 *   +25  trigram similarity on full name > 0.5 (Jane/Janie territory)
 *   +20  birth_date match
 *   +20  phone match (digits-only, ignores formatting)
 *   +15  email match (lowered)
 *   +10  same address_id (post-dedupe, exact place)
 *
 * Returns a list of human-readable reasons alongside the score so the
 * review queue can show "why" without a second query.
 */

export interface DedupQuery {
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;   // 'YYYY-MM-DD'
  mobile_phone?: string | null;
  email?: string | null;
  address_id?: number | null;
}

export interface DedupMatch {
  client_id: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  mobile_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  match_score: number;
  match_reasons: string;
  referral_count: number;
  request_count: number;
}

/** Build the scoring CTE + select. `$1..$6` are positional params in this order:
 *   1 first_name (text), 2 last_name (text), 3 birth_date (date or null),
 *   4 mobile_phone (text or null), 5 email (text or null), 6 address_id (int or null)
 *
 * Caller appends WHERE / LIMIT clauses (e.g. agency-scoped joins). Score
 * threshold is applied by the caller too — search wants ≥ 30, the nightly
 * scan reads it from app_settings.
 */
export function buildScoringSql(extraJoinSql = '', extraWhereSql = ''): string {
  return `
    WITH input AS (
      SELECT
        LOWER(COALESCE($1,''))                                              AS in_first,
        LOWER(COALESCE($2,''))                                              AS in_last,
        NULLIF($3, '')::date                                                AS in_dob,
        REGEXP_REPLACE(COALESCE($4,''), '[^0-9]', '', 'g')                  AS in_phone_digits,
        LOWER(COALESCE($5,''))                                              AS in_email,
        $6::int                                                              AS in_address_id
    ),
    scored AS (
      SELECT
        c.client_id,
        contact.first_name,
        contact.last_name,
        contact.birth_date,
        contact.mobile_phone,
        contact.email,
        addr.address,
        city.city,
        contact.address_id,
        -- Pre-compute signals once
        CASE WHEN LOWER(contact.first_name) = input.in_first
              AND LOWER(contact.last_name)  = input.in_last
              AND input.in_first <> '' AND input.in_last <> ''
             THEN TRUE ELSE FALSE END AS sig_exact_name,
        CASE WHEN input.in_first <> '' AND input.in_last <> ''
              AND similarity(
                    LOWER(contact.first_name || ' ' || contact.last_name),
                    input.in_first || ' ' || input.in_last
                  ) > 0.5
             THEN TRUE ELSE FALSE END AS sig_trgm_name,
        CASE WHEN input.in_dob IS NOT NULL
              AND contact.birth_date = input.in_dob
             THEN TRUE ELSE FALSE END AS sig_dob,
        CASE WHEN input.in_phone_digits <> ''
              AND REGEXP_REPLACE(COALESCE(contact.mobile_phone,''), '[^0-9]', '', 'g') = input.in_phone_digits
             THEN TRUE ELSE FALSE END AS sig_phone,
        CASE WHEN input.in_email <> ''
              AND LOWER(COALESCE(contact.email,'')) = input.in_email
             THEN TRUE ELSE FALSE END AS sig_email,
        CASE WHEN input.in_address_id IS NOT NULL
              AND contact.address_id = input.in_address_id
             THEN TRUE ELSE FALSE END AS sig_address
      FROM tbl_client c
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      LEFT JOIN tbl_address addr ON addr.address_id = contact.address_id
      LEFT JOIN lkp_city city    ON city.city_id    = addr.city_id
      CROSS JOIN input
      ${extraJoinSql}
      ${extraWhereSql}
    )
    SELECT
      s.client_id, s.first_name, s.last_name, s.birth_date, s.mobile_phone,
      s.email, s.address, s.city,
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
          CASE WHEN sig_exact_name THEN 'Exact name'           END,
          CASE WHEN sig_trgm_name  THEN 'Similar name'         END,
          CASE WHEN sig_dob        THEN 'Same date of birth'   END,
          CASE WHEN sig_phone      THEN 'Same phone'           END,
          CASE WHEN sig_email      THEN 'Same email'           END,
          CASE WHEN sig_address    THEN 'Same address'         END
        ], NULL),
        '; '
      ) AS match_reasons,
      (SELECT COUNT(*)::int FROM tbl_referral r2 WHERE r2.client_id = s.client_id)                              AS referral_count,
      (SELECT COUNT(*)::int FROM tbl_client_provisioning_request pr WHERE pr.client_id = s.client_id)           AS request_count
    FROM scored s
  `;
}
