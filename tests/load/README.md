# Load Testing — Search Flow (k6)

Load test for the async search pipeline: submit a keyword search, then poll the
job until it completes. Simulates 50 concurrent users picking random product
queries.

`search.js` exercises the real request/response shapes:

- `POST /api/v1/search/keyword` → `200` (cached, with `results`) or `202` (new/active job)
- `GET  /api/v1/jobs/:jobId`    → `200` with `{ status, results, ... }`

---

## 1. Install k6

k6 is a single binary — it is **not** an npm package.

**Windows (winget):**
```powershell
winget install k6 --source winget
```

**Windows (Chocolatey):**
```powershell
choco install k6
```

**macOS (Homebrew):**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**Docker (no install):**
```bash
docker run --rm -i --network host grafana/k6 run - < tests/load/search.js
```

Verify:
```bash
k6 version
```

---

## 2. Run the test

Make sure the stack is running first (`docker compose up`) so the API, worker,
Postgres, and Redis are all available on `localhost:3000`.

From the repo root:
```bash
k6 run tests/load/search.js
```

Point it at a different host/port:
```bash
k6 run -e BASE_URL=http://localhost:3000 tests/load/search.js
```

The run takes ~100 seconds (30s ramp-up + 60s hold + 10s ramp-down).

---

## 3. Run with 1 worker vs 3 workers

The whole point of an async queue is horizontal scaling of the worker. The API
just enqueues jobs; the **worker** process does the scraping. Each worker runs
with `concurrency: 3` (see `backend/src/worker.ts`), so:

- **1 worker**  → up to **3** jobs scraped in parallel
- **3 workers** → up to **9** jobs scraped in parallel

**1 worker (default):**
```bash
docker compose up -d
k6 run tests/load/search.js
```

**3 workers:**
```bash
docker compose up -d --scale worker=3
k6 run tests/load/search.js
```

Reset back to 1 worker:
```bash
docker compose up -d --scale worker=1
```

Run the test once per configuration and compare `completed_jobs`,
`timed_out_jobs`, and the poll-duration percentiles. More workers should mean
fewer timeouts and faster job completion under the same 50-user load.

> Tip: the `scrapeQueue` dedupes identical queries within a 5-minute window, so
> the 10 shared queries cause heavy cache/dedup hits. To stress the workers
> harder, restart the stack (or wait 5 min) between runs so the cache is cold.

---

## 4. What the metrics mean

k6 prints a summary table at the end. Key rows:

| Metric | Meaning |
|---|---|
| `http_req_duration` | Total time per HTTP request. Look at `p(95)` (95th percentile). |
| `http_req_duration{endpoint:submit}` | Same, but **only** the submit POST. This is what the 500ms threshold checks. |
| `http_req_duration{endpoint:poll}` | Only the job-status GET requests. |
| `http_req_failed` | Fraction of requests that failed (status ≥ 400 or network error). Threshold: < 1%. |
| `http_reqs` | Total requests and requests/sec throughput. |
| `iterations` | Number of completed full flows (submit + poll loop). |
| `vus` / `vus_max` | Active and peak virtual users (peaks at 50). |
| `checks` | Pass rate of all `check()` assertions. |

Custom counters added by this test:

| Counter | Meaning |
|---|---|
| `cached_hits` | Submits answered immediately from cache (HTTP 200 with results). |
| `completed_jobs` | Jobs that reached `COMPLETED` via polling. |
| `failed_jobs` | Jobs that reached `FAILED`. |
| `timed_out_jobs` | Jobs that never settled within the 30s poll window. |

Thresholds appear at the top of the summary with a ✓ (pass) or ✗ (fail). The
process exit code is non-zero if any threshold fails — useful for CI gating.

---

## 5. Good vs bad results

**Healthy run:**
```
✓ http_req_duration{endpoint:submit}..: p(95)=180ms   (< 500ms)
✓ http_req_failed....................: 0.00%          (< 1%)
✓ checks.............................: 100.00%
  completed_jobs.....................: high
  timed_out_jobs.....................: 0
  failed_jobs........................: 0
```
- Submit p95 comfortably under 500ms → the API enqueues quickly even at 50 VUs.
- ~0% failures, ~100% checks → endpoints stable, all responses well-formed.
- `timed_out_jobs` at or near 0 → workers keep up with the job rate.

**Unhealthy run — API bottleneck:**
```
✗ http_req_duration{endpoint:submit}..: p(95)=1.4s     (> 500ms)
✗ http_req_failed....................: 3.20%
```
- Submit p95 over 500ms means the **enqueue path is slow** — usually Postgres
  contention on the `ScrapeJob` dedup lookups/inserts, or Redis saturation.
- Rising `http_req_failed` points at the API crashing, connection limits, or
  timeouts. Check the `backend` container logs.

**Unhealthy run — worker bottleneck:**
```
✓ http_req_duration{endpoint:submit}..: p(95)=160ms
✓ http_req_failed....................: 0.10%
  timed_out_jobs.....................: many
  completed_jobs.....................: low
```
- Submits are fast and successful (API is fine), but jobs pile up faster than
  the worker can scrape them, so many hit the 30s poll timeout.
- This is the signal to **scale the worker** (`--scale worker=3`) — the fix the
  async architecture exists to enable.

**Rule of thumb:** slow/ failing *submits* → scale the API or tune the DB. Slow
*job completion* with healthy submits → scale the worker.
