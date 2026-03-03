--
-- PostgreSQL database dump
--


-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'public', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Required for gen_random_uuid(), gen_random_bytes() used in table defaults
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: calculate_product_volumetric_weight(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: calculate_volumetric_weight(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: generate_webhook_credentials(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: sync_inventory_product_info(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: allocation_history; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: allocation_rules; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for compliance and security';


--
-- Name: background_jobs; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: carrier_assignments; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN carrier_assignments.idempotency_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_assignments.idempotency_key IS 'Prevents duplicate carrier assignment requests';


--
-- Name: carrier_capacity_log; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: carrier_performance_metrics; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: carriers; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN carriers.webhook_secret; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carriers.webhook_secret IS 'Shared secret for HMAC-SHA256 signature verification (carrier signs their webhooks)';


--
-- Name: COLUMN carriers.our_client_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carriers.our_client_id IS 'Our client ID for authenticating with carrier API';


--
-- Name: COLUMN carriers.our_client_secret; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carriers.our_client_secret IS 'Our secret for signing requests to carrier API';


--
-- Name: COLUMN carriers.ip_whitelist; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carriers.ip_whitelist IS 'Array of allowed IP addresses for webhook requests';


--
-- Name: COLUMN carriers.webhook_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carriers.webhook_events IS 'Array of webhook event types carrier subscribes to';


--
-- Name: COLUMN carriers.api_timeout_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carriers.api_timeout_ms IS 'Per-carrier HTTP timeout in milliseconds for outbound quote/tracking API calls. NULL means use the application default (DEFAULT_CARRIER_API_TIMEOUT_MS). Value is capped to 45 000 ms in the application layer.';


--
-- Name: shipments; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN shipments.route_geometry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.route_geometry IS 'GeoJSON route for map display (populated during transit, not at creation)';


--
-- Name: COLUMN shipments.tracking_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.tracking_events IS 'Tracking history array (populated as carrier provides updates)';


--
-- Name: COLUMN shipments.is_fragile; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.is_fragile IS 'True if ANY item in shipment is fragile (aggregated from order_items)';


--
-- Name: COLUMN shipments.is_hazardous; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.is_hazardous IS 'True if ANY item is hazardous (requires special carrier certification)';


--
-- Name: COLUMN shipments.is_perishable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.is_perishable IS 'True if ANY item is perishable (time-sensitive delivery required)';


--
-- Name: COLUMN shipments.requires_cold_storage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.requires_cold_storage IS 'True if ANY item requires temperature control';


--
-- Name: COLUMN shipments.item_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.item_type IS 'Most restrictive item type from all items in shipment';


--
-- Name: COLUMN shipments.package_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.package_type IS 'Package type determined from order items';


--
-- Name: COLUMN shipments.handling_instructions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.handling_instructions IS 'Special handling instructions aggregated from all order items';


--
-- Name: COLUMN shipments.requires_insurance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.requires_insurance IS 'True if ANY item requires insurance';


--
-- Name: COLUMN shipments.declared_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.declared_value IS 'Total declared value for insurance (sum of all item declared values)';


--
-- Name: COLUMN shipments.total_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.total_items IS 'Total number of items (quantity) in this shipment';


--
-- Name: COLUMN shipments.sla_policy_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shipments.sla_policy_id IS 'The SLA policy that was matched and applied when this shipment was created. NULL = system fallback (72h) was used.';


--
-- Name: sla_violations; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: carrier_performance_summary; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: carrier_quotes; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN carrier_quotes.selection_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_quotes.selection_reason IS 'Why selected: best_price, best_speed, best_balance, reliability, only_option';


--
-- Name: carrier_rejections; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN carrier_rejections.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_rejections.reason IS 'at_capacity, weight_exceeded, route_not_serviceable, no_cold_storage, api_error, timeout';


--
-- Name: carrier_rejection_analysis; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: carrier_webhook_config; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: VIEW carrier_webhook_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.carrier_webhook_config IS 'Webhook configuration for active carriers';


--
-- Name: cron_schedules; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: dead_letter_queue; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE dead_letter_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.dead_letter_queue IS 'Failed jobs that exceeded max retries for debugging and reprocessing';


--
-- Name: shipping_estimates; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: estimate_accuracy_analysis; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: eta_predictions; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: exceptions; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN inventory.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.quantity IS 'Total quantity (available + reserved + damaged + in_transit)';


--
-- Name: COLUMN inventory.available_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.available_quantity IS 'Available quantity for sale/transfer';


--
-- Name: COLUMN inventory.reserved_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.reserved_quantity IS 'Reserved quantity (allocated to orders)';


--
-- Name: COLUMN inventory.damaged_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.damaged_quantity IS 'Damaged/unusable quantity';


--
-- Name: COLUMN inventory.in_transit_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.in_transit_quantity IS 'Quantity in transit (being transferred)';


--
-- Name: COLUMN inventory.unit_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inventory.unit_cost IS 'Cost per unit for inventory valuation';


--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: job_execution_logs; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN order_items.dimensions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_items.dimensions IS 'Package dimensions in cm: {length, width, height}';


--
-- Name: COLUMN order_items.volumetric_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_items.volumetric_weight IS 'Dimensional weight (L×W×H/5000). Used for carrier pricing when > actual weight';


--
-- Name: order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_number_seq
    START WITH 10000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_splits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_splits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_order_id uuid NOT NULL,
    child_order_id uuid NOT NULL,
    warehouse_id uuid,
    split_reason character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN orders.external_order_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.external_order_id IS 'Reference ID from external system: E-commerce order ID for sales orders, PO number for purchase orders';


--
-- Name: COLUMN orders.customer_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.customer_name IS 'Customer name for sales orders, or receiving warehouse for transfer orders';


--
-- Name: COLUMN orders.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.status IS 'Order workflow: created -> pending_carrier_assignment -> ready_to_ship -> shipped -> in_transit -> delivered. Use on_hold for any blocking issues.';


--
-- Name: COLUMN orders.order_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.order_type IS 'Order type: regular, replacement, cod, transfer (warehouse-to-warehouse)';


--
-- Name: COLUMN orders.shipping_locked_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.shipping_locked_by IS 'Worker/process identifier that acquired the lock (for debugging)';


--
-- Name: COLUMN orders.shipping_locked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.shipping_locked_at IS 'Timestamp when the lock was acquired; used to detect expired locks';


--
-- Name: COLUMN orders.carrier_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.carrier_id IS 'Carrier that accepted the assignment (set when carrier accepts job)';


--
-- Name: COLUMN orders.supplier_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.supplier_id IS 'Reference to supplier organization for purchase/inbound orders (NULL for sales orders)';


--
-- Name: COLUMN orders.platform; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.platform IS 'Source platform: amazon, shopify, ebay, website, api, manual';


--
-- Name: COLUMN orders.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.customer_id IS 'External customer ID from platform';


--
-- Name: COLUMN orders.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.payment_method IS 'Payment method: cod, prepaid, upi, card, netbanking';


--
-- Name: COLUMN orders.shipping_locked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.shipping_locked IS 'Optimistic lock flag – set true while a worker holds the shipping assignment lock';


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizations IS 'Multi-tenant companies using the platform';


--
-- Name: COLUMN organizations.webhook_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.webhook_token IS 'Secret token for org-scoped webhook URLs. Used in /api/webhooks/:token/orders etc.';


--
-- Name: pick_list_items; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: pick_lists; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: postal_zones; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE postal_zones; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.postal_zones IS 'NOT_PRODUCTION_READY: table is empty until seeded with real pincode data.';


--
-- Name: postal_zones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.postal_zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: postal_zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.postal_zones_id_seq OWNED BY public.postal_zones.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN products.dimensions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.dimensions IS 'Package dimensions in cm: {length, width, height}. Used for shipping cost calculations.';


--
-- Name: COLUMN products.selling_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.selling_price IS 'Base catalog selling price (pre-tax, pre-discount)';


--
-- Name: COLUMN products.cost_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.cost_price IS 'Purchase/manufacturing cost (COGS) - internal use for margin calculation';


--
-- Name: COLUMN products.is_fragile; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.is_fragile IS 'Requires fragile handling (adds surcharge)';


--
-- Name: COLUMN products.requires_cold_storage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.requires_cold_storage IS 'Requires temperature-controlled transport (adds surcharge)';


--
-- Name: COLUMN products.is_perishable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.is_perishable IS 'Perishable item (adds surcharge, time-sensitive delivery)';


--
-- Name: COLUMN products.volumetric_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.volumetric_weight IS 'Dimensional weight (L×W×H/5000). Auto-calculated from dimensions.';


--
-- Name: COLUMN products.package_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.package_type IS 'Recommended package type for this product';


--
-- Name: COLUMN products.handling_instructions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.handling_instructions IS 'Special handling instructions for carriers';


--
-- Name: COLUMN products.requires_insurance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.requires_insurance IS 'Whether this product requires shipping insurance';


--
-- Name: COLUMN products.manufacturer_barcode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.manufacturer_barcode IS 'UPC/EAN/ISBN from product manufacturer (optional, for retail products)';


--
-- Name: COLUMN products.hsn_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.hsn_code IS 'HSN/SAC code for GST compliance (manual entry, government classification)';


--
-- Name: COLUMN products.gst_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.gst_rate IS 'GST rate percentage (0/5/12/18/28) - can be auto-filled from HSN but user must confirm';


--
-- Name: COLUMN products.brand; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.brand IS 'Brand or manufacturer name';


--
-- Name: COLUMN products.country_of_origin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.country_of_origin IS 'Country of manufacture — required for customs declarations';


--
-- Name: COLUMN products.warranty_period_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.warranty_period_days IS 'Warranty duration in days (0 = no warranty)';


--
-- Name: COLUMN products.shelf_life_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.shelf_life_days IS 'Shelf life in days for perishable products';


--
-- Name: COLUMN products.tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.tags IS 'Free-form tags for search/filtering e.g. ["summer","new-arrival"]';


--
-- Name: COLUMN products.supplier_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.supplier_id IS 'Primary supplier for procurement and replenishment';


--
-- Name: COLUMN products.mrp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.mrp IS 'Maximum Retail Price (India legal requirement, printed on package)';


--
-- Name: COLUMN products.internal_barcode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.internal_barcode IS 'Auto-generated internal barcode for warehouse scanning (mandatory, globally unique)';


--
-- Name: quote_idempotency_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_idempotency_cache (
    idempotency_key character varying(255) NOT NULL,
    quote_id uuid,
    response_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE quote_idempotency_cache; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.quote_idempotency_cache IS 'Prevents duplicate quote requests. Auto-cleanup: DELETE WHERE expires_at < NOW()';


--
-- Name: rate_cards; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: return_items; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: returns; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: revoked_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revoked_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jti character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE revoked_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.revoked_tokens IS 'Blocklist of revoked JWT tokens (by JTI) for immediate invalidation';


--
-- Name: sales_channels; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE sales_channels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sales_channels IS 'E-commerce platforms and marketplaces that push orders via webhooks';


--
-- Name: shipment_events; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: sla_policies; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN stock_movements.performed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_movements.performed_by IS 'User ID or system identifier who performed the movement';


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE suppliers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.suppliers IS 'Inbound vendors for purchase orders and inventory replenishment';


--
-- Name: transfer_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transfer_order_number_seq
    START WITH 10000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: COLUMN warehouses.zones; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.warehouses.zones IS 'Number of storage zones in warehouse';


--
-- Name: COLUMN warehouses.operating_hours; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.warehouses.operating_hours IS 'Operating hours: {open: "HH:MM", close: "HH:MM", timezone: "TZ"}';


--
-- Name: transfer_orders; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: VIEW transfer_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.transfer_orders IS 'Convenient view for querying transfer orders with shipment details';


--
-- Name: transfer_shipment_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transfer_shipment_number_seq
    START WITH 10000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_notification_preferences; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE user_notification_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_notification_preferences IS 'Stores user notification preferences for different channels and event types';


--
-- Name: COLUMN user_notification_preferences.notification_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_notification_preferences.notification_types IS 'JSON object containing boolean flags for different notification types (orders, shipments, sla_alerts, exceptions, returns, system_updates)';


--
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_notification_preferences_id_seq OWNED BY public.user_notification_preferences.id;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    permission character varying(100) NOT NULL,
    granted_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE user_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_sessions IS 'Tracks active user sessions for security and session management';


--
-- Name: COLUMN user_sessions.session_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_sessions.session_token IS 'JWT token for the session';


--
-- Name: COLUMN user_sessions.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_sessions.is_active IS 'Whether the session is currently active (not revoked)';


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_preferences jsonb DEFAULT '{"sla_alerts": true, "sms_enabled": false, "push_enabled": true, "email_enabled": true, "order_updates": true, "exception_alerts": true, "shipment_updates": true}'::jsonb,
    ui_preferences jsonb DEFAULT '{"theme": "system", "dashboard_layout": "default", "sidebar_collapsed": false, "table_rows_per_page": 20}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'All platform users including superadmin and company users';


--
-- Name: COLUMN users.organization_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.organization_id IS 'NULL for superadmin who manages all organizations';


--
-- Name: v_order_items_shipping_details; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: VIEW v_order_items_shipping_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_order_items_shipping_details IS 'Complete shipping details for order items including chargeable weight and special handling';


--
-- Name: webhook_logs; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE webhook_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.webhook_logs IS 'Audit trail for all webhook requests (authenticated and rejected)';


--
-- Name: wh_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wh_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zone_distances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zone_distances (
    id integer NOT NULL,
    from_zone character varying(10) NOT NULL,
    to_zone character varying(10) NOT NULL,
    distance_km integer NOT NULL,
    transit_days integer
);


--
-- Name: TABLE zone_distances; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.zone_distances IS 'NOT_PRODUCTION_READY: table is empty until seeded with carrier zone matrices.';


--
-- Name: zone_distances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zone_distances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zone_distances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zone_distances_id_seq OWNED BY public.zone_distances.id;


--
-- Name: postal_zones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_zones ALTER COLUMN id SET DEFAULT nextval('public.postal_zones_id_seq'::regclass);


--
-- Name: user_notification_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_notification_preferences_id_seq'::regclass);


--
-- Name: zone_distances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_distances ALTER COLUMN id SET DEFAULT nextval('public.zone_distances_id_seq'::regclass);


--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: allocation_history allocation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_pkey PRIMARY KEY (id);


--
-- Name: allocation_rules allocation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocation_rules
    ADD CONSTRAINT allocation_rules_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: background_jobs background_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_pkey PRIMARY KEY (id);


--
-- Name: carrier_assignments carrier_assignments_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: carrier_assignments carrier_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_pkey PRIMARY KEY (id);


--
-- Name: carrier_capacity_log carrier_capacity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_capacity_log
    ADD CONSTRAINT carrier_capacity_log_pkey PRIMARY KEY (id);


--
-- Name: carrier_performance_metrics carrier_performance_metrics_carrier_id_organization_id_peri_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_carrier_id_organization_id_peri_key UNIQUE (carrier_id, organization_id, period_start, period_type);


--
-- Name: carrier_performance_metrics carrier_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: carrier_quotes carrier_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_pkey PRIMARY KEY (id);


--
-- Name: carrier_rejections carrier_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_pkey PRIMARY KEY (id);


--
-- Name: carriers carriers_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: carriers carriers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_pkey PRIMARY KEY (id);


--
-- Name: cron_schedules cron_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_schedules
    ADD CONSTRAINT cron_schedules_pkey PRIMARY KEY (id);


--
-- Name: dead_letter_queue dead_letter_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dead_letter_queue
    ADD CONSTRAINT dead_letter_queue_pkey PRIMARY KEY (id);


--
-- Name: eta_predictions eta_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eta_predictions
    ADD CONSTRAINT eta_predictions_pkey PRIMARY KEY (id);


--
-- Name: exceptions exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_organization_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_invoice_number_key UNIQUE (organization_id, invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: job_execution_logs job_execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_execution_logs
    ADD CONSTRAINT job_execution_logs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_splits order_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_code_key UNIQUE (code);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_webhook_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_webhook_token_key UNIQUE (webhook_token);


--
-- Name: pick_list_items pick_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_pkey PRIMARY KEY (id);


--
-- Name: pick_lists pick_lists_pick_list_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_pick_list_number_key UNIQUE (pick_list_number);


--
-- Name: pick_lists pick_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_pkey PRIMARY KEY (id);


--
-- Name: postal_zones postal_zones_pincode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_zones
    ADD CONSTRAINT postal_zones_pincode_key UNIQUE (pincode);


--
-- Name: postal_zones postal_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_zones
    ADD CONSTRAINT postal_zones_pkey PRIMARY KEY (id);


--
-- Name: products products_internal_barcode_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_internal_barcode_unique UNIQUE (internal_barcode);


--
-- Name: products products_organization_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_sku_key UNIQUE (organization_id, sku);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: quote_idempotency_cache quote_idempotency_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_idempotency_cache
    ADD CONSTRAINT quote_idempotency_cache_pkey PRIMARY KEY (idempotency_key);


--
-- Name: rate_cards rate_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_pkey PRIMARY KEY (id);


--
-- Name: return_items return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_pkey PRIMARY KEY (id);


--
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- Name: revoked_tokens revoked_tokens_jti_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revoked_tokens
    ADD CONSTRAINT revoked_tokens_jti_key UNIQUE (jti);


--
-- Name: revoked_tokens revoked_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revoked_tokens
    ADD CONSTRAINT revoked_tokens_pkey PRIMARY KEY (id);


--
-- Name: sales_channels sales_channels_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: sales_channels sales_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_pkey PRIMARY KEY (id);


--
-- Name: sales_channels sales_channels_webhook_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_webhook_token_key UNIQUE (webhook_token);


--
-- Name: shipment_events shipment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_tracking_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_tracking_number_key UNIQUE (tracking_number);


--
-- Name: shipping_estimates shipping_estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_pkey PRIMARY KEY (id);


--
-- Name: sla_policies sla_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_pkey PRIMARY KEY (id);


--
-- Name: sla_violations sla_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: user_notification_preferences user_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_notification_preferences user_notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_id_permission_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_permission_key UNIQUE (user_id, permission);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: webhook_logs webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: zone_distances zone_distances_from_zone_to_zone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_distances
    ADD CONSTRAINT zone_distances_from_zone_to_zone_key UNIQUE (from_zone, to_zone);


--
-- Name: zone_distances zone_distances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_distances
    ADD CONSTRAINT zone_distances_pkey PRIMARY KEY (id);


--
-- Name: idx_alert_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_rules_active ON public.alert_rules USING btree (is_active);


--
-- Name: idx_alert_rules_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_rules_org ON public.alert_rules USING btree (organization_id);


--
-- Name: idx_alert_rules_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_rules_type ON public.alert_rules USING btree (rule_type);


--
-- Name: idx_alerts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_org ON public.alerts USING btree (organization_id);


--
-- Name: idx_alerts_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_severity ON public.alerts USING btree (severity);


--
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);


--
-- Name: idx_alerts_triggered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_triggered ON public.alerts USING btree (triggered_at);


--
-- Name: idx_allocation_history_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocation_history_order ON public.allocation_history USING btree (order_id);


--
-- Name: idx_allocation_history_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocation_history_warehouse ON public.allocation_history USING btree (warehouse_id);


--
-- Name: idx_allocation_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocation_rules_active ON public.allocation_rules USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- Name: idx_allocation_rules_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocation_rules_org ON public.allocation_rules USING btree (organization_id);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_org ON public.audit_logs USING btree (organization_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_carrier_assignments_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_assignments_carrier ON public.carrier_assignments USING btree (carrier_id);


--
-- Name: idx_carrier_assignments_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_assignments_expires ON public.carrier_assignments USING btree (expires_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_carrier_assignments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_assignments_order ON public.carrier_assignments USING btree (order_id);


--
-- Name: idx_carrier_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_assignments_status ON public.carrier_assignments USING btree (status);


--
-- Name: idx_carrier_capacity_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_capacity_carrier ON public.carrier_capacity_log USING btree (carrier_id);


--
-- Name: idx_carrier_capacity_logged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_capacity_logged ON public.carrier_capacity_log USING btree (logged_at);


--
-- Name: idx_carrier_perf_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_perf_carrier ON public.carrier_performance_metrics USING btree (carrier_id);


--
-- Name: idx_carrier_perf_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_perf_period ON public.carrier_performance_metrics USING btree (period_start, period_type);


--
-- Name: idx_carrier_quotes_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_quotes_carrier ON public.carrier_quotes USING btree (carrier_id);


--
-- Name: idx_carrier_quotes_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_quotes_order ON public.carrier_quotes USING btree (order_id);


--
-- Name: idx_carrier_quotes_selected; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_quotes_selected ON public.carrier_quotes USING btree (order_id) WHERE (was_selected = true);


--
-- Name: idx_carrier_rejections_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_rejections_assignment ON public.carrier_rejections USING btree (carrier_assignment_id) WHERE (carrier_assignment_id IS NOT NULL);


--
-- Name: idx_carrier_rejections_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_rejections_carrier ON public.carrier_rejections USING btree (carrier_id);


--
-- Name: idx_carrier_rejections_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_rejections_date ON public.carrier_rejections USING btree (rejected_at);


--
-- Name: idx_carrier_rejections_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_rejections_order_id ON public.carrier_rejections USING btree (order_id);


--
-- Name: idx_carrier_rejections_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_rejections_reason ON public.carrier_rejections USING btree (reason);


--
-- Name: idx_carriers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carriers_active ON public.carriers USING btree (is_active);


--
-- Name: idx_carriers_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carriers_code ON public.carriers USING btree (code);


--
-- Name: idx_carriers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carriers_org ON public.carriers USING btree (organization_id);


--
-- Name: idx_carriers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carriers_status ON public.carriers USING btree (availability_status);


--
-- Name: idx_cron_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cron_active ON public.cron_schedules USING btree (is_active, next_run_at);


--
-- Name: idx_cron_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cron_org ON public.cron_schedules USING btree (organization_id);


--
-- Name: idx_dlq_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dlq_created ON public.dead_letter_queue USING btree (moved_to_dlq_at);


--
-- Name: idx_dlq_job_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dlq_job_type ON public.dead_letter_queue USING btree (job_type);


--
-- Name: idx_dlq_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dlq_unprocessed ON public.dead_letter_queue USING btree (reprocessed) WHERE (reprocessed = false);


--
-- Name: idx_eta_predictions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eta_predictions_created ON public.eta_predictions USING btree (created_at);


--
-- Name: idx_eta_predictions_shipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eta_predictions_shipment ON public.eta_predictions USING btree (shipment_id);


--
-- Name: idx_exceptions_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exceptions_assigned ON public.exceptions USING btree (assigned_to);


--
-- Name: idx_exceptions_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exceptions_open ON public.exceptions USING btree (organization_id) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'investigating'::character varying])::text[]));


--
-- Name: idx_exceptions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exceptions_order ON public.exceptions USING btree (order_id);


--
-- Name: idx_exceptions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exceptions_org ON public.exceptions USING btree (organization_id);


--
-- Name: idx_exceptions_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exceptions_severity ON public.exceptions USING btree (severity);


--
-- Name: idx_exceptions_shipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exceptions_shipment ON public.exceptions USING btree (shipment_id);


--
-- Name: idx_exceptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exceptions_status ON public.exceptions USING btree (status);


--
-- Name: idx_exceptions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exceptions_type ON public.exceptions USING btree (exception_type);


--
-- Name: idx_inventory_low_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_low_stock ON public.inventory USING btree (warehouse_id) WHERE (available_quantity <= COALESCE(reorder_point, 10));


--
-- Name: idx_inventory_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_organization_id ON public.inventory USING btree (organization_id);


--
-- Name: idx_inventory_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_product ON public.inventory USING btree (product_id);


--
-- Name: idx_inventory_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_warehouse ON public.inventory USING btree (warehouse_id);


--
-- Name: idx_inventory_warehouse_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_inventory_warehouse_product ON public.inventory USING btree (warehouse_id, product_id) WHERE (product_id IS NOT NULL);


--
-- Name: idx_inventory_warehouse_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_inventory_warehouse_sku ON public.inventory USING btree (warehouse_id, sku) WHERE (sku IS NOT NULL);


--
-- Name: idx_inventory_warehouse_stats; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_warehouse_stats ON public.inventory USING btree (warehouse_id, quantity, available_quantity, reserved_quantity);


--
-- Name: idx_invoice_line_items_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_line_items_invoice ON public.invoice_line_items USING btree (invoice_id);


--
-- Name: idx_invoice_line_items_shipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_line_items_shipment ON public.invoice_line_items USING btree (shipment_id) WHERE (shipment_id IS NOT NULL);


--
-- Name: idx_invoices_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_carrier ON public.invoices USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);


--
-- Name: idx_invoices_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_due ON public.invoices USING btree (due_date) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'overdue'::character varying])::text[]));


