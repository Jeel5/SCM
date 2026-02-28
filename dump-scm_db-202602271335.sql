--
-- PostgreSQL database dump
--

\restrict C40r99KNwqfUbl6p8fIBbmk4r9OU0vwQx6PxsK6Ng3wIoWaxt5Kuxe8ar5KbtC8

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-02-27 13:35:54 IST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 23498)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5469 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 274 (class 1255 OID 23386)
-- Name: calculate_product_volumetric_weight(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_product_volumetric_weight() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Calculate volumetric weight: (L × W × H) / 5000 (industry standard)
  -- Dimensions are in cm, weight in kg
  IF NEW.dimensions IS NOT NULL AND 
     (NEW.dimensions->>'length')::numeric > 0 AND 
     (NEW.dimensions->>'width')::numeric > 0 AND 
     (NEW.dimensions->>'height')::numeric > 0 THEN
    
    NEW.volumetric_weight := (
      (NEW.dimensions->>'length')::numeric * 
      (NEW.dimensions->>'width')::numeric * 
      (NEW.dimensions->>'height')::numeric
    ) / 5000.0;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_product_volumetric_weight() OWNER TO postgres;

--
-- TOC entry 273 (class 1255 OID 23368)
-- Name: calculate_volumetric_weight(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_volumetric_weight() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Calculate volumetric weight: (L × W × H) / 5000 (industry standard)
  -- Dimensions are in cm, weight in kg
  IF NEW.dimensions IS NOT NULL AND 
     (NEW.dimensions->>'length')::numeric > 0 AND 
     (NEW.dimensions->>'width')::numeric > 0 AND 
     (NEW.dimensions->>'height')::numeric > 0 THEN
    
    NEW.volumetric_weight := (
      (NEW.dimensions->>'length')::numeric * 
      (NEW.dimensions->>'width')::numeric * 
      (NEW.dimensions->>'height')::numeric
    ) / 5000.0;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_volumetric_weight() OWNER TO postgres;

--
-- TOC entry 275 (class 1255 OID 23449)
-- Name: generate_webhook_credentials(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_webhook_credentials() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.webhook_secret IS NULL THEN
    NEW.webhook_secret := 'whsec_' || LOWER(NEW.code) || '_' || MD5(RANDOM()::TEXT);
  END IF;
  IF NEW.our_client_id IS NULL THEN
    NEW.our_client_id := 'scm_client_' || NEW.id::TEXT;
  END IF;
  IF NEW.our_client_secret IS NULL THEN
    NEW.our_client_secret := 'scm_secret_' || MD5(RANDOM()::TEXT);
  END IF;
  IF NEW.webhook_events IS NULL THEN
    NEW.webhook_events := ARRAY['shipment.pickup', 'shipment.in_transit', 'shipment.delivered', 'shipment.exception'];
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_webhook_credentials() OWNER TO postgres;

--
-- TOC entry 313 (class 1255 OID 23550)
-- Name: sync_inventory_product_info(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_inventory_product_info() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_sku  VARCHAR(100);
  v_name VARCHAR(255);
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT sku, name INTO v_sku, v_name
    FROM products WHERE id = NEW.product_id LIMIT 1;

    NEW.sku          := COALESCE(NEW.sku, v_sku);
    NEW.product_name := COALESCE(NEW.product_name, v_name);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_inventory_product_info() OWNER TO postgres;

--
-- TOC entry 272 (class 1255 OID 22023)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 260 (class 1259 OID 23079)
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alert_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    rule_type character varying(100) NOT NULL,
    description text,
    severity character varying(50) DEFAULT 'medium'::character varying,
    threshold integer,
    threshold_comparison character varying(20),
    conditions jsonb,
    message_template text NOT NULL,
    assigned_users uuid[],
    assigned_roles character varying(50)[],
    notification_channels text[],
    escalation_enabled boolean DEFAULT false,
    escalation_delay_minutes integer DEFAULT 15,
    escalation_users uuid[],
    is_active boolean DEFAULT true,
    priority integer DEFAULT 5,
    cooldown_minutes integer DEFAULT 5,
    last_triggered_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alert_rules_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


ALTER TABLE public.alert_rules OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 23110)
-- Name: alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    rule_id uuid,
    rule_name character varying(255),
    alert_type character varying(100),
    severity character varying(50),
    message text,
    entity_type character varying(50),
    entity_id uuid,
    data jsonb,
    status character varying(50) DEFAULT 'triggered'::character varying,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    resolution text,
    triggered_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alerts_status_check CHECK (((status)::text = ANY ((ARRAY['triggered'::character varying, 'acknowledged'::character varying, 'investigating'::character varying, 'resolved'::character varying, 'suppressed'::character varying])::text[])))
);


ALTER TABLE public.alerts OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 22673)
-- Name: allocation_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allocation_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    order_item_id uuid,
    warehouse_id uuid NOT NULL,
    allocation_strategy character varying(50),
    allocation_score numeric(5,2),
    allocated_quantity integer NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.allocation_history OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 22654)
-- Name: allocation_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allocation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    priority integer DEFAULT 5,
    strategy character varying(50),
    conditions jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.allocation_rules OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 22133)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    organization_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    changes jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- TOC entry 5470 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for compliance and security';


--
-- TOC entry 256 (class 1259 OID 22992)
-- Name: background_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.background_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    job_type character varying(255) NOT NULL,
    job_name character varying(255),
    priority integer DEFAULT 5,
    status character varying(100) DEFAULT 'pending'::character varying,
    payload jsonb,
    result jsonb,
    error_message text,
    error_stack text,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    retry_delay_seconds integer DEFAULT 60,
    scheduled_for timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    timeout_seconds integer DEFAULT 300,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT background_jobs_priority_check CHECK (((priority >= 1) AND (priority <= 10))),
    CONSTRAINT background_jobs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'retrying'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.background_jobs OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 22430)
-- Name: carrier_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    order_id uuid NOT NULL,
    carrier_id uuid NOT NULL,
    service_type character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    pickup_address jsonb NOT NULL,
    delivery_address jsonb NOT NULL,
    estimated_pickup timestamp with time zone,
    estimated_delivery timestamp with time zone,
    actual_pickup timestamp with time zone,
    special_instructions text,
    request_payload jsonb,
    acceptance_payload jsonb,
    carrier_reference_id character varying(100),
    carrier_tracking_number character varying(100),
    rejected_reason text,
    idempotency_key character varying(255),
    requested_at timestamp with time zone DEFAULT now(),
    assigned_at timestamp with time zone,
    accepted_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT carrier_assignments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'busy'::character varying, 'expired'::character varying, 'cancelled'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.carrier_assignments OWNER TO postgres;

--
-- TOC entry 5471 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN carrier_assignments.idempotency_key; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_assignments.idempotency_key IS 'Prevents duplicate carrier assignment requests';


--
-- TOC entry 242 (class 1259 OID 22597)
-- Name: carrier_capacity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_capacity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_id uuid NOT NULL,
    daily_capacity integer,
    current_load integer,
    utilization_percentage numeric(5,2),
    availability_status character varying(20),
    logged_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.carrier_capacity_log OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 22626)
-- Name: carrier_performance_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_performance_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_id uuid NOT NULL,
    organization_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    period_type character varying(20),
    total_shipments integer DEFAULT 0,
    delivered_on_time integer DEFAULT 0,
    delivered_late integer DEFAULT 0,
    failed_deliveries integer DEFAULT 0,
    returns_processed integer DEFAULT 0,
    on_time_rate numeric(5,2),
    delivery_success_rate numeric(5,2),
    damage_rate numeric(5,4),
    avg_delivery_hours numeric(10,2),
    avg_first_attempt_success_rate numeric(5,2),
    calculated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.carrier_performance_metrics OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 22183)
-- Name: carriers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carriers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    service_type character varying(50),
    service_areas jsonb,
    contact_email character varying(255),
    contact_phone character varying(20),
    website character varying(500),
    api_endpoint character varying(500),
    api_key_encrypted character varying(500),
    webhook_url character varying(500),
    reliability_score numeric(3,2) DEFAULT 0.85,
    avg_delivery_days numeric(4,1),
    daily_capacity integer,
    current_load integer DEFAULT 0,
    is_active boolean DEFAULT true,
    availability_status character varying(20) DEFAULT 'available'::character varying,
    last_status_change timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    webhook_secret character varying(255),
    our_client_id character varying(100),
    our_client_secret character varying(255),
    ip_whitelist jsonb,
    webhook_events text[],
    webhook_enabled boolean DEFAULT true,
    CONSTRAINT carriers_availability_status_check CHECK (((availability_status)::text = ANY ((ARRAY['available'::character varying, 'busy'::character varying, 'offline'::character varying, 'maintenance'::character varying])::text[]))),
    CONSTRAINT carriers_reliability_score_check CHECK (((reliability_score >= (0)::numeric) AND (reliability_score <= (1)::numeric)))
);


ALTER TABLE public.carriers OWNER TO postgres;

--
-- TOC entry 5472 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.webhook_secret; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.webhook_secret IS 'Shared secret for HMAC-SHA256 signature verification (carrier signs their webhooks)';


--
-- TOC entry 5473 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.our_client_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.our_client_id IS 'Our client ID for authenticating with carrier API';


--
-- TOC entry 5474 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.our_client_secret; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.our_client_secret IS 'Our secret for signing requests to carrier API';


--
-- TOC entry 5475 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.ip_whitelist; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.ip_whitelist IS 'Array of allowed IP addresses for webhook requests';


--
-- TOC entry 5476 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.webhook_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.webhook_events IS 'Array of webhook event types carrier subscribes to';


--
-- TOC entry 237 (class 1259 OID 22465)
-- Name: shipments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    tracking_number character varying(100) NOT NULL,
    carrier_tracking_number character varying(100),
    awb_number character varying(100),
    order_id uuid,
    carrier_assignment_id uuid,
    carrier_id uuid,
    warehouse_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    origin_address jsonb,
    destination_address jsonb,
    weight numeric(10,3),
    volumetric_weight numeric(10,3),
    dimensions jsonb,
    package_count integer DEFAULT 1,
    shipping_cost numeric(10,2),
    cod_amount numeric(10,2),
    current_location jsonb,
    route_geometry jsonb,
    tracking_events jsonb DEFAULT '[]'::jsonb,
    delivery_attempts integer DEFAULT 0,
    pickup_scheduled timestamp with time zone,
    pickup_actual timestamp with time zone,
    delivery_scheduled timestamp with time zone,
    delivery_actual timestamp with time zone,
    pod_image_url character varying(500),
    pod_signature_url character varying(500),
    delivered_to character varying(255),
    delivery_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_fragile boolean DEFAULT false,
    is_hazardous boolean DEFAULT false,
    is_perishable boolean DEFAULT false,
    requires_cold_storage boolean DEFAULT false,
    item_type character varying(50) DEFAULT 'general'::character varying,
    package_type character varying(50) DEFAULT 'box'::character varying,
    handling_instructions text,
    requires_insurance boolean DEFAULT false,
    declared_value numeric(10,2),
    total_items integer DEFAULT 0,
    CONSTRAINT shipments_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['general'::character varying, 'fragile'::character varying, 'hazardous'::character varying, 'perishable'::character varying, 'electronics'::character varying, 'documents'::character varying, 'valuable'::character varying])::text[]))),
    CONSTRAINT shipments_package_type_check CHECK (((package_type)::text = ANY ((ARRAY['envelope'::character varying, 'box'::character varying, 'tube'::character varying, 'pallet'::character varying, 'crate'::character varying, 'bag'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT shipments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'manifested'::character varying, 'picked_up'::character varying, 'in_transit'::character varying, 'at_hub'::character varying, 'out_for_delivery'::character varying, 'delivered'::character varying, 'failed_delivery'::character varying, 'rto_initiated'::character varying, 'returned'::character varying, 'lost'::character varying])::text[])))
);


ALTER TABLE public.shipments OWNER TO postgres;

--
-- TOC entry 5477 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.awb_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.awb_number IS 'Air Waybill Number (optional - mainly for air freight, can be same as carrier_tracking_number)';


--
-- TOC entry 5478 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.route_geometry; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.route_geometry IS 'GeoJSON route for map display (populated during transit, not at creation)';


--
-- TOC entry 5479 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.tracking_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.tracking_events IS 'Tracking history array (populated as carrier provides updates)';


--
-- TOC entry 5480 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.is_fragile; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.is_fragile IS 'True if ANY item in shipment is fragile (aggregated from order_items)';


--
-- TOC entry 5481 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.is_hazardous; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.is_hazardous IS 'True if ANY item is hazardous (requires special carrier certification)';


--
-- TOC entry 5482 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.is_perishable; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.is_perishable IS 'True if ANY item is perishable (time-sensitive delivery required)';


--
-- TOC entry 5483 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.requires_cold_storage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.requires_cold_storage IS 'True if ANY item requires temperature control';


--
-- TOC entry 5484 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.item_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.item_type IS 'Most restrictive item type from all items in shipment';


--
-- TOC entry 5485 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.package_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.package_type IS 'Package type determined from order items';


--
-- TOC entry 5486 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.handling_instructions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.handling_instructions IS 'Special handling instructions aggregated from all order items';


--
-- TOC entry 5487 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.requires_insurance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.requires_insurance IS 'True if ANY item requires insurance';


--
-- TOC entry 5488 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.declared_value; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.declared_value IS 'Total declared value for insurance (sum of all item declared values)';


--
-- TOC entry 5489 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.total_items; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.total_items IS 'Total number of items (quantity) in this shipment';


--
-- TOC entry 252 (class 1259 OID 22875)
-- Name: sla_violations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sla_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    shipment_id uuid,
    sla_policy_id uuid,
    carrier_id uuid,
    violation_type character varying(50),
    promised_delivery timestamp with time zone,
    actual_delivery timestamp with time zone,
    delay_hours numeric(10,2),
    penalty_amount numeric(10,2),
    penalty_status character varying(50) DEFAULT 'pending'::character varying,
    status character varying(50) DEFAULT 'open'::character varying,
    waiver_reason text,
    waived_by uuid,
    waived_at timestamp with time zone,
    reason character varying(255),
    notes text,
    violated_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sla_violations_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'acknowledged'::character varying, 'investigating'::character varying, 'resolved'::character varying, 'waived'::character varying, 'disputed'::character varying])::text[])))
);


ALTER TABLE public.sla_violations OWNER TO postgres;

--
-- TOC entry 263 (class 1259 OID 23329)
-- Name: carrier_performance_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.carrier_performance_summary AS
 SELECT c.id AS carrier_id,
    c.name AS carrier_name,
    c.code AS carrier_code,
    c.reliability_score,
    c.availability_status,
    c.daily_capacity,
    c.current_load,
        CASE
            WHEN (c.daily_capacity > 0) THEN round((((c.current_load)::numeric / (c.daily_capacity)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS utilization_percentage,
    count(DISTINCT s.id) AS total_shipments,
    count(DISTINCT s.id) FILTER (WHERE ((s.status)::text = 'delivered'::text)) AS delivered_count,
    count(DISTINCT s.id) FILTER (WHERE ((s.status)::text = ANY ((ARRAY['failed_delivery'::character varying, 'returned'::character varying, 'lost'::character varying])::text[]))) AS failed_count,
    round((((count(DISTINCT s.id) FILTER (WHERE ((s.status)::text = 'delivered'::text)))::numeric / (NULLIF(count(DISTINCT s.id), 0))::numeric) * (100)::numeric), 2) AS success_rate,
    count(DISTINCT sv.id) AS sla_violations
   FROM ((public.carriers c
     LEFT JOIN public.shipments s ON (((s.carrier_id = c.id) AND (s.created_at > (now() - '30 days'::interval)))))
     LEFT JOIN public.sla_violations sv ON (((sv.carrier_id = c.id) AND (sv.violated_at > (now() - '30 days'::interval)))))
  WHERE (c.is_active = true)
  GROUP BY c.id, c.name, c.code, c.reliability_score, c.availability_status, c.daily_capacity, c.current_load;


ALTER VIEW public.carrier_performance_summary OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 22545)
-- Name: carrier_quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    carrier_id uuid NOT NULL,
    quoted_price numeric(10,2),
    estimated_delivery_days integer,
    service_type character varying(50),
    response_time_ms integer,
    was_retried boolean DEFAULT false,
    retry_count integer DEFAULT 0,
    was_selected boolean DEFAULT false,
    selection_reason character varying(255),
    status character varying(50) DEFAULT 'received'::character varying,
    error_message text,
    request_payload jsonb,
    response_payload jsonb,
    quoted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone
);


ALTER TABLE public.carrier_quotes OWNER TO postgres;

--
-- TOC entry 5490 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN carrier_quotes.selection_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_quotes.selection_reason IS 'Why selected: best_price, best_speed, best_balance, reliability, only_option';


--
-- TOC entry 241 (class 1259 OID 22570)
-- Name: carrier_rejections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_rejections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_assignment_id uuid,
    carrier_id uuid NOT NULL,
    order_id uuid,
    reason character varying(100) NOT NULL,
    message text,
    error_code character varying(50),
    response_time_ms integer,
    raw_response jsonb,
    rejected_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.carrier_rejections OWNER TO postgres;

--
-- TOC entry 5491 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN carrier_rejections.reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_rejections.reason IS 'at_capacity, weight_exceeded, route_not_serviceable, no_cold_storage, api_error, timeout';


--
-- TOC entry 264 (class 1259 OID 23334)
-- Name: carrier_rejection_analysis; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.carrier_rejection_analysis AS
 SELECT cr.carrier_id,
    c.name AS carrier_name,
    c.code AS carrier_code,
    cr.reason,
    count(*) AS rejection_count,
    round(avg(cr.response_time_ms), 2) AS avg_response_time_ms,
    min(cr.rejected_at) AS first_rejection,
    max(cr.rejected_at) AS last_rejection
   FROM (public.carrier_rejections cr
     JOIN public.carriers c ON ((c.id = cr.carrier_id)))
  WHERE (cr.rejected_at > (now() - '30 days'::interval))
  GROUP BY cr.carrier_id, c.name, c.code, cr.reason
  ORDER BY (count(*)) DESC;


ALTER VIEW public.carrier_rejection_analysis OWNER TO postgres;

--
-- TOC entry 268 (class 1259 OID 23451)
-- Name: carrier_webhook_config; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.carrier_webhook_config AS
 SELECT id,
    code,
    name,
    webhook_secret,
    our_client_id,
    webhook_events,
    webhook_enabled,
    ip_whitelist,
    created_at
   FROM public.carriers
  WHERE (webhook_enabled = true);


ALTER VIEW public.carrier_webhook_config OWNER TO postgres;

--
-- TOC entry 5492 (class 0 OID 0)
-- Dependencies: 268
-- Name: VIEW carrier_webhook_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.carrier_webhook_config IS 'Webhook configuration for active carriers';


--
-- TOC entry 258 (class 1259 OID 23041)
-- Name: cron_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cron_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    job_type character varying(100) NOT NULL,
    cron_expression character varying(100) NOT NULL,
    timezone character varying(50) DEFAULT 'Asia/Kolkata'::character varying,
    payload jsonb,
    is_active boolean DEFAULT true,
    last_run_at timestamp with time zone,
    last_run_status character varying(50),
    next_run_at timestamp with time zone,
    total_runs integer DEFAULT 0,
    failed_runs integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cron_schedules OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 23064)
