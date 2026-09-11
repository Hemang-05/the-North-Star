// ============================================================================
// PERSONAL OS — Fitness / Health KPI & Adherence Computation Engine
// Pure deterministic metrics calculation for training, running, football,
// nutrition, sleep/recovery, and habit adherence.
// 
// Axioms:
//   "I record reality. The system compares reality with my goals. AI interprets the gap."
//   "Code calculates. AI judges and explains."
// 
// Note: fitnessAdherenceScore strictly measures recorded habit adherence,
// NOT objective medical health or physical diagnosis.
// ============================================================================

import type {
  WorkoutSession,
  ExerciseLog,
  RunLog,
  NutritionLog,
  SupplementLog,
  DailyBioSnapshot,
  FitnessKpiSummary,
} from '../types/pillars';
import type { FocusSession } from '../types/core';
import { dbGetAll, STORES } from './db';

/**
 * Parses HH:mm string to minutes from 00:00.
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Calculates sleep duration in minutes from bedtime and waketime strings (HH:mm).
 * Handles overnight sleep (e.g. 23:30 to 07:00 = 450 minutes).
 */
export function calculateSleepDurationMins(bedtime?: string, waketime?: string): number | null {
  if (!bedtime || !waketime) return null;
  const b = parseTimeToMinutes(bedtime);
  const w = parseTimeToMinutes(waketime);
  if (b === null || w === null) return null;

  if (w < b) {
    // Crossed midnight
    return (w + 1440) - b;
  }
  return w - b;
}

/**
 * Calculates total weight when per-side weight and bar weight are known.
 * Does NOT assume a default 20 kg bar if barWeightKg is omitted.
 */
export function calculateTotalWeight(weightPerSideKg: number, barWeightKg?: number): number | undefined {
  if (barWeightKg === undefined) return undefined;
  return (weightPerSideKg * 2) + barWeightKg;
}

/**
 * Calculates per-side weight from total weight when bar weight is known.
 * Does NOT assume a default 20 kg bar if barWeightKg is omitted.
 */
export function calculatePerSideWeight(totalWeightKg: number, barWeightKg?: number): number | undefined {
  if (barWeightKg === undefined) return undefined;
  return Math.max(0, (totalWeightKg - barWeightKg) / 2);
}

/**
 * Pure calculation of Fitness KPIs and Adherence Score from domain records.
 */
