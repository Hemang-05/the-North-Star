import { describe, it, expect } from 'vitest';
import {
  computeForexKpiSummary,
  CRITICAL_MISTAKE_COUNT_THRESHOLD,
  SEVERE_TRADE_MISTAKES,
} from '../services/forexKpi';
import type {
  ForexStudySession,
  ForexSetup,
  ForexBacktestBatch,
  ForexPaperTrade,
  FocusSession,
  ActivityEvent,
} from '../types';

describe('Forex Learning KPI Engine (computeForexKpiSummary)', () => {
  const mockNow = new Date('2026-09-05T12:00:00Z');

  it('handles empty inputs with clean zero and null defaults', () => {
    const kpis = computeForexKpiSummary([], [], [], [], [], [], mockNow);

    expect(kpis.totalStudySessions).toBe(0);
    expect(kpis.totalStudyMinutes).toBe(0);
    expect(kpis.totalStudyHoursFormatted).toBe('0h 0m');
    expect(kpis.totalSetups).toBe(0);
    expect(kpis.totalBacktestBatches).toBe(0);
    expect(kpis.totalBacktestedTrades).toBe(0);
    expect(kpis.weightedBacktestWinRate).toBeNull();
    expect(kpis.averageRecordedExpectancyR).toBeNull();
    expect(kpis.totalPaperTrades).toBe(0);
    expect(kpis.paperWinRate).toBeNull();
    expect(kpis.averageRMultiple).toBeNull();
    expect(kpis.ruleAdherenceRate).toBeNull();
    expect(kpis.cleanTradeStreak).toBe(0);
    expect(kpis.totalMistakesRecorded).toBe(0);
    expect(kpis.severeMistakeCount).toBe(0);
    expect(kpis.fomoCount).toBe(0);
    expect(kpis.revengeCount).toBe(0);
  });

  it('correctly calculates study minutes, hours, and curriculum phase breakdown', () => {
    const studySessions: ForexStudySession[] = [
      {
        id: 's1',
        topic: 'Market Structure & Swings',
        curriculumPhase: 'FOUNDATION',
        studyType: 'VIDEO',
        durationMinutes: 45,
        studiedAt: '2026-09-04T10:00:00Z',
        createdAt: '2026-09-04T10:00:00Z',
      },
      {
        id: 's2',
        topic: 'Liquidity Pools',
        curriculumPhase: 'MARKET_UNDERSTANDING',
        studyType: 'CHART_STUDY',
        durationMinutes: 75,
        studiedAt: '2026-09-05T09:00:00Z',
        createdAt: '2026-09-05T09:00:00Z',
      },
      {
        id: 's3',
        topic: 'Older Foundation Session',
        curriculumPhase: 'FOUNDATION',
        studyType: 'BOOK',
        durationMinutes: 60,
        studiedAt: '2026-08-01T10:00:00Z', // Outside 7-day window
        createdAt: '2026-08-01T10:00:00Z',
      },
    ];

    const kpis = computeForexKpiSummary(studySessions, [], [], [], [], [], mockNow);

    expect(kpis.totalStudySessions).toBe(3);
    expect(kpis.totalStudyMinutes).toBe(180); // 45 + 75 + 60
    expect(kpis.totalStudyHoursFormatted).toBe('3h 0m');
    expect(kpis.studySessionsThisWeek).toBe(2);
    expect(kpis.studyMinutesThisWeek).toBe(120);
    expect(kpis.sessionsByPhase.FOUNDATION).toBe(2);
    expect(kpis.sessionsByPhase.MARKET_UNDERSTANDING).toBe(1);
    expect(kpis.sessionsByPhase.EXECUTION).toBe(0);
  });

  it('aggregates setup statuses across lifecycle stages', () => {
    const setups: ForexSetup[] = [
      {
        id: 'set1',
        name: 'Asian Range Sweep',
        marketContext: 'Range Reversal',
        timeframe: '15m',
        entryRules: 'High swept + displacement',
        slRules: 'High + 2 pips',
        tpRules: 'Opposite low',
        status: 'VALIDATED',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'set2',
        name: 'London Continuation',
        marketContext: 'Trend Continuation',
        timeframe: '5m',
        entryRules: 'FVG mitigation',
        slRules: 'Swing low',
        tpRules: '2.0R',
        status: 'BACKTESTING',
        createdAt: '2026-09-02T00:00:00Z',
        updatedAt: '2026-09-02T00:00:00Z',
      },
      {
        id: 'set3',
        name: 'NY Open Breakout',
        marketContext: 'Breakout',
        timeframe: '1h',
        entryRules: 'Close outside range',
        slRules: 'Midpoint',
        tpRules: '1.5R',
        status: 'PAPER_TRADING',
        createdAt: '2026-09-03T00:00:00Z',
        updatedAt: '2026-09-03T00:00:00Z',
      },
    ];

    const kpis = computeForexKpiSummary([], setups, [], [], [], [], mockNow);

    expect(kpis.totalSetups).toBe(3);
    expect(kpis.setupsValidated).toBe(1);
    expect(kpis.setupsBacktesting).toBe(1);
    expect(kpis.setupsPaperTrading).toBe(1);
    expect(kpis.setupsDraft).toBe(0);
  });

  it('computes backtesting statistics, weighting win rates and preserving recorded expectancy without fabrication', () => {
    const backtests: ForexBacktestBatch[] = [
      {
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
        recordedExpectancyR: 1.8, // Explicitly entered
        ruleViolations: 2,
        backtestedAt: '2026-09-02T00:00:00Z',
        createdAt: '2026-09-02T00:00:00Z',
      },
      {
        id: 'bt2',
        setupId: 'set1',
        pair: 'GBP/USD',
        timeframe: '15m',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
        sampleSize: 20,
        wins: 12,
        losses: 8,
        breakevens: 0,
        winRate: 60,
        recordedExpectancyR: 1.2, // Explicitly entered
        ruleViolations: 1,
        backtestedAt: '2026-09-03T00:00:00Z',
        createdAt: '2026-09-03T00:00:00Z',
      },
    ];

    const kpis = computeForexKpiSummary([], [], backtests, [], [], [], mockNow);

    expect(kpis.totalBacktestBatches).toBe(2);
    expect(kpis.totalBacktestedTrades).toBe(50); // 30 + 20
    expect(kpis.totalBacktestWins).toBe(30); // 18 + 12
    expect(kpis.totalBacktestLosses).toBe(20); // 12 + 8
    expect(kpis.weightedBacktestWinRate).toBe(60); // 30 / 50 * 100
    expect(kpis.recordedBatchesWithExpectancy).toBe(2);
    expect(kpis.averageRecordedExpectancyR).toBe(1.5); // (1.8 + 1.2) / 2
    expect(kpis.totalBacktestRuleViolations).toBe(3);
    expect(kpis.backtestRuleAdherenceRate).toBe(94); // (50 - 3) / 50 * 100 = 94%
  });

  it('correctly calculates paper trading metrics, rule adherence, clean streak, and mistake distribution', () => {
    const paperTrades: ForexPaperTrade[] = [
      // Trade 4: Most recent - clean win (+2.0R)
      {
        id: 't4',
        setupId: 'set1',
        pair: 'EUR/USD',
        direction: 'LONG',
        entryPrice: 1.085,
        slPrice: 1.083,
        tpPrice: 1.089,
        rMultiple: 2.0,
        result: 'WIN',
        ruleAdhered: true,
        mistakeTag: 'NONE',
        tradedAt: '2026-09-05T08:00:00Z',
        createdAt: '2026-09-05T08:00:00Z',
      },
      // Trade 3: Clean loss (-1.0R) - adhered to rules
      {
        id: 't3',
        setupId: 'set1',
        pair: 'GBP/USD',
        direction: 'SHORT',
        entryPrice: 1.285,
        slPrice: 1.288,
        tpPrice: 1.279,
        rMultiple: -1.0,
        result: 'LOSS',
        ruleAdhered: true,
        mistakeTag: 'NONE',
        tradedAt: '2026-09-04T08:00:00Z',
        createdAt: '2026-09-04T08:00:00Z',
      },
      // Trade 2: Broke rules with FOMO (-1.0R) -> Resets clean streak
      {
        id: 't2',
        setupId: 'set1',
        pair: 'EUR/USD',
        direction: 'LONG',
        entryPrice: 1.087,
        slPrice: 1.085,
        tpPrice: 1.091,
        rMultiple: -1.0,
        result: 'LOSS',
        ruleAdhered: false,
        mistakeTag: 'FOMO',
        tradedAt: '2026-09-03T08:00:00Z',
        createdAt: '2026-09-03T08:00:00Z',
      },
      // Trade 1: Broke rules with REVENGE (-1.0R)
      {
        id: 't1',
        setupId: 'set1',
        pair: 'EUR/USD',
        direction: 'LONG',
        entryPrice: 1.086,
        slPrice: 1.084,
        tpPrice: 1.09,
        rMultiple: -1.0,
        result: 'LOSS',
        ruleAdhered: false,
        mistakeTag: 'REVENGE',
        tradedAt: '2026-09-02T08:00:00Z',
        createdAt: '2026-09-02T08:00:00Z',
      },
    ];

    const kpis = computeForexKpiSummary([], [], [], paperTrades, [], [], mockNow);

    expect(kpis.totalPaperTrades).toBe(4);
    expect(kpis.tradesWin).toBe(1);
    expect(kpis.tradesLoss).toBe(3);
    expect(kpis.paperWinRate).toBe(25); // 1 / 4 * 100
    expect(kpis.totalRRealized).toBe(-1.0); // 2.0 - 1.0 - 1.0 - 1.0 = -1.0
    expect(kpis.averageRMultiple).toBe(-0.25); // -1.0 / 4

    // Primary Discipline KPIs
    expect(kpis.ruleAdheredCount).toBe(2);
    expect(kpis.ruleViolatedCount).toBe(2);
    expect(kpis.ruleAdherenceRate).toBe(50); // 2 / 4 * 100 = 50%

    // Clean streak: most recent trades are t4 (clean) and t3 (clean) -> streak = 2
    expect(kpis.cleanTradeStreak).toBe(2);

    // Mistakes
    expect(kpis.totalMistakesRecorded).toBe(2); // 1 FOMO + 1 REVENGE
    expect(kpis.fomoCount).toBe(1);
    expect(kpis.revengeCount).toBe(1);
    expect(kpis.severeMistakeCount).toBe(2); // FOMO + REVENGE are severe
    expect(kpis.fomoCount + kpis.revengeCount).toBe(CRITICAL_MISTAKE_COUNT_THRESHOLD);
  });
});
