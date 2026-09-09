import { describe, it, expect } from 'vitest';
import { evaluateForexStatus } from '../services/statusEngine';
import { computeForexKpiSummary, CRITICAL_MISTAKE_COUNT_THRESHOLD } from '../services/forexKpi';
import type { Goal } from '../types';

describe('Forex Learning Status Engine (evaluateForexStatus)', () => {
  const mockNow = new Date('2026-09-05T12:00:00Z');

  it('returns NEGLECTED with "Awaiting Initial Input" on an uninitialized dataset', () => {
    const kpis = computeForexKpiSummary([], [], [], [], [], [], mockNow);
    const result = evaluateForexStatus(kpis, []);

    expect(result.verdict).toBe('NEGLECTED');
    expect(result.headline).toBe('Awaiting Initial Input');
    expect(result.score).toBe(10);
    expect(result.badges).toContain('Uninitialized');
  });

  it('returns NEGLECTED when inactive for the past 7 days', () => {
    // Has historic sessions older than 7 days, but 0 activity this week
    const oldSession = {
      id: 's_old',
      topic: 'Historic Study',
      curriculumPhase: 'FOUNDATION' as const,
      studyType: 'BOOK' as const,
      durationMinutes: 60,
      studiedAt: '2026-08-01T00:00:00Z',
      createdAt: '2026-08-01T00:00:00Z',
    };
    const kpis = computeForexKpiSummary([oldSession], [], [], [], [], [], mockNow);
    const result = evaluateForexStatus(kpis, []);

    expect(result.verdict).toBe('NEGLECTED');
    expect(result.headline).toBe('Forex Learning Dormant');
    expect(result.reason).toContain('0 study sessions, backtests, or paper trades logged in the past 7 days');
  });

  it('triggers AT_RISK with transparent threshold warning when FOMO + REVENGE >= threshold (2)', () => {
    const trades = [
      {
        id: 't1',
        pair: 'EUR/USD',
        direction: 'LONG' as const,
        entryPrice: 1.08,
        slPrice: 1.078,
        tpPrice: 1.084,
        result: 'LOSS' as const,
        ruleAdhered: false,
        mistakeTag: 'FOMO' as const,
        tradedAt: '2026-09-04T10:00:00Z',
        createdAt: '2026-09-04T10:00:00Z',
      },
      {
        id: 't2',
        pair: 'EUR/USD',
        direction: 'LONG' as const,
        entryPrice: 1.08,
        slPrice: 1.078,
        tpPrice: 1.084,
        result: 'LOSS' as const,
        ruleAdhered: false,
        mistakeTag: 'REVENGE' as const,
        tradedAt: '2026-09-05T10:00:00Z',
        createdAt: '2026-09-05T10:00:00Z',
      },
    ];

    const kpis = computeForexKpiSummary([], [], [], trades, [], [], mockNow);
    const result = evaluateForexStatus(kpis, []);

    expect(result.verdict).toBe('AT_RISK');
    expect(result.headline).toContain(`Discipline Breakdown: Severe Mistakes (Threshold >= ${CRITICAL_MISTAKE_COUNT_THRESHOLD})`);
    expect(result.reason).toContain(`Explicit threshold is >= ${CRITICAL_MISTAKE_COUNT_THRESHOLD}`);
    expect(result.reason).toContain('1 FOMO, 1 Revenge');
    expect(result.score).toBe(35);
  });

  it('triggers AT_RISK when rule adherence falls below 70%', () => {
    // 3 trades, 2 violated rules -> adherence = 33.3% (< 70%)
    const trades = [
      {
        id: 't1',
        pair: 'EUR/USD',
        direction: 'LONG' as const,
        entryPrice: 1.08,
        slPrice: 1.078,
        tpPrice: 1.084,
        result: 'WIN' as const,
        ruleAdhered: true,
        mistakeTag: 'NONE' as const,
        tradedAt: '2026-09-05T08:00:00Z',
        createdAt: '2026-09-05T08:00:00Z',
      },
      {
        id: 't2',
        pair: 'EUR/USD',
        direction: 'LONG' as const,
        entryPrice: 1.08,
        slPrice: 1.078,
        tpPrice: 1.084,
        result: 'LOSS' as const,
        ruleAdhered: false,
        mistakeTag: 'EARLY_ENTRY' as const,
        tradedAt: '2026-09-05T09:00:00Z',
        createdAt: '2026-09-05T09:00:00Z',
      },
      {
        id: 't3',
        pair: 'EUR/USD',
        direction: 'LONG' as const,
        entryPrice: 1.08,
        slPrice: 1.078,
        tpPrice: 1.084,
        result: 'LOSS' as const,
        ruleAdhered: false,
        mistakeTag: 'LATE_ENTRY' as const,
        tradedAt: '2026-09-05T10:00:00Z',
        createdAt: '2026-09-05T10:00:00Z',
      },
    ];

    const kpis = computeForexKpiSummary([], [], [], trades, [], [], mockNow);
    const result = evaluateForexStatus(kpis, []);

    expect(result.verdict).toBe('AT_RISK');
    expect(result.headline).toContain('Rule Adherence Compromised');
    expect(result.reason).toContain('below the 70% process minimum');
    expect(result.score).toBe(40);
  });

  it('triggers AT_RISK on premature paper trading when backtesting sample size is < 20', () => {
    // 5 clean paper trades, but 0 backtested sample trades
    const trades = Array.from({ length: 5 }, (_, i) => ({
      id: `t_${i}`,
      pair: 'EUR/USD',
      direction: 'LONG' as const,
      entryPrice: 1.08,
      slPrice: 1.078,
      tpPrice: 1.084,
      result: 'WIN' as const,
      ruleAdhered: true,
      mistakeTag: 'NONE' as const,
      tradedAt: '2026-09-05T10:00:00Z',
      createdAt: '2026-09-05T10:00:00Z',
    }));

    const kpis = computeForexKpiSummary([], [], [], trades, [], [], mockNow);
    const result = evaluateForexStatus(kpis, []);

    expect(result.verdict).toBe('AT_RISK');
    expect(result.headline).toBe('Insufficient Backtesting Sample Size');
    expect(result.reason).toContain('Minimum statistical threshold is 20 historical sample trades');
  });

  it('returns ON_TRACK under healthy heuristic learning momentum', () => {
    const session = {
      id: 's1',
      topic: 'Market Structure',
      curriculumPhase: 'FOUNDATION' as const,
      studyType: 'VIDEO' as const,
      durationMinutes: 120,
      studiedAt: '2026-09-05T10:00:00Z',
      createdAt: '2026-09-05T10:00:00Z',
    };
    const setup = {
      id: 'set1',
      name: 'London Breakout',
      marketContext: 'Trend Continuation',
      timeframe: '15m',
      entryRules: 'Rules',
      slRules: 'SL',
      tpRules: 'TP',
      status: 'BACKTESTING' as const,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };
    const bt = {
      id: 'bt1',
      setupId: 'set1',
      pair: 'EUR/USD',
      timeframe: '15m',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      sampleSize: 30,
      wins: 18,
      losses: 12,
      breakevens: 0,
      winRate: 60,
      recordedExpectancyR: 1.5,
      ruleViolations: 1,
      backtestedAt: '2026-09-05T00:00:00Z',
      createdAt: '2026-09-05T00:00:00Z',
    };
    const focus = [
      {
        id: 'f1',
        pillarId: 'forex' as const,
        category: 'Study',
        startedAt: '2026-09-04T10:00:00Z',
        durationSeconds: 3600,
        pausedSeconds: 0,
        status: 'STOPPED' as const,
      },
      {
        id: 'f2',
        pillarId: 'forex' as const,
        category: 'Backtesting',
        startedAt: '2026-09-05T10:00:00Z',
        durationSeconds: 3600,
        pausedSeconds: 0,
        status: 'STOPPED' as const,
      },
    ];

    const kpis = computeForexKpiSummary([session], [setup], [bt], [], focus, [], mockNow);
    const result = evaluateForexStatus(kpis, []);

    expect(result.verdict).toBe('ON_TRACK');
    expect(result.headline).toContain('Healthy Learning Momentum');
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it('returns EXCEEDING when discipline mastery is achieved', () => {
    const session = {
      id: 's1',
      topic: 'Advanced Order Flow',
      curriculumPhase: 'EXECUTION' as const,
      studyType: 'CHART_STUDY' as const,
      durationMinutes: 650,
      studiedAt: '2026-09-05T10:00:00Z',
      createdAt: '2026-09-05T10:00:00Z',
    };
    const setup = {
      id: 'set1',
      name: 'Validated London Breakout',
      marketContext: 'Trend Continuation',
      timeframe: '15m',
      entryRules: 'Rules',
      slRules: 'SL',
      tpRules: 'TP',
      status: 'VALIDATED' as const,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };
    const bt = {
      id: 'bt1',
      setupId: 'set1',
      pair: 'EUR/USD',
      timeframe: '15m',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      sampleSize: 60,
      wins: 40,
      losses: 20,
      breakevens: 0,
      winRate: 66.7,
      recordedExpectancyR: 2.1,
      ruleViolations: 0,
      backtestedAt: '2026-09-05T00:00:00Z',
      createdAt: '2026-09-05T00:00:00Z',
    };
    const trades = Array.from({ length: 6 }, (_, i) => ({
      id: `t_${i}`,
      pair: 'EUR/USD',
      direction: 'LONG' as const,
      entryPrice: 1.08,
      slPrice: 1.078,
      tpPrice: 1.084,
      result: 'WIN' as const,
      ruleAdhered: true,
      mistakeTag: 'NONE' as const,
      tradedAt: `2026-09-05T${10 + i}:00:00Z`,
      createdAt: `2026-09-05T${10 + i}:00:00Z`,
    }));

    const kpis = computeForexKpiSummary([session], [setup], [bt], trades, [], [], mockNow);
    const result = evaluateForexStatus(kpis, []);

    expect(result.verdict).toBe('EXCEEDING');
    expect(result.headline).toBe('Mastery Discipline Achieved [Heuristic]');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.badges).toContain('Discipline Master');
  });

  it('evaluates status deterministically against active user goals', () => {
    const session = {
      id: 's1',
      topic: 'Study',
      curriculumPhase: 'FOUNDATION' as const,
      studyType: 'VIDEO' as const,
      durationMinutes: 600, // 10h
      studiedAt: '2026-09-05T10:00:00Z',
      createdAt: '2026-09-05T10:00:00Z',
    };
    const kpis = computeForexKpiSummary([session], [], [], [], [], [], mockNow);

    const goalMet: Goal = {
      id: 'g1',
      pillarId: 'forex',
      title: '10h Study this Month',
      targetValue: 10,
      targetType: 'COUNT',
      cadence: 'MONTHLY',
      currentComputedValue: 10,
      isActive: true,
      createdAt: '2026-09-01T00:00:00Z',
    };

    const result = evaluateForexStatus(kpis, [goalMet]);
    expect(result.verdict).toBe('EXCEEDING');
    expect(result.headline).toBe('Surpassing Learning Goals');
  });
});
