/**
 * IMAP → tbl_email_message sync. For each connected email account
 * owned by the user, fetch new UIDs in the INBOX and Sent folders,
 * parse with mailparser, and cache locally.
 *
 * Idempotent: rerunning is safe because tbl_email_message has a
 * unique index on (user_account_id, message_id_header). Messages
 * that already exist are skipped.
 *
 * Per-account state lives in tbl_email_sync_state — one row per
 * (account, folder) tracking the last UID we saw. Future fetches
 * pull `UID > last_uid` for incremental sync.
 */

import { simpleParser, type AddressObject } from 'mailparser';
import { query, queryOne } from '../db/pool.js';
import { buildImapClient, type EmailAccountRow } from './transports.js';

/** Provider-specific Sent folder names. The order matters — first hit wins. */
const SENT_FOLDER_CANDIDATES = ['Sent', 'INBOX/Sent', '[Gmail]/Sent Mail', 'Sent Items', 'Sent Messages', 'Outbox'];

export interface SyncSummary {
  account_id: number;
  account_email: string;
  inbox_new: number;
  sent_new: number;
  error: string | null;
  inbox_error?: string | null;
  sent_error?: string | null;
}

/**
 * Sync every email account belonging to the user. Returns a per-account
 * summary so the UI can show what landed.
 */
export async function syncAllAccountsForUser(userId: number, opts?: { limit?: number }): Promise<SyncSummary[]> {
  const accounts = await query<EmailAccountRow & { email_address: string }>(`
    SELECT * FROM tbl_email_account WHERE user_account_id = $1 ORDER BY email_account_id
  `, [userId]);

  const summaries: SyncSummary[] = [];
  for (const acct of accounts) {
    try {
      const result = await syncOneAccount(acct, userId, opts);
      summaries.push(result);
    } catch (err: any) {
      summaries.push({
        account_id: acct.email_account_id,
        account_email: acct.email_address,
        inbox_new: 0,
        sent_new: 0,
        error: (err?.message ?? String(err)).slice(0, 300),
      });
    }
  }
  return summaries;
}

