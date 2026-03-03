/**
 * Prometheus metrics middleware (prom-client).
 *
 * Exposes GET /metrics — scraped by Prometheus every 15s.
 *
 * Default metrics collected automatically:
 *   - process_cpu_seconds_total
 *   - process_resident_memory_bytes
 *   - nodejs_eventloop_lag_seconds
 *   - nodejs_active_handles_total
 *   - nodejs_heap_size_used_bytes
 *   ... (all standard prom-client defaults)
 *
 * Custom metrics:
 *   http_request_duration_ms  — latency histogram labelled by method + route + status
 *   http_requests_total       — counter by method + route + status
 *   active_connections        — gauge (Socket.IO connections tracked separately)
 */
import client from 'prom-client';

const { Registry, collectDefaultMetrics, Histogram, Counter, Gauge } = client;

export const register = new Registry();

// Collect Node.js process + GC metrics automatically
collectDefaultMetrics({ register, prefix: 'scm_' });

// ── HTTP duration histogram ───────────────────────────────────────────────────
export const httpDuration = new Histogram({
  name:    'scm_http_request_duration_ms',
  help:    'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

// ── HTTP request counter ─────────────────────────────────────────────────────
export const httpRequests = new Counter({
  name:    'scm_http_requests_total',
  help:    'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// ── Active WebSocket connections ──────────────────────────────────────────────
export const activeConnections = new Gauge({
  name:    'scm_socket_active_connections',
  help:    'Number of active Socket.IO connections',
  registers: [register],
});

// ── Business metrics ──────────────────────────────────────────────────────────
export const ordersCreated = new Counter({
  name:    'scm_orders_created_total',
  help:    'Total orders created',
  registers: [register],
});

export const cacheHits = new Counter({
  name:    'scm_cache_hits_total',
  help:    'Redis cache hits',
  labelNames: ['endpoint'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name:    'scm_cache_misses_total',
  help:    'Redis cache misses',
  labelNames: ['endpoint'],
  registers: [register],
});

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * Attach this BEFORE routes to record every request's duration and status.
 * Route label is normalised to strip dynamic segments (:id, UUIDs, numbers)
 * so cardinality stays low.
 */
export function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    // Normalise route — use Express matched route if available, else path
    let route = req.route?.path || req.path || 'unknown';
    // Strip UUIDs and numeric IDs to reduce cardinality
    route = route
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');

    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };

    httpDuration.observe(labels, Date.now() - start);
    httpRequests.inc(labels);
  });

  next();
}

/**
 * GET /metrics handler — returns Prometheus text format.
 * Should be protected in production (put behind internal network or basic auth).
 */
export async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