--
-- Name: idx_invoices_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_org ON public.invoices USING btree (organization_id);


--
-- Name: idx_invoices_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_period ON public.invoices USING btree (billing_period_start, billing_period_end);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_job_execution_logs_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_execution_logs_job ON public.job_execution_logs USING btree (job_id);


--
-- Name: idx_job_execution_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_execution_logs_status ON public.job_execution_logs USING btree (status);


--
-- Name: idx_jobs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_created ON public.background_jobs USING btree (created_at);


--
-- Name: idx_jobs_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_jobs_idempotency ON public.background_jobs USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_jobs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_org ON public.background_jobs USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_jobs_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_priority ON public.background_jobs USING btree (priority, scheduled_for) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying])::text[]));


--
-- Name: idx_jobs_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_scheduled ON public.background_jobs USING btree (scheduled_for) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying])::text[]));


--
-- Name: idx_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_status ON public.background_jobs USING btree (status);


--
-- Name: idx_jobs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_type ON public.background_jobs USING btree (job_type);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_order_items_fragile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_fragile ON public.order_items USING btree (is_fragile) WHERE (is_fragile = true);


--
-- Name: idx_order_items_hazardous; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_hazardous ON public.order_items USING btree (is_hazardous) WHERE (is_hazardous = true);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_perishable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_perishable ON public.order_items USING btree (is_perishable) WHERE (is_perishable = true);


