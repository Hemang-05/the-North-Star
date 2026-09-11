// ============================================================================
// PERSONAL OS — OS Layer 3: Time & Intelligence Types
// Authoritative definitions for Time Allocation, Deterministic Comparison,
// Trend Movements, Anomalies, and Intelligence Snapshots.
//
// Core Axiom:
//   "Time is evidence. Outcomes are evidence. Intelligence is derived from both.
//    Code calculates facts deterministically; AI interprets later."
// ============================================================================

import type { PillarSlug, KpiValueState, GoalKpiSnapshot } from './core.ts';

export type TimePeriodType =
  | 'TODAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'THIS_QUARTER'
  | 'THIS_YEAR'
  | 'CUSTOM';

export interface PeriodBounds {
  start: string; // ISO 8601 local start
  end: string;   // ISO 8601 local end
  type: TimePeriodType;
  label: string;
}

export interface PillarTimeDetail {
  pillarId: PillarSlug;
  title: string;
  color: string;
  priorityRank: number; // 1 = highest
  minutes: number;
  hours: number;
  sharePercent: number; // 0 to 100% of total focus time
  sessionCount: number;
  averageSessionMinutes: number;
  longestSessionMinutes: number;
  byCategory: Record<string, number>; // category -> minutes
  previousPeriodMinutes?: number;
  changePercent?: number | null; // null if previous was 0 or NO_DATA
}

export interface TimeSummary {
  totalMinutes: number;
  totalHours: number;
  byPillar: Record<PillarSlug, number>; // minutes per pillar
  pillarDetails: PillarTimeDetail[];
  byCategory: Record<string, number>;
  sessionCount: number;
  averageSessionMinutes: number;
  longestSessionMinutes: number;
  deepWorkMinutes: number; // sessions >= 25 minutes
  deepWorkSessionCount: number;
  deepWorkRatioPercent: number; // deep work as % of total focus
  priorityAlignedMinutes: number; // Focus in Top 3 priority pillars: Job Hunt, Agency, Trading OS
  priorityAlignedPercent: number;
  period: PeriodBounds;
  previousPeriod?: {
    totalMinutes: number;
    byPillar: Record<PillarSlug, number>;
  };
  changePercent?: number | null;
}

export interface ComparisonFact {
  metricKey: string;
  label: string;
  current: number | null;
  previous: number | null;
  state: KpiValueState;
  unit: string;
  absoluteChange: number | null;
  percentageChange: number | null;
  direction: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'NO_CHANGE_POSSIBLE';
  favorable?: boolean | null; // evaluated against MetricDirection if available
  statement: string; // e.g. "Applications increased 25% from 4 to 5"
}

export interface TrendFact {
  id: string;
  pillarId?: PillarSlug | null;
  metricKey?: string;
  title: string;
  description: string;
  percentageChange: number | null;
  direction: 'UP' | 'DOWN' | 'STABLE';
  favorable?: boolean | null;
}

export type AnomalySeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AnomalyType =
  | 'TIME_DROP'
  | 'TIME_SPIKE'
  | 'KPI_DROP'
  | 'KPI_SURGE'
  | 'ZERO_ACTIVITY'
  | 'STATUS_REGRESSION';

export interface AnomalyFact {
  id: string;
  pillarId?: PillarSlug | null;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  baseline: string;
  threshold: string;
}

export interface PillarIntelligenceFact {
  pillarId: PillarSlug;
  title: string;
  priorityRank: number;
  color: string;
  focusMinutes: number;
  focusHours: number;
  focusSharePercent: number;
  sessionCount: number;
  activityCount: number;
  goals: GoalKpiSnapshot[];
  kpis: Array<{
    metricKey: string;
    name: string;
    value: number | null;
    state: KpiValueState;
    unit: string;
  }>;
  efficiency?: {
    label: string;
    value: number | null;
    unit: string;
    explanation: string;
  };
  previousPeriod?: {
    focusMinutes: number;
    activityCount: number;
  };
  changes: ComparisonFact[];
}

export interface IntelligenceSnapshot {
  generatedAt: string;
  period: PeriodBounds;
  previousPeriod: PeriodBounds;
  time: TimeSummary;
  goals: GoalKpiSnapshot[];
  pillars: PillarIntelligenceFact[];
  trends: TrendFact[];
  anomalies: AnomalyFact[];
  goalStats: {
    total: number;
    ahead: number;
    onTrack: number;
    behind: number;
    achieved: number;
    notStarted: number;
    noData: number;
  };
  biggestMovements: {
    positive: TrendFact | null;
    negative: TrendFact | null;
  };
}
