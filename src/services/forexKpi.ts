// ============================================================================
// PERSONAL OS — Forex Learning KPI Engine
// Pure, deterministic metrics calculation for Pillar 4: Forex Learning.
// Focuses on the core learning loop:
// Study → Understanding → Setup Development → Backtesting → Paper Trading → Review → Discipline
// Code calculates. AI judges and explains.
// ============================================================================

import { dbGetAll, STORES } from './db';
import type {
  ForexStudySession,
  ForexSetup,
  ForexBacktestBatch,
  ForexPaperTrade,
  CurriculumPhase,
  StudyType,
  SetupStatus,
  TradeMistake,
  FocusSession,
  ActivityEvent,
} from '../types';
import { safePct } from '../utils/helpers';

export const ALL_CURRICULUM_PHASES: CurriculumPhase[] = [
  'FOUNDATION',
  'MARKET_UNDERSTANDING',
  'STRATEGY',
  'TECHNICAL_ANALYSIS',
  'PSYCHOLOGY',
  'EXECUTION',
];

export const ALL_STUDY_TYPES: StudyType[] = [
  'VIDEO',
  'BOOK',
  'ARTICLE',
  'CHART_STUDY',
  'NOTES',
  'COURSE',
  'OTHER',
];

export const ALL_SETUP_STATUSES: SetupStatus[] = [
  'DRAFT',
  'BACKTESTING',
  'PAPER_TRADING',
  'VALIDATED',
  'REJECTED',
];

export const ALL_TRADE_MISTAKES: TradeMistake[] = [
  'NONE',
  'FOMO',
  'EARLY_ENTRY',
  'LATE_ENTRY',
  'MOVED_SL',
  'MOVED_TP',
  'OVERTRADING',
  'REVENGE',
  'BROKE_RULES',
  'INCREASED_RISK',
  'EARLY_EXIT',
  'HESITATION',
  'OTHER',
];

// Severe emotional & discipline mistakes
export const SEVERE_TRADE_MISTAKES: TradeMistake[] = [
  'FOMO',
  'REVENGE',
  'OVERTRADING',
  'INCREASED_RISK',
  'MOVED_SL',
];

// Explicit deterministic threshold for repeated critical mistakes
export const CRITICAL_MISTAKE_COUNT_THRESHOLD = 2;

export interface ForexKpiSummary {
  // === STUDY & CURRICULUM ===
  totalStudySessions: number;
  totalStudyMinutes: number;
  totalStudyHoursFormatted: string;
  studySessionsThisWeek: number;
  studyMinutesThisWeek: number;
  sessionsByPhase: Record<CurriculumPhase, number>;
  minutesByPhase: Record<CurriculumPhase, number>;
  studyByStudyType: Record<StudyType, number>;

  // === STRATEGY & SETUP DEVELOPMENT ===
  totalSetups: number;
  setupsByStatus: Record<SetupStatus, number>;
  setupsDraft: number;
  setupsBacktesting: number;
  setupsPaperTrading: number;
  setupsValidated: number;
  setupsRejected: number;

  // === BACKTESTING RIGOR (Historical Sample Data) ===
  totalBacktestBatches: number;
  totalBacktestedTrades: number; // Sample size
  totalBacktestWins: number;
  totalBacktestLosses: number;
  totalBacktestBreakevens: number;
  weightedBacktestWinRate: number | null; // System-calculated from aggregate wins / sampleSize
  recordedBatchesWithExpectancy: number;
  averageRecordedExpectancyR: number | null; // Average of user-entered/recorded expectancy
  totalBacktestRuleViolations: number;
  backtestRuleAdherenceRate: number | null; // (sampleSize - violations) / sampleSize

  // === PAPER TRADING EXECUTION ===
  totalPaperTrades: number;
  tradesThisWeek: number;
  tradesWin: number;
  tradesLoss: number;
  tradesBreakeven: number;
  tradesOpen: number;
  paperWinRate: number | null; // System-calculated from closed trades
  averageRMultiple: number | null; // System-calculated from closed trades
  totalRRealized: number; // Sum of R-multiples of closed trades

