--
-- PostgreSQL database dump
--

\restrict 3H3rV7SL1KHR9SA9qWXLJUk8tfnuOO6zjFtxoVAyqa3OHUAqbrFSuY0x16jnJvl

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-03-12 14:00:24 IST

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
-- TOC entry 5595 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 285 (class 1255 OID 23386)
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
-- TOC entry 284 (class 1255 OID 23368)
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
-- TOC entry 286 (class 1255 OID 23449)
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
-- TOC entry 324 (class 1255 OID 23550)
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
-- TOC entry 283 (class 1255 OID 22023)
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
-- TOC entry 5596 (class 0 OID 0)
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
    idempotency_key character varying(255),
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
-- TOC entry 5597 (class 0 OID 0)
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
    api_timeout_ms integer DEFAULT 15000,
    CONSTRAINT carriers_api_timeout_ms_check CHECK (((api_timeout_ms >= 1000) AND (api_timeout_ms <= 45000))),
    CONSTRAINT carriers_availability_status_check CHECK (((availability_status)::text = ANY ((ARRAY['available'::character varying, 'busy'::character varying, 'offline'::character varying, 'maintenance'::character varying])::text[]))),
    CONSTRAINT carriers_reliability_score_check CHECK (((reliability_score >= (0)::numeric) AND (reliability_score <= (1)::numeric)))
);


ALTER TABLE public.carriers OWNER TO postgres;

--
-- TOC entry 5598 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.webhook_secret; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.webhook_secret IS 'Shared secret for HMAC-SHA256 signature verification (carrier signs their webhooks)';


--
-- TOC entry 5599 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.our_client_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.our_client_id IS 'Our client ID for authenticating with carrier API';


--
-- TOC entry 5600 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.our_client_secret; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.our_client_secret IS 'Our secret for signing requests to carrier API';


--
-- TOC entry 5601 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.ip_whitelist; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.ip_whitelist IS 'Array of allowed IP addresses for webhook requests';


--
-- TOC entry 5602 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.webhook_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.webhook_events IS 'Array of webhook event types carrier subscribes to';


--
-- TOC entry 5603 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN carriers.api_timeout_ms; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carriers.api_timeout_ms IS 'Per-carrier HTTP timeout in milliseconds for outbound quote/tracking API calls. NULL means use the application default (DEFAULT_CARRIER_API_TIMEOUT_MS). Value is capped to 45 000 ms in the application layer.';


--
-- TOC entry 237 (class 1259 OID 22465)
-- Name: shipments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    tracking_number character varying(100) NOT NULL,
    carrier_tracking_number character varying(100),
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
    sla_policy_id uuid,
    CONSTRAINT shipments_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['general'::character varying, 'fragile'::character varying, 'hazardous'::character varying, 'perishable'::character varying, 'electronics'::character varying, 'documents'::character varying, 'valuable'::character varying])::text[]))),
    CONSTRAINT shipments_package_type_check CHECK (((package_type)::text = ANY ((ARRAY['envelope'::character varying, 'box'::character varying, 'tube'::character varying, 'pallet'::character varying, 'crate'::character varying, 'bag'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT shipments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'manifested'::character varying, 'picked_up'::character varying, 'in_transit'::character varying, 'at_hub'::character varying, 'out_for_delivery'::character varying, 'delivered'::character varying, 'failed_delivery'::character varying, 'rto_initiated'::character varying, 'returned'::character varying, 'lost'::character varying])::text[])))
);


ALTER TABLE public.shipments OWNER TO postgres;

--
-- TOC entry 5604 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.route_geometry; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.route_geometry IS 'GeoJSON route for map display (populated during transit, not at creation)';


--
-- TOC entry 5605 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.tracking_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.tracking_events IS 'Tracking history array (populated as carrier provides updates)';


--
-- TOC entry 5606 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.is_fragile; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.is_fragile IS 'True if ANY item in shipment is fragile (aggregated from order_items)';


--
-- TOC entry 5607 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.is_hazardous; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.is_hazardous IS 'True if ANY item is hazardous (requires special carrier certification)';


--
-- TOC entry 5608 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.is_perishable; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.is_perishable IS 'True if ANY item is perishable (time-sensitive delivery required)';


--
-- TOC entry 5609 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.requires_cold_storage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.requires_cold_storage IS 'True if ANY item requires temperature control';


--
-- TOC entry 5610 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.item_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.item_type IS 'Most restrictive item type from all items in shipment';


--
-- TOC entry 5611 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.package_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.package_type IS 'Package type determined from order items';


--
-- TOC entry 5612 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.handling_instructions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.handling_instructions IS 'Special handling instructions aggregated from all order items';


--
-- TOC entry 5613 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.requires_insurance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.requires_insurance IS 'True if ANY item requires insurance';


--
-- TOC entry 5614 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.declared_value; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.declared_value IS 'Total declared value for insurance (sum of all item declared values)';


--
-- TOC entry 5615 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.total_items; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.total_items IS 'Total number of items (quantity) in this shipment';


--
-- TOC entry 5616 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN shipments.sla_policy_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipments.sla_policy_id IS 'The SLA policy that was matched and applied when this shipment was created. NULL = system fallback (72h) was used.';


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
    penalty_applied boolean DEFAULT false,
    penalty_calculated_at timestamp with time zone,
    penalty_approved_by uuid,
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
-- TOC entry 5617 (class 0 OID 0)
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
-- TOC entry 5618 (class 0 OID 0)
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
-- TOC entry 5619 (class 0 OID 0)
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
-- TOC entry 5620 (class 0 OID 0)
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
-- TOC entry 5621 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.quantity IS 'Total quantity (available + reserved + damaged + in_transit)';


--
-- TOC entry 5622 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.available_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.available_quantity IS 'Available quantity for sale/transfer';


--
-- TOC entry 5623 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.reserved_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.reserved_quantity IS 'Reserved quantity (allocated to orders)';


--
-- TOC entry 5624 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.damaged_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.damaged_quantity IS 'Damaged/unusable quantity';


--
-- TOC entry 5625 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN inventory.in_transit_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.inventory.in_transit_quantity IS 'Quantity in transit (being transferred)';


--
-- TOC entry 5626 (class 0 OID 0)
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
-- TOC entry 5627 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN order_items.dimensions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.dimensions IS 'Package dimensions in cm: {length, width, height}';


--
-- TOC entry 5628 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN order_items.volumetric_weight; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.volumetric_weight IS 'Dimensional weight (L×W×H/5000). Used for carrier pricing when > actual weight';


--
-- TOC entry 277 (class 1259 OID 23635)
-- Name: order_number_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_number_seq
    START WITH 10000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_number_seq OWNER TO postgres;

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
    platform character varying(50),
    customer_id character varying(100),
    payment_method character varying(50),
    shipping_locked boolean DEFAULT false NOT NULL,
    CONSTRAINT orders_order_type_check CHECK (((order_type)::text = ANY ((ARRAY['regular'::character varying, 'replacement'::character varying, 'cod'::character varying, 'transfer'::character varying])::text[]))),
    CONSTRAINT orders_priority_check CHECK (((priority)::text = ANY ((ARRAY['express'::character varying, 'standard'::character varying, 'bulk'::character varying, 'same_day'::character varying])::text[]))),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'confirmed'::character varying, 'processing'::character varying, 'allocated'::character varying, 'ready_to_ship'::character varying, 'shipped'::character varying, 'in_transit'::character varying, 'out_for_delivery'::character varying, 'delivered'::character varying, 'returned'::character varying, 'cancelled'::character varying, 'on_hold'::character varying, 'pending_carrier_assignment'::character varying])::text[])))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- TOC entry 5629 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.external_order_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.external_order_id IS 'Reference ID from external system: E-commerce order ID for sales orders, PO number for purchase orders';


--
-- TOC entry 5630 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.customer_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.customer_name IS 'Customer name for sales orders, or receiving warehouse for transfer orders';


--
-- TOC entry 5631 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.status IS 'Order workflow: created -> pending_carrier_assignment -> ready_to_ship -> shipped -> in_transit -> delivered. Use on_hold for any blocking issues.';


--
-- TOC entry 5632 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.order_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.order_type IS 'Order type: regular, replacement, cod, transfer (warehouse-to-warehouse)';


--
-- TOC entry 5633 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.shipping_locked_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.shipping_locked_by IS 'Worker/process identifier that acquired the lock (for debugging)';


--
-- TOC entry 5634 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.shipping_locked_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.shipping_locked_at IS 'Timestamp when the lock was acquired; used to detect expired locks';


--
-- TOC entry 5635 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.carrier_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.carrier_id IS 'Carrier that accepted the assignment (set when carrier accepts job)';


--
-- TOC entry 5636 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.supplier_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.supplier_id IS 'Reference to supplier organization for purchase/inbound orders (NULL for sales orders)';


--
-- TOC entry 5637 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.platform; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.platform IS 'Source platform: amazon, shopify, ebay, website, api, manual';


--
-- TOC entry 5638 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.customer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.customer_id IS 'External customer ID from platform';


--
-- TOC entry 5639 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.payment_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.payment_method IS 'Payment method: cod, prepaid, upi, card, netbanking';


--
-- TOC entry 5640 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN orders.shipping_locked; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.shipping_locked IS 'Optimistic lock flag – set true while a worker holds the shipping assignment lock';


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
-- TOC entry 5641 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.organizations IS 'Multi-tenant companies using the platform';