-- Name: dead_letter_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dead_letter_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_job_id uuid NOT NULL,
    job_type character varying(100) NOT NULL,
    payload jsonb,
    priority integer,
    error_message text,
    error_stack text,
    retry_count integer DEFAULT 0,
    original_created_at timestamp with time zone NOT NULL,
    moved_to_dlq_at timestamp with time zone DEFAULT now(),
    reprocessed boolean DEFAULT false,
    reprocessed_at timestamp with time zone,
    reprocessed_job_id uuid
);


ALTER TABLE public.dead_letter_queue OWNER TO postgres;

--
-- TOC entry 5493 (class 0 OID 0)
-- Dependencies: 259
-- Name: TABLE dead_letter_queue; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.dead_letter_queue IS 'Failed jobs that exceeded max retries for debugging and reprocessing';


--
-- TOC entry 239 (class 1259 OID 22527)
-- Name: shipping_estimates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipping_estimates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    carrier_id uuid,
    estimated_cost numeric(10,2),
    estimated_days integer,
    service_type character varying(50),
    confidence_score numeric(3,2),
    actual_cost numeric(10,2),
    actual_days integer,
    accuracy_percent numeric(5,2),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.shipping_estimates OWNER TO postgres;

--
-- TOC entry 265 (class 1259 OID 23339)
-- Name: estimate_accuracy_analysis; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.estimate_accuracy_analysis AS
 SELECT c.id AS carrier_id,
    c.name AS carrier_name,
    se.service_type,
    count(*) AS total_estimates,
    round(avg(se.estimated_cost), 2) AS avg_estimated_cost,
    round(avg(se.actual_cost), 2) AS avg_actual_cost,
    round(avg(abs((se.estimated_cost - se.actual_cost))), 2) AS avg_cost_variance,
    round(avg(se.accuracy_percent), 2) AS avg_accuracy_percent
   FROM (public.shipping_estimates se
     JOIN public.carriers c ON ((c.id = se.carrier_id)))
  WHERE (se.actual_cost IS NOT NULL)
  GROUP BY c.id, c.name, se.service_type;


ALTER VIEW public.estimate_accuracy_analysis OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 22915)
-- Name: eta_predictions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.eta_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipment_id uuid NOT NULL,
    predicted_delivery timestamp with time zone NOT NULL,
    confidence_score numeric(3,2),
    delay_risk_score character varying(20),
    factors jsonb,
    actual_delivery timestamp with time zone,
    prediction_accuracy_hours numeric(10,2),
    model_version character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT eta_predictions_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric)))
);


ALTER TABLE public.eta_predictions OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 22829)
-- Name: exceptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exceptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    exception_type character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'medium'::character varying,
    priority integer DEFAULT 5,
    shipment_id uuid,
    order_id uuid,
    carrier_id uuid,
    title character varying(255),
    description text,
    root_cause character varying(255),
    status character varying(50) DEFAULT 'open'::character varying,
    escalation_level integer DEFAULT 0,
    escalated_at timestamp with time zone,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    resolution character varying(50),
    resolution_notes text,
    sla_impacted boolean DEFAULT false,
    customer_impacted boolean DEFAULT false,
    financial_impact numeric(10,2),
    estimated_resolution_time timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT exceptions_exception_type_check CHECK (((exception_type)::text = ANY ((ARRAY['delay'::character varying, 'damage'::character varying, 'lost_shipment'::character varying, 'address_issue'::character varying, 'carrier_issue'::character varying, 'inventory_issue'::character varying, 'sla_breach'::character varying, 'delivery_failed'::character varying, 'customer_not_available'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT exceptions_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT exceptions_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'acknowledged'::character varying, 'investigating'::character varying, 'pending_resolution'::character varying, 'resolved'::character varying, 'escalated'::character varying, 'closed'::character varying])::text[])))
);


ALTER TABLE public.exceptions OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 22279)
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid NOT NULL,
    product_id uuid,
    sku character varying(100),
    product_name character varying(255),
    quantity integer DEFAULT 0,
    available_quantity integer DEFAULT 0,
    reserved_quantity integer DEFAULT 0,
    damaged_quantity integer DEFAULT 0,
    in_transit_quantity integer DEFAULT 0,
    bin_location character varying(50),
    zone character varying(50),
    reorder_point integer,
    max_stock_level integer,
    last_stock_check timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    unit_cost numeric(10,2) DEFAULT 0,
    organization_id uuid
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- TOC entry 5494 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.quantity IS 'Total quantity (available + reserved + damaged + in_transit)';


--
-- TOC entry 5495 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.available_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.available_quantity IS 'Available quantity for sale/transfer';


--
-- TOC entry 5496 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.reserved_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.reserved_quantity IS 'Reserved quantity (allocated to orders)';


--
-- TOC entry 5497 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.damaged_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.damaged_quantity IS 'Damaged/unusable quantity';


--
-- TOC entry 5498 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.in_transit_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.in_transit_quantity IS 'Quantity in transit (being transferred)';


--
-- TOC entry 5499 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.unit_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.unit_cost IS 'Cost per unit for inventory valuation';


--
-- TOC entry 255 (class 1259 OID 22965)
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    shipment_id uuid,
    order_id uuid,
    description character varying(255) NOT NULL,
    item_type character varying(50),
    quantity integer DEFAULT 1,
    unit_price numeric(10,2),
    amount numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.invoice_line_items OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 22933)
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    invoice_number character varying(50) NOT NULL,
    carrier_id uuid,
    billing_period_start date,
    billing_period_end date,
    total_shipments integer,
    base_amount numeric(10,2),
    penalties numeric(10,2) DEFAULT 0,
    adjustments numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    final_amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    due_date date,
    paid_amount numeric(10,2) DEFAULT 0,
    paid_at timestamp with time zone,
    payment_method character varying(50),
    payment_reference character varying(255),
    invoice_url character varying(500),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invoices_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'sent'::character varying, 'approved'::character varying, 'paid'::character varying, 'overdue'::character varying, 'disputed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 23023)
-- Name: job_execution_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_execution_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    status character varying(50) NOT NULL,
    error_message text,
    execution_time_ms integer,
    output_data jsonb,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone
);


ALTER TABLE public.job_execution_logs OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 23143)
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    entity_type character varying(50),
    entity_id uuid,
    link character varying(500),
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    priority character varying(20) DEFAULT 'normal'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 22374)
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    sku character varying(100),
    product_name character varying(255),
    quantity integer NOT NULL,
    fulfilled_quantity integer DEFAULT 0,
    unit_price numeric(10,2),
    discount numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total_price numeric(10,2),
    weight numeric(10,3),
    warehouse_id uuid,
    bin_location character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    shipped_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    dimensions jsonb DEFAULT '{"width": 0, "height": 0, "length": 0}'::jsonb,
    is_fragile boolean DEFAULT false,
    is_hazardous boolean DEFAULT false,
    is_perishable boolean DEFAULT false,
    requires_cold_storage boolean DEFAULT false,
    item_type character varying(50) DEFAULT 'general'::character varying,
    volumetric_weight numeric(10,3),
    package_type character varying(50) DEFAULT 'box'::character varying,
    handling_instructions text,
    requires_insurance boolean DEFAULT false,
    declared_value numeric(10,2),
    CONSTRAINT order_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['general'::character varying, 'fragile'::character varying, 'hazardous'::character varying, 'perishable'::character varying, 'electronics'::character varying, 'documents'::character varying, 'valuable'::character varying])::text[]))),
    CONSTRAINT order_items_package_type_check CHECK (((package_type)::text = ANY ((ARRAY['envelope'::character varying, 'box'::character varying, 'tube'::character varying, 'pallet'::character varying, 'crate'::character varying, 'bag'::character varying, 'custom'::character varying])::text[])))
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- TOC entry 5500 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN order_items.dimensions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.dimensions IS 'Package dimensions in cm: {length, width, height}';


--
-- TOC entry 5501 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN order_items.volumetric_weight; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.volumetric_weight IS 'Dimensional weight (L×W×H/5000). Used for carrier pricing when > actual weight';


--
-- TOC entry 235 (class 1259 OID 22405)
-- Name: order_splits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_splits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_order_id uuid NOT NULL,
    child_order_id uuid NOT NULL,
    warehouse_id uuid,
    split_reason character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.order_splits OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 22340)
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    order_number character varying(50),
    external_order_id character varying(100),
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_phone character varying(20),
    status character varying(50) DEFAULT 'created'::character varying,
    priority character varying(20) DEFAULT 'standard'::character varying,
    order_type character varying(50) DEFAULT 'regular'::character varying,
    is_cod boolean DEFAULT false,
    subtotal numeric(10,2),
    tax_amount numeric(10,2) DEFAULT 0,
    shipping_amount numeric(10,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    shipping_address jsonb NOT NULL,
    billing_address jsonb,
    estimated_delivery timestamp with time zone,
    actual_delivery timestamp with time zone,
    promised_delivery timestamp with time zone,
    allocated_warehouse_id uuid,
    shipping_locked_by character varying(255),
    shipping_locked_at timestamp with time zone,
    notes text,
    special_instructions text,
    tags jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    carrier_id uuid,
    supplier_id uuid,
    supplier_name character varying(255),
    platform character varying(50),
    customer_id character varying(100),
    payment_method character varying(50),
    CONSTRAINT orders_order_type_check CHECK (((order_type)::text = ANY ((ARRAY['regular'::character varying, 'replacement'::character varying, 'cod'::character varying, 'transfer'::character varying])::text[]))),
    CONSTRAINT orders_priority_check CHECK (((priority)::text = ANY ((ARRAY['express'::character varying, 'standard'::character varying, 'bulk'::character varying, 'same_day'::character varying])::text[]))),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'confirmed'::character varying, 'processing'::character varying, 'allocated'::character varying, 'ready_to_ship'::character varying, 'shipped'::character varying, 'in_transit'::character varying, 'out_for_delivery'::character varying, 'delivered'::character varying, 'returned'::character varying, 'cancelled'::character varying, 'on_hold'::character varying, 'pending_carrier_assignment'::character varying])::text[])))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- TOC entry 5502 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.external_order_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.external_order_id IS 'Reference ID from external system: E-commerce order ID for sales orders, PO number for purchase orders';


--
-- TOC entry 5503 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.customer_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.customer_name IS 'Customer name for sales orders, or receiving warehouse for transfer orders';


--
-- TOC entry 5504 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.status IS 'Order workflow: created -> pending_carrier_assignment -> ready_to_ship -> shipped -> in_transit -> delivered. Use on_hold for any blocking issues.';


--
-- TOC entry 5505 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.order_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.order_type IS 'Order type: regular, replacement, cod, transfer (warehouse-to-warehouse)';


--
-- TOC entry 5506 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.carrier_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.carrier_id IS 'Carrier that accepted the assignment (set when carrier accepts job)';


--
-- TOC entry 5507 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.supplier_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.supplier_id IS 'Reference to supplier organization for purchase/inbound orders (NULL for sales orders)';


--
-- TOC entry 5508 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.supplier_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.supplier_name IS 'Supplier name for inbound orders (denormalized for performance)';


--
-- TOC entry 5509 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.platform; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.platform IS 'Source platform: amazon, shopify, ebay, website, api, manual';


--
-- TOC entry 5510 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.customer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.customer_id IS 'External customer ID from platform';


--
-- TOC entry 5511 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.payment_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.payment_method IS 'Payment method: cod, prepaid, upi, card, netbanking';


--
-- TOC entry 220 (class 1259 OID 22024)
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    email character varying(255),
    phone character varying(20),
    website character varying(500),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100) DEFAULT 'India'::character varying,
    postal_code character varying(20),
    timezone character varying(50) DEFAULT 'Asia/Kolkata'::character varying,
    currency character varying(3) DEFAULT 'INR'::character varying,
    logo_url character varying(500),
    is_active boolean DEFAULT true,
    subscription_tier character varying(50) DEFAULT 'standard'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    webhook_token character varying(64) DEFAULT encode(public.gen_random_bytes(32), 'hex'::text)
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- TOC entry 5512 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.organizations IS 'Multi-tenant companies using the platform';


--
-- TOC entry 5513 (class 0 OID 0)
-- Dependencies: 220
-- Name: COLUMN organizations.webhook_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organizations.webhook_token IS 'Secret token for org-scoped webhook URLs. Used in /api/webhooks/:token/orders etc.';


--
-- TOC entry 248 (class 1259 OID 22733)
-- Name: pick_list_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pick_list_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pick_list_id uuid NOT NULL,
    order_item_id uuid,
    inventory_id uuid,
    sku character varying(100),
    product_name character varying(255),
    quantity_to_pick integer NOT NULL,
    quantity_picked integer DEFAULT 0,
    bin_location character varying(50),
    zone character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    picked_at timestamp with time zone,
    picked_by uuid
);


ALTER TABLE public.pick_list_items OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 22701)
-- Name: pick_lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pick_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    warehouse_id uuid NOT NULL,
    pick_list_number character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    priority integer DEFAULT 5,
    total_items integer DEFAULT 0,
    picked_items integer DEFAULT 0,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pick_lists_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'assigned'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.pick_lists OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 22231)
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    sku character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    weight numeric(10,3),
    dimensions jsonb,
    unit_price numeric(10,2),
    cost_price numeric(10,2),
    currency character varying(3) DEFAULT 'INR'::character varying,
    attributes jsonb,
    images jsonb,
    is_active boolean DEFAULT true,
    is_fragile boolean DEFAULT false,
    requires_cold_storage boolean DEFAULT false,
    is_hazmat boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_perishable boolean DEFAULT false,
    item_type character varying(50) DEFAULT 'general'::character varying,
    volumetric_weight numeric(10,3),
    package_type character varying(50) DEFAULT 'box'::character varying,
    handling_instructions text,
    requires_insurance boolean DEFAULT false,
    declared_value numeric(10,2),
    CONSTRAINT products_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['general'::character varying, 'fragile'::character varying, 'hazardous'::character varying, 'perishable'::character varying, 'electronics'::character varying, 'documents'::character varying, 'valuable'::character varying])::text[]))),
    CONSTRAINT products_package_type_check CHECK (((package_type)::text = ANY ((ARRAY['envelope'::character varying, 'box'::character varying, 'tube'::character varying, 'pallet'::character varying, 'crate'::character varying, 'bag'::character varying, 'custom'::character varying])::text[])))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- TOC entry 5514 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.dimensions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.dimensions IS 'Package dimensions in cm: {length, width, height}. Used for shipping cost calculations.';


--
-- TOC entry 5515 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.is_fragile; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.is_fragile IS 'Requires fragile handling (adds surcharge)';


--
-- TOC entry 5516 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.requires_cold_storage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.requires_cold_storage IS 'Requires temperature-controlled transport (adds surcharge)';


--
-- TOC entry 5517 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.is_perishable; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.is_perishable IS 'Perishable item (adds surcharge, time-sensitive delivery)';


--
-- TOC entry 5518 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.item_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.item_type IS 'Product category for handling requirements';


--
-- TOC entry 5519 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.volumetric_weight; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.volumetric_weight IS 'Dimensional weight (L×W×H/5000). Auto-calculated from dimensions.';


--
-- TOC entry 5520 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.package_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.package_type IS 'Recommended package type for this product';


--
-- TOC entry 5521 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.handling_instructions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.handling_instructions IS 'Special handling instructions for carriers';


--
-- TOC entry 5522 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.requires_insurance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.requires_insurance IS 'Whether this product requires shipping insurance';


--
-- TOC entry 5523 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.declared_value; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.declared_value IS 'Default declared value for insurance calculation';


--
-- TOC entry 243 (class 1259 OID 22611)
-- Name: quote_idempotency_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_idempotency_cache (
    idempotency_key character varying(255) NOT NULL,
    quote_id uuid,
    response_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE public.quote_idempotency_cache OWNER TO postgres;

--
-- TOC entry 5524 (class 0 OID 0)
-- Dependencies: 243
-- Name: TABLE quote_idempotency_cache; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.quote_idempotency_cache IS 'Prevents duplicate quote requests. Auto-cleanup: DELETE WHERE expires_at < NOW()';


--
-- TOC entry 228 (class 1259 OID 22210)
-- Name: rate_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_id uuid NOT NULL,
    origin_state character varying(100),
    origin_city character varying(100),
    destination_state character varying(100),
    destination_city character varying(100),
    service_type character varying(50),
    base_rate numeric(10,2) NOT NULL,
    per_kg_rate numeric(10,2) DEFAULT 0,
    per_km_rate numeric(10,4) DEFAULT 0,
    fuel_surcharge_pct numeric(5,2) DEFAULT 0,
    cod_charge numeric(10,2) DEFAULT 0,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.rate_cards OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 22802)
-- Name: return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_id uuid NOT NULL,
    order_item_id uuid,
    product_id uuid,
    sku character varying(100),
    product_name character varying(255),
    quantity integer NOT NULL,
    reason character varying(100),
    reason_detail text,
    condition character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.return_items OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 22766)
