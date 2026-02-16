--
-- PostgreSQL database dump
--

\restrict UD9PxGXzGqqCuEfpp4yQp4Ejf3HhyvEygQR58fMxk5zZwhMcGJbabSZJ5oY9CSi

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-02-16 14:13:13 IST

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
-- TOC entry 268 (class 1255 OID 21477)
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
-- TOC entry 252 (class 1259 OID 21696)
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alert_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    rule_type character varying(100) NOT NULL,
    severity character varying(50) DEFAULT 'medium'::character varying NOT NULL,
    message_template text NOT NULL,
    threshold integer,
    conditions jsonb,
    assigned_users uuid[],
    assigned_roles character varying(50)[],
    escalation_enabled boolean DEFAULT false,
    escalation_delay_minutes integer DEFAULT 15,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 5,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.alert_rules OWNER TO postgres;

--
-- TOC entry 5142 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE alert_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.alert_rules IS 'Configurable alert rules for system monitoring';


--
-- TOC entry 5143 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN alert_rules.threshold; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.alert_rules.threshold IS 'Numeric threshold for triggering the alert';


--
-- TOC entry 5144 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN alert_rules.conditions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.alert_rules.conditions IS 'JSON object with additional rule conditions';


--
-- TOC entry 253 (class 1259 OID 21721)
-- Name: alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid,
    rule_name character varying(255),
    alert_type character varying(100),
    severity character varying(50),
    message text,
    data jsonb,
    status character varying(50) DEFAULT 'pending'::character varying,
    triggered_at timestamp with time zone DEFAULT now(),
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    resolution text
);


ALTER TABLE public.alerts OWNER TO postgres;

--
-- TOC entry 5145 (class 0 OID 0)
-- Dependencies: 253
-- Name: TABLE alerts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.alerts IS 'Triggered alerts from alert rules';


--
-- TOC entry 5146 (class 0 OID 0)
-- Dependencies: 253
-- Name: COLUMN alerts.data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.alerts.data IS 'Additional context data for the alert';


--
-- TOC entry 249 (class 1259 OID 21608)
-- Name: allocation_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allocation_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    order_item_id uuid,
    warehouse_id uuid,
    allocation_strategy character varying(50),
    allocation_score numeric(10,2),
    allocated_quantity integer,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.allocation_history OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 21594)
-- Name: allocation_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allocation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    priority integer DEFAULT 5,
    strategy character varying(50) NOT NULL,
    conditions jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.allocation_rules OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 21013)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    changes jsonb,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 21793)
-- Name: background_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.background_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_type character varying(255) NOT NULL,
    priority integer DEFAULT 5,
    status character varying(100) DEFAULT 'pending'::character varying,
    payload jsonb,
    result jsonb,
    error_message text,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    scheduled_for timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.background_jobs OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 21876)
-- Name: carrier_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    carrier_id uuid,
    service_type character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    pickup_address jsonb,
    delivery_address jsonb,
    estimated_pickup timestamp with time zone,
    estimated_delivery timestamp with time zone,
    special_instructions text,
    request_payload jsonb,
    acceptance_payload jsonb,
    carrier_reference_id character varying(100),
    rejected_reason text,
    requested_at timestamp with time zone DEFAULT now(),
    assigned_at timestamp with time zone,
    accepted_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    idempotency_key character varying(255)
);


ALTER TABLE public.carrier_assignments OWNER TO postgres;

--
-- TOC entry 5147 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN carrier_assignments.idempotency_key; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_assignments.idempotency_key IS 'Unique key to prevent duplicate carrier assignment requests. Format: {orderId}-carrier-{carrierId}-{timestamp}';


--
-- TOC entry 263 (class 1259 OID 21970)
-- Name: carrier_capacity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_capacity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_id uuid,
    capacity_snapshot integer,
    max_capacity integer,
    utilization_percent numeric(5,2),
    logged_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.carrier_capacity_log OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 21662)
-- Name: carrier_performance_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_performance_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_shipments integer DEFAULT 0,
    on_time_deliveries integer DEFAULT 0,
    late_deliveries integer DEFAULT 0,
    failed_deliveries integer DEFAULT 0,
    sla_violations integer DEFAULT 0,
    total_penalties numeric(10,2) DEFAULT 0,
    performance_score numeric(5,2),
    reliability_score numeric(3,2),
    calculated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.carrier_performance_metrics OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 21911)
-- Name: carrier_quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_quotes (
    id uuid NOT NULL,
    order_id uuid,
    carrier_id uuid,
    request_payload jsonb,
    quoted_price numeric(10,2),
    estimated_delivery_time timestamp with time zone,
    carrier_service_id character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    is_selected boolean DEFAULT false,
    response_time_ms integer,
    was_retried boolean DEFAULT false,
    selection_reason character varying(255)
);


ALTER TABLE public.carrier_quotes OWNER TO postgres;

--
-- TOC entry 5148 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN carrier_quotes.response_time_ms; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_quotes.response_time_ms IS 'Response time in milliseconds. Useful for identifying slow carriers.';


--
-- TOC entry 5149 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN carrier_quotes.was_retried; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_quotes.was_retried IS 'True if quote was obtained on retry attempt. Useful for reliability analysis.';


--
-- TOC entry 5150 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN carrier_quotes.selection_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_quotes.selection_reason IS 'Why this carrier was selected: best_price, best_speed, best_balance, only_option, etc.';


--
-- TOC entry 224 (class 1259 OID 21051)
-- Name: carriers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carriers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    service_type character varying(50),
    contact_email character varying(255),
    contact_phone character varying(20),
    reliability_score numeric(3,2) DEFAULT 0.85,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    website character varying(500),
    availability_status character varying(20) DEFAULT 'available'::character varying,
    last_status_change timestamp with time zone DEFAULT now(),
    api_endpoint character varying(255),
    api_key_encrypted text,
    api_version character varying(50),
    current_load integer DEFAULT 0,
    max_capacity integer,
    daily_capacity integer
);


ALTER TABLE public.carriers OWNER TO postgres;

--
-- TOC entry 265 (class 1259 OID 21998)
-- Name: carrier_performance_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.carrier_performance_summary AS
 SELECT c.name AS carrier_name,
    c.code AS carrier_code,
    count(DISTINCT cq.order_id) AS total_quotes_given,
    avg(cq.response_time_ms) AS avg_response_time_ms,
    count(*) FILTER (WHERE (cq.was_retried = true)) AS retry_count,
    count(*) FILTER (WHERE (cq.is_selected = true)) AS times_selected,
    round((((count(*) FILTER (WHERE (cq.is_selected = true)))::numeric / (NULLIF(count(DISTINCT cq.order_id), 0))::numeric) * (100)::numeric), 2) AS selection_rate_percent
   FROM (public.carriers c
     LEFT JOIN public.carrier_quotes cq ON ((c.id = cq.carrier_id)))
  GROUP BY c.id, c.name, c.code;


ALTER VIEW public.carrier_performance_summary OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 21931)
-- Name: carrier_rejections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_rejections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    carrier_name character varying(255) NOT NULL,
    carrier_code character varying(50) NOT NULL,
    reason character varying(100) NOT NULL,
    message text,
    rejected_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    response_time_ms integer
);


ALTER TABLE public.carrier_rejections OWNER TO postgres;

--
-- TOC entry 5151 (class 0 OID 0)
-- Dependencies: 261
-- Name: TABLE carrier_rejections; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.carrier_rejections IS 'Tracks when carriers reject shipment requests with reasons';


--
-- TOC entry 5152 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN carrier_rejections.reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_rejections.reason IS 'Rejection reason: at_capacity, weight_exceeded, route_not_serviceable, no_cold_storage, api_error';


--
-- TOC entry 5153 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN carrier_rejections.message; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_rejections.message IS 'Detailed message from carrier explaining rejection';


--
-- TOC entry 5154 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN carrier_rejections.response_time_ms; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_rejections.response_time_ms IS 'Response time before rejection. Null if timeout.';


--
-- TOC entry 266 (class 1259 OID 22003)
-- Name: carrier_rejection_analysis; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.carrier_rejection_analysis AS
 SELECT carrier_code,
    carrier_name,
    count(*) AS total_rejections,
    count(DISTINCT order_id) AS orders_rejected,
    reason,
    count(*) AS rejection_count,
    round((((count(*))::numeric / sum(count(*)) OVER (PARTITION BY carrier_code)) * (100)::numeric), 2) AS percentage,
    avg(response_time_ms) AS avg_response_time_ms
   FROM public.carrier_rejections
  GROUP BY carrier_code, carrier_name, reason
  ORDER BY carrier_code, (count(*)) DESC;


ALTER VIEW public.carrier_rejection_analysis OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 21829)
-- Name: cron_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cron_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    job_type character varying(100) NOT NULL,
    cron_expression character varying(100) NOT NULL,
    payload jsonb,
    is_active boolean DEFAULT true,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cron_schedules OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 21775)
-- Name: dead_letter_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dead_letter_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_job_id uuid NOT NULL,
    job_type character varying(100) NOT NULL,
    payload jsonb,
    priority integer,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    moved_to_dlq_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.dead_letter_queue OWNER TO postgres;

--
-- TOC entry 5155 (class 0 OID 0)
-- Dependencies: 255
-- Name: TABLE dead_letter_queue; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.dead_letter_queue IS 'Failed jobs that exceeded max retries';


--
-- TOC entry 5156 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN dead_letter_queue.original_job_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dead_letter_queue.original_job_id IS 'ID of the original job in background_jobs';


--
-- TOC entry 5157 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN dead_letter_queue.moved_to_dlq_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dead_letter_queue.moved_to_dlq_at IS 'When the job was moved to dead letter queue';


--
-- TOC entry 264 (class 1259 OID 21984)
-- Name: shipping_estimates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipping_estimates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id character varying(255),
    from_pincode character varying(10),
    to_pincode character varying(10),
    weight_kg numeric(10,2),
    service_type character varying(50),
    estimated_cost numeric(10,2),
    min_cost numeric(10,2),
    max_cost numeric(10,2),
    confidence numeric(3,2),
    created_at timestamp with time zone DEFAULT now(),
    order_id uuid,
    actual_cost numeric(10,2),
    accuracy_percent numeric(5,2)
);


ALTER TABLE public.shipping_estimates OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 22010)
-- Name: estimate_accuracy_analysis; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.estimate_accuracy_analysis AS
 SELECT
        CASE
            WHEN (confidence >= 0.90) THEN 'Very High (90%+)'::text
            WHEN (confidence >= 0.80) THEN 'High (80-90%)'::text
            WHEN (confidence >= 0.70) THEN 'Medium (70-80%)'::text
            ELSE 'Low (<70%)'::text
        END AS confidence_range,
    count(*) AS estimate_count,
    avg(estimated_cost) AS avg_estimated,
    avg(actual_cost) AS avg_actual,
    avg(abs((estimated_cost - actual_cost))) AS avg_difference,
    avg(accuracy_percent) AS avg_accuracy_percent,
    count(*) FILTER (WHERE (abs((estimated_cost - actual_cost)) <= (50)::numeric)) AS within_50_rupees,
    round((((count(*) FILTER (WHERE (abs((estimated_cost - actual_cost)) <= (50)::numeric)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS within_50_percent
   FROM public.shipping_estimates
  WHERE (actual_cost IS NOT NULL)
  GROUP BY
        CASE
            WHEN (confidence >= 0.90) THEN 'Very High (90%+)'::text
            WHEN (confidence >= 0.80) THEN 'High (80-90%)'::text
            WHEN (confidence >= 0.70) THEN 'Medium (70-80%)'::text
            ELSE 'Low (<70%)'::text
        END
  ORDER BY
        CASE
            WHEN (
            CASE
                WHEN (confidence >= 0.90) THEN 'Very High (90%+)'::text
                WHEN (confidence >= 0.80) THEN 'High (80-90%)'::text
                WHEN (confidence >= 0.70) THEN 'Medium (70-80%)'::text
                ELSE 'Low (<70%)'::text
            END = 'Very High (90%+)'::text) THEN 1
            WHEN (
            CASE
                WHEN (confidence >= 0.90) THEN 'Very High (90%+)'::text
                WHEN (confidence >= 0.80) THEN 'High (80-90%)'::text
                WHEN (confidence >= 0.70) THEN 'Medium (70-80%)'::text
                ELSE 'Low (<70%)'::text
            END = 'High (80-90%)'::text) THEN 2
            WHEN (
            CASE
                WHEN (confidence >= 0.90) THEN 'Very High (90%+)'::text
                WHEN (confidence >= 0.80) THEN 'High (80-90%)'::text
                WHEN (confidence >= 0.70) THEN 'Medium (70-80%)'::text
                ELSE 'Low (<70%)'::text
            END = 'Medium (70-80%)'::text) THEN 3
            ELSE 4
        END;


ALTER VIEW public.estimate_accuracy_analysis OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 21350)
-- Name: eta_predictions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.eta_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipment_id uuid,
    predicted_delivery timestamp with time zone,
    confidence_score numeric(3,2),
    delay_risk_score character varying(20),
    factors jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.eta_predictions OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 21323)
-- Name: exceptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exceptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exception_type character varying(50),
    severity character varying(20),
    shipment_id uuid,
    order_id uuid,
    description text,
    status character varying(50) DEFAULT 'open'::character varying,
    assigned_to uuid,
    resolution character varying(50),
    resolution_notes text,
    sla_impacted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    priority integer DEFAULT 5,
    escalation_level integer DEFAULT 0,
    escalated_at timestamp with time zone,
    escalated_to uuid,
    root_cause character varying(100),
    impact_assessment text,
    estimated_resolution_time timestamp with time zone
);


ALTER TABLE public.exceptions OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 21110)
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid,
    product_id uuid,
    available_quantity integer DEFAULT 0,
    reserved_quantity integer DEFAULT 0,
    damaged_quantity integer DEFAULT 0,
    last_stock_check timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    sku character varying(100),
    product_name character varying(255),
    quantity integer DEFAULT 0,
    bin_location character varying(50)
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 21641)
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid,
    shipment_id uuid,
    description text,
    item_type character varying(50),
    quantity integer DEFAULT 1,
    unit_price numeric(10,2),
    amount numeric(10,2),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.invoice_line_items OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 21381)
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number character varying(50) NOT NULL,
    carrier_id uuid,
    billing_period_start date,
    billing_period_end date,
    total_shipments integer,
    base_amount numeric(10,2),
    penalties numeric(10,2),
    adjustments numeric(10,2),
    final_amount numeric(10,2),
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    auto_generated boolean DEFAULT false,
    generation_job_id uuid,
    approved_at timestamp with time zone,
    approved_by uuid,
    payment_due_date date,
    payment_received_date date,
    payment_method character varying(50)
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 21815)
-- Name: job_execution_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_execution_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid,
    attempt_number integer,
    status character varying(50),
    error_message text,
    execution_time_ms integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);


