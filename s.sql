-- DROP SCHEMA public;

CREATE SCHEMA public AUTHORIZATION pg_database_owner;

-- DROP SEQUENCE public.exception_ticket_seq;

CREATE SEQUENCE public.exception_ticket_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.order_number_seq;

CREATE SEQUENCE public.order_number_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 10000
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.org_code_seq;

CREATE SEQUENCE public.org_code_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.postal_zones_id_seq;

CREATE SEQUENCE public.postal_zones_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.restock_order_number_seq;

CREATE SEQUENCE public.restock_order_number_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 10000
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.transfer_order_number_seq;

CREATE SEQUENCE public.transfer_order_number_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 10000
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.transfer_shipment_number_seq;

CREATE SEQUENCE public.transfer_shipment_number_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 10000
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.user_notification_preferences_id_seq;

CREATE SEQUENCE public.user_notification_preferences_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.wh_code_seq;

CREATE SEQUENCE public.wh_code_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.zone_distances_id_seq;

CREATE SEQUENCE public.zone_distances_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;-- public.analytics_daily_carrier_stats definition

-- Drop table

-- DROP TABLE public.analytics_daily_carrier_stats;

CREATE TABLE public.analytics_daily_carrier_stats (
	organization_id uuid NOT NULL,
	stat_date date NOT NULL,
	carrier_id uuid NOT NULL,
	total_shipments int4 DEFAULT 0 NOT NULL,
	delivered_shipments int4 DEFAULT 0 NOT NULL,
	on_time_deliveries int4 DEFAULT 0 NOT NULL,
	failed_deliveries int4 DEFAULT 0 NOT NULL,
	total_cost numeric(14, 2) DEFAULT 0 NOT NULL,
	avg_delay_hours numeric(10, 2) DEFAULT 0 NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT analytics_daily_carrier_stats_pkey PRIMARY KEY (organization_id, stat_date, carrier_id)
);
CREATE INDEX analytics_daily_carrier_stats_carrier_idx ON public.analytics_daily_carrier_stats USING btree (carrier_id, stat_date DESC);


-- public.analytics_daily_stats definition

-- Drop table

-- DROP TABLE public.analytics_daily_stats;

CREATE TABLE public.analytics_daily_stats (
	organization_id uuid NOT NULL,
	stat_date date NOT NULL,
	orders_total int4 DEFAULT 0 NOT NULL,
	orders_pending int4 DEFAULT 0 NOT NULL,
	orders_processing int4 DEFAULT 0 NOT NULL,
	orders_shipped int4 DEFAULT 0 NOT NULL,
	orders_delivered int4 DEFAULT 0 NOT NULL,
	orders_cancelled int4 DEFAULT 0 NOT NULL,
	orders_returned int4 DEFAULT 0 NOT NULL,
	orders_value numeric(14, 2) DEFAULT 0 NOT NULL,
	shipments_total int4 DEFAULT 0 NOT NULL,
	shipments_in_transit int4 DEFAULT 0 NOT NULL,
	shipments_out_for_delivery int4 DEFAULT 0 NOT NULL,
	shipments_delivered int4 DEFAULT 0 NOT NULL,
	shipments_failed int4 DEFAULT 0 NOT NULL,
	shipments_on_time int4 DEFAULT 0 NOT NULL,
	shipping_cost_total numeric(14, 2) DEFAULT 0 NOT NULL,
	avg_delivery_days numeric(10, 2) DEFAULT 0 NOT NULL,
	returns_total int4 DEFAULT 0 NOT NULL,
	returns_pending int4 DEFAULT 0 NOT NULL,
	returns_refunded int4 DEFAULT 0 NOT NULL,
	refund_amount numeric(14, 2) DEFAULT 0 NOT NULL,
	exceptions_created int4 DEFAULT 0 NOT NULL,
	sla_violations int4 DEFAULT 0 NOT NULL,
	penalties_total numeric(14, 2) DEFAULT 0 NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT analytics_daily_stats_pkey PRIMARY KEY (organization_id, stat_date)
);
CREATE INDEX analytics_daily_stats_stat_date_idx ON public.analytics_daily_stats USING btree (stat_date DESC);


-- public.analytics_daily_warehouse_activity definition

-- Drop table

-- DROP TABLE public.analytics_daily_warehouse_activity;

CREATE TABLE public.analytics_daily_warehouse_activity (
	organization_id uuid NOT NULL,
	stat_date date NOT NULL,
	warehouse_id uuid NOT NULL,
	inbound_count int4 DEFAULT 0 NOT NULL,
	outbound_count int4 DEFAULT 0 NOT NULL,
	inbound_units int4 DEFAULT 0 NOT NULL,
	outbound_units int4 DEFAULT 0 NOT NULL,
	shipments_processed int4 DEFAULT 0 NOT NULL,
	orders_fulfilled int4 DEFAULT 0 NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT analytics_daily_warehouse_activity_pkey PRIMARY KEY (organization_id, stat_date, warehouse_id)
);
CREATE INDEX analytics_daily_warehouse_activity_warehouse_idx ON public.analytics_daily_warehouse_activity USING btree (warehouse_id, stat_date DESC);


-- public.dead_letter_queue definition

-- Drop table

-- DROP TABLE public.dead_letter_queue;

CREATE TABLE public.dead_letter_queue (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	original_job_id uuid NOT NULL,
	job_type varchar(100) NOT NULL,
	payload jsonb NULL,
	priority int4 NULL,
	error_message text NULL,
	error_stack text NULL,
	retry_count int4 DEFAULT 0 NULL,
	original_created_at timestamptz NOT NULL,
	moved_to_dlq_at timestamptz DEFAULT now() NULL,
	reprocessed bool DEFAULT false NULL,
	reprocessed_at timestamptz NULL,
	reprocessed_job_id uuid NULL,
	CONSTRAINT dead_letter_queue_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_dlq_created ON public.dead_letter_queue USING btree (moved_to_dlq_at);
CREATE INDEX idx_dlq_job_type ON public.dead_letter_queue USING btree (job_type);
CREATE INDEX idx_dlq_unprocessed ON public.dead_letter_queue USING btree (reprocessed) WHERE (reprocessed = false);


-- public.postal_zones definition

-- Drop table

-- DROP TABLE public.postal_zones;

CREATE TABLE public.postal_zones (
	id serial4 NOT NULL,
	pincode varchar(10) NOT NULL,
	zone_code varchar(10) NOT NULL,
	city varchar(100) NULL,
	state varchar(100) NULL,
	country bpchar(2) DEFAULT 'IN'::bpchar NOT NULL,
	lat numeric(9, 6) NULL,
	lon numeric(9, 6) NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT postal_zones_pincode_key UNIQUE (pincode),
	CONSTRAINT postal_zones_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_postal_zones_zone_code ON public.postal_zones USING btree (zone_code);


-- public.zone_distances definition

-- Drop table

-- DROP TABLE public.zone_distances;

CREATE TABLE public.zone_distances (
	id serial4 NOT NULL,
	from_zone varchar(10) NOT NULL,
	to_zone varchar(10) NOT NULL,
	distance_km int4 NOT NULL,
	transit_days int4 NULL,
	CONSTRAINT zone_distances_from_zone_to_zone_key UNIQUE (from_zone, to_zone),
	CONSTRAINT zone_distances_pkey PRIMARY KEY (id)
);


-- public.alerts definition

-- Drop table

-- DROP TABLE public.alerts;

CREATE TABLE public.alerts (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	rule_id uuid NULL,
	rule_name varchar(255) NULL,
	alert_type varchar(100) NULL,
	severity varchar(50) NULL,
	message text NULL,
	entity_type varchar(50) NULL,
	entity_id uuid NULL,
	"data" jsonb NULL,
	status varchar(50) DEFAULT 'triggered'::character varying NULL,
	acknowledged_by uuid NULL,
	acknowledged_at timestamptz NULL,
	resolved_by uuid NULL,
	resolved_at timestamptz NULL,
	resolution text NULL,
	triggered_at timestamptz DEFAULT now() NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT alerts_pkey PRIMARY KEY (id),
	CONSTRAINT alerts_status_check CHECK (((status)::text = ANY ((ARRAY['triggered'::character varying, 'acknowledged'::character varying, 'investigating'::character varying, 'resolved'::character varying, 'suppressed'::character varying])::text[])))
);
CREATE INDEX idx_alerts_org ON public.alerts USING btree (organization_id);
CREATE INDEX idx_alerts_severity ON public.alerts USING btree (severity);
CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);
CREATE INDEX idx_alerts_triggered ON public.alerts USING btree (triggered_at);


-- public.allocation_history definition

-- Drop table

-- DROP TABLE public.allocation_history;

CREATE TABLE public.allocation_history (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	order_id uuid NOT NULL,
	order_item_id uuid NULL,
	warehouse_id uuid NOT NULL,
	allocation_strategy varchar(50) NULL,
	allocation_score numeric(5, 2) NULL,
	allocated_quantity int4 NOT NULL,
	reason text NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT allocation_history_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_allocation_history_order ON public.allocation_history USING btree (order_id);
CREATE INDEX idx_allocation_history_warehouse ON public.allocation_history USING btree (warehouse_id);


-- public.audit_logs definition

-- Drop table

-- DROP TABLE public.audit_logs;

CREATE TABLE public.audit_logs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NULL,
	organization_id uuid NULL,
	"action" varchar(100) NOT NULL,
	entity_type varchar(50) NULL,
	entity_id uuid NULL,
	changes jsonb NULL,
	ip_address inet NULL,
	user_agent text NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX idx_audit_logs_org ON public.audit_logs USING btree (organization_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


-- public.background_jobs definition

-- Drop table

-- DROP TABLE public.background_jobs;

CREATE TABLE public.background_jobs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	job_type varchar(255) NOT NULL,
	job_name varchar(255) NULL,
	priority int4 DEFAULT 5 NULL,
	status varchar(100) DEFAULT 'pending'::character varying NULL,
	payload jsonb NULL,
	"result" jsonb NULL,
	error_message text NULL,
	error_stack text NULL,
	retry_count int4 DEFAULT 0 NULL,
	max_retries int4 DEFAULT 3 NULL,
	retry_delay_seconds int4 DEFAULT 60 NULL,
	scheduled_for timestamptz DEFAULT now() NULL,
	started_at timestamptz NULL,
	completed_at timestamptz NULL,
	timeout_seconds int4 DEFAULT 300 NULL,
	created_by uuid NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	idempotency_key varchar(255) NULL,
	CONSTRAINT background_jobs_pkey PRIMARY KEY (id),
	CONSTRAINT background_jobs_priority_check CHECK (((priority >= 1) AND (priority <= 10))),
	CONSTRAINT background_jobs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'retrying'::character varying, 'cancelled'::character varying])::text[])))
);
CREATE INDEX idx_jobs_created ON public.background_jobs USING btree (created_at);
CREATE UNIQUE INDEX idx_jobs_idempotency ON public.background_jobs USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX idx_jobs_org ON public.background_jobs USING btree (organization_id) WHERE (organization_id IS NOT NULL);
CREATE INDEX idx_jobs_priority ON public.background_jobs USING btree (priority, scheduled_for) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying])::text[]));
CREATE INDEX idx_jobs_scheduled ON public.background_jobs USING btree (scheduled_for) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying])::text[]));
CREATE INDEX idx_jobs_status ON public.background_jobs USING btree (status);
CREATE INDEX idx_jobs_type ON public.background_jobs USING btree (job_type);
CREATE UNIQUE INDEX uq_background_jobs_idempotency_key ON public.background_jobs USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);