--
-- TOC entry 5642 (class 0 OID 0)
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
-- TOC entry 273 (class 1259 OID 23584)
-- Name: postal_zones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.postal_zones (
    id integer NOT NULL,
    pincode character varying(10) NOT NULL,
    zone_code character varying(10) NOT NULL,
    city character varying(100),
    state character varying(100),
    country character(2) DEFAULT 'IN'::bpchar NOT NULL,
    lat numeric(9,6),
    lon numeric(9,6),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.postal_zones OWNER TO postgres;

--
-- TOC entry 5643 (class 0 OID 0)
-- Dependencies: 273
-- Name: TABLE postal_zones; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.postal_zones IS 'NOT_PRODUCTION_READY: table is empty until seeded with real pincode data.';


--
-- TOC entry 272 (class 1259 OID 23583)
-- Name: postal_zones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.postal_zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.postal_zones_id_seq OWNER TO postgres;

--
-- TOC entry 5644 (class 0 OID 0)
-- Dependencies: 272
-- Name: postal_zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.postal_zones_id_seq OWNED BY public.postal_zones.id;


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
    selling_price numeric(10,2),
    cost_price numeric(10,2),
    currency character varying(3) DEFAULT 'INR'::character varying,
    attributes jsonb,
    is_active boolean DEFAULT true,
    is_fragile boolean DEFAULT false,
    requires_cold_storage boolean DEFAULT false,
    is_hazmat boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_perishable boolean DEFAULT false,
    volumetric_weight numeric(10,3),
    package_type character varying(50) DEFAULT 'box'::character varying,
    handling_instructions text,
    requires_insurance boolean DEFAULT false,
    manufacturer_barcode character varying(100),
    hsn_code character varying(20),
    gst_rate numeric(5,2) DEFAULT 18.00,
    brand character varying(255),
    country_of_origin character varying(100) DEFAULT 'India'::character varying,
    warranty_period_days integer DEFAULT 0,
    shelf_life_days integer,
    tags jsonb DEFAULT '[]'::jsonb,
    supplier_id uuid,
    mrp numeric(12,2),
    internal_barcode character varying(50) NOT NULL,
    CONSTRAINT products_mrp_check CHECK (((mrp IS NULL) OR (mrp >= (0)::numeric))),
    CONSTRAINT products_package_type_check CHECK (((package_type)::text = ANY ((ARRAY['envelope'::character varying, 'box'::character varying, 'tube'::character varying, 'pallet'::character varying, 'crate'::character varying, 'bag'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT products_shelf_life_days_check CHECK (((shelf_life_days IS NULL) OR (shelf_life_days > 0))),
    CONSTRAINT products_warranty_period_days_check CHECK ((warranty_period_days >= 0))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- TOC entry 5645 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.dimensions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.dimensions IS 'Package dimensions in cm: {length, width, height}. Used for shipping cost calculations.';


--
-- TOC entry 5646 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.selling_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.selling_price IS 'Base catalog selling price (pre-tax, pre-discount)';


--
-- TOC entry 5647 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.cost_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.cost_price IS 'Purchase/manufacturing cost (COGS) - internal use for margin calculation';


--
-- TOC entry 5648 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.is_fragile; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.is_fragile IS 'Requires fragile handling (adds surcharge)';


--
-- TOC entry 5649 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.requires_cold_storage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.requires_cold_storage IS 'Requires temperature-controlled transport (adds surcharge)';


--
-- TOC entry 5650 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.is_perishable; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.is_perishable IS 'Perishable item (adds surcharge, time-sensitive delivery)';


--
-- TOC entry 5651 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.volumetric_weight; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.volumetric_weight IS 'Dimensional weight (L×W×H/5000). Auto-calculated from dimensions.';


--
-- TOC entry 5652 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.package_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.package_type IS 'Recommended package type for this product';


--
-- TOC entry 5653 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.handling_instructions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.handling_instructions IS 'Special handling instructions for carriers';


--
-- TOC entry 5654 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.requires_insurance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.requires_insurance IS 'Whether this product requires shipping insurance';


--
-- TOC entry 5655 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.manufacturer_barcode; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.manufacturer_barcode IS 'UPC/EAN/ISBN from product manufacturer (optional, for retail products)';


--
-- TOC entry 5656 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.hsn_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.hsn_code IS 'HSN/SAC code for GST compliance (manual entry, government classification)';


--
-- TOC entry 5657 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.gst_rate; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.gst_rate IS 'GST rate percentage (0/5/12/18/28) - can be auto-filled from HSN but user must confirm';


--
-- TOC entry 5658 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.brand; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.brand IS 'Brand or manufacturer name';


--
-- TOC entry 5659 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.country_of_origin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.country_of_origin IS 'Country of manufacture — required for customs declarations';


--
-- TOC entry 5660 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.warranty_period_days; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.warranty_period_days IS 'Warranty duration in days (0 = no warranty)';


--
-- TOC entry 5661 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.shelf_life_days; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.shelf_life_days IS 'Shelf life in days for perishable products';


--
-- TOC entry 5662 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.tags; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.tags IS 'Free-form tags for search/filtering e.g. ["summer","new-arrival"]';


--
-- TOC entry 5663 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.supplier_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.supplier_id IS 'Primary supplier for procurement and replenishment';


--
-- TOC entry 5664 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.mrp; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.mrp IS 'Maximum Retail Price (India legal requirement, printed on package)';


--
-- TOC entry 5665 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN products.internal_barcode; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.internal_barcode IS 'Auto-generated internal barcode for warehouse scanning (mandatory, globally unique)';


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
-- TOC entry 5666 (class 0 OID 0)
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
-- TOC entry 276 (class 1259 OID 23615)
-- Name: revoked_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.revoked_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jti character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.revoked_tokens OWNER TO postgres;

--
-- TOC entry 5667 (class 0 OID 0)
-- Dependencies: 276
-- Name: TABLE revoked_tokens; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.revoked_tokens IS 'Blocklist of revoked JWT tokens (by JTI) for immediate invalidation';


--
-- TOC entry 280 (class 1259 OID 23641)
-- Name: sales_channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    platform_type character varying(50) DEFAULT 'marketplace'::character varying NOT NULL,
    webhook_token character varying(64) DEFAULT encode(public.gen_random_bytes(32), 'hex'::text),
    api_endpoint character varying(500),
    contact_name character varying(255),
    contact_email character varying(255),
    contact_phone character varying(20),
    config jsonb DEFAULT '{}'::jsonb,
    default_warehouse_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sales_channels_platform_type_check CHECK (((platform_type)::text = ANY ((ARRAY['marketplace'::character varying, 'd2c'::character varying, 'b2b'::character varying, 'wholesale'::character varying, 'internal'::character varying])::text[])))
);


ALTER TABLE public.sales_channels OWNER TO postgres;

--
-- TOC entry 5668 (class 0 OID 0)
-- Dependencies: 280
-- Name: TABLE sales_channels; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.sales_channels IS 'E-commerce platforms and marketplaces that push orders via webhooks';


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
    updated_at timestamp with time zone DEFAULT now(),
    carrier_id uuid,
    origin_zone_type character varying(20),
    destination_zone_type character varying(20),
    warning_threshold_percent integer DEFAULT 80,
    CONSTRAINT sla_policies_destination_zone_type_check CHECK (((destination_zone_type IS NULL) OR ((destination_zone_type)::text = ANY ((ARRAY['local'::character varying, 'metro'::character varying, 'regional'::character varying, 'national'::character varying, 'remote'::character varying])::text[])))),
    CONSTRAINT sla_policies_origin_zone_type_check CHECK (((origin_zone_type IS NULL) OR ((origin_zone_type)::text = ANY ((ARRAY['local'::character varying, 'metro'::character varying, 'regional'::character varying, 'national'::character varying, 'remote'::character varying])::text[])))),
    CONSTRAINT sla_policies_warning_threshold_percent_check CHECK (((warning_threshold_percent >= 1) AND (warning_threshold_percent <= 100)))
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
-- TOC entry 5669 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN stock_movements.performed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.stock_movements.performed_by IS 'User ID or system identifier who performed the movement';


--
-- TOC entry 281 (class 1259 OID 23676)
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    contact_name character varying(255),
    contact_email character varying(255),
    contact_phone character varying(20),
    website character varying(500),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100) DEFAULT 'India'::character varying,
    postal_code character varying(20),
    lead_time_days integer DEFAULT 7,
    payment_terms character varying(100),
    reliability_score numeric(3,2) DEFAULT 0.85,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suppliers_reliability_score_check CHECK (((reliability_score >= (0)::numeric) AND (reliability_score <= (1)::numeric)))
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- TOC entry 5670 (class 0 OID 0)
-- Dependencies: 281
-- Name: TABLE suppliers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.suppliers IS 'Inbound vendors for purchase orders and inventory replenishment';


--
-- TOC entry 278 (class 1259 OID 23636)
-- Name: transfer_order_number_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transfer_order_number_seq
    START WITH 10000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transfer_order_number_seq OWNER TO postgres;

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
    contact_email character varying(255),
    contact_phone character varying(20),
    is_active boolean DEFAULT true,
    warehouse_type character varying(50) DEFAULT 'standard'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    zones integer DEFAULT 0,
    operating_hours jsonb,
    gstin character varying(15),
    has_cold_storage boolean DEFAULT false NOT NULL,
    temperature_min_celsius numeric(5,1),
    temperature_max_celsius numeric(5,1),
    customs_bonded_warehouse boolean DEFAULT false NOT NULL,
    certifications text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT warehouses_gstin_format CHECK (((gstin IS NULL) OR ((gstin)::text ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'::text))),
    CONSTRAINT warehouses_temperature_range_check CHECK (((temperature_min_celsius IS NULL) OR (temperature_max_celsius IS NULL) OR (temperature_min_celsius <= temperature_max_celsius)))
);


ALTER TABLE public.warehouses OWNER TO postgres;

--
-- TOC entry 5671 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN warehouses.zones; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.warehouses.zones IS 'Number of storage zones in warehouse';


--
-- TOC entry 5672 (class 0 OID 0)
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
-- TOC entry 5673 (class 0 OID 0)
-- Dependencies: 269
-- Name: VIEW transfer_orders; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.transfer_orders IS 'Convenient view for querying transfer orders with shipment details';


--
-- TOC entry 279 (class 1259 OID 23637)
-- Name: transfer_shipment_number_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transfer_shipment_number_seq
    START WITH 10000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transfer_shipment_number_seq OWNER TO postgres;

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
-- TOC entry 5674 (class 0 OID 0)
-- Dependencies: 271
-- Name: TABLE user_notification_preferences; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_notification_preferences IS 'Stores user notification preferences for different channels and event types';


--
-- TOC entry 5675 (class 0 OID 0)
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
-- TOC entry 5676 (class 0 OID 0)
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
    expires_at timestamp with time zone NOT NULL,
    jti character varying(255)
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- TOC entry 5677 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE user_sessions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_sessions IS 'Tracks active user sessions for security and session management';


--
-- TOC entry 5678 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN user_sessions.session_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_sessions.session_token IS 'JWT token for the session';


--
-- TOC entry 5679 (class 0 OID 0)
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
    pending_email character varying(255),
    email_change_token character varying(255),
    email_change_expires timestamp with time zone,
    token_version integer DEFAULT 0 NOT NULL,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['superadmin'::character varying, 'admin'::character varying, 'operations_manager'::character varying, 'warehouse_manager'::character varying, 'carrier_partner'::character varying, 'finance'::character varying, 'customer_support'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 5680 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'All platform users including superadmin and company users';


--
-- TOC entry 5681 (class 0 OID 0)
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
-- TOC entry 5682 (class 0 OID 0)
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
-- TOC entry 5683 (class 0 OID 0)
-- Dependencies: 267
-- Name: TABLE webhook_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.webhook_logs IS 'Audit trail for all webhook requests (authenticated and rejected)';


--
-- TOC entry 282 (class 1259 OID 23787)
-- Name: wh_code_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wh_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wh_code_seq OWNER TO postgres;

--
-- TOC entry 275 (class 1259 OID 23603)
-- Name: zone_distances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zone_distances (
    id integer NOT NULL,
    from_zone character varying(10) NOT NULL,
    to_zone character varying(10) NOT NULL,
    distance_km integer NOT NULL,
    transit_days integer
);


ALTER TABLE public.zone_distances OWNER TO postgres;

--
-- TOC entry 5684 (class 0 OID 0)
-- Dependencies: 275
-- Name: TABLE zone_distances; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.zone_distances IS 'NOT_PRODUCTION_READY: table is empty until seeded with carrier zone matrices.';


--
-- TOC entry 274 (class 1259 OID 23602)
-- Name: zone_distances_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zone_distances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zone_distances_id_seq OWNER TO postgres;

--
-- TOC entry 5685 (class 0 OID 0)
-- Dependencies: 274
-- Name: zone_distances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zone_distances_id_seq OWNED BY public.zone_distances.id;


--
-- TOC entry 4860 (class 2604 OID 23587)
-- Name: postal_zones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.postal_zones ALTER COLUMN id SET DEFAULT nextval('public.postal_zones_id_seq'::regclass);


--
-- TOC entry 4853 (class 2604 OID 23556)
-- Name: user_notification_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_notification_preferences_id_seq'::regclass);


--
-- TOC entry 4864 (class 2604 OID 23606)
-- Name: zone_distances id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_distances ALTER COLUMN id SET DEFAULT nextval('public.zone_distances_id_seq'::regclass);


--
-- TOC entry 5573 (class 0 OID 23079)
-- Dependencies: 260
-- Data for Name: alert_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alert_rules (id, organization_id, name, rule_type, description, severity, threshold, threshold_comparison, conditions, message_template, assigned_users, assigned_roles, notification_channels, escalation_enabled, escalation_delay_minutes, escalation_users, is_active, priority, cooldown_minutes, last_triggered_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5574 (class 0 OID 23110)
-- Dependencies: 261
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alerts (id, organization_id, rule_id, rule_name, alert_type, severity, message, entity_type, entity_id, data, status, acknowledged_by, acknowledged_at, resolved_by, resolved_at, resolution, triggered_at, created_at) FROM stdin;
\.


--
-- TOC entry 5559 (class 0 OID 22673)
-- Dependencies: 246
-- Data for Name: allocation_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.allocation_history (id, order_id, order_item_id, warehouse_id, allocation_strategy, allocation_score, allocated_quantity, reason, created_at) FROM stdin;
\.


--
-- TOC entry 5558 (class 0 OID 22654)
-- Dependencies: 245
-- Data for Name: allocation_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.allocation_rules (id, organization_id, name, priority, strategy, conditions, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5538 (class 0 OID 22133)
-- Dependencies: 225
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, organization_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at) FROM stdin;
51320e31-725a-41cd-b9d4-ba11391d016a	ad53579f-780f-4c6a-9d7d-5b065efba5f8	\N	profile_updated	user	ad53579f-780f-4c6a-9d7d-5b065efba5f8	\N	\N	\N	2026-03-03 00:27:36.858015+05:30
7a93b28f-8b37-4c9f-9191-3dc625017c0a	ad53579f-780f-4c6a-9d7d-5b065efba5f8	\N	profile_updated	user	ad53579f-780f-4c6a-9d7d-5b065efba5f8	\N	\N	\N	2026-03-03 00:27:49.337643+05:30
a8f10e99-4309-41d1-8e83-61bc27698429	ad53579f-780f-4c6a-9d7d-5b065efba5f8	\N	profile_updated	user	ad53579f-780f-4c6a-9d7d-5b065efba5f8	\N	\N	\N	2026-03-03 01:08:47.61704+05:30
1ee6d1f2-e51f-4348-a36b-b19668c57b03	ad53579f-780f-4c6a-9d7d-5b065efba5f8	\N	password_changed	user	ad53579f-780f-4c6a-9d7d-5b065efba5f8	\N	\N	\N	2026-03-03 01:18:36.03493+05:30
\.


--
-- TOC entry 5569 (class 0 OID 22992)
-- Dependencies: 256
-- Data for Name: background_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.background_jobs (id, organization_id, job_type, job_name, priority, status, payload, result, error_message, error_stack, retry_count, max_retries, retry_delay_seconds, scheduled_for, started_at, completed_at, timeout_seconds, created_by, created_at, updated_at, idempotency_key) FROM stdin;
0c22d6b1-c3a0-4d4e-92d9-1a8cb8ef1ab5	\N	process_order	\N	5	completed	{"order": {"items": [{"sku": "LGDOU-202603-DDV1T", "weight": 85, "quantity": 1, "dimensions": {"unit": "cm", "width": 70, "height": 165, "length": 65}, "is_fragile": true, "unit_price": 0, "product_name": "LG Double Door Refrigerator 585L", "declared_value": 0}], "notes": "Order for LG Double Door Refrigerator 585L", "platform": "customer-portal", "priority": "standard", "tax_amount": 0, "total_amount": 2552, "customer_name": "Test Customer", "customer_email": "customer@example.com", "customer_phone": "9876543210", "shipping_amount": 2552, "shipping_address": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}, "external_order_id": "ORD-1772453563633"}, "source": "customer-portal", "event_type": "order.created", "received_at": "2026-03-02T12:12:43.633Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	{"orderId": "8158d62f-39de-488c-be97-d6563d01c7e1", "success": true, "duration": "24ms", "itemsCount": 1, "orderNumber": "ORD-20260302-10063", "externalOrderId": "ORD-1772453563633"}	\N	\N	0	3	60	2026-03-02 17:42:43.646+05:30	2026-03-02 17:42:44.271491+05:30	2026-03-02 17:42:44.306695+05:30	300	\N	2026-03-02 17:42:43.647024+05:30	2026-03-02 17:42:44.306695+05:30	order-customer-portal-ORD-1772453563633
98a6a598-d565-4ad0-b60b-63a6b1788078	\N	process_order	\N	5	completed	{"order": {"items": [{"sku": "LGDOU-202603-DDV1T", "weight": 85, "quantity": 1, "dimensions": {"unit": "cm", "width": 70, "height": 165, "length": 65}, "is_fragile": true, "unit_price": 0, "product_name": "LG Double Door Refrigerator 585L", "declared_value": 0}], "notes": "Order for LG Double Door Refrigerator 585L", "platform": "customer-portal", "priority": "standard", "tax_amount": 0, "total_amount": 2552, "customer_name": "Test Customer", "customer_email": "customer@example.com", "customer_phone": "9876543210", "shipping_amount": 2552, "shipping_address": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}, "external_order_id": "ORD-1772455976646"}, "source": "customer-portal", "event_type": "order.created", "received_at": "2026-03-02T12:52:56.646Z", "organization_id": "314c5bb9-2a9d-4da3-889f-12bc1af98c8e"}	{"orderId": "b81c0b6d-7257-4c71-a6ed-6a106cf221cd", "success": true, "duration": "16ms", "itemsCount": 1, "orderNumber": "ORD-20260302-10064", "externalOrderId": "ORD-1772455976646"}	\N	\N	0	3	60	2026-03-02 18:22:56.656+05:30	2026-03-02 18:22:57.630186+05:30	2026-03-02 18:22:57.650953+05:30	300	\N	2026-03-02 18:22:56.656883+05:30	2026-03-02 18:22:57.650953+05:30	order-customer-portal-ORD-1772455976646
\.


--
-- TOC entry 5549 (class 0 OID 22430)
-- Dependencies: 236
-- Data for Name: carrier_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_assignments (id, organization_id, order_id, carrier_id, service_type, status, pickup_address, delivery_address, estimated_pickup, estimated_delivery, actual_pickup, special_instructions, request_payload, acceptance_payload, carrier_reference_id, carrier_tracking_number, rejected_reason, idempotency_key, requested_at, assigned_at, accepted_at, expires_at, created_at, updated_at) FROM stdin;
31291056-f180-4074-9ca9-3d09826ddc0d	\N	8158d62f-39de-488c-be97-d6563d01c7e1	3d2cffcd-5e43-48ca-9c6e-9427afab1070	standard	rejected	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	2026-03-02 19:42:44.298+05:30	2026-03-03 17:42:44.298+05:30	\N	\N	{"items": [{"sku": "LGDOU-202603-DDV1T", "weight": 85, "category": null, "quantity": 1, "dimensions": {"unit": "cm", "width": 70, "height": 165, "length": 65}, "is_fragile": true, "product_id": null, "unit_price": 0, "is_hazardous": false, "product_name": "LG Double Door Refrigerator 585L"}], "orderId": "8158d62f-39de-488c-be97-d6563d01c7e1", "orderNumber": "ORD-20260302-10063", "requestedAt": "2026-03-02T12:12:44.298Z", "serviceType": "standard", "totalAmount": 48551, "customerName": "Test Customer", "customerEmail": "customer@example.com", "customerPhone": "9876543210", "shippingAddress": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}}	\N	\N	\N	weight_exceeded	8158d62f-39de-488c-be97-d6563d01c7e1-carrier-3d2cffcd-5e43-48ca-9c6e-9427afab1070-1772453564298	2026-03-02 17:42:44.283545+05:30	\N	\N	2026-03-02 17:52:44.298+05:30	2026-03-02 17:42:44.283545+05:30	2026-03-02 18:11:03.234568+05:30
ce3b1b5c-f743-421f-b36f-2d2f44fc9de6	\N	8158d62f-39de-488c-be97-d6563d01c7e1	a0c33fcb-0cb7-45d0-ba2a-22f777612b64	standard	accepted	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	2026-03-02 19:42:44.3+05:30	2026-03-03 17:42:44.3+05:30	\N	\N	{"items": [{"sku": "LGDOU-202603-DDV1T", "weight": 85, "category": null, "quantity": 1, "dimensions": {"unit": "cm", "width": 70, "height": 165, "length": 65}, "is_fragile": true, "product_id": null, "unit_price": 0, "is_hazardous": false, "product_name": "LG Double Door Refrigerator 585L"}], "orderId": "8158d62f-39de-488c-be97-d6563d01c7e1", "orderNumber": "ORD-20260302-10063", "requestedAt": "2026-03-02T12:12:44.300Z", "serviceType": "standard", "totalAmount": 48551, "customerName": "Test Customer", "customerEmail": "customer@example.com", "customerPhone": "9876543210", "shippingAddress": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}}	{"driver": null, "pricing": {"currency": "INR", "breakdown": {}, "quotedPrice": 7283}, "accepted": true, "delivery": {}, "tracking": {}, "acceptedAt": "2026-03-02T12:41:27.218Z", "termsAccepted": true}	\N	\N	\N	8158d62f-39de-488c-be97-d6563d01c7e1-carrier-a0c33fcb-0cb7-45d0-ba2a-22f777612b64-1772453564300	2026-03-02 17:42:44.283545+05:30	\N	2026-03-02 18:11:27.209949+05:30	2026-03-02 17:52:44.3+05:30	2026-03-02 17:42:44.283545+05:30	2026-03-02 18:11:27.209949+05:30
edda6f9c-c059-48d1-9b9f-34b37adb879c	\N	8158d62f-39de-488c-be97-d6563d01c7e1	9d4c95c3-2e98-46d1-b0ac-3023398e99c3	standard	cancelled	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	2026-03-02 19:42:44.302+05:30	2026-03-03 17:42:44.302+05:30	\N	\N	{"items": [{"sku": "LGDOU-202603-DDV1T", "weight": 85, "category": null, "quantity": 1, "dimensions": {"unit": "cm", "width": 70, "height": 165, "length": 65}, "is_fragile": true, "product_id": null, "unit_price": 0, "is_hazardous": false, "product_name": "LG Double Door Refrigerator 585L"}], "orderId": "8158d62f-39de-488c-be97-d6563d01c7e1", "orderNumber": "ORD-20260302-10063", "requestedAt": "2026-03-02T12:12:44.301Z", "serviceType": "standard", "totalAmount": 48551, "customerName": "Test Customer", "customerEmail": "customer@example.com", "customerPhone": "9876543210", "shippingAddress": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}}	\N	\N	\N	\N	8158d62f-39de-488c-be97-d6563d01c7e1-carrier-9d4c95c3-2e98-46d1-b0ac-3023398e99c3-1772453564301	2026-03-02 17:42:44.283545+05:30	\N	\N	2026-03-02 17:52:44.301+05:30	2026-03-02 17:42:44.283545+05:30	2026-03-02 18:11:27.209949+05:30
65f2ed3f-3f01-4817-bad1-6383a70653f8	\N	b81c0b6d-7257-4c71-a6ed-6a106cf221cd	3d2cffcd-5e43-48ca-9c6e-9427afab1070	standard	pending	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	2026-03-02 20:22:57.642+05:30	2026-03-03 18:22:57.642+05:30	\N	\N	{"items": [{"sku": "LGDOU-202603-DDV1T", "weight": 85, "category": null, "quantity": 1, "dimensions": {"unit": "cm", "width": 70, "height": 165, "length": 65}, "is_fragile": true, "product_id": null, "unit_price": 0, "is_hazardous": false, "product_name": "LG Double Door Refrigerator 585L"}], "orderId": "b81c0b6d-7257-4c71-a6ed-6a106cf221cd", "orderNumber": "ORD-20260302-10064", "requestedAt": "2026-03-02T12:52:57.642Z", "serviceType": "standard", "totalAmount": 48551, "customerName": "Test Customer", "customerEmail": "customer@example.com", "customerPhone": "9876543210", "shippingAddress": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}}	\N	\N	\N	\N	b81c0b6d-7257-4c71-a6ed-6a106cf221cd-carrier-3d2cffcd-5e43-48ca-9c6e-9427afab1070-1772455977642	2026-03-02 18:22:57.635574+05:30	\N	\N	2026-03-02 18:32:57.642+05:30	2026-03-02 18:22:57.635574+05:30	2026-03-02 18:22:57.635574+05:30
2fd05044-a9fd-4c65-9995-d93ddba593ed	\N	b81c0b6d-7257-4c71-a6ed-6a106cf221cd	a0c33fcb-0cb7-45d0-ba2a-22f777612b64	standard	pending	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	2026-03-02 20:22:57.644+05:30	2026-03-03 18:22:57.644+05:30	\N	\N	{"items": [{"sku": "LGDOU-202603-DDV1T", "weight": 85, "category": null, "quantity": 1, "dimensions": {"unit": "cm", "width": 70, "height": 165, "length": 65}, "is_fragile": true, "product_id": null, "unit_price": 0, "is_hazardous": false, "product_name": "LG Double Door Refrigerator 585L"}], "orderId": "b81c0b6d-7257-4c71-a6ed-6a106cf221cd", "orderNumber": "ORD-20260302-10064", "requestedAt": "2026-03-02T12:52:57.644Z", "serviceType": "standard", "totalAmount": 48551, "customerName": "Test Customer", "customerEmail": "customer@example.com", "customerPhone": "9876543210", "shippingAddress": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}}	\N	\N	\N	\N	b81c0b6d-7257-4c71-a6ed-6a106cf221cd-carrier-a0c33fcb-0cb7-45d0-ba2a-22f777612b64-1772455977644	2026-03-02 18:22:57.635574+05:30	\N	\N	2026-03-02 18:32:57.644+05:30	2026-03-02 18:22:57.635574+05:30	2026-03-02 18:22:57.635574+05:30
5002eb19-4609-45f4-a056-a59e713a4a82	\N	b81c0b6d-7257-4c71-a6ed-6a106cf221cd	9d4c95c3-2e98-46d1-b0ac-3023398e99c3	standard	pending	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	2026-03-02 20:22:57.646+05:30	2026-03-03 18:22:57.646+05:30	\N	\N	{"items": [{"sku": "LGDOU-202603-DDV1T", "weight": 85, "category": null, "quantity": 1, "dimensions": {"unit": "cm", "width": 70, "height": 165, "length": 65}, "is_fragile": true, "product_id": null, "unit_price": 0, "is_hazardous": false, "product_name": "LG Double Door Refrigerator 585L"}], "orderId": "b81c0b6d-7257-4c71-a6ed-6a106cf221cd", "orderNumber": "ORD-20260302-10064", "requestedAt": "2026-03-02T12:52:57.646Z", "serviceType": "standard", "totalAmount": 48551, "customerName": "Test Customer", "customerEmail": "customer@example.com", "customerPhone": "9876543210", "shippingAddress": {"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}}	\N	\N	\N	\N	b81c0b6d-7257-4c71-a6ed-6a106cf221cd-carrier-9d4c95c3-2e98-46d1-b0ac-3023398e99c3-1772455977646	2026-03-02 18:22:57.635574+05:30	\N	\N	2026-03-02 18:32:57.646+05:30	2026-03-02 18:22:57.635574+05:30	2026-03-02 18:22:57.635574+05:30
\.


--
-- TOC entry 5555 (class 0 OID 22597)
-- Dependencies: 242
-- Data for Name: carrier_capacity_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_capacity_log (id, carrier_id, daily_capacity, current_load, utilization_percentage, availability_status, logged_at) FROM stdin;
\.


--
-- TOC entry 5557 (class 0 OID 22626)
-- Dependencies: 244
-- Data for Name: carrier_performance_metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_performance_metrics (id, carrier_id, organization_id, period_start, period_end, period_type, total_shipments, delivered_on_time, delivered_late, failed_deliveries, returns_processed, on_time_rate, delivery_success_rate, damage_rate, avg_delivery_hours, avg_first_attempt_success_rate, calculated_at) FROM stdin;
\.


--
-- TOC entry 5553 (class 0 OID 22545)
-- Dependencies: 240
-- Data for Name: carrier_quotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_quotes (id, order_id, carrier_id, quoted_price, estimated_delivery_days, service_type, response_time_ms, was_retried, retry_count, was_selected, selection_reason, status, error_message, request_payload, response_payload, quoted_at, expires_at) FROM stdin;
\.


--
-- TOC entry 5554 (class 0 OID 22570)
-- Dependencies: 241
-- Data for Name: carrier_rejections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_rejections (id, carrier_assignment_id, carrier_id, order_id, reason, message, error_code, response_time_ms, raw_response, rejected_at) FROM stdin;
\.


--
-- TOC entry 5540 (class 0 OID 22183)
-- Dependencies: 227
-- Data for Name: carriers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carriers (id, organization_id, code, name, service_type, service_areas, contact_email, contact_phone, website, api_endpoint, api_key_encrypted, webhook_url, reliability_score, avg_delivery_days, daily_capacity, current_load, is_active, availability_status, last_status_change, created_at, updated_at, webhook_secret, our_client_id, our_client_secret, ip_whitelist, webhook_events, webhook_enabled, api_timeout_ms) FROM stdin;
3d2cffcd-5e43-48ca-9c6e-9427afab1070	\N	DELHIVERY	Delhivery	standard	\N	support@delhivery.com	\N	\N	\N	\N	\N	0.92	\N	1000	0	t	available	2026-02-16 14:32:00.319073+05:30	2026-02-16 14:32:00.319073+05:30	2026-02-18 01:49:56.631479+05:30	whsec_delhivery_a7b1268b3ae9ab3c3adc786456d1757d	scm_client_3d2cffcd-5e43-48ca-9c6e-9427afab1070	scm_secret_841779c27790c75e9a8a7d2ba70498e8	\N	{shipment.pickup,shipment.in_transit,shipment.delivered,shipment.exception}	t	15000
66e17e40-c5f2-4eca-9a5d-c4166b00d571	\N	BLUEDART	BlueDart Express	express	\N	support@bluedart.com	\N	\N	\N	\N	\N	0.95	\N	500	0	t	available	2026-02-16 14:32:00.319073+05:30	2026-02-16 14:32:00.319073+05:30	2026-02-18 01:49:56.631479+05:30	whsec_bluedart_b79f62b01e936c41ce7f0b1adb283be5	scm_client_66e17e40-c5f2-4eca-9a5d-c4166b00d571	scm_secret_65e7c2b373733c3ee7313d373356cccb	\N	{shipment.pickup,shipment.in_transit,shipment.delivered,shipment.exception}	t	15000
9d4c95c3-2e98-46d1-b0ac-3023398e99c3	\N	DTDC	DTDC Courier	standard	\N	support@dtdc.com	\N	\N	\N	\N	\N	0.88	\N	800	0	t	available	2026-02-16 14:32:00.319073+05:30	2026-02-16 14:32:00.319073+05:30	2026-02-18 01:49:56.631479+05:30	whsec_dtdc_d5101563c177673a02b5216b350bb80f	scm_client_9d4c95c3-2e98-46d1-b0ac-3023398e99c3	scm_secret_2409c32e6ead5e56f4744caeb611f0c2	\N	{shipment.pickup,shipment.in_transit,shipment.delivered,shipment.exception}	t	15000
a0c33fcb-0cb7-45d0-ba2a-22f777612b64	\N	ECOM	Ecom Express	standard	\N	support@ecomexpress.in	\N	\N	\N	\N	\N	0.90	\N	600	0	t	available	2026-02-16 14:32:00.319073+05:30	2026-02-16 14:32:00.319073+05:30	2026-02-18 01:49:56.631479+05:30	whsec_ecom_7c0ecff5bb944d02c6ec6d0d55ee519f	scm_client_a0c33fcb-0cb7-45d0-ba2a-22f777612b64	scm_secret_2bb401c9bbbaf4c0fd35ebd2c9b09079	\N	{shipment.pickup,shipment.in_transit,shipment.delivered,shipment.exception}	t	15000
ae48904e-1967-4ded-b73c-ccae165fd0c9	\N	SHADOWFAX	Shadowfax	same_day	\N	support@shadowfax.in	\N	\N	\N	\N	\N	0.87	\N	300	0	t	available	2026-02-16 14:32:00.319073+05:30	2026-02-16 14:32:00.319073+05:30	2026-02-18 01:49:56.631479+05:30	whsec_shadowfax_bdb1c849a9a56d70e1071334b946de58	scm_client_ae48904e-1967-4ded-b73c-ccae165fd0c9	scm_secret_6ce10d120779f904b6cc0206b8273800	\N	{shipment.pickup,shipment.in_transit,shipment.delivered,shipment.exception}	t	15000
\.


--
-- TOC entry 5571 (class 0 OID 23041)
-- Dependencies: 258
-- Data for Name: cron_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cron_schedules (id, organization_id, name, description, job_type, cron_expression, timezone, payload, is_active, last_run_at, last_run_status, next_run_at, total_runs, failed_runs, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5572 (class 0 OID 23064)
-- Dependencies: 259
-- Data for Name: dead_letter_queue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dead_letter_queue (id, original_job_id, job_type, payload, priority, error_message, error_stack, retry_count, original_created_at, moved_to_dlq_at, reprocessed, reprocessed_at, reprocessed_job_id) FROM stdin;
\.


--
-- TOC entry 5566 (class 0 OID 22915)
-- Dependencies: 253
-- Data for Name: eta_predictions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.eta_predictions (id, shipment_id, predicted_delivery, confidence_score, delay_risk_score, factors, actual_delivery, prediction_accuracy_hours, model_version, created_at) FROM stdin;
\.


--
-- TOC entry 5564 (class 0 OID 22829)
-- Dependencies: 251
-- Data for Name: exceptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exceptions (id, organization_id, exception_type, severity, priority, shipment_id, order_id, carrier_id, title, description, root_cause, status, escalation_level, escalated_at, assigned_to, assigned_at, resolution, resolution_notes, sla_impacted, customer_impacted, financial_impact, estimated_resolution_time, resolved_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5544 (class 0 OID 22279)
-- Dependencies: 231
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory (id, warehouse_id, product_id, sku, product_name, quantity, available_quantity, reserved_quantity, damaged_quantity, in_transit_quantity, reorder_point, max_stock_level, last_stock_check, created_at, updated_at, unit_cost, organization_id) FROM stdin;
163a294d-c116-415c-88a1-c49bbfa5e833	e0c046e4-ae5f-449b-ab10-1c220e6fb6db	b3d7fb4e-ad01-4448-8e1c-8d2722c6c3c0	LGDOU-202603-DDV1T	LG Double Door Refrigerator 585L	49	48	1	0	0	10	50	\N	2026-03-02 17:42:05.640671+05:30	2026-03-02 18:37:33.756903+05:30	55000.00	314c5bb9-2a9d-4da3-889f-12bc1af98c8e
\.


--
-- TOC entry 5568 (class 0 OID 22965)
-- Dependencies: 255
-- Data for Name: invoice_line_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_line_items (id, invoice_id, shipment_id, order_id, description, item_type, quantity, unit_price, amount, created_at) FROM stdin;
\.


--
-- TOC entry 5567 (class 0 OID 22933)
-- Dependencies: 254
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, organization_id, invoice_number, carrier_id, billing_period_start, billing_period_end, total_shipments, base_amount, penalties, adjustments, tax_amount, final_amount, currency, status, due_date, paid_amount, paid_at, payment_method, payment_reference, invoice_url, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5570 (class 0 OID 23023)
-- Dependencies: 257
-- Data for Name: job_execution_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.job_execution_logs (id, job_id, attempt_number, status, error_message, execution_time_ms, output_data, started_at, completed_at) FROM stdin;
db01af61-110e-49ec-aac6-9e808c83c949	0c22d6b1-c3a0-4d4e-92d9-1a8cb8ef1ab5	1	completed	\N	35	\N	2026-03-02 17:42:44.271491+05:30	2026-03-02 17:42:44.306695+05:30
45167671-ab4c-4d1d-81b0-e913fa223314	98a6a598-d565-4ad0-b60b-63a6b1788078	1	completed	\N	21	\N	2026-03-02 18:22:57.630186+05:30	2026-03-02 18:22:57.650953+05:30
\.


--
-- TOC entry 5575 (class 0 OID 23143)
-- Dependencies: 262
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, organization_id, type, title, message, entity_type, entity_id, link, is_read, read_at, priority, created_at, expires_at) FROM stdin;
\.


--
-- TOC entry 5547 (class 0 OID 22374)
-- Dependencies: 234
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, product_id, sku, product_name, quantity, fulfilled_quantity, unit_price, discount, tax, total_price, weight, warehouse_id, bin_location, status, shipped_at, created_at, dimensions, is_fragile, is_hazardous, is_perishable, requires_cold_storage, item_type, volumetric_weight, package_type, handling_instructions, requires_insurance, declared_value) FROM stdin;
d6ea4c1f-cf04-4745-b463-e818ccacef9d	8158d62f-39de-488c-be97-d6563d01c7e1	b3d7fb4e-ad01-4448-8e1c-8d2722c6c3c0	LGDOU-202603-DDV1T	LG Double Door Refrigerator 585L	1	0	45999.00	0.00	0.00	45999.00	85.000	e0c046e4-ae5f-449b-ab10-1c220e6fb6db	\N	pending	\N	2026-03-02 17:42:44.283545+05:30	{"unit": "cm", "width": 70, "height": 165, "length": 65}	t	f	f	f	general	150.150	box	\N	t	\N
00ced88e-83ec-4cec-af43-c5373389bcf6	b81c0b6d-7257-4c71-a6ed-6a106cf221cd	b3d7fb4e-ad01-4448-8e1c-8d2722c6c3c0	LGDOU-202603-DDV1T	LG Double Door Refrigerator 585L	1	0	45999.00	0.00	0.00	45999.00	85.000	e0c046e4-ae5f-449b-ab10-1c220e6fb6db	\N	pending	\N	2026-03-02 18:22:57.635574+05:30	{"unit": "cm", "width": 70, "height": 165, "length": 65}	t	f	f	f	general	150.150	box	\N	t	\N
\.


--
-- TOC entry 5548 (class 0 OID 22405)
-- Dependencies: 235
-- Data for Name: order_splits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_splits (id, parent_order_id, child_order_id, warehouse_id, split_reason, created_at) FROM stdin;
\.


--
-- TOC entry 5546 (class 0 OID 22340)
-- Dependencies: 233
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, organization_id, order_number, external_order_id, customer_name, customer_email, customer_phone, status, priority, order_type, is_cod, subtotal, tax_amount, shipping_amount, discount_amount, total_amount, currency, shipping_address, billing_address, estimated_delivery, actual_delivery, promised_delivery, allocated_warehouse_id, shipping_locked_by, shipping_locked_at, notes, special_instructions, tags, created_at, updated_at, carrier_id, supplier_id, platform, customer_id, payment_method, shipping_locked) FROM stdin;
8158d62f-39de-488c-be97-d6563d01c7e1	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	ORD-20260302-10063	ORD-1772453563633	Test Customer	customer@example.com	9876543210	shipped	standard	regular	f	45999.00	0.00	2552.00	0.00	48551.00	INR	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	\N	\N	\N	\N	\N	\N	\N	Order for LG Double Door Refrigerator 585L	\N	\N	2026-03-02 17:42:44.283545+05:30	2026-03-02 18:11:36.648114+05:30	a0c33fcb-0cb7-45d0-ba2a-22f777612b64	\N	customer-portal	\N	\N	f
b81c0b6d-7257-4c71-a6ed-6a106cf221cd	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	ORD-20260302-10064	ORD-1772455976646	Test Customer	customer@example.com	9876543210	pending_carrier_assignment	standard	regular	f	45999.00	0.00	2552.00	0.00	48551.00	INR	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	\N	\N	\N	\N	\N	\N	\N	Order for LG Double Door Refrigerator 585L	\N	\N	2026-03-02 18:22:57.635574+05:30	2026-03-02 18:22:57.635574+05:30	\N	\N	customer-portal	\N	\N	f
\.


--
-- TOC entry 5533 (class 0 OID 22024)
-- Dependencies: 220
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, code, email, phone, website, address, city, state, country, postal_code, timezone, currency, logo_url, is_active, subscription_tier, created_at, updated_at, webhook_token) FROM stdin;
314c5bb9-2a9d-4da3-889f-12bc1af98c8e	Croma	ORG-26-001	contact@croma.com	9876543210	https://croma.com	ABC	Mumbai	Magarashtra	India	400001	Asia/Kolkata	INR	\N	t	standard	2026-02-22 15:27:27.602374+05:30	2026-02-22 18:28:15.299892+05:30	7d0aa9fe498ea6bc704bd230ea00bdc57c4c246213d91eba3c1ceaaabab83293
\.


--
-- TOC entry 5561 (class 0 OID 22733)
-- Dependencies: 248
-- Data for Name: pick_list_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pick_list_items (id, pick_list_id, order_item_id, inventory_id, sku, product_name, quantity_to_pick, quantity_picked, bin_location, zone, status, picked_at, picked_by) FROM stdin;
\.


--
-- TOC entry 5560 (class 0 OID 22701)
-- Dependencies: 247
-- Data for Name: pick_lists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pick_lists (id, organization_id, warehouse_id, pick_list_number, status, priority, total_items, picked_items, assigned_to, assigned_at, started_at, completed_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5580 (class 0 OID 23584)
-- Dependencies: 273
-- Data for Name: postal_zones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.postal_zones (id, pincode, zone_code, city, state, country, lat, lon, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5542 (class 0 OID 22231)
-- Dependencies: 229
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, organization_id, sku, name, description, category, weight, dimensions, selling_price, cost_price, currency, attributes, is_active, is_fragile, requires_cold_storage, is_hazmat, created_at, updated_at, is_perishable, volumetric_weight, package_type, handling_instructions, requires_insurance, manufacturer_barcode, hsn_code, gst_rate, brand, country_of_origin, warranty_period_days, shelf_life_days, tags, supplier_id, mrp, internal_barcode) FROM stdin;
b3d7fb4e-ad01-4448-8e1c-8d2722c6c3c0	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	LGDOU-202603-DDV1T	LG Double Door Refrigerator 585L	585L frost-free double door	Electronics	85.000	{"unit": "cm", "width": 70, "height": 165, "length": 65}	45999.00	32000.00	INR	\N	t	t	f	f	2026-03-01 18:59:49.137546+05:30	2026-03-01 18:59:49.137546+05:30	f	150.150	box	\N	t	8806089865413	841821	18.00	LG	India	365	\N	["home-appliance", "kitchen", "refrigeration", "inverter-compressor", "energy-efficient"]	\N	54999.00	IB202603011859493IMA
\.


--
-- TOC entry 5556 (class 0 OID 22611)
-- Dependencies: 243
-- Data for Name: quote_idempotency_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_idempotency_cache (idempotency_key, quote_id, response_data, created_at, expires_at) FROM stdin;
\.


--
-- TOC entry 5541 (class 0 OID 22210)
-- Dependencies: 228
-- Data for Name: rate_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rate_cards (id, carrier_id, origin_state, origin_city, destination_state, destination_city, service_type, base_rate, per_kg_rate, per_km_rate, fuel_surcharge_pct, cod_charge, effective_from, effective_to, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 5563 (class 0 OID 22802)
-- Dependencies: 250
-- Data for Name: return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.return_items (id, return_id, order_item_id, product_id, sku, product_name, quantity, reason, reason_detail, condition, created_at) FROM stdin;
\.


--
-- TOC entry 5562 (class 0 OID 22766)
-- Dependencies: 249
-- Data for Name: returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.returns (id, organization_id, rma_number, external_return_id, order_id, original_shipment_id, return_shipment_id, customer_name, customer_email, customer_phone, reason, reason_detail, status, quality_check_result, quality_check_notes, inspection_images, refund_amount, restocking_fee, refund_status, refund_processed_at, items, pickup_address, requested_at, approved_at, received_at, resolved_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5583 (class 0 OID 23615)
-- Dependencies: 276
-- Data for Name: revoked_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.revoked_tokens (id, jti, user_id, expires_at, created_at) FROM stdin;
\.


--
-- TOC entry 5587 (class 0 OID 23641)
-- Dependencies: 280
-- Data for Name: sales_channels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_channels (id, organization_id, name, code, platform_type, webhook_token, api_endpoint, contact_name, contact_email, contact_phone, config, default_warehouse_id, is_active, created_at, updated_at) FROM stdin;
16c0f952-154c-41fb-85f2-fdfde7397f3b	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	Croma	CROMA-0P8H	marketplace	661e0b56fb823ff60573b5257a6b7f3bc9ba66ee864ea2b4ab050cc6d05a801d	https://croma.com	Croma	croma@gmail.com	9876543210	{}	\N	t	2026-02-28 15:51:10.208071+05:30	2026-02-28 15:51:10.208071+05:30
\.


--
-- TOC entry 5551 (class 0 OID 22509)
-- Dependencies: 238
-- Data for Name: shipment_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipment_events (id, shipment_id, event_type, event_code, status, location, city, description, remarks, source, raw_payload, event_timestamp, created_at) FROM stdin;
09cc3772-4f80-4ffc-85d8-0a20746bdfea	66e3ec0b-13eb-4949-a4d6-a270ffbf89c6	shipment_created	CREATED	pending	\N	\N	Shipment confirmed and awaiting carrier pickup	\N	system	\N	2026-03-02 18:11:27.209949+05:30	2026-03-02 18:11:27.209949+05:30
216c68df-62f3-4b3a-acf5-04a75b877ffa	66e3ec0b-13eb-4949-a4d6-a270ffbf89c6	picked_up	\N	\N	{"lat": 19.110997169617974, "lon": 72.85533845891764, "city": "Mumbai", "state": "Maharashtra"}	\N	Package picked up by Ecom Express | Driver: Ecom Express Driver | Vehicle: MH-01-AB-7888	\N	\N	\N	2026-03-02 18:11:36.631+05:30	2026-03-02 18:11:36.648114+05:30
\.


--
-- TOC entry 5550 (class 0 OID 22465)
-- Dependencies: 237
-- Data for Name: shipments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipments (id, organization_id, tracking_number, carrier_tracking_number, order_id, carrier_assignment_id, carrier_id, warehouse_id, status, origin_address, destination_address, weight, volumetric_weight, dimensions, package_count, shipping_cost, cod_amount, current_location, route_geometry, tracking_events, delivery_attempts, pickup_scheduled, pickup_actual, delivery_scheduled, delivery_actual, pod_image_url, pod_signature_url, delivered_to, delivery_notes, created_at, updated_at, is_fragile, is_hazardous, is_perishable, requires_cold_storage, item_type, package_type, handling_instructions, requires_insurance, declared_value, total_items, sla_policy_id) FROM stdin;
66e3ec0b-13eb-4949-a4d6-a270ffbf89c6	\N	TRACK-1772455287226-lhc84170w	\N	8158d62f-39de-488c-be97-d6563d01c7e1	ce3b1b5c-f743-421f-b36f-2d2f44fc9de6	a0c33fcb-0cb7-45d0-ba2a-22f777612b64	\N	in_transit	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	{"city": "Mumbai", "state": "Maharashtra", "street": "123 Main St", "country": "India", "postal_code": "400001"}	150.150	150.150	{"width": 70, "height": 165, "length": 65}	1	7283.00	0.00	{"lat": 19.110997169617974, "lon": 72.85533845891764, "city": "Mumbai", "state": "Maharashtra"}	\N	[]	0	\N	2026-03-02 18:11:36.631+05:30	2026-03-03 18:11:27.23+05:30	\N	\N	\N	\N	\N	2026-03-02 18:11:27.209949+05:30	2026-03-02 18:11:36.648114+05:30	t	f	f	f	general	box	\N	t	0.00	1	\N
\.


--
-- TOC entry 5552 (class 0 OID 22527)
-- Dependencies: 239
-- Data for Name: shipping_estimates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipping_estimates (id, order_id, carrier_id, estimated_cost, estimated_days, service_type, confidence_score, actual_cost, actual_days, accuracy_percent, created_at) FROM stdin;
\.


--
-- TOC entry 5543 (class 0 OID 22256)
-- Dependencies: 230
-- Data for Name: sla_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sla_policies (id, organization_id, name, service_type, origin_region, destination_region, delivery_hours, pickup_hours, first_attempt_delivery_hours, penalty_per_hour, max_penalty_amount, penalty_type, is_active, priority, created_at, updated_at, carrier_id, origin_zone_type, destination_zone_type, warning_threshold_percent) FROM stdin;
8ac658a3-8304-497d-8827-1aa6ffd7bf74	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	Standard SLA	standard	\N	\N	72	24	\N	0.00	\N	fixed	t	5	2026-03-01 16:31:46.998183+05:30	2026-03-01 16:31:46.998183+05:30	\N	\N	\N	80
a47be437-3e18-4d02-8482-4f903dbcbf7f	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	Delhivery Metro Policy	standard	metro	metro	72	4	\N	25.00	200.00	fixed	t	2	2026-03-03 00:00:31.276963+05:30	2026-03-03 00:00:31.276963+05:30	\N	metro	metro	80
\.


--
-- TOC entry 5565 (class 0 OID 22875)
-- Dependencies: 252
-- Data for Name: sla_violations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sla_violations (id, organization_id, shipment_id, sla_policy_id, carrier_id, violation_type, promised_delivery, actual_delivery, delay_hours, penalty_amount, penalty_status, status, waiver_reason, waived_by, waived_at, reason, notes, violated_at, resolved_at, created_at, updated_at, penalty_applied, penalty_calculated_at, penalty_approved_by) FROM stdin;
\.


--
-- TOC entry 5545 (class 0 OID 22306)
-- Dependencies: 232
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movements (id, warehouse_id, product_id, inventory_id, movement_type, quantity, reference_type, reference_id, notes, batch_number, created_by, created_at, performed_by) FROM stdin;
\.


--
-- TOC entry 5588 (class 0 OID 23676)
-- Dependencies: 281
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, organization_id, name, code, contact_name, contact_email, contact_phone, website, address, city, state, country, postal_code, lead_time_days, payment_terms, reliability_score, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5578 (class 0 OID 23553)
-- Dependencies: 271
-- Data for Name: user_notification_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_notification_preferences (id, user_id, email_enabled, push_enabled, sms_enabled, notification_types, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5535 (class 0 OID 22070)
-- Dependencies: 222
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_permissions (id, user_id, permission, granted_by, created_at) FROM stdin;
\.


--
-- TOC entry 5537 (class 0 OID 22113)
-- Dependencies: 224
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_sessions (id, user_id, session_token, refresh_token, device_name, device_type, ip_address, user_agent, is_active, last_active, created_at, expires_at, jti) FROM stdin;
ded5c484-1105-4471-a795-5bc4c8dd54f2	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyNDgyOTUxLCJleHAiOjE3NzMwODc3NTF9.ak3miNtF9isBvscGT80qPc55VV7ieU2YZAD-xrJyZZ0	\N	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	t	2026-03-03 01:52:31.697539+05:30	2026-03-03 01:52:31.697539+05:30	2026-03-10 01:52:31.697539+05:30	\N
a7fe42fc-d186-49c8-b0b5-1ccd2b579367	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyMzYyOTAxLCJleHAiOjE3NzI5Njc3MDF9.SNK1ZPpRBXVmRgHw9eCudGfzywzdh8x-XFOUyiu_lIs	\N	\N	\N	::1	node	f	2026-03-01 16:31:41.627248+05:30	2026-03-01 16:31:41.627248+05:30	2026-03-08 16:31:41.627248+05:30	\N
9045435e-f76d-4a86-b8dd-969a55c3f2e7	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyMzYyOTM5LCJleHAiOjE3NzI5Njc3Mzl9.ka8AdkKMI58G0OVan_iArty8tZ2Er06pS5ml8b6MfpA	\N	\N	\N	::1	node	f	2026-03-01 16:32:19.673769+05:30	2026-03-01 16:32:19.673769+05:30	2026-03-08 16:32:19.673769+05:30	\N
850c052a-b631-44fb-bb03-ce08f18563bf	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyMzYzNjM5LCJleHAiOjE3NzI5Njg0Mzl9.ng65AWMA_K12O24hbswcLGsU1sR6XWnob4FJYNS7CCM	\N	\N	\N	::1	node	f	2026-03-01 16:43:59.719163+05:30	2026-03-01 16:43:59.719163+05:30	2026-03-08 16:43:59.719163+05:30	\N
75d2efd9-cf34-40f3-bc98-82d6e75132ba	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyMzY1OTEzLCJleHAiOjE3NzI5NzA3MTN9.B1Ix6jgw6DJGpDtbtVRbZ-QnPKQrUmt0KmMhhYKzAd0	\N	\N	\N	::1	node	f	2026-03-01 17:21:53.911722+05:30	2026-03-01 17:21:53.911722+05:30	2026-03-08 17:21:53.911722+05:30	\N
276767d8-e230-480f-9f13-fc5f222d2d73	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyMzcwNjcxLCJleHAiOjE3NzI5NzU0NzF9.dlNMFv_jA3iIVDsTOELrAmAv1L4QSqgZ9Yk0dV1UhlE	\N	\N	\N	::1	node	f	2026-03-01 18:41:11.322189+05:30	2026-03-01 18:41:11.322189+05:30	2026-03-08 18:41:11.322189+05:30	\N
258da16f-e7e3-4070-bb9b-ed00c7f58101	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyMzcwNzU3LCJleHAiOjE3NzI5NzU1NTd9.5usDtEdqZ2Vl0wD788FmvLfo4lDz8bc3nFjZ5XlYgVM	\N	\N	\N	::1	node	f	2026-03-01 18:42:37.233977+05:30	2026-03-01 18:42:37.233977+05:30	2026-03-08 18:42:37.233977+05:30	\N
7401acf0-6b28-4fcd-be47-8baf62b3bd36	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyMzcxNzI2LCJleHAiOjE3NzI5NzY1MjZ9.uvNg6PpqKtba1T5c24h3ikymBbR0qY7KFLsIzC3ntGk	\N	\N	\N	::1	curl/8.15.0	f	2026-03-01 18:58:46.980494+05:30	2026-03-01 18:58:46.980494+05:30	2026-03-08 18:58:46.980494+05:30	\N
f349752a-3e6e-4d70-8285-f304b5e6e1d3	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyMzcxNzYyLCJleHAiOjE3NzI5NzY1NjJ9.wU1AUVEmjBNIfJiTjkSBn1cDvCdLlmsrue_1WUTjF-4	\N	\N	\N	::1	curl/8.15.0	f	2026-03-01 18:59:22.99095+05:30	2026-03-01 18:59:22.99095+05:30	2026-03-08 18:59:22.99095+05:30	\N
2ddb7305-e420-470b-9e03-a18f3db5a999	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyMzcxNzg5LCJleHAiOjE3NzI5NzY1ODl9.VtnM6MFulD_13X5Zvd9qZEdPzuRfl5uZJT9b1ip736I	\N	\N	\N	::1	curl/8.15.0	f	2026-03-01 18:59:49.119756+05:30	2026-03-01 18:59:49.119756+05:30	2026-03-08 18:59:49.119756+05:30	\N
8af23ea9-3e64-43e5-8580-853d41588216	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyMzYxMTk3LCJleHAiOjE3NzI5NjU5OTd9._3qO-ghDkN-eyaNQdMZLeOm_T0plY4EVlPT5damY0OA	\N	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	f	2026-03-03 00:31:13.721219+05:30	2026-03-01 16:03:17.326954+05:30	2026-03-08 16:03:17.326954+05:30	\N
c74c3b5d-57f1-4bc6-a3f8-f534a579ee8d	ad53579f-780f-4c6a-9d7d-5b065efba5f8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZDUzNTc5Zi03ODBmLTRjNmEtOWQ3ZC01YjA2NWVmYmE1ZjgiLCJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGNyb21hLmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiMzE0YzViYjktMmE5ZC00ZGEzLTg4OWYtMTJiYzFhZjk4YzhlIiwiaWF0IjoxNzcyNDgwMzE2LCJleHAiOjE3NzMwODUxMTZ9.q6UGafNRSjhDEUpFcMI_Nr6fR9GNzSf16Wxm4KyM774	\N	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	f	2026-03-03 01:08:36.380785+05:30	2026-03-03 01:08:36.380785+05:30	2026-03-10 01:08:36.380785+05:30	\N
\.


--
-- TOC entry 5536 (class 0 OID 22092)
-- Dependencies: 223
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_settings (id, user_id, notification_preferences, ui_preferences, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5534 (class 0 OID 22044)
-- Dependencies: 221
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, name, role, organization_id, avatar, phone, is_active, email_verified, last_login, failed_login_attempts, locked_until, created_at, updated_at, pending_email, email_change_token, email_change_expires, token_version) FROM stdin;
ad53579f-780f-4c6a-9d7d-5b065efba5f8	admin@croma.com	$2b$10$1v/Pnr.31KuoiN9lXMXjX.KetAs9AL.scMZZb4UevhZk714wIMTce	Jeel Admin	admin	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	\N	9876543210	t	f	2026-03-03 01:52:31.690941+05:30	0	\N	2026-02-22 15:27:27.602374+05:30	2026-03-03 01:52:31.690941+05:30	\N	\N	\N	1
0f6f9229-9384-4a25-81d8-f2e8b61530fd	manav@croma.com	$2b$10$1v/Pnr.31KuoiN9lXMXjX.KetAs9AL.scMZZb4UevhZk714wIMTce	Manav	operations_manager	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	\N	\N	t	f	\N	0	\N	2026-02-28 11:49:54.376201+05:30	2026-02-28 20:01:40.630892+05:30	\N	\N	\N	0
7279923c-315d-4168-ba92-00e1b439bdd6	superadmin@twinchain.com	$2b$10$1v/Pnr.31KuoiN9lXMXjX.KetAs9AL.scMZZb4UevhZk714wIMTce	Super Admin	superadmin	\N	\N	\N	t	f	2026-02-22 16:25:03.462103+05:30	0	\N	2026-02-22 15:10:59.61103+05:30	2026-02-28 20:01:40.630892+05:30	\N	\N	\N	0
\.


--
-- TOC entry 5539 (class 0 OID 22154)
-- Dependencies: 226
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouses (id, organization_id, code, name, address, coordinates, capacity, current_utilization, contact_email, contact_phone, is_active, warehouse_type, created_at, updated_at, zones, operating_hours, gstin, has_cold_storage, temperature_min_celsius, temperature_max_celsius, customs_bonded_warehouse, certifications) FROM stdin;
e0c046e4-ae5f-449b-ab10-1c220e6fb6db	314c5bb9-2a9d-4da3-889f-12bc1af98c8e	WH-26-001	Anand Warehouse	{"city": "Anand", "state": "Gujarat", "street": "MG Road", "country": "India", "postal_code": "300001"}	{"lat": 22.5586555, "lng": 72.9627227}	50000	0.10	jeel@gmail.com	9876543210	t	standard	2026-03-01 20:05:53.171738+05:30	2026-03-02 18:38:00.18224+05:30	0	\N	27AAAAA1234A1Z5	f	\N	\N	f	{"ISO 3661"}
\.


--
-- TOC entry 5576 (class 0 OID 23429)
-- Dependencies: 267
-- Data for Name: webhook_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.webhook_logs (id, carrier_id, endpoint, method, request_signature, request_timestamp, signature_valid, ip_address, user_agent, payload, headers, response_status, response_body, error_message, processing_time_ms, created_at) FROM stdin;
fd3204b8-6d2d-4276-8ae1-a6603b38ca14	3d2cffcd-5e43-48ca-9c6e-9427afab1070	/assignments/31291056-f180-4074-9ca9-3d09826ddc0d/reject	POST	sha256=dbdf74b28d7026b4411976f859149da51dab252e19e909e52108da851c13d698	1772455263	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"reason": "weight_exceeded", "message": "Shipment weight exceeds our capacity limits"}	{"content-type": "application/json", "x-carrier-id": "3d2cffcd-5e43-48ca-9c6e-9427afab1070"}	200	\N	\N	2	2026-03-02 18:11:03.229057+05:30
de0bc330-1d4d-4d64-ac19-e175ea550b52	a0c33fcb-0cb7-45d0-ba2a-22f777612b64	/assignments/ce3b1b5c-f743-421f-b36f-2d2f44fc9de6/accept	POST	sha256=11b9cf8a7a022e0f8a8e0392496aafe4234b4248ae356b502dec6efab2a99b91	1772455287	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"price": 7283, "driver": {"name": "Driver", "phone": "+91-9876543210", "vehicleType": "Van", "vehicleNumber": "MH-01-AB-1234"}, "currency": "INR", "quotedPrice": 7283, "serviceLevel": "standard", "additionalInfo": "Service Type: standard, Quoted Price: ₹7283", "trackingNumber": "ECOM-TRACK-1772455287193", "carrierReferenceId": "ECOM-1772455287193", "estimatedPickupTime": "2026-03-02T14:41:27.193Z", "estimatedDeliveryTime": "2026-03-04T12:41:27.193Z"}	{"content-type": "application/json", "x-carrier-id": "a0c33fcb-0cb7-45d0-ba2a-22f777612b64"}	200	\N	\N	2	2026-03-02 18:11:27.203175+05:30
79900e34-ce7f-4aa4-b626-07aafb407ffc	a0c33fcb-0cb7-45d0-ba2a-22f777612b64	/shipments/66e3ec0b-13eb-4949-a4d6-a270ffbf89c6/confirm-pickup	POST	sha256=e0f58e1da5600f42a9d24e74d5667e009b717125d19b92c8761e4fe22f8f479e	1772455296	t	::ffff:127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0	{"notes": "Package picked up by Ecom Express", "carrierId": "a0c33fcb-0cb7-45d0-ba2a-22f777612b64", "driverName": "Ecom Express Driver", "gpsLocation": {"lat": 19.110997169617974, "lon": 72.85533845891764, "city": "Mumbai", "state": "Maharashtra"}, "vehicleNumber": "MH-01-AB-7888", "pickupTimestamp": "2026-03-02T12:41:36.631Z"}	{"content-type": "application/json", "x-carrier-id": "a0c33fcb-0cb7-45d0-ba2a-22f777612b64"}	200	\N	\N	1	2026-03-02 18:11:36.643051+05:30
\.


--
-- TOC entry 5582 (class 0 OID 23603)
-- Dependencies: 275
-- Data for Name: zone_distances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zone_distances (id, from_zone, to_zone, distance_km, transit_days) FROM stdin;
\.


--
-- TOC entry 5686 (class 0 OID 0)
-- Dependencies: 277
-- Name: order_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_number_seq', 10064, true);


--
-- TOC entry 5687 (class 0 OID 0)
-- Dependencies: 272
-- Name: postal_zones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.postal_zones_id_seq', 1, false);


--
-- TOC entry 5688 (class 0 OID 0)
-- Dependencies: 278
-- Name: transfer_order_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transfer_order_number_seq', 10000, false);


--
-- TOC entry 5689 (class 0 OID 0)
-- Dependencies: 279
-- Name: transfer_shipment_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transfer_shipment_number_seq', 10000, false);


--
-- TOC entry 5690 (class 0 OID 0)
-- Dependencies: 270
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_notification_preferences_id_seq', 1, false);


--
-- TOC entry 5691 (class 0 OID 0)
-- Dependencies: 282
-- Name: wh_code_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wh_code_seq', 1, true);


--
-- TOC entry 5692 (class 0 OID 0)
-- Dependencies: 274
-- Name: zone_distances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zone_distances_id_seq', 1, false);


--
-- TOC entry 5194 (class 2606 OID 23099)
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 5199 (class 2606 OID 23122)
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 5108 (class 2606 OID 22685)
-- Name: allocation_history allocation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5104 (class 2606 OID 22667)
-- Name: allocation_rules allocation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_rules
    ADD CONSTRAINT allocation_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 4951 (class 2606 OID 22143)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5172 (class 2606 OID 23012)
-- Name: background_jobs background_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_pkey PRIMARY KEY (id);


--
-- TOC entry 5043 (class 2606 OID 22449)
-- Name: carrier_assignments carrier_assignments_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_idempotency_key_key UNIQUE (idempotency_key);


--
-- TOC entry 5045 (class 2606 OID 22447)
-- Name: carrier_assignments carrier_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 5091 (class 2606 OID 22605)
-- Name: carrier_capacity_log carrier_capacity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_capacity_log
    ADD CONSTRAINT carrier_capacity_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5098 (class 2606 OID 22643)
-- Name: carrier_performance_metrics carrier_performance_metrics_carrier_id_organization_id_peri_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_carrier_id_organization_id_peri_key UNIQUE (carrier_id, organization_id, period_start, period_type);


--
-- TOC entry 5100 (class 2606 OID 22641)
-- Name: carrier_performance_metrics carrier_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_pkey PRIMARY KEY (id);


--
-- TOC entry 5079 (class 2606 OID 22559)
-- Name: carrier_quotes carrier_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_pkey PRIMARY KEY (id);


--
-- TOC entry 5084 (class 2606 OID 22581)
-- Name: carrier_rejections carrier_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_pkey PRIMARY KEY (id);


--
-- TOC entry 4966 (class 2606 OID 22204)
-- Name: carriers carriers_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_organization_id_code_key UNIQUE (organization_id, code);


--
-- TOC entry 4968 (class 2606 OID 22202)
-- Name: carriers carriers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_pkey PRIMARY KEY (id);


--
-- TOC entry 5185 (class 2606 OID 23058)
-- Name: cron_schedules cron_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cron_schedules
    ADD CONSTRAINT cron_schedules_pkey PRIMARY KEY (id);


--
-- TOC entry 5189 (class 2606 OID 23078)
-- Name: dead_letter_queue dead_letter_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dead_letter_queue
    ADD CONSTRAINT dead_letter_queue_pkey PRIMARY KEY (id);


--
-- TOC entry 5155 (class 2606 OID 22927)
-- Name: eta_predictions eta_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eta_predictions
    ADD CONSTRAINT eta_predictions_pkey PRIMARY KEY (id);


--
-- TOC entry 5137 (class 2606 OID 22849)
-- Name: exceptions exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_pkey PRIMARY KEY (id);


--
-- TOC entry 5008 (class 2606 OID 22293)
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 5170 (class 2606 OID 22976)
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5164 (class 2606 OID 22954)
-- Name: invoices invoices_organization_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_invoice_number_key UNIQUE (organization_id, invoice_number);


--
-- TOC entry 5166 (class 2606 OID 22952)
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- TOC entry 5183 (class 2606 OID 23035)
-- Name: job_execution_logs job_execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_execution_logs
    ADD CONSTRAINT job_execution_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5208 (class 2606 OID 23157)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 5037 (class 2606 OID 22389)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5041 (class 2606 OID 22414)
-- Name: order_splits order_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_pkey PRIMARY KEY (id);


--
-- TOC entry 5029 (class 2606 OID 22363)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 4921 (class 2606 OID 22043)
-- Name: organizations organizations_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_code_key UNIQUE (code);


--
-- TOC entry 4923 (class 2606 OID 22041)
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- TOC entry 4925 (class 2606 OID 23496)
-- Name: organizations organizations_webhook_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_webhook_token_key UNIQUE (webhook_token);


--
-- TOC entry 5122 (class 2606 OID 22745)
-- Name: pick_list_items pick_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5116 (class 2606 OID 22717)
-- Name: pick_lists pick_lists_pick_list_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_pick_list_number_key UNIQUE (pick_list_number);


--
-- TOC entry 5118 (class 2606 OID 22715)
-- Name: pick_lists pick_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_pkey PRIMARY KEY (id);


--
-- TOC entry 5221 (class 2606 OID 23600)
-- Name: postal_zones postal_zones_pincode_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.postal_zones
    ADD CONSTRAINT postal_zones_pincode_key UNIQUE (pincode);


--
-- TOC entry 5223 (class 2606 OID 23598)
-- Name: postal_zones postal_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.postal_zones
    ADD CONSTRAINT postal_zones_pkey PRIMARY KEY (id);


--
-- TOC entry 4990 (class 2606 OID 23767)
-- Name: products products_internal_barcode_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_internal_barcode_unique UNIQUE (internal_barcode);


--
-- TOC entry 4992 (class 2606 OID 22250)
-- Name: products products_organization_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_sku_key UNIQUE (organization_id, sku);


--
-- TOC entry 4994 (class 2606 OID 22248)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 5096 (class 2606 OID 22620)
-- Name: quote_idempotency_cache quote_idempotency_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_idempotency_cache
    ADD CONSTRAINT quote_idempotency_cache_pkey PRIMARY KEY (idempotency_key);


--
-- TOC entry 4977 (class 2606 OID 22225)
-- Name: rate_cards rate_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_pkey PRIMARY KEY (id);


--
-- TOC entry 5135 (class 2606 OID 22813)
-- Name: return_items return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5131 (class 2606 OID 22780)
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- TOC entry 5231 (class 2606 OID 23627)
-- Name: revoked_tokens revoked_tokens_jti_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revoked_tokens
    ADD CONSTRAINT revoked_tokens_jti_key UNIQUE (jti);


--
-- TOC entry 5233 (class 2606 OID 23625)
-- Name: revoked_tokens revoked_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revoked_tokens
    ADD CONSTRAINT revoked_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 5237 (class 2606 OID 23664)
-- Name: sales_channels sales_channels_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_organization_id_code_key UNIQUE (organization_id, code);


--
-- TOC entry 5239 (class 2606 OID 23660)
-- Name: sales_channels sales_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_pkey PRIMARY KEY (id);


--
-- TOC entry 5241 (class 2606 OID 23662)
-- Name: sales_channels sales_channels_webhook_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_webhook_token_key UNIQUE (webhook_token);


--
-- TOC entry 5073 (class 2606 OID 22521)
-- Name: shipment_events shipment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_pkey PRIMARY KEY (id);


--
-- TOC entry 5066 (class 2606 OID 22481)
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- TOC entry 5068 (class 2606 OID 22483)
-- Name: shipments shipments_tracking_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_tracking_number_key UNIQUE (tracking_number);


--
-- TOC entry 5077 (class 2606 OID 22534)
-- Name: shipping_estimates shipping_estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_pkey PRIMARY KEY (id);


--
-- TOC entry 4999 (class 2606 OID 22273)
-- Name: sla_policies sla_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_pkey PRIMARY KEY (id);


--
-- TOC entry 5153 (class 2606 OID 22889)
-- Name: sla_violations sla_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_pkey PRIMARY KEY (id);


--
-- TOC entry 5015 (class 2606 OID 22319)
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 5245 (class 2606 OID 23696)
-- Name: suppliers suppliers_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_organization_id_code_key UNIQUE (organization_id, code);


--
-- TOC entry 5247 (class 2606 OID 23694)
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- TOC entry 5216 (class 2606 OID 23568)
-- Name: user_notification_preferences user_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id);


--
-- TOC entry 5218 (class 2606 OID 23570)
-- Name: user_notification_preferences user_notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_key UNIQUE (user_id);


--
-- TOC entry 4936 (class 2606 OID 22079)
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 4938 (class 2606 OID 22081)
-- Name: user_permissions user_permissions_user_id_permission_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_permission_key UNIQUE (user_id, permission);


--
-- TOC entry 4949 (class 2606 OID 22127)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4940 (class 2606 OID 22105)
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4942 (class 2606 OID 22107)
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- TOC entry 4932 (class 2606 OID 22064)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4934 (class 2606 OID 22062)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4962 (class 2606 OID 22172)
-- Name: warehouses warehouses_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_organization_id_code_key UNIQUE (organization_id, code);


--
-- TOC entry 4964 (class 2606 OID 22170)
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- TOC entry 5213 (class 2606 OID 23440)
-- Name: webhook_logs webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5225 (class 2606 OID 23614)
-- Name: zone_distances zone_distances_from_zone_to_zone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_distances
    ADD CONSTRAINT zone_distances_from_zone_to_zone_key UNIQUE (from_zone, to_zone);


--
-- TOC entry 5227 (class 2606 OID 23612)
-- Name: zone_distances zone_distances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_distances
    ADD CONSTRAINT zone_distances_pkey PRIMARY KEY (id);


--
-- TOC entry 5195 (class 1259 OID 23299)
-- Name: idx_alert_rules_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_rules_active ON public.alert_rules USING btree (is_active);


--
-- TOC entry 5196 (class 1259 OID 23301)
-- Name: idx_alert_rules_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_rules_org ON public.alert_rules USING btree (organization_id);


--
-- TOC entry 5197 (class 1259 OID 23300)
-- Name: idx_alert_rules_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_rules_type ON public.alert_rules USING btree (rule_type);


--
-- TOC entry 5200 (class 1259 OID 23305)
-- Name: idx_alerts_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_org ON public.alerts USING btree (organization_id);


--
-- TOC entry 5201 (class 1259 OID 23303)
-- Name: idx_alerts_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_severity ON public.alerts USING btree (severity);


--
-- TOC entry 5202 (class 1259 OID 23302)
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);


--
-- TOC entry 5203 (class 1259 OID 23304)
-- Name: idx_alerts_triggered; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_triggered ON public.alerts USING btree (triggered_at);


--
-- TOC entry 5109 (class 1259 OID 23242)
-- Name: idx_allocation_history_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_history_order ON public.allocation_history USING btree (order_id);


--
-- TOC entry 5110 (class 1259 OID 23243)
-- Name: idx_allocation_history_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_history_warehouse ON public.allocation_history USING btree (warehouse_id);


--
-- TOC entry 5105 (class 1259 OID 23245)
-- Name: idx_allocation_rules_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_rules_active ON public.allocation_rules USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- TOC entry 5106 (class 1259 OID 23244)
-- Name: idx_allocation_rules_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_rules_org ON public.allocation_rules USING btree (organization_id);


--
-- TOC entry 4952 (class 1259 OID 23179)
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);


--
-- TOC entry 4953 (class 1259 OID 23178)
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- TOC entry 4954 (class 1259 OID 23177)
-- Name: idx_audit_logs_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_org ON public.audit_logs USING btree (organization_id);


--
-- TOC entry 4955 (class 1259 OID 23176)
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- TOC entry 5046 (class 1259 OID 23207)
-- Name: idx_carrier_assignments_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_carrier ON public.carrier_assignments USING btree (carrier_id);


--
-- TOC entry 5047 (class 1259 OID 23209)
-- Name: idx_carrier_assignments_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_expires ON public.carrier_assignments USING btree (expires_at) WHERE ((status)::text = 'pending'::text);


--
-- TOC entry 5048 (class 1259 OID 23206)
-- Name: idx_carrier_assignments_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_order ON public.carrier_assignments USING btree (order_id);


--
-- TOC entry 5049 (class 1259 OID 23208)
-- Name: idx_carrier_assignments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_status ON public.carrier_assignments USING btree (status);


--
-- TOC entry 5092 (class 1259 OID 23232)
-- Name: idx_carrier_capacity_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_capacity_carrier ON public.carrier_capacity_log USING btree (carrier_id);


--
-- TOC entry 5093 (class 1259 OID 23233)
-- Name: idx_carrier_capacity_logged; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_capacity_logged ON public.carrier_capacity_log USING btree (logged_at);


--
-- TOC entry 5101 (class 1259 OID 23234)
-- Name: idx_carrier_perf_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_perf_carrier ON public.carrier_performance_metrics USING btree (carrier_id);


--
-- TOC entry 5102 (class 1259 OID 23235)
-- Name: idx_carrier_perf_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_perf_period ON public.carrier_performance_metrics USING btree (period_start, period_type);


--
-- TOC entry 5080 (class 1259 OID 23223)
-- Name: idx_carrier_quotes_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_quotes_carrier ON public.carrier_quotes USING btree (carrier_id);


--
-- TOC entry 5081 (class 1259 OID 23222)
-- Name: idx_carrier_quotes_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_quotes_order ON public.carrier_quotes USING btree (order_id);


--
-- TOC entry 5082 (class 1259 OID 23224)
-- Name: idx_carrier_quotes_selected; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_quotes_selected ON public.carrier_quotes USING btree (order_id) WHERE (was_selected = true);


--
-- TOC entry 5085 (class 1259 OID 23227)
-- Name: idx_carrier_rejections_assignment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_assignment ON public.carrier_rejections USING btree (carrier_assignment_id) WHERE (carrier_assignment_id IS NOT NULL);


--
-- TOC entry 5086 (class 1259 OID 23225)
-- Name: idx_carrier_rejections_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_carrier ON public.carrier_rejections USING btree (carrier_id);


--
-- TOC entry 5087 (class 1259 OID 23228)
-- Name: idx_carrier_rejections_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_date ON public.carrier_rejections USING btree (rejected_at);


--
-- TOC entry 5088 (class 1259 OID 23580)
-- Name: idx_carrier_rejections_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_order_id ON public.carrier_rejections USING btree (order_id);


--
-- TOC entry 5089 (class 1259 OID 23226)
-- Name: idx_carrier_rejections_reason; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_reason ON public.carrier_rejections USING btree (reason);


--
-- TOC entry 4969 (class 1259 OID 23184)
-- Name: idx_carriers_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carriers_active ON public.carriers USING btree (is_active);


--
-- TOC entry 4970 (class 1259 OID 23183)
-- Name: idx_carriers_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carriers_code ON public.carriers USING btree (code);


--
-- TOC entry 4971 (class 1259 OID 23182)
-- Name: idx_carriers_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carriers_org ON public.carriers USING btree (organization_id);


--
-- TOC entry 4972 (class 1259 OID 23185)
-- Name: idx_carriers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carriers_status ON public.carriers USING btree (availability_status);


--
-- TOC entry 5186 (class 1259 OID 23294)
-- Name: idx_cron_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cron_active ON public.cron_schedules USING btree (is_active, next_run_at);


--
-- TOC entry 5187 (class 1259 OID 23295)
-- Name: idx_cron_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cron_org ON public.cron_schedules USING btree (organization_id);


--
-- TOC entry 5190 (class 1259 OID 23297)
-- Name: idx_dlq_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dlq_created ON public.dead_letter_queue USING btree (moved_to_dlq_at);


--
-- TOC entry 5191 (class 1259 OID 23296)
-- Name: idx_dlq_job_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dlq_job_type ON public.dead_letter_queue USING btree (job_type);


--
-- TOC entry 5192 (class 1259 OID 23298)
-- Name: idx_dlq_unprocessed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dlq_unprocessed ON public.dead_letter_queue USING btree (reprocessed) WHERE (reprocessed = false);


--
-- TOC entry 5156 (class 1259 OID 23275)
-- Name: idx_eta_predictions_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eta_predictions_created ON public.eta_predictions USING btree (created_at);


--
-- TOC entry 5157 (class 1259 OID 23274)
-- Name: idx_eta_predictions_shipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eta_predictions_shipment ON public.eta_predictions USING btree (shipment_id);


--
-- TOC entry 5138 (class 1259 OID 23266)
-- Name: idx_exceptions_assigned; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_assigned ON public.exceptions USING btree (assigned_to);


--
-- TOC entry 5139 (class 1259 OID 23267)
-- Name: idx_exceptions_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_open ON public.exceptions USING btree (organization_id) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'investigating'::character varying])::text[]));


