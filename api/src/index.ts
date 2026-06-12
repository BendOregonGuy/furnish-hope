// Load .env BEFORE any module that reads process.env. Failing to do this
// means SESSION_SECRET is undefined when session.ts evaluates.
import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { dashboardRouter } from './routes/dashboard.js';
import { clientsRouter } from './routes/clients.js';
import { requestsRouter } from './routes/requests.js';
import { inventoryRouter } from './routes/inventory.js';
import { deliveriesRouter } from './routes/deliveries.js';
import { pickupsRouter } from './routes/pickups.js';
import { volunteersRouter } from './routes/volunteers.js';
import { lookupsRouter } from './routes/lookups.js';
import { adminRouter } from './routes/admin.js';
import { activityRouter } from './routes/activity.js';
import { authRouter } from './routes/auth.js';
import { settingsRouter } from './routes/settings.js';
import { donationsRouter } from './routes/donations.js';
import { pledgesRouter } from './routes/pledges.js';
import { donorsRouter } from './routes/donors.js';
import { campaignsRouter } from './routes/campaigns.js';
import { eventsRouter } from './routes/events.js';
import { emailRouter } from './routes/email.js';
import { emailTemplatesRouter } from './routes/emailTemplates.js';
import { vendorsRouter } from './routes/vendors.js';
import { vendorServicesRouter } from './routes/vendorServices.js';
import { waiversRouter, mountWaiverOnRequests } from './routes/waivers.js';
import { agencyRouter } from './routes/agency.js';
import { quickbooksRouter } from './routes/quickbooks.js';
import { orgInfoRouter } from './routes/orgInfo.js';
import { calendarRouter } from './routes/calendar.js';
import { quickCreateRouter } from './routes/quickCreate.js';
import { shiftsRouter } from './routes/shifts.js';
import { receiptsRouter } from './routes/receipts.js';
import { mailboxRouter } from './routes/mailbox.js';
import { attachmentsRouter } from './routes/attachments.js';
import { reportsRouter } from './routes/reports.js';
import { shiftTemplatesRouter, holidaysRouter } from './routes/shiftTemplates.js';
import { manualRouter } from './routes/manual.js';
import {
  volunteerSignupPublicRouter,
  volunteerSignupsAdminRouter,
} from './routes/volunteerSignup.js';
import { createSessionMiddleware } from './auth/session.js';
import { runAuthMigrations } from './auth/migrations.js';
import { requireUser, requireAdmin, requireStaff } from './auth/middleware.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_PROD = NODE_ENV === 'production';

// Behind DigitalOcean App Platform's load balancer, the real client IP is in
// the `x-forwarded-for` header. Telling Express to trust the first hop makes
// req.ip and the rate-limiter return real client addresses instead of
// 127.0.0.1.
if (IS_PROD) app.set('trust proxy', 1);

app.use(helmet({
  // CSP is configured at the static-host level (Vite in dev, whatever serves
  // index.html in prod). Disabling here keeps Helmet from blocking the API
  // CORS preflight or interfering with dev tools.
  contentSecurityPolicy: false,
}));

// CORS — only meaningful in dev where the Vite server is on a different
// origin. In prod we serve the React bundle from the same Express server, so
// requests are same-origin and CORS doesn't apply.
if (!IS_PROD) {
  app.use(cors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }));
}

