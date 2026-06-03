/**
 * Idempotent schema migrations that run at startup. Add new migrations to
 * the array — they're applied in order, and each one is wrapped so it only
 * runs if the change isn't already present. Safe to run repeatedly.
 */

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { query, queryOne } from '../db/pool.js';

interface Migration {
  name: string;
  run: () => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    name: 'tbl_user_account.is_admin',
    async run() {
      await query(`
        ALTER TABLE tbl_user_account
          ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false
      `);
    },
  },
  {
    name: 'tbl_user_account.is_active default',
    async run() {
      // is_active is NOT NULL in the schema but had no default — make new
      // rows default to active so admin-creating-a-user doesn't blow up.
      await query(`ALTER TABLE tbl_user_account ALTER COLUMN is_active SET DEFAULT true`);
    },
  },
  {
    name: 'tbl_user_account.created_at default',
    async run() {
      await query(`ALTER TABLE tbl_user_account ALTER COLUMN created_at SET DEFAULT NOW()`);
    },
  },
  {
    name: 'tbl_audit_log.action_at default',
    async run() {
      await query(`ALTER TABLE tbl_audit_log ALTER COLUMN action_at SET DEFAULT NOW()`);
    },
  },
  {
    name: 'session table',
    async run() {
      // connect-pg-simple's canonical session table. Creating it ourselves so
      // we know it exists by the time express-session boots.
      await query(`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid"    VARCHAR NOT NULL PRIMARY KEY,
          "sess"   JSON NOT NULL,
          "expire" TIMESTAMP(6) NOT NULL
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);
    },
  },

  // ============================================================
  // Donations expansion v1 (2026-05-29)
  // - app-level settings (configurable from /admin/settings)
  // - per-fiscal-year receipt counter for sequential receipt numbers
  // - 7 new lookup tables (funds, restrictions, payment methods, etc.)
  // - tbl_pledge (commitments separate from gifts)
  // - tbl_donation_designation (split a gift across multiple funds)
  // - tbl_donation_securities + tbl_donation_check (sidecars for stock/check details)
  // - tbl_donation enhanced with payment_method, designations, receipt #,
  //   pledge linkage, soft credit, QBO sync columns, etc.
  // - tbl_donor enhanced with DAF name, employer-match flag, do-not-contact
  // - Seed default rows for all new lookup tables.
  // ============================================================
  {
    name: 'tbl_app_setting',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_app_setting (
          setting_key   VARCHAR(50)  PRIMARY KEY,
          setting_value TEXT NOT NULL,
          description   VARCHAR(200),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by_user_account_id INTEGER
            REFERENCES tbl_user_account(user_account_id)
        )
      `);
    },
  },
  {
    name: 'tbl_receipt_counter',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_receipt_counter (
          fiscal_year  INTEGER PRIMARY KEY,
          next_number  INTEGER NOT NULL DEFAULT 1,
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    },
  },
  {
    name: 'lkp_payment_method',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_payment_method (
          payment_method_id SERIAL PRIMARY KEY,
          payment_method    VARCHAR(50) NOT NULL UNIQUE,
          description       VARCHAR(200)
        )
      `);
      await query(`
        INSERT INTO lkp_payment_method (payment_method, description) VALUES
          ('Cash',            'Physical currency'),
          ('Check',           'Paper check or e-check'),
          ('Credit card',     'Online or in-person card payment'),
          ('ACH / bank transfer', 'Direct bank-to-bank transfer'),
          ('Wire transfer',   'Wire from donor''s bank'),
          ('Stock',           'Gift of publicly-traded shares'),
          ('Bond',            'Gift of bonds or fixed-income securities'),
          ('Cryptocurrency',  'Bitcoin, Ethereum, or other digital asset'),
          ('Real estate',     'Real property gift'),
          ('Other',           'Anything else — note the method in description')
        ON CONFLICT (payment_method) DO NOTHING
      `);
    },
  },
  {
    name: 'lkp_restriction_type',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_restriction_type (
          restriction_type_id SERIAL PRIMARY KEY,
          restriction_type    VARCHAR(50) NOT NULL UNIQUE,
          description         VARCHAR(200)
        )
      `);
      await query(`
        INSERT INTO lkp_restriction_type (restriction_type, description) VALUES
          ('Unrestricted',             'Donor placed no restrictions on use of funds'),
          ('Temporarily restricted',   'Restricted to a specific purpose or time period'),
          ('Permanently restricted',   'Endowment-style; principal preserved in perpetuity')
        ON CONFLICT (restriction_type) DO NOTHING
      `);
    },
  },
  {
    name: 'lkp_fund',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_fund (
          fund_id    SERIAL PRIMARY KEY,
          fund_name  VARCHAR(100) NOT NULL UNIQUE,
          default_restriction_type_id INTEGER
            REFERENCES lkp_restriction_type(restriction_type_id),
          is_active  BOOLEAN NOT NULL DEFAULT true,
          description VARCHAR(200)
        )
      `);
      // Seed with starter funds. Admins can rename, add, or deactivate via the
      // admin tool (or once we ship /admin/settings, the dedicated fund manager).
      await query(`
        INSERT INTO lkp_fund (fund_name, default_restriction_type_id, description) VALUES
          ('General operating',
            (SELECT restriction_type_id FROM lkp_restriction_type WHERE restriction_type='Unrestricted'),
            'Day-to-day operations; rent, payroll, utilities'),
          ('Housing program',
            (SELECT restriction_type_id FROM lkp_restriction_type WHERE restriction_type='Temporarily restricted'),
            'Direct support to households being resettled'),
          ('Furniture program',
            (SELECT restriction_type_id FROM lkp_restriction_type WHERE restriction_type='Temporarily restricted'),
            'Furniture acquisition, storage, and delivery'),
          ('Infrastructure',
            (SELECT restriction_type_id FROM lkp_restriction_type WHERE restriction_type='Temporarily restricted'),
            'Warehouse, vehicles, equipment, software'),
          ('Education program',
            (SELECT restriction_type_id FROM lkp_restriction_type WHERE restriction_type='Temporarily restricted'),
            'Training and education initiatives'),
          ('Capital campaign',
            (SELECT restriction_type_id FROM lkp_restriction_type WHERE restriction_type='Temporarily restricted'),
            'Multi-year fundraising for major projects'),
          ('Volunteer program',
            (SELECT restriction_type_id FROM lkp_restriction_type WHERE restriction_type='Temporarily restricted'),
            'Volunteer recruitment, training, recognition')
        ON CONFLICT (fund_name) DO NOTHING
      `);
    },
  },
  {
    name: 'lkp_pledge_status',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_pledge_status (
          pledge_status_id SERIAL PRIMARY KEY,
          pledge_status    VARCHAR(50) NOT NULL UNIQUE,
          description      VARCHAR(200)
        )
      `);
      await query(`
        INSERT INTO lkp_pledge_status (pledge_status, description) VALUES
          ('Open',                'Pledge made, no payments yet'),
          ('Partially fulfilled', 'Some payments received, more expected'),
          ('Fulfilled',           'Pledge paid in full'),
          ('Lapsed',              'Pledge unpaid past expected fulfillment date'),
          ('Cancelled',           'Pledge withdrawn by donor or written off')
        ON CONFLICT (pledge_status) DO NOTHING
      `);
    },
  },
  {
    name: 'lkp_solicitation_method',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_solicitation_method (
          solicitation_method_id SERIAL PRIMARY KEY,
          solicitation_method    VARCHAR(50) NOT NULL UNIQUE,
          description            VARCHAR(200)
        )
      `);
      await query(`
        INSERT INTO lkp_solicitation_method (solicitation_method, description) VALUES
          ('Direct mail',     'Physical mail appeal'),
          ('Email',           'Email campaign or appeal'),
          ('Phone',           'Phonathon or personal call'),
          ('In-person',       'Face-to-face ask'),
          ('Event',           'Fundraising event'),
          ('Web form',        'Online donation form'),
          ('Word of mouth',   'Referral from friend or family'),
          ('Unsolicited',     'Donor gave without being asked'),
          ('Other',           'Custom — note in description')
        ON CONFLICT (solicitation_method) DO NOTHING
      `);
    },
  },
  {
    name: 'lkp_acknowledgement_status',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_acknowledgement_status (
          acknowledgement_status_id SERIAL PRIMARY KEY,
          acknowledgement_status    VARCHAR(50) NOT NULL UNIQUE,
          description               VARCHAR(200)
        )
      `);
      await query(`
        INSERT INTO lkp_acknowledgement_status (acknowledgement_status, description) VALUES
          ('Not yet sent',    'Acknowledgement letter has not been generated'),
          ('Sent',            'Letter sent and assumed delivered'),
          ('Returned',        'Letter returned undeliverable — address needs update'),
          ('Not required',    'Donor anonymous or amount below threshold')
        ON CONFLICT (acknowledgement_status) DO NOTHING
      `);
    },
  },
  {
    name: 'lkp_donation_type additions',
    async run() {
      // Existing seed: In-kind, Monetary, Mixed. Add the financial-instrument
      // categories. Using ON CONFLICT against the unique-ish name column.
      // If the seed never created a unique index on this column we'll catch
      // it here by checking for the row first.
      const types = ['Stock', 'Bond', 'Real estate', 'Planned gift', 'Cryptocurrency'];
      for (const t of types) {
        const existing = await queryOne<{ id: number }>(
          `SELECT donation_type_id AS id FROM lkp_donation_type WHERE donation_type = $1`, [t],
        );
        if (!existing) {
          await query(`INSERT INTO lkp_donation_type (donation_type) VALUES ($1)`, [t]);
        }
      }
    },
  },
  {
    name: 'lkp_donor_type additions',
    async run() {
      // Existing: Individual, Corporate, Organization, Estate sale, Anonymous.
      // Add donor-source categories needed for foundations/DAFs/etc.
      const types = [
        'Donor-Advised Fund',
        'Private Foundation',
        'Community Foundation',
        'Government Grant',
        'Estate / Planned Gift',
        'Corporate Matching',
      ];
      for (const t of types) {
        const existing = await queryOne<{ id: number }>(
          `SELECT donor_type_id AS id FROM lkp_donor_type WHERE donor_type = $1`, [t],
        );
        if (!existing) {
          await query(`INSERT INTO lkp_donor_type (donor_type) VALUES ($1)`, [t]);
        }
      }
    },
  },
  {
    name: 'tbl_pledge',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_pledge (
          pledge_id  SERIAL PRIMARY KEY,
          donor_id   INTEGER NOT NULL REFERENCES tbl_donor(donor_id),
          fund_id    INTEGER REFERENCES lkp_fund(fund_id),
          total_pledged_amount NUMERIC(12,2) NOT NULL,
          amount_fulfilled     NUMERIC(12,2) NOT NULL DEFAULT 0,
          pledge_date          DATE NOT NULL,
          expected_fulfillment_date DATE,
          pledge_status_id     INTEGER NOT NULL REFERENCES lkp_pledge_status(pledge_status_id),
          solicitation_method_id INTEGER REFERENCES lkp_solicitation_method(solicitation_method_id),
          campaign_id INTEGER, -- forward-ref to tbl_campaign (added in fundraising phase)
          notes      TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id),
          description VARCHAR(100)
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_pledge_donor_id ON tbl_pledge(donor_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_pledge_pledge_status_id ON tbl_pledge(pledge_status_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_pledge_fund_id ON tbl_pledge(fund_id)`);
    },
  },
  {
    name: 'tbl_donation_designation',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_donation_designation (
          donation_designation_id SERIAL PRIMARY KEY,
          donation_id INTEGER NOT NULL REFERENCES tbl_donation(donation_id) ON DELETE CASCADE,
          fund_id     INTEGER NOT NULL REFERENCES lkp_fund(fund_id),
          amount      NUMERIC(12,2) NOT NULL,
          description VARCHAR(100)
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_donation_designation_donation_id ON tbl_donation_designation(donation_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_donation_designation_fund_id ON tbl_donation_designation(fund_id)`);
    },
  },
  {
    name: 'tbl_donation_securities',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_donation_securities (
          donation_securities_id SERIAL PRIMARY KEY,
          donation_id  INTEGER NOT NULL REFERENCES tbl_donation(donation_id) ON DELETE CASCADE,
          security_type VARCHAR(20) NOT NULL, -- 'Stock' | 'Bond' | 'Other'
          ticker       VARCHAR(20),
          security_description VARCHAR(200),
          shares       NUMERIC(15,4),
          gift_date_fmv NUMERIC(12,2),
          sale_proceeds NUMERIC(12,2),
          broker_name  VARCHAR(100)
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_donation_securities_donation_id ON tbl_donation_securities(donation_id)`);
    },
  },
  {
    name: 'tbl_donation_check',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_donation_check (
          donation_check_id SERIAL PRIMARY KEY,
          donation_id  INTEGER NOT NULL REFERENCES tbl_donation(donation_id) ON DELETE CASCADE,
          check_number VARCHAR(20),
          check_date   DATE,
          bank_name    VARCHAR(100)
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_donation_check_donation_id ON tbl_donation_check(donation_id)`);
    },
  },
  {
    name: 'tbl_donation new columns',
    async run() {
      await query(`
        ALTER TABLE tbl_donation
          ADD COLUMN IF NOT EXISTS payment_method_id        INTEGER REFERENCES lkp_payment_method(payment_method_id),
          ADD COLUMN IF NOT EXISTS solicitation_method_id   INTEGER REFERENCES lkp_solicitation_method(solicitation_method_id),
          ADD COLUMN IF NOT EXISTS tax_deductible_amount    NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS acknowledgement_status_id INTEGER REFERENCES lkp_acknowledgement_status(acknowledgement_status_id),
          ADD COLUMN IF NOT EXISTS acknowledgement_sent_date DATE,
          ADD COLUMN IF NOT EXISTS receipt_number           VARCHAR(50),
          ADD COLUMN IF NOT EXISTS pledge_id                INTEGER REFERENCES tbl_pledge(pledge_id),
          ADD COLUMN IF NOT EXISTS soft_credit_contact_id   INTEGER REFERENCES tbl_contact(contact_id),
          ADD COLUMN IF NOT EXISTS gift_in_honor_of         TEXT,
          ADD COLUMN IF NOT EXISTS external_transaction_id  VARCHAR(100),
          ADD COLUMN IF NOT EXISTS received_via             VARCHAR(50),
          ADD COLUMN IF NOT EXISTS campaign_id              INTEGER, -- FK to tbl_campaign in fundraising phase
          ADD COLUMN IF NOT EXISTS qbo_sync_status          VARCHAR(20),
          ADD COLUMN IF NOT EXISTS qbo_transaction_id       VARCHAR(50),
          ADD COLUMN IF NOT EXISTS qbo_last_synced_at       TIMESTAMPTZ
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_donation_payment_method_id ON tbl_donation(payment_method_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_donation_pledge_id ON tbl_donation(pledge_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_donation_receipt_number ON tbl_donation(receipt_number)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_donation_qbo_sync_status ON tbl_donation(qbo_sync_status) WHERE qbo_sync_status IS NOT NULL`);
    },
  },
  {
    name: 'tbl_donor new columns',
    async run() {
      await query(`
        ALTER TABLE tbl_donor
          ADD COLUMN IF NOT EXISTS donor_advised_fund_name   VARCHAR(100),
          ADD COLUMN IF NOT EXISTS employer_match_eligible   BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS do_not_contact            BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS preferred_contact_method_id INTEGER REFERENCES lkp_communication_method(communication_method_id)
      `);
    },
  },
  // ============================================================
  // Phase 4A — Email account connections (per-user)
  // ============================================================
  {
    name: 'tbl_email_account',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_email_account (
          email_account_id SERIAL PRIMARY KEY,
          user_account_id  INTEGER NOT NULL REFERENCES tbl_user_account(user_account_id) ON DELETE CASCADE,
          display_name     VARCHAR(100),
          email_address    VARCHAR(255) NOT NULL,
          provider         VARCHAR(20)  NOT NULL, -- gmail | icloud | outlook | yahoo | proton | imap
          auth_type        VARCHAR(20)  NOT NULL DEFAULT 'password', -- password | oauth (future)
          imap_host        VARCHAR(255),
          imap_port        INTEGER,
          imap_secure      BOOLEAN NOT NULL DEFAULT true,
          smtp_host        VARCHAR(255),
          smtp_port        INTEGER,
          smtp_secure      BOOLEAN NOT NULL DEFAULT true,
          username         VARCHAR(255),
          encrypted_password TEXT, -- AES-256-GCM, base64(iv):base64(tag):base64(ciphertext)
          is_default_send  BOOLEAN NOT NULL DEFAULT false,
          last_tested_at   TIMESTAMPTZ,
          last_test_status VARCHAR(20), -- success | failure
          last_test_error  TEXT,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          description      VARCHAR(100)
        )
      `);
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_email_account_user_email
          ON tbl_email_account (user_account_id, LOWER(email_address))
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_email_account_user ON tbl_email_account(user_account_id)`);
    },
  },

  // ============================================================
  // Phase 2 — Fundraising campaigns + events + donor pipeline
  // ============================================================
  {
    name: 'lkp_campaign_type',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_campaign_type (
          campaign_type_id SERIAL PRIMARY KEY,
          campaign_type    VARCHAR(50) NOT NULL UNIQUE,
          description      VARCHAR(200)
        )
      `);
      await query(`
        INSERT INTO lkp_campaign_type (campaign_type, description) VALUES
          ('Annual fund',     'Yearly unrestricted operating support'),
          ('Capital campaign', 'Major multi-year drive for buildings, vehicles, or expansion'),
          ('Special appeal',  'Time-limited push for a specific need'),
          ('Event-based',     'Fundraising tied to a single event (gala, auction)'),
          ('Peer-to-peer',    'Supporters fundraise on the org''s behalf'),
          ('Planned giving',  'Bequests, estate gifts, charitable trusts'),
          ('Endowment',       'Principal preserved, earnings spent'),
          ('Grant cycle',     'Specific grant proposal or reporting period')
        ON CONFLICT (campaign_type) DO NOTHING
      `);
    },
  },
  {
    name: 'lkp_campaign_status',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_campaign_status (
          campaign_status_id SERIAL PRIMARY KEY,
          campaign_status    VARCHAR(50) NOT NULL UNIQUE,
          description        VARCHAR(200)
        )
      `);
      await query(`
        INSERT INTO lkp_campaign_status (campaign_status, description) VALUES
          ('Planning',  'Being scoped; not yet accepting gifts'),
          ('Active',    'Currently accepting gifts'),
          ('Paused',    'Temporarily not soliciting (e.g. waiting on next milestone)'),
          ('Completed', 'Closed successfully'),
          ('Cancelled', 'Closed before goal was met or before launch')
        ON CONFLICT (campaign_status) DO NOTHING
      `);
    },
  },
  {
    name: 'lkp_donor_stage',
    async run() {
      // Standard major-gifts pipeline. Smaller orgs may only use a couple
      // of stages; bigger ones can model full moves management here.
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_donor_stage (
          donor_stage_id SERIAL PRIMARY KEY,
          donor_stage    VARCHAR(50) NOT NULL UNIQUE,
          stage_order    INTEGER NOT NULL DEFAULT 0,
          description    VARCHAR(200)
        )
      `);
      await query(`
        INSERT INTO lkp_donor_stage (donor_stage, stage_order, description) VALUES
          ('Identification', 10, 'Prospect identified but not yet researched'),
          ('Qualification',  20, 'Researched and confirmed as a real prospect'),
          ('Cultivation',    30, 'Building the relationship; not yet ready to ask'),
          ('Solicitation',   40, 'Currently being asked for a gift'),
          ('Stewardship',    50, 'Gave; now being thanked, retained, upgraded'),
          ('Lapsed',         60, 'Was a donor; hasn''t given in 24+ months')
        ON CONFLICT (donor_stage) DO NOTHING
      `);
    },
  },
  {
    name: 'tbl_campaign',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_campaign (
          campaign_id        SERIAL PRIMARY KEY,
          campaign_name      VARCHAR(150) NOT NULL,
          campaign_type_id   INTEGER NOT NULL REFERENCES lkp_campaign_type(campaign_type_id),
          campaign_status_id INTEGER NOT NULL REFERENCES lkp_campaign_status(campaign_status_id),
          fund_id            INTEGER REFERENCES lkp_fund(fund_id),
          goal_amount        NUMERIC(12,2),
          start_date         DATE,
          end_date           DATE,
          manager_facility_staff_id INTEGER REFERENCES tbl_facility_staff(facility_staff_id),
          public_url         VARCHAR(255),
          notes              TEXT,
          created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id),
          description        VARCHAR(100)
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_campaign_status ON tbl_campaign(campaign_status_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_campaign_type   ON tbl_campaign(campaign_type_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_campaign_fund   ON tbl_campaign(fund_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_campaign_dates  ON tbl_campaign(start_date, end_date)`);
    },
  },
  {
    name: 'tbl_donation.campaign_id FK',
    async run() {
      // Forward-reference column was created in Phase 1 without FK. Add the
      // real FK now that tbl_campaign exists. Wrapped in DO block so it's
      // idempotent on re-runs.
      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'fk_tbl_donation_campaign_id'
          ) THEN
            ALTER TABLE tbl_donation
              ADD CONSTRAINT fk_tbl_donation_campaign_id
              FOREIGN KEY (campaign_id) REFERENCES tbl_campaign(campaign_id);
          END IF;
        END $$
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_donation_campaign_id ON tbl_donation(campaign_id)`);
    },
  },
  {
    name: 'tbl_pledge.campaign_id FK',
    async run() {
      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'fk_tbl_pledge_campaign_id'
          ) THEN
            ALTER TABLE tbl_pledge
              ADD CONSTRAINT fk_tbl_pledge_campaign_id
              FOREIGN KEY (campaign_id) REFERENCES tbl_campaign(campaign_id);
          END IF;
        END $$
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_pledge_campaign_id ON tbl_pledge(campaign_id)`);
    },
  },
  {
    name: 'tbl_event campaign linkage + RSVP enhancements',
    async run() {
      await query(`
        ALTER TABLE tbl_event
          ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES tbl_campaign(campaign_id),
          ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS ticket_price NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS notes TEXT
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_event_campaign_id ON tbl_event(campaign_id)`);
    },
  },
  {
    name: 'tbl_event_attendee check-in + ticket tracking',
    async run() {
      await query(`
        ALTER TABLE tbl_event_attendee
          ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS ticket_count INTEGER NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS notes TEXT
      `);
    },
  },
  {
    name: 'tbl_donor.donor_stage_id',
    async run() {
      await query(`
        ALTER TABLE tbl_donor
          ADD COLUMN IF NOT EXISTS donor_stage_id INTEGER REFERENCES lkp_donor_stage(donor_stage_id),
          ADD COLUMN IF NOT EXISTS stage_notes TEXT,
          ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMPTZ
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_donor_stage_id ON tbl_donor(donor_stage_id)`);
    },
  },

  {
    name: 'tbl_app_setting defaults',
    async run() {
      // Seed only if missing — admins can change these from /admin/settings.
      const defaults: Array<[string, string, string]> = [
        ['fiscal_year_start_month', '1',
          `Month (1-12) when the org's fiscal year begins. 1 = January (calendar year).`],
        ['org_name',                'Furnish Hope',
          'Org name as it appears on receipts.'],
        ['org_address_line1',       '',
          'Mailing address line 1 (for receipts).'],
        ['org_address_line2',       '',
          'Mailing address line 2 (suite, etc).'],
        ['org_city',                'Bend',
          'Org city.'],
        ['org_state',               'OR',
          'Org state / region.'],
        ['org_postalcode',          '',
          'Org ZIP / postal code.'],
        ['org_ein',                 '',
          'Federal Employer Identification Number (XX-XXXXXXX). Required on US tax-deductible receipts.'],
        ['org_phone',               '',
          'Public phone number for receipts.'],
        ['org_email',               '',
          'Public email for receipts and acknowledgement letters.'],
        ['receipt_prefix',          'FH',
          'Prefix on generated receipt numbers, e.g. "FH" produces "FH-2026-0001".'],
        ['acknowledgement_threshold', '250',
          'Donations at or above this amount get a tax-deductible acknowledgement letter (IRS threshold is $250+).'],
      ];
      for (const [key, value, desc] of defaults) {
        await query(`
          INSERT INTO tbl_app_setting (setting_key, setting_value, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (setting_key) DO NOTHING
        `, [key, value, desc]);
      }
    },
  },

  // ============================================================
  // Phase 3 — QuickBooks Online integration
  // ------------------------------------------------------------
  // - tbl_quickbooks_connection: per-org OAuth tokens (encrypted) + realm_id.
  //   Only one row is is_active=true at a time. Connection is org-wide
  //   (accounting is shared) but is_admin-gated.
  // - tbl_quickbooks_account_mapping: which QBO income account each
  //   FH designation/fund maps to. Required before donations can sync.
  // - tbl_quickbooks_donor_link: FH donor ↔ QBO customer. Auto-created
  //   on first donation sync if no row exists.
  // - tbl_quickbooks_donation_sync: per-donation sync history (each sync
  //   attempt is a row). tbl_donation gets qbo_synced_at + qbo_sync_status
  //   + qbo_current_sync_id pointers so the list view doesn't have to
  //   join this table.
  // ============================================================
  {
    name: 'tbl_quickbooks_connection',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_quickbooks_connection (
          qbo_connection_id        SERIAL PRIMARY KEY,
          realm_id                 VARCHAR(50)  NOT NULL,
          environment              VARCHAR(20)  NOT NULL DEFAULT 'production',
          access_token_encrypted   TEXT         NOT NULL,
          refresh_token_encrypted  TEXT         NOT NULL,
          access_token_expires_at  TIMESTAMPTZ  NOT NULL,
          refresh_token_expires_at TIMESTAMPTZ,
          is_active                BOOLEAN      NOT NULL DEFAULT true,
          connected_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id),
          connected_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          last_sync_at             TIMESTAMPTZ,
          last_refresh_at          TIMESTAMPTZ,
          disconnected_at          TIMESTAMPTZ,
          description              VARCHAR(200)
        )
      `);
      // Only one row can be active at a time. Partial unique index lets us
      // keep history of past connections (when someone disconnects and
      // reconnects to a different QBO company).
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_quickbooks_connection_active
          ON tbl_quickbooks_connection (is_active) WHERE is_active = true
      `);
    },
  },
  {
    name: 'tbl_quickbooks_account_mapping',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_quickbooks_account_mapping (
          mapping_id          SERIAL PRIMARY KEY,
          fund_id             INTEGER REFERENCES lkp_fund(fund_id) ON DELETE CASCADE,
          qbo_account_id      VARCHAR(50)  NOT NULL,
          qbo_account_name    VARCHAR(255) NOT NULL,
          qbo_account_type    VARCHAR(50),
          created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          created_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id),
          updated_at          TIMESTAMPTZ
        )
      `);
      // One mapping per fund.
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_quickbooks_account_mapping_fund
          ON tbl_quickbooks_account_mapping (fund_id)
      `);
    },
  },
  {
    name: 'tbl_quickbooks_donor_link',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_quickbooks_donor_link (
          donor_link_id    SERIAL PRIMARY KEY,
          donor_id         INTEGER NOT NULL REFERENCES tbl_donor(donor_id) ON DELETE CASCADE,
          qbo_customer_id  VARCHAR(50)  NOT NULL,
          qbo_customer_display_name VARCHAR(255),
          created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          last_synced_at   TIMESTAMPTZ
        )
      `);
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_quickbooks_donor_link_donor
          ON tbl_quickbooks_donor_link (donor_id)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_quickbooks_donor_link_customer
          ON tbl_quickbooks_donor_link (qbo_customer_id)
      `);
    },
  },
  {
    name: 'tbl_quickbooks_donation_sync',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_quickbooks_donation_sync (
          sync_id                  SERIAL PRIMARY KEY,
          donation_id              INTEGER NOT NULL REFERENCES tbl_donation(donation_id) ON DELETE CASCADE,
          qbo_sales_receipt_id     VARCHAR(50),
          sync_status              VARCHAR(20) NOT NULL,  -- 'pending', 'synced', 'failed', 'skipped'
          attempted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          synced_at                TIMESTAMPTZ,
          attempted_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id),
          error_message            TEXT,
          payload_summary          TEXT
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_quickbooks_donation_sync_donation
          ON tbl_quickbooks_donation_sync (donation_id)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_quickbooks_donation_sync_status_attempted
          ON tbl_quickbooks_donation_sync (sync_status, attempted_at DESC)
      `);
    },
  },
  {
    // Add denormalized sync-state columns to tbl_donation so the list view
    // can show "synced / pending / failed" pills without joining the sync
    // log table. qbo_current_sync_id points to the latest row in
    // tbl_quickbooks_donation_sync; qbo_synced_at is the success timestamp.
    name: 'tbl_donation qbo sync columns',
    async run() {
      await query(`
        ALTER TABLE tbl_donation
          ADD COLUMN IF NOT EXISTS qbo_current_sync_id INTEGER REFERENCES tbl_quickbooks_donation_sync(sync_id),
          ADD COLUMN IF NOT EXISTS qbo_sync_status     VARCHAR(20),
          ADD COLUMN IF NOT EXISTS qbo_synced_at       TIMESTAMPTZ
      `);
    },
  },
  {
    name: 'tbl_app_setting QBO defaults',
    async run() {
      const defaults: Array<[string, string, string]> = [
        ['qbo_auto_sync_donations', 'false',
          'When true, donations sync to QuickBooks automatically on save. When false, sync is manual via the "Sync to QBO" button.'],
        ['qbo_default_payment_method_id', '',
          'QBO Payment Method ID applied to sales receipts. Leave blank to use the QBO default.'],
        ['qbo_default_deposit_account_id', '',
          'QBO Deposit Account ID (Undeposited Funds or a specific bank account). Required for sales receipts; set during initial mapping.'],
        ['qbo_undesignated_account_id', '',
          'QBO income account ID for donations that have no fund designations (e.g. unrestricted gifts). Required if you want to sync undesignated donations.'],
        ['qbo_undesignated_account_name', '',
          'Friendly name of the undesignated income account (denormalized for display).'],
      ];
      for (const [key, value, desc] of defaults) {
        await query(`
          INSERT INTO tbl_app_setting (setting_key, setting_value, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (setting_key) DO NOTHING
        `, [key, value, desc]);
      }
    },
  },

  // ============================================================
  // Anonymity flag (2026-06-01)
  // ------------------------------------------------------------
  // donor_type='Anonymous' used to be doing double duty: a category
  // for "truly unknown gift" AND a way to flag a known donor who
  // wants public anonymity. Splitting them: is_anonymous is the
  // preference flag (known donor, public anonymity), donor_type
  // stays as the category (one placeholder record for unknown gifts).
  //
  // Existing donors with type=Anonymous (other than the seeded
  // placeholder whose contact is literally named "Anonymous Donor")
  // get is_anonymous=true so behavior is preserved for whatever
  // public-facing artifacts honor the flag later.
  // ============================================================
  {
    name: 'tbl_donor.is_anonymous',
    async run() {
      await query(`
        ALTER TABLE tbl_donor
          ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false
      `);
      // One-time backfill: flag any donor currently marked donor_type=Anonymous
      // EXCEPT the seeded placeholder (contact literally named "Anonymous Donor"),
      // which stays as a no-flag category=Anonymous row representing
      // "truly unknown gift". Idempotent — re-running this won't flip the flag
      // back on already-cleared rows because we only flag rows that are still
      // type=Anonymous AND not the placeholder; if you later change a donor's
      // type away from Anonymous the flag stays whatever you set it to.
      await query(`
        UPDATE tbl_donor d
           SET is_anonymous = true
          FROM lkp_donor_type dt
         WHERE d.donor_type_id = dt.donor_type_id
           AND dt.donor_type = 'Anonymous'
           AND d.is_anonymous = false
           AND d.contact_id NOT IN (
             SELECT contact_id FROM tbl_contact
             WHERE LOWER(first_name) = 'anonymous' AND LOWER(last_name) = 'donor'
           )
      `);
    },
  },

  // ============================================================
  // Volunteer shifts (2026-06-02)
  // ------------------------------------------------------------
  // A shift is a scheduled block of work that volunteers (or paid
  // staff) sign up for: pickup crew rotations, warehouse stocking,
  // event support, delivery crew, etc. Each shift has a capacity
  // (how many people are needed) and per-person signups capture
  // attendance + hours.
  //
  // Separate from the pickup/delivery crew assignments — those are
  // tied to specific operational events; shifts are recurring or
  // ad-hoc time blocks that staff fill via signup.
  // ============================================================
  {
    name: 'lkp_shift_type',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_shift_type (
          shift_type_id SERIAL PRIMARY KEY,
          shift_type    VARCHAR(50) NOT NULL UNIQUE,
          description   VARCHAR(200)
        )
      `);
      await query(`
        INSERT INTO lkp_shift_type (shift_type, description) VALUES
          ('Pickup crew',     'Driving + loading at donor homes'),
          ('Delivery crew',   'Driving + delivering furniture to clients'),
          ('Warehouse',       'Receiving, sorting, staging inventory'),
          ('Event support',   'Fundraising or community event staffing'),
          ('Administrative',  'Office, data entry, donor calls'),
          ('Outreach',        'Tabling, recruitment, community visits')
        ON CONFLICT (shift_type) DO NOTHING
      `);
    },
  },
  {
    name: 'lkp_shift_status',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_shift_status (
          shift_status_id SERIAL PRIMARY KEY,
          shift_status    VARCHAR(50) NOT NULL UNIQUE,
          description     VARCHAR(200)
        )
      `);
      await query(`
        INSERT INTO lkp_shift_status (shift_status, description) VALUES
          ('Open',      'Accepting signups'),
          ('Filled',    'Capacity reached'),
          ('Cancelled', 'Shift will not happen'),
          ('Completed', 'Already occurred; finalize attendance')
        ON CONFLICT (shift_status) DO NOTHING
      `);
    },
  },
  {
    name: 'tbl_volunteer_shift',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_volunteer_shift (
          shift_id           SERIAL PRIMARY KEY,
          shift_type_id      INTEGER NOT NULL REFERENCES lkp_shift_type(shift_type_id),
          shift_status_id    INTEGER NOT NULL REFERENCES lkp_shift_status(shift_status_id),
          corp_facility_id   INTEGER REFERENCES tbl_corp_facility(corp_facility_id),
          shift_name         VARCHAR(120),
          shift_date         DATE NOT NULL,
          start_time         TIME,
          end_time           TIME,
          capacity_needed    INTEGER NOT NULL DEFAULT 1,
          notes              TEXT,
          created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id)
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_volunteer_shift_date ON tbl_volunteer_shift(shift_date)`);
    },
  },
  {
    name: 'tbl_volunteer_shift_signup',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_volunteer_shift_signup (
          signup_id          SERIAL PRIMARY KEY,
          shift_id           INTEGER NOT NULL REFERENCES tbl_volunteer_shift(shift_id) ON DELETE CASCADE,
          facility_staff_id  INTEGER NOT NULL REFERENCES tbl_facility_staff(facility_staff_id),
          signup_status      VARCHAR(20) NOT NULL DEFAULT 'signed_up',  -- 'signed_up' | 'cancelled' | 'attended' | 'no_show'
          hours_logged       NUMERIC(5,2),
          notes              VARCHAR(200),
          signed_up_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          signed_up_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id)
        )
      `);
      // A given person can only have one (non-cancelled) signup per shift;
      // re-signing-up after a cancel is fine.
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_volunteer_shift_signup_active
          ON tbl_volunteer_shift_signup (shift_id, facility_staff_id)
          WHERE signup_status <> 'cancelled'
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_volunteer_shift_signup_shift ON tbl_volunteer_shift_signup(shift_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_volunteer_shift_signup_staff ON tbl_volunteer_shift_signup(facility_staff_id)`);
    },
  },

  // ============================================================
  // Email message cache (2026-06-02)
  // ------------------------------------------------------------
  // Local store of sent/received email messages per user. IMAP is
  // too slow to hit on every page view, so we cache headers + body
  // here and refresh on a "Sync" trigger. The cache is per-user
  // (same scoping as tbl_email_account) so one staff member never
  // sees another's private correspondence.
  //
  // Bodies are stored both as text and HTML when both are present.
  // Participant filter (showing "messages with this donor") works
  // by case-insensitive match on from_address / to_addresses.
  // Threading uses Message-Id / In-Reply-To headers; v1 stores the
  // values but doesn't group — that's a follow-up.
  // ============================================================
  {
    name: 'tbl_email_message',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_email_message (
          message_id        SERIAL PRIMARY KEY,
          user_account_id   INTEGER NOT NULL REFERENCES tbl_user_account(user_account_id) ON DELETE CASCADE,
          email_account_id  INTEGER NOT NULL REFERENCES tbl_email_account(email_account_id) ON DELETE CASCADE,
          folder            VARCHAR(40) NOT NULL,    -- 'INBOX' | 'Sent' (provider-specific names allowed)
          direction         VARCHAR(4)  NOT NULL,    -- 'in' | 'out'
          imap_uid          BIGINT,                  -- IMAP UID within the folder; null for locally-recorded sends pre-sync
          message_id_header VARCHAR(998),            -- RFC822 Message-Id (e.g. <abc@gmail.com>)
          in_reply_to       VARCHAR(998),            -- RFC822 In-Reply-To (one message-id)
          thread_refs       TEXT,                    -- space-separated References list (for future threading)
          from_address      VARCHAR(255) NOT NULL,
          from_name         VARCHAR(200),
          to_addresses      TEXT NOT NULL DEFAULT '',  -- comma-separated lowercase
          cc_addresses      TEXT NOT NULL DEFAULT '',
          bcc_addresses     TEXT NOT NULL DEFAULT '',
          subject           VARCHAR(500),
          body_text         TEXT,
          body_html         TEXT,
          body_preview      VARCHAR(300),
          has_attachments   BOOLEAN NOT NULL DEFAULT false,
          sent_at           TIMESTAMPTZ NOT NULL,    -- Date header; for outbound this is when we sent
          received_at       TIMESTAMPTZ,             -- when IMAP says it landed (inbound only)
          cached_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      // Dedupe by message-id-header per user. A single message can land
      // in INBOX and Sent (own-sends with sent-to-self), so don't include
      // folder in the unique key.
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_email_message_dedup
          ON tbl_email_message (user_account_id, message_id_header)
          WHERE message_id_header IS NOT NULL
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_email_message_user_sent ON tbl_email_message(user_account_id, sent_at DESC)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_email_message_account_uid ON tbl_email_message(email_account_id, folder, imap_uid)`);
      // Participant lookup — used by the per-entity widget. Stored
      // lowercase so a single ILIKE works without a function index.
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_email_message_from_lc ON tbl_email_message(user_account_id, LOWER(from_address))`);
    },
  },
  {
    name: 'tbl_email_sync_state',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_email_sync_state (
          sync_state_id      SERIAL PRIMARY KEY,
          email_account_id   INTEGER NOT NULL REFERENCES tbl_email_account(email_account_id) ON DELETE CASCADE,
          folder             VARCHAR(40) NOT NULL,
          last_uid           BIGINT NOT NULL DEFAULT 0,
          last_synced_at     TIMESTAMPTZ,
          last_error         TEXT
        )
      `);
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_email_sync_state_account_folder
          ON tbl_email_sync_state (email_account_id, folder)
      `);
    },
  },
];