-- Name: returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    rma_number character varying(50),
    external_return_id character varying(100),
    order_id uuid,
    original_shipment_id uuid,
    return_shipment_id uuid,
    customer_name character varying(255),
    customer_email character varying(255),
    customer_phone character varying(20),
    reason character varying(100),
    reason_detail text,
    status character varying(50) DEFAULT 'requested'::character varying,
    quality_check_result character varying(50),
    quality_check_notes text,
    inspection_images jsonb,
    refund_amount numeric(10,2),
    restocking_fee numeric(10,2) DEFAULT 0,
    refund_status character varying(50),
    refund_processed_at timestamp with time zone,
    items jsonb,
    pickup_address jsonb,
    requested_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    received_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT returns_status_check CHECK (((status)::text = ANY ((ARRAY['requested'::character varying, 'approved'::character varying, 'rejected'::character varying, 'pickup_scheduled'::character varying, 'picked_up'::character varying, 'in_transit'::character varying, 'received'::character varying, 'inspecting'::character varying, 'inspection_passed'::character varying, 'inspection_failed'::character varying, 'refunded'::character varying, 'restocked'::character varying])::text[])))
);


ALTER TABLE public.returns OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 22509)
-- Name: shipment_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipment_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    event_code character varying(50),
    status character varying(50),
    location jsonb,
    city character varying(100),
    description text,
    remarks text,
    source character varying(50),
    raw_payload jsonb,
    event_timestamp timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.shipment_events OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 22256)
-- Name: sla_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sla_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    service_type character varying(50),
    origin_region character varying(100),
    destination_region character varying(100),
    delivery_hours integer NOT NULL,
    pickup_hours integer DEFAULT 4,
    first_attempt_delivery_hours integer,
    penalty_per_hour numeric(10,2) DEFAULT 0,
    max_penalty_amount numeric(10,2),
    penalty_type character varying(50) DEFAULT 'fixed'::character varying,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sla_policies OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 22306)
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid NOT NULL,
    product_id uuid,
    inventory_id uuid,
    movement_type character varying(50) NOT NULL,
    quantity integer NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    notes text,
    batch_number character varying(100),
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    performed_by character varying(255),
    CONSTRAINT stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['inbound'::character varying, 'outbound'::character varying, 'transfer_in'::character varying, 'transfer_out'::character varying, 'adjustment'::character varying, 'return'::character varying, 'damaged'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- TOC entry 5525 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN stock_movements.performed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.stock_movements.performed_by IS 'User ID or system identifier who performed the movement';


--
-- TOC entry 226 (class 1259 OID 22154)
-- Name: warehouses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    address jsonb NOT NULL,
    coordinates jsonb,
    capacity integer,
    current_utilization numeric(5,2) DEFAULT 0,
    manager_id uuid,
    contact_email character varying(255),
    contact_phone character varying(20),
    is_active boolean DEFAULT true,
    warehouse_type character varying(50) DEFAULT 'standard'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    zones integer DEFAULT 0,
    operating_hours jsonb
);


ALTER TABLE public.warehouses OWNER TO postgres;

--
-- TOC entry 5526 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN warehouses.zones; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.warehouses.zones IS 'Number of storage zones in warehouse';


--
-- TOC entry 5527 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN warehouses.operating_hours; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.warehouses.operating_hours IS 'Operating hours: {open: "HH:MM", close: "HH:MM", timezone: "TZ"}';


--
-- TOC entry 269 (class 1259 OID 23472)
-- Name: transfer_orders; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.transfer_orders AS
 SELECT o.id,
    o.order_number,
    o.status,
    o.priority,
    o.total_amount,
    o.shipping_address,
    o.billing_address,
    o.estimated_delivery,
    o.actual_delivery,
    o.notes,
    o.created_at,
    o.updated_at,
    ( SELECT w.id
           FROM public.warehouses w
          WHERE ((w.address)::text = (o.billing_address)::text)
         LIMIT 1) AS from_warehouse_id,
    ( SELECT w.id
           FROM public.warehouses w
          WHERE ((w.address)::text = (o.shipping_address)::text)
         LIMIT 1) AS to_warehouse_id,
    s.id AS shipment_id,
    s.tracking_number,
    s.status AS shipment_status,
    c.name AS carrier_name
   FROM ((public.orders o
     LEFT JOIN public.shipments s ON ((s.order_id = o.id)))
     LEFT JOIN public.carriers c ON ((s.carrier_id = c.id)))
  WHERE ((o.order_type)::text = 'transfer'::text);


ALTER VIEW public.transfer_orders OWNER TO postgres;

--
-- TOC entry 5528 (class 0 OID 0)
-- Dependencies: 269
-- Name: VIEW transfer_orders; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.transfer_orders IS 'Convenient view for querying transfer orders with shipment details';


--
-- TOC entry 271 (class 1259 OID 23553)
-- Name: user_notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_notification_preferences (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    email_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT true,
    sms_enabled boolean DEFAULT false,
    notification_types jsonb DEFAULT '{"orders": true, "returns": true, "shipments": true, "exceptions": true, "sla_alerts": true, "system_updates": true}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_notification_preferences OWNER TO postgres;

--
-- TOC entry 5529 (class 0 OID 0)
-- Dependencies: 271
-- Name: TABLE user_notification_preferences; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_notification_preferences IS 'Stores user notification preferences for different channels and event types';


--
-- TOC entry 5530 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN user_notification_preferences.notification_types; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_notification_preferences.notification_types IS 'JSON object containing boolean flags for different notification types (orders, shipments, sla_alerts, exceptions, returns, system_updates)';


--
-- TOC entry 270 (class 1259 OID 23552)
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_notification_preferences_id_seq OWNER TO postgres;

--
-- TOC entry 5531 (class 0 OID 0)
-- Dependencies: 270
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_notification_preferences_id_seq OWNED BY public.user_notification_preferences.id;


--
-- TOC entry 222 (class 1259 OID 22070)
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    permission character varying(100) NOT NULL,
    granted_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_permissions OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 22113)
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token character varying(500) NOT NULL,
    refresh_token character varying(500),
    device_name character varying(255),
    device_type character varying(50),
    ip_address character varying(45),
    user_agent text,
    is_active boolean DEFAULT true,
    last_active timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- TOC entry 5532 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE user_sessions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_sessions IS 'Tracks active user sessions for security and session management';


--
-- TOC entry 5533 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN user_sessions.session_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_sessions.session_token IS 'JWT token for the session';


--
-- TOC entry 5534 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN user_sessions.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_sessions.is_active IS 'Whether the session is currently active (not revoked)';


