-- Furnish Hope — seed data
-- Populates lookup tables and a small set of demo records so the app
-- shows realistic data on first boot. All Central Oregon flavor.

BEGIN;

-- ============================================================
-- Lookups — geography
-- ============================================================
INSERT INTO lkp_state (state) VALUES ('Oregon'), ('Washington'), ('California');
INSERT INTO lkp_county (state_id, county) VALUES
    (1, 'Deschutes'), (1, 'Crook'), (1, 'Jefferson'), (1, 'Klamath');
INSERT INTO lkp_city (county_id, city) VALUES
    (1, 'Bend'), (1, 'Redmond'), (1, 'Sisters'), (1, 'La Pine'),
    (1, 'Sunriver'), (2, 'Prineville'), (3, 'Madras');

-- ============================================================
-- Lookups — types & statuses
-- ============================================================
INSERT INTO lkp_address_type (address_type) VALUES
    ('Residence'), ('Business'), ('Warehouse'), ('Mailing'), ('Pickup');

INSERT INTO lkp_agency_type (agency_type) VALUES
    ('Refugee resettlement'), ('Domestic violence'), ('Veterans services'),
    ('Recovery / treatment'), ('Family services'), ('Housing assistance'),
    ('Disability services'), ('Foster care');

INSERT INTO lkp_contact_type (contact_type) VALUES
    ('Client'), ('Donor'), ('Staff'), ('Volunteer'), ('Agency'), ('Vendor');

INSERT INTO lkp_corp_type (corp_type) VALUES
    ('Nonprofit 501c3'), ('LLC'), ('Sole proprietor'), ('Partnership');

INSERT INTO lkp_gender (gender) VALUES
    ('Female'), ('Male'), ('Non-binary'), ('Prefer not to say');

INSERT INTO lkp_ethnicity (ethnicity) VALUES
    ('Hispanic / Latino'), ('White'), ('Black or African American'),
    ('Native American'), ('Asian'), ('Pacific Islander'),
    ('Two or more'), ('Prefer not to say');

INSERT INTO lkp_citizen_status (citizen_status) VALUES
    ('US citizen'), ('Permanent resident'), ('Refugee / asylee'),
    ('Visa holder'), ('Other / prefer not to say');

INSERT INTO lkp_client_type (client_type) VALUES
    ('Refugee family'), ('Veteran'), ('Recovery graduate'),
    ('Domestic violence survivor'), ('Foster youth / family'),
    ('Natural disaster'), ('Person with disability');

INSERT INTO lkp_client_status (client_status) VALUES
    ('Intake'), ('Active'), ('Matching'), ('Scheduled'), ('Served'), ('Closed');

INSERT INTO lkp_facility_type (facility_type) VALUES
    ('Warehouse'), ('Office'), ('Storage'), ('Retail');

INSERT INTO lkp_facility_staff_status (facility_staff_status) VALUES
    ('Active'), ('Inactive'), ('On leave'), ('Onboarding'), ('Terminated');

INSERT INTO lkp_status_change_reason (status_change_reason) VALUES
    ('Initial hire'), ('Promotion'), ('Resignation'),
    ('Leave of absence'), ('Return from leave'), ('Termination');

-- ============================================================
-- Lookups — inventory & items
-- ============================================================
INSERT INTO lkp_item_category (item_category) VALUES
    ('Sofa'), ('Sectional'), ('Loveseat'), ('Armchair'), ('Coffee table'),
    ('End table'), ('Dining table'), ('Dining chairs'),
    ('Bed frame'), ('Mattress'), ('Box spring'), ('Crib'),
    ('Dresser'), ('Nightstand'), ('Wardrobe'),
    ('Lamp'), ('Floor lamp'), ('Lighting fixture'),
    ('Kitchen essentials kit'), ('Dishware'), ('Cookware'),
    ('Bath linens'), ('Bedding'), ('Curtains'),
    ('Storage / shelving'), ('Desk'), ('Bookcase'),
    ('Childrens items'), ('Toys'), ('Highchair'), ('Stroller');

INSERT INTO lkp_item_condition (item_condition) VALUES
    ('Excellent'), ('Good'), ('Fair'), ('Needs repair');