-- Table Triggers

create trigger trigger_update_background_jobs_updated_at before
update
    on
    public.background_jobs for each row execute function update_updated_at_column();


-- public.carrier_assignments definition

-- Drop table

-- DROP TABLE public.carrier_assignments;

CREATE TABLE public.carrier_assignments (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	order_id uuid NOT NULL,
	carrier_id uuid NOT NULL,
	service_type varchar(50) NULL,
	status varchar(50) DEFAULT 'pending'::character varying NULL,
	pickup_address jsonb NOT NULL,
	delivery_address jsonb NOT NULL,
	estimated_pickup timestamptz NULL,
	estimated_delivery timestamptz NULL,
	actual_pickup timestamptz NULL,
	special_instructions text NULL,
	request_payload jsonb NULL,
	acceptance_payload jsonb NULL,
	carrier_reference_id varchar(100) NULL,
	carrier_tracking_number varchar(100) NULL,
	rejected_reason text NULL,
	idempotency_key varchar(255) NULL,
	requested_at timestamptz DEFAULT now() NULL,
	assigned_at timestamptz NULL,
	accepted_at timestamptz NULL,
	expires_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT carrier_assignments_idempotency_key_key UNIQUE (idempotency_key),
	CONSTRAINT carrier_assignments_pkey PRIMARY KEY (id),
	CONSTRAINT carrier_assignments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'busy'::character varying, 'expired'::character varying, 'cancelled'::character varying, 'completed'::character varying])::text[])))
);
CREATE INDEX idx_carrier_assignments_carrier ON public.carrier_assignments USING btree (carrier_id);
CREATE INDEX idx_carrier_assignments_expires ON public.carrier_assignments USING btree (expires_at) WHERE ((status)::text = 'pending'::text);
CREATE INDEX idx_carrier_assignments_order ON public.carrier_assignments USING btree (order_id);
CREATE INDEX idx_carrier_assignments_status ON public.carrier_assignments USING btree (status);

-- Table Triggers

create trigger trigger_update_carrier_assignments_updated_at before
update
    on
    public.carrier_assignments for each row execute function update_updated_at_column();


-- public.carrier_performance_metrics definition

-- Drop table

-- DROP TABLE public.carrier_performance_metrics;

CREATE TABLE public.carrier_performance_metrics (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	carrier_id uuid NOT NULL,
	organization_id uuid NULL,
	period_start date NOT NULL,
	period_end date NOT NULL,
	period_type varchar(20) NULL,
	total_shipments int4 DEFAULT 0 NULL,
	delivered_on_time int4 DEFAULT 0 NULL,
	delivered_late int4 DEFAULT 0 NULL,
	failed_deliveries int4 DEFAULT 0 NULL,
	returns_processed int4 DEFAULT 0 NULL,
	on_time_rate numeric(5, 2) NULL,
	delivery_success_rate numeric(5, 2) NULL,
	damage_rate numeric(5, 4) NULL,
	avg_delivery_hours numeric(10, 2) NULL,
	avg_first_attempt_success_rate numeric(5, 2) NULL,
	calculated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT carrier_performance_metrics_carrier_id_organization_id_peri_key UNIQUE (carrier_id, organization_id, period_start, period_type),
	CONSTRAINT carrier_performance_metrics_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_carrier_perf_carrier ON public.carrier_performance_metrics USING btree (carrier_id);
CREATE INDEX idx_carrier_perf_period ON public.carrier_performance_metrics USING btree (period_start, period_type);


-- public.carrier_quotes definition

-- Drop table

-- DROP TABLE public.carrier_quotes;

CREATE TABLE public.carrier_quotes (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	order_id uuid NULL,
	carrier_id uuid NOT NULL,
	quoted_price numeric(10, 2) NULL,
	estimated_delivery_days int4 NULL,
	service_type varchar(50) NULL,
	response_time_ms int4 NULL,
	was_retried bool DEFAULT false NULL,
	retry_count int4 DEFAULT 0 NULL,
	was_selected bool DEFAULT false NULL,
	selection_reason varchar(255) NULL,
	status varchar(50) DEFAULT 'received'::character varying NULL,
	error_message text NULL,
	request_payload jsonb NULL,
	response_payload jsonb NULL,
	quoted_at timestamptz DEFAULT now() NULL,
	expires_at timestamptz NULL,
	organization_id uuid NULL,
	CONSTRAINT carrier_quotes_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_carrier_quotes_carrier ON public.carrier_quotes USING btree (carrier_id);
CREATE INDEX idx_carrier_quotes_order ON public.carrier_quotes USING btree (order_id);
CREATE INDEX idx_carrier_quotes_org ON public.carrier_quotes USING btree (organization_id);
CREATE INDEX idx_carrier_quotes_selected ON public.carrier_quotes USING btree (order_id) WHERE (was_selected = true);
CREATE INDEX idx_carrier_quotes_window ON public.carrier_quotes USING btree (order_id, expires_at) WHERE (was_selected IS FALSE);


-- public.carrier_rejections definition

-- Drop table

-- DROP TABLE public.carrier_rejections;

CREATE TABLE public.carrier_rejections (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	carrier_assignment_id uuid NULL,
	carrier_id uuid NOT NULL,
	order_id uuid NULL,
	reason varchar(100) NOT NULL,
	message text NULL,
	error_code varchar(50) NULL,
	response_time_ms int4 NULL,
	raw_response jsonb NULL,
	rejected_at timestamptz DEFAULT now() NULL,
	CONSTRAINT carrier_rejections_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_carrier_rejections_assignment ON public.carrier_rejections USING btree (carrier_assignment_id) WHERE (carrier_assignment_id IS NOT NULL);
CREATE INDEX idx_carrier_rejections_carrier ON public.carrier_rejections USING btree (carrier_id);
CREATE INDEX idx_carrier_rejections_date ON public.carrier_rejections USING btree (rejected_at);
CREATE INDEX idx_carrier_rejections_order_id ON public.carrier_rejections USING btree (order_id);
CREATE INDEX idx_carrier_rejections_reason ON public.carrier_rejections USING btree (reason);


-- public.carriers definition

-- Drop table

-- DROP TABLE public.carriers;

CREATE TABLE public.carriers (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	code varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	service_type varchar(50) NULL,
	service_areas jsonb NULL,
	contact_email varchar(255) NULL,
	contact_phone varchar(20) NULL,
	website varchar(500) NULL,
	api_endpoint varchar(500) NULL,
	api_key_encrypted varchar(500) NULL,
	webhook_url varchar(500) NULL,
	reliability_score numeric(3, 2) DEFAULT 0.85 NULL,
	avg_delivery_days numeric(4, 1) NULL,
	daily_capacity int4 NULL,
	current_load int4 DEFAULT 0 NULL,
	is_active bool DEFAULT true NULL,
	availability_status varchar(20) DEFAULT 'available'::character varying NULL,
	last_status_change timestamptz DEFAULT now() NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	webhook_secret varchar(255) NULL,
	our_client_id varchar(100) NULL,
	our_client_secret varchar(255) NULL,
	ip_whitelist jsonb NULL,
	webhook_events _text NULL,
	webhook_enabled bool DEFAULT true NULL,
	api_timeout_ms int4 DEFAULT 15000 NULL,
	CONSTRAINT carriers_api_timeout_ms_check CHECK (((api_timeout_ms >= 1000) AND (api_timeout_ms <= 45000))),
	CONSTRAINT carriers_availability_status_check CHECK (((availability_status)::text = ANY ((ARRAY['available'::character varying, 'busy'::character varying, 'offline'::character varying, 'suspended'::character varying])::text[]))),
	CONSTRAINT carriers_organization_id_code_key UNIQUE (organization_id, code),
	CONSTRAINT carriers_pkey PRIMARY KEY (id),
	CONSTRAINT carriers_reliability_score_check CHECK (((reliability_score >= (0)::numeric) AND (reliability_score <= (1)::numeric)))
);
CREATE INDEX idx_carriers_active ON public.carriers USING btree (is_active);
CREATE INDEX idx_carriers_code ON public.carriers USING btree (code);
CREATE INDEX idx_carriers_org ON public.carriers USING btree (organization_id);
CREATE INDEX idx_carriers_status ON public.carriers USING btree (availability_status);

-- Table Triggers

create trigger trigger_update_carriers_updated_at before
update
    on
    public.carriers for each row execute function update_updated_at_column();
create trigger carrier_webhook_credentials_trigger before
insert
    on
    public.carriers for each row execute function generate_webhook_credentials();


-- public.cron_schedules definition

-- Drop table

-- DROP TABLE public.cron_schedules;

CREATE TABLE public.cron_schedules (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	"name" varchar(255) NOT NULL,
	description text NULL,
	job_type varchar(100) NOT NULL,
	cron_expression varchar(100) NOT NULL,
	timezone varchar(50) DEFAULT 'Asia/Kolkata'::character varying NULL,
	payload jsonb NULL,
	is_active bool DEFAULT true NULL,
	last_run_at timestamptz NULL,
	last_run_status varchar(50) NULL,
	next_run_at timestamptz NULL,
	total_runs int4 DEFAULT 0 NULL,
	failed_runs int4 DEFAULT 0 NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT cron_schedules_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_cron_active ON public.cron_schedules USING btree (is_active, next_run_at);
CREATE INDEX idx_cron_org ON public.cron_schedules USING btree (organization_id);

-- Table Triggers

create trigger trigger_update_cron_schedules_updated_at before
update
    on
    public.cron_schedules for each row execute function update_updated_at_column();


-- public.eta_predictions definition

-- Drop table

-- DROP TABLE public.eta_predictions;

CREATE TABLE public.eta_predictions (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	shipment_id uuid NOT NULL,
	predicted_delivery timestamptz NOT NULL,
	confidence_score numeric(3, 2) NULL,
	delay_risk_score varchar(20) NULL,
	factors jsonb NULL,
	actual_delivery timestamptz NULL,
	prediction_accuracy_hours numeric(10, 2) NULL,
	model_version varchar(50) NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT eta_predictions_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
	CONSTRAINT eta_predictions_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_eta_predictions_created ON public.eta_predictions USING btree (created_at);
CREATE INDEX idx_eta_predictions_shipment ON public.eta_predictions USING btree (shipment_id);


-- public.exceptions definition

-- Drop table

-- DROP TABLE public.exceptions;

CREATE TABLE public.exceptions (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	exception_type varchar(50) NOT NULL,
	severity varchar(20) DEFAULT 'medium'::character varying NULL,
	priority int4 DEFAULT 5 NULL,
	shipment_id uuid NULL,
	order_id uuid NULL,
	carrier_id uuid NULL,
	title varchar(255) NULL,
	description text NULL,
	root_cause varchar(255) NULL,
	status varchar(50) DEFAULT 'open'::character varying NULL,
	escalation_level int4 DEFAULT 0 NULL,
	escalated_at timestamptz NULL,
	assigned_to uuid NULL,
	assigned_at timestamptz NULL,
	resolution varchar(50) NULL,
	resolution_notes text NULL,
	sla_impacted bool DEFAULT false NULL,
	customer_impacted bool DEFAULT false NULL,
	financial_impact numeric(10, 2) NULL,
	estimated_resolution_time timestamptz NULL,
	resolved_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	ticket_number varchar(30) NULL,
	CONSTRAINT exceptions_exception_type_check CHECK (((exception_type)::text = ANY ((ARRAY['delay'::character varying, 'damage'::character varying, 'lost_shipment'::character varying, 'address_issue'::character varying, 'carrier_issue'::character varying, 'inventory_issue'::character varying, 'sla_breach'::character varying, 'delivery_failed'::character varying, 'customer_not_available'::character varying, 'other'::character varying])::text[]))),
	CONSTRAINT exceptions_pkey PRIMARY KEY (id),
	CONSTRAINT exceptions_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
	CONSTRAINT exceptions_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'acknowledged'::character varying, 'investigating'::character varying, 'pending_resolution'::character varying, 'resolved'::character varying, 'escalated'::character varying, 'closed'::character varying])::text[]))),
	CONSTRAINT exceptions_ticket_number_key UNIQUE (ticket_number)
);
CREATE INDEX idx_exceptions_assigned ON public.exceptions USING btree (assigned_to);
CREATE INDEX idx_exceptions_open ON public.exceptions USING btree (organization_id) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'investigating'::character varying])::text[]));
CREATE INDEX idx_exceptions_order ON public.exceptions USING btree (order_id);
CREATE INDEX idx_exceptions_org ON public.exceptions USING btree (organization_id);
CREATE INDEX idx_exceptions_severity ON public.exceptions USING btree (severity);
CREATE INDEX idx_exceptions_shipment ON public.exceptions USING btree (shipment_id);
CREATE INDEX idx_exceptions_status ON public.exceptions USING btree (status);
CREATE INDEX idx_exceptions_ticket ON public.exceptions USING btree (ticket_number);
CREATE INDEX idx_exceptions_type ON public.exceptions USING btree (exception_type);