  // === PROCESS ADHERENCE & DISCIPLINE (Primary KPIs) ===
  ruleAdheredCount: number;
  ruleViolatedCount: number;
  ruleAdherenceRate: number | null; // % of paper trades with ruleAdhered === true
  cleanTradeStreak: number; // Consecutive most-recent paper trades with ruleAdhered && mistakeTag === 'NONE'
  mistakesByTag: Record<TradeMistake, number>;
  totalMistakesRecorded: number;
  severeMistakeCount: number;
  fomoCount: number;
  revengeCount: number;
  topMistakes: Array<{ mistake: TradeMistake; count: number; percentage: number }>;

  // === TIME & FOCUS TRACKING ===
  focusTimeTodaySeconds: number;
  focusTimeThisWeekSeconds: number;
  focusTimeTotalSeconds: number;
  focusTimeStudySeconds: number;
  focusTimeBacktestingSeconds: number;
  focusTimePaperTradingSeconds: number;
  daysActiveThisWeek: number;
}

/**
 * Pure calculation function for Forex learning KPIs.
 * No side effects, fully testable with mock data.
 */
export function computeForexKpiSummary(
  studySessions: ForexStudySession[],
  setups: ForexSetup[],
  backtests: ForexBacktestBatch[],
  paperTrades: ForexPaperTrade[],
  focusSessions: FocusSession[],
  events: ActivityEvent[],
  nowDate: Date = new Date()
): ForexKpiSummary {
  const oneWeekAgo = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());

  // 1. Study & Curriculum
  const totalStudySessions = studySessions.length;
  let totalStudyMinutes = 0;
  let studySessionsThisWeek = 0;
  let studyMinutesThisWeek = 0;

  const sessionsByPhase = Object.fromEntries(
    ALL_CURRICULUM_PHASES.map((phase) => [phase, 0])
  ) as Record<CurriculumPhase, number>;

  const minutesByPhase = Object.fromEntries(
    ALL_CURRICULUM_PHASES.map((phase) => [phase, 0])
  ) as Record<CurriculumPhase, number>;

  const studyByStudyType = Object.fromEntries(
    ALL_STUDY_TYPES.map((type) => [type, 0])
  ) as Record<StudyType, number>;

  for (const session of studySessions) {
    totalStudyMinutes += session.durationMinutes || 0;
    if (session.curriculumPhase && sessionsByPhase[session.curriculumPhase] !== undefined) {
      sessionsByPhase[session.curriculumPhase] += 1;
      minutesByPhase[session.curriculumPhase] += session.durationMinutes || 0;
    }
    if (session.studyType && studyByStudyType[session.studyType] !== undefined) {
      studyByStudyType[session.studyType] += 1;
    }
    const sessionTime = new Date(session.studiedAt || session.createdAt || 0);
    if (sessionTime >= oneWeekAgo) {
      studySessionsThisWeek += 1;
      studyMinutesThisWeek += session.durationMinutes || 0;
    }
  }

  const studyHours = Math.floor(totalStudyMinutes / 60);
  const studyMinsRem = totalStudyMinutes % 60;
  const totalStudyHoursFormatted = `${studyHours}h ${studyMinsRem}m`;

  // 2. Setups & Strategies
  const totalSetups = setups.length;
  const setupsByStatus = Object.fromEntries(
    ALL_SETUP_STATUSES.map((status) => [status, 0])
  ) as Record<SetupStatus, number>;

  for (const setup of setups) {
    if (setup.status && setupsByStatus[setup.status] !== undefined) {
      setupsByStatus[setup.status] += 1;
    }
  }

  const setupsDraft = setupsByStatus.DRAFT;
  const setupsBacktesting = setupsByStatus.BACKTESTING;
  const setupsPaperTrading = setupsByStatus.PAPER_TRADING;
  const setupsValidated = setupsByStatus.VALIDATED;
  const setupsRejected = setupsByStatus.REJECTED;

  // 3. Backtesting (Historical Samples)
  const totalBacktestBatches = backtests.length;
  let totalBacktestedTrades = 0;
  let totalBacktestWins = 0;
  let totalBacktestLosses = 0;
  let totalBacktestBreakevens = 0;
  let totalBacktestRuleViolations = 0;
  let sumRecordedExpectancy = 0;
  let recordedBatchesWithExpectancy = 0;

  for (const batch of backtests) {
    const sample = batch.sampleSize || 0;
    totalBacktestedTrades += sample;
    totalBacktestWins += batch.wins || 0;
    totalBacktestLosses += batch.losses || 0;
    totalBacktestBreakevens += batch.breakevens || 0;
    totalBacktestRuleViolations += batch.ruleViolations || 0;

    const exp = batch.recordedExpectancyR ?? batch.expectancyR;
    if (exp !== undefined && exp !== null && !isNaN(exp)) {
      sumRecordedExpectancy += exp;
      recordedBatchesWithExpectancy += 1;
    }
  }

  const weightedBacktestWinRate =
    totalBacktestedTrades > 0
      ? safePct(totalBacktestWins, totalBacktestedTrades)
      : null;

  const averageRecordedExpectancyR =
    recordedBatchesWithExpectancy > 0
      ? Math.round((sumRecordedExpectancy / recordedBatchesWithExpectancy) * 100) / 100
      : null;

  const backtestRuleAdherenceRate =
    totalBacktestedTrades > 0
      ? safePct(
          Math.max(0, totalBacktestedTrades - totalBacktestRuleViolations),
          totalBacktestedTrades
        )
      : null;

  // 4. Paper Trading Execution
  const totalPaperTrades = paperTrades.length;
  let tradesThisWeek = 0;
  let tradesWin = 0;
  let tradesLoss = 0;
  let tradesBreakeven = 0;
  let tradesOpen = 0;
  let sumRMultiple = 0;
  let closedWithR = 0;

  // 5. Discipline & Mistake Tagging
  let ruleAdheredCount = 0;
  let ruleViolatedCount = 0;

  const mistakesByTag = Object.fromEntries(
    ALL_TRADE_MISTAKES.map((m) => [m, 0])
  ) as Record<TradeMistake, number>;

  // Sort paper trades descending by date for clean trade streak calculation
  const sortedPaperTrades = [...paperTrades].sort((a, b) =>
    (b.tradedAt || b.createdAt || '').localeCompare(a.tradedAt || a.createdAt || '')
  );

  for (const trade of sortedPaperTrades) {
    const tradeTime = new Date(trade.tradedAt || trade.createdAt || 0);
    if (tradeTime >= oneWeekAgo) {
      tradesThisWeek += 1;
    }

    if (trade.result === 'WIN') tradesWin += 1;
    else if (trade.result === 'LOSS') tradesLoss += 1;
    else if (trade.result === 'BREAKEVEN') tradesBreakeven += 1;
    else tradesOpen += 1;

    if (trade.rMultiple !== undefined && trade.rMultiple !== null && trade.result !== 'OPEN') {
      sumRMultiple += trade.rMultiple;
      closedWithR += 1;
    }

    if (trade.ruleAdhered) {
      ruleAdheredCount += 1;
    } else {
      ruleViolatedCount += 1;
    }

    if (trade.mistakeTag && mistakesByTag[trade.mistakeTag] !== undefined) {
      mistakesByTag[trade.mistakeTag] += 1;
    }
  }

  const closedTrades = tradesWin + tradesLoss + tradesBreakeven;
  const paperWinRate =
    tradesWin + tradesLoss > 0 ? safePct(tradesWin, tradesWin + tradesLoss) : null;
  const averageRMultiple =
    closedWithR > 0 ? Math.round((sumRMultiple / closedWithR) * 100) / 100 : null;
  const totalRRealized = Math.round(sumRMultiple * 100) / 100;

  const ruleAdherenceRate =
    totalPaperTrades > 0 ? safePct(ruleAdheredCount, totalPaperTrades) : null;

  // Clean trade streak: consecutive most recent trades where ruleAdhered === true and mistakeTag === 'NONE'
  let cleanTradeStreak = 0;
  for (const trade of sortedPaperTrades) {
    if (trade.ruleAdhered && trade.mistakeTag === 'NONE') {
      cleanTradeStreak += 1;
    } else {
      break;
    }
  }

  // Count non-NONE mistakes
  let totalMistakesRecorded = 0;
  let severeMistakeCount = 0;
  for (const [tag, count] of Object.entries(mistakesByTag)) {
    if (tag !== 'NONE') {
      totalMistakesRecorded += count;
      if (SEVERE_TRADE_MISTAKES.includes(tag as TradeMistake)) {
        severeMistakeCount += count;
      }
    }
  }

  const fomoCount = mistakesByTag.FOMO || 0;
  const revengeCount = mistakesByTag.REVENGE || 0;

  // Top mistakes breakdown
  const topMistakes = Object.entries(mistakesByTag)
    .filter(([tag]) => tag !== 'NONE')
    .map(([tag, count]) => ({
      mistake: tag as TradeMistake,
      count,
      percentage: totalMistakesRecorded > 0 ? safePct(count, totalMistakesRecorded) : 0,
    }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count);

  // 6. Time & Focus Tracking
  let focusTimeTodaySeconds = 0;
  let focusTimeThisWeekSeconds = 0;
  let focusTimeTotalSeconds = 0;
  let focusTimeStudySeconds = 0;
  let focusTimeBacktestingSeconds = 0;
  let focusTimePaperTradingSeconds = 0;
  const activeDayStrings = new Set<string>();

  for (const session of focusSessions) {
    if (session.pillarId !== 'forex') continue;
    const duration = session.durationSeconds || 0;
    focusTimeTotalSeconds += duration;

    const startedDate = new Date(session.startedAt);
    if (startedDate >= todayStart) {
      focusTimeTodaySeconds += duration;
    }
    if (startedDate >= oneWeekAgo) {
      focusTimeThisWeekSeconds += duration;
      activeDayStrings.add(startedDate.toISOString().slice(0, 10));
    }

    const cat = (session.category || '').toLowerCase();
    if (cat.includes('study')) focusTimeStudySeconds += duration;
    else if (cat.includes('backtest')) focusTimeBacktestingSeconds += duration;
    else if (cat.includes('paper')) focusTimePaperTradingSeconds += duration;
  }

  // Also include activity events for active days
  for (const event of events) {
    if (event.pillarId !== 'forex') continue;
    const eventTime = new Date(event.occurredAt || event.createdAt);
    if (eventTime >= oneWeekAgo) {
      activeDayStrings.add(eventTime.toISOString().slice(0, 10));
    }
  }

  const daysActiveThisWeek = activeDayStrings.size;

  return {
    totalStudySessions,
    totalStudyMinutes,
    totalStudyHoursFormatted,
    studySessionsThisWeek,
    studyMinutesThisWeek,
    sessionsByPhase,
    minutesByPhase,
    studyByStudyType,
    totalSetups,
    setupsByStatus,
    setupsDraft,
    setupsBacktesting,
    setupsPaperTrading,
    setupsValidated,
    setupsRejected,
    totalBacktestBatches,
    totalBacktestedTrades,
    totalBacktestWins,
    totalBacktestLosses,
    totalBacktestBreakevens,
    weightedBacktestWinRate,
    recordedBatchesWithExpectancy,
    averageRecordedExpectancyR,
    totalBacktestRuleViolations,
    backtestRuleAdherenceRate,
    totalPaperTrades,
    tradesThisWeek,
    tradesWin,
    tradesLoss,
    tradesBreakeven,
    tradesOpen,
    paperWinRate,
    averageRMultiple,
    totalRRealized,
    ruleAdheredCount,
    ruleViolatedCount,
    ruleAdherenceRate,
    cleanTradeStreak,
    mistakesByTag,
    totalMistakesRecorded,
    severeMistakeCount,
    fomoCount,
    revengeCount,
    topMistakes,
    focusTimeTodaySeconds,
    focusTimeThisWeekSeconds,
    focusTimeTotalSeconds,
    focusTimeStudySeconds,
    focusTimeBacktestingSeconds,
    focusTimePaperTradingSeconds,
    daysActiveThisWeek,
  };
}

/**
 * Loads all Forex records from IndexedDB and computes the complete ForexKpiSummary.
 */
export async function loadForexKpiSummary(): Promise<ForexKpiSummary> {
  const [studySessions, setups, backtests, paperTrades, focusSessions, events] =
    await Promise.all([
      dbGetAll<ForexStudySession>(STORES.FOREX_STUDY),
      dbGetAll<ForexSetup>(STORES.FOREX_SETUPS),
      dbGetAll<ForexBacktestBatch>(STORES.FOREX_BACKTESTS),
      dbGetAll<ForexPaperTrade>(STORES.FOREX_PAPER_TRADES),
      dbGetAll<FocusSession>(STORES.FOCUS_SESSIONS),
      dbGetAll<ActivityEvent>(STORES.EVENTS),
    ]);

  return computeForexKpiSummary(
    studySessions,
    setups,
    backtests,
    paperTrades,
    focusSessions,
    events
  );
}
