import { describe, it, expect } from 'vitest';
import { buildAISystemPrompt, buildAIUserPrompt } from '../services/ai/aiPrompts.js';
import type { AIContext } from '../types/ai.js';
import type { CrossPillarFact, Alert, DataQualityReport } from '../types/layer5.js';

describe('AI Layer 5 Context & Prompt Integration', () => {
  it('enforces Layer 5 prompt directives and taxonomy in system prompt', () => {
    const prompt = buildAISystemPrompt('WEEKLY');

    // Taxonomy checks
    expect(prompt).toContain('"FACT": Directly stated by deterministic OS numbers');
    expect(prompt).toContain('"INFERENCE": Interpretation or hypothesis');
    expect(prompt).toContain('"UNCERTAINTY": Ambiguities where data is insufficient');

    // Classification of priorities
    expect(prompt).toContain('"OBSERVED": directly supported by deterministic facts');
    expect(prompt).toContain('"INFERRED": reasonable analytical deductions');
    expect(prompt).toContain('"SUGGESTED": optional considerations');

    // Non-causality directive
    expect(prompt).toContain('NEVER invent causal claims for observed outcomes');
    expect(prompt).toContain('coincided with');

    // Alert directive
    expect(prompt).toContain('ALERTS & EXCEPTIONS: Deterministic alerts indicate verified deviations');
  });

  it('serializes Layer 5 structured facts and alerts into canonical AI user prompt', () => {
    const mockFact: CrossPillarFact = {
      id: 'fact-priority-1',
      type: 'PRIORITY_MISMATCH',
      severity: 'HIGH',
      primaryPillars: ['job_hunt'],
      secondaryPillars: ['trading_os'],
      statement: 'Pillar job_hunt (priority #1) received 1.0h, while lower-priority pillar trading_os received 15.0h.',
      evidence: [
        {
          source: 'activity_event',
          entityId: 'act-1',
          pillarId: 'job_hunt',
          description: 'Job hunt focus',
        },
      ],
      observationPeriod: {
        start: '2026-03-01T00:00:00.000Z',
        end: '2026-03-07T23:59:59.999Z',
      },
      generatedAt: '2026-03-07T12:00:00.000Z',
    };

    const mockAlert: Alert = {
      id: 'alert:GOAL_REGRESSION:saas_agency:goal-agency-rev:2026-03-01_2026-03-07',
      fingerprint: 'GOAL_REGRESSION:saas_agency:goal-agency-rev',
      type: 'GOAL_REGRESSION',
      severity: 'CRITICAL',
      status: 'OPEN',
      title: 'Goal Regressed: Agency Revenue',
      message: 'Status changed from ON_TRACK to BEHIND',
      evidenceIds: ['snapshot:snap-curr-1'],
      pillarIds: ['saas_agency'],
      period: {
        start: '2026-03-01T00:00:00.000Z',
        end: '2026-03-07T23:59:59.999Z',
      },
      firstDetectedAt: '2026-03-07T10:00:00.000Z',
      lastDetectedAt: '2026-03-07T10:00:00.000Z',
      occurrenceCount: 1,
    };

    const mockDataQuality: DataQualityReport = {
      totalChecked: 25,
      issuesBySeverity: { CRITICAL: 0, WARNING: 1, INFO: 0 },
      issuesByType: {
        INVALID_TIMESTAMP: 0,
        ORPHANED_RELATION: 0,
        NEGATIVE_AMOUNT: 0,
        ZERO_VALUE_SUSPICION: 1,
        DUPLICATE_ACTIVITY: 0,
        FINANCIAL_INVARIANT_VIOLATION: 0,
        CHRONOLOGY_VIOLATION: 0,
      },
      issues: [
        {
          id: 'dq-susp-1',
          severity: 'WARNING',
          type: 'ZERO_VALUE_SUSPICION',
          entityType: 'AgencyClient',
          entityId: 'client-1',
          pillarId: 'saas_agency',
          field: 'monthlyRetainer',
          message: 'Active client has retainer of 0',
          evidence: { monthlyRetainer: 0 },
          detectedAt: '2026-03-07T12:00:00.000Z',
        },
      ],
      runAt: '2026-03-07T12:00:00.000Z',
    };

    const context: AIContext = {
      contextVersion: '1.0.0',
      generatedAt: '2026-03-07T12:00:00.000Z',
      period: {
        start: '2026-03-01T00:00:00.000Z',
        end: '2026-03-07T23:59:59.999Z',
        label: 'This Week',
      },
      analysisMode: 'WEEKLY',
      northStar: {
        currentCash: 5000,
        targetCash: 10000,
        agencyRealizedCash: 3000,
        voireCashReceived: 2000,
        status: 'BEHIND',
        currency: 'USD',
      },
      goals: [],
      time: {
        totalFocusMinutes: 1200,
        totalDeepWorkMinutes: 800,
        deepWorkRatio: 0.67,
        distributionByPillar: {
          job_hunt: 60,
          saas_agency: 300,
          trading_os: 500,
          youtube: 100,
          voire: 140,
          fitness: 100,
        },
      },
      intelligence: {
        overallVerdict: 'STABLE',
        pillarVerdicts: {
          job_hunt: 'AT_RISK',
          saas_agency: 'ON_TRACK',
          trading_os: 'AHEAD',
          youtube: 'ON_TRACK',
          voire: 'ON_TRACK',
          fitness: 'ON_TRACK',
        },
        activeAnomalies: [],
      },
      pillars: {} as any,
      crossPillarFacts: [mockFact],
      alerts: [mockAlert],
      dataQuality: {
        report: mockDataQuality,
        summary: '25 checked, 1 issues (0 critical)',
        issues: mockDataQuality.issues,
      },
      evidenceCatalog: [
        {
          id: 'crosspillar:fact-priority-1',
          label: 'Priority Mismatch: job_hunt vs trading_os',
          source: 'activity_event',
          value: 'job_hunt: 1.0h, trading_os: 15.0h',
        },
        {
          id: 'alert:alert:GOAL_REGRESSION:saas_agency:goal-agency-rev:2026-03-01_2026-03-07',
          label: 'Alert: Goal Regressed: Agency Revenue',
          source: 'goal',
          value: 'CRITICAL: Status changed from ON_TRACK to BEHIND',
        },
        {
          id: 'quality:dq-susp-1',
          label: 'Data Quality Warning: AgencyClient/monthlyRetainer',
          source: 'activity_event',
          value: 'Active client has retainer of 0',
        },
      ],
    };

    const userPrompt = buildAIUserPrompt(context);

    // Assert that Layer 5 facts and alerts appear in structured facts
    expect(userPrompt).toContain('crossPillarFacts');
    expect(userPrompt).toContain('PRIORITY_MISMATCH');
    expect(userPrompt).toContain('alerts');
    expect(userPrompt).toContain('GOAL_REGRESSION');
    expect(userPrompt).toContain('dataQuality');
    expect(userPrompt).toContain('25 checked, 1 issues');

    // Assert that Layer 5 evidence items appear in evidence catalog
    expect(userPrompt).toContain('crosspillar:fact-priority-1');
    expect(userPrompt).toContain('alert:alert:GOAL_REGRESSION');
    expect(userPrompt).toContain('quality:dq-susp-1');

    // Ensure raw db contents are absent
    expect(userPrompt).not.toContain('STORES');
    expect(userPrompt).not.toContain('IndexedDB');
  });
});
