/**
 * Admin merge-queue API for resolving potential duplicates flagged by the
 * nightly dedup scan. Mounted at /api/admin/duplicates under requireAdmin.
 *
 *   GET    /                  list pending pairs (sorted by score desc)
 *   POST   /scan              run the scan immediately (manual trigger)
 *   GET    /:id               side-by-side compare data for one pair
 *   POST   /:id/merge         atomic merge — keeps one client, deletes the other
 *   POST   /:id/not-duplicate mark the pair as not a duplicate (stays out of future scans)
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate } from '../auth/audit.js';
import { runScan } from '../dedup/scan.js';
import { mergeClients } from '../dedup/merge.js';

export const duplicatesRouter = Router();

/** GET /api/admin/duplicates — pending pairs, scored desc. */
duplicatesRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        d.potential_duplicate_id,
        d.client_id_a, d.client_id_b,
        d.match_score, d.match_reasons,
        d.detected_at,
        (SELECT ca.first_name || ' ' || ca.last_name
           FROM tbl_contact ca
           JOIN tbl_client cla ON cla.contact_id = ca.contact_id
          WHERE cla.client_id = d.client_id_a) AS name_a,
        (SELECT cb.first_name || ' ' || cb.last_name
           FROM tbl_contact cb
           JOIN tbl_client clb ON clb.contact_id = cb.contact_id
          WHERE clb.client_id = d.client_id_b) AS name_b
      FROM tbl_potential_duplicate d
      WHERE d.status = 'pending'
      ORDER BY d.match_score DESC, d.detected_at ASC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

/** POST /api/admin/duplicates/scan — manually trigger the nightly scan now. */
duplicatesRouter.post('/scan', async (req, res, next) => {
  try {
    const summary = await runScan();
    await auditCreate(req, 'dedup_scan', 0, {
      action: 'manual_scan',
      ...summary,
    });
    res.json(summary);
  } catch (err) { next(err); }
});

/** GET /api/admin/duplicates/:id — side-by-side data for the compare view. */
duplicatesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const pair = await queryOne<any>(
      `SELECT * FROM tbl_potential_duplicate WHERE potential_duplicate_id = $1`,
      [id],
    );
    if (!pair) return res.status(404).json({ error: 'Not found' });

    // Pull a compact projection for each side. We hand the same shape to the
    // frontend so the compare grid can just iterate field names.
    const projection = async (clientId: number) => {
      const row = await queryOne(`
        SELECT
          c.client_id,
          contact.first_name || ' ' || contact.last_name AS name,
          contact.birth_date,
          contact.mobile_phone,
          contact.home_phone,
          contact.email,
          addr.address,
          addr.address2,
          city.city, st.state, addr.postalcode,
          (SELECT COUNT(*)::int FROM tbl_referral WHERE client_id = c.client_id)               AS referral_count,
          (SELECT COUNT(*)::int FROM tbl_client_provisioning_request WHERE client_id = c.client_id) AS request_count,
          (SELECT COUNT(*)::int FROM tbl_client_visit WHERE client_id = c.client_id)           AS visit_count,
          (SELECT COUNT(*)::int FROM tbl_client_deliveries WHERE client_id IN
             (SELECT client_id FROM tbl_client_provisioning_request WHERE client_id = c.client_id)) AS delivery_count,
          (SELECT STRING_AGG(ag.agency_name, ', ' ORDER BY ag.agency_name)
             FROM tbl_referral r
             JOIN tbl_agency_contact ac ON ac.agency_contact_id = r.agency_contact_id
             JOIN tbl_agency ag         ON ag.agency_id = ac.agency_id
            WHERE r.client_id = c.client_id) AS referring_agencies,
          (SELECT COALESCE(JSON_AGG(ct.client_type ORDER BY ct.client_type), '[]'::json)
             FROM tbl_client_client_type cct
             JOIN lkp_client_type ct ON ct.client_type_id = cct.client_type_id
            WHERE cct.client_id = c.client_id) AS client_types
        FROM tbl_client c
        JOIN tbl_contact contact ON contact.contact_id = c.contact_id
        LEFT JOIN tbl_address addr ON addr.address_id = contact.address_id
        LEFT JOIN lkp_city city ON city.city_id = addr.city_id
        LEFT JOIN lkp_state st  ON st.state_id  = addr.state_id
        WHERE c.client_id = $1
      `, [clientId]);
      return row;
    };

    const a = await projection(pair.client_id_a);
    const b = await projection(pair.client_id_b);
    res.json({ pair, a, b });
  } catch (err) { next(err); }
});

