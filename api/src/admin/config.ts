/**
 * Manual overrides for the generic admin. The introspector handles structure
 * (columns, types, FKs). This file handles UX — what to call things, what to
 * show in lists, and how to render a row's "display name" when it's referenced
 * elsewhere.
 *
 * Anything not listed here gets sensible auto-derived defaults.
 */

import type { FieldType } from './types.js';

export interface TableOverride {
  group: string;
  label?: string;
  singular?: string;
  description?: string;
  /** SQL expression returning the row's display text. `t` aliases the table. */
  displaySql?: string;
  listColumns?: string[];
  searchColumns?: string[];
  defaultSort?: { column: string; direction: 'asc' | 'desc' };
  /** Per-column overrides keyed by column name. */
  columns?: Record<string, ColumnOverride>;
  /** SQL predicate applied ONLY to the /fk-options dropdown query so
   *  the table can restrict what's pickable going forward without
   *  hiding existing rows from list/detail views. `t` aliases the row.
   *  Example: `t.is_approved = true`. */
  fkOptionsFilter?: string;
}

export interface ColumnOverride {
  label?: string;
  type?: FieldType;
  helpText?: string;
  hideInForm?: boolean;
  hideInList?: boolean;
  /** When the underlying VARCHAR is pinned by a CHECK constraint to a
   *  fixed set of values (e.g. severity / status / kind), declare them
   *  here so the admin form renders a <select> instead of a text input. */
  enumValues?: string[];
}

/**
 * Most lookup tables follow the convention `lkp_<name>` with a label column
 * also called `<name>`. We auto-handle those. This map only contains tables
 * that need explicit help.
 */