-- Table Triggers

create trigger trg_exception_ticket before
insert
    on
    public.exceptions for each row execute function generate_exception_ticket();
create trigger trigger_update_exceptions_updated_at before
update
    on
    public.exceptions for each row execute function update_updated_at_column();


-- public.inventory definition

-- Drop table

-- DROP TABLE public.inventory;

CREATE TABLE public.inventory (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	warehouse_id uuid NOT NULL,
	product_id uuid NULL,
	sku varchar(100) NULL,
	product_name varchar(255) NULL,
	quantity int4 DEFAULT 0 NULL,
	available_quantity int4 DEFAULT 0 NULL,
	reserved_quantity int4 DEFAULT 0 NULL,
	damaged_quantity int4 DEFAULT 0 NULL,
	in_transit_quantity int4 DEFAULT 0 NULL,
	reorder_point int4 NULL,
	max_stock_level int4 NULL,
	last_stock_check timestamptz NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	unit_cost numeric(10, 2) DEFAULT 0 NULL,
	organization_id uuid NULL,
	CONSTRAINT inventory_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_inventory_low_stock ON public.inventory USING btree (warehouse_id) WHERE (available_quantity <= COALESCE(reorder_point, 10));
CREATE INDEX idx_inventory_organization_id ON public.inventory USING btree (organization_id);
CREATE INDEX idx_inventory_product ON public.inventory USING btree (product_id);
CREATE INDEX idx_inventory_warehouse ON public.inventory USING btree (warehouse_id);
CREATE UNIQUE INDEX idx_inventory_warehouse_product ON public.inventory USING btree (warehouse_id, product_id) WHERE (product_id IS NOT NULL);
CREATE UNIQUE INDEX idx_inventory_warehouse_sku ON public.inventory USING btree (warehouse_id, sku) WHERE (sku IS NOT NULL);
CREATE INDEX idx_inventory_warehouse_stats ON public.inventory USING btree (warehouse_id, quantity, available_quantity, reserved_quantity);

-- Table Triggers

create trigger trigger_update_inventory_updated_at before
update
    on
    public.inventory for each row execute function update_updated_at_column();
create trigger trg_sync_inventory_product_info before
insert
    or
update
    of product_id on
    public.inventory for each row execute function sync_inventory_product_info();


-- public.invoice_line_items definition

-- Drop table

-- DROP TABLE public.invoice_line_items;

CREATE TABLE public.invoice_line_items (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	invoice_id uuid NOT NULL,
	shipment_id uuid NULL,
	order_id uuid NULL,
	description varchar(255) NOT NULL,
	item_type varchar(50) NULL,
	quantity int4 DEFAULT 1 NULL,
	unit_price numeric(10, 2) NULL,
	amount numeric(10, 2) NOT NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_invoice_line_items_invoice ON public.invoice_line_items USING btree (invoice_id);
CREATE INDEX idx_invoice_line_items_shipment ON public.invoice_line_items USING btree (shipment_id) WHERE (shipment_id IS NOT NULL);


-- public.invoices definition

-- Drop table

-- DROP TABLE public.invoices;

CREATE TABLE public.invoices (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	invoice_number varchar(50) NOT NULL,
	carrier_id uuid NULL,
	billing_period_start date NULL,
	billing_period_end date NULL,
	total_shipments int4 NULL,
	base_amount numeric(10, 2) NULL,
	penalties numeric(10, 2) DEFAULT 0 NULL,
	adjustments numeric(10, 2) DEFAULT 0 NULL,
	tax_amount numeric(10, 2) DEFAULT 0 NULL,
	final_amount numeric(10, 2) NOT NULL,
	currency varchar(3) DEFAULT 'INR'::character varying NULL,
	status varchar(50) DEFAULT 'draft'::character varying NULL,
	due_date date NULL,
	paid_amount numeric(10, 2) DEFAULT 0 NULL,
	paid_at timestamptz NULL,
	payment_method varchar(50) NULL,
	payment_reference varchar(255) NULL,
	invoice_url varchar(500) NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT invoices_organization_id_invoice_number_key UNIQUE (organization_id, invoice_number),
	CONSTRAINT invoices_pkey PRIMARY KEY (id),
	CONSTRAINT invoices_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'sent'::character varying, 'approved'::character varying, 'paid'::character varying, 'overdue'::character varying, 'disputed'::character varying, 'cancelled'::character varying])::text[])))
);
CREATE INDEX idx_invoices_carrier ON public.invoices USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);
CREATE INDEX idx_invoices_due ON public.invoices USING btree (due_date) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'overdue'::character varying])::text[]));
CREATE INDEX idx_invoices_org ON public.invoices USING btree (organization_id);
CREATE INDEX idx_invoices_period ON public.invoices USING btree (billing_period_start, billing_period_end);
CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);

-- Table Triggers

create trigger trigger_update_invoices_updated_at before
update
    on
    public.invoices for each row execute function update_updated_at_column();


-- public.job_execution_logs definition

-- Drop table

-- DROP TABLE public.job_execution_logs;

CREATE TABLE public.job_execution_logs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	job_id uuid NOT NULL,
	attempt_number int4 NOT NULL,
	status varchar(50) NOT NULL,
	error_message text NULL,
	execution_time_ms int4 NULL,
	output_data jsonb NULL,
	started_at timestamptz NOT NULL,
	completed_at timestamptz NULL,
	CONSTRAINT job_execution_logs_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_job_execution_logs_job ON public.job_execution_logs USING btree (job_id);
CREATE INDEX idx_job_execution_logs_status ON public.job_execution_logs USING btree (status);


-- public.notifications definition

-- Drop table

-- DROP TABLE public.notifications;

CREATE TABLE public.notifications (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NOT NULL,
	organization_id uuid NULL,
	"type" varchar(50) NOT NULL,
	title varchar(255) NOT NULL,
	message text NULL,
	entity_type varchar(50) NULL,
	entity_id uuid NULL,
	link varchar(500) NULL,
	is_read bool DEFAULT false NULL,
	read_at timestamptz NULL,
	priority varchar(20) DEFAULT 'normal'::character varying NULL,
	created_at timestamptz DEFAULT now() NULL,
	expires_at timestamptz NULL,
	CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at);
CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);
CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


-- public.order_items definition

-- Drop table

-- DROP TABLE public.order_items;

CREATE TABLE public.order_items (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	order_id uuid NOT NULL,
	product_id uuid NULL,
	sku varchar(100) NULL,
	product_name varchar(255) NULL,
	quantity int4 NOT NULL,
	fulfilled_quantity int4 DEFAULT 0 NULL,
	unit_price numeric(10, 2) NULL,
	discount numeric(10, 2) DEFAULT 0 NULL,
	tax numeric(10, 2) DEFAULT 0 NULL,
	total_price numeric(10, 2) NULL,
	weight numeric(10, 3) NULL,
	warehouse_id uuid NULL,
	bin_location varchar(50) NULL,
	status varchar(50) DEFAULT 'pending'::character varying NULL,
	shipped_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NULL,
	dimensions jsonb DEFAULT '{"width": 0, "height": 0, "length": 0}'::jsonb NULL,
	is_fragile bool DEFAULT false NULL,
	is_hazardous bool DEFAULT false NULL,
	is_perishable bool DEFAULT false NULL,
	requires_cold_storage bool DEFAULT false NULL,
	item_type varchar(50) DEFAULT 'general'::character varying NULL,
	volumetric_weight numeric(10, 3) NULL,
	package_type varchar(50) DEFAULT 'box'::character varying NULL,
	handling_instructions text NULL,
	requires_insurance bool DEFAULT false NULL,
	declared_value numeric(10, 2) NULL,
	CONSTRAINT order_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['general'::character varying, 'fragile'::character varying, 'hazardous'::character varying, 'perishable'::character varying, 'electronics'::character varying, 'documents'::character varying, 'valuable'::character varying])::text[]))),
	CONSTRAINT order_items_package_type_check CHECK (((package_type)::text = ANY ((ARRAY['envelope'::character varying, 'box'::character varying, 'tube'::character varying, 'pallet'::character varying, 'crate'::character varying, 'bag'::character varying, 'custom'::character varying])::text[]))),
	CONSTRAINT order_items_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_order_items_fragile ON public.order_items USING btree (is_fragile) WHERE (is_fragile = true);
CREATE INDEX idx_order_items_hazardous ON public.order_items USING btree (is_hazardous) WHERE (is_hazardous = true);
CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_items_perishable ON public.order_items USING btree (is_perishable) WHERE (is_perishable = true);
CREATE INDEX idx_order_items_product ON public.order_items USING btree (product_id);
CREATE INDEX idx_order_items_sku ON public.order_items USING btree (sku);

-- Table Triggers

create trigger trigger_calculate_volumetric_weight before
insert
    or
update
    of dimensions on
    public.order_items for each row execute function calculate_volumetric_weight();


-- public.orders definition

-- Drop table

-- DROP TABLE public.orders;