ALTER TABLE public.job_execution_logs OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 21365)
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type character varying(50),
    title character varying(255),
    message text,
    link character varying(500),
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 21179)
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    product_id uuid,
    sku character varying(100),
    product_name character varying(255),
    quantity integer NOT NULL,
    unit_price numeric(10,2),
    weight numeric(10,2),
    warehouse_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    pick_status character varying(50) DEFAULT 'pending'::character varying,
    picked_at timestamp with time zone,
    picked_by uuid,
    pack_status character varying(50) DEFAULT 'pending'::character varying,
    packed_at timestamp with time zone,
    packed_by uuid,
    ship_status character varying(50) DEFAULT 'pending'::character varying,
    shipped_at timestamp with time zone
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 21569)
-- Name: order_splits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_splits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_order_id uuid,
    child_order_id uuid,
    warehouse_id uuid,
    split_reason character varying(255),
    items_count integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.order_splits OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 21160)
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number character varying(50),
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_phone character varying(20),
    status character varying(50) DEFAULT 'created'::character varying,
    priority character varying(20) DEFAULT 'standard'::character varying,
    total_amount numeric(10,2),
    currency character varying(3) DEFAULT 'USD'::character varying,
    shipping_address jsonb NOT NULL,
    billing_address jsonb,
    estimated_delivery timestamp with time zone,
    actual_delivery timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_order_id uuid,
    is_split boolean DEFAULT false,
    split_reason character varying(255),
    external_order_id character varying(100),
    platform character varying(50),
    tax_amount numeric(10,2) DEFAULT 0,
    shipping_amount numeric(10,2) DEFAULT 0,
    shipping_locked boolean DEFAULT false,
    shipping_locked_at timestamp with time zone,
    shipping_locked_by character varying(255)
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 20961)
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 21519)
-- Name: pick_list_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pick_list_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pick_list_id uuid,
    order_item_id uuid,
    product_id uuid,
    quantity_required integer NOT NULL,
    quantity_picked integer DEFAULT 0,
    location character varying(100),
    status character varying(50) DEFAULT 'pending'::character varying,
    picked_at timestamp with time zone
);


ALTER TABLE public.pick_list_items OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 21494)
-- Name: pick_lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pick_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pick_list_number character varying(50) NOT NULL,
    warehouse_id uuid,
    assigned_to uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    priority integer DEFAULT 5,
    total_items integer DEFAULT 0,
    picked_items integer DEFAULT 0,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.pick_lists OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 21081)
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100),
    weight numeric(10,2),
    dimensions jsonb,
    unit_price numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.products OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 21955)
-- Name: quote_idempotency_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_idempotency_cache (
    idempotency_key character varying(255) NOT NULL,
    result jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE public.quote_idempotency_cache OWNER TO postgres;

--
-- TOC entry 5158 (class 0 OID 0)
-- Dependencies: 262
-- Name: TABLE quote_idempotency_cache; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.quote_idempotency_cache IS 'Auto-cleanup query: DELETE FROM quote_idempotency_cache WHERE expires_at < NOW() - INTERVAL ''1 day''';


--
-- TOC entry 225 (class 1259 OID 21068)
-- Name: rate_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_id uuid,
    origin_state character varying(100),
    destination_state character varying(100),
    service_type character varying(50),
    base_rate numeric(10,2),
    per_kg_rate numeric(10,2),
    fuel_surcharge_pct numeric(5,2),
    effective_from date,
    effective_to date,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.rate_cards OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 21297)
-- Name: return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_id uuid,
    order_item_id uuid,
    product_id uuid,
    quantity integer NOT NULL,
    reason_detail text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.return_items OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 21269)
-- Name: returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rma_number character varying(50),
    order_id uuid,
    shipment_id uuid,
    reason character varying(255),
    status character varying(50) DEFAULT 'requested'::character varying,
    return_shipment_id uuid,
    quality_check_result character varying(50),
    refund_amount numeric(10,2),
    restocking_fee numeric(10,2),
    requested_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    pickup_scheduled_date timestamp with time zone,
    pickup_time_slot character varying(50),
    pickup_address jsonb,
    pickup_completed_at timestamp with time zone,
    inspection_notes text,
    refund_initiated_at timestamp with time zone,
    refund_completed_at timestamp with time zone,
    refund_method character varying(50),
    refund_reference character varying(100),
    external_return_id character varying(100),
    customer_name character varying(255),
    customer_email character varying(255),
    items jsonb
);


ALTER TABLE public.returns OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 21233)
-- Name: shipment_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipment_id uuid,
    event_type character varying(50) NOT NULL,
    location jsonb,
    description text,
    event_timestamp timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.shipment_events OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 21203)
-- Name: shipments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tracking_number character varying(100) NOT NULL,
    order_id uuid,
    carrier_id uuid,
    warehouse_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    origin_address jsonb,
    destination_address jsonb,
    weight numeric(10,2),
    dimensions jsonb,
    shipping_cost numeric(10,2),
    pickup_scheduled timestamp with time zone,
    pickup_actual timestamp with time zone,
    delivery_scheduled timestamp with time zone,
    delivery_actual timestamp with time zone,
    current_location jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tracking_events jsonb DEFAULT '[]'::jsonb,
    carrier_assignment_id uuid,
    route_geometry jsonb
);


ALTER TABLE public.shipments OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 21097)
-- Name: sla_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sla_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    service_type character varying(50),
    origin_region character varying(100),
    destination_region character varying(100),
    delivery_hours integer NOT NULL,
    penalty_per_hour numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sla_policies OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 21250)
-- Name: sla_violations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sla_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipment_id uuid,
    sla_policy_id uuid,
    promised_delivery timestamp with time zone,
    actual_delivery timestamp with time zone,
    delay_hours numeric(10,2),
    penalty_amount numeric(10,2),
    reason character varying(255),
    status character varying(50) DEFAULT 'open'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    violated_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    detected_at timestamp with time zone DEFAULT now(),
    detection_method character varying(50) DEFAULT 'automated'::character varying,
    penalty_calculated_at timestamp with time zone,
    penalty_approved_by uuid,
    penalty_applied boolean DEFAULT false,
    waiver_reason text
);


ALTER TABLE public.sla_violations OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 21134)
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid,
    product_id uuid,
    movement_type character varying(50),
    quantity integer NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 21429)
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
-- TOC entry 5159 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE user_notification_preferences; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_notification_preferences IS 'Stores user notification preferences for different channels and event types';


--
-- TOC entry 5160 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN user_notification_preferences.notification_types; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_notification_preferences.notification_types IS 'JSON object containing boolean flags for different notification types (orders, shipments, sla_alerts, exceptions, returns, system_updates)';


--
-- TOC entry 241 (class 1259 OID 21428)
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
-- TOC entry 5161 (class 0 OID 0)
-- Dependencies: 241
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_notification_preferences_id_seq OWNED BY public.user_notification_preferences.id;


--
-- TOC entry 221 (class 1259 OID 20999)
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    permission character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_permissions OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 21453)
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    session_token character varying(500) NOT NULL,
    device_name character varying(255),
    ip_address character varying(45),
    user_agent text,
    is_active boolean DEFAULT true,
    last_active timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- TOC entry 5162 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE user_sessions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_sessions IS 'Tracks active user sessions for security and session management';


--
-- TOC entry 5163 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN user_sessions.session_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_sessions.session_token IS 'JWT token for the session';


--
-- TOC entry 5164 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN user_sessions.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_sessions.is_active IS 'Whether the session is currently active (not revoked)';


--
-- TOC entry 243 (class 1259 OID 21452)
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_sessions_id_seq OWNER TO postgres;

--
-- TOC entry 5165 (class 0 OID 0)
-- Dependencies: 243
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- TOC entry 254 (class 1259 OID 21747)
-- Name: user_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_preferences jsonb DEFAULT '{}'::jsonb,
    ui_preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_settings OWNER TO postgres;

--
-- TOC entry 5166 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE user_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_settings IS 'User-specific settings and preferences';


--
-- TOC entry 220 (class 1259 OID 20975)
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
    is_active boolean DEFAULT true,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['superadmin'::character varying, 'admin'::character varying, 'operations_manager'::character varying, 'warehouse_manager'::character varying, 'carrier_partner'::character varying, 'finance'::character varying, 'customer_support'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 21029)
-- Name: warehouses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    address jsonb NOT NULL,
    capacity integer,
    manager_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.warehouses OWNER TO postgres;

--
-- TOC entry 4604 (class 2604 OID 21432)
-- Name: user_notification_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_notification_preferences_id_seq'::regclass);