async function syncOneAccount(
  acct: EmailAccountRow & { email_address: string },
  userId: number,
  opts?: { limit?: number },
): Promise<SyncSummary> {
  const client = buildImapClient(acct);
  await client.connect();
  try {
    // INBOX first. We bubble errors up via the per-folder error field
    // so the user can see WHY a folder didn't sync (vs the previous
    // behavior where INBOX failures showed as "0 new" with no clue why).
    let inboxNew = 0;
    let inboxError: string | null = null;
    try { inboxNew = await syncFolder(client, acct, userId, 'INBOX', 'in', opts?.limit ?? 100); }
    catch (err: any) {
      inboxError = (err?.message ?? String(err)).slice(0, 300);
      console.error('[email:sync] INBOX failed:', inboxError);
    }

    // Sent folder — try each candidate name until one works.
    let sentNew = 0;
    let sentError: string | null = null;
    let sentMatched = false;
    for (const name of SENT_FOLDER_CANDIDATES) {
      try {
        sentNew = await syncFolder(client, acct, userId, name, 'out', opts?.limit ?? 100);
        sentMatched = true;
        break;
      } catch (err: any) {
        // Try the next candidate. Hold the last error in case nothing matches.
        sentError = (err?.message ?? String(err)).slice(0, 300);
      }
    }
    if (sentMatched) sentError = null;     // success on a later candidate — clear

    return {
      account_id: acct.email_account_id,
      account_email: acct.email_address,
      inbox_new: inboxNew,
      sent_new: sentNew,
      error: null,
      inbox_error: inboxError,
      sent_error: sentMatched ? null : sentError,
    };
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

async function syncFolder(
  client: any,
  acct: EmailAccountRow & { email_address: string },
  userId: number,
  folderName: string,
  direction: 'in' | 'out',
  limit: number,
): Promise<number> {
  const lock = await client.getMailboxLock(folderName);
  try {
    // Where are we? Pull the last-uid cursor for this (account, folder).
    const stateRow = await queryOne<{ last_uid: number }>(`
      SELECT last_uid FROM tbl_email_sync_state
      WHERE email_account_id = $1 AND folder = $2
    `, [acct.email_account_id, folderName]);
    const lastUid = stateRow?.last_uid ?? 0;

    // After getMailboxLock the mailbox is open and client.mailbox holds
    // its current state. uidNext is what the server will assign to the
    // NEXT message; uidNext - 1 is the highest UID currently in the
    // folder. We skip client.search() entirely (which we found
    // unreliable across providers) and fetch the UID range directly.
    const mailbox = client.mailbox;
    const exists  = mailbox?.exists ?? 0;
    const uidNext = Number(mailbox?.uidNext ?? 0);
    const highestUid = uidNext > 0 ? uidNext - 1 : 0;

    console.log(`[email:sync] ${folderName}: exists=${exists}, uidNext=${uidNext}, lastSyncedUid=${lastUid}`);

    if (exists === 0 || highestUid <= lastUid) {
      // Nothing new. Touch last_synced_at so the UI shows "just now."
      await upsertSyncState(acct.email_account_id, folderName, lastUid, null);
      return 0;
    }

    // Compute the UID range to fetch. Cap to the most recent `limit`
    // so a first sync of a huge mailbox doesn't melt the server.
    const fromUid = Math.max(lastUid + 1, highestUid - limit + 1);
    const toUid   = highestUid;
    const range   = `${fromUid}:${toUid}`;

    let imported = 0;
    let maxUid   = lastUid;
    // Third arg {uid: true} tells fetch the sequence set is UIDs, not
    // sequence numbers — critical for incremental sync correctness.
    for await (const msg of client.fetch(
      range,
      { uid: true, source: true, envelope: true, internalDate: true, flags: true },
      { uid: true },
    )) {
      try {
        const parsed = await simpleParser(msg.source as Buffer);
        await persistMessage({
          userId,
          emailAccountId: acct.email_account_id,
          folder: folderName,
          direction,
          imapUid: Number(msg.uid),
          receivedAt: msg.internalDate ? new Date(msg.internalDate) : null,
          parsed,
        });
        if (Number(msg.uid) > maxUid) maxUid = Number(msg.uid);
        imported++;
      } catch (err: any) {
        console.error('[email:sync] message parse failed:', err.message);
      }
    }

    console.log(`[email:sync] ${folderName}: imported ${imported} messages (UID range ${range})`);
    await upsertSyncState(acct.email_account_id, folderName, maxUid, null);
    return imported;
  } finally {
    lock.release();
  }
}

interface PersistArgs {
  userId: number;
  emailAccountId: number;
  folder: string;
  direction: 'in' | 'out';
  imapUid: number | null;
  receivedAt: Date | null;
  parsed: any; // ParsedMail from mailparser
}

async function persistMessage(a: PersistArgs): Promise<void> {
  const p = a.parsed;
  const fromAddr = firstAddress(p.from);
  const toAddrs  = addressList(p.to);
  const ccAddrs  = addressList(p.cc);
  const bccAddrs = addressList(p.bcc);

  const bodyText: string | null = p.text ?? null;
  const bodyHtml: string | null = p.html ?? null;
  const preview = makePreview(bodyText, bodyHtml);
  const messageIdHeader: string | null = p.messageId ?? null;
  const inReplyTo: string | null = p.inReplyTo ?? null;
  const references: string | null = Array.isArray(p.references) ? p.references.join(' ')
    : (typeof p.references === 'string' ? p.references : null);
  const sentAt: Date = p.date ?? a.receivedAt ?? new Date();
  const hasAttachments = Array.isArray(p.attachments) && p.attachments.length > 0;

  await query(`
    INSERT INTO tbl_email_message
      (user_account_id, email_account_id, folder, direction, imap_uid,
       message_id_header, in_reply_to, thread_refs,
       from_address, from_name,
       to_addresses, cc_addresses, bcc_addresses,
       subject, body_text, body_html, body_preview, has_attachments,
       sent_at, received_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    ON CONFLICT (user_account_id, message_id_header) WHERE message_id_header IS NOT NULL
      DO UPDATE SET imap_uid = COALESCE(EXCLUDED.imap_uid, tbl_email_message.imap_uid),
                    folder   = EXCLUDED.folder
  `, [
    a.userId, a.emailAccountId, a.folder, a.direction, a.imapUid,
    messageIdHeader, inReplyTo, references,
    fromAddr.address.toLowerCase(), fromAddr.name,
    toAddrs, ccAddrs, bccAddrs,
    (p.subject ?? '').slice(0, 500),
    bodyText, bodyHtml, preview, hasAttachments,
    sentAt, a.receivedAt,
  ]);
}

async function upsertSyncState(accountId: number, folder: string, lastUid: number, lastError: string | null): Promise<void> {
  await query(`
    INSERT INTO tbl_email_sync_state (email_account_id, folder, last_uid, last_synced_at, last_error)
    VALUES ($1, $2, $3, NOW(), $4)
    ON CONFLICT (email_account_id, folder) DO UPDATE
      SET last_uid = GREATEST(tbl_email_sync_state.last_uid, EXCLUDED.last_uid),
          last_synced_at = NOW(),
          last_error = EXCLUDED.last_error
  `, [accountId, folder, lastUid, lastError]);
}

/* ----------------------------------------------------------------- */
/*  Address helpers                                                   */
/* ----------------------------------------------------------------- */

function firstAddress(field: any): { address: string; name: string | null } {
  const a: AddressObject | undefined = Array.isArray(field) ? field[0] : field;
  if (a && Array.isArray(a.value) && a.value.length > 0) {
    const v = a.value[0];
    return { address: v.address ?? '', name: v.name ?? null };
  }
  return { address: '', name: null };
}

function addressList(field: any): string {
  const a: AddressObject | undefined = Array.isArray(field) ? field[0] : field;
  if (!a || !Array.isArray(a.value)) return '';
  return a.value.map((v: any) => (v.address ?? '').toLowerCase()).filter(Boolean).join(',');
}

function makePreview(text: string | null, html: string | null): string {
  const src = text ?? (html ? stripHtml(html) : '');
  return src.replace(/\s+/g, ' ').trim().slice(0, 280);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/* ----------------------------------------------------------------- */
/*  Record-on-send — call from /api/email/send right after success     */
/* ----------------------------------------------------------------- */

/**
 * Insert a row into tbl_email_message for a message we just sent via
 * SMTP. Means the user sees the sent message in their mailbox/widget
 * immediately, without waiting for the next IMAP sync of the Sent folder.
 * Dedupes against the IMAP-synced copy via message_id_header.
 */
export async function recordSentMessage(args: {
  userId: number;
  emailAccountId: number;
  fromAddress: string;
  fromName?: string | null;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  messageIdHeader: string | null;
  inReplyTo?: string | null;
  hasAttachments: boolean;
}): Promise<void> {
  const preview = makePreview(args.bodyText, args.bodyHtml);
  const toLower = normalizeList(args.to);
  const ccLower = normalizeList(args.cc ?? '');
  const bccLower = normalizeList(args.bcc ?? '');

  await query(`
    INSERT INTO tbl_email_message
      (user_account_id, email_account_id, folder, direction,
       message_id_header, in_reply_to,
       from_address, from_name,
       to_addresses, cc_addresses, bcc_addresses,
       subject, body_text, body_html, body_preview, has_attachments,
       sent_at)
    VALUES ($1, $2, 'Sent', 'out',
            $3, $4,
            $5, $6,
            $7, $8, $9,
            $10, $11, $12, $13, $14,
            NOW())
    ON CONFLICT (user_account_id, message_id_header) WHERE message_id_header IS NOT NULL
      DO NOTHING
  `, [
    args.userId, args.emailAccountId,
    args.messageIdHeader, args.inReplyTo ?? null,
    args.fromAddress.toLowerCase(), args.fromName ?? null,
    toLower, ccLower, bccLower,
    args.subject.slice(0, 500), args.bodyText, args.bodyHtml, preview, args.hasAttachments,
  ]);
}

function normalizeList(s: string): string {
  return s.split(',').map(p => p.trim().toLowerCase()).filter(Boolean).join(',');
}