CREATE TABLE public.orders (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	order_number varchar(50) NULL,
	external_order_id varchar(100) NULL,
	customer_name varchar(255) NOT NULL,
	customer_email varchar(255) NULL,
	customer_phone varchar(20) NULL,
	status varchar(50) DEFAULT 'created'::character varying NULL,
	priority varchar(20) DEFAULT 'standard'::character varying NULL,
	order_type varchar(50) DEFAULT 'outbound'::character varying NULL,
	is_cod bool DEFAULT false NULL,
	subtotal numeric(10, 2) NULL,
	tax_amount numeric(10, 2) DEFAULT 0 NULL,
	shipping_amount numeric(10, 2) DEFAULT 0 NULL,
	discount_amount numeric(10, 2) DEFAULT 0 NULL,
	total_amount numeric(10, 2) NOT NULL,
	currency varchar(3) DEFAULT 'INR'::character varying NULL,
	shipping_address jsonb NOT NULL,
	billing_address jsonb NULL,
	estimated_delivery timestamptz NULL,
	actual_delivery timestamptz NULL,
	promised_delivery timestamptz NULL,
	allocated_warehouse_id uuid NULL,
	shipping_locked_by varchar(255) NULL,
	shipping_locked_at timestamptz NULL,
	notes text NULL,
	special_instructions text NULL,
	tags jsonb NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	carrier_id uuid NULL,
	platform varchar(50) NULL,
	customer_id varchar(100) NULL,
	payment_method varchar(50) NULL,
	shipping_locked bool DEFAULT false NOT NULL,
	CONSTRAINT orders_order_type_check null,
	CONSTRAINT orders_pkey PRIMARY KEY (id),
	CONSTRAINT orders_priority_check CHECK (((priority)::text = ANY ((ARRAY['express'::character varying, 'standard'::character varying, 'bulk'::character varying, 'same_day'::character varying])::text[]))),
	CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'confirmed'::character varying, 'processing'::character varying, 'allocated'::character varying, 'ready_to_ship'::character varying, 'shipped'::character varying, 'in_transit'::character varying, 'out_for_delivery'::character varying, 'delivered'::character varying, 'returned'::character varying, 'cancelled'::character varying, 'on_hold'::character varying, 'pending_carrier_assignment'::character varying])::text[])))
);
CREATE INDEX idx_orders_carrier_id ON public.orders USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);
CREATE INDEX idx_orders_created ON public.orders USING btree (created_at);
CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_email);
CREATE INDEX idx_orders_external ON public.orders USING btree (external_order_id) WHERE (external_order_id IS NOT NULL);
CREATE INDEX idx_orders_number ON public.orders USING btree (order_number);
CREATE INDEX idx_orders_on_hold ON public.orders USING btree (status) WHERE ((status)::text = 'on_hold'::text);
CREATE INDEX idx_orders_order_type ON public.orders USING btree (order_type);
CREATE INDEX idx_orders_org ON public.orders USING btree (organization_id);
CREATE INDEX idx_orders_shipping_locked ON public.orders USING btree (shipping_locked_at) WHERE (shipping_locked = true);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_status_org ON public.orders USING btree (organization_id, status);

-- Table Triggers

create trigger trigger_update_orders_updated_at before
update
    on
    public.orders for each row execute function update_updated_at_column();


-- public.organization_audit_logs definition

-- Drop table

-- DROP TABLE public.organization_audit_logs;

CREATE TABLE public.organization_audit_logs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	"action" varchar(100) NOT NULL,
	performed_by uuid NULL,
	performed_by_role varchar(50) NULL,
	ip_address inet NULL,
	user_agent text NULL,
	before_state jsonb NULL,
	after_state jsonb NULL,
	metadata jsonb NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT organization_audit_logs_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_org_audit_action ON public.organization_audit_logs USING btree (action);
CREATE INDEX idx_org_audit_created ON public.organization_audit_logs USING btree (created_at);
CREATE INDEX idx_org_audit_org ON public.organization_audit_logs USING btree (organization_id);
CREATE INDEX idx_org_audit_performed_by ON public.organization_audit_logs USING btree (performed_by);


-- public.organizations definition

-- Drop table

-- DROP TABLE public.organizations;

CREATE TABLE public.organizations (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	code varchar(50) NOT NULL,
	email varchar(255) NULL,
	phone varchar(20) NULL,
	website varchar(500) NULL,
	address text NULL,
	city varchar(100) NULL,
	state varchar(100) NULL,
	country varchar(100) DEFAULT 'India'::character varying NULL,
	postal_code varchar(20) NULL,
	timezone varchar(50) DEFAULT 'Asia/Kolkata'::character varying NULL,
	currency varchar(3) DEFAULT 'INR'::character varying NULL,
	logo_url varchar(500) NULL,
	is_active bool DEFAULT true NULL,
	subscription_tier varchar(50) DEFAULT 'standard'::character varying NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	webhook_token varchar(64) DEFAULT encode(gen_random_bytes(32), 'hex'::text) NULL,
	is_deleted bool DEFAULT false NOT NULL,
	deleted_at timestamptz NULL,
	deleted_by uuid NULL,
	suspension_reason text NULL,
	suspended_at timestamptz NULL,
	suspended_by uuid NULL,
	CONSTRAINT organizations_code_key UNIQUE (code),
	CONSTRAINT organizations_pkey PRIMARY KEY (id),
	CONSTRAINT organizations_webhook_token_key UNIQUE (webhook_token)
);
CREATE INDEX idx_org_is_deleted ON public.organizations USING btree (is_deleted) WHERE (is_deleted = false);
CREATE INDEX idx_org_suspended ON public.organizations USING btree (suspended_at) WHERE (suspended_at IS NOT NULL);
CREATE INDEX idx_organizations_active ON public.organizations USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_organizations_webhook_token ON public.organizations USING btree (webhook_token);

-- Table Triggers

create trigger trigger_update_organizations_updated_at before
update
    on
    public.organizations for each row execute function update_updated_at_column();


-- public.products definition

-- Drop table

-- DROP TABLE public.products;

CREATE TABLE public.products (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	sku varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	description text NULL,
	category varchar(100) NULL,
	weight numeric(10, 3) NULL,
	dimensions jsonb NULL,
	selling_price numeric(10, 2) NULL,
	cost_price numeric(10, 2) NULL,
	currency varchar(3) DEFAULT 'INR'::character varying NULL,
	"attributes" jsonb NULL,
	is_active bool DEFAULT true NULL,
	is_fragile bool DEFAULT false NULL,
	requires_cold_storage bool DEFAULT false NULL,
	is_hazmat bool DEFAULT false NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	is_perishable bool DEFAULT false NULL,
	volumetric_weight numeric(10, 3) NULL,
	package_type varchar(50) DEFAULT 'box'::character varying NULL,
	handling_instructions text NULL,
	requires_insurance bool DEFAULT false NULL,
	manufacturer_barcode varchar(100) NULL,
	hsn_code varchar(20) NULL,
	gst_rate numeric(5, 2) DEFAULT 18.00 NULL,
	brand varchar(255) NULL,
	country_of_origin varchar(100) DEFAULT 'India'::character varying NULL,
	warranty_period_days int4 DEFAULT 0 NULL,
	shelf_life_days int4 NULL,
	tags jsonb DEFAULT '[]'::jsonb NULL,
	supplier_id uuid NULL,
	mrp numeric(12, 2) NULL,
	internal_barcode varchar(50) NOT NULL,
	barcode varchar(100) NULL,
	CONSTRAINT products_internal_barcode_unique UNIQUE (internal_barcode),
	CONSTRAINT products_mrp_check CHECK (((mrp IS NULL) OR (mrp >= (0)::numeric))),
	CONSTRAINT products_organization_id_sku_key UNIQUE (organization_id, sku),
	CONSTRAINT products_package_type_check CHECK (((package_type)::text = ANY ((ARRAY['envelope'::character varying, 'box'::character varying, 'tube'::character varying, 'pallet'::character varying, 'crate'::character varying, 'bag'::character varying, 'custom'::character varying])::text[]))),
	CONSTRAINT products_pkey PRIMARY KEY (id),
	CONSTRAINT products_shelf_life_days_check CHECK (((shelf_life_days IS NULL) OR (shelf_life_days > 0))),
	CONSTRAINT products_warranty_period_days_check CHECK ((warranty_period_days >= 0))
);
CREATE INDEX idx_products_active ON public.products USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_products_brand ON public.products USING btree (organization_id, brand) WHERE (brand IS NOT NULL);
CREATE INDEX idx_products_category ON public.products USING btree (organization_id, category) WHERE (category IS NOT NULL);
CREATE INDEX idx_products_fragile ON public.products USING btree (is_fragile) WHERE (is_fragile = true);
CREATE INDEX idx_products_hsn ON public.products USING btree (hsn_code) WHERE (hsn_code IS NOT NULL);
CREATE UNIQUE INDEX idx_products_manufacturer_barcode_org ON public.products USING btree (organization_id, manufacturer_barcode) WHERE (manufacturer_barcode IS NOT NULL);
CREATE INDEX idx_products_org ON public.products USING btree (organization_id);
CREATE INDEX idx_products_organization_id ON public.products USING btree (organization_id);
CREATE INDEX idx_products_perishable ON public.products USING btree (is_perishable) WHERE (is_perishable = true);
CREATE INDEX idx_products_supplier ON public.products USING btree (supplier_id) WHERE (supplier_id IS NOT NULL);
CREATE INDEX idx_products_tags ON public.products USING gin (tags);

-- Table Triggers

create trigger trigger_update_products_updated_at before
update
    on
    public.products for each row execute function update_updated_at_column();
create trigger trigger_calculate_product_volumetric_weight before
insert
    or
update
    of dimensions on
    public.products for each row execute function calculate_product_volumetric_weight();


-- public.quote_idempotency_cache definition

-- Drop table

-- DROP TABLE public.quote_idempotency_cache;

CREATE TABLE public.quote_idempotency_cache (
	idempotency_key varchar(255) NOT NULL,
	quote_id uuid NULL,
	response_data jsonb NULL,
	created_at timestamptz DEFAULT now() NULL,
	expires_at timestamptz NOT NULL,
	CONSTRAINT quote_idempotency_cache_pkey PRIMARY KEY (idempotency_key)
);
CREATE INDEX idx_quote_cache_expires ON public.quote_idempotency_cache USING btree (expires_at);


-- public.rate_cards definition

-- Drop table

-- DROP TABLE public.rate_cards;

