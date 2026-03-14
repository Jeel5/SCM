-- Migration 038: Add missing PRIMARY KEY constraints (idempotent)

DO $$
DECLARE
	tbl text;
	tables_with_id text[] := ARRAY[
		'organizations', 'users', 'warehouses', 'carriers', 'products', 'inventory',
		'orders', 'order_items', 'order_splits', 'shipments', 'shipment_events',
		'returns', 'return_items', 'carrier_assignments', 'carrier_quotes',
		'carrier_rejections', 'carrier_capacity_log', 'carrier_performance_metrics',
		'rate_cards', 'invoices', 'invoice_line_items', 'sla_policies',
		'sla_violations', 'exceptions', 'alerts', 'alert_rules', 'notifications',
		'user_notification_preferences', 'user_permissions', 'user_sessions',
		'user_settings', 'audit_logs', 'background_jobs', 'job_execution_logs',
		'cron_schedules', 'dead_letter_queue', 'stock_movements', 'pick_lists',
		'pick_list_items', 'allocation_history', 'allocation_rules', 'eta_predictions',
		'shipping_estimates', 'postal_zones', 'zone_distances', 'sales_channels',
		'suppliers', 'revoked_tokens', 'webhook_logs'
	];
BEGIN
	FOREACH tbl IN ARRAY tables_with_id LOOP
		IF to_regclass(format('public.%I', tbl)) IS NOT NULL
			 AND EXISTS (
				 SELECT 1
				 FROM information_schema.columns
				 WHERE table_schema = 'public'
					 AND table_name = tbl
					 AND column_name = 'id'
			 )
			 AND NOT EXISTS (
				 SELECT 1
				 FROM pg_constraint c
				 JOIN pg_class r ON r.oid = c.conrelid
				 JOIN pg_namespace n ON n.oid = r.relnamespace
				 WHERE c.contype = 'p'
					 AND n.nspname = 'public'
					 AND r.relname = tbl
			 )
		THEN
			EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (id)', tbl);
		END IF;
	END LOOP;

	-- quote_idempotency_cache uses idempotency_key as its natural PK (no id column)
	IF to_regclass('public.quote_idempotency_cache') IS NOT NULL
		 AND NOT EXISTS (
			 SELECT 1
			 FROM pg_constraint c
			 JOIN pg_class r ON r.oid = c.conrelid
			 JOIN pg_namespace n ON n.oid = r.relnamespace
			 WHERE c.contype = 'p'
				 AND n.nspname = 'public'
				 AND r.relname = 'quote_idempotency_cache'
		 )
	THEN
		ALTER TABLE public.quote_idempotency_cache ADD PRIMARY KEY (idempotency_key);
	END IF;
END $$;