--
-- TOC entry 223 (class 1259 OID 22092)
-- Name: user_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_preferences jsonb DEFAULT '{"sla_alerts": true, "sms_enabled": false, "push_enabled": true, "email_enabled": true, "order_updates": true, "exception_alerts": true, "shipment_updates": true}'::jsonb,
    ui_preferences jsonb DEFAULT '{"theme": "system", "dashboard_layout": "default", "sidebar_collapsed": false, "table_rows_per_page": 20}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_settings OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 22044)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    organization_id uuid,
    avatar character varying(500),
    phone character varying(20),
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    last_login timestamp with time zone,
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['superadmin'::character varying, 'admin'::character varying, 'operations_manager'::character varying, 'warehouse_manager'::character varying, 'carrier_partner'::character varying, 'finance'::character varying, 'customer_support'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 5535 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'All platform users including superadmin and company users';


--
-- TOC entry 5536 (class 0 OID 0)
-- Dependencies: 221
-- Name: COLUMN users.organization_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.organization_id IS 'NULL for superadmin who manages all organizations';


--
-- TOC entry 266 (class 1259 OID 23370)
-- Name: v_order_items_shipping_details; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_order_items_shipping_details AS
 SELECT id,
    order_id,
    product_id,
    sku,
    product_name,
    quantity,
    weight AS actual_weight,
    volumetric_weight,
    GREATEST(weight, volumetric_weight) AS chargeable_weight,
    dimensions,
    is_fragile,
    is_hazardous,
    is_perishable,
    requires_cold_storage,
    item_type,
    package_type,
    handling_instructions,
    requires_insurance,
    declared_value,
    (((((dimensions ->> 'length'::text))::numeric * ((dimensions ->> 'width'::text))::numeric) * ((dimensions ->> 'height'::text))::numeric) / 1000000.0) AS volume_cubic_meters,
        CASE
            WHEN (is_fragile OR is_hazardous OR is_perishable OR requires_cold_storage) THEN true
            ELSE false
        END AS requires_special_handling
   FROM public.order_items oi;


ALTER VIEW public.v_order_items_shipping_details OWNER TO postgres;

--
-- TOC entry 5537 (class 0 OID 0)
-- Dependencies: 266
-- Name: VIEW v_order_items_shipping_details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_order_items_shipping_details IS 'Complete shipping details for order items including chargeable weight and special handling';


--
-- TOC entry 267 (class 1259 OID 23429)
-- Name: webhook_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_id uuid,
    endpoint character varying(255) NOT NULL,
    method character varying(10) DEFAULT 'POST'::character varying,
    request_signature text,
    request_timestamp bigint,
    signature_valid boolean,
    ip_address inet,
    user_agent text,
    payload jsonb,
    headers jsonb,
    response_status integer,
    response_body jsonb,
    error_message text,
    processing_time_ms integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.webhook_logs OWNER TO postgres;

--
-- TOC entry 5538 (class 0 OID 0)
-- Dependencies: 267
-- Name: TABLE webhook_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.webhook_logs IS 'Audit trail for all webhook requests (authenticated and rejected)';


--
-- TOC entry 4816 (class 2604 OID 23556)
-- Name: user_notification_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_notification_preferences_id_seq'::regclass);


--
-- TOC entry 5458 (class 0 OID 23079)
-- Dependencies: 260
-- Data for Name: alert_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alert_rules (id, organization_id, name, rule_type, description, severity, threshold, threshold_comparison, conditions, message_template, assigned_users, assigned_roles, notification_channels, escalation_enabled, escalation_delay_minutes, escalation_users, is_active, priority, cooldown_minutes, last_triggered_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5459 (class 0 OID 23110)
-- Dependencies: 261
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alerts (id, organization_id, rule_id, rule_name, alert_type, severity, message, entity_type, entity_id, data, status, acknowledged_by, acknowledged_at, resolved_by, resolved_at, resolution, triggered_at, created_at) FROM stdin;
\.


--
-- TOC entry 5444 (class 0 OID 22673)
-- Dependencies: 246
-- Data for Name: allocation_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.allocation_history (id, order_id, order_item_id, warehouse_id, allocation_strategy, allocation_score, allocated_quantity, reason, created_at) FROM stdin;
\.


--
-- TOC entry 5443 (class 0 OID 22654)
-- Dependencies: 245
-- Data for Name: allocation_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.allocation_rules (id, organization_id, name, priority, strategy, conditions, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5423 (class 0 OID 22133)
-- Dependencies: 225
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, organization_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at) FROM stdin;
7bc6b353-9069-4844-9b2d-d88d3a3777bb	\N	\N	schema_migration	database	\N	{"changes": ["Added warehouses.zones and warehouses.operating_hours columns", "Updated orders.order_type to support transfer orders", "Added inventory.unit_cost column", "Added stock_movements.performed_by column", "Created indexes for performance optimization", "Created transfer_orders view"], "applied_at": "2026-02-21T14:54:39.237635+05:30", "description": "Applied transfer orders and system enhancements migration", "migration_number": "015"}	\N	\N	2026-02-21 14:54:39.237635+05:30
36f9e604-fc75-4d38-9a97-07bb346b9dba	\N	\N	schema_migration	database	\N	{"changes": ["Added warehouses.zones and warehouses.operating_hours columns", "Updated orders.order_type to support transfer orders", "Added inventory.unit_cost column", "Added stock_movements.performed_by column", "Created indexes for performance optimization", "Created transfer_orders view"], "applied_at": "2026-02-22T17:23:57.018026+05:30", "description": "Applied transfer orders and system enhancements migration", "migration_number": "015"}	\N	\N	2026-02-22 17:23:57.018026+05:30
\.


--
-- TOC entry 5454 (class 0 OID 22992)
-- Dependencies: 256
-- Data for Name: background_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.background_jobs (id, organization_id, job_type, job_name, priority, status, payload, result, error_message, error_stack, retry_count, max_retries, retry_delay_seconds, scheduled_for, started_at, completed_at, timeout_seconds, created_by, created_at, updated_at) FROM stdin;
a706091a-663a-484a-844f-b1f8fd4c902a	\N	process_order	\N	5	failed	{"order": {"items": [{"sku": "SKU001", "name": "Test Item", "price": 299, "quantity": 1}], "status": "pending", "platform": "amazon", "order_date": "2026-02-22T00:00:00Z", "tax_amount": 0, "total_amount": 299, "customer_name": "Croma Customer", "customer_email": "croma@example.com", "customer_phone": "9999999999", "shipping_amount": 50, "shipping_address": {"city": "Mumbai", "state": "Maharashtra", "street": "123 MG Road", "country": "India", "postal_code": "400001"}, "external_order_id": "AMZ-ORG-TEST-001"}, "source": "amazon", "event_type": "order.created", "received_at": "2026-02-22T13:03:01.440Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	\N	column "platform" of relation "orders" does not exist	\N	3	3	60	2026-02-22 18:33:11.23021+05:30	2026-02-22 18:33:11.289104+05:30	2026-02-22 18:33:11.309267+05:30	300	\N	2026-02-22 18:33:01.441264+05:30	2026-02-22 18:33:11.309267+05:30
30b8c772-dac2-4d73-a1a1-c9f1784cfe4e	\N	process_order	\N	5	failed	{"order": {"items": [{"sku": "SKU001", "name": "Test Item", "price": 299, "quantity": 1}], "status": "pending", "platform": "amazon", "order_date": "2026-02-22T00:00:00Z", "tax_amount": 0, "total_amount": 299, "customer_name": "Croma Customer", "customer_email": "croma@test.com", "customer_phone": "9876543210", "shipping_amount": 50, "shipping_address": {"city": "Mumbai", "state": "MH", "street": "123 MG Road", "country": "India", "postal_code": "400001"}, "external_order_id": "AMZ-ORG-TEST-001"}, "source": "amazon", "event_type": "order.created", "received_at": "2026-02-22T13:03:41.944Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	\N	column "platform" of relation "orders" does not exist	\N	3	3	60	2026-02-22 18:33:51.258636+05:30	2026-02-22 18:33:51.32368+05:30	2026-02-22 18:33:51.333367+05:30	300	\N	2026-02-22 18:33:41.94515+05:30	2026-02-22 18:33:51.333367+05:30
7dbedb02-b98c-48e3-b3ac-b37895a272f4	\N	process_order	\N	5	failed	{"order": {"items": [{"sku": "TESTSKU", "name": "Test Product", "price": "499", "quantity": 2}], "status": "pending", "platform": "amazon", "order_date": "2026-02-22T13:00:00Z", "tax_amount": 0, "total_amount": 998, "customer_name": "Croma Verify", "customer_email": "verify@croma.com", "customer_phone": "9876543210", "shipping_amount": 0, "shipping_address": {"city": "Bengaluru", "state": "KA", "street": "MG Road", "country": "India", "postal_code": "560001"}, "external_order_id": "AMZ-ORGVERIFY-002"}, "source": "amazon", "event_type": "order.created", "received_at": "2026-02-22T13:08:13.510Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	\N	new row for relation "orders" violates check constraint "orders_status_check"	\N	3	3	60	2026-02-22 18:38:21.447254+05:30	2026-02-22 18:38:21.531774+05:30	2026-02-22 18:38:21.552791+05:30	300	\N	2026-02-22 18:38:13.510854+05:30	2026-02-22 18:38:21.552791+05:30
e511e096-f09e-4af2-acd6-1ad689dc2a80	\N	process_order	\N	5	completed	{"order": {"items": [{"sku": "TSKU", "name": "Product", "price": "499", "quantity": 1}], "status": "pending", "platform": "amazon", "order_date": "2026-02-22T13:00:00Z", "tax_amount": 0, "total_amount": 499, "customer_name": "Croma Verify Final", "customer_email": "final@croma.com", "customer_phone": "9876543210", "shipping_amount": 0, "shipping_address": {"city": "Bengaluru", "state": "KA", "street": "MG Road", "country": "India", "postal_code": "560001"}, "external_order_id": "AMZ-FINALTEST-001"}, "source": "amazon", "event_type": "order.created", "received_at": "2026-02-22T13:09:41.304Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	{"orderId": "fdbc3b6f-72d6-41cb-91fb-c135a074860b", "success": true, "duration": "13ms", "itemsCount": 1}	\N	\N	0	3	60	2026-02-22 18:39:41.305+05:30	2026-02-22 18:39:41.849617+05:30	2026-02-22 18:39:41.871927+05:30	300	\N	2026-02-22 18:39:41.306067+05:30	2026-02-22 18:39:41.871927+05:30
b1d4d73e-264b-4119-b55a-07feea25ad1e	\N	process_order	\N	5	completed	{"order": {"items": [{"sku": "PHONE-IP15", "weight": 0.5, "quantity": 1, "item_type": "electronics", "dimensions": {"width": 7, "height": 1, "length": 15}, "is_fragile": true, "product_id": null, "unit_price": 79999, "total_price": 79999, "is_hazardous": false, "package_type": "box", "product_name": "iPhone 15", "is_perishable": false, "declared_value": 79999, "requires_insurance": true, "requires_cold_storage": false}], "notes": "Demo order for iPhone 15", "status": "pending_carrier_assignment", "currency": "INR", "priority": "standard", "subtotal": 79999, "order_type": "sales", "tax_amount": 14399.82, "total_amount": 94706.82, "customer_name": "Demo Customer", "customer_email": "demo@example.com", "customer_phone": "9876543210", "discount_amount": 0, "shipping_amount": 308, "shipping_address": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}, "special_instructions": "Handle with care - Fragile electronics", "estimated_shipping_cost": 308}, "source": "demo", "event_type": "order.created", "received_at": "2026-02-22T14:05:15.987Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	{"orderId": "8b720094-99ac-4463-a096-a3185a0baf3d", "success": true, "duration": "6ms", "itemsCount": 1, "externalOrderId": "demo-1771769116900"}	\N	\N	0	3	60	2026-02-22 19:35:15.988+05:30	2026-02-22 19:35:16.895555+05:30	2026-02-22 19:35:16.907262+05:30	300	\N	2026-02-22 19:35:15.988659+05:30	2026-02-22 19:35:16.907262+05:30
b034f676-59c8-4ae2-bef5-2157015bdd57	\N	process_order	\N	5	completed	{"order": {"items": [{"sku": "PHONE-TEST", "name": "Test Phone", "price": 9999, "quantity": 1}], "total_amount": 9999, "customer_name": "Test User", "customer_email": "test@demo.com", "customer_phone": "9999999999", "payment_method": "prepaid", "shipping_address": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "pincode": "400001"}, "external_order_id": "DEMO-E2E-002"}, "source": "croma", "event_type": "order.created", "received_at": "2026-02-22T14:30:05.686Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	{"orderId": "e64b94ae-55a2-4c06-b678-2068a490dde5", "success": true, "duration": "66ms", "itemsCount": 1, "externalOrderId": "DEMO-E2E-002"}	\N	\N	0	3	60	2026-02-22 20:00:05.686+05:30	2026-02-22 20:00:10.287744+05:30	2026-02-22 20:00:10.359574+05:30	300	\N	2026-02-22 20:00:05.68716+05:30	2026-02-22 20:00:10.359574+05:30
90ebc30e-83d2-4650-bc93-e9a69430903a	\N	process_order	\N	5	completed	{"order": {"items": [{"sku": "PHONE-TEST", "name": "Test Phone", "price": 9999, "quantity": 1}], "total_amount": 9999, "customer_name": "Test User", "customer_email": "test@demo.com", "customer_phone": "9999999999", "payment_method": "prepaid", "shipping_address": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "pincode": "400001"}, "external_order_id": "DEMO-E2E-002"}, "source": "croma", "event_type": "order.created", "received_at": "2026-02-22T14:30:12.582Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	{"orderId": "fbac4f82-ac95-4c10-9483-860bf15b6ed7", "success": true, "duration": "87ms", "itemsCount": 1, "externalOrderId": "DEMO-E2E-002"}	\N	\N	0	3	60	2026-02-22 20:00:12.582+05:30	2026-02-22 20:00:15.290965+05:30	2026-02-22 20:00:15.382261+05:30	300	\N	2026-02-22 20:00:12.582677+05:30	2026-02-22 20:00:15.382261+05:30
b4320c10-6fd0-4b06-8662-671dc92555b4	\N	process_order	\N	5	completed	{"order": {"items": [{"sku": "PHONE-IP15", "name": "iPhone 15", "price": 79999, "weight": 0.5, "quantity": 1, "dimensions": {"width": 7, "height": 1, "length": 15}, "is_fragile": true, "declared_value": 79999}], "notes": "Demo order for iPhone 15", "platform": "croma", "priority": "standard", "tax_amount": 14399.82, "total_amount": 94706.82, "customer_name": "Demo Customer", "customer_email": "demo@example.com", "customer_phone": "9876543210", "shipping_amount": 308, "shipping_address": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}, "external_order_id": "DEMO-1771780403661"}, "source": "croma", "event_type": "order.created", "received_at": "2026-02-22T17:13:23.661Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	{"orderId": "8e104bd1-ba60-4034-9a31-5463cfaf72ea", "success": true, "duration": "58ms", "itemsCount": 1, "externalOrderId": "DEMO-1771780403661"}	\N	\N	0	3	60	2026-02-22 22:43:23.668+05:30	2026-02-22 22:43:24.49877+05:30	2026-02-22 22:43:24.566113+05:30	300	\N	2026-02-22 22:43:23.669022+05:30	2026-02-22 22:43:24.566113+05:30
cebb6898-0de2-4a08-97f5-ac3754638c73	\N	process_order	\N	5	completed	{"order": {"items": [{"sku": "BOOK-JSGUIDE", "name": "JavaScript Guide", "price": 599, "weight": 1.2, "quantity": 1, "dimensions": {"width": 18, "height": 3, "length": 24}, "is_fragile": false, "declared_value": 599}], "notes": "Demo order for JavaScript Guide", "platform": "croma", "priority": "standard", "tax_amount": 107.82, "total_amount": 1024.82, "customer_name": "Demo Customer", "customer_email": "demo@example.com", "customer_phone": "9876543210", "shipping_amount": 318, "shipping_address": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}, "external_order_id": "DEMO-1771780971442"}, "source": "croma", "event_type": "order.created", "received_at": "2026-02-22T17:22:51.442Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	{"orderId": "1622c843-2006-4b1a-9071-a200bb518e2c", "success": true, "duration": "52ms", "itemsCount": 1, "orderNumber": "ORD-20260222-30377", "externalOrderId": "DEMO-1771780971442"}	\N	\N	0	3	60	2026-02-22 22:52:51.455+05:30	2026-02-22 22:52:52.820453+05:30	2026-02-22 22:52:52.880192+05:30	300	\N	2026-02-22 22:52:51.45574+05:30	2026-02-22 22:52:52.880192+05:30
\.


--
-- TOC entry 5434 (class 0 OID 22430)
-- Dependencies: 236
-- Data for Name: carrier_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_assignments (id, organization_id, order_id, carrier_id, service_type, status, pickup_address, delivery_address, estimated_pickup, estimated_delivery, actual_pickup, special_instructions, request_payload, acceptance_payload, carrier_reference_id, carrier_tracking_number, rejected_reason, idempotency_key, requested_at, assigned_at, accepted_at, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5440 (class 0 OID 22597)
-- Dependencies: 242
-- Data for Name: carrier_capacity_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_capacity_log (id, carrier_id, daily_capacity, current_load, utilization_percentage, availability_status, logged_at) FROM stdin;
\.


--
-- TOC entry 5442 (class 0 OID 22626)
-- Dependencies: 244
-- Data for Name: carrier_performance_metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_performance_metrics (id, carrier_id, organization_id, period_start, period_end, period_type, total_shipments, delivered_on_time, delivered_late, failed_deliveries, returns_processed, on_time_rate, delivery_success_rate, damage_rate, avg_delivery_hours, avg_first_attempt_success_rate, calculated_at) FROM stdin;
\.


--
-- TOC entry 5438 (class 0 OID 22545)
-- Dependencies: 240
-- Data for Name: carrier_quotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_quotes (id, order_id, carrier_id, quoted_price, estimated_delivery_days, service_type, response_time_ms, was_retried, retry_count, was_selected, selection_reason, status, error_message, request_payload, response_payload, quoted_at, expires_at) FROM stdin;
\.


--
-- TOC entry 5439 (class 0 OID 22570)
-- Dependencies: 241
-- Data for Name: carrier_rejections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_rejections (id, carrier_assignment_id, carrier_id, order_id, reason, message, error_code, response_time_ms, raw_response, rejected_at) FROM stdin;
\.


--
-- TOC entry 5425 (class 0 OID 22183)
-- Dependencies: 227
-- Data for Name: carriers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carriers (id, organization_id, code, name, service_type, service_areas, contact_email, contact_phone, website, api_endpoint, api_key_encrypted, webhook_url, reliability_score, avg_delivery_days, daily_capacity, current_load, is_active, availability_status, last_status_change, created_at, updated_at, webhook_secret, our_client_id, our_client_secret, ip_whitelist, webhook_events, webhook_enabled) FROM stdin;
3d2cffcd-5e43-48ca-9c6e-9427afab1070	\N	DELHIVERY	Delhivery	standard	\N	support@delhivery.com	\N	\N	\N	\N	\N	0.92	\N	1000	0	t	available	2026-02-16 14:32:00.319073+05:30	2026-02-16 14:32:00.319073+05:30	2026-02-18 01:49:56.631479+05:30	whsec_delhivery_a7b1268b3ae9ab3c3adc786456d1757d	scm_client_3d2cffcd-5e43-48ca-9c6e-9427afab1070	scm_secret_841779c27790c75e9a8a7d2ba70498e8	\N	{shipment.pickup,shipment.in_transit,shipment.delivered,shipment.exception}	t
66e17e40-c5f2-4eca-9a5d-c4166b00d571	\N	BLUEDART	BlueDart Express	express	\N	support@bluedart.com	\N	\N	\N	\N	\N	0.95	\N	500	0	t	available	2026-02-16 14:32:00.319073+05:30	2026-02-16 14:32:00.319073+05:30	2026-02-18 01:49:56.631479+05:30	whsec_bluedart_b79f62b01e936c41ce7f0b1adb283be5	scm_client_66e17e40-c5f2-4eca-9a5d-c4166b00d571	scm_secret_65e7c2b373733c3ee7313d373356cccb	\N	{shipment.pickup,shipment.in_transit,shipment.delivered,shipment.exception}	t
9d4c95c3-2e98-46d1-b0ac-3023398e99c3	\N	DTDC	DTDC Courier	standard	\N	support@dtdc.com	\N	\N	\N	\N	\N	0.88	\N	800	0	t	available	2026-02-16 14:32:00.319073+05:30	2026-02-16 14:32:00.319073+05:30	2026-02-18 01:49:56.631479+05:30	whsec_dtdc_d5101563c177673a02b5216b350bb80f	scm_client_9d4c95c3-2e98-46d1-b0ac-3023398e99c3	scm_secret_2409c32e6ead5e56f4744caeb611f0c2	\N	{shipment.pickup,shipment.in_transit,shipment.delivered,shipment.exception}	t
a0c33fcb-0cb7-45d0-ba2a-22f777612b64	\N	ECOM	Ecom Express	standard	\N	support@ecomexpress.in	\N	\N	\N	\N	\N	0.90	\N	600	0	t	available	2026-02-16 14:32:00.319073+05:30	2026-02-16 14:32:00.319073+05:30	2026-02-18 01:49:56.631479+05:30	whsec_ecom_7c0ecff5bb944d02c6ec6d0d55ee519f	scm_client_a0c33fcb-0cb7-45d0-ba2a-22f777612b64	scm_secret_2bb401c9bbbaf4c0fd35ebd2c9b09079	\N	{shipment.pickup,shipment.in_transit,shipment.delivered,shipment.exception}	t
ae48904e-1967-4ded-b73c-ccae165fd0c9	\N	SHADOWFAX	Shadowfax	same_day	\N	support@shadowfax.in	\N	\N	\N	\N	\N	0.87	\N	300	0	t	available	2026-02-16 14:32:00.319073+05:30	2026-02-16 14:32:00.319073+05:30	2026-02-18 01:49:56.631479+05:30	whsec_shadowfax_bdb1c849a9a56d70e1071334b946de58	scm_client_ae48904e-1967-4ded-b73c-ccae165fd0c9	scm_secret_6ce10d120779f904b6cc0206b8273800	\N	{shipment.pickup,shipment.in_transit,shipment.delivered,shipment.exception}	t
\.


--
-- TOC entry 5456 (class 0 OID 23041)
-- Dependencies: 258
-- Data for Name: cron_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cron_schedules (id, organization_id, name, description, job_type, cron_expression, timezone, payload, is_active, last_run_at, last_run_status, next_run_at, total_runs, failed_runs, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5457 (class 0 OID 23064)
-- Dependencies: 259
-- Data for Name: dead_letter_queue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dead_letter_queue (id, original_job_id, job_type, payload, priority, error_message, error_stack, retry_count, original_created_at, moved_to_dlq_at, reprocessed, reprocessed_at, reprocessed_job_id) FROM stdin;
\.


--
-- TOC entry 5451 (class 0 OID 22915)
-- Dependencies: 253
-- Data for Name: eta_predictions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.eta_predictions (id, shipment_id, predicted_delivery, confidence_score, delay_risk_score, factors, actual_delivery, prediction_accuracy_hours, model_version, created_at) FROM stdin;
\.


--
-- TOC entry 5449 (class 0 OID 22829)
-- Dependencies: 251
-- Data for Name: exceptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exceptions (id, organization_id, exception_type, severity, priority, shipment_id, order_id, carrier_id, title, description, root_cause, status, escalation_level, escalated_at, assigned_to, assigned_at, resolution, resolution_notes, sla_impacted, customer_impacted, financial_impact, estimated_resolution_time, resolved_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5429 (class 0 OID 22279)
-- Dependencies: 231
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory (id, warehouse_id, product_id, sku, product_name, quantity, available_quantity, reserved_quantity, damaged_quantity, in_transit_quantity, bin_location, zone, reorder_point, max_stock_level, last_stock_check, created_at, updated_at, unit_cost, organization_id) FROM stdin;
a6c0ec1b-cd47-4f5a-803e-b9736f68e028	52562629-31dd-40e5-8f8f-b30c493847a2	052e04d6-464c-45d6-b39f-8a0689ecb977	LAP-202602-VPGOX	Laptop	20	18	2	0	0	A-01-01	A	4	20	\N	2026-02-23 01:31:52.207474+05:30	2026-02-23 01:31:52.207474+05:30	0.00	314c5bb9-2a9d-4da3-889f-12bc1af98c8e
\.


--
-- TOC entry 5453 (class 0 OID 22965)
-- Dependencies: 255
-- Data for Name: invoice_line_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_line_items (id, invoice_id, shipment_id, order_id, description, item_type, quantity, unit_price, amount, created_at) FROM stdin;
\.


--
-- TOC entry 5452 (class 0 OID 22933)
-- Dependencies: 254
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, organization_id, invoice_number, carrier_id, billing_period_start, billing_period_end, total_shipments, base_amount, penalties, adjustments, tax_amount, final_amount, currency, status, due_date, paid_amount, paid_at, payment_method, payment_reference, invoice_url, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5455 (class 0 OID 23023)
-- Dependencies: 257
-- Data for Name: job_execution_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.job_execution_logs (id, job_id, attempt_number, status, error_message, execution_time_ms, output_data, started_at, completed_at) FROM stdin;
297c6cc6-2c5e-4f84-8c7c-021a20015209	a706091a-663a-484a-844f-b1f8fd4c902a	1	failed	column "platform" of relation "orders" does not exist	29	\N	2026-02-22 18:33:06.194122+05:30	2026-02-22 18:33:06.223425+05:30
fb2fe546-783e-4723-afdc-4b25f469360a	a706091a-663a-484a-844f-b1f8fd4c902a	2	failed	column "platform" of relation "orders" does not exist	27	\N	2026-02-22 18:33:06.282485+05:30	2026-02-22 18:33:06.3094+05:30
b7c546ec-8aa0-4184-ba84-2f277fc0e73a	a706091a-663a-484a-844f-b1f8fd4c902a	3	failed	column "platform" of relation "orders" does not exist	23	\N	2026-02-22 18:33:11.19866+05:30	2026-02-22 18:33:11.221976+05:30
96bc998e-a37c-4c10-a80c-b451601e7b27	a706091a-663a-484a-844f-b1f8fd4c902a	4	failed	column "platform" of relation "orders" does not exist	20	\N	2026-02-22 18:33:11.289104+05:30	2026-02-22 18:33:11.309267+05:30
a5521609-4ca8-4ea6-8a25-6b3a70758fe2	30b8c772-dac2-4d73-a1a1-c9f1784cfe4e	1	failed	column "platform" of relation "orders" does not exist	29	\N	2026-02-22 18:33:46.223454+05:30	2026-02-22 18:33:46.252525+05:30
8711c6c6-e7d2-4649-b976-fd451b23f11e	30b8c772-dac2-4d73-a1a1-c9f1784cfe4e	2	failed	column "platform" of relation "orders" does not exist	10	\N	2026-02-22 18:33:46.317617+05:30	2026-02-22 18:33:46.327877+05:30
78e77e85-fade-46c0-a94f-be66f94d836f	30b8c772-dac2-4d73-a1a1-c9f1784cfe4e	3	failed	column "platform" of relation "orders" does not exist	25	\N	2026-02-22 18:33:51.229284+05:30	2026-02-22 18:33:51.254225+05:30
7fe3a267-5568-4ca1-8283-485a0b323858	30b8c772-dac2-4d73-a1a1-c9f1784cfe4e	4	failed	column "platform" of relation "orders" does not exist	10	\N	2026-02-22 18:33:51.32368+05:30	2026-02-22 18:33:51.333367+05:30
06b5464d-dad3-4d5b-846d-6d6c2fc77666	7dbedb02-b98c-48e3-b3ac-b37895a272f4	1	failed	new row for relation "orders" violates check constraint "orders_status_check"	25	\N	2026-02-22 18:38:16.412665+05:30	2026-02-22 18:38:16.437705+05:30
2f66910a-40f4-45c0-9f32-3457cfe3b25d	7dbedb02-b98c-48e3-b3ac-b37895a272f4	2	failed	new row for relation "orders" violates check constraint "orders_status_check"	20	\N	2026-02-22 18:38:16.525085+05:30	2026-02-22 18:38:16.54516+05:30
ad9fa523-707c-4b2b-b0d3-0aead14f62f1	7dbedb02-b98c-48e3-b3ac-b37895a272f4	3	failed	new row for relation "orders" violates check constraint "orders_status_check"	21	\N	2026-02-22 18:38:21.417654+05:30	2026-02-22 18:38:21.439146+05:30
13ae8f72-ed84-40a9-8943-bf1f177c476a	7dbedb02-b98c-48e3-b3ac-b37895a272f4	4	failed	new row for relation "orders" violates check constraint "orders_status_check"	21	\N	2026-02-22 18:38:21.531774+05:30	2026-02-22 18:38:21.552791+05:30
8d2fa48e-5347-42cc-98f9-179be00b64f2	e511e096-f09e-4af2-acd6-1ad689dc2a80	1	completed	\N	19	\N	2026-02-22 18:39:41.839426+05:30	2026-02-22 18:39:41.858719+05:30
c0c06c3d-3097-4ea0-a57c-b952fe4ed6ad	e511e096-f09e-4af2-acd6-1ad689dc2a80	1	completed	\N	22	\N	2026-02-22 18:39:41.849617+05:30	2026-02-22 18:39:41.871927+05:30
8e3ab53a-0044-4dcd-9678-bee55372e635	b1d4d73e-264b-4119-b55a-07feea25ad1e	1	completed	\N	12	\N	2026-02-22 19:35:16.895555+05:30	2026-02-22 19:35:16.907262+05:30
9e604a67-07de-4e5f-a562-9e07b41e901c	b034f676-59c8-4ae2-bef5-2157015bdd57	1	completed	\N	72	\N	2026-02-22 20:00:10.287744+05:30	2026-02-22 20:00:10.359574+05:30
28849c06-b131-4bca-b714-0f5f0136fdfb	90ebc30e-83d2-4650-bc93-e9a69430903a	1	completed	\N	91	\N	2026-02-22 20:00:15.290965+05:30	2026-02-22 20:00:15.382261+05:30
ae7fcd8f-2e66-496d-b004-c77077a4df1b	b4320c10-6fd0-4b06-8662-671dc92555b4	1	completed	\N	67	\N	2026-02-22 22:43:24.49877+05:30	2026-02-22 22:43:24.566113+05:30
5273b57e-1b8b-4ada-96b9-5e2944523a0b	cebb6898-0de2-4a08-97f5-ac3754638c73	1	completed	\N	60	\N	2026-02-22 22:52:52.820453+05:30	2026-02-22 22:52:52.880192+05:30
\.


--
-- TOC entry 5460 (class 0 OID 23143)
-- Dependencies: 262
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, organization_id, type, title, message, entity_type, entity_id, link, is_read, read_at, priority, created_at, expires_at) FROM stdin;
\.


--
-- TOC entry 5432 (class 0 OID 22374)
-- Dependencies: 234
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, product_id, sku, product_name, quantity, fulfilled_quantity, unit_price, discount, tax, total_price, weight, warehouse_id, bin_location, status, shipped_at, created_at, dimensions, is_fragile, is_hazardous, is_perishable, requires_cold_storage, item_type, volumetric_weight, package_type, handling_instructions, requires_insurance, declared_value) FROM stdin;
\.


--
-- TOC entry 5433 (class 0 OID 22405)
-- Dependencies: 235
-- Data for Name: order_splits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_splits (id, parent_order_id, child_order_id, warehouse_id, split_reason, created_at) FROM stdin;
\.


--
-- TOC entry 5431 (class 0 OID 22340)
-- Dependencies: 233
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, organization_id, order_number, external_order_id, customer_name, customer_email, customer_phone, status, priority, order_type, is_cod, subtotal, tax_amount, shipping_amount, discount_amount, total_amount, currency, shipping_address, billing_address, estimated_delivery, actual_delivery, promised_delivery, allocated_warehouse_id, shipping_locked_by, shipping_locked_at, notes, special_instructions, tags, created_at, updated_at, carrier_id, supplier_id, supplier_name, platform, customer_id, payment_method) FROM stdin;
\.


--
-- TOC entry 5418 (class 0 OID 22024)
-- Dependencies: 220
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, code, email, phone, website, address, city, state, country, postal_code, timezone, currency, logo_url, is_active, subscription_tier, created_at, updated_at, webhook_token) FROM stdin;
314c5bb9-2a9d-4da3-889f-12bc1af98c8e	Croma	ORG-26-001	contact@croma.com	9876543210	https://croma.com	ABC	Mumbai	Magarashtra	India	400001	Asia/Kolkata	INR	\N	t	standard	2026-02-22 15:27:27.602374+05:30	2026-02-22 18:28:15.299892+05:30	7d0aa9fe498ea6bc704bd230ea00bdc57c4c246213d91eba3c1ceaaabab83293
\.


--
-- TOC entry 5446 (class 0 OID 22733)
-- Dependencies: 248
-- Data for Name: pick_list_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pick_list_items (id, pick_list_id, order_item_id, inventory_id, sku, product_name, quantity_to_pick, quantity_picked, bin_location, zone, status, picked_at, picked_by) FROM stdin;
\.


--
-- TOC entry 5445 (class 0 OID 22701)
-- Dependencies: 247
-- Data for Name: pick_lists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pick_lists (id, organization_id, warehouse_id, pick_list_number, status, priority, total_items, picked_items, assigned_to, assigned_at, started_at, completed_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5427 (class 0 OID 22231)
-- Dependencies: 229
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, organization_id, sku, name, description, category, weight, dimensions, unit_price, cost_price, currency, attributes, images, is_active, is_fragile, requires_cold_storage, is_hazmat, created_at, updated_at, is_perishable, item_type, volumetric_weight, package_type, handling_instructions, requires_insurance, declared_value) FROM stdin;
052e04d6-464c-45d6-b39f-8a0689ecb977	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	LAP-202602-VPGOX	Laptop	Its a freaking laptop.	Electronics	1.400	{"unit": "cm", "width": 15, "height": 2, "length": 30}	100000.00	75000.00	INR	\N	\N	t	t	f	f	2026-02-23 01:31:08.789986+05:30	2026-02-23 01:31:08.789986+05:30	f	general	0.180	box	\N	f	\N
\.


--
-- TOC entry 5441 (class 0 OID 22611)
-- Dependencies: 243
-- Data for Name: quote_idempotency_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_idempotency_cache (idempotency_key, quote_id, response_data, created_at, expires_at) FROM stdin;
\.


--
-- TOC entry 5426 (class 0 OID 22210)
-- Dependencies: 228
-- Data for Name: rate_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rate_cards (id, carrier_id, origin_state, origin_city, destination_state, destination_city, service_type, base_rate, per_kg_rate, per_km_rate, fuel_surcharge_pct, cod_charge, effective_from, effective_to, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 5448 (class 0 OID 22802)
-- Dependencies: 250
-- Data for Name: return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.return_items (id, return_id, order_item_id, product_id, sku, product_name, quantity, reason, reason_detail, condition, created_at) FROM stdin;
\.


--
-- TOC entry 5447 (class 0 OID 22766)
-- Dependencies: 249
-- Data for Name: returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.returns (id, organization_id, rma_number, external_return_id, order_id, original_shipment_id, return_shipment_id, customer_name, customer_email, customer_phone, reason, reason_detail, status, quality_check_result, quality_check_notes, inspection_images, refund_amount, restocking_fee, refund_status, refund_processed_at, items, pickup_address, requested_at, approved_at, received_at, resolved_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5436 (class 0 OID 22509)
-- Dependencies: 238
-- Data for Name: shipment_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipment_events (id, shipment_id, event_type, event_code, status, location, city, description, remarks, source, raw_payload, event_timestamp, created_at) FROM stdin;
\.


--
-- TOC entry 5435 (class 0 OID 22465)
-- Dependencies: 237
-- Data for Name: shipments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipments (id, organization_id, tracking_number, carrier_tracking_number, awb_number, order_id, carrier_assignment_id, carrier_id, warehouse_id, status, origin_address, destination_address, weight, volumetric_weight, dimensions, package_count, shipping_cost, cod_amount, current_location, route_geometry, tracking_events, delivery_attempts, pickup_scheduled, pickup_actual, delivery_scheduled, delivery_actual, pod_image_url, pod_signature_url, delivered_to, delivery_notes, created_at, updated_at, is_fragile, is_hazardous, is_perishable, requires_cold_storage, item_type, package_type, handling_instructions, requires_insurance, declared_value, total_items) FROM stdin;
\.


--
-- TOC entry 5437 (class 0 OID 22527)
-- Dependencies: 239
-- Data for Name: shipping_estimates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipping_estimates (id, order_id, carrier_id, estimated_cost, estimated_days, service_type, confidence_score, actual_cost, actual_days, accuracy_percent, created_at) FROM stdin;
\.


--
-- TOC entry 5428 (class 0 OID 22256)
-- Dependencies: 230
-- Data for Name: sla_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sla_policies (id, organization_id, name, service_type, origin_region, destination_region, delivery_hours, pickup_hours, first_attempt_delivery_hours, penalty_per_hour, max_penalty_amount, penalty_type, is_active, priority, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5450 (class 0 OID 22875)
-- Dependencies: 252
-- Data for Name: sla_violations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sla_violations (id, organization_id, shipment_id, sla_policy_id, carrier_id, violation_type, promised_delivery, actual_delivery, delay_hours, penalty_amount, penalty_status, status, waiver_reason, waived_by, waived_at, reason, notes, violated_at, resolved_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5430 (class 0 OID 22306)
-- Dependencies: 232
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movements (id, warehouse_id, product_id, inventory_id, movement_type, quantity, reference_type, reference_id, notes, batch_number, created_by, created_at, performed_by) FROM stdin;
\.


--
-- TOC entry 5463 (class 0 OID 23553)
-- Dependencies: 271
-- Data for Name: user_notification_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_notification_preferences (id, user_id, email_enabled, push_enabled, sms_enabled, notification_types, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5420 (class 0 OID 22070)
-- Dependencies: 222
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_permissions (id, user_id, permission, granted_by, created_at) FROM stdin;
\.


--
-- TOC entry 5422 (class 0 OID 22113)
-- Dependencies: 224
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_sessions (id, user_id, session_token, refresh_token, device_name, device_type, ip_address, user_agent, is_active, last_active, created_at, expires_at) FROM stdin;
\.


--
-- TOC entry 5421 (class 0 OID 22092)
-- Dependencies: 223
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_settings (id, user_id, notification_preferences, ui_preferences, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5419 (class 0 OID 22044)
-- Dependencies: 221
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, name, role, organization_id, avatar, phone, is_active, email_verified, last_login, failed_login_attempts, locked_until, created_at, updated_at) FROM stdin;
7279923c-315d-4168-ba92-00e1b439bdd6	superadmin@twinchain.com	$2b$10$.vQWUI6qz87SDtMLPvui5eK2P2HMnYDJh4Gc8iQnsfg7271lrywI2	Super Admin	superadmin	\N	\N	\N	t	f	2026-02-22 16:25:03.462103+05:30	0	\N	2026-02-22 15:10:59.61103+05:30	2026-02-22 16:25:03.462103+05:30
ad53579f-780f-4c6a-9d7d-5b065efba5f8	admin@croma.com	$2b$10$.vQWUI6qz87SDtMLPvui5eK2P2HMnYDJh4Gc8iQnsfg7271lrywI2	Croma Admin	admin	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	\N	8765432109	t	f	2026-02-23 01:40:09.715904+05:30	0	\N	2026-02-22 15:27:27.602374+05:30	2026-02-23 01:40:09.715904+05:30
d1e995e2-ffe2-4bd5-8952-6e9cd5724de7	superadmin@twinchain.in	$2b$10$demoHashedPassword	Super Admin	superadmin	\N	https://api.dicebear.com/7.x/avataaars/svg?seed=SuperAdmin	\N	t	f	\N	0	\N	2026-02-27 13:27:11.485686+05:30	2026-02-27 13:27:11.485686+05:30
\.


--
-- TOC entry 5424 (class 0 OID 22154)
-- Dependencies: 226
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouses (id, organization_id, code, name, address, coordinates, capacity, current_utilization, manager_id, contact_email, contact_phone, is_active, warehouse_type, created_at, updated_at, zones, operating_hours) FROM stdin;
52562629-31dd-40e5-8f8f-b30c493847a2	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	WH-26-001	Anand Warehouse	{"city": "Anand", "state": "Gujarat", "street": "MG Road", "country": "India", "postal_code": "300001"}	{"lat": 22.5586555, "lng": 72.9627227}	5000	0.00	\N	jeel@gmail.com	9876543210	t	standard	2026-02-22 23:26:30.630438+05:30	2026-02-22 23:26:30.630438+05:30	0	\N
\.


--
-- TOC entry 5461 (class 0 OID 23429)
-- Dependencies: 267
-- Data for Name: webhook_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.webhook_logs (id, carrier_id, endpoint, method, request_signature, request_timestamp, signature_valid, ip_address, user_agent, payload, headers, response_status, response_body, error_message, processing_time_ms, created_at) FROM stdin;
8c1d7440-f918-48f5-8dfd-90cd79fabd7d	66e17e40-c5f2-4eca-9a5d-c4166b00d571	/assignments/bdd9fff0-a588-445a-8372-d61985129f73/accept	POST	sha256=a6eb276dc6b47eb82dc8eaf0c01ee561831847661e9f9f5c3b17e9102bfaf2ff	1771359796	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 15981, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 15981, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹15981", "trackingNumber": "DELHIVERY-TRACK-1771359796377", "carrierReferenceId": "DELHIVERY-1771359796377", "estimatedPickupTime": "2026-02-17T22:23:16.377Z", "estimatedDeliveryTime": "2026-02-19T20:23:16.377Z"}	{"content-type": "application/json", "x-carrier-id": "66e17e40-c5f2-4eca-9a5d-c4166b00d571"}	200	\N	\N	1	2026-02-18 01:53:16.389162+05:30
e0b8cee3-ca40-418e-8818-8389d1760082	66e17e40-c5f2-4eca-9a5d-c4166b00d571	/assignments/bdd9fff0-a588-445a-8372-d61985129f73/accept	POST	sha256=fe8330de3a270821103cf91bf5ae82a9fb9fe29becbdcc8f6e0367b3d0f7357e	1771360116	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 15981, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 15981, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹15981", "trackingNumber": "DELHIVERY-TRACK-1771360116708", "carrierReferenceId": "DELHIVERY-1771360116708", "estimatedPickupTime": "2026-02-17T22:28:36.708Z", "estimatedDeliveryTime": "2026-02-19T20:28:36.708Z"}	{"content-type": "application/json", "x-carrier-id": "66e17e40-c5f2-4eca-9a5d-c4166b00d571"}	200	\N	\N	1	2026-02-18 01:58:36.730792+05:30
7405fbd7-54ee-40ac-bce3-9763b7be697d	66e17e40-c5f2-4eca-9a5d-c4166b00d571	/assignments/bdd9fff0-a588-445a-8372-d61985129f73/accept	POST	sha256=9dd232d111710f31e8506d4af144289cd6ba2ff9e0096ca37bd1077533b2ad14	1771360383	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 15981, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 15981, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹15981", "trackingNumber": "DELHIVERY-TRACK-1771360383991", "carrierReferenceId": "DELHIVERY-1771360383991", "estimatedPickupTime": "2026-02-17T22:33:03.991Z", "estimatedDeliveryTime": "2026-02-19T20:33:03.991Z"}	{"content-type": "application/json", "x-carrier-id": "66e17e40-c5f2-4eca-9a5d-c4166b00d571"}	200	\N	\N	1	2026-02-18 02:03:04.012724+05:30
5dcb92d7-9920-4000-85da-828060e5ead5	66e17e40-c5f2-4eca-9a5d-c4166b00d571	/assignments/bdd9fff0-a588-445a-8372-d61985129f73/accept	POST	sha256=239adbb63cb889feea38aed9896f5ebc1715fbf9a91a429825faac3fa3aa26e2	1771360444	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 15981, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 15981, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹15981", "trackingNumber": "DELHIVERY-TRACK-1771360444231", "carrierReferenceId": "DELHIVERY-1771360444231", "estimatedPickupTime": "2026-02-17T22:34:04.231Z", "estimatedDeliveryTime": "2026-02-19T20:34:04.231Z"}	{"content-type": "application/json", "x-carrier-id": "66e17e40-c5f2-4eca-9a5d-c4166b00d571"}	200	\N	\N	1	2026-02-18 02:04:04.254005+05:30
ad6297de-10dd-4409-bd89-f3bb887d3279	66e17e40-c5f2-4eca-9a5d-c4166b00d571	/assignments/bdd9fff0-a588-445a-8372-d61985129f73/accept	POST	sha256=446c54640292cbe797ae502966e675b9fc63f5e5048bdca888f35c89c02d193d	1771360502	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 15981, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 15981, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹15981", "trackingNumber": "DELHIVERY-TRACK-1771360502547", "carrierReferenceId": "DELHIVERY-1771360502547", "estimatedPickupTime": "2026-02-17T22:35:02.547Z", "estimatedDeliveryTime": "2026-02-19T20:35:02.547Z"}	{"content-type": "application/json", "x-carrier-id": "66e17e40-c5f2-4eca-9a5d-c4166b00d571"}	200	\N	\N	1	2026-02-18 02:05:02.557891+05:30
2d89a1f8-87ff-40b8-91da-da304cb25995	66e17e40-c5f2-4eca-9a5d-c4166b00d571	/assignments/bdd9fff0-a588-445a-8372-d61985129f73/accept	POST	sha256=c5d0bc96dbef11f432ca465645e2ad9038cf487763d7225c2c8231330b001180	1771360732	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 15981, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 15981, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹15981", "trackingNumber": "DELHIVERY-TRACK-1771360732904", "carrierReferenceId": "DELHIVERY-1771360732904", "estimatedPickupTime": "2026-02-17T22:38:52.904Z", "estimatedDeliveryTime": "2026-02-19T20:38:52.904Z"}	{"content-type": "application/json", "x-carrier-id": "66e17e40-c5f2-4eca-9a5d-c4166b00d571"}	200	\N	\N	2	2026-02-18 02:08:52.914591+05:30
7448eff8-18dd-4d91-86c6-23dd318765bf	3d2cffcd-5e43-48ca-9c6e-9427afab1070	/assignments/bdd9fff0-a588-445a-8372-d61985129f73/accept	POST	sha256=f3957a5ad4be25d2cff5706563626cbe1234d92c4dd68cd3799cbe91ec3b18f3	1771360955	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 15981, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 15981, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹15981", "trackingNumber": "DELHIVERY-TRACK-1771360955032", "carrierReferenceId": "DELHIVERY-1771360955032", "estimatedPickupTime": "2026-02-17T22:42:35.032Z", "estimatedDeliveryTime": "2026-02-19T20:42:35.032Z"}	{"content-type": "application/json", "x-carrier-id": "3d2cffcd-5e43-48ca-9c6e-9427afab1070"}	200	\N	\N	2	2026-02-18 02:12:35.041136+05:30
e816eb26-c0d7-4ca9-bf73-b713e9ed8721	3d2cffcd-5e43-48ca-9c6e-9427afab1070	/shipments/67bd7a97-bb45-4d2d-8292-8bcdb0d7b2f6/confirm-pickup	POST	sha256=ecc206ba16603f8a983cf63835a99ad7fcd9af6ac21def0235cbb591755f1347	1771360973	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"notes": "Package picked up by DELHIVERY carrier", "carrierId": "3d2cffcd-5e43-48ca-9c6e-9427afab1070", "driverName": "DELHIVERY Driver", "gpsLocation": {"lat": 19.048191901573514, "lon": 72.90866797266169, "city": "Mumbai", "state": "Maharashtra"}, "vehicleNumber": "DE-01-AB-1447", "pickupTimestamp": "2026-02-17T20:42:53.958Z"}	{"content-type": "application/json", "x-carrier-id": "3d2cffcd-5e43-48ca-9c6e-9427afab1070"}	200	\N	\N	1	2026-02-18 02:12:53.96391+05:30
726151eb-b5d5-4193-a953-e977ccce430c	3d2cffcd-5e43-48ca-9c6e-9427afab1070	/shipments/67bd7a97-bb45-4d2d-8292-8bcdb0d7b2f6/confirm-pickup	POST	sha256=8a47a6bd015cb39e180706af48e570a5503b3a3701c3d001983689a97c086f31	1771361080	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"notes": "Package picked up by DELHIVERY carrier", "carrierId": "3d2cffcd-5e43-48ca-9c6e-9427afab1070", "driverName": "DELHIVERY Driver", "gpsLocation": {"lat": 19.06268836651498, "lon": 72.92142002169065, "city": "Mumbai", "state": "Maharashtra"}, "vehicleNumber": "DE-01-AB-2938", "pickupTimestamp": "2026-02-17T20:44:40.497Z"}	{"content-type": "application/json", "x-carrier-id": "3d2cffcd-5e43-48ca-9c6e-9427afab1070"}	200	\N	\N	1	2026-02-18 02:14:40.508743+05:30
7c44795f-fb07-4387-85f9-2ca769354a98	3d2cffcd-5e43-48ca-9c6e-9427afab1070	/assignments/a5e684f8-a1ec-43fb-86dc-4321e9864d77/accept	POST	sha256=16f4ae1c3a44bf46864caec3ed91bf59fce29e6c09c5e43837ad05ca9dbb98c9	1771653635	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 154, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 154, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹154", "trackingNumber": "DELHIVERY-TRACK-1771653635779", "carrierReferenceId": "DELHIVERY-1771653635779", "estimatedPickupTime": "2026-02-21T08:00:35.779Z", "estimatedDeliveryTime": "2026-02-23T06:00:35.779Z"}	{"content-type": "application/json", "x-carrier-id": "3d2cffcd-5e43-48ca-9c6e-9427afab1070"}	200	\N	\N	2	2026-02-21 11:30:35.790985+05:30
28b8c01a-fae0-444c-9655-cf53163bb9b5	3d2cffcd-5e43-48ca-9c6e-9427afab1070	/assignments/682eb6ce-df14-42cd-9a3e-9e616e841e50/accept	POST	sha256=68d152b2935fabe4b7b98f64468144e90d04905d0706fdd0de1ba49e38d0d2bb	1771655061	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 1500, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 1500, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹1500", "trackingNumber": "DELHIVERY-TRACK-1771655061930", "carrierReferenceId": "DELHIVERY-1771655061930", "estimatedPickupTime": "2026-02-21T08:24:21.930Z", "estimatedDeliveryTime": "2026-02-23T06:24:21.930Z"}	{"content-type": "application/json", "x-carrier-id": "3d2cffcd-5e43-48ca-9c6e-9427afab1070"}	200	\N	\N	1	2026-02-21 11:54:21.940472+05:30
0aa72d25-3be5-4f8e-b1df-37b7a5403778	3d2cffcd-5e43-48ca-9c6e-9427afab1070	/assignments/4884fb66-37a2-4d77-8339-2c4235a82c43/accept	POST	sha256=eadb098f31435017162d339f6afea02b835d407f3c7c650e52340cec7adb7d24	1771780983	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 154, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 154, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹154", "trackingNumber": "DELHIVERY-TRACK-1771780983076", "carrierReferenceId": "DELHIVERY-1771780983076", "estimatedPickupTime": "2026-02-22T19:23:03.076Z", "estimatedDeliveryTime": "2026-02-24T17:23:03.076Z"}	{"content-type": "application/json", "x-carrier-id": "3d2cffcd-5e43-48ca-9c6e-9427afab1070"}	200	\N	\N	1	2026-02-22 22:53:03.089593+05:30
eb452b9a-5e1a-4dba-af80-458b76fc6d06	3d2cffcd-5e43-48ca-9c6e-9427afab1070	/shipments/e139663f-f946-4ff5-9e2a-68bc3d4c405f/confirm-pickup	POST	sha256=99c9d44ec054f00fbe35593ec7b825d2e0864c56387be1622ba387fdb4079bc2	1771781314	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"notes": "Package picked up by DELHIVERY carrier", "carrierId": "3d2cffcd-5e43-48ca-9c6e-9427afab1070", "driverName": "DELHIVERY Driver", "gpsLocation": {"lat": 19.05580893502723, "lon": 72.8378503736456, "city": "Mumbai", "state": "Maharashtra"}, "vehicleNumber": "DE-01-AB-2720", "pickupTimestamp": "2026-02-22T17:28:34.770Z"}	{"content-type": "application/json", "x-carrier-id": "3d2cffcd-5e43-48ca-9c6e-9427afab1070"}	200	\N	\N	1	2026-02-22 22:58:34.777627+05:30
c00de9ac-c2cf-456b-b4d3-28a7453d0c22	3d2cffcd-5e43-48ca-9c6e-9427afab1070	/assignments/aab4c0f5-6ce8-4e83-9624-86464e75d364/accept	POST	sha256=ae5126596ed86831dc94a4791823a38fbbd24f01b84791d8816444e8566747e5	1771782711	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 300, "driver": {"name": "Demo Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "TN-01-AB-1234"}, "currency": "INR", "quotedPrice": 300, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹300", "trackingNumber": "DELHIVERY-TRACK-1771782711013", "carrierReferenceId": "DELHIVERY-1771782711013", "estimatedPickupTime": "2026-02-22T19:51:51.013Z", "estimatedDeliveryTime": "2026-02-24T17:51:51.013Z"}	{"content-type": "application/json", "x-carrier-id": "3d2cffcd-5e43-48ca-9c6e-9427afab1070"}	200	\N	\N	2	2026-02-22 23:21:51.02139+05:30
ca1e262e-19ca-4c29-9d32-4e1c9f890848	3d2cffcd-5e43-48ca-9c6e-9427afab1070	/shipments/1ec78c5c-598d-4200-a37c-b558211aec6d/confirm-pickup	POST	sha256=78672371cd954b4f7028018599da722aff058231cadcd5d5cb36c23e193bad59	1771782745	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"notes": "Package picked up by DELHIVERY carrier", "carrierId": "3d2cffcd-5e43-48ca-9c6e-9427afab1070", "driverName": "DELHIVERY Driver", "gpsLocation": {"lat": 19.08898553669412, "lon": 72.91926658256675, "city": "Mumbai", "state": "Maharashtra"}, "vehicleNumber": "DE-01-AB-1366", "pickupTimestamp": "2026-02-22T17:52:25.514Z"}	{"content-type": "application/json", "x-carrier-id": "3d2cffcd-5e43-48ca-9c6e-9427afab1070"}	200	\N	\N	1	2026-02-22 23:22:25.522198+05:30
\.


--
-- TOC entry 5539 (class 0 OID 0)
-- Dependencies: 270
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_notification_preferences_id_seq', 1, false);


--
-- TOC entry 5117 (class 2606 OID 23099)
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 5122 (class 2606 OID 23122)
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 5032 (class 2606 OID 22685)
-- Name: allocation_history allocation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5028 (class 2606 OID 22667)
-- Name: allocation_rules allocation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_rules
    ADD CONSTRAINT allocation_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 4882 (class 2606 OID 22143)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5096 (class 2606 OID 23012)
-- Name: background_jobs background_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_pkey PRIMARY KEY (id);


--
-- TOC entry 4967 (class 2606 OID 22449)
-- Name: carrier_assignments carrier_assignments_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_idempotency_key_key UNIQUE (idempotency_key);


--
-- TOC entry 4969 (class 2606 OID 22447)
-- Name: carrier_assignments carrier_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 5015 (class 2606 OID 22605)
-- Name: carrier_capacity_log carrier_capacity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_capacity_log
    ADD CONSTRAINT carrier_capacity_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5022 (class 2606 OID 22643)
-- Name: carrier_performance_metrics carrier_performance_metrics_carrier_id_organization_id_peri_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_carrier_id_organization_id_peri_key UNIQUE (carrier_id, organization_id, period_start, period_type);


--
-- TOC entry 5024 (class 2606 OID 22641)
-- Name: carrier_performance_metrics carrier_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_pkey PRIMARY KEY (id);


--
-- TOC entry 5003 (class 2606 OID 22559)
-- Name: carrier_quotes carrier_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_pkey PRIMARY KEY (id);


--
-- TOC entry 5008 (class 2606 OID 22581)
-- Name: carrier_rejections carrier_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_pkey PRIMARY KEY (id);


--
-- TOC entry 4895 (class 2606 OID 22204)
-- Name: carriers carriers_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_organization_id_code_key UNIQUE (organization_id, code);


--
-- TOC entry 4897 (class 2606 OID 22202)
-- Name: carriers carriers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_pkey PRIMARY KEY (id);


--
-- TOC entry 5108 (class 2606 OID 23058)
-- Name: cron_schedules cron_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cron_schedules
    ADD CONSTRAINT cron_schedules_pkey PRIMARY KEY (id);


--
-- TOC entry 5112 (class 2606 OID 23078)
-- Name: dead_letter_queue dead_letter_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dead_letter_queue
    ADD CONSTRAINT dead_letter_queue_pkey PRIMARY KEY (id);


--
-- TOC entry 5079 (class 2606 OID 22927)
-- Name: eta_predictions eta_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eta_predictions
    ADD CONSTRAINT eta_predictions_pkey PRIMARY KEY (id);


--
-- TOC entry 5061 (class 2606 OID 22849)
-- Name: exceptions exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_pkey PRIMARY KEY (id);


--
-- TOC entry 4932 (class 2606 OID 22293)
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 5094 (class 2606 OID 22976)
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5088 (class 2606 OID 22954)
-- Name: invoices invoices_organization_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_invoice_number_key UNIQUE (organization_id, invoice_number);


--
-- TOC entry 5090 (class 2606 OID 22952)
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- TOC entry 5106 (class 2606 OID 23035)
-- Name: job_execution_logs job_execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_execution_logs
    ADD CONSTRAINT job_execution_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5131 (class 2606 OID 23157)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 4961 (class 2606 OID 22389)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4965 (class 2606 OID 22414)
-- Name: order_splits order_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_pkey PRIMARY KEY (id);


--
-- TOC entry 4953 (class 2606 OID 22363)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 4853 (class 2606 OID 22043)
-- Name: organizations organizations_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_code_key UNIQUE (code);


--
-- TOC entry 4855 (class 2606 OID 22041)
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- TOC entry 4857 (class 2606 OID 23496)
-- Name: organizations organizations_webhook_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_webhook_token_key UNIQUE (webhook_token);


--
-- TOC entry 5046 (class 2606 OID 22745)
-- Name: pick_list_items pick_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5040 (class 2606 OID 22717)
-- Name: pick_lists pick_lists_pick_list_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_pick_list_number_key UNIQUE (pick_list_number);


--
-- TOC entry 5042 (class 2606 OID 22715)
-- Name: pick_lists pick_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_pkey PRIMARY KEY (id);


--
-- TOC entry 4916 (class 2606 OID 22250)
-- Name: products products_organization_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_sku_key UNIQUE (organization_id, sku);


--
-- TOC entry 4918 (class 2606 OID 22248)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 5020 (class 2606 OID 22620)
-- Name: quote_idempotency_cache quote_idempotency_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_idempotency_cache
    ADD CONSTRAINT quote_idempotency_cache_pkey PRIMARY KEY (idempotency_key);


--
-- TOC entry 4907 (class 2606 OID 22225)
-- Name: rate_cards rate_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_pkey PRIMARY KEY (id);


--
-- TOC entry 5059 (class 2606 OID 22813)
-- Name: return_items return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5055 (class 2606 OID 22780)
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- TOC entry 4997 (class 2606 OID 22521)
-- Name: shipment_events shipment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4990 (class 2606 OID 22481)
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- TOC entry 4992 (class 2606 OID 22483)
-- Name: shipments shipments_tracking_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_tracking_number_key UNIQUE (tracking_number);


--
-- TOC entry 5001 (class 2606 OID 22534)
-- Name: shipping_estimates shipping_estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_pkey PRIMARY KEY (id);


--
-- TOC entry 4923 (class 2606 OID 22273)
-- Name: sla_policies sla_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_pkey PRIMARY KEY (id);


--
-- TOC entry 5077 (class 2606 OID 22889)
-- Name: sla_violations sla_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_pkey PRIMARY KEY (id);


--
-- TOC entry 4939 (class 2606 OID 22319)
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 5139 (class 2606 OID 23568)
-- Name: user_notification_preferences user_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id);


--
-- TOC entry 5141 (class 2606 OID 23570)
-- Name: user_notification_preferences user_notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_key UNIQUE (user_id);


--
-- TOC entry 4867 (class 2606 OID 22079)
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 4869 (class 2606 OID 22081)
-- Name: user_permissions user_permissions_user_id_permission_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_permission_key UNIQUE (user_id, permission);


--
-- TOC entry 4880 (class 2606 OID 22127)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4871 (class 2606 OID 22105)
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4873 (class 2606 OID 22107)
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- TOC entry 4863 (class 2606 OID 22064)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4865 (class 2606 OID 22062)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4891 (class 2606 OID 22172)
-- Name: warehouses warehouses_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_organization_id_code_key UNIQUE (organization_id, code);


--
-- TOC entry 4893 (class 2606 OID 22170)
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- TOC entry 5136 (class 2606 OID 23440)
-- Name: webhook_logs webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5118 (class 1259 OID 23299)
-- Name: idx_alert_rules_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_rules_active ON public.alert_rules USING btree (is_active);


--
-- TOC entry 5119 (class 1259 OID 23301)
-- Name: idx_alert_rules_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_rules_org ON public.alert_rules USING btree (organization_id);


--
-- TOC entry 5120 (class 1259 OID 23300)
-- Name: idx_alert_rules_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_rules_type ON public.alert_rules USING btree (rule_type);


--
-- TOC entry 5123 (class 1259 OID 23305)
-- Name: idx_alerts_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_org ON public.alerts USING btree (organization_id);


--
-- TOC entry 5124 (class 1259 OID 23303)
-- Name: idx_alerts_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_severity ON public.alerts USING btree (severity);


--
-- TOC entry 5125 (class 1259 OID 23302)
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);


--
-- TOC entry 5126 (class 1259 OID 23304)
-- Name: idx_alerts_triggered; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_triggered ON public.alerts USING btree (triggered_at);


--
-- TOC entry 5033 (class 1259 OID 23242)
-- Name: idx_allocation_history_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_history_order ON public.allocation_history USING btree (order_id);


--
-- TOC entry 5034 (class 1259 OID 23243)
-- Name: idx_allocation_history_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_history_warehouse ON public.allocation_history USING btree (warehouse_id);


--
-- TOC entry 5029 (class 1259 OID 23245)
-- Name: idx_allocation_rules_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_rules_active ON public.allocation_rules USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- TOC entry 5030 (class 1259 OID 23244)
-- Name: idx_allocation_rules_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_rules_org ON public.allocation_rules USING btree (organization_id);


--
-- TOC entry 4883 (class 1259 OID 23179)
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);


--
-- TOC entry 4884 (class 1259 OID 23178)
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- TOC entry 4885 (class 1259 OID 23177)
-- Name: idx_audit_logs_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_org ON public.audit_logs USING btree (organization_id);


--
-- TOC entry 4886 (class 1259 OID 23176)
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- TOC entry 4970 (class 1259 OID 23207)
-- Name: idx_carrier_assignments_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_carrier ON public.carrier_assignments USING btree (carrier_id);


--
-- TOC entry 4971 (class 1259 OID 23209)
-- Name: idx_carrier_assignments_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_expires ON public.carrier_assignments USING btree (expires_at) WHERE ((status)::text = 'pending'::text);


--
-- TOC entry 4972 (class 1259 OID 23206)
-- Name: idx_carrier_assignments_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_order ON public.carrier_assignments USING btree (order_id);


--
-- TOC entry 4973 (class 1259 OID 23208)
-- Name: idx_carrier_assignments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_status ON public.carrier_assignments USING btree (status);


--
-- TOC entry 5016 (class 1259 OID 23232)
-- Name: idx_carrier_capacity_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_capacity_carrier ON public.carrier_capacity_log USING btree (carrier_id);


--
-- TOC entry 5017 (class 1259 OID 23233)
-- Name: idx_carrier_capacity_logged; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_capacity_logged ON public.carrier_capacity_log USING btree (logged_at);


--
-- TOC entry 5025 (class 1259 OID 23234)
-- Name: idx_carrier_perf_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_perf_carrier ON public.carrier_performance_metrics USING btree (carrier_id);


--
-- TOC entry 5026 (class 1259 OID 23235)
-- Name: idx_carrier_perf_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_perf_period ON public.carrier_performance_metrics USING btree (period_start, period_type);


--
-- TOC entry 5004 (class 1259 OID 23223)
-- Name: idx_carrier_quotes_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_quotes_carrier ON public.carrier_quotes USING btree (carrier_id);


--
-- TOC entry 5005 (class 1259 OID 23222)
-- Name: idx_carrier_quotes_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_quotes_order ON public.carrier_quotes USING btree (order_id);


--
-- TOC entry 5006 (class 1259 OID 23224)
-- Name: idx_carrier_quotes_selected; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_quotes_selected ON public.carrier_quotes USING btree (order_id) WHERE (was_selected = true);


--
-- TOC entry 5009 (class 1259 OID 23227)
-- Name: idx_carrier_rejections_assignment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_assignment ON public.carrier_rejections USING btree (carrier_assignment_id) WHERE (carrier_assignment_id IS NOT NULL);


--
-- TOC entry 5010 (class 1259 OID 23225)
-- Name: idx_carrier_rejections_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_carrier ON public.carrier_rejections USING btree (carrier_id);


--
-- TOC entry 5011 (class 1259 OID 23228)
-- Name: idx_carrier_rejections_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_date ON public.carrier_rejections USING btree (rejected_at);


--
-- TOC entry 5012 (class 1259 OID 23580)
-- Name: idx_carrier_rejections_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_order_id ON public.carrier_rejections USING btree (order_id);


--
-- TOC entry 5013 (class 1259 OID 23226)
-- Name: idx_carrier_rejections_reason; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_reason ON public.carrier_rejections USING btree (reason);


--
-- TOC entry 4898 (class 1259 OID 23184)
-- Name: idx_carriers_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carriers_active ON public.carriers USING btree (is_active);


--
-- TOC entry 4899 (class 1259 OID 23183)
-- Name: idx_carriers_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carriers_code ON public.carriers USING btree (code);


--
-- TOC entry 4900 (class 1259 OID 23182)
-- Name: idx_carriers_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carriers_org ON public.carriers USING btree (organization_id);


--
-- TOC entry 4901 (class 1259 OID 23489)
-- Name: idx_carriers_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carriers_organization_id ON public.carriers USING btree (organization_id);


--
-- TOC entry 4902 (class 1259 OID 23185)
-- Name: idx_carriers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carriers_status ON public.carriers USING btree (availability_status);


--
-- TOC entry 5109 (class 1259 OID 23294)
-- Name: idx_cron_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cron_active ON public.cron_schedules USING btree (is_active, next_run_at);


--
-- TOC entry 5110 (class 1259 OID 23295)
-- Name: idx_cron_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cron_org ON public.cron_schedules USING btree (organization_id);


--
-- TOC entry 5113 (class 1259 OID 23297)
-- Name: idx_dlq_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dlq_created ON public.dead_letter_queue USING btree (moved_to_dlq_at);


--
-- TOC entry 5114 (class 1259 OID 23296)
-- Name: idx_dlq_job_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dlq_job_type ON public.dead_letter_queue USING btree (job_type);


--
-- TOC entry 5115 (class 1259 OID 23298)
-- Name: idx_dlq_unprocessed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dlq_unprocessed ON public.dead_letter_queue USING btree (reprocessed) WHERE (reprocessed = false);


--
-- TOC entry 5080 (class 1259 OID 23275)
-- Name: idx_eta_predictions_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eta_predictions_created ON public.eta_predictions USING btree (created_at);


--
-- TOC entry 5081 (class 1259 OID 23274)
-- Name: idx_eta_predictions_shipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eta_predictions_shipment ON public.eta_predictions USING btree (shipment_id);


--
-- TOC entry 5062 (class 1259 OID 23266)
-- Name: idx_exceptions_assigned; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_assigned ON public.exceptions USING btree (assigned_to);


--
-- TOC entry 5063 (class 1259 OID 23267)
-- Name: idx_exceptions_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_open ON public.exceptions USING btree (organization_id) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'investigating'::character varying])::text[]));