CREATE TABLE public.rate_cards (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	carrier_id uuid NOT NULL,
	origin_state varchar(100) NULL,
	origin_city varchar(100) NULL,
	destination_state varchar(100) NULL,
	destination_city varchar(100) NULL,
	service_type varchar(50) NULL,
	base_rate numeric(10, 2) NOT NULL,
	per_kg_rate numeric(10, 2) DEFAULT 0 NULL,
	per_km_rate numeric(10, 4) DEFAULT 0 NULL,
	fuel_surcharge_pct numeric(5, 2) DEFAULT 0 NULL,
	cod_charge numeric(10, 2) DEFAULT 0 NULL,
	effective_from date NOT NULL,
	effective_to date NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT rate_cards_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_rate_cards_active ON public.rate_cards USING btree (carrier_id, is_active) WHERE (is_active = true);
CREATE INDEX idx_rate_cards_carrier ON public.rate_cards USING btree (carrier_id);
CREATE INDEX idx_rate_cards_route ON public.rate_cards USING btree (origin_state, destination_state) WHERE (is_active = true);


-- public.restock_order_items definition

-- Drop table

-- DROP TABLE public.restock_order_items;

CREATE TABLE public.restock_order_items (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	restock_order_id uuid NOT NULL,
	product_id uuid NULL,
	sku varchar(100) NOT NULL,
	product_name varchar(255) NULL,
	quantity_ordered int4 NOT NULL,
	quantity_received int4 DEFAULT 0 NULL,
	unit_cost numeric(10, 2) NULL,
	total_cost numeric(12, 2) NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT restock_order_items_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_restock_items_order ON public.restock_order_items USING btree (restock_order_id);


-- public.restock_orders definition

-- Drop table

-- DROP TABLE public.restock_orders;

CREATE TABLE public.restock_orders (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NOT NULL,
	restock_number varchar(50) NULL,
	supplier_id uuid NOT NULL,
	destination_warehouse_id uuid NOT NULL,
	status varchar(50) DEFAULT 'draft'::character varying NOT NULL,
	is_auto_generated bool DEFAULT false NULL,
	trigger_reason varchar(100) NULL,
	priority varchar(20) DEFAULT 'standard'::character varying NULL,
	total_items int4 DEFAULT 0 NULL,
	total_amount numeric(12, 2) DEFAULT 0 NULL,
	currency varchar(3) DEFAULT 'INR'::character varying NULL,
	requested_at timestamptz DEFAULT now() NULL,
	confirmed_at timestamptz NULL,
	expected_arrival timestamptz NULL,
	received_at timestamptz NULL,
	supplier_po_number varchar(100) NULL,
	tracking_number varchar(100) NULL,
	notes text NULL,
	created_by uuid NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT restock_orders_pkey PRIMARY KEY (id),
	CONSTRAINT restock_orders_priority_check CHECK (((priority)::text = ANY ((ARRAY['standard'::character varying, 'express'::character varying, 'urgent'::character varying])::text[]))),
	CONSTRAINT restock_orders_restock_number_key UNIQUE (restock_number),
	CONSTRAINT restock_orders_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'confirmed'::character varying, 'in_transit'::character varying, 'received'::character varying, 'cancelled'::character varying])::text[])))
);
CREATE INDEX idx_restock_org ON public.restock_orders USING btree (organization_id);
CREATE INDEX idx_restock_status ON public.restock_orders USING btree (status);
CREATE INDEX idx_restock_supplier ON public.restock_orders USING btree (supplier_id);
CREATE INDEX idx_restock_warehouse ON public.restock_orders USING btree (destination_warehouse_id);

-- Table Triggers

create trigger trg_restock_number before
insert
    on
    public.restock_orders for each row execute function generate_restock_number();


-- public.return_items definition

-- Drop table

-- DROP TABLE public.return_items;

CREATE TABLE public.return_items (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	return_id uuid NOT NULL,
	order_item_id uuid NULL,
	product_id uuid NULL,
	sku varchar(100) NULL,
	product_name varchar(255) NULL,
	quantity int4 NOT NULL,
	reason varchar(100) NULL,
	reason_detail text NULL,
	"condition" varchar(50) NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT return_items_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_return_items_order_item ON public.return_items USING btree (order_item_id) WHERE (order_item_id IS NOT NULL);
CREATE INDEX idx_return_items_return ON public.return_items USING btree (return_id);


-- public."returns" definition

-- Drop table

-- DROP TABLE public."returns";

CREATE TABLE public."returns" (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	rma_number varchar(50) NULL,
	external_return_id varchar(100) NULL,
	order_id uuid NULL,
	original_shipment_id uuid NULL,
	return_shipment_id uuid NULL,
	customer_name varchar(255) NULL,
	customer_email varchar(255) NULL,
	customer_phone varchar(20) NULL,
	reason varchar(100) NULL,
	reason_detail text NULL,
	status varchar(50) DEFAULT 'requested'::character varying NULL,
	quality_check_result varchar(50) NULL,
	quality_check_notes text NULL,
	inspection_images jsonb NULL,
	refund_amount numeric(10, 2) NULL,
	restocking_fee numeric(10, 2) DEFAULT 0 NULL,
	refund_status varchar(50) NULL,
	refund_processed_at timestamptz NULL,
	pickup_address jsonb NULL,
	requested_at timestamptz DEFAULT now() NULL,
	approved_at timestamptz NULL,
	received_at timestamptz NULL,
	resolved_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT returns_pkey PRIMARY KEY (id),
	CONSTRAINT returns_status_check CHECK (((status)::text = ANY ((ARRAY['requested'::character varying, 'approved'::character varying, 'rejected'::character varying, 'pickup_scheduled'::character varying, 'picked_up'::character varying, 'in_transit'::character varying, 'received'::character varying, 'inspecting'::character varying, 'inspection_passed'::character varying, 'inspection_failed'::character varying, 'refunded'::character varying])::text[])))
);
CREATE INDEX idx_returns_created ON public.returns USING btree (created_at);
CREATE INDEX idx_returns_external ON public.returns USING btree (external_return_id) WHERE (external_return_id IS NOT NULL);
CREATE INDEX idx_returns_order ON public.returns USING btree (order_id) WHERE (order_id IS NOT NULL);
CREATE INDEX idx_returns_org ON public.returns USING btree (organization_id);
CREATE INDEX idx_returns_organization_id ON public.returns USING btree (organization_id);
CREATE UNIQUE INDEX idx_returns_rma_number ON public.returns USING btree (organization_id, rma_number) WHERE (rma_number IS NOT NULL);
CREATE INDEX idx_returns_status ON public.returns USING btree (status);

-- Table Triggers

create trigger trigger_update_returns_updated_at before
update
    on
    public.returns for each row execute function update_updated_at_column();


-- public.revoked_tokens definition

-- Drop table

-- DROP TABLE public.revoked_tokens;

CREATE TABLE public.revoked_tokens (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	jti varchar(255) NOT NULL,
	user_id uuid NOT NULL,
	expires_at timestamptz NOT NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT revoked_tokens_jti_key UNIQUE (jti),
	CONSTRAINT revoked_tokens_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_revoked_tokens_expires ON public.revoked_tokens USING btree (expires_at);
CREATE INDEX idx_revoked_tokens_jti ON public.revoked_tokens USING btree (jti);


-- public.sales_channels definition

-- Drop table

-- DROP TABLE public.sales_channels;

CREATE TABLE public.sales_channels (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	code varchar(50) NOT NULL,
	platform_type varchar(50) DEFAULT 'marketplace'::character varying NOT NULL,
	webhook_token varchar(64) DEFAULT encode(gen_random_bytes(32), 'hex'::text) NULL,
	api_endpoint varchar(500) NULL,
	contact_name varchar(255) NULL,
	contact_email varchar(255) NULL,
	contact_phone varchar(20) NULL,
	config jsonb DEFAULT '{}'::jsonb NULL,
	default_warehouse_id uuid NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT sales_channels_organization_id_code_key UNIQUE (organization_id, code),
	CONSTRAINT sales_channels_pkey PRIMARY KEY (id),
	CONSTRAINT sales_channels_platform_type_check CHECK (((platform_type)::text = ANY ((ARRAY['marketplace'::character varying, 'd2c'::character varying, 'b2b'::character varying, 'wholesale'::character varying, 'internal'::character varying])::text[]))),
	CONSTRAINT sales_channels_webhook_token_key UNIQUE (webhook_token)
);
CREATE INDEX idx_sales_channels_active ON public.sales_channels USING btree (organization_id, is_active);
CREATE INDEX idx_sales_channels_org ON public.sales_channels USING btree (organization_id);

-- Table Triggers

create trigger set_sales_channels_updated_at before
update
    on
    public.sales_channels for each row execute function update_updated_at_column();


-- public.shipment_events definition

-- Drop table

-- DROP TABLE public.shipment_events;

CREATE TABLE public.shipment_events (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	shipment_id uuid NOT NULL,
	event_type varchar(50) NOT NULL,
	event_code varchar(50) NULL,
	status varchar(50) NULL,
	"location" jsonb NULL,
	city varchar(100) NULL,
	description text NULL,
	remarks text NULL,
	"source" varchar(50) NULL,
	raw_payload jsonb NULL,
	event_timestamp timestamptz NOT NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT shipment_events_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_shipment_events_shipment ON public.shipment_events USING btree (shipment_id);
CREATE INDEX idx_shipment_events_timestamp ON public.shipment_events USING btree (event_timestamp);
CREATE INDEX idx_shipment_events_type ON public.shipment_events USING btree (event_type);


-- public.shipments definition

-- Drop table

-- DROP TABLE public.shipments;

CREATE TABLE public.shipments (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	tracking_number varchar(100) NOT NULL,
	carrier_tracking_number varchar(100) NULL,
	order_id uuid NULL,
	carrier_assignment_id uuid NULL,
	carrier_id uuid NULL,
	warehouse_id uuid NULL,
	status varchar(50) DEFAULT 'pending'::character varying NULL,
	origin_address jsonb NULL,
	destination_address jsonb NULL,
	weight numeric(10, 3) NULL,
	volumetric_weight numeric(10, 3) NULL,
	dimensions jsonb NULL,
	package_count int4 DEFAULT 1 NULL,
	shipping_cost numeric(10, 2) NULL,
	cod_amount numeric(10, 2) NULL,
	current_location jsonb NULL,
	route_geometry jsonb NULL,
	tracking_events jsonb DEFAULT '[]'::jsonb NULL,
	delivery_attempts int4 DEFAULT 0 NULL,
	pickup_scheduled timestamptz NULL,
	pickup_actual timestamptz NULL,
	delivery_scheduled timestamptz NULL,
	delivery_actual timestamptz NULL,
	pod_image_url varchar(500) NULL,
	pod_signature_url varchar(500) NULL,
	delivered_to varchar(255) NULL,
	delivery_notes text NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	is_fragile bool DEFAULT false NULL,
	is_hazardous bool DEFAULT false NULL,
	is_perishable bool DEFAULT false NULL,
	requires_cold_storage bool DEFAULT false NULL,
	item_type varchar(50) DEFAULT 'general'::character varying NULL,
	package_type varchar(50) DEFAULT 'box'::character varying NULL,
	handling_instructions text NULL,
	requires_insurance bool DEFAULT false NULL,
	declared_value numeric(10, 2) NULL,
	total_items int4 DEFAULT 0 NULL,
	sla_policy_id uuid NULL,
	CONSTRAINT shipments_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['general'::character varying, 'fragile'::character varying, 'hazardous'::character varying, 'perishable'::character varying, 'electronics'::character varying, 'documents'::character varying, 'valuable'::character varying])::text[]))),
	CONSTRAINT shipments_package_type_check CHECK (((package_type)::text = ANY ((ARRAY['envelope'::character varying, 'box'::character varying, 'tube'::character varying, 'pallet'::character varying, 'crate'::character varying, 'bag'::character varying, 'custom'::character varying])::text[]))),
	CONSTRAINT shipments_pkey PRIMARY KEY (id),
	CONSTRAINT shipments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'manifested'::character varying, 'picked_up'::character varying, 'in_transit'::character varying, 'at_hub'::character varying, 'out_for_delivery'::character varying, 'delivered'::character varying, 'failed_delivery'::character varying, 'rto_initiated'::character varying, 'returned'::character varying, 'lost'::character varying])::text[]))),
	CONSTRAINT shipments_tracking_number_key UNIQUE (tracking_number)
);
CREATE INDEX idx_shipments_carrier ON public.shipments USING btree (carrier_id);
CREATE INDEX idx_shipments_carrier_tracking ON public.shipments USING btree (carrier_tracking_number) WHERE (carrier_tracking_number IS NOT NULL);
CREATE INDEX idx_shipments_created ON public.shipments USING btree (created_at);
CREATE INDEX idx_shipments_delivery_scheduled ON public.shipments USING btree (delivery_scheduled) WHERE (delivery_scheduled IS NOT NULL);
CREATE INDEX idx_shipments_is_hazardous ON public.shipments USING btree (is_hazardous) WHERE (is_hazardous = true);
CREATE INDEX idx_shipments_is_perishable ON public.shipments USING btree (is_perishable) WHERE (is_perishable = true);
CREATE INDEX idx_shipments_item_type ON public.shipments USING btree (item_type) WHERE ((item_type)::text <> 'general'::text);
CREATE INDEX idx_shipments_order ON public.shipments USING btree (order_id);
CREATE INDEX idx_shipments_org ON public.shipments USING btree (organization_id);
CREATE INDEX idx_shipments_requires_cold_storage ON public.shipments USING btree (requires_cold_storage) WHERE (requires_cold_storage = true);
CREATE INDEX idx_shipments_sla_policy ON public.shipments USING btree (sla_policy_id) WHERE (sla_policy_id IS NOT NULL);
CREATE INDEX idx_shipments_status ON public.shipments USING btree (status);
CREATE INDEX idx_shipments_status_created ON public.shipments USING btree (status, created_at DESC);
CREATE INDEX idx_shipments_status_org ON public.shipments USING btree (organization_id, status);
CREATE INDEX idx_shipments_warehouse ON public.shipments USING btree (warehouse_id) WHERE (warehouse_id IS NOT NULL);

