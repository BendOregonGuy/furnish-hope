/**
 * Organizational message send + read (COMMUNICATIONS_DESIGN §13.1).
 *
 *   POST /api/messages/send          staff-initiated send (runs the cascade)
 *   GET  /api/messages?contact_id=X          messages for a contact
 *   GET  /api/messages?context_type=X&context_id=Y   messages on a record
 *   POST /api/messages/:id/mark-reviewed     clear the "unread inbound" flag
 *
 * Mounted under requireStaff in index.ts.
 */

import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { auditCreate } from '../auth/audit.js';
import { sendToContact, type Channel } from '../messaging/send.js';

export const messagesRouter = Router();

interface MessageRow {
  message_id: number;
  direction: string;
  channel: string;
  contact_id: number | null;
  to_address: string;
  from_address: string;
  subject: string | null;
  body_rendered: string;
  sent_at: string;
  delivery_status: string;
  context_type: string | null;
  context_id: number | null;
  context_reference_code: string | null;
  thread_id: number | null;
  reply_to_message_id: number | null;
  reviewed_at: string | null;
}

const MESSAGE_COLUMNS = `
  message_id, direction, channel, contact_id, to_address, from_address, subject,
  body_rendered, sent_at, delivery_status, context_type, context_id,
  context_reference_code, thread_id, reply_to_message_id, reviewed_at
`;

/* ----------------------------------------------------------------- */
/*  POST /send                                                        */
/* ----------------------------------------------------------------- */

interface SendPayload {
  to_contact_id?: number;
  channels?: string[];
  template_id?: number | null;
  body?: string;
  subject?: string | null;
  context_type?: string | null;
  context_id?: number | null;
}

messagesRouter.post('/send', async (req, res, next) => {
  try {
    const b = req.body as SendPayload;
    const contactId = Number(b.to_contact_id);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return res.status(400).json({ error: 'to_contact_id is required' });
    }
    if (!b.body || !String(b.body).trim()) {
      return res.status(400).json({ error: 'body is required' });
    }

    let channels: Channel[] | undefined;
    if (Array.isArray(b.channels)) {
      channels = b.channels.filter((c): c is Channel => c === 'sms' || c === 'email');
      if (channels.length === 0) {
        return res.status(400).json({ error: "channels must include 'sms' and/or 'email'" });
      }
    }

    const outcome = await sendToContact({
      contactId,
      channels,
      body: String(b.body),
      subject: b.subject ?? null,
      context: { type: b.context_type ?? null, id: b.context_id ?? null },
      messageTemplateId: b.template_id ?? null,
      sentByFacilityStaffId: req.user!.facility_staff_id ?? null,
    });

    if (outcome.messageId) {
      await auditCreate(req, 'tbl_message', outcome.messageId, {
        channel: outcome.channel,
        to_contact_id: contactId,
        status: outcome.status,
      });
    }

    // A fallback-only outcome is still a 200 — the send was handled (logged +
    // queued to the fallback inbox); the client shows the reason.
    res.status(outcome.ok || outcome.channel === 'fallback_email' ? 200 : 502).json(outcome);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET / — by contact or by record context                          */
/* ----------------------------------------------------------------- */

messagesRouter.get('/', async (req, res, next) => {
  try {
    const contactId = req.query.contact_id ? Number(req.query.contact_id) : null;
    const contextType = typeof req.query.context_type === 'string' ? req.query.context_type : null;
    const contextId = req.query.context_id ? Number(req.query.context_id) : null;

    if (contactId && Number.isInteger(contactId)) {
      const rows = await query<MessageRow>(
        `SELECT ${MESSAGE_COLUMNS} FROM tbl_message
          WHERE contact_id = $1 ORDER BY sent_at DESC LIMIT 500`,
        [contactId],
      );
      return res.json(rows);
    }
    if (contextType && contextId && Number.isInteger(contextId)) {
      const rows = await query<MessageRow>(
        `SELECT ${MESSAGE_COLUMNS} FROM tbl_message
          WHERE context_type = $1 AND context_id = $2 ORDER BY sent_at DESC LIMIT 500`,
        [contextType, contextId],
      );
      return res.json(rows);
    }
    return res.status(400).json({ error: 'Provide contact_id, or context_type + context_id' });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /:id/mark-reviewed                                           */
/* ----------------------------------------------------------------- */

messagesRouter.post('/:id/mark-reviewed', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const updated = await queryOne<{ message_id: number }>(
      `UPDATE tbl_message
          SET reviewed_at = NOW(), reviewed_by_facility_staff_id = $2
        WHERE message_id = $1
        RETURNING message_id`,
      [id, req.user!.facility_staff_id ?? null],
    );
    if (!updated) return res.status(404).json({ error: 'Message not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
