import { Router } from 'express';
import { query } from '../db/pool.js';

export const lookupsRouter = Router();

// Whitelist of lookup tables the frontend may fetch. Whitelist (not dynamic
// table-name) prevents SQL injection through the route parameter.
const LOOKUP_WHITELIST: Record<string, { table: string; id: string; label: string }> = {
  client_type:                { table: 'lkp_client_type',                id: 'client_type_id',                label: 'client_type' },
  client_status:              { table: 'lkp_client_status',              id: 'client_status_id',              label: 'client_status' },
  gender:                     { table: 'lkp_gender',                     id: 'gender_id',                     label: 'gender' },
  ethnicity:                  { table: 'lkp_ethnicity',                  id: 'ethnicity_id',                  label: 'ethnicity' },
  citizen_status:             { table: 'lkp_citizen_status',             id: 'citizen_status_id',             label: 'citizen_status' },
  contact_type:               { table: 'lkp_contact_type',               id: 'contact_type_id',               label: 'contact_type' },
  item_category:              { table: 'lkp_item_category',              id: 'item_category_id',              label: 'item_category' },
  item_condition:             { table: 'lkp_item_condition',             id: 'item_condition_id',             label: 'item_condition' },
  item_size:                  { table: 'lkp_item_size',                  id: 'item_size_id',                  label: 'item_size' },
  delivery_status:            { table: 'lkp_delivery_status',            id: 'delivery_status_id',            label: 'delivery_status' },
  pickup_status:              { table: 'lkp_pickup_status',              id: 'pickup_status_id',              label: 'pickup_status' },
  agency_type:                { table: 'lkp_agency_type',                id: 'agency_type_id',                label: 'agency_type' },
  donor_type:                 { table: 'lkp_donor_type',                 id: 'donor_type_id',                 label: 'donor_type' },
  donation_type:              { table: 'lkp_donation_type',              id: 'donation_type_id',              label: 'donation_type' },
  request_receipt_origin:     { table: 'lkp_request_receipt_origin',     id: 'request_receipt_origin_id',     label: 'request_receipt_origin' },
  howtheyfoundus:             { table: 'lkp_howtheyfoundus',             id: 'howtheyfoundus_id',             label: 'howtheyfoundus' },
  source_type:                { table: 'lkp_source_type',                id: 'source_type_id',                label: 'source_type' },
  city:                       { table: 'lkp_city',                       id: 'city_id',                       label: 'city' },
  county:                     { table: 'lkp_county',                     id: 'county_id',                     label: 'county' },
  state:                      { table: 'lkp_state',                      id: 'state_id',                      label: 'state' },
  volunteer_activity_type:    { table: 'lkp_volunteer_activity_type',    id: 'volunteer_activity_type_id',    label: 'volunteer_activity_type' },
  skill:                      { table: 'lkp_skill',                      id: 'skill_id',                      label: 'skill' },
  staff_role:                 { table: 'lkp_staff_role',                 id: 'staff_role_id',                 label: 'staff_role' },
};

/** GET /api/lookups/:name — fetch the entries of a lookup table */
lookupsRouter.get('/:name', async (req, res, next) => {
  try {
    const spec = LOOKUP_WHITELIST[req.params.name];
    if (!spec) return res.status(404).json({ error: 'Unknown lookup' });

    // Safe: table/column names came from whitelist, not user input.
    const rows = await query(
      `SELECT ${spec.id} AS id, ${spec.label} AS label FROM ${spec.table} ORDER BY ${spec.label}`
    );
    res.json(rows);
  } catch (err) { next(err); }
});