INSERT INTO lkp_item_size (item_size) VALUES
    ('Small'), ('Medium'), ('Large'), ('Extra large'),
    ('Twin'), ('Full'), ('Queen'), ('King');

INSERT INTO lkp_item_weight (item_weight, weight_lbs_min, weight_lbs_max) VALUES
    ('Light (under 25 lbs)', 0, 25),
    ('Medium (25-75 lbs)', 25, 75),
    ('Heavy (75-150 lbs)', 75, 150),
    ('Very heavy (150+ lbs)', 150, 999);

INSERT INTO lkp_disposition_reason (disposition_reason) VALUES
    ('Delivered to client'), ('Donated to partner org'),
    ('Sold in shop'), ('Damaged beyond repair'),
    ('Returned to donor'), ('Discarded');

-- lkp_storage_location moved below — depends on tbl_corp_facility existing.

INSERT INTO lkp_reservation_status (reservation_status) VALUES
    ('Active'), ('Released'), ('Fulfilled'), ('Expired');

-- ============================================================
-- Lookups — donors, donations, sourcing
-- ============================================================
INSERT INTO lkp_donor_type (donor_type) VALUES
    ('Individual'), ('Corporate'), ('Organization'),
    ('Estate sale'), ('Anonymous');

INSERT INTO lkp_donation_type (donation_type) VALUES
    ('In-kind'), ('Monetary'), ('Mixed');

INSERT INTO lkp_source_type (source_type) VALUES
    ('Online'), ('Word of mouth'), ('Community event'),
    ('Partner agency'), ('Media'), ('Other');

INSERT INTO lkp_howtheyfoundus (howtheyfoundus, source_type_id) VALUES
    ('Website', 1), ('Google search', 1), ('Social media', 1),
    ('Friend or family', 2), ('Neighbor', 2),
    ('Fundraising event', 3), ('Caseworker referral', 4),
    ('News article', 5), ('Other', 6);

INSERT INTO lkp_request_receipt_origin (request_receipt_origin) VALUES
    ('Agency referral form'), ('Phone call'), ('Email'),
    ('Walk-in'), ('Online intake form');

INSERT INTO lkp_pickup_status (pickup_status) VALUES
    ('Requested'), ('Scheduled'), ('Confirmed'),
    ('In progress'), ('Completed'), ('Cancelled'), ('Failed');

INSERT INTO lkp_delivery_status (delivery_status) VALUES
    ('Scheduled'), ('Loading'), ('In transit'),
    ('Delivered'), ('Cancelled'), ('Rescheduled');

-- ============================================================
-- Lookups — vehicles
-- ============================================================
INSERT INTO lkp_vehicle_weight_class (vehicle_weight_class) VALUES
    ('Class 1 - light'), ('Class 2 - medium'), ('Class 3 - heavy'), ('Class 4 - HD');

INSERT INTO lkp_vehicle_fuel_type (vehicle_fuel_type) VALUES
    ('Gasoline'), ('Diesel'), ('Hybrid'), ('Electric');

INSERT INTO lkp_vehicle_type (vehicle_type, vehicle_weight_class_id, vehicle_fuel_type_id) VALUES
    ('Pickup truck', 1, 1), ('Cargo van', 2, 1),
    ('Box truck 16ft', 3, 2), ('Box truck 24ft', 3, 2),
    ('Sprinter van', 2, 2);

INSERT INTO lkp_vehicle_make (vehicle_make) VALUES
    ('Ford'), ('Chevrolet'), ('Ram'), ('Toyota'),
    ('Mercedes-Benz'), ('Isuzu'), ('Hino');

INSERT INTO lkp_vehicle_model (vehicle_make_id, vehicle_model) VALUES
    (1, 'F-150'), (1, 'F-250'), (1, 'Transit'),
    (2, 'Silverado 1500'), (2, 'Express 2500'),
    (3, 'ProMaster 2500'), (4, 'Tacoma'),
    (5, 'Sprinter 2500'), (6, 'NPR-HD');

INSERT INTO lkp_delivery_vehicle_type (delivery_vehicle_type) VALUES
    ('Owned'), ('Rented'), ('Borrowed'), ('Staff personal');

