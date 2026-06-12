-- Wipe all operational data from the database while preserving:
--   * Schema (every table, index, constraint)
--   * Lookup tables (lkp_*) — seeded dropdown values
--   * Migrations / system rows that the API expects on startup
--   * The current admin user (so you can still log in afterward)
--
-- Run this BEFORE bulk-importing real production data:
--
--   1. Take a fresh DigitalOcean snapshot of the database (Backups tab).
--   2. Connect to the prod DB via psql with the admin credentials.
--   3. \i 03_wipe_demo.sql
--   4. Verify: SELECT COUNT(*) FROM tbl_donor; should return 0.
--      The admin user account at tbl_user_account should still exist.
--   5. Import production data via the Excel templates flow.
--   6. Run sequence resets (see end of this file) so subsequent
--      app-created rows don't collide with imported IDs.
--
-- One CASCADE TRUNCATE handles the FK ordering automatically. The
-- alternative would be to truncate each table in dependency order,
-- which is fragile when new tables are added.

BEGIN;

-- Operational + transactional data — every tbl_* except a few system
-- tables we want to preserve. Use TRUNCATE ... CASCADE so dependent
-- rows cascade automatically and RESTART IDENTITY so future INSERTs
-- start at id 1.
TRUNCATE TABLE
  -- Communication + audit
  tbl_audit_log,
  tbl_communication_log,
  tbl_note,
  tbl_email_message,
  tbl_email_attachment,
  tbl_email_sync_state,
  tbl_email_template,
  tbl_email_account,
  -- Attachments
  tbl_attachment,
  tbl_entity_attachment,
  tbl_attachment_blob,
  tbl_manual_screenshot,
  -- Fundraising
  tbl_donation_designation,
  tbl_donation_securities,
  tbl_donation_check,
  tbl_donation_item,
  tbl_quickbooks_donation_sync,
  tbl_quickbooks_donor_link,
  tbl_quickbooks_connection,
  tbl_quickbooks_account_mapping,
  tbl_donation,
  tbl_pledge,
  tbl_event_attendee,
  tbl_event_sponsor,
  tbl_event,
  tbl_campaign,
  tbl_donor,
  -- Operations
  tbl_request_item_inv_matches,
  tbl_inventory_reservation,
  tbl_delivery_items,
  tbl_delivery_staff,
  tbl_delivery_vehicle,
  tbl_delivery_receipt,
  tbl_client_deliveries,
  tbl_client_waiver,
  tbl_waiver_template,
  tbl_client_request_items,
  tbl_client_provisioning_request,
  tbl_referral,
  tbl_client,
  tbl_donation_pickup,
  tbl_corp_facility_inventory_item,
  tbl_vendor_service,
  tbl_vendor,
  -- People + scheduling
  tbl_volunteer_shift_signup,
  tbl_volunteer_shift,
  tbl_volunteer_shift_template,
  tbl_volunteer_hours,
  tbl_volunteer_skill,
  tbl_volunteer_profile,
  tbl_volunteer_signup,
  tbl_staff_types,
  tbl_facility_staff_statuses,
  tbl_facility_staff,
  tbl_agency_contact,
  tbl_agency,
  tbl_corp_facility,
  tbl_corporate,
  tbl_vehicle_maintenance,
  tbl_vehicle_mileage,
  tbl_vehicle,
  tbl_contact,
  tbl_address,
  -- Org branding (singleton — re-seed after if needed)
  tbl_org_branding,
  -- Receipts counter (singleton — re-seed after)
  tbl_receipt_counter
RESTART IDENTITY CASCADE;

-- Preserve admin login: the bootstrap admin user account from
-- ensureInitialAdmin() should still exist. Keep ONLY admin accounts;
-- delete non-admin users. (If you want a totally fresh user list,
-- delete the WHERE clause too — but then re-running the API will
-- recreate an admin with a new temp password printed to logs.)
DELETE FROM tbl_user_account WHERE is_admin = false;

-- Re-seed the org branding singleton row (the migration expects it).
INSERT INTO tbl_org_branding (branding_id) VALUES (1) ON CONFLICT DO NOTHING;

-- After bulk import, reset sequences for any table whose rows you
-- imported with explicit IDs. Without this, the next app-created row
-- collides with an existing ID. Run these in psql after import:
--
--   SELECT setval('tbl_donor_donor_id_seq', (SELECT COALESCE(MAX(donor_id), 0) FROM tbl_donor));
--   SELECT setval('tbl_contact_contact_id_seq', (SELECT COALESCE(MAX(contact_id), 0) FROM tbl_contact));
--   SELECT setval('tbl_address_address_id_seq', (SELECT COALESCE(MAX(address_id), 0) FROM tbl_address));
--   SELECT setval('tbl_client_client_id_seq', (SELECT COALESCE(MAX(client_id), 0) FROM tbl_client));
--   ... and so on for every imported table.
--
-- Or, more brute-force, regenerate ALL sequences from current MAX:
--
--   DO $$ DECLARE r RECORD; BEGIN
--     FOR r IN SELECT c.table_name, c.column_name,
--                     pg_get_serial_sequence(c.table_name, c.column_name) AS seq
--                FROM information_schema.columns c
--               WHERE c.table_schema = 'public'
--                 AND c.column_default LIKE 'nextval%'
--     LOOP
--       EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I), 0))',
--                      r.seq, r.column_name, r.table_name);
--     END LOOP;
--   END $$;

COMMIT;

-- Sanity checks (run manually):
--   SELECT COUNT(*) FROM tbl_donor;           -- expect 0
--   SELECT COUNT(*) FROM tbl_client;          -- expect 0
--   SELECT COUNT(*) FROM tbl_donation;        -- expect 0
--   SELECT COUNT(*) FROM tbl_user_account;    -- expect 1 (the admin)
--   SELECT COUNT(*) FROM lkp_donor_type;      -- expect > 0 (lookups preserved)
--   SELECT COUNT(*) FROM lkp_state;           -- expect > 0