/** Run every migration, then ensure there's an initial admin user. */
export async function runAuthMigrations(): Promise<void> {
  for (const m of MIGRATIONS) {
    try {
      await m.run();
    } catch (err: any) {
      console.error(`Migration "${m.name}" failed:`, err.message);
      throw err;
    }
  }

  await ensureInitialAdmin();
}

/**
 * If there is no admin in the system, create one and print the temporary
 * password to the console. Runs on fresh installs (no users) AND on
 * existing installs that pre-date the is_admin column (the demo seed
 * data has no admins). The password is unique per-installation and the
 * admin must change it on first login.
 */
async function ensureInitialAdmin(): Promise<void> {
  const existing = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM tbl_user_account WHERE is_admin = true`,
  );
  if (Number(existing?.count ?? 0) > 0) return;

  // Pick a username that doesn't collide with existing demo users.
  const desiredName = await pickAvailableUsername('admin');
  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 10);

  await query(`
    INSERT INTO tbl_user_account (username, password_hash, is_active, is_admin)
    VALUES ($1, $2, true, true)
  `, [desiredName, hash]);

  const banner = '*'.repeat(72);
  console.log('\n' + banner);
  console.log('INITIAL ADMIN ACCOUNT CREATED');
  console.log(`  Username: ${desiredName}`);
  console.log(`  Temporary password: ${tempPassword}`);
  console.log('  CHANGE THIS PASSWORD on first login.');
  console.log(banner + '\n');
}

/** Return the requested username if it's free, otherwise append a number. */
async function pickAvailableUsername(base: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const taken = await queryOne<{ id: number }>(
      `SELECT user_account_id AS id FROM tbl_user_account WHERE username = $1`,
      [candidate],
    );
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** A readable temp password — three short syllables + 3 digits. Easy to
 *  type from a console but still high-entropy enough to not be guessed. */
function generateTempPassword(): string {
  const syllables = ['cas', 'mor', 'len', 'tor', 'pin', 'val', 'sun', 'ash', 'jun', 'rey', 'tan', 'oak', 'mes', 'fal', 'win', 'kel'];
  const pick = () => syllables[crypto.randomInt(0, syllables.length)];
  const digits = crypto.randomInt(100, 999);
  return `${pick()}-${pick()}-${pick()}-${digits}`;
}
