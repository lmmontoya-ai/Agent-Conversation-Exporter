# ACE v1 Performance Audit

## Baseline Findings

- Session corpus is large and heterogeneous:
  - `~/.codex/sessions`: 192 files
  - `~/.codex/archived_sessions`: 37 files
  - Several session files exceed 40 MB (largest observed ~142 MB)
- Renderer bundle was previously monolithic; markdown rendering libraries were loaded in the initial chunk.
- Preview rendering work could become expensive for very large markdown outputs.
- Session scans reparsed every JSONL file on each refresh.

## Implemented Quick Wins

### 1) Incremental scan cache

- Added persistent summary cache keyed by `(absolutePath, size, mtimeMs)`:
  - `src/main/services/sessionScanCache.ts`
  - integrated into `src/main/services/sessionScanner.ts`
- Unchanged files reuse cached `SessionSummary` without reparsing.
- Added stale-cache pruning for removed files.
- Added dev scan telemetry logging in `src/main/ipc.ts`.

Observed warm-scan telemetry in dev:

- first warm run: `total=229 parsed=196 cacheHits=33 durationMs=5059`
- subsequent warm run: `total=229 parsed=132 cacheHits=97 durationMs=5060`

### 2) Session/markdown hot-path cache

- Added in-memory LRU caches in `src/main/ipc.ts`:
  - transcript cache keyed by `sessionId`
  - markdown cache keyed by `sessionId:mode`
- Added invalidation whenever a scanned record signature changes or disappears.

### 3) Large preview guard + lazy markdown rendering

- Extended preview response contract with:
  - `charCount`, `lineCount`, `isLargePreview`
- Added guard thresholds:
  - `300,000` chars or `6,000` lines
- Rendered markdown now requires explicit user action for large documents ("Render anyway").
- React markdown stack is now code-split and lazy loaded:
  - new chunk: `rendered-markdown-*.js` (~386 KB)
- Resulting initial renderer chunk decreased to ~1.10 MB.

### 4) UI responsiveness

- Added deferred search query in `AppShell` via `useDeferredValue` to smooth filtering under large in-memory lists.
- Existing virtualized session list remains in place.

## Current Standards Alignment

- Virtualized long lists.
- Lazy load heavy UI code paths.
- Guard expensive rendering paths behind user intent.
- Cache IO + parse-heavy index passes.
- Keep exports deterministic and identical despite UI/perf changes.

## Suggested Next Iteration (v1.1+)

- Offload file parsing to worker threads for smoother main-process responsiveness during large refreshes.
- Add background scan scheduling (low-priority scan after app idle).
- Move scan/index metadata to SQLite for more scalable incremental indexing and richer query filtering.
- Add simple perf instrumentation panel in dev (scan time, cache hit ratio, preview render timings).