--
-- Name: idx_order_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product ON public.order_items USING btree (product_id);


--
-- Name: idx_order_items_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_sku ON public.order_items USING btree (sku);


--
-- Name: idx_order_splits_child; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_splits_child ON public.order_splits USING btree (child_order_id);


--
-- Name: idx_order_splits_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_splits_parent ON public.order_splits USING btree (parent_order_id);


--
-- Name: idx_orders_carrier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_carrier_id ON public.orders USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);


--
-- Name: idx_orders_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created ON public.orders USING btree (created_at);


--
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_email);


--
-- Name: idx_orders_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_external ON public.orders USING btree (external_order_id) WHERE (external_order_id IS NOT NULL);


--
-- Name: idx_orders_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_number ON public.orders USING btree (order_number);


--
-- Name: idx_orders_on_hold; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_on_hold ON public.orders USING btree (status) WHERE ((status)::text = 'on_hold'::text);


--
-- Name: idx_orders_order_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_type ON public.orders USING btree (order_type);


--
-- Name: idx_orders_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_org ON public.orders USING btree (organization_id);


--
-- Name: idx_orders_shipping_locked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_shipping_locked ON public.orders USING btree (shipping_locked_at) WHERE (shipping_locked = true);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_status_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status_org ON public.orders USING btree (organization_id, status);