export function computeFitnessKpiSummary(
  workouts: WorkoutSession[],
  exercises: ExerciseLog[],
  runs: RunLog[],
  nutrition: NutritionLog[],
  supplements: SupplementLog[],
  bioSnapshots: DailyBioSnapshot[],
  focusSessions: FocusSession[] = [],
  now = new Date()
): FitnessKpiSummary {
  const nowMs = now.getTime();
  const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  const todayStr = now.toISOString().slice(0, 10);

  // --- 1. Activity Duration Segregation & Deduplication ---
  // Workouts set IDs to check against focus sessions
  const workoutIds = new Set(workouts.map((w) => w.id));
  const runIds = new Set(runs.map((r) => r.id));

  const getFocusMinutes = (f: FocusSession | { durationMinutes?: number; durationSeconds?: number }): number => {
    if (typeof (f as { durationMinutes?: number }).durationMinutes === 'number') {
      return (f as { durationMinutes?: number }).durationMinutes!;
    }
    if (typeof f.durationSeconds === 'number') {
      return Math.round(f.durationSeconds / 60);
    }
    return 0;
  };

  const getFocusDate = (f: FocusSession | { startTime?: string; startedAt?: string }): string => {
    const ts = f.startedAt || (f as { startTime?: string }).startTime || '';
    return ts.slice(0, 10);
  };

  // Focus timer deduplication: ignore focus sessions that reference an already-logged workout or run
  const standaloneGymFocusMinutes = focusSessions
    .filter((f) => {
      const cat = f.category?.toLowerCase() || '';
      const isGym = cat === 'gym' || cat === 'workout' || cat === 'fitness';
      const isLinked = f.projectRef && (workoutIds.has(f.projectRef) || runIds.has(f.projectRef));
      return isGym && !isLinked;
    })
    .reduce((acc, f) => acc + getFocusMinutes(f), 0);

  const standaloneFootballFocusMinutes = focusSessions
    .filter((f) => {
      const cat = f.category?.toLowerCase() || '';
      const isFootball = cat === 'football';
      const isLinked = f.projectRef && workoutIds.has(f.projectRef);
      return isFootball && !isLinked;
    })
    .reduce((acc, f) => acc + getFocusMinutes(f), 0);

  const standaloneMobilityFocusMinutes = focusSessions
    .filter((f) => {
      const cat = f.category?.toLowerCase() || '';
      const isMobility = cat === 'mobility' || cat === 'stretching' || cat === 'walk';
      const isLinked = f.projectRef && workoutIds.has(f.projectRef);
      return isMobility && !isLinked;
    })
    .reduce((acc, f) => acc + getFocusMinutes(f), 0);

  // Segregate WorkoutSession durations by workoutType
  let gymDurationMinutes = standaloneGymFocusMinutes;
  let footballDurationMinutes = standaloneFootballFocusMinutes;
  let mobilityDurationMinutes = standaloneMobilityFocusMinutes;

  let workoutsCount = 0;
  let workoutsThisWeek = 0;
  let footballSessionsCount = 0;
  let footballSessionsThisWeek = 0;

  for (const w of workouts) {
    const wTime = new Date(w.startedAt).getTime();
    const isThisWeek = wTime >= sevenDaysAgoMs && wTime <= nowMs;

    if (w.workoutType === 'FOOTBALL') {
      footballSessionsCount++;
      footballDurationMinutes += w.durationMinutes || 0;
      if (isThisWeek) footballSessionsThisWeek++;
    } else if (w.workoutType === 'WALKING') {
      mobilityDurationMinutes += w.durationMinutes || 0;
    } else {
      // Gym / Resistance / General Workout
      workoutsCount++;
      gymDurationMinutes += w.durationMinutes || 0;
      if (isThisWeek) workoutsThisWeek++;
    }
  }

  // Running duration comes strictly from RunLog
  let runningDurationMinutes = 0;
  let totalDistanceKm = 0;
  let distanceThisWeekKm = 0;
  let fiveKmRunsCount = 0;
  let fiveKmRunsThisWeek = 0;
  let totalPaceSeconds = 0;
  let paceRunsCount = 0;

  for (const r of runs) {
    const rTime = new Date(r.startedAt).getTime();
    const isThisWeek = rTime >= sevenDaysAgoMs && rTime <= nowMs;
    const durMins = Math.round((r.durationSeconds || 0) / 60);

    runningDurationMinutes += durMins;
    totalDistanceKm += r.distanceKm || 0;

    if (isThisWeek) {
      distanceThisWeekKm += r.distanceKm || 0;
    }

    if ((r.distanceKm || 0) >= 5.0) {
      fiveKmRunsCount++;
      if (isThisWeek) fiveKmRunsThisWeek++;
    }

    if (r.paceMinKm && r.paceMinKm > 0) {
      totalPaceSeconds += r.paceMinKm;
      paceRunsCount++;
    }
  }

  const avgPaceMinKm = paceRunsCount > 0 ? Number((totalPaceSeconds / paceRunsCount).toFixed(2)) : null;

  // --- 2. Bench Press Weight Semantics ---
  // We evaluate bench press maxKg and maxPerSideKg without guessing unknown bar weights
  let benchPressMaxKg = 0;
  let benchPressMaxPerSideKg = 0;
  let benchPressBarWeightKg: number | null = null;

  for (const ex of exercises) {
    const name = (ex.exerciseName || (ex as any).name || '').toLowerCase();
    if (name.includes('bench press') || name.includes('benchpress') || name.includes('flat bench')) {
      if (ex.weightKg > benchPressMaxKg) {
        benchPressMaxKg = ex.weightKg;
      }
      if (ex.barWeightKg !== undefined) {
        benchPressBarWeightKg = ex.barWeightKg;
      }

      let perSide = ex.weightPerSideKg;
      if (perSide === undefined && ex.barWeightKg !== undefined) {
        perSide = calculatePerSideWeight(ex.weightKg, ex.barWeightKg);
      }
      if (perSide !== undefined && perSide > benchPressMaxPerSideKg) {
        benchPressMaxPerSideKg = perSide;
      }
    }
  }

  // --- 3. Cognitive Habits Deduplication ---
  // For each date d, max(focusMinutes, snapshotMinutes). Segregated from physical training.
  const mentalFocusByDate: Record<string, number> = {};
  for (const f of focusSessions) {
    const cat = f.category?.toLowerCase() || '';
    if (cat === 'mental' || cat === 'chess' || cat === 'sudoku' || cat === 'study') {
      const date = getFocusDate(f);
      if (date) {
        mentalFocusByDate[date] = (mentalFocusByDate[date] || 0) + getFocusMinutes(f);
      }
    }
  }

  const bioSnapshotsByDate: Record<string, DailyBioSnapshot> = {};
  for (const s of bioSnapshots) {
    bioSnapshotsByDate[s.date] = s;
  }

  const allCognitiveDates = new Set([...Object.keys(mentalFocusByDate), ...Object.keys(bioSnapshotsByDate)]);
  let cognitiveDurationMinutes = 0;
  let chessSudokuMinutesWeek = 0;

  for (const d of allCognitiveDates) {
    const dTime = new Date(d).getTime();
    const focusMins = mentalFocusByDate[d] || 0;
    const bioMins = bioSnapshotsByDate[d]?.chessSudokuMins || 0;
    const dayCognitive = Math.max(focusMins, bioMins);
    cognitiveDurationMinutes += dayCognitive;

    if (dTime >= sevenDaysAgoMs && dTime <= nowMs + 86400000) {
      chessSudokuMinutesWeek += dayCognitive;
    }
  }

  const totalActiveMinutes = gymDurationMinutes + runningDurationMinutes + footballDurationMinutes + mobilityDurationMinutes;

  // --- 4. Nutrition Aggregation & Averaging Windows ---
  // Day with meals logged = unique YYYY-MM-DD containing >= 1 meal
  const mealsByDate: Record<string, NutritionLog[]> = {};
  for (const m of nutrition) {
    const eatenAt = m.eatenAt || (m as any).createdAt || (m as any).timestamp;
    if (!eatenAt) continue;
    const date = String(eatenAt).slice(0, 10);
    if (!mealsByDate[date]) mealsByDate[date] = [];
    mealsByDate[date].push(m);
  }

  const uniqueActiveDates = Object.keys(mealsByDate);
  const daysWithMealsLogged = uniqueActiveDates.length;

  // Weekly active days (trailing 7 days)
  const weekActiveDates = uniqueActiveDates.filter((d) => {
    const dTime = new Date(d).getTime();
    return dTime >= sevenDaysAgoMs && dTime <= nowMs + 86400000;
  });

  let avgDailyCaloriesWeek: number | null = null;
  let avgDailyProteinWeek: number | null = null;

  if (weekActiveDates.length > 0) {
    let weekCals = 0;
    let weekProtein = 0;
    for (const d of weekActiveDates) {
      const dayMeals = mealsByDate[d];
      weekCals += dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
      weekProtein += dayMeals.reduce((sum, m) => sum + (m.proteinG || 0), 0);
    }
    avgDailyCaloriesWeek = Math.round(weekCals / weekActiveDates.length);
    avgDailyProteinWeek = Math.round(weekProtein / weekActiveDates.length);
  }

  // Today's nutrition
  const todayMeals = mealsByDate[todayStr] || [];
  const todayCalories = todayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const todayProteinG = todayMeals.reduce((sum, m) => sum + (m.proteinG || 0), 0);

  // Supplements
  const totalSupplementsTracked = supplements.length;
  const supplementsTakenToday = supplements.filter((s) => {
    if (!s.taken) return false;
    if (s.takenAt) return s.takenAt.slice(0, 10) === todayStr;
    return true; // Marked taken today if taken flag is true
  }).length;

  // --- 5. Bio / Sleep / Recovery ---
  const sortedSnapshots = [...bioSnapshots].sort((a, b) => b.date.localeCompare(a.date));
  const latestWeightKg = sortedSnapshots.find((s) => s.weightKg !== undefined)?.weightKg ?? null;

  // Weight delta over 30 days
  let weightDeltaMonthKg: number | null = null;
  if (latestWeightKg !== null) {
    const monthOldSnap = sortedSnapshots.find((s) => {
      const sTime = new Date(s.date).getTime();
      return sTime <= thirtyDaysAgoMs && s.weightKg !== undefined;
    });
    if (monthOldSnap?.weightKg !== undefined) {
      weightDeltaMonthKg = Number((latestWeightKg - monthOldSnap.weightKg).toFixed(1));
    }
  }

  // Sleep this week
  const weekSnapshots = bioSnapshots.filter((s) => {
    const sTime = new Date(s.date).getTime();
    return sTime >= sevenDaysAgoMs && sTime <= nowMs + 86400000;
  });

  const sleepDurationsHours: number[] = [];
  const sleepQualities: number[] = [];

  for (const s of weekSnapshots) {
    const calcMins = calculateSleepDurationMins(s.sleepBedtime, s.sleepWaketime);
    const effectiveMins = calcMins ?? s.sleepDurationMins ?? null;
    if (effectiveMins !== null && effectiveMins > 0) {
      sleepDurationsHours.push(effectiveMins / 60);
    }
    if (s.sleepQuality !== undefined && s.sleepQuality > 0) {
      sleepQualities.push(s.sleepQuality);
    }
  }

  const avgSleepHoursWeek = sleepDurationsHours.length > 0
    ? Number((sleepDurationsHours.reduce((a, b) => a + b, 0) / sleepDurationsHours.length).toFixed(1))
    : null;

  const avgSleepQualityWeek = sleepQualities.length > 0
    ? Number((sleepQualities.reduce((a, b) => a + b, 0) / sleepQualities.length).toFixed(1))
    : null;

  const sleepDeficitFlag = avgSleepHoursWeek !== null && avgSleepHoursWeek < 6.0 && sleepDurationsHours.length >= 2;

  // --- 6. Mathematical Fitness Adherence Score (0 to 100) ---
  // Strictly measures recorded habit adherence, NOT objective medical health.
  // 1. Training Consistency (max 30)
  let sTraining = 0;
  if (workoutsThisWeek >= 4) sTraining = 30;
  else if (workoutsThisWeek === 3) sTraining = 24;
  else if (workoutsThisWeek === 2) sTraining = 16;
  else if (workoutsThisWeek === 1) sTraining = 8;

  // 2. Cardio & Sports (max 25)
  let sCardio = 0;
  if (fiveKmRunsThisWeek >= 1 || distanceThisWeekKm >= 5.0) {
    sCardio += 15;
  } else if (distanceThisWeekKm > 0) {
    sCardio += Math.min(15, Math.round(distanceThisWeekKm * 3));
  }
  if (footballSessionsThisWeek >= 1) {
    sCardio += 10;
  }
  sCardio = Math.min(25, sCardio);

  // 3. Recovery & Sleep (max 25)
  let sRecovery = 0;
  if (avgSleepHoursWeek !== null) {
    if (avgSleepHoursWeek >= 7.5) sRecovery += 15;
    else if (avgSleepHoursWeek >= 7.0) sRecovery += 12;
    else if (avgSleepHoursWeek >= 6.0) sRecovery += 8;
    // < 6.0 hrs = 0 pts
  }
  if (avgSleepQualityWeek !== null) {
    if (avgSleepQualityWeek >= 8) sRecovery += 10;
    else if (avgSleepQualityWeek >= 6) sRecovery += 6;
    else sRecovery += 2;
  }
  sRecovery = Math.min(25, sRecovery);

  // 4. Nutrition & Habits (max 20)
  let sNutrition = 0;
  if (avgDailyProteinWeek !== null) {
    if (avgDailyProteinWeek >= 120) sNutrition += 10;
    else if (avgDailyProteinWeek >= 80) sNutrition += 6;
  }
  if (weekSnapshots.length >= 1) {
    sNutrition += 5; // Tracked bio/weight snapshot this week
  }
  if (chessSudokuMinutesWeek >= 15) {
    sNutrition += 5; // Maintained cognitive exercise habit
  }
  sNutrition = Math.min(20, sNutrition);

  const fitnessAdherenceScore = Math.min(100, Math.max(0, sTraining + sCardio + sRecovery + sNutrition));

  return {
    gymDurationMinutes,
    runningDurationMinutes,
    footballDurationMinutes,
    mobilityDurationMinutes,
    cognitiveDurationMinutes,
    totalActiveMinutes,

    workoutsCount,
    workoutsThisWeek,
    benchPressMaxKg,
    benchPressMaxPerSideKg,
    benchPressBarWeightKg,

    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    distanceThisWeekKm: Number(distanceThisWeekKm.toFixed(2)),
    fiveKmRunsCount,
    fiveKmRunsThisWeek,
    avgPaceMinKm,

    footballSessionsCount,
    footballSessionsThisWeek,

    daysWithMealsLogged,
    avgDailyCaloriesWeek,
    avgDailyProteinWeek,
    todayCalories,
    todayProteinG,
    supplementsTakenToday,
    totalSupplementsTracked,

    latestWeightKg,
    weightDeltaMonthKg,
    avgSleepHoursWeek,
    avgSleepQualityWeek,
    sleepDeficitFlag,

    chessSudokuMinutesWeek,

    fitnessAdherenceScore,
    adherenceScoreBreakdown: {
      trainingConsistency: sTraining,
      cardioAndSports: sCardio,
      recoveryAndSleep: sRecovery,
      nutritionAndHabits: sNutrition,
    },
  };
}

/**
 * Loads all fitness records from IndexedDB and calculates the KPI summary.
 */
export async function loadFitnessKpiSummary(now = new Date()): Promise<FitnessKpiSummary> {
  const [workouts, exercises, runs, nutrition, supplements, bioSnapshots, focusSessions] = await Promise.all([
    dbGetAll<WorkoutSession>(STORES.WORKOUTS),
    dbGetAll<ExerciseLog>(STORES.EXERCISES),
    dbGetAll<RunLog>(STORES.RUNS),
    dbGetAll<NutritionLog>(STORES.NUTRITION),
    dbGetAll<SupplementLog>(STORES.SUPPLEMENTS),
    dbGetAll<DailyBioSnapshot>(STORES.BIO_SNAPSHOTS),
    dbGetAll<FocusSession>(STORES.FOCUS_SESSIONS),
  ]);

  return computeFitnessKpiSummary(
    workouts,
    exercises,
    runs,
    nutrition,
    supplements,
    bioSnapshots,
    focusSessions,
    now
  );
}