--
-- TOC entry 5140 (class 1259 OID 23262)
-- Name: idx_exceptions_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_order ON public.exceptions USING btree (order_id);


--
-- TOC entry 5141 (class 1259 OID 23260)
-- Name: idx_exceptions_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_org ON public.exceptions USING btree (organization_id);


--
-- TOC entry 5142 (class 1259 OID 23265)
-- Name: idx_exceptions_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_severity ON public.exceptions USING btree (severity);


--
-- TOC entry 5143 (class 1259 OID 23261)
-- Name: idx_exceptions_shipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_shipment ON public.exceptions USING btree (shipment_id);


--
-- TOC entry 5144 (class 1259 OID 23264)
-- Name: idx_exceptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_status ON public.exceptions USING btree (status);


--
-- TOC entry 5145 (class 1259 OID 23263)
-- Name: idx_exceptions_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_type ON public.exceptions USING btree (exception_type);


--
-- TOC entry 5000 (class 1259 OID 23194)
-- Name: idx_inventory_low_stock; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_low_stock ON public.inventory USING btree (warehouse_id) WHERE (available_quantity <= COALESCE(reorder_point, 10));


--
-- TOC entry 5001 (class 1259 OID 23485)
-- Name: idx_inventory_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_organization_id ON public.inventory USING btree (organization_id);


