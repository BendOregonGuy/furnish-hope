--
-- PostgreSQL database dump
--

\restrict qrROHXg6IQciRTgCqveDxe4aIIimBabUBPwKjYu7WapuAc2uFU0MAj2EDVLbcPQ

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_table_access_method = heap;

--
-- Name: lkp_acknowledgement_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_acknowledgement_status (
    acknowledgement_status_id integer NOT NULL,
    acknowledgement_status character varying(50) NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_acknowledgement_status_acknowledgement_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_acknowledgement_status_acknowledgement_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_acknowledgement_status_acknowledgement_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_acknowledgement_status_acknowledgement_status_id_seq OWNED BY public.lkp_acknowledgement_status.acknowledgement_status_id;


--
-- Name: lkp_address_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_address_type (
    address_type_id integer NOT NULL,
    address_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_address_type_address_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_address_type_address_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_address_type_address_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_address_type_address_type_id_seq OWNED BY public.lkp_address_type.address_type_id;


--
-- Name: lkp_agency_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_agency_type (
    agency_type_id integer NOT NULL,
    agency_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_agency_type_agency_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_agency_type_agency_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_agency_type_agency_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_agency_type_agency_type_id_seq OWNED BY public.lkp_agency_type.agency_type_id;


--
-- Name: lkp_attachment_entity_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_attachment_entity_type (
    attachment_entity_type_id integer NOT NULL,
    attachment_entity_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_attachment_entity_type_attachment_entity_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_attachment_entity_type_attachment_entity_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_attachment_entity_type_attachment_entity_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_attachment_entity_type_attachment_entity_type_id_seq OWNED BY public.lkp_attachment_entity_type.attachment_entity_type_id;


--
-- Name: lkp_campaign_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_campaign_status (
    campaign_status_id integer NOT NULL,
    campaign_status character varying(50) NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_campaign_status_campaign_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_campaign_status_campaign_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_campaign_status_campaign_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_campaign_status_campaign_status_id_seq OWNED BY public.lkp_campaign_status.campaign_status_id;


--
-- Name: lkp_campaign_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_campaign_type (
    campaign_type_id integer NOT NULL,
    campaign_type character varying(50) NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_campaign_type_campaign_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_campaign_type_campaign_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_campaign_type_campaign_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_campaign_type_campaign_type_id_seq OWNED BY public.lkp_campaign_type.campaign_type_id;


--
-- Name: lkp_citizen_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_citizen_status (
    citizen_status_id integer NOT NULL,
    citizen_status character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_citizen_status_citizen_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_citizen_status_citizen_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_citizen_status_citizen_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_citizen_status_citizen_status_id_seq OWNED BY public.lkp_citizen_status.citizen_status_id;


--
-- Name: lkp_city; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_city (
    city_id integer NOT NULL,
    county_id integer NOT NULL,
    city character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_city_city_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_city_city_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_city_city_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_city_city_id_seq OWNED BY public.lkp_city.city_id;


--
-- Name: lkp_client_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_client_status (
    client_status_id integer NOT NULL,
    client_status character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_client_status_client_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_client_status_client_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_client_status_client_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_client_status_client_status_id_seq OWNED BY public.lkp_client_status.client_status_id;


--
-- Name: lkp_client_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_client_type (
    client_type_id integer NOT NULL,
    client_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_client_type_client_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_client_type_client_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_client_type_client_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_client_type_client_type_id_seq OWNED BY public.lkp_client_type.client_type_id;


--
-- Name: lkp_communication_method; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_communication_method (
    communication_method_id integer NOT NULL,
    communication_method character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_communication_method_communication_method_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_communication_method_communication_method_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_communication_method_communication_method_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_communication_method_communication_method_id_seq OWNED BY public.lkp_communication_method.communication_method_id;


--
-- Name: lkp_contact_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_contact_type (
    contact_type_id integer NOT NULL,
    contact_type character varying(25) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_contact_type_contact_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_contact_type_contact_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_contact_type_contact_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_contact_type_contact_type_id_seq OWNED BY public.lkp_contact_type.contact_type_id;


--
-- Name: lkp_corp_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_corp_type (
    corp_type_id integer NOT NULL,
    corp_type character varying(25) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_corp_type_corp_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_corp_type_corp_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_corp_type_corp_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_corp_type_corp_type_id_seq OWNED BY public.lkp_corp_type.corp_type_id;


--
-- Name: lkp_county; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_county (
    county_id integer NOT NULL,
    state_id integer NOT NULL,
    county character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_county_county_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_county_county_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_county_county_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_county_county_id_seq OWNED BY public.lkp_county.county_id;


--
-- Name: lkp_delivery_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_delivery_status (
    delivery_status_id integer NOT NULL,
    delivery_status character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_delivery_status_delivery_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_delivery_status_delivery_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_delivery_status_delivery_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_delivery_status_delivery_status_id_seq OWNED BY public.lkp_delivery_status.delivery_status_id;


--
-- Name: lkp_delivery_vehicle_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_delivery_vehicle_type (
    delivery_vehicle_type_id integer NOT NULL,
    delivery_vehicle_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_delivery_vehicle_type_delivery_vehicle_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_delivery_vehicle_type_delivery_vehicle_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_delivery_vehicle_type_delivery_vehicle_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_delivery_vehicle_type_delivery_vehicle_type_id_seq OWNED BY public.lkp_delivery_vehicle_type.delivery_vehicle_type_id;


--
-- Name: lkp_disposition_reason; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_disposition_reason (
    disposition_reason_id integer NOT NULL,
    disposition_reason character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_disposition_reason_disposition_reason_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_disposition_reason_disposition_reason_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_disposition_reason_disposition_reason_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_disposition_reason_disposition_reason_id_seq OWNED BY public.lkp_disposition_reason.disposition_reason_id;


--
-- Name: lkp_donation_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_donation_type (
    donation_type_id integer NOT NULL,
    donation_type character varying(25) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_donation_type_donation_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_donation_type_donation_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_donation_type_donation_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_donation_type_donation_type_id_seq OWNED BY public.lkp_donation_type.donation_type_id;


--
-- Name: lkp_donor_stage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_donor_stage (
    donor_stage_id integer NOT NULL,
    donor_stage character varying(50) NOT NULL,
    stage_order integer DEFAULT 0 NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_donor_stage_donor_stage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_donor_stage_donor_stage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_donor_stage_donor_stage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_donor_stage_donor_stage_id_seq OWNED BY public.lkp_donor_stage.donor_stage_id;


--
-- Name: lkp_donor_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_donor_type (
    donor_type_id integer NOT NULL,
    donor_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_donor_type_donor_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_donor_type_donor_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_donor_type_donor_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_donor_type_donor_type_id_seq OWNED BY public.lkp_donor_type.donor_type_id;


--
-- Name: lkp_ethnicity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_ethnicity (
    ethnicity_id integer NOT NULL,
    ethnicity character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_ethnicity_ethnicity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_ethnicity_ethnicity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_ethnicity_ethnicity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_ethnicity_ethnicity_id_seq OWNED BY public.lkp_ethnicity.ethnicity_id;


--
-- Name: lkp_event_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_event_type (
    event_type_id integer NOT NULL,
    event_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_event_type_event_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_event_type_event_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_event_type_event_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_event_type_event_type_id_seq OWNED BY public.lkp_event_type.event_type_id;


--
-- Name: lkp_facility_staff_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_facility_staff_status (
    facility_staff_status_id integer NOT NULL,
    facility_staff_status character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_facility_staff_status_facility_staff_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_facility_staff_status_facility_staff_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_facility_staff_status_facility_staff_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_facility_staff_status_facility_staff_status_id_seq OWNED BY public.lkp_facility_staff_status.facility_staff_status_id;


--
-- Name: lkp_facility_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_facility_type (
    facility_type_id integer NOT NULL,
    facility_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_facility_type_facility_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_facility_type_facility_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_facility_type_facility_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_facility_type_facility_type_id_seq OWNED BY public.lkp_facility_type.facility_type_id;


--
-- Name: lkp_fund; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_fund (
    fund_id integer NOT NULL,
    fund_name character varying(100) NOT NULL,
    default_restriction_type_id integer,
    is_active boolean DEFAULT true NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_fund_fund_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_fund_fund_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_fund_fund_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_fund_fund_id_seq OWNED BY public.lkp_fund.fund_id;


--
-- Name: lkp_gender; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_gender (
    gender_id integer NOT NULL,
    gender character varying(20) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_gender_gender_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_gender_gender_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_gender_gender_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_gender_gender_id_seq OWNED BY public.lkp_gender.gender_id;


--
-- Name: lkp_howtheyfoundus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_howtheyfoundus (
    howtheyfoundus_id integer NOT NULL,
    howtheyfoundus character varying(50) NOT NULL,
    source_type_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_howtheyfoundus_howtheyfoundus_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_howtheyfoundus_howtheyfoundus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_howtheyfoundus_howtheyfoundus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_howtheyfoundus_howtheyfoundus_id_seq OWNED BY public.lkp_howtheyfoundus.howtheyfoundus_id;


--
-- Name: lkp_item_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_item_category (
    item_category_id integer NOT NULL,
    item_category character varying(100) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_item_category_item_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_item_category_item_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_item_category_item_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_item_category_item_category_id_seq OWNED BY public.lkp_item_category.item_category_id;


--
-- Name: lkp_item_condition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_item_condition (
    item_condition_id integer NOT NULL,
    item_condition character varying(20) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_item_condition_item_condition_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_item_condition_item_condition_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_item_condition_item_condition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_item_condition_item_condition_id_seq OWNED BY public.lkp_item_condition.item_condition_id;


--
-- Name: lkp_item_size; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_item_size (
    item_size_id integer NOT NULL,
    item_size character varying(20) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_item_size_item_size_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_item_size_item_size_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_item_size_item_size_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_item_size_item_size_id_seq OWNED BY public.lkp_item_size.item_size_id;


--
-- Name: lkp_item_weight; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_item_weight (
    item_weight_id integer NOT NULL,
    item_weight character varying(50) NOT NULL,
    weight_lbs_min integer,
    weight_lbs_max integer,
    description character varying(100)
);


--
-- Name: lkp_item_weight_item_weight_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_item_weight_item_weight_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_item_weight_item_weight_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_item_weight_item_weight_id_seq OWNED BY public.lkp_item_weight.item_weight_id;


--
-- Name: lkp_maintenance_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_maintenance_type (
    maintenance_type_id integer NOT NULL,
    maintenance_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_maintenance_type_maintenance_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_maintenance_type_maintenance_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_maintenance_type_maintenance_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_maintenance_type_maintenance_type_id_seq OWNED BY public.lkp_maintenance_type.maintenance_type_id;


--
-- Name: lkp_note_entity_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_note_entity_type (
    note_entity_type_id integer NOT NULL,
    note_entity_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_note_entity_type_note_entity_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_note_entity_type_note_entity_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_note_entity_type_note_entity_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_note_entity_type_note_entity_type_id_seq OWNED BY public.lkp_note_entity_type.note_entity_type_id;


--
-- Name: lkp_payment_method; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_payment_method (
    payment_method_id integer NOT NULL,
    payment_method character varying(50) NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_payment_method_payment_method_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_payment_method_payment_method_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_payment_method_payment_method_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_payment_method_payment_method_id_seq OWNED BY public.lkp_payment_method.payment_method_id;


--
-- Name: lkp_pickup_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_pickup_status (
    pickup_status_id integer NOT NULL,
    pickup_status character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_pickup_status_pickup_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_pickup_status_pickup_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_pickup_status_pickup_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_pickup_status_pickup_status_id_seq OWNED BY public.lkp_pickup_status.pickup_status_id;


--
-- Name: lkp_pledge_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_pledge_status (
    pledge_status_id integer NOT NULL,
    pledge_status character varying(50) NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_pledge_status_pledge_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_pledge_status_pledge_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_pledge_status_pledge_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_pledge_status_pledge_status_id_seq OWNED BY public.lkp_pledge_status.pledge_status_id;


--
-- Name: lkp_rental_agency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_rental_agency (
    rental_agency_id integer NOT NULL,
    rental_agency character varying(100) NOT NULL,
    account_number character varying(25),
    description character varying(100)
);


--
-- Name: lkp_rental_agency_rental_agency_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_rental_agency_rental_agency_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_rental_agency_rental_agency_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_rental_agency_rental_agency_id_seq OWNED BY public.lkp_rental_agency.rental_agency_id;


--
-- Name: lkp_request_receipt_origin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_request_receipt_origin (
    request_receipt_origin_id integer NOT NULL,
    request_receipt_origin character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_request_receipt_origin_request_receipt_origin_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_request_receipt_origin_request_receipt_origin_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_request_receipt_origin_request_receipt_origin_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_request_receipt_origin_request_receipt_origin_id_seq OWNED BY public.lkp_request_receipt_origin.request_receipt_origin_id;


--
-- Name: lkp_reservation_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_reservation_status (
    reservation_status_id integer NOT NULL,
    reservation_status character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_reservation_status_reservation_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_reservation_status_reservation_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_reservation_status_reservation_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_reservation_status_reservation_status_id_seq OWNED BY public.lkp_reservation_status.reservation_status_id;


--
-- Name: lkp_restriction_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_restriction_type (
    restriction_type_id integer NOT NULL,
    restriction_type character varying(50) NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_restriction_type_restriction_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_restriction_type_restriction_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_restriction_type_restriction_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_restriction_type_restriction_type_id_seq OWNED BY public.lkp_restriction_type.restriction_type_id;


--
-- Name: lkp_role_pay_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_role_pay_type (
    role_pay_type_id integer NOT NULL,
    role_pay_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_role_pay_type_role_pay_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_role_pay_type_role_pay_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_role_pay_type_role_pay_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_role_pay_type_role_pay_type_id_seq OWNED BY public.lkp_role_pay_type.role_pay_type_id;


--
-- Name: lkp_shift_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_shift_status (
    shift_status_id integer NOT NULL,
    shift_status character varying(50) NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_shift_status_shift_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_shift_status_shift_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_shift_status_shift_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_shift_status_shift_status_id_seq OWNED BY public.lkp_shift_status.shift_status_id;


--
-- Name: lkp_shift_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_shift_type (
    shift_type_id integer NOT NULL,
    shift_type character varying(50) NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_shift_type_shift_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_shift_type_shift_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_shift_type_shift_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_shift_type_shift_type_id_seq OWNED BY public.lkp_shift_type.shift_type_id;


--
-- Name: lkp_skill; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_skill (
    skill_id integer NOT NULL,
    skill character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_skill_skill_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_skill_skill_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_skill_skill_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_skill_skill_id_seq OWNED BY public.lkp_skill.skill_id;


--
-- Name: lkp_solicitation_method; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_solicitation_method (
    solicitation_method_id integer NOT NULL,
    solicitation_method character varying(50) NOT NULL,
    description character varying(200)
);


--
-- Name: lkp_solicitation_method_solicitation_method_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_solicitation_method_solicitation_method_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_solicitation_method_solicitation_method_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_solicitation_method_solicitation_method_id_seq OWNED BY public.lkp_solicitation_method.solicitation_method_id;


--
-- Name: lkp_source_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_source_type (
    source_type_id integer NOT NULL,
    source_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_source_type_source_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_source_type_source_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_source_type_source_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_source_type_source_type_id_seq OWNED BY public.lkp_source_type.source_type_id;


--
-- Name: lkp_staff_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_staff_role (
    staff_role_id integer NOT NULL,
    staff_role character varying(50) NOT NULL,
    role_pay_type_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_staff_role_staff_role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_staff_role_staff_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_staff_role_staff_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_staff_role_staff_role_id_seq OWNED BY public.lkp_staff_role.staff_role_id;


--
-- Name: lkp_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_state (
    state_id integer NOT NULL,
    state character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_state_state_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_state_state_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_state_state_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_state_state_id_seq OWNED BY public.lkp_state.state_id;


--
-- Name: lkp_status_change_reason; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_status_change_reason (
    status_change_reason_id integer NOT NULL,
    status_change_reason character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_status_change_reason_status_change_reason_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_status_change_reason_status_change_reason_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_status_change_reason_status_change_reason_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_status_change_reason_status_change_reason_id_seq OWNED BY public.lkp_status_change_reason.status_change_reason_id;


--
-- Name: lkp_storage_location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_storage_location (
    storage_location_id integer NOT NULL,
    corp_facility_id integer NOT NULL,
    location_code character varying(20) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_storage_location_storage_location_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_storage_location_storage_location_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_storage_location_storage_location_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_storage_location_storage_location_id_seq OWNED BY public.lkp_storage_location.storage_location_id;


--
-- Name: lkp_vehicle_fuel_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_vehicle_fuel_type (
    vehicle_fuel_type_id integer NOT NULL,
    vehicle_fuel_type character varying(15) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_vehicle_fuel_type_vehicle_fuel_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_vehicle_fuel_type_vehicle_fuel_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_vehicle_fuel_type_vehicle_fuel_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_vehicle_fuel_type_vehicle_fuel_type_id_seq OWNED BY public.lkp_vehicle_fuel_type.vehicle_fuel_type_id;


--
-- Name: lkp_vehicle_make; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_vehicle_make (
    vehicle_make_id integer NOT NULL,
    vehicle_make character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_vehicle_make_vehicle_make_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_vehicle_make_vehicle_make_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_vehicle_make_vehicle_make_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_vehicle_make_vehicle_make_id_seq OWNED BY public.lkp_vehicle_make.vehicle_make_id;


--
-- Name: lkp_vehicle_model; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_vehicle_model (
    vehicle_model_id integer NOT NULL,
    vehicle_make_id integer NOT NULL,
    vehicle_model character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_vehicle_model_vehicle_model_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_vehicle_model_vehicle_model_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_vehicle_model_vehicle_model_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_vehicle_model_vehicle_model_id_seq OWNED BY public.lkp_vehicle_model.vehicle_model_id;


--
-- Name: lkp_vehicle_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_vehicle_type (
    vehicle_type_id integer NOT NULL,
    vehicle_type character varying(50) NOT NULL,
    vehicle_weight_class_id integer NOT NULL,
    vehicle_fuel_type_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_vehicle_type_vehicle_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_vehicle_type_vehicle_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_vehicle_type_vehicle_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_vehicle_type_vehicle_type_id_seq OWNED BY public.lkp_vehicle_type.vehicle_type_id;


--
-- Name: lkp_vehicle_weight_class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_vehicle_weight_class (
    vehicle_weight_class_id integer NOT NULL,
    vehicle_weight_class character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_vehicle_weight_class_vehicle_weight_class_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_vehicle_weight_class_vehicle_weight_class_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_vehicle_weight_class_vehicle_weight_class_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_vehicle_weight_class_vehicle_weight_class_id_seq OWNED BY public.lkp_vehicle_weight_class.vehicle_weight_class_id;


--
-- Name: lkp_volunteer_activity_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lkp_volunteer_activity_type (
    volunteer_activity_type_id integer NOT NULL,
    volunteer_activity_type character varying(50) NOT NULL,
    description character varying(100)
);


--
-- Name: lkp_volunteer_activity_type_volunteer_activity_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lkp_volunteer_activity_type_volunteer_activity_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lkp_volunteer_activity_type_volunteer_activity_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lkp_volunteer_activity_type_volunteer_activity_type_id_seq OWNED BY public.lkp_volunteer_activity_type.volunteer_activity_type_id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: tbl_address; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_address (
    address_id integer NOT NULL,
    address_name character varying(50) NOT NULL,
    address_type_id integer NOT NULL,
    address character varying(100) NOT NULL,
    address2 character varying(50),
    city_id integer NOT NULL,
    county_id integer NOT NULL,
    state_id integer NOT NULL,
    postalcode character varying(10) NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_address_address_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_address_address_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_address_address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_address_address_id_seq OWNED BY public.tbl_address.address_id;


--
-- Name: tbl_agency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_agency (
    agency_id integer NOT NULL,
    agency_name character varying(100) NOT NULL,
    address_id integer NOT NULL,
    agency_type_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_agency_agency_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_agency_agency_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_agency_agency_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_agency_agency_id_seq OWNED BY public.tbl_agency.agency_id;


--
-- Name: tbl_agency_contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_agency_contact (
    agency_contact_id integer NOT NULL,
    agency_id integer NOT NULL,
    contact_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_agency_contact_agency_contact_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_agency_contact_agency_contact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_agency_contact_agency_contact_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_agency_contact_agency_contact_id_seq OWNED BY public.tbl_agency_contact.agency_contact_id;


--
-- Name: tbl_app_setting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_app_setting (
    setting_key character varying(50) NOT NULL,
    setting_value text NOT NULL,
    description character varying(200),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_user_account_id integer
);


--
-- Name: tbl_attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_attachment (
    attachment_id integer NOT NULL,
    attachment_entity_type_id integer NOT NULL,
    entity_id integer NOT NULL,
    file_url character varying(255) NOT NULL,
    file_name character varying(100),
    mime_type character varying(50),
    uploaded_by_facility_staff_id integer NOT NULL,
    uploaded_at timestamp with time zone NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_attachment_attachment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_attachment_attachment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_attachment_attachment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_attachment_attachment_id_seq OWNED BY public.tbl_attachment.attachment_id;


--
-- Name: tbl_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_audit_log (
    audit_log_id integer NOT NULL,
    user_account_id integer NOT NULL,
    action character varying(20) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer NOT NULL,
    field_changed character varying(100),
    old_value text,
    new_value text,
    action_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tbl_audit_log_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_audit_log_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_audit_log_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_audit_log_audit_log_id_seq OWNED BY public.tbl_audit_log.audit_log_id;


--
-- Name: tbl_campaign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_campaign (
    campaign_id integer NOT NULL,
    campaign_name character varying(150) NOT NULL,
    campaign_type_id integer NOT NULL,
    campaign_status_id integer NOT NULL,
    fund_id integer,
    goal_amount numeric(12,2),
    start_date date,
    end_date date,
    manager_facility_staff_id integer,
    public_url character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_account_id integer,
    description character varying(100)
);


--
-- Name: tbl_campaign_campaign_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_campaign_campaign_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_campaign_campaign_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_campaign_campaign_id_seq OWNED BY public.tbl_campaign.campaign_id;


--
-- Name: tbl_client; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_client (
    client_id integer NOT NULL,
    client_type_id integer NOT NULL,
    contact_id integer NOT NULL,
    start_date date,
    client_status_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_client_client_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_client_client_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_client_client_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_client_client_id_seq OWNED BY public.tbl_client.client_id;


--
-- Name: tbl_client_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_client_deliveries (
    client_deliveries_id integer NOT NULL,
    client_provisioning_request_id integer NOT NULL,
    facility_staff_id integer NOT NULL,
    delivery_date date NOT NULL,
    delivery_status_id integer NOT NULL,
    time_arrival_earliest time without time zone,
    time_arrival_latest time without time zone,
    time_delivery_complete time without time zone,
    notes text,
    gate_code character varying(10),
    description character varying(100)
);


--
-- Name: tbl_client_deliveries_client_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_client_deliveries_client_deliveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_client_deliveries_client_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_client_deliveries_client_deliveries_id_seq OWNED BY public.tbl_client_deliveries.client_deliveries_id;


--
-- Name: tbl_client_provisioning_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_client_provisioning_request (
    client_provisioning_request_id integer NOT NULL,
    client_id integer NOT NULL,
    client_request_note text,
    fulfillment_corp_facility_id integer NOT NULL,
    request_receipt_origin_id integer NOT NULL,
    client_request_creator_facility_staff_id integer NOT NULL,
    request_at timestamp with time zone NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_client_provisioning_reque_client_provisioning_request_i_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_client_provisioning_reque_client_provisioning_request_i_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_client_provisioning_reque_client_provisioning_request_i_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_client_provisioning_reque_client_provisioning_request_i_seq OWNED BY public.tbl_client_provisioning_request.client_provisioning_request_id;


--
-- Name: tbl_client_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_client_request_items (
    client_request_items_id integer NOT NULL,
    client_provisioning_request_id integer NOT NULL,
    item_category_id integer NOT NULL,
    item_notes character varying(255),
    quantity integer NOT NULL,
    priority character varying(20),
    description character varying(100),
    time_stamp timestamp with time zone NOT NULL
);


--
-- Name: tbl_client_request_items_client_request_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_client_request_items_client_request_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_client_request_items_client_request_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_client_request_items_client_request_items_id_seq OWNED BY public.tbl_client_request_items.client_request_items_id;


--
-- Name: tbl_communication_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_communication_log (
    communication_log_id integer NOT NULL,
    note_entity_type_id integer NOT NULL,
    entity_id integer NOT NULL,
    communication_method_id integer NOT NULL,
    facility_staff_id integer NOT NULL,
    communication_at timestamp with time zone NOT NULL,
    summary text NOT NULL,
    follow_up_needed boolean NOT NULL,
    follow_up_date date,
    description character varying(100)
);


--
-- Name: tbl_communication_log_communication_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_communication_log_communication_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_communication_log_communication_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_communication_log_communication_log_id_seq OWNED BY public.tbl_communication_log.communication_log_id;


--
-- Name: tbl_contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_contact (
    contact_id integer NOT NULL,
    contact_type_id integer NOT NULL,
    first_name character varying(50) NOT NULL,
    middle_name character varying(50),
    last_name character varying(50) NOT NULL,
    gender_id integer,
    ethnicity_id integer,
    birth_date date,
    citizen_status_id integer,
    address_id integer,
    mobile_phone character varying(20),
    home_phone character varying(20),
    other_phone character varying(20),
    email character varying(100),
    description character varying(100)
);


--
-- Name: tbl_contact_contact_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_contact_contact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_contact_contact_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_contact_contact_id_seq OWNED BY public.tbl_contact.contact_id;


--
-- Name: tbl_corp_facility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_corp_facility (
    corp_facility_id integer NOT NULL,
    corporate_id integer NOT NULL,
    facility_name character varying(100) NOT NULL,
    contact_id integer,
    address_id integer NOT NULL,
    facility_type_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_corp_facility_corp_facility_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_corp_facility_corp_facility_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_corp_facility_corp_facility_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_corp_facility_corp_facility_id_seq OWNED BY public.tbl_corp_facility.corp_facility_id;


--
-- Name: tbl_corp_facility_inventory_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_corp_facility_inventory_item (
    corp_facility_inventory_item_id integer NOT NULL,
    corp_facility_id integer NOT NULL,
    donation_item_id integer,
    storage_location_id integer,
    item_category_id integer NOT NULL,
    item_size_id integer NOT NULL,
    item_weight_id integer NOT NULL,
    item_condition_id integer NOT NULL,
    date_added_to_inventory date NOT NULL,
    date_dispositioned date,
    disposition_reason_id integer,
    donation_value_in numeric(12,2) NOT NULL,
    donation_value_out numeric(12,2),
    description character varying(100)
);


--
-- Name: tbl_corp_facility_inventory_i_corp_facility_inventory_item__seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_corp_facility_inventory_i_corp_facility_inventory_item__seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_corp_facility_inventory_i_corp_facility_inventory_item__seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_corp_facility_inventory_i_corp_facility_inventory_item__seq OWNED BY public.tbl_corp_facility_inventory_item.corp_facility_inventory_item_id;


--
-- Name: tbl_corporate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_corporate (
    corporate_id integer NOT NULL,
    corp_type_id integer NOT NULL,
    corp_name character varying(100) NOT NULL,
    fed_tax_id character varying(20),
    incorp_state_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_corporate_corporate_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_corporate_corporate_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_corporate_corporate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_corporate_corporate_id_seq OWNED BY public.tbl_corporate.corporate_id;


--
-- Name: tbl_delivery_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_delivery_items (
    delivery_items_id integer NOT NULL,
    client_deliveries_id integer NOT NULL,
    corp_facility_inventory_item_id integer NOT NULL,
    loaded_at timestamp with time zone,
    description character varying(100)
);


--
-- Name: tbl_delivery_items_delivery_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_delivery_items_delivery_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_delivery_items_delivery_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_delivery_items_delivery_items_id_seq OWNED BY public.tbl_delivery_items.delivery_items_id;


--
-- Name: tbl_delivery_receipt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_delivery_receipt (
    delivery_receipt_id integer NOT NULL,
    client_deliveries_id integer NOT NULL,
    signature_photo_url character varying(255),
    signed_at timestamp with time zone NOT NULL,
    all_items_received boolean NOT NULL,
    condition_acceptable boolean NOT NULL,
    photo_release_granted boolean NOT NULL,
    recipient_notes text,
    description character varying(100)
);


--
-- Name: tbl_delivery_receipt_delivery_receipt_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_delivery_receipt_delivery_receipt_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_delivery_receipt_delivery_receipt_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_delivery_receipt_delivery_receipt_id_seq OWNED BY public.tbl_delivery_receipt.delivery_receipt_id;


--
-- Name: tbl_delivery_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_delivery_staff (
    delivery_staff_id integer NOT NULL,
    client_deliveries_id integer NOT NULL,
    facility_staff_id integer NOT NULL,
    is_team_lead boolean NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_delivery_staff_delivery_staff_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_delivery_staff_delivery_staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_delivery_staff_delivery_staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_delivery_staff_delivery_staff_id_seq OWNED BY public.tbl_delivery_staff.delivery_staff_id;


--
-- Name: tbl_delivery_vehicle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_delivery_vehicle (
    delivery_vehicle_id integer NOT NULL,
    client_deliveries_id integer NOT NULL,
    delivery_vehicle_type_id integer NOT NULL,
    vehicle_id integer,
    rental_agency_id integer,
    mileage_start integer,
    mileage_end integer,
    fuel_cost numeric(12,2),
    description character varying(100)
);


--
-- Name: tbl_delivery_vehicle_delivery_vehicle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_delivery_vehicle_delivery_vehicle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_delivery_vehicle_delivery_vehicle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_delivery_vehicle_delivery_vehicle_id_seq OWNED BY public.tbl_delivery_vehicle.delivery_vehicle_id;


--
-- Name: tbl_donation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_donation (
    donation_id integer NOT NULL,
    donor_id integer NOT NULL,
    donation_type_id integer NOT NULL,
    donation_date date NOT NULL,
    total_value numeric(12,2),
    receipt_sent_date date,
    description character varying(100),
    payment_method_id integer,
    solicitation_method_id integer,
    tax_deductible_amount numeric(12,2),
    acknowledgement_status_id integer,
    acknowledgement_sent_date date,
    receipt_number character varying(50),
    pledge_id integer,
    soft_credit_contact_id integer,
    gift_in_honor_of text,
    external_transaction_id character varying(100),
    received_via character varying(50),
    campaign_id integer,
    qbo_sync_status character varying(20),
    qbo_transaction_id character varying(50),
    qbo_last_synced_at timestamp with time zone,
    qbo_current_sync_id integer,
    qbo_synced_at timestamp with time zone
);


--
-- Name: tbl_donation_check; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_donation_check (
    donation_check_id integer NOT NULL,
    donation_id integer NOT NULL,
    check_number character varying(20),
    check_date date,
    bank_name character varying(100)
);


--
-- Name: tbl_donation_check_donation_check_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_donation_check_donation_check_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_donation_check_donation_check_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_donation_check_donation_check_id_seq OWNED BY public.tbl_donation_check.donation_check_id;


--
-- Name: tbl_donation_designation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_donation_designation (
    donation_designation_id integer NOT NULL,
    donation_id integer NOT NULL,
    fund_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_donation_designation_donation_designation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_donation_designation_donation_designation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_donation_designation_donation_designation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_donation_designation_donation_designation_id_seq OWNED BY public.tbl_donation_designation.donation_designation_id;


--
-- Name: tbl_donation_donation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_donation_donation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_donation_donation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_donation_donation_id_seq OWNED BY public.tbl_donation.donation_id;


--
-- Name: tbl_donation_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_donation_item (
    donation_item_id integer NOT NULL,
    donation_id integer NOT NULL,
    item_description character varying(100) NOT NULL,
    item_category_id integer NOT NULL,
    item_condition_id integer NOT NULL,
    item_size_id integer NOT NULL,
    item_photo_url character varying(255),
    description character varying(100)
);


--
-- Name: tbl_donation_item_donation_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_donation_item_donation_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_donation_item_donation_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_donation_item_donation_item_id_seq OWNED BY public.tbl_donation_item.donation_item_id;


--
-- Name: tbl_donation_pickup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_donation_pickup (
    donation_pickup_id integer NOT NULL,
    donor_id integer NOT NULL,
    pickup_address_id integer NOT NULL,
    pickup_status_id integer NOT NULL,
    scheduled_date date NOT NULL,
    time_window_start time without time zone,
    time_window_end time without time zone,
    assigned_vehicle_id integer,
    assigned_lead_facility_staff_id integer,
    access_notes text,
    description character varying(100)
);


--
-- Name: tbl_donation_pickup_donation_pickup_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_donation_pickup_donation_pickup_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_donation_pickup_donation_pickup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_donation_pickup_donation_pickup_id_seq OWNED BY public.tbl_donation_pickup.donation_pickup_id;


--
-- Name: tbl_donation_securities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_donation_securities (
    donation_securities_id integer NOT NULL,
    donation_id integer NOT NULL,
    security_type character varying(20) NOT NULL,
    ticker character varying(20),
    security_description character varying(200),
    shares numeric(15,4),
    gift_date_fmv numeric(12,2),
    sale_proceeds numeric(12,2),
    broker_name character varying(100)
);


--
-- Name: tbl_donation_securities_donation_securities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_donation_securities_donation_securities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_donation_securities_donation_securities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_donation_securities_donation_securities_id_seq OWNED BY public.tbl_donation_securities.donation_securities_id;


--
-- Name: tbl_donor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_donor (
    donor_id integer NOT NULL,
    donor_type_id integer NOT NULL,
    contact_id integer NOT NULL,
    address_id integer NOT NULL,
    howtheyfoundus_id integer NOT NULL,
    is_recurring boolean NOT NULL,
    description character varying(100),
    donor_advised_fund_name character varying(100),
    employer_match_eligible boolean DEFAULT false NOT NULL,
    do_not_contact boolean DEFAULT false NOT NULL,
    preferred_contact_method_id integer,
    donor_stage_id integer,
    stage_notes text,
    stage_updated_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL
);


--
-- Name: tbl_donor_donor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_donor_donor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_donor_donor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_donor_donor_id_seq OWNED BY public.tbl_donor.donor_id;


--
-- Name: tbl_email_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_email_account (
    email_account_id integer NOT NULL,
    user_account_id integer NOT NULL,
    display_name character varying(100),
    email_address character varying(255) NOT NULL,
    provider character varying(20) NOT NULL,
    auth_type character varying(20) DEFAULT 'password'::character varying NOT NULL,
    imap_host character varying(255),
    imap_port integer,
    imap_secure boolean DEFAULT true NOT NULL,
    smtp_host character varying(255),
    smtp_port integer,
    smtp_secure boolean DEFAULT true NOT NULL,
    username character varying(255),
    encrypted_password text,
    is_default_send boolean DEFAULT false NOT NULL,
    last_tested_at timestamp with time zone,
    last_test_status character varying(20),
    last_test_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_email_account_email_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_email_account_email_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_email_account_email_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_email_account_email_account_id_seq OWNED BY public.tbl_email_account.email_account_id;


--
-- Name: tbl_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_event (
    event_id integer NOT NULL,
    event_type_id integer NOT NULL,
    event_name character varying(100) NOT NULL,
    event_date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    address_id integer,
    goal_amount numeric(12,2),
    amount_raised numeric(12,2),
    description character varying(100),
    campaign_id integer,
    is_public boolean DEFAULT false NOT NULL,
    ticket_price numeric(12,2),
    notes text
);


--
-- Name: tbl_event_attendee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_event_attendee (
    event_attendee_id integer NOT NULL,
    event_id integer NOT NULL,
    contact_id integer NOT NULL,
    rsvp_status character varying(20),
    attended boolean,
    amount_contributed numeric(12,2),
    description character varying(100),
    checked_in_at timestamp with time zone,
    ticket_count integer DEFAULT 1 NOT NULL,
    notes text
);


--
-- Name: tbl_event_attendee_event_attendee_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_event_attendee_event_attendee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_event_attendee_event_attendee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_event_attendee_event_attendee_id_seq OWNED BY public.tbl_event_attendee.event_attendee_id;


--
-- Name: tbl_event_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_event_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_event_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_event_event_id_seq OWNED BY public.tbl_event.event_id;


--
-- Name: tbl_facility_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_facility_staff (
    facility_staff_id integer NOT NULL,
    corp_facility_id integer NOT NULL,
    contact_id integer NOT NULL,
    is_volunteer boolean NOT NULL,
    hire_date date,
    description character varying(100)
);


--
-- Name: tbl_facility_staff_facility_staff_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_facility_staff_facility_staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_facility_staff_facility_staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_facility_staff_facility_staff_id_seq OWNED BY public.tbl_facility_staff.facility_staff_id;


--
-- Name: tbl_facility_staff_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_facility_staff_statuses (
    facility_staff_statuses_id integer NOT NULL,
    facility_staff_id integer NOT NULL,
    facility_staff_status_id integer NOT NULL,
    status_date_changed date NOT NULL,
    changed_by_facility_staff_id integer NOT NULL,
    status_change_reason_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_facility_staff_statuses_facility_staff_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_facility_staff_statuses_facility_staff_statuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_facility_staff_statuses_facility_staff_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_facility_staff_statuses_facility_staff_statuses_id_seq OWNED BY public.tbl_facility_staff_statuses.facility_staff_statuses_id;


--
-- Name: tbl_grant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_grant (
    grant_id integer NOT NULL,
    funder_name character varying(100) NOT NULL,
    grant_name character varying(100) NOT NULL,
    award_amount numeric(12,2) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    reporting_deadline date,
    restrictions text,
    description character varying(100)
);


--
-- Name: tbl_grant_grant_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_grant_grant_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_grant_grant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_grant_grant_id_seq OWNED BY public.tbl_grant.grant_id;


--
-- Name: tbl_inventory_reservation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_inventory_reservation (
    inventory_reservation_id integer NOT NULL,
    corp_facility_inventory_item_id integer NOT NULL,
    client_provisioning_request_id integer NOT NULL,
    reservation_status_id integer NOT NULL,
    reserved_by_facility_staff_id integer NOT NULL,
    reserved_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone,
    released_at timestamp with time zone,
    description character varying(100)
);


--
-- Name: tbl_inventory_reservation_inventory_reservation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_inventory_reservation_inventory_reservation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_inventory_reservation_inventory_reservation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_inventory_reservation_inventory_reservation_id_seq OWNED BY public.tbl_inventory_reservation.inventory_reservation_id;


--
-- Name: tbl_note; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_note (
    note_id integer NOT NULL,
    note_entity_type_id integer NOT NULL,
    entity_id integer NOT NULL,
    author_facility_staff_id integer NOT NULL,
    note_body text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_note_note_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_note_note_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_note_note_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_note_note_id_seq OWNED BY public.tbl_note.note_id;


--
-- Name: tbl_pledge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_pledge (
    pledge_id integer NOT NULL,
    donor_id integer NOT NULL,
    fund_id integer,
    total_pledged_amount numeric(12,2) NOT NULL,
    amount_fulfilled numeric(12,2) DEFAULT 0 NOT NULL,
    pledge_date date NOT NULL,
    expected_fulfillment_date date,
    pledge_status_id integer NOT NULL,
    solicitation_method_id integer,
    campaign_id integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_account_id integer,
    description character varying(100)
);


--
-- Name: tbl_pledge_pledge_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_pledge_pledge_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_pledge_pledge_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_pledge_pledge_id_seq OWNED BY public.tbl_pledge.pledge_id;


--
-- Name: tbl_quickbooks_account_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_quickbooks_account_mapping (
    mapping_id integer NOT NULL,
    fund_id integer,
    qbo_account_id character varying(50) NOT NULL,
    qbo_account_name character varying(255) NOT NULL,
    qbo_account_type character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_account_id integer,
    updated_at timestamp with time zone
);


--
-- Name: tbl_quickbooks_account_mapping_mapping_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_quickbooks_account_mapping_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_quickbooks_account_mapping_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_quickbooks_account_mapping_mapping_id_seq OWNED BY public.tbl_quickbooks_account_mapping.mapping_id;


--
-- Name: tbl_quickbooks_connection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_quickbooks_connection (
    qbo_connection_id integer NOT NULL,
    realm_id character varying(50) NOT NULL,
    environment character varying(20) DEFAULT 'production'::character varying NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text NOT NULL,
    access_token_expires_at timestamp with time zone NOT NULL,
    refresh_token_expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    connected_by_user_account_id integer,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_sync_at timestamp with time zone,
    last_refresh_at timestamp with time zone,
    disconnected_at timestamp with time zone,
    description character varying(200)
);


--
-- Name: tbl_quickbooks_connection_qbo_connection_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_quickbooks_connection_qbo_connection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_quickbooks_connection_qbo_connection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_quickbooks_connection_qbo_connection_id_seq OWNED BY public.tbl_quickbooks_connection.qbo_connection_id;


--
-- Name: tbl_quickbooks_donation_sync; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_quickbooks_donation_sync (
    sync_id integer NOT NULL,
    donation_id integer NOT NULL,
    qbo_sales_receipt_id character varying(50),
    sync_status character varying(20) NOT NULL,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    synced_at timestamp with time zone,
    attempted_by_user_account_id integer,
    error_message text,
    payload_summary text
);


--
-- Name: tbl_quickbooks_donation_sync_sync_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_quickbooks_donation_sync_sync_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_quickbooks_donation_sync_sync_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_quickbooks_donation_sync_sync_id_seq OWNED BY public.tbl_quickbooks_donation_sync.sync_id;


--
-- Name: tbl_quickbooks_donor_link; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_quickbooks_donor_link (
    donor_link_id integer NOT NULL,
    donor_id integer NOT NULL,
    qbo_customer_id character varying(50) NOT NULL,
    qbo_customer_display_name character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone
);


--
-- Name: tbl_quickbooks_donor_link_donor_link_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_quickbooks_donor_link_donor_link_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_quickbooks_donor_link_donor_link_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_quickbooks_donor_link_donor_link_id_seq OWNED BY public.tbl_quickbooks_donor_link.donor_link_id;


--
-- Name: tbl_receipt_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_receipt_counter (
    fiscal_year integer NOT NULL,
    next_number integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tbl_referral; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_referral (
    referral_id integer NOT NULL,
    agency_contact_id integer NOT NULL,
    client_id integer NOT NULL,
    referral_date date NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_referral_referral_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_referral_referral_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_referral_referral_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_referral_referral_id_seq OWNED BY public.tbl_referral.referral_id;


--
-- Name: tbl_request_item_inv_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_request_item_inv_matches (
    request_item_inv_matches_id integer NOT NULL,
    client_request_items_id integer NOT NULL,
    corp_facility_inventory_item_id integer NOT NULL,
    item_selected boolean NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_request_item_inv_matches_request_item_inv_matches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_request_item_inv_matches_request_item_inv_matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_request_item_inv_matches_request_item_inv_matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_request_item_inv_matches_request_item_inv_matches_id_seq OWNED BY public.tbl_request_item_inv_matches.request_item_inv_matches_id;


--
-- Name: tbl_staff_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_staff_type (
    staff_type_id integer NOT NULL,
    staff_type character varying(50) NOT NULL,
    staff_role_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_staff_type_staff_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_staff_type_staff_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_staff_type_staff_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_staff_type_staff_type_id_seq OWNED BY public.tbl_staff_type.staff_type_id;


--
-- Name: tbl_staff_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_staff_types (
    staff_types_id integer NOT NULL,
    facility_staff_id integer NOT NULL,
    staff_type_id integer NOT NULL,
    date_changed date NOT NULL,
    date_effective date NOT NULL,
    is_active boolean NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_staff_types_staff_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_staff_types_staff_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_staff_types_staff_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_staff_types_staff_types_id_seq OWNED BY public.tbl_staff_types.staff_types_id;


--
-- Name: tbl_user_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_user_account (
    user_account_id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    facility_staff_id integer,
    agency_contact_id integer,
    last_login_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description character varying(100),
    is_admin boolean DEFAULT false NOT NULL
);


--
-- Name: tbl_user_account_user_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_user_account_user_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_user_account_user_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_user_account_user_account_id_seq OWNED BY public.tbl_user_account.user_account_id;


--
-- Name: tbl_vehicle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_vehicle (
    vehicle_id integer NOT NULL,
    corp_facility_id integer,
    vehicle_make_id integer NOT NULL,
    vehicle_model_id integer NOT NULL,
    model_year integer NOT NULL,
    vehicle_type_id integer NOT NULL,
    vehicle_license character varying(15),
    description character varying(100)
);


--
-- Name: tbl_vehicle_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_vehicle_maintenance (
    vehicle_maintenance_id integer NOT NULL,
    vehicle_id integer NOT NULL,
    maintenance_type_id integer NOT NULL,
    service_date date NOT NULL,
    vendor character varying(100),
    cost numeric(12,2),
    next_due_date date,
    notes text,
    description character varying(100)
);


--
-- Name: tbl_vehicle_maintenance_vehicle_maintenance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_vehicle_maintenance_vehicle_maintenance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_vehicle_maintenance_vehicle_maintenance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_vehicle_maintenance_vehicle_maintenance_id_seq OWNED BY public.tbl_vehicle_maintenance.vehicle_maintenance_id;


--
-- Name: tbl_vehicle_mileage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_vehicle_mileage (
    vehicle_mileage_id integer NOT NULL,
    vehicle_id integer NOT NULL,
    date_recorded date NOT NULL,
    mileage integer NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_vehicle_mileage_vehicle_mileage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_vehicle_mileage_vehicle_mileage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_vehicle_mileage_vehicle_mileage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_vehicle_mileage_vehicle_mileage_id_seq OWNED BY public.tbl_vehicle_mileage.vehicle_mileage_id;


--
-- Name: tbl_vehicle_vehicle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_vehicle_vehicle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_vehicle_vehicle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_vehicle_vehicle_id_seq OWNED BY public.tbl_vehicle.vehicle_id;


--
-- Name: tbl_volunteer_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_volunteer_hours (
    volunteer_hours_id integer NOT NULL,
    facility_staff_id integer NOT NULL,
    volunteer_activity_type_id integer NOT NULL,
    activity_date date NOT NULL,
    hours_logged numeric(5,2) NOT NULL,
    verified_by_facility_staff_id integer,
    notes text,
    description character varying(100)
);


--
-- Name: tbl_volunteer_hours_volunteer_hours_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_volunteer_hours_volunteer_hours_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_volunteer_hours_volunteer_hours_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_volunteer_hours_volunteer_hours_id_seq OWNED BY public.tbl_volunteer_hours.volunteer_hours_id;


--
-- Name: tbl_volunteer_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_volunteer_profile (
    volunteer_profile_id integer NOT NULL,
    facility_staff_id integer NOT NULL,
    waiver_signed boolean NOT NULL,
    waiver_signed_date date,
    waiver_version character varying(20),
    background_check_status character varying(50),
    background_check_expiration date,
    emergency_contact_name character varying(100),
    emergency_contact_phone character varying(20),
    t_shirt_size character varying(10),
    description character varying(100)
);


--
-- Name: tbl_volunteer_profile_volunteer_profile_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_volunteer_profile_volunteer_profile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_volunteer_profile_volunteer_profile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_volunteer_profile_volunteer_profile_id_seq OWNED BY public.tbl_volunteer_profile.volunteer_profile_id;


--
-- Name: tbl_volunteer_shift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_volunteer_shift (
    shift_id integer NOT NULL,
    shift_type_id integer NOT NULL,
    shift_status_id integer NOT NULL,
    corp_facility_id integer,
    shift_name character varying(120),
    shift_date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    capacity_needed integer DEFAULT 1 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_account_id integer
);


--
-- Name: tbl_volunteer_shift_shift_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_volunteer_shift_shift_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_volunteer_shift_shift_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_volunteer_shift_shift_id_seq OWNED BY public.tbl_volunteer_shift.shift_id;


--
-- Name: tbl_volunteer_shift_signup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_volunteer_shift_signup (
    signup_id integer NOT NULL,
    shift_id integer NOT NULL,
    facility_staff_id integer NOT NULL,
    signup_status character varying(20) DEFAULT 'signed_up'::character varying NOT NULL,
    hours_logged numeric(5,2),
    notes character varying(200),
    signed_up_at timestamp with time zone DEFAULT now() NOT NULL,
    signed_up_by_user_account_id integer
);


--
-- Name: tbl_volunteer_shift_signup_signup_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_volunteer_shift_signup_signup_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_volunteer_shift_signup_signup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_volunteer_shift_signup_signup_id_seq OWNED BY public.tbl_volunteer_shift_signup.signup_id;


--
-- Name: tbl_volunteer_skill; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbl_volunteer_skill (
    volunteer_skill_id integer NOT NULL,
    facility_staff_id integer NOT NULL,
    skill_id integer NOT NULL,
    description character varying(100)
);


--
-- Name: tbl_volunteer_skill_volunteer_skill_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbl_volunteer_skill_volunteer_skill_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbl_volunteer_skill_volunteer_skill_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbl_volunteer_skill_volunteer_skill_id_seq OWNED BY public.tbl_volunteer_skill.volunteer_skill_id;


--
-- Name: lkp_acknowledgement_status acknowledgement_status_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_acknowledgement_status ALTER COLUMN acknowledgement_status_id SET DEFAULT nextval('public.lkp_acknowledgement_status_acknowledgement_status_id_seq'::regclass);


--
-- Name: lkp_address_type address_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_address_type ALTER COLUMN address_type_id SET DEFAULT nextval('public.lkp_address_type_address_type_id_seq'::regclass);


--
-- Name: lkp_agency_type agency_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_agency_type ALTER COLUMN agency_type_id SET DEFAULT nextval('public.lkp_agency_type_agency_type_id_seq'::regclass);


--
-- Name: lkp_attachment_entity_type attachment_entity_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_attachment_entity_type ALTER COLUMN attachment_entity_type_id SET DEFAULT nextval('public.lkp_attachment_entity_type_attachment_entity_type_id_seq'::regclass);


--
-- Name: lkp_campaign_status campaign_status_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_campaign_status ALTER COLUMN campaign_status_id SET DEFAULT nextval('public.lkp_campaign_status_campaign_status_id_seq'::regclass);


--
-- Name: lkp_campaign_type campaign_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_campaign_type ALTER COLUMN campaign_type_id SET DEFAULT nextval('public.lkp_campaign_type_campaign_type_id_seq'::regclass);


--
-- Name: lkp_citizen_status citizen_status_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_citizen_status ALTER COLUMN citizen_status_id SET DEFAULT nextval('public.lkp_citizen_status_citizen_status_id_seq'::regclass);


--
-- Name: lkp_city city_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_city ALTER COLUMN city_id SET DEFAULT nextval('public.lkp_city_city_id_seq'::regclass);


--
-- Name: lkp_client_status client_status_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_client_status ALTER COLUMN client_status_id SET DEFAULT nextval('public.lkp_client_status_client_status_id_seq'::regclass);


--
-- Name: lkp_client_type client_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_client_type ALTER COLUMN client_type_id SET DEFAULT nextval('public.lkp_client_type_client_type_id_seq'::regclass);


--
-- Name: lkp_communication_method communication_method_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_communication_method ALTER COLUMN communication_method_id SET DEFAULT nextval('public.lkp_communication_method_communication_method_id_seq'::regclass);


--
-- Name: lkp_contact_type contact_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_contact_type ALTER COLUMN contact_type_id SET DEFAULT nextval('public.lkp_contact_type_contact_type_id_seq'::regclass);


--
-- Name: lkp_corp_type corp_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_corp_type ALTER COLUMN corp_type_id SET DEFAULT nextval('public.lkp_corp_type_corp_type_id_seq'::regclass);


--
-- Name: lkp_county county_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_county ALTER COLUMN county_id SET DEFAULT nextval('public.lkp_county_county_id_seq'::regclass);


--
-- Name: lkp_delivery_status delivery_status_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_delivery_status ALTER COLUMN delivery_status_id SET DEFAULT nextval('public.lkp_delivery_status_delivery_status_id_seq'::regclass);


--
-- Name: lkp_delivery_vehicle_type delivery_vehicle_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_delivery_vehicle_type ALTER COLUMN delivery_vehicle_type_id SET DEFAULT nextval('public.lkp_delivery_vehicle_type_delivery_vehicle_type_id_seq'::regclass);


--
-- Name: lkp_disposition_reason disposition_reason_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_disposition_reason ALTER COLUMN disposition_reason_id SET DEFAULT nextval('public.lkp_disposition_reason_disposition_reason_id_seq'::regclass);


--
-- Name: lkp_donation_type donation_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_donation_type ALTER COLUMN donation_type_id SET DEFAULT nextval('public.lkp_donation_type_donation_type_id_seq'::regclass);


--
-- Name: lkp_donor_stage donor_stage_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_donor_stage ALTER COLUMN donor_stage_id SET DEFAULT nextval('public.lkp_donor_stage_donor_stage_id_seq'::regclass);


--
-- Name: lkp_donor_type donor_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_donor_type ALTER COLUMN donor_type_id SET DEFAULT nextval('public.lkp_donor_type_donor_type_id_seq'::regclass);


--
-- Name: lkp_ethnicity ethnicity_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_ethnicity ALTER COLUMN ethnicity_id SET DEFAULT nextval('public.lkp_ethnicity_ethnicity_id_seq'::regclass);


--
-- Name: lkp_event_type event_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_event_type ALTER COLUMN event_type_id SET DEFAULT nextval('public.lkp_event_type_event_type_id_seq'::regclass);


--
-- Name: lkp_facility_staff_status facility_staff_status_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_facility_staff_status ALTER COLUMN facility_staff_status_id SET DEFAULT nextval('public.lkp_facility_staff_status_facility_staff_status_id_seq'::regclass);


--
-- Name: lkp_facility_type facility_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_facility_type ALTER COLUMN facility_type_id SET DEFAULT nextval('public.lkp_facility_type_facility_type_id_seq'::regclass);


--
-- Name: lkp_fund fund_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_fund ALTER COLUMN fund_id SET DEFAULT nextval('public.lkp_fund_fund_id_seq'::regclass);


--
-- Name: lkp_gender gender_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_gender ALTER COLUMN gender_id SET DEFAULT nextval('public.lkp_gender_gender_id_seq'::regclass);


--
-- Name: lkp_howtheyfoundus howtheyfoundus_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_howtheyfoundus ALTER COLUMN howtheyfoundus_id SET DEFAULT nextval('public.lkp_howtheyfoundus_howtheyfoundus_id_seq'::regclass);


--
-- Name: lkp_item_category item_category_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_item_category ALTER COLUMN item_category_id SET DEFAULT nextval('public.lkp_item_category_item_category_id_seq'::regclass);


--
-- Name: lkp_item_condition item_condition_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_item_condition ALTER COLUMN item_condition_id SET DEFAULT nextval('public.lkp_item_condition_item_condition_id_seq'::regclass);


--
-- Name: lkp_item_size item_size_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_item_size ALTER COLUMN item_size_id SET DEFAULT nextval('public.lkp_item_size_item_size_id_seq'::regclass);


--
-- Name: lkp_item_weight item_weight_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_item_weight ALTER COLUMN item_weight_id SET DEFAULT nextval('public.lkp_item_weight_item_weight_id_seq'::regclass);


--
-- Name: lkp_maintenance_type maintenance_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_maintenance_type ALTER COLUMN maintenance_type_id SET DEFAULT nextval('public.lkp_maintenance_type_maintenance_type_id_seq'::regclass);


--
-- Name: lkp_note_entity_type note_entity_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_note_entity_type ALTER COLUMN note_entity_type_id SET DEFAULT nextval('public.lkp_note_entity_type_note_entity_type_id_seq'::regclass);


--
-- Name: lkp_payment_method payment_method_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_payment_method ALTER COLUMN payment_method_id SET DEFAULT nextval('public.lkp_payment_method_payment_method_id_seq'::regclass);


--
-- Name: lkp_pickup_status pickup_status_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_pickup_status ALTER COLUMN pickup_status_id SET DEFAULT nextval('public.lkp_pickup_status_pickup_status_id_seq'::regclass);


--
-- Name: lkp_pledge_status pledge_status_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_pledge_status ALTER COLUMN pledge_status_id SET DEFAULT nextval('public.lkp_pledge_status_pledge_status_id_seq'::regclass);


--
-- Name: lkp_rental_agency rental_agency_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_rental_agency ALTER COLUMN rental_agency_id SET DEFAULT nextval('public.lkp_rental_agency_rental_agency_id_seq'::regclass);


--
-- Name: lkp_request_receipt_origin request_receipt_origin_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_request_receipt_origin ALTER COLUMN request_receipt_origin_id SET DEFAULT nextval('public.lkp_request_receipt_origin_request_receipt_origin_id_seq'::regclass);


--
-- Name: lkp_reservation_status reservation_status_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_reservation_status ALTER COLUMN reservation_status_id SET DEFAULT nextval('public.lkp_reservation_status_reservation_status_id_seq'::regclass);


--
-- Name: lkp_restriction_type restriction_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_restriction_type ALTER COLUMN restriction_type_id SET DEFAULT nextval('public.lkp_restriction_type_restriction_type_id_seq'::regclass);


--
-- Name: lkp_role_pay_type role_pay_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_role_pay_type ALTER COLUMN role_pay_type_id SET DEFAULT nextval('public.lkp_role_pay_type_role_pay_type_id_seq'::regclass);


--
-- Name: lkp_shift_status shift_status_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_shift_status ALTER COLUMN shift_status_id SET DEFAULT nextval('public.lkp_shift_status_shift_status_id_seq'::regclass);


--
-- Name: lkp_shift_type shift_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_shift_type ALTER COLUMN shift_type_id SET DEFAULT nextval('public.lkp_shift_type_shift_type_id_seq'::regclass);


--
-- Name: lkp_skill skill_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_skill ALTER COLUMN skill_id SET DEFAULT nextval('public.lkp_skill_skill_id_seq'::regclass);


--
-- Name: lkp_solicitation_method solicitation_method_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_solicitation_method ALTER COLUMN solicitation_method_id SET DEFAULT nextval('public.lkp_solicitation_method_solicitation_method_id_seq'::regclass);


--
-- Name: lkp_source_type source_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_source_type ALTER COLUMN source_type_id SET DEFAULT nextval('public.lkp_source_type_source_type_id_seq'::regclass);


--
-- Name: lkp_staff_role staff_role_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_staff_role ALTER COLUMN staff_role_id SET DEFAULT nextval('public.lkp_staff_role_staff_role_id_seq'::regclass);


--
-- Name: lkp_state state_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_state ALTER COLUMN state_id SET DEFAULT nextval('public.lkp_state_state_id_seq'::regclass);


--
-- Name: lkp_status_change_reason status_change_reason_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_status_change_reason ALTER COLUMN status_change_reason_id SET DEFAULT nextval('public.lkp_status_change_reason_status_change_reason_id_seq'::regclass);


--
-- Name: lkp_storage_location storage_location_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_storage_location ALTER COLUMN storage_location_id SET DEFAULT nextval('public.lkp_storage_location_storage_location_id_seq'::regclass);


--
-- Name: lkp_vehicle_fuel_type vehicle_fuel_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_fuel_type ALTER COLUMN vehicle_fuel_type_id SET DEFAULT nextval('public.lkp_vehicle_fuel_type_vehicle_fuel_type_id_seq'::regclass);


--
-- Name: lkp_vehicle_make vehicle_make_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_make ALTER COLUMN vehicle_make_id SET DEFAULT nextval('public.lkp_vehicle_make_vehicle_make_id_seq'::regclass);


--
-- Name: lkp_vehicle_model vehicle_model_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_model ALTER COLUMN vehicle_model_id SET DEFAULT nextval('public.lkp_vehicle_model_vehicle_model_id_seq'::regclass);


--
-- Name: lkp_vehicle_type vehicle_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_type ALTER COLUMN vehicle_type_id SET DEFAULT nextval('public.lkp_vehicle_type_vehicle_type_id_seq'::regclass);


--
-- Name: lkp_vehicle_weight_class vehicle_weight_class_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_weight_class ALTER COLUMN vehicle_weight_class_id SET DEFAULT nextval('public.lkp_vehicle_weight_class_vehicle_weight_class_id_seq'::regclass);


--
-- Name: lkp_volunteer_activity_type volunteer_activity_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_volunteer_activity_type ALTER COLUMN volunteer_activity_type_id SET DEFAULT nextval('public.lkp_volunteer_activity_type_volunteer_activity_type_id_seq'::regclass);


--
-- Name: tbl_address address_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_address ALTER COLUMN address_id SET DEFAULT nextval('public.tbl_address_address_id_seq'::regclass);


--
-- Name: tbl_agency agency_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_agency ALTER COLUMN agency_id SET DEFAULT nextval('public.tbl_agency_agency_id_seq'::regclass);


--
-- Name: tbl_agency_contact agency_contact_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_agency_contact ALTER COLUMN agency_contact_id SET DEFAULT nextval('public.tbl_agency_contact_agency_contact_id_seq'::regclass);


--
-- Name: tbl_attachment attachment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_attachment ALTER COLUMN attachment_id SET DEFAULT nextval('public.tbl_attachment_attachment_id_seq'::regclass);


--
-- Name: tbl_audit_log audit_log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_audit_log ALTER COLUMN audit_log_id SET DEFAULT nextval('public.tbl_audit_log_audit_log_id_seq'::regclass);


--
-- Name: tbl_campaign campaign_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_campaign ALTER COLUMN campaign_id SET DEFAULT nextval('public.tbl_campaign_campaign_id_seq'::regclass);


--
-- Name: tbl_client client_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client ALTER COLUMN client_id SET DEFAULT nextval('public.tbl_client_client_id_seq'::regclass);


--
-- Name: tbl_client_deliveries client_deliveries_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_deliveries ALTER COLUMN client_deliveries_id SET DEFAULT nextval('public.tbl_client_deliveries_client_deliveries_id_seq'::regclass);


--
-- Name: tbl_client_provisioning_request client_provisioning_request_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_provisioning_request ALTER COLUMN client_provisioning_request_id SET DEFAULT nextval('public.tbl_client_provisioning_reque_client_provisioning_request_i_seq'::regclass);


--
-- Name: tbl_client_request_items client_request_items_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_request_items ALTER COLUMN client_request_items_id SET DEFAULT nextval('public.tbl_client_request_items_client_request_items_id_seq'::regclass);


--
-- Name: tbl_communication_log communication_log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_communication_log ALTER COLUMN communication_log_id SET DEFAULT nextval('public.tbl_communication_log_communication_log_id_seq'::regclass);


--
-- Name: tbl_contact contact_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_contact ALTER COLUMN contact_id SET DEFAULT nextval('public.tbl_contact_contact_id_seq'::regclass);


--
-- Name: tbl_corp_facility corp_facility_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility ALTER COLUMN corp_facility_id SET DEFAULT nextval('public.tbl_corp_facility_corp_facility_id_seq'::regclass);


--
-- Name: tbl_corp_facility_inventory_item corp_facility_inventory_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility_inventory_item ALTER COLUMN corp_facility_inventory_item_id SET DEFAULT nextval('public.tbl_corp_facility_inventory_i_corp_facility_inventory_item__seq'::regclass);


--
-- Name: tbl_corporate corporate_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corporate ALTER COLUMN corporate_id SET DEFAULT nextval('public.tbl_corporate_corporate_id_seq'::regclass);


--
-- Name: tbl_delivery_items delivery_items_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_items ALTER COLUMN delivery_items_id SET DEFAULT nextval('public.tbl_delivery_items_delivery_items_id_seq'::regclass);


--
-- Name: tbl_delivery_receipt delivery_receipt_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_receipt ALTER COLUMN delivery_receipt_id SET DEFAULT nextval('public.tbl_delivery_receipt_delivery_receipt_id_seq'::regclass);


--
-- Name: tbl_delivery_staff delivery_staff_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_staff ALTER COLUMN delivery_staff_id SET DEFAULT nextval('public.tbl_delivery_staff_delivery_staff_id_seq'::regclass);


--
-- Name: tbl_delivery_vehicle delivery_vehicle_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_vehicle ALTER COLUMN delivery_vehicle_id SET DEFAULT nextval('public.tbl_delivery_vehicle_delivery_vehicle_id_seq'::regclass);


--
-- Name: tbl_donation donation_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation ALTER COLUMN donation_id SET DEFAULT nextval('public.tbl_donation_donation_id_seq'::regclass);


--
-- Name: tbl_donation_check donation_check_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_check ALTER COLUMN donation_check_id SET DEFAULT nextval('public.tbl_donation_check_donation_check_id_seq'::regclass);


--
-- Name: tbl_donation_designation donation_designation_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_designation ALTER COLUMN donation_designation_id SET DEFAULT nextval('public.tbl_donation_designation_donation_designation_id_seq'::regclass);


--
-- Name: tbl_donation_item donation_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_item ALTER COLUMN donation_item_id SET DEFAULT nextval('public.tbl_donation_item_donation_item_id_seq'::regclass);


--
-- Name: tbl_donation_pickup donation_pickup_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_pickup ALTER COLUMN donation_pickup_id SET DEFAULT nextval('public.tbl_donation_pickup_donation_pickup_id_seq'::regclass);


--
-- Name: tbl_donation_securities donation_securities_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_securities ALTER COLUMN donation_securities_id SET DEFAULT nextval('public.tbl_donation_securities_donation_securities_id_seq'::regclass);


--
-- Name: tbl_donor donor_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donor ALTER COLUMN donor_id SET DEFAULT nextval('public.tbl_donor_donor_id_seq'::regclass);


--
-- Name: tbl_email_account email_account_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_email_account ALTER COLUMN email_account_id SET DEFAULT nextval('public.tbl_email_account_email_account_id_seq'::regclass);


--
-- Name: tbl_event event_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_event ALTER COLUMN event_id SET DEFAULT nextval('public.tbl_event_event_id_seq'::regclass);


--
-- Name: tbl_event_attendee event_attendee_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_event_attendee ALTER COLUMN event_attendee_id SET DEFAULT nextval('public.tbl_event_attendee_event_attendee_id_seq'::regclass);


--
-- Name: tbl_facility_staff facility_staff_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_facility_staff ALTER COLUMN facility_staff_id SET DEFAULT nextval('public.tbl_facility_staff_facility_staff_id_seq'::regclass);


--
-- Name: tbl_facility_staff_statuses facility_staff_statuses_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_facility_staff_statuses ALTER COLUMN facility_staff_statuses_id SET DEFAULT nextval('public.tbl_facility_staff_statuses_facility_staff_statuses_id_seq'::regclass);


--
-- Name: tbl_grant grant_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_grant ALTER COLUMN grant_id SET DEFAULT nextval('public.tbl_grant_grant_id_seq'::regclass);


--
-- Name: tbl_inventory_reservation inventory_reservation_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_inventory_reservation ALTER COLUMN inventory_reservation_id SET DEFAULT nextval('public.tbl_inventory_reservation_inventory_reservation_id_seq'::regclass);


--
-- Name: tbl_note note_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_note ALTER COLUMN note_id SET DEFAULT nextval('public.tbl_note_note_id_seq'::regclass);


--
-- Name: tbl_pledge pledge_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_pledge ALTER COLUMN pledge_id SET DEFAULT nextval('public.tbl_pledge_pledge_id_seq'::regclass);


--
-- Name: tbl_quickbooks_account_mapping mapping_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_account_mapping ALTER COLUMN mapping_id SET DEFAULT nextval('public.tbl_quickbooks_account_mapping_mapping_id_seq'::regclass);


--
-- Name: tbl_quickbooks_connection qbo_connection_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_connection ALTER COLUMN qbo_connection_id SET DEFAULT nextval('public.tbl_quickbooks_connection_qbo_connection_id_seq'::regclass);


--
-- Name: tbl_quickbooks_donation_sync sync_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_donation_sync ALTER COLUMN sync_id SET DEFAULT nextval('public.tbl_quickbooks_donation_sync_sync_id_seq'::regclass);


--
-- Name: tbl_quickbooks_donor_link donor_link_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_donor_link ALTER COLUMN donor_link_id SET DEFAULT nextval('public.tbl_quickbooks_donor_link_donor_link_id_seq'::regclass);


--
-- Name: tbl_referral referral_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_referral ALTER COLUMN referral_id SET DEFAULT nextval('public.tbl_referral_referral_id_seq'::regclass);


--
-- Name: tbl_request_item_inv_matches request_item_inv_matches_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_request_item_inv_matches ALTER COLUMN request_item_inv_matches_id SET DEFAULT nextval('public.tbl_request_item_inv_matches_request_item_inv_matches_id_seq'::regclass);


--
-- Name: tbl_staff_type staff_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_staff_type ALTER COLUMN staff_type_id SET DEFAULT nextval('public.tbl_staff_type_staff_type_id_seq'::regclass);


--
-- Name: tbl_staff_types staff_types_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_staff_types ALTER COLUMN staff_types_id SET DEFAULT nextval('public.tbl_staff_types_staff_types_id_seq'::regclass);


--
-- Name: tbl_user_account user_account_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_user_account ALTER COLUMN user_account_id SET DEFAULT nextval('public.tbl_user_account_user_account_id_seq'::regclass);


--
-- Name: tbl_vehicle vehicle_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle ALTER COLUMN vehicle_id SET DEFAULT nextval('public.tbl_vehicle_vehicle_id_seq'::regclass);


--
-- Name: tbl_vehicle_maintenance vehicle_maintenance_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle_maintenance ALTER COLUMN vehicle_maintenance_id SET DEFAULT nextval('public.tbl_vehicle_maintenance_vehicle_maintenance_id_seq'::regclass);


--
-- Name: tbl_vehicle_mileage vehicle_mileage_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle_mileage ALTER COLUMN vehicle_mileage_id SET DEFAULT nextval('public.tbl_vehicle_mileage_vehicle_mileage_id_seq'::regclass);


--
-- Name: tbl_volunteer_hours volunteer_hours_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_hours ALTER COLUMN volunteer_hours_id SET DEFAULT nextval('public.tbl_volunteer_hours_volunteer_hours_id_seq'::regclass);


--
-- Name: tbl_volunteer_profile volunteer_profile_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_profile ALTER COLUMN volunteer_profile_id SET DEFAULT nextval('public.tbl_volunteer_profile_volunteer_profile_id_seq'::regclass);


--
-- Name: tbl_volunteer_shift shift_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift ALTER COLUMN shift_id SET DEFAULT nextval('public.tbl_volunteer_shift_shift_id_seq'::regclass);


--
-- Name: tbl_volunteer_shift_signup signup_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift_signup ALTER COLUMN signup_id SET DEFAULT nextval('public.tbl_volunteer_shift_signup_signup_id_seq'::regclass);


--
-- Name: tbl_volunteer_skill volunteer_skill_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_skill ALTER COLUMN volunteer_skill_id SET DEFAULT nextval('public.tbl_volunteer_skill_volunteer_skill_id_seq'::regclass);


--
-- Name: lkp_acknowledgement_status lkp_acknowledgement_status_acknowledgement_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_acknowledgement_status
    ADD CONSTRAINT lkp_acknowledgement_status_acknowledgement_status_key UNIQUE (acknowledgement_status);


--
-- Name: lkp_acknowledgement_status lkp_acknowledgement_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_acknowledgement_status
    ADD CONSTRAINT lkp_acknowledgement_status_pkey PRIMARY KEY (acknowledgement_status_id);


--
-- Name: lkp_address_type lkp_address_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_address_type
    ADD CONSTRAINT lkp_address_type_pkey PRIMARY KEY (address_type_id);


--
-- Name: lkp_agency_type lkp_agency_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_agency_type
    ADD CONSTRAINT lkp_agency_type_pkey PRIMARY KEY (agency_type_id);


--
-- Name: lkp_attachment_entity_type lkp_attachment_entity_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_attachment_entity_type
    ADD CONSTRAINT lkp_attachment_entity_type_pkey PRIMARY KEY (attachment_entity_type_id);


--
-- Name: lkp_campaign_status lkp_campaign_status_campaign_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_campaign_status
    ADD CONSTRAINT lkp_campaign_status_campaign_status_key UNIQUE (campaign_status);


--
-- Name: lkp_campaign_status lkp_campaign_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_campaign_status
    ADD CONSTRAINT lkp_campaign_status_pkey PRIMARY KEY (campaign_status_id);


--
-- Name: lkp_campaign_type lkp_campaign_type_campaign_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_campaign_type
    ADD CONSTRAINT lkp_campaign_type_campaign_type_key UNIQUE (campaign_type);


--
-- Name: lkp_campaign_type lkp_campaign_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_campaign_type
    ADD CONSTRAINT lkp_campaign_type_pkey PRIMARY KEY (campaign_type_id);


--
-- Name: lkp_citizen_status lkp_citizen_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_citizen_status
    ADD CONSTRAINT lkp_citizen_status_pkey PRIMARY KEY (citizen_status_id);


--
-- Name: lkp_city lkp_city_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_city
    ADD CONSTRAINT lkp_city_pkey PRIMARY KEY (city_id);


--
-- Name: lkp_client_status lkp_client_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_client_status
    ADD CONSTRAINT lkp_client_status_pkey PRIMARY KEY (client_status_id);


--
-- Name: lkp_client_type lkp_client_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_client_type
    ADD CONSTRAINT lkp_client_type_pkey PRIMARY KEY (client_type_id);


--
-- Name: lkp_communication_method lkp_communication_method_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_communication_method
    ADD CONSTRAINT lkp_communication_method_pkey PRIMARY KEY (communication_method_id);


--
-- Name: lkp_contact_type lkp_contact_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_contact_type
    ADD CONSTRAINT lkp_contact_type_pkey PRIMARY KEY (contact_type_id);


--
-- Name: lkp_corp_type lkp_corp_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_corp_type
    ADD CONSTRAINT lkp_corp_type_pkey PRIMARY KEY (corp_type_id);


--
-- Name: lkp_county lkp_county_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_county
    ADD CONSTRAINT lkp_county_pkey PRIMARY KEY (county_id);


--
-- Name: lkp_delivery_status lkp_delivery_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_delivery_status
    ADD CONSTRAINT lkp_delivery_status_pkey PRIMARY KEY (delivery_status_id);


--
-- Name: lkp_delivery_vehicle_type lkp_delivery_vehicle_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_delivery_vehicle_type
    ADD CONSTRAINT lkp_delivery_vehicle_type_pkey PRIMARY KEY (delivery_vehicle_type_id);


--
-- Name: lkp_disposition_reason lkp_disposition_reason_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_disposition_reason
    ADD CONSTRAINT lkp_disposition_reason_pkey PRIMARY KEY (disposition_reason_id);


--
-- Name: lkp_donation_type lkp_donation_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_donation_type
    ADD CONSTRAINT lkp_donation_type_pkey PRIMARY KEY (donation_type_id);


--
-- Name: lkp_donor_stage lkp_donor_stage_donor_stage_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_donor_stage
    ADD CONSTRAINT lkp_donor_stage_donor_stage_key UNIQUE (donor_stage);


--
-- Name: lkp_donor_stage lkp_donor_stage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_donor_stage
    ADD CONSTRAINT lkp_donor_stage_pkey PRIMARY KEY (donor_stage_id);


--
-- Name: lkp_donor_type lkp_donor_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_donor_type
    ADD CONSTRAINT lkp_donor_type_pkey PRIMARY KEY (donor_type_id);


--
-- Name: lkp_ethnicity lkp_ethnicity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_ethnicity
    ADD CONSTRAINT lkp_ethnicity_pkey PRIMARY KEY (ethnicity_id);


--
-- Name: lkp_event_type lkp_event_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_event_type
    ADD CONSTRAINT lkp_event_type_pkey PRIMARY KEY (event_type_id);


--
-- Name: lkp_facility_staff_status lkp_facility_staff_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_facility_staff_status
    ADD CONSTRAINT lkp_facility_staff_status_pkey PRIMARY KEY (facility_staff_status_id);


--
-- Name: lkp_facility_type lkp_facility_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_facility_type
    ADD CONSTRAINT lkp_facility_type_pkey PRIMARY KEY (facility_type_id);


--
-- Name: lkp_fund lkp_fund_fund_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_fund
    ADD CONSTRAINT lkp_fund_fund_name_key UNIQUE (fund_name);


--
-- Name: lkp_fund lkp_fund_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_fund
    ADD CONSTRAINT lkp_fund_pkey PRIMARY KEY (fund_id);


--
-- Name: lkp_gender lkp_gender_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_gender
    ADD CONSTRAINT lkp_gender_pkey PRIMARY KEY (gender_id);


--
-- Name: lkp_howtheyfoundus lkp_howtheyfoundus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_howtheyfoundus
    ADD CONSTRAINT lkp_howtheyfoundus_pkey PRIMARY KEY (howtheyfoundus_id);


--
-- Name: lkp_item_category lkp_item_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_item_category
    ADD CONSTRAINT lkp_item_category_pkey PRIMARY KEY (item_category_id);


--
-- Name: lkp_item_condition lkp_item_condition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_item_condition
    ADD CONSTRAINT lkp_item_condition_pkey PRIMARY KEY (item_condition_id);


--
-- Name: lkp_item_size lkp_item_size_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_item_size
    ADD CONSTRAINT lkp_item_size_pkey PRIMARY KEY (item_size_id);


--
-- Name: lkp_item_weight lkp_item_weight_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_item_weight
    ADD CONSTRAINT lkp_item_weight_pkey PRIMARY KEY (item_weight_id);


--
-- Name: lkp_maintenance_type lkp_maintenance_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_maintenance_type
    ADD CONSTRAINT lkp_maintenance_type_pkey PRIMARY KEY (maintenance_type_id);


--
-- Name: lkp_note_entity_type lkp_note_entity_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_note_entity_type
    ADD CONSTRAINT lkp_note_entity_type_pkey PRIMARY KEY (note_entity_type_id);


--
-- Name: lkp_payment_method lkp_payment_method_payment_method_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_payment_method
    ADD CONSTRAINT lkp_payment_method_payment_method_key UNIQUE (payment_method);


--
-- Name: lkp_payment_method lkp_payment_method_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_payment_method
    ADD CONSTRAINT lkp_payment_method_pkey PRIMARY KEY (payment_method_id);


--
-- Name: lkp_pickup_status lkp_pickup_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_pickup_status
    ADD CONSTRAINT lkp_pickup_status_pkey PRIMARY KEY (pickup_status_id);


--
-- Name: lkp_pledge_status lkp_pledge_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_pledge_status
    ADD CONSTRAINT lkp_pledge_status_pkey PRIMARY KEY (pledge_status_id);


--
-- Name: lkp_pledge_status lkp_pledge_status_pledge_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_pledge_status
    ADD CONSTRAINT lkp_pledge_status_pledge_status_key UNIQUE (pledge_status);


--
-- Name: lkp_rental_agency lkp_rental_agency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_rental_agency
    ADD CONSTRAINT lkp_rental_agency_pkey PRIMARY KEY (rental_agency_id);


--
-- Name: lkp_request_receipt_origin lkp_request_receipt_origin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_request_receipt_origin
    ADD CONSTRAINT lkp_request_receipt_origin_pkey PRIMARY KEY (request_receipt_origin_id);


--
-- Name: lkp_reservation_status lkp_reservation_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_reservation_status
    ADD CONSTRAINT lkp_reservation_status_pkey PRIMARY KEY (reservation_status_id);


--
-- Name: lkp_restriction_type lkp_restriction_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_restriction_type
    ADD CONSTRAINT lkp_restriction_type_pkey PRIMARY KEY (restriction_type_id);


--
-- Name: lkp_restriction_type lkp_restriction_type_restriction_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_restriction_type
    ADD CONSTRAINT lkp_restriction_type_restriction_type_key UNIQUE (restriction_type);


--
-- Name: lkp_role_pay_type lkp_role_pay_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_role_pay_type
    ADD CONSTRAINT lkp_role_pay_type_pkey PRIMARY KEY (role_pay_type_id);


--
-- Name: lkp_shift_status lkp_shift_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_shift_status
    ADD CONSTRAINT lkp_shift_status_pkey PRIMARY KEY (shift_status_id);


--
-- Name: lkp_shift_status lkp_shift_status_shift_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_shift_status
    ADD CONSTRAINT lkp_shift_status_shift_status_key UNIQUE (shift_status);


--
-- Name: lkp_shift_type lkp_shift_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_shift_type
    ADD CONSTRAINT lkp_shift_type_pkey PRIMARY KEY (shift_type_id);


--
-- Name: lkp_shift_type lkp_shift_type_shift_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_shift_type
    ADD CONSTRAINT lkp_shift_type_shift_type_key UNIQUE (shift_type);


--
-- Name: lkp_skill lkp_skill_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_skill
    ADD CONSTRAINT lkp_skill_pkey PRIMARY KEY (skill_id);


--
-- Name: lkp_solicitation_method lkp_solicitation_method_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_solicitation_method
    ADD CONSTRAINT lkp_solicitation_method_pkey PRIMARY KEY (solicitation_method_id);


--
-- Name: lkp_solicitation_method lkp_solicitation_method_solicitation_method_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_solicitation_method
    ADD CONSTRAINT lkp_solicitation_method_solicitation_method_key UNIQUE (solicitation_method);


--
-- Name: lkp_source_type lkp_source_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_source_type
    ADD CONSTRAINT lkp_source_type_pkey PRIMARY KEY (source_type_id);


--
-- Name: lkp_staff_role lkp_staff_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_staff_role
    ADD CONSTRAINT lkp_staff_role_pkey PRIMARY KEY (staff_role_id);


--
-- Name: lkp_state lkp_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_state
    ADD CONSTRAINT lkp_state_pkey PRIMARY KEY (state_id);


--
-- Name: lkp_status_change_reason lkp_status_change_reason_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_status_change_reason
    ADD CONSTRAINT lkp_status_change_reason_pkey PRIMARY KEY (status_change_reason_id);


--
-- Name: lkp_storage_location lkp_storage_location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_storage_location
    ADD CONSTRAINT lkp_storage_location_pkey PRIMARY KEY (storage_location_id);


--
-- Name: lkp_vehicle_fuel_type lkp_vehicle_fuel_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_fuel_type
    ADD CONSTRAINT lkp_vehicle_fuel_type_pkey PRIMARY KEY (vehicle_fuel_type_id);


--
-- Name: lkp_vehicle_make lkp_vehicle_make_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_make
    ADD CONSTRAINT lkp_vehicle_make_pkey PRIMARY KEY (vehicle_make_id);


--
-- Name: lkp_vehicle_model lkp_vehicle_model_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_model
    ADD CONSTRAINT lkp_vehicle_model_pkey PRIMARY KEY (vehicle_model_id);


--
-- Name: lkp_vehicle_type lkp_vehicle_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_type
    ADD CONSTRAINT lkp_vehicle_type_pkey PRIMARY KEY (vehicle_type_id);


--
-- Name: lkp_vehicle_weight_class lkp_vehicle_weight_class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_weight_class
    ADD CONSTRAINT lkp_vehicle_weight_class_pkey PRIMARY KEY (vehicle_weight_class_id);


--
-- Name: lkp_volunteer_activity_type lkp_volunteer_activity_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_volunteer_activity_type
    ADD CONSTRAINT lkp_volunteer_activity_type_pkey PRIMARY KEY (volunteer_activity_type_id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: tbl_address tbl_address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_address
    ADD CONSTRAINT tbl_address_pkey PRIMARY KEY (address_id);


--
-- Name: tbl_agency_contact tbl_agency_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_agency_contact
    ADD CONSTRAINT tbl_agency_contact_pkey PRIMARY KEY (agency_contact_id);


--
-- Name: tbl_agency tbl_agency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_agency
    ADD CONSTRAINT tbl_agency_pkey PRIMARY KEY (agency_id);


--
-- Name: tbl_app_setting tbl_app_setting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_app_setting
    ADD CONSTRAINT tbl_app_setting_pkey PRIMARY KEY (setting_key);


--
-- Name: tbl_attachment tbl_attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_attachment
    ADD CONSTRAINT tbl_attachment_pkey PRIMARY KEY (attachment_id);


--
-- Name: tbl_audit_log tbl_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_audit_log
    ADD CONSTRAINT tbl_audit_log_pkey PRIMARY KEY (audit_log_id);


--
-- Name: tbl_campaign tbl_campaign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_campaign
    ADD CONSTRAINT tbl_campaign_pkey PRIMARY KEY (campaign_id);


--
-- Name: tbl_client_deliveries tbl_client_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_deliveries
    ADD CONSTRAINT tbl_client_deliveries_pkey PRIMARY KEY (client_deliveries_id);


--
-- Name: tbl_client tbl_client_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client
    ADD CONSTRAINT tbl_client_pkey PRIMARY KEY (client_id);


--
-- Name: tbl_client_provisioning_request tbl_client_provisioning_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_provisioning_request
    ADD CONSTRAINT tbl_client_provisioning_request_pkey PRIMARY KEY (client_provisioning_request_id);


--
-- Name: tbl_client_request_items tbl_client_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_request_items
    ADD CONSTRAINT tbl_client_request_items_pkey PRIMARY KEY (client_request_items_id);


--
-- Name: tbl_communication_log tbl_communication_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_communication_log
    ADD CONSTRAINT tbl_communication_log_pkey PRIMARY KEY (communication_log_id);


--
-- Name: tbl_contact tbl_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_contact
    ADD CONSTRAINT tbl_contact_pkey PRIMARY KEY (contact_id);


--
-- Name: tbl_corp_facility_inventory_item tbl_corp_facility_inventory_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility_inventory_item
    ADD CONSTRAINT tbl_corp_facility_inventory_item_pkey PRIMARY KEY (corp_facility_inventory_item_id);


--
-- Name: tbl_corp_facility tbl_corp_facility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility
    ADD CONSTRAINT tbl_corp_facility_pkey PRIMARY KEY (corp_facility_id);


--
-- Name: tbl_corporate tbl_corporate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corporate
    ADD CONSTRAINT tbl_corporate_pkey PRIMARY KEY (corporate_id);


--
-- Name: tbl_delivery_items tbl_delivery_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_items
    ADD CONSTRAINT tbl_delivery_items_pkey PRIMARY KEY (delivery_items_id);


--
-- Name: tbl_delivery_receipt tbl_delivery_receipt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_receipt
    ADD CONSTRAINT tbl_delivery_receipt_pkey PRIMARY KEY (delivery_receipt_id);


--
-- Name: tbl_delivery_staff tbl_delivery_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_staff
    ADD CONSTRAINT tbl_delivery_staff_pkey PRIMARY KEY (delivery_staff_id);


--
-- Name: tbl_delivery_vehicle tbl_delivery_vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_vehicle
    ADD CONSTRAINT tbl_delivery_vehicle_pkey PRIMARY KEY (delivery_vehicle_id);


--
-- Name: tbl_donation_check tbl_donation_check_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_check
    ADD CONSTRAINT tbl_donation_check_pkey PRIMARY KEY (donation_check_id);


--
-- Name: tbl_donation_designation tbl_donation_designation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_designation
    ADD CONSTRAINT tbl_donation_designation_pkey PRIMARY KEY (donation_designation_id);


--
-- Name: tbl_donation_item tbl_donation_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_item
    ADD CONSTRAINT tbl_donation_item_pkey PRIMARY KEY (donation_item_id);


--
-- Name: tbl_donation_pickup tbl_donation_pickup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_pickup
    ADD CONSTRAINT tbl_donation_pickup_pkey PRIMARY KEY (donation_pickup_id);


--
-- Name: tbl_donation tbl_donation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation
    ADD CONSTRAINT tbl_donation_pkey PRIMARY KEY (donation_id);


--
-- Name: tbl_donation_securities tbl_donation_securities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_securities
    ADD CONSTRAINT tbl_donation_securities_pkey PRIMARY KEY (donation_securities_id);


--
-- Name: tbl_donor tbl_donor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donor
    ADD CONSTRAINT tbl_donor_pkey PRIMARY KEY (donor_id);


--
-- Name: tbl_email_account tbl_email_account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_email_account
    ADD CONSTRAINT tbl_email_account_pkey PRIMARY KEY (email_account_id);


--
-- Name: tbl_event_attendee tbl_event_attendee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_event_attendee
    ADD CONSTRAINT tbl_event_attendee_pkey PRIMARY KEY (event_attendee_id);


--
-- Name: tbl_event tbl_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_event
    ADD CONSTRAINT tbl_event_pkey PRIMARY KEY (event_id);


--
-- Name: tbl_facility_staff tbl_facility_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_facility_staff
    ADD CONSTRAINT tbl_facility_staff_pkey PRIMARY KEY (facility_staff_id);


--
-- Name: tbl_facility_staff_statuses tbl_facility_staff_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_facility_staff_statuses
    ADD CONSTRAINT tbl_facility_staff_statuses_pkey PRIMARY KEY (facility_staff_statuses_id);


--
-- Name: tbl_grant tbl_grant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_grant
    ADD CONSTRAINT tbl_grant_pkey PRIMARY KEY (grant_id);


--
-- Name: tbl_inventory_reservation tbl_inventory_reservation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_inventory_reservation
    ADD CONSTRAINT tbl_inventory_reservation_pkey PRIMARY KEY (inventory_reservation_id);


--
-- Name: tbl_note tbl_note_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_note
    ADD CONSTRAINT tbl_note_pkey PRIMARY KEY (note_id);


--
-- Name: tbl_pledge tbl_pledge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_pledge
    ADD CONSTRAINT tbl_pledge_pkey PRIMARY KEY (pledge_id);


--
-- Name: tbl_quickbooks_account_mapping tbl_quickbooks_account_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_account_mapping
    ADD CONSTRAINT tbl_quickbooks_account_mapping_pkey PRIMARY KEY (mapping_id);


--
-- Name: tbl_quickbooks_connection tbl_quickbooks_connection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_connection
    ADD CONSTRAINT tbl_quickbooks_connection_pkey PRIMARY KEY (qbo_connection_id);


--
-- Name: tbl_quickbooks_donation_sync tbl_quickbooks_donation_sync_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_donation_sync
    ADD CONSTRAINT tbl_quickbooks_donation_sync_pkey PRIMARY KEY (sync_id);


--
-- Name: tbl_quickbooks_donor_link tbl_quickbooks_donor_link_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_donor_link
    ADD CONSTRAINT tbl_quickbooks_donor_link_pkey PRIMARY KEY (donor_link_id);


--
-- Name: tbl_receipt_counter tbl_receipt_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_receipt_counter
    ADD CONSTRAINT tbl_receipt_counter_pkey PRIMARY KEY (fiscal_year);


--
-- Name: tbl_referral tbl_referral_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_referral
    ADD CONSTRAINT tbl_referral_pkey PRIMARY KEY (referral_id);


--
-- Name: tbl_request_item_inv_matches tbl_request_item_inv_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_request_item_inv_matches
    ADD CONSTRAINT tbl_request_item_inv_matches_pkey PRIMARY KEY (request_item_inv_matches_id);


--
-- Name: tbl_staff_type tbl_staff_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_staff_type
    ADD CONSTRAINT tbl_staff_type_pkey PRIMARY KEY (staff_type_id);


--
-- Name: tbl_staff_types tbl_staff_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_staff_types
    ADD CONSTRAINT tbl_staff_types_pkey PRIMARY KEY (staff_types_id);


--
-- Name: tbl_user_account tbl_user_account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_user_account
    ADD CONSTRAINT tbl_user_account_pkey PRIMARY KEY (user_account_id);


--
-- Name: tbl_vehicle_maintenance tbl_vehicle_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle_maintenance
    ADD CONSTRAINT tbl_vehicle_maintenance_pkey PRIMARY KEY (vehicle_maintenance_id);


--
-- Name: tbl_vehicle_mileage tbl_vehicle_mileage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle_mileage
    ADD CONSTRAINT tbl_vehicle_mileage_pkey PRIMARY KEY (vehicle_mileage_id);


--
-- Name: tbl_vehicle tbl_vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle
    ADD CONSTRAINT tbl_vehicle_pkey PRIMARY KEY (vehicle_id);


--
-- Name: tbl_volunteer_hours tbl_volunteer_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_hours
    ADD CONSTRAINT tbl_volunteer_hours_pkey PRIMARY KEY (volunteer_hours_id);


--
-- Name: tbl_volunteer_profile tbl_volunteer_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_profile
    ADD CONSTRAINT tbl_volunteer_profile_pkey PRIMARY KEY (volunteer_profile_id);


--
-- Name: tbl_volunteer_shift tbl_volunteer_shift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift
    ADD CONSTRAINT tbl_volunteer_shift_pkey PRIMARY KEY (shift_id);


--
-- Name: tbl_volunteer_shift_signup tbl_volunteer_shift_signup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift_signup
    ADD CONSTRAINT tbl_volunteer_shift_signup_pkey PRIMARY KEY (signup_id);


--
-- Name: tbl_volunteer_skill tbl_volunteer_skill_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_skill
    ADD CONSTRAINT tbl_volunteer_skill_pkey PRIMARY KEY (volunteer_skill_id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: idx_lkp_city_county_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lkp_city_county_id ON public.lkp_city USING btree (county_id);


--
-- Name: idx_lkp_county_state_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lkp_county_state_id ON public.lkp_county USING btree (state_id);


--
-- Name: idx_lkp_howtheyfoundus_source_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lkp_howtheyfoundus_source_type_id ON public.lkp_howtheyfoundus USING btree (source_type_id);


--
-- Name: idx_lkp_staff_role_role_pay_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lkp_staff_role_role_pay_type_id ON public.lkp_staff_role USING btree (role_pay_type_id);


--
-- Name: idx_lkp_storage_location_corp_facility_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lkp_storage_location_corp_facility_id ON public.lkp_storage_location USING btree (corp_facility_id);


--
-- Name: idx_lkp_vehicle_model_vehicle_make_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lkp_vehicle_model_vehicle_make_id ON public.lkp_vehicle_model USING btree (vehicle_make_id);


--
-- Name: idx_lkp_vehicle_type_vehicle_fuel_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lkp_vehicle_type_vehicle_fuel_type_id ON public.lkp_vehicle_type USING btree (vehicle_fuel_type_id);


--
-- Name: idx_lkp_vehicle_type_vehicle_weight_class_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lkp_vehicle_type_vehicle_weight_class_id ON public.lkp_vehicle_type USING btree (vehicle_weight_class_id);


--
-- Name: idx_tbl_address_address_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_address_address_type_id ON public.tbl_address USING btree (address_type_id);


--
-- Name: idx_tbl_address_city_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_address_city_id ON public.tbl_address USING btree (city_id);


--
-- Name: idx_tbl_address_county_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_address_county_id ON public.tbl_address USING btree (county_id);


--
-- Name: idx_tbl_address_state_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_address_state_id ON public.tbl_address USING btree (state_id);


--
-- Name: idx_tbl_agency_address_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_agency_address_id ON public.tbl_agency USING btree (address_id);


--
-- Name: idx_tbl_agency_agency_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_agency_agency_type_id ON public.tbl_agency USING btree (agency_type_id);


--
-- Name: idx_tbl_agency_contact_agency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_agency_contact_agency_id ON public.tbl_agency_contact USING btree (agency_id);


--
-- Name: idx_tbl_agency_contact_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_agency_contact_contact_id ON public.tbl_agency_contact USING btree (contact_id);


--
-- Name: idx_tbl_attachment_attachment_entity_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_attachment_attachment_entity_type_id ON public.tbl_attachment USING btree (attachment_entity_type_id);


--
-- Name: idx_tbl_attachment_uploaded_by_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_attachment_uploaded_by_facility_staff_id ON public.tbl_attachment USING btree (uploaded_by_facility_staff_id);


--
-- Name: idx_tbl_audit_log_user_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_audit_log_user_account_id ON public.tbl_audit_log USING btree (user_account_id);


--
-- Name: idx_tbl_campaign_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_campaign_dates ON public.tbl_campaign USING btree (start_date, end_date);


--
-- Name: idx_tbl_campaign_fund; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_campaign_fund ON public.tbl_campaign USING btree (fund_id);


--
-- Name: idx_tbl_campaign_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_campaign_status ON public.tbl_campaign USING btree (campaign_status_id);


--
-- Name: idx_tbl_campaign_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_campaign_type ON public.tbl_campaign USING btree (campaign_type_id);


--
-- Name: idx_tbl_client_client_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_client_status_id ON public.tbl_client USING btree (client_status_id);


--
-- Name: idx_tbl_client_client_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_client_type_id ON public.tbl_client USING btree (client_type_id);


--
-- Name: idx_tbl_client_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_contact_id ON public.tbl_client USING btree (contact_id);


--
-- Name: idx_tbl_client_deliveries_client_provisioning_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_deliveries_client_provisioning_request_id ON public.tbl_client_deliveries USING btree (client_provisioning_request_id);


--
-- Name: idx_tbl_client_deliveries_delivery_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_deliveries_delivery_status_id ON public.tbl_client_deliveries USING btree (delivery_status_id);


--
-- Name: idx_tbl_client_deliveries_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_deliveries_facility_staff_id ON public.tbl_client_deliveries USING btree (facility_staff_id);


--
-- Name: idx_tbl_client_provisioning_request_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_provisioning_request_client_id ON public.tbl_client_provisioning_request USING btree (client_id);


--
-- Name: idx_tbl_client_provisioning_request_client_request_creator_faci; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_provisioning_request_client_request_creator_faci ON public.tbl_client_provisioning_request USING btree (client_request_creator_facility_staff_id);


--
-- Name: idx_tbl_client_provisioning_request_fulfillment_corp_facility_i; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_provisioning_request_fulfillment_corp_facility_i ON public.tbl_client_provisioning_request USING btree (fulfillment_corp_facility_id);


--
-- Name: idx_tbl_client_provisioning_request_request_receipt_origin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_provisioning_request_request_receipt_origin_id ON public.tbl_client_provisioning_request USING btree (request_receipt_origin_id);


--
-- Name: idx_tbl_client_request_items_client_provisioning_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_request_items_client_provisioning_request_id ON public.tbl_client_request_items USING btree (client_provisioning_request_id);


--
-- Name: idx_tbl_client_request_items_item_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_client_request_items_item_category_id ON public.tbl_client_request_items USING btree (item_category_id);


--
-- Name: idx_tbl_communication_log_communication_method_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_communication_log_communication_method_id ON public.tbl_communication_log USING btree (communication_method_id);


--
-- Name: idx_tbl_communication_log_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_communication_log_facility_staff_id ON public.tbl_communication_log USING btree (facility_staff_id);


--
-- Name: idx_tbl_communication_log_note_entity_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_communication_log_note_entity_type_id ON public.tbl_communication_log USING btree (note_entity_type_id);


--
-- Name: idx_tbl_contact_address_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_contact_address_id ON public.tbl_contact USING btree (address_id);


--
-- Name: idx_tbl_contact_citizen_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_contact_citizen_status_id ON public.tbl_contact USING btree (citizen_status_id);


--
-- Name: idx_tbl_contact_contact_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_contact_contact_type_id ON public.tbl_contact USING btree (contact_type_id);


--
-- Name: idx_tbl_contact_ethnicity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_contact_ethnicity_id ON public.tbl_contact USING btree (ethnicity_id);


--
-- Name: idx_tbl_contact_gender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_contact_gender_id ON public.tbl_contact USING btree (gender_id);


--
-- Name: idx_tbl_corp_facility_address_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_address_id ON public.tbl_corp_facility USING btree (address_id);


--
-- Name: idx_tbl_corp_facility_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_contact_id ON public.tbl_corp_facility USING btree (contact_id);


--
-- Name: idx_tbl_corp_facility_corporate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_corporate_id ON public.tbl_corp_facility USING btree (corporate_id);


--
-- Name: idx_tbl_corp_facility_facility_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_facility_type_id ON public.tbl_corp_facility USING btree (facility_type_id);


--
-- Name: idx_tbl_corp_facility_inventory_item_corp_facility_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_inventory_item_corp_facility_id ON public.tbl_corp_facility_inventory_item USING btree (corp_facility_id);


--
-- Name: idx_tbl_corp_facility_inventory_item_disposition_reason_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_inventory_item_disposition_reason_id ON public.tbl_corp_facility_inventory_item USING btree (disposition_reason_id);


--
-- Name: idx_tbl_corp_facility_inventory_item_donation_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_inventory_item_donation_item_id ON public.tbl_corp_facility_inventory_item USING btree (donation_item_id);


--
-- Name: idx_tbl_corp_facility_inventory_item_item_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_inventory_item_item_category_id ON public.tbl_corp_facility_inventory_item USING btree (item_category_id);


--
-- Name: idx_tbl_corp_facility_inventory_item_item_condition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_inventory_item_item_condition_id ON public.tbl_corp_facility_inventory_item USING btree (item_condition_id);


--
-- Name: idx_tbl_corp_facility_inventory_item_item_size_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_inventory_item_item_size_id ON public.tbl_corp_facility_inventory_item USING btree (item_size_id);


--
-- Name: idx_tbl_corp_facility_inventory_item_item_weight_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_inventory_item_item_weight_id ON public.tbl_corp_facility_inventory_item USING btree (item_weight_id);


--
-- Name: idx_tbl_corp_facility_inventory_item_storage_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corp_facility_inventory_item_storage_location_id ON public.tbl_corp_facility_inventory_item USING btree (storage_location_id);


--
-- Name: idx_tbl_corporate_corp_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corporate_corp_type_id ON public.tbl_corporate USING btree (corp_type_id);


--
-- Name: idx_tbl_corporate_incorp_state_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_corporate_incorp_state_id ON public.tbl_corporate USING btree (incorp_state_id);


--
-- Name: idx_tbl_delivery_items_client_deliveries_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_delivery_items_client_deliveries_id ON public.tbl_delivery_items USING btree (client_deliveries_id);


--
-- Name: idx_tbl_delivery_items_corp_facility_inventory_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_delivery_items_corp_facility_inventory_item_id ON public.tbl_delivery_items USING btree (corp_facility_inventory_item_id);


--
-- Name: idx_tbl_delivery_receipt_client_deliveries_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_delivery_receipt_client_deliveries_id ON public.tbl_delivery_receipt USING btree (client_deliveries_id);


--
-- Name: idx_tbl_delivery_staff_client_deliveries_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_delivery_staff_client_deliveries_id ON public.tbl_delivery_staff USING btree (client_deliveries_id);


--
-- Name: idx_tbl_delivery_staff_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_delivery_staff_facility_staff_id ON public.tbl_delivery_staff USING btree (facility_staff_id);


--
-- Name: idx_tbl_delivery_vehicle_client_deliveries_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_delivery_vehicle_client_deliveries_id ON public.tbl_delivery_vehicle USING btree (client_deliveries_id);


--
-- Name: idx_tbl_delivery_vehicle_delivery_vehicle_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_delivery_vehicle_delivery_vehicle_type_id ON public.tbl_delivery_vehicle USING btree (delivery_vehicle_type_id);


--
-- Name: idx_tbl_delivery_vehicle_rental_agency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_delivery_vehicle_rental_agency_id ON public.tbl_delivery_vehicle USING btree (rental_agency_id);


--
-- Name: idx_tbl_delivery_vehicle_vehicle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_delivery_vehicle_vehicle_id ON public.tbl_delivery_vehicle USING btree (vehicle_id);


--
-- Name: idx_tbl_donation_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_campaign_id ON public.tbl_donation USING btree (campaign_id);


--
-- Name: idx_tbl_donation_check_donation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_check_donation_id ON public.tbl_donation_check USING btree (donation_id);


--
-- Name: idx_tbl_donation_designation_donation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_designation_donation_id ON public.tbl_donation_designation USING btree (donation_id);


--
-- Name: idx_tbl_donation_designation_fund_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_designation_fund_id ON public.tbl_donation_designation USING btree (fund_id);


--
-- Name: idx_tbl_donation_donation_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_donation_type_id ON public.tbl_donation USING btree (donation_type_id);


--
-- Name: idx_tbl_donation_donor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_donor_id ON public.tbl_donation USING btree (donor_id);


--
-- Name: idx_tbl_donation_item_donation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_item_donation_id ON public.tbl_donation_item USING btree (donation_id);


--
-- Name: idx_tbl_donation_item_item_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_item_item_category_id ON public.tbl_donation_item USING btree (item_category_id);


--
-- Name: idx_tbl_donation_item_item_condition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_item_item_condition_id ON public.tbl_donation_item USING btree (item_condition_id);


--
-- Name: idx_tbl_donation_item_item_size_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_item_item_size_id ON public.tbl_donation_item USING btree (item_size_id);


--
-- Name: idx_tbl_donation_payment_method_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_payment_method_id ON public.tbl_donation USING btree (payment_method_id);


--
-- Name: idx_tbl_donation_pickup_assigned_lead_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_pickup_assigned_lead_facility_staff_id ON public.tbl_donation_pickup USING btree (assigned_lead_facility_staff_id);


--
-- Name: idx_tbl_donation_pickup_assigned_vehicle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_pickup_assigned_vehicle_id ON public.tbl_donation_pickup USING btree (assigned_vehicle_id);


--
-- Name: idx_tbl_donation_pickup_donor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_pickup_donor_id ON public.tbl_donation_pickup USING btree (donor_id);


--
-- Name: idx_tbl_donation_pickup_pickup_address_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_pickup_pickup_address_id ON public.tbl_donation_pickup USING btree (pickup_address_id);


--
-- Name: idx_tbl_donation_pickup_pickup_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_pickup_pickup_status_id ON public.tbl_donation_pickup USING btree (pickup_status_id);


--
-- Name: idx_tbl_donation_pledge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_pledge_id ON public.tbl_donation USING btree (pledge_id);


--
-- Name: idx_tbl_donation_qbo_sync_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_qbo_sync_status ON public.tbl_donation USING btree (qbo_sync_status) WHERE (qbo_sync_status IS NOT NULL);


--
-- Name: idx_tbl_donation_receipt_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_receipt_number ON public.tbl_donation USING btree (receipt_number);


--
-- Name: idx_tbl_donation_securities_donation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donation_securities_donation_id ON public.tbl_donation_securities USING btree (donation_id);


--
-- Name: idx_tbl_donor_address_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donor_address_id ON public.tbl_donor USING btree (address_id);


--
-- Name: idx_tbl_donor_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donor_contact_id ON public.tbl_donor USING btree (contact_id);


--
-- Name: idx_tbl_donor_donor_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donor_donor_type_id ON public.tbl_donor USING btree (donor_type_id);


--
-- Name: idx_tbl_donor_howtheyfoundus_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donor_howtheyfoundus_id ON public.tbl_donor USING btree (howtheyfoundus_id);


--
-- Name: idx_tbl_donor_stage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_donor_stage_id ON public.tbl_donor USING btree (donor_stage_id);


--
-- Name: idx_tbl_email_account_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_email_account_user ON public.tbl_email_account USING btree (user_account_id);


--
-- Name: idx_tbl_email_account_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tbl_email_account_user_email ON public.tbl_email_account USING btree (user_account_id, lower((email_address)::text));


--
-- Name: idx_tbl_event_address_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_event_address_id ON public.tbl_event USING btree (address_id);


--
-- Name: idx_tbl_event_attendee_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_event_attendee_contact_id ON public.tbl_event_attendee USING btree (contact_id);


--
-- Name: idx_tbl_event_attendee_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_event_attendee_event_id ON public.tbl_event_attendee USING btree (event_id);


--
-- Name: idx_tbl_event_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_event_campaign_id ON public.tbl_event USING btree (campaign_id);


--
-- Name: idx_tbl_event_event_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_event_event_type_id ON public.tbl_event USING btree (event_type_id);


--
-- Name: idx_tbl_facility_staff_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_facility_staff_contact_id ON public.tbl_facility_staff USING btree (contact_id);


--
-- Name: idx_tbl_facility_staff_corp_facility_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_facility_staff_corp_facility_id ON public.tbl_facility_staff USING btree (corp_facility_id);


--
-- Name: idx_tbl_facility_staff_statuses_changed_by_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_facility_staff_statuses_changed_by_facility_staff_id ON public.tbl_facility_staff_statuses USING btree (changed_by_facility_staff_id);


--
-- Name: idx_tbl_facility_staff_statuses_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_facility_staff_statuses_facility_staff_id ON public.tbl_facility_staff_statuses USING btree (facility_staff_id);


--
-- Name: idx_tbl_facility_staff_statuses_facility_staff_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_facility_staff_statuses_facility_staff_status_id ON public.tbl_facility_staff_statuses USING btree (facility_staff_status_id);


--
-- Name: idx_tbl_facility_staff_statuses_status_change_reason_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_facility_staff_statuses_status_change_reason_id ON public.tbl_facility_staff_statuses USING btree (status_change_reason_id);


--
-- Name: idx_tbl_inventory_reservation_client_provisioning_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_inventory_reservation_client_provisioning_request_id ON public.tbl_inventory_reservation USING btree (client_provisioning_request_id);


--
-- Name: idx_tbl_inventory_reservation_corp_facility_inventory_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_inventory_reservation_corp_facility_inventory_item_id ON public.tbl_inventory_reservation USING btree (corp_facility_inventory_item_id);


--
-- Name: idx_tbl_inventory_reservation_reservation_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_inventory_reservation_reservation_status_id ON public.tbl_inventory_reservation USING btree (reservation_status_id);


--
-- Name: idx_tbl_inventory_reservation_reserved_by_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_inventory_reservation_reserved_by_facility_staff_id ON public.tbl_inventory_reservation USING btree (reserved_by_facility_staff_id);


--
-- Name: idx_tbl_note_author_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_note_author_facility_staff_id ON public.tbl_note USING btree (author_facility_staff_id);


--
-- Name: idx_tbl_note_note_entity_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_note_note_entity_type_id ON public.tbl_note USING btree (note_entity_type_id);


--
-- Name: idx_tbl_pledge_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_pledge_campaign_id ON public.tbl_pledge USING btree (campaign_id);


--
-- Name: idx_tbl_pledge_donor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_pledge_donor_id ON public.tbl_pledge USING btree (donor_id);


--
-- Name: idx_tbl_pledge_fund_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_pledge_fund_id ON public.tbl_pledge USING btree (fund_id);


--
-- Name: idx_tbl_pledge_pledge_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_pledge_pledge_status_id ON public.tbl_pledge USING btree (pledge_status_id);


--
-- Name: idx_tbl_quickbooks_account_mapping_fund; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tbl_quickbooks_account_mapping_fund ON public.tbl_quickbooks_account_mapping USING btree (fund_id);


--
-- Name: idx_tbl_quickbooks_connection_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tbl_quickbooks_connection_active ON public.tbl_quickbooks_connection USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_tbl_quickbooks_donation_sync_donation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_quickbooks_donation_sync_donation ON public.tbl_quickbooks_donation_sync USING btree (donation_id);


--
-- Name: idx_tbl_quickbooks_donation_sync_status_attempted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_quickbooks_donation_sync_status_attempted ON public.tbl_quickbooks_donation_sync USING btree (sync_status, attempted_at DESC);


--
-- Name: idx_tbl_quickbooks_donor_link_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_quickbooks_donor_link_customer ON public.tbl_quickbooks_donor_link USING btree (qbo_customer_id);


--
-- Name: idx_tbl_quickbooks_donor_link_donor; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tbl_quickbooks_donor_link_donor ON public.tbl_quickbooks_donor_link USING btree (donor_id);


--
-- Name: idx_tbl_referral_agency_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_referral_agency_contact_id ON public.tbl_referral USING btree (agency_contact_id);


--
-- Name: idx_tbl_referral_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_referral_client_id ON public.tbl_referral USING btree (client_id);


--
-- Name: idx_tbl_request_item_inv_matches_client_request_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_request_item_inv_matches_client_request_items_id ON public.tbl_request_item_inv_matches USING btree (client_request_items_id);


--
-- Name: idx_tbl_request_item_inv_matches_corp_facility_inventory_item_i; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_request_item_inv_matches_corp_facility_inventory_item_i ON public.tbl_request_item_inv_matches USING btree (corp_facility_inventory_item_id);


--
-- Name: idx_tbl_staff_type_staff_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_staff_type_staff_role_id ON public.tbl_staff_type USING btree (staff_role_id);


--
-- Name: idx_tbl_staff_types_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_staff_types_facility_staff_id ON public.tbl_staff_types USING btree (facility_staff_id);


--
-- Name: idx_tbl_staff_types_staff_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_staff_types_staff_type_id ON public.tbl_staff_types USING btree (staff_type_id);


--
-- Name: idx_tbl_user_account_agency_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_user_account_agency_contact_id ON public.tbl_user_account USING btree (agency_contact_id);


--
-- Name: idx_tbl_user_account_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_user_account_facility_staff_id ON public.tbl_user_account USING btree (facility_staff_id);


--
-- Name: idx_tbl_vehicle_corp_facility_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_vehicle_corp_facility_id ON public.tbl_vehicle USING btree (corp_facility_id);


--
-- Name: idx_tbl_vehicle_maintenance_maintenance_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_vehicle_maintenance_maintenance_type_id ON public.tbl_vehicle_maintenance USING btree (maintenance_type_id);


--
-- Name: idx_tbl_vehicle_maintenance_vehicle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_vehicle_maintenance_vehicle_id ON public.tbl_vehicle_maintenance USING btree (vehicle_id);


--
-- Name: idx_tbl_vehicle_mileage_vehicle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_vehicle_mileage_vehicle_id ON public.tbl_vehicle_mileage USING btree (vehicle_id);


--
-- Name: idx_tbl_vehicle_vehicle_make_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_vehicle_vehicle_make_id ON public.tbl_vehicle USING btree (vehicle_make_id);


--
-- Name: idx_tbl_vehicle_vehicle_model_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_vehicle_vehicle_model_id ON public.tbl_vehicle USING btree (vehicle_model_id);


--
-- Name: idx_tbl_vehicle_vehicle_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_vehicle_vehicle_type_id ON public.tbl_vehicle USING btree (vehicle_type_id);


--
-- Name: idx_tbl_volunteer_hours_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_volunteer_hours_facility_staff_id ON public.tbl_volunteer_hours USING btree (facility_staff_id);


--
-- Name: idx_tbl_volunteer_hours_verified_by_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_volunteer_hours_verified_by_facility_staff_id ON public.tbl_volunteer_hours USING btree (verified_by_facility_staff_id);


--
-- Name: idx_tbl_volunteer_hours_volunteer_activity_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_volunteer_hours_volunteer_activity_type_id ON public.tbl_volunteer_hours USING btree (volunteer_activity_type_id);


--
-- Name: idx_tbl_volunteer_profile_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_volunteer_profile_facility_staff_id ON public.tbl_volunteer_profile USING btree (facility_staff_id);


--
-- Name: idx_tbl_volunteer_shift_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_volunteer_shift_date ON public.tbl_volunteer_shift USING btree (shift_date);


--
-- Name: idx_tbl_volunteer_shift_signup_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tbl_volunteer_shift_signup_active ON public.tbl_volunteer_shift_signup USING btree (shift_id, facility_staff_id) WHERE ((signup_status)::text <> 'cancelled'::text);


--
-- Name: idx_tbl_volunteer_shift_signup_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_volunteer_shift_signup_shift ON public.tbl_volunteer_shift_signup USING btree (shift_id);


--
-- Name: idx_tbl_volunteer_shift_signup_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_volunteer_shift_signup_staff ON public.tbl_volunteer_shift_signup USING btree (facility_staff_id);


--
-- Name: idx_tbl_volunteer_skill_facility_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_volunteer_skill_facility_staff_id ON public.tbl_volunteer_skill USING btree (facility_staff_id);


--
-- Name: idx_tbl_volunteer_skill_skill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbl_volunteer_skill_skill_id ON public.tbl_volunteer_skill USING btree (skill_id);


--
-- Name: lkp_city fk_lkp_city_county_id_005; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_city
    ADD CONSTRAINT fk_lkp_city_county_id_005 FOREIGN KEY (county_id) REFERENCES public.lkp_county(county_id);


--
-- Name: lkp_county fk_lkp_county_state_id_006; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_county
    ADD CONSTRAINT fk_lkp_county_state_id_006 FOREIGN KEY (state_id) REFERENCES public.lkp_state(state_id);


--
-- Name: lkp_howtheyfoundus fk_lkp_howtheyfoundus_source_type_id_056; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_howtheyfoundus
    ADD CONSTRAINT fk_lkp_howtheyfoundus_source_type_id_056 FOREIGN KEY (source_type_id) REFERENCES public.lkp_source_type(source_type_id);


--
-- Name: lkp_staff_role fk_lkp_staff_role_role_pay_type_id_036; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_staff_role
    ADD CONSTRAINT fk_lkp_staff_role_role_pay_type_id_036 FOREIGN KEY (role_pay_type_id) REFERENCES public.lkp_role_pay_type(role_pay_type_id);


--
-- Name: lkp_storage_location fk_lkp_storage_location_corp_facility_id_051; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_storage_location
    ADD CONSTRAINT fk_lkp_storage_location_corp_facility_id_051 FOREIGN KEY (corp_facility_id) REFERENCES public.tbl_corp_facility(corp_facility_id);


--
-- Name: lkp_vehicle_model fk_lkp_vehicle_model_vehicle_make_id_096; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_model
    ADD CONSTRAINT fk_lkp_vehicle_model_vehicle_make_id_096 FOREIGN KEY (vehicle_make_id) REFERENCES public.lkp_vehicle_make(vehicle_make_id);


--
-- Name: lkp_vehicle_type fk_lkp_vehicle_type_vehicle_fuel_type_id_098; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_type
    ADD CONSTRAINT fk_lkp_vehicle_type_vehicle_fuel_type_id_098 FOREIGN KEY (vehicle_fuel_type_id) REFERENCES public.lkp_vehicle_fuel_type(vehicle_fuel_type_id);


--
-- Name: lkp_vehicle_type fk_lkp_vehicle_type_vehicle_weight_class_id_097; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_vehicle_type
    ADD CONSTRAINT fk_lkp_vehicle_type_vehicle_weight_class_id_097 FOREIGN KEY (vehicle_weight_class_id) REFERENCES public.lkp_vehicle_weight_class(vehicle_weight_class_id);


--
-- Name: tbl_address fk_tbl_address_address_type_id_001; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_address
    ADD CONSTRAINT fk_tbl_address_address_type_id_001 FOREIGN KEY (address_type_id) REFERENCES public.lkp_address_type(address_type_id);


--
-- Name: tbl_address fk_tbl_address_city_id_002; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_address
    ADD CONSTRAINT fk_tbl_address_city_id_002 FOREIGN KEY (city_id) REFERENCES public.lkp_city(city_id);


--
-- Name: tbl_address fk_tbl_address_county_id_003; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_address
    ADD CONSTRAINT fk_tbl_address_county_id_003 FOREIGN KEY (county_id) REFERENCES public.lkp_county(county_id);


--
-- Name: tbl_address fk_tbl_address_state_id_004; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_address
    ADD CONSTRAINT fk_tbl_address_state_id_004 FOREIGN KEY (state_id) REFERENCES public.lkp_state(state_id);


--
-- Name: tbl_agency fk_tbl_agency_address_id_007; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_agency
    ADD CONSTRAINT fk_tbl_agency_address_id_007 FOREIGN KEY (address_id) REFERENCES public.tbl_address(address_id);


--
-- Name: tbl_agency fk_tbl_agency_agency_type_id_008; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_agency
    ADD CONSTRAINT fk_tbl_agency_agency_type_id_008 FOREIGN KEY (agency_type_id) REFERENCES public.lkp_agency_type(agency_type_id);


--
-- Name: tbl_agency_contact fk_tbl_agency_contact_agency_id_009; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_agency_contact
    ADD CONSTRAINT fk_tbl_agency_contact_agency_id_009 FOREIGN KEY (agency_id) REFERENCES public.tbl_agency(agency_id);


--
-- Name: tbl_agency_contact fk_tbl_agency_contact_contact_id_010; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_agency_contact
    ADD CONSTRAINT fk_tbl_agency_contact_contact_id_010 FOREIGN KEY (contact_id) REFERENCES public.tbl_contact(contact_id);


--
-- Name: tbl_attachment fk_tbl_attachment_attachment_entity_type_id_102; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_attachment
    ADD CONSTRAINT fk_tbl_attachment_attachment_entity_type_id_102 FOREIGN KEY (attachment_entity_type_id) REFERENCES public.lkp_attachment_entity_type(attachment_entity_type_id);


--
-- Name: tbl_attachment fk_tbl_attachment_uploaded_by_facility_staff_id_103; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_attachment
    ADD CONSTRAINT fk_tbl_attachment_uploaded_by_facility_staff_id_103 FOREIGN KEY (uploaded_by_facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_audit_log fk_tbl_audit_log_user_account_id_109; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_audit_log
    ADD CONSTRAINT fk_tbl_audit_log_user_account_id_109 FOREIGN KEY (user_account_id) REFERENCES public.tbl_user_account(user_account_id);


--
-- Name: tbl_client fk_tbl_client_client_status_id_018; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client
    ADD CONSTRAINT fk_tbl_client_client_status_id_018 FOREIGN KEY (client_status_id) REFERENCES public.lkp_client_status(client_status_id);


--
-- Name: tbl_client fk_tbl_client_client_type_id_016; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client
    ADD CONSTRAINT fk_tbl_client_client_type_id_016 FOREIGN KEY (client_type_id) REFERENCES public.lkp_client_type(client_type_id);


--
-- Name: tbl_client fk_tbl_client_contact_id_017; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client
    ADD CONSTRAINT fk_tbl_client_contact_id_017 FOREIGN KEY (contact_id) REFERENCES public.tbl_contact(contact_id);


--
-- Name: tbl_client_deliveries fk_tbl_client_deliveries_client_provisioning_request_id_080; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_deliveries
    ADD CONSTRAINT fk_tbl_client_deliveries_client_provisioning_request_id_080 FOREIGN KEY (client_provisioning_request_id) REFERENCES public.tbl_client_provisioning_request(client_provisioning_request_id);


--
-- Name: tbl_client_deliveries fk_tbl_client_deliveries_delivery_status_id_082; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_deliveries
    ADD CONSTRAINT fk_tbl_client_deliveries_delivery_status_id_082 FOREIGN KEY (delivery_status_id) REFERENCES public.lkp_delivery_status(delivery_status_id);


--
-- Name: tbl_client_deliveries fk_tbl_client_deliveries_facility_staff_id_081; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_deliveries
    ADD CONSTRAINT fk_tbl_client_deliveries_facility_staff_id_081 FOREIGN KEY (facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_client_provisioning_request fk_tbl_client_provisioning_request_client_id_068; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_provisioning_request
    ADD CONSTRAINT fk_tbl_client_provisioning_request_client_id_068 FOREIGN KEY (client_id) REFERENCES public.tbl_client(client_id);


--
-- Name: tbl_client_provisioning_request fk_tbl_client_provisioning_request_client_request_creator_facil; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_provisioning_request
    ADD CONSTRAINT fk_tbl_client_provisioning_request_client_request_creator_facil FOREIGN KEY (client_request_creator_facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_client_provisioning_request fk_tbl_client_provisioning_request_fulfillment_corp_facility_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_provisioning_request
    ADD CONSTRAINT fk_tbl_client_provisioning_request_fulfillment_corp_facility_id FOREIGN KEY (fulfillment_corp_facility_id) REFERENCES public.tbl_corp_facility(corp_facility_id);


--
-- Name: tbl_client_provisioning_request fk_tbl_client_provisioning_request_request_receipt_origin_id_07; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_provisioning_request
    ADD CONSTRAINT fk_tbl_client_provisioning_request_request_receipt_origin_id_07 FOREIGN KEY (request_receipt_origin_id) REFERENCES public.lkp_request_receipt_origin(request_receipt_origin_id);


--
-- Name: tbl_client_request_items fk_tbl_client_request_items_client_provisioning_request_id_072; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_request_items
    ADD CONSTRAINT fk_tbl_client_request_items_client_provisioning_request_id_072 FOREIGN KEY (client_provisioning_request_id) REFERENCES public.tbl_client_provisioning_request(client_provisioning_request_id);


--
-- Name: tbl_client_request_items fk_tbl_client_request_items_item_category_id_073; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_client_request_items
    ADD CONSTRAINT fk_tbl_client_request_items_item_category_id_073 FOREIGN KEY (item_category_id) REFERENCES public.lkp_item_category(item_category_id);


--
-- Name: tbl_communication_log fk_tbl_communication_log_communication_method_id_107; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_communication_log
    ADD CONSTRAINT fk_tbl_communication_log_communication_method_id_107 FOREIGN KEY (communication_method_id) REFERENCES public.lkp_communication_method(communication_method_id);


--
-- Name: tbl_communication_log fk_tbl_communication_log_facility_staff_id_108; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_communication_log
    ADD CONSTRAINT fk_tbl_communication_log_facility_staff_id_108 FOREIGN KEY (facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_communication_log fk_tbl_communication_log_note_entity_type_id_106; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_communication_log
    ADD CONSTRAINT fk_tbl_communication_log_note_entity_type_id_106 FOREIGN KEY (note_entity_type_id) REFERENCES public.lkp_note_entity_type(note_entity_type_id);


--
-- Name: tbl_contact fk_tbl_contact_address_id_015; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_contact
    ADD CONSTRAINT fk_tbl_contact_address_id_015 FOREIGN KEY (address_id) REFERENCES public.tbl_address(address_id);


--
-- Name: tbl_contact fk_tbl_contact_citizen_status_id_014; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_contact
    ADD CONSTRAINT fk_tbl_contact_citizen_status_id_014 FOREIGN KEY (citizen_status_id) REFERENCES public.lkp_citizen_status(citizen_status_id);


--
-- Name: tbl_contact fk_tbl_contact_contact_type_id_011; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_contact
    ADD CONSTRAINT fk_tbl_contact_contact_type_id_011 FOREIGN KEY (contact_type_id) REFERENCES public.lkp_contact_type(contact_type_id);


--
-- Name: tbl_contact fk_tbl_contact_ethnicity_id_013; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_contact
    ADD CONSTRAINT fk_tbl_contact_ethnicity_id_013 FOREIGN KEY (ethnicity_id) REFERENCES public.lkp_ethnicity(ethnicity_id);


--
-- Name: tbl_contact fk_tbl_contact_gender_id_012; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_contact
    ADD CONSTRAINT fk_tbl_contact_gender_id_012 FOREIGN KEY (gender_id) REFERENCES public.lkp_gender(gender_id);


--
-- Name: tbl_corp_facility fk_tbl_corp_facility_address_id_025; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility
    ADD CONSTRAINT fk_tbl_corp_facility_address_id_025 FOREIGN KEY (address_id) REFERENCES public.tbl_address(address_id);


--
-- Name: tbl_corp_facility fk_tbl_corp_facility_contact_id_024; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility
    ADD CONSTRAINT fk_tbl_corp_facility_contact_id_024 FOREIGN KEY (contact_id) REFERENCES public.tbl_contact(contact_id);


--
-- Name: tbl_corp_facility fk_tbl_corp_facility_corporate_id_023; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility
    ADD CONSTRAINT fk_tbl_corp_facility_corporate_id_023 FOREIGN KEY (corporate_id) REFERENCES public.tbl_corporate(corporate_id);


--
-- Name: tbl_corp_facility fk_tbl_corp_facility_facility_type_id_026; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility
    ADD CONSTRAINT fk_tbl_corp_facility_facility_type_id_026 FOREIGN KEY (facility_type_id) REFERENCES public.lkp_facility_type(facility_type_id);


--
-- Name: tbl_corp_facility_inventory_item fk_tbl_corp_facility_inventory_item_corp_facility_id_043; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility_inventory_item
    ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_corp_facility_id_043 FOREIGN KEY (corp_facility_id) REFERENCES public.tbl_corp_facility(corp_facility_id);


--
-- Name: tbl_corp_facility_inventory_item fk_tbl_corp_facility_inventory_item_disposition_reason_id_050; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility_inventory_item
    ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_disposition_reason_id_050 FOREIGN KEY (disposition_reason_id) REFERENCES public.lkp_disposition_reason(disposition_reason_id);


--
-- Name: tbl_corp_facility_inventory_item fk_tbl_corp_facility_inventory_item_donation_item_id_044; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility_inventory_item
    ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_donation_item_id_044 FOREIGN KEY (donation_item_id) REFERENCES public.tbl_donation_item(donation_item_id);


--
-- Name: tbl_corp_facility_inventory_item fk_tbl_corp_facility_inventory_item_item_category_id_046; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility_inventory_item
    ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_item_category_id_046 FOREIGN KEY (item_category_id) REFERENCES public.lkp_item_category(item_category_id);


--
-- Name: tbl_corp_facility_inventory_item fk_tbl_corp_facility_inventory_item_item_condition_id_049; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility_inventory_item
    ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_item_condition_id_049 FOREIGN KEY (item_condition_id) REFERENCES public.lkp_item_condition(item_condition_id);


--
-- Name: tbl_corp_facility_inventory_item fk_tbl_corp_facility_inventory_item_item_size_id_047; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility_inventory_item
    ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_item_size_id_047 FOREIGN KEY (item_size_id) REFERENCES public.lkp_item_size(item_size_id);


--
-- Name: tbl_corp_facility_inventory_item fk_tbl_corp_facility_inventory_item_item_weight_id_048; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility_inventory_item
    ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_item_weight_id_048 FOREIGN KEY (item_weight_id) REFERENCES public.lkp_item_weight(item_weight_id);


--
-- Name: tbl_corp_facility_inventory_item fk_tbl_corp_facility_inventory_item_storage_location_id_045; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corp_facility_inventory_item
    ADD CONSTRAINT fk_tbl_corp_facility_inventory_item_storage_location_id_045 FOREIGN KEY (storage_location_id) REFERENCES public.lkp_storage_location(storage_location_id);


--
-- Name: tbl_corporate fk_tbl_corporate_corp_type_id_021; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corporate
    ADD CONSTRAINT fk_tbl_corporate_corp_type_id_021 FOREIGN KEY (corp_type_id) REFERENCES public.lkp_corp_type(corp_type_id);


--
-- Name: tbl_corporate fk_tbl_corporate_incorp_state_id_022; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_corporate
    ADD CONSTRAINT fk_tbl_corporate_incorp_state_id_022 FOREIGN KEY (incorp_state_id) REFERENCES public.lkp_state(state_id);


--
-- Name: tbl_delivery_items fk_tbl_delivery_items_client_deliveries_id_083; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_items
    ADD CONSTRAINT fk_tbl_delivery_items_client_deliveries_id_083 FOREIGN KEY (client_deliveries_id) REFERENCES public.tbl_client_deliveries(client_deliveries_id);


--
-- Name: tbl_delivery_items fk_tbl_delivery_items_corp_facility_inventory_item_id_084; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_items
    ADD CONSTRAINT fk_tbl_delivery_items_corp_facility_inventory_item_id_084 FOREIGN KEY (corp_facility_inventory_item_id) REFERENCES public.tbl_corp_facility_inventory_item(corp_facility_inventory_item_id);


--
-- Name: tbl_delivery_receipt fk_tbl_delivery_receipt_client_deliveries_id_091; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_receipt
    ADD CONSTRAINT fk_tbl_delivery_receipt_client_deliveries_id_091 FOREIGN KEY (client_deliveries_id) REFERENCES public.tbl_client_deliveries(client_deliveries_id);


--
-- Name: tbl_delivery_staff fk_tbl_delivery_staff_client_deliveries_id_085; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_staff
    ADD CONSTRAINT fk_tbl_delivery_staff_client_deliveries_id_085 FOREIGN KEY (client_deliveries_id) REFERENCES public.tbl_client_deliveries(client_deliveries_id);


--
-- Name: tbl_delivery_staff fk_tbl_delivery_staff_facility_staff_id_086; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_staff
    ADD CONSTRAINT fk_tbl_delivery_staff_facility_staff_id_086 FOREIGN KEY (facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_delivery_vehicle fk_tbl_delivery_vehicle_client_deliveries_id_087; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_vehicle
    ADD CONSTRAINT fk_tbl_delivery_vehicle_client_deliveries_id_087 FOREIGN KEY (client_deliveries_id) REFERENCES public.tbl_client_deliveries(client_deliveries_id);


--
-- Name: tbl_delivery_vehicle fk_tbl_delivery_vehicle_delivery_vehicle_type_id_088; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_vehicle
    ADD CONSTRAINT fk_tbl_delivery_vehicle_delivery_vehicle_type_id_088 FOREIGN KEY (delivery_vehicle_type_id) REFERENCES public.lkp_delivery_vehicle_type(delivery_vehicle_type_id);


--
-- Name: tbl_delivery_vehicle fk_tbl_delivery_vehicle_rental_agency_id_090; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_vehicle
    ADD CONSTRAINT fk_tbl_delivery_vehicle_rental_agency_id_090 FOREIGN KEY (rental_agency_id) REFERENCES public.lkp_rental_agency(rental_agency_id);


--
-- Name: tbl_delivery_vehicle fk_tbl_delivery_vehicle_vehicle_id_089; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_delivery_vehicle
    ADD CONSTRAINT fk_tbl_delivery_vehicle_vehicle_id_089 FOREIGN KEY (vehicle_id) REFERENCES public.tbl_vehicle(vehicle_id);


--
-- Name: tbl_donation fk_tbl_donation_campaign_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation
    ADD CONSTRAINT fk_tbl_donation_campaign_id FOREIGN KEY (campaign_id) REFERENCES public.tbl_campaign(campaign_id);


--
-- Name: tbl_donation fk_tbl_donation_donation_type_id_058; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation
    ADD CONSTRAINT fk_tbl_donation_donation_type_id_058 FOREIGN KEY (donation_type_id) REFERENCES public.lkp_donation_type(donation_type_id);


--
-- Name: tbl_donation fk_tbl_donation_donor_id_057; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation
    ADD CONSTRAINT fk_tbl_donation_donor_id_057 FOREIGN KEY (donor_id) REFERENCES public.tbl_donor(donor_id);


--
-- Name: tbl_donation_item fk_tbl_donation_item_donation_id_059; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_item
    ADD CONSTRAINT fk_tbl_donation_item_donation_id_059 FOREIGN KEY (donation_id) REFERENCES public.tbl_donation(donation_id);


--
-- Name: tbl_donation_item fk_tbl_donation_item_item_category_id_060; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_item
    ADD CONSTRAINT fk_tbl_donation_item_item_category_id_060 FOREIGN KEY (item_category_id) REFERENCES public.lkp_item_category(item_category_id);


--
-- Name: tbl_donation_item fk_tbl_donation_item_item_condition_id_061; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_item
    ADD CONSTRAINT fk_tbl_donation_item_item_condition_id_061 FOREIGN KEY (item_condition_id) REFERENCES public.lkp_item_condition(item_condition_id);


--
-- Name: tbl_donation_item fk_tbl_donation_item_item_size_id_062; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_item
    ADD CONSTRAINT fk_tbl_donation_item_item_size_id_062 FOREIGN KEY (item_size_id) REFERENCES public.lkp_item_size(item_size_id);


--
-- Name: tbl_donation_pickup fk_tbl_donation_pickup_assigned_lead_facility_staff_id_067; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_pickup
    ADD CONSTRAINT fk_tbl_donation_pickup_assigned_lead_facility_staff_id_067 FOREIGN KEY (assigned_lead_facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_donation_pickup fk_tbl_donation_pickup_assigned_vehicle_id_066; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_pickup
    ADD CONSTRAINT fk_tbl_donation_pickup_assigned_vehicle_id_066 FOREIGN KEY (assigned_vehicle_id) REFERENCES public.tbl_vehicle(vehicle_id);


--
-- Name: tbl_donation_pickup fk_tbl_donation_pickup_donor_id_063; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_pickup
    ADD CONSTRAINT fk_tbl_donation_pickup_donor_id_063 FOREIGN KEY (donor_id) REFERENCES public.tbl_donor(donor_id);


--
-- Name: tbl_donation_pickup fk_tbl_donation_pickup_pickup_address_id_064; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_pickup
    ADD CONSTRAINT fk_tbl_donation_pickup_pickup_address_id_064 FOREIGN KEY (pickup_address_id) REFERENCES public.tbl_address(address_id);


--
-- Name: tbl_donation_pickup fk_tbl_donation_pickup_pickup_status_id_065; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_pickup
    ADD CONSTRAINT fk_tbl_donation_pickup_pickup_status_id_065 FOREIGN KEY (pickup_status_id) REFERENCES public.lkp_pickup_status(pickup_status_id);


--
-- Name: tbl_donor fk_tbl_donor_address_id_054; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donor
    ADD CONSTRAINT fk_tbl_donor_address_id_054 FOREIGN KEY (address_id) REFERENCES public.tbl_address(address_id);


--
-- Name: tbl_donor fk_tbl_donor_contact_id_053; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donor
    ADD CONSTRAINT fk_tbl_donor_contact_id_053 FOREIGN KEY (contact_id) REFERENCES public.tbl_contact(contact_id);


--
-- Name: tbl_donor fk_tbl_donor_donor_type_id_052; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donor
    ADD CONSTRAINT fk_tbl_donor_donor_type_id_052 FOREIGN KEY (donor_type_id) REFERENCES public.lkp_donor_type(donor_type_id);


--
-- Name: tbl_donor fk_tbl_donor_howtheyfoundus_id_055; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donor
    ADD CONSTRAINT fk_tbl_donor_howtheyfoundus_id_055 FOREIGN KEY (howtheyfoundus_id) REFERENCES public.lkp_howtheyfoundus(howtheyfoundus_id);


--
-- Name: tbl_event fk_tbl_event_address_id_113; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_event
    ADD CONSTRAINT fk_tbl_event_address_id_113 FOREIGN KEY (address_id) REFERENCES public.tbl_address(address_id);


--
-- Name: tbl_event_attendee fk_tbl_event_attendee_contact_id_115; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_event_attendee
    ADD CONSTRAINT fk_tbl_event_attendee_contact_id_115 FOREIGN KEY (contact_id) REFERENCES public.tbl_contact(contact_id);


--
-- Name: tbl_event_attendee fk_tbl_event_attendee_event_id_114; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_event_attendee
    ADD CONSTRAINT fk_tbl_event_attendee_event_id_114 FOREIGN KEY (event_id) REFERENCES public.tbl_event(event_id);


--
-- Name: tbl_event fk_tbl_event_event_type_id_112; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_event
    ADD CONSTRAINT fk_tbl_event_event_type_id_112 FOREIGN KEY (event_type_id) REFERENCES public.lkp_event_type(event_type_id);


--
-- Name: tbl_facility_staff fk_tbl_facility_staff_contact_id_028; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_facility_staff
    ADD CONSTRAINT fk_tbl_facility_staff_contact_id_028 FOREIGN KEY (contact_id) REFERENCES public.tbl_contact(contact_id);


--
-- Name: tbl_facility_staff fk_tbl_facility_staff_corp_facility_id_027; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_facility_staff
    ADD CONSTRAINT fk_tbl_facility_staff_corp_facility_id_027 FOREIGN KEY (corp_facility_id) REFERENCES public.tbl_corp_facility(corp_facility_id);


--
-- Name: tbl_facility_staff_statuses fk_tbl_facility_staff_statuses_changed_by_facility_staff_id_031; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_facility_staff_statuses
    ADD CONSTRAINT fk_tbl_facility_staff_statuses_changed_by_facility_staff_id_031 FOREIGN KEY (changed_by_facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_facility_staff_statuses fk_tbl_facility_staff_statuses_facility_staff_id_029; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_facility_staff_statuses
    ADD CONSTRAINT fk_tbl_facility_staff_statuses_facility_staff_id_029 FOREIGN KEY (facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_facility_staff_statuses fk_tbl_facility_staff_statuses_facility_staff_status_id_030; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_facility_staff_statuses
    ADD CONSTRAINT fk_tbl_facility_staff_statuses_facility_staff_status_id_030 FOREIGN KEY (facility_staff_status_id) REFERENCES public.lkp_facility_staff_status(facility_staff_status_id);


--
-- Name: tbl_facility_staff_statuses fk_tbl_facility_staff_statuses_status_change_reason_id_032; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_facility_staff_statuses
    ADD CONSTRAINT fk_tbl_facility_staff_statuses_status_change_reason_id_032 FOREIGN KEY (status_change_reason_id) REFERENCES public.lkp_status_change_reason(status_change_reason_id);


--
-- Name: tbl_inventory_reservation fk_tbl_inventory_reservation_client_provisioning_request_id_077; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_inventory_reservation
    ADD CONSTRAINT fk_tbl_inventory_reservation_client_provisioning_request_id_077 FOREIGN KEY (client_provisioning_request_id) REFERENCES public.tbl_client_provisioning_request(client_provisioning_request_id);


--
-- Name: tbl_inventory_reservation fk_tbl_inventory_reservation_corp_facility_inventory_item_id_07; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_inventory_reservation
    ADD CONSTRAINT fk_tbl_inventory_reservation_corp_facility_inventory_item_id_07 FOREIGN KEY (corp_facility_inventory_item_id) REFERENCES public.tbl_corp_facility_inventory_item(corp_facility_inventory_item_id);


--
-- Name: tbl_inventory_reservation fk_tbl_inventory_reservation_reservation_status_id_078; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_inventory_reservation
    ADD CONSTRAINT fk_tbl_inventory_reservation_reservation_status_id_078 FOREIGN KEY (reservation_status_id) REFERENCES public.lkp_reservation_status(reservation_status_id);


--
-- Name: tbl_inventory_reservation fk_tbl_inventory_reservation_reserved_by_facility_staff_id_079; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_inventory_reservation
    ADD CONSTRAINT fk_tbl_inventory_reservation_reserved_by_facility_staff_id_079 FOREIGN KEY (reserved_by_facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_note fk_tbl_note_author_facility_staff_id_105; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_note
    ADD CONSTRAINT fk_tbl_note_author_facility_staff_id_105 FOREIGN KEY (author_facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_note fk_tbl_note_note_entity_type_id_104; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_note
    ADD CONSTRAINT fk_tbl_note_note_entity_type_id_104 FOREIGN KEY (note_entity_type_id) REFERENCES public.lkp_note_entity_type(note_entity_type_id);


--
-- Name: tbl_pledge fk_tbl_pledge_campaign_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_pledge
    ADD CONSTRAINT fk_tbl_pledge_campaign_id FOREIGN KEY (campaign_id) REFERENCES public.tbl_campaign(campaign_id);


--
-- Name: tbl_referral fk_tbl_referral_agency_contact_id_019; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_referral
    ADD CONSTRAINT fk_tbl_referral_agency_contact_id_019 FOREIGN KEY (agency_contact_id) REFERENCES public.tbl_agency_contact(agency_contact_id);


--
-- Name: tbl_referral fk_tbl_referral_client_id_020; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_referral
    ADD CONSTRAINT fk_tbl_referral_client_id_020 FOREIGN KEY (client_id) REFERENCES public.tbl_client(client_id);


--
-- Name: tbl_request_item_inv_matches fk_tbl_request_item_inv_matches_client_request_items_id_074; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_request_item_inv_matches
    ADD CONSTRAINT fk_tbl_request_item_inv_matches_client_request_items_id_074 FOREIGN KEY (client_request_items_id) REFERENCES public.tbl_client_request_items(client_request_items_id);


--
-- Name: tbl_request_item_inv_matches fk_tbl_request_item_inv_matches_corp_facility_inventory_item_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_request_item_inv_matches
    ADD CONSTRAINT fk_tbl_request_item_inv_matches_corp_facility_inventory_item_id FOREIGN KEY (corp_facility_inventory_item_id) REFERENCES public.tbl_corp_facility_inventory_item(corp_facility_inventory_item_id);


--
-- Name: tbl_staff_type fk_tbl_staff_type_staff_role_id_033; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_staff_type
    ADD CONSTRAINT fk_tbl_staff_type_staff_role_id_033 FOREIGN KEY (staff_role_id) REFERENCES public.lkp_staff_role(staff_role_id);


--
-- Name: tbl_staff_types fk_tbl_staff_types_facility_staff_id_034; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_staff_types
    ADD CONSTRAINT fk_tbl_staff_types_facility_staff_id_034 FOREIGN KEY (facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_staff_types fk_tbl_staff_types_staff_type_id_035; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_staff_types
    ADD CONSTRAINT fk_tbl_staff_types_staff_type_id_035 FOREIGN KEY (staff_type_id) REFERENCES public.tbl_staff_type(staff_type_id);


--
-- Name: tbl_user_account fk_tbl_user_account_agency_contact_id_111; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_user_account
    ADD CONSTRAINT fk_tbl_user_account_agency_contact_id_111 FOREIGN KEY (agency_contact_id) REFERENCES public.tbl_agency_contact(agency_contact_id);


--
-- Name: tbl_user_account fk_tbl_user_account_facility_staff_id_110; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_user_account
    ADD CONSTRAINT fk_tbl_user_account_facility_staff_id_110 FOREIGN KEY (facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_vehicle fk_tbl_vehicle_corp_facility_id_092; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle
    ADD CONSTRAINT fk_tbl_vehicle_corp_facility_id_092 FOREIGN KEY (corp_facility_id) REFERENCES public.tbl_corp_facility(corp_facility_id);


--
-- Name: tbl_vehicle_maintenance fk_tbl_vehicle_maintenance_maintenance_type_id_101; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle_maintenance
    ADD CONSTRAINT fk_tbl_vehicle_maintenance_maintenance_type_id_101 FOREIGN KEY (maintenance_type_id) REFERENCES public.lkp_maintenance_type(maintenance_type_id);


--
-- Name: tbl_vehicle_maintenance fk_tbl_vehicle_maintenance_vehicle_id_100; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle_maintenance
    ADD CONSTRAINT fk_tbl_vehicle_maintenance_vehicle_id_100 FOREIGN KEY (vehicle_id) REFERENCES public.tbl_vehicle(vehicle_id);


--
-- Name: tbl_vehicle_mileage fk_tbl_vehicle_mileage_vehicle_id_099; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle_mileage
    ADD CONSTRAINT fk_tbl_vehicle_mileage_vehicle_id_099 FOREIGN KEY (vehicle_id) REFERENCES public.tbl_vehicle(vehicle_id);


--
-- Name: tbl_vehicle fk_tbl_vehicle_vehicle_make_id_093; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle
    ADD CONSTRAINT fk_tbl_vehicle_vehicle_make_id_093 FOREIGN KEY (vehicle_make_id) REFERENCES public.lkp_vehicle_make(vehicle_make_id);


--
-- Name: tbl_vehicle fk_tbl_vehicle_vehicle_model_id_094; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle
    ADD CONSTRAINT fk_tbl_vehicle_vehicle_model_id_094 FOREIGN KEY (vehicle_model_id) REFERENCES public.lkp_vehicle_model(vehicle_model_id);


--
-- Name: tbl_vehicle fk_tbl_vehicle_vehicle_type_id_095; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_vehicle
    ADD CONSTRAINT fk_tbl_vehicle_vehicle_type_id_095 FOREIGN KEY (vehicle_type_id) REFERENCES public.lkp_vehicle_type(vehicle_type_id);


--
-- Name: tbl_volunteer_hours fk_tbl_volunteer_hours_facility_staff_id_040; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_hours
    ADD CONSTRAINT fk_tbl_volunteer_hours_facility_staff_id_040 FOREIGN KEY (facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_volunteer_hours fk_tbl_volunteer_hours_verified_by_facility_staff_id_042; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_hours
    ADD CONSTRAINT fk_tbl_volunteer_hours_verified_by_facility_staff_id_042 FOREIGN KEY (verified_by_facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_volunteer_hours fk_tbl_volunteer_hours_volunteer_activity_type_id_041; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_hours
    ADD CONSTRAINT fk_tbl_volunteer_hours_volunteer_activity_type_id_041 FOREIGN KEY (volunteer_activity_type_id) REFERENCES public.lkp_volunteer_activity_type(volunteer_activity_type_id);


--
-- Name: tbl_volunteer_profile fk_tbl_volunteer_profile_facility_staff_id_037; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_profile
    ADD CONSTRAINT fk_tbl_volunteer_profile_facility_staff_id_037 FOREIGN KEY (facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_volunteer_skill fk_tbl_volunteer_skill_facility_staff_id_038; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_skill
    ADD CONSTRAINT fk_tbl_volunteer_skill_facility_staff_id_038 FOREIGN KEY (facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_volunteer_skill fk_tbl_volunteer_skill_skill_id_039; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_skill
    ADD CONSTRAINT fk_tbl_volunteer_skill_skill_id_039 FOREIGN KEY (skill_id) REFERENCES public.lkp_skill(skill_id);


--
-- Name: lkp_fund lkp_fund_default_restriction_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lkp_fund
    ADD CONSTRAINT lkp_fund_default_restriction_type_id_fkey FOREIGN KEY (default_restriction_type_id) REFERENCES public.lkp_restriction_type(restriction_type_id);


--
-- Name: tbl_app_setting tbl_app_setting_updated_by_user_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_app_setting
    ADD CONSTRAINT tbl_app_setting_updated_by_user_account_id_fkey FOREIGN KEY (updated_by_user_account_id) REFERENCES public.tbl_user_account(user_account_id);


--
-- Name: tbl_campaign tbl_campaign_campaign_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_campaign
    ADD CONSTRAINT tbl_campaign_campaign_status_id_fkey FOREIGN KEY (campaign_status_id) REFERENCES public.lkp_campaign_status(campaign_status_id);


--
-- Name: tbl_campaign tbl_campaign_campaign_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_campaign
    ADD CONSTRAINT tbl_campaign_campaign_type_id_fkey FOREIGN KEY (campaign_type_id) REFERENCES public.lkp_campaign_type(campaign_type_id);


--
-- Name: tbl_campaign tbl_campaign_created_by_user_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_campaign
    ADD CONSTRAINT tbl_campaign_created_by_user_account_id_fkey FOREIGN KEY (created_by_user_account_id) REFERENCES public.tbl_user_account(user_account_id);


--
-- Name: tbl_campaign tbl_campaign_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_campaign
    ADD CONSTRAINT tbl_campaign_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.lkp_fund(fund_id);


--
-- Name: tbl_campaign tbl_campaign_manager_facility_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_campaign
    ADD CONSTRAINT tbl_campaign_manager_facility_staff_id_fkey FOREIGN KEY (manager_facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_donation tbl_donation_acknowledgement_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation
    ADD CONSTRAINT tbl_donation_acknowledgement_status_id_fkey FOREIGN KEY (acknowledgement_status_id) REFERENCES public.lkp_acknowledgement_status(acknowledgement_status_id);


--
-- Name: tbl_donation_check tbl_donation_check_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_check
    ADD CONSTRAINT tbl_donation_check_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.tbl_donation(donation_id) ON DELETE CASCADE;


--
-- Name: tbl_donation_designation tbl_donation_designation_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_designation
    ADD CONSTRAINT tbl_donation_designation_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.tbl_donation(donation_id) ON DELETE CASCADE;


--
-- Name: tbl_donation_designation tbl_donation_designation_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_designation
    ADD CONSTRAINT tbl_donation_designation_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.lkp_fund(fund_id);


--
-- Name: tbl_donation tbl_donation_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation
    ADD CONSTRAINT tbl_donation_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.lkp_payment_method(payment_method_id);


--
-- Name: tbl_donation tbl_donation_pledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation
    ADD CONSTRAINT tbl_donation_pledge_id_fkey FOREIGN KEY (pledge_id) REFERENCES public.tbl_pledge(pledge_id);


--
-- Name: tbl_donation tbl_donation_qbo_current_sync_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation
    ADD CONSTRAINT tbl_donation_qbo_current_sync_id_fkey FOREIGN KEY (qbo_current_sync_id) REFERENCES public.tbl_quickbooks_donation_sync(sync_id);


--
-- Name: tbl_donation_securities tbl_donation_securities_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation_securities
    ADD CONSTRAINT tbl_donation_securities_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.tbl_donation(donation_id) ON DELETE CASCADE;


--
-- Name: tbl_donation tbl_donation_soft_credit_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation
    ADD CONSTRAINT tbl_donation_soft_credit_contact_id_fkey FOREIGN KEY (soft_credit_contact_id) REFERENCES public.tbl_contact(contact_id);


--
-- Name: tbl_donation tbl_donation_solicitation_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donation
    ADD CONSTRAINT tbl_donation_solicitation_method_id_fkey FOREIGN KEY (solicitation_method_id) REFERENCES public.lkp_solicitation_method(solicitation_method_id);


--
-- Name: tbl_donor tbl_donor_donor_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donor
    ADD CONSTRAINT tbl_donor_donor_stage_id_fkey FOREIGN KEY (donor_stage_id) REFERENCES public.lkp_donor_stage(donor_stage_id);


--
-- Name: tbl_donor tbl_donor_preferred_contact_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_donor
    ADD CONSTRAINT tbl_donor_preferred_contact_method_id_fkey FOREIGN KEY (preferred_contact_method_id) REFERENCES public.lkp_communication_method(communication_method_id);


--
-- Name: tbl_email_account tbl_email_account_user_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_email_account
    ADD CONSTRAINT tbl_email_account_user_account_id_fkey FOREIGN KEY (user_account_id) REFERENCES public.tbl_user_account(user_account_id) ON DELETE CASCADE;


--
-- Name: tbl_event tbl_event_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_event
    ADD CONSTRAINT tbl_event_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.tbl_campaign(campaign_id);


--
-- Name: tbl_pledge tbl_pledge_created_by_user_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_pledge
    ADD CONSTRAINT tbl_pledge_created_by_user_account_id_fkey FOREIGN KEY (created_by_user_account_id) REFERENCES public.tbl_user_account(user_account_id);


--
-- Name: tbl_pledge tbl_pledge_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_pledge
    ADD CONSTRAINT tbl_pledge_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.tbl_donor(donor_id);


--
-- Name: tbl_pledge tbl_pledge_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_pledge
    ADD CONSTRAINT tbl_pledge_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.lkp_fund(fund_id);


--
-- Name: tbl_pledge tbl_pledge_pledge_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_pledge
    ADD CONSTRAINT tbl_pledge_pledge_status_id_fkey FOREIGN KEY (pledge_status_id) REFERENCES public.lkp_pledge_status(pledge_status_id);


--
-- Name: tbl_pledge tbl_pledge_solicitation_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_pledge
    ADD CONSTRAINT tbl_pledge_solicitation_method_id_fkey FOREIGN KEY (solicitation_method_id) REFERENCES public.lkp_solicitation_method(solicitation_method_id);


--
-- Name: tbl_quickbooks_account_mapping tbl_quickbooks_account_mapping_created_by_user_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_account_mapping
    ADD CONSTRAINT tbl_quickbooks_account_mapping_created_by_user_account_id_fkey FOREIGN KEY (created_by_user_account_id) REFERENCES public.tbl_user_account(user_account_id);


--
-- Name: tbl_quickbooks_account_mapping tbl_quickbooks_account_mapping_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_account_mapping
    ADD CONSTRAINT tbl_quickbooks_account_mapping_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.lkp_fund(fund_id) ON DELETE CASCADE;


--
-- Name: tbl_quickbooks_connection tbl_quickbooks_connection_connected_by_user_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_connection
    ADD CONSTRAINT tbl_quickbooks_connection_connected_by_user_account_id_fkey FOREIGN KEY (connected_by_user_account_id) REFERENCES public.tbl_user_account(user_account_id);


--
-- Name: tbl_quickbooks_donation_sync tbl_quickbooks_donation_sync_attempted_by_user_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_donation_sync
    ADD CONSTRAINT tbl_quickbooks_donation_sync_attempted_by_user_account_id_fkey FOREIGN KEY (attempted_by_user_account_id) REFERENCES public.tbl_user_account(user_account_id);


--
-- Name: tbl_quickbooks_donation_sync tbl_quickbooks_donation_sync_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_donation_sync
    ADD CONSTRAINT tbl_quickbooks_donation_sync_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.tbl_donation(donation_id) ON DELETE CASCADE;


--
-- Name: tbl_quickbooks_donor_link tbl_quickbooks_donor_link_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_quickbooks_donor_link
    ADD CONSTRAINT tbl_quickbooks_donor_link_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.tbl_donor(donor_id) ON DELETE CASCADE;


--
-- Name: tbl_volunteer_shift tbl_volunteer_shift_corp_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift
    ADD CONSTRAINT tbl_volunteer_shift_corp_facility_id_fkey FOREIGN KEY (corp_facility_id) REFERENCES public.tbl_corp_facility(corp_facility_id);


--
-- Name: tbl_volunteer_shift tbl_volunteer_shift_created_by_user_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift
    ADD CONSTRAINT tbl_volunteer_shift_created_by_user_account_id_fkey FOREIGN KEY (created_by_user_account_id) REFERENCES public.tbl_user_account(user_account_id);


--
-- Name: tbl_volunteer_shift tbl_volunteer_shift_shift_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift
    ADD CONSTRAINT tbl_volunteer_shift_shift_status_id_fkey FOREIGN KEY (shift_status_id) REFERENCES public.lkp_shift_status(shift_status_id);


--
-- Name: tbl_volunteer_shift tbl_volunteer_shift_shift_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift
    ADD CONSTRAINT tbl_volunteer_shift_shift_type_id_fkey FOREIGN KEY (shift_type_id) REFERENCES public.lkp_shift_type(shift_type_id);


--
-- Name: tbl_volunteer_shift_signup tbl_volunteer_shift_signup_facility_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift_signup
    ADD CONSTRAINT tbl_volunteer_shift_signup_facility_staff_id_fkey FOREIGN KEY (facility_staff_id) REFERENCES public.tbl_facility_staff(facility_staff_id);


--
-- Name: tbl_volunteer_shift_signup tbl_volunteer_shift_signup_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift_signup
    ADD CONSTRAINT tbl_volunteer_shift_signup_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.tbl_volunteer_shift(shift_id) ON DELETE CASCADE;


--
-- Name: tbl_volunteer_shift_signup tbl_volunteer_shift_signup_signed_up_by_user_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbl_volunteer_shift_signup
    ADD CONSTRAINT tbl_volunteer_shift_signup_signed_up_by_user_account_id_fkey FOREIGN KEY (signed_up_by_user_account_id) REFERENCES public.tbl_user_account(user_account_id);


--
-- PostgreSQL database dump complete
--

\unrestrict qrROHXg6IQciRTgCqveDxe4aIIimBabUBPwKjYu7WapuAc2uFU0MAj2EDVLbcPQ