--
-- Name: idx_orders_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_supplier_id ON public.orders USING btree (supplier_id) WHERE (supplier_id IS NOT NULL);


--
-- Name: idx_organizations_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_active ON public.organizations USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_organizations_webhook_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_webhook_token ON public.organizations USING btree (webhook_token);


--
-- Name: idx_pick_list_items_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pick_list_items_list ON public.pick_list_items USING btree (pick_list_id);


--
-- Name: idx_pick_list_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pick_list_items_status ON public.pick_list_items USING btree (pick_list_id, status);


--
-- Name: idx_pick_lists_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pick_lists_assigned ON public.pick_lists USING btree (assigned_to) WHERE (assigned_to IS NOT NULL);


--
-- Name: idx_pick_lists_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pick_lists_org ON public.pick_lists USING btree (organization_id);


--
-- Name: idx_pick_lists_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pick_lists_status ON public.pick_lists USING btree (status);


--
-- Name: idx_pick_lists_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pick_lists_warehouse ON public.pick_lists USING btree (warehouse_id);


--
-- Name: idx_postal_zones_zone_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_postal_zones_zone_code ON public.postal_zones USING btree (zone_code);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_active ON public.products USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_products_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_brand ON public.products USING btree (organization_id, brand) WHERE (brand IS NOT NULL);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (organization_id, category) WHERE (category IS NOT NULL);