INSERT INTO lkp_rental_agency (rental_agency, account_number) VALUES
    ('U-Haul Bend', 'UH-FH-2104'),
    ('Penske Bend', 'PEN-44102'),
    ('Enterprise Truck', 'ENT-9921');

INSERT INTO lkp_maintenance_type (maintenance_type) VALUES
    ('Oil change'), ('Tire rotation'), ('Brake service'),
    ('Annual inspection'), ('Transmission service'), ('Other repair');

-- ============================================================
-- Lookups — staff & volunteers
-- ============================================================
INSERT INTO lkp_role_pay_type (role_pay_type) VALUES
    ('Paid full-time'), ('Paid part-time'), ('Contractor'), ('Volunteer');

INSERT INTO lkp_staff_role (staff_role, role_pay_type_id) VALUES
    ('Executive Director', 1), ('Operations Coordinator', 1),
    ('Warehouse Manager', 1), ('Caseworker', 2),
    ('Delivery Driver', 4), ('Delivery Helper', 4),
    ('Donation Receiver', 4), ('Office Volunteer', 4);

INSERT INTO lkp_skill (skill) VALUES
    ('Can drive box truck (24ft)'), ('Can drive cargo van'),
    ('Heavy lifting (75+ lbs)'), ('Spanish'),
    ('Customer service'), ('Inventory / data entry'),
    ('Furniture assembly'), ('Photography');

INSERT INTO lkp_volunteer_activity_type (volunteer_activity_type) VALUES
    ('Delivery'), ('Warehouse / sorting'), ('Donation pickup'),
    ('Event support'), ('Office / admin'), ('Outreach');

-- ============================================================
-- Lookups — communications & attachments
-- ============================================================
INSERT INTO lkp_communication_method (communication_method) VALUES
    ('Phone call'), ('Text message'), ('Email'), ('In person'), ('Letter');

INSERT INTO lkp_note_entity_type (note_entity_type) VALUES
    ('Client'), ('Donor'), ('Agency'), ('Provisioning request'),
    ('Delivery'), ('Inventory item'), ('Facility staff');

INSERT INTO lkp_attachment_entity_type (attachment_entity_type) VALUES
    ('Facility staff'), ('Vehicle'), ('Inventory item'),
    ('Donation item'), ('Delivery'), ('Delivery receipt'),
    ('Client'), ('Facility');

INSERT INTO lkp_event_type (event_type) VALUES
    ('Fundraiser'), ('Open house'), ('Volunteer appreciation'),
    ('Board meeting'), ('Community outreach');

-- ============================================================
-- Demo data — Corporate, facilities, addresses
-- ============================================================
INSERT INTO tbl_corporate (corp_type_id, corp_name, fed_tax_id, incorp_state_id) VALUES
    (1, 'Furnish Hope', '87-1234567', 1);

INSERT INTO tbl_address (address_name, address_type_id, address, address2, city_id, county_id, state_id, postalcode) VALUES
    ('Bend Warehouse', 3, '63100 NE 18th St', NULL, 1, 1, 1, '97701'),
    ('Redmond Storage', 3, '2240 SW Highland Ave', NULL, 2, 1, 1, '97756'),
    ('Latino Community Assn', 2, '2125 NE Daggett Ln', 'Suite B', 1, 1, 1, '97701'),
    ('NeighborImpact', 2, '2303 SW First St', NULL, 2, 1, 1, '97756'),
    ('Saving Grace', 2, 'PO Box 9054', NULL, 1, 1, 1, '97708'),
    ('1428 NE Lafayette Ave', 1, '1428 NE Lafayette Ave', NULL, 1, 1, 1, '97701'),
    ('312 NW Vermont Pl', 1, '312 NW Vermont Pl', NULL, 1, 1, 1, '97701'),
    ('445 SE Reed Market Rd', 1, '445 SE Reed Market Rd', 'Apt 12', 1, 1, 1, '97702'),
    ('8821 SW Eagle Crest Dr', 1, '8821 SW Eagle Crest Dr', NULL, 5, 1, 1, '97707'),
    ('Cascade Estate Sales', 2, '1015 NW Wall St', NULL, 1, 1, 1, '97703'),
    ('Margaret & Paul Lin', 1, '2244 NW Crossing Dr', NULL, 1, 1, 1, '97703');

