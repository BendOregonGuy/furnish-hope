/**
 * Communications settings API (COMMUNICATIONS_DESIGN §10, §13.1). Mounted at
 * /api/settings/communications under requireAdmin in index.ts.
 *
 *   GET/PUT  /sms-provider          + POST /sms-provider/test
 *   GET/PUT  /org-email             + POST /org-email/test
 *   GET/PUT  /fallback-inbox
 *
 * Secrets are write-only from the UI: GET never returns them (just a "set"
 * boolean), and PUT only overwrites a secret when a non-empty value is sent.
 */

import { Router } from 'express';
import type { Request } from 'express';
import { auditCreate } from '../auth/audit.js';
import {
  getSmsSettingsPublic, setSmsSettings,
  getOrgEmailSettingsPublic, setOrgEmailSettings,
  getFallbackInbox, setFallbackInbox,
} from '../messaging/settings.js';
import { getSmsProvider } from '../messaging/sms/index.js';
import { sendOrgEmail, verifyOrgEmail } from '../messaging/email/org-email.js';

export const communicationsSettingsRouter = Router();

function userId(req: Request): number | null {
  return req.user?.user_account_id ?? null;
}

async function noteAudit(req: Request, area: string, keys: string[]): Promise<void> {
  // Record THAT settings changed without mirroring secret values into audit
  // storage. entity_id 0 is a settings surrogate (same convention as the
  // generic settings route).
  await auditCreate(req, 'tbl_app_setting', 0, { communications: area, changed: keys });
}

/* ------------------------- SMS provider ------------------------- */

communicationsSettingsRouter.get('/sms-provider', async (_req, res, next) => {
  try {
    res.json(await getSmsSettingsPublic());
  } catch (err) { next(err); }
});

communicationsSettingsRouter.put('/sms-provider', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const update = {
      provider: typeof b.provider === 'string' ? b.provider : undefined,
      from_phone: b.from_phone !== undefined ? String(b.from_phone ?? '') : undefined,
      enabled: typeof b.enabled === 'boolean' ? b.enabled : undefined,
      account_sid: b.account_sid !== undefined ? b.account_sid : undefined,
      auth_token: b.auth_token !== undefined ? b.auth_token : undefined,
      webhook_secret: b.webhook_secret !== undefined ? b.webhook_secret : undefined,
    };
    await setSmsSettings(update, userId(req));
    await noteAudit(req, 'sms-provider', Object.keys(b));
    res.json(await getSmsSettingsPublic());
  } catch (err) { next(err); }
});

communicationsSettingsRouter.post('/sms-provider/test', async (req, res, next) => {
  try {
    const to = String(req.body?.to ?? '').trim();
    if (!to) return res.status(400).json({ error: 'A destination phone number is required.' });
    const provider = await getSmsProvider();
    if (!provider) return res.status(400).json({ error: 'Save valid Twilio credentials before testing.' });
    const result = await provider.send(to, 'Furnish Hope — test message. Your SMS integration is working.');
    if (!result.ok) return res.status(502).json({ ok: false, error: result.errorMessage ?? 'Send failed', code: result.errorCode });
    res.json({ ok: true, provider_message_id: result.providerMessageId, status: result.status });
  } catch (err) { next(err); }
});

/* ------------------------- Org email ------------------------- */

communicationsSettingsRouter.get('/org-email', async (_req, res, next) => {
  try {
    res.json(await getOrgEmailSettingsPublic());
  } catch (err) { next(err); }
});

communicationsSettingsRouter.put('/org-email', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    await setOrgEmailSettings({
      smtp_host: b.smtp_host !== undefined ? String(b.smtp_host ?? '') : undefined,
      smtp_port: b.smtp_port !== undefined ? b.smtp_port : undefined,
      smtp_username: b.smtp_username !== undefined ? String(b.smtp_username ?? '') : undefined,
      smtp_password: b.smtp_password !== undefined ? b.smtp_password : undefined,
      smtp_use_tls: typeof b.smtp_use_tls === 'boolean' ? b.smtp_use_tls : undefined,
      from_address: b.from_address !== undefined ? String(b.from_address ?? '') : undefined,
      from_display_name: b.from_display_name !== undefined ? String(b.from_display_name ?? '') : undefined,
      reply_domain: b.reply_domain !== undefined ? String(b.reply_domain ?? '') : undefined,
      enabled: typeof b.enabled === 'boolean' ? b.enabled : undefined,
    }, userId(req));
    await noteAudit(req, 'org-email', Object.keys(b));
    res.json(await getOrgEmailSettingsPublic());
  } catch (err) { next(err); }
});

communicationsSettingsRouter.post('/org-email/test', async (req, res, next) => {
  try {
    const to = req.body?.to ? String(req.body.to).trim() : '';
    if (to) {
      const result = await sendOrgEmail({
        to,
        subject: 'Furnish Hope — test email',
        bodyText: 'This is a test of the Furnish Hope organizational email settings. If you received it, sending works.',
      });
      if (!result.ok) return res.status(502).json({ ok: false, error: result.errorMessage ?? 'Send failed' });
      return res.json({ ok: true, provider_message_id: result.providerMessageId });
    }
    // No recipient — just verify the SMTP connection.
    await verifyOrgEmail();
    res.json({ ok: true, verified: true });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message ?? 'Connection test failed' });
  }
});

/* ------------------------- Fallback inbox ------------------------- */

communicationsSettingsRouter.get('/fallback-inbox', async (_req, res, next) => {
  try {
    res.json({ email: await getFallbackInbox() });
  } catch (err) { next(err); }
});

communicationsSettingsRouter.put('/fallback-inbox', async (req, res, next) => {
  try {
    const email = req.body?.email !== undefined ? String(req.body.email ?? '').trim() : '';
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    await setFallbackInbox(email, userId(req));
    await noteAudit(req, 'fallback-inbox', ['messaging.fallback_inbox']);
    res.json({ email: await getFallbackInbox() });
  } catch (err) { next(err); }
});