--
-- Name: idx_products_fragile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_fragile ON public.products USING btree (is_fragile) WHERE (is_fragile = true);


--
-- Name: idx_products_hsn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_hsn ON public.products USING btree (hsn_code) WHERE (hsn_code IS NOT NULL);


--
-- Name: idx_products_manufacturer_barcode_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_products_manufacturer_barcode_org ON public.products USING btree (organization_id, manufacturer_barcode) WHERE (manufacturer_barcode IS NOT NULL);


--
-- Name: idx_products_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_org ON public.products USING btree (organization_id);


--
-- Name: idx_products_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_organization_id ON public.products USING btree (organization_id);


--
-- Name: idx_products_perishable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_perishable ON public.products USING btree (is_perishable) WHERE (is_perishable = true);


--
-- Name: idx_products_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_supplier ON public.products USING btree (supplier_id) WHERE (supplier_id IS NOT NULL);


--
-- Name: idx_products_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_tags ON public.products USING gin (tags);


--
-- Name: idx_quote_cache_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_cache_expires ON public.quote_idempotency_cache USING btree (expires_at);


--
-- Name: idx_rate_cards_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_cards_active ON public.rate_cards USING btree (carrier_id, is_active) WHERE (is_active = true);


--
-- Name: idx_rate_cards_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_cards_carrier ON public.rate_cards USING btree (carrier_id);


