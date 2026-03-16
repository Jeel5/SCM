CREATE TABLE IF NOT EXISTS analytics_daily_stats (
    organization_id uuid NOT NULL,
    stat_date date NOT NULL,
    orders_total integer NOT NULL DEFAULT 0,
    orders_pending integer NOT NULL DEFAULT 0,
    orders_processing integer NOT NULL DEFAULT 0,
    orders_shipped integer NOT NULL DEFAULT 0,
    orders_delivered integer NOT NULL DEFAULT 0,
    orders_cancelled integer NOT NULL DEFAULT 0,
    orders_returned integer NOT NULL DEFAULT 0,
    orders_value numeric(14,2) NOT NULL DEFAULT 0,
    shipments_total integer NOT NULL DEFAULT 0,
    shipments_in_transit integer NOT NULL DEFAULT 0,
    shipments_out_for_delivery integer NOT NULL DEFAULT 0,
    shipments_delivered integer NOT NULL DEFAULT 0,
    shipments_failed integer NOT NULL DEFAULT 0,
    shipments_on_time integer NOT NULL DEFAULT 0,
    shipping_cost_total numeric(14,2) NOT NULL DEFAULT 0,
    avg_delivery_days numeric(10,2) NOT NULL DEFAULT 0,
    returns_total integer NOT NULL DEFAULT 0,
    returns_pending integer NOT NULL DEFAULT 0,
    returns_refunded integer NOT NULL DEFAULT 0,
    refund_amount numeric(14,2) NOT NULL DEFAULT 0,
    exceptions_created integer NOT NULL DEFAULT 0,
    sla_violations integer NOT NULL DEFAULT 0,
    penalties_total numeric(14,2) NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, stat_date)
);

CREATE INDEX IF NOT EXISTS analytics_daily_stats_stat_date_idx
    ON analytics_daily_stats (stat_date DESC);

CREATE TABLE IF NOT EXISTS analytics_daily_carrier_stats (
    organization_id uuid NOT NULL,
    stat_date date NOT NULL,
    carrier_id uuid NOT NULL,
    total_shipments integer NOT NULL DEFAULT 0,
    delivered_shipments integer NOT NULL DEFAULT 0,
    on_time_deliveries integer NOT NULL DEFAULT 0,
    failed_deliveries integer NOT NULL DEFAULT 0,
    total_cost numeric(14,2) NOT NULL DEFAULT 0,
    avg_delay_hours numeric(10,2) NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, stat_date, carrier_id)
);

CREATE INDEX IF NOT EXISTS analytics_daily_carrier_stats_carrier_idx
    ON analytics_daily_carrier_stats (carrier_id, stat_date DESC);

CREATE TABLE IF NOT EXISTS analytics_daily_warehouse_activity (
    organization_id uuid NOT NULL,
    stat_date date NOT NULL,
    warehouse_id uuid NOT NULL,
    inbound_count integer NOT NULL DEFAULT 0,
    outbound_count integer NOT NULL DEFAULT 0,
    inbound_units integer NOT NULL DEFAULT 0,
    outbound_units integer NOT NULL DEFAULT 0,
    shipments_processed integer NOT NULL DEFAULT 0,
    orders_fulfilled integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, stat_date, warehouse_id)
);

CREATE INDEX IF NOT EXISTS analytics_daily_warehouse_activity_warehouse_idx
    ON analytics_daily_warehouse_activity (warehouse_id, stat_date DESC);