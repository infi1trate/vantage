# Vantage Performance Budgets

This document defines the performance budgets for the Vantage application. These budgets serve as guardrails to prevent performance regressions.

## Overview

Performance budgets are enforced in two ways:
1. **Development**: Automatic monitoring with console warnings
2. **CI/Tests**: Vitest tests that fail on budget violations

## Budget Categories

### Capture Pipeline

| Metric | Budget | Severity | Notes |
|--------|--------|----------|-------|
| Camera First Frame | ≤1500ms | warning | Includes permission prompt + stream acquisition |
| Screen First Frame | ≤2000ms | warning | Includes system picker UI |
| Background Removal (per-frame) | ≤33ms | warning | 30fps target, P95 ≤50ms |
| Composite (per-frame) | ≤16ms | warning | 60fps target |
| Recorder First Data | ≤3000ms | **error** | Codec negotiation + first chunk |

### Playback

| Metric | Budget | Severity | Notes |
|--------|--------|----------|-------|
| Playback Startup | ≤1000ms | warning | From click to first frame |
| Metadata Load | ≤500ms | warning | Video metadata available |
| First Frame | ≤1000ms | warning | First frame rendered |
| Seek Response | ≤100ms | warning | P95 ≤200ms |

### Thumbnails

| Metric | Budget | Severity | Notes |
|--------|--------|----------|-------|
| Generation | ≤100ms | warning | Worker-based generation |
| Load (cache miss) | ≤200ms | warning | From IndexedDB |
| Cache Hit | ≤10ms | warning | Memory cache lookup |

### Library

| Metric | Budget | Severity | Notes |
|--------|--------|----------|-------|
| Initial Render | ≤300ms | warning | Full session grid |
| Scroll Frame | ≤16ms | warning | No jank during scroll |

## Long Task Limits

Long tasks are main thread blocks >50ms that cause jank.

| Context | Limit | Notes |
|---------|-------|-------|
| Recording | ≤2 per minute | Minimal interference with capture |
| Playback | ≤1 per seek | Responsive scrubbing |
| Library Scroll | 0 | Smooth scrolling required |

## Resource Targets (Best-Effort)

These are guidelines, not hard limits:

| Metric | Target | Notes |
|--------|--------|-------|
| Recording CPU | ≤60% sustained | Avoid thermal throttling |
| Recording Memory Growth | ≤50MB/min | Streaming chunks to IndexedDB |
| Playback CPU | ≤30% sustained | Leave headroom for other apps |
| Memory per Session | ≤100MB | Efficient blob handling |

## Usage

### Checking Budgets in Code

```typescript
import { checkBudgets, assertWithinBudget, logBudgetReport } from "@/lib/performanceBudget";

// Check all budgets
const violations = checkBudgets();
if (violations.length > 0) {
  console.warn("Performance budget violations:", violations);
}

// Assert in tests
assertWithinBudget("playback:seek"); // Throws on violation

// Generate report
logBudgetReport(); // Logs formatted report to console
```

### Recording Metrics

```typescript
import { recordMetric, startTiming, endTiming } from "@/lib/performanceMetrics";

// Direct recording
recordMetric("thumbnail:generate", durationMs);

// Timer-based
startTiming("my-operation");
// ... do work ...
endTiming("my-operation", "playback:seek");
```

### Long Task Monitoring

```typescript
import { 
  startLongTaskMonitoring, 
  onLongTask, 
  getLongTaskCount 
} from "@/lib/performanceBudget";

// Start monitoring (auto-starts in dev)
startLongTaskMonitoring();

// Subscribe to events
const unsubscribe = onLongTask((count, duration) => {
  console.warn(`Long task #${count}: ${duration}ms`);
});

// Check count
if (getLongTaskCount() > 5) {
  console.error("Too many long tasks!");
}
```

## Running Performance Tests

```bash
# Run performance budget tests
bun test src/test/performanceBudget.test.ts

# Run all tests including performance
bun test
```

## Adding New Budgets

1. Add the budget definition to `PERFORMANCE_BUDGETS` in `src/lib/performanceBudget.ts`
2. Add the metric category to `MetricCategory` type in `src/lib/performanceMetrics.ts`
3. Instrument the code with `recordMetric()` or `startTiming()/endTiming()`
4. Add test cases in `src/test/performanceBudget.test.ts`

## Severity Levels

- **warning**: Logs in development, test continues
- **error**: Logs in development, test fails

Use `error` severity sparingly for truly critical metrics that would break user experience.

## Debugging Performance Issues

1. Open DevTools and press `Ctrl+Shift+P` to toggle the performance overlay
2. Check the console for `[Perf]` and `[PerfBudget]` logs
3. Run `logBudgetReport()` in console for a summary
4. Use Chrome DevTools Performance panel for detailed analysis