--
-- Name: idx_rate_cards_route; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_cards_route ON public.rate_cards USING btree (origin_state, destination_state) WHERE (is_active = true);


--
-- Name: idx_return_items_order_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_items_order_item ON public.return_items USING btree (order_item_id) WHERE (order_item_id IS NOT NULL);


--
-- Name: idx_return_items_return; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_items_return ON public.return_items USING btree (return_id);


--
-- Name: idx_returns_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_created ON public.returns USING btree (created_at);


--
-- Name: idx_returns_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_external ON public.returns USING btree (external_return_id) WHERE (external_return_id IS NOT NULL);


--
-- Name: idx_returns_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_order ON public.returns USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: idx_returns_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_org ON public.returns USING btree (organization_id);


--
-- Name: idx_returns_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_organization_id ON public.returns USING btree (organization_id);


--
-- Name: idx_returns_rma_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_returns_rma_number ON public.returns USING btree (organization_id, rma_number) WHERE (rma_number IS NOT NULL);


--
-- Name: idx_returns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_status ON public.returns USING btree (status);


--
-- Name: idx_revoked_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revoked_tokens_expires ON public.revoked_tokens USING btree (expires_at);


--
-- Name: idx_revoked_tokens_jti; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revoked_tokens_jti ON public.revoked_tokens USING btree (jti);


--
-- Name: idx_sales_channels_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_channels_active ON public.sales_channels USING btree (organization_id, is_active);


--
-- Name: idx_sales_channels_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_channels_org ON public.sales_channels USING btree (organization_id);


--
-- Name: idx_shipment_events_shipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_events_shipment ON public.shipment_events USING btree (shipment_id);


--
-- Name: idx_shipment_events_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_events_timestamp ON public.shipment_events USING btree (event_timestamp);


--
-- Name: idx_shipment_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_events_type ON public.shipment_events USING btree (event_type);


--
-- Name: idx_shipments_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_carrier ON public.shipments USING btree (carrier_id);


--
-- Name: idx_shipments_carrier_tracking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_carrier_tracking ON public.shipments USING btree (carrier_tracking_number) WHERE (carrier_tracking_number IS NOT NULL);


--
-- Name: idx_shipments_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_created ON public.shipments USING btree (created_at);


--
-- Name: idx_shipments_delivery_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_delivery_scheduled ON public.shipments USING btree (delivery_scheduled) WHERE (delivery_scheduled IS NOT NULL);


--
-- Name: idx_shipments_is_hazardous; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_is_hazardous ON public.shipments USING btree (is_hazardous) WHERE (is_hazardous = true);


--
-- Name: idx_shipments_is_perishable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_is_perishable ON public.shipments USING btree (is_perishable) WHERE (is_perishable = true);


--
-- Name: idx_shipments_item_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_item_type ON public.shipments USING btree (item_type) WHERE ((item_type)::text <> 'general'::text);


--
-- Name: idx_shipments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_order ON public.shipments USING btree (order_id);


--
-- Name: idx_shipments_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_org ON public.shipments USING btree (organization_id);


--
-- Name: idx_shipments_requires_cold_storage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_requires_cold_storage ON public.shipments USING btree (requires_cold_storage) WHERE (requires_cold_storage = true);


--
-- Name: idx_shipments_sla_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_sla_policy ON public.shipments USING btree (sla_policy_id) WHERE (sla_policy_id IS NOT NULL);


--
-- Name: idx_shipments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_status ON public.shipments USING btree (status);


--
-- Name: idx_shipments_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_status_created ON public.shipments USING btree (status, created_at DESC);


--
-- Name: idx_shipments_status_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_status_org ON public.shipments USING btree (organization_id, status);


--
-- Name: idx_shipments_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_warehouse ON public.shipments USING btree (warehouse_id) WHERE (warehouse_id IS NOT NULL);


--
-- Name: idx_shipping_estimates_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_estimates_carrier ON public.shipping_estimates USING btree (carrier_id);


