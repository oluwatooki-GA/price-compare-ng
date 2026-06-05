import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// ── Configuration ─────────────────────────────────────────────────────────────
// Override with: k6 run -e BASE_URL=http://localhost:3000 worker-stress.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const POLL_INTERVAL_SEC = 2;
// Poll window is wider than search.js (90s vs 30s) so jobs taking up to the
// 60s completion threshold can actually be observed instead of being recorded
// as timeouts.
const POLL_TIMEOUT_MS = 90_000;

// Base product names. Combined with random numbers below to build 500 unique
// queries — and then a per-request nonce guarantees every single submit is
// globally unique, so NOTHING is ever served from the 5-minute dedup cache.
// Every request creates a real scrape job → this stresses the worker pool.
const PRODUCT_NAMES = [
  'samsung tv', 'iphone', 'generator', 'laptop', 'washing machine',
  'air conditioner', 'bluetooth speaker', 'nike shoes', 'mattress', 'gas cooker',
  'refrigerator', 'microwave', 'power bank', 'smart watch', 'headphones',
];

function generateUniqueQueries(count) {
  const set = new Set();
  let i = 0;
  while (set.size < count) {
    const name = PRODUCT_NAMES[i % PRODUCT_NAMES.length];
    const num = Math.floor(Math.random() * 1_000_000);
    set.add(`${name} ${num}`);
    i++;
  }
  return Array.from(set);
}

// 500 unique base queries (product name + random number)
const QUERIES = generateUniqueQueries(500);

// ── Custom metrics ────────────────────────────────────────────────────────────
const cachedHits    = new Counter('cached_hits');     // should stay 0 — proves cache bypass
const completedJobs = new Counter('completed_jobs');
const failedJobs    = new Counter('failed_jobs');
const timedOutJobs  = new Counter('timed_out_jobs');
// Time from submit to COMPLETED — the metric the 60s threshold is measured on.
const jobCompletionTime = new Trend('job_completion_time', true);

// ── Load profile + thresholds ─────────────────────────────────────────────────
export const options = {
  scenarios: {
    worker_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 }, // ramp up to 50 users over 30s
        { duration: '60s', target: 50 }, // hold at 50 users for 60s
        { duration: '10s', target: 0 },  // ramp down over 10s
      ],
      // Let VUs that are mid-poll finish their job (up to the 90s poll window)
      // instead of being killed when ramp-down starts.
      gracefulRampDown: '90s',
    },
  },
  thresholds: {
    // 95% of SUBMIT requests must complete under 500ms (enqueue stays fast)
    'http_req_duration{endpoint:submit}': ['p(95)<500'],
    // Less than 1% of all requests may fail
    'http_req_failed': ['rate<0.01'],
    // 95% of jobs must complete within 60 seconds
    'job_completion_time': ['p(95)<60000'],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function uniqueQuery() {
  const base = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  // __VU + __ITER is a globally unique pair across the whole test run, so the
  // final query never repeats → guaranteed cache miss → guaranteed new job.
  return `${base} ${__VU}-${__ITER}`;
}

function safeJson(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

// ── The full search flow, forcing a fresh job every iteration ─────────────────
export default function () {
  const keyword = uniqueQuery();
  const submitStart = Date.now();

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
    'submit created a new job (not cached)': () => submitBody !== null && submitBody.status === 'PENDING',
  });

  if (!submitBody || !submitBody.jobId) {
    return;
  }

  // Unique queries should never be cached — count any that slip through so a
  // non-zero value flags a broken assumption.
  if (submitBody.status === 'COMPLETED') {
    cachedHits.add(1);
    sleep(1);
    return;
  }

  // 2. Poll every 2s until COMPLETED, FAILED, or the 90s timeout
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
      jobCompletionTime.add(Date.now() - submitStart);
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