--
-- TOC entry 5002 (class 1259 OID 23193)
-- Name: idx_inventory_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_product ON public.inventory USING btree (product_id);


--
-- TOC entry 5003 (class 1259 OID 23192)
-- Name: idx_inventory_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_warehouse ON public.inventory USING btree (warehouse_id);


--
-- TOC entry 5004 (class 1259 OID 22305)
-- Name: idx_inventory_warehouse_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_inventory_warehouse_product ON public.inventory USING btree (warehouse_id, product_id) WHERE (product_id IS NOT NULL);


--
-- TOC entry 5005 (class 1259 OID 22304)
-- Name: idx_inventory_warehouse_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_inventory_warehouse_sku ON public.inventory USING btree (warehouse_id, sku) WHERE (sku IS NOT NULL);


--
-- TOC entry 5006 (class 1259 OID 23471)
-- Name: idx_inventory_warehouse_stats; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_warehouse_stats ON public.inventory USING btree (warehouse_id, quantity, available_quantity, reserved_quantity);


--
-- TOC entry 5167 (class 1259 OID 23284)
-- Name: idx_invoice_line_items_invoice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_line_items_invoice ON public.invoice_line_items USING btree (invoice_id);


--
-- TOC entry 5168 (class 1259 OID 23285)
-- Name: idx_invoice_line_items_shipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_line_items_shipment ON public.invoice_line_items USING btree (shipment_id) WHERE (shipment_id IS NOT NULL);


