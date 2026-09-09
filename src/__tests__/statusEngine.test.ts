import { describe, it, expect } from 'vitest';
import { evaluateJobHuntStatus } from '../services/statusEngine';
import type { JobHuntKpiSummary } from '../services/jobHuntKpi';
import type { Goal } from '../types';

describe('Status Engine', () => {
  const emptyKpis: JobHuntKpiSummary = {
    totalOpportunities: 0,
    activeOpportunities: 0,
    archivedOpportunities: 0,
    stageCounts: {
      DISCOVERED: 0,
      APPLIED: 0,
      OUTREACH: 0,
      REPLIED: 0,
      SCREENING: 0,
      INTERVIEW: 0,
      ASSESSMENT: 0,
      FINAL_ROUND: 0,
      OFFER: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
      GHOSTED: 0,
    },
    stageDistribution: [],
    totalApplications: 0,
    applicationsToday: 0,
    applicationsThisWeek: 0,
    applicationsThisMonth: 0,
    customizationBreakdown: { quick: 0, tailored: 0, deep: 0 },
    totalOutreach: 0,
    outreachToday: 0,
    outreachThisWeek: 0,
    totalReplied: 0,
    repliedThisWeek: 0,
    responseRate: null,
    screeningsReached: 0,
    interviewsReached: 0,
    offersReceived: 0,
    totalInterviewRounds: 0,
    interviewConversionRate: null,
    offerConversionRate: null,
    replyToInterviewRate: null,
    interviewToOfferRate: null,
    applicationToOfferRate: null,
    focusTimeTodaySeconds: 0,
    focusTimeThisWeekSeconds: 0,
    focusTimeTotalSeconds: 0,
    focusTimeByCategory: {},
    weeklyApplicationVelocity: 0,
    weeklyOutreachVelocity: 0,
    daysActiveThisWeek: 0,
    totalAssets: 0,
    activeAssets: 0,
    inProgressAssets: 0,
  };

  it('evaluates completely uninitialized pillar as NEGLECTED', () => {
    const evaluation = evaluateJobHuntStatus(emptyKpis, []);
    expect(evaluation.verdict).toBe('NEGLECTED');
    expect(evaluation.score).toBeLessThanOrEqual(20);
  });

  it('evaluates secured offer as EXCEEDING with score 100', () => {
    const kpisWithOffer: JobHuntKpiSummary = {
      ...emptyKpis,
      totalOpportunities: 10,
      activeOpportunities: 5,
      totalApplications: 8,
      offersReceived: 1,
      weeklyApplicationVelocity: 3,
      daysActiveThisWeek: 3,
    };

    const evaluation = evaluateJobHuntStatus(kpisWithOffer, []);
    expect(evaluation.verdict).toBe('EXCEEDING');
    expect(evaluation.score).toBe(100);
    expect(evaluation.badges).toContain('Offer Secured');
  });

  it('evaluates high activity without goals as ON_TRACK', () => {
    const activeKpis: JobHuntKpiSummary = {
      ...emptyKpis,
      totalOpportunities: 12,
      activeOpportunities: 10,
      totalApplications: 12,
      weeklyApplicationVelocity: 6,
      weeklyOutreachVelocity: 10,
      daysActiveThisWeek: 5,
      focusTimeThisWeekSeconds: 7200, // 2 hours
      interviewsReached: 1,
    };

    const evaluation = evaluateJobHuntStatus(activeKpis, []);
    expect(evaluation.verdict).toBe('ON_TRACK');
    expect(evaluation.score).toBeGreaterThanOrEqual(75);
  });

  it('evaluates low velocity against ambitious goal as BEHIND or AT_RISK', () => {
    const moderateKpis: JobHuntKpiSummary = {
      ...emptyKpis,
      totalOpportunities: 3,
      activeOpportunities: 3,
      totalApplications: 2,
      weeklyApplicationVelocity: 2,
      weeklyOutreachVelocity: 2,
      daysActiveThisWeek: 2,
    };

    const goal: Goal = {
      id: 'g-1',
      pillarId: 'job_hunt',
      title: 'Weekly Applications',
      targetType: 'COUNT',
      targetValue: 10,
      currentComputedValue: 2, // 20%
      cadence: 'WEEKLY',
      weight: 90,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const evaluation = evaluateJobHuntStatus(moderateKpis, [goal]);
    expect(evaluation.verdict).toBe('BEHIND');
    expect(evaluation.score).toBeLessThan(50);
  });
});
