WITH base AS (
  SELECT
    s.id AS shipment_id,
    s.organization_id,
    s.carrier_id,
    s.order_id,
    COALESCE(s.delivery_scheduled, NOW() - INTERVAL '30 hours') AS promised_delivery
  FROM shipments s
  WHERE s.organization_id IS NOT NULL
  ORDER BY s.created_at DESC
  LIMIT 1
),
policy AS (
  INSERT INTO sla_policies (
    organization_id, name, service_type, carrier_id,
    origin_region, destination_region,
    delivery_hours, pickup_hours,
    penalty_per_hour, max_penalty_amount, penalty_type,
    warning_threshold_percent, is_active, priority
  )
  SELECT
    b.organization_id,
    'Manual SLA Frontend Test Policy',
    'express',
    b.carrier_id,
    'Metro Cities',
    'Regional',
    24,
    4,
    50,
    500,
    'fixed',
    80,
    TRUE,
    5
  FROM base b
  RETURNING id, organization_id
)
INSERT INTO sla_violations (
  organization_id, shipment_id, sla_policy_id, carrier_id,
  violation_type, promised_delivery, actual_delivery,
  delay_hours, penalty_amount, status, reason, notes, violated_at, resolved_at
)
SELECT
  b.organization_id, b.shipment_id, p.id, b.carrier_id,
  'delivery_delay',
  b.promised_delivery,
  NOW() - INTERVAL '2 hours',
  8.00, 400.00, 'open',
  'Late delivery', 'Manual test violation - open', NOW() - INTERVAL '6 hours', NULL
FROM base b CROSS JOIN policy p
UNION ALL
SELECT
  b.organization_id, b.shipment_id, p.id, b.carrier_id,
  'delivery_delay',
  b.promised_delivery,
  NOW() - INTERVAL '1 hours',
  5.00, 250.00, 'resolved',
  'Resolved delay', 'Manual test violation - resolved', NOW() - INTERVAL '18 hours', NOW() - INTERVAL '3 hours'
FROM base b CROSS JOIN policy p
UNION ALL
SELECT
  b.organization_id, b.shipment_id, p.id, b.carrier_id,
  'delivery_delay',
  b.promised_delivery,
  NOW() - INTERVAL '30 minutes',
  3.00, 150.00, 'waived',
  'Waived by ops', 'Manual test violation - waived', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '1 hours'
FROM base b CROSS JOIN policy p;

INSERT INTO exceptions (
  organization_id, shipment_id, order_id,
  exception_type, severity, title, description, status,
  root_cause, sla_impacted, estimated_resolution_time, resolved_at, resolution
)
SELECT
  s.organization_id,
  s.id,
  s.order_id,
  x.exception_type,
  x.severity,
  x.title,
  x.description,
  x.status,
  x.root_cause,
  TRUE,
  NOW() + INTERVAL '4 hours',
  x.resolved_at,
  x.resolution
FROM (
  SELECT id, organization_id, order_id
  FROM shipments
  WHERE organization_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
) s
CROSS JOIN (
  VALUES
    ('delay','critical','Critical Delay','Shipment stuck at hub for 18 hours','open','Carrier pickup backlog',NULL,NULL),
    ('carrier_issue','high','Carrier Routing Issue','Carrier assigned wrong route','investigating','Routing table mismatch',NULL,NULL),
    ('delivery_failed','medium','Delivery Failed','Customer unavailable on first attempt','resolved','Customer unavailable',NOW() - INTERVAL '2 hours','Rescheduled and delivered successfully')
) AS x(exception_type,severity,title,description,status,root_cause,resolved_at,resolution);