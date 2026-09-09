import { describe, it, expect, vi } from 'vitest';
import { logEvent } from '../hooks/useDatabase';
import { computeForexKpiSummary } from '../services/forexKpi';
import { evaluateForexStatus } from '../services/statusEngine';
import { generateOfflineForexAudit, type ForexAiFacts } from '../services/aiContext';
import type {
  ForexStudySession,
  ForexSetup,
  ForexBacktestBatch,
  ForexPaperTrade,
  ActivityEvent,
} from '../types';

vi.mock('../services/db', () => ({
  dbPut: vi.fn().mockImplementation(async (_store, item) => item),
  dbGetAll: vi.fn().mockResolvedValue([]),
  STORES: {
    EVENTS: 'activityEvents',
    FOREX_STUDY: 'forexStudy',
    FOREX_SETUPS: 'forexSetups',
    FOREX_BACKTESTS: 'forexBacktests',
    FOREX_PAPER_TRADES: 'forexPaperTrades',
    GOALS: 'goals',
  },
}));

describe('Forex Learning Integration & Activity Ledger Verification', () => {
  it('verifies full Forex event schema and entity references for all major actions', async () => {
    // 1. Log Study Session Event
    const studyEvt = await logEvent('forex', 'FOREX_STUDY_SESSION', {
      quantity: 45,
      unit: 'minutes',
      entityRefType: 'ForexStudySession',
      entityRefId: 'fx_study_123',
      metadata: {
        topic: 'Market Structure & Liquidity',
        curriculumPhase: 'FOUNDATION',
        studyType: 'VIDEO',
        durationMinutes: 45,
      },
    });

    expect(studyEvt.pillarId).toBe('forex');
    expect(studyEvt.eventType).toBe('FOREX_STUDY_SESSION');
    expect(studyEvt.quantity).toBe(45);
    expect(studyEvt.unit).toBe('minutes');
    expect(studyEvt.entityRefType).toBe('ForexStudySession');
    expect(studyEvt.entityRefId).toBe('fx_study_123');
    expect(studyEvt.metadata).toBeDefined();
    expect(studyEvt.metadata?.topic).toBe('Market Structure & Liquidity');

    // 2. Log Setup Documented Event
    const setupEvt = await logEvent('forex', 'FOREX_SETUP_DOCUMENTED', {
      quantity: 1,
      unit: 'setup',
      entityRefType: 'ForexSetup',
      entityRefId: 'fx_setup_456',
      metadata: {
        name: 'London Breakout',
        timeframe: '15m',
        marketContext: 'Trend Continuation',
        status: 'BACKTESTING',
      },
    });

    expect(setupEvt.pillarId).toBe('forex');
    expect(setupEvt.eventType).toBe('FOREX_SETUP_DOCUMENTED');
    expect(setupEvt.quantity).toBe(1);
    expect(setupEvt.entityRefType).toBe('ForexSetup');
    expect(setupEvt.entityRefId).toBe('fx_setup_456');

    // 3. Log Backtest Run Event
    const btEvt = await logEvent('forex', 'FOREX_BACKTEST_RUN', {
      quantity: 30,
      unit: 'trades',
      entityRefType: 'ForexBacktestBatch',
      entityRefId: 'fx_bt_789',
      metadata: {
        setupId: 'fx_setup_456',
        pair: 'EUR/USD',
        sampleSize: 30,
        winRate: 60,
        recordedExpectancyR: 1.8,
      },
    });

    expect(btEvt.pillarId).toBe('forex');
    expect(btEvt.eventType).toBe('FOREX_BACKTEST_RUN');
    expect(btEvt.quantity).toBe(30);
    expect(btEvt.unit).toBe('trades');
    expect(btEvt.entityRefType).toBe('ForexBacktestBatch');
    expect(btEvt.metadata?.recordedExpectancyR).toBe(1.8);

    // 4. Log Paper Trade Event
    const tradeEvt = await logEvent('forex', 'FOREX_PAPER_TRADE', {
      quantity: 1,
      unit: 'trade',
      entityRefType: 'ForexPaperTrade',
      entityRefId: 'fx_trade_101',
      metadata: {
        pair: 'EUR/USD',
        direction: 'LONG',
        result: 'WIN',
        rMultiple: 2.0,
        ruleAdhered: true,
        mistakeTag: 'NONE',
      },
    });

    expect(tradeEvt.pillarId).toBe('forex');
    expect(tradeEvt.eventType).toBe('FOREX_PAPER_TRADE');
    expect(tradeEvt.entityRefType).toBe('ForexPaperTrade');
    expect(tradeEvt.metadata?.rMultiple).toBe(2.0);

    // 5. Log Rule Violation Event
    const violEvt = await logEvent('forex', 'FOREX_RULE_VIOLATION', {
      quantity: 1,
      unit: 'violation',
      entityRefType: 'ForexPaperTrade',
      entityRefId: 'fx_trade_102',
      metadata: {
        pair: 'GBP/USD',
        mistakeTag: 'FOMO',
        ruleAdhered: false,
        severe: true,
      },
    });

    expect(violEvt.pillarId).toBe('forex');
    expect(violEvt.eventType).toBe('FOREX_RULE_VIOLATION');
    expect(violEvt.metadata?.mistakeTag).toBe('FOMO');
  });

  it('generates deterministic offline strategic audit without hallucinations', () => {
    const mockFacts: ForexAiFacts = {
      timestamp: '2026-09-05T12:00:00Z',
      pillar: 'forex',
      status: {
        verdict: 'AT_RISK',
        score: 35,
        headline: 'Discipline Breakdown: Severe Mistakes (Threshold >= 2)',
        reason: 'Observed 2 critical discipline breach(es) (1 FOMO, 1 Revenge).',
      },
      study: {
        totalHoursFormatted: '2h 30m',
        totalSessions: 3,
        sessionsThisWeek: 2,
        minutesThisWeek: 90,
        phaseBreakdown: { FOUNDATION: 2, MARKET_UNDERSTANDING: 1 },
      },
      setups: {
        total: 1,
        validated: 0,
        inTesting: 1,
        inPaperTrading: 0,
        draft: 0,
        rejected: 0,
      },
      backtesting: {
        totalBatches: 1,
        totalSampleTrades: 15, // < 20 deficit
        weightedWinRate: '53.3%',
        averageRecordedExpectancy: '+1.2R (recorded)',
        ruleAdherenceRate: '86.7%',
        violationsCount: 2,
      },
      paperTrading: {
        totalTrades: 6,
        tradesThisWeek: 6,
        winRate: '33.3%',
        averageR: '-0.5R',
        totalR: '-3.0R',
        openTrades: 0,
      },
      discipline: {
        ruleAdherenceRate: '50.0%', // < 70% process breakdown
        cleanStreak: 0,
        totalMistakes: 3,
        severeMistakes: 2,
        fomoCount: 1,
        revengeCount: 1,
        topMistakes: [
          { mistake: 'FOMO', count: 1, percentage: '33.3%' },
          { mistake: 'REVENGE', count: 1, percentage: '33.3%' },
        ],
      },
      focusTime: {
        todayFormatted: '45m',
        thisWeekFormatted: '2h 15m',
        totalFormatted: '4h 30m',
      },
      activeGoals: [],
    };

    const audit = generateOfflineForexAudit(mockFacts);

    // Verifies key sections and deterministic advice
    expect(audit).toContain('Forex Learning — Strategic Skill & Discipline Audit');
    expect(audit).toContain('AT_RISK');
    expect(audit).toContain('Health Score: 35/100');
    expect(audit).toContain('1 FOMO and 1 Revenge trades detected');
    expect(audit).toContain('mandatory 30-minute cooling-off window');
    expect(audit).toContain('Backtesting Sample Deficit');
    expect(audit).toContain('only 15 backtested trades');
    expect(audit).toContain('Process adherence is currently 50.0%');
  });
});