--
-- Name: idx_shipping_estimates_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_estimates_order ON public.shipping_estimates USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: idx_sla_policies_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_policies_active ON public.sla_policies USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- Name: idx_sla_policies_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_policies_org ON public.sla_policies USING btree (organization_id);


--
-- Name: idx_sla_policies_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_policies_service ON public.sla_policies USING btree (service_type) WHERE (is_active = true);


--
-- Name: idx_sla_violations_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_violations_carrier ON public.sla_violations USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);


--
-- Name: idx_sla_violations_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_violations_open ON public.sla_violations USING btree (organization_id, status) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'acknowledged'::character varying])::text[]));


--
-- Name: idx_sla_violations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_violations_org ON public.sla_violations USING btree (organization_id);


--
-- Name: idx_sla_violations_shipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_violations_shipment ON public.sla_violations USING btree (shipment_id) WHERE (shipment_id IS NOT NULL);


--
-- Name: idx_sla_violations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_violations_status ON public.sla_violations USING btree (status);


--
-- Name: idx_sla_violations_violated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_violations_violated ON public.sla_violations USING btree (violated_at);


--
-- Name: idx_stock_movements_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_created ON public.stock_movements USING btree (created_at);


--
-- Name: idx_stock_movements_inventory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_inventory ON public.stock_movements USING btree (inventory_id) WHERE (inventory_id IS NOT NULL);


--
-- Name: idx_stock_movements_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_reference ON public.stock_movements USING btree (reference_type, reference_id) WHERE (reference_id IS NOT NULL);


--
-- Name: idx_stock_movements_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_type ON public.stock_movements USING btree (movement_type);


--
-- Name: idx_stock_movements_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_warehouse ON public.stock_movements USING btree (warehouse_id);


--
-- Name: idx_suppliers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_active ON public.suppliers USING btree (organization_id, is_active);


--
-- Name: idx_suppliers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_org ON public.suppliers USING btree (organization_id);


--
-- Name: idx_user_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_preferences_user_id ON public.user_notification_preferences USING btree (user_id);


--
-- Name: idx_user_sessions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_active ON public.user_sessions USING btree (user_id, is_active);


--
-- Name: idx_user_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_expires ON public.user_sessions USING btree (expires_at);


--
-- Name: idx_user_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (session_token);


--
-- Name: idx_user_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user ON public.user_sessions USING btree (user_id);


--
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_users_email_change_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email_change_token ON public.users USING btree (email_change_token) WHERE (email_change_token IS NOT NULL);


--
-- Name: idx_users_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_organization ON public.users USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_users_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_organization_id ON public.users USING btree (organization_id);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_warehouses_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_active ON public.warehouses USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_warehouses_bonded_customs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_bonded_customs ON public.warehouses USING btree (customs_bonded_warehouse) WHERE (customs_bonded_warehouse = true);


--
-- Name: idx_warehouses_cold_storage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_cold_storage ON public.warehouses USING btree (has_cold_storage) WHERE (has_cold_storage = true);


--
-- Name: idx_warehouses_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_org ON public.warehouses USING btree (organization_id);


--
-- Name: idx_warehouses_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_organization_id ON public.warehouses USING btree (organization_id);


--
-- Name: idx_webhook_logs_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_carrier ON public.webhook_logs USING btree (carrier_id, created_at DESC);


--
-- Name: idx_webhook_logs_endpoint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_endpoint ON public.webhook_logs USING btree (endpoint, created_at DESC);


--
-- Name: idx_webhook_logs_signature_valid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_signature_valid ON public.webhook_logs USING btree (signature_valid, created_at DESC);


--
-- Name: carriers carrier_webhook_credentials_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER carrier_webhook_credentials_trigger BEFORE INSERT ON public.carriers FOR EACH ROW EXECUTE FUNCTION public.generate_webhook_credentials();


--
-- Name: sales_channels set_sales_channels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_sales_channels_updated_at BEFORE UPDATE ON public.sales_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: suppliers set_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory trg_sync_inventory_product_info; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_inventory_product_info BEFORE INSERT OR UPDATE OF product_id ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_product_info();


--
-- Name: products trigger_calculate_product_volumetric_weight; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_product_volumetric_weight BEFORE INSERT OR UPDATE OF dimensions ON public.products FOR EACH ROW EXECUTE FUNCTION public.calculate_product_volumetric_weight();


--
-- Name: order_items trigger_calculate_volumetric_weight; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_volumetric_weight BEFORE INSERT OR UPDATE OF dimensions ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.calculate_volumetric_weight();


--
-- Name: alert_rules trigger_update_alert_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_alert_rules_updated_at BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: allocation_rules trigger_update_allocation_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_allocation_rules_updated_at BEFORE UPDATE ON public.allocation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: background_jobs trigger_update_background_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_background_jobs_updated_at BEFORE UPDATE ON public.background_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carrier_assignments trigger_update_carrier_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_carrier_assignments_updated_at BEFORE UPDATE ON public.carrier_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carriers trigger_update_carriers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_carriers_updated_at BEFORE UPDATE ON public.carriers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cron_schedules trigger_update_cron_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_cron_schedules_updated_at BEFORE UPDATE ON public.cron_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: exceptions trigger_update_exceptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_exceptions_updated_at BEFORE UPDATE ON public.exceptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory trigger_update_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices trigger_update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders trigger_update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations trigger_update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pick_lists trigger_update_pick_lists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_pick_lists_updated_at BEFORE UPDATE ON public.pick_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products trigger_update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: returns trigger_update_returns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shipments trigger_update_shipments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sla_policies trigger_update_sla_policies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_sla_policies_updated_at BEFORE UPDATE ON public.sla_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sla_violations trigger_update_sla_violations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_sla_violations_updated_at BEFORE UPDATE ON public.sla_violations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_settings trigger_update_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users trigger_update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: warehouses trigger_update_warehouses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_notification_preferences update_user_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_notification_preferences_updated_at BEFORE UPDATE ON public.user_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: alert_rules alert_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: alert_rules alert_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: alerts alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: alerts alerts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: alerts alerts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: alerts alerts_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id);


