import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// ── Configuration ─────────────────────────────────────────────────────────────
// Override with: k6 run -e BASE_URL=http://localhost:3000 search.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const POLL_INTERVAL_SEC = 2;
const POLL_TIMEOUT_MS = 30_000;

// Each virtual user picks a random query from this list to simulate
// different users hitting different products.
const QUERIES = [
  'samsung tv',
  'iphone 14',
  'generator',
  'laptop',
  'washing machine',
  'air conditioner',
  'bluetooth speaker',
  'nike shoes',
  'mattress',
  'gas cooker',
];

// ── Custom metrics ────────────────────────────────────────────────────────────
const cachedHits   = new Counter('cached_hits');    // submit returned COMPLETED immediately
const completedJobs = new Counter('completed_jobs'); // job reached COMPLETED via polling
const failedJobs   = new Counter('failed_jobs');     // job reached FAILED
const timedOutJobs = new Counter('timed_out_jobs');  // job never settled within 30s

// ── Load profile + thresholds ─────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp up to 50 users over 30s
    { duration: '60s', target: 50 }, // hold at 50 users for 60s
    { duration: '10s', target: 0 },  // ramp down over 10s
  ],
  thresholds: {
    // 95% of SUBMIT requests must complete under 500ms
    'http_req_duration{endpoint:submit}': ['p(95)<500'],
    // Less than 1% of all requests may fail
    'http_req_failed': ['rate<0.01'],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function pickQuery() {
  return QUERIES[Math.floor(Math.random() * QUERIES.length)];
}

function safeJson(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

// ── The full search flow, run once per VU iteration ───────────────────────────
export default function () {
  const keyword = pickQuery();

  // 1. Submit the search
  const submitRes = http.post(
    `${BASE_URL}/api/v1/search/keyword`,
    JSON.stringify({ keyword }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'submit' },
    }
  );

  const submitBody = safeJson(submitRes);

  check(submitRes, {
    'submit returns 200 or 202': (r) => r.status === 200 || r.status === 202,
    'submit response contains jobId': () => submitBody !== null && submitBody.jobId !== undefined,
  });

  if (!submitBody || !submitBody.jobId) {
    return;
  }

  // 2. Cached / already-complete job — return immediately
  if (submitBody.status === 'COMPLETED') {
    cachedHits.add(1);
    check(submitBody, {
      'cached job has results': (b) => Array.isArray(b.results),
    });
    sleep(1);
    return;
  }

  // 3. New/active job — poll every 2s until COMPLETED, FAILED, or 30s timeout
  const jobId = submitBody.jobId;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let settled = false;

  while (Date.now() < deadline) {
    sleep(POLL_INTERVAL_SEC);

    const pollRes = http.get(`${BASE_URL}/api/v1/jobs/${jobId}`, {
      tags: { endpoint: 'poll' },
    });

    check(pollRes, {
      'poll returns 200 or 202': (r) => r.status === 200 || r.status === 202,
    });

    const pollBody = safeJson(pollRes);
    if (!pollBody) {
      continue;
    }

    if (pollBody.status === 'COMPLETED') {
      completedJobs.add(1);
      check(pollBody, {
        'completed jobs have results': (b) => Array.isArray(b.results),
      });
      settled = true;
      break;
    }

    if (pollBody.status === 'FAILED') {
      failedJobs.add(1);
      settled = true;
      break;
    }
  }

  if (!settled) {
    timedOutJobs.add(1);
  }

  sleep(1);
}