--
-- TOC entry 5064 (class 1259 OID 23262)
-- Name: idx_exceptions_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_order ON public.exceptions USING btree (order_id);


--
-- TOC entry 5065 (class 1259 OID 23260)
-- Name: idx_exceptions_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_org ON public.exceptions USING btree (organization_id);


--
-- TOC entry 5066 (class 1259 OID 23265)
-- Name: idx_exceptions_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_severity ON public.exceptions USING btree (severity);


--
-- TOC entry 5067 (class 1259 OID 23261)
-- Name: idx_exceptions_shipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_shipment ON public.exceptions USING btree (shipment_id);


--
-- TOC entry 5068 (class 1259 OID 23264)
-- Name: idx_exceptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_status ON public.exceptions USING btree (status);


--
-- TOC entry 5069 (class 1259 OID 23263)
-- Name: idx_exceptions_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_type ON public.exceptions USING btree (exception_type);


--
-- TOC entry 4924 (class 1259 OID 23194)
-- Name: idx_inventory_low_stock; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_low_stock ON public.inventory USING btree (warehouse_id) WHERE (available_quantity <= COALESCE(reorder_point, 10));


--
-- TOC entry 4925 (class 1259 OID 23485)
-- Name: idx_inventory_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_organization_id ON public.inventory USING btree (organization_id);


