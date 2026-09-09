import { describe, it, expect } from 'vitest';
import { computeGoalCurrentValue } from '../components/job-hunt/JobHuntGoals';
import type { JobHuntKpiSummary } from '../services/jobHuntKpi';
import type { Goal } from '../types';

describe('Job Hunt Goal Computation Engine', () => {
  const mockKpis: JobHuntKpiSummary = {
    totalOpportunities: 10,
    activeOpportunities: 8,
    archivedOpportunities: 2,
    stageCounts: {
      DISCOVERED: 2,
      APPLIED: 3,
      OUTREACH: 1,
      REPLIED: 1,
      SCREENING: 1,
      INTERVIEW: 1,
      ASSESSMENT: 0,
      FINAL_ROUND: 0,
      OFFER: 1,
      REJECTED: 1,
      WITHDRAWN: 0,
      GHOSTED: 0,
    },
    stageDistribution: [],
    totalApplications: 6,
    applicationsToday: 2,
    applicationsThisWeek: 5,
    applicationsThisMonth: 6,
    customizationBreakdown: { quick: 2, tailored: 3, deep: 1 },
    totalOutreach: 8,
    outreachToday: 3,
    outreachThisWeek: 7,
    totalReplied: 4,
    repliedThisWeek: 3,
    responseRate: 50,
    screeningsReached: 1,
    interviewsReached: 3, // screening + interview + offer
    offersReceived: 1,
    interviewConversionRate: 50,
    offerConversionRate: 16.7,
    focusTimeTodaySeconds: 3600,
    focusTimeThisWeekSeconds: 18000, // 5 hours
    focusTimeTotalSeconds: 36000,
    focusTimeByCategory: {},
    weeklyApplicationVelocity: 5,
    weeklyOutreachVelocity: 7,
    daysActiveThisWeek: 4,
    totalAssets: 3,
    activeAssets: 2,
    inProgressAssets: 1,
  };

  const createGoal = (title: string, cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY', unit?: string): Goal => ({
    id: 'g-test',
    pillarId: 'job_hunt',
    title,
    cadence,
    targetType: 'COUNT',
    targetValue: 10,
    currentComputedValue: 0,
    unit,
    weight: 80,
    isActive: true,
    createdAt: new Date().toISOString(),
  });

  it('maps Weekly Applications goal to applicationsThisWeek', () => {
    const goal = createGoal('Weekly Applications', 'WEEKLY', 'apps');
    expect(computeGoalCurrentValue(goal, mockKpis)).toBe(5);
  });

  it('maps Daily Applications goal to applicationsToday', () => {
    const goal = createGoal('Daily Applications Target', 'DAILY', 'apps');
    expect(computeGoalCurrentValue(goal, mockKpis)).toBe(2);
  });

  it('maps Weekly Outreach goal to outreachThisWeek', () => {
    const goal = createGoal('Weekly Outbound Outreach', 'WEEKLY', 'messages');
    expect(computeGoalCurrentValue(goal, mockKpis)).toBe(7);
  });

  it('maps Interviews goal to interviewsReached', () => {
    const goal = createGoal('Interviews Reached', 'MONTHLY', 'interviews');
    expect(computeGoalCurrentValue(goal, mockKpis)).toBe(3);
  });

  it('maps Focus Hours goal to focusTimeThisWeek / 3600', () => {
    const goal = createGoal('Weekly Focus Hours', 'WEEKLY', 'hours');
    expect(computeGoalCurrentValue(goal, mockKpis)).toBe(5); // 18000s / 3600 = 5h
  });
});
