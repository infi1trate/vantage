/**
 * Performance Regression Tests
 * 
 * These tests verify that key operations stay within their performance budgets.
 * Run as part of CI to catch regressions early.
 * 
 * NOTE: These tests measure the budget infrastructure, not actual app performance.
 * Real performance testing requires browser automation with the full app.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PERFORMANCE_BUDGETS,
  checkBudgets,
  checkCategoryBudget,
  assertWithinBudget,
  assertNoLongTasks,
  assertLongTasksBelow,
  generateBudgetReport,
  startLongTaskMonitoring,
  stopLongTaskMonitoring,
  getLongTaskCount,
  resetLongTaskCount,
} from "@/lib/performanceBudget";
import {
  recordMetric,
  resetMetrics,
  startTiming,
  endTiming,
  MetricCategory,
} from "@/lib/performanceMetrics";

describe("Performance Budget System", () => {
  beforeEach(() => {
    resetMetrics();
    resetLongTaskCount();
  });

  afterEach(() => {
    resetMetrics();
    stopLongTaskMonitoring();
  });

  describe("Budget Definitions", () => {
    it("should have budgets defined for all critical categories", () => {
      const criticalCategories: MetricCategory[] = [
        "capture:facecam:first-frame",
        "capture:screen:first-frame",
        "capture:recorder:first-data",
        "playback:startup",
        "thumbnail:generate",
      ];

      for (const category of criticalCategories) {
        const budget = PERFORMANCE_BUDGETS.find(b => b.category === category);
        expect(budget, `Budget should exist for ${category}`).toBeDefined();
        expect(budget!.maxDuration).toBeGreaterThan(0);
      }
    });

    it("should have reasonable capture budgets (30fps = 33ms)", () => {
      const bgRemovalBudget = PERFORMANCE_BUDGETS.find(
        b => b.category === "capture:background-removal"
      );
      expect(bgRemovalBudget?.maxDuration).toBeLessThanOrEqual(33);
    });

    it("should have reasonable playback budgets", () => {
      const seekBudget = PERFORMANCE_BUDGETS.find(
        b => b.category === "playback:seek"
      );
      expect(seekBudget?.maxDuration).toBeLessThanOrEqual(100);
    });
  });

  describe("Budget Violation Detection", () => {
    it("should detect no violations when metrics are within budget", () => {
      // Record metrics within budget
      recordMetric("thumbnail:generate", 50); // Budget: 100ms
      recordMetric("thumbnail:generate", 60);
      recordMetric("thumbnail:generate", 70);

      const violations = checkBudgets();
      const thumbnailViolations = violations.filter(
        v => v.budget.category === "thumbnail:generate"
      );
      
      expect(thumbnailViolations).toHaveLength(0);
    });

    it("should detect violations when metrics exceed budget", () => {
      // Record metric that exceeds budget
      recordMetric("thumbnail:generate", 150); // Budget: 100ms

      const violations = checkBudgets();
      const thumbnailViolation = violations.find(
        v => v.budget.category === "thumbnail:generate"
      );

      expect(thumbnailViolation).toBeDefined();
      expect(thumbnailViolation!.actual).toBe(150);
      expect(thumbnailViolation!.threshold).toBe(100);
      expect(thumbnailViolation!.type).toBe("duration");
    });

    it("should check individual category budget", () => {
      recordMetric("playback:seek", 50); // Within budget (100ms)
      expect(checkCategoryBudget("playback:seek")).toBeNull();

      recordMetric("playback:seek", 200); // Exceeds budget
      const violation = checkCategoryBudget("playback:seek");
      expect(violation).not.toBeNull();
      expect(violation!.actual).toBe(200);
    });
  });

  describe("Assertions for Testing", () => {
    it("assertWithinBudget should not throw for metrics within budget", () => {
      recordMetric("capture:recorder:first-data", 2000); // Budget: 3000ms

      expect(() => assertWithinBudget("capture:recorder:first-data")).not.toThrow();
    });

    it("assertWithinBudget should throw for error-severity violations", () => {
      recordMetric("capture:recorder:first-data", 5000); // Budget: 3000ms, severity: error

      expect(() => assertWithinBudget("capture:recorder:first-data")).toThrow(
        /exceeds budget/
      );
    });

    it("assertNoLongTasks should not throw when no long tasks occurred", () => {
      expect(() => assertNoLongTasks()).not.toThrow();
    });

    it("assertLongTasksBelow should validate against threshold", () => {
      expect(() => assertLongTasksBelow(5)).not.toThrow();
    });
  });

  describe("Budget Report Generation", () => {
    it("should generate a report with all metrics", () => {
      recordMetric("thumbnail:generate", 50);
      recordMetric("thumbnail:load", 100);
      recordMetric("playback:startup", 500);

      const report = generateBudgetReport();

      expect(report).toContain("PERFORMANCE BUDGET REPORT");
      expect(report).toContain("METRIC SUMMARY");
      expect(report).toContain("thumbnail:generate");
    });

    it("should indicate violations in report", () => {
      recordMetric("thumbnail:generate", 200); // Exceeds 100ms budget

      const report = generateBudgetReport();

      expect(report).toContain("WARNINGS");
      expect(report).toContain("thumbnail:generate");
    });

    it("should show success when all budgets pass", () => {
      recordMetric("thumbnail:generate", 50); // Within budget

      const report = generateBudgetReport();

      expect(report).toContain("All budgets within limits");
    });
  });

  describe("Timing API Integration", () => {
    it("should work with startTiming/endTiming API", () => {
      startTiming("test-operation");
      
      // Simulate some work
      const start = performance.now();
      while (performance.now() - start < 5) {
        // Busy wait ~5ms
      }
      
      const duration = endTiming("test-operation", "thumbnail:generate");
      
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50); // Should be around 5ms
    });
  });
});

describe("Performance Budget Constants", () => {
  it("capture budgets should maintain 30fps target", () => {
    const frameBasedBudgets = PERFORMANCE_BUDGETS.filter(
      b => b.category.includes("background-removal") || 
           b.category.includes("composite")
    );

    for (const budget of frameBasedBudgets) {
      // At 30fps, each frame has 33ms budget
      // At 60fps, each frame has 16ms budget
      expect(budget.maxDuration).toBeLessThanOrEqual(33);
    }
  });

  it("playback seek should be perceptually instant (<100ms)", () => {
    const seekBudget = PERFORMANCE_BUDGETS.find(
      b => b.category === "playback:seek"
    );
    
    expect(seekBudget).toBeDefined();
    expect(seekBudget!.maxDuration).toBeLessThanOrEqual(100);
  });

  it("thumbnail cache hits should be near-instant (<10ms)", () => {
    const cacheHitBudget = PERFORMANCE_BUDGETS.find(
      b => b.category === "thumbnail:cache-hit"
    );
    
    expect(cacheHitBudget).toBeDefined();
    expect(cacheHitBudget!.maxDuration).toBeLessThanOrEqual(10);
  });

  it("first data from recorder should allow for codec negotiation (<3s)", () => {
    const recorderBudget = PERFORMANCE_BUDGETS.find(
      b => b.category === "capture:recorder:first-data"
    );
    
    expect(recorderBudget).toBeDefined();
    expect(recorderBudget!.maxDuration).toBeLessThanOrEqual(3000);
    expect(recorderBudget!.severity).toBe("error"); // Critical metric
  });
});
