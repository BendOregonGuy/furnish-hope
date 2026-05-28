-- Furnish Hope — full schema DDL (PostgreSQL)
-- Generated from ERD v5. 85 tables.
--
-- Conventions:
--   - Table and column names lowercased (Postgres convention)
--   - PKs are SERIAL (auto-increment integers)
--   - All FKs are deferred-checked, NOT CASCADE — deletes require explicit handling

BEGIN;

CREATE TABLE lkp_address_type (
    address_type_id SERIAL PRIMARY KEY,
    address_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_agency_type (
    agency_type_id SERIAL PRIMARY KEY,
    agency_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_attachment_entity_type (
    attachment_entity_type_id SERIAL PRIMARY KEY,
    attachment_entity_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_citizen_status (
    citizen_status_id SERIAL PRIMARY KEY,
    citizen_status VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_client_status (
    client_status_id SERIAL PRIMARY KEY,
    client_status VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_client_type (
    client_type_id SERIAL PRIMARY KEY,
    client_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_communication_method (
    communication_method_id SERIAL PRIMARY KEY,
    communication_method VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_contact_type (
    contact_type_id SERIAL PRIMARY KEY,
    contact_type VARCHAR(25) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_corp_type (
    corp_type_id SERIAL PRIMARY KEY,
    corp_type VARCHAR(25) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_delivery_status (
    delivery_status_id SERIAL PRIMARY KEY,
    delivery_status VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_delivery_vehicle_type (
    delivery_vehicle_type_id SERIAL PRIMARY KEY,
    delivery_vehicle_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_disposition_reason (
    disposition_reason_id SERIAL PRIMARY KEY,
    disposition_reason VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_donation_type (
    donation_type_id SERIAL PRIMARY KEY,
    donation_type VARCHAR(25) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_donor_type (
    donor_type_id SERIAL PRIMARY KEY,
    donor_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_ethnicity (
    ethnicity_id SERIAL PRIMARY KEY,
    ethnicity VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_event_type (
    event_type_id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_facility_staff_status (
    facility_staff_status_id SERIAL PRIMARY KEY,
    facility_staff_status VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_facility_type (
    facility_type_id SERIAL PRIMARY KEY,
    facility_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_gender (
    gender_id SERIAL PRIMARY KEY,
    gender VARCHAR(20) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_item_category (
    item_category_id SERIAL PRIMARY KEY,
    item_category VARCHAR(100) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_item_condition (
    item_condition_id SERIAL PRIMARY KEY,
    item_condition VARCHAR(20) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_item_size (
    item_size_id SERIAL PRIMARY KEY,
    item_size VARCHAR(20) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_item_weight (
    item_weight_id SERIAL PRIMARY KEY,
    item_weight VARCHAR(50) NOT NULL,
    weight_lbs_min INTEGER,
    weight_lbs_max INTEGER,
    description VARCHAR(100)
);

CREATE TABLE lkp_maintenance_type (
    maintenance_type_id SERIAL PRIMARY KEY,
    maintenance_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_note_entity_type (
    note_entity_type_id SERIAL PRIMARY KEY,
    note_entity_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_pickup_status (
    pickup_status_id SERIAL PRIMARY KEY,
    pickup_status VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_rental_agency (
    rental_agency_id SERIAL PRIMARY KEY,
    rental_agency VARCHAR(100) NOT NULL,
    account_number VARCHAR(25),
    description VARCHAR(100)
);

CREATE TABLE lkp_request_receipt_origin (
    request_receipt_origin_id SERIAL PRIMARY KEY,
    request_receipt_origin VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_reservation_status (
    reservation_status_id SERIAL PRIMARY KEY,
    reservation_status VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_role_pay_type (
    role_pay_type_id SERIAL PRIMARY KEY,
    role_pay_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_skill (
    skill_id SERIAL PRIMARY KEY,
    skill VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_source_type (
    source_type_id SERIAL PRIMARY KEY,
    source_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_state (
    state_id SERIAL PRIMARY KEY,
    state VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_status_change_reason (
    status_change_reason_id SERIAL PRIMARY KEY,
    status_change_reason VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_vehicle_fuel_type (
    vehicle_fuel_type_id SERIAL PRIMARY KEY,
    vehicle_fuel_type VARCHAR(15) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_vehicle_make (
    vehicle_make_id SERIAL PRIMARY KEY,
    vehicle_make VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_vehicle_weight_class (
    vehicle_weight_class_id SERIAL PRIMARY KEY,
    vehicle_weight_class VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_volunteer_activity_type (
    volunteer_activity_type_id SERIAL PRIMARY KEY,
    volunteer_activity_type VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_grant (
    grant_id SERIAL PRIMARY KEY,
    funder_name VARCHAR(100) NOT NULL,
    grant_name VARCHAR(100) NOT NULL,
    award_amount NUMERIC(12,2) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    reporting_deadline DATE,
    restrictions TEXT,
    description VARCHAR(100)
);

CREATE TABLE lkp_county (
    county_id SERIAL PRIMARY KEY,
    state_id INTEGER NOT NULL,
    county VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_howtheyfoundus (
    howtheyfoundus_id SERIAL PRIMARY KEY,
    howtheyfoundus VARCHAR(50) NOT NULL,
    source_type_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_staff_role (
    staff_role_id SERIAL PRIMARY KEY,
    staff_role VARCHAR(50) NOT NULL,
    role_pay_type_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_vehicle_model (
    vehicle_model_id SERIAL PRIMARY KEY,
    vehicle_make_id INTEGER NOT NULL,
    vehicle_model VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_vehicle_type (
    vehicle_type_id SERIAL PRIMARY KEY,
    vehicle_type VARCHAR(50) NOT NULL,
    vehicle_weight_class_id INTEGER NOT NULL,
    vehicle_fuel_type_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_corporate (
    corporate_id SERIAL PRIMARY KEY,
    corp_type_id INTEGER NOT NULL,
    corp_name VARCHAR(100) NOT NULL,
    fed_tax_id VARCHAR(20),
    incorp_state_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE lkp_city (
    city_id SERIAL PRIMARY KEY,
    county_id INTEGER NOT NULL,
    city VARCHAR(50) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_staff_type (
    staff_type_id SERIAL PRIMARY KEY,
    staff_type VARCHAR(50) NOT NULL,
    staff_role_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_address (
    address_id SERIAL PRIMARY KEY,
    address_name VARCHAR(50) NOT NULL,
    address_type_id INTEGER NOT NULL,
    address VARCHAR(100) NOT NULL,
    address2 VARCHAR(50),
    city_id INTEGER NOT NULL,
    county_id INTEGER NOT NULL,
    state_id INTEGER NOT NULL,
    postalcode VARCHAR(10) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_agency (
    agency_id SERIAL PRIMARY KEY,
    agency_name VARCHAR(100) NOT NULL,
    address_id INTEGER NOT NULL,
    agency_type_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_contact (
    contact_id SERIAL PRIMARY KEY,
    contact_type_id INTEGER NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    gender_id INTEGER,
    ethnicity_id INTEGER,
    birth_date DATE,
    citizen_status_id INTEGER,
    address_id INTEGER,
    mobile_phone VARCHAR(20),
    home_phone VARCHAR(20),
    other_phone VARCHAR(20),
    email VARCHAR(100),
    description VARCHAR(100)
);

CREATE TABLE tbl_event (
    event_id SERIAL PRIMARY KEY,
    event_type_id INTEGER NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    address_id INTEGER,
    goal_amount NUMERIC(12,2),
    amount_raised NUMERIC(12,2),
    description VARCHAR(100)
);

CREATE TABLE tbl_agency_contact (
    agency_contact_id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_client (
    client_id SERIAL PRIMARY KEY,
    client_type_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    start_date DATE,
    client_status_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_corp_facility (
    corp_facility_id SERIAL PRIMARY KEY,
    corporate_id INTEGER NOT NULL,
    facility_name VARCHAR(100) NOT NULL,
    contact_id INTEGER,
    address_id INTEGER NOT NULL,
    facility_type_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_donor (
    donor_id SERIAL PRIMARY KEY,
    donor_type_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    address_id INTEGER NOT NULL,
    howtheyfoundus_id INTEGER NOT NULL,
    is_recurring BOOLEAN NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_event_attendee (
    event_attendee_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    rsvp_status VARCHAR(20),
    attended BOOLEAN,
    amount_contributed NUMERIC(12,2),
    description VARCHAR(100)
);

CREATE TABLE lkp_storage_location (
    storage_location_id SERIAL PRIMARY KEY,
    corp_facility_id INTEGER NOT NULL,
    location_code VARCHAR(20) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_donation (
    donation_id SERIAL PRIMARY KEY,
    donor_id INTEGER NOT NULL,
    donation_type_id INTEGER NOT NULL,
    donation_date DATE NOT NULL,
    total_value NUMERIC(12,2),
    receipt_sent_date DATE,
    description VARCHAR(100)
);

CREATE TABLE tbl_facility_staff (
    facility_staff_id SERIAL PRIMARY KEY,
    corp_facility_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    is_volunteer BOOLEAN NOT NULL,
    hire_date DATE,
    description VARCHAR(100)
);

CREATE TABLE tbl_referral (
    referral_id SERIAL PRIMARY KEY,
    agency_contact_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    referral_date DATE NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_vehicle (
    vehicle_id SERIAL PRIMARY KEY,
    corp_facility_id INTEGER,
    vehicle_make_id INTEGER NOT NULL,
    vehicle_model_id INTEGER NOT NULL,
    model_year INTEGER NOT NULL,
    vehicle_type_id INTEGER NOT NULL,
    vehicle_license VARCHAR(15),
    description VARCHAR(100)
);

CREATE TABLE tbl_attachment (
    attachment_id SERIAL PRIMARY KEY,
    attachment_entity_type_id INTEGER NOT NULL,
    entity_id INTEGER NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    file_name VARCHAR(100),
    mime_type VARCHAR(50),
    uploaded_by_facility_staff_id INTEGER NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_client_provisioning_request (
    client_provisioning_request_id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    client_request_note TEXT,
    fulfillment_corp_facility_id INTEGER NOT NULL,
    request_receipt_origin_id INTEGER NOT NULL,
    client_request_creator_facility_staff_id INTEGER NOT NULL,
    request_at TIMESTAMPTZ NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_communication_log (
    communication_log_id SERIAL PRIMARY KEY,
    note_entity_type_id INTEGER NOT NULL,
    entity_id INTEGER NOT NULL,
    communication_method_id INTEGER NOT NULL,
    facility_staff_id INTEGER NOT NULL,
    communication_at TIMESTAMPTZ NOT NULL,
    summary TEXT NOT NULL,
    follow_up_needed BOOLEAN NOT NULL,
    follow_up_date DATE,
    description VARCHAR(100)
);

CREATE TABLE tbl_donation_item (
    donation_item_id SERIAL PRIMARY KEY,
    donation_id INTEGER NOT NULL,
    item_description VARCHAR(100) NOT NULL,
    item_category_id INTEGER NOT NULL,
    item_condition_id INTEGER NOT NULL,
    item_size_id INTEGER NOT NULL,
    item_photo_url VARCHAR(255),
    description VARCHAR(100)
);

CREATE TABLE tbl_donation_pickup (
    donation_pickup_id SERIAL PRIMARY KEY,
    donor_id INTEGER NOT NULL,
    pickup_address_id INTEGER NOT NULL,
    pickup_status_id INTEGER NOT NULL,
    scheduled_date DATE NOT NULL,
    time_window_start TIME,
    time_window_end TIME,
    assigned_vehicle_id INTEGER,
    assigned_lead_facility_staff_id INTEGER,
    access_notes TEXT,
    description VARCHAR(100)
);

CREATE TABLE tbl_facility_staff_statuses (
    facility_staff_statuses_id SERIAL PRIMARY KEY,
    facility_staff_id INTEGER NOT NULL,
    facility_staff_status_id INTEGER NOT NULL,
    status_date_changed DATE NOT NULL,
    changed_by_facility_staff_id INTEGER NOT NULL,
    status_change_reason_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_note (
    note_id SERIAL PRIMARY KEY,
    note_entity_type_id INTEGER NOT NULL,
    entity_id INTEGER NOT NULL,
    author_facility_staff_id INTEGER NOT NULL,
    note_body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_staff_types (
    staff_types_id SERIAL PRIMARY KEY,
    facility_staff_id INTEGER NOT NULL,
    staff_type_id INTEGER NOT NULL,
    date_changed DATE NOT NULL,
    date_effective DATE NOT NULL,
    is_active BOOLEAN NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_user_account (
    user_account_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    facility_staff_id INTEGER,
    agency_contact_id INTEGER,
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_vehicle_maintenance (
    vehicle_maintenance_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL,
    maintenance_type_id INTEGER NOT NULL,
    service_date DATE NOT NULL,
    vendor VARCHAR(100),
    cost NUMERIC(12,2),
    next_due_date DATE,
    notes TEXT,
    description VARCHAR(100)
);

CREATE TABLE tbl_vehicle_mileage (
    vehicle_mileage_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL,
    date_recorded DATE NOT NULL,
    mileage INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_volunteer_hours (
    volunteer_hours_id SERIAL PRIMARY KEY,
    facility_staff_id INTEGER NOT NULL,
    volunteer_activity_type_id INTEGER NOT NULL,
    activity_date DATE NOT NULL,
    hours_logged NUMERIC(5,2) NOT NULL,
    verified_by_facility_staff_id INTEGER,
    notes TEXT,
    description VARCHAR(100)
);

CREATE TABLE tbl_volunteer_profile (
    volunteer_profile_id SERIAL PRIMARY KEY,
    facility_staff_id INTEGER NOT NULL,
    waiver_signed BOOLEAN NOT NULL,
    waiver_signed_date DATE,
    waiver_version VARCHAR(20),
    background_check_status VARCHAR(50),
    background_check_expiration DATE,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    t_shirt_size VARCHAR(10),
    description VARCHAR(100)
);

CREATE TABLE tbl_volunteer_skill (
    volunteer_skill_id SERIAL PRIMARY KEY,
    facility_staff_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_audit_log (
    audit_log_id SERIAL PRIMARY KEY,
    user_account_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    field_changed VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    action_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE tbl_client_deliveries (
    client_deliveries_id SERIAL PRIMARY KEY,
    client_provisioning_request_id INTEGER NOT NULL,
    facility_staff_id INTEGER NOT NULL,
    delivery_date DATE NOT NULL,
    delivery_status_id INTEGER NOT NULL,
    time_arrival_earliest TIME,
    time_arrival_latest TIME,
    time_delivery_complete TIME,
    notes TEXT,
    gate_code VARCHAR(10),
    description VARCHAR(100)
);

CREATE TABLE tbl_client_request_items (
    client_request_items_id SERIAL PRIMARY KEY,
    client_provisioning_request_id INTEGER NOT NULL,
    item_category_id INTEGER NOT NULL,
    item_notes VARCHAR(255),
    quantity INTEGER NOT NULL,
    priority VARCHAR(20),
    description VARCHAR(100),
    time_stamp TIMESTAMPTZ NOT NULL
);

CREATE TABLE tbl_corp_facility_inventory_item (
    corp_facility_inventory_item_id SERIAL PRIMARY KEY,
    corp_facility_id INTEGER NOT NULL,
    donation_item_id INTEGER,
    storage_location_id INTEGER,
    item_category_id INTEGER NOT NULL,
    item_size_id INTEGER NOT NULL,
    item_weight_id INTEGER NOT NULL,
    item_condition_id INTEGER NOT NULL,
    date_added_to_inventory DATE NOT NULL,
    date_dispositioned DATE,
    disposition_reason_id INTEGER,
    donation_value_in NUMERIC(12,2) NOT NULL,
    donation_value_out NUMERIC(12,2),
    description VARCHAR(100)
);

CREATE TABLE tbl_delivery_items (
    delivery_items_id SERIAL PRIMARY KEY,
    client_deliveries_id INTEGER NOT NULL,
    corp_facility_inventory_item_id INTEGER NOT NULL,
    loaded_at TIMESTAMPTZ,
    description VARCHAR(100)
);

CREATE TABLE tbl_delivery_receipt (
    delivery_receipt_id SERIAL PRIMARY KEY,
    client_deliveries_id INTEGER NOT NULL,
    signature_photo_url VARCHAR(255),
    signed_at TIMESTAMPTZ NOT NULL,
    all_items_received BOOLEAN NOT NULL,
    condition_acceptable BOOLEAN NOT NULL,
    photo_release_granted BOOLEAN NOT NULL,
    recipient_notes TEXT,
    description VARCHAR(100)
);

CREATE TABLE tbl_delivery_staff (
    delivery_staff_id SERIAL PRIMARY KEY,
    client_deliveries_id INTEGER NOT NULL,
    facility_staff_id INTEGER NOT NULL,
    is_team_lead BOOLEAN NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE tbl_delivery_vehicle (
    delivery_vehicle_id SERIAL PRIMARY KEY,
    client_deliveries_id INTEGER NOT NULL,
    delivery_vehicle_type_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    rental_agency_id INTEGER,
    mileage_start INTEGER,
    mileage_end INTEGER,
    fuel_cost NUMERIC(12,2),
    description VARCHAR(100)
);

CREATE TABLE tbl_inventory_reservation (
    inventory_reservation_id SERIAL PRIMARY KEY,
    corp_facility_inventory_item_id INTEGER NOT NULL,
    client_provisioning_request_id INTEGER NOT NULL,
    reservation_status_id INTEGER NOT NULL,
    reserved_by_facility_staff_id INTEGER NOT NULL,
    reserved_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    description VARCHAR(100)
);

CREATE TABLE tbl_request_item_inv_matches (
    request_item_inv_matches_id SERIAL PRIMARY KEY,
    client_request_items_id INTEGER NOT NULL,
    corp_facility_inventory_item_id INTEGER NOT NULL,
    item_selected BOOLEAN NOT NULL,
    description VARCHAR(100)
);

-- ============================================================
-- Foreign key constraints
-- ============================================================

ALTER TABLE tbl_address ADD CONSTRAINT fk_tbl_address_address_type_id_001 FOREIGN KEY (address_type_id) REFERENCES lkp_address_type(address_type_id);
ALTER TABLE tbl_address ADD CONSTRAINT fk_tbl_address_city_id_002 FOREIGN KEY (city_id) REFERENCES lkp_city(city_id);
ALTER TABLE tbl_address ADD CONSTRAINT fk_tbl_address_county_id_003 FOREIGN KEY (county_id) REFERENCES lkp_county(county_id);
ALTER TABLE tbl_address ADD CONSTRAINT fk_tbl_address_state_id_004 FOREIGN KEY (state_id) REFERENCES lkp_state(state_id);
ALTER TABLE lkp_city ADD CONSTRAINT fk_lkp_city_county_id_005 FOREIGN KEY (county_id) REFERENCES lkp_county(county_id);
ALTER TABLE lkp_county ADD CONSTRAINT fk_lkp_county_state_id_006 FOREIGN KEY (state_id) REFERENCES lkp_state(state_id);
ALTER TABLE tbl_agency ADD CONSTRAINT fk_tbl_agency_address_id_007 FOREIGN KEY (address_id) REFERENCES tbl_address(address_id);
ALTER TABLE tbl_agency ADD CONSTRAINT fk_tbl_agency_agency_type_id_008 FOREIGN KEY (agency_type_id) REFERENCES lkp_agency_type(agency_type_id);
ALTER TABLE tbl_agency_contact ADD CONSTRAINT fk_tbl_agency_contact_agency_id_009 FOREIGN KEY (agency_id) REFERENCES tbl_agency(agency_id);
ALTER TABLE tbl_agency_contact ADD CONSTRAINT fk_tbl_agency_contact_contact_id_010 FOREIGN KEY (contact_id) REFERENCES tbl_contact(contact_id);
ALTER TABLE tbl_contact ADD CONSTRAINT fk_tbl_contact_contact_type_id_011 FOREIGN KEY (contact_type_id) REFERENCES lkp_contact_type(contact_type_id);
ALTER TABLE tbl_contact ADD CONSTRAINT fk_tbl_contact_gender_id_012 FOREIGN KEY (gender_id) REFERENCES lkp_gender(gender_id);
ALTER TABLE tbl_contact ADD CONSTRAINT fk_tbl_contact_ethnicity_id_013 FOREIGN KEY (ethnicity_id) REFERENCES lkp_ethnicity(ethnicity_id);
ALTER TABLE tbl_contact ADD CONSTRAINT fk_tbl_contact_citizen_status_id_014 FOREIGN KEY (citizen_status_id) REFERENCES lkp_citizen_status(citizen_status_id);
ALTER TABLE tbl_contact ADD CONSTRAINT fk_tbl_contact_address_id_015 FOREIGN KEY (address_id) REFERENCES tbl_address(address_id);
ALTER TABLE tbl_client ADD CONSTRAINT fk_tbl_client_client_type_id_016 FOREIGN KEY (client_type_id) REFERENCES lkp_client_type(client_type_id);
ALTER TABLE tbl_client ADD CONSTRAINT fk_tbl_client_contact_id_017 FOREIGN KEY (contact_id) REFERENCES tbl_contact(contact_id);
ALTER TABLE tbl_client ADD CONSTRAINT fk_tbl_client_client_status_id_018 FOREIGN KEY (client_status_id) REFERENCES lkp_client_status(client_status_id);
ALTER TABLE tbl_referral ADD CONSTRAINT fk_tbl_referral_agency_contact_id_019 FOREIGN KEY (agency_contact_id) REFERENCES tbl_agency_contact(agency_contact_id);
ALTER TABLE tbl_referral ADD CONSTRAINT fk_tbl_referral_client_id_020 FOREIGN KEY (client_id) REFERENCES tbl_client(client_id);
ALTER TABLE tbl_corporate ADD CONSTRAINT fk_tbl_corporate_corp_type_id_021 FOREIGN KEY (corp_type_id) REFERENCES lkp_corp_type(corp_type_id);
ALTER TABLE tbl_corporate ADD CONSTRAINT fk_tbl_corporate_incorp_state_id_022 FOREIGN KEY (incorp_state_id) REFERENCES lkp_state(state_id);
ALTER TABLE tbl_corp_facility ADD CONSTRAINT fk_tbl_corp_facility_corporate_id_023 FOREIGN KEY (corporate_id) REFERENCES tbl_corporate(corporate_id);
ALTER TABLE tbl_corp_facility ADD CONSTRAINT fk_tbl_corp_facility_contact_id_024 FOREIGN KEY (contact_id) REFERENCES tbl_contact(contact_id);
ALTER TABLE tbl_corp_facility ADD CONSTRAINT fk_tbl_corp_facility_address_id_025 FOREIGN KEY (address_id) REFERENCES tbl_address(address_id);
ALTER TABLE tbl_corp_facility ADD CONSTRAINT fk_tbl_corp_facility_facility_type_id_026 FOREIGN KEY (facility_type_id) REFERENCES lkp_facility_type(facility_type_id);
ALTER TABLE tbl_facility_staff ADD CONSTRAINT fk_tbl_facility_staff_corp_facility_id_027 FOREIGN KEY (corp_facility_id) REFERENCES tbl_corp_facility(corp_facility_id);
ALTER TABLE tbl_facility_staff ADD CONSTRAINT fk_tbl_facility_staff_contact_id_028 FOREIGN KEY (contact_id) REFERENCES tbl_contact(contact_id);
ALTER TABLE tbl_facility_staff_statuses ADD CONSTRAINT fk_tbl_facility_staff_statuses_facility_staff_id_029 FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_facility_staff_statuses ADD CONSTRAINT fk_tbl_facility_staff_statuses_facility_staff_status_id_030 FOREIGN KEY (facility_staff_status_id) REFERENCES lkp_facility_staff_status(facility_staff_status_id);
ALTER TABLE tbl_facility_staff_statuses ADD CONSTRAINT fk_tbl_facility_staff_statuses_changed_by_facility_staff_id_031 FOREIGN KEY (changed_by_facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_facility_staff_statuses ADD CONSTRAINT fk_tbl_facility_staff_statuses_status_change_reason_id_032 FOREIGN KEY (status_change_reason_id) REFERENCES lkp_status_change_reason(status_change_reason_id);
ALTER TABLE tbl_staff_type ADD CONSTRAINT fk_tbl_staff_type_staff_role_id_033 FOREIGN KEY (staff_role_id) REFERENCES lkp_staff_role(staff_role_id);
ALTER TABLE tbl_staff_types ADD CONSTRAINT fk_tbl_staff_types_facility_staff_id_034 FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_staff_types ADD CONSTRAINT fk_tbl_staff_types_staff_type_id_035 FOREIGN KEY (staff_type_id) REFERENCES tbl_staff_type(staff_type_id);
ALTER TABLE lkp_staff_role ADD CONSTRAINT fk_lkp_staff_role_role_pay_type_id_036 FOREIGN KEY (role_pay_type_id) REFERENCES lkp_role_pay_type(role_pay_type_id);
ALTER TABLE tbl_volunteer_profile ADD CONSTRAINT fk_tbl_volunteer_profile_facility_staff_id_037 FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_volunteer_skill ADD CONSTRAINT fk_tbl_volunteer_skill_facility_staff_id_038 FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_volunteer_skill ADD CONSTRAINT fk_tbl_volunteer_skill_skill_id_039 FOREIGN KEY (skill_id) REFERENCES lkp_skill(skill_id);
ALTER TABLE tbl_volunteer_hours ADD CONSTRAINT fk_tbl_volunteer_hours_facility_staff_id_040 FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_volunteer_hours ADD CONSTRAINT fk_tbl_volunteer_hours_volunteer_activity_type_id_041 FOREIGN KEY (volunteer_activity_type_id) REFERENCES lkp_volunteer_activity_type(volunteer_activity_type_id);
ALTER TABLE tbl_volunteer_hours ADD CONSTRAINT fk_tbl_volunteer_hours_verified_by_facility_staff_id_042 FOREIGN KEY (verified_by_facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_corp_facility_inventory_item ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_corp_facility_id_043 FOREIGN KEY (corp_facility_id) REFERENCES tbl_corp_facility(corp_facility_id);
ALTER TABLE tbl_corp_facility_inventory_item ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_donation_item_id_044 FOREIGN KEY (donation_item_id) REFERENCES tbl_donation_item(donation_item_id);
ALTER TABLE tbl_corp_facility_inventory_item ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_storage_location_id_045 FOREIGN KEY (storage_location_id) REFERENCES lkp_storage_location(storage_location_id);
ALTER TABLE tbl_corp_facility_inventory_item ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_item_category_id_046 FOREIGN KEY (item_category_id) REFERENCES lkp_item_category(item_category_id);
ALTER TABLE tbl_corp_facility_inventory_item ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_item_size_id_047 FOREIGN KEY (item_size_id) REFERENCES lkp_item_size(item_size_id);
ALTER TABLE tbl_corp_facility_inventory_item ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_item_weight_id_048 FOREIGN KEY (item_weight_id) REFERENCES lkp_item_weight(item_weight_id);
ALTER TABLE tbl_corp_facility_inventory_item ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_item_condition_id_049 FOREIGN KEY (item_condition_id) REFERENCES lkp_item_condition(item_condition_id);
ALTER TABLE tbl_corp_facility_inventory_item ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_disposition_reason_id_050 FOREIGN KEY (disposition_reason_id) REFERENCES lkp_disposition_reason(disposition_reason_id);
ALTER TABLE lkp_storage_location ADD CONSTRAINT fk_lkp_storage_location_corp_facility_id_051 FOREIGN KEY (corp_facility_id) REFERENCES tbl_corp_facility(corp_facility_id);
ALTER TABLE tbl_donor ADD CONSTRAINT fk_tbl_donor_donor_type_id_052 FOREIGN KEY (donor_type_id) REFERENCES lkp_donor_type(donor_type_id);
ALTER TABLE tbl_donor ADD CONSTRAINT fk_tbl_donor_contact_id_053 FOREIGN KEY (contact_id) REFERENCES tbl_contact(contact_id);
ALTER TABLE tbl_donor ADD CONSTRAINT fk_tbl_donor_address_id_054 FOREIGN KEY (address_id) REFERENCES tbl_address(address_id);
ALTER TABLE tbl_donor ADD CONSTRAINT fk_tbl_donor_howtheyfoundus_id_055 FOREIGN KEY (howtheyfoundus_id) REFERENCES lkp_howtheyfoundus(howtheyfoundus_id);
ALTER TABLE lkp_howtheyfoundus ADD CONSTRAINT fk_lkp_howtheyfoundus_source_type_id_056 FOREIGN KEY (source_type_id) REFERENCES lkp_source_type(source_type_id);
ALTER TABLE tbl_donation ADD CONSTRAINT fk_tbl_donation_donor_id_057 FOREIGN KEY (donor_id) REFERENCES tbl_donor(donor_id);
ALTER TABLE tbl_donation ADD CONSTRAINT fk_tbl_donation_donation_type_id_058 FOREIGN KEY (donation_type_id) REFERENCES lkp_donation_type(donation_type_id);
ALTER TABLE tbl_donation_item ADD CONSTRAINT fk_tbl_donation_item_donation_id_059 FOREIGN KEY (donation_id) REFERENCES tbl_donation(donation_id);
ALTER TABLE tbl_donation_item ADD CONSTRAINT fk_tbl_donation_item_item_category_id_060 FOREIGN KEY (item_category_id) REFERENCES lkp_item_category(item_category_id);
ALTER TABLE tbl_donation_item ADD CONSTRAINT fk_tbl_donation_item_item_condition_id_061 FOREIGN KEY (item_condition_id) REFERENCES lkp_item_condition(item_condition_id);
ALTER TABLE tbl_donation_item ADD CONSTRAINT fk_tbl_donation_item_item_size_id_062 FOREIGN KEY (item_size_id) REFERENCES lkp_item_size(item_size_id);
ALTER TABLE tbl_donation_pickup ADD CONSTRAINT fk_tbl_donation_pickup_donor_id_063 FOREIGN KEY (donor_id) REFERENCES tbl_donor(donor_id);
ALTER TABLE tbl_donation_pickup ADD CONSTRAINT fk_tbl_donation_pickup_pickup_address_id_064 FOREIGN KEY (pickup_address_id) REFERENCES tbl_address(address_id);
ALTER TABLE tbl_donation_pickup ADD CONSTRAINT fk_tbl_donation_pickup_pickup_status_id_065 FOREIGN KEY (pickup_status_id) REFERENCES lkp_pickup_status(pickup_status_id);
ALTER TABLE tbl_donation_pickup ADD CONSTRAINT fk_tbl_donation_pickup_assigned_vehicle_id_066 FOREIGN KEY (assigned_vehicle_id) REFERENCES tbl_vehicle(vehicle_id);
ALTER TABLE tbl_donation_pickup ADD CONSTRAINT fk_tbl_donation_pickup_assigned_lead_facility_staff_id_067 FOREIGN KEY (assigned_lead_facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_client_provisioning_request ADD CONSTRAINT fk_tbl_client_provisioning_request_client_id_068 FOREIGN KEY (client_id) REFERENCES tbl_client(client_id);
ALTER TABLE tbl_client_provisioning_request ADD CONSTRAINT fk_tbl_client_provisioning_request_fulfillment_corp_facility_id_069 FOREIGN KEY (fulfillment_corp_facility_id) REFERENCES tbl_corp_facility(corp_facility_id);
ALTER TABLE tbl_client_provisioning_request ADD CONSTRAINT fk_tbl_client_provisioning_request_request_receipt_origin_id_070 FOREIGN KEY (request_receipt_origin_id) REFERENCES lkp_request_receipt_origin(request_receipt_origin_id);
ALTER TABLE tbl_client_provisioning_request ADD CONSTRAINT fk_tbl_client_provisioning_request_client_request_creator_facility_staff_id_071 FOREIGN KEY (client_request_creator_facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_client_request_items ADD CONSTRAINT fk_tbl_client_request_items_client_provisioning_request_id_072 FOREIGN KEY (client_provisioning_request_id) REFERENCES tbl_client_provisioning_request(client_provisioning_request_id);
ALTER TABLE tbl_client_request_items ADD CONSTRAINT fk_tbl_client_request_items_item_category_id_073 FOREIGN KEY (item_category_id) REFERENCES lkp_item_category(item_category_id);
ALTER TABLE tbl_request_item_inv_matches ADD CONSTRAINT fk_tbl_request_item_inv_matches_client_request_items_id_074 FOREIGN KEY (client_request_items_id) REFERENCES tbl_client_request_items(client_request_items_id);
ALTER TABLE tbl_request_item_inv_matches ADD CONSTRAINT fk_tbl_request_item_inv_matches_corp_facility_inventory_item_id_075 FOREIGN KEY (corp_facility_inventory_item_id) REFERENCES tbl_corp_facility_inventory_item(corp_facility_inventory_item_id);
ALTER TABLE tbl_inventory_reservation ADD CONSTRAINT fk_tbl_inventory_reservation_corp_facility_inventory_item_id_076 FOREIGN KEY (corp_facility_inventory_item_id) REFERENCES tbl_corp_facility_inventory_item(corp_facility_inventory_item_id);
ALTER TABLE tbl_inventory_reservation ADD CONSTRAINT fk_tbl_inventory_reservation_client_provisioning_request_id_077 FOREIGN KEY (client_provisioning_request_id) REFERENCES tbl_client_provisioning_request(client_provisioning_request_id);
ALTER TABLE tbl_inventory_reservation ADD CONSTRAINT fk_tbl_inventory_reservation_reservation_status_id_078 FOREIGN KEY (reservation_status_id) REFERENCES lkp_reservation_status(reservation_status_id);
ALTER TABLE tbl_inventory_reservation ADD CONSTRAINT fk_tbl_inventory_reservation_reserved_by_facility_staff_id_079 FOREIGN KEY (reserved_by_facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_client_deliveries ADD CONSTRAINT fk_tbl_client_deliveries_client_provisioning_request_id_080 FOREIGN KEY (client_provisioning_request_id) REFERENCES tbl_client_provisioning_request(client_provisioning_request_id);
ALTER TABLE tbl_client_deliveries ADD CONSTRAINT fk_tbl_client_deliveries_facility_staff_id_081 FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_client_deliveries ADD CONSTRAINT fk_tbl_client_deliveries_delivery_status_id_082 FOREIGN KEY (delivery_status_id) REFERENCES lkp_delivery_status(delivery_status_id);
ALTER TABLE tbl_delivery_items ADD CONSTRAINT fk_tbl_delivery_items_client_deliveries_id_083 FOREIGN KEY (client_deliveries_id) REFERENCES tbl_client_deliveries(client_deliveries_id);
ALTER TABLE tbl_delivery_items ADD CONSTRAINT fk_tbl_delivery_items_corp_facility_inventory_item_id_084 FOREIGN KEY (corp_facility_inventory_item_id) REFERENCES tbl_corp_facility_inventory_item(corp_facility_inventory_item_id);
ALTER TABLE tbl_delivery_staff ADD CONSTRAINT fk_tbl_delivery_staff_client_deliveries_id_085 FOREIGN KEY (client_deliveries_id) REFERENCES tbl_client_deliveries(client_deliveries_id);
ALTER TABLE tbl_delivery_staff ADD CONSTRAINT fk_tbl_delivery_staff_facility_staff_id_086 FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_delivery_vehicle ADD CONSTRAINT fk_tbl_delivery_vehicle_client_deliveries_id_087 FOREIGN KEY (client_deliveries_id) REFERENCES tbl_client_deliveries(client_deliveries_id);
ALTER TABLE tbl_delivery_vehicle ADD CONSTRAINT fk_tbl_delivery_vehicle_delivery_vehicle_type_id_088 FOREIGN KEY (delivery_vehicle_type_id) REFERENCES lkp_delivery_vehicle_type(delivery_vehicle_type_id);
ALTER TABLE tbl_delivery_vehicle ADD CONSTRAINT fk_tbl_delivery_vehicle_vehicle_id_089 FOREIGN KEY (vehicle_id) REFERENCES tbl_vehicle(vehicle_id);
ALTER TABLE tbl_delivery_vehicle ADD CONSTRAINT fk_tbl_delivery_vehicle_rental_agency_id_090 FOREIGN KEY (rental_agency_id) REFERENCES lkp_rental_agency(rental_agency_id);
ALTER TABLE tbl_delivery_receipt ADD CONSTRAINT fk_tbl_delivery_receipt_client_deliveries_id_091 FOREIGN KEY (client_deliveries_id) REFERENCES tbl_client_deliveries(client_deliveries_id);
ALTER TABLE tbl_vehicle ADD CONSTRAINT fk_tbl_vehicle_corp_facility_id_092 FOREIGN KEY (corp_facility_id) REFERENCES tbl_corp_facility(corp_facility_id);
ALTER TABLE tbl_vehicle ADD CONSTRAINT fk_tbl_vehicle_vehicle_make_id_093 FOREIGN KEY (vehicle_make_id) REFERENCES lkp_vehicle_make(vehicle_make_id);
ALTER TABLE tbl_vehicle ADD CONSTRAINT fk_tbl_vehicle_vehicle_model_id_094 FOREIGN KEY (vehicle_model_id) REFERENCES lkp_vehicle_model(vehicle_model_id);
ALTER TABLE tbl_vehicle ADD CONSTRAINT fk_tbl_vehicle_vehicle_type_id_095 FOREIGN KEY (vehicle_type_id) REFERENCES lkp_vehicle_type(vehicle_type_id);
ALTER TABLE lkp_vehicle_model ADD CONSTRAINT fk_lkp_vehicle_model_vehicle_make_id_096 FOREIGN KEY (vehicle_make_id) REFERENCES lkp_vehicle_make(vehicle_make_id);
ALTER TABLE lkp_vehicle_type ADD CONSTRAINT fk_lkp_vehicle_type_vehicle_weight_class_id_097 FOREIGN KEY (vehicle_weight_class_id) REFERENCES lkp_vehicle_weight_class(vehicle_weight_class_id);
ALTER TABLE lkp_vehicle_type ADD CONSTRAINT fk_lkp_vehicle_type_vehicle_fuel_type_id_098 FOREIGN KEY (vehicle_fuel_type_id) REFERENCES lkp_vehicle_fuel_type(vehicle_fuel_type_id);
ALTER TABLE tbl_vehicle_mileage ADD CONSTRAINT fk_tbl_vehicle_mileage_vehicle_id_099 FOREIGN KEY (vehicle_id) REFERENCES tbl_vehicle(vehicle_id);
ALTER TABLE tbl_vehicle_maintenance ADD CONSTRAINT fk_tbl_vehicle_maintenance_vehicle_id_100 FOREIGN KEY (vehicle_id) REFERENCES tbl_vehicle(vehicle_id);
ALTER TABLE tbl_vehicle_maintenance ADD CONSTRAINT fk_tbl_vehicle_maintenance_maintenance_type_id_101 FOREIGN KEY (maintenance_type_id) REFERENCES lkp_maintenance_type(maintenance_type_id);
ALTER TABLE tbl_attachment ADD CONSTRAINT fk_tbl_attachment_attachment_entity_type_id_102 FOREIGN KEY (attachment_entity_type_id) REFERENCES lkp_attachment_entity_type(attachment_entity_type_id);
ALTER TABLE tbl_attachment ADD CONSTRAINT fk_tbl_attachment_uploaded_by_facility_staff_id_103 FOREIGN KEY (uploaded_by_facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_note ADD CONSTRAINT fk_tbl_note_note_entity_type_id_104 FOREIGN KEY (note_entity_type_id) REFERENCES lkp_note_entity_type(note_entity_type_id);
ALTER TABLE tbl_note ADD CONSTRAINT fk_tbl_note_author_facility_staff_id_105 FOREIGN KEY (author_facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_communication_log ADD CONSTRAINT fk_tbl_communication_log_note_entity_type_id_106 FOREIGN KEY (note_entity_type_id) REFERENCES lkp_note_entity_type(note_entity_type_id);
ALTER TABLE tbl_communication_log ADD CONSTRAINT fk_tbl_communication_log_communication_method_id_107 FOREIGN KEY (communication_method_id) REFERENCES lkp_communication_method(communication_method_id);
ALTER TABLE tbl_communication_log ADD CONSTRAINT fk_tbl_communication_log_facility_staff_id_108 FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_audit_log ADD CONSTRAINT fk_tbl_audit_log_user_account_id_109 FOREIGN KEY (user_account_id) REFERENCES tbl_user_account(user_account_id);
ALTER TABLE tbl_user_account ADD CONSTRAINT fk_tbl_user_account_facility_staff_id_110 FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff(facility_staff_id);
ALTER TABLE tbl_user_account ADD CONSTRAINT fk_tbl_user_account_agency_contact_id_111 FOREIGN KEY (agency_contact_id) REFERENCES tbl_agency_contact(agency_contact_id);
ALTER TABLE tbl_event ADD CONSTRAINT fk_tbl_event_event_type_id_112 FOREIGN KEY (event_type_id) REFERENCES lkp_event_type(event_type_id);
ALTER TABLE tbl_event ADD CONSTRAINT fk_tbl_event_address_id_113 FOREIGN KEY (address_id) REFERENCES tbl_address(address_id);
ALTER TABLE tbl_event_attendee ADD CONSTRAINT fk_tbl_event_attendee_event_id_114 FOREIGN KEY (event_id) REFERENCES tbl_event(event_id);
ALTER TABLE tbl_event_attendee ADD CONSTRAINT fk_tbl_event_attendee_contact_id_115 FOREIGN KEY (contact_id) REFERENCES tbl_contact(contact_id);

-- ============================================================
-- Indexes on foreign-key columns
-- ============================================================

CREATE INDEX idx_tbl_address_address_type_id ON tbl_address(address_type_id);
CREATE INDEX idx_tbl_address_city_id ON tbl_address(city_id);
CREATE INDEX idx_tbl_address_county_id ON tbl_address(county_id);
CREATE INDEX idx_tbl_address_state_id ON tbl_address(state_id);
CREATE INDEX idx_lkp_city_county_id ON lkp_city(county_id);
CREATE INDEX idx_lkp_county_state_id ON lkp_county(state_id);
CREATE INDEX idx_tbl_agency_address_id ON tbl_agency(address_id);
CREATE INDEX idx_tbl_agency_agency_type_id ON tbl_agency(agency_type_id);
CREATE INDEX idx_tbl_agency_contact_agency_id ON tbl_agency_contact(agency_id);
CREATE INDEX idx_tbl_agency_contact_contact_id ON tbl_agency_contact(contact_id);
CREATE INDEX idx_tbl_contact_contact_type_id ON tbl_contact(contact_type_id);
CREATE INDEX idx_tbl_contact_gender_id ON tbl_contact(gender_id);
CREATE INDEX idx_tbl_contact_ethnicity_id ON tbl_contact(ethnicity_id);
CREATE INDEX idx_tbl_contact_citizen_status_id ON tbl_contact(citizen_status_id);
CREATE INDEX idx_tbl_contact_address_id ON tbl_contact(address_id);
CREATE INDEX idx_tbl_client_client_type_id ON tbl_client(client_type_id);
CREATE INDEX idx_tbl_client_contact_id ON tbl_client(contact_id);
CREATE INDEX idx_tbl_client_client_status_id ON tbl_client(client_status_id);
CREATE INDEX idx_tbl_referral_agency_contact_id ON tbl_referral(agency_contact_id);
CREATE INDEX idx_tbl_referral_client_id ON tbl_referral(client_id);
CREATE INDEX idx_tbl_corporate_corp_type_id ON tbl_corporate(corp_type_id);
CREATE INDEX idx_tbl_corporate_incorp_state_id ON tbl_corporate(incorp_state_id);
CREATE INDEX idx_tbl_corp_facility_corporate_id ON tbl_corp_facility(corporate_id);
CREATE INDEX idx_tbl_corp_facility_contact_id ON tbl_corp_facility(contact_id);
CREATE INDEX idx_tbl_corp_facility_address_id ON tbl_corp_facility(address_id);
CREATE INDEX idx_tbl_corp_facility_facility_type_id ON tbl_corp_facility(facility_type_id);
CREATE INDEX idx_tbl_facility_staff_corp_facility_id ON tbl_facility_staff(corp_facility_id);
CREATE INDEX idx_tbl_facility_staff_contact_id ON tbl_facility_staff(contact_id);
CREATE INDEX idx_tbl_facility_staff_statuses_facility_staff_id ON tbl_facility_staff_statuses(facility_staff_id);
CREATE INDEX idx_tbl_facility_staff_statuses_facility_staff_status_id ON tbl_facility_staff_statuses(facility_staff_status_id);
CREATE INDEX idx_tbl_facility_staff_statuses_changed_by_facility_staff_id ON tbl_facility_staff_statuses(changed_by_facility_staff_id);
CREATE INDEX idx_tbl_facility_staff_statuses_status_change_reason_id ON tbl_facility_staff_statuses(status_change_reason_id);
CREATE INDEX idx_tbl_staff_type_staff_role_id ON tbl_staff_type(staff_role_id);
CREATE INDEX idx_tbl_staff_types_facility_staff_id ON tbl_staff_types(facility_staff_id);
CREATE INDEX idx_tbl_staff_types_staff_type_id ON tbl_staff_types(staff_type_id);
CREATE INDEX idx_lkp_staff_role_role_pay_type_id ON lkp_staff_role(role_pay_type_id);
CREATE INDEX idx_tbl_volunteer_profile_facility_staff_id ON tbl_volunteer_profile(facility_staff_id);
CREATE INDEX idx_tbl_volunteer_skill_facility_staff_id ON tbl_volunteer_skill(facility_staff_id);
CREATE INDEX idx_tbl_volunteer_skill_skill_id ON tbl_volunteer_skill(skill_id);
CREATE INDEX idx_tbl_volunteer_hours_facility_staff_id ON tbl_volunteer_hours(facility_staff_id);
CREATE INDEX idx_tbl_volunteer_hours_volunteer_activity_type_id ON tbl_volunteer_hours(volunteer_activity_type_id);
CREATE INDEX idx_tbl_volunteer_hours_verified_by_facility_staff_id ON tbl_volunteer_hours(verified_by_facility_staff_id);
CREATE INDEX idx_tbl_corp_facility_inventory_item_corp_facility_id ON tbl_corp_facility_inventory_item(corp_facility_id);
CREATE INDEX idx_tbl_corp_facility_inventory_item_donation_item_id ON tbl_corp_facility_inventory_item(donation_item_id);
CREATE INDEX idx_tbl_corp_facility_inventory_item_storage_location_id ON tbl_corp_facility_inventory_item(storage_location_id);
CREATE INDEX idx_tbl_corp_facility_inventory_item_item_category_id ON tbl_corp_facility_inventory_item(item_category_id);
CREATE INDEX idx_tbl_corp_facility_inventory_item_item_size_id ON tbl_corp_facility_inventory_item(item_size_id);
CREATE INDEX idx_tbl_corp_facility_inventory_item_item_weight_id ON tbl_corp_facility_inventory_item(item_weight_id);
CREATE INDEX idx_tbl_corp_facility_inventory_item_item_condition_id ON tbl_corp_facility_inventory_item(item_condition_id);
CREATE INDEX idx_tbl_corp_facility_inventory_item_disposition_reason_id ON tbl_corp_facility_inventory_item(disposition_reason_id);
CREATE INDEX idx_lkp_storage_location_corp_facility_id ON lkp_storage_location(corp_facility_id);
CREATE INDEX idx_tbl_donor_donor_type_id ON tbl_donor(donor_type_id);
CREATE INDEX idx_tbl_donor_contact_id ON tbl_donor(contact_id);
CREATE INDEX idx_tbl_donor_address_id ON tbl_donor(address_id);
CREATE INDEX idx_tbl_donor_howtheyfoundus_id ON tbl_donor(howtheyfoundus_id);
CREATE INDEX idx_lkp_howtheyfoundus_source_type_id ON lkp_howtheyfoundus(source_type_id);
CREATE INDEX idx_tbl_donation_donor_id ON tbl_donation(donor_id);
CREATE INDEX idx_tbl_donation_donation_type_id ON tbl_donation(donation_type_id);
CREATE INDEX idx_tbl_donation_item_donation_id ON tbl_donation_item(donation_id);
CREATE INDEX idx_tbl_donation_item_item_category_id ON tbl_donation_item(item_category_id);
CREATE INDEX idx_tbl_donation_item_item_condition_id ON tbl_donation_item(item_condition_id);
CREATE INDEX idx_tbl_donation_item_item_size_id ON tbl_donation_item(item_size_id);
CREATE INDEX idx_tbl_donation_pickup_donor_id ON tbl_donation_pickup(donor_id);
CREATE INDEX idx_tbl_donation_pickup_pickup_address_id ON tbl_donation_pickup(pickup_address_id);
CREATE INDEX idx_tbl_donation_pickup_pickup_status_id ON tbl_donation_pickup(pickup_status_id);
CREATE INDEX idx_tbl_donation_pickup_assigned_vehicle_id ON tbl_donation_pickup(assigned_vehicle_id);
CREATE INDEX idx_tbl_donation_pickup_assigned_lead_facility_staff_id ON tbl_donation_pickup(assigned_lead_facility_staff_id);
CREATE INDEX idx_tbl_client_provisioning_request_client_id ON tbl_client_provisioning_request(client_id);
CREATE INDEX idx_tbl_client_provisioning_request_fulfillment_corp_facility_id ON tbl_client_provisioning_request(fulfillment_corp_facility_id);
CREATE INDEX idx_tbl_client_provisioning_request_request_receipt_origin_id ON tbl_client_provisioning_request(request_receipt_origin_id);
CREATE INDEX idx_tbl_client_provisioning_request_client_request_creator_facility_staff_id ON tbl_client_provisioning_request(client_request_creator_facility_staff_id);
CREATE INDEX idx_tbl_client_request_items_client_provisioning_request_id ON tbl_client_request_items(client_provisioning_request_id);
CREATE INDEX idx_tbl_client_request_items_item_category_id ON tbl_client_request_items(item_category_id);
CREATE INDEX idx_tbl_request_item_inv_matches_client_request_items_id ON tbl_request_item_inv_matches(client_request_items_id);
CREATE INDEX idx_tbl_request_item_inv_matches_corp_facility_inventory_item_id ON tbl_request_item_inv_matches(corp_facility_inventory_item_id);
CREATE INDEX idx_tbl_inventory_reservation_corp_facility_inventory_item_id ON tbl_inventory_reservation(corp_facility_inventory_item_id);
CREATE INDEX idx_tbl_inventory_reservation_client_provisioning_request_id ON tbl_inventory_reservation(client_provisioning_request_id);
CREATE INDEX idx_tbl_inventory_reservation_reservation_status_id ON tbl_inventory_reservation(reservation_status_id);
CREATE INDEX idx_tbl_inventory_reservation_reserved_by_facility_staff_id ON tbl_inventory_reservation(reserved_by_facility_staff_id);
CREATE INDEX idx_tbl_client_deliveries_client_provisioning_request_id ON tbl_client_deliveries(client_provisioning_request_id);
CREATE INDEX idx_tbl_client_deliveries_facility_staff_id ON tbl_client_deliveries(facility_staff_id);
CREATE INDEX idx_tbl_client_deliveries_delivery_status_id ON tbl_client_deliveries(delivery_status_id);
CREATE INDEX idx_tbl_delivery_items_client_deliveries_id ON tbl_delivery_items(client_deliveries_id);
CREATE INDEX idx_tbl_delivery_items_corp_facility_inventory_item_id ON tbl_delivery_items(corp_facility_inventory_item_id);
CREATE INDEX idx_tbl_delivery_staff_client_deliveries_id ON tbl_delivery_staff(client_deliveries_id);
CREATE INDEX idx_tbl_delivery_staff_facility_staff_id ON tbl_delivery_staff(facility_staff_id);
CREATE INDEX idx_tbl_delivery_vehicle_client_deliveries_id ON tbl_delivery_vehicle(client_deliveries_id);
CREATE INDEX idx_tbl_delivery_vehicle_delivery_vehicle_type_id ON tbl_delivery_vehicle(delivery_vehicle_type_id);
CREATE INDEX idx_tbl_delivery_vehicle_vehicle_id ON tbl_delivery_vehicle(vehicle_id);
CREATE INDEX idx_tbl_delivery_vehicle_rental_agency_id ON tbl_delivery_vehicle(rental_agency_id);
CREATE INDEX idx_tbl_delivery_receipt_client_deliveries_id ON tbl_delivery_receipt(client_deliveries_id);
CREATE INDEX idx_tbl_vehicle_corp_facility_id ON tbl_vehicle(corp_facility_id);
CREATE INDEX idx_tbl_vehicle_vehicle_make_id ON tbl_vehicle(vehicle_make_id);
CREATE INDEX idx_tbl_vehicle_vehicle_model_id ON tbl_vehicle(vehicle_model_id);
CREATE INDEX idx_tbl_vehicle_vehicle_type_id ON tbl_vehicle(vehicle_type_id);
CREATE INDEX idx_lkp_vehicle_model_vehicle_make_id ON lkp_vehicle_model(vehicle_make_id);
CREATE INDEX idx_lkp_vehicle_type_vehicle_weight_class_id ON lkp_vehicle_type(vehicle_weight_class_id);
CREATE INDEX idx_lkp_vehicle_type_vehicle_fuel_type_id ON lkp_vehicle_type(vehicle_fuel_type_id);
CREATE INDEX idx_tbl_vehicle_mileage_vehicle_id ON tbl_vehicle_mileage(vehicle_id);
CREATE INDEX idx_tbl_vehicle_maintenance_vehicle_id ON tbl_vehicle_maintenance(vehicle_id);
CREATE INDEX idx_tbl_vehicle_maintenance_maintenance_type_id ON tbl_vehicle_maintenance(maintenance_type_id);
CREATE INDEX idx_tbl_attachment_attachment_entity_type_id ON tbl_attachment(attachment_entity_type_id);
CREATE INDEX idx_tbl_attachment_uploaded_by_facility_staff_id ON tbl_attachment(uploaded_by_facility_staff_id);
CREATE INDEX idx_tbl_note_note_entity_type_id ON tbl_note(note_entity_type_id);
CREATE INDEX idx_tbl_note_author_facility_staff_id ON tbl_note(author_facility_staff_id);
CREATE INDEX idx_tbl_communication_log_note_entity_type_id ON tbl_communication_log(note_entity_type_id);
CREATE INDEX idx_tbl_communication_log_communication_method_id ON tbl_communication_log(communication_method_id);
CREATE INDEX idx_tbl_communication_log_facility_staff_id ON tbl_communication_log(facility_staff_id);
CREATE INDEX idx_tbl_audit_log_user_account_id ON tbl_audit_log(user_account_id);
CREATE INDEX idx_tbl_user_account_facility_staff_id ON tbl_user_account(facility_staff_id);
CREATE INDEX idx_tbl_user_account_agency_contact_id ON tbl_user_account(agency_contact_id);
CREATE INDEX idx_tbl_event_event_type_id ON tbl_event(event_type_id);
CREATE INDEX idx_tbl_event_address_id ON tbl_event(address_id);
CREATE INDEX idx_tbl_event_attendee_event_id ON tbl_event_attendee(event_id);
CREATE INDEX idx_tbl_event_attendee_contact_id ON tbl_event_attendee(contact_id);

COMMIT;