INSERT INTO tbl_corp_facility (corporate_id, facility_name, contact_id, address_id, facility_type_id) VALUES
    (1, 'Bend Warehouse', NULL, 1, 1),
    (1, 'Redmond Storage', NULL, 2, 3);

INSERT INTO lkp_storage_location (corp_facility_id, location_code) VALUES
    (1, 'Bay 1 - Living room'), (1, 'Bay 2 - Bedroom'),
    (1, 'Bay 3 - Dining'), (1, 'Bay 4 - Kitchen'),
    (1, 'Bay 5 - Misc'), (1, 'Loft - Linens'),
    (2, 'Row A'), (2, 'Row B'), (2, 'Row C');

-- ============================================================
-- Demo data — Contacts (clients, donors, staff)
-- ============================================================
-- Staff contacts (1-3)
INSERT INTO tbl_contact (contact_type_id, first_name, last_name, gender_id, ethnicity_id, mobile_phone, email) VALUES
    (3, 'Jamie', 'Mercer', 1, 2, '(541) 555-0100', 'jamie@furnishhope.org'),
    (3, 'Marcus', 'Bell', 2, 3, '(541) 555-0101', 'marcus@furnishhope.org'),
    (3, 'Priya', 'Shah', 1, 5, '(541) 555-0102', 'priya@furnishhope.org');

-- Caseworker / agency contacts (4-6)
INSERT INTO tbl_contact (contact_type_id, first_name, last_name, gender_id, ethnicity_id, mobile_phone, email) VALUES
    (5, 'Kathie', 'Wilson', 1, 2, '(541) 555-0301', 'kwilson@bendlapine.org'),
    (5, 'Diego', 'Martinez', 2, 1, '(541) 555-0302', 'dmartinez@lcaoregon.org'),
    (5, 'Sarah', 'Chen', 1, 5, '(541) 555-0303', 'schen@neighborimpact.org');

-- Client contacts (7-11)
INSERT INTO tbl_contact (contact_type_id, first_name, last_name, gender_id, ethnicity_id, birth_date, citizen_status_id, address_id, mobile_phone) VALUES
    (1, 'Marisol', 'Navarro', 1, 1, '1989-03-14', 3, 6, '(541) 555-0182'),
    (1, 'Terrence', 'Park', 2, 5, '1982-09-22', 1, 7, '(541) 555-0144'),
    (1, 'Vonya', 'Reyes', 1, 1, '1991-11-08', 1, 8, '(541) 555-0167'),
    (1, 'Devon', 'Kelley', 2, 2, '1986-06-30', 1, 9, '(541) 555-0193'),
    (1, 'Amelia', 'Hollis', 1, 2, '1990-02-17', 1, 7, '(541) 555-0188');

-- Donor contacts (12-14)
INSERT INTO tbl_contact (contact_type_id, first_name, last_name, mobile_phone, email) VALUES
    (2, 'Rachel', 'Bergstrom', '(541) 555-0801', 'rachel@cascadeestate.com'),
    (2, 'Margaret', 'Lin', '(541) 555-0802', 'mplin@example.com'),
    (2, 'Anonymous', 'Donor', NULL, NULL);

-- Volunteer contacts (15-17)
INSERT INTO tbl_contact (contact_type_id, first_name, last_name, mobile_phone, email) VALUES
    (4, 'Tom', 'Westbrook', '(541) 555-0501', 'twestbrook@gmail.com'),
    (4, 'Liz', 'Okafor', '(541) 555-0502', 'liz.okafor@gmail.com'),
    (4, 'Hiroshi', 'Tanaka', '(541) 555-0503', 'h.tanaka@gmail.com');

-- ============================================================
-- Demo data — Facility staff
-- ============================================================
INSERT INTO tbl_facility_staff (corp_facility_id, contact_id, is_volunteer, hire_date) VALUES
    (1, 1, false, '2023-03-15'),  -- Jamie (ops coordinator) - id 1
    (1, 2, false, '2022-08-01'),  -- Marcus (warehouse manager) - id 2
    (1, 3, false, '2024-01-10'),  -- Priya (caseworker) - id 3
    (1, 15, true, '2024-06-01'),  -- Tom (volunteer driver) - id 4
    (1, 16, true, '2025-02-15'),  -- Liz (volunteer) - id 5
    (1, 17, true, '2025-04-08');  -- Hiroshi (volunteer) - id 6

