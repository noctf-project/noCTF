import { describe, it, expect } from "vitest";
import { WindowDeltaedTimeSeriesPoints } from "./graph.ts";

describe("WindowDeltaedTimeSeriesPoints", () => {
  describe("edge cases", () => {
    it("should return original points when windowSize is 1", () => {
      const points: [number, number][] = [
        [2, 10],
        [3, 20],
        [1, 30],
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 1);
      expect(result).toEqual(points);
    });

    it("should return empty array when points array is empty", () => {
      const result = WindowDeltaedTimeSeriesPoints([], 5);
      expect(result).toEqual([]);
    });

    it("should handle single point", () => {
      const points: [number, number][] = [[5, 100]];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);
      expect(result).toEqual([[0, 100]]);
    });
  });

  describe("basic windowing with default sum reducer", () => {
    it("should group points within same window", () => {
      // Window size 10: points at t=0-9 go to window 0, t=10-19 to window 10, etc.
      const points: [number, number][] = [
        [3, 10], // t=3, window=0
        [4, 20], // t=7, window=0
        [5, 30], // t=12, window=10
        [8, 40], // t=20, window=20
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);

      // Should return deltas: [0, 30], [10, 30], [10, 40]
      expect(result).toEqual([
        [0, 30], // window 0: sum of 10+20
        [10, 30], // delta from 0 to 10, value 30
        [10, 40], // delta from 10 to 20, value 40
      ]);
    });

    it("should handle points that span multiple windows", () => {
      const points: [number, number][] = [
        [5, 100], // t=5, window=0
        [15, 200], // t=20, window=20
        [25, 300], // t=45, window=40
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);

      expect(result).toEqual([
        [0, 100], // window 0
        [20, 200], // delta to window 20
        [20, 300], // delta to window 40
      ]);
    });

    it("should accumulate values in same window with sum reducer", () => {
      const points: [number, number][] = [
        [1, 10], // t=1, window=0
        [2, 20], // t=3, window=0
        [3, 30], // t=6, window=0
        [5, 40], // t=11, window=10
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);

      expect(result).toEqual([
        [0, 60], // window 0: 10+20+30
        [10, 40], // window 10: 40
      ]);
    });
  });

  describe("custom reducers", () => {
    it("should work with multiplication reducer", () => {
      const points: [number, number][] = [
        [2, 3], // t=2, window=0
        [3, 4], // t=5, window=0
        [6, 5], // t=11, window=10
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10, (a, b) => a * b);

      expect(result).toEqual([
        [0, 12], // window 0: 3*4
        [10, 5], // window 10: 5
      ]);
    });

    it("should work with max reducer", () => {
      const points: [number, number][] = [
        [1, 100], // t=1, window=0
        [2, 50], // t=3, window=0
        [3, 200], // t=6, window=0
        [5, 75], // t=11, window=10
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10, Math.max);

      expect(result).toEqual([
        [0, 200], // window 0: max(100, 50, 200)
        [10, 75], // window 10: 75
      ]);
    });

    it("should work with min reducer", () => {
      const points: [number, number][] = [
        [1, 100], // t=1, window=0
        [2, 50], // t=3, window=0
        [3, 200], // t=6, window=0
        [5, 25], // t=11, window=10
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10, Math.min);

      expect(result).toEqual([
        [0, 50], // window 0: min(100, 50, 200)
        [10, 25], // window 10: 25
      ]);
    });
  });

  describe("different window sizes", () => {
    it("should work with window size 5", () => {
      const points: [number, number][] = [
        [2, 10], // t=2, window=0
        [4, 20], // t=6, window=5
        [3, 30], // t=9, window=5
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 5);

      expect(result).toEqual([
        [0, 10], // window 0
        [5, 50], // window 5: 20+30
      ]);
    });

    it("should work with larger window size", () => {
      const points: [number, number][] = [
        [10, 100], // t=10, window=0
        [15, 200], // t=25, window=0
        [30, 300], // t=55, window=50
        [20, 400], // t=75, window=50
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 50);

      expect(result).toEqual([
        [0, 300], // window 0: 100+200
        [50, 700], // window 50: 300+400
      ]);
    });
  });

  describe("time accumulation behavior", () => {
    it("should properly accumulate time across points", () => {
      // Test that time accumulates correctly: t += p[0]
      const points: [number, number][] = [
        [5, 10], // t=5, window=0 (floor(5/10)*10 = 0)
        [8, 20], // t=13, window=10 (floor(13/10)*10 = 10)
        [2, 30], // t=15, window=10 (floor(15/10)*10 = 10)
        [10, 40], // t=25, window=20 (floor(25/10)*10 = 20)
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);

      expect(result).toEqual([
        [0, 10], // window 0
        [10, 50], // window 10: 20+30
        [10, 40], // window 20: 40
      ]);
    });
  });

  describe("delta calculation", () => {
    it("should return correct deltas between windows", () => {
      const points: [number, number][] = [
        [15, 100], // t=15, window=10
        [25, 200], // t=40, window=40
        [35, 300], // t=75, window=70
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);
      expect(result).toEqual([
        [10, 100], // first window at 10
        [30, 200], // delta from 10 to 40 = 30
        [30, 300], // delta from 40 to 70 = 30
      ]);
    });

    it("should handle consecutive windows", () => {
      const points: [number, number][] = [
        [5, 10], // t=5, window=0
        [8, 20], // t=13, window=10
        [7, 30], // t=20, window=20
        [10, 40], // t=30, window=30
      ];
      const result = WindowDeltaedTimeSeriesPoints(points, 10);
      expect(result).toEqual([
        [0, 10],
        [10, 20],
        [10, 30],
        [10, 40],
      ]);
    });
  });
});
