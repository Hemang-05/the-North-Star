import { describe, it, expect } from 'vitest';
import {
  getCurrentKpiValue,
  calculateProgress,
  calculateGap,
  calculateGoalStatus,
  getCadencePeriod,
  evaluateGoalSnapshot,
  type KpisEvaluationContext,
} from '../services/kpiEvaluation';
import type { Goal } from '../types';

describe('Canonical KPI Evaluation Engine', () => {
  const mockContext: KpisEvaluationContext = {
    jobHunt: {
      totalOpportunities: 10,
      activeOpportunities: 8,
      archivedOpportunities: 2,
      stageCounts: {} as any,
      stageDistribution: [],
      totalApplications: 25,
      applicationsToday: 2,
      applicationsThisWeek: 7,
      applicationsThisMonth: 15,
      customizationBreakdown: { quick: 1, tailored: 5, deep: 1 },
      totalOutreach: 20,
      outreachToday: 3,
      outreachThisWeek: 10,
      totalReplied: 5,
      repliedThisWeek: 3,
      responseRate: 30,
      screeningsReached: 2,
      interviewsReached: 4,
      offersReceived: 1,
      totalInterviewRounds: 6,
      interviewConversionRate: 16,
      offerConversionRate: 25,
      focusTimeTodaySeconds: 3600,
      focusTimeThisWeekSeconds: 18000, // 5 hours
      focusTimeTotalSeconds: 36000,
      focusTimeByCategory: {},
      weeklyApplicationVelocity: 7,
      weeklyOutreachVelocity: 10,
      daysActiveThisWeek: 4,
      totalAssets: 3,
      activeAssets: 3,
      inProgressAssets: 0,
    },
    agency: {
      realizedCash: 240000,
      billedRevenue: 350000,
      accountsReceivable: 110000,
      totalPipelineValue: 500000,
      currency: 'INR',
      totalLeads: 20,
      activeLeads: 8,
      qualifiedLeads: 5,
      proposalLeads: 3,
      wonLeads: 2,
      lostLeads: 1,
      leadToQualifiedRate: 25,
      qualifiedToProposalRate: 60,
      proposalToWonRate: 66,
      overallLeadToWonRate: 10,
      leadsThisWeek: 3,
      leadsToday: 1,
      proposalsThisWeek: 2,
      totalClients: 5,
      activeClients: 3,
      totalProjects: 6,
      activeProjects: 3,
      completedProjects: 3,
      totalDeliveryHours: 120,
      totalInvoices: 8,
      draftInvoices: 1,
      sentInvoices: 2,
      overdueInvoices: 1,
      paidInvoices: 4,
      focusTimeTodaySeconds: 7200,
      focusTimeThisWeekSeconds: 36000,
      focusTimeTotalSeconds: 144000,
      focusTimeByCategory: {},
      effectiveHourlyRate: 2000,
      daysActiveThisWeek: 5,
      maturity: {} as any,
    },
    saas: {
      totalFeatures: 12,
      featuresByStatus: {} as any,
      featuresIdea: 2,
      featuresPlanned: 2,
      featuresInProgress: 2,
      featuresTesting: 1,
      featuresDone: 5,
      featuresBlocked: 0,
      featureCompletionRate: 41.7,
      totalTestRuns: 10,
      passTestRuns: 8,
      failTestRuns: 2,
      testPassRate: 80,
      criticalBugsOpen: 0,
      totalReleases: 3,
      releasesThisMonth: 1,
      latestRelease: null,
      developmentFocusSeconds: 20000,
      testingFocusSeconds: 5000,
      totalDistributionActivities: 15,
      distributionByChannel: {} as any,
      distributionByActivityType: {} as any,
      distributionThisWeek: 4,
      distributionThisMonth: 12,
      distributionFocusSeconds: 10000,
      latestSnapshot: null,
      totalUsers: 150,
      activeUsers: 80,
      newUsers: 25,
      payingUsers: 18,
      churnedUsers: 2,
      revenue: 18000,
      recurringRevenue: 18000, // MRR
      payingConversionRate: 12,
      activationRate: 53.3,
      retentionRate: 98,
      totalFeedback: 10,
      openFeedback: 3,
      resolvedFeedback: 7,
      criticalOrHighFeedback: 0,
      feedbackByType: {} as any,
      buildEffortScore: 50,
      distributionEffortScore: 50,
      buildRatioPercent: 50,
      distributionRatioPercent: 50,
      balanceLabel: 'Balanced',
      focusTimeTodaySeconds: 3600,
      focusTimeThisWeekSeconds: 18000,
      focusTimeTotalSeconds: 50000,
      focusTimeByCategory: {},
      daysActiveThisWeek: 4,
    },
    forex: {
      totalStudyMinutes: 600, // 10h
      totalStudyHoursFormatted: '10h 0m',
      studySessionsThisWeek: 3,
      studyHoursMonth: 10,
      totalSetups: 3,
      setupsValidated: 2,
      validatedSetups: 2,
      setupsDraft: 1,
      totalBacktestedTrades: 50,
      backtestWinRate: 58,
      totalPaperTrades: 20,
      paperTradeWinRate: 60,
      paperTradesThisWeek: 5,
      cleanTradeStreak: 8,
      ruleAdherenceRate: 90,
      totalMistakesRecorded: 2,
      severeMistakeCount: 0,
      fomoCount: 1,
      revengeCount: 0,
      topMistakes: [],
      focusTimeTodaySeconds: 3600,
      focusTimeThisWeekSeconds: 14400,
      focusTimeTotalSeconds: 36000,
      focusTimeStudySeconds: 18000,
      focusTimeBacktestingSeconds: 10000,
      focusTimePaperTradingSeconds: 8000,
      daysActiveThisWeek: 4,
    },
    fitness: {
      workoutsCount: 12,
      workoutsThisWeek: 4,
      footballSessionsCount: 2,
      footballSessionsThisWeek: 1,
      totalDistanceKm: 42,
      distanceThisWeekKm: 12,
      fiveKmRunsThisWeek: 2,
      avgPaceFormatted: '5:30/km',
      totalActiveMinutes: 600,
      totalGymMinutes: 300,
      totalFootballMinutes: 120,
      totalRunMinutes: 120,
      totalMobilityMinutes: 60,
      todayCalories: 2200,
      todayProtein: 145,
      avgDailyCaloriesWeek: 2150,
      avgDailyProteinWeek: 140,
      daysWithMealsLogged: 5,
      supplementAdherencePercent: 85,
      supplementsTakenCount: 12,
      latestWeightKg: 74.5,
      startingWeightKg: 78.0,
      weightDeltaKg: -3.5,
      avgSleepHoursWeek: 7.5,
      avgSleepScoreWeek: 82,
      latestSleepDeficitMins: 0,
      sleepDeficitFlag: false,
      chessSudokuMinutesWeek: 60,
      benchPressMaxPerSideKg: 27.5,
      fitnessAdherenceScore: 85,
      adherenceScoreBreakdown: {} as any,
    },
    voire: {
      totalDesigns: 8,
      readyOrSampledDesigns: 6,
      studioConcepts: 8,
      weekendOutputLast14Days: 3,
      weekendCreativeSessionsCount: 2,
      weekendCreativeMinutes: 180,
      activeProducts: 4,
      totalProducts: 4,
      liveProducts: 4,
      activeDrops: 1,
      totalDrops: 2,
      liveDrops: 1,
      completedDrops: 1,
      totalOrders: 30,
      paidOrdersCount: 28,
      pendingOrdersCount: 2,
      ordersThisWeek: 6,
      totalUnitsSold: 35,
      grossSales: 120000,
      discounts: 5000,
      refunds: 2000,
      refundCount: 1,
      netSales: 113000,
      cogsProduction: 45000,
      cogsShipping: 8000,
      totalCogs: 53000,
      marketingSpend: 20000,
      otherExpenses: 5000,
      contributionProfit: 35000,
      contributionMarginPercent: 30.9,
      cashReceived: 110000,
      accountsReceivablePending: 5000,
      aov: 4035,
      roas: 5.65,
      cac: 714,
      campaignsCount: 2,
      totalImpressions: 50000,
      totalClicks: 2500,
      totalConversions: 28,
      overallCtr: 5.0,
      overallCvr: 1.12,
      isWeekend: false,
      creativePauseExcused: true,
    },
  };

  it('maps all 6 pillar KPI metrics deterministically', async () => {
    // Job hunt
    const jobRes = await getCurrentKpiValue('job_hunt.applicationsThisWeek', 'WEEKLY', mockContext);
    expect(jobRes.state).toBe('AVAILABLE');
    expect(jobRes.value).toBe(7);

    // Agency
    const agencyRes = await getCurrentKpiValue('agency.realizedCash', 'MONTHLY', mockContext);
    expect(agencyRes.state).toBe('AVAILABLE');
    expect(agencyRes.value).toBe(240000);

    // SaaS
    const saasRes = await getCurrentKpiValue('saas.mrr', 'MONTHLY', mockContext);
    expect(saasRes.state).toBe('AVAILABLE');
    expect(saasRes.value).toBe(18000);

    // Forex
    const forexRes = await getCurrentKpiValue('forex.ruleAdherenceRate', 'MONTHLY', mockContext);
    expect(forexRes.state).toBe('AVAILABLE');
    expect(forexRes.value).toBe(90);

    // Fitness
    const fitRes = await getCurrentKpiValue('fitness.benchPressMaxPerSideKg', 'NORTH_STAR', mockContext);
    expect(fitRes.state).toBe('AVAILABLE');
    expect(fitRes.value).toBe(27.5);

    // VOIRE
    const voireRes = await getCurrentKpiValue('voire.netSales', 'MONTHLY', mockContext);
    expect(voireRes.state).toBe('AVAILABLE');
    expect(voireRes.value).toBe(113000);
  });

  it('strictly differentiates between 0 and NO_DATA', async () => {
    const emptyContext: KpisEvaluationContext = {
      agency: {
        ...mockContext.agency!,
        activeClients: 0, // Genuinely measured 0
      },
    };

    const zeroRes = await getCurrentKpiValue('agency.activeClients', 'MONTHLY', emptyContext);
    expect(zeroRes.state).toBe('AVAILABLE');
    expect(zeroRes.value).toBe(0);

    const unknownRes = await getCurrentKpiValue('unregistered.unknownKey', 'MONTHLY', emptyContext);
    expect(unknownRes.state).toBe('NO_DATA');
    expect(unknownRes.value).toBeNull();
  });

  it('isolates cadences so 25 orders/month does not evaluate against weekly volume', async () => {
    // VOIRE net sales weekly vs monthly
    const monthlyDef = await getCurrentKpiValue('voire.netSales', 'MONTHLY', mockContext);
    expect(monthlyDef.period.cadence).toBe('MONTHLY');
    expect(monthlyDef.value).toBe(113000);

    // Job hunt applications: daily vs weekly vs monthly
    const daily = await getCurrentKpiValue('job_hunt.applicationsToday', 'DAILY', mockContext);
    const weekly = await getCurrentKpiValue('job_hunt.applicationsThisWeek', 'WEEKLY', mockContext);
    const monthly = await getCurrentKpiValue('job_hunt.applicationsThisMonth', 'MONTHLY', mockContext);

    expect(daily.value).toBe(2);
    expect(weekly.value).toBe(7);
    expect(monthly.value).toBe(15);
    expect(daily.value).not.toBe(weekly.value);
    expect(weekly.value).not.toBe(monthly.value);
  });

  it('calculates deterministic progress, gap, and status for HIGHER_IS_BETTER', () => {
    const target = 600000;
    const current = 240000;
    const progress = calculateProgress(current, target, 'HIGHER_IS_BETTER');
    expect(progress).toBe(0.4); // 40%

    const gap = calculateGap(current, target, 'HIGHER_IS_BETTER');
    expect(gap).toBe(360000); // 3.6L needed

    // Behind target status
    const period = getCadencePeriod('MONTHLY', new Date('2026-09-25T12:00:00Z'));
    const status = calculateGoalStatus({
      state: 'AVAILABLE',
      current,
      target,
      progress,
      cadence: 'MONTHLY',
      period,
      refDate: new Date('2026-09-25T12:00:00Z'),
    });
    expect(status).toBe('BEHIND');
  });

  it('calculates deterministic progress and gap for LOWER_IS_BETTER', () => {
    const targetWeight = 72; // Goal: drop to 72 kg
    const currentWeight = 74; // Reality: 74 kg
    const gap = calculateGap(currentWeight, targetWeight, 'LOWER_IS_BETTER');
    expect(gap).toBe(2); // Excess of 2 kg

    const safeTarget = 75; // Goal was 75 kg, we achieved 74 kg
    const safeGap = calculateGap(currentWeight, safeTarget, 'LOWER_IS_BETTER');
    expect(safeGap).toBe(-1); // 1 kg below limit (safe/exceeded)
  });

  it('evaluates complete GoalKpiSnapshot with North Star cash proceeds aggregation', async () => {
    const northStarGoal: Goal = {
      id: 'g-ns',
      pillarId: null,
      title: 'North Star',
      metricKey: 'north_star.financialProceeds',
      cadence: 'NORTH_STAR',
      targetType: 'CURRENCY',
      targetValue: 10000000,
      currentComputedValue: 0,
      unit: '₹',
      weight: 100,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const snap = await evaluateGoalSnapshot(northStarGoal, mockContext);
    expect(snap.state).toBe('AVAILABLE');
    // Agency realized cash (2,40,000) + VOIRE cash received (1,10,000) = 3,50,000
    expect(snap.current).toBe(350000);
    expect(snap.progressPercent).toBe(3.5);
    expect(snap.gap).toBe(9650000);
    expect(snap.status).toBe('BEHIND');
  });
});
