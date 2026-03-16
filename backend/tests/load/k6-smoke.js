import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const API_BASE = __ENV.API_BASE || 'http://localhost:3000/api';
const AUTH_COOKIE = __ENV.AUTH_COOKIE || '';

export const options = {
  scenarios: {
    health_probe: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '40s', target: 20 },
        { duration: '20s', target: 0 },
      ],
      exec: 'healthProbe',
    },
    api_smoke: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '20s', target: 10 },
        { duration: '40s', target: 10 },
        { duration: '20s', target: 0 },
      ],
      exec: 'apiSmoke',
      startTime: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1200'],
    api_errors: ['count<100'],
    api_latency: ['p(95)<1500'],
  },
};

const apiErrors = new Counter('api_errors');
const apiLatency = new Trend('api_latency');

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_COOKIE) headers.Cookie = AUTH_COOKIE;
  return { headers };
}

export function healthProbe() {
  const res = http.get(`${API_BASE.replace('/api', '')}/health`);
  check(res, {
    'health status is 200': (r) => r.status === 200,
    'health has ok payload': (r) => r.body && r.body.includes('ok'),
  });
  sleep(0.2);
}

export function apiSmoke() {
  const requests = [
    ['GET', `${API_BASE}/inventory`],
    ['GET', `${API_BASE}/shipments`],
    ['GET', `${API_BASE}/orders`],
    ['GET', `${API_BASE}/notifications/unread-count`],
  ];

  for (const [method, url] of requests) {
    const res = http.request(method, url, null, getHeaders());
    apiLatency.add(res.timings.duration);

    const ok = check(res, {
      'response code is expected': (r) => [200, 401, 403].includes(r.status),
      'error payload has message': (r) => {
        if (r.status < 400) return true;
        try {
          const body = JSON.parse(r.body || '{}');
          return typeof body.message === 'string' && body.message.length > 0;
        } catch {
          return false;
        }
      },
    });

    if (!ok) apiErrors.add(1);
  }

  sleep(0.4);
}
