// ============================================================================
// PERSONAL OS — Layer 4: AI Intelligence & Gemini 3.7 Flash Types
//
// Core Axiom:
//   "Code calculates. AI judges and explains. AI does not redefine reality or goals."
// ============================================================================

import type { GoalStatus, PillarSlug } from './core.ts';
import type { TimePeriodType } from './intelligence.ts';
import type { CrossPillarFact, Alert, DataQualityReport } from './layer5.ts';

export const AI_MODEL = 'gemini-3.7-flash';

export type AIAnalysisMode =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'NORTH_STAR'
  | 'PILLAR'
  | 'GOAL'
  | 'BRUTAL'
  | 'USER_QUERY';

export type ThinkingLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export const THINKING_LEVEL_BUDGETS: Record<ThinkingLevel, number> = {
  LOW: 1024,
  MEDIUM: 2048,
  HIGH: 4096,
};

export interface AIThinkingConfig {
  thinkingLevel: ThinkingLevel;
  thinkingBudget: number;
}

export const AI_MODE_CONFIG: Record<AIAnalysisMode, AIThinkingConfig> = {
  DAILY: { thinkingLevel: 'LOW', thinkingBudget: THINKING_LEVEL_BUDGETS.LOW },
  WEEKLY: { thinkingLevel: 'MEDIUM', thinkingBudget: THINKING_LEVEL_BUDGETS.MEDIUM },
  MONTHLY: { thinkingLevel: 'HIGH', thinkingBudget: THINKING_LEVEL_BUDGETS.HIGH },
  NORTH_STAR: { thinkingLevel: 'HIGH', thinkingBudget: THINKING_LEVEL_BUDGETS.HIGH },
  PILLAR: { thinkingLevel: 'MEDIUM', thinkingBudget: THINKING_LEVEL_BUDGETS.MEDIUM },
  GOAL: { thinkingLevel: 'MEDIUM', thinkingBudget: THINKING_LEVEL_BUDGETS.MEDIUM },
  BRUTAL: { thinkingLevel: 'HIGH', thinkingBudget: THINKING_LEVEL_BUDGETS.HIGH },
  USER_QUERY: { thinkingLevel: 'MEDIUM', thinkingBudget: THINKING_LEVEL_BUDGETS.MEDIUM },
};

// --- Deterministic Evidence Catalog (Supplied to AI) ---
export interface AIEvidence {
  id: string; // e.g. "goal.agency_realized_cash.current", "time.job_hunt.minutes"
  category: 'GOAL' | 'TIME' | 'METRIC' | 'TREND' | 'ANOMALY' | 'EVENT' | 'EFFICIENCY' | 'FINANCIAL';
  label: string;
  source: string;
  value: string | number | boolean | null;
  period?: {
    start: string;
    end: string;
  };
}

// --- Canonical AI Context (Minimized, No Raw DB Dumps) ---
export interface AIContext {
  contextVersion: '4.0.0';
  generatedAt: string;
  period: {
    type: TimePeriodType;
    start: string;
    end: string;
    label: string;
  };
  pillarScope?: PillarSlug;
  goalScope?: string; // goalId
  northStar?: {
    title: string;
    target: number;
    current: number;
    gap: number;
    progressPercent: number;
    status: GoalStatus;
    breakdown: {
      agencyRealizedCash: number;
      voireCashReceived: number;
    };
  };
  goals: Array<{
    goalId: string;
    title: string;
    pillarId: PillarSlug | null;
    metricKey: string;
    cadence: string;
    target: number;
    current: number | null;
    gap: number | null;
    progressPercent: number | null;
    status: GoalStatus;
  }>;
  time: {
    summary: {
      totalHours: number;
      totalMinutes: number;
      sessionCount: number;
      deepWorkMinutes: number;
      deepWorkRatioPercent: number;
      priorityAlignedPercent: number;
      changePercent: number | null;
    };
    pillars: Array<{
      pillarId: PillarSlug;
      pillarName: string;
      hours: number;
      minutes: number;
      sharePercent: number;
      sessionCount: number;
      changePercent: number | null;
      topCategories: Record<string, number>;
    }>;
  };
  intelligence: {
    comparisons: Array<{
      metricKey: string;
      label: string;
      currentValue: number | null;
      previousValue: number | null;
      delta: number | null;
      changePercent: number | null;
      direction: string;
      isFavorable: boolean | null;
      statement: string;
    }>;
    trends: Array<{
      id: string;
      title: string;
      statement: string;
      direction: string;
      severity: string;
    }>;
    anomalies: Array<{
      id: string;
      title: string;
      description: string;
      severity: string;
      baseline: string;
      threshold: string;
    }>;
    pillarFacts: Array<{
      pillarId: PillarSlug;
      title: string;
      focusMinutes: number;
      activityCount: number;
      statusHeadline: string;
      operatingEfficiency?: {
        label: string;
        value: string;
      };
    }>;
  };
  pillars: Array<{
    pillarId: PillarSlug;
    name: string;
    status: string;
    keyMetrics: Record<string, unknown>;
  }>;
  evidenceCatalog: AIEvidence[];
  analysisMode: AIAnalysisMode;
  userQuery?: string;
  crossPillarFacts?: CrossPillarFact[];
  alerts?: Alert[];
  dataQuality?: DataQualityReport;
}

