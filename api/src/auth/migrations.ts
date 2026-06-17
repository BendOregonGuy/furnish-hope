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

  // ============================================================
  // Per-entity attachments (2026-06-02)
  // ------------------------------------------------------------
  // Generic "documents attached to a thing" system. Each row points
  // at any entity by (entity_type, entity_id) — donor, client,
  // pickup, delivery, campaign, etc. — and references a blob via a
  // pluggable storage provider.
  //
  // The metadata row is tiny (just the index info + provider ref).
  // The actual bytes live in a separate table (tbl_attachment_blob,
  // Phase 1 / pg_blob provider) OR — in future — in object storage
  // (DO Spaces, S3, Drive). To migrate, copy each blob to the new
  // store and rewrite the metadata row's storage_provider +
  // storage_ref; no data-shape changes needed.
  // ============================================================
  {
    name: 'tbl_entity_attachment',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_entity_attachment (
          attachment_id     SERIAL PRIMARY KEY,
          entity_type       VARCHAR(40)  NOT NULL,   -- 'donor'|'client'|'volunteer'|'contact'|...
          entity_id         INTEGER      NOT NULL,
          filename          VARCHAR(255) NOT NULL,
          mime_type         VARCHAR(150) NOT NULL,
          size_bytes        BIGINT       NOT NULL,
          description       VARCHAR(500),
          storage_provider  VARCHAR(40)  NOT NULL,   -- 'pg_blob' | 'do_spaces' | 's3' | 'gdrive' | …
          storage_ref       TEXT         NOT NULL,   -- provider-specific (blob_id, object key, …)
          external_url      TEXT,                    -- "Open in Drive" link, etc.
          uploaded_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id),
          uploaded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          last_modified_at  TIMESTAMPTZ
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_entity_attachment_entity ON tbl_entity_attachment (entity_type, entity_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_entity_attachment_provider ON tbl_entity_attachment (storage_provider)`);
    },
  },
  {
    name: 'tbl_attachment_blob',
    async run() {
      // Phase 1 storage. Separate from the metadata table so the
      // metadata index stays slim and so a future migration can drain
      // this table progressively without locking the metadata.
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_attachment_blob (
          blob_id SERIAL PRIMARY KEY,
          content BYTEA NOT NULL
        )
      `);
    },
  },

  // ============================================================
  // Shift templates + holidays (2026-06-02)
  // ------------------------------------------------------------
  // Recurring-shift scaffolding. Admin defines templates ("Weekday
  // AM Warehouse: Mon-Fri 8-12, capacity 3"); a Generate button
  // creates actual shift rows for a date range, skipping holidays
  // for templates that opt in. Generated shifts are normal rows —
  // editable, cancellable, signup-able as usual.
  //
  // day_of_week_mask uses bit positions where bit 0 = Sunday,
  // bit 1 = Monday, …, bit 6 = Saturday. Mon-Fri = 0b0111110 = 62.
  // Saturday only = 0b1000000 = 64. Weekend = 0b1000001 = 65.
  // ============================================================
  {
    name: 'tbl_shift_template',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_shift_template (
          shift_template_id SERIAL PRIMARY KEY,
          template_name     VARCHAR(120) NOT NULL,
          shift_type_id     INTEGER NOT NULL REFERENCES lkp_shift_type(shift_type_id),
          corp_facility_id  INTEGER REFERENCES tbl_corp_facility(corp_facility_id),
          shift_name        VARCHAR(120),
          start_time        TIME,
          end_time          TIME,
          capacity_needed   INTEGER NOT NULL DEFAULT 1,
          notes             TEXT,
          day_of_week_mask  SMALLINT NOT NULL DEFAULT 0,
          skip_holidays     BOOLEAN  NOT NULL DEFAULT true,
          is_active         BOOLEAN  NOT NULL DEFAULT true,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id)
        )
      `);
    },
  },
  {
    name: 'tbl_volunteer_shift.shift_template_id',
    async run() {
      // Track which template (if any) a generated shift came from. Lets the
      // UI label generated shifts ("from Weekday AM Warehouse") and
      // prevents duplicate generation for the same (template, date).
      await query(`
        ALTER TABLE tbl_volunteer_shift
          ADD COLUMN IF NOT EXISTS shift_template_id INTEGER REFERENCES tbl_shift_template(shift_template_id) ON DELETE SET NULL
      `);
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_volunteer_shift_template_date
          ON tbl_volunteer_shift (shift_template_id, shift_date)
          WHERE shift_template_id IS NOT NULL
      `);
    },
  },
  {
    name: 'tbl_holiday',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_holiday (
          holiday_id   SERIAL PRIMARY KEY,
          holiday_date DATE NOT NULL UNIQUE,
          holiday_name VARCHAR(120) NOT NULL,
          is_active    BOOLEAN NOT NULL DEFAULT true,
          notes        VARCHAR(200)
        )
      `);
    },
  },
  {
    name: 'seed federal holidays',
    async run() {
      // Federal holidays for the current calendar year and the next two.
      // Picked at run time so a fresh install gets coverage regardless
      // of when it starts up. Idempotent via UNIQUE (holiday_date).
      const fixed: Array<[string, string]> = [
        ['01-01', "New Year's Day"],
        ['07-04', 'Independence Day'],
        ['11-11', 'Veterans Day'],
        ['12-25', 'Christmas Day'],
        ['06-19', 'Juneteenth'],
      ];
      const thisYear = new Date().getUTCFullYear();
      for (const yearOffset of [0, 1, 2]) {
        const y = thisYear + yearOffset;
        for (const [md, name] of fixed) {
          await query(`
            INSERT INTO tbl_holiday (holiday_date, holiday_name)
            VALUES ($1::date, $2)
            ON CONFLICT (holiday_date) DO NOTHING
          `, [`${y}-${md}`, name]);
        }
        // Floating holidays — compute exact dates per year.
        await query(`
          INSERT INTO tbl_holiday (holiday_date, holiday_name) VALUES
            ($1::date, 'Martin Luther King Jr. Day'),
            ($2::date, 'Presidents Day'),
            ($3::date, 'Memorial Day'),
            ($4::date, 'Labor Day'),
            ($5::date, 'Columbus Day / Indigenous Peoples Day'),
            ($6::date, 'Thanksgiving Day')
          ON CONFLICT (holiday_date) DO NOTHING
        `, [
          thirdMonday(y, 0),   // Jan, 3rd Monday
          thirdMonday(y, 1),   // Feb, 3rd Monday
          lastMonday(y, 4),    // May, last Monday
          firstMonday(y, 8),   // Sep, 1st Monday
          secondMonday(y, 9),  // Oct, 2nd Monday
          fourthThursday(y, 10), // Nov, 4th Thursday
        ]);
      }
    },
  },

  // ============================================================
  // Email read/unread state (2026-06-02)
  // ------------------------------------------------------------
  // read_at = NULL → unread (for inbound only). Outbound messages
  // ("Sent" folder) don't have a read concept — the sender authored
  // them — so we always treat direction='out' as "read." Auto-stamp
  // happens server-side when GET /api/mailbox/messages/:id loads.
  // ============================================================
  {
    name: 'tbl_email_message.read_at',
    async run() {
      await query(`
        ALTER TABLE tbl_email_message
          ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ
      `);
      // Index for the unread-count query — partial so it only covers
      // the few unread rows, keeping it tiny.
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_email_message_unread
          ON tbl_email_message (user_account_id)
          WHERE read_at IS NULL AND direction = 'in'
      `);
    },
  },

  // ============================================================
  // tbl_email_attachment — binary content of every attachment on
  // every synced email. Lets us display inline images in the body
  // (replacing cid: references with our own URL) and lets users
  // download regular attachments. Cascades from the message row so
  // deleting a message cleans up its attachments automatically.
  //
  // Stored inline as BYTEA for now (cheap on small mailboxes). If
  // mailboxes grow large we can move to S3/Spaces using the same
  // pattern as tbl_attachment_blob without changing this schema.
  // ============================================================
  {
    name: 'tbl_email_attachment',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_email_attachment (
          email_attachment_id SERIAL PRIMARY KEY,
          message_id          INTEGER NOT NULL REFERENCES tbl_email_message(message_id) ON DELETE CASCADE,
          filename            VARCHAR(500) NOT NULL,
          content_type        VARCHAR(200),
          size_bytes          INTEGER NOT NULL,
          is_inline           BOOLEAN NOT NULL DEFAULT false,
          content_id          VARCHAR(500),   -- the <cid> for inline refs; null for regular attachments
          content             BYTEA NOT NULL,
          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_email_attachment_message ON tbl_email_attachment(message_id)`);
      // Fast cid lookup when rewriting inline image src= refs in the body.
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_email_attachment_cid ON tbl_email_attachment(message_id, content_id) WHERE content_id IS NOT NULL`);
    },
  },

  // ============================================================
  // Per-account email signature. Stored as plain text — staff just
  // need name + title + phone + maybe a tagline. If we ever add a
  // rich-text editor we can add a signature_html column alongside.
  // ============================================================
  {
    name: 'tbl_email_account.signature',
    async run() {
      await query(`ALTER TABLE tbl_email_account ADD COLUMN IF NOT EXISTS signature TEXT`);
    },
  },

  // ============================================================
  // Email templates — pre-canned messages staff use over and over
  // (thank-you for cash gift, pickup confirmation, volunteer
  // welcome, etc). Per-user so each staff member can curate their
  // own set without stepping on each other; we can layer an
  // "org-wide" flag later if shared templates become a need.
  //
  // Placeholders use the {{name}} syntax — substitution happens
  // client-side when a template is applied to a compose form.
  // Supported placeholders today are advisory only (the UI shows
  // them in the editor) — at apply-time we just text-replace.
  // ============================================================
  {
    name: 'tbl_email_template',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_email_template (
          email_template_id SERIAL PRIMARY KEY,
          user_account_id   INTEGER NOT NULL REFERENCES tbl_user_account(user_account_id) ON DELETE CASCADE,
          name              VARCHAR(120) NOT NULL,
          description       VARCHAR(300),
          subject           VARCHAR(500),
          body              TEXT NOT NULL,
          sort_order        INTEGER NOT NULL DEFAULT 0,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_email_template_user ON tbl_email_template(user_account_id, sort_order, name)`);
    },
  },

  // ============================================================
  // Vendors / suppliers / trades-people. Operational directory only —
  // bills + payments + 1099s stay in QuickBooks (the books of record).
  // FH stores who we work with, what they do, the documents we keep
  // on file (W-9, COI), and the correspondence + service history.
  //
  // Vendors join to tbl_contact for name/phone/email — same pattern
  // as donors/clients/agency_contacts/facility_staff so the existing
  // contact infrastructure (search, recipient picker, etc.) just
  // includes them.
  // ============================================================
  {
    name: 'tbl_vendor + lookups',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_vendor_type (
          vendor_type_id   SERIAL PRIMARY KEY,
          vendor_type      VARCHAR(50) NOT NULL UNIQUE,
          description      VARCHAR(200),
          sort_order       INTEGER NOT NULL DEFAULT 0
        )
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_vendor_specialty (
          vendor_specialty_id SERIAL PRIMARY KEY,
          vendor_specialty    VARCHAR(80) NOT NULL UNIQUE,
          description         VARCHAR(200),
          sort_order          INTEGER NOT NULL DEFAULT 0
        )
      `);

      // Seed types
      const types: Array<[string, string, number]> = [
        ['Trade-Person',     'Plumber, electrician, HVAC tech — individual service providers we hire by the job.', 10],
        ['Service Provider', 'Recurring service contractors — cleaning, landscaping, IT support, etc.',           20],
        ['Supplier',         'Suppliers we buy goods from — packing materials, office, fuel, etc.',                30],
        ['Professional',     'Accountant, attorney, insurance broker, consultants.',                                40],
        ['Other',            'Anything that doesn’t fit the categories above.',                                90],
      ];
      for (const [name, desc, sort] of types) {
        await query(`
          INSERT INTO lkp_vendor_type (vendor_type, description, sort_order)
          VALUES ($1, $2, $3)
          ON CONFLICT (vendor_type) DO NOTHING
        `, [name, desc, sort]);
      }

      // Seed specialties — useful filter chips even if many vendors
      // are "Other". Admins can add more via the generic admin UI.
      const specialties: Array<[string, number]> = [
        ['Plumber', 10],['Electrician', 20],['HVAC', 30],['Carpenter', 40],
        ['Painter', 50],['Landscaper', 60],['Cleaner', 70],['Pest Control', 80],
        ['Locksmith', 90],['IT / Technology', 100],['Legal', 110],['Accountant', 120],
        ['Insurance', 130],['Fuel', 140],['Office Supplies', 150],['Packing / Moving Supplies', 160],
        ['Vehicle Repair', 170],['Storage', 180],['Other', 900],
      ];
      for (const [name, sort] of specialties) {
        await query(`
          INSERT INTO lkp_vendor_specialty (vendor_specialty, sort_order)
          VALUES ($1, $2)
          ON CONFLICT (vendor_specialty) DO NOTHING
        `, [name, sort]);
      }

      await query(`
        CREATE TABLE IF NOT EXISTS tbl_vendor (
          vendor_id           SERIAL PRIMARY KEY,
          contact_id          INTEGER NOT NULL REFERENCES tbl_contact(contact_id),
          vendor_type_id      INTEGER NOT NULL REFERENCES lkp_vendor_type(vendor_type_id),
          vendor_specialty_id INTEGER REFERENCES lkp_vendor_specialty(vendor_specialty_id),
          business_name       VARCHAR(200),
          -- Compliance flags + expiry dates. Drive "missing/expired"
          -- pre-year-end and pre-audit reports later. The actual
          -- documents attach via the entity-attachments widget.
          w9_received         BOOLEAN NOT NULL DEFAULT false,
          w9_received_date    DATE,
          coi_received        BOOLEAN NOT NULL DEFAULT false,
          coi_expires_at      DATE,
          -- Optional operational fields
          default_hourly_rate NUMERIC(10,2),
          payment_terms       VARCHAR(80),      -- "Net 30", "Due on receipt", etc
          tax_id              VARCHAR(40),       -- EIN/SSN — encrypt later if needed
          notes               TEXT,
          is_active           BOOLEAN NOT NULL DEFAULT true,
          -- QBO sync columns — set when the bookkeeper pushes this
          -- vendor to QBO. Phase 3, not used yet but reserved.
          qbo_vendor_id       VARCHAR(40),
          qbo_synced_at       TIMESTAMPTZ,
          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_vendor_type ON tbl_vendor(vendor_type_id, vendor_specialty_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_vendor_contact ON tbl_vendor(contact_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_vendor_active ON tbl_vendor(is_active) WHERE is_active = true`);
    },
  },

  // ============================================================
  // Client furniture waiver — IRS-style audit trail of consent.
  //
  // tbl_waiver_template: versioned text of the waiver. Insert a new
  // row whenever the lawyer changes a comma; the old version stays
  // referenced by every signature that was captured against it, so
  // a dispute years later can be re-litigated against the EXACT
  // language the client agreed to at the time.
  //
  // tbl_client_waiver: one row per signed instance. Captures the
  // typed legal name (act of attestation), drawn signature (PNG
  // BYTEA), timestamp, IP, user-agent, and the staff member who
  // witnessed the signing. The generated PDF is stored as a regular
  // attachment on the request via tbl_entity_attachment.
  //
  // Linked to tbl_client_provisioning_request 1:1 (a request needs
  // exactly one signed waiver). Linked to tbl_client redundantly
  // for fast lookup of "all of Margaret's signed waivers."
  // ============================================================
  {
    name: 'tbl_client_waiver + template',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_waiver_template (
          waiver_template_id  SERIAL PRIMARY KEY,
          title               VARCHAR(200) NOT NULL,
          subtitle            VARCHAR(200),
          body_markdown       TEXT NOT NULL,
          version_label       VARCHAR(40),
          is_current          BOOLEAN NOT NULL DEFAULT false,
          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id)
        )
      `);
      // Only ONE row may be is_current=true at a time. Enforced by
      // a partial unique index — simpler + faster than a trigger.
      await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_waiver_template_current ON tbl_waiver_template ((1)) WHERE is_current = true`);

      // Seed the v1 template from the reference docx if no template
      // exists yet. Body uses simple markers (## for section
      // headings, blank-line paragraph breaks) — the PDF generator
      // parses these.
      const have = await queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tbl_waiver_template`);
      if (Number(have?.count ?? 0) === 0) {
        await query(`
          INSERT INTO tbl_waiver_template
            (title, subtitle, body_markdown, version_label, is_current)
          VALUES ($1, $2, $3, $4, true)
        `, [
          'Furnish Hope Furniture Waiver',
          'Please read carefully',
          [
            'This waiver allows Furnish Hope or your caseworker to make furniture and household furnishings selections on your behalf.',
            '',
            '## NO WARRANTIES',
            'By signing this waiver, you have agreed to allow your caseworker or a Furnish Hope representative to select the as-is furniture and household furnishings on your behalf. Most furniture and household furnishings selected are known to be used items, in good condition. At the time the furniture and household furnishings are selected, items requested by the recipient will be selected to the extent they are available. No guarantee can be made that all of the items will be available at the time of selection.',
            '',
            '## INDEMNIFICATION',
            'Recipient acknowledges that the used furniture and household furnishings are accepted on an as-is basis, and further agrees to indemnify and hold Furnish Hope free and harmless from any and all liability arising out of the use and transportation of the furniture and household furnishings selected for the recipient.',
          ].join('\n'),
          'v1 (2026-06)',
        ]);
      }

      await query(`
        CREATE TABLE IF NOT EXISTS tbl_client_waiver (
          waiver_id                       SERIAL PRIMARY KEY,
          client_provisioning_request_id  INTEGER NOT NULL REFERENCES tbl_client_provisioning_request(client_provisioning_request_id) ON DELETE CASCADE,
          client_id                       INTEGER NOT NULL REFERENCES tbl_client(client_id),
          waiver_template_id              INTEGER NOT NULL REFERENCES tbl_waiver_template(waiver_template_id),
          typed_legal_name                VARCHAR(200) NOT NULL,
          signature_image                 BYTEA NOT NULL,
          signed_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ip_address                      INET,
          user_agent                      TEXT,
          witness_user_account_id         INTEGER NOT NULL REFERENCES tbl_user_account(user_account_id),
          -- The generated PDF is also attached to the request via
          -- tbl_entity_attachment so it shows in the existing
          -- attachments widget. This column stores the attachment id
          -- for direct linking.
          pdf_attachment_id               INTEGER REFERENCES tbl_entity_attachment(attachment_id) ON DELETE SET NULL,
          created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      // One signed waiver per request — re-signing a request requires
      // an explicit replace (delete old → insert new). This UNIQUE
      // also guards against a double-submit race condition.
      await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_client_waiver_request ON tbl_client_waiver(client_provisioning_request_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_client_waiver_client ON tbl_client_waiver(client_id, signed_at DESC)`);
    },
  },

  // ============================================================
  // Vendor service log — an operational journal of what each vendor
  // did, when, where, and what was authorized. Pre-bill, pre-accounting.
  // Builds institutional memory ("did we already call this plumber?
  // what did they fix?") and feeds a calendar entry for scheduled
  // service visits. Bills + payments stay in QuickBooks; cost_estimate
  // here is just an authorization/expectation, not an accounting fact.
  // ============================================================
  {
    name: 'tbl_vendor_service + status lookup',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_vendor_service_status (
          vendor_service_status_id SERIAL PRIMARY KEY,
          vendor_service_status    VARCHAR(40) NOT NULL UNIQUE,
          description              VARCHAR(200),
          sort_order               INTEGER NOT NULL DEFAULT 0
        )
      `);
      for (const [name, desc, sort] of [
        ['Scheduled', 'Service is booked but hasn’t happened yet.',           10],
        ['Completed', 'Vendor finished the work.',                              20],
        ['Cancelled', 'Service was called off before it happened.',             30],
        ['Billed',    'Vendor has invoiced — entry now matches a QBO bill.',    40],
      ] as Array<[string, string, number]>) {
        await query(
          `INSERT INTO lkp_vendor_service_status (vendor_service_status, description, sort_order)
           VALUES ($1, $2, $3) ON CONFLICT (vendor_service_status) DO NOTHING`,
          [name, desc, sort],
        );
      }

      await query(`
        CREATE TABLE IF NOT EXISTS tbl_vendor_service (
          vendor_service_id         SERIAL PRIMARY KEY,
          vendor_id                 INTEGER NOT NULL REFERENCES tbl_vendor(vendor_id) ON DELETE CASCADE,
          service_date              DATE NOT NULL,
          start_time                TIME,
          end_time                  TIME,
          -- Two ways to record where: free-text (covers "unit 4B at 213
          -- Maple", "warehouse break room") OR a linked facility row
          -- when it's a corporate site. Both optional; use whatever's
          -- handy.
          location_text             VARCHAR(300),
          corp_facility_id          INTEGER REFERENCES tbl_corp_facility(corp_facility_id),
          description               TEXT NOT NULL,
          cost_estimate             NUMERIC(12,2),
          vendor_service_status_id  INTEGER NOT NULL REFERENCES lkp_vendor_service_status(vendor_service_status_id),
          notes                     TEXT,
          created_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id),
          created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_vendor_service_vendor ON tbl_vendor_service(vendor_id, service_date DESC)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_vendor_service_date  ON tbl_vendor_service(service_date)`);
    },
  },

  // ============================================================
  // OAuth columns for tbl_email_account. Lets users sign in with
  // Google / Microsoft instead of generating an app-specific
  // password. auth_type already exists ('password' | 'oauth'); the
  // tokens themselves live in encrypted columns and get refreshed
  // automatically when they expire.
  // ============================================================
  {
    name: 'tbl_email_account.oauth_columns',
    async run() {
      await query(`
        ALTER TABLE tbl_email_account
          ADD COLUMN IF NOT EXISTS oauth_provider           VARCHAR(20),
          ADD COLUMN IF NOT EXISTS oauth_access_token_enc   TEXT,
          ADD COLUMN IF NOT EXISTS oauth_refresh_token_enc  TEXT,
          ADD COLUMN IF NOT EXISTS oauth_expires_at         TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS oauth_scope              TEXT
      `);
    },
  },

  // ============================================================
  // Email threading — group a back-and-forth conversation into a
  // single thread. thread_id = message_id of the conversation's
  // root (the first message in the chain). Backfilled via recursive
  // CTE that walks In-Reply-To headers; new messages get their
  // thread_id computed at insert time by sync.ts / send paths.
  //
  // Per-user scoping: message-id headers are global identifiers but
  // we still scope the lookup by user_account_id, so two users who
  // happen to be on opposite sides of a CC chain don't accidentally
  // share a thread row.
  // ============================================================
  {
    name: 'tbl_email_message.thread_id',
    async run() {
      await query(`ALTER TABLE tbl_email_message ADD COLUMN IF NOT EXISTS thread_id INTEGER`);

      // Backfill in two passes:
      //  1. Recursive CTE: chase In-Reply-To chains to find each
      //     message's root. Roots are messages whose in_reply_to is
      //     null or references a Message-Id we don't have stored.
      //  2. Anything still NULL after (1) is its own root.
      await query(`
        WITH RECURSIVE chain AS (
          SELECT
            m.user_account_id,
            m.message_id,
            m.message_id AS thread_root,
            m.message_id_header
          FROM tbl_email_message m
          WHERE m.in_reply_to IS NULL
             OR NOT EXISTS (
               SELECT 1
               FROM tbl_email_message p
               WHERE p.user_account_id = m.user_account_id
                 AND p.message_id_header = m.in_reply_to
             )

          UNION ALL

          SELECT
            m.user_account_id,
            m.message_id,
            c.thread_root,
            m.message_id_header
          FROM tbl_email_message m
          JOIN chain c
            ON c.user_account_id = m.user_account_id
           AND c.message_id_header = m.in_reply_to
          WHERE m.in_reply_to IS NOT NULL
        )
        UPDATE tbl_email_message t
        SET thread_id = c.thread_root
        FROM chain c
        WHERE t.message_id = c.message_id
          AND t.thread_id IS DISTINCT FROM c.thread_root
      `);

      // Anything the CTE didn't reach (truly orphan or cyclic) gets
      // its own message_id as thread_id so the column is never null.
      await query(`UPDATE tbl_email_message SET thread_id = message_id WHERE thread_id IS NULL`);

      await query(`ALTER TABLE tbl_email_message ALTER COLUMN thread_id SET NOT NULL`);
      // Index for the per-user grouped list query.
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_email_message_thread ON tbl_email_message(user_account_id, thread_id, sent_at DESC)`);
    },
  },

  // ============================================================
  // tbl_org_branding — the org's logo image (BYTEA), shown on PDF
  // receipts and (eventually) other branded outputs. Single-row
  // table — branding_id is fixed at 1 by an INSERT-or-UPDATE.
  // Stored in the DB rather than the filesystem so deploys don't
  // wipe it and so we don't depend on a specific mount layout in
  // production (DO App Platform doesn't share fs with the build).
  // ============================================================
  {
    name: 'tbl_org_branding',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_org_branding (
          branding_id    INTEGER PRIMARY KEY DEFAULT 1 CHECK (branding_id = 1),
          logo_data      BYTEA,
          content_type   VARCHAR(80),
          filename       VARCHAR(200),
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id)
        )
      `);
      // Seed the singleton row so subsequent UPDATEs always have a
      // target. logo_data starts NULL — no logo until uploaded.
      await query(`INSERT INTO tbl_org_branding (branding_id) VALUES (1) ON CONFLICT DO NOTHING`);
    },
  },

  // ============================================================
  // Performance indexes (2026-06-10) — for the production scale of
  // ~3K clients, ~30K inventory items, ~30K emails/year.
  //
  // Three btree gaps the original schema missed:
  //   - tbl_audit_log: only indexed on user_account_id. Every audit
  //     viewer query sorts by action_at DESC. Without an index on it
  //     this becomes a full-table sort once the log has any volume.
  //   - tbl_corp_facility_inventory_item: no index on
  //     date_added_to_inventory. "Recent intake" reports and any
  //     date-sorted inventory list scan otherwise.
  // ============================================================
  {
    name: 'performance indexes — audit + inventory dates',
    async run() {
      // Single-column desc index for the global audit log viewer.
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_audit_log_action_at
          ON tbl_audit_log (action_at DESC)
      `);
      // Composite for "this user's audit history" — covers both the
      // filter and the sort with one index lookup.
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_audit_log_user_action_at
          ON tbl_audit_log (user_account_id, action_at DESC)
      `);
      // Most "recent inventory" UI sorts by date_added_to_inventory.
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_corp_facility_inventory_item_date_added
          ON tbl_corp_facility_inventory_item (date_added_to_inventory DESC)
      `);
    },
  },

  // ============================================================
  // pg_trgm + substring-search indexes (2026-06-10).
  //
  // Every search box in the app uses ILIKE '%foo%' (donor/client
  // name, vendor name, email subject/from, contact email). A plain
  // btree can't accelerate a leading-wildcard match, so today these
  // do sequential scans. Fine at thousands of rows, painful at tens
  // of thousands.
  //
  // pg_trgm + GIN turns substring ILIKE into an index lookup. Also
  // sets up the autocomplete UI (next feature) to feel instant — a
  // typeahead query like 'ka' becomes index-driven instead of a
  // table scan with every keystroke.
  //
  // Indexes are kept narrow on purpose: only the columns users
  // actually search. Body_text is NOT indexed — bodies are huge and
  // we don't have a "search email bodies" feature today. Add later
  // if/when that feature lands.
  // ============================================================
  {
    name: 'pg_trgm extension + substring search indexes',
    async run() {
      // pg_trgm is on the DO Managed Postgres allowed-extension list.
      await query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

      // Names + emails on tbl_contact — the join target for clients,
      // donors, volunteers, staff, vendors, agency contacts.
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_contact_first_name_trgm
          ON tbl_contact USING gin (first_name gin_trgm_ops)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_contact_last_name_trgm
          ON tbl_contact USING gin (last_name gin_trgm_ops)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_contact_email_trgm
          ON tbl_contact USING gin (email gin_trgm_ops)
          WHERE email IS NOT NULL
      `);

      // Vendor business name — only column we ILIKE on directly.
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_vendor_business_name_trgm
          ON tbl_vendor USING gin (business_name gin_trgm_ops)
          WHERE business_name IS NOT NULL
      `);

      // Email subject + from_address for mailbox search.
      // from_address already has a LOWER() btree for case-insensitive
      // exact / prefix lookup — trigram complements it for '%foo%'.
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_email_message_subject_trgm
          ON tbl_email_message USING gin (subject gin_trgm_ops)
          WHERE subject IS NOT NULL
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_email_message_from_trgm
          ON tbl_email_message USING gin (from_address gin_trgm_ops)
      `);
    },
  },

  // ============================================================
  // Event attendee workflow (2026-06-10)
  // ------------------------------------------------------------
  // - lkp_rsvp_status: proper lookup table replacing the hard-coded
  //   "Invited / Yes / Maybe / No" strings. Five canonical values
  //   matching email-invite vocabulary.
  // - tbl_event_attendee.rsvp_status_id: FK to the lookup.
  //   Backfilled from the legacy VARCHAR with a tolerant mapping
  //   (Yes -> Accepted, No -> Declined, case-insensitive). The
  //   legacy `rsvp_status` VARCHAR column stays for now — readers
  //   continue to work and we can drop it after a transition.
  // - tbl_event_attendee.donation_id: optional link to a real
  //   tbl_donation row, set when a contribution is "promoted" to a
  //   proper donation (so it shows up in lifetime giving + can
  //   generate a receipt). NULL means the amount is still
  //   informational only.
  // ============================================================
  {
    name: 'lkp_rsvp_status + tbl_event_attendee.rsvp_status_id + donation_id',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_rsvp_status (
          rsvp_status_id  SERIAL PRIMARY KEY,
          rsvp_status     VARCHAR(40) NOT NULL UNIQUE,
          sort_order      INTEGER NOT NULL DEFAULT 0,
          is_active       BOOLEAN NOT NULL DEFAULT true
        )
      `);
      const seed: Array<[string, number]> = [
        ['Invited',     10],
        ['Accepted',    20],
        ['Declined',    30],
        ['Maybe',       40],
        ['No response', 50],
      ];
      for (const [name, sort] of seed) {
        await query(
          `INSERT INTO lkp_rsvp_status (rsvp_status, sort_order)
             VALUES ($1, $2)
             ON CONFLICT (rsvp_status) DO NOTHING`,
          [name, sort],
        );
      }
      await query(`
        ALTER TABLE tbl_event_attendee
          ADD COLUMN IF NOT EXISTS rsvp_status_id INTEGER
            REFERENCES lkp_rsvp_status(rsvp_status_id)
      `);
      // Backfill from the legacy VARCHAR. Match by canonical name OR
      // by the historical short forms the hard-coded dropdown used.
      await query(`
        UPDATE tbl_event_attendee ea
           SET rsvp_status_id = l.rsvp_status_id
          FROM lkp_rsvp_status l
         WHERE ea.rsvp_status_id IS NULL
           AND ea.rsvp_status IS NOT NULL
           AND TRIM(ea.rsvp_status) <> ''
           AND (
                LOWER(TRIM(ea.rsvp_status)) = LOWER(l.rsvp_status)
                OR (LOWER(TRIM(ea.rsvp_status)) = 'yes' AND l.rsvp_status = 'Accepted')
                OR (LOWER(TRIM(ea.rsvp_status)) = 'no'  AND l.rsvp_status = 'Declined')
           )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_event_attendee_rsvp_status_id
          ON tbl_event_attendee (rsvp_status_id)
      `);
      // Promote-to-donation link. SET NULL on delete so deleting the
      // donation doesn't cascade-wipe the attendee record.
      await query(`
        ALTER TABLE tbl_event_attendee
          ADD COLUMN IF NOT EXISTS donation_id INTEGER
            REFERENCES tbl_donation(donation_id) ON DELETE SET NULL
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_event_attendee_donation_id
          ON tbl_event_attendee (donation_id)
          WHERE donation_id IS NOT NULL
      `);
    },
  },

  // ============================================================
  // Event roles + capacity (2026-06-11)
  // ------------------------------------------------------------
  // Free-text scheduling fields are TEXT (not VARCHAR with cap) —
  // staff need to paste in their own multi-line run-of-show without
  // hitting a limit. Host is split into two FK columns rather than
  // polymorphic: a host is EITHER a contact (staff/volunteer/donor)
  // OR a corporate organization, never both, never neither (NULL
  // means "no host set"). Simpler than entity_type+entity_id and
  // queries don't need a discriminator.
  // ============================================================
  {
    name: 'tbl_event: manager + host + capacity + briefing fields',
    async run() {
      await query(`
        ALTER TABLE tbl_event
          ADD COLUMN IF NOT EXISTS manager_facility_staff_id INTEGER
            REFERENCES tbl_facility_staff(facility_staff_id)
      `);
      await query(`
        ALTER TABLE tbl_event
          ADD COLUMN IF NOT EXISTS host_contact_id INTEGER
            REFERENCES tbl_contact(contact_id)
      `);
      await query(`
        ALTER TABLE tbl_event
          ADD COLUMN IF NOT EXISTS host_corporate_id INTEGER
            REFERENCES tbl_corporate(corporate_id)
      `);
      await query(`
        ALTER TABLE tbl_event
          ADD COLUMN IF NOT EXISTS max_attendees INTEGER
      `);
      await query(`
        ALTER TABLE tbl_event
          ADD COLUMN IF NOT EXISTS run_of_show TEXT
      `);
      await query(`
        ALTER TABLE tbl_event
          ADD COLUMN IF NOT EXISTS staff_briefing TEXT
      `);
      // FK indexes for the new columns — every other FK in this
      // schema is indexed, keep the pattern consistent.
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_event_manager        ON tbl_event(manager_facility_staff_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_event_host_contact   ON tbl_event(host_contact_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_event_host_corporate ON tbl_event(host_corporate_id)`);
    },
  },

  // ============================================================
  // Attendee seating fields (2026-06-11)
  // ------------------------------------------------------------
  // table_number + seat_number kept as VARCHAR so events can use
  // any scheme they want — "Table 12 / Seat A", "Stage / Bridal",
  // "Rose Room", etc. No need for integer order in a small fundraiser.
  // ============================================================
  {
    name: 'tbl_event_attendee: seating + dietary',
    async run() {
      await query(`ALTER TABLE tbl_event_attendee ADD COLUMN IF NOT EXISTS table_number VARCHAR(40)`);
      await query(`ALTER TABLE tbl_event_attendee ADD COLUMN IF NOT EXISTS seat_number VARCHAR(20)`);
      await query(`ALTER TABLE tbl_event_attendee ADD COLUMN IF NOT EXISTS dietary_notes VARCHAR(200)`);
    },
  },

  // ============================================================
  // Corporate sponsorships (2026-06-11)
  // ------------------------------------------------------------
  // - lkp_sponsor_level: seeded with the most-common nonprofit gala
  //   tiers (Title, Presenting, Platinum, Gold, Silver, Bronze).
  //   Admin can rename / add / remove via /admin/lkp_sponsor_level.
  // - tbl_event_sponsor: join table. Each sponsor row points at
  //   EITHER a corporate org (typical) OR a contact (rare — an
  //   individual mega-donor sponsoring the event). CHECK constraint
  //   enforces XOR. amount_pledged is the commitment; amount_paid
  //   is what's actually been received; donation_id links to the
  //   real tbl_donation once promoted (same pattern as attendee
  //   contributions).
  // ============================================================
  // ============================================================
  // Relax tbl_donor NOT NULL constraints (2026-06-11) — addresses
  // a bug where the new event-promote-to-donation endpoints can't
  // create a donor row for a contact who doesn't already have an
  // address / "how they found us" attribution. Both fields are
  // really only meaningful at manual donor creation time; the
  // auto-promote path can leave them blank, and the user can fill
  // them in later from the donor edit page.
  // ============================================================
  {
    name: 'tbl_donor: relax address_id + howtheyfoundus_id NOT NULL',
    async run() {
      await query(`ALTER TABLE tbl_donor ALTER COLUMN address_id        DROP NOT NULL`);
      await query(`ALTER TABLE tbl_donor ALTER COLUMN howtheyfoundus_id DROP NOT NULL`);
    },
  },

  // ============================================================
  // tbl_donation.description grows from VARCHAR(100) to VARCHAR(500)
  // (2026-06-11). The new event-promote-to-donation endpoints build
  // descriptions like `Contribution at "{event_name}" on YYYY-MM-DD`
  // which can blow past 100 chars on any event with a long name.
  // Going to 500 is generous and headroom-friendly; truncation in
  // app code would have been a silent data loss.
  // ============================================================
  {
    name: 'tbl_donation.description -> VARCHAR(500)',
    async run() {
      await query(`ALTER TABLE tbl_donation ALTER COLUMN description TYPE VARCHAR(500)`);
    },
  },

  // ============================================================
  // tbl_manual_screenshot (2026-06-11)
  // ------------------------------------------------------------
  // Stores images uploaded by admins to fill the screenshot slots
  // in the in-app User Manual. Same pattern as tbl_org_branding:
  // image data inline as BYTEA, single row per slug (the slot
  // identifier referenced from the manual content). Audience
  // distinguishes the staff manual from the agency caseworker one.
  // Caption is admin-editable text shown beneath the image.
  // ============================================================
  {
    name: 'tbl_manual_screenshot',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_manual_screenshot (
          slug              VARCHAR(80)  PRIMARY KEY,
          audience          VARCHAR(20)  NOT NULL DEFAULT 'staff'
                              CHECK (audience IN ('staff', 'agency')),
          caption           VARCHAR(300),
          image_data        BYTEA        NOT NULL,
          content_type      VARCHAR(80)  NOT NULL,
          filename          VARCHAR(200),
          byte_size         INTEGER      NOT NULL,
          uploaded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          uploaded_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id)
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_manual_screenshot_audience ON tbl_manual_screenshot(audience)`);
    },
  },

  {
    name: 'lkp_sponsor_level + tbl_event_sponsor',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_sponsor_level (
          sponsor_level_id  SERIAL PRIMARY KEY,
          sponsor_level     VARCHAR(40) NOT NULL UNIQUE,
          sort_order        INTEGER NOT NULL DEFAULT 0,
          is_active         BOOLEAN NOT NULL DEFAULT true,
          description       VARCHAR(200)
        )
      `);
      const seed: Array<[string, number, string]> = [
        ['Title',      10, 'Top-tier exclusive naming sponsor'],
        ['Presenting', 20, 'Co-billed with the event name'],
        ['Platinum',   30, 'Highest non-naming tier'],
        ['Gold',       40, 'Mid-high tier'],
        ['Silver',     50, 'Mid tier'],
        ['Bronze',     60, 'Entry tier'],
      ];
      for (const [name, sort, desc] of seed) {
        await query(
          `INSERT INTO lkp_sponsor_level (sponsor_level, sort_order, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (sponsor_level) DO NOTHING`,
          [name, sort, desc],
        );
      }
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_event_sponsor (
          event_sponsor_id   SERIAL PRIMARY KEY,
          event_id           INTEGER NOT NULL REFERENCES tbl_event(event_id) ON DELETE CASCADE,
          corporate_id       INTEGER REFERENCES tbl_corporate(corporate_id),
          contact_id         INTEGER REFERENCES tbl_contact(contact_id),
          sponsor_level_id   INTEGER NOT NULL REFERENCES lkp_sponsor_level(sponsor_level_id),
          amount_pledged     NUMERIC(12,2),
          amount_paid        NUMERIC(12,2),
          acknowledged       BOOLEAN NOT NULL DEFAULT false,
          notes              TEXT,
          donation_id        INTEGER REFERENCES tbl_donation(donation_id) ON DELETE SET NULL,
          created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT chk_event_sponsor_entity
            CHECK ((corporate_id IS NOT NULL AND contact_id IS NULL)
                OR (corporate_id IS NULL AND contact_id IS NOT NULL))
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_event_sponsor_event     ON tbl_event_sponsor(event_id, sponsor_level_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_event_sponsor_corporate ON tbl_event_sponsor(corporate_id) WHERE corporate_id IS NOT NULL`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_event_sponsor_contact   ON tbl_event_sponsor(contact_id)   WHERE contact_id IS NOT NULL`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_event_sponsor_donation  ON tbl_event_sponsor(donation_id)  WHERE donation_id IS NOT NULL`);
    },
  },

  // ============================================================
  // tbl_volunteer_signup (2026-06-11)
  // ------------------------------------------------------------
  // Public volunteer-application form at /volunteer creates one
  // row here per submission. Status starts at 'pending'; admin
  // reviews and either approves (creating tbl_contact + tbl_facility_staff
  // records) or rejects.
  //
  // Activity preferences are stored as fixed BOOLEAN columns
  // rather than a join table — eight canonical categories that
  // are unlikely to change frequently. If they ever need to be
  // admin-editable, migrate to a lookup + join.
  //
  // Availability uses 7 day-of-week booleans + 3 time-of-day
  // booleans — the most compact representation for what's
  // really 21 yes/no choices.
  // ============================================================
  {
    name: 'tbl_volunteer_signup',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_volunteer_signup (
          signup_id              SERIAL PRIMARY KEY,
          first_name             VARCHAR(50)  NOT NULL,
          last_name              VARCHAR(50)  NOT NULL,
          email                  VARCHAR(120) NOT NULL,
          mobile_phone           VARCHAR(20)  NOT NULL,
          city                   VARCHAR(80),
          state_id               INTEGER REFERENCES lkp_state(state_id),
          postalcode             VARCHAR(20),
          date_of_birth          DATE,
          emergency_contact_name VARCHAR(120),
          emergency_contact_phone VARCHAR(20),
          frequency              VARCHAR(20) NOT NULL
                                   CHECK (frequency IN ('one_time', 'recurring', 'on_call')),
          start_date             DATE,
          end_date               DATE,
          avail_mon BOOLEAN NOT NULL DEFAULT false,
          avail_tue BOOLEAN NOT NULL DEFAULT false,
          avail_wed BOOLEAN NOT NULL DEFAULT false,
          avail_thu BOOLEAN NOT NULL DEFAULT false,
          avail_fri BOOLEAN NOT NULL DEFAULT false,
          avail_sat BOOLEAN NOT NULL DEFAULT false,
          avail_sun BOOLEAN NOT NULL DEFAULT false,
          time_morning   BOOLEAN NOT NULL DEFAULT false,
          time_afternoon BOOLEAN NOT NULL DEFAULT false,
          time_evening   BOOLEAN NOT NULL DEFAULT false,
          act_pickups     BOOLEAN NOT NULL DEFAULT false,
          act_deliveries  BOOLEAN NOT NULL DEFAULT false,
          act_warehouse   BOOLEAN NOT NULL DEFAULT false,
          act_events      BOOLEAN NOT NULL DEFAULT false,
          act_admin       BOOLEAN NOT NULL DEFAULT false,
          act_photography BOOLEAN NOT NULL DEFAULT false,
          act_trades      BOOLEAN NOT NULL DEFAULT false,
          act_anywhere    BOOLEAN NOT NULL DEFAULT false,
          can_lift            VARCHAR(20) NOT NULL
                                CHECK (can_lift IN ('under_25', '25_50', '50_plus', 'cannot')),
          has_drivers_license BOOLEAN NOT NULL DEFAULT false,
          has_vehicle         BOOLEAN NOT NULL DEFAULT false,
          special_skills      TEXT,
          heard_from_id        INTEGER REFERENCES lkp_howtheyfoundus(howtheyfoundus_id),
          why_interested       TEXT,
          needs_verified_hours BOOLEAN NOT NULL DEFAULT false,
          agreed_to_waiver  BOOLEAN NOT NULL,
          agreed_to_emails  BOOLEAN NOT NULL DEFAULT false,
          status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
          submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          submitted_ip      VARCHAR(50),
          reviewed_at       TIMESTAMPTZ,
          reviewed_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id),
          review_notes      TEXT,
          approved_facility_staff_id INTEGER REFERENCES tbl_facility_staff(facility_staff_id)
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_volunteer_signup_status ON tbl_volunteer_signup(status, submitted_at DESC)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_volunteer_signup_email  ON tbl_volunteer_signup(LOWER(email))`);
    },
  },

  // ============================================================
  // Client visits + delivery fulfillment methods (2026-06-15)
  // ------------------------------------------------------------
  // Visits: a scheduled in-person, phone, Zoom, or email session
  // where the client chooses their furniture from the showroom or
  // catalog. Soft requirement before a delivery — clients can
  // skip the visit step entirely if staff makes choices on their
  // behalf, but the typical flow is referral → visit → delivery.
  //
  // Fulfillment method goes on the delivery (not the visit) since
  // the client may decide at the visit to take the furniture home
  // immediately (walkout), have it delivered to their home, or
  // pick it up later from a locked container.
  // ============================================================
  {
    name: 'lkp_visit_mode',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_visit_mode (
          visit_mode_id  SERIAL PRIMARY KEY,
          visit_mode     VARCHAR(40) NOT NULL UNIQUE,
          sort_order     INTEGER NOT NULL DEFAULT 0,
          is_active      BOOLEAN NOT NULL DEFAULT true,
          description    VARCHAR(200)
        )
      `);
      const seed: Array<[string, number, string]> = [
        ['In-person', 10, 'Client visits the showroom in person to pick out furniture.'],
        ['Phone',     20, 'Staff calls the client and walks them through choices verbally.'],
        ['Zoom',      30, 'Live video call — staff shares the showroom or catalog on screen.'],
        ['Email',     40, 'Asynchronous — staff sends a catalog, client replies with choices.'],
      ];
      for (const [name, sort, desc] of seed) {
        await query(
          `INSERT INTO lkp_visit_mode (visit_mode, sort_order, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (visit_mode) DO NOTHING`,
          [name, sort, desc],
        );
      }
    },
  },
  {
    name: 'lkp_visit_status',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_visit_status (
          visit_status_id  SERIAL PRIMARY KEY,
          visit_status     VARCHAR(40) NOT NULL UNIQUE,
          sort_order       INTEGER NOT NULL DEFAULT 0,
          is_active        BOOLEAN NOT NULL DEFAULT true,
          description      VARCHAR(200)
        )
      `);
      const seed: Array<[string, number, string]> = [
        ['Scheduled', 10, 'Visit booked but not yet held.'],
        ['Completed', 20, 'Visit happened; client made selections.'],
        ['No show',   30, 'Client did not show up and did not reschedule.'],
        ['Cancelled', 40, 'Visit was cancelled before it happened.'],
      ];
      for (const [name, sort, desc] of seed) {
        await query(
          `INSERT INTO lkp_visit_status (visit_status, sort_order, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (visit_status) DO NOTHING`,
          [name, sort, desc],
        );
      }
    },
  },
  {
    name: 'tbl_client_visit',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_client_visit (
          client_visit_id   SERIAL PRIMARY KEY,
          client_id         INTEGER NOT NULL REFERENCES tbl_client(client_id) ON DELETE CASCADE,
          visit_date        DATE NOT NULL,
          start_time        TIME,
          end_time          TIME,
          visit_mode_id     INTEGER NOT NULL REFERENCES lkp_visit_mode(visit_mode_id),
          visit_status_id   INTEGER NOT NULL REFERENCES lkp_visit_status(visit_status_id),
          -- Staff member hosting the visit (showroom guide, caller, etc).
          host_facility_staff_id INTEGER REFERENCES tbl_facility_staff(facility_staff_id),
          -- Showroom / warehouse where the visit happens (NULL for phone/email).
          corp_facility_id  INTEGER REFERENCES tbl_corp_facility(corp_facility_id),
          -- The provisioning request the visit serves (NULL until a request exists).
          client_provisioning_request_id INTEGER REFERENCES tbl_client_provisioning_request(client_provisioning_request_id) ON DELETE SET NULL,
          notes             TEXT,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_client_visit_client_date ON tbl_client_visit(client_id, visit_date DESC)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_client_visit_status     ON tbl_client_visit(visit_status_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_client_visit_date       ON tbl_client_visit(visit_date)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_client_visit_request    ON tbl_client_visit(client_provisioning_request_id) WHERE client_provisioning_request_id IS NOT NULL`);
    },
  },
  {
    name: 'lkp_fulfillment_method',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS lkp_fulfillment_method (
          fulfillment_method_id  SERIAL PRIMARY KEY,
          fulfillment_method     VARCHAR(40) NOT NULL UNIQUE,
          sort_order             INTEGER NOT NULL DEFAULT 0,
          is_active              BOOLEAN NOT NULL DEFAULT true,
          description            VARCHAR(200)
        )
      `);
      const seed: Array<[string, number, string]> = [
        ['Home delivery',    10, "Furnish Hope crew delivers the furniture to the client's home."],
        ['Walkout',          20, 'Client takes the furniture home from the showroom at the time of the visit.'],
        ['Container pickup', 30, 'Furniture is locked in a container or lockbox; client picks up later using a shared lock code.'],
      ];
      for (const [name, sort, desc] of seed) {
        await query(
          `INSERT INTO lkp_fulfillment_method (fulfillment_method, sort_order, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (fulfillment_method) DO NOTHING`,
          [name, sort, desc],
        );
      }
    },
  },
  {
    name: 'tbl_client_deliveries: fulfillment + container pickup columns',
    async run() {
      // Add fulfillment_method, pickup_deadline (only meaningful for
      // container pickups), lock_code (shared across containers), and
      // notification audit fields (when/how/where the code was sent).
      // All nullable so the existing rows back-fill cleanly.
      await query(`
        ALTER TABLE tbl_client_deliveries
          ADD COLUMN IF NOT EXISTS fulfillment_method_id INTEGER REFERENCES lkp_fulfillment_method(fulfillment_method_id),
          ADD COLUMN IF NOT EXISTS pickup_deadline       DATE,
          ADD COLUMN IF NOT EXISTS lock_code             VARCHAR(40),
          ADD COLUMN IF NOT EXISTS pickup_code_sent_at   TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS pickup_code_sent_via  VARCHAR(20),
          ADD COLUMN IF NOT EXISTS pickup_code_sent_to   VARCHAR(255)
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_client_deliveries_fulfillment_method ON tbl_client_deliveries(fulfillment_method_id) WHERE fulfillment_method_id IS NOT NULL`);
    },
  },
  {
    name: 'lkp_storage_location: container + lockbox flags',
    async run() {
      // is_container_or_lockbox filters the pickup-location dropdown
      // so internal warehouse bays don't appear. container_type lets
      // staff distinguish a small lockbox from a full shipping container.
      await query(`
        ALTER TABLE lkp_storage_location
          ADD COLUMN IF NOT EXISTS is_container_or_lockbox BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS container_type          VARCHAR(20),
          ADD COLUMN IF NOT EXISTS is_active               BOOLEAN NOT NULL DEFAULT true
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_lkp_storage_location_container ON lkp_storage_location(is_container_or_lockbox) WHERE is_container_or_lockbox = true`);
    },
  },
  {
    name: 'tbl_client_delivery_container',
    async run() {
      // Junction: a single delivery's container pickup can occupy
      // multiple containers/lockboxes. The shared lock_code lives on
      // tbl_client_deliveries (one code per pickup, not per container).
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_client_delivery_container (
          client_delivery_container_id SERIAL PRIMARY KEY,
          client_deliveries_id INTEGER NOT NULL REFERENCES tbl_client_deliveries(client_deliveries_id) ON DELETE CASCADE,
          storage_location_id  INTEGER NOT NULL REFERENCES lkp_storage_location(storage_location_id),
          notes                VARCHAR(200),
          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      // A given container can only be assigned once per delivery.
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_client_delivery_container_unique
          ON tbl_client_delivery_container(client_deliveries_id, storage_location_id)
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_client_delivery_container_storage ON tbl_client_delivery_container(storage_location_id)`);
    },
  },
  {
    name: 'tbl_app_setting: container_pickup_default_deadline_days',
    async run() {
      await query(`
        INSERT INTO tbl_app_setting (setting_key, setting_value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (setting_key) DO NOTHING
      `, [
        'container_pickup_default_deadline_days',
        '30',
        'Default number of days a client has to pick up furniture from a locked container before staff follows up. Adjustable.',
      ]);
    },
  },

  // ============================================================
  // In-app issue tracker (2026-06-15)
  // ------------------------------------------------------------
  // Admin users can file an issue from any page via the "Report
  // issue" button in the PageHeader. Issues capture a screenshot
  // (PNG, taken by html2canvas client-side) plus the page URL,
  // viewport size, user agent, and a short narrative — what the
  // reporter expected vs. what actually happened, severity, and
  // free-text repro steps.
  //
  // Developers (a new is_developer flag on tbl_user_account)
  // triage at /dev/issues — investigating → resolved → closed —
  // and can broadcast a banner asking users to save + refresh
  // after a deploy.
  // ============================================================
  {
    name: 'tbl_user_account.is_developer',
    async run() {
      await query(`
        ALTER TABLE tbl_user_account
          ADD COLUMN IF NOT EXISTS is_developer BOOLEAN NOT NULL DEFAULT false
      `);
      // Partial index for the developer-list lookup.
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tbl_user_account_developer
          ON tbl_user_account (is_developer)
          WHERE is_developer = true
      `);
    },
  },
  {
    name: 'tbl_app_issue',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_app_issue (
          issue_id            SERIAL PRIMARY KEY,
          title               VARCHAR(200) NOT NULL,
          description         TEXT NOT NULL,
          severity            VARCHAR(20) NOT NULL DEFAULT 'medium'
                                CHECK (severity IN ('low', 'medium', 'high', 'critical')),
          status              VARCHAR(20) NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
          page_url            TEXT,
          page_title          VARCHAR(200),
          user_agent          TEXT,
          viewport_width      INTEGER,
          viewport_height     INTEGER,
          steps_to_reproduce  TEXT,
          expected_behavior   TEXT,
          actual_behavior     TEXT,
          screenshot_data     BYTEA,
          screenshot_content_type VARCHAR(80),
          reporter_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id) ON DELETE SET NULL,
          assignee_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id) ON DELETE SET NULL,
          resolution_notes    TEXT,
          resolved_at         TIMESTAMPTZ,
          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_app_issue_status   ON tbl_app_issue (status, created_at DESC)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_app_issue_reporter ON tbl_app_issue (reporter_user_account_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_app_issue_assignee ON tbl_app_issue (assignee_user_account_id) WHERE assignee_user_account_id IS NOT NULL`);
    },
  },
  {
    // Bump description from VARCHAR(200) -> VARCHAR(500) so newer
    // setting rows can carry a more helpful explanation. Existing
    // shorter values pass through unchanged. Must run BEFORE the
    // issue_reporter_visible_to_all insert, which previously
    // exceeded the 200-char cap and aborted startup.
    name: 'tbl_app_setting.description -> VARCHAR(500)',
    async run() {
      await query(`ALTER TABLE tbl_app_setting ALTER COLUMN description TYPE VARCHAR(500)`);
    },
  },
  {
    name: 'tbl_app_setting: issue_reporter_visible_to_all',
    async run() {
      await query(`
        INSERT INTO tbl_app_setting (setting_key, setting_value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (setting_key) DO NOTHING
      `, [
        'issue_reporter_visible_to_all',
        'false',
        'When set to "true", the Report Issue button appears in every page header for every signed-in staff user, not just admins. Useful during the initial rollout. Set back to "false" later to restrict reporting to admins.',
      ]);
    },
  },
  // ============================================================
  // Address dedupe (2026-06-16)
  // ------------------------------------------------------------
  // tbl_address has no uniqueness constraint and the quick-create
  // endpoint did an unconditional INSERT, so two identical addresses
  // produced two rows. With multiple staff entering the same place,
  // the table accumulated near-duplicates over time.
  //
  // Migration steps:
  //   1) Find normalized-equal duplicate groups
  //      (LOWER(TRIM(address)) + LOWER(TRIM(COALESCE(address2,'')))
  //       + city_id + state_id + postalcode).
  //   2) For each group, pick the lowest address_id as the canonical
  //      row. Re-point every FK in the six referencing tables
  //      (tbl_agency / tbl_contact / tbl_corp_facility /
  //       tbl_donation_pickup / tbl_donor / tbl_event) from each
  //      duplicate to the canonical.
  //   3) Delete the now-orphaned duplicate rows.
  //   4) Add a unique btree index on the normalized key so the
  //      schema enforces the property going forward. Future inserts
  //      use ON CONFLICT against this index for race-safe
  //      find-or-create behavior.
  //
  // Wrapped in a single DO block so partial failure rolls back.
  // ============================================================
  {
    name: 'tbl_address: dedupe normalized + unique index',
    async run() {
      await query(`
        DO $$
        DECLARE
          dup RECORD;
          dup_id INTEGER;
          merged_count INTEGER := 0;
          deleted_count INTEGER := 0;
        BEGIN
          -- Find each duplicate group and re-point its non-canonical IDs.
          FOR dup IN
            SELECT
              MIN(address_id) AS canonical_id,
              array_agg(address_id ORDER BY address_id) AS all_ids
            FROM tbl_address
            GROUP BY
              LOWER(TRIM(address)),
              LOWER(TRIM(COALESCE(address2, ''))),
              city_id, state_id, postalcode
            HAVING COUNT(*) > 1
          LOOP
            FOREACH dup_id IN ARRAY dup.all_ids
            LOOP
              CONTINUE WHEN dup_id = dup.canonical_id;
              UPDATE tbl_agency          SET address_id        = dup.canonical_id WHERE address_id        = dup_id;
              UPDATE tbl_contact         SET address_id        = dup.canonical_id WHERE address_id        = dup_id;
              UPDATE tbl_corp_facility   SET address_id        = dup.canonical_id WHERE address_id        = dup_id;
              UPDATE tbl_donation_pickup SET pickup_address_id = dup.canonical_id WHERE pickup_address_id = dup_id;
              UPDATE tbl_donor           SET address_id        = dup.canonical_id WHERE address_id        = dup_id;
              UPDATE tbl_event           SET address_id        = dup.canonical_id WHERE address_id        = dup_id;
              DELETE FROM tbl_address WHERE address_id = dup_id;
              merged_count := merged_count + 1;
              deleted_count := deleted_count + 1;
            END LOOP;
          END LOOP;
          IF deleted_count > 0 THEN
            RAISE NOTICE 'tbl_address dedupe: merged % duplicates, deleted % orphan rows', merged_count, deleted_count;
          END IF;
        END $$;
      `);

      // Now that duplicates are gone, the unique index can be safely
      // created. Idempotent via IF NOT EXISTS — re-running the migration
      // is a no-op once the index exists.
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_address_dedupe
          ON tbl_address (
            LOWER(TRIM(address)),
            LOWER(TRIM(COALESCE(address2, ''))),
            city_id,
            state_id,
            postalcode
          )
      `);
    },
  },

  {
    name: 'tbl_app_broadcast + tbl_app_broadcast_dismissal',
    async run() {
      await query(`
        CREATE TABLE IF NOT EXISTS tbl_app_broadcast (
          broadcast_id      SERIAL PRIMARY KEY,
          message           TEXT NOT NULL,
          kind              VARCHAR(20) NOT NULL DEFAULT 'info'
                              CHECK (kind IN ('info', 'refresh_required', 'warning')),
          related_issue_id  INTEGER REFERENCES tbl_app_issue(issue_id) ON DELETE SET NULL,
          is_active         BOOLEAN NOT NULL DEFAULT true,
          created_by_user_account_id INTEGER REFERENCES tbl_user_account(user_account_id) ON DELETE SET NULL,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at        TIMESTAMPTZ
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tbl_app_broadcast_active ON tbl_app_broadcast (is_active, created_at DESC) WHERE is_active = true`);

      await query(`
        CREATE TABLE IF NOT EXISTS tbl_app_broadcast_dismissal (
          broadcast_id      INTEGER NOT NULL REFERENCES tbl_app_broadcast(broadcast_id) ON DELETE CASCADE,
          user_account_id   INTEGER NOT NULL REFERENCES tbl_user_account(user_account_id) ON DELETE CASCADE,
          dismissed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (broadcast_id, user_account_id)
        )
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

/* ----------------------------------------------------------------- */
/*  Floating-holiday date helpers                                     */
/*                                                                    */
/*  Take year + 0-indexed month, return YYYY-MM-DD strings for the    */
/*  named US federal holiday dates.                                   */
/* ----------------------------------------------------------------- */

function pad(n: number): string { return String(n).padStart(2, '0'); }

function nthDayOfWeek(year: number, monthIdx: number, dayOfWeek: number, n: number): string {
  // dayOfWeek: 0 = Sun, 1 = Mon, … 6 = Sat. n: 1..5 (use 5 for "last").
  const first = new Date(Date.UTC(year, monthIdx, 1));
  const firstDow = first.getUTCDay();
  let day = 1 + ((dayOfWeek - firstDow + 7) % 7) + (n - 1) * 7;
  // For n=5 ("last"), step back a week until we're in the month.
  if (n === 5) {
    const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
    while (day > daysInMonth) day -= 7;
  }
  return `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
}

function firstMonday  (y: number, m: number): string { return nthDayOfWeek(y, m, 1, 1); }
function secondMonday (y: number, m: number): string { return nthDayOfWeek(y, m, 1, 2); }
function thirdMonday  (y: number, m: number): string { return nthDayOfWeek(y, m, 1, 3); }
function lastMonday   (y: number, m: number): string { return nthDayOfWeek(y, m, 1, 5); }
function fourthThursday(y: number, m: number): string { return nthDayOfWeek(y, m, 4, 4); }