--
-- TOC entry 5158 (class 1259 OID 23280)
-- Name: idx_invoices_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_carrier ON public.invoices USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);


--
-- TOC entry 5159 (class 1259 OID 23282)
-- Name: idx_invoices_due; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_due ON public.invoices USING btree (due_date) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'overdue'::character varying])::text[]));


--
-- TOC entry 5160 (class 1259 OID 23279)
-- Name: idx_invoices_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_org ON public.invoices USING btree (organization_id);


--
-- TOC entry 5161 (class 1259 OID 23283)
-- Name: idx_invoices_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_period ON public.invoices USING btree (billing_period_start, billing_period_end);


--
-- TOC entry 5162 (class 1259 OID 23281)
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- TOC entry 5180 (class 1259 OID 23292)
-- Name: idx_job_execution_logs_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_execution_logs_job ON public.job_execution_logs USING btree (job_id);


--
-- TOC entry 5181 (class 1259 OID 23293)
-- Name: idx_job_execution_logs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_execution_logs_status ON public.job_execution_logs USING btree (status);


--
-- TOC entry 5173 (class 1259 OID 23291)
-- Name: idx_jobs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_created ON public.background_jobs USING btree (created_at);


--
-- TOC entry 5174 (class 1259 OID 23707)
-- Name: idx_jobs_idempotency; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_jobs_idempotency ON public.background_jobs USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- TOC entry 5175 (class 1259 OID 23290)
-- Name: idx_jobs_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_org ON public.background_jobs USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- TOC entry 5176 (class 1259 OID 23289)
-- Name: idx_jobs_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_priority ON public.background_jobs USING btree (priority, scheduled_for) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying])::text[]));