// --- Structured AI Analysis Output Contract ---
export type ObservationType = 'FACT' | 'INFERENCE' | 'UNCERTAINTY';

export interface AIObservation {
  id: string;
  type: ObservationType;
  category: 'TIME' | 'GOAL' | 'OUTCOME' | 'ALIGNMENT' | 'FINANCIAL';
  statement: string;
  evidenceRefs: string[]; // Validated against evidenceCatalog IDs
}

export interface AIPattern {
  id: string;
  title: string;
  description: string;
  pillarIds: PillarSlug[];
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
  evidenceRefs: string[];
}

export interface AIContradiction {
  id: string;
  statedIntent: string; // e.g. "Stated priority #1 is Job Hunt"
  observedReality: string; // e.g. "0 focus sessions and 0 applications logged"
  severity: 'CRITICAL' | 'WARNING' | 'NOTE';
  evidenceRefs: string[];
}

export interface AIRisk {
  id: string;
  title: string;
  description: string;
  pillarId?: PillarSlug;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  mitigationFact?: string;
}

export interface AIOpportunity {
  id: string;
  title: string;
  description: string;
  pillarId?: PillarSlug;
}

export interface AIPriority {
  id: string;
  rank: number;
  area: string;
  rationale: string;
  nature: 'OBSERVED' | 'INFERRED' | 'PRIORITY' | 'OPTIONAL_SUGGESTION';
}

export interface AIGoalAnalysis {
  goalId: string;
  goalTitle: string;
  status: GoalStatus;
  varianceExplanation: string; // Contributing factor and variance interpretation
  trajectory: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNKNOWN';
  evidenceRefs: string[];
}

export interface AIAnalysis {
  headline: string;
  summary: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  observations: AIObservation[];
  patterns: AIPattern[];
  contradictions: AIContradiction[];
  risks: AIRisk[];
  opportunities: AIOpportunity[];
  priorities: AIPriority[];
  goalAnalysis: AIGoalAnalysis[];
  evidenceCatalog?: AIEvidence[];
}

// --- Cache Identity Contract ---
export interface AIReviewIdentity {
  mode: AIAnalysisMode;
  periodStart: string;
  periodEnd: string;
  pillarId?: string;
  goalId?: string;
  userQueryHash?: string;
  contextHash: string;
}

// --- Request / Response Interfaces for Providers ---
export interface AIRequest {
  mode: AIAnalysisMode;
  context: AIContext;
  thinkingLevel?: ThinkingLevel;
  thinkingBudget?: number;
  userQuery?: string;
  pillarScope?: PillarSlug;
  goalScope?: string;
  forceRegenerate?: boolean;
}

export interface AIResponse {
  analysis: AIAnalysis;
  provider: string;
  model: string;
  mode: AIAnalysisMode;
  latencyMs: number;
  contextHash: string;
  userQueryHash?: string;
  createdAt: string;
}