INSERT INTO tbl_staff_type (staff_type, staff_role_id) VALUES
    ('Operations Coordinator', 2),
    ('Warehouse Manager', 3),
    ('Caseworker (PT)', 4),
    ('Delivery Driver (vol)', 5),
    ('Delivery Helper (vol)', 6);

INSERT INTO tbl_staff_types (facility_staff_id, staff_type_id, date_changed, date_effective, is_active) VALUES
    (1, 1, '2023-03-15', '2023-03-15', true),
    (2, 2, '2022-08-01', '2022-08-01', true),
    (3, 3, '2024-01-10', '2024-01-10', true),
    (4, 4, '2024-06-01', '2024-06-01', true),
    (5, 5, '2025-02-15', '2025-02-15', true),
    (6, 5, '2025-04-08', '2025-04-08', true);

INSERT INTO tbl_facility_staff_statuses (facility_staff_id, facility_staff_status_id, status_date_changed, changed_by_facility_staff_id, status_change_reason_id) VALUES
    (1, 1, '2023-03-15', 1, 1),
    (2, 1, '2022-08-01', 1, 1),
    (3, 1, '2024-01-10', 1, 1),
    (4, 1, '2024-06-01', 1, 1),
    (5, 1, '2025-02-15', 1, 1),
    (6, 1, '2025-04-08', 1, 1);

-- Volunteer profiles
INSERT INTO tbl_volunteer_profile (facility_staff_id, waiver_signed, waiver_signed_date, waiver_version, background_check_status, background_check_expiration, emergency_contact_name, emergency_contact_phone, t_shirt_size) VALUES
    (4, true, '2024-06-01', 'v2.1', 'Cleared', '2026-06-01', 'Susan Westbrook', '(541) 555-0511', 'L'),
    (5, true, '2025-02-15', 'v2.1', 'Cleared', '2027-02-15', 'David Okafor', '(541) 555-0512', 'M'),
    (6, true, '2025-04-08', 'v2.1', 'Pending', NULL, 'Yuki Tanaka', '(541) 555-0513', 'M');

-- Volunteer skills
INSERT INTO tbl_volunteer_skill (facility_staff_id, skill_id) VALUES
    (4, 1), (4, 3), (4, 7),     -- Tom: box truck, lifting, assembly
    (5, 2), (5, 4), (5, 5),     -- Liz: van, Spanish, customer service
    (6, 3), (6, 6), (6, 8);     -- Hiroshi: lifting, data entry, photography

-- Volunteer hours
INSERT INTO tbl_volunteer_hours (facility_staff_id, volunteer_activity_type_id, activity_date, hours_logged, verified_by_facility_staff_id, notes) VALUES
    (4, 1, '2026-05-21', 4.5, 1, 'Delivery to Kelley family'),
    (4, 1, '2026-05-18', 5.0, 1, 'Two deliveries, Bend area'),
    (5, 2, '2026-05-20', 3.0, 2, 'Sorting incoming donations'),
    (5, 3, '2026-05-17', 2.5, 2, 'Pickup from Lin household'),
    (6, 2, '2026-05-22', 4.0, 2, 'Inventory photography session'),
    (4, 1, '2026-05-14', 6.0, 1, 'Multi-stop delivery day');

-- ============================================================
-- Demo data — Agencies & referrals
-- ============================================================
INSERT INTO tbl_agency (agency_name, address_id, agency_type_id) VALUES
    ('Latino Community Association', 3, 1),
    ('NeighborImpact', 4, 5),
    ('Saving Grace', 5, 2),
    ('Central Oregon Veterans Outreach', 4, 3),
    ('BestCare Treatment', 4, 4);

INSERT INTO tbl_agency_contact (agency_id, contact_id) VALUES
    (1, 5),  -- Diego at LCA
    (2, 6),  -- Sarah at NeighborImpact
    (3, 4);  -- Kathie at Saving Grace (via FAN advocacy network)

