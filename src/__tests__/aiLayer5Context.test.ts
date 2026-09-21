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
      type: 'PRIORITY_TIME_MISMATCH',
      severity: 'CRITICAL',
      pillarIds: ['job_hunt', 'trading_os'],
      period: {
        type: 'WEEKLY',
        start: '2026-03-01T00:00:00.000Z',
        end: '2026-03-07T23:59:59.999Z',
        label: 'This Week',
      },
      title: 'Priority Mismatch',
      description: 'Pillar job_hunt (priority #1) received 1.0h, while lower-priority pillar trading_os received 15.0h.',
      evidence: [
        {
          sourceType: 'ACTIVITY_EVENT',
          sourceId: 'act-1',
          metricKey: 'focus_hours',
          value: 1.0,
        },
      ],
      createdAt: '2026-03-07T12:00:00.000Z',
    };

    const mockAlert: Alert = {
      id: 'alert:GOAL_REGRESSION:agency:goal-agency-rev:2026-03-01_2026-03-07',
      fingerprint: 'GOAL_REGRESSION:agency:goal-agency-rev',
      type: 'GOAL_REGRESSION',
      severity: 'CRITICAL',
      status: 'OPEN',
      title: 'Goal Regressed: Agency Revenue',
      description: 'Status changed from ON_TRACK to BEHIND',
      message: 'Status changed from ON_TRACK to BEHIND',
      evidenceIds: ['snapshot:snap-curr-1'],
      evidence: [
        {
          sourceType: 'GOAL',
          sourceId: 'goal-agency-rev',
          value: 'BEHIND',
        },
      ],
      pillarIds: ['agency'],
      period: {
        type: 'WEEKLY',
        start: '2026-03-01T00:00:00.000Z',
        end: '2026-03-07T23:59:59.999Z',
        label: 'This Week',
      },
      detectedAt: '2026-03-07T10:00:00.000Z',
      lastEvaluatedAt: '2026-03-07T10:00:00.000Z',
      firstDetectedAt: '2026-03-07T10:00:00.000Z',
      occurrenceCount: 1,
    };

    const mockDataQuality: DataQualityReport = {
      checkedAt: '2026-03-07T12:00:00.000Z',
      period: {
        type: 'WEEKLY',
        start: '2026-03-01T00:00:00.000Z',
        end: '2026-03-07T23:59:59.999Z',
        label: 'This Week',
      },
      summary: {
        totalIssues: 1,
        criticalCount: 0,
        warningCount: 1,
        infoCount: 0,
        byCategory: {
          COMPLETENESS: 0,
          VALIDITY: 1,
          CONSISTENCY: 0,
          DUPLICATION: 0,
          REFERENTIAL_INTEGRITY: 0,
          TEMPORAL_INTEGRITY: 0,
        },
      },
      issues: [
        {
          id: 'dq-susp-1',
          category: 'VALIDITY',
          severity: 'WARNING',
          pillarId: 'agency',
          title: 'Zero value suspicion',
          description: 'Active client has retainer of 0',
          evidence: [
            {
              sourceType: 'DATA_QUALITY',
              sourceId: 'client-1',
              metricKey: 'monthlyRetainer',
              value: 0,
            },
          ],
        },
      ],
    };

    const context: AIContext = {
      contextVersion: '4.0.0',
      generatedAt: '2026-03-07T12:00:00.000Z',
      period: {
        type: 'WEEKLY',
        start: '2026-03-01T00:00:00.000Z',
        end: '2026-03-07T23:59:59.999Z',
        label: 'This Week',
      },
      northStar: {
        title: 'Runway & Cash Goal',
        target: 10000,
        current: 5000,
        gap: 5000,
        progressPercent: 50,
        status: 'BEHIND',
        breakdown: {
          agencyRealizedCash: 3000,
          voireCashReceived: 2000,
        },
      },
      goals: [],
      time: {
        summary: {
          totalHours: 20,
          totalMinutes: 1200,
          sessionCount: 15,
          deepWorkMinutes: 800,
          deepWorkRatioPercent: 67,
          priorityAlignedPercent: 75,
          changePercent: null,
        },
        pillars: [],
      },
      intelligence: {
        comparisons: [],
        trends: [],
        anomalies: [],
        pillarFacts: [],
      },
      crossPillarFacts: [mockFact],
      alerts: [mockAlert],
      dataQuality: {
        report: mockDataQuality,
        summary: mockDataQuality.summary,
        issues: mockDataQuality.issues,
      },
      evidenceCatalog: [
        {
          id: 'crosspillar:fact-priority-1',
          category: 'EFFICIENCY',
          label: 'Priority Mismatch: job_hunt vs trading_os',
          source: 'activity_event',
          value: 'job_hunt: 1.0h, trading_os: 15.0h',
        },
        {
          id: 'alert:alert:GOAL_REGRESSION:agency:goal-agency-rev:2026-03-01_2026-03-07',
          category: 'GOAL',
          label: 'Alert: Goal Regressed: Agency Revenue',
          source: 'goal',
          value: 'CRITICAL: Status changed from ON_TRACK to BEHIND',
        },
        {
          id: 'quality:dq-susp-1',
          category: 'METRIC',
          label: 'Data Quality Warning: AgencyClient/monthlyRetainer',
          source: 'activity_event',
          value: 'Active client has retainer of 0',
        },
      ],
    };

    const userPrompt = buildAIUserPrompt(context);

    // Assert that Layer 5 facts and alerts appear in structured facts
    expect(userPrompt).toContain('crossPillarFacts');
    expect(userPrompt).toContain('PRIORITY_TIME_MISMATCH');
    expect(userPrompt).toContain('alerts');
    expect(userPrompt).toContain('GOAL_REGRESSION');
    expect(userPrompt).toContain('dataQuality');

    // Assert that Layer 5 evidence items appear in evidence catalog
    expect(userPrompt).toContain('crosspillar:fact-priority-1');
    expect(userPrompt).toContain('alert:alert:GOAL_REGRESSION');
    expect(userPrompt).toContain('quality:dq-susp-1');

    // Ensure raw db contents are absent
    expect(userPrompt).not.toContain('STORES');
    expect(userPrompt).not.toContain('IndexedDB');
  });
});