-- Table Triggers

create trigger trigger_update_shipments_updated_at before
update
    on
    public.shipments for each row execute function update_updated_at_column();


-- public.sla_policies definition

-- Drop table

-- DROP TABLE public.sla_policies;

CREATE TABLE public.sla_policies (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	"name" varchar(255) NOT NULL,
	service_type varchar(50) NULL,
	origin_region varchar(100) NULL,
	destination_region varchar(100) NULL,
	delivery_hours int4 NOT NULL,
	pickup_hours int4 DEFAULT 4 NULL,
	first_attempt_delivery_hours int4 NULL,
	penalty_per_hour numeric(10, 2) DEFAULT 0 NULL,
	max_penalty_amount numeric(10, 2) NULL,
	penalty_type varchar(50) DEFAULT 'fixed'::character varying NULL,
	is_active bool DEFAULT true NULL,
	priority int4 DEFAULT 5 NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	carrier_id uuid NULL,
	origin_zone_type varchar(20) NULL,
	destination_zone_type varchar(20) NULL,
	warning_threshold_percent int4 DEFAULT 80 NULL,
	CONSTRAINT sla_policies_destination_zone_type_check CHECK (((destination_zone_type IS NULL) OR ((destination_zone_type)::text = ANY ((ARRAY['local'::character varying, 'metro'::character varying, 'regional'::character varying, 'national'::character varying, 'remote'::character varying])::text[])))),
	CONSTRAINT sla_policies_origin_zone_type_check CHECK (((origin_zone_type IS NULL) OR ((origin_zone_type)::text = ANY ((ARRAY['local'::character varying, 'metro'::character varying, 'regional'::character varying, 'national'::character varying, 'remote'::character varying])::text[])))),
	CONSTRAINT sla_policies_pkey PRIMARY KEY (id),
	CONSTRAINT sla_policies_warning_threshold_percent_check CHECK (((warning_threshold_percent >= 1) AND (warning_threshold_percent <= 100)))
);
CREATE INDEX idx_sla_policies_active ON public.sla_policies USING btree (organization_id, is_active) WHERE (is_active = true);
CREATE INDEX idx_sla_policies_org ON public.sla_policies USING btree (organization_id);
CREATE INDEX idx_sla_policies_service ON public.sla_policies USING btree (service_type) WHERE (is_active = true);

-- Table Triggers

create trigger trigger_update_sla_policies_updated_at before
update
    on
    public.sla_policies for each row execute function update_updated_at_column();


-- public.sla_violations definition

-- Drop table

-- DROP TABLE public.sla_violations;

CREATE TABLE public.sla_violations (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	shipment_id uuid NULL,
	sla_policy_id uuid NULL,
	carrier_id uuid NULL,
	violation_type varchar(50) NULL,
	promised_delivery timestamptz NULL,
	actual_delivery timestamptz NULL,
	delay_hours numeric(10, 2) NULL,
	penalty_amount numeric(10, 2) NULL,
	penalty_status varchar(50) DEFAULT 'pending'::character varying NULL,
	status varchar(50) DEFAULT 'open'::character varying NULL,
	waiver_reason text NULL,
	waived_by uuid NULL,
	waived_at timestamptz NULL,
	reason varchar(255) NULL,
	notes text NULL,
	violated_at timestamptz DEFAULT now() NULL,
	resolved_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	penalty_applied bool DEFAULT false NULL,
	penalty_calculated_at timestamptz NULL,
	penalty_approved_by uuid NULL,
	CONSTRAINT sla_violations_pkey PRIMARY KEY (id),
	CONSTRAINT sla_violations_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'acknowledged'::character varying, 'investigating'::character varying, 'resolved'::character varying, 'waived'::character varying, 'disputed'::character varying])::text[])))
);
CREATE INDEX idx_sla_violations_carrier ON public.sla_violations USING btree (carrier_id) WHERE (carrier_id IS NOT NULL);
CREATE INDEX idx_sla_violations_open ON public.sla_violations USING btree (organization_id, status) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'acknowledged'::character varying])::text[]));
CREATE INDEX idx_sla_violations_org ON public.sla_violations USING btree (organization_id);
CREATE INDEX idx_sla_violations_shipment ON public.sla_violations USING btree (shipment_id) WHERE (shipment_id IS NOT NULL);
CREATE INDEX idx_sla_violations_status ON public.sla_violations USING btree (status);
CREATE INDEX idx_sla_violations_violated ON public.sla_violations USING btree (violated_at);

-- Table Triggers

create trigger trigger_update_sla_violations_updated_at before
update
    on
    public.sla_violations for each row execute function update_updated_at_column();


-- public.stock_movements definition

-- Drop table

-- DROP TABLE public.stock_movements;

CREATE TABLE public.stock_movements (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	warehouse_id uuid NOT NULL,
	product_id uuid NULL,
	inventory_id uuid NULL,
	movement_type varchar(50) NOT NULL,
	quantity int4 NOT NULL,
	reference_type varchar(50) NULL,
	reference_id uuid NULL,
	notes text NULL,
	batch_number varchar(100) NULL,
	created_by uuid NULL,
	created_at timestamptz DEFAULT now() NULL,
	performed_by varchar(255) NULL,
	CONSTRAINT stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['inbound'::character varying, 'outbound'::character varying, 'transfer_in'::character varying, 'transfer_out'::character varying, 'adjustment'::character varying, 'return'::character varying, 'damaged'::character varying, 'expired'::character varying])::text[]))),
	CONSTRAINT stock_movements_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_stock_movements_created ON public.stock_movements USING btree (created_at);
CREATE INDEX idx_stock_movements_inventory ON public.stock_movements USING btree (inventory_id) WHERE (inventory_id IS NOT NULL);
CREATE INDEX idx_stock_movements_reference ON public.stock_movements USING btree (reference_type, reference_id) WHERE (reference_id IS NOT NULL);
CREATE INDEX idx_stock_movements_type ON public.stock_movements USING btree (movement_type);
CREATE INDEX idx_stock_movements_warehouse ON public.stock_movements USING btree (warehouse_id);


-- public.suppliers definition

-- Drop table

-- DROP TABLE public.suppliers;

CREATE TABLE public.suppliers (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	code varchar(50) NOT NULL,
	contact_name varchar(255) NULL,
	contact_email varchar(255) NULL,
	contact_phone varchar(20) NULL,
	website varchar(500) NULL,
	address text NULL,
	city varchar(100) NULL,
	state varchar(100) NULL,
	country varchar(100) DEFAULT 'India'::character varying NULL,
	postal_code varchar(20) NULL,
	lead_time_days int4 DEFAULT 7 NULL,
	payment_terms varchar(100) NULL,
	reliability_score numeric(3, 2) DEFAULT 0.85 NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT suppliers_organization_id_code_key UNIQUE (organization_id, code),
	CONSTRAINT suppliers_pkey PRIMARY KEY (id),
	CONSTRAINT suppliers_reliability_score_check CHECK (((reliability_score >= (0)::numeric) AND (reliability_score <= (1)::numeric)))
);
CREATE INDEX idx_suppliers_active ON public.suppliers USING btree (organization_id, is_active);
CREATE INDEX idx_suppliers_org ON public.suppliers USING btree (organization_id);

-- Table Triggers

create trigger set_suppliers_updated_at before
update
    on
    public.suppliers for each row execute function update_updated_at_column();


-- public.system_incident_banners definition

-- Drop table

-- DROP TABLE public.system_incident_banners;

CREATE TABLE public.system_incident_banners (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	title varchar(120) NOT NULL,
	message text NOT NULL,
	severity varchar(20) DEFAULT 'warning'::character varying NOT NULL,
	starts_at timestamptz NULL,
	ends_at timestamptz NULL,
	is_active bool DEFAULT true NOT NULL,
	created_by uuid NULL,
	updated_by uuid NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT system_incident_banners_pkey PRIMARY KEY (id),
	CONSTRAINT system_incident_banners_severity_check CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critical'::character varying])::text[])))
);
CREATE INDEX idx_incident_banners_active ON public.system_incident_banners USING btree (is_active, severity, created_at DESC);
CREATE INDEX idx_incident_banners_org ON public.system_incident_banners USING btree (organization_id, created_at DESC);


-- public.user_notification_preferences definition

-- Drop table

-- DROP TABLE public.user_notification_preferences;

CREATE TABLE public.user_notification_preferences (
	id serial4 NOT NULL,
	user_id uuid NOT NULL,
	email_enabled bool DEFAULT true NULL,
	push_enabled bool DEFAULT true NULL,
	sms_enabled bool DEFAULT false NULL,
	notification_types jsonb DEFAULT '{"orders": true, "returns": true, "shipments": true, "exceptions": true, "sla_alerts": true, "system_updates": true}'::jsonb NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id),
	CONSTRAINT user_notification_preferences_user_id_key UNIQUE (user_id)
);
CREATE INDEX idx_user_preferences_user_id ON public.user_notification_preferences USING btree (user_id);

-- Table Triggers

create trigger update_user_notification_preferences_updated_at before
update
    on
    public.user_notification_preferences for each row execute function update_updated_at_column();


-- public.user_sessions definition

-- Drop table

-- DROP TABLE public.user_sessions;

