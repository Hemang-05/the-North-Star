// ============================================================================
// PERSONAL OS — Fitness Status Precedence Unit Tests
// Tests the strict deterministic precedence hierarchy and safety rules.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { evaluateFitnessStatus } from '../services/statusEngine';
import type { FitnessKpiSummary } from '../types/pillars';
import type { Goal } from '../types';

function createDefaultKpis(overrides: Partial<FitnessKpiSummary> = {}): FitnessKpiSummary {
  return {
    gymDurationMinutes: 0,
    runningDurationMinutes: 0,
    footballDurationMinutes: 0,
    mobilityDurationMinutes: 0,
    cognitiveDurationMinutes: 0,
    totalActiveMinutes: 0,

    workoutsCount: 0,
    workoutsThisWeek: 0,
    benchPressMaxKg: 0,
    benchPressMaxPerSideKg: 0,
    benchPressBarWeightKg: null,

    totalDistanceKm: 0,
    distanceThisWeekKm: 0,
    fiveKmRunsCount: 0,
    fiveKmRunsThisWeek: 0,
    avgPaceMinKm: null,

    footballSessionsCount: 0,
    footballSessionsThisWeek: 0,

    daysWithMealsLogged: 0,
    avgDailyCaloriesWeek: null,
    avgDailyProteinWeek: null,
    todayCalories: 0,
    todayProteinG: 0,
    supplementsTakenToday: 0,
    totalSupplementsTracked: 0,

    latestWeightKg: null,
    weightDeltaMonthKg: null,
    avgSleepHoursWeek: null,
    avgSleepQualityWeek: null,
    sleepDeficitFlag: false,

    chessSudokuMinutesWeek: 0,

    fitnessAdherenceScore: 0,
    adherenceScoreBreakdown: {
      trainingConsistency: 0,
      cardioAndSports: 0,
      recoveryAndSleep: 0,
      nutritionAndHabits: 0,
    },
    ...overrides,
  };
}

describe('Fitness Status Engine Precedence', () => {
  it('Precedence 1: Zero data all-time returns NEGLECTED (Score 10)', () => {
    const kpis = createDefaultKpis();
    const evaluation = evaluateFitnessStatus(kpis, []);

    expect(evaluation.verdict).toBe('NEGLECTED');
    expect(evaluation.score).toBe(10);
    expect(evaluation.headline).toBe('Awaiting Initial Input');
  });

  it('Precedence 2: 7-Day Inactivity returns NEGLECTED (Score 15) even with historical workouts', () => {
    const kpis = createDefaultKpis({
      workoutsCount: 20, // Historical activity exists
      totalDistanceKm: 50,
      daysWithMealsLogged: 0,
      workoutsThisWeek: 0, // Inactive trailing 7 days
      distanceThisWeekKm: 0,
      todayCalories: 0,
      footballSessionsThisWeek: 0,
      chessSudokuMinutesWeek: 0,
    });

    const evaluation = evaluateFitnessStatus(kpis, []);

    expect(evaluation.verdict).toBe('NEGLECTED');
    expect(evaluation.score).toBe(15);
    expect(evaluation.headline).toBe('Fitness & Health Dormant');
  });

  it('Precedence 3: Critical sleep deficit (< 6.0h) triggers AT_RISK and overrides high training consistency', () => {
    const kpis = createDefaultKpis({
      workoutsCount: 10,
      workoutsThisWeek: 5, // High training volume!
      distanceThisWeekKm: 15,
      totalActiveMinutes: 300,
      avgSleepHoursWeek: 5.2, // Severely deficient sleep!
      sleepDeficitFlag: true,
      fitnessAdherenceScore: 70,
    });

    const evaluation = evaluateFitnessStatus(kpis, []);

    expect(evaluation.verdict).toBe('AT_RISK');
    expect(evaluation.score).toBe(35);
    expect(evaluation.headline).toContain('Sleep Deprivation');
    expect(evaluation.badges).toContain('Sleep Deficit');
  });

  it('Precedence 4: Compounded Consistency Lag (< 2 workouts AND < 80g protein) returns AT_RISK', () => {
    const kpis = createDefaultKpis({
      workoutsCount: 5,
      workoutsThisWeek: 1, // < 2 workouts
      daysWithMealsLogged: 3,
      avgDailyProteinWeek: 60, // < 80g protein
      avgSleepHoursWeek: 7.5,
      sleepDeficitFlag: false,
      fitnessAdherenceScore: 35,
    });

    const evaluation = evaluateFitnessStatus(kpis, []);

    expect(evaluation.verdict).toBe('AT_RISK');
    expect(evaluation.score).toBe(40);
    expect(evaluation.headline).toBe('Compounded Consistency Lag');
  });

  it('Precedence 5: Active user goals govern status when goals are configured', () => {
    const kpis = createDefaultKpis({
      workoutsCount: 4,
      workoutsThisWeek: 4,
      distanceThisWeekKm: 5.0,
      fiveKmRunsThisWeek: 1,
      avgSleepHoursWeek: 7.5,
      sleepDeficitFlag: false,
      fitnessAdherenceScore: 85,
    });

    const goals: Goal[] = [
      {
        id: 'g-1',
        pillarId: 'fitness',
        title: '5 km Run Completed',
        cadence: 'WEEKLY',
        targetType: 'COUNT',
        targetValue: 1,
        currentValue: 1, // 100% progress
        createdAt: '2026-09-01',
        updatedAt: '2026-09-06',
      },
    ];

    const evaluation = evaluateFitnessStatus(kpis, goals);

    expect(evaluation.verdict).toBe('EXCEEDING');
    expect(evaluation.score).toBe(90);
    expect(evaluation.headline).toBe('Surpassing Fitness Goals');
  });

  it('Precedence 6: Heuristic fallback evaluates adherence score when no active goals exist', () => {
    const kpis = createDefaultKpis({
      workoutsCount: 8,
      workoutsThisWeek: 4,
      distanceThisWeekKm: 10,
      totalActiveMinutes: 240,
      avgSleepHoursWeek: 7.8,
      sleepDeficitFlag: false,
      fitnessAdherenceScore: 85,
    });

    const evaluation = evaluateFitnessStatus(kpis, []);

    expect(evaluation.verdict).toBe('EXCEEDING');
    expect(evaluation.headline).toContain('High Habit Adherence');
  });

  it('Weekend Football Neutrality: Zero football sessions does NOT trigger penalty when other training is consistent', () => {
    const kpis = createDefaultKpis({
      workoutsCount: 15,
      workoutsThisWeek: 3,
      distanceThisWeekKm: 6.0,
      fiveKmRunsThisWeek: 1,
      footballSessionsThisWeek: 0, // No football on weekdays/weekends
      footballSessionsCount: 0,
      daysWithMealsLogged: 4,
      avgDailyProteinWeek: 130,
      avgSleepHoursWeek: 7.6,
      sleepDeficitFlag: false,
      fitnessAdherenceScore: 65,
    });

    const evaluation = evaluateFitnessStatus(kpis, []);

    // Must be ON_TRACK or EXCEEDING, NEVER penalized because football = 0
    expect(evaluation.verdict).toBe('ON_TRACK');
    expect(evaluation.score).toBeGreaterThanOrEqual(50);
  });
});