--
-- TOC entry 5177 (class 1259 OID 23288)
-- Name: idx_jobs_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_scheduled ON public.background_jobs USING btree (scheduled_for) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying])::text[]));


--
-- TOC entry 5178 (class 1259 OID 23286)
-- Name: idx_jobs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_status ON public.background_jobs USING btree (status);


--
-- TOC entry 5179 (class 1259 OID 23287)
-- Name: idx_jobs_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_type ON public.background_jobs USING btree (job_type);


--
-- TOC entry 5204 (class 1259 OID 23308)
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at);


--
-- TOC entry 5205 (class 1259 OID 23307)
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);


--
-- TOC entry 5206 (class 1259 OID 23306)
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- TOC entry 5030 (class 1259 OID 23365)
-- Name: idx_order_items_fragile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_fragile ON public.order_items USING btree (is_fragile) WHERE (is_fragile = true);


--
-- TOC entry 5031 (class 1259 OID 23366)
-- Name: idx_order_items_hazardous; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_hazardous ON public.order_items USING btree (is_hazardous) WHERE (is_hazardous = true);


--
-- TOC entry 5032 (class 1259 OID 23203)
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- TOC entry 5033 (class 1259 OID 23367)
-- Name: idx_order_items_perishable; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_perishable ON public.order_items USING btree (is_perishable) WHERE (is_perishable = true);


