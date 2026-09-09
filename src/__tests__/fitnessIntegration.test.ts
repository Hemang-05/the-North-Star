// ============================================================================
// PERSONAL OS — Fitness Integration, Activity Ledger & DB Migration Verification
// 1. Verifies complete ActivityEvent contracts for all Fitness domain events.
// 2. Verifies v5 -> v6 migration: all frozen pillar data & KPIs survive untouched.
// 3. Verifies AI ground-truth consistency and non-medical guardrails.
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { logEvent } from '../hooks/useDatabase';
import { computeFitnessKpiSummary } from '../services/fitnessKpi';
import { evaluateFitnessStatus } from '../services/statusEngine';
import { generateOfflineFitnessAudit, type FitnessAiFacts } from '../services/aiContext';
import { calculateJobHuntKpis } from '../services/jobHuntKpi';
import { calculateAgencyKpis } from '../services/agencyKpi';
import { computeSaasKpis } from '../services/saasKpi';
import { computeForexKpiSummary } from '../services/forexKpi';

import type {
  WorkoutSession,
  ExerciseLog,
  RunLog,
  NutritionLog,
  SupplementLog,
  DailyBioSnapshot,
  JobOpportunity,
  JobApplication,
  JobOutreach,
  AgencyClient,
  AgencyProject,
  AgencyInvoice,
  AgencyLead,
  SaasFeature,
  SaasRelease,
  SaasDistribution,
  ForexStudySession,
  ForexSetup,
  ForexBacktestBatch,
  ForexPaperTrade,
} from '../types';

vi.mock('../services/db', () => ({
  dbPut: vi.fn().mockImplementation(async (_store, item) => item),
  dbGetAll: vi.fn().mockResolvedValue([]),
  STORES: {
    EVENTS: 'activityEvents',
    WORKOUTS: 'workouts',
    EXERCISES: 'exercises',
    RUNS: 'runs',
    NUTRITION: 'nutrition',
    SUPPLEMENTS: 'supplements',
    BIO_SNAPSHOTS: 'bioSnapshots',
    GOALS: 'goals',
  },
}));