CREATE TABLE public.user_sessions (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NOT NULL,
	session_token text NOT NULL,
	refresh_token text NULL,
	device_name varchar(255) NULL,
	device_type varchar(50) NULL,
	ip_address varchar(45) NULL,
	user_agent text NULL,
	is_active bool DEFAULT true NULL,
	last_active timestamptz DEFAULT now() NULL,
	created_at timestamptz DEFAULT now() NULL,
	expires_at timestamptz NOT NULL,
	jti varchar(255) NULL,
	CONSTRAINT user_sessions_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_user_sessions_active ON public.user_sessions USING btree (user_id, is_active);
CREATE INDEX idx_user_sessions_expires ON public.user_sessions USING btree (expires_at);
CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (session_token);
CREATE INDEX idx_user_sessions_user ON public.user_sessions USING btree (user_id);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


-- public.user_settings definition

-- Drop table

-- DROP TABLE public.user_settings;

CREATE TABLE public.user_settings (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NOT NULL,
	notification_preferences jsonb DEFAULT '{"sla_alerts": true, "sms_enabled": false, "push_enabled": true, "email_enabled": true, "order_updates": true, "exception_alerts": true, "shipment_updates": true}'::jsonb NULL,
	ui_preferences jsonb DEFAULT '{"theme": "system", "dashboard_layout": "default", "sidebar_collapsed": false, "table_rows_per_page": 20}'::jsonb NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT user_settings_pkey PRIMARY KEY (id),
	CONSTRAINT user_settings_user_id_key UNIQUE (user_id)
);

-- Table Triggers

create trigger trigger_update_user_settings_updated_at before
update
    on
    public.user_settings for each row execute function update_updated_at_column();


-- public.users definition

-- Drop table

-- DROP TABLE public.users;

CREATE TABLE public.users (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	email varchar(255) NOT NULL,
	password_hash varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	organization_id uuid NULL,
	avatar varchar(500) NULL,
	phone varchar(20) NULL,
	is_active bool DEFAULT true NULL,
	email_verified bool DEFAULT false NULL,
	last_login timestamptz NULL,
	failed_login_attempts int4 DEFAULT 0 NULL,
	locked_until timestamptz NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	pending_email varchar(255) NULL,
	email_change_token varchar(255) NULL,
	email_change_expires timestamptz NULL,
	token_version int4 DEFAULT 0 NOT NULL,
	CONSTRAINT users_email_key UNIQUE (email),
	CONSTRAINT users_pkey PRIMARY KEY (id),
	CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['superadmin'::character varying, 'admin'::character varying, 'operations_manager'::character varying, 'warehouse_manager'::character varying, 'carrier_partner'::character varying, 'finance'::character varying, 'customer_support'::character varying])::text[])))
);
CREATE INDEX idx_users_active ON public.users USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_users_email_change_token ON public.users USING btree (email_change_token) WHERE (email_change_token IS NOT NULL);
CREATE INDEX idx_users_organization ON public.users USING btree (organization_id) WHERE (organization_id IS NOT NULL);
CREATE INDEX idx_users_organization_id ON public.users USING btree (organization_id);
CREATE INDEX idx_users_role ON public.users USING btree (role);

-- Table Triggers

create trigger trigger_update_users_updated_at before
update
    on
    public.users for each row execute function update_updated_at_column();


-- public.warehouses definition

-- Drop table

-- DROP TABLE public.warehouses;

CREATE TABLE public.warehouses (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organization_id uuid NULL,
	code varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	address jsonb NOT NULL,
	coordinates jsonb NULL,
	capacity int4 NULL,
	current_utilization numeric(5, 2) DEFAULT 0 NULL,
	contact_email varchar(255) NULL,
	contact_phone varchar(20) NULL,
	is_active bool DEFAULT true NULL,
	warehouse_type varchar(50) DEFAULT 'fulfillment'::character varying NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	zones int4 DEFAULT 0 NULL,
	operating_hours jsonb NULL,
	gstin varchar(15) NULL,
	has_cold_storage bool DEFAULT false NOT NULL,
	temperature_min_celsius numeric(5, 1) NULL,
	temperature_max_celsius numeric(5, 1) NULL,
	customs_bonded_warehouse bool DEFAULT false NOT NULL,
	certifications _text DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT warehouses_gstin_format CHECK (((gstin IS NULL) OR ((gstin)::text ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'::text))),
	CONSTRAINT warehouses_organization_id_code_key UNIQUE (organization_id, code),
	CONSTRAINT warehouses_pkey PRIMARY KEY (id),
	CONSTRAINT warehouses_temperature_range_check CHECK (((temperature_min_celsius IS NULL) OR (temperature_max_celsius IS NULL) OR (temperature_min_celsius <= temperature_max_celsius))),
	CONSTRAINT warehouses_warehouse_type_check CHECK (((warehouse_type)::text = ANY ((ARRAY['standard'::character varying, 'fulfillment'::character varying, 'distribution'::character varying, 'cold_storage'::character varying, 'hazmat'::character varying, 'bonded_customs'::character varying, 'returns_center'::character varying])::text[])))
);
CREATE INDEX idx_warehouses_active ON public.warehouses USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_warehouses_bonded_customs ON public.warehouses USING btree (customs_bonded_warehouse) WHERE (customs_bonded_warehouse = true);
CREATE INDEX idx_warehouses_cold_storage ON public.warehouses USING btree (has_cold_storage) WHERE (has_cold_storage = true);
CREATE INDEX idx_warehouses_org ON public.warehouses USING btree (organization_id);
CREATE INDEX idx_warehouses_organization_id ON public.warehouses USING btree (organization_id);

-- Table Triggers

create trigger trigger_update_warehouses_updated_at before
update
    on
    public.warehouses for each row execute function update_updated_at_column();


-- public.webhook_logs definition

-- Drop table

-- DROP TABLE public.webhook_logs;

CREATE TABLE public.webhook_logs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	carrier_id uuid NULL,
	endpoint varchar(255) NOT NULL,
	"method" varchar(10) DEFAULT 'POST'::character varying NULL,
	request_signature text NULL,
	request_timestamp int8 NULL,
	signature_valid bool NULL,
	ip_address inet NULL,
	user_agent text NULL,
	payload jsonb NULL,
	headers jsonb NULL,
	response_status int4 NULL,
	response_body jsonb NULL,
	error_message text NULL,
	processing_time_ms int4 NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT webhook_logs_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_webhook_logs_carrier ON public.webhook_logs USING btree (carrier_id, created_at DESC);
CREATE INDEX idx_webhook_logs_created ON public.webhook_logs USING btree (created_at);
CREATE INDEX idx_webhook_logs_endpoint ON public.webhook_logs USING btree (endpoint, created_at DESC);
CREATE INDEX idx_webhook_logs_signature_valid ON public.webhook_logs USING btree (signature_valid, created_at DESC);
CREATE INDEX idx_webhook_logs_valid ON public.webhook_logs USING btree (signature_valid);


-- public.alerts foreign keys

ALTER TABLE public.alerts ADD CONSTRAINT alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);
ALTER TABLE public.alerts ADD CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.alerts ADD CONSTRAINT alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


-- public.allocation_history foreign keys

ALTER TABLE public.allocation_history ADD CONSTRAINT allocation_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.allocation_history ADD CONSTRAINT allocation_history_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);
ALTER TABLE public.allocation_history ADD CONSTRAINT allocation_history_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


-- public.audit_logs foreign keys

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


-- public.background_jobs foreign keys

ALTER TABLE public.background_jobs ADD CONSTRAINT background_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.background_jobs ADD CONSTRAINT background_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


-- public.carrier_assignments foreign keys

ALTER TABLE public.carrier_assignments ADD CONSTRAINT carrier_assignments_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);
ALTER TABLE public.carrier_assignments ADD CONSTRAINT carrier_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE public.carrier_assignments ADD CONSTRAINT carrier_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


-- public.carrier_performance_metrics foreign keys

ALTER TABLE public.carrier_performance_metrics ADD CONSTRAINT carrier_performance_metrics_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);
ALTER TABLE public.carrier_performance_metrics ADD CONSTRAINT carrier_performance_metrics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


-- public.carrier_quotes foreign keys

ALTER TABLE public.carrier_quotes ADD CONSTRAINT carrier_quotes_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);
ALTER TABLE public.carrier_quotes ADD CONSTRAINT carrier_quotes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.carrier_quotes ADD CONSTRAINT carrier_quotes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


-- public.carrier_rejections foreign keys

ALTER TABLE public.carrier_rejections ADD CONSTRAINT carrier_rejections_carrier_assignment_id_fkey FOREIGN KEY (carrier_assignment_id) REFERENCES public.carrier_assignments(id);
ALTER TABLE public.carrier_rejections ADD CONSTRAINT carrier_rejections_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);
ALTER TABLE public.carrier_rejections ADD CONSTRAINT carrier_rejections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


-- public.carriers foreign keys

ALTER TABLE public.carriers ADD CONSTRAINT carriers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


-- public.cron_schedules foreign keys

ALTER TABLE public.cron_schedules ADD CONSTRAINT cron_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


-- public.eta_predictions foreign keys

ALTER TABLE public.eta_predictions ADD CONSTRAINT eta_predictions_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


-- public.exceptions foreign keys

ALTER TABLE public.exceptions ADD CONSTRAINT exceptions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);
ALTER TABLE public.exceptions ADD CONSTRAINT exceptions_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);
ALTER TABLE public.exceptions ADD CONSTRAINT exceptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.exceptions ADD CONSTRAINT exceptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.exceptions ADD CONSTRAINT exceptions_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


-- public.inventory foreign keys

ALTER TABLE public.inventory ADD CONSTRAINT inventory_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.inventory ADD CONSTRAINT inventory_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


-- public.invoice_line_items foreign keys

ALTER TABLE public.invoice_line_items ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_line_items ADD CONSTRAINT invoice_line_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.invoice_line_items ADD CONSTRAINT invoice_line_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


-- public.invoices foreign keys

ALTER TABLE public.invoices ADD CONSTRAINT invoices_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


-- public.job_execution_logs foreign keys

ALTER TABLE public.job_execution_logs ADD CONSTRAINT job_execution_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.background_jobs(id) ON DELETE CASCADE;


-- public.notifications foreign keys

ALTER TABLE public.notifications ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- public.order_items foreign keys

ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


-- public.orders foreign keys

ALTER TABLE public.orders ADD CONSTRAINT orders_allocated_warehouse_id_fkey FOREIGN KEY (allocated_warehouse_id) REFERENCES public.warehouses(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


-- public.organization_audit_logs foreign keys

ALTER TABLE public.organization_audit_logs ADD CONSTRAINT organization_audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.organization_audit_logs ADD CONSTRAINT organization_audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


-- public.organizations foreign keys

ALTER TABLE public.organizations ADD CONSTRAINT organizations_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES public.users(id) ON DELETE SET NULL;


-- public.products foreign keys

ALTER TABLE public.products ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.products ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


-- public.quote_idempotency_cache foreign keys

ALTER TABLE public.quote_idempotency_cache ADD CONSTRAINT quote_idempotency_cache_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.carrier_quotes(id);


-- public.rate_cards foreign keys

ALTER TABLE public.rate_cards ADD CONSTRAINT rate_cards_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id) ON DELETE CASCADE;


-- public.restock_order_items foreign keys

ALTER TABLE public.restock_order_items ADD CONSTRAINT restock_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.restock_order_items ADD CONSTRAINT restock_order_items_restock_order_id_fkey FOREIGN KEY (restock_order_id) REFERENCES public.restock_orders(id) ON DELETE CASCADE;


-- public.restock_orders foreign keys

ALTER TABLE public.restock_orders ADD CONSTRAINT restock_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.restock_orders ADD CONSTRAINT restock_orders_destination_warehouse_id_fkey FOREIGN KEY (destination_warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;
ALTER TABLE public.restock_orders ADD CONSTRAINT restock_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.restock_orders ADD CONSTRAINT restock_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


-- public.return_items foreign keys

ALTER TABLE public.return_items ADD CONSTRAINT return_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);
ALTER TABLE public.return_items ADD CONSTRAINT return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.return_items ADD CONSTRAINT return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public."returns"(id) ON DELETE CASCADE;


-- public."returns" foreign keys

