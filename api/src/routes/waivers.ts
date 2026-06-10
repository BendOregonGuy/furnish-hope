/**
 * Client Furniture Waiver — signing + PDF + retrieval.
 *
 *   GET    /api/waivers/template                 the current template (for the signing page)
 *   GET    /api/waivers/template/:id             a specific version (lookup for past sigs)
 *   GET    /api/requests/:id/waiver              the signed waiver record for a request (or 404)
 *   POST   /api/requests/:id/waiver              sign it: typed name + signature image
 *                                                + checkbox confirmation. Generates the PDF,
 *                                                stores as attachment, returns waiver id.
 *   GET    /api/waivers/:id/pdf                  stream the stored PDF (for in-app viewing)
 *   DELETE /api/requests/:id/waiver              un-sign (admin only — clears the record
 *                                                so the client can re-sign a corrected
 *                                                version)
 *
 * Signing collects a defensible audit trail: typed legal name, drawn
 * signature image, server-stamped timestamp, IP, user-agent, witness
 * (the logged-in staff member). No CAPTCHA — the multi-layer
 * verification above produces a stronger evidence record than a bot
 * check ever could.
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete } from '../auth/audit.js';
import { requireAdmin } from '../auth/middleware.js';
import { generateWaiverPdf, type WaiverPdfData } from '../waivers/generate.js';
import { getDefaultProvider, getProvider } from '../storage/index.js';

export const waiversRouter = Router();

/* ----------------------------------------------------------------- */
/*  GET /api/waivers/template — the current template                  */
/* ----------------------------------------------------------------- */

waiversRouter.get('/template', async (_req, res, next) => {
  try {
    const row = await queryOne(`
      SELECT waiver_template_id, title, subtitle, body_markdown, version_label, created_at
      FROM tbl_waiver_template
      WHERE is_current = true
      LIMIT 1
    `);
    if (!row) return res.status(404).json({ error: 'No current waiver template set.' });
    res.json(row);
  } catch (err) { next(err); }
});

waiversRouter.get('/template/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const row = await queryOne(`
      SELECT waiver_template_id, title, subtitle, body_markdown, version_label, created_at
      FROM tbl_waiver_template
      WHERE waiver_template_id = $1
    `, [id]);
    if (!row) return res.status(404).json({ error: 'Template version not found' });
    res.json(row);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /api/waivers/:id/pdf — stream the signed PDF                  */
/* ----------------------------------------------------------------- */

waiversRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const row = await queryOne<{
      pdf_attachment_id: number | null;
      client_name: string;
    }>(`
      SELECT w.pdf_attachment_id,
             contact.first_name || ' ' || contact.last_name AS client_name
      FROM tbl_client_waiver w
      JOIN tbl_client c   ON c.client_id = w.client_id
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      WHERE w.waiver_id = $1
    `, [id]);
    if (!row || !row.pdf_attachment_id) return res.status(404).json({ error: 'Signed PDF not on file.' });

    const meta = await queryOne<{
      filename: string;
      content_type: string;
      storage_provider: string;
      storage_ref: string;
    }>(`
      SELECT filename, content_type, storage_provider, storage_ref
      FROM tbl_entity_attachment
      WHERE attachment_id = $1
    `, [row.pdf_attachment_id]);
    if (!meta) return res.status(404).json({ error: 'Stored PDF missing.' });

    const storage = getProvider(meta.storage_provider);
    const bytes = await storage.get(meta.storage_ref);
    res.setHeader('Content-Type', meta.content_type || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(meta.filename)}`);
    res.send(bytes);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Per-request endpoints                                              */
/*  Mounted at /api/requests/:id/waiver via the helper below          */
/* ----------------------------------------------------------------- */