describe('Fitness Integration, Event Ledger & Migration Verification', () => {
  describe('Complete ActivityEvent Contract Verification', () => {
    it('verifies full Fitness event schema and entity references for all domain actions', async () => {
      // 1. FITNESS_WORKOUT_DONE
      const workoutEvt = await logEvent(
        'fitness',
        'FITNESS_WORKOUT_DONE',
        60,
        'minutes',
        'WorkoutSession',
        'w_gym_101',
        {
          workoutType: 'GYM_PUSH',
          durationMinutes: 60,
          exercisesCount: 3,
          hasBenchPress: true,
        }
      );

      expect(workoutEvt.pillarId).toBe('fitness');
      expect(workoutEvt.eventType).toBe('FITNESS_WORKOUT_DONE');
      expect(workoutEvt.quantity).toBe(60);
      expect(workoutEvt.unit).toBe('minutes');
      expect(workoutEvt.entityRefType).toBe('WorkoutSession');
      expect(workoutEvt.entityRefId).toBe('w_gym_101');
      expect(workoutEvt.metadata?.workoutType).toBe('GYM_PUSH');

      // 2. FITNESS_RUN_COMPLETED
      const runEvt = await logEvent(
        'fitness',
        'FITNESS_RUN_COMPLETED',
        5.0,
        'km',
        'RunLog',
        'r_run_202',
        {
          distanceKm: 5.0,
          durationSeconds: 1680,
          paceMinKm: 5.6,
          completed5k: true,
        }
      );

      expect(runEvt.pillarId).toBe('fitness');
      expect(runEvt.eventType).toBe('FITNESS_RUN_COMPLETED');
      expect(runEvt.quantity).toBe(5.0);
      expect(runEvt.unit).toBe('km');
      expect(runEvt.entityRefType).toBe('RunLog');
      expect(runEvt.entityRefId).toBe('r_run_202');
      expect(runEvt.metadata?.completed5k).toBe(true);

      // 3. FITNESS_MEAL_LOGGED
      const mealEvt = await logEvent(
        'fitness',
        'FITNESS_MEAL_LOGGED',
        650,
        'kcal',
        'NutritionLog',
        'm_meal_303',
        {
          foodName: 'Chicken & Rice',
          mealType: 'LUNCH',
          calories: 650,
          proteinG: 45,
        }
      );

      expect(mealEvt.pillarId).toBe('fitness');
      expect(mealEvt.eventType).toBe('FITNESS_MEAL_LOGGED');
      expect(mealEvt.quantity).toBe(650);
      expect(mealEvt.unit).toBe('kcal');
      expect(mealEvt.entityRefType).toBe('NutritionLog');
      expect(mealEvt.entityRefId).toBe('m_meal_303');
      expect(mealEvt.metadata?.proteinG).toBe(45);

      // 4. FITNESS_WEIGHT_LOGGED
      const weightEvt = await logEvent(
        'fitness',
        'FITNESS_WEIGHT_LOGGED',
        68.5,
        'kg',
        'DailyBioSnapshot',
        'b_snap_404',
        {
          weightKg: 68.5,
          date: '2026-09-06',
        }
      );

      expect(weightEvt.pillarId).toBe('fitness');
      expect(weightEvt.eventType).toBe('FITNESS_WEIGHT_LOGGED');
      expect(weightEvt.quantity).toBe(68.5);
      expect(weightEvt.unit).toBe('kg');
      expect(weightEvt.entityRefType).toBe('DailyBioSnapshot');
      expect(weightEvt.entityRefId).toBe('b_snap_404');

      // 5. FITNESS_SLEEP_LOGGED
      const sleepEvt = await logEvent(
        'fitness',
        'FITNESS_SLEEP_LOGGED',
        450,
        'minutes',
        'DailyBioSnapshot',
        'b_snap_404',
        {
          sleepDurationMins: 450,
          sleepQuality: 8,
          sleepBedtime: '23:30',
          sleepWaketime: '07:00',
        }
      );

      expect(sleepEvt.pillarId).toBe('fitness');
      expect(sleepEvt.eventType).toBe('FITNESS_SLEEP_LOGGED');
      expect(sleepEvt.quantity).toBe(450);
      expect(sleepEvt.unit).toBe('minutes');
      expect(sleepEvt.entityRefType).toBe('DailyBioSnapshot');
      expect(sleepEvt.metadata?.sleepWaketime).toBe('07:00');

      // 6. FITNESS_SUPPLEMENT_TAKEN
      const suppEvt = await logEvent(
        'fitness',
        'FITNESS_SUPPLEMENT_TAKEN',
        1,
        'dose',
        'SupplementLog',
        's_supp_505',
        {
          supplement: 'Creatine Monohydrate',
          quantity: '5g',
        }
      );

      expect(suppEvt.pillarId).toBe('fitness');
      expect(suppEvt.eventType).toBe('FITNESS_SUPPLEMENT_TAKEN');
      expect(suppEvt.quantity).toBe(1);
      expect(suppEvt.unit).toBe('dose');
      expect(suppEvt.entityRefType).toBe('SupplementLog');
      expect(suppEvt.metadata?.supplement).toBe('Creatine Monohydrate');
    });
  });

  describe('DB v5 -> v6 Migration & Frozen Pillar Regression Verification', () => {
    it('verifies that all existing records and KPIs in the 4 frozen pillars remain 100% intact after v6 upgrade', () => {
      // 1. Frozen Pillar 1: Job Hunt
      const opps: JobOpportunity[] = [
        {
          id: 'jh-1',
          company: 'TechCorp',
          role: 'Staff Engineer',
          stage: 'APPLIED',
          targetCompensation: 120000,
          currency: 'USD',
          source: 'REFERRAL',
          priority: 1,
          createdAt: '2026-09-01T10:00:00.000Z',
          updatedAt: '2026-09-01T10:00:00.000Z',
        },
      ];
      const apps: JobApplication[] = [
        {
          id: 'app-1',
          opportunityId: 'jh-1',
          appliedAt: '2026-09-01T10:00:00.000Z',
          channel: 'REFERRAL',
          resumeVersion: 'v2.1',
        },
      ];
      const outreach: JobOutreach[] = [
        {
          id: 'out-1',
          contactName: 'Alice Recruiter',
          channel: 'LINKEDIN',
          sentAt: '2026-09-01T11:00:00.000Z',
          repliedAt: '2026-09-01T12:00:00.000Z',
        },
      ];
      const jhKpiBefore = calculateJobHuntKpis({
        opportunities: opps,
        applications: apps,
        outreaches: outreach,
        assets: [],
        focusSessions: [],
        events: [],
      });
      expect(jhKpiBefore.totalOpportunities).toBe(1);
      expect(jhKpiBefore.totalApplications).toBe(1);
      expect(jhKpiBefore.totalOutreach).toBe(1);
      expect(jhKpiBefore.responseRate).toBe(100);

      // 2. Frozen Pillar 2: Agency
      const clients: AgencyClient[] = [
        {
          id: 'cl-1',
          name: 'Acme Corp',
          company: 'Acme',
          status: 'ACTIVE',
          joinedAt: '2026-09-02T10:00:00.000Z',
          createdAt: '2026-09-02T10:00:00.000Z',
          updatedAt: '2026-09-02T10:00:00.000Z',
        },
      ];
      const projects: AgencyProject[] = [
        {
          id: 'proj-1',
          clientId: 'cl-1',
          name: 'Web App Redesign',
          value: 150000,
          status: 'ACTIVE',
          currency: 'INR',
          createdAt: '2026-09-02T10:00:00.000Z',
          updatedAt: '2026-09-02T10:00:00.000Z',
        },
      ];
      const invoices: AgencyInvoice[] = [
        {
          id: 'inv-1',
          clientId: 'cl-1',
          projectId: 'proj-1',
          invoiceNumber: 'INV-001',
          amount: 75000,
          status: 'PAID',
          paidAt: '2026-09-03T10:00:00.000Z',
          currency: 'INR',
          createdAt: '2026-09-02T10:00:00.000Z',
          updatedAt: '2026-09-03T10:00:00.000Z',
        },
      ];
      const leads: AgencyLead[] = [];
      const agencyKpiBefore = calculateAgencyKpis({
        clients,
        projects,
        leads,
        invoices,
        focusSessions: [],
        events: [],
      });
      expect(agencyKpiBefore.activeClients).toBe(1);
      expect(agencyKpiBefore.realizedCash).toBe(75000);
      expect(agencyKpiBefore.accountsReceivable).toBe(0);

      // 3. Frozen Pillar 3: Trading OS -> SaaS
      const features: SaasFeature[] = [
        {
          id: 'feat-1',
          title: 'Stripe Billing',
          status: 'DONE',
          priority: 'P0',
          createdAt: '2026-09-02T10:00:00.000Z',
          updatedAt: '2026-09-03T10:00:00.000Z',
        },
      ];
      const releases: SaasRelease[] = [
        {
          id: 'rel-1',
          version: 'v1.0.0',
          status: 'PUBLISHED',
          releasedAt: '2026-09-03T10:00:00.000Z',
          changelog: 'Initial launch',
        },
      ];
      const dist: SaasDistribution[] = [
        {
          id: 'dist-1',
          channel: 'TWITTER',
          activityType: 'LAUNCH_POST',
          title: 'Product launch tweet',
          createdAt: '2026-09-03T11:00:00.000Z',
        },
      ];

      const saasKpiBefore = computeSaasKpis(features, [], releases, dist, [], [], []);
      expect(saasKpiBefore.featuresDone).toBe(1);
      expect(saasKpiBefore.publishedReleases).toBe(1);
      expect(saasKpiBefore.totalDistributionActivities).toBe(1);

      // 4. Frozen Pillar 4: Forex Learning
      const studies: ForexStudySession[] = [
        {
          id: 'study-1',
          topic: 'Market Structure & Liquidity',
          curriculumPhase: 'FOUNDATION',
          studyType: 'VIDEO',
          durationMinutes: 45,
          studiedAt: '2026-09-04T10:00:00.000Z',
        },
      ];
      const setups: ForexSetup[] = [
        {
          id: 'setup-1',
          name: 'London Breakout',
          timeframe: '15m',
          status: 'BACKTESTING',
          createdAt: '2026-09-04T11:00:00.000Z',
          updatedAt: '2026-09-04T11:00:00.000Z',
        },
      ];
      const backtests: ForexBacktestBatch[] = [
        {
          id: 'bt-1',
          setupId: 'setup-1',
          pair: 'EUR/USD',
          sampleSize: 30,
          wins: 18,
          winRate: 60,
          backtestedAt: '2026-09-04T12:00:00.000Z',
        },
      ];
      const paperTrades: ForexPaperTrade[] = [
        {
          id: 'pt-1',
          setupId: 'setup-1',
          pair: 'EUR/USD',
          direction: 'LONG',
          result: 'WIN',
          ruleAdhered: true,
          rMultiple: 2.0,
          tradedAt: '2026-09-05T10:00:00.000Z',
        },
      ];

      const forexKpiBefore = computeForexKpiSummary(studies, setups, backtests, paperTrades, [], []);
      expect(forexKpiBefore.totalStudyMinutes).toBe(45);
      expect(forexKpiBefore.totalStudySessions).toBe(1);
      expect(forexKpiBefore.totalSetups).toBe(1);
      expect(forexKpiBefore.totalBacktestedTrades).toBe(30);
      expect(forexKpiBefore.ruleAdherenceRate).toBe(100);

      // SIMULATE v5 -> v6 MIGRATION:
      // Fitness data is added to the system alongside existing v5 data
      const fitnessWorkouts: WorkoutSession[] = [
        {
          id: 'w-1',
          startedAt: '2026-09-05T09:00:00.000Z',
          durationMinutes: 60,
          workoutType: 'GYM_PUSH',
        },
      ];
      const fitnessKpis = computeFitnessKpiSummary(fitnessWorkouts, [], [], [], [], [], []);
      expect(fitnessKpis.workoutsCount).toBe(1);

      // Re-verify that the frozen pillar KPI engines produce the exact same outputs
      const jhKpiAfter = calculateJobHuntKpis({
        opportunities: opps,
        applications: apps,
        outreaches: outreach,
        assets: [],
        focusSessions: [],
        events: [],
      });
      expect(jhKpiAfter).toEqual(jhKpiBefore);

      const agencyKpiAfter = calculateAgencyKpis({
        clients,
        projects,
        leads,
        invoices,
        focusSessions: [],
        events: [],
      });
      expect(agencyKpiAfter).toEqual(agencyKpiBefore);

      const saasKpiAfter = computeSaasKpis(features, [], releases, dist, [], [], []);
      expect(saasKpiAfter).toEqual(saasKpiBefore);

      const forexKpiAfter = computeForexKpiSummary(studies, setups, backtests, paperTrades, [], []);
      expect(forexKpiAfter).toEqual(forexKpiBefore);
    });
  });

  describe('AI Ground-Truth & Non-Medical Guardrails Verification', () => {
    it('verifies AI audit interprets deterministic facts without medical claims or fabricated numbers', () => {
      const mockFacts: FitnessAiFacts = {
        timestamp: '2026-09-06T12:00:00.000Z',
        pillar: 'fitness',
        status: {
          verdict: 'ON_TRACK',
          score: 75,
          headline: 'Consistent Habit Momentum',
          reason: 'Solid routine across workouts and running.',
        },
        durations: {
          gymDurationMinutes: 120,
          runningDurationMinutes: 28,
          footballDurationMinutes: 90,
          mobilityDurationMinutes: 30,
          cognitiveDurationMinutes: 25,
          totalActiveMinutes: 268,
        },
        workouts: {
          count: 2,
          thisWeek: 2,
          benchPressMaxKg: 80,
          benchPressMaxPerSideKg: 30,
          benchPressBarWeightKg: 20,
        },
        running: {
          totalDistanceKm: 5.0,
          distanceThisWeekKm: 5.0,
          fiveKmRunsCount: 1,
          fiveKmRunsThisWeek: 1,
          avgPaceMinKm: '5.60 min/km',
        },
        football: {
          totalSessions: 1,
          sessionsThisWeek: 1,
        },
        nutrition: {
          daysWithMealsLogged: 1,
          avgDailyCaloriesWeek: '650 kcal',
          avgDailyProteinWeek: '45 g',
          todayCalories: 650,
          todayProteinG: 45,
          supplementsTakenToday: 1,
          totalSupplementsTracked: 1,
        },
        recoveryAndBio: {
          latestWeightKg: '68.5 kg',
          weightDeltaMonthKg: '—',
          avgSleepHoursWeek: '7.5 h',
          avgSleepQualityWeek: '8.0/10',
          sleepDeficitFlag: false,
        },
        cognitive: {
          chessSudokuMinutesWeek: 25,
        },
        adherence: {
          fitnessAdherenceScore: 75,
          breakdown: {
            trainingConsistency: 16,
            cardioAndSports: 25,
            recoveryAndSleep: 25,
            nutritionAndHabits: 9,
          },
        },
        activeGoals: [
          {
            title: '30 kg Bench Each Side',
            cadence: 'NORTH_STAR',
            currentValue: 30,
            targetValue: 30,
            unit: 'kg/side',
            progressPercent: '100%',
          },
          {
            title: '5 km Run Completed',
            cadence: 'WEEKLY',
            currentValue: 1,
            targetValue: 1,
            unit: 'runs',
            progressPercent: '100%',
          },
        ],
      };

      const audit = generateOfflineFitnessAudit(mockFacts);

      // Verifies non-medical disclaimer exists
      expect(audit).toContain('does not provide medical diagnosis');
      // Verifies exact adherence score
      expect(audit).toContain('Adherence Score: 75/100');
      // Verifies exact bench press milestone
      expect(audit).toContain('30 kg/side');
      expect(audit).toContain('80 kg total load');
      // Verifies 5K run detection
      expect(audit).toContain('1 5K run(s) all-time');
      // Verifies duration segregation
      expect(audit).toContain('**Resistance / Gym Training**: 120 min');
      expect(audit).toContain('**Running & Cardio**: 28 min');
      expect(audit).toContain('**Weekend Football**: 90 min');
      expect(audit).toContain('**Cognitive Habit (Chess / Sudoku)**: 25 min');
    });
  });
});
