/**
 * Backend for the in-form "+ New" quick-create modals. Each endpoint
 * accepts a friendly, validated payload and runs the multi-row inserts
 * needed to create the entity (and any inline-composed sub-records) in
 * one transaction.
 *
 * Endpoints:
 *   POST /api/quick-create/address          → address only
 *   POST /api/quick-create/vehicle          → vehicle only
 *   POST /api/quick-create/contact          → contact only
 *   POST /api/quick-create/corp-facility    → address + facility (atomic)
 *   POST /api/quick-create/facility-staff   → contact + facility-staff link (atomic)
 *
 * Each returns `{ <pk>_id, label }` so the calling modal can immediately
 * select the new row in its FK dropdown without a roundtrip.
 *
 * These complement /api/donors (atomic donor + contact + address) that
 * shipped in Phase A.
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate } from '../auth/audit.js';

export const quickCreateRouter = Router();

/* ----------------------------------------------------------------- */
/*  POST /api/quick-create/address                                    */
/* ----------------------------------------------------------------- */

interface AddressPayload {
  address_name: string;
  address_type_id: number;
  address: string;
  address2?: string | null;
  city_id: number;
  county_id: number;
  state_id: number;
  postalcode: string;
  description?: string | null;
}

quickCreateRouter.post('/address', async (req, res, next) => {
  try {
    const b = req.body as AddressPayload;
    const errs: string[] = [];
    if (!b.address_name?.trim()) errs.push('Label is required');
    if (!b.address_type_id) errs.push('Type is required');
    if (!b.address?.trim()) errs.push('Street is required');
    if (!b.city_id) errs.push('City is required');
    if (!b.county_id) errs.push('County is required');
    if (!b.state_id) errs.push('State is required');
    if (!b.postalcode?.trim()) errs.push('ZIP is required');
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const row = await queryOne<{ address_id: number; address_name: string; address: string }>(`
      INSERT INTO tbl_address
        (address_name, address_type_id, address, address2, city_id, county_id, state_id, postalcode, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING address_id, address_name, address
    `, [
      b.address_name.trim(), b.address_type_id, b.address.trim(),
      b.address2?.trim() || null,
      b.city_id, b.county_id, b.state_id, b.postalcode.trim(),
      b.description?.trim() || null,
    ]);

    await auditCreate(req, 'tbl_address', row!.address_id, row!);
    // FK display label mirrors the admin config: "<name> — <street>"
    const label = `${row!.address_name} — ${row!.address}`;
    res.status(201).json({ address_id: row!.address_id, label });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/quick-create/vehicle                                    */
/* ----------------------------------------------------------------- */

interface VehiclePayload {
  corp_facility_id?: number | null;
  vehicle_make_id: number;
  vehicle_model_id: number;
  vehicle_type_id: number;
  model_year: number;
  vehicle_license?: string | null;
  description?: string | null;
}

quickCreateRouter.post('/vehicle', async (req, res, next) => {
  try {
    const b = req.body as VehiclePayload;
    const errs: string[] = [];
    if (!b.vehicle_make_id) errs.push('Make is required');
    if (!b.vehicle_model_id) errs.push('Model is required');
    if (!b.vehicle_type_id) errs.push('Type is required');
    const year = Number(b.model_year);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) errs.push('Model year must be a 4-digit integer');
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const row = await queryOne<{ vehicle_id: number; vehicle_license: string | null; model_year: number }>(`
      INSERT INTO tbl_vehicle
        (corp_facility_id, vehicle_make_id, vehicle_model_id, model_year, vehicle_type_id, vehicle_license, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING vehicle_id, vehicle_license, model_year
    `, [
      b.corp_facility_id ?? null,
      b.vehicle_make_id, b.vehicle_model_id, year, b.vehicle_type_id,
      b.vehicle_license?.trim() || null,
      b.description?.trim() || null,
    ]);

    await auditCreate(req, 'tbl_vehicle', row!.vehicle_id, row!);

    // Look up the human label parts to mirror the admin display format.
    const display = await queryOne<{ label: string }>(`
      SELECT
        (SELECT vehicle_make  FROM lkp_vehicle_make  WHERE vehicle_make_id  = $1) || ' ' ||
        (SELECT vehicle_model FROM lkp_vehicle_model WHERE vehicle_model_id = $2) || ' ' ||
        $3::text ||
        COALESCE(' (' || $4::text || ')', '') AS label
    `, [b.vehicle_make_id, b.vehicle_model_id, year, b.vehicle_license ?? null]);

    res.status(201).json({ vehicle_id: row!.vehicle_id, label: display?.label ?? `Vehicle #${row!.vehicle_id}` });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/quick-create/contact                                    */
/* ----------------------------------------------------------------- */

interface ContactPayload {
  contact_type_id: number;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  gender_id?: number | null;
  ethnicity_id?: number | null;
  birth_date?: string | null;
  citizen_status_id?: number | null;
  address_id?: number | null;
  mobile_phone?: string | null;
  home_phone?: string | null;
  other_phone?: string | null;
  email?: string | null;
  description?: string | null;
}

quickCreateRouter.post('/contact', async (req, res, next) => {
  try {
    const b = req.body as ContactPayload;
    const errs: string[] = [];
    if (!b.contact_type_id) errs.push('Contact type is required');
    if (!b.first_name?.trim()) errs.push('First name is required');
    if (!b.last_name?.trim()) errs.push('Last name is required');
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const row = await queryOne<{ contact_id: number; first_name: string; last_name: string }>(`
      INSERT INTO tbl_contact
        (contact_type_id, first_name, middle_name, last_name, gender_id, ethnicity_id,
         birth_date, citizen_status_id, address_id, mobile_phone, home_phone, other_phone, email, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING contact_id, first_name, last_name
    `, [
      b.contact_type_id, b.first_name.trim(), b.middle_name?.trim() || null, b.last_name.trim(),
      b.gender_id ?? null, b.ethnicity_id ?? null, b.birth_date || null, b.citizen_status_id ?? null,
      b.address_id ?? null,
      b.mobile_phone?.trim() || null, b.home_phone?.trim() || null,
      b.other_phone?.trim() || null, b.email?.trim() || null, b.description?.trim() || null,
    ]);

    await auditCreate(req, 'tbl_contact', row!.contact_id, row!);
    const label = `${row!.first_name} ${row!.last_name}`.trim() || `Contact #${row!.contact_id}`;
    res.status(201).json({ contact_id: row!.contact_id, label });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/quick-create/corp-facility — facility + address atomic  */
/* ----------------------------------------------------------------- */

interface CorpFacilityPayload {
  facility_name: string;
  facility_type_id: number;
  corporate_id?: number | null;  // optional — defaults to first corporate row
  description?: string | null;
  address: {
    address_name: string;
    address_type_id: number;
    address: string;
    address2?: string | null;
    city_id: number;
    county_id: number;
    state_id: number;
    postalcode: string;
  };
}

quickCreateRouter.post('/corp-facility', async (req, res, next) => {
  try {
    const b = req.body as CorpFacilityPayload;
    const errs: string[] = [];
    if (!b.facility_name?.trim()) errs.push('Facility name is required');
    if (!b.facility_type_id) errs.push('Facility type is required');
    if (!b.address) errs.push('Address section is required');
    else {
      if (!b.address.address_name?.trim()) errs.push('Address label is required');
      if (!b.address.address_type_id) errs.push('Address type is required');
      if (!b.address.address?.trim()) errs.push('Street is required');
      if (!b.address.city_id) errs.push('City is required');
      if (!b.address.county_id) errs.push('County is required');
      if (!b.address.state_id) errs.push('State is required');
      if (!b.address.postalcode?.trim()) errs.push('ZIP is required');
    }
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    // Default corporate_id to the first/only corporate row if not provided.
    // Most installs have exactly one corporate parent — no point making the
    // user pick from a list of one.
    let corporateId = b.corporate_id ?? null;
    if (!corporateId) {
      const first = await queryOne<{ corporate_id: number }>(
        `SELECT corporate_id FROM tbl_corporate ORDER BY corporate_id LIMIT 1`,
      );
      if (!first) return res.status(400).json({ error: 'No corporate parent exists — create one under /admin/tbl_corporate first.' });
      corporateId = first.corporate_id;
    }

    const result = await withTransaction(async (tx) => {
      const a = await tx.queryOne<{ address_id: number }>(`
        INSERT INTO tbl_address
          (address_name, address_type_id, address, address2, city_id, county_id, state_id, postalcode)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING address_id
      `, [
        b.address.address_name.trim(), b.address.address_type_id,
        b.address.address.trim(), b.address.address2?.trim() || null,
        b.address.city_id, b.address.county_id, b.address.state_id, b.address.postalcode.trim(),
      ]);

      const f = await tx.queryOne<{ corp_facility_id: number; facility_name: string }>(`
        INSERT INTO tbl_corp_facility
          (corporate_id, facility_name, address_id, facility_type_id, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING corp_facility_id, facility_name
      `, [corporateId, b.facility_name.trim(), a!.address_id, b.facility_type_id, b.description?.trim() || null]);

      return { corp_facility_id: f!.corp_facility_id, label: f!.facility_name };
    });

    await auditCreate(req, 'tbl_corp_facility', result.corp_facility_id, { facility_name: result.label });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/quick-create/facility-staff — staff + contact atomic    */
/* ----------------------------------------------------------------- */

interface FacilityStaffPayload {
  corp_facility_id: number;
  is_volunteer: boolean;
  hire_date?: string | null;
  description?: string | null;
  contact: {
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    mobile_phone?: string | null;
    email?: string | null;
  };
}

quickCreateRouter.post('/facility-staff', async (req, res, next) => {
  try {
    const b = req.body as FacilityStaffPayload;
    const errs: string[] = [];
    if (!b.corp_facility_id) errs.push('Home facility is required');
    if (typeof b.is_volunteer !== 'boolean') errs.push('Volunteer flag is required (true/false)');
    if (!b.contact) errs.push('Contact section is required');
    else {
      if (!b.contact.first_name?.trim()) errs.push('First name is required');
      if (!b.contact.last_name?.trim()) errs.push('Last name is required');
    }
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const result = await withTransaction(async (tx) => {
      // contact_type_id is "Staff" (=3) for paid staff or "Volunteer" (=4)
      // for volunteers per the seed.
      const contactTypeId = b.is_volunteer ? 4 : 3;
      const c = await tx.queryOne<{ contact_id: number }>(`
        INSERT INTO tbl_contact
          (contact_type_id, first_name, middle_name, last_name, mobile_phone, email)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING contact_id
      `, [
        contactTypeId, b.contact.first_name.trim(),
        b.contact.middle_name?.trim() || null, b.contact.last_name.trim(),
        b.contact.mobile_phone?.trim() || null, b.contact.email?.trim() || null,
      ]);

      const fs = await tx.queryOne<{ facility_staff_id: number }>(`
        INSERT INTO tbl_facility_staff
          (corp_facility_id, contact_id, is_volunteer, hire_date, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING facility_staff_id
      `, [b.corp_facility_id, c!.contact_id, b.is_volunteer, b.hire_date || null, b.description?.trim() || null]);

      const name = `${b.contact.first_name} ${b.contact.last_name}`.trim();
      return { facility_staff_id: fs!.facility_staff_id, label: name || `Staff #${fs!.facility_staff_id}` };
    });

    await auditCreate(req, 'tbl_facility_staff', result.facility_staff_id, { name: result.label });
    res.status(201).json(result);
  } catch (err) { next(err); }
});