--
-- TOC entry 4926 (class 1259 OID 23193)
-- Name: idx_inventory_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_product ON public.inventory USING btree (product_id);


--
-- TOC entry 4927 (class 1259 OID 23192)
-- Name: idx_inventory_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_warehouse ON public.inventory USING btree (warehouse_id);


--
-- TOC entry 4928 (class 1259 OID 22305)
-- Name: idx_inventory_warehouse_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_inventory_warehouse_product ON public.inventory USING btree (warehouse_id, product_id) WHERE (product_id IS NOT NULL);


--
-- TOC entry 4929 (class 1259 OID 22304)
-- Name: idx_inventory_warehouse_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_inventory_warehouse_sku ON public.inventory USING btree (warehouse_id, sku) WHERE (sku IS NOT NULL);


--
-- TOC entry 4930 (class 1259 OID 23471)
-- Name: idx_inventory_warehouse_stats; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_warehouse_stats ON public.inventory USING btree (warehouse_id, quantity, available_quantity, reserved_quantity);


--
-- TOC entry 5091 (class 1259 OID 23284)
-- Name: idx_invoice_line_items_invoice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_line_items_invoice ON public.invoice_line_items USING btree (invoice_id);


--
-- TOC entry 5092 (class 1259 OID 23285)
-- Name: idx_invoice_line_items_shipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_line_items_shipment ON public.invoice_line_items USING btree (shipment_id) WHERE (shipment_id IS NOT NULL);