/** POST /api/admin/duplicates/:id/merge { keep_client_id, merge_client_id }
 *  Atomically reassigns every FK from merge -> keep, deletes the merge row,
 *  flips the pair to status='merged'. */
duplicatesRouter.post('/:id/merge', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const keep  = Number(req.body?.keep_client_id);
    const merge = Number(req.body?.merge_client_id);
    if (!Number.isInteger(keep) || !Number.isInteger(merge)) {
      return res.status(400).json({ error: 'keep_client_id and merge_client_id required' });
    }

    const summary = await withTransaction(async (tx) => {
      const pair = await tx.queryOne<any>(
        `SELECT * FROM tbl_potential_duplicate WHERE potential_duplicate_id = $1 FOR UPDATE`,
        [id],
      );
      if (!pair) { const e: any = new Error('Not found'); e.status = 404; throw e; }
      if (pair.status !== 'pending') {
        const e: any = new Error(`Already resolved as ${pair.status}`); e.status = 409; throw e;
      }
      // Sanity: keep + merge must be the same pair the row represents.
      const ids = new Set([pair.client_id_a, pair.client_id_b]);
      if (!ids.has(keep) || !ids.has(merge) || keep === merge) {
        const e: any = new Error('keep_client_id / merge_client_id must match this pair');
        e.status = 400; throw e;
      }

      // Flip THIS pair's status to merged BEFORE invoking the merge
      // transaction. mergeClients deletes stale pending pairs involving
      // merge_client_id, so a still-pending row for the same pair would
      // be lost. Marking it merged first preserves the audit row.
      await tx.query(`
        UPDATE tbl_potential_duplicate
           SET status = 'merged',
               reviewed_by_user_account_id = $2,
               reviewed_at = NOW(),
               merged_into_client_id = $3
         WHERE potential_duplicate_id = $1
      `, [id, req.user?.user_account_id ?? null, keep]);

      const result = await mergeClients(tx, keep, merge);
      return result;
    });

    await auditCreate(req, 'tbl_client_merge', merge, {
      merged_into_client_id: keep,
      moved: summary.rows_moved_by_table,
    });
    res.json(summary);
  } catch (err) { next(err); }
});

/** POST /api/admin/duplicates/:id/not-duplicate — mark the pair as not
 *  a duplicate so the nightly scan stops re-flagging it. */
duplicatesRouter.post('/:id/not-duplicate', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const pair = await tx.queryOne<any>(
        `SELECT * FROM tbl_potential_duplicate WHERE potential_duplicate_id = $1 FOR UPDATE`,
        [id],
      );
      if (!pair) { const e: any = new Error('Not found'); e.status = 404; throw e; }
      if (pair.status !== 'pending') {
        const e: any = new Error(`Already resolved as ${pair.status}`); e.status = 409; throw e;
      }
      await tx.query(`
        UPDATE tbl_potential_duplicate
           SET status = 'not_duplicate',
               reviewed_by_user_account_id = $2,
               reviewed_at = NOW()
         WHERE potential_duplicate_id = $1
      `, [id, req.user?.user_account_id ?? null]);
    });

    await auditCreate(req, 'tbl_potential_duplicate', id, { action: 'NOT_DUPLICATE' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