-- ============================================================
-- Demo data — Clients
-- ============================================================
INSERT INTO tbl_client (client_type_id, contact_id, start_date, client_status_id) VALUES
    (1, 7, '2026-05-17', 3),   -- Marisol (refugee), matching
    (2, 8, '2026-05-18', 1),   -- Terrence (veteran), intake
    (1, 9, '2026-05-19', 3),   -- Vonya, matching
    (3, 10, '2026-05-16', 4),  -- Devon (recovery), scheduled
    (4, 11, '2026-05-15', 3);  -- Amelia (DV), matching

INSERT INTO tbl_referral (agency_contact_id, client_id, referral_date) VALUES
    (1, 1, '2026-05-17'),
    (2, 3, '2026-05-19'),
    (3, 5, '2026-05-15');

-- ============================================================
-- Demo data — Donors & donations
-- ============================================================
INSERT INTO tbl_donor (donor_type_id, contact_id, address_id, howtheyfoundus_id, is_recurring) VALUES
    (2, 12, 10, 7, true),   -- Cascade Estate Sales, corporate recurring
    (1, 13, 11, 4, false),  -- Margaret & Paul Lin, individual first-time
    (5, 14, 11, 5, false);  -- Anonymous

INSERT INTO tbl_donation (donor_id, donation_type_id, donation_date, total_value, receipt_sent_date) VALUES
    (1, 1, '2026-05-22', 2840.00, '2026-05-23'),
    (2, 1, '2026-05-22',  620.00, NULL),
    (3, 1, '2026-05-20',  280.00, NULL);

INSERT INTO tbl_donation_item (donation_id, item_description, item_category_id, item_condition_id, item_size_id) VALUES
    (1, 'Beige sectional sofa', 2, 1, 4),
    (1, 'Oak dresser, 6-drawer', 13, 1, 3),
    (1, 'Pine dining table seats 6', 7, 2, 3),
    (1, 'Set of 4 dining chairs', 8, 2, 1),
    (2, 'Queen bed frame, walnut', 9, 1, 7),
    (2, 'Queen mattress, like new', 10, 1, 7),
    (2, 'Matching nightstand pair', 14, 1, 1),
    (3, 'Crib, white', 12, 1, 2),
    (3, 'Crib bedding set', 23, 1, 1);

-- ============================================================
-- Demo data — Inventory items
-- ============================================================
INSERT INTO tbl_corp_facility_inventory_item
    (corp_facility_id, donation_item_id, storage_location_id, item_category_id, item_size_id, item_weight_id, item_condition_id, date_added_to_inventory, donation_value_in, description) VALUES
    (1, 1, 1, 2, 4, 4, 1, '2026-05-22', 680.00, 'Beige sectional, no pets in donor home'),
    (1, 2, 2, 13, 3, 3, 1, '2026-05-22', 210.00, 'Oak dresser, 6-drawer'),
    (1, 3, 3, 7, 3, 3, 2, '2026-05-22', 340.00, 'Pine dining table'),
    (1, 4, 3, 8, 1, 2, 2, '2026-05-22',  80.00, 'Dining chairs (4)'),
    (1, 5, 2, 9, 7, 3, 1, '2026-05-22', 420.00, 'Walnut queen bed frame'),
    (1, 6, 2, 10, 7, 3, 1, '2026-05-22', 280.00, 'Queen mattress'),
    (1, 7, 2, 14, 1, 2, 1, '2026-05-22', 140.00, 'Nightstand pair'),
    (2, 8, 7, 12, 2, 2, 1, '2026-05-20', 180.00, 'White crib'),
    (2, 9, 7, 23, 1, 1, 1, '2026-05-20', 100.00, 'Crib bedding set');

-- A few previously-existing inventory items not tied to recent donations
INSERT INTO tbl_corp_facility_inventory_item
    (corp_facility_id, storage_location_id, item_category_id, item_size_id, item_weight_id, item_condition_id, date_added_to_inventory, donation_value_in, description) VALUES
    (1, 5, 16, 1, 1, 2, '2026-04-15', 65.00, 'Brass floor lamp'),
    (1, 5, 16, 1, 1, 2, '2026-04-15', 45.00, 'Table lamp, ceramic base'),
    (1, 4, 19, 3, 2, 1, '2026-05-01', 120.00, 'Kitchen essentials kit, family of 4'),
    (1, 2, 9, 5, 3, 2, '2026-05-08', 220.00, 'Twin bed frame, oak'),
    (1, 2, 9, 5, 3, 2, '2026-05-08', 180.00, 'Twin bed frame, white'),
    (1, 2, 10, 5, 3, 1, '2026-05-08', 160.00, 'Twin mattress'),
    (1, 2, 13, 3, 3, 2, '2026-05-10', 180.00, 'Pine dresser');