--
-- TOC entry 4611 (class 2604 OID 21456)
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- TOC entry 5124 (class 0 OID 21696)
-- Dependencies: 252
-- Data for Name: alert_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alert_rules (id, name, rule_type, severity, message_template, threshold, conditions, assigned_users, assigned_roles, escalation_enabled, escalation_delay_minutes, is_active, priority, created_by, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5125 (class 0 OID 21721)
-- Dependencies: 253
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alerts (id, rule_id, rule_name, alert_type, severity, message, data, status, triggered_at, acknowledged_by, acknowledged_at, resolved_by, resolved_at, resolution) FROM stdin;
\.


--
-- TOC entry 5121 (class 0 OID 21608)
-- Dependencies: 249
-- Data for Name: allocation_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.allocation_history (id, order_id, order_item_id, warehouse_id, allocation_strategy, allocation_score, allocated_quantity, reason, created_at) FROM stdin;
\.


--
-- TOC entry 5120 (class 0 OID 21594)
-- Dependencies: 248
-- Data for Name: allocation_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.allocation_rules (id, name, priority, strategy, conditions, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 5094 (class 0 OID 21013)
-- Dependencies: 222
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, action, entity_type, entity_id, changes, ip_address, created_at) FROM stdin;
\.


--
-- TOC entry 5128 (class 0 OID 21793)
-- Dependencies: 256
-- Data for Name: background_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.background_jobs (id, job_type, priority, status, payload, result, error_message, retry_count, max_retries, scheduled_for, started_at, completed_at, created_by, created_at, updated_at) FROM stdin;
33a1b594-4703-40be-8d0b-962807b8aabb	process_return	3	completed	{"items": [{"sku": "SKU-7430", "name": "USB-C Cable", "price": "206.61", "quantity": 1, "condition": "damaged", "weight_lb": "2.87", "product_id": "PROD-1028", "return_reason": "not_as_described"}, {"sku": "SKU-9610", "name": "Webcam", "price": "83.39", "quantity": 1, "condition": "good", "weight_lb": "4.38", "product_id": "PROD-5133", "return_reason": "size_issue"}, {"sku": "SKU-3895", "name": "Phone Case", "price": "17.77", "quantity": 1, "condition": "good", "weight_lb": "4.87", "product_id": "PROD-214", "return_reason": "size_issue"}], "status": "pending_approval", "customer": {"id": "CUST-17827", "name": "Robert Garcia", "email": "customer6606@example.com"}, "return_id": "RET-1769764729912-722", "received_at": "2026-01-30T09:18:49.912Z", "refund_amount": "317.47", "pickup_address": {"zip": "42397", "city": "Los Angeles", "state": "CA", "street": "9330 Maple Dr", "country": "USA"}, "original_order_id": "ORD-1769159929912"}	{"success": true, "duration": "8ms", "returnId": "f0ff95ec-aaba-400a-8932-d83629cd83a3", "itemsCount": 3}	\N	0	3	2026-01-30 14:48:49.961+05:30	2026-01-30 14:48:51.942342+05:30	2026-01-30 14:48:51.961856+05:30	\N	2026-01-30 14:48:50.048713+05:30	2026-01-30 14:48:51.961856+05:30
e41c5e02-bc71-4ce6-9d9b-7587fca4a377	process_return	3	completed	{"items": [{"sku": "SKU-857", "name": "USB-C Cable", "price": "78.51", "quantity": 1, "condition": "damaged", "weight_lb": "1.76", "product_id": "PROD-4168", "return_reason": "damaged"}, {"sku": "SKU-9248", "name": "Mouse Pad", "price": "123.65", "quantity": 2, "condition": "damaged", "weight_lb": "2.23", "product_id": "PROD-4207", "return_reason": "defective"}], "status": "pending_approval", "customer": {"id": "CUST-1749", "name": "David Williams", "email": "customer5652@example.com"}, "return_id": "RET-1769764729912-611", "received_at": "2026-01-30T09:18:49.912Z", "refund_amount": "147.81", "pickup_address": {"zip": "74458", "city": "Houston", "state": "TX", "street": "44 Oak Ave", "country": "USA"}, "original_order_id": "ORD-1769159929912"}	{"success": true, "duration": "8ms", "returnId": "cd372dad-562f-49f3-a567-2811a5d4edf5", "itemsCount": 2}	\N	0	3	2026-01-30 14:48:49.962+05:30	2026-01-30 14:48:56.949274+05:30	2026-01-30 14:48:56.967092+05:30	\N	2026-01-30 14:48:50.050099+05:30	2026-01-30 14:48:56.967092+05:30
b625148f-5a2a-4865-a4e4-22ef29690013	process_return	3	completed	{"items": [{"sku": "SKU-2768", "name": "Mechanical Keyboard", "price": "174.04", "quantity": 5, "condition": "damaged", "weight_lb": "3.55", "product_id": "PROD-717", "return_reason": "customer_remorse"}, {"sku": "SKU-5547", "name": "Mechanical Keyboard", "price": "54.13", "quantity": 1, "condition": "good", "weight_lb": "2.72", "product_id": "PROD-9583", "return_reason": "size_issue"}], "status": "pending_approval", "customer": {"id": "CUST-47156", "name": "Emily Davis", "email": "customer5096@example.com"}, "return_id": "RET-1769764729908-516", "received_at": "2026-01-30T09:18:49.908Z", "refund_amount": "136.41", "pickup_address": {"zip": "18386", "city": "New York", "state": "NY", "street": "955 Pine Rd", "country": "USA"}, "original_order_id": "ORD-1769159929908"}	{"success": true, "duration": "8ms", "returnId": "c76313b0-c960-4927-ae7f-c46745f7106d", "itemsCount": 2}	\N	0	3	2026-01-30 14:48:49.957+05:30	2026-01-30 14:48:51.942307+05:30	2026-01-30 14:48:51.960893+05:30	\N	2026-01-30 14:48:50.054509+05:30	2026-01-30 14:48:51.960893+05:30
88742fad-080c-4f58-88bc-361099bf22bd	process_order	5	completed	{"order": {"items": [{"sku": "SKU-3691", "name": "Phone Case", "price": "123.90", "quantity": 3, "weight_lb": "3.63", "product_id": "PROD-4038"}, {"sku": "SKU-7528", "name": "Mechanical Keyboard", "price": "104.35", "quantity": 1, "weight_lb": "3.76", "product_id": "PROD-243"}, {"sku": "SKU-7740", "name": "Mouse Pad", "price": "177.49", "quantity": 4, "weight_lb": "2.67", "product_id": "PROD-1244"}, {"sku": "SKU-3352", "name": "Smart Watch", "price": "61.67", "quantity": 4, "weight_lb": "2.27", "product_id": "PROD-2388"}], "status": "confirmed", "platform": "amazon", "priority": "normal", "order_date": "2026-01-30T09:18:49.909Z", "tax_amount": 41.2, "marketplace": "amazon.com", "total_amount": 582.04, "customer_name": "Chris Brown", "customer_email": "customer6546@example.com", "customer_phone": "+14482895209", "shipping_amount": 10.54, "shipping_method": "standard", "shipping_address": {"zip": "91754", "city": "Phoenix", "state": "AZ", "street": "485 Maple Dr", "country": "USA"}, "external_order_id": "AMZ-1769764729909-93", "requested_carrier": "UPS"}, "source": "amazon", "event_type": "order.created", "received_at": "2026-01-30T09:18:49.909Z"}	{"orderId": "99ff9105-d8a7-4d35-8d29-b86562b0d614", "success": true, "duration": "13ms", "itemsCount": 4}	\N	0	3	2026-01-30 14:48:49.958+05:30	2026-01-30 14:49:06.962927+05:30	2026-01-30 14:49:06.983719+05:30	\N	2026-01-30 14:48:50.070645+05:30	2026-01-30 14:49:06.983719+05:30
184a3c80-18e2-443d-857d-fe093d2ce046	update_tracking	5	completed	{"events": [{"status": "picked_up", "location": "Warehouse - Chicago, IL", "timestamp": "2026-01-28T09:18:49.907Z"}, {"status": "in_transit", "location": "Distribution Center - Indianapolis, IN", "timestamp": "2026-01-29T09:18:49.907Z"}, {"status": "exception", "location": "San Diego, CA", "timestamp": "2026-01-30T09:18:49.907Z"}], "status": "exception", "carrier": "FedEx", "location": "Los Angeles, CA", "received_at": "2026-01-30T09:18:49.907Z", "status_detail": "Delivery exception - weather delay", "actual_delivery": null, "tracking_number": "FED1769764729907400", "estimated_delivery": "2026-01-31T12:02:07.910Z"}	{"reason": "shipment_not_found", "success": false}	\N	0	3	2026-01-30 14:48:49.956+05:30	2026-01-30 14:49:06.962952+05:30	2026-01-30 14:49:06.977231+05:30	\N	2026-01-30 14:48:50.070864+05:30	2026-01-30 14:49:06.977231+05:30
a62c4ae8-8a12-45b3-8d0f-2d0ce0a094db	process_return	3	completed	{"items": [{"sku": "SKU-642", "name": "Monitor", "price": "46.73", "quantity": 4, "condition": "damaged", "weight_lb": "1.77", "product_id": "PROD-8630", "return_reason": "not_as_described"}, {"sku": "SKU-9316", "name": "Wireless Headphones", "price": "60.57", "quantity": 3, "condition": "good", "weight_lb": "4.66", "product_id": "PROD-131", "return_reason": "wrong_item"}], "status": "pending_approval", "customer": {"id": "CUST-13312", "name": "Emily Martinez", "email": "customer4930@example.com"}, "return_id": "RET-1769764729913-213", "received_at": "2026-01-30T09:18:49.913Z", "refund_amount": "203.98", "pickup_address": {"zip": "26754", "city": "Los Angeles", "state": "CA", "street": "1601 Main St", "country": "USA"}, "original_order_id": "ORD-1769159929913"}	{"success": true, "duration": "10ms", "returnId": "00fb6714-963a-4421-ae3c-44e3f6938e53", "itemsCount": 2}	\N	0	3	2026-01-30 14:48:49.963+05:30	2026-01-30 14:48:56.949348+05:30	2026-01-30 14:48:56.973599+05:30	\N	2026-01-30 14:48:50.072589+05:30	2026-01-30 14:48:56.973599+05:30
5898be04-f632-4309-ad63-c105f3a7c225	update_tracking	5	completed	{"events": [{"status": "picked_up", "location": "Warehouse - Chicago, IL", "timestamp": "2026-01-28T09:18:49.907Z"}, {"status": "in_transit", "location": "Distribution Center - Indianapolis, IN", "timestamp": "2026-01-29T09:18:49.907Z"}, {"status": "picked_up", "location": "San Diego, CA", "timestamp": "2026-01-30T09:18:49.907Z"}], "status": "picked_up", "carrier": "FedEx", "location": "Los Angeles, CA", "received_at": "2026-01-30T09:18:49.907Z", "status_detail": "Package picked up from warehouse", "actual_delivery": null, "tracking_number": "FED1769764729907274", "estimated_delivery": "2026-02-01T11:59:20.084Z"}	{"reason": "shipment_not_found", "success": false}	\N	0	3	2026-01-30 14:48:49.954+05:30	2026-01-30 14:49:06.962798+05:30	2026-01-30 14:49:06.974316+05:30	\N	2026-01-30 14:48:50.075994+05:30	2026-01-30 14:49:06.974316+05:30
12c483ca-4fb5-4d0d-a4ac-8b4e0055fb4b	process_rates	4	completed	{"rates": [{"rate": "47.96", "carrier": "FedEx", "service": "Express", "currency": "USD", "available": true, "delivery_date": "2026-02-06T09:18:49.875Z", "estimated_days": 4}, {"rate": "35.48", "carrier": "UPS", "service": "Express", "currency": "USD", "available": false, "delivery_date": "2026-01-31T09:18:49.875Z", "estimated_days": 1}, {"rate": "39.02", "carrier": "DHL", "service": "Express", "currency": "USD", "available": true, "delivery_date": "2026-02-04T09:18:49.875Z", "estimated_days": 6}, {"rate": "10.77", "carrier": "USPS", "service": "Ground", "currency": "USD", "available": true, "delivery_date": "2026-02-06T09:18:49.875Z", "estimated_days": 2}], "origin": {"zip": "55423", "city": "Phoenix", "state": "AZ", "street": "7353 Maple Dr", "country": "USA"}, "weight_lb": "46.70", "request_id": "RATE-1769764729875", "destination": {"zip": "62207", "city": "Chicago", "state": "IL", "street": "5855 Main St", "country": "USA"}, "received_at": "2026-01-30T09:18:49.874Z"}	{"success": true, "duration": "1ms", "ratesCount": 4, "request_id": "RATE-1769764729875"}	\N	0	3	2026-01-30 14:48:49.936+05:30	2026-01-30 14:48:56.94977+05:30	2026-01-30 14:48:56.970135+05:30	\N	2026-01-30 14:48:49.937113+05:30	2026-01-30 14:48:56.970135+05:30
7a4ccd61-2757-4265-8037-2d6d76e6a12f	process_order	1	completed	{"order": {"items": [{"sku": "SKU-3061", "name": "Mechanical Keyboard", "price": "128.92", "quantity": 3, "weight_lb": "3.81", "product_id": "PROD-7615"}], "status": "processing", "platform": "amazon", "priority": "high", "order_date": "2026-01-30T09:18:49.911Z", "tax_amount": 5.57, "marketplace": "amazon.com", "total_amount": 248.13, "customer_name": "Emily Johnson", "customer_email": "customer50@example.com", "customer_phone": "+17378109228", "shipping_amount": 11.82, "shipping_method": "standard", "shipping_address": {"zip": "23244", "city": "New York", "state": "NY", "street": "5825 Main St", "country": "USA"}, "external_order_id": "AMZ-1769764729911-290", "requested_carrier": "DHL"}, "source": "amazon", "event_type": "order.created", "received_at": "2026-01-30T09:18:49.911Z"}	{"orderId": "e101cd83-4181-401b-95a6-fd1b9db3bd34", "success": true, "duration": "13ms", "itemsCount": 1}	\N	0	3	2026-01-30 14:48:49.96+05:30	2026-01-30 14:48:51.94225+05:30	2026-01-30 14:48:51.969199+05:30	\N	2026-01-30 14:48:50.081018+05:30	2026-01-30 14:48:51.969199+05:30
8f73d012-3392-41fd-8310-2d06926dec46	process_order	1	completed	{"order": {"items": [{"sku": "SKU-6786", "name": "Phone Case", "price": "94.25", "quantity": 5, "weight_lb": "4.82", "product_id": "PROD-2392"}, {"sku": "SKU-1498", "name": "Webcam", "price": "122.90", "quantity": 3, "weight_lb": "3.01", "product_id": "PROD-8824"}, {"sku": "SKU-1414", "name": "Phone Case", "price": "99.98", "quantity": 4, "weight_lb": "1.22", "product_id": "PROD-5591"}], "status": "processing", "platform": "amazon", "priority": "high", "order_date": "2026-01-30T09:18:49.896Z", "tax_amount": 20.67, "marketplace": "amazon.com", "total_amount": 443.04, "customer_name": "David Johnson", "customer_email": "customer5713@example.com", "customer_phone": "+12752521841", "shipping_amount": 23.78, "shipping_method": "standard", "shipping_address": {"zip": "71466", "city": "Chicago", "state": "IL", "street": "3003 Main St", "country": "USA"}, "external_order_id": "AMZ-1769764729896-253", "requested_carrier": "DHL"}, "source": "amazon", "event_type": "order.created", "received_at": "2026-01-30T09:18:49.896Z"}	{"orderId": "c343226e-2076-4f35-9a57-34b4635252b8", "success": true, "duration": "12ms", "itemsCount": 3}	\N	0	3	2026-01-30 14:48:49.942+05:30	2026-01-30 14:48:51.942155+05:30	2026-01-30 14:48:51.963824+05:30	\N	2026-01-30 14:48:50.023279+05:30	2026-01-30 14:48:51.963824+05:30
4752eef2-871b-4776-8203-74fbe7e6ff78	sync_inventory	5	completed	{"items": [{"sku": "SKU-2098", "change": -9, "reason": "transfer", "bin_location": "B-5-5", "new_quantity": 2, "product_name": "Pro Device", "previous_quantity": 32}, {"sku": "SKU-2504", "change": 3, "reason": "transfer", "bin_location": "C-19-7", "new_quantity": 46, "product_name": "Ultra Tool", "previous_quantity": 58}, {"sku": "SKU-5096", "change": 5, "reason": "transfer", "bin_location": "A-14-2", "new_quantity": 55, "product_name": "Premium Tool", "previous_quantity": 63}, {"sku": "SKU-9100", "change": -4, "reason": "transfer", "bin_location": "E-16-4", "new_quantity": 38, "product_name": "Pro Tool", "previous_quantity": 52}, {"sku": "SKU-7640", "change": 10, "reason": "transfer", "bin_location": "B-3-4", "new_quantity": 54, "product_name": "Premium Device", "previous_quantity": 33}, {"sku": "SKU-1", "change": 13, "reason": "transfer", "bin_location": "D-12-3", "new_quantity": 39, "product_name": "Basic Tool", "previous_quantity": 32}, {"sku": "SKU-6132", "change": -7, "reason": "transfer", "bin_location": "A-9-3", "new_quantity": 8, "product_name": "Ultra Device", "previous_quantity": 70}], "notes": "Transfer operation completed", "updated_by": "USER-14", "received_at": "2026-01-30T09:18:49.893Z", "update_type": "transfer", "warehouse_id": "WH-001", "warehouse_name": "Warehouse WH-001"}	{"success": true, "duration": "27ms", "itemsUpdated": 7, "warehouse_id": "WH-001"}	\N	0	3	2026-01-30 14:48:49.938+05:30	2026-01-30 14:48:56.949867+05:30	2026-01-30 14:48:56.987643+05:30	\N	2026-01-30 14:48:50.024789+05:30	2026-01-30 14:48:56.987643+05:30
132ae432-1e33-4978-8cd9-dfb1e0758bc1	update_tracking	5	completed	{"events": [{"status": "picked_up", "location": "Warehouse - Chicago, IL", "timestamp": "2026-01-28T09:18:49.898Z"}, {"status": "in_transit", "location": "Distribution Center - Indianapolis, IN", "timestamp": "2026-01-29T09:18:49.898Z"}, {"status": "attempted_delivery", "location": "San Antonio, TX", "timestamp": "2026-01-30T09:18:49.898Z"}], "status": "attempted_delivery", "carrier": "FedEx", "location": "Phoenix, AZ", "received_at": "2026-01-30T09:18:49.898Z", "status_detail": "Delivery attempted - customer not available", "actual_delivery": null, "tracking_number": "FED1769764729898750", "estimated_delivery": "2026-02-05T22:15:42.934Z"}	{"reason": "shipment_not_found", "success": false}	\N	0	3	2026-01-30 14:48:49.942+05:30	2026-01-30 14:49:01.957674+05:30	2026-01-30 14:49:01.971122+05:30	\N	2026-01-30 14:48:50.023739+05:30	2026-01-30 14:49:01.971122+05:30
6e9099f9-5eec-464f-b186-9df695faa015	update_tracking	5	completed	{"events": [{"status": "picked_up", "location": "Warehouse - Chicago, IL", "timestamp": "2026-01-28T09:18:49.906Z"}, {"status": "in_transit", "location": "Distribution Center - Indianapolis, IN", "timestamp": "2026-01-29T09:18:49.906Z"}, {"status": "picked_up", "location": "New York, NY", "timestamp": "2026-01-30T09:18:49.906Z"}], "status": "picked_up", "carrier": "FedEx", "location": "San Diego, CA", "received_at": "2026-01-30T09:18:49.906Z", "status_detail": "Package picked up from warehouse", "actual_delivery": null, "tracking_number": "FED1769764729906303", "estimated_delivery": "2026-02-05T15:15:31.548Z"}	{"reason": "shipment_not_found", "success": false}	\N	0	3	2026-01-30 14:48:49.953+05:30	2026-01-30 14:49:06.96256+05:30	2026-01-30 14:49:06.975301+05:30	\N	2026-01-30 14:48:50.02671+05:30	2026-01-30 14:49:06.975301+05:30
d9ea3945-1aa4-4c63-87f0-740a70629b5e	update_tracking	5	completed	{"events": [{"status": "picked_up", "location": "Warehouse - Chicago, IL", "timestamp": "2026-01-28T09:18:49.903Z"}, {"status": "in_transit", "location": "Distribution Center - Indianapolis, IN", "timestamp": "2026-01-29T09:18:49.903Z"}, {"status": "attempted_delivery", "location": "San Antonio, TX", "timestamp": "2026-01-30T09:18:49.903Z"}], "status": "attempted_delivery", "carrier": "FedEx", "location": "Phoenix, AZ", "received_at": "2026-01-30T09:18:49.903Z", "status_detail": "Delivery attempted - customer not available", "actual_delivery": null, "tracking_number": "FED1769764729903379", "estimated_delivery": "2026-02-03T07:06:35.260Z"}	{"reason": "shipment_not_found", "success": false}	\N	0	3	2026-01-30 14:48:49.947+05:30	2026-01-30 14:49:01.957843+05:30	2026-01-30 14:49:01.972463+05:30	\N	2026-01-30 14:48:50.033344+05:30	2026-01-30 14:49:01.972463+05:30
78ad0fe5-8a70-4f84-a0bf-9a3b7115af3d	process_order	5	completed	{"order": {"items": [{"sku": "SKU-5581", "name": "Laptop Stand", "price": "181.07", "quantity": 3, "weight_lb": "4.73", "product_id": "PROD-4125"}, {"sku": "SKU-8959", "name": "Smart Watch", "price": "14.16", "quantity": 1, "weight_lb": "2.10", "product_id": "PROD-919"}, {"sku": "SKU-4568", "name": "Wireless Headphones", "price": "68.24", "quantity": 5, "weight_lb": "4.49", "product_id": "PROD-7699"}, {"sku": "SKU-6028", "name": "Mouse Pad", "price": "89.42", "quantity": 4, "weight_lb": "3.60", "product_id": "PROD-4167"}, {"sku": "SKU-860", "name": "Laptop Stand", "price": "37.35", "quantity": 3, "weight_lb": "3.96", "product_id": "PROD-877"}], "status": "processing", "platform": "amazon", "priority": "normal", "order_date": "2026-01-30T09:18:49.905Z", "tax_amount": 35.9, "marketplace": "amazon.com", "total_amount": 291.98, "customer_name": "Chris Smith", "customer_email": "customer1895@example.com", "customer_phone": "+12575611186", "shipping_amount": 9.72, "shipping_method": "standard", "shipping_address": {"zip": "52199", "city": "New York", "state": "NY", "street": "6006 Maple Dr", "country": "USA"}, "external_order_id": "AMZ-1769764729905-520", "requested_carrier": "DHL"}, "source": "amazon", "event_type": "order.created", "received_at": "2026-01-30T09:18:49.905Z"}	{"orderId": "b3a7c7fc-9658-427c-97bd-65b92dc319fc", "success": true, "duration": "11ms", "itemsCount": 5}	\N	0	3	2026-01-30 14:48:49.951+05:30	2026-01-30 14:49:06.962461+05:30	2026-01-30 14:49:06.978941+05:30	\N	2026-01-30 14:48:50.033566+05:30	2026-01-30 14:49:06.978941+05:30
13d7d592-fd5c-42b1-a8bd-1fee11d00ed4	process_rates	4	completed	{"rates": [{"rate": "16.13", "carrier": "FedEx", "service": "Ground", "currency": "USD", "available": true, "delivery_date": "2026-02-04T09:18:49.901Z", "estimated_days": 1}, {"rate": "12.27", "carrier": "UPS", "service": "Ground", "currency": "USD", "available": true, "delivery_date": "2026-02-04T09:18:49.901Z", "estimated_days": 2}, {"rate": "21.04", "carrier": "DHL", "service": "Express", "currency": "USD", "available": true, "delivery_date": "2026-02-06T09:18:49.901Z", "estimated_days": 1}, {"rate": "37.51", "carrier": "USPS", "service": "Express", "currency": "USD", "available": true, "delivery_date": "2026-02-05T09:18:49.901Z", "estimated_days": 4}], "origin": {"zip": "58763", "city": "Houston", "state": "TX", "street": "1578 Oak Ave", "country": "USA"}, "weight_lb": "40.72", "request_id": "RATE-1769764729901", "destination": {"zip": "80657", "city": "Los Angeles", "state": "CA", "street": "8139 Cedar Ln", "country": "USA"}, "received_at": "2026-01-30T09:18:49.901Z"}	{"success": true, "duration": "1ms", "ratesCount": 4, "request_id": "RATE-1769764729901"}	\N	0	3	2026-01-30 14:48:49.945+05:30	2026-01-30 14:48:56.949827+05:30	2026-01-30 14:48:56.962763+05:30	\N	2026-01-30 14:48:50.033823+05:30	2026-01-30 14:48:56.962763+05:30
8e0b43e9-4689-4aa7-b75c-b9929f1d9355	update_tracking	5	completed	{"events": [{"status": "picked_up", "location": "Warehouse - Chicago, IL", "timestamp": "2026-01-28T09:18:49.895Z"}, {"status": "in_transit", "location": "Distribution Center - Indianapolis, IN", "timestamp": "2026-01-29T09:18:49.895Z"}, {"status": "in_transit", "location": "San Antonio, TX", "timestamp": "2026-01-30T09:18:49.895Z"}], "status": "in_transit", "carrier": "FedEx", "location": "Los Angeles, CA", "received_at": "2026-01-30T09:18:49.895Z", "status_detail": "Package is in transit", "actual_delivery": null, "tracking_number": "FED1769764729895781", "estimated_delivery": "2026-02-01T22:24:52.548Z"}	{"reason": "shipment_not_found", "success": false}	\N	0	3	2026-01-30 14:48:49.94+05:30	2026-01-30 14:49:01.95756+05:30	2026-01-30 14:49:01.970544+05:30	\N	2026-01-30 14:48:50.035025+05:30	2026-01-30 14:49:01.970544+05:30
dbd9035b-4d95-4e58-8b46-3be399954dea	update_tracking	5	completed	{"events": [{"status": "picked_up", "location": "Warehouse - Chicago, IL", "timestamp": "2026-01-28T09:18:49.899Z"}, {"status": "in_transit", "location": "Distribution Center - Indianapolis, IN", "timestamp": "2026-01-29T09:18:49.899Z"}, {"status": "in_transit", "location": "San Antonio, TX", "timestamp": "2026-01-30T09:18:49.899Z"}], "status": "in_transit", "carrier": "FedEx", "location": "Philadelphia, PA", "received_at": "2026-01-30T09:18:49.899Z", "status_detail": "Package is in transit", "actual_delivery": null, "tracking_number": "FED1769764729899391", "estimated_delivery": "2026-02-02T15:51:45.795Z"}	{"reason": "shipment_not_found", "success": false}	\N	0	3	2026-01-30 14:48:49.943+05:30	2026-01-30 14:49:01.957743+05:30	2026-01-30 14:49:01.969978+05:30	\N	2026-01-30 14:48:50.033742+05:30	2026-01-30 14:49:01.969978+05:30
0710b587-e2e6-4838-b859-d3174ccfb142	sync_inventory	5	completed	{"items": [{"sku": "SKU-5927", "change": -19, "reason": "restock", "bin_location": "A-12-4", "new_quantity": 1, "product_name": "Basic Gadget", "previous_quantity": 42}, {"sku": "SKU-2989", "change": 23, "reason": "restock", "bin_location": "D-16-5", "new_quantity": 39, "product_name": "Pro Tool", "previous_quantity": 74}, {"sku": "SKU-1546", "change": -4, "reason": "restock", "bin_location": "C-2-8", "new_quantity": 82, "product_name": "Pro Widget", "previous_quantity": 30}, {"sku": "SKU-3618", "change": -3, "reason": "restock", "bin_location": "E-16-2", "new_quantity": 66, "product_name": "Premium Gadget", "previous_quantity": 45}, {"sku": "SKU-2627", "change": 2, "reason": "restock", "bin_location": "D-12-3", "new_quantity": 7, "product_name": "Essential Tool", "previous_quantity": 32}, {"sku": "SKU-6677", "change": -16, "reason": "restock", "bin_location": "B-18-3", "new_quantity": 39, "product_name": "Essential Device", "previous_quantity": 62}, {"sku": "SKU-2527", "change": -6, "reason": "restock", "bin_location": "C-8-6", "new_quantity": 88, "product_name": "Pro Device", "previous_quantity": 67}, {"sku": "SKU-8494", "change": -25, "reason": "restock", "bin_location": "E-15-8", "new_quantity": 34, "product_name": "Premium Tool", "previous_quantity": 54}, {"sku": "SKU-3977", "change": -19, "reason": "restock", "bin_location": "B-16-5", "new_quantity": 64, "product_name": "Ultra Item", "previous_quantity": 57}], "notes": "Restock operation completed", "updated_by": "USER-65", "received_at": "2026-01-30T09:18:49.904Z", "update_type": "restock", "warehouse_id": "WH-001", "warehouse_name": "Warehouse WH-001"}	{"success": true, "duration": "24ms", "itemsUpdated": 9, "warehouse_id": "WH-001"}	\N	0	3	2026-01-30 14:48:49.949+05:30	2026-01-30 14:49:01.957875+05:30	2026-01-30 14:49:01.992559+05:30	\N	2026-01-30 14:48:50.034712+05:30	2026-01-30 14:49:01.992559+05:30
54b6523b-9485-4b90-acf9-6819f83c7b3b	process_return	3	completed	{"items": [{"sku": "SKU-8303", "name": "Smart Watch", "price": "125.66", "quantity": 5, "condition": "damaged", "weight_lb": "3.52", "product_id": "PROD-9475", "return_reason": "not_as_described"}], "status": "pending_approval", "customer": {"id": "CUST-86318", "name": "David Rodriguez", "email": "customer6363@example.com"}, "return_id": "RET-1769764729900-42", "received_at": "2026-01-30T09:18:49.900Z", "refund_amount": "255.60", "pickup_address": {"zip": "93841", "city": "Chicago", "state": "IL", "street": "6111 Cedar Ln", "country": "USA"}, "original_order_id": "ORD-1769159929900"}	{"success": true, "duration": "10ms", "returnId": "5e060bab-4b53-4728-adcf-5a6a8c3a8ed5", "itemsCount": 1}	\N	0	3	2026-01-30 14:48:49.944+05:30	2026-01-30 14:48:51.942272+05:30	2026-01-30 14:48:51.964543+05:30	\N	2026-01-30 14:48:50.048194+05:30	2026-01-30 14:48:51.964543+05:30
\.


--
-- TOC entry 5131 (class 0 OID 21876)
-- Dependencies: 259
-- Data for Name: carrier_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_assignments (id, order_id, carrier_id, service_type, status, pickup_address, delivery_address, estimated_pickup, estimated_delivery, special_instructions, request_payload, acceptance_payload, carrier_reference_id, rejected_reason, requested_at, assigned_at, accepted_at, expires_at, created_at, updated_at, idempotency_key) FROM stdin;
cbcdc0c8-f663-47af-9299-955ab7484800	7fc3c3d0-1ecf-4b9d-b84e-326a95c82616	ff66fdc5-6db6-4a0c-94c8-345119fdd53b	standard	pending	{"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}	{"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}	2026-02-14 00:23:24.718+05:30	2026-02-14 22:23:24.718+05:30	\N	{"items": [{"sku": "SKU-1771001604663", "quantity": 1, "unit_price": 10000, "product_name": "Phone"}], "orderId": "7fc3c3d0-1ecf-4b9d-b84e-326a95c82616", "orderNumber": "ORD-1771001604705", "requestedAt": "2026-02-13T16:53:24.717Z", "serviceType": "standard", "totalAmount": 10000, "customerName": "Jeel", "customerEmail": "jeel@gmail.com", "customerPhone": "9876543210", "shippingAddress": {"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}}	\N	\N	\N	2026-02-13 22:23:24.703402+05:30	\N	\N	2026-02-14 22:23:24.717+05:30	2026-02-13 22:23:24.703402+05:30	2026-02-13 22:23:24.703402+05:30	7fc3c3d0-1ecf-4b9d-b84e-326a95c82616-carrier-ff66fdc5-6db6-4a0c-94c8-345119fdd53b-1771001604717
9aee0287-ab3d-48e6-8723-0f740c420735	7fc3c3d0-1ecf-4b9d-b84e-326a95c82616	04628140-8ced-4eba-9705-d6f0d40fc915	standard	accepted	{"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}	{"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}	2026-02-14 00:23:24.712+05:30	2026-02-14 22:23:24.712+05:30	\N	{"items": [{"sku": "SKU-1771001604663", "quantity": 1, "unit_price": 10000, "product_name": "Phone"}], "orderId": "7fc3c3d0-1ecf-4b9d-b84e-326a95c82616", "orderNumber": "ORD-1771001604705", "requestedAt": "2026-02-13T16:53:24.712Z", "serviceType": "standard", "totalAmount": 10000, "customerName": "Jeel", "customerEmail": "jeel@gmail.com", "customerPhone": "9876543210", "shippingAddress": {"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}}	{"driverName": "Demo Driver", "driverPhone": "+91-9876543210", "vehicleInfo": "TN-01-AB-1234", "dispatchTime": "2026-02-13T16:53:38.976Z", "additionalInfo": "Service Type: standard, Quoted Price: ₹1500", "estimatedPickup": "2026-02-13T18:53:38.976Z", "estimatedDelivery": "2026-02-15T16:53:38.976Z", "carrierReferenceId": "DELHIVERY-1771001618976"}	DELHIVERY-1771001618976	\N	2026-02-13 22:23:24.703402+05:30	\N	2026-02-13 22:23:38.98267+05:30	2026-02-14 22:23:24.712+05:30	2026-02-13 22:23:24.703402+05:30	2026-02-13 22:23:24.703402+05:30	7fc3c3d0-1ecf-4b9d-b84e-326a95c82616-carrier-04628140-8ced-4eba-9705-d6f0d40fc915-1771001604712
1e82e112-e1cf-48fc-a0dd-35c164e747db	7fc3c3d0-1ecf-4b9d-b84e-326a95c82616	6f510335-bffd-4769-b121-40e5f2fe34ec	standard	pending	{"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}	{"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}	2026-02-14 00:23:24.722+05:30	2026-02-14 22:23:24.722+05:30	\N	{"items": [{"sku": "SKU-1771001604663", "quantity": 1, "unit_price": 10000, "product_name": "Phone"}], "orderId": "7fc3c3d0-1ecf-4b9d-b84e-326a95c82616", "orderNumber": "ORD-1771001604705", "requestedAt": "2026-02-13T16:53:24.722Z", "serviceType": "standard", "totalAmount": 10000, "customerName": "Jeel", "customerEmail": "jeel@gmail.com", "customerPhone": "9876543210", "shippingAddress": {"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}}	\N	\N	\N	2026-02-13 22:23:24.703402+05:30	\N	\N	2026-02-14 22:23:24.722+05:30	2026-02-13 22:23:24.703402+05:30	2026-02-13 22:23:24.703402+05:30	7fc3c3d0-1ecf-4b9d-b84e-326a95c82616-carrier-6f510335-bffd-4769-b121-40e5f2fe34ec-1771001604722
\.


--
-- TOC entry 5135 (class 0 OID 21970)
-- Dependencies: 263
-- Data for Name: carrier_capacity_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_capacity_log (id, carrier_id, capacity_snapshot, max_capacity, utilization_percent, logged_at) FROM stdin;
\.


--
-- TOC entry 5123 (class 0 OID 21662)
-- Dependencies: 251
-- Data for Name: carrier_performance_metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_performance_metrics (id, carrier_id, period_start, period_end, total_shipments, on_time_deliveries, late_deliveries, failed_deliveries, sla_violations, total_penalties, performance_score, reliability_score, calculated_at) FROM stdin;
\.


--
-- TOC entry 5132 (class 0 OID 21911)
-- Dependencies: 260
-- Data for Name: carrier_quotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_quotes (id, order_id, carrier_id, request_payload, quoted_price, estimated_delivery_time, carrier_service_id, created_at, valid_until, is_selected, response_time_ms, was_retried, selection_reason) FROM stdin;
\.


--
-- TOC entry 5133 (class 0 OID 21931)
-- Dependencies: 261
-- Data for Name: carrier_rejections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrier_rejections (id, order_id, carrier_name, carrier_code, reason, message, rejected_at, created_at, response_time_ms) FROM stdin;
\.


--
-- TOC entry 5096 (class 0 OID 21051)
-- Dependencies: 224
-- Data for Name: carriers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carriers (id, code, name, service_type, contact_email, contact_phone, reliability_score, is_active, created_at, updated_at, website, availability_status, last_status_change, api_endpoint, api_key_encrypted, api_version, current_load, max_capacity, daily_capacity) FROM stdin;
1f76632d-eb66-42d2-a4a1-bbd94973d315	FEDEX-001	FedEx India	express	operations@fedex.co.in	+91-1800-102-332	0.00	t	2026-01-30 23:36:12.004806+05:30	2026-01-30 23:36:12.004806+05:30	\N	offline	2026-01-30 23:36:12.004806+05:30	\N	\N	\N	0	\N	\N
ff66fdc5-6db6-4a0c-94c8-345119fdd53b	UPS-001	UPS Supply Chain Solutions	all	dispatch@ups-india.com	+91-1860-266-6877	0.00	t	2026-01-30 23:36:12.004806+05:30	2026-01-30 23:36:12.004806+05:30	\N	offline	2026-01-30 23:36:12.004806+05:30	\N	\N	\N	0	\N	\N
88119869-e994-4a75-b9f0-1b1149d3fa60	BLUEDART-001	Blue Dart Express	express	support@bluedart.com	+91-1860-233-3333	0.00	t	2026-01-30 23:36:12.004806+05:30	2026-01-30 23:36:12.004806+05:30	\N	offline	2026-01-30 23:36:12.004806+05:30	\N	\N	\N	0	\N	\N
6f510335-bffd-4769-b121-40e5f2fe34ec	DTDC-001	DTDC Courier & Cargo	standard	info@dtdc.com	+91-1860-208-0208	0.00	t	2026-01-30 23:36:12.004806+05:30	2026-01-30 23:36:12.004806+05:30	\N	offline	2026-01-30 23:36:12.004806+05:30	\N	\N	\N	0	\N	\N
adb3479b-8cb2-43f9-a1d9-6dd892d1e882	ECOM-001	Ecom Express	standard	ops@ecomexpress.in	+91-1800-1200-9030	0.00	t	2026-01-30 23:36:12.004806+05:30	2026-01-30 23:36:12.004806+05:30	\N	offline	2026-01-30 23:36:12.004806+05:30	\N	\N	\N	0	\N	\N
ac8e672e-e92e-4a79-8b9e-86a09d17a67b	DELHIVERY-001	Delhivery Logistics	all	support@delhivery.com	+91-1800-103-7878	0.00	t	2026-01-30 23:36:12.004806+05:30	2026-01-30 23:36:12.004806+05:30	\N	offline	2026-01-30 23:36:12.004806+05:30	\N	\N	\N	0	\N	\N
a0340a90-14a8-46b9-b3f3-ad5f61145cae	XPRESSBEES-001	Xpressbees Logistics	standard	operations@xpressbees.com	+91-1800-1233-303	0.00	t	2026-01-30 23:36:12.004806+05:30	2026-01-30 23:36:12.004806+05:30	\N	offline	2026-01-30 23:36:12.004806+05:30	\N	\N	\N	0	\N	\N
7ee88dc0-787b-4b4e-bee5-a1d3b43f99fd	DHL-001	DHL Express India	express	ops@dhl-india.com	+91-1800-111-345	0.00	t	2026-01-30 23:36:12.004806+05:30	2026-01-30 23:36:12.004806+05:30	\N	available	2026-01-30 23:56:05.257249+05:30	\N	\N	\N	0	\N	\N
db80d075-4006-4d1a-9154-d2f25a6dbd06	DHL	DHL Express India	express	\N	\N	0.92	t	2026-02-09 16:21:40.814084+05:30	2026-02-09 16:21:40.814084+05:30	\N	available	2026-02-09 16:21:40.814084+05:30	\N	\N	\N	0	\N	\N
aa3ec85a-b93c-4575-920b-e3145a0ebf46	FEDEX	FedEx India	express	\N	\N	0.88	t	2026-02-09 16:21:40.814084+05:30	2026-02-09 16:21:40.814084+05:30	\N	available	2026-02-09 16:21:40.814084+05:30	\N	\N	\N	0	\N	\N
465969ae-8749-4a7a-a969-c3859e46d386	BLUEDART	Blue Dart	express	\N	\N	0.85	t	2026-02-09 16:21:40.814084+05:30	2026-02-09 16:21:40.814084+05:30	\N	available	2026-02-09 16:21:40.814084+05:30	\N	\N	\N	0	\N	\N
04628140-8ced-4eba-9705-d6f0d40fc915	DELHIVERY	Delhivery	standard	\N	\N	0.82	t	2026-02-09 16:21:40.814084+05:30	2026-02-09 16:21:40.814084+05:30	\N	available	2026-02-09 16:21:40.814084+05:30	\N	\N	\N	0	\N	\N
\.


--
-- TOC entry 5130 (class 0 OID 21829)
-- Dependencies: 258
-- Data for Name: cron_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cron_schedules (id, name, job_type, cron_expression, payload, is_active, last_run_at, next_run_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5127 (class 0 OID 21775)
-- Dependencies: 255
-- Data for Name: dead_letter_queue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dead_letter_queue (id, original_job_id, job_type, payload, priority, error_message, retry_count, created_at, moved_to_dlq_at) FROM stdin;
\.


--
-- TOC entry 5110 (class 0 OID 21350)
-- Dependencies: 238
-- Data for Name: eta_predictions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.eta_predictions (id, shipment_id, predicted_delivery, confidence_score, delay_risk_score, factors, created_at) FROM stdin;
\.


--
-- TOC entry 5109 (class 0 OID 21323)
-- Dependencies: 237
-- Data for Name: exceptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exceptions (id, exception_type, severity, shipment_id, order_id, description, status, assigned_to, resolution, resolution_notes, sla_impacted, created_at, resolved_at, priority, escalation_level, escalated_at, escalated_to, root_cause, impact_assessment, estimated_resolution_time) FROM stdin;
\.


--
-- TOC entry 5100 (class 0 OID 21110)
-- Dependencies: 228
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory (id, warehouse_id, product_id, available_quantity, reserved_quantity, damaged_quantity, last_stock_check, created_at, updated_at, sku, product_name, quantity, bin_location) FROM stdin;
224f8e2b-8073-4b92-8e02-fd31c3ddb69c	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:48:56.968243+05:30	2026-01-30 14:48:56.968243+05:30	SKU-2098	Pro Device	2	B-5-5
0f1d185b-affa-4fe4-a5cc-9fa3cf80a9d4	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:48:56.976437+05:30	2026-01-30 14:48:56.976437+05:30	SKU-2504	Ultra Tool	46	C-19-7
c833a06f-8872-4972-9279-1d4cd7cce4bc	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:48:56.979055+05:30	2026-01-30 14:48:56.979055+05:30	SKU-5096	Premium Tool	55	A-14-2
a27dbc38-6189-4f49-bdb3-38f5983bf4f3	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:48:56.98143+05:30	2026-01-30 14:48:56.98143+05:30	SKU-9100	Pro Tool	38	E-16-4
d49a9069-bded-4148-b451-3d12a61a97bf	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:48:56.983168+05:30	2026-01-30 14:48:56.983168+05:30	SKU-7640	Premium Device	54	B-3-4
a1294c89-585b-4c63-b4a1-91e249e6e41e	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:48:56.984646+05:30	2026-01-30 14:48:56.984646+05:30	SKU-1	Basic Tool	39	D-12-3
dfa71f37-1a29-40da-b5cd-886d4c3fa6c8	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:48:56.985933+05:30	2026-01-30 14:48:56.985933+05:30	SKU-6132	Ultra Device	8	A-9-3
0a0ab5ee-3a78-45d9-8896-91f4f220cb36	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:49:01.97283+05:30	2026-01-30 14:49:01.97283+05:30	SKU-5927	Basic Gadget	1	A-12-4
2a90f8f4-ecbc-4c81-b069-6f6c1bea6a44	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:49:01.976497+05:30	2026-01-30 14:49:01.976497+05:30	SKU-2989	Pro Tool	39	D-16-5
1bcd0b87-618c-4b68-b57f-ee63582d4aa0	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:49:01.979948+05:30	2026-01-30 14:49:01.979948+05:30	SKU-1546	Pro Widget	82	C-2-8
9c65d83e-a070-4994-a950-368fd35a3b2e	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:49:01.982255+05:30	2026-01-30 14:49:01.982255+05:30	SKU-3618	Premium Gadget	66	E-16-2
1d45f746-eba1-434a-bae8-60f17b5491c2	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:49:01.984219+05:30	2026-01-30 14:49:01.984219+05:30	SKU-2627	Essential Tool	7	D-12-3
20ce5b19-5bee-4fb5-828d-bcf0d1201dd4	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:49:01.986106+05:30	2026-01-30 14:49:01.986106+05:30	SKU-6677	Essential Device	39	B-18-3
38e95ab0-231e-4b35-b0e9-7929f4473ced	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:49:01.987876+05:30	2026-01-30 14:49:01.987876+05:30	SKU-2527	Pro Device	88	C-8-6
7d7c058c-6b51-46ef-a383-24bcf40d9455	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:49:01.989594+05:30	2026-01-30 14:49:01.989594+05:30	SKU-8494	Premium Tool	34	E-15-8
6a07201a-a754-40a8-bcd9-a91462a70fac	336c9039-3503-47d8-b4f7-040bf3b94efe	\N	0	0	0	\N	2026-01-30 14:49:01.991091+05:30	2026-01-30 14:49:01.991091+05:30	SKU-3977	Ultra Item	64	B-16-5
\.


--
-- TOC entry 5122 (class 0 OID 21641)
-- Dependencies: 250
-- Data for Name: invoice_line_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_line_items (id, invoice_id, shipment_id, description, item_type, quantity, unit_price, amount, created_at) FROM stdin;
\.


--
-- TOC entry 5112 (class 0 OID 21381)
-- Dependencies: 240
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, invoice_number, carrier_id, billing_period_start, billing_period_end, total_shipments, base_amount, penalties, adjustments, final_amount, status, created_at, auto_generated, generation_job_id, approved_at, approved_by, payment_due_date, payment_received_date, payment_method) FROM stdin;
\.


--
-- TOC entry 5129 (class 0 OID 21815)
-- Dependencies: 257
-- Data for Name: job_execution_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.job_execution_logs (id, job_id, attempt_number, status, error_message, execution_time_ms, started_at, completed_at) FROM stdin;
2f5b342c-8de3-4523-a635-b5039f391f6b	e41c5e02-bc71-4ce6-9d9b-7587fca4a377	1	completed	\N	18	2026-01-30 14:48:56.949274+05:30	2026-01-30 14:48:56.967092+05:30
a5189bfb-360b-4e77-9648-489c5d8bebb0	d9ea3945-1aa4-4c63-87f0-740a70629b5e	1	completed	\N	15	2026-01-30 14:49:01.957843+05:30	2026-01-30 14:49:01.972463+05:30
f10d73c3-986c-4e17-8bed-8b53530986e4	5898be04-f632-4309-ad63-c105f3a7c225	1	completed	\N	12	2026-01-30 14:49:06.962798+05:30	2026-01-30 14:49:06.974316+05:30
bf6884ce-72bc-4560-b369-40e80a025378	a62c4ae8-8a12-45b3-8d0f-2d0ce0a094db	1	completed	\N	24	2026-01-30 14:48:56.949348+05:30	2026-01-30 14:48:56.973599+05:30
6f9e1c16-47fd-442d-a2f0-0a36e705c559	132ae432-1e33-4978-8cd9-dfb1e0758bc1	1	completed	\N	13	2026-01-30 14:49:01.957674+05:30	2026-01-30 14:49:01.971122+05:30
8b46a4de-7274-4d56-a585-fef0e0163fc0	6e9099f9-5eec-464f-b186-9df695faa015	1	completed	\N	13	2026-01-30 14:49:06.96256+05:30	2026-01-30 14:49:06.975301+05:30
d2640e0d-f3e5-48fa-b830-7886995033a9	12c483ca-4fb5-4d0d-a4ac-8b4e0055fb4b	1	completed	\N	20	2026-01-30 14:48:56.94977+05:30	2026-01-30 14:48:56.970135+05:30
46d76149-7750-45ad-881e-f20c4a0ab599	4752eef2-871b-4776-8203-74fbe7e6ff78	1	completed	\N	38	2026-01-30 14:48:56.949867+05:30	2026-01-30 14:48:56.987643+05:30
81d42541-94f2-458c-ae74-016f6b5baff4	dbd9035b-4d95-4e58-8b46-3be399954dea	1	completed	\N	12	2026-01-30 14:49:01.957743+05:30	2026-01-30 14:49:01.969978+05:30
338477c0-e960-42d6-9e54-1c891659fda5	8e0b43e9-4689-4aa7-b75c-b9929f1d9355	1	completed	\N	13	2026-01-30 14:49:01.95756+05:30	2026-01-30 14:49:01.970544+05:30
ca09391c-6311-4136-81e4-ea29e34a40cc	184a3c80-18e2-443d-857d-fe093d2ce046	1	completed	\N	14	2026-01-30 14:49:06.962952+05:30	2026-01-30 14:49:06.977231+05:30
c42c58f1-a20c-4e16-801f-e0641a8d3874	88742fad-080c-4f58-88bc-361099bf22bd	1	completed	\N	21	2026-01-30 14:49:06.962927+05:30	2026-01-30 14:49:06.983719+05:30
82816ed5-8d20-4c0d-a5e6-4b5b0cc267f8	13d7d592-fd5c-42b1-a8bd-1fee11d00ed4	1	completed	\N	13	2026-01-30 14:48:56.949827+05:30	2026-01-30 14:48:56.962763+05:30
555c2c0e-4275-487e-9f0c-c68fdc2e0ece	0710b587-e2e6-4838-b859-d3174ccfb142	1	completed	\N	35	2026-01-30 14:49:01.957875+05:30	2026-01-30 14:49:01.992559+05:30
e95b6417-d950-4458-a9de-a2c2def1dd64	78ad0fe5-8a70-4f84-a0bf-9a3b7115af3d	1	completed	\N	16	2026-01-30 14:49:06.962461+05:30	2026-01-30 14:49:06.978941+05:30
1c6ea99c-e379-4a12-ba4a-4a6317e5c2a4	54b6523b-9485-4b90-acf9-6819f83c7b3b	1	completed	\N	22	2026-01-30 14:48:51.942272+05:30	2026-01-30 14:48:51.964543+05:30
0ab165c5-0203-4958-91da-5aecff6ed350	8f73d012-3392-41fd-8310-2d06926dec46	1	completed	\N	22	2026-01-30 14:48:51.942155+05:30	2026-01-30 14:48:51.963824+05:30
77175a9b-0522-417b-8951-f6da8f79acbf	7a4ccd61-2757-4265-8037-2d6d76e6a12f	1	completed	\N	27	2026-01-30 14:48:51.94225+05:30	2026-01-30 14:48:51.969199+05:30
7e14250d-7b7c-4b33-94cc-156ec2242020	33a1b594-4703-40be-8d0b-962807b8aabb	1	completed	\N	20	2026-01-30 14:48:51.942342+05:30	2026-01-30 14:48:51.961856+05:30
7a58b244-5e6b-4d2d-bbe2-f6f038e4849d	b625148f-5a2a-4865-a4e4-22ef29690013	1	completed	\N	19	2026-01-30 14:48:51.942307+05:30	2026-01-30 14:48:51.960893+05:30
\.


--
-- TOC entry 5111 (class 0 OID 21365)
-- Dependencies: 239
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, title, message, link, is_read, created_at) FROM stdin;
\.


--
-- TOC entry 5103 (class 0 OID 21179)
-- Dependencies: 231
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, product_id, sku, product_name, quantity, unit_price, weight, warehouse_id, created_at, pick_status, picked_at, picked_by, pack_status, packed_at, packed_by, ship_status, shipped_at) FROM stdin;
2ef9b306-fd35-4d8b-bbbc-28795ed421ad	7fc3c3d0-1ecf-4b9d-b84e-326a95c82616	\N	SKU-1771001604663	Phone	1	10000.00	\N	\N	2026-02-13 22:23:24.703402+05:30	pending	\N	\N	pending	\N	\N	pending	\N
5f332028-083b-4985-85f0-afd70b16111f	0458358f-b760-4c92-9f1d-62b5d00ab40b	\N	SKU-1771003744235	Mobile	1	100000.00	\N	\N	2026-02-13 22:59:04.261047+05:30	pending	\N	\N	pending	\N	\N	pending	\N
5221708d-6ad7-42fe-8c99-478b55849a64	7b133623-9d9e-44fe-a2c1-1f6ae50011cc	\N	SKU-1771005391860	XYZ	1	1000.00	\N	\N	2026-02-13 23:26:31.880145+05:30	pending	\N	\N	pending	\N	\N	pending	\N
\.


--
-- TOC entry 5119 (class 0 OID 21569)
-- Dependencies: 247
-- Data for Name: order_splits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_splits (id, parent_order_id, child_order_id, warehouse_id, split_reason, items_count, created_at) FROM stdin;
\.


--
-- TOC entry 5102 (class 0 OID 21160)
-- Dependencies: 230
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, order_number, customer_name, customer_email, customer_phone, status, priority, total_amount, currency, shipping_address, billing_address, estimated_delivery, actual_delivery, notes, created_at, updated_at, parent_order_id, is_split, split_reason, external_order_id, platform, tax_amount, shipping_amount, shipping_locked, shipping_locked_at, shipping_locked_by) FROM stdin;
0458358f-b760-4c92-9f1d-62b5d00ab40b	ORD-1771003744263	omom	abc@gmail.com	8967452310	shipped	standard	100000.00	INR	{"city": "Anand", "state": "Gujarat", "street": "222", "country": "India", "postal_code": "300001"}	\N	\N	\N	\N	2026-02-13 22:59:04.261047+05:30	2026-02-13 22:59:04.261047+05:30	\N	f	\N	\N	\N	0.00	0.00	f	\N	\N
7b133623-9d9e-44fe-a2c1-1f6ae50011cc	ORD-1771005391880	Shubham	abc@gmail.com	8967452310	shipped	standard	1000.00	INR	{"city": "Anand", "state": "Gujarat", "street": "3232", "country": "India", "postal_code": "300001"}	\N	\N	\N	\N	2026-02-13 23:26:31.880145+05:30	2026-02-13 23:26:31.880145+05:30	\N	f	\N	\N	\N	0.00	0.00	f	\N	\N
7fc3c3d0-1ecf-4b9d-b84e-326a95c82616	ORD-1771001604705	Jeel	jeel@gmail.com	9876543210	shipped	standard	10000.00	INR	{"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}	\N	\N	\N	\N	2026-02-13 22:23:24.703402+05:30	2026-02-13 22:23:38.98267+05:30	\N	f	\N	\N	\N	0.00	0.00	f	\N	\N
\.


--
-- TOC entry 5091 (class 0 OID 20961)
-- Dependencies: 219
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, code, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5118 (class 0 OID 21519)
-- Dependencies: 246
-- Data for Name: pick_list_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pick_list_items (id, pick_list_id, order_item_id, product_id, quantity_required, quantity_picked, location, status, picked_at) FROM stdin;
\.


--
-- TOC entry 5117 (class 0 OID 21494)
-- Dependencies: 245
-- Data for Name: pick_lists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pick_lists (id, pick_list_number, warehouse_id, assigned_to, status, priority, total_items, picked_items, started_at, completed_at, created_at) FROM stdin;
\.


--
-- TOC entry 5098 (class 0 OID 21081)
-- Dependencies: 226
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, sku, name, category, weight, dimensions, unit_price, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5134 (class 0 OID 21955)
-- Dependencies: 262
-- Data for Name: quote_idempotency_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_idempotency_cache (idempotency_key, result, created_at, expires_at) FROM stdin;
\.


--
-- TOC entry 5097 (class 0 OID 21068)
-- Dependencies: 225
-- Data for Name: rate_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rate_cards (id, carrier_id, origin_state, destination_state, service_type, base_rate, per_kg_rate, fuel_surcharge_pct, effective_from, effective_to, created_at) FROM stdin;
\.


--
-- TOC entry 5108 (class 0 OID 21297)
-- Dependencies: 236
-- Data for Name: return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.return_items (id, return_id, order_item_id, product_id, quantity, reason_detail, created_at) FROM stdin;
\.


--
-- TOC entry 5107 (class 0 OID 21269)
-- Dependencies: 235
-- Data for Name: returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.returns (id, rma_number, order_id, shipment_id, reason, status, return_shipment_id, quality_check_result, refund_amount, restocking_fee, requested_at, resolved_at, created_at, pickup_scheduled_date, pickup_time_slot, pickup_address, pickup_completed_at, inspection_notes, refund_initiated_at, refund_completed_at, refund_method, refund_reference, external_return_id, customer_name, customer_email, items) FROM stdin;
c76313b0-c960-4927-ae7f-c46745f7106d	\N	\N	\N	\N	pending	\N	\N	136.41	\N	2026-01-30 14:48:51.953664+05:30	\N	2026-01-30 14:48:51.953664+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	RET-1769764729908-516	Emily Davis	customer5096@example.com	[{"sku": "SKU-2768", "name": "Mechanical Keyboard", "price": "174.04", "quantity": 5, "condition": "damaged", "weight_lb": "3.55", "product_id": "PROD-717", "return_reason": "customer_remorse"}, {"sku": "SKU-5547", "name": "Mechanical Keyboard", "price": "54.13", "quantity": 1, "condition": "good", "weight_lb": "2.72", "product_id": "PROD-9583", "return_reason": "size_issue"}]
f0ff95ec-aaba-400a-8932-d83629cd83a3	\N	\N	\N	\N	pending	\N	\N	317.47	\N	2026-01-30 14:48:51.954472+05:30	\N	2026-01-30 14:48:51.954472+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	RET-1769764729912-722	Robert Garcia	customer6606@example.com	[{"sku": "SKU-7430", "name": "USB-C Cable", "price": "206.61", "quantity": 1, "condition": "damaged", "weight_lb": "2.87", "product_id": "PROD-1028", "return_reason": "not_as_described"}, {"sku": "SKU-9610", "name": "Webcam", "price": "83.39", "quantity": 1, "condition": "good", "weight_lb": "4.38", "product_id": "PROD-5133", "return_reason": "size_issue"}, {"sku": "SKU-3895", "name": "Phone Case", "price": "17.77", "quantity": 1, "condition": "good", "weight_lb": "4.87", "product_id": "PROD-214", "return_reason": "size_issue"}]
5e060bab-4b53-4728-adcf-5a6a8c3a8ed5	\N	\N	\N	\N	pending	\N	\N	255.60	\N	2026-01-30 14:48:51.955129+05:30	\N	2026-01-30 14:48:51.955129+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	RET-1769764729900-42	David Rodriguez	customer6363@example.com	[{"sku": "SKU-8303", "name": "Smart Watch", "price": "125.66", "quantity": 5, "condition": "damaged", "weight_lb": "3.52", "product_id": "PROD-9475", "return_reason": "not_as_described"}]
cd372dad-562f-49f3-a567-2811a5d4edf5	\N	\N	\N	\N	pending	\N	\N	147.81	\N	2026-01-30 14:48:56.959667+05:30	\N	2026-01-30 14:48:56.959667+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	RET-1769764729912-611	David Williams	customer5652@example.com	[{"sku": "SKU-857", "name": "USB-C Cable", "price": "78.51", "quantity": 1, "condition": "damaged", "weight_lb": "1.76", "product_id": "PROD-4168", "return_reason": "damaged"}, {"sku": "SKU-9248", "name": "Mouse Pad", "price": "123.65", "quantity": 2, "condition": "damaged", "weight_lb": "2.23", "product_id": "PROD-4207", "return_reason": "defective"}]
00fb6714-963a-4421-ae3c-44e3f6938e53	\N	\N	\N	\N	pending	\N	\N	203.98	\N	2026-01-30 14:48:56.963796+05:30	\N	2026-01-30 14:48:56.963796+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	RET-1769764729913-213	Emily Martinez	customer4930@example.com	[{"sku": "SKU-642", "name": "Monitor", "price": "46.73", "quantity": 4, "condition": "damaged", "weight_lb": "1.77", "product_id": "PROD-8630", "return_reason": "not_as_described"}, {"sku": "SKU-9316", "name": "Wireless Headphones", "price": "60.57", "quantity": 3, "condition": "good", "weight_lb": "4.66", "product_id": "PROD-131", "return_reason": "wrong_item"}]
\.


--
-- TOC entry 5105 (class 0 OID 21233)
-- Dependencies: 233
-- Data for Name: shipment_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipment_events (id, shipment_id, event_type, location, description, event_timestamp, created_at) FROM stdin;
1545e832-bfeb-464b-a1de-ebf2f157f433	a627de2d-4534-4250-9aec-a23aa55814c0	pending	{"city": "TBD", "state": "TBD", "street": "TBD", "country": "US", "postal_code": "00000"}	Shipment created and pending pickup	2026-02-13 22:59:04.261047+05:30	2026-02-13 22:59:04.261047+05:30
c96eea8b-615b-468e-b5d0-df8a6e102ed0	868c0443-25e1-4c78-8eeb-e9607a7bce24	pending	{"city": "TBD", "state": "TBD", "street": "TBD", "country": "US", "postal_code": "00000"}	Shipment created and pending pickup	2026-02-13 23:26:31.880145+05:30	2026-02-13 23:26:31.880145+05:30
\.


--
-- TOC entry 5104 (class 0 OID 21203)
-- Dependencies: 232
-- Data for Name: shipments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipments (id, tracking_number, order_id, carrier_id, warehouse_id, status, origin_address, destination_address, weight, dimensions, shipping_cost, pickup_scheduled, pickup_actual, delivery_scheduled, delivery_actual, current_location, created_at, updated_at, tracking_events, carrier_assignment_id, route_geometry) FROM stdin;
6a1542c4-770d-4e5c-aed7-c679df655591	TRACK-1771001618987-5dud2cggt	7fc3c3d0-1ecf-4b9d-b84e-326a95c82616	04628140-8ced-4eba-9705-d6f0d40fc915	\N	pending	{"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}	{"city": "Anand", "state": "Gujarat", "street": "123", "country": "India", "postal_code": "40001"}	\N	\N	\N	\N	\N	2026-02-15 22:23:38.976+05:30	\N	\N	2026-02-13 22:23:38.98267+05:30	2026-02-13 22:23:38.98267+05:30	[]	9aee0287-ab3d-48e6-8723-0f740c420735	\N
a627de2d-4534-4250-9aec-a23aa55814c0	TRK-1771003744268-1296	0458358f-b760-4c92-9f1d-62b5d00ab40b	04628140-8ced-4eba-9705-d6f0d40fc915	336c9039-3503-47d8-b4f7-040bf3b94efe	pending	{"city": "TBD", "state": "TBD", "street": "TBD", "country": "US", "postal_code": "00000"}	{"city": "Anand", "state": "Gujarat", "street": "222", "country": "India", "postal_code": "300001"}	\N	\N	\N	2026-02-13 22:59:04.261047+05:30	\N	2026-02-16 22:59:04.261047+05:30	\N	\N	2026-02-13 22:59:04.261047+05:30	2026-02-13 22:59:04.261047+05:30	[]	\N	\N
868c0443-25e1-4c78-8eeb-e9607a7bce24	TRK-1771005391883-1327	7b133623-9d9e-44fe-a2c1-1f6ae50011cc	04628140-8ced-4eba-9705-d6f0d40fc915	336c9039-3503-47d8-b4f7-040bf3b94efe	pending	{"city": "TBD", "state": "TBD", "street": "TBD", "country": "US", "postal_code": "00000"}	{"city": "Anand", "state": "Gujarat", "street": "3232", "country": "India", "postal_code": "300001"}	\N	\N	\N	2026-02-13 23:26:31.880145+05:30	\N	2026-02-16 23:26:31.880145+05:30	\N	\N	2026-02-13 23:26:31.880145+05:30	2026-02-13 23:26:31.880145+05:30	[]	\N	\N
\.


--
-- TOC entry 5136 (class 0 OID 21984)
-- Dependencies: 264
-- Data for Name: shipping_estimates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipping_estimates (id, session_id, from_pincode, to_pincode, weight_kg, service_type, estimated_cost, min_cost, max_cost, confidence, created_at, order_id, actual_cost, accuracy_percent) FROM stdin;
\.


--
-- TOC entry 5099 (class 0 OID 21097)
-- Dependencies: 227
-- Data for Name: sla_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sla_policies (id, name, service_type, origin_region, destination_region, delivery_hours, penalty_per_hour, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 5106 (class 0 OID 21250)
-- Dependencies: 234
-- Data for Name: sla_violations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sla_violations (id, shipment_id, sla_policy_id, promised_delivery, actual_delivery, delay_hours, penalty_amount, reason, status, created_at, violated_at, resolved_at, detected_at, detection_method, penalty_calculated_at, penalty_approved_by, penalty_applied, waiver_reason) FROM stdin;
\.


--
-- TOC entry 5101 (class 0 OID 21134)
-- Dependencies: 229
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movements (id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, notes, created_by, created_at) FROM stdin;
\.


--
-- TOC entry 5114 (class 0 OID 21429)
-- Dependencies: 242
-- Data for Name: user_notification_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_notification_preferences (id, user_id, email_enabled, push_enabled, sms_enabled, notification_types, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5093 (class 0 OID 20999)
-- Dependencies: 221
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_permissions (id, user_id, permission, created_at) FROM stdin;
\.


--
-- TOC entry 5116 (class 0 OID 21453)
-- Dependencies: 244
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_sessions (id, user_id, session_token, device_name, ip_address, user_agent, is_active, last_active, created_at, expires_at) FROM stdin;
\.


--
-- TOC entry 5126 (class 0 OID 21747)
-- Dependencies: 254
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_settings (id, user_id, notification_preferences, ui_preferences, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5092 (class 0 OID 20975)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, name, role, organization_id, avatar, is_active, last_login, created_at, updated_at) FROM stdin;
426c3c8b-e8cd-40a1-a9d7-f8ff04989bc1	wh2@logitower.com	$2b$10$demoHashedPassword	Priya Warehouse	warehouse_manager	\N	\N	t	\N	2026-01-17 20:14:14.967887+05:30	2026-01-17 20:14:14.967887+05:30
19ac65a4-d314-4bac-b401-7aeecd05a355	finance@logitower.com	$2b$10$demoHashedPassword	Alice Finance	finance	\N	\N	t	\N	2026-01-17 20:14:14.967887+05:30	2026-01-17 20:14:14.967887+05:30
42b94f06-000c-4deb-9265-d4810bc798b9	support@logitower.com	$2b$10$demoHashedPassword	Bob Support	customer_support	\N	\N	t	\N	2026-01-17 20:14:14.967887+05:30	2026-01-17 20:14:14.967887+05:30
f5bfdb0a-8eca-4ae8-b783-8b5161e93f04	admin@acme.com	$2b$10$demoHashedPassword	Acme Admin	admin	\N	\N	t	\N	2026-01-17 20:14:14.967887+05:30	2026-01-17 20:14:14.967887+05:30
b82e49aa-0255-41a4-8390-175377691518	carrier@twinchain.com	$2b$10$v/IPyY0MQ6Qb7MIXL6gMV.naIIk9FwjlOsynXv.GaWlpD7zc93Fh.	DHL Partner	carrier_partner	\N	\N	t	2026-02-13 22:51:53.266675+05:30	2026-01-17 20:14:14.967887+05:30	2026-01-17 20:14:14.967887+05:30
5f24f6ba-8704-4646-be21-8cfbb42cc4d2	ops@twinchain.com	$2b$10$v/IPyY0MQ6Qb7MIXL6gMV.naIIk9FwjlOsynXv.GaWlpD7zc93Fh.	Manav	operations_manager	\N	https://api.dicebear.com/7.x/avataaars/svg?seed=John	t	2026-02-14 09:57:36.645184+05:30	2026-01-17 20:14:14.967887+05:30	2026-01-17 20:14:14.967887+05:30
7dfd3c6f-131e-4374-8f87-e417615935af	admin@twinchain.com	$2b$10$v/IPyY0MQ6Qb7MIXL6gMV.naIIk9FwjlOsynXv.GaWlpD7zc93Fh.	Jeel	admin	\N	https://api.dicebear.com/7.x/avataaars/svg?seed=John	t	2026-02-14 11:40:24.986429+05:30	2026-01-17 20:14:14.967887+05:30	2026-01-17 20:14:14.967887+05:30
eae1dda2-7f08-4d14-a27b-dd9f29a63d37	superadmin@twinchain.in	$2b$10$demoHashedPassword	Super Admin	superadmin	\N	https://api.dicebear.com/7.x/avataaars/svg?seed=SuperAdmin	t	\N	2026-02-16 14:03:06.391702+05:30	2026-02-16 14:03:06.391702+05:30
5307606e-326c-4f1f-8d41-0cbeacb4cd35	wh1@twinchain.com	$2b$10$v/IPyY0MQ6Qb7MIXL6gMV.naIIk9FwjlOsynXv.GaWlpD7zc93Fh.	Luis Warehouse	warehouse_manager	\N	\N	t	\N	2026-01-17 20:14:14.967887+05:30	2026-01-17 20:14:14.967887+05:30
\.


--
-- TOC entry 5095 (class 0 OID 21029)
-- Dependencies: 223
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouses (id, code, name, address, capacity, manager_id, is_active, created_at, updated_at) FROM stdin;
336c9039-3503-47d8-b4f7-040bf3b94efe	WH-001	Warehouse WH-001	{"city": "TBD", "state": "TBD", "street": "TBD", "country": "US", "postal_code": "00000"}	\N	\N	t	2026-01-30 14:48:56.96485+05:30	2026-01-30 14:48:56.96485+05:30
\.


--
-- TOC entry 5167 (class 0 OID 0)
-- Dependencies: 241
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_notification_preferences_id_seq', 1, false);


--
-- TOC entry 5168 (class 0 OID 0)
-- Dependencies: 243
-- Name: user_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_sessions_id_seq', 1, false);


--
-- TOC entry 4814 (class 2606 OID 21715)
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 4818 (class 2606 OID 21731)
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 4802 (class 2606 OID 21617)
-- Name: allocation_history allocation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_pkey PRIMARY KEY (id);


--
-- TOC entry 4800 (class 2606 OID 21607)
-- Name: allocation_rules allocation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_rules
    ADD CONSTRAINT allocation_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 4703 (class 2606 OID 21023)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4832 (class 2606 OID 21809)
-- Name: background_jobs background_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_pkey PRIMARY KEY (id);


--
-- TOC entry 4844 (class 2606 OID 22019)
-- Name: carrier_assignments carrier_assignments_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_idempotency_key_key UNIQUE (idempotency_key);


--
-- TOC entry 4846 (class 2606 OID 21888)
-- Name: carrier_assignments carrier_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 4867 (class 2606 OID 21977)
-- Name: carrier_capacity_log carrier_capacity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_capacity_log
    ADD CONSTRAINT carrier_capacity_log_pkey PRIMARY KEY (id);


--
-- TOC entry 4809 (class 2606 OID 21679)
-- Name: carrier_performance_metrics carrier_performance_metrics_carrier_id_period_start_period__key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_carrier_id_period_start_period__key UNIQUE (carrier_id, period_start, period_end);


--
-- TOC entry 4811 (class 2606 OID 21677)
-- Name: carrier_performance_metrics carrier_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_pkey PRIMARY KEY (id);


--
-- TOC entry 4853 (class 2606 OID 21920)
-- Name: carrier_quotes carrier_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_pkey PRIMARY KEY (id);


--
-- TOC entry 4858 (class 2606 OID 21944)
-- Name: carrier_rejections carrier_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_pkey PRIMARY KEY (id);


--
-- TOC entry 4709 (class 2606 OID 21067)
-- Name: carriers carriers_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_code_key UNIQUE (code);


--
-- TOC entry 4711 (class 2606 OID 21065)
-- Name: carriers carriers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_pkey PRIMARY KEY (id);


--
-- TOC entry 4841 (class 2606 OID 21843)
-- Name: cron_schedules cron_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cron_schedules
    ADD CONSTRAINT cron_schedules_pkey PRIMARY KEY (id);


--
-- TOC entry 4828 (class 2606 OID 21788)
-- Name: dead_letter_queue dead_letter_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dead_letter_queue
    ADD CONSTRAINT dead_letter_queue_pkey PRIMARY KEY (id);


--
-- TOC entry 4767 (class 2606 OID 21359)
-- Name: eta_predictions eta_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eta_predictions
    ADD CONSTRAINT eta_predictions_pkey PRIMARY KEY (id);


--
-- TOC entry 4762 (class 2606 OID 21334)
-- Name: exceptions exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_pkey PRIMARY KEY (id);


--
-- TOC entry 4723 (class 2606 OID 21121)
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 4725 (class 2606 OID 21123)
-- Name: inventory inventory_warehouse_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_warehouse_id_product_id_key UNIQUE (warehouse_id, product_id);


--
-- TOC entry 4807 (class 2606 OID 21651)
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4771 (class 2606 OID 21392)
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- TOC entry 4773 (class 2606 OID 21390)
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- TOC entry 4839 (class 2606 OID 21823)
-- Name: job_execution_logs job_execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_execution_logs
    ADD CONSTRAINT job_execution_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4769 (class 2606 OID 21375)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 4738 (class 2606 OID 21187)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4796 (class 2606 OID 21578)
-- Name: order_splits order_splits_parent_order_id_child_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_parent_order_id_child_order_id_key UNIQUE (parent_order_id, child_order_id);


--
-- TOC entry 4798 (class 2606 OID 21576)
-- Name: order_splits order_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_pkey PRIMARY KEY (id);


--
-- TOC entry 4734 (class 2606 OID 21178)
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- TOC entry 4736 (class 2606 OID 21176)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 4693 (class 2606 OID 20974)
-- Name: organizations organizations_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_code_key UNIQUE (code);


--
-- TOC entry 4695 (class 2606 OID 20972)
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- TOC entry 4792 (class 2606 OID 21528)
-- Name: pick_list_items pick_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4787 (class 2606 OID 21508)
-- Name: pick_lists pick_lists_pick_list_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_pick_list_number_key UNIQUE (pick_list_number);


--
-- TOC entry 4789 (class 2606 OID 21506)
-- Name: pick_lists pick_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_pkey PRIMARY KEY (id);


--
-- TOC entry 4715 (class 2606 OID 21094)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 4717 (class 2606 OID 21096)
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- TOC entry 4865 (class 2606 OID 21965)
-- Name: quote_idempotency_cache quote_idempotency_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_idempotency_cache
    ADD CONSTRAINT quote_idempotency_cache_pkey PRIMARY KEY (idempotency_key);


--
-- TOC entry 4713 (class 2606 OID 21075)
-- Name: rate_cards rate_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_pkey PRIMARY KEY (id);


--
-- TOC entry 4760 (class 2606 OID 21307)
-- Name: return_items return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4756 (class 2606 OID 21279)
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- TOC entry 4758 (class 2606 OID 21281)
-- Name: returns returns_rma_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_rma_number_key UNIQUE (rma_number);


--
-- TOC entry 4748 (class 2606 OID 21244)
-- Name: shipment_events shipment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4744 (class 2606 OID 21215)
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- TOC entry 4746 (class 2606 OID 21217)
-- Name: shipments shipments_tracking_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_tracking_number_key UNIQUE (tracking_number);


--
-- TOC entry 4871 (class 2606 OID 21991)
-- Name: shipping_estimates shipping_estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_pkey PRIMARY KEY (id);


--
-- TOC entry 4719 (class 2606 OID 21109)
-- Name: sla_policies sla_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_pkey PRIMARY KEY (id);


--
-- TOC entry 4753 (class 2606 OID 21258)
-- Name: sla_violations sla_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_pkey PRIMARY KEY (id);


--
-- TOC entry 4727 (class 2606 OID 21144)
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 4776 (class 2606 OID 21444)
-- Name: user_notification_preferences user_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id);


--
-- TOC entry 4778 (class 2606 OID 21446)
-- Name: user_notification_preferences user_notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_key UNIQUE (user_id);


--
-- TOC entry 4701 (class 2606 OID 21007)
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 4783 (class 2606 OID 21467)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4824 (class 2606 OID 21760)
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4826 (class 2606 OID 21762)
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- TOC entry 4697 (class 2606 OID 20993)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4699 (class 2606 OID 20991)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4705 (class 2606 OID 21045)
-- Name: warehouses warehouses_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_code_key UNIQUE (code);


--
-- TOC entry 4707 (class 2606 OID 21043)
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- TOC entry 4815 (class 1259 OID 21768)
-- Name: idx_alert_rules_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_rules_active ON public.alert_rules USING btree (is_active);


--
-- TOC entry 4816 (class 1259 OID 21769)
-- Name: idx_alert_rules_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_rules_type ON public.alert_rules USING btree (rule_type);


--
-- TOC entry 4819 (class 1259 OID 21771)
-- Name: idx_alerts_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_severity ON public.alerts USING btree (severity);


--
-- TOC entry 4820 (class 1259 OID 21770)
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);


--
-- TOC entry 4821 (class 1259 OID 21772)
-- Name: idx_alerts_triggered_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_triggered_at ON public.alerts USING btree (triggered_at);


--
-- TOC entry 4803 (class 1259 OID 21690)
-- Name: idx_allocation_history_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_history_order ON public.allocation_history USING btree (order_id);


--
-- TOC entry 4804 (class 1259 OID 21691)
-- Name: idx_allocation_history_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_history_warehouse ON public.allocation_history USING btree (warehouse_id);


--
-- TOC entry 4833 (class 1259 OID 21853)
-- Name: idx_background_jobs_job_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_background_jobs_job_type ON public.background_jobs USING btree (job_type);


--
-- TOC entry 4834 (class 1259 OID 21845)
-- Name: idx_background_jobs_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_background_jobs_priority ON public.background_jobs USING btree (priority, scheduled_for);


--
-- TOC entry 4835 (class 1259 OID 21852)
-- Name: idx_background_jobs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_background_jobs_status ON public.background_jobs USING btree (status);


--
-- TOC entry 4836 (class 1259 OID 21849)
-- Name: idx_background_jobs_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_background_jobs_type ON public.background_jobs USING btree (job_type);


--
-- TOC entry 4868 (class 1259 OID 21983)
-- Name: idx_capacity_log_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_capacity_log_time ON public.carrier_capacity_log USING btree (carrier_id, logged_at DESC);


--
-- TOC entry 4847 (class 1259 OID 21901)
-- Name: idx_carrier_assignments_carrier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_carrier_id ON public.carrier_assignments USING btree (carrier_id);


--
-- TOC entry 4848 (class 1259 OID 21902)
-- Name: idx_carrier_assignments_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_expires_at ON public.carrier_assignments USING btree (expires_at);


--
-- TOC entry 4849 (class 1259 OID 22020)
-- Name: idx_carrier_assignments_idempotency_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_idempotency_key ON public.carrier_assignments USING btree (idempotency_key);


--
-- TOC entry 4850 (class 1259 OID 21900)
-- Name: idx_carrier_assignments_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_order_id ON public.carrier_assignments USING btree (order_id);


--
-- TOC entry 4851 (class 1259 OID 21899)
-- Name: idx_carrier_assignments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_assignments_status ON public.carrier_assignments USING btree (status);


--
-- TOC entry 4812 (class 1259 OID 21693)
-- Name: idx_carrier_performance_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_performance_carrier ON public.carrier_performance_metrics USING btree (carrier_id);


--
-- TOC entry 4854 (class 1259 OID 22016)
-- Name: idx_carrier_quotes_carrier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_quotes_carrier_id ON public.carrier_quotes USING btree (carrier_id);


--
-- TOC entry 4855 (class 1259 OID 22017)
-- Name: idx_carrier_quotes_is_selected; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_quotes_is_selected ON public.carrier_quotes USING btree (is_selected);


--
-- TOC entry 4856 (class 1259 OID 22015)
-- Name: idx_carrier_quotes_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_quotes_order_id ON public.carrier_quotes USING btree (order_id);


--
-- TOC entry 4859 (class 1259 OID 21951)
-- Name: idx_carrier_rejections_carrier_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_carrier_code ON public.carrier_rejections USING btree (carrier_code);


--
-- TOC entry 4860 (class 1259 OID 21950)
-- Name: idx_carrier_rejections_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_order_id ON public.carrier_rejections USING btree (order_id);


--
-- TOC entry 4861 (class 1259 OID 21952)
-- Name: idx_carrier_rejections_reason; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_reason ON public.carrier_rejections USING btree (reason);


--
-- TOC entry 4862 (class 1259 OID 21953)
-- Name: idx_carrier_rejections_rejected_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_rejections_rejected_at ON public.carrier_rejections USING btree (rejected_at);


--
-- TOC entry 4842 (class 1259 OID 21848)
-- Name: idx_cron_schedules_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cron_schedules_active ON public.cron_schedules USING btree (is_active, next_run_at);


--
-- TOC entry 4829 (class 1259 OID 21790)
-- Name: idx_dead_letter_queue_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dead_letter_queue_created_at ON public.dead_letter_queue USING btree (created_at);


--
-- TOC entry 4830 (class 1259 OID 21789)
-- Name: idx_dead_letter_queue_job_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dead_letter_queue_job_type ON public.dead_letter_queue USING btree (job_type);


--
-- TOC entry 4763 (class 1259 OID 21695)
-- Name: idx_exceptions_escalation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_escalation ON public.exceptions USING btree (escalation_level);


--
-- TOC entry 4764 (class 1259 OID 21694)
-- Name: idx_exceptions_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_priority ON public.exceptions USING btree (priority, status);


--
-- TOC entry 4765 (class 1259 OID 21404)
-- Name: idx_exceptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exceptions_status ON public.exceptions USING btree (status);


--
-- TOC entry 4863 (class 1259 OID 21966)
-- Name: idx_idempotency_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_idempotency_expires ON public.quote_idempotency_cache USING btree (expires_at);


--
-- TOC entry 4720 (class 1259 OID 21402)
-- Name: idx_inventory_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_warehouse ON public.inventory USING btree (warehouse_id);


--
-- TOC entry 4721 (class 1259 OID 21875)
-- Name: idx_inventory_warehouse_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_inventory_warehouse_sku ON public.inventory USING btree (warehouse_id, sku);


--
-- TOC entry 4805 (class 1259 OID 21692)
-- Name: idx_invoice_line_items_invoice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_line_items_invoice ON public.invoice_line_items USING btree (invoice_id);


--
-- TOC entry 4837 (class 1259 OID 21847)
-- Name: idx_job_execution_logs_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_execution_logs_job_id ON public.job_execution_logs USING btree (job_id);


--
-- TOC entry 4793 (class 1259 OID 21689)
-- Name: idx_order_splits_child; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_splits_child ON public.order_splits USING btree (child_order_id);


--
-- TOC entry 4794 (class 1259 OID 21688)
-- Name: idx_order_splits_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_splits_parent ON public.order_splits USING btree (parent_order_id);


--
-- TOC entry 4728 (class 1259 OID 21399)
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at);


--
-- TOC entry 4729 (class 1259 OID 21856)
-- Name: idx_orders_external_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_external_order_id ON public.orders USING btree (external_order_id);


--
-- TOC entry 4730 (class 1259 OID 21857)
-- Name: idx_orders_platform; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_platform ON public.orders USING btree (platform);


--
-- TOC entry 4731 (class 1259 OID 21968)
-- Name: idx_orders_shipping_locked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_shipping_locked ON public.orders USING btree (shipping_locked) WHERE (shipping_locked = true);


--
-- TOC entry 4732 (class 1259 OID 21398)
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- TOC entry 4790 (class 1259 OID 21687)
-- Name: idx_pick_list_items_picklist; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_list_items_picklist ON public.pick_list_items USING btree (pick_list_id);


--
-- TOC entry 4784 (class 1259 OID 21686)
-- Name: idx_pick_lists_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_lists_status ON public.pick_lists USING btree (status);


--
-- TOC entry 4785 (class 1259 OID 21685)
-- Name: idx_pick_lists_warehouse; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pick_lists_warehouse ON public.pick_lists USING btree (warehouse_id);


--
-- TOC entry 4754 (class 1259 OID 21863)
-- Name: idx_returns_external_return_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_external_return_id ON public.returns USING btree (external_return_id);


--
-- TOC entry 4739 (class 1259 OID 21401)
-- Name: idx_shipments_carrier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_carrier ON public.shipments USING btree (carrier_id);


--
-- TOC entry 4740 (class 1259 OID 21908)
-- Name: idx_shipments_route_geometry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_route_geometry ON public.shipments USING gin (route_geometry);


--
-- TOC entry 4741 (class 1259 OID 21400)
-- Name: idx_shipments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_status ON public.shipments USING btree (status);


--
-- TOC entry 4742 (class 1259 OID 21861)
-- Name: idx_shipments_tracking_events; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipments_tracking_events ON public.shipments USING gin (tracking_events);


--
-- TOC entry 4869 (class 1259 OID 21997)
-- Name: idx_shipping_estimates_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipping_estimates_order ON public.shipping_estimates USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- TOC entry 4749 (class 1259 OID 21408)
-- Name: idx_sla_violations_resolved_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_resolved_at ON public.sla_violations USING btree (resolved_at);


--
-- TOC entry 4750 (class 1259 OID 21403)
-- Name: idx_sla_violations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_status ON public.sla_violations USING btree (status);


--
-- TOC entry 4751 (class 1259 OID 21407)
-- Name: idx_sla_violations_violated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sla_violations_violated_at ON public.sla_violations USING btree (violated_at);


--
-- TOC entry 4774 (class 1259 OID 21473)
-- Name: idx_user_preferences_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_preferences_user_id ON public.user_notification_preferences USING btree (user_id);


--
-- TOC entry 4779 (class 1259 OID 21475)
-- Name: idx_user_sessions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_active ON public.user_sessions USING btree (user_id, is_active);


--
-- TOC entry 4780 (class 1259 OID 21476)
-- Name: idx_user_sessions_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (session_token);


--
-- TOC entry 4781 (class 1259 OID 21474)
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- TOC entry 4822 (class 1259 OID 21773)
-- Name: idx_user_settings_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_settings_user_id ON public.user_settings USING btree (user_id);


--
-- TOC entry 4940 (class 2620 OID 21478)
-- Name: user_notification_preferences update_user_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_notification_preferences_updated_at BEFORE UPDATE ON public.user_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4926 (class 2606 OID 21716)
-- Name: alert_rules alert_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4927 (class 2606 OID 21737)
-- Name: alerts alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- TOC entry 4928 (class 2606 OID 21742)
-- Name: alerts alerts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- TOC entry 4929 (class 2606 OID 21732)
-- Name: alerts alerts_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id);


--
-- TOC entry 4920 (class 2606 OID 21618)
-- Name: allocation_history allocation_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 4921 (class 2606 OID 21623)
-- Name: allocation_history allocation_history_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- TOC entry 4922 (class 2606 OID 21628)
-- Name: allocation_history allocation_history_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocation_history
    ADD CONSTRAINT allocation_history_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 4874 (class 2606 OID 21024)
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4931 (class 2606 OID 21810)
-- Name: background_jobs background_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4933 (class 2606 OID 21894)
-- Name: carrier_assignments carrier_assignments_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 4934 (class 2606 OID 21889)
-- Name: carrier_assignments carrier_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_assignments
    ADD CONSTRAINT carrier_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 4938 (class 2606 OID 21978)
-- Name: carrier_capacity_log carrier_capacity_log_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_capacity_log
    ADD CONSTRAINT carrier_capacity_log_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 4925 (class 2606 OID 21680)
-- Name: carrier_performance_metrics carrier_performance_metrics_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_performance_metrics
    ADD CONSTRAINT carrier_performance_metrics_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 4935 (class 2606 OID 21926)
-- Name: carrier_quotes carrier_quotes_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 4936 (class 2606 OID 21921)
-- Name: carrier_quotes carrier_quotes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_quotes
    ADD CONSTRAINT carrier_quotes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 4937 (class 2606 OID 21945)
-- Name: carrier_rejections carrier_rejections_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_rejections
    ADD CONSTRAINT carrier_rejections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 4906 (class 2606 OID 21360)
-- Name: eta_predictions eta_predictions_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eta_predictions
    ADD CONSTRAINT eta_predictions_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 4902 (class 2606 OID 21345)
-- Name: exceptions exceptions_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 4903 (class 2606 OID 21548)
-- Name: exceptions exceptions_escalated_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_escalated_to_fkey FOREIGN KEY (escalated_to) REFERENCES public.users(id);


--
-- TOC entry 4904 (class 2606 OID 21340)
-- Name: exceptions exceptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 4905 (class 2606 OID 21335)
-- Name: exceptions exceptions_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 4877 (class 2606 OID 21129)
-- Name: inventory inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4878 (class 2606 OID 21124)
-- Name: inventory inventory_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 4923 (class 2606 OID 21652)
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- TOC entry 4924 (class 2606 OID 21657)
-- Name: invoice_line_items invoice_line_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 4908 (class 2606 OID 21636)
-- Name: invoices invoices_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- TOC entry 4909 (class 2606 OID 21393)
-- Name: invoices invoices_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 4932 (class 2606 OID 21824)
-- Name: job_execution_logs job_execution_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_execution_logs
    ADD CONSTRAINT job_execution_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.background_jobs(id) ON DELETE CASCADE;


--
-- TOC entry 4907 (class 2606 OID 21376)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4883 (class 2606 OID 21188)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 4884 (class 2606 OID 21487)
-- Name: order_items order_items_packed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_packed_by_fkey FOREIGN KEY (packed_by) REFERENCES public.users(id);


--
-- TOC entry 4885 (class 2606 OID 21482)
-- Name: order_items order_items_picked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_picked_by_fkey FOREIGN KEY (picked_by) REFERENCES public.users(id);


--
-- TOC entry 4886 (class 2606 OID 21193)
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4887 (class 2606 OID 21198)
-- Name: order_items order_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 4917 (class 2606 OID 21584)
-- Name: order_splits order_splits_child_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_child_order_id_fkey FOREIGN KEY (child_order_id) REFERENCES public.orders(id);


--
-- TOC entry 4918 (class 2606 OID 21579)
-- Name: order_splits order_splits_parent_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES public.orders(id);


--
-- TOC entry 4919 (class 2606 OID 21589)
-- Name: order_splits order_splits_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_splits
    ADD CONSTRAINT order_splits_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 4882 (class 2606 OID 21564)
-- Name: orders orders_parent_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES public.orders(id);


--
-- TOC entry 4914 (class 2606 OID 21534)
-- Name: pick_list_items pick_list_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- TOC entry 4915 (class 2606 OID 21529)
-- Name: pick_list_items pick_list_items_pick_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_pick_list_id_fkey FOREIGN KEY (pick_list_id) REFERENCES public.pick_lists(id) ON DELETE CASCADE;


--
-- TOC entry 4916 (class 2606 OID 21539)
-- Name: pick_list_items pick_list_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_list_items
    ADD CONSTRAINT pick_list_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4912 (class 2606 OID 21514)
-- Name: pick_lists pick_lists_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 4913 (class 2606 OID 21509)
-- Name: pick_lists pick_lists_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pick_lists
    ADD CONSTRAINT pick_lists_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 4876 (class 2606 OID 21076)
-- Name: rate_cards rate_cards_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 4899 (class 2606 OID 21313)
-- Name: return_items return_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- TOC entry 4900 (class 2606 OID 21318)
-- Name: return_items return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4901 (class 2606 OID 21308)
-- Name: return_items return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE CASCADE;


--
-- TOC entry 4896 (class 2606 OID 21282)
-- Name: returns returns_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 4897 (class 2606 OID 21292)
-- Name: returns returns_return_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_return_shipment_id_fkey FOREIGN KEY (return_shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 4898 (class 2606 OID 21287)
-- Name: returns returns_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 4892 (class 2606 OID 21245)
-- Name: shipment_events shipment_events_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE;


--
-- TOC entry 4888 (class 2606 OID 21903)
-- Name: shipments shipments_carrier_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_carrier_assignment_id_fkey FOREIGN KEY (carrier_assignment_id) REFERENCES public.carrier_assignments(id);


--
-- TOC entry 4889 (class 2606 OID 21223)
-- Name: shipments shipments_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


--
-- TOC entry 4890 (class 2606 OID 21218)
-- Name: shipments shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 4891 (class 2606 OID 21228)
-- Name: shipments shipments_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 4939 (class 2606 OID 21992)
-- Name: shipping_estimates shipping_estimates_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipping_estimates
    ADD CONSTRAINT shipping_estimates_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 4893 (class 2606 OID 21556)
-- Name: sla_violations sla_violations_penalty_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_penalty_approved_by_fkey FOREIGN KEY (penalty_approved_by) REFERENCES public.users(id);


--
-- TOC entry 4894 (class 2606 OID 21259)
-- Name: sla_violations sla_violations_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- TOC entry 4895 (class 2606 OID 21264)
-- Name: sla_violations sla_violations_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sla_violations
    ADD CONSTRAINT sla_violations_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.sla_policies(id);


--
-- TOC entry 4879 (class 2606 OID 21155)
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4880 (class 2606 OID 21150)
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4881 (class 2606 OID 21145)
-- Name: stock_movements stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- TOC entry 4910 (class 2606 OID 21447)
-- Name: user_notification_preferences user_notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4873 (class 2606 OID 21008)
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4911 (class 2606 OID 21468)
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4930 (class 2606 OID 21763)
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4872 (class 2606 OID 20994)
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4875 (class 2606 OID 21046)
-- Name: warehouses warehouses_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


-- Completed on 2026-02-16 14:13:13 IST

--
-- PostgreSQL database dump complete
--

\unrestrict UD9PxGXzGqqCuEfpp4yQp4Ejf3HhyvEygQR58fMxk5zZwhMcGJbabSZJ5oY9CSi

