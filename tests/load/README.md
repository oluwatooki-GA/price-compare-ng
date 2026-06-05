# Load Testing — Search Flow (k6)

Load tests for the async search pipeline: submit a keyword search, then poll the
job until it completes. Both simulate 50 concurrent users with the same ramp
profile (30s up → 60s hold → 10s down).

Both exercise the real request/response shapes:

- `POST /api/v1/search/keyword` → `200` (cached, with `results`) or `202` (new/active job)
- `GET  /api/v1/jobs/:jobId`    → `200` with `{ status, results, ... }`

---

## Which test to run

| | `search.js` | `worker-stress.js` |
|---|---|---|
| **Queries** | 10 shared product queries | 500+ globally-unique queries (product + random number + per-request nonce) |
| **Cache behaviour** | Heavy cache/dedup hits — most submits return instantly | Every submit bypasses the 5-min dedup cache and creates a **real** scrape job |
| **What it stresses** | The **API**: enqueue path, cache lookups, dedup queries, Redis | The **worker pool**: how fast jobs are actually scraped and completed |
| **Poll window** | 30s | 90s (jobs can take longer; needed to measure the 60s threshold) |
| **Key threshold** | submit p95 < 500ms, fail < 1% | adds **job completion p95 < 60s** |
| **Use when** | Checking the API stays fast and stable under realistic, repeat-heavy traffic | Capacity-planning the workers — "can N workers clear jobs fast enough?" |

**Rule of thumb:**
- Run **`search.js`** to validate the read/submit path under realistic load where
  users repeat popular searches (the cache does its job).
- Run **`worker-stress.js`** to find the worker ceiling — every request becomes a
  job, so `job_completion_time` and `timed_out_jobs` tell you whether the workers
  keep up. This is the test to pair with `--scale worker=3` (see §3) to prove
  scaling helps.

Run either the same way (`k6 run tests/load/<file>.js`); only the script name changes.

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

**Docker (no install):** see [Running via Docker](#running-via-docker-no-local-binary)
below — the `--network host` form only works on Linux.

Verify a local install:
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

## Run from WSL Ubuntu (recommended on Windows)

On Windows the simplest setup is to run the **native k6 binary inside WSL
Ubuntu**. Docker Desktop's WSL integration forwards the published port `3000` to
`localhost` inside Ubuntu, so `k6 run` works with no networking flags and no
container — unlike the Dockerised k6 approach, which needs `host.docker.internal`
and a volume mount.

**1. Open the Ubuntu terminal and go to the repo** (Windows drives live under `/mnt`):
```bash
cd /mnt/c/Users/LENOVO/Projects/price-compare-ng
```

**2. Confirm the stack is reachable from Ubuntu** (with `docker compose up` running):
```bash
curl http://localhost:3000/health
```
Expect `{"status":"ok",...}`. If you get nothing, enable Docker Desktop →
Settings → Resources → WSL Integration for your Ubuntu distro and restart the stack.

**3. Install k6 natively (one-time):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**4. Run it:**
```bash
k6 run tests/load/search.js
```
No `BASE_URL` needed — the default `http://localhost:3000` is correct from WSL.

---

## Running via Docker (no local binary)

If you installed k6 with `docker pull grafana/k6` instead of the native binary,
run the script inside a container. Start the stack first (`docker compose up`).

Two things differ from the native commands:

1. **Networking.** Inside the container, `localhost` is the container itself, not
   your machine. On **Docker Desktop (Windows/macOS)** reach the host via
   `host.docker.internal`. On **Linux**, add `--network host` and use `localhost`.
2. **Passing the script.** PowerShell does not support the `< file` redirect used
   in Linux examples, so mount the folder instead of piping over stdin.

**Windows / macOS (Docker Desktop) — PowerShell:**
```powershell
docker run --rm -v ${PWD}/tests/load:/scripts grafana/k6 run -e BASE_URL=http://host.docker.internal:3000 /scripts/search.js
```

**Windows / macOS (Docker Desktop) — bash:**
```bash
docker run --rm -v "$(pwd)/tests/load:/scripts" grafana/k6 run -e BASE_URL=http://host.docker.internal:3000 /scripts/search.js
```

**Linux:**
```bash
docker run --rm -i --network host grafana/k6 run - < tests/load/search.js
```

### Alternative: attach to the Compose network

Instead of `host.docker.internal`, join k6 to the same Docker network as the
stack and address the API by its service name (`backend`):

```powershell
docker run --rm -v ${PWD}/tests/load:/scripts --network price-compare-ng_default grafana/k6 run -e BASE_URL=http://backend:3000 /scripts/search.js
```

If that network name errors, find the real one (look for the `*_default` entry):
```powershell
docker network ls
```

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
| `timed_out_jobs` | Jobs that never settled within the poll window (30s in `search.js`, 90s in `worker-stress.js`). |
| `job_completion_time` | (`worker-stress.js`) Time from submit to `COMPLETED`. The 60s threshold is measured on this. |

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
