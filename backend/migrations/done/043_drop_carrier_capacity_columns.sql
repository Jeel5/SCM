-- Migration 043: remove deprecated carrier capacity columns
BEGIN;

DROP VIEW IF EXISTS public.carrier_performance_summary;

ALTER TABLE public.carriers
  DROP COLUMN IF EXISTS daily_capacity,
  DROP COLUMN IF EXISTS current_load;

CREATE OR REPLACE VIEW public.carrier_performance_summary AS
SELECT
  c.id AS carrier_id,
  c.name AS carrier_name,
  c.code AS carrier_code,
  c.reliability_score,
  c.availability_status,
  0::numeric AS utilization_percentage,
  count(DISTINCT s.id) AS total_shipments,
  count(DISTINCT s.id) FILTER (WHERE s.status::text = 'delivered'::text) AS delivered_count,
  count(DISTINCT s.id) FILTER (WHERE s.status::text = ANY (ARRAY['failed_delivery'::character varying, 'returned'::character varying, 'lost'::character varying]::text[])) AS failed_count,
  round(count(DISTINCT s.id) FILTER (WHERE s.status::text = 'delivered'::text)::numeric / NULLIF(count(DISTINCT s.id), 0)::numeric * 100::numeric, 2) AS success_rate,
  count(DISTINCT sv.id) AS sla_violations
FROM carriers c
LEFT JOIN shipments s ON s.carrier_id = c.id AND s.created_at > (now() - '30 days'::interval)
LEFT JOIN sla_violations sv ON sv.carrier_id = c.id AND sv.violated_at > (now() - '30 days'::interval)
WHERE c.is_active = true
GROUP BY c.id, c.name, c.code, c.reliability_score, c.availability_status;

COMMIT;
