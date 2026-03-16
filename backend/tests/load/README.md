# Load Testing Baseline (k6)

This folder contains a baseline stress test for backend availability and error contract validation.

## File
- `k6-smoke.js`: runs concurrent probes for `health` and representative API endpoints.

## Why this test exists
- Validates API responsiveness under load.
- Ensures error responses still include `message` when status is `4xx/5xx`.
- Catches regressions where auth/rate-limit responses become opaque to frontend toasts.

## Run

```bash
# Optional auth cookie for authenticated flows
# Example: AUTH_COOKIE="accessToken=...; refreshToken=..."
API_BASE=http://localhost:3000/api AUTH_COOKIE="" k6 run tests/load/k6-smoke.js
```

## Interpreting failures
- `http_req_failed` above threshold means service instability.
- `api_errors` > 0 usually means malformed JSON/error contract drift.
- `api_latency` p95 above threshold indicates saturation or DB/API contention.

## Next steps for production-grade testing
1. Add authenticated scenario with real login bootstrap in setup().
2. Add import workload scenario (`/import/upload`) plus concurrent read traffic.
3. Add chaos scenario: Redis unavailable + background queue retries.
4. Add endpoint-specific SLO thresholds by route family.
