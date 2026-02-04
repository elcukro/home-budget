import { describe, it, expect } from 'vitest';
import {
  calculateMovingAverage,
  calculateExponentialMovingAverage,
  type MovingAverageResult,
} from './movingAverage';

describe('calculateMovingAverage', () => {
  describe('basic functionality', () => {
    it('calculates 3-period moving average correctly', () => {
      const values = [100, 200, 300, 400, 500];
      const result = calculateMovingAverage(values, 3);

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({ index: 0, value: null, hasValue: false });
      expect(result[1]).toEqual({ index: 1, value: null, hasValue: false });
      expect(result[2]).toEqual({ index: 2, value: 200, hasValue: true }); // (100 + 200 + 300) / 3
      expect(result[3]).toEqual({ index: 3, value: 300, hasValue: true }); // (200 + 300 + 400) / 3
      expect(result[4]).toEqual({ index: 4, value: 400, hasValue: true }); // (300 + 400 + 500) / 3
    });

    it('calculates 2-period moving average correctly', () => {
      const values = [100, 200, 300, 400];
      const result = calculateMovingAverage(values, 2);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ index: 0, value: null, hasValue: false });
      expect(result[1]).toEqual({ index: 1, value: 150, hasValue: true }); // (100 + 200) / 2
      expect(result[2]).toEqual({ index: 2, value: 250, hasValue: true }); // (200 + 300) / 2
      expect(result[3]).toEqual({ index: 3, value: 350, hasValue: true }); // (300 + 400) / 2
    });

    it('defaults to 3-period moving average', () => {
      const values = [100, 200, 300, 400];
      const result = calculateMovingAverage(values);

      expect(result[2]?.hasValue).toBe(true);
      expect(result[2]?.value).toBe(200); // (100 + 200 + 300) / 3
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = calculateMovingAverage([], 3);
      expect(result).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      const result = calculateMovingAverage(undefined as any, 3);
      expect(result).toEqual([]);
    });

    it('returns all nulls when period is greater than array length', () => {
      const values = [100, 200];
      const result = calculateMovingAverage(values, 5);

      expect(result).toHaveLength(2);
      expect(result.every(r => r.value === null && !r.hasValue)).toBe(true);
    });

    it('throws error for period less than 1', () => {
      expect(() => calculateMovingAverage([1, 2, 3], 0)).toThrow('Period must be at least 1');
      expect(() => calculateMovingAverage([1, 2, 3], -1)).toThrow('Period must be at least 1');
    });

    it('handles single value with period 1', () => {
      const values = [100];
      const result = calculateMovingAverage(values, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ index: 0, value: 100, hasValue: true });
    });

    it('handles single value with period greater than 1', () => {
      const values = [100];
      const result = calculateMovingAverage(values, 3);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ index: 0, value: null, hasValue: false });
    });

    it('handles array length equal to period', () => {
      const values = [100, 200, 300];
      const result = calculateMovingAverage(values, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ index: 0, value: null, hasValue: false });
      expect(result[1]).toEqual({ index: 1, value: null, hasValue: false });
      expect(result[2]).toEqual({ index: 2, value: 200, hasValue: true }); // Only last element has value
    });
  });

  describe('real-world scenarios', () => {
    it('handles typical monthly expense data', () => {
      const expenses = [1500, 1800, 1200, 2000, 1600, 1900];
      const result = calculateMovingAverage(expenses, 3);

      expect(result[2]?.value).toBeCloseTo(1500, 2); // (1500 + 1800 + 1200) / 3
      expect(result[3]?.value).toBeCloseTo(1666.67, 2); // (1800 + 1200 + 2000) / 3
      expect(result[4]?.value).toBeCloseTo(1600, 2); // (1200 + 2000 + 1600) / 3
      expect(result[5]?.value).toBeCloseTo(1833.33, 2); // (2000 + 1600 + 1900) / 3
    });

    it('handles zero values', () => {
      const values = [0, 100, 200, 0, 300];
      const result = calculateMovingAverage(values, 3);

      expect(result[2]?.value).toBe(100); // (0 + 100 + 200) / 3
      expect(result[3]?.value).toBe(100); // (100 + 200 + 0) / 3
      expect(result[4]?.value).toBeCloseTo(166.67, 2); // (200 + 0 + 300) / 3
    });

    it('handles decimal values', () => {
      const values = [10.5, 20.75, 30.25, 40.5];
      const result = calculateMovingAverage(values, 3);

      expect(result[2]?.value).toBeCloseTo(20.5, 2); // (10.5 + 20.75 + 30.25) / 3
      expect(result[3]?.value).toBeCloseTo(30.5, 2); // (20.75 + 30.25 + 40.5) / 3
    });

    it('handles negative values (refunds/corrections)', () => {
      const values = [1000, -200, 1500, 800];
      const result = calculateMovingAverage(values, 3);

      expect(result[2]?.value).toBeCloseTo(766.67, 2); // (1000 + -200 + 1500) / 3
      expect(result[3]?.value).toBe(700); // (-200 + 1500 + 800) / 3
    });
  });
});

describe('calculateExponentialMovingAverage', () => {
  describe('basic functionality', () => {
    it('calculates 3-period EMA correctly', () => {
      const values = [100, 200, 300, 400, 500];
      const result = calculateExponentialMovingAverage(values, 3);

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({ index: 0, value: null, hasValue: false });
      expect(result[1]).toEqual({ index: 1, value: null, hasValue: false });
      expect(result[2]?.value).toBe(200); // Initial SMA: (100 + 200 + 300) / 3
      expect(result[2]?.hasValue).toBe(true);
      // EMA = (400 - 200) * 0.5 + 200 = 300
      expect(result[3]?.value).toBe(300);
      // EMA = (500 - 300) * 0.5 + 300 = 400
      expect(result[4]?.value).toBe(400);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = calculateExponentialMovingAverage([], 3);
      expect(result).toEqual([]);
    });

    it('throws error for period less than 1', () => {
      expect(() => calculateExponentialMovingAverage([1, 2, 3], 0)).toThrow(
        'Period must be at least 1'
      );
    });

    it('returns all nulls when array is shorter than period', () => {
      const values = [100, 200];
      const result = calculateExponentialMovingAverage(values, 5);

      expect(result).toHaveLength(2);
      expect(result.every(r => r.value === null && !r.hasValue)).toBe(true);
    });
  });

  describe('comparison with SMA', () => {
    it('EMA responds faster to recent changes than SMA', () => {
      // A sudden jump in values
      const values = [100, 100, 100, 100, 500];
      const sma = calculateMovingAverage(values, 3);
      const ema = calculateExponentialMovingAverage(values, 3);

      // After the jump, EMA should be higher than SMA because it gives more weight to recent values
      // SMA at index 4: (100 + 100 + 500) / 3 = 233.33
      // EMA reacts faster to the jump
      expect(ema[4]?.value).toBeGreaterThan(sma[4]?.value || 0);
    });
  });
});

describe('MovingAverageResult type', () => {
  it('has correct structure', () => {
    const result: MovingAverageResult = {
      index: 0,
      value: 100,
      hasValue: true,
    };

    expect(result.index).toBe(0);
    expect(result.value).toBe(100);
    expect(result.hasValue).toBe(true);
  });

  it('allows null value', () => {
    const result: MovingAverageResult = {
      index: 0,
      value: null,
      hasValue: false,
    };

    expect(result.value).toBeNull();
    expect(result.hasValue).toBe(false);
  });
});
