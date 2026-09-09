// ============================================================================
// PERSONAL OS — Fitness / Health KPI & Adherence Unit Tests
// Tests pure calculations, duration separation, bench weight semantics,
// sleep calculations across midnight, nutrition averages, and adherence score.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  computeFitnessKpiSummary,
  calculateSleepDurationMins,
  calculateTotalWeight,
  calculatePerSideWeight,
  parseTimeToMinutes,
} from '../services/fitnessKpi';
import type {
  WorkoutSession,
  ExerciseLog,
  RunLog,
  NutritionLog,
  SupplementLog,
  DailyBioSnapshot,
} from '../types/pillars';
import type { FocusSession } from '../types/core';

describe('Fitness KPI & Adherence Calculations', () => {
  const mockNow = new Date('2026-09-06T12:00:00.000Z');

  describe('Empty Dataset & Missing Data Handling', () => {
    it('returns deterministic zero/null defaults on empty dataset', () => {
      const summary = computeFitnessKpiSummary([], [], [], [], [], [], [], mockNow);

      expect(summary.workoutsCount).toBe(0);
      expect(summary.totalDistanceKm).toBe(0);
      expect(summary.fiveKmRunsCount).toBe(0);
      expect(summary.benchPressMaxKg).toBe(0);
      expect(summary.benchPressMaxPerSideKg).toBe(0);
      expect(summary.benchPressBarWeightKg).toBeNull();
      expect(summary.daysWithMealsLogged).toBe(0);
      expect(summary.avgDailyCaloriesWeek).toBeNull();
      expect(summary.avgDailyProteinWeek).toBeNull();
      expect(summary.latestWeightKg).toBeNull();
      expect(summary.weightDeltaMonthKg).toBeNull();
      expect(summary.avgSleepHoursWeek).toBeNull();
      expect(summary.sleepDeficitFlag).toBe(false);
      expect(summary.fitnessAdherenceScore).toBe(0);
      expect(summary.totalActiveMinutes).toBe(0);
    });

    it('never assumes zero calories or protein when no meals are logged', () => {
      const summary = computeFitnessKpiSummary([], [], [], [], [], [], [], mockNow);
      expect(summary.avgDailyCaloriesWeek).toBeNull();
      expect(summary.avgDailyProteinWeek).toBeNull();
    });
  });

  describe('Duration Separation & Deduplication', () => {
    it('segregates Gym, Running, Football, Mobility, and Cognitive durations with zero double-counting', () => {
      const workouts: WorkoutSession[] = [
        {
          id: 'w-1',
          startedAt: '2026-09-05T09:00:00.000Z',
          durationMinutes: 60,
          workoutType: 'GYM_PUSH',
        },
        {
          id: 'w-2',
          startedAt: '2026-09-06T10:00:00.000Z',
          durationMinutes: 90,
          workoutType: 'FOOTBALL',
        },
        {
          id: 'w-3',
          startedAt: '2026-09-04T08:00:00.000Z',
          durationMinutes: 30,
          workoutType: 'WALKING',
        },
      ];

      const runs: RunLog[] = [
        {
          id: 'r-1',
          startedAt: '2026-09-05T18:00:00.000Z',
          distanceKm: 5.0,
          durationSeconds: 1680, // 28 minutes
        },
      ];

      const focusSessions: FocusSession[] = [
        // Linked focus session for workout w-1 -> MUST NOT BE DOUBLE COUNTED
        {
          id: 'f-1',
          startTime: '2026-09-05T09:00:00.000Z',
          durationMinutes: 60,
          category: 'Gym',
          projectRef: 'w-1',
          isCompleted: true,
        },
        // Standalone focus session without a logged workout
        {
          id: 'f-2',
          startTime: '2026-09-03T11:00:00.000Z',
          durationMinutes: 45,
          category: 'Gym',
          isCompleted: true,
        },
        // Mental / cognitive focus session
        {
          id: 'f-3',
          startTime: '2026-09-06T14:00:00.000Z',
          durationMinutes: 25,
          category: 'Mental',
          isCompleted: true,
        },
      ];

      const bioSnapshots: DailyBioSnapshot[] = [
        {
          id: 'b-1',
          date: '2026-09-06',
          chessSudokuMins: 20, // Same date as f-3 (25 mins) -> max is 25 mins
        },
        {
          id: 'b-2',
          date: '2026-09-05',
          chessSudokuMins: 15, // Standalone date
        },
      ];

      const summary = computeFitnessKpiSummary(
        workouts,
        [],
        runs,
        [],
        [],
        bioSnapshots,
        focusSessions,
        mockNow
      );

      // Gym = w-1 (60m) + standalone f-2 (45m) = 105m (f-1 linked to w-1 is not double counted)
      expect(summary.gymDurationMinutes).toBe(105);
      // Running = 28m
      expect(summary.runningDurationMinutes).toBe(28);
      // Football = 90m
      expect(summary.footballDurationMinutes).toBe(90);
      // Mobility = 30m
      expect(summary.mobilityDurationMinutes).toBe(30);
      // Total Physical = 105 + 28 + 90 + 30 = 253m
      expect(summary.totalActiveMinutes).toBe(253);

      // Cognitive = max(25, 20) on 2026-09-06 + 15 on 2026-09-05 = 40m
      expect(summary.cognitiveDurationMinutes).toBe(40);
      expect(summary.chessSudokuMinutesWeek).toBe(40);
    });
  });

  describe('Bench Press Weight Semantics', () => {
    it('calculates total weight and per-side weight only when bar weight is explicitly known', () => {
      // Known bar weight
      expect(calculateTotalWeight(30, 20)).toBe(80);
      expect(calculatePerSideWeight(80, 20)).toBe(30);

      expect(calculateTotalWeight(20, 20)).toBe(60);
      expect(calculatePerSideWeight(60, 20)).toBe(20);

      // Bar weight undefined -> does NOT assume 20kg!
      expect(calculateTotalWeight(30, undefined)).toBeUndefined();
      expect(calculatePerSideWeight(80, undefined)).toBeUndefined();
    });

    it('distinguishes "60 kg total" from "30 kg each side" and computes maxes accurately', () => {
      const exercises: ExerciseLog[] = [
        {
          id: 'e-1',
          workoutId: 'w-1',
          exerciseName: 'Barbell Bench Press',
          setIndex: 1,
          reps: 10,
          weightKg: 60,
          weightPerSideKg: 20,
          barWeightKg: 20,
          isPR: false,
        },
        {
          id: 'e-2',
          workoutId: 'w-1',
          exerciseName: 'Flat Bench Press',
          setIndex: 2,
          reps: 5,
          weightKg: 80,
          weightPerSideKg: 30,
          barWeightKg: 20,
          isPR: true,
        },
      ];

      const summary = computeFitnessKpiSummary([], exercises, [], [], [], [], [], mockNow);

      expect(summary.benchPressMaxKg).toBe(80);
      expect(summary.benchPressMaxPerSideKg).toBe(30);
      expect(summary.benchPressBarWeightKg).toBe(20);
    });
  });

  describe('Running 5K Detection', () => {
    it('detects 5.0+ km runs accurately and ignores runs under 5.0 km', () => {
      const runs: RunLog[] = [
        {
          id: 'r-1',
          startedAt: '2026-09-01T08:00:00.000Z',
          distanceKm: 4.8,
          durationSeconds: 1600,
        },
        {
          id: 'r-2',
          startedAt: '2026-09-04T08:00:00.000Z',
          distanceKm: 5.0,
          durationSeconds: 1680,
        },
        {
          id: 'r-3',
          startedAt: '2026-09-05T08:00:00.000Z',
          distanceKm: 10.0,
          durationSeconds: 3400,
        },
      ];

      const summary = computeFitnessKpiSummary([], [], runs, [], [], [], [], mockNow);

      expect(summary.totalDistanceKm).toBe(19.8);
      expect(summary.fiveKmRunsCount).toBe(2);
      expect(summary.fiveKmRunsThisWeek).toBe(2);
    });
  });

  describe('Nutrition Averaging Windows', () => {
    it('computes daily averages strictly over unique dates with logged meals', () => {
      const nutrition: NutritionLog[] = [
        // Day 1 (2 meals)
        {
          id: 'm-1',
          eatenAt: '2026-09-05T08:30:00.000Z',
          foodName: 'Oatmeal',
          mealType: 'BREAKFAST',
          calories: 400,
          proteinG: 20,
          carbsG: 60,
          fatG: 5,
        },
        {
          id: 'm-2',
          eatenAt: '2026-09-05T13:00:00.000Z',
          foodName: 'Chicken & Rice',
          mealType: 'LUNCH',
          calories: 800,
          proteinG: 60,
          carbsG: 90,
          fatG: 15,
        },
        // Day 2 (1 meal)
        {
          id: 'm-3',
          eatenAt: '2026-09-06T12:00:00.000Z',
          foodName: 'Steak & Potatoes',
          mealType: 'LUNCH',
          calories: 900,
          proteinG: 70,
          carbsG: 50,
          fatG: 25,
        },
      ];

      const summary = computeFitnessKpiSummary([], [], [], nutrition, [], [], [], mockNow);

      expect(summary.daysWithMealsLogged).toBe(2);
      // Day 1 sum: 1200 kcal, 80g protein
      // Day 2 sum: 900 kcal, 70g protein
      // Avg calories = (1200 + 900) / 2 = 1050 kcal
      // Avg protein = (80 + 70) / 2 = 75g
      expect(summary.avgDailyCaloriesWeek).toBe(1050);
      expect(summary.avgDailyProteinWeek).toBe(75);
    });
  });

  describe('Sleep Duration Calculation', () => {
    it('correctly computes overnight sleep crossing midnight', () => {
      // 23:30 to 07:00 = 7.5 hours = 450 minutes
      const mins = calculateSleepDurationMins('23:30', '07:00');
      expect(mins).toBe(450);

      // 00:15 to 08:15 = 8.0 hours = 480 minutes
      const mins2 = calculateSleepDurationMins('00:15', '08:15');
      expect(mins2).toBe(480);
    });

    it('returns null if either bedtime or waketime is invalid', () => {
      expect(calculateSleepDurationMins(undefined, '07:00')).toBeNull();
      expect(calculateSleepDurationMins('23:30', undefined)).toBeNull();
      expect(calculateSleepDurationMins('invalid', '07:00')).toBeNull();
    });

    it('detects sleep deficit when average sleep is under 6 hours across multiple days', () => {
      const bioSnapshots: DailyBioSnapshot[] = [
        {
          id: 'b-1',
          date: '2026-09-05',
          sleepBedtime: '01:00',
          sleepWaketime: '06:00', // 5.0h
          sleepQuality: 5,
        },
        {
          id: 'b-2',
          date: '2026-09-06',
          sleepBedtime: '01:30',
          sleepWaketime: '06:30', // 5.0h
          sleepQuality: 5,
        },
      ];

      const summary = computeFitnessKpiSummary([], [], [], [], [], bioSnapshots, [], mockNow);

      expect(summary.avgSleepHoursWeek).toBe(5.0);
      expect(summary.sleepDeficitFlag).toBe(true);
    });
  });

  describe('Fitness Adherence Score (0-100)', () => {
    it('calculates habit adherence score and component breakdown', () => {
      const workouts: WorkoutSession[] = [
        { id: 'w-1', startedAt: '2026-09-02T10:00:00.000Z', durationMinutes: 60, workoutType: 'GYM_PUSH' },
        { id: 'w-2', startedAt: '2026-09-03T10:00:00.000Z', durationMinutes: 60, workoutType: 'GYM_PULL' },
        { id: 'w-3', startedAt: '2026-09-04T10:00:00.000Z', durationMinutes: 60, workoutType: 'GYM_LEGS' },
        { id: 'w-4', startedAt: '2026-09-05T10:00:00.000Z', durationMinutes: 60, workoutType: 'GYM_UPPER' },
      ]; // 4 workouts -> 30 pts

      const runs: RunLog[] = [
        { id: 'r-1', startedAt: '2026-09-05T18:00:00.000Z', distanceKm: 5.0, durationSeconds: 1680 },
      ]; // 5K run -> 15 pts

      const bioSnapshots: DailyBioSnapshot[] = [
        {
          id: 'b-1',
          date: '2026-09-05',
          sleepBedtime: '23:30',
          sleepWaketime: '07:30', // 8.0h -> 15 pts
          sleepQuality: 8, // 8/10 -> 10 pts (total recovery 25 pts)
          chessSudokuMins: 20, // 5 pts
        },
      ];

      const nutrition: NutritionLog[] = [
        {
          id: 'm-1',
          eatenAt: '2026-09-05T12:00:00.000Z',
          foodName: 'High Protein Meal',
          mealType: 'LUNCH',
          calories: 1200,
          proteinG: 140, // >= 120g -> 10 pts
          carbsG: 100,
          fatG: 20,
        },
      ]; // Snapshot present (5 pts) + cognitive (5 pts) + protein (10 pts) = 20 pts

      const summary = computeFitnessKpiSummary(workouts, [], runs, nutrition, [], bioSnapshots, [], mockNow);

      expect(summary.adherenceScoreBreakdown.trainingConsistency).toBe(30);
      expect(summary.adherenceScoreBreakdown.cardioAndSports).toBe(15);
      expect(summary.adherenceScoreBreakdown.recoveryAndSleep).toBe(25);
      expect(summary.adherenceScoreBreakdown.nutritionAndHabits).toBe(20);
      expect(summary.fitnessAdherenceScore).toBe(90);
    });
  });
});