export function mountWaiverOnRequests(router: Router) {
  /* GET — the signed waiver for this request (or null) */
  router.get('/:id/waiver', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
      const w = await queryOne(`
        SELECT
          w.waiver_id,
          w.client_provisioning_request_id,
          w.client_id,
          w.waiver_template_id,
          w.typed_legal_name,
          w.signed_at,
          w.ip_address,
          w.user_agent,
          w.witness_user_account_id,
          w.pdf_attachment_id,
          wt.version_label AS template_version,
          witness_user.username AS witness_username
        FROM tbl_client_waiver w
        JOIN tbl_waiver_template wt ON wt.waiver_template_id = w.waiver_template_id
        LEFT JOIN tbl_user_account witness_user ON witness_user.user_account_id = w.witness_user_account_id
        WHERE w.client_provisioning_request_id = $1
      `, [id]);
      res.json(w ?? null);
    } catch (err) { next(err); }
  });

  /* POST — sign it */
  router.post('/:id/waiver', async (req, res, next) => {
    try {
      const reqId = Number(req.params.id);
      if (!Number.isInteger(reqId) || reqId <= 0) return res.status(400).json({ error: 'Invalid request id' });

      const body = req.body as {
        typed_legal_name?: string;
        signature_image_base64?: string;   // raw PNG, base64-encoded (no data: prefix needed)
        agreed?: boolean;                  // checkbox confirmation
      };

      // Validation — the four pillars of consent.
      const errs: string[] = [];
      if (!body.typed_legal_name || body.typed_legal_name.trim().length < 2) errs.push('Typed legal name is required.');
      if (!body.signature_image_base64) errs.push('Signature is required — please sign in the box.');
      if (!body.agreed) errs.push('You must check "I have read and agree" to sign.');
      if (errs.length) return res.status(400).json({ error: errs.join(' ') });

      // Strip data: prefix if present, then decode.
      const b64 = body.signature_image_base64!.replace(/^data:[^,]+,/, '');
      const sigBuf = Buffer.from(b64, 'base64');
      if (sigBuf.length === 0) return res.status(400).json({ error: 'Signature image is empty.' });
      if (sigBuf.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Signature image too large (2MB max).' });

      // Look up the request + client + template + org info we need
      // for the PDF.
      const reqRow = await queryOne<any>(`
        SELECT
          r.client_provisioning_request_id AS request_id,
          r.client_id,
          r.request_at,
          contact.first_name || ' ' || contact.last_name AS client_name,
          addr.address,
          city.city,
          st.state AS state,
          addr.postalcode
        FROM tbl_client_provisioning_request r
        JOIN tbl_client c ON c.client_id = r.client_id
        JOIN tbl_contact contact ON contact.contact_id = c.contact_id
        LEFT JOIN tbl_address addr ON addr.address_id = contact.address_id
        LEFT JOIN lkp_city city   ON city.city_id     = addr.city_id
        LEFT JOIN lkp_state st    ON st.state_id      = addr.state_id
        WHERE r.client_provisioning_request_id = $1
      `, [reqId]);
      if (!reqRow) return res.status(404).json({ error: 'Provisioning request not found.' });

      const template = await queryOne<any>(`
        SELECT waiver_template_id, title, subtitle, body_markdown, version_label
        FROM tbl_waiver_template WHERE is_current = true LIMIT 1
      `);
      if (!template) return res.status(500).json({ error: 'No current waiver template is configured.' });

      // Pull org letterhead fields from tbl_app_setting (already used
      // by manifests + receipts).
      const orgRows = await query<{ setting_key: string; setting_value: string }>(`
        SELECT setting_key, setting_value FROM tbl_app_setting
        WHERE setting_key IN (
          'org_name','org_address_line1','org_address_line2',
          'org_city','org_state','org_postalcode','org_phone','org_email'
        )
      `);
      const org: Record<string, string> = {};
      for (const r of orgRows) org[r.setting_key] = r.setting_value ?? '';

      const witness = req.user!;
      const signedAt = new Date();
      const ipAddr = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() || req.socket.remoteAddress || null;
      const userAgent = req.headers['user-agent'] ?? null;

      // Generate the PDF.
      const pdfData: WaiverPdfData = {
        org: {
          name:         org.org_name         || 'Furnish Hope',
          address_line1: org.org_address_line1 || '',
          address_line2: org.org_address_line2 || '',
          city:         org.org_city         || '',
          state:        org.org_state        || '',
          postalcode:   org.org_postalcode   || '',
          phone:        org.org_phone        || '',
          email:        org.org_email        || '',
        },
        client: {
          name:       reqRow.client_name,
          address:    reqRow.address,
          city:       reqRow.city,
          state:      reqRow.state,
          postalcode: reqRow.postalcode,
        },
        template: {
          title:         template.title,
          subtitle:      template.subtitle,
          body_markdown: template.body_markdown,
          version_label: template.version_label,
        },
        signing: {
          typed_legal_name:    body.typed_legal_name!.trim(),
          signature_image_png: sigBuf,
          signed_at:           signedAt,
          ip_address:          ipAddr,
          user_agent:          userAgent,
          witness_name:        witness.display_name || witness.username,
        },
        request: {
          request_id: reqRow.request_id,
          request_at: new Date(reqRow.request_at),
        },
      };
      const pdfBuffer = await generateWaiverPdf(pdfData);

      // Persist: waiver row + PDF attachment (atomic). If the request
      // already has a waiver, replace it (delete cascade-detaches the
      // old attachment too).
      const waiverId = await withTransaction(async (tx) => {
        const existing = await tx.queryOne<{ waiver_id: number; pdf_attachment_id: number | null }>(
          `SELECT waiver_id, pdf_attachment_id FROM tbl_client_waiver WHERE client_provisioning_request_id = $1`,
          [reqId],
        );
        if (existing) {
          // Clear the old PDF attachment first so we don't leak rows.
          if (existing.pdf_attachment_id) {
            await tx.query(`DELETE FROM tbl_entity_attachment WHERE attachment_id = $1`, [existing.pdf_attachment_id]);
          }
          await tx.query(`DELETE FROM tbl_client_waiver WHERE waiver_id = $1`, [existing.waiver_id]);
        }

        // Insert the PDF as an attachment on the request first; we
        // need its id to backfill onto the waiver row.
        const storage = await getDefaultProvider();
        const filename = `Waiver_Request_${reqId}_${signedAt.toISOString().slice(0, 10)}.pdf`;
        const stored = await storage.put({ bytes: pdfBuffer, mimeType: 'application/pdf', filename });

        const attach = await tx.queryOne<{ attachment_id: number }>(`
          INSERT INTO tbl_entity_attachment
            (entity_type, entity_id, filename, content_type, size_bytes,
             storage_provider, storage_ref, uploaded_by_user_account_id)
          VALUES ('request', $1, $2, 'application/pdf', $3, $4, $5, $6)
          RETURNING attachment_id
        `, [reqId, filename, pdfBuffer.length, storage.name, stored.ref, witness.user_account_id]);

        const wRow = await tx.queryOne<{ waiver_id: number }>(`
          INSERT INTO tbl_client_waiver
            (client_provisioning_request_id, client_id, waiver_template_id,
             typed_legal_name, signature_image, signed_at,
             ip_address, user_agent, witness_user_account_id, pdf_attachment_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING waiver_id
        `, [
          reqId, reqRow.client_id, template.waiver_template_id,
          body.typed_legal_name!.trim(),
          sigBuf,
          signedAt,
          ipAddr,
          userAgent,
          witness.user_account_id,
          attach!.attachment_id,
        ]);

        await auditCreate(req, 'tbl_client_waiver', wRow!.waiver_id, {
          request_id: reqId,
          typed_legal_name: body.typed_legal_name,
          ip_address: ipAddr,
          witness: witness.username,
        }, tx);

        return wRow!.waiver_id;
      });

      res.status(201).json({ waiver_id: waiverId });
    } catch (err) { next(err); }
  });

  /* DELETE — admin-only un-sign so the client can re-sign */
  router.delete('/:id/waiver', requireAdmin, async (req, res, next) => {
    try {
      const reqId = Number(req.params.id);
      if (!Number.isInteger(reqId) || reqId <= 0) return res.status(400).json({ error: 'Invalid id' });

      await withTransaction(async (tx) => {
        const existing = await tx.queryOne<{ waiver_id: number; pdf_attachment_id: number | null }>(
          `SELECT waiver_id, pdf_attachment_id FROM tbl_client_waiver WHERE client_provisioning_request_id = $1`,
          [reqId],
        );
        if (!existing) { const e: any = new Error('No waiver on file'); e.status = 404; throw e; }

        if (existing.pdf_attachment_id) {
          await tx.query(`DELETE FROM tbl_entity_attachment WHERE attachment_id = $1`, [existing.pdf_attachment_id]);
        }
        await tx.query(`DELETE FROM tbl_client_waiver WHERE waiver_id = $1`, [existing.waiver_id]);
        await auditDelete(req, 'tbl_client_waiver', existing.waiver_id, { request_id: reqId }, tx);
      });

      res.json({ ok: true });
    } catch (err) { next(err); }
  });
}