export const TABLE_OVERRIDES: Record<string, TableOverride> = {
  // ============================================================
  // People & Contacts
  // ============================================================
  tbl_contact: {
    group: 'People',
    label: 'Contacts',
    singular: 'Contact',
    description: 'A person — clients, donors, staff, volunteers, agency reps. Used wherever a person is referenced.',
    displaySql: "t.first_name || ' ' || t.last_name",
    listColumns: ['contact_id', 'first_name', 'last_name', 'contact_type_id', 'mobile_phone', 'email'],
    searchColumns: ['first_name', 'last_name', 'email', 'mobile_phone'],
    defaultSort: { column: 'last_name', direction: 'asc' },
    columns: {
      mobile_phone: { label: 'Mobile phone' },
      home_phone:   { label: 'Home phone' },
      other_phone:  { label: 'Other phone' },
      birth_date:   { label: 'Birth date' },
    },
  },
  tbl_address: {
    group: 'People',
    label: 'Addresses',
    singular: 'Address',
    displaySql: "t.address_name || ' — ' || t.address",
    listColumns: ['address_id', 'address_name', 'address', 'city_id', 'state_id', 'postalcode'],
    searchColumns: ['address_name', 'address', 'postalcode'],
    defaultSort: { column: 'address_name', direction: 'asc' },
    columns: {
      address: { label: 'Street address' },
      address2: { label: 'Address line 2' },
      postalcode: { label: 'Postal code' },
    },
  },
  tbl_user_account: {
    group: 'System',
    label: 'User accounts',
    singular: 'User account',
    description: 'Login credentials for staff and agency contacts.',
    displaySql: 't.username',
    listColumns: ['user_account_id', 'username', 'is_admin', 'facility_staff_id', 'is_active', 'last_login_at'],
    searchColumns: ['username'],
    columns: {
      password_hash: {
        type: 'text',
        label: 'Password',
        helpText: 'Type a new password — it will be hashed automatically. Leave blank to keep the current one (on edit).',
        hideInList: true,
      },
      last_login_at: { hideInForm: true },
      created_at:    { hideInForm: true },
      is_admin:      { label: 'Administrator', helpText: 'Grants access to the Database Admin tool.' },
      is_program_manager: { label: 'Program Manager', helpText: 'Grants access to the agency-application review queue and caseworker onboarding tools. Admins get this implicitly.' },
      is_active:     { label: 'Active', helpText: 'Disable to immediately lock this user out.' },
    },
  },
  tbl_audit_log: {
    group: 'System',
    label: 'Audit log',
    singular: 'Audit entry',
    description: 'Change history — populated automatically once auditing is wired up.',
    displaySql: "t.entity_type || ' #' || t.entity_id::text",
    listColumns: ['audit_log_id', 'user_account_id', 'action', 'entity_type', 'entity_id', 'action_at'],
    searchColumns: ['entity_type', 'action'],
    defaultSort: { column: 'action_at', direction: 'desc' },
    columns: {
      action_at: { hideInForm: true }, // system-set at audit time
    },
  },

  // ============================================================
  // Clients & Referrals
  // ============================================================
  tbl_client: {
    group: 'Clients & Referrals',
    label: 'Clients',
    singular: 'Client',
    displaySql: "(SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c WHERE c.contact_id = t.contact_id)",
    listColumns: ['client_id', 'contact_id', 'client_type_id', 'client_status_id', 'start_date'],
    searchColumns: [],
    columns: {
      start_date: { label: 'Intake date' },
    },
  },
  tbl_referral: {
    group: 'Clients & Referrals',
    label: 'Referrals',
    singular: 'Referral',
    displaySql: "(SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c JOIN tbl_client cl ON cl.contact_id = c.contact_id WHERE cl.client_id = t.client_id) || ' • ' || to_char(t.referral_date,'YYYY-MM-DD')",
    listColumns: ['referral_id', 'client_id', 'agency_contact_id', 'referral_date'],
    searchColumns: [],
    defaultSort: { column: 'referral_date', direction: 'desc' },
  },
  tbl_client_client_type: {
    group: 'Clients & Referrals',
    label: 'Client → Household Types',
    singular: 'Client Type Assignment',
    displaySql: "'#' || t.client_id::text || ' → ' || (SELECT client_type FROM lkp_client_type WHERE client_type_id = t.client_type_id)",
    listColumns: ['client_id', 'client_type_id'],
    searchColumns: [],
  },
  tbl_potential_duplicate: {
    group: 'Clients & Referrals',
    label: 'Potential Duplicates',
    singular: 'Potential Duplicate',
    displaySql: "'#' || t.client_id_a::text || ' vs #' || t.client_id_b::text || ' (' || t.match_score::text || '%)'",
    listColumns: ['potential_duplicate_id', 'client_id_a', 'client_id_b', 'match_score', 'status', 'detected_at'],
    searchColumns: ['match_reasons'],
    defaultSort: { column: 'detected_at', direction: 'desc' },
    columns: {
      match_reasons: { type: 'textarea', label: 'Why flagged' },
      status: {
        label: 'Status',
        enumValues: ['pending', 'merged', 'not_duplicate'],
      },
    },
  },
  tbl_client_provisioning_request: {
    group: 'Clients & Referrals',
    label: 'Provisioning Requests',
    singular: 'Provisioning Request',
    displaySql: "(SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c JOIN tbl_client cl ON cl.contact_id = c.contact_id WHERE cl.client_id = t.client_id) || ' • ' || to_char(t.request_at::date,'YYYY-MM-DD')",
    listColumns: ['client_provisioning_request_id', 'client_id', 'fulfillment_corp_facility_id', 'request_at'],
    searchColumns: ['client_request_note'],
    defaultSort: { column: 'request_at', direction: 'desc' },
    columns: {
      client_request_note: { type: 'textarea', label: 'Request notes' },
      review_status: {
        label: 'Review status',
        enumValues: ['awaiting_review', 'approved', 'rejected', 'in_progress', 'completed'],
      },
      referral_id: { label: 'Source referral' },
    },
  },
  tbl_client_request_items: {
    group: 'Clients & Referrals',
    label: 'Request Items',
    singular: 'Request Item',
    displaySql: "(SELECT ic.item_category FROM lkp_item_category ic WHERE ic.item_category_id = t.item_category_id) || ' ×' || t.quantity::text",
    listColumns: ['client_request_items_id', 'client_provisioning_request_id', 'item_category_id', 'quantity', 'priority'],
    searchColumns: ['item_notes'],
    columns: {
      item_notes: { type: 'textarea', label: 'Notes' },
      time_stamp: { label: 'Created at' },
    },
  },
  tbl_request_item_inv_matches: {
    group: 'Clients & Referrals',
    label: 'Request → Inventory Matches',
    singular: 'Match',
    displaySql: "'Match #' || t.request_item_inv_matches_id::text",
  },

  // ============================================================
  // Partner Agencies
  // ============================================================
  tbl_agency: {
    group: 'Partner Agencies',
    label: 'Agencies',
    singular: 'Agency',
    displaySql: 't.agency_name',
    listColumns: ['agency_id', 'agency_name', 'is_approved', 'agency_type_id', 'address_id'],
    searchColumns: ['agency_name'],
    defaultSort: { column: 'agency_name', direction: 'asc' },
    // Phase G: pickers on new records only see approved agencies.
    // Existing rows referencing a since-unapproved agency still resolve
    // labels correctly on list/detail — this filter is options-only.
    fkOptionsFilter: 't.is_approved = true',
    columns: {
      is_approved:        { label: 'Approved to refer', helpText: 'When true, this agency appears in referral dropdowns and on the public /referring-agencies page. Legacy seed rows default to true.' },
      public_description: { type: 'textarea', label: 'Public description', helpText: 'One-liner shown on the /referring-agencies page.' },
      needs_filled:       { type: 'textarea', label: 'Needs typically filled' },
      // The introspection layer promotes VARCHAR(>100) to textarea by default.
      // These are all single-line in practice — force text so the admin form
      // renders the right input.
      main_email:         { type: 'text' },
      website:            { type: 'text' },
    },
  },
  tbl_agency_contact: {
    group: 'Partner Agencies',
    label: 'Agency Contacts',
    singular: 'Agency Contact',
    displaySql: "(SELECT a.agency_name FROM tbl_agency a WHERE a.agency_id = t.agency_id) || ' — ' || (SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c WHERE c.contact_id = t.contact_id)",
    listColumns: ['agency_contact_id', 'agency_id', 'contact_id'],
    // Phase G: only surface contacts belonging to an approved agency in
    // the referral dropdown. Matches the tbl_agency filter above.
    fkOptionsFilter: 'EXISTS (SELECT 1 FROM tbl_agency a WHERE a.agency_id = t.agency_id AND a.is_approved = true)',
  },
  tbl_agency_client_type: {
    group: 'Partner Agencies',
    label: 'Agency → Client Types',
    singular: 'Agency Client Type',
    displaySql: "'#' || t.agency_id::text || ' → ' || (SELECT client_type FROM lkp_client_type WHERE client_type_id = t.client_type_id)",
    listColumns: ['agency_id', 'client_type_id'],
  },
  tbl_agency_application: {
    group: 'Partner Agencies',
    label: 'Agency Applications',
    singular: 'Agency Application',
    displaySql: "t.agency_name || ' (' || t.status || ')'",
    listColumns: ['agency_application_id', 'agency_name', 'main_email', 'status', 'submitted_at', 'approved_agency_id'],
    searchColumns: ['agency_name', 'main_email', 'legal_name'],
    defaultSort: { column: 'submitted_at', direction: 'desc' },
    columns: {
      status: {
        label: 'Status',
        enumValues: ['pending', 'approved', 'rejected'],
        helpText: 'Managed by the Applications review queue at /agencies/applications. Changing this here does NOT create the agency, send caseworker invites, or record a reviewer — use the review queue to approve or reject.',
      },
      public_description: { type: 'textarea' },
      needs_filled:      { type: 'textarea' },
      other_info:        { type: 'textarea' },
      rejection_note:    { type: 'textarea', helpText: 'Reason shown to Program Managers in the review queue. Set automatically when Reject is used there.' },
      // Force single-line for VARCHAR(>100) that would otherwise become textarea.
      legal_name:        { type: 'text' },
      main_email:        { type: 'text' },
      website:           { type: 'text' },
      // System-set fields — populated by the approve/reject transaction, not
      // meant to be edited by hand. Kept visible in the list column so admins
      // can see the outcome at a glance.
      submitted_at:                { label: 'Submitted at', hideInForm: true },
      reviewed_at:                 { label: 'Reviewed at', hideInForm: true },
      reviewed_by_user_account_id: { label: 'Reviewed by', hideInForm: true },
      approved_agency_id:          { label: 'Approved as agency', hideInForm: true },
    },
  },
  tbl_agency_application_caseworker: {
    group: 'Partner Agencies',
    label: 'Application Caseworkers',
    singular: 'Application Caseworker',
    displaySql: "t.first_name || ' ' || t.last_name || ' (' || t.email || ')'",
    listColumns: ['agency_application_caseworker_id', 'agency_application_id', 'first_name', 'last_name', 'email'],
    searchColumns: ['first_name', 'last_name', 'email'],
    columns: {
      email: { type: 'text' },
    },
  },
  tbl_agency_application_client_type: {
    group: 'Partner Agencies',
    label: 'Application → Client Types',
    singular: 'Application Client Type',
    displaySql: "'App#' || t.agency_application_id::text || ' → ' || (SELECT client_type FROM lkp_client_type WHERE client_type_id = t.client_type_id)",
    listColumns: ['agency_application_id', 'client_type_id'],
  },
  tbl_caseworker_invitation: {
    group: 'Partner Agencies',
    label: 'Caseworker Invitations',
    singular: 'Caseworker Invitation',
    displaySql: "t.email || ' (' || t.status || ')'",
    listColumns: ['caseworker_invitation_id', 'agency_id', 'email', 'status', 'issued_at', 'expires_at'],
    searchColumns: ['email'],
    defaultSort: { column: 'issued_at', direction: 'desc' },
    columns: {
      status: { label: 'Status', enumValues: ['pending', 'sent', 'accepted', 'expired', 'revoked'] },
      token:  { helpText: 'One-time signup token; do not share.' },
      email:  { type: 'text' },
    },
  },

  // ============================================================
  // Inventory & Donations
  // ============================================================
  tbl_donor: {
    group: 'Donations',
    label: 'Donors',
    singular: 'Donor',
    displaySql: "(SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c WHERE c.contact_id = t.contact_id)",
    listColumns: ['donor_id', 'contact_id', 'donor_type_id', 'address_id', 'is_recurring'],
    searchColumns: [],
    columns: {
      is_recurring: { label: 'Recurring donor' },
    },
  },
  tbl_donation: {
    group: 'Donations',
    label: 'Donations',
    singular: 'Donation',
    displaySql: "to_char(t.donation_date,'YYYY-MM-DD') || ' • $' || COALESCE(t.total_value::text,'?')",
    listColumns: ['donation_id', 'donor_id', 'donation_type_id', 'donation_date', 'total_value'],
    searchColumns: [],
    defaultSort: { column: 'donation_date', direction: 'desc' },
    columns: {
      total_value:        { type: 'money', label: 'Total value' },
      donation_date:      { label: 'Donation date' },
      receipt_sent_date:  { label: 'Receipt sent on' },
    },
  },
  tbl_donation_item: {
    group: 'Donations',
    label: 'Donation Items',
    singular: 'Donation Item',
    displaySql: 't.item_description',
    listColumns: ['donation_item_id', 'donation_id', 'item_description', 'item_category_id', 'item_condition_id', 'item_size_id'],
    searchColumns: ['item_description'],
    columns: {
      item_photo_url: { label: 'Photo URL', helpText: 'Direct URL to a photo of the item.' },
    },
  },
  tbl_donation_pickup: {
    group: 'Donations',
    label: 'Donation Pickups',
    singular: 'Pickup',
    displaySql: "(SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c JOIN tbl_donor d ON d.contact_id = c.contact_id WHERE d.donor_id = t.donor_id) || ' • ' || to_char(t.scheduled_date,'YYYY-MM-DD')",
    listColumns: ['donation_pickup_id', 'donor_id', 'scheduled_date', 'pickup_status_id', 'assigned_vehicle_id'],
    searchColumns: ['access_notes'],
    defaultSort: { column: 'scheduled_date', direction: 'desc' },
    columns: {
      time_window_start: { label: 'Window start' },
      time_window_end:   { label: 'Window end' },
      access_notes:      { type: 'textarea', label: 'Access notes' },
    },
  },
  tbl_corp_facility_inventory_item: {
    group: 'Inventory',
    label: 'Inventory Items',
    singular: 'Inventory Item',
    displaySql: "COALESCE((SELECT di.item_description FROM tbl_donation_item di WHERE di.donation_item_id = t.donation_item_id), 'Item #' || t.corp_facility_inventory_item_id::text)",
    listColumns: ['corp_facility_inventory_item_id', 'item_category_id', 'item_condition_id', 'item_size_id', 'storage_location_id', 'date_dispositioned'],
    searchColumns: [],
    defaultSort: { column: 'date_added_to_inventory', direction: 'desc' },
    columns: {
      donation_value_in:  { type: 'money', label: 'Value at intake' },
      donation_value_out: { type: 'money', label: 'Value at disposition' },
      date_added_to_inventory: { label: 'Date added' },
      date_dispositioned:      { label: 'Date dispositioned' },
    },
  },
  tbl_inventory_reservation: {
    group: 'Inventory',
    label: 'Inventory Reservations',
    singular: 'Reservation',
    displaySql: "'Reservation #' || t.inventory_reservation_id::text",
    listColumns: ['inventory_reservation_id', 'corp_facility_inventory_item_id', 'client_provisioning_request_id', 'reservation_status_id', 'reserved_at'],
    defaultSort: { column: 'reserved_at', direction: 'desc' },
    columns: {
      reserved_at: { hideInForm: true }, // system-set when reservation is made
    },
  },

  // ============================================================
  // Operations — Deliveries
  // ============================================================
  tbl_client_deliveries: {
    group: 'Operations',
    label: 'Deliveries',
    singular: 'Delivery',
    displaySql: "(SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c JOIN tbl_client cl ON cl.contact_id = c.contact_id JOIN tbl_client_provisioning_request r ON r.client_id = cl.client_id WHERE r.client_provisioning_request_id = t.client_provisioning_request_id) || ' • ' || to_char(t.delivery_date,'YYYY-MM-DD')",
    listColumns: ['client_deliveries_id', 'client_provisioning_request_id', 'delivery_date', 'delivery_status_id', 'facility_staff_id'],
    searchColumns: ['notes', 'gate_code'],
    defaultSort: { column: 'delivery_date', direction: 'desc' },
    columns: {
      notes: { type: 'textarea' },
      gate_code: { label: 'Gate code' },
      time_arrival_earliest: { label: 'Earliest arrival' },
      time_arrival_latest:   { label: 'Latest arrival' },
      time_delivery_complete: { label: 'Delivery completed at' },
    },
  },
  tbl_delivery_items: {
    group: 'Operations',
    label: 'Delivery Items',
    singular: 'Delivery Item',
    displaySql: "'Item on delivery #' || t.client_deliveries_id::text",
  },
  tbl_delivery_receipt: {
    group: 'Operations',
    label: 'Delivery Receipts',
    singular: 'Receipt',
    displaySql: "'Receipt for delivery #' || t.client_deliveries_id::text",
    listColumns: ['delivery_receipt_id', 'client_deliveries_id', 'signed_at', 'all_items_received', 'condition_acceptable', 'photo_release_granted'],
    columns: {
      recipient_notes: { type: 'textarea', label: 'Recipient notes' },
      all_items_received:    { label: 'All items received' },
      condition_acceptable:  { label: 'Condition acceptable' },
      photo_release_granted: { label: 'Photo release granted' },
      signed_at:             { hideInForm: true }, // system-set when receipt is recorded
    },
  },
  tbl_delivery_staff: {
    group: 'Operations',
    label: 'Delivery Crew',
    singular: 'Crew Member',
    displaySql: "'Crew on delivery #' || t.client_deliveries_id::text",
    columns: {
      is_team_lead: { label: 'Team lead' },
    },
  },
  tbl_delivery_vehicle: {
    group: 'Operations',
    label: 'Delivery Vehicles',
    singular: 'Delivery Vehicle',
    displaySql: "'Vehicle on delivery #' || t.client_deliveries_id::text",
    columns: {
      fuel_cost: { type: 'money', label: 'Fuel cost' },
      mileage_start: { label: 'Starting mileage' },
      mileage_end:   { label: 'Ending mileage' },
    },
  },

  // ============================================================
  // Facilities
  // ============================================================
  tbl_corporate: {
    group: 'Facilities',
    label: 'Corporate Entities',
    singular: 'Corporate Entity',
    displaySql: 't.corp_name',
    listColumns: ['corporate_id', 'corp_name', 'corp_type_id', 'incorp_state_id'],
    searchColumns: ['corp_name', 'fed_tax_id'],
    columns: {
      fed_tax_id: { label: 'Federal Tax ID (EIN)' },
    },
  },
  tbl_corp_facility: {
    group: 'Facilities',
    label: 'Facilities',
    singular: 'Facility',
    displaySql: 't.facility_name',
    listColumns: ['corp_facility_id', 'facility_name', 'corporate_id', 'facility_type_id', 'address_id'],
    searchColumns: ['facility_name'],
    defaultSort: { column: 'facility_name', direction: 'asc' },
  },

  // ============================================================
  // Staff & Volunteers
  // ============================================================
  tbl_facility_staff: {
    group: 'Staff & Volunteers',
    label: 'Staff & Volunteers',
    singular: 'Staff Member',
    displaySql: "(SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c WHERE c.contact_id = t.contact_id)",
    listColumns: ['facility_staff_id', 'contact_id', 'corp_facility_id', 'is_volunteer', 'hire_date'],
    searchColumns: [],
    columns: {
      is_volunteer: { label: 'Volunteer' },
      hire_date:    { label: 'Start date' },
    },
  },
  tbl_facility_staff_statuses: {
    group: 'Staff & Volunteers',
    label: 'Staff Status History',
    singular: 'Status Change',
    displaySql: "'Status change #' || t.facility_staff_statuses_id::text",
    listColumns: ['facility_staff_statuses_id', 'facility_staff_id', 'facility_staff_status_id', 'status_date_changed'],
    defaultSort: { column: 'status_date_changed', direction: 'desc' },
  },
  tbl_staff_type: {
    group: 'Staff & Volunteers',
    label: 'Staff Types',
    singular: 'Staff Type',
    displaySql: 't.staff_type',
    listColumns: ['staff_type_id', 'staff_type', 'staff_role_id'],
    searchColumns: ['staff_type'],
  },
  tbl_staff_types: {
    group: 'Staff & Volunteers',
    label: 'Staff Type Assignments',
    singular: 'Type Assignment',
    displaySql: "'Assignment #' || t.staff_types_id::text",
  },
  tbl_volunteer_profile: {
    group: 'Staff & Volunteers',
    label: 'Volunteer Profiles',
    singular: 'Volunteer Profile',
    displaySql: "(SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c JOIN tbl_facility_staff fs ON fs.contact_id = c.contact_id WHERE fs.facility_staff_id = t.facility_staff_id)",
    listColumns: ['volunteer_profile_id', 'facility_staff_id', 'waiver_signed', 'background_check_status', 'background_check_expiration'],
    columns: {
      waiver_signed: { label: 'Waiver signed' },
      waiver_signed_date: { label: 'Waiver signed on' },
      waiver_version: { label: 'Waiver version' },
      background_check_status: { label: 'Background check status' },
      background_check_expiration: { label: 'Background check expires' },
      emergency_contact_name:  { label: 'Emergency contact name' },
      emergency_contact_phone: { label: 'Emergency contact phone' },
      t_shirt_size: { label: 'T-shirt size' },
    },
  },
  tbl_volunteer_skill: {
    group: 'Staff & Volunteers',
    label: 'Volunteer Skills',
    singular: 'Skill Assignment',
    displaySql: "'Skill assignment #' || t.volunteer_skill_id::text",
  },
  tbl_volunteer_hours: {
    group: 'Staff & Volunteers',
    label: 'Volunteer Hours',
    singular: 'Hours Entry',
    displaySql: "(SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c JOIN tbl_facility_staff fs ON fs.contact_id = c.contact_id WHERE fs.facility_staff_id = t.facility_staff_id) || ' • ' || t.hours_logged::text || 'h'",
    listColumns: ['volunteer_hours_id', 'facility_staff_id', 'activity_date', 'hours_logged', 'volunteer_activity_type_id'],
    searchColumns: ['notes'],
    defaultSort: { column: 'activity_date', direction: 'desc' },
    columns: {
      hours_logged: { label: 'Hours' },
      activity_date: { label: 'Activity date' },
      notes: { type: 'textarea' },
    },
  },

  // ============================================================
  // Vehicles
  // ============================================================
  tbl_vehicle: {
    group: 'Vehicles',
    label: 'Vehicles',
    singular: 'Vehicle',
    displaySql: "t.model_year::text || ' ' || (SELECT m.vehicle_make FROM lkp_vehicle_make m WHERE m.vehicle_make_id = t.vehicle_make_id) || ' ' || (SELECT mo.vehicle_model FROM lkp_vehicle_model mo WHERE mo.vehicle_model_id = t.vehicle_model_id)",
    listColumns: ['vehicle_id', 'model_year', 'vehicle_make_id', 'vehicle_model_id', 'vehicle_license', 'corp_facility_id'],
    searchColumns: ['vehicle_license'],
    defaultSort: { column: 'model_year', direction: 'desc' },
    columns: {
      model_year: { label: 'Year' },
      vehicle_license: { label: 'License plate' },
    },
  },
  tbl_vehicle_mileage: {
    group: 'Vehicles',
    label: 'Mileage Log',
    singular: 'Mileage Entry',
    displaySql: "'Mileage entry #' || t.vehicle_mileage_id::text",
    listColumns: ['vehicle_mileage_id', 'vehicle_id', 'date_recorded', 'mileage'],
    defaultSort: { column: 'date_recorded', direction: 'desc' },
  },
  tbl_vehicle_maintenance: {
    group: 'Vehicles',
    label: 'Vehicle Maintenance',
    singular: 'Maintenance Record',
    displaySql: "(SELECT mt.maintenance_type FROM lkp_maintenance_type mt WHERE mt.maintenance_type_id = t.maintenance_type_id) || ' on ' || to_char(t.service_date,'YYYY-MM-DD')",
    listColumns: ['vehicle_maintenance_id', 'vehicle_id', 'maintenance_type_id', 'service_date', 'cost', 'next_due_date'],
    searchColumns: ['vendor', 'notes'],
    defaultSort: { column: 'service_date', direction: 'desc' },
    columns: {
      cost: { type: 'money' },
      service_date: { label: 'Service date' },
      next_due_date: { label: 'Next due' },
      notes: { type: 'textarea' },
    },
  },

  // ============================================================
  // Events & Grants
  // ============================================================
  tbl_event: {
    group: 'Events & Grants',
    label: 'Events',
    singular: 'Event',
    displaySql: 't.event_name',
    listColumns: ['event_id', 'event_name', 'event_type_id', 'event_date', 'goal_amount', 'amount_raised'],
    searchColumns: ['event_name'],
    defaultSort: { column: 'event_date', direction: 'desc' },
    columns: {
      goal_amount:    { type: 'money', label: 'Goal' },
      amount_raised:  { type: 'money', label: 'Raised' },
      start_time:     { label: 'Start time' },
      end_time:       { label: 'End time' },
    },
  },
  tbl_event_attendee: {
    group: 'Events & Grants',
    label: 'Event Attendees',
    singular: 'Attendee',
    displaySql: "(SELECT e.event_name FROM tbl_event e WHERE e.event_id = t.event_id) || ' — ' || (SELECT c.first_name || ' ' || c.last_name FROM tbl_contact c WHERE c.contact_id = t.contact_id)",
    listColumns: ['event_attendee_id', 'event_id', 'contact_id', 'rsvp_status', 'attended', 'amount_contributed'],
    columns: {
      rsvp_status:        { label: 'RSVP status' },
      amount_contributed: { type: 'money', label: 'Contribution' },
    },
  },
  tbl_grant: {
    group: 'Events & Grants',
    label: 'Grants',
    singular: 'Grant',
    displaySql: "t.funder_name || ' — ' || t.grant_name",
    listColumns: ['grant_id', 'funder_name', 'grant_name', 'award_amount', 'period_start', 'period_end'],
    searchColumns: ['funder_name', 'grant_name'],
    defaultSort: { column: 'period_start', direction: 'desc' },
    columns: {
      funder_name:        { label: 'Funder' },
      grant_name:         { label: 'Grant name' },
      award_amount:       { type: 'money', label: 'Award amount' },
      period_start:       { label: 'Period start' },
      period_end:         { label: 'Period end' },
      reporting_deadline: { label: 'Reporting deadline' },
      restrictions:       { type: 'textarea' },
    },
  },

  // ============================================================
  // Notes & Communication
  // ============================================================
  tbl_note: {
    group: 'Notes & Communication',
    label: 'Notes',
    singular: 'Note',
    displaySql: "'Note #' || t.note_id::text",
    listColumns: ['note_id', 'note_entity_type_id', 'entity_id', 'author_facility_staff_id', 'created_at'],
    searchColumns: ['note_body'],
    defaultSort: { column: 'created_at', direction: 'desc' },
    columns: {
      note_body:  { type: 'textarea', label: 'Body' },
      entity_id:  { label: 'Linked entity ID', helpText: 'ID of the record this note is attached to (paired with Entity type).' },
      created_at: { label: 'Created at', hideInForm: true }, // system-set on insert
    },
  },
  tbl_communication_log: {
    group: 'Notes & Communication',
    label: 'Communication Log',
    singular: 'Communication',
    displaySql: "'Communication #' || t.communication_log_id::text",
    listColumns: ['communication_log_id', 'note_entity_type_id', 'entity_id', 'communication_method_id', 'communication_at', 'follow_up_needed'],
    searchColumns: ['summary'],
    defaultSort: { column: 'communication_at', direction: 'desc' },
    columns: {
      summary:           { type: 'textarea' },
      communication_at:  { label: 'When' },
      follow_up_needed:  { label: 'Follow-up needed' },
      follow_up_date:    { label: 'Follow-up by' },
      entity_id:         { label: 'Linked entity ID' },
    },
  },
  tbl_attachment: {
    group: 'Notes & Communication',
    label: 'Attachments',
    singular: 'Attachment',
    displaySql: "COALESCE(t.file_name, 'Attachment #' || t.attachment_id::text)",
    listColumns: ['attachment_id', 'attachment_entity_type_id', 'entity_id', 'file_name', 'mime_type', 'uploaded_at'],
    searchColumns: ['file_name'],
    columns: {
      file_url:    { label: 'File URL' },
      mime_type:   { label: 'MIME type' },
      uploaded_at: { label: 'Uploaded at', hideInForm: true }, // system-set on upload
    },
  },
  // Shift templates have a dedicated admin page at /admin/shift-templates
  // with friendly day-of-week toggles. Keep the table listed in the
  // generic admin tool for diagnostics, but hide the raw mask column
  // from the auto-form so it doesn't ask non-technical users to enter
  // a bitmask integer.
  tbl_shift_template: {
    group: 'Operations',
    label: 'Shift Templates (raw)',
    singular: 'Shift Template',
    displaySql: 't.template_name',
    columns: {
      day_of_week_mask: {
        label: 'Day-of-week bitmask',
        hideInForm: true,    // managed via the friendly toggles on /admin/shift-templates
      },
      created_at: { label: 'Created at', hideInForm: true },
    },
  },

  // ============================================================
  // CHECK-constrained VARCHAR enums.
  // ============================================================
  // The columns below are VARCHAR(N) with a CHECK (... IN (...)) clause
  // that pins them to a fixed value set. Postgres won't surface those
  // values through information_schema, so without these enumValues the
  // admin form would render a freeform text input (and the user would
  // have to know to type the exact string).
  // ============================================================
  tbl_app_issue: {
    group: 'System',
    label: 'App Issues',
    singular: 'App Issue',
    description: 'Issues filed from inside the app via the Report Issue button. Manage at /dev/issues for the full developer workflow.',
    displaySql: "'#' || t.issue_id::text || ' — ' || COALESCE(t.title, '(no title)')",
    columns: {
      severity:        { label: 'Severity', enumValues: ['low', 'medium', 'high', 'critical'] },
      status:          { label: 'Status',   enumValues: ['open', 'investigating', 'resolved', 'closed'] },
      screenshot_data: { hideInForm: true, hideInList: true },
      user_agent:      { hideInList: true },
    },
  },
  tbl_app_broadcast: {
    group: 'System',
    label: 'App Broadcasts',
    singular: 'App Broadcast',
    description: 'Banners pushed to every signed-in user. Manage at /dev/broadcasts for the full developer workflow.',
    displaySql: "'#' || t.broadcast_id::text || ' — ' || LEFT(COALESCE(t.message, ''), 60)",
    columns: {
      kind: { label: 'Kind', enumValues: ['info', 'refresh_required', 'warning'] },
    },
  },
  tbl_volunteer_signup: {
    group: 'Staff & Volunteers',
    label: 'Volunteer Applications',
    singular: 'Volunteer Application',
    description: 'Pending public volunteer-signup submissions. Review at /admin/volunteer-signups for the friendly workflow.',
    displaySql: "t.first_name || ' ' || t.last_name",
    columns: {
      frequency: { label: 'Frequency',  enumValues: ['one_time', 'recurring', 'on_call'] },
      can_lift:  { label: 'Lifting capacity', enumValues: ['under_25', '25_50', '50_plus', 'cannot'] },
      status:    { label: 'Status',     enumValues: ['pending', 'approved', 'rejected', 'archived'] },
    },
  },
  tbl_volunteer_shift_signup: {
    group: 'Staff & Volunteers',
    label: 'Shift Signups',
    singular: 'Shift Signup',
    displaySql: "'Signup #' || t.signup_id::text",
    columns: {
      signup_status: { label: 'Signup status', enumValues: ['signed_up', 'cancelled', 'attended', 'no_show'] },
    },
  },
  tbl_email_account: {
    group: 'Notes & Communication',
    label: 'Email Accounts',
    singular: 'Email Account',
    displaySql: 't.email_address',
    columns: {
      provider:         { label: 'Provider',    enumValues: ['gmail', 'icloud', 'outlook', 'yahoo', 'proton', 'imap'] },
      auth_type:        { label: 'Auth type',   enumValues: ['password', 'oauth'] },
      last_test_status: { label: 'Last test',   enumValues: ['success', 'failure'] },
      // OAuth + IMAP secrets are encrypted at rest; never display.
      oauth_access_token_enc:  { hideInForm: true, hideInList: true },
      oauth_refresh_token_enc: { hideInForm: true, hideInList: true },
      encrypted_password:      { hideInForm: true, hideInList: true },
    },
  },
};

/**
 * Custom labels per lookup table when the snake-case-to-title-case default
 * isn't pretty enough.
 */
export const LOOKUP_OVERRIDES: Record<string, Partial<TableOverride>> = {
  lkp_howtheyfoundus: { label: 'How They Found Us', singular: 'Source' },
  lkp_facility_staff_status: { label: 'Staff Statuses', singular: 'Staff Status' },
  lkp_role_pay_type: { label: 'Pay Types', singular: 'Pay Type' },
};

/**
 * The order groups appear in the sidebar. Groups not listed go to the end,
 * alphabetically.
 */
export const GROUP_ORDER = [
  'Clients & Referrals',
  'Inventory',
  'Donations',
  'Operations',
  'Partner Agencies',
  'People',
  'Staff & Volunteers',
  'Facilities',
  'Vehicles',
  'Events & Grants',
  'Notes & Communication',
  'Lookups',
  'System',
];
