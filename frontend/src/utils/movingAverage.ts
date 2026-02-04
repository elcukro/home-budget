/**
 * Represents a single point in the moving average calculation
 */
export interface MovingAverageResult {
  /** The index of this data point in the original array */
  index: number;
  /** The calculated moving average value, or null if not enough data points */
  value: number | null;
  /** Whether this point has a valid moving average calculation */
  hasValue: boolean;
}

/**
 * Calculates the simple moving average for an array of numbers.
 *
 * The moving average at position i is the average of the values from
 * position (i - period + 1) to position i (inclusive).
 *
 * For the first (period - 1) positions where there aren't enough previous
 * values, the result will have value: null and hasValue: false.
 *
 * @param values - Array of numeric values to calculate moving average for
 * @param period - The number of periods to average (default: 3)
 * @returns Array of MovingAverageResult objects
 *
 * @example
 * // 3-period moving average
 * const values = [100, 200, 300, 400, 500];
 * const ma = calculateMovingAverage(values, 3);
 * // Returns:
 * // [
 * //   { index: 0, value: null, hasValue: false },
 * //   { index: 1, value: null, hasValue: false },
 * //   { index: 2, value: 200, hasValue: true },  // (100 + 200 + 300) / 3
 * //   { index: 3, value: 300, hasValue: true },  // (200 + 300 + 400) / 3
 * //   { index: 4, value: 400, hasValue: true },  // (300 + 400 + 500) / 3
 * // ]
 */
export function calculateMovingAverage(
  values: number[],
  period: number = 3
): MovingAverageResult[] {
  if (!values || values.length === 0) {
    return [];
  }

  if (period < 1) {
    throw new Error('Period must be at least 1');
  }

  if (period > values.length) {
    return values.map((_, index) => ({
      index,
      value: null,
      hasValue: false,
    }));
  }

  const result: MovingAverageResult[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push({
        index: i,
        value: null,
        hasValue: false,
      });
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += values[j];
      }
      result.push({
        index: i,
        value: sum / period,
        hasValue: true,
      });
    }
  }

  return result;
}

/**
 * Calculates the exponential moving average (EMA) for an array of numbers.
 * EMA gives more weight to recent values.
 *
 * @param values - Array of numeric values to calculate EMA for
 * @param period - The number of periods for EMA calculation (default: 3)
 * @returns Array of MovingAverageResult objects
 */
export function calculateExponentialMovingAverage(
  values: number[],
  period: number = 3
): MovingAverageResult[] {
  if (!values || values.length === 0) {
    return [];
  }

  if (period < 1) {
    throw new Error('Period must be at least 1');
  }

  if (values.length < period) {
    return values.map((_, index) => ({
      index,
      value: null,
      hasValue: false,
    }));
  }

  const result: MovingAverageResult[] = [];
  const multiplier = 2 / (period + 1);

  // First (period - 1) values don't have EMA
  for (let i = 0; i < period - 1; i++) {
    result.push({
      index: i,
      value: null,
      hasValue: false,
    });
  }

  // Calculate initial SMA for the first valid EMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let ema = sum / period;

  result.push({
    index: period - 1,
    value: ema,
    hasValue: true,
  });

  // Calculate EMA for remaining values
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
    result.push({
      index: i,
      value: ema,
      hasValue: true,
    });
  }

  return result;
}
