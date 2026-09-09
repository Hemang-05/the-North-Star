import { describe, it, expect } from 'vitest';
import {
  getPeriodBounds,
  aggregateFocusSessions,
  DEEP_WORK_THRESHOLD_SECONDS,
} from '../services/timeAggregation';
import type { FocusSession } from '../types/core';

describe('Time Aggregation Engine', () => {
  const refDate = new Date('2026-09-09T14:30:00Z'); // Wednesday

  it('calculates calendar-aligned period bounds with local Monday-Sunday weeks', () => {
    const { current, previous } = getPeriodBounds('THIS_WEEK', refDate);
    expect(current.type).toBe('THIS_WEEK');
    expect(previous.type).toBe('THIS_WEEK');

    const startDate = new Date(current.start);
    const endDate = new Date(current.end);

    // Monday to Sunday check
    expect(startDate.getDay()).toBe(1); // Monday
    expect(endDate.getDay()).toBe(0);   // Sunday
    expect(endDate.getHours()).toBe(23);
    expect(endDate.getMinutes()).toBe(59);

    // Previous week is exactly 7 days before
    const prevStart = new Date(previous.start);
    expect(prevStart.getTime()).toBe(startDate.getTime() - 7 * 86400000);
  });

  it('calculates calendar-aligned monthly bounds from 1st to last day', () => {
    const { current, previous } = getPeriodBounds('THIS_MONTH', refDate);
    const startDate = new Date(current.start);
    const endDate = new Date(current.end);

    expect(startDate.getDate()).toBe(1);
    expect(startDate.getMonth()).toBe(8); // September (0-indexed 8)
    expect(endDate.getDate()).toBe(30);   // 30 days in Sept

    const prevStart = new Date(previous.start);
    expect(prevStart.getMonth()).toBe(7); // August
    expect(prevStart.getDate()).toBe(1);
  });

  it('aggregates focus sessions accurately across all 6 pillars', () => {
    const { current, previous } = getPeriodBounds('THIS_WEEK', refDate);

    const mockSessions: FocusSession[] = [
      // Job Hunt: 60 mins
      {
        id: 'foc_1',
        pillarId: 'job_hunt',
        category: 'Applications',
        startedAt: new Date('2026-09-08T10:00:00Z').toISOString(),
        durationSeconds: 3600,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
      // Agency: 90 mins (Deep Work)
      {
        id: 'foc_2',
        pillarId: 'agency',
        category: 'Client Work',
        startedAt: new Date('2026-09-08T14:00:00Z').toISOString(),
        durationSeconds: 5400,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
      // SaaS: 45 mins
      {
        id: 'foc_3',
        pillarId: 'trading_os',
        category: 'Product Development',
        startedAt: new Date('2026-09-09T09:00:00Z').toISOString(),
        durationSeconds: 2700,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
      // Forex: 20 mins (Not deep work)
      {
        id: 'foc_4',
        pillarId: 'forex',
        category: 'Study',
        startedAt: new Date('2026-09-09T11:00:00Z').toISOString(),
        durationSeconds: 1200,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
      // RUNNING session (should be excluded)
      {
        id: 'foc_running',
        pillarId: 'fitness',
        category: 'Gym',
        startedAt: new Date('2026-09-09T12:00:00Z').toISOString(),
        durationSeconds: 1800,
        pausedSeconds: 0,
        status: 'RUNNING',
      },
      // Prior week session: 60 mins Agency
      {
        id: 'foc_prior',
        pillarId: 'agency',
        category: 'Client Work',
        startedAt: new Date('2026-09-01T10:00:00Z').toISOString(),
        durationSeconds: 3600,
        pausedSeconds: 0,
        status: 'STOPPED',
      },
    ];

    const summary = aggregateFocusSessions(mockSessions, current, previous);

    // Total minutes = 60 + 90 + 45 + 20 = 215 minutes (~3.6h)
    expect(summary.totalMinutes).toBe(215);
    expect(summary.totalHours).toBe(3.6);
    expect(summary.sessionCount).toBe(4);

    // Deep work check (sessions >= 25 mins: foc_1 [60m], foc_2 [90m], foc_3 [45m] = 195m)
    expect(summary.deepWorkSessionCount).toBe(3);
    expect(summary.deepWorkMinutes).toBe(195);
    expect(summary.deepWorkRatioPercent).toBe(91); // 195 / 215 = 90.7% -> 91%

    // Priority aligned check (Top 3: Job Hunt + Agency + SaaS = 60 + 90 + 45 = 195m)
    expect(summary.priorityAlignedMinutes).toBe(195);
    expect(summary.priorityAlignedPercent).toBe(91);

    // Pillar breakdown
    const jobPillar = summary.pillarDetails.find((p) => p.pillarId === 'job_hunt');
    expect(jobPillar?.minutes).toBe(60);
    expect(jobPillar?.sharePercent).toBe(27.9);

    const agencyPillar = summary.pillarDetails.find((p) => p.pillarId === 'agency');
    expect(agencyPillar?.minutes).toBe(90);
    expect(agencyPillar?.previousPeriodMinutes).toBe(60);
    expect(agencyPillar?.changePercent).toBe(50); // (90 - 60) / 60 = +50%

    const forexPillar = summary.pillarDetails.find((p) => p.pillarId === 'forex');
    expect(forexPillar?.minutes).toBe(20);

    // Prior week total was 60 minutes
    expect(summary.previousPeriod?.totalMinutes).toBe(60);
    expect(summary.changePercent).toBe(258.3); // (215 - 60) / 60 * 100 = 258.3%
  });

  it('handles edge cases: zero sessions, single session, zero duration', () => {
    const { current, previous } = getPeriodBounds('THIS_WEEK', refDate);

    // Zero sessions
    const emptySummary = aggregateFocusSessions([], current, previous);
    expect(emptySummary.totalMinutes).toBe(0);
    expect(emptySummary.totalHours).toBe(0);
    expect(emptySummary.sessionCount).toBe(0);
    expect(emptySummary.averageSessionMinutes).toBe(0);
    expect(emptySummary.deepWorkMinutes).toBe(0);
    expect(emptySummary.pillarDetails.length).toBe(6);
    expect(emptySummary.pillarDetails.every((p) => p.minutes === 0)).toBe(true);

    // Zero duration session
    const zeroDurSession: FocusSession = {
      id: 'foc_0',
      pillarId: 'job_hunt',
      category: 'General',
      startedAt: new Date('2026-09-08T10:00:00Z').toISOString(),
      durationSeconds: 0,
      pausedSeconds: 0,
      status: 'STOPPED',
    };
    const zeroSummary = aggregateFocusSessions([zeroDurSession], current, previous);
    expect(zeroSummary.totalMinutes).toBe(0);
    expect(zeroSummary.sessionCount).toBe(1);
    expect(zeroSummary.longestSessionMinutes).toBe(0);
  });

  it('explicitly evaluates cross-midnight FocusSession boundary attribution', () => {
    // Reference dates for Day 1 and Day 2 using local calendar
    const day1Ref = new Date(2026, 8, 8, 12, 0, 0);
    const day2Ref = new Date(2026, 8, 9, 12, 0, 0);

    const day1Bounds = getPeriodBounds('TODAY', day1Ref);
    const day2Bounds = getPeriodBounds('TODAY', day2Ref);

    // Session starts at 23:45 local time on Day 1 and runs across midnight (60 mins)
    const localStart = new Date(2026, 8, 8, 23, 45, 0);
    const crossMidnightSession: FocusSession = {
      id: 'foc_midnight',
      pillarId: 'agency',
      category: 'Client Work',
      startedAt: localStart.toISOString(),
      durationSeconds: 3600, // 60 mins (runs 23:45 to 00:45)
      pausedSeconds: 0,
      status: 'STOPPED',
    };

    // Day 1 aggregation: session initiated at 23:45 is attributed to Day 1
    const day1Summary = aggregateFocusSessions([crossMidnightSession], day1Bounds.current, day1Bounds.previous);
    expect(day1Summary.sessionCount).toBe(1);
    expect(day1Summary.totalMinutes).toBe(60);

    // Day 2 aggregation: session initiated on Day 1 is not double-counted in Day 2 current period
    const day2Summary = aggregateFocusSessions([crossMidnightSession], day2Bounds.current, day2Bounds.previous);
    expect(day2Summary.sessionCount).toBe(0);
    expect(day2Summary.totalMinutes).toBe(0);
    // In Day 2's comparison baseline (Yesterday), it is accurately accounted for
    expect(day2Summary.previousPeriod?.totalMinutes).toBe(60);
  });
});