--
-- TOC entry 5082 (class 1259 OID 23280)
-- Name: idx_invoices_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_carrier ON public.invoices USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);


--
-- TOC entry 5083 (class 1259 OID 23282)
-- Name: idx_invoices_due; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_due ON public.invoices USING btree (due_date) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'overdue'::character varying])::text[]));


--
-- TOC entry 5084 (class 1259 OID 23279)
-- Name: idx_invoices_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_org ON public.invoices USING btree (organization_id);


--
-- TOC entry 5085 (class 1259 OID 23283)
-- Name: idx_invoices_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_period ON public.invoices USING btree (billing_period_start, billing_period_end);


--
-- TOC entry 5086 (class 1259 OID 23281)
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- TOC entry 5103 (class 1259 OID 23292)
-- Name: idx_job_execution_logs_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_execution_logs_job ON public.job_execution_logs USING btree (job_id);


--
-- TOC entry 5104 (class 1259 OID 23293)
-- Name: idx_job_execution_logs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_execution_logs_status ON public.job_execution_logs USING btree (status);


--
-- TOC entry 5097 (class 1259 OID 23291)
-- Name: idx_jobs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_created ON public.background_jobs USING btree (created_at);


--
-- TOC entry 5098 (class 1259 OID 23290)
-- Name: idx_jobs_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_org ON public.background_jobs USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- TOC entry 5099 (class 1259 OID 23289)
-- Name: idx_jobs_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_priority ON public.background_jobs USING btree (priority, scheduled_for) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying])::text[]));


--
-- TOC entry 5100 (class 1259 OID 23288)
-- Name: idx_jobs_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_scheduled ON public.background_jobs USING btree (scheduled_for) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying])::text[]));


--
-- TOC entry 5101 (class 1259 OID 23286)
-- Name: idx_jobs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_status ON public.background_jobs USING btree (status);


--
-- TOC entry 5102 (class 1259 OID 23287)
-- Name: idx_jobs_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_type ON public.background_jobs USING btree (job_type);


--
-- TOC entry 5127 (class 1259 OID 23308)
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at);


--
-- TOC entry 5128 (class 1259 OID 23307)
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);


--
-- TOC entry 5129 (class 1259 OID 23306)
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- TOC entry 4954 (class 1259 OID 23365)
-- Name: idx_order_items_fragile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_fragile ON public.order_items USING btree (is_fragile) WHERE (is_fragile = true);


--
-- TOC entry 4955 (class 1259 OID 23366)
-- Name: idx_order_items_hazardous; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_hazardous ON public.order_items USING btree (is_hazardous) WHERE (is_hazardous = true);


--
-- TOC entry 4956 (class 1259 OID 23203)
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- TOC entry 4957 (class 1259 OID 23367)
-- Name: idx_order_items_perishable; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_perishable ON public.order_items USING btree (is_perishable) WHERE (is_perishable = true);


--
-- TOC entry 4958 (class 1259 OID 23204)
-- Name: idx_order_items_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_product ON public.order_items USING btree (product_id);


--
-- TOC entry 4959 (class 1259 OID 23205)
-- Name: idx_order_items_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_sku ON public.order_items USING btree (sku);


--
-- TOC entry 4962 (class 1259 OID 23247)
-- Name: idx_order_splits_child; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_splits_child ON public.order_splits USING btree (child_order_id);


--
-- TOC entry 4963 (class 1259 OID 23246)
-- Name: idx_order_splits_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_splits_parent ON public.order_splits USING btree (parent_order_id);


--
-- TOC entry 4940 (class 1259 OID 23352)
-- Name: idx_orders_carrier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_carrier_id ON public.orders USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);


--
-- TOC entry 4941 (class 1259 OID 23200)
-- Name: idx_orders_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_created ON public.orders USING btree (created_at);


--
-- TOC entry 4942 (class 1259 OID 23201)
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_email);


--
-- TOC entry 4943 (class 1259 OID 23197)
-- Name: idx_orders_external; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_external ON public.orders USING btree (external_order_id) WHERE (external_order_id IS NOT NULL);


--
-- TOC entry 4944 (class 1259 OID 23196)
-- Name: idx_orders_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_number ON public.orders USING btree (order_number);


--
-- TOC entry 4945 (class 1259 OID 23353)
-- Name: idx_orders_on_hold; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_on_hold ON public.orders USING btree (status) WHERE ((status)::text = 'on_hold'::text);


--
-- TOC entry 4946 (class 1259 OID 23403)
-- Name: idx_orders_order_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_order_type ON public.orders USING btree (order_type);


--
-- TOC entry 4947 (class 1259 OID 23195)
-- Name: idx_orders_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_org ON public.orders USING btree (organization_id);


--
-- TOC entry 4948 (class 1259 OID 23486)
-- Name: idx_orders_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_organization_id ON public.orders USING btree (organization_id);


--
-- TOC entry 4949 (class 1259 OID 23198)
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- TOC entry 4950 (class 1259 OID 23199)
-- Name: idx_orders_status_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status_org ON public.orders USING btree (organization_id, status);


--
-- TOC entry 4951 (class 1259 OID 23402)
-- Name: idx_orders_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_supplier_id ON public.orders USING btree (supplier_id) WHERE (supplier_id IS NOT NULL);


--
-- TOC entry 4850 (class 1259 OID 23168)
-- Name: idx_organizations_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizations_active ON public.organizations USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 4851 (class 1259 OID 23497)
-- Name: idx_organizations_webhook_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizations_webhook_token ON public.organizations USING btree (webhook_token);


--
-- TOC entry 5043 (class 1259 OID 23240)
-- Name: idx_pick_list_items_list; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_list_items_list ON public.pick_list_items USING btree (pick_list_id);


--
-- TOC entry 5044 (class 1259 OID 23241)
-- Name: idx_pick_list_items_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_list_items_status ON public.pick_list_items USING btree (pick_list_id, status);


--
-- TOC entry 5035 (class 1259 OID 23238)
-- Name: idx_pick_lists_assigned; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_lists_assigned ON public.pick_lists USING btree (assigned_to) WHERE (assigned_to IS NOT NULL);


--
-- TOC entry 5036 (class 1259 OID 23239)
-- Name: idx_pick_lists_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_lists_org ON public.pick_lists USING btree (organization_id);


--
-- TOC entry 5037 (class 1259 OID 23237)
-- Name: idx_pick_lists_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_lists_status ON public.pick_lists USING btree (status);


--
-- TOC entry 5038 (class 1259 OID 23236)
-- Name: idx_pick_lists_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_lists_warehouse ON public.pick_lists USING btree (warehouse_id);


--
-- TOC entry 4908 (class 1259 OID 23188)
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_active ON public.products USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 4909 (class 1259 OID 23187)
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category ON public.products USING btree (organization_id, category) WHERE (category IS NOT NULL);


--
-- TOC entry 4910 (class 1259 OID 23382)
-- Name: idx_products_fragile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_fragile ON public.products USING btree (is_fragile) WHERE (is_fragile = true);


--
-- TOC entry 4911 (class 1259 OID 23385)
-- Name: idx_products_item_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_item_type ON public.products USING btree (item_type);


--
-- TOC entry 4912 (class 1259 OID 23186)
-- Name: idx_products_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_org ON public.products USING btree (organization_id);


--
-- TOC entry 4913 (class 1259 OID 23484)
-- Name: idx_products_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_organization_id ON public.products USING btree (organization_id);


--
-- TOC entry 4914 (class 1259 OID 23384)
-- Name: idx_products_perishable; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_perishable ON public.products USING btree (is_perishable) WHERE (is_perishable = true);


--
-- TOC entry 5018 (class 1259 OID 23229)
-- Name: idx_quote_cache_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_cache_expires ON public.quote_idempotency_cache USING btree (expires_at);


--
-- TOC entry 4903 (class 1259 OID 23190)
-- Name: idx_rate_cards_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_cards_active ON public.rate_cards USING btree (carrier_id, is_active) WHERE (is_active = true);


--
-- TOC entry 4904 (class 1259 OID 23189)
-- Name: idx_rate_cards_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_cards_carrier ON public.rate_cards USING btree (carrier_id);


--
-- TOC entry 4905 (class 1259 OID 23191)
-- Name: idx_rate_cards_route; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_cards_route ON public.rate_cards USING btree (origin_state, destination_state) WHERE (is_active = true);


--
-- TOC entry 5056 (class 1259 OID 23259)
-- Name: idx_return_items_order_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_items_order_item ON public.return_items USING btree (order_item_id) WHERE (order_item_id IS NOT NULL);


--
-- TOC entry 5057 (class 1259 OID 23258)
-- Name: idx_return_items_return; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_items_return ON public.return_items USING btree (return_id);


--
-- TOC entry 5047 (class 1259 OID 23257)
-- Name: idx_returns_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_created ON public.returns USING btree (created_at);


--
-- TOC entry 5048 (class 1259 OID 23254)
-- Name: idx_returns_external; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_external ON public.returns USING btree (external_return_id) WHERE (external_return_id IS NOT NULL);


--
-- TOC entry 5049 (class 1259 OID 23255)
-- Name: idx_returns_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_order ON public.returns USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- TOC entry 5050 (class 1259 OID 23253)
-- Name: idx_returns_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_org ON public.returns USING btree (organization_id);


--
-- TOC entry 5051 (class 1259 OID 23488)
-- Name: idx_returns_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_organization_id ON public.returns USING btree (organization_id);


--
-- TOC entry 5052 (class 1259 OID 22801)
-- Name: idx_returns_rma_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_returns_rma_number ON public.returns USING btree (organization_id, rma_number) WHERE (rma_number IS NOT NULL);


--
-- TOC entry 5053 (class 1259 OID 23256)
-- Name: idx_returns_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_status ON public.returns USING btree (status);


--
-- TOC entry 4993 (class 1259 OID 23219)
-- Name: idx_shipment_events_shipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipment_events_shipment ON public.shipment_events USING btree (shipment_id);


--
-- TOC entry 4994 (class 1259 OID 23221)
-- Name: idx_shipment_events_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipment_events_timestamp ON public.shipment_events USING btree (event_timestamp);


--
-- TOC entry 4995 (class 1259 OID 23220)
-- Name: idx_shipment_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipment_events_type ON public.shipment_events USING btree (event_type);


--
-- TOC entry 4974 (class 1259 OID 23213)
-- Name: idx_shipments_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_carrier ON public.shipments USING btree (carrier_id);


--
-- TOC entry 4975 (class 1259 OID 23211)
-- Name: idx_shipments_carrier_tracking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_carrier_tracking ON public.shipments USING btree (carrier_tracking_number) WHERE (carrier_tracking_number IS NOT NULL);


--
-- TOC entry 4976 (class 1259 OID 23218)
-- Name: idx_shipments_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_created ON public.shipments USING btree (created_at);


--
-- TOC entry 4977 (class 1259 OID 23216)
-- Name: idx_shipments_delivery_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_delivery_scheduled ON public.shipments USING btree (delivery_scheduled) WHERE (delivery_scheduled IS NOT NULL);


--
-- TOC entry 4978 (class 1259 OID 23422)
-- Name: idx_shipments_is_hazardous; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_is_hazardous ON public.shipments USING btree (is_hazardous) WHERE (is_hazardous = true);


--
-- TOC entry 4979 (class 1259 OID 23423)
-- Name: idx_shipments_is_perishable; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_is_perishable ON public.shipments USING btree (is_perishable) WHERE (is_perishable = true);


--
-- TOC entry 4980 (class 1259 OID 23425)
-- Name: idx_shipments_item_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_item_type ON public.shipments USING btree (item_type) WHERE ((item_type)::text <> 'general'::text);


--
-- TOC entry 4981 (class 1259 OID 23212)
-- Name: idx_shipments_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_order ON public.shipments USING btree (order_id);


--
-- TOC entry 4982 (class 1259 OID 23210)
-- Name: idx_shipments_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_org ON public.shipments USING btree (organization_id);


--
-- TOC entry 4983 (class 1259 OID 23487)
-- Name: idx_shipments_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_organization_id ON public.shipments USING btree (organization_id);


--
-- TOC entry 4984 (class 1259 OID 23424)
-- Name: idx_shipments_requires_cold_storage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_requires_cold_storage ON public.shipments USING btree (requires_cold_storage) WHERE (requires_cold_storage = true);


--
-- TOC entry 4985 (class 1259 OID 23214)
-- Name: idx_shipments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_status ON public.shipments USING btree (status);


--
-- TOC entry 4986 (class 1259 OID 23426)
-- Name: idx_shipments_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_status_created ON public.shipments USING btree (status, created_at DESC);


--
-- TOC entry 4987 (class 1259 OID 23215)
-- Name: idx_shipments_status_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_status_org ON public.shipments USING btree (organization_id, status);


--
-- TOC entry 4988 (class 1259 OID 23217)
-- Name: idx_shipments_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_warehouse ON public.shipments USING btree (warehouse_id) WHERE (warehouse_id IS NOT NULL);


--
-- TOC entry 4998 (class 1259 OID 23231)
-- Name: idx_shipping_estimates_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipping_estimates_carrier ON public.shipping_estimates USING btree (carrier_id);


--
-- TOC entry 4999 (class 1259 OID 23230)
-- Name: idx_shipping_estimates_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipping_estimates_order ON public.shipping_estimates USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- TOC entry 4919 (class 1259 OID 23277)
-- Name: idx_sla_policies_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_policies_active ON public.sla_policies USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- TOC entry 4920 (class 1259 OID 23276)
-- Name: idx_sla_policies_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_policies_org ON public.sla_policies USING btree (organization_id);


--
-- TOC entry 4921 (class 1259 OID 23278)
-- Name: idx_sla_policies_service; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_policies_service ON public.sla_policies USING btree (service_type) WHERE (is_active = true);


--
-- TOC entry 5070 (class 1259 OID 23270)
-- Name: idx_sla_violations_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_carrier ON public.sla_violations USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);


--
-- TOC entry 5071 (class 1259 OID 23273)
-- Name: idx_sla_violations_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_open ON public.sla_violations USING btree (organization_id, status) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'acknowledged'::character varying])::text[]));


--
-- TOC entry 5072 (class 1259 OID 23268)
-- Name: idx_sla_violations_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_org ON public.sla_violations USING btree (organization_id);


--
-- TOC entry 5073 (class 1259 OID 23269)
-- Name: idx_sla_violations_shipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_shipment ON public.sla_violations USING btree (shipment_id) WHERE (shipment_id IS NOT NULL);


--
-- TOC entry 5074 (class 1259 OID 23271)
-- Name: idx_sla_violations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_status ON public.sla_violations USING btree (status);


--
-- TOC entry 5075 (class 1259 OID 23272)
-- Name: idx_sla_violations_violated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_violated ON public.sla_violations USING btree (violated_at);


--
-- TOC entry 4933 (class 1259 OID 23251)
-- Name: idx_stock_movements_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_created ON public.stock_movements USING btree (created_at);


--
-- TOC entry 4934 (class 1259 OID 23249)
-- Name: idx_stock_movements_inventory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_inventory ON public.stock_movements USING btree (inventory_id) WHERE (inventory_id IS NOT NULL);


--
-- TOC entry 4935 (class 1259 OID 23252)
-- Name: idx_stock_movements_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_reference ON public.stock_movements USING btree (reference_type, reference_id) WHERE (reference_id IS NOT NULL);


--
-- TOC entry 4936 (class 1259 OID 23250)
-- Name: idx_stock_movements_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_type ON public.stock_movements USING btree (movement_type);


--
-- TOC entry 4937 (class 1259 OID 23248)
-- Name: idx_stock_movements_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_warehouse ON public.stock_movements USING btree (warehouse_id);


--
-- TOC entry 5137 (class 1259 OID 23576)
-- Name: idx_user_preferences_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_preferences_user_id ON public.user_notification_preferences USING btree (user_id);


--
-- TOC entry 4874 (class 1259 OID 23173)
-- Name: idx_user_sessions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_active ON public.user_sessions USING btree (user_id, is_active);


--
-- TOC entry 4875 (class 1259 OID 23175)
-- Name: idx_user_sessions_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_expires ON public.user_sessions USING btree (expires_at);


--
-- TOC entry 4876 (class 1259 OID 23174)
-- Name: idx_user_sessions_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (session_token);


--
-- TOC entry 4877 (class 1259 OID 23172)
-- Name: idx_user_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_user ON public.user_sessions USING btree (user_id);


--
-- TOC entry 4878 (class 1259 OID 23577)
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- TOC entry 4858 (class 1259 OID 23171)
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 4859 (class 1259 OID 23169)
-- Name: idx_users_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_organization ON public.users USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- TOC entry 4860 (class 1259 OID 23482)
-- Name: idx_users_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_organization_id ON public.users USING btree (organization_id);


--
-- TOC entry 4861 (class 1259 OID 23170)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 4887 (class 1259 OID 23181)
-- Name: idx_warehouses_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warehouses_active ON public.warehouses USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 4888 (class 1259 OID 23180)
-- Name: idx_warehouses_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warehouses_org ON public.warehouses USING btree (organization_id);


--
-- TOC entry 4889 (class 1259 OID 23483)
-- Name: idx_warehouses_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warehouses_organization_id ON public.warehouses USING btree (organization_id);


--
-- TOC entry 5132 (class 1259 OID 23446)
-- Name: idx_webhook_logs_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_logs_carrier ON public.webhook_logs USING btree (carrier_id, created_at DESC);


--
-- TOC entry 5133 (class 1259 OID 23448)
-- Name: idx_webhook_logs_endpoint; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_logs_endpoint ON public.webhook_logs USING btree (endpoint, created_at DESC);


--
-- TOC entry 5134 (class 1259 OID 23447)
-- Name: idx_webhook_logs_signature_valid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_logs_signature_valid ON public.webhook_logs USING btree (signature_valid, created_at DESC);


--
-- TOC entry 5244 (class 2620 OID 23450)
-- Name: carriers carrier_webhook_credentials_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER carrier_webhook_credentials_trigger BEFORE INSERT ON public.carriers FOR EACH ROW EXECUTE FUNCTION public.generate_webhook_credentials();


--
-- TOC entry 5249 (class 2620 OID 23551)
-- Name: inventory trg_sync_inventory_product_info; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_inventory_product_info BEFORE INSERT OR UPDATE OF product_id ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_product_info();


--
-- TOC entry 5246 (class 2620 OID 23407)
-- Name: products trigger_calculate_product_volumetric_weight; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_calculate_product_volumetric_weight BEFORE INSERT OR UPDATE OF dimensions ON public.products FOR EACH ROW EXECUTE FUNCTION public.calculate_product_volumetric_weight();


--
-- TOC entry 5252 (class 2620 OID 23405)
-- Name: order_items trigger_calculate_volumetric_weight; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_calculate_volumetric_weight BEFORE INSERT OR UPDATE OF dimensions ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.calculate_volumetric_weight();


--
-- TOC entry 5263 (class 2620 OID 23325)
-- Name: alert_rules trigger_update_alert_rules_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_alert_rules_updated_at BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5255 (class 2620 OID 23320)
-- Name: allocation_rules trigger_update_allocation_rules_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_allocation_rules_updated_at BEFORE UPDATE ON public.allocation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5261 (class 2620 OID 23327)
-- Name: background_jobs trigger_update_background_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_background_jobs_updated_at BEFORE UPDATE ON public.background_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5253 (class 2620 OID 23318)
-- Name: carrier_assignments trigger_update_carrier_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_carrier_assignments_updated_at BEFORE UPDATE ON public.carrier_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5245 (class 2620 OID 23313)
-- Name: carriers trigger_update_carriers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_carriers_updated_at BEFORE UPDATE ON public.carriers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5262 (class 2620 OID 23328)
-- Name: cron_schedules trigger_update_cron_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_cron_schedules_updated_at BEFORE UPDATE ON public.cron_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5258 (class 2620 OID 23323)
-- Name: exceptions trigger_update_exceptions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_exceptions_updated_at BEFORE UPDATE ON public.exceptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5250 (class 2620 OID 23316)
-- Name: inventory trigger_update_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5260 (class 2620 OID 23326)
-- Name: invoices trigger_update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5251 (class 2620 OID 23317)
-- Name: orders trigger_update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5240 (class 2620 OID 23309)
-- Name: organizations trigger_update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5256 (class 2620 OID 23321)
-- Name: pick_lists trigger_update_pick_lists_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_pick_lists_updated_at BEFORE UPDATE ON public.pick_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5247 (class 2620 OID 23314)
-- Name: products trigger_update_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5257 (class 2620 OID 23322)
-- Name: returns trigger_update_returns_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5254 (class 2620 OID 23319)
-- Name: shipments trigger_update_shipments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5248 (class 2620 OID 23315)
-- Name: sla_policies trigger_update_sla_policies_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_sla_policies_updated_at BEFORE UPDATE ON public.sla_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5259 (class 2620 OID 23324)
-- Name: sla_violations trigger_update_sla_violations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_sla_violations_updated_at BEFORE UPDATE ON public.sla_violations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5242 (class 2620 OID 23311)
-- Name: user_settings trigger_update_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5241 (class 2620 OID 23310)
-- Name: users trigger_update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5243 (class 2620 OID 23312)
-- Name: warehouses trigger_update_warehouses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5264 (class 2620 OID 23578)
-- Name: user_notification_preferences update_user_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_notification_preferences_updated_at BEFORE UPDATE ON public.user_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5230 (class 2606 OID 23105)
-- Name: alert_rules alert_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5231 (class 2606 OID 23100)
-- Name: alert_rules alert_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5232 (class 2606 OID 23133)
-- Name: alerts alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- TOC entry 5233 (class 2606 OID 23123)
-- Name: alerts alerts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5234 (class 2606 OID 23138)
-- Name: alerts alerts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- TOC entry 5235 (class 2606 OID 23128)
-- Name: alerts alerts_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id);


--
-- TOC entry 5193 (class 2606 OID 22686)
-- Name: allocation_history allocation_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5194 (class 2606 OID 22691)
-- Name: allocation_history allocation_history_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- TOC entry 5195 (class 2606 OID 22696)
-- Name: allocation_history allocation_history_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5192 (class 2606 OID 22668)
-- Name: allocation_rules allocation_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_rules
    ADD CONSTRAINT allocation_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5147 (class 2606 OID 22149)
-- Name: audit_logs audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5148 (class 2606 OID 22144)
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5226 (class 2606 OID 23018)
-- Name: background_jobs background_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5227 (class 2606 OID 23013)
-- Name: background_jobs background_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5172 (class 2606 OID 22460)
-- Name: carrier_assignments carrier_assignments_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5173 (class 2606 OID 22455)
-- Name: carrier_assignments carrier_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 5174 (class 2606 OID 22450)
-- Name: carrier_assignments carrier_assignments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5188 (class 2606 OID 22606)
-- Name: carrier_capacity_log carrier_capacity_log_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_capacity_log
    ADD CONSTRAINT carrier_capacity_log_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5190 (class 2606 OID 22644)
-- Name: carrier_performance_metrics carrier_performance_metrics_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5191 (class 2606 OID 22649)
-- Name: carrier_performance_metrics carrier_performance_metrics_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5183 (class 2606 OID 22565)
-- Name: carrier_quotes carrier_quotes_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5184 (class 2606 OID 22560)
-- Name: carrier_quotes carrier_quotes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5185 (class 2606 OID 22582)
-- Name: carrier_rejections carrier_rejections_carrier_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_carrier_assignment_id_fkey FOREIGN KEY (carrier_assignment_id) REFERENCES public.carrier_assignments(id);


--
-- TOC entry 5186 (class 2606 OID 22587)
-- Name: carrier_rejections carrier_rejections_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5187 (class 2606 OID 22592)
-- Name: carrier_rejections carrier_rejections_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5151 (class 2606 OID 22205)
-- Name: carriers carriers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5229 (class 2606 OID 23059)
-- Name: cron_schedules cron_schedules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cron_schedules
    ADD CONSTRAINT cron_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5220 (class 2606 OID 22928)
-- Name: eta_predictions eta_predictions_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eta_predictions
    ADD CONSTRAINT eta_predictions_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5210 (class 2606 OID 22870)
-- Name: exceptions exceptions_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 5211 (class 2606 OID 22865)
-- Name: exceptions exceptions_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5212 (class 2606 OID 22860)
-- Name: exceptions exceptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5213 (class 2606 OID 22850)
-- Name: exceptions exceptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5214 (class 2606 OID 22855)
-- Name: exceptions exceptions_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5155 (class 2606 OID 23477)
-- Name: inventory inventory_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 5156 (class 2606 OID 22299)
-- Name: inventory inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 5157 (class 2606 OID 22294)
-- Name: inventory inventory_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5223 (class 2606 OID 22977)
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- TOC entry 5224 (class 2606 OID 22987)
-- Name: invoice_line_items invoice_line_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5225 (class 2606 OID 22982)
-- Name: invoice_line_items invoice_line_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5221 (class 2606 OID 22960)
-- Name: invoices invoices_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5222 (class 2606 OID 22955)
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5228 (class 2606 OID 23036)
-- Name: job_execution_logs job_execution_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_execution_logs
    ADD CONSTRAINT job_execution_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.background_jobs(id) ON DELETE CASCADE;


--
-- TOC entry 5236 (class 2606 OID 23163)
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5237 (class 2606 OID 23158)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5166 (class 2606 OID 22390)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 5167 (class 2606 OID 22395)
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 5168 (class 2606 OID 22400)
-- Name: order_items order_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5169 (class 2606 OID 22420)
-- Name: order_splits order_splits_child_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_child_order_id_fkey FOREIGN KEY (child_order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 5170 (class 2606 OID 22415)
-- Name: order_splits order_splits_parent_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 5171 (class 2606 OID 22425)
-- Name: order_splits order_splits_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5162 (class 2606 OID 22369)
-- Name: orders orders_allocated_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_allocated_warehouse_id_fkey FOREIGN KEY (allocated_warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5163 (class 2606 OID 23347)
-- Name: orders orders_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5164 (class 2606 OID 22364)
-- Name: orders orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5165 (class 2606 OID 23396)
-- Name: orders orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.organizations(id);


--
-- TOC entry 5199 (class 2606 OID 22756)
-- Name: pick_list_items pick_list_items_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- TOC entry 5200 (class 2606 OID 22751)
-- Name: pick_list_items pick_list_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- TOC entry 5201 (class 2606 OID 22746)
-- Name: pick_list_items pick_list_items_pick_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_pick_list_id_fkey FOREIGN KEY (pick_list_id) REFERENCES public.pick_lists(id) ON DELETE CASCADE;


--
-- TOC entry 5202 (class 2606 OID 22761)
-- Name: pick_list_items pick_list_items_picked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_picked_by_fkey FOREIGN KEY (picked_by) REFERENCES public.users(id);


--
-- TOC entry 5196 (class 2606 OID 22728)
-- Name: pick_lists pick_lists_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 5197 (class 2606 OID 22718)
-- Name: pick_lists pick_lists_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5198 (class 2606 OID 22723)
-- Name: pick_lists pick_lists_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5153 (class 2606 OID 22251)
-- Name: products products_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5189 (class 2606 OID 22621)
-- Name: quote_idempotency_cache quote_idempotency_cache_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_idempotency_cache
    ADD CONSTRAINT quote_idempotency_cache_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.carrier_quotes(id);


--
-- TOC entry 5152 (class 2606 OID 22226)
-- Name: rate_cards rate_cards_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id) ON DELETE CASCADE;


--
-- TOC entry 5207 (class 2606 OID 22819)
-- Name: return_items return_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- TOC entry 5208 (class 2606 OID 22824)
-- Name: return_items return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 5209 (class 2606 OID 22814)
-- Name: return_items return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE CASCADE;


--
-- TOC entry 5203 (class 2606 OID 22786)
-- Name: returns returns_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5204 (class 2606 OID 22781)
-- Name: returns returns_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5205 (class 2606 OID 22791)
-- Name: returns returns_original_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_original_shipment_id_fkey FOREIGN KEY (original_shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5206 (class 2606 OID 22796)
-- Name: returns returns_return_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_return_shipment_id_fkey FOREIGN KEY (return_shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5180 (class 2606 OID 22522)
-- Name: shipment_events shipment_events_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE;


--
-- TOC entry 5175 (class 2606 OID 22494)
-- Name: shipments shipments_carrier_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_carrier_assignment_id_fkey FOREIGN KEY (carrier_assignment_id) REFERENCES public.carrier_assignments(id);


--
-- TOC entry 5176 (class 2606 OID 22499)
-- Name: shipments shipments_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5177 (class 2606 OID 22489)
-- Name: shipments shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5178 (class 2606 OID 22484)
-- Name: shipments shipments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5179 (class 2606 OID 22504)
-- Name: shipments shipments_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5181 (class 2606 OID 22540)
-- Name: shipping_estimates shipping_estimates_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5182 (class 2606 OID 22535)
-- Name: shipping_estimates shipping_estimates_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5154 (class 2606 OID 22274)
-- Name: sla_policies sla_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5215 (class 2606 OID 22905)
-- Name: sla_violations sla_violations_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5216 (class 2606 OID 22890)
-- Name: sla_violations sla_violations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5217 (class 2606 OID 22895)
-- Name: sla_violations sla_violations_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5218 (class 2606 OID 22900)
-- Name: sla_violations sla_violations_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.sla_policies(id);


--
-- TOC entry 5219 (class 2606 OID 22910)
-- Name: sla_violations sla_violations_waived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_waived_by_fkey FOREIGN KEY (waived_by) REFERENCES public.users(id);


--
-- TOC entry 5158 (class 2606 OID 22335)
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5159 (class 2606 OID 22330)
-- Name: stock_movements stock_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- TOC entry 5160 (class 2606 OID 22325)
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 5161 (class 2606 OID 22320)
-- Name: stock_movements stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5239 (class 2606 OID 23571)
-- Name: user_notification_preferences user_notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5143 (class 2606 OID 22087)
-- Name: user_permissions user_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- TOC entry 5144 (class 2606 OID 22082)
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5146 (class 2606 OID 22128)
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5145 (class 2606 OID 22108)
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5142 (class 2606 OID 22065)
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5149 (class 2606 OID 22178)
-- Name: warehouses warehouses_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- TOC entry 5150 (class 2606 OID 22173)
-- Name: warehouses warehouses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5238 (class 2606 OID 23441)
-- Name: webhook_logs webhook_logs_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


-- Completed on 2026-02-27 13:35:54 IST

--
-- PostgreSQL database dump complete
--

\unrestrict C40r99KNwqfUbl6p8fIBbmk4r9OU0vwQx6PxsK6Ng3wIoWaxt5Kuxe8ar5KbtC8