// File-attachment uploads ship as base64-encoded JSON, so a 10 MB file
// becomes ~13.4 MB of body. Mount a higher-limit parser scoped to
// /api/attachments BEFORE the global 1 MB parser — Express's body-parser
// is idempotent, and whichever runs first wins. Without this, big
// uploads die with "request entity too large" before the router runs.
app.use('/api/attachments', express.json({ limit: '20mb' }));
// Logo upload — capped at 2MB in the route handler, parser limit a touch higher.
app.use('/api/admin/settings/logo', express.json({ limit: '5mb' }));
// Manual screenshot uploads — base64 of a 2MB image is ~2.7MB; allow some headroom.
app.use('/api/manual/screenshots', express.json({ limit: '5mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(createSessionMiddleware());

// Health check — unauthenticated, so monitoring tools work without creds.
app.get('/api/health', async (_req, res) => res.json({ ok: true }));

// Auth endpoints — login/logout/me/password. Login is unauthenticated by
// definition; the rest handle "no user" themselves.
app.use('/api/auth', authRouter);

// Public volunteer signup — anyone can hit this without logging in.
// Mounted BEFORE the requireUser middleware. Honeypot + IP capture
// + server-side validation guard against abuse.
app.use('/api/volunteer-signup', volunteerSignupPublicRouter);

// Org-info is intentionally public — name + logo show on the
// public volunteer-signup form (and other to-be-public surfaces
// like the waiver-signing letterhead). All operational data is
// still behind requireUser; only the cosmetic identity bits are
// exposed here.
app.use('/api/org-info',   orgInfoRouter);

// Everything below requires a signed-in user.
app.use('/api', requireUser);

// Admin tool requires admin role on top of being signed in. The dedicated
// activity viewer + settings are mounted FIRST so they don't fall through
// to the generic admin router's /:table catch-all.
app.use('/api/admin/activity', requireAdmin, activityRouter);
app.use('/api/admin/settings', requireAdmin, settingsRouter);
app.use('/api/admin/volunteer-signups', requireAdmin, volunteerSignupsAdminRouter);
app.use('/api/admin', requireAdmin, adminRouter);

// (Org-info is mounted above, BEFORE requireUser, so the public
// volunteer-signup form can render org name + logo without login.)

// User manual screenshots — readable by anyone logged in (both
// staff and agency users can view their respective manuals). The
// router enforces requireAdmin on write routes (PUT/DELETE) so
// only admins can upload / replace / remove images.
app.use('/api/manual',     manualRouter);

// Agency caseworker routes — STRICTLY scoped to their own agency.
// All endpoints inside enforce requireAgency at the router level.
app.use('/api/agency',     agencyRouter);

// Everything below is staff-only. Agency users get 403 from
// requireStaff before reaching the route handler — no chance of a
// route author forgetting to scope by agency_id and accidentally
// leaking internal data.
app.use('/api/dashboard',  requireStaff, dashboardRouter);
app.use('/api/clients',    requireStaff, clientsRouter);
mountWaiverOnRequests(requestsRouter);
app.use('/api/requests',   requireStaff, requestsRouter);
app.use('/api/waivers',    requireStaff, waiversRouter);
app.use('/api/inventory',  requireStaff, inventoryRouter);
app.use('/api/deliveries', requireStaff, deliveriesRouter);
app.use('/api/pickups',    requireStaff, pickupsRouter);
app.use('/api/volunteers', requireStaff, volunteersRouter);
app.use('/api/lookups',    requireStaff, lookupsRouter);
app.use('/api/donations',  requireStaff, donationsRouter);
app.use('/api/pledges',    requireStaff, pledgesRouter);
app.use('/api/donors',     requireStaff, donorsRouter);
app.use('/api/vendors',    requireStaff, vendorsRouter);
app.use('/api/vendor-services', requireStaff, vendorServicesRouter);
app.use('/api/campaigns',  requireStaff, campaignsRouter);
app.use('/api/events',     requireStaff, eventsRouter);
app.use('/api/email',      requireStaff, emailRouter);
app.use('/api/email-templates', requireStaff, emailTemplatesRouter);
app.use('/api/calendar',   requireStaff, calendarRouter);
app.use('/api/quick-create', requireStaff, quickCreateRouter);
app.use('/api/shifts',     requireStaff, shiftsRouter);
app.use('/api/receipts',   requireStaff, receiptsRouter);
app.use('/api/mailbox',    requireStaff, mailboxRouter);
app.use('/api/attachments', requireStaff, attachmentsRouter);
app.use('/api/reports',    requireStaff, reportsRouter);
app.use('/api/shift-templates', requireAdmin, shiftTemplatesRouter);
app.use('/api/holidays',        requireAdmin, holidaysRouter);
// QuickBooks integration — admin-only because accounting touches the books.
app.use('/api/quickbooks', requireAdmin, quickbooksRouter);

// 404 for unmatched /api routes (before the static-file fallback so a typo
// like /api/clientx returns JSON, not the HTML index).
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// ---------------------------------------------------------------------------
// Serve the built React bundle. In dev the Vite server handles this on :5173;
// in prod (post-`npm run build`), we serve web/dist from the same Express.
// ---------------------------------------------------------------------------
if (IS_PROD) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // From api/dist/index.js, the web build sits at ../../web/dist.
  const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist');

  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist, {
      // Hashed asset files (Vite outputs JS/CSS with content hashes) can be
      // cached aggressively; the HTML entry must always revalidate.
      setHeaders(res, file) {
        if (file.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));

    // SPA fallback: any non-API request that didn't match a real file gets
    // index.html so React Router can take over.
    app.get('*', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } else {
    console.warn(`[startup] web/dist not found at ${webDist} — frontend will not be served.`);
  }
}

// Error handler — must come AFTER routes.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API error:', err);
  const code = typeof err.status === 'number' ? err.status : 500;
  res.status(code).json({ error: err.message ?? 'Internal error' });
});

// Run migrations BEFORE listening so the first request lands on a ready DB.
runAuthMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Furnish Hope API listening on http://localhost:${PORT} (${NODE_ENV})`);
    });
  })
  .catch((err) => {
    console.error('Auth migrations failed — aborting startup:', err);
    process.exit(1);
  });
