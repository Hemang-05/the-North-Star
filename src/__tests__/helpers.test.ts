import { describe, it, expect } from 'vitest';
import { safePct, pct, formatSafePercent, daysBetween } from '../utils/helpers';

describe('Utility Helpers & Safe Math', () => {
  it('safePct returns null for zero denominator instead of misleading 0%', () => {
    expect(safePct(0, 0)).toBeNull();
    expect(safePct(5, 0)).toBeNull();
    expect(safePct(-1, 0)).toBeNull();
    expect(safePct(2, 4)).toBe(50);
  });

  it('pct fallback returns 0 for zero denominator', () => {
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 0)).toBe(0);
    expect(pct(1, 2)).toBe(50);
  });

  it('formatSafePercent displays fallback symbol for null / NaN', () => {
    expect(formatSafePercent(null)).toBe('—');
    expect(formatSafePercent(NaN)).toBe('—');
    expect(formatSafePercent(null, 1, 'N/A')).toBe('N/A');
    expect(formatSafePercent(33.333, 1)).toBe('33.3%');
    expect(formatSafePercent(100, 0)).toBe('100%');
  });

  it('daysBetween computes calendar day difference accurately', () => {
    const d1 = '2026-09-01T00:00:00.000Z';
    const d2 = '2026-09-05T12:00:00.000Z';
    expect(daysBetween(d1, d2)).toBe(4);
  });
});