ALTER TABLE public."returns" ADD CONSTRAINT returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public."returns" ADD CONSTRAINT returns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public."returns" ADD CONSTRAINT returns_original_shipment_id_fkey FOREIGN KEY (original_shipment_id) REFERENCES public.shipments(id);
ALTER TABLE public."returns" ADD CONSTRAINT returns_return_shipment_id_fkey FOREIGN KEY (return_shipment_id) REFERENCES public.shipments(id);


-- public.revoked_tokens foreign keys

ALTER TABLE public.revoked_tokens ADD CONSTRAINT revoked_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- public.sales_channels foreign keys

ALTER TABLE public.sales_channels ADD CONSTRAINT sales_channels_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id);
ALTER TABLE public.sales_channels ADD CONSTRAINT sales_channels_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


-- public.shipment_events foreign keys

ALTER TABLE public.shipment_events ADD CONSTRAINT shipment_events_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE;


-- public.shipments foreign keys

ALTER TABLE public.shipments ADD CONSTRAINT shipments_carrier_assignment_id_fkey FOREIGN KEY (carrier_assignment_id) REFERENCES public.carrier_assignments(id);
ALTER TABLE public.shipments ADD CONSTRAINT shipments_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);
ALTER TABLE public.shipments ADD CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.shipments ADD CONSTRAINT shipments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.shipments ADD CONSTRAINT shipments_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.sla_policies(id) ON DELETE SET NULL;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


-- public.sla_policies foreign keys

ALTER TABLE public.sla_policies ADD CONSTRAINT sla_policies_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id) ON DELETE SET NULL;
ALTER TABLE public.sla_policies ADD CONSTRAINT sla_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


-- public.sla_violations foreign keys

ALTER TABLE public.sla_violations ADD CONSTRAINT sla_violations_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);
ALTER TABLE public.sla_violations ADD CONSTRAINT sla_violations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.sla_violations ADD CONSTRAINT sla_violations_penalty_approved_by_fkey FOREIGN KEY (penalty_approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.sla_violations ADD CONSTRAINT sla_violations_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);
ALTER TABLE public.sla_violations ADD CONSTRAINT sla_violations_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.sla_policies(id);
ALTER TABLE public.sla_violations ADD CONSTRAINT sla_violations_waived_by_fkey FOREIGN KEY (waived_by) REFERENCES public.users(id);


-- public.stock_movements foreign keys

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


-- public.suppliers foreign keys

ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


-- public.system_incident_banners foreign keys

ALTER TABLE public.system_incident_banners ADD CONSTRAINT system_incident_banners_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.system_incident_banners ADD CONSTRAINT system_incident_banners_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.system_incident_banners ADD CONSTRAINT system_incident_banners_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


-- public.user_notification_preferences foreign keys

ALTER TABLE public.user_notification_preferences ADD CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- public.user_sessions foreign keys

ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- public.user_settings foreign keys

ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- public.users foreign keys

ALTER TABLE public.users ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


-- public.warehouses foreign keys

ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


-- public.webhook_logs foreign keys

ALTER TABLE public.webhook_logs ADD CONSTRAINT webhook_logs_carrier_id_fkey FOREIGN KEY (carrier_id) REFERENCES public.carriers(id);


-- public.carrier_performance_summary source

CREATE OR REPLACE VIEW public.carrier_performance_summary
AS SELECT c.id AS carrier_id,
    c.name AS carrier_name,
    c.code AS carrier_code,
    c.reliability_score,
    c.availability_status,
    c.daily_capacity,
    c.current_load,
        CASE
            WHEN c.daily_capacity > 0 THEN round(c.current_load::numeric / c.daily_capacity::numeric * 100::numeric, 2)
            ELSE 0::numeric
        END AS utilization_percentage,
    count(DISTINCT s.id) AS total_shipments,
    count(DISTINCT s.id) FILTER (WHERE s.status::text = 'delivered'::text) AS delivered_count,
    count(DISTINCT s.id) FILTER (WHERE s.status::text = ANY (ARRAY['failed_delivery'::character varying, 'returned'::character varying, 'lost'::character varying]::text[])) AS failed_count,
    round(count(DISTINCT s.id) FILTER (WHERE s.status::text = 'delivered'::text)::numeric / NULLIF(count(DISTINCT s.id), 0)::numeric * 100::numeric, 2) AS success_rate,
    count(DISTINCT sv.id) AS sla_violations
   FROM carriers c
     LEFT JOIN shipments s ON s.carrier_id = c.id AND s.created_at > (now() - '30 days'::interval)
     LEFT JOIN sla_violations sv ON sv.carrier_id = c.id AND sv.violated_at > (now() - '30 days'::interval)
  WHERE c.is_active = true
  GROUP BY c.id, c.name, c.code, c.reliability_score, c.availability_status, c.daily_capacity, c.current_load;


-- public.carrier_rejection_analysis source

CREATE OR REPLACE VIEW public.carrier_rejection_analysis
AS SELECT cr.carrier_id,
    c.name AS carrier_name,
    c.code AS carrier_code,
    cr.reason,
    count(*) AS rejection_count,
    round(avg(cr.response_time_ms), 2) AS avg_response_time_ms,
    min(cr.rejected_at) AS first_rejection,
    max(cr.rejected_at) AS last_rejection
   FROM carrier_rejections cr
     JOIN carriers c ON c.id = cr.carrier_id
  WHERE cr.rejected_at > (now() - '30 days'::interval)
  GROUP BY cr.carrier_id, c.name, c.code, cr.reason
  ORDER BY (count(*)) DESC;


-- public.carrier_webhook_config source

CREATE OR REPLACE VIEW public.carrier_webhook_config
AS SELECT id,
    code,
    name,
    webhook_secret,
    our_client_id,
    webhook_events,
    webhook_enabled,
    ip_whitelist,
    created_at
   FROM carriers
  WHERE webhook_enabled = true;


-- public.transfer_orders source

CREATE OR REPLACE VIEW public.transfer_orders
AS SELECT o.id,
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
           FROM warehouses w
          WHERE w.address::text = o.billing_address::text
         LIMIT 1) AS from_warehouse_id,
    ( SELECT w.id
           FROM warehouses w
          WHERE w.address::text = o.shipping_address::text
         LIMIT 1) AS to_warehouse_id,
    s.id AS shipment_id,
    s.tracking_number,
    s.status AS shipment_status,
    c.name AS carrier_name
   FROM orders o
     LEFT JOIN shipments s ON s.order_id = o.id
     LEFT JOIN carriers c ON s.carrier_id = c.id
  WHERE o.order_type::text = 'transfer'::text;


-- public.v_order_items_shipping_details source

CREATE OR REPLACE VIEW public.v_order_items_shipping_details
AS SELECT id,
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
    ((dimensions ->> 'length'::text)::numeric) * ((dimensions ->> 'width'::text)::numeric) * ((dimensions ->> 'height'::text)::numeric) / 1000000.0 AS volume_cubic_meters,
        CASE
            WHEN is_fragile OR is_hazardous OR is_perishable OR requires_cold_storage THEN true
            ELSE false
        END AS requires_special_handling
   FROM order_items oi;



-- DROP FUNCTION public.armor(bytea);

CREATE OR REPLACE FUNCTION public.armor(bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_armor$function$
;

-- DROP FUNCTION public.armor(bytea, _text, _text);

CREATE OR REPLACE FUNCTION public.armor(bytea, text[], text[])
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_armor$function$
;

-- DROP FUNCTION public.calculate_product_volumetric_weight();

CREATE OR REPLACE FUNCTION public.calculate_product_volumetric_weight()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

-- DROP FUNCTION public.calculate_volumetric_weight();

CREATE OR REPLACE FUNCTION public.calculate_volumetric_weight()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

-- DROP FUNCTION public.crypt(text, text);

CREATE OR REPLACE FUNCTION public.crypt(text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_crypt$function$
;

-- DROP FUNCTION public.dearmor(text);

CREATE OR REPLACE FUNCTION public.dearmor(text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_dearmor$function$
;

-- DROP FUNCTION public.decrypt(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.decrypt(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_decrypt$function$
;

-- DROP FUNCTION public.decrypt_iv(bytea, bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.decrypt_iv(bytea, bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_decrypt_iv$function$
;

-- DROP FUNCTION public.digest(text, text);

CREATE OR REPLACE FUNCTION public.digest(text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_digest$function$
;

-- DROP FUNCTION public.digest(bytea, text);

CREATE OR REPLACE FUNCTION public.digest(bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_digest$function$
;

-- DROP FUNCTION public.encrypt(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.encrypt(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_encrypt$function$
;

-- DROP FUNCTION public.encrypt_iv(bytea, bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.encrypt_iv(bytea, bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_encrypt_iv$function$
;

-- DROP FUNCTION public.fips_mode();

CREATE OR REPLACE FUNCTION public.fips_mode()
 RETURNS boolean
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_check_fipsmode$function$
;

-- DROP FUNCTION public.gen_random_bytes(int4);

CREATE OR REPLACE FUNCTION public.gen_random_bytes(integer)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_random_bytes$function$
;

-- DROP FUNCTION public.gen_random_uuid();

CREATE OR REPLACE FUNCTION public.gen_random_uuid()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE
AS '$libdir/pgcrypto', $function$pg_random_uuid$function$
;

-- DROP FUNCTION public.gen_salt(text);

CREATE OR REPLACE FUNCTION public.gen_salt(text)
 RETURNS text
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_gen_salt$function$
;

-- DROP FUNCTION public.gen_salt(text, int4);

CREATE OR REPLACE FUNCTION public.gen_salt(text, integer)
 RETURNS text
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_gen_salt_rounds$function$
;

-- DROP FUNCTION public.generate_exception_ticket();

CREATE OR REPLACE FUNCTION public.generate_exception_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := 'EX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                             LPAD(nextval('public.exception_ticket_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.generate_restock_number();

CREATE OR REPLACE FUNCTION public.generate_restock_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.restock_number IS NULL THEN
        NEW.restock_number := 'RST-' || TO_CHAR(NOW(), 'YY') || '-' ||
                              LPAD(nextval('public.restock_order_number_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.generate_webhook_credentials();

CREATE OR REPLACE FUNCTION public.generate_webhook_credentials()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

-- DROP FUNCTION public.hmac(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.hmac(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_hmac$function$
;

-- DROP FUNCTION public.hmac(text, text, text);

CREATE OR REPLACE FUNCTION public.hmac(text, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_hmac$function$
;

-- DROP FUNCTION public.pgp_armor_headers(in text, out text, out text);

CREATE OR REPLACE FUNCTION public.pgp_armor_headers(text, OUT key text, OUT value text)
 RETURNS SETOF record
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_armor_headers$function$
;

-- DROP FUNCTION public.pgp_key_id(bytea);

CREATE OR REPLACE FUNCTION public.pgp_key_id(bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_key_id_w$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt(bytea, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt(bytea, bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea, text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt(text, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt(text, bytea)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt(text, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt(text, bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt(bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(bytea, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt(bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(bytea, text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt_bytea(bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt_bytea(bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt_bytea(bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt_bytea(bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt(text, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(text, text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt(text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt_bytea(bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt_bytea(bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt_bytea(bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt_bytea(bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$
;

-- DROP FUNCTION public.sync_inventory_product_info();

CREATE OR REPLACE FUNCTION public.sync_inventory_product_info()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

-- DROP FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $function$
;