--
-- TOC entry 5034 (class 1259 OID 23204)
-- Name: idx_order_items_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_product ON public.order_items USING btree (product_id);


--
-- TOC entry 5035 (class 1259 OID 23205)
-- Name: idx_order_items_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_sku ON public.order_items USING btree (sku);


--
-- TOC entry 5038 (class 1259 OID 23247)
-- Name: idx_order_splits_child; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_splits_child ON public.order_splits USING btree (child_order_id);


--
-- TOC entry 5039 (class 1259 OID 23246)
-- Name: idx_order_splits_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_splits_parent ON public.order_splits USING btree (parent_order_id);


--
-- TOC entry 5016 (class 1259 OID 23352)
-- Name: idx_orders_carrier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_carrier_id ON public.orders USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);


--
-- TOC entry 5017 (class 1259 OID 23200)
-- Name: idx_orders_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_created ON public.orders USING btree (created_at);


--
-- TOC entry 5018 (class 1259 OID 23201)
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_email);


--
-- TOC entry 5019 (class 1259 OID 23197)
-- Name: idx_orders_external; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_external ON public.orders USING btree (external_order_id) WHERE (external_order_id IS NOT NULL);


--
-- TOC entry 5020 (class 1259 OID 23196)
-- Name: idx_orders_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_number ON public.orders USING btree (order_number);


--
-- TOC entry 5021 (class 1259 OID 23353)
-- Name: idx_orders_on_hold; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_on_hold ON public.orders USING btree (status) WHERE ((status)::text = 'on_hold'::text);


--
-- TOC entry 5022 (class 1259 OID 23403)
-- Name: idx_orders_order_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_order_type ON public.orders USING btree (order_type);


--
-- TOC entry 5023 (class 1259 OID 23195)
-- Name: idx_orders_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_org ON public.orders USING btree (organization_id);


--
-- TOC entry 5024 (class 1259 OID 23790)
-- Name: idx_orders_shipping_locked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_shipping_locked ON public.orders USING btree (shipping_locked_at) WHERE (shipping_locked = true);


--
-- TOC entry 5025 (class 1259 OID 23198)
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- TOC entry 5026 (class 1259 OID 23199)
-- Name: idx_orders_status_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status_org ON public.orders USING btree (organization_id, status);


--
-- TOC entry 5027 (class 1259 OID 23402)
-- Name: idx_orders_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_supplier_id ON public.orders USING btree (supplier_id) WHERE (supplier_id IS NOT NULL);


--
-- TOC entry 4918 (class 1259 OID 23168)
-- Name: idx_organizations_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizations_active ON public.organizations USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 4919 (class 1259 OID 23497)
-- Name: idx_organizations_webhook_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizations_webhook_token ON public.organizations USING btree (webhook_token);


--
-- TOC entry 5119 (class 1259 OID 23240)
-- Name: idx_pick_list_items_list; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_list_items_list ON public.pick_list_items USING btree (pick_list_id);


--
-- TOC entry 5120 (class 1259 OID 23241)
-- Name: idx_pick_list_items_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_list_items_status ON public.pick_list_items USING btree (pick_list_id, status);


--
-- TOC entry 5111 (class 1259 OID 23238)
-- Name: idx_pick_lists_assigned; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_lists_assigned ON public.pick_lists USING btree (assigned_to) WHERE (assigned_to IS NOT NULL);


--
-- TOC entry 5112 (class 1259 OID 23239)
-- Name: idx_pick_lists_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_lists_org ON public.pick_lists USING btree (organization_id);


--
-- TOC entry 5113 (class 1259 OID 23237)
-- Name: idx_pick_lists_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_lists_status ON public.pick_lists USING btree (status);


--
-- TOC entry 5114 (class 1259 OID 23236)
-- Name: idx_pick_lists_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_lists_warehouse ON public.pick_lists USING btree (warehouse_id);


--
-- TOC entry 5219 (class 1259 OID 23601)
-- Name: idx_postal_zones_zone_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_postal_zones_zone_code ON public.postal_zones USING btree (zone_code);


--
-- TOC entry 4978 (class 1259 OID 23188)
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_active ON public.products USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 4979 (class 1259 OID 23756)
-- Name: idx_products_brand; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_brand ON public.products USING btree (organization_id, brand) WHERE (brand IS NOT NULL);


--
-- TOC entry 4980 (class 1259 OID 23187)
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category ON public.products USING btree (organization_id, category) WHERE (category IS NOT NULL);


--
-- TOC entry 4981 (class 1259 OID 23382)
-- Name: idx_products_fragile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_fragile ON public.products USING btree (is_fragile) WHERE (is_fragile = true);


--
-- TOC entry 4982 (class 1259 OID 23757)
-- Name: idx_products_hsn; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_hsn ON public.products USING btree (hsn_code) WHERE (hsn_code IS NOT NULL);


--
-- TOC entry 4983 (class 1259 OID 23768)
-- Name: idx_products_manufacturer_barcode_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_products_manufacturer_barcode_org ON public.products USING btree (organization_id, manufacturer_barcode) WHERE (manufacturer_barcode IS NOT NULL);


--
-- TOC entry 4984 (class 1259 OID 23186)
-- Name: idx_products_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_org ON public.products USING btree (organization_id);


--
-- TOC entry 4985 (class 1259 OID 23484)
-- Name: idx_products_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_organization_id ON public.products USING btree (organization_id);


--
-- TOC entry 4986 (class 1259 OID 23384)
-- Name: idx_products_perishable; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_perishable ON public.products USING btree (is_perishable) WHERE (is_perishable = true);


--
-- TOC entry 4987 (class 1259 OID 23758)
-- Name: idx_products_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_supplier ON public.products USING btree (supplier_id) WHERE (supplier_id IS NOT NULL);


--
-- TOC entry 4988 (class 1259 OID 23759)
-- Name: idx_products_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_tags ON public.products USING gin (tags);


--
-- TOC entry 5094 (class 1259 OID 23229)
-- Name: idx_quote_cache_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_cache_expires ON public.quote_idempotency_cache USING btree (expires_at);


--
-- TOC entry 4973 (class 1259 OID 23190)
-- Name: idx_rate_cards_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_cards_active ON public.rate_cards USING btree (carrier_id, is_active) WHERE (is_active = true);


--
-- TOC entry 4974 (class 1259 OID 23189)
-- Name: idx_rate_cards_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_cards_carrier ON public.rate_cards USING btree (carrier_id);


--
-- TOC entry 4975 (class 1259 OID 23191)
-- Name: idx_rate_cards_route; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_cards_route ON public.rate_cards USING btree (origin_state, destination_state) WHERE (is_active = true);


--
-- TOC entry 5132 (class 1259 OID 23259)
-- Name: idx_return_items_order_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_items_order_item ON public.return_items USING btree (order_item_id) WHERE (order_item_id IS NOT NULL);


--
-- TOC entry 5133 (class 1259 OID 23258)
-- Name: idx_return_items_return; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_items_return ON public.return_items USING btree (return_id);


--
-- TOC entry 5123 (class 1259 OID 23257)
-- Name: idx_returns_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_created ON public.returns USING btree (created_at);


--
-- TOC entry 5124 (class 1259 OID 23254)
-- Name: idx_returns_external; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_external ON public.returns USING btree (external_return_id) WHERE (external_return_id IS NOT NULL);


--
-- TOC entry 5125 (class 1259 OID 23255)
-- Name: idx_returns_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_order ON public.returns USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- TOC entry 5126 (class 1259 OID 23253)
-- Name: idx_returns_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_org ON public.returns USING btree (organization_id);


--
-- TOC entry 5127 (class 1259 OID 23488)
-- Name: idx_returns_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_organization_id ON public.returns USING btree (organization_id);


--
-- TOC entry 5128 (class 1259 OID 22801)
-- Name: idx_returns_rma_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_returns_rma_number ON public.returns USING btree (organization_id, rma_number) WHERE (rma_number IS NOT NULL);


--
-- TOC entry 5129 (class 1259 OID 23256)
-- Name: idx_returns_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_status ON public.returns USING btree (status);


--
-- TOC entry 5228 (class 1259 OID 23634)
-- Name: idx_revoked_tokens_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_revoked_tokens_expires ON public.revoked_tokens USING btree (expires_at);


--
-- TOC entry 5229 (class 1259 OID 23633)
-- Name: idx_revoked_tokens_jti; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_revoked_tokens_jti ON public.revoked_tokens USING btree (jti);


--
-- TOC entry 5234 (class 1259 OID 23704)
-- Name: idx_sales_channels_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_channels_active ON public.sales_channels USING btree (organization_id, is_active);


--
-- TOC entry 5235 (class 1259 OID 23703)
-- Name: idx_sales_channels_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_channels_org ON public.sales_channels USING btree (organization_id);


--
-- TOC entry 5069 (class 1259 OID 23219)
-- Name: idx_shipment_events_shipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipment_events_shipment ON public.shipment_events USING btree (shipment_id);


--
-- TOC entry 5070 (class 1259 OID 23221)
-- Name: idx_shipment_events_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipment_events_timestamp ON public.shipment_events USING btree (event_timestamp);


--
-- TOC entry 5071 (class 1259 OID 23220)
-- Name: idx_shipment_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipment_events_type ON public.shipment_events USING btree (event_type);


--
-- TOC entry 5050 (class 1259 OID 23213)
-- Name: idx_shipments_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_carrier ON public.shipments USING btree (carrier_id);


--
-- TOC entry 5051 (class 1259 OID 23211)
-- Name: idx_shipments_carrier_tracking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_carrier_tracking ON public.shipments USING btree (carrier_tracking_number) WHERE (carrier_tracking_number IS NOT NULL);


--
-- TOC entry 5052 (class 1259 OID 23218)
-- Name: idx_shipments_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_created ON public.shipments USING btree (created_at);


--
-- TOC entry 5053 (class 1259 OID 23216)
-- Name: idx_shipments_delivery_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_delivery_scheduled ON public.shipments USING btree (delivery_scheduled) WHERE (delivery_scheduled IS NOT NULL);


--
-- TOC entry 5054 (class 1259 OID 23422)
-- Name: idx_shipments_is_hazardous; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_is_hazardous ON public.shipments USING btree (is_hazardous) WHERE (is_hazardous = true);


--
-- TOC entry 5055 (class 1259 OID 23423)
-- Name: idx_shipments_is_perishable; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_is_perishable ON public.shipments USING btree (is_perishable) WHERE (is_perishable = true);


--
-- TOC entry 5056 (class 1259 OID 23425)
-- Name: idx_shipments_item_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_item_type ON public.shipments USING btree (item_type) WHERE ((item_type)::text <> 'general'::text);


--
-- TOC entry 5057 (class 1259 OID 23212)
-- Name: idx_shipments_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_order ON public.shipments USING btree (order_id);


--
-- TOC entry 5058 (class 1259 OID 23210)
-- Name: idx_shipments_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_org ON public.shipments USING btree (organization_id);


--
-- TOC entry 5059 (class 1259 OID 23424)
-- Name: idx_shipments_requires_cold_storage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_requires_cold_storage ON public.shipments USING btree (requires_cold_storage) WHERE (requires_cold_storage = true);


--
-- TOC entry 5060 (class 1259 OID 23812)
-- Name: idx_shipments_sla_policy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_sla_policy ON public.shipments USING btree (sla_policy_id) WHERE (sla_policy_id IS NOT NULL);


--
-- TOC entry 5061 (class 1259 OID 23214)
-- Name: idx_shipments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_status ON public.shipments USING btree (status);


--
-- TOC entry 5062 (class 1259 OID 23426)
-- Name: idx_shipments_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_status_created ON public.shipments USING btree (status, created_at DESC);


--
-- TOC entry 5063 (class 1259 OID 23215)
-- Name: idx_shipments_status_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_status_org ON public.shipments USING btree (organization_id, status);


--
-- TOC entry 5064 (class 1259 OID 23217)
-- Name: idx_shipments_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_warehouse ON public.shipments USING btree (warehouse_id) WHERE (warehouse_id IS NOT NULL);


--
-- TOC entry 5074 (class 1259 OID 23231)
-- Name: idx_shipping_estimates_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipping_estimates_carrier ON public.shipping_estimates USING btree (carrier_id);


--
-- TOC entry 5075 (class 1259 OID 23230)
-- Name: idx_shipping_estimates_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipping_estimates_order ON public.shipping_estimates USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- TOC entry 4995 (class 1259 OID 23277)
-- Name: idx_sla_policies_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_policies_active ON public.sla_policies USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- TOC entry 4996 (class 1259 OID 23276)
-- Name: idx_sla_policies_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_policies_org ON public.sla_policies USING btree (organization_id);


--
-- TOC entry 4997 (class 1259 OID 23278)
-- Name: idx_sla_policies_service; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_policies_service ON public.sla_policies USING btree (service_type) WHERE (is_active = true);


--
-- TOC entry 5146 (class 1259 OID 23270)
-- Name: idx_sla_violations_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_carrier ON public.sla_violations USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);


--
-- TOC entry 5147 (class 1259 OID 23273)
-- Name: idx_sla_violations_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_open ON public.sla_violations USING btree (organization_id, status) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'acknowledged'::character varying])::text[]));


--
-- TOC entry 5148 (class 1259 OID 23268)
-- Name: idx_sla_violations_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_org ON public.sla_violations USING btree (organization_id);


--
-- TOC entry 5149 (class 1259 OID 23269)
-- Name: idx_sla_violations_shipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_shipment ON public.sla_violations USING btree (shipment_id) WHERE (shipment_id IS NOT NULL);


--
-- TOC entry 5150 (class 1259 OID 23271)
-- Name: idx_sla_violations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_status ON public.sla_violations USING btree (status);


--
-- TOC entry 5151 (class 1259 OID 23272)
-- Name: idx_sla_violations_violated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_violated ON public.sla_violations USING btree (violated_at);


--
-- TOC entry 5009 (class 1259 OID 23251)
-- Name: idx_stock_movements_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_created ON public.stock_movements USING btree (created_at);


--
-- TOC entry 5010 (class 1259 OID 23249)
-- Name: idx_stock_movements_inventory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_inventory ON public.stock_movements USING btree (inventory_id) WHERE (inventory_id IS NOT NULL);


--
-- TOC entry 5011 (class 1259 OID 23252)
-- Name: idx_stock_movements_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_reference ON public.stock_movements USING btree (reference_type, reference_id) WHERE (reference_id IS NOT NULL);


--
-- TOC entry 5012 (class 1259 OID 23250)
-- Name: idx_stock_movements_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_type ON public.stock_movements USING btree (movement_type);


--
-- TOC entry 5013 (class 1259 OID 23248)
-- Name: idx_stock_movements_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_warehouse ON public.stock_movements USING btree (warehouse_id);


--
-- TOC entry 5242 (class 1259 OID 23706)
-- Name: idx_suppliers_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suppliers_active ON public.suppliers USING btree (organization_id, is_active);


--
-- TOC entry 5243 (class 1259 OID 23705)
-- Name: idx_suppliers_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suppliers_org ON public.suppliers USING btree (organization_id);


--
-- TOC entry 5214 (class 1259 OID 23576)
-- Name: idx_user_preferences_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_preferences_user_id ON public.user_notification_preferences USING btree (user_id);


--
-- TOC entry 4943 (class 1259 OID 23173)
-- Name: idx_user_sessions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_active ON public.user_sessions USING btree (user_id, is_active);


--
-- TOC entry 4944 (class 1259 OID 23175)
-- Name: idx_user_sessions_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_expires ON public.user_sessions USING btree (expires_at);


--
-- TOC entry 4945 (class 1259 OID 23174)
-- Name: idx_user_sessions_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (session_token);


--
-- TOC entry 4946 (class 1259 OID 23172)
-- Name: idx_user_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_user ON public.user_sessions USING btree (user_id);


