-- Furnish Hope database — ERD-ready DDL
-- Generated from db/schema_current.sql by db/generate-erd-sql.mjs
-- For drawio.com → Arrange → Insert → From SQL

CREATE TABLE lkp_acknowledgement_status (
  acknowledgement_status_id INT NOT NULL PRIMARY KEY,
  acknowledgement_status VARCHAR(50) NOT NULL,
  description VARCHAR(200)
);

CREATE TABLE lkp_address_type (
  address_type_id INT NOT NULL PRIMARY KEY,
  address_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_agency_type (
  agency_type_id INT NOT NULL PRIMARY KEY,
  agency_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_attachment_entity_type (
  attachment_entity_type_id INT NOT NULL PRIMARY KEY,
  attachment_entity_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_campaign_status (
  campaign_status_id INT NOT NULL PRIMARY KEY,
  campaign_status VARCHAR(50) NOT NULL,
  description VARCHAR(200)
);

CREATE TABLE lkp_campaign_type (
  campaign_type_id INT NOT NULL PRIMARY KEY,
  campaign_type VARCHAR(50) NOT NULL,
  description VARCHAR(200)
);

CREATE TABLE lkp_citizen_status (
  citizen_status_id INT NOT NULL PRIMARY KEY,
  citizen_status VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_city (
  city_id INT NOT NULL PRIMARY KEY,
  county_id INT NOT NULL,
  city VARCHAR(50) NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (county_id) REFERENCES lkp_county (county_id)
);

CREATE TABLE lkp_client_status (
  client_status_id INT NOT NULL PRIMARY KEY,
  client_status VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_client_type (
  client_type_id INT NOT NULL PRIMARY KEY,
  client_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_communication_method (
  communication_method_id INT NOT NULL PRIMARY KEY,
  communication_method VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_contact_type (
  contact_type_id INT NOT NULL PRIMARY KEY,
  contact_type VARCHAR(25) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_corp_type (
  corp_type_id INT NOT NULL PRIMARY KEY,
  corp_type VARCHAR(25) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_county (
  county_id INT NOT NULL PRIMARY KEY,
  state_id INT NOT NULL,
  county VARCHAR(50) NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (state_id) REFERENCES lkp_state (state_id)
);

CREATE TABLE lkp_delivery_status (
  delivery_status_id INT NOT NULL PRIMARY KEY,
  delivery_status VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_delivery_vehicle_type (
  delivery_vehicle_type_id INT NOT NULL PRIMARY KEY,
  delivery_vehicle_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_disposition_reason (
  disposition_reason_id INT NOT NULL PRIMARY KEY,
  disposition_reason VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_donation_type (
  donation_type_id INT NOT NULL PRIMARY KEY,
  donation_type VARCHAR(25) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_donor_stage (
  donor_stage_id INT NOT NULL PRIMARY KEY,
  donor_stage VARCHAR(50) NOT NULL,
  stage_order INT,
  description VARCHAR(200)
);

CREATE TABLE lkp_donor_type (
  donor_type_id INT NOT NULL PRIMARY KEY,
  donor_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_ethnicity (
  ethnicity_id INT NOT NULL PRIMARY KEY,
  ethnicity VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_event_type (
  event_type_id INT NOT NULL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_facility_staff_status (
  facility_staff_status_id INT NOT NULL PRIMARY KEY,
  facility_staff_status VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_facility_type (
  facility_type_id INT NOT NULL PRIMARY KEY,
  facility_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_fund (
  fund_id INT NOT NULL PRIMARY KEY,
  fund_name VARCHAR(100) NOT NULL,
  default_restriction_type_id INT,
  is_active BOOLEAN,
  description VARCHAR(200),
  FOREIGN KEY (default_restriction_type_id) REFERENCES lkp_restriction_type (restriction_type_id)
);

CREATE TABLE lkp_gender (
  gender_id INT NOT NULL PRIMARY KEY,
  gender VARCHAR(20) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_howtheyfoundus (
  howtheyfoundus_id INT NOT NULL PRIMARY KEY,
  howtheyfoundus VARCHAR(50) NOT NULL,
  source_type_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (source_type_id) REFERENCES lkp_source_type (source_type_id)
);

CREATE TABLE lkp_item_category (
  item_category_id INT NOT NULL PRIMARY KEY,
  item_category VARCHAR(100) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_item_condition (
  item_condition_id INT NOT NULL PRIMARY KEY,
  item_condition VARCHAR(20) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_item_size (
  item_size_id INT NOT NULL PRIMARY KEY,
  item_size VARCHAR(20) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_item_weight (
  item_weight_id INT NOT NULL PRIMARY KEY,
  item_weight VARCHAR(50) NOT NULL,
  weight_lbs_min INT,
  weight_lbs_max INT,
  description VARCHAR(100)
);

CREATE TABLE lkp_maintenance_type (
  maintenance_type_id INT NOT NULL PRIMARY KEY,
  maintenance_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_note_entity_type (
  note_entity_type_id INT NOT NULL PRIMARY KEY,
  note_entity_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_payment_method (
  payment_method_id INT NOT NULL PRIMARY KEY,
  payment_method VARCHAR(50) NOT NULL,
  description VARCHAR(200)
);

CREATE TABLE lkp_pickup_status (
  pickup_status_id INT NOT NULL PRIMARY KEY,
  pickup_status VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_pledge_status (
  pledge_status_id INT NOT NULL PRIMARY KEY,
  pledge_status VARCHAR(50) NOT NULL,
  description VARCHAR(200)
);

CREATE TABLE lkp_rental_agency (
  rental_agency_id INT NOT NULL PRIMARY KEY,
  rental_agency VARCHAR(100) NOT NULL,
  account_number VARCHAR(25),
  description VARCHAR(100)
);

CREATE TABLE lkp_request_receipt_origin (
  request_receipt_origin_id INT NOT NULL PRIMARY KEY,
  request_receipt_origin VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_reservation_status (
  reservation_status_id INT NOT NULL PRIMARY KEY,
  reservation_status VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_restriction_type (
  restriction_type_id INT NOT NULL PRIMARY KEY,
  restriction_type VARCHAR(50) NOT NULL,
  description VARCHAR(200)
);

CREATE TABLE lkp_role_pay_type (
  role_pay_type_id INT NOT NULL PRIMARY KEY,
  role_pay_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_shift_status (
  shift_status_id INT NOT NULL PRIMARY KEY,
  shift_status VARCHAR(50) NOT NULL,
  description VARCHAR(200)
);

CREATE TABLE lkp_shift_type (
  shift_type_id INT NOT NULL PRIMARY KEY,
  shift_type VARCHAR(50) NOT NULL,
  description VARCHAR(200)
);

CREATE TABLE lkp_skill (
  skill_id INT NOT NULL PRIMARY KEY,
  skill VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_solicitation_method (
  solicitation_method_id INT NOT NULL PRIMARY KEY,
  solicitation_method VARCHAR(50) NOT NULL,
  description VARCHAR(200)
);

CREATE TABLE lkp_source_type (
  source_type_id INT NOT NULL PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_staff_role (
  staff_role_id INT NOT NULL PRIMARY KEY,
  staff_role VARCHAR(50) NOT NULL,
  role_pay_type_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (role_pay_type_id) REFERENCES lkp_role_pay_type (role_pay_type_id)
);

CREATE TABLE lkp_state (
  state_id INT NOT NULL PRIMARY KEY,
  state VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_status_change_reason (
  status_change_reason_id INT NOT NULL PRIMARY KEY,
  status_change_reason VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_storage_location (
  storage_location_id INT NOT NULL PRIMARY KEY,
  corp_facility_id INT NOT NULL,
  location_code VARCHAR(20) NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (corp_facility_id) REFERENCES tbl_corp_facility (corp_facility_id)
);

CREATE TABLE lkp_vehicle_fuel_type (
  vehicle_fuel_type_id INT NOT NULL PRIMARY KEY,
  vehicle_fuel_type VARCHAR(15) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_vehicle_make (
  vehicle_make_id INT NOT NULL PRIMARY KEY,
  vehicle_make VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_vehicle_model (
  vehicle_model_id INT NOT NULL PRIMARY KEY,
  vehicle_make_id INT NOT NULL,
  vehicle_model VARCHAR(50) NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (vehicle_make_id) REFERENCES lkp_vehicle_make (vehicle_make_id)
);

CREATE TABLE lkp_vehicle_type (
  vehicle_type_id INT NOT NULL PRIMARY KEY,
  vehicle_type VARCHAR(50) NOT NULL,
  vehicle_weight_class_id INT NOT NULL,
  vehicle_fuel_type_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (vehicle_fuel_type_id) REFERENCES lkp_vehicle_fuel_type (vehicle_fuel_type_id),
  FOREIGN KEY (vehicle_weight_class_id) REFERENCES lkp_vehicle_weight_class (vehicle_weight_class_id)
);

CREATE TABLE lkp_vehicle_weight_class (
  vehicle_weight_class_id INT NOT NULL PRIMARY KEY,
  vehicle_weight_class VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE lkp_volunteer_activity_type (
  volunteer_activity_type_id INT NOT NULL PRIMARY KEY,
  volunteer_activity_type VARCHAR(50) NOT NULL,
  description VARCHAR(100)
);

CREATE TABLE session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) without time zone NOT NULL
);

CREATE TABLE tbl_address (
  address_id INT NOT NULL PRIMARY KEY,
  address_name VARCHAR(50) NOT NULL,
  address_type_id INT NOT NULL,
  address VARCHAR(100) NOT NULL,
  address2 VARCHAR(50),
  city_id INT NOT NULL,
  county_id INT NOT NULL,
  state_id INT NOT NULL,
  postalcode VARCHAR(10) NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (address_type_id) REFERENCES lkp_address_type (address_type_id),
  FOREIGN KEY (city_id) REFERENCES lkp_city (city_id),
  FOREIGN KEY (county_id) REFERENCES lkp_county (county_id),
  FOREIGN KEY (state_id) REFERENCES lkp_state (state_id)
);

CREATE TABLE tbl_agency (
  agency_id INT NOT NULL PRIMARY KEY,
  agency_name VARCHAR(100) NOT NULL,
  address_id INT NOT NULL,
  agency_type_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (address_id) REFERENCES tbl_address (address_id),
  FOREIGN KEY (agency_type_id) REFERENCES lkp_agency_type (agency_type_id)
);

CREATE TABLE tbl_agency_contact (
  agency_contact_id INT NOT NULL PRIMARY KEY,
  agency_id INT NOT NULL,
  contact_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (agency_id) REFERENCES tbl_agency (agency_id),
  FOREIGN KEY (contact_id) REFERENCES tbl_contact (contact_id)
);

CREATE TABLE tbl_app_setting (
  setting_key VARCHAR(50) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  description VARCHAR(200),
  updated_at TIMESTAMP,
  updated_by_user_account_id INT,
  FOREIGN KEY (updated_by_user_account_id) REFERENCES tbl_user_account (user_account_id)
);

CREATE TABLE tbl_attachment (
  attachment_id INT NOT NULL PRIMARY KEY,
  attachment_entity_type_id INT NOT NULL,
  entity_id INT NOT NULL,
  file_url VARCHAR(255) NOT NULL,
  file_name VARCHAR(100),
  mime_type VARCHAR(50),
  uploaded_by_facility_staff_id INT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (attachment_entity_type_id) REFERENCES lkp_attachment_entity_type (attachment_entity_type_id),
  FOREIGN KEY (uploaded_by_facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id)
);

CREATE TABLE tbl_audit_log (
  audit_log_id INT NOT NULL PRIMARY KEY,
  user_account_id INT NOT NULL,
  action VARCHAR(20) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  field_changed VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  action_at TIMESTAMP,
  FOREIGN KEY (user_account_id) REFERENCES tbl_user_account (user_account_id)
);

CREATE TABLE tbl_campaign (
  campaign_id INT NOT NULL PRIMARY KEY,
  campaign_name VARCHAR(150) NOT NULL,
  campaign_type_id INT NOT NULL,
  campaign_status_id INT NOT NULL,
  fund_id INT,
  goal_amount DECIMAL(12,2),
  start_date date,
  end_date date,
  manager_facility_staff_id INT,
  public_url VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP,
  created_by_user_account_id INT,
  description VARCHAR(100),
  FOREIGN KEY (campaign_status_id) REFERENCES lkp_campaign_status (campaign_status_id),
  FOREIGN KEY (campaign_type_id) REFERENCES lkp_campaign_type (campaign_type_id),
  FOREIGN KEY (created_by_user_account_id) REFERENCES tbl_user_account (user_account_id),
  FOREIGN KEY (fund_id) REFERENCES lkp_fund (fund_id),
  FOREIGN KEY (manager_facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id)
);

CREATE TABLE tbl_client (
  client_id INT NOT NULL PRIMARY KEY,
  client_type_id INT NOT NULL,
  contact_id INT NOT NULL,
  start_date date,
  client_status_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (client_status_id) REFERENCES lkp_client_status (client_status_id),
  FOREIGN KEY (client_type_id) REFERENCES lkp_client_type (client_type_id),
  FOREIGN KEY (contact_id) REFERENCES tbl_contact (contact_id)
);

CREATE TABLE tbl_client_deliveries (
  client_deliveries_id INT NOT NULL PRIMARY KEY,
  client_provisioning_request_id INT NOT NULL,
  facility_staff_id INT NOT NULL,
  delivery_date date NOT NULL,
  delivery_status_id INT NOT NULL,
  time_arrival_earliest TIME,
  time_arrival_latest TIME,
  time_delivery_complete TIME,
  notes TEXT,
  gate_code VARCHAR(10),
  description VARCHAR(100),
  FOREIGN KEY (client_provisioning_request_id) REFERENCES tbl_client_provisioning_request (client_provisioning_request_id),
  FOREIGN KEY (delivery_status_id) REFERENCES lkp_delivery_status (delivery_status_id),
  FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id)
);

CREATE TABLE tbl_client_provisioning_request (
  client_provisioning_request_id INT NOT NULL PRIMARY KEY,
  client_id INT NOT NULL,
  client_request_note TEXT,
  fulfillment_corp_facility_id INT NOT NULL,
  request_receipt_origin_id INT NOT NULL,
  client_request_creator_facility_staff_id INT NOT NULL,
  request_at TIMESTAMP NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (client_id) REFERENCES tbl_client (client_id),
  FOREIGN KEY (client_request_creator_facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (fulfillment_corp_facility_id) REFERENCES tbl_corp_facility (corp_facility_id),
  FOREIGN KEY (request_receipt_origin_id) REFERENCES lkp_request_receipt_origin (request_receipt_origin_id)
);

CREATE TABLE tbl_client_request_items (
  client_request_items_id INT NOT NULL PRIMARY KEY,
  client_provisioning_request_id INT NOT NULL,
  item_category_id INT NOT NULL,
  item_notes VARCHAR(255),
  quantity INT NOT NULL,
  priority VARCHAR(20),
  description VARCHAR(100),
  time_stamp TIMESTAMP NOT NULL,
  FOREIGN KEY (client_provisioning_request_id) REFERENCES tbl_client_provisioning_request (client_provisioning_request_id),
  FOREIGN KEY (item_category_id) REFERENCES lkp_item_category (item_category_id)
);

CREATE TABLE tbl_communication_log (
  communication_log_id INT NOT NULL PRIMARY KEY,
  note_entity_type_id INT NOT NULL,
  entity_id INT NOT NULL,
  communication_method_id INT NOT NULL,
  facility_staff_id INT NOT NULL,
  communication_at TIMESTAMP NOT NULL,
  summary TEXT NOT NULL,
  follow_up_needed BOOLEAN NOT NULL,
  follow_up_date date,
  description VARCHAR(100),
  FOREIGN KEY (communication_method_id) REFERENCES lkp_communication_method (communication_method_id),
  FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (note_entity_type_id) REFERENCES lkp_note_entity_type (note_entity_type_id)
);

CREATE TABLE tbl_contact (
  contact_id INT NOT NULL PRIMARY KEY,
  contact_type_id INT NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50),
  last_name VARCHAR(50) NOT NULL,
  gender_id INT,
  ethnicity_id INT,
  birth_date date,
  citizen_status_id INT,
  address_id INT,
  mobile_phone VARCHAR(20),
  home_phone VARCHAR(20),
  other_phone VARCHAR(20),
  email VARCHAR(100),
  description VARCHAR(100),
  FOREIGN KEY (address_id) REFERENCES tbl_address (address_id),
  FOREIGN KEY (citizen_status_id) REFERENCES lkp_citizen_status (citizen_status_id),
  FOREIGN KEY (contact_type_id) REFERENCES lkp_contact_type (contact_type_id),
  FOREIGN KEY (ethnicity_id) REFERENCES lkp_ethnicity (ethnicity_id),
  FOREIGN KEY (gender_id) REFERENCES lkp_gender (gender_id)
);

CREATE TABLE tbl_corp_facility (
  corp_facility_id INT NOT NULL PRIMARY KEY,
  corporate_id INT NOT NULL,
  facility_name VARCHAR(100) NOT NULL,
  contact_id INT,
  address_id INT NOT NULL,
  facility_type_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (address_id) REFERENCES tbl_address (address_id),
  FOREIGN KEY (contact_id) REFERENCES tbl_contact (contact_id),
  FOREIGN KEY (corporate_id) REFERENCES tbl_corporate (corporate_id),
  FOREIGN KEY (facility_type_id) REFERENCES lkp_facility_type (facility_type_id)
);

CREATE TABLE tbl_corp_facility_inventory_item (
  corp_facility_inventory_item_id INT NOT NULL PRIMARY KEY,
  corp_facility_id INT NOT NULL,
  donation_item_id INT,
  storage_location_id INT,
  item_category_id INT NOT NULL,
  item_size_id INT NOT NULL,
  item_weight_id INT NOT NULL,
  item_condition_id INT NOT NULL,
  date_added_to_inventory date NOT NULL,
  date_dispositioned date,
  disposition_reason_id INT,
  donation_value_in DECIMAL(12,2) NOT NULL,
  donation_value_out DECIMAL(12,2),
  description VARCHAR(100),
  FOREIGN KEY (corp_facility_id) REFERENCES tbl_corp_facility (corp_facility_id),
  FOREIGN KEY (disposition_reason_id) REFERENCES lkp_disposition_reason (disposition_reason_id),
  FOREIGN KEY (donation_item_id) REFERENCES tbl_donation_item (donation_item_id),
  FOREIGN KEY (item_category_id) REFERENCES lkp_item_category (item_category_id),
  FOREIGN KEY (item_condition_id) REFERENCES lkp_item_condition (item_condition_id),
  FOREIGN KEY (item_size_id) REFERENCES lkp_item_size (item_size_id),
  FOREIGN KEY (item_weight_id) REFERENCES lkp_item_weight (item_weight_id),
  FOREIGN KEY (storage_location_id) REFERENCES lkp_storage_location (storage_location_id)
);

CREATE TABLE tbl_corporate (
  corporate_id INT NOT NULL PRIMARY KEY,
  corp_type_id INT NOT NULL,
  corp_name VARCHAR(100) NOT NULL,
  fed_tax_id VARCHAR(20),
  incorp_state_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (corp_type_id) REFERENCES lkp_corp_type (corp_type_id),
  FOREIGN KEY (incorp_state_id) REFERENCES lkp_state (state_id)
);

CREATE TABLE tbl_delivery_items (
  delivery_items_id INT NOT NULL PRIMARY KEY,
  client_deliveries_id INT NOT NULL,
  corp_facility_inventory_item_id INT NOT NULL,
  loaded_at TIMESTAMP,
  description VARCHAR(100),
  FOREIGN KEY (client_deliveries_id) REFERENCES tbl_client_deliveries (client_deliveries_id),
  FOREIGN KEY (corp_facility_inventory_item_id) REFERENCES tbl_corp_facility_inventory_item (corp_facility_inventory_item_id)
);

CREATE TABLE tbl_delivery_receipt (
  delivery_receipt_id INT NOT NULL PRIMARY KEY,
  client_deliveries_id INT NOT NULL,
  signature_photo_url VARCHAR(255),
  signed_at TIMESTAMP NOT NULL,
  all_items_received BOOLEAN NOT NULL,
  condition_acceptable BOOLEAN NOT NULL,
  photo_release_granted BOOLEAN NOT NULL,
  recipient_notes TEXT,
  description VARCHAR(100),
  FOREIGN KEY (client_deliveries_id) REFERENCES tbl_client_deliveries (client_deliveries_id)
);

CREATE TABLE tbl_delivery_staff (
  delivery_staff_id INT NOT NULL PRIMARY KEY,
  client_deliveries_id INT NOT NULL,
  facility_staff_id INT NOT NULL,
  is_team_lead BOOLEAN NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (client_deliveries_id) REFERENCES tbl_client_deliveries (client_deliveries_id),
  FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id)
);

CREATE TABLE tbl_delivery_vehicle (
  delivery_vehicle_id INT NOT NULL PRIMARY KEY,
  client_deliveries_id INT NOT NULL,
  delivery_vehicle_type_id INT NOT NULL,
  vehicle_id INT,
  rental_agency_id INT,
  mileage_start INT,
  mileage_end INT,
  fuel_cost DECIMAL(12,2),
  description VARCHAR(100),
  FOREIGN KEY (client_deliveries_id) REFERENCES tbl_client_deliveries (client_deliveries_id),
  FOREIGN KEY (delivery_vehicle_type_id) REFERENCES lkp_delivery_vehicle_type (delivery_vehicle_type_id),
  FOREIGN KEY (rental_agency_id) REFERENCES lkp_rental_agency (rental_agency_id),
  FOREIGN KEY (vehicle_id) REFERENCES tbl_vehicle (vehicle_id)
);

CREATE TABLE tbl_donation (
  donation_id INT NOT NULL PRIMARY KEY,
  donor_id INT NOT NULL,
  donation_type_id INT NOT NULL,
  donation_date date NOT NULL,
  total_value DECIMAL(12,2),
  receipt_sent_date date,
  description VARCHAR(100),
  payment_method_id INT,
  solicitation_method_id INT,
  tax_deductible_amount DECIMAL(12,2),
  acknowledgement_status_id INT,
  acknowledgement_sent_date date,
  receipt_number VARCHAR(50),
  pledge_id INT,
  soft_credit_contact_id INT,
  gift_in_honor_of TEXT,
  external_transaction_id VARCHAR(100),
  received_via VARCHAR(50),
  campaign_id INT,
  qbo_sync_status VARCHAR(20),
  qbo_transaction_id VARCHAR(50),
  qbo_last_synced_at TIMESTAMP,
  qbo_current_sync_id INT,
  qbo_synced_at TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES tbl_campaign (campaign_id),
  FOREIGN KEY (donation_type_id) REFERENCES lkp_donation_type (donation_type_id),
  FOREIGN KEY (donor_id) REFERENCES tbl_donor (donor_id),
  FOREIGN KEY (acknowledgement_status_id) REFERENCES lkp_acknowledgement_status (acknowledgement_status_id),
  FOREIGN KEY (payment_method_id) REFERENCES lkp_payment_method (payment_method_id),
  FOREIGN KEY (pledge_id) REFERENCES tbl_pledge (pledge_id),
  FOREIGN KEY (qbo_current_sync_id) REFERENCES tbl_quickbooks_donation_sync (sync_id),
  FOREIGN KEY (soft_credit_contact_id) REFERENCES tbl_contact (contact_id),
  FOREIGN KEY (solicitation_method_id) REFERENCES lkp_solicitation_method (solicitation_method_id)
);

CREATE TABLE tbl_donation_check (
  donation_check_id INT NOT NULL PRIMARY KEY,
  donation_id INT NOT NULL,
  check_number VARCHAR(20),
  check_date date,
  bank_name VARCHAR(100),
  FOREIGN KEY (donation_id) REFERENCES tbl_donation (donation_id)
);

CREATE TABLE tbl_donation_designation (
  donation_designation_id INT NOT NULL PRIMARY KEY,
  donation_id INT NOT NULL,
  fund_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (donation_id) REFERENCES tbl_donation (donation_id),
  FOREIGN KEY (fund_id) REFERENCES lkp_fund (fund_id)
);

CREATE TABLE tbl_donation_item (
  donation_item_id INT NOT NULL PRIMARY KEY,
  donation_id INT NOT NULL,
  item_description VARCHAR(100) NOT NULL,
  item_category_id INT NOT NULL,
  item_condition_id INT NOT NULL,
  item_size_id INT NOT NULL,
  item_photo_url VARCHAR(255),
  description VARCHAR(100),
  FOREIGN KEY (donation_id) REFERENCES tbl_donation (donation_id),
  FOREIGN KEY (item_category_id) REFERENCES lkp_item_category (item_category_id),
  FOREIGN KEY (item_condition_id) REFERENCES lkp_item_condition (item_condition_id),
  FOREIGN KEY (item_size_id) REFERENCES lkp_item_size (item_size_id)
);

CREATE TABLE tbl_donation_pickup (
  donation_pickup_id INT NOT NULL PRIMARY KEY,
  donor_id INT NOT NULL,
  pickup_address_id INT NOT NULL,
  pickup_status_id INT NOT NULL,
  scheduled_date date NOT NULL,
  time_window_start TIME,
  time_window_end TIME,
  assigned_vehicle_id INT,
  assigned_lead_facility_staff_id INT,
  access_notes TEXT,
  description VARCHAR(100),
  FOREIGN KEY (assigned_lead_facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (assigned_vehicle_id) REFERENCES tbl_vehicle (vehicle_id),
  FOREIGN KEY (donor_id) REFERENCES tbl_donor (donor_id),
  FOREIGN KEY (pickup_address_id) REFERENCES tbl_address (address_id),
  FOREIGN KEY (pickup_status_id) REFERENCES lkp_pickup_status (pickup_status_id)
);

CREATE TABLE tbl_donation_securities (
  donation_securities_id INT NOT NULL PRIMARY KEY,
  donation_id INT NOT NULL,
  security_type VARCHAR(20) NOT NULL,
  ticker VARCHAR(20),
  security_description VARCHAR(200),
  shares DECIMAL(15,4),
  gift_date_fmv DECIMAL(12,2),
  sale_proceeds DECIMAL(12,2),
  broker_name VARCHAR(100),
  FOREIGN KEY (donation_id) REFERENCES tbl_donation (donation_id)
);

CREATE TABLE tbl_donor (
  donor_id INT NOT NULL PRIMARY KEY,
  donor_type_id INT NOT NULL,
  contact_id INT NOT NULL,
  address_id INT NOT NULL,
  howtheyfoundus_id INT NOT NULL,
  is_recurring BOOLEAN NOT NULL,
  description VARCHAR(100),
  donor_advised_fund_name VARCHAR(100),
  employer_match_eligible BOOLEAN,
  do_not_contact BOOLEAN,
  preferred_contact_method_id INT,
  donor_stage_id INT,
  stage_notes TEXT,
  stage_updated_at TIMESTAMP,
  is_anonymous BOOLEAN,
  FOREIGN KEY (address_id) REFERENCES tbl_address (address_id),
  FOREIGN KEY (contact_id) REFERENCES tbl_contact (contact_id),
  FOREIGN KEY (donor_type_id) REFERENCES lkp_donor_type (donor_type_id),
  FOREIGN KEY (howtheyfoundus_id) REFERENCES lkp_howtheyfoundus (howtheyfoundus_id),
  FOREIGN KEY (donor_stage_id) REFERENCES lkp_donor_stage (donor_stage_id),
  FOREIGN KEY (preferred_contact_method_id) REFERENCES lkp_communication_method (communication_method_id)
);

CREATE TABLE tbl_email_account (
  email_account_id INT NOT NULL PRIMARY KEY,
  user_account_id INT NOT NULL,
  display_name VARCHAR(100),
  email_address VARCHAR(255) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  auth_type VARCHAR(20),
  imap_host VARCHAR(255),
  imap_port INT,
  imap_secure BOOLEAN,
  smtp_host VARCHAR(255),
  smtp_port INT,
  smtp_secure BOOLEAN,
  username VARCHAR(255),
  encrypted_password TEXT,
  is_default_send BOOLEAN,
  last_tested_at TIMESTAMP,
  last_test_status VARCHAR(20),
  last_test_error TEXT,
  created_at TIMESTAMP,
  description VARCHAR(100),
  FOREIGN KEY (user_account_id) REFERENCES tbl_user_account (user_account_id)
);

CREATE TABLE tbl_event (
  event_id INT NOT NULL PRIMARY KEY,
  event_type_id INT NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  event_date date NOT NULL,
  start_time TIME,
  end_time TIME,
  address_id INT,
  goal_amount DECIMAL(12,2),
  amount_raised DECIMAL(12,2),
  description VARCHAR(100),
  campaign_id INT,
  is_public BOOLEAN,
  ticket_price DECIMAL(12,2),
  notes TEXT,
  FOREIGN KEY (address_id) REFERENCES tbl_address (address_id),
  FOREIGN KEY (event_type_id) REFERENCES lkp_event_type (event_type_id),
  FOREIGN KEY (campaign_id) REFERENCES tbl_campaign (campaign_id)
);

CREATE TABLE tbl_event_attendee (
  event_attendee_id INT NOT NULL PRIMARY KEY,
  event_id INT NOT NULL,
  contact_id INT NOT NULL,
  rsvp_status VARCHAR(20),
  attended BOOLEAN,
  amount_contributed DECIMAL(12,2),
  description VARCHAR(100),
  checked_in_at TIMESTAMP,
  ticket_count INT,
  notes TEXT,
  FOREIGN KEY (contact_id) REFERENCES tbl_contact (contact_id),
  FOREIGN KEY (event_id) REFERENCES tbl_event (event_id)
);

CREATE TABLE tbl_facility_staff (
  facility_staff_id INT NOT NULL PRIMARY KEY,
  corp_facility_id INT NOT NULL,
  contact_id INT NOT NULL,
  is_volunteer BOOLEAN NOT NULL,
  hire_date date,
  description VARCHAR(100),
  FOREIGN KEY (contact_id) REFERENCES tbl_contact (contact_id),
  FOREIGN KEY (corp_facility_id) REFERENCES tbl_corp_facility (corp_facility_id)
);

CREATE TABLE tbl_facility_staff_statuses (
  facility_staff_statuses_id INT NOT NULL PRIMARY KEY,
  facility_staff_id INT NOT NULL,
  facility_staff_status_id INT NOT NULL,
  status_date_changed date NOT NULL,
  changed_by_facility_staff_id INT NOT NULL,
  status_change_reason_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (changed_by_facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (facility_staff_status_id) REFERENCES lkp_facility_staff_status (facility_staff_status_id),
  FOREIGN KEY (status_change_reason_id) REFERENCES lkp_status_change_reason (status_change_reason_id)
);

CREATE TABLE tbl_grant (
  grant_id INT NOT NULL PRIMARY KEY,
  funder_name VARCHAR(100) NOT NULL,
  grant_name VARCHAR(100) NOT NULL,
  award_amount DECIMAL(12,2) NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  reporting_deadline date,
  restrictions TEXT,
  description VARCHAR(100)
);

CREATE TABLE tbl_inventory_reservation (
  inventory_reservation_id INT NOT NULL PRIMARY KEY,
  corp_facility_inventory_item_id INT NOT NULL,
  client_provisioning_request_id INT NOT NULL,
  reservation_status_id INT NOT NULL,
  reserved_by_facility_staff_id INT NOT NULL,
  reserved_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,
  released_at TIMESTAMP,
  description VARCHAR(100),
  FOREIGN KEY (client_provisioning_request_id) REFERENCES tbl_client_provisioning_request (client_provisioning_request_id),
  FOREIGN KEY (corp_facility_inventory_item_id) REFERENCES tbl_corp_facility_inventory_item (corp_facility_inventory_item_id),
  FOREIGN KEY (reservation_status_id) REFERENCES lkp_reservation_status (reservation_status_id),
  FOREIGN KEY (reserved_by_facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id)
);

CREATE TABLE tbl_note (
  note_id INT NOT NULL PRIMARY KEY,
  note_entity_type_id INT NOT NULL,
  entity_id INT NOT NULL,
  author_facility_staff_id INT NOT NULL,
  note_body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (author_facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (note_entity_type_id) REFERENCES lkp_note_entity_type (note_entity_type_id)
);

CREATE TABLE tbl_pledge (
  pledge_id INT NOT NULL PRIMARY KEY,
  donor_id INT NOT NULL,
  fund_id INT,
  total_pledged_amount DECIMAL(12,2) NOT NULL,
  amount_fulfilled DECIMAL(12,2),
  pledge_date date NOT NULL,
  expected_fulfillment_date date,
  pledge_status_id INT NOT NULL,
  solicitation_method_id INT,
  campaign_id INT,
  notes TEXT,
  created_at TIMESTAMP,
  created_by_user_account_id INT,
  description VARCHAR(100),
  FOREIGN KEY (campaign_id) REFERENCES tbl_campaign (campaign_id),
  FOREIGN KEY (created_by_user_account_id) REFERENCES tbl_user_account (user_account_id),
  FOREIGN KEY (donor_id) REFERENCES tbl_donor (donor_id),
  FOREIGN KEY (fund_id) REFERENCES lkp_fund (fund_id),
  FOREIGN KEY (pledge_status_id) REFERENCES lkp_pledge_status (pledge_status_id),
  FOREIGN KEY (solicitation_method_id) REFERENCES lkp_solicitation_method (solicitation_method_id)
);

CREATE TABLE tbl_quickbooks_account_mapping (
  mapping_id INT NOT NULL PRIMARY KEY,
  fund_id INT,
  qbo_account_id VARCHAR(50) NOT NULL,
  qbo_account_name VARCHAR(255) NOT NULL,
  qbo_account_type VARCHAR(50),
  created_at TIMESTAMP,
  created_by_user_account_id INT,
  updated_at TIMESTAMP,
  FOREIGN KEY (created_by_user_account_id) REFERENCES tbl_user_account (user_account_id),
  FOREIGN KEY (fund_id) REFERENCES lkp_fund (fund_id)
);

CREATE TABLE tbl_quickbooks_connection (
  qbo_connection_id INT NOT NULL PRIMARY KEY,
  realm_id VARCHAR(50) NOT NULL,
  environment VARCHAR(20),
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  access_token_expires_at TIMESTAMP NOT NULL,
  refresh_token_expires_at TIMESTAMP,
  is_active BOOLEAN,
  connected_by_user_account_id INT,
  connected_at TIMESTAMP,
  last_sync_at TIMESTAMP,
  last_refresh_at TIMESTAMP,
  disconnected_at TIMESTAMP,
  description VARCHAR(200),
  FOREIGN KEY (connected_by_user_account_id) REFERENCES tbl_user_account (user_account_id)
);

CREATE TABLE tbl_quickbooks_donation_sync (
  sync_id INT NOT NULL PRIMARY KEY,
  donation_id INT NOT NULL,
  qbo_sales_receipt_id VARCHAR(50),
  sync_status VARCHAR(20) NOT NULL,
  attempted_at TIMESTAMP,
  synced_at TIMESTAMP,
  attempted_by_user_account_id INT,
  error_message TEXT,
  payload_summary TEXT,
  FOREIGN KEY (attempted_by_user_account_id) REFERENCES tbl_user_account (user_account_id),
  FOREIGN KEY (donation_id) REFERENCES tbl_donation (donation_id)
);

CREATE TABLE tbl_quickbooks_donor_link (
  donor_link_id INT NOT NULL PRIMARY KEY,
  donor_id INT NOT NULL,
  qbo_customer_id VARCHAR(50) NOT NULL,
  qbo_customer_display_name VARCHAR(255),
  created_at TIMESTAMP,
  last_synced_at TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES tbl_donor (donor_id)
);

CREATE TABLE tbl_receipt_counter (
  fiscal_year INT NOT NULL PRIMARY KEY,
  next_number INT,
  updated_at TIMESTAMP
);

CREATE TABLE tbl_referral (
  referral_id INT NOT NULL PRIMARY KEY,
  agency_contact_id INT NOT NULL,
  client_id INT NOT NULL,
  referral_date date NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (agency_contact_id) REFERENCES tbl_agency_contact (agency_contact_id),
  FOREIGN KEY (client_id) REFERENCES tbl_client (client_id)
);

CREATE TABLE tbl_request_item_inv_matches (
  request_item_inv_matches_id INT NOT NULL PRIMARY KEY,
  client_request_items_id INT NOT NULL,
  corp_facility_inventory_item_id INT NOT NULL,
  item_selected BOOLEAN NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (client_request_items_id) REFERENCES tbl_client_request_items (client_request_items_id),
  FOREIGN KEY (corp_facility_inventory_item_id) REFERENCES tbl_corp_facility_inventory_item (corp_facility_inventory_item_id)
);

CREATE TABLE tbl_staff_type (
  staff_type_id INT NOT NULL PRIMARY KEY,
  staff_type VARCHAR(50) NOT NULL,
  staff_role_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (staff_role_id) REFERENCES lkp_staff_role (staff_role_id)
);

CREATE TABLE tbl_staff_types (
  staff_types_id INT NOT NULL PRIMARY KEY,
  facility_staff_id INT NOT NULL,
  staff_type_id INT NOT NULL,
  date_changed date NOT NULL,
  date_effective date NOT NULL,
  is_active BOOLEAN NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (staff_type_id) REFERENCES tbl_staff_type (staff_type_id)
);

CREATE TABLE tbl_user_account (
  user_account_id INT NOT NULL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  facility_staff_id INT,
  agency_contact_id INT,
  last_login_at TIMESTAMP,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  description VARCHAR(100),
  is_admin BOOLEAN,
  FOREIGN KEY (agency_contact_id) REFERENCES tbl_agency_contact (agency_contact_id),
  FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id)
);

CREATE TABLE tbl_vehicle (
  vehicle_id INT NOT NULL PRIMARY KEY,
  corp_facility_id INT,
  vehicle_make_id INT NOT NULL,
  vehicle_model_id INT NOT NULL,
  model_year INT NOT NULL,
  vehicle_type_id INT NOT NULL,
  vehicle_license VARCHAR(15),
  description VARCHAR(100),
  FOREIGN KEY (corp_facility_id) REFERENCES tbl_corp_facility (corp_facility_id),
  FOREIGN KEY (vehicle_make_id) REFERENCES lkp_vehicle_make (vehicle_make_id),
  FOREIGN KEY (vehicle_model_id) REFERENCES lkp_vehicle_model (vehicle_model_id),
  FOREIGN KEY (vehicle_type_id) REFERENCES lkp_vehicle_type (vehicle_type_id)
);

CREATE TABLE tbl_vehicle_maintenance (
  vehicle_maintenance_id INT NOT NULL PRIMARY KEY,
  vehicle_id INT NOT NULL,
  maintenance_type_id INT NOT NULL,
  service_date date NOT NULL,
  vendor VARCHAR(100),
  cost DECIMAL(12,2),
  next_due_date date,
  notes TEXT,
  description VARCHAR(100),
  FOREIGN KEY (maintenance_type_id) REFERENCES lkp_maintenance_type (maintenance_type_id),
  FOREIGN KEY (vehicle_id) REFERENCES tbl_vehicle (vehicle_id)
);

CREATE TABLE tbl_vehicle_mileage (
  vehicle_mileage_id INT NOT NULL PRIMARY KEY,
  vehicle_id INT NOT NULL,
  date_recorded date NOT NULL,
  mileage INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (vehicle_id) REFERENCES tbl_vehicle (vehicle_id)
);

CREATE TABLE tbl_volunteer_hours (
  volunteer_hours_id INT NOT NULL PRIMARY KEY,
  facility_staff_id INT NOT NULL,
  volunteer_activity_type_id INT NOT NULL,
  activity_date date NOT NULL,
  hours_logged DECIMAL(5,2) NOT NULL,
  verified_by_facility_staff_id INT,
  notes TEXT,
  description VARCHAR(100),
  FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (verified_by_facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (volunteer_activity_type_id) REFERENCES lkp_volunteer_activity_type (volunteer_activity_type_id)
);

CREATE TABLE tbl_volunteer_profile (
  volunteer_profile_id INT NOT NULL PRIMARY KEY,
  facility_staff_id INT NOT NULL,
  waiver_signed BOOLEAN NOT NULL,
  waiver_signed_date date,
  waiver_version VARCHAR(20),
  background_check_status VARCHAR(50),
  background_check_expiration date,
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  t_shirt_size VARCHAR(10),
  description VARCHAR(100),
  FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id)
);

CREATE TABLE tbl_volunteer_shift (
  shift_id INT NOT NULL PRIMARY KEY,
  shift_type_id INT NOT NULL,
  shift_status_id INT NOT NULL,
  corp_facility_id INT,
  shift_name VARCHAR(120),
  shift_date date NOT NULL,
  start_time TIME,
  end_time TIME,
  capacity_needed INT,
  notes TEXT,
  created_at TIMESTAMP,
  created_by_user_account_id INT,
  FOREIGN KEY (corp_facility_id) REFERENCES tbl_corp_facility (corp_facility_id),
  FOREIGN KEY (created_by_user_account_id) REFERENCES tbl_user_account (user_account_id),
  FOREIGN KEY (shift_status_id) REFERENCES lkp_shift_status (shift_status_id),
  FOREIGN KEY (shift_type_id) REFERENCES lkp_shift_type (shift_type_id)
);

CREATE TABLE tbl_volunteer_shift_signup (
  signup_id INT NOT NULL PRIMARY KEY,
  shift_id INT NOT NULL,
  facility_staff_id INT NOT NULL,
  signup_status VARCHAR(20),
  hours_logged DECIMAL(5,2),
  notes VARCHAR(200),
  signed_up_at TIMESTAMP,
  signed_up_by_user_account_id INT,
  FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (shift_id) REFERENCES tbl_volunteer_shift (shift_id),
  FOREIGN KEY (signed_up_by_user_account_id) REFERENCES tbl_user_account (user_account_id)
);

CREATE TABLE tbl_volunteer_skill (
  volunteer_skill_id INT NOT NULL PRIMARY KEY,
  facility_staff_id INT NOT NULL,
  skill_id INT NOT NULL,
  description VARCHAR(100),
  FOREIGN KEY (facility_staff_id) REFERENCES tbl_facility_staff (facility_staff_id),
  FOREIGN KEY (skill_id) REFERENCES lkp_skill (skill_id)
);