-- ============================================================
-- Demo data — Vehicles
-- ============================================================
INSERT INTO tbl_vehicle (corp_facility_id, vehicle_make_id, vehicle_model_id, model_year, vehicle_type_id, vehicle_license) VALUES
    (1, 6, 9, 2019, 4, 'OR-FH-101'),    -- Isuzu NPR-HD 24ft box
    (1, 3, 6, 2021, 2, 'OR-FH-102'),    -- Ram ProMaster cargo van
    (1, 1, 1, 2018, 1, 'OR-FH-103');    -- Ford F-150

INSERT INTO tbl_vehicle_mileage (vehicle_id, date_recorded, mileage) VALUES
    (1, '2026-05-01', 87420),
    (1, '2026-05-22', 88105),
    (2, '2026-05-01', 42330),
    (2, '2026-05-22', 42780),
    (3, '2026-05-01', 112050),
    (3, '2026-05-22', 112520);

INSERT INTO tbl_vehicle_maintenance (vehicle_id, maintenance_type_id, service_date, vendor, cost, next_due_date) VALUES
    (1, 1, '2026-04-15', 'Bend Diesel Service', 145.00, '2026-07-15'),
    (1, 4, '2026-01-20', 'Bend Diesel Service', 320.00, '2027-01-20'),
    (2, 1, '2026-03-01', 'Jiffy Lube', 65.00, '2026-06-01'),
    (3, 3, '2026-02-10', 'Les Schwab', 480.00, NULL);

