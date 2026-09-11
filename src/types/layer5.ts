// ============================================================================
// PERSONAL OS — Layer 5 Universal Types & Contracts
// Authoritative contracts for Cross-Pillar Intelligence, Alerts & Exceptions,
// and Data Quality & Integrity.
//
// Core Axiom:
//   "Code calculates facts deterministically; AI interprets later.
//    No duplicate sources of truth. No causal claims in observations."
// ============================================================================

import type { PillarSlug } from './core.ts';
import type { PeriodBounds } from './intelligence.ts';

// ============================================================================
// Evidence Reference Contract
// Pointer to authoritative underlying transactional records / facts.
// ============================================================================
export type EvidenceSourceType =
  | 'KPI'
  | 'GOAL'
  | 'FOCUS_SESSION'
  | 'ACTIVITY_EVENT'
  | 'ALERT'
  | 'DATA_QUALITY';

export interface EvidenceReference {
  sourceType: EvidenceSourceType;
  sourceId: string;
  metricKey?: string;
  value?: number | string | boolean | null;
  period?: PeriodBounds;
}

// ============================================================================
// Cross-Pillar Intelligence Contracts
// ============================================================================
export type CrossPillarFactType =
  | 'PRIORITY_TIME_MISMATCH'
  | 'TIME_CONCENTRATION'
  | 'TIME_NEGLECT'
  | 'TRADEOFF'
  | 'TIME_OUTCOME_DIVERGENCE'
  | 'GOAL_PRESSURE'
  | 'CROSS_PILLAR_CORRELATION';

export interface CrossPillarFact {
  id: string;
  type: CrossPillarFactType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  pillarIds: PillarSlug[];
  period: PeriodBounds;
  title: string;
  /**
   * Strictly observational language ("X coincided with Y", "X increased while Y remained flat").
   * Never contains causal assertions ("X caused Y").
   */
  description: string;
  evidence: EvidenceReference[];
  createdAt: string;
}

// ============================================================================
// Alerts & Exceptions Contracts
// ============================================================================
export type AlertType =
  | 'GOAL_REGRESSION'
  | 'GOAL_BEHIND'
  | 'TIME_MISMATCH'
  | 'KPI_ANOMALY'
  | 'BUSINESS_EXCEPTION'
  | 'DATA_QUALITY';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type AlertResolutionReason = 'CONDITION_CLEARED' | 'MANUAL_RESOLUTION';

export interface Alert {
  /**
   * Occurrence identity bound to logical fingerprint and period start/end.
   * Format: `alert:${fingerprint}:${periodStart}_${periodEnd}`
   */
  id: string;

  /**
   * Abstract failure mode fingerprint for deduplication and lifecycle matching.
   * Format: `${type}:${pillarIds}:${metricKey || goalId || 'general'}`
   */
  fingerprint: string;

  type: AlertType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  pillarIds: PillarSlug[];
  goalId?: string;
  metricKey?: string;
  period: PeriodBounds;
  title: string;
  description: string;
  message?: string;
  evidence: EvidenceReference[];
  evidenceIds?: string[];
  detectedAt: string;
  lastEvaluatedAt: string;
  firstDetectedAt?: string;
  occurrenceCount?: number;
  metadata?: Record<string, any>;
  status: AlertStatus;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolutionReason?: AlertResolutionReason;
}

// ============================================================================
// Data Quality & Integrity Contracts
// ============================================================================
export type DataQualityCategory =
  | 'COMPLETENESS'
  | 'VALIDITY'
  | 'CONSISTENCY'
  | 'DUPLICATION'
  | 'REFERENTIAL_INTEGRITY'
  | 'TEMPORAL_INTEGRITY';

export interface DataQualityIssue {
  id: string;
  category: DataQualityCategory;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  pillarId?: PillarSlug;
  entityRef?: {
    type: string;
    id: string;
  };
  title: string;
  description: string;
  evidence: EvidenceReference[];
}

export interface DataQualityReport {
  period: PeriodBounds;
  issues: DataQualityIssue[];
  checkedAt: string;
  summary: {
    totalIssues: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    byCategory: Record<DataQualityCategory, number>;
  };
}