--
-- TOC entry 4947 (class 1259 OID 23577)
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- TOC entry 4926 (class 1259 OID 23171)
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 4927 (class 1259 OID 23815)
-- Name: idx_users_email_change_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email_change_token ON public.users USING btree (email_change_token) WHERE (email_change_token IS NOT NULL);


--
-- TOC entry 4928 (class 1259 OID 23169)
-- Name: idx_users_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_organization ON public.users USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- TOC entry 4929 (class 1259 OID 23482)
-- Name: idx_users_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_organization_id ON public.users USING btree (organization_id);


--
-- TOC entry 4930 (class 1259 OID 23170)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 4956 (class 1259 OID 23181)
-- Name: idx_warehouses_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warehouses_active ON public.warehouses USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 4957 (class 1259 OID 23786)
-- Name: idx_warehouses_bonded_customs; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warehouses_bonded_customs ON public.warehouses USING btree (customs_bonded_warehouse) WHERE (customs_bonded_warehouse = true);


--
-- TOC entry 4958 (class 1259 OID 23785)
-- Name: idx_warehouses_cold_storage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warehouses_cold_storage ON public.warehouses USING btree (has_cold_storage) WHERE (has_cold_storage = true);


--
-- TOC entry 4959 (class 1259 OID 23180)
-- Name: idx_warehouses_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warehouses_org ON public.warehouses USING btree (organization_id);


--
-- TOC entry 4960 (class 1259 OID 23483)
-- Name: idx_warehouses_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warehouses_organization_id ON public.warehouses USING btree (organization_id);


--
-- TOC entry 5209 (class 1259 OID 23446)
-- Name: idx_webhook_logs_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_logs_carrier ON public.webhook_logs USING btree (carrier_id, created_at DESC);


--
-- TOC entry 5210 (class 1259 OID 23448)
-- Name: idx_webhook_logs_endpoint; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_logs_endpoint ON public.webhook_logs USING btree (endpoint, created_at DESC);


--
-- TOC entry 5211 (class 1259 OID 23447)
-- Name: idx_webhook_logs_signature_valid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_logs_signature_valid ON public.webhook_logs USING btree (signature_valid, created_at DESC);


--
-- TOC entry 5357 (class 2620 OID 23450)
-- Name: carriers carrier_webhook_credentials_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER carrier_webhook_credentials_trigger BEFORE INSERT ON public.carriers FOR EACH ROW EXECUTE FUNCTION public.generate_webhook_credentials();


--
-- TOC entry 5378 (class 2620 OID 23675)
-- Name: sales_channels set_sales_channels_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_sales_channels_updated_at BEFORE UPDATE ON public.sales_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5379 (class 2620 OID 23702)
-- Name: suppliers set_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5362 (class 2620 OID 23551)
-- Name: inventory trg_sync_inventory_product_info; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_inventory_product_info BEFORE INSERT OR UPDATE OF product_id ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_product_info();


--
-- TOC entry 5359 (class 2620 OID 23407)
-- Name: products trigger_calculate_product_volumetric_weight; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_calculate_product_volumetric_weight BEFORE INSERT OR UPDATE OF dimensions ON public.products FOR EACH ROW EXECUTE FUNCTION public.calculate_product_volumetric_weight();


--
-- TOC entry 5365 (class 2620 OID 23405)
-- Name: order_items trigger_calculate_volumetric_weight; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_calculate_volumetric_weight BEFORE INSERT OR UPDATE OF dimensions ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.calculate_volumetric_weight();


--
-- TOC entry 5376 (class 2620 OID 23325)
-- Name: alert_rules trigger_update_alert_rules_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_alert_rules_updated_at BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5368 (class 2620 OID 23320)
-- Name: allocation_rules trigger_update_allocation_rules_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_allocation_rules_updated_at BEFORE UPDATE ON public.allocation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5374 (class 2620 OID 23327)
-- Name: background_jobs trigger_update_background_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_background_jobs_updated_at BEFORE UPDATE ON public.background_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5366 (class 2620 OID 23318)
-- Name: carrier_assignments trigger_update_carrier_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_carrier_assignments_updated_at BEFORE UPDATE ON public.carrier_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5358 (class 2620 OID 23313)
-- Name: carriers trigger_update_carriers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_carriers_updated_at BEFORE UPDATE ON public.carriers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5375 (class 2620 OID 23328)
-- Name: cron_schedules trigger_update_cron_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_cron_schedules_updated_at BEFORE UPDATE ON public.cron_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5371 (class 2620 OID 23323)
-- Name: exceptions trigger_update_exceptions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_exceptions_updated_at BEFORE UPDATE ON public.exceptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5363 (class 2620 OID 23316)
-- Name: inventory trigger_update_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5373 (class 2620 OID 23326)
-- Name: invoices trigger_update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5364 (class 2620 OID 23317)
-- Name: orders trigger_update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5353 (class 2620 OID 23309)
-- Name: organizations trigger_update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5369 (class 2620 OID 23321)
-- Name: pick_lists trigger_update_pick_lists_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_pick_lists_updated_at BEFORE UPDATE ON public.pick_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5360 (class 2620 OID 23314)
-- Name: products trigger_update_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5370 (class 2620 OID 23322)
-- Name: returns trigger_update_returns_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5367 (class 2620 OID 23319)
-- Name: shipments trigger_update_shipments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5361 (class 2620 OID 23315)
-- Name: sla_policies trigger_update_sla_policies_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_sla_policies_updated_at BEFORE UPDATE ON public.sla_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5372 (class 2620 OID 23324)
-- Name: sla_violations trigger_update_sla_violations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_sla_violations_updated_at BEFORE UPDATE ON public.sla_violations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5355 (class 2620 OID 23311)
-- Name: user_settings trigger_update_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5354 (class 2620 OID 23310)
-- Name: users trigger_update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5356 (class 2620 OID 23312)
-- Name: warehouses trigger_update_warehouses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5377 (class 2620 OID 23578)
-- Name: user_notification_preferences update_user_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_notification_preferences_updated_at BEFORE UPDATE ON public.user_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5339 (class 2606 OID 23105)
-- Name: alert_rules alert_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5340 (class 2606 OID 23100)
-- Name: alert_rules alert_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5341 (class 2606 OID 23133)
-- Name: alerts alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- TOC entry 5342 (class 2606 OID 23123)
-- Name: alerts alerts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5343 (class 2606 OID 23138)
-- Name: alerts alerts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- TOC entry 5344 (class 2606 OID 23128)
-- Name: alerts alerts_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id);


--
-- TOC entry 5301 (class 2606 OID 22686)
-- Name: allocation_history allocation_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5302 (class 2606 OID 22691)
-- Name: allocation_history allocation_history_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- TOC entry 5303 (class 2606 OID 22696)
-- Name: allocation_history allocation_history_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5300 (class 2606 OID 22668)
-- Name: allocation_rules allocation_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_rules
    ADD CONSTRAINT allocation_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5253 (class 2606 OID 22149)
-- Name: audit_logs audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5254 (class 2606 OID 22144)
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5335 (class 2606 OID 23018)
-- Name: background_jobs background_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5336 (class 2606 OID 23013)
-- Name: background_jobs background_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5279 (class 2606 OID 22460)
-- Name: carrier_assignments carrier_assignments_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5280 (class 2606 OID 22455)
-- Name: carrier_assignments carrier_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 5281 (class 2606 OID 22450)
-- Name: carrier_assignments carrier_assignments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5296 (class 2606 OID 22606)
-- Name: carrier_capacity_log carrier_capacity_log_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_capacity_log
    ADD CONSTRAINT carrier_capacity_log_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5298 (class 2606 OID 22644)
-- Name: carrier_performance_metrics carrier_performance_metrics_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5299 (class 2606 OID 22649)
-- Name: carrier_performance_metrics carrier_performance_metrics_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5291 (class 2606 OID 22565)
-- Name: carrier_quotes carrier_quotes_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5292 (class 2606 OID 22560)
-- Name: carrier_quotes carrier_quotes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5293 (class 2606 OID 22582)
-- Name: carrier_rejections carrier_rejections_carrier_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_carrier_assignment_id_fkey FOREIGN KEY (carrier_assignment_id) REFERENCES public.carrier_assignments(id);


--
-- TOC entry 5294 (class 2606 OID 22587)
-- Name: carrier_rejections carrier_rejections_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5295 (class 2606 OID 22592)
-- Name: carrier_rejections carrier_rejections_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5256 (class 2606 OID 22205)
-- Name: carriers carriers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5338 (class 2606 OID 23059)
-- Name: cron_schedules cron_schedules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cron_schedules
    ADD CONSTRAINT cron_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5329 (class 2606 OID 22928)
-- Name: eta_predictions eta_predictions_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eta_predictions
    ADD CONSTRAINT eta_predictions_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5318 (class 2606 OID 22870)
-- Name: exceptions exceptions_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 5319 (class 2606 OID 22865)
-- Name: exceptions exceptions_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5320 (class 2606 OID 22860)
-- Name: exceptions exceptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5321 (class 2606 OID 22850)
-- Name: exceptions exceptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5322 (class 2606 OID 22855)
-- Name: exceptions exceptions_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5262 (class 2606 OID 23477)
-- Name: inventory inventory_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 5263 (class 2606 OID 22299)
-- Name: inventory inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 5264 (class 2606 OID 22294)
-- Name: inventory inventory_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5332 (class 2606 OID 22977)
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- TOC entry 5333 (class 2606 OID 22987)
-- Name: invoice_line_items invoice_line_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5334 (class 2606 OID 22982)
-- Name: invoice_line_items invoice_line_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5330 (class 2606 OID 22960)
-- Name: invoices invoices_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5331 (class 2606 OID 22955)
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5337 (class 2606 OID 23036)
-- Name: job_execution_logs job_execution_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_execution_logs
    ADD CONSTRAINT job_execution_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.background_jobs(id) ON DELETE CASCADE;


--
-- TOC entry 5345 (class 2606 OID 23163)
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5346 (class 2606 OID 23158)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5273 (class 2606 OID 22390)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 5274 (class 2606 OID 22395)
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 5275 (class 2606 OID 22400)
-- Name: order_items order_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5276 (class 2606 OID 22420)
-- Name: order_splits order_splits_child_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_child_order_id_fkey FOREIGN KEY (child_order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 5277 (class 2606 OID 22415)
-- Name: order_splits order_splits_parent_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 5278 (class 2606 OID 22425)
-- Name: order_splits order_splits_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5269 (class 2606 OID 22369)
-- Name: orders orders_allocated_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_allocated_warehouse_id_fkey FOREIGN KEY (allocated_warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5270 (class 2606 OID 23347)
-- Name: orders orders_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5271 (class 2606 OID 22364)
-- Name: orders orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5272 (class 2606 OID 23396)
-- Name: orders orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.organizations(id);


--
-- TOC entry 5307 (class 2606 OID 22756)
-- Name: pick_list_items pick_list_items_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- TOC entry 5308 (class 2606 OID 22751)
-- Name: pick_list_items pick_list_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- TOC entry 5309 (class 2606 OID 22746)
-- Name: pick_list_items pick_list_items_pick_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_pick_list_id_fkey FOREIGN KEY (pick_list_id) REFERENCES public.pick_lists(id) ON DELETE CASCADE;


--
-- TOC entry 5310 (class 2606 OID 22761)
-- Name: pick_list_items pick_list_items_picked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_picked_by_fkey FOREIGN KEY (picked_by) REFERENCES public.users(id);


--
-- TOC entry 5304 (class 2606 OID 22728)
-- Name: pick_lists pick_lists_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 5305 (class 2606 OID 22718)
-- Name: pick_lists pick_lists_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5306 (class 2606 OID 22723)
-- Name: pick_lists pick_lists_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5258 (class 2606 OID 22251)
-- Name: products products_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5259 (class 2606 OID 23750)
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- TOC entry 5297 (class 2606 OID 22621)
-- Name: quote_idempotency_cache quote_idempotency_cache_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_idempotency_cache
    ADD CONSTRAINT quote_idempotency_cache_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.carrier_quotes(id);


--
-- TOC entry 5257 (class 2606 OID 22226)
-- Name: rate_cards rate_cards_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id) ON DELETE CASCADE;


--
-- TOC entry 5315 (class 2606 OID 22819)
-- Name: return_items return_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- TOC entry 5316 (class 2606 OID 22824)
-- Name: return_items return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 5317 (class 2606 OID 22814)
-- Name: return_items return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE CASCADE;


--
-- TOC entry 5311 (class 2606 OID 22786)
-- Name: returns returns_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5312 (class 2606 OID 22781)
-- Name: returns returns_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5313 (class 2606 OID 22791)
-- Name: returns returns_original_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_original_shipment_id_fkey FOREIGN KEY (original_shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5314 (class 2606 OID 22796)
-- Name: returns returns_return_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_return_shipment_id_fkey FOREIGN KEY (return_shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5349 (class 2606 OID 23628)
-- Name: revoked_tokens revoked_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revoked_tokens
    ADD CONSTRAINT revoked_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5350 (class 2606 OID 23670)
-- Name: sales_channels sales_channels_default_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5351 (class 2606 OID 23665)
-- Name: sales_channels sales_channels_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 5288 (class 2606 OID 22522)
-- Name: shipment_events shipment_events_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE;


--
-- TOC entry 5282 (class 2606 OID 22494)
-- Name: shipments shipments_carrier_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_carrier_assignment_id_fkey FOREIGN KEY (carrier_assignment_id) REFERENCES public.carrier_assignments(id);


--
-- TOC entry 5283 (class 2606 OID 22499)
-- Name: shipments shipments_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5284 (class 2606 OID 22489)
-- Name: shipments shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5285 (class 2606 OID 22484)
-- Name: shipments shipments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5286 (class 2606 OID 23807)
-- Name: shipments shipments_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.sla_policies(id) ON DELETE SET NULL;


--
-- TOC entry 5287 (class 2606 OID 22504)
-- Name: shipments shipments_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5289 (class 2606 OID 22540)
-- Name: shipping_estimates shipping_estimates_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5290 (class 2606 OID 22535)
-- Name: shipping_estimates shipping_estimates_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 5260 (class 2606 OID 23792)
-- Name: sla_policies sla_policies_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id) ON DELETE SET NULL;


--
-- TOC entry 5261 (class 2606 OID 22274)
-- Name: sla_policies sla_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5323 (class 2606 OID 22905)
-- Name: sla_violations sla_violations_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 5324 (class 2606 OID 22890)
-- Name: sla_violations sla_violations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5325 (class 2606 OID 23802)
-- Name: sla_violations sla_violations_penalty_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_penalty_approved_by_fkey FOREIGN KEY (penalty_approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5326 (class 2606 OID 22895)
-- Name: sla_violations sla_violations_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 5327 (class 2606 OID 22900)
-- Name: sla_violations sla_violations_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.sla_policies(id);


--
-- TOC entry 5328 (class 2606 OID 22910)
-- Name: sla_violations sla_violations_waived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_waived_by_fkey FOREIGN KEY (waived_by) REFERENCES public.users(id);


--
-- TOC entry 5265 (class 2606 OID 22335)
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5266 (class 2606 OID 22330)
-- Name: stock_movements stock_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- TOC entry 5267 (class 2606 OID 22325)
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 5268 (class 2606 OID 22320)
-- Name: stock_movements stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 5352 (class 2606 OID 23697)
-- Name: suppliers suppliers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 5348 (class 2606 OID 23571)
-- Name: user_notification_preferences user_notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5249 (class 2606 OID 22087)
-- Name: user_permissions user_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- TOC entry 5250 (class 2606 OID 22082)
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5252 (class 2606 OID 22128)
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5251 (class 2606 OID 22108)
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5248 (class 2606 OID 22065)
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5255 (class 2606 OID 22173)
-- Name: warehouses warehouses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 5347 (class 2606 OID 23441)
-- Name: webhook_logs webhook_logs_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


-- Completed on 2026-03-12 14:00:24 IST

--
-- PostgreSQL database dump complete
--

\unrestrict 3H3rV7SL1KHR9SA9qWXLJUk8tfnuOO6zjFtxoVAyqa3OHUAqbrFSuY0x16jnJvl