-- ============================================================
-- Demo data — Provisioning request, matching, reservation, delivery
-- (Marisol Navarro's family — the showcase scenario)
-- ============================================================
INSERT INTO tbl_client_provisioning_request
    (client_id, client_request_note, fulfillment_corp_facility_id, request_receipt_origin_id, client_request_creator_facility_staff_id, request_at) VALUES
    (1, 'Family of 5 (parents + 3 children ages 4, 7, 11). Earth tones preferred. No pets in home. Spanish-speaking — prefer Spanish-speaking volunteer on delivery if possible.',
     1, 1, 3, '2026-05-17 14:32:00-07');

INSERT INTO tbl_client_request_items (client_provisioning_request_id, item_category_id, item_notes, quantity, priority, time_stamp) VALUES
    (1, 1, 'Earth tones preferred', 1, 'High', '2026-05-17 14:32:00-07'),
    (1, 5, NULL, 1, 'Medium', '2026-05-17 14:32:00-07'),
    (1, 16, '2 floor or table lamps', 2, 'Low', '2026-05-17 14:32:00-07'),
    (1, 9, 'Primary bedroom, firm mattress requested', 1, 'High', '2026-05-17 14:32:00-07'),
    (1, 10, 'Firm', 1, 'High', '2026-05-17 14:32:00-07'),
    (1, 9, 'For children, ages 4/7/11', 3, 'High', '2026-05-17 14:32:00-07'),
    (1, 10, 'Twin mattresses for kids beds', 3, 'High', '2026-05-17 14:32:00-07'),
    (1, 13, 'For shared kids room', 2, 'Medium', '2026-05-17 14:32:00-07'),
    (1, 7, 'Seats 6+', 1, 'Medium', '2026-05-17 14:32:00-07'),
    (1, 19, 'For family of 5', 1, 'High', '2026-05-17 14:32:00-07');

-- Reservations on inventory for Marisol's request
INSERT INTO tbl_inventory_reservation
    (corp_facility_inventory_item_id, client_provisioning_request_id, reservation_status_id, reserved_by_facility_staff_id, reserved_at, expires_at) VALUES
    (1, 1, 1, 1, '2026-05-19 10:15:00-07', '2026-05-31 23:59:00-07'),  -- sectional
    (5, 1, 1, 1, '2026-05-22 14:00:00-07', '2026-05-31 23:59:00-07'),  -- queen bed
    (6, 1, 1, 1, '2026-05-22 14:01:00-07', '2026-05-31 23:59:00-07'),  -- queen mattress
    (3, 1, 1, 1, '2026-05-19 10:20:00-07', '2026-05-31 23:59:00-07'),  -- dining table
    (4, 1, 1, 1, '2026-05-19 10:21:00-07', '2026-05-31 23:59:00-07'),  -- dining chairs
    (10, 1, 1, 1, '2026-05-19 10:30:00-07', '2026-05-31 23:59:00-07'), -- floor lamp
    (11, 1, 1, 1, '2026-05-19 10:31:00-07', '2026-05-31 23:59:00-07'), -- table lamp
    (12, 1, 1, 1, '2026-05-19 10:35:00-07', '2026-05-31 23:59:00-07'), -- kitchen kit
    (13, 1, 1, 1, '2026-05-22 14:10:00-07', '2026-05-31 23:59:00-07'), -- twin bed 1
    (14, 1, 1, 1, '2026-05-22 14:11:00-07', '2026-05-31 23:59:00-07'); -- twin bed 2

-- Devon Kelley's request — already scheduled for delivery
INSERT INTO tbl_client_provisioning_request
    (client_id, client_request_note, fulfillment_corp_facility_id, request_receipt_origin_id, client_request_creator_facility_staff_id, request_at) VALUES
    (4, 'Single adult, post-recovery housing.', 1, 1, 3, '2026-05-16 09:15:00-07');

INSERT INTO tbl_client_request_items (client_provisioning_request_id, item_category_id, quantity, priority, time_stamp) VALUES
    (2, 9, 1, 'High', '2026-05-16 09:15:00-07'),
    (2, 10, 1, 'High', '2026-05-16 09:15:00-07'),
    (2, 4, 1, 'Medium', '2026-05-16 09:15:00-07'),
    (2, 16, 1, 'Low', '2026-05-16 09:15:00-07');

INSERT INTO tbl_client_deliveries
    (client_provisioning_request_id, facility_staff_id, delivery_date, delivery_status_id, time_arrival_earliest, time_arrival_latest, gate_code) VALUES
    (2, 4, '2026-05-25', 1, '09:00', '11:00', NULL);

INSERT INTO tbl_delivery_staff (client_deliveries_id, facility_staff_id, is_team_lead) VALUES
    (1, 4, true),   -- Tom (volunteer driver) leads
    (1, 5, false);  -- Liz assists

INSERT INTO tbl_delivery_vehicle (client_deliveries_id, delivery_vehicle_type_id, vehicle_id, mileage_start) VALUES
    (1, 1, 2, 42780);  -- Use the Ram ProMaster van

-- ============================================================
-- Demo data — Donation pickup (scheduled)
-- ============================================================
INSERT INTO tbl_donation_pickup
    (donor_id, pickup_address_id, pickup_status_id, scheduled_date, time_window_start, time_window_end, assigned_vehicle_id, assigned_lead_facility_staff_id, access_notes) VALUES
    (2, 11, 2, '2026-05-27', '10:00', '12:00', 1, 4, 'Long driveway. Items in garage. Steep stairs to deck — heavy items only via front door.');

-- ============================================================
-- Demo data — User accounts
-- ============================================================
INSERT INTO tbl_user_account (username, password_hash, facility_staff_id, is_active, created_at) VALUES
    ('jmercer', '$2a$10$placeholder_hash_value_for_demo_only_not_real', 1, true, '2023-03-15 09:00:00-07'),
    ('mbell',   '$2a$10$placeholder_hash_value_for_demo_only_not_real', 2, true, '2022-08-01 09:00:00-07'),
    ('pshah',   '$2a$10$placeholder_hash_value_for_demo_only_not_real', 3, true, '2024-01-10 09:00:00-07');

INSERT INTO tbl_user_account (username, password_hash, agency_contact_id, is_active, created_at) VALUES
    ('kwilson', '$2a$10$placeholder_hash_value_for_demo_only_not_real', 3, true, '2024-04-01 09:00:00-07'),
    ('dmartinez','$2a$10$placeholder_hash_value_for_demo_only_not_real', 1, true, '2024-06-01 09:00:00-07');

COMMIT;
