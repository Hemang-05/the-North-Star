import { describe, it, expect } from 'vitest';
import { groupAndStackByDate, safeGetTimestamp } from '../utils/dateFolding';

describe('dateFolding Engine', () => {
  const referenceNow = new Date('2026-09-22T14:30:00.000Z');

  it('safeGetTimestamp parses ISO strings, epoch ms, and Date instances', () => {
    expect(safeGetTimestamp(null)).toBe(0);
    expect(safeGetTimestamp(undefined)).toBe(0);
    expect(safeGetTimestamp('invalid-date')).toBe(0);
    expect(safeGetTimestamp(1727010000000)).toBe(1727010000000);
    const d = new Date('2026-09-22T10:00:00.000Z');
    expect(safeGetTimestamp(d)).toBe(d.getTime());
    expect(safeGetTimestamp('2026-09-22T10:00:00.000Z')).toBe(d.getTime());
  });

  it('returns empty array when no items provided', () => {
    expect(groupAndStackByDate([], (item: any) => item.date, referenceNow)).toEqual([]);
  });

  it('stacks items latest on top within a single day and across multiple days', () => {
    const items = [
      { id: 'job-1', title: 'Earlier Morning Job', date: '2026-09-22T09:00:00.000Z' },
      { id: 'job-2', title: 'Afternoon Job (Latest)', date: '2026-09-22T14:00:00.000Z' },
      { id: 'job-3', title: 'Mid Morning Job', date: '2026-09-22T11:00:00.000Z' },
      { id: 'job-yesterday-1', title: 'Yesterday Morning', date: '2026-09-21T08:00:00.000Z' },
      { id: 'job-yesterday-2', title: 'Yesterday Evening', date: '2026-09-21T18:00:00.000Z' },
      { id: 'job-older', title: 'Last Week Job', date: '2026-09-15T12:00:00.000Z' },
    ];

    const folds = groupAndStackByDate(items, (item) => item.date, referenceNow);

    // Should create 3 folds: Today, Yesterday, and Older date
    expect(folds).toHaveLength(3);

    // 1st Fold: Today
    expect(folds[0].label).toBe('Today');
    expect(folds[0].items).toHaveLength(3);
    // Verified descending: job-2 (14:00) -> job-3 (11:00) -> job-1 (09:00)
    expect(folds[0].items[0].id).toBe('job-2');
    expect(folds[0].items[1].id).toBe('job-3');
    expect(folds[0].items[2].id).toBe('job-1');

    // 2nd Fold: Yesterday
    expect(folds[1].label).toBe('Yesterday');
    expect(folds[1].items).toHaveLength(2);
    // Verified descending: job-yesterday-2 (18:00) -> job-yesterday-1 (08:00)
    expect(folds[1].items[0].id).toBe('job-yesterday-2');
    expect(folds[1].items[1].id).toBe('job-yesterday-1');

    // 3rd Fold: Older
    expect(folds[2].items).toHaveLength(1);
    expect(folds[2].items[0].id).toBe('job-older');
  });

  it('handles undated items safely by grouping them under an Undated fold at the end', () => {
    const items = [
      { id: 'job-valid', date: '2026-09-22T10:00:00.000Z' },
      { id: 'job-nodate', date: undefined },
      { id: 'job-bad-date', date: 'not-a-date' },
    ];

    const folds = groupAndStackByDate(items, (item) => item.date, referenceNow);

    expect(folds).toHaveLength(2);
    expect(folds[0].label).toBe('Today');
    expect(folds[0].items[0].id).toBe('job-valid');

    expect(folds[1].label).toBe('Undated');
    expect(folds[1].items).toHaveLength(2);
  });
});
