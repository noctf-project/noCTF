import { describe, it, expect } from "vitest";
import { WindowDeltaedTimeSeriesPoints } from "./graph.ts";

describe("WindowDeltaedTimeSeriesPoints", () => {
  describe("edge cases", () => {
    it("should return original points when windowSize is 1", () => {
      const points: [number[], number[]] = [
        [2, 3, 1],
        [10, 20, 30],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 1);
      expect(result).toEqual(points);
    });

    it("should return empty array when points array is empty", () => {
      const result = WindowDeltaedTimeSeriesPoints([[], []], 5);
      expect(result).toEqual([[], []]);
    });

    it("should handle single point", () => {
      const points: [number[], number[]] = [[5], [100]];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);
      expect(result).toEqual([[0], [100]]);
    });
  });

  describe("basic windowing with default sum reducer", () => {
    it("should group points within same window", () => {
      // Window size 10: points at t=0-9 go to window 0, t=10-19 to window 10, etc.
      const points: [number[], number[]] = [
        [3, 4, 5, 8],
        [10, 20, 30, 40],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);

      // Should return deltas: [0, 30], [10, 30], [10, 40]
      expect(result).toEqual([
        [0, 10, 10],
        [30, 30, 40],
      ]);
    });

    it("should handle points that span multiple windows", () => {
      const points: [number[], number[]] = [
        [5, 15, 25],
        [100, 200, 300],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);

      expect(result).toEqual([
        [0, 20, 20],
        [100, 200, 300],
      ]);
    });

    it("should accumulate values in same window with sum reducer", () => {
      const points: [number[], number[]] = [
        [1, 2, 3, 5],
        [10, 20, 30, 40],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);

      expect(result).toEqual([
        [0, 10],
        [60, 40],
      ]);
    });
  });

  describe("custom reducers", () => {
    it("should work with multiplication reducer", () => {
      const points: [number[], number[]] = [
        [2, 3, 6],
        [3, 4, 5],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10, (a, b) => a * b);

      expect(result).toEqual([
        [0, 10],
        [12, 5],
      ]);
    });

    it("should work with max reducer", () => {
      const points: [number[], number[]] = [
        [1, 2, 3, 5],
        [100, 50, 200, 75],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10, Math.max);

      expect(result).toEqual([
        [0, 10],
        [200, 75],
      ]);
    });

    it("should work with min reducer", () => {
      const points: [number[], number[]] = [
        [1, 2, 3, 5],
        [100, 50, 200, 25],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10, Math.min);

      expect(result).toEqual([
        [0, 10],
        [50, 25],
      ]);
    });
  });

  describe("different window sizes", () => {
    it("should work with window size 5", () => {
      const points: [number[], number[]] = [
        [2, 4, 3],
        [10, 20, 30],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 5);

      expect(result).toEqual([
        [0, 5],
        [10, 50],
      ]);
    });

    it("should work with larger window size", () => {
      const points: [number[], number[]] = [
        [10, 15, 30, 20],
        [100, 200, 300, 400],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 50);

      expect(result).toEqual([
        [0, 50],
        [300, 700],
      ]);
    });
  });

  describe("time accumulation behavior", () => {
    it("should properly accumulate time across points", () => {
      // Test that time accumulates correctly: t += p[0]
      const points: [number[], number[]] = [
        [5, 8, 2, 10],
        [10, 20, 30, 40],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);

      expect(result).toEqual([
        [0, 10, 10],
        [10, 50, 40],
      ]);
    });
  });

  describe("delta calculation", () => {
    it("should return correct deltas between windows", () => {
      const points: [number[], number[]] = [
        [15, 25, 35],
        [100, 200, 300],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);
      expect(result).toEqual([
        [10, 30, 30],
        [100, 200, 300],
      ]);
    });

    it("should handle consecutive windows", () => {
      const points: [number[], number[]] = [
        [5, 8, 7, 10],
        [10, 20, 30, 40],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);
      expect(result).toEqual([
        [0, 10, 10, 10],
        [10, 20, 30, 40],
      ]);
    });
  });
});
