import { describe, it, expect } from 'vitest';
import { generateOfflineStrategicAudit, type JobHuntAiFacts } from '../services/aiContext';

describe('AI Context & Deterministic Strategic Audit', () => {
  const baseFacts: JobHuntAiFacts = {
    timestamp: '2026-09-05T00:00:00.000Z',
    pillar: 'job_hunt',
    status: {
      verdict: 'BEHIND',
      score: 35,
      headline: 'Low Velocity',
      reason: 'Trailing weekly pace',
    },
    funnel: {
      totalOpportunities: 3,
      activePipeline: 3,
      applied: 2,
      screeningsOrInterviews: 0,
      offers: 0,
      rejectedOrArchived: 0,
      interviewConversionRate: '0.0%',
      offerConversionRate: '0.0%',
    },
    velocity: {
      applicationsToday: 0,
      applicationsThisWeek: 2,
      outreachToday: 0,
      outreachThisWeek: 1,
      outreachResponseRate: '0.0%',
      daysActivePastWeek: 2,
    },
    focusTime: {
      todayFormatted: '0m 00s',
      thisWeekFormatted: '1h 30m',
      totalFormatted: '4h 00m',
      categoryBreakdown: { Applications: '1h 30m' },
    },
    activeGoals: [
      {
        title: 'Weekly Applications',
        cadence: 'WEEKLY',
        targetValue: 10,
        currentValue: 2,
        unit: 'apps',
        progressPercent: '20%',
      },
    ],
    recentOpportunities: [
      {
        company: 'Stripe',
        role: 'Staff Engineer',
        stage: 'APPLIED',
        workMode: 'REMOTE',
        discoveredAt: '2026-09-04T12:00:00.000Z',
      },
    ],
    recentOutreach: [],
  };

  it('generates pipeline volume warning when weekly apps and outreach are below threshold', () => {
    const report = generateOfflineStrategicAudit(baseFacts);
    expect(report).toContain('Pipeline Volume Warning');
    expect(report).toContain('2 applications and 1 outreaches');
    expect(report).toContain('Health Score: 35/100');
  });

  it('identifies conversion bottleneck when high application count yields 0 interviews', () => {
    const bottleneckFacts: JobHuntAiFacts = {
      ...baseFacts,
      funnel: {
        ...baseFacts.funnel,
        applied: 15,
        screeningsOrInterviews: 0,
      },
    };
    const report = generateOfflineStrategicAudit(bottleneckFacts);
    expect(report).toContain('Conversion Bottleneck');
    expect(report).toContain('15 applications but have 0 screenings or interviews');
  });

  it('identifies interview preparation priority when interviews are active', () => {
    const interviewFacts: JobHuntAiFacts = {
      ...baseFacts,
      funnel: {
        ...baseFacts.funnel,
        screeningsOrInterviews: 2,
        offers: 0,
      },
    };
    const report = generateOfflineStrategicAudit(interviewFacts);
    expect(report).toContain('Interview Preparation');
    expect(report).toContain('converted 2 opportunities into interviews');
  });

  it('strictly reflects active goals in alignment section without inventing goals', () => {
    const report = generateOfflineStrategicAudit(baseFacts);
    expect(report).toContain('**Weekly Applications** (WEEKLY): 2 / 10 apps (20%)');
  });
});