--
-- Name: allocation_history allocation_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: allocation_history allocation_history_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- Name: allocation_history allocation_history_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: allocation_rules allocation_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocation_rules
    ADD CONSTRAINT allocation_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_logs audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: background_jobs background_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: background_jobs background_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: carrier_assignments carrier_assignments_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: carrier_assignments carrier_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: carrier_assignments carrier_assignments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: carrier_capacity_log carrier_capacity_log_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_capacity_log
    ADD CONSTRAINT carrier_capacity_log_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: carrier_performance_metrics carrier_performance_metrics_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: carrier_performance_metrics carrier_performance_metrics_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: carrier_quotes carrier_quotes_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: carrier_quotes carrier_quotes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: carrier_rejections carrier_rejections_carrier_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_carrier_assignment_id_fkey FOREIGN KEY (carrier_assignment_id) REFERENCES public.carrier_assignments(id);


--
-- Name: carrier_rejections carrier_rejections_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: carrier_rejections carrier_rejections_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: carriers carriers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: cron_schedules cron_schedules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_schedules
    ADD CONSTRAINT cron_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: eta_predictions eta_predictions_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eta_predictions
    ADD CONSTRAINT eta_predictions_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- Name: exceptions exceptions_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: exceptions exceptions_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: exceptions exceptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: exceptions exceptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: exceptions exceptions_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- Name: inventory inventory_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory inventory_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_line_items invoice_line_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: invoice_line_items invoice_line_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- Name: invoices invoices_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: job_execution_logs job_execution_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_execution_logs
    ADD CONSTRAINT job_execution_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.background_jobs(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_items order_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: order_splits order_splits_child_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_child_order_id_fkey FOREIGN KEY (child_order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_splits order_splits_parent_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_splits order_splits_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: orders orders_allocated_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_allocated_warehouse_id_fkey FOREIGN KEY (allocated_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: orders orders_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: orders orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: orders orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.organizations(id);


--
-- Name: pick_list_items pick_list_items_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- Name: pick_list_items pick_list_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- Name: pick_list_items pick_list_items_pick_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_pick_list_id_fkey FOREIGN KEY (pick_list_id) REFERENCES public.pick_lists(id) ON DELETE CASCADE;


--
-- Name: pick_list_items pick_list_items_picked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_picked_by_fkey FOREIGN KEY (picked_by) REFERENCES public.users(id);


--
-- Name: pick_lists pick_lists_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: pick_lists pick_lists_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: pick_lists pick_lists_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: products products_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: quote_idempotency_cache quote_idempotency_cache_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_idempotency_cache
    ADD CONSTRAINT quote_idempotency_cache_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.carrier_quotes(id);


--
-- Name: rate_cards rate_cards_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id) ON DELETE CASCADE;


--
-- Name: return_items return_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- Name: return_items return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: return_items return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE CASCADE;


--
-- Name: returns returns_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: returns returns_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: returns returns_original_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_original_shipment_id_fkey FOREIGN KEY (original_shipment_id) REFERENCES public.shipments(id);


--
-- Name: returns returns_return_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_return_shipment_id_fkey FOREIGN KEY (return_shipment_id) REFERENCES public.shipments(id);


--
-- Name: revoked_tokens revoked_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revoked_tokens
    ADD CONSTRAINT revoked_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sales_channels sales_channels_default_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: sales_channels sales_channels_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: shipment_events shipment_events_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE;


--
-- Name: shipments shipments_carrier_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_carrier_assignment_id_fkey FOREIGN KEY (carrier_assignment_id) REFERENCES public.carrier_assignments(id);


--
-- Name: shipments shipments_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: shipments shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: shipments shipments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: shipments shipments_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.sla_policies(id) ON DELETE SET NULL;


--
-- Name: shipments shipments_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: shipping_estimates shipping_estimates_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: shipping_estimates shipping_estimates_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: sla_policies sla_policies_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id) ON DELETE SET NULL;


--
-- Name: sla_policies sla_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sla_violations sla_violations_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- Name: sla_violations sla_violations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sla_violations sla_violations_penalty_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_penalty_approved_by_fkey FOREIGN KEY (penalty_approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sla_violations sla_violations_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- Name: sla_violations sla_violations_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.sla_policies(id);


--
-- Name: sla_violations sla_violations_waived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_waived_by_fkey FOREIGN KEY (waived_by) REFERENCES public.users(id);


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_movements stock_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_movements stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: suppliers suppliers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_notification_preferences user_notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: warehouses warehouses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: webhook_logs webhook_logs_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- PostgreSQL database dump complete
--

-- ============================================
-- SEED: Superadmin user
-- Password hash below is a bcrypt placeholder — the account cannot log in
-- until you set a real hash. Connect to the running container and run:
--
--   docker exec -it scm_backend node -e "
--     const b = require('bcrypt');
--     b.hash('YourPassword123!', 10).then(h => console.log(h));
--   "
--   Then: UPDATE users SET password_hash='<hash>' WHERE email='superadmin@twinchain.in';
-- ============================================

INSERT INTO users (email, password_hash, name, role, organization_id, is_active)
VALUES (
    'superadmin@twinchain.in',
    '$2b$10$w.dQMHPbM.X4tvmaof9JJOGPNK4EBa9NSM5B/5g0H4QC11Ci1Z.WC',
    'Super Admin',
    'superadmin',
    NULL,
    true
)
ON CONFLICT (email) DO NOTHING;

