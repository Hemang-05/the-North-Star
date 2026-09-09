// ============================================================================
// PERSONAL OS — Time Aggregation Engine
// Authoritative calculation of time evidence from FocusSession records.
//
// Axioms:
//   "Time is evidence. Outcomes are evidence."
//   "FocusSessions represent intentional time spent; ActivityEvents represent events."
//   "Local calendar boundaries (Monday-Sunday, 1st-last day) are strictly preserved."
// ============================================================================

import type { FocusSession, PillarSlug } from '../types/core';
import type {
  TimePeriodType,
  PeriodBounds,
  PillarTimeDetail,
  TimeSummary,
} from '../types/intelligence';
import { PILLARS } from '../config/pillars';
import { dbGetAll, STORES } from './db';

// Top 3 priority pillars as defined by the OS hierarchy
export const TOP_PRIORITY_PILLARS: Set<PillarSlug> = new Set([
  'job_hunt',   // Priority 1
  'agency',     // Priority 2
  'trading_os', // Priority 3
]);

// Deep work threshold: 25 minutes uninterrupted focus
export const DEEP_WORK_THRESHOLD_SECONDS = 25 * 60;

/**
 * Calculates calendar-aligned current and preceding comparison periods.
 */
export function getPeriodBounds(
  type: TimePeriodType,
  refDate = new Date(),
  customRange?: { start: string; end: string }
): { current: PeriodBounds; previous: PeriodBounds } {
  const d = new Date(refDate);

  if (type === 'TODAY') {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - 1);

    return {
      current: {
        start: start.toISOString(),
        end: end.toISOString(),
        type,
        label: 'Today',
      },
      previous: {
        start: prevStart.toISOString(),
        end: prevEnd.toISOString(),
        type,
        label: 'Yesterday',
      },
    };
  }

  if (type === 'THIS_WEEK') {
    // Local Monday to Sunday
    const day = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);

    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - 7);

    return {
      current: {
        start: start.toISOString(),
        end: end.toISOString(),
        type,
        label: 'This Week',
      },
      previous: {
        start: prevStart.toISOString(),
        end: prevEnd.toISOString(),
        type,
        label: 'Last Week',
      },
    };
  }

  if (type === 'THIS_MONTH') {
    // 1st to last day of month
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0);
    const prevEnd = new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);

    return {
      current: {
        start: start.toISOString(),
        end: end.toISOString(),
        type,
        label: 'This Month',
      },
      previous: {
        start: prevStart.toISOString(),
        end: prevEnd.toISOString(),
        type,
        label: 'Last Month',
      },
    };
  }

  if (type === 'THIS_QUARTER') {
    const currentQ = Math.floor(d.getMonth() / 3);
    const start = new Date(d.getFullYear(), currentQ * 3, 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), (currentQ + 1) * 3, 0, 23, 59, 59, 999);

    const prevQStart = new Date(d.getFullYear(), (currentQ - 1) * 3, 1, 0, 0, 0, 0);
    const prevQEnd = new Date(d.getFullYear(), currentQ * 3, 0, 23, 59, 59, 999);

    return {
      current: {
        start: start.toISOString(),
        end: end.toISOString(),
        type,
        label: `Q${currentQ + 1}`,
      },
      previous: {
        start: prevQStart.toISOString(),
        end: prevQEnd.toISOString(),
        type,
        label: `Q${currentQ === 0 ? 4 : currentQ}`,
      },
    };
  }

  if (type === 'THIS_YEAR') {
    const start = new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

    const prevStart = new Date(d.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    const prevEnd = new Date(d.getFullYear() - 1, 11, 31, 23, 59, 59, 999);

    return {
      current: {
        start: start.toISOString(),
        end: end.toISOString(),
        type,
        label: `${d.getFullYear()}`,
      },
      previous: {
        start: prevStart.toISOString(),
        end: prevEnd.toISOString(),
        type,
        label: `${d.getFullYear() - 1}`,
      },
    };
  }

  // CUSTOM Range
  const startIso = customRange?.start || new Date(d.getTime() - 7 * 86400000).toISOString();
  const endIso = customRange?.end || d.toISOString();
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const durationMs = Math.max(86400000, endMs - startMs);

  const prevStart = new Date(startMs - durationMs);
  const prevEnd = new Date(startMs - 1);

  return {
    current: {
      start: startIso,
      end: endIso,
      type: 'CUSTOM',
      label: 'Custom Period',
    },
    previous: {
      start: prevStart.toISOString(),
      end: prevEnd.toISOString(),
      type: 'CUSTOM',
      label: 'Prior Period',
    },
  };
}

/**
 * Pure calculation of TimeSummary from raw FocusSession records.
 */
export function aggregateFocusSessions(
  sessions: FocusSession[],
  currentPeriod: PeriodBounds,
  previousPeriod?: PeriodBounds
): TimeSummary {
  // 1. Filter sessions for current period (must be STOPPED)
  const currentSessions = sessions.filter((s) => {
    if (s.status !== 'STOPPED') return false;
    const time = s.startedAt;
    return time >= currentPeriod.start && time <= currentPeriod.end;
  });

  // 2. Filter sessions for previous period if provided
  const prevSessions = previousPeriod
    ? sessions.filter((s) => {
        if (s.status !== 'STOPPED') return false;
        const time = s.startedAt;
        return time >= previousPeriod.start && time <= previousPeriod.end;
      })
    : [];

  // Group current sessions by pillar
  const sessionsByPillar: Record<string, FocusSession[]> = {};
  const prevMinutesByPillar: Record<string, number> = {};

  for (const p of PILLARS) {
    sessionsByPillar[p.id] = [];
    prevMinutesByPillar[p.id] = 0;
  }

  for (const s of currentSessions) {
    if (!sessionsByPillar[s.pillarId]) {
      sessionsByPillar[s.pillarId] = [];
    }
    sessionsByPillar[s.pillarId].push(s);
  }

  for (const s of prevSessions) {
    const mins = Math.floor((s.durationSeconds || 0) / 60);
    prevMinutesByPillar[s.pillarId] = (prevMinutesByPillar[s.pillarId] || 0) + mins;
  }

  // Calculate totals
  let totalDurationSeconds = 0;
  let deepWorkSeconds = 0;
  let deepWorkSessionCount = 0;
  let priorityAlignedSeconds = 0;
  let longestSessionSeconds = 0;
  const byCategory: Record<string, number> = {};
  const byPillar: Record<PillarSlug, number> = {
    job_hunt: 0,
    agency: 0,
    trading_os: 0,
    forex: 0,
    fitness: 0,
    voire: 0,
  };

  for (const s of currentSessions) {
    const dur = Math.max(0, s.durationSeconds || 0);
    totalDurationSeconds += dur;

    if (dur > longestSessionSeconds) {
      longestSessionSeconds = dur;
    }

    if (dur >= DEEP_WORK_THRESHOLD_SECONDS) {
      deepWorkSeconds += dur;
      deepWorkSessionCount++;
    }

    if (TOP_PRIORITY_PILLARS.has(s.pillarId)) {
      priorityAlignedSeconds += dur;
    }

    const cat = s.category || 'General';
    const catMins = Math.floor(dur / 60);
    byCategory[cat] = (byCategory[cat] || 0) + catMins;

    const pSlug = s.pillarId as PillarSlug;
    if (byPillar[pSlug] !== undefined) {
      byPillar[pSlug] += Math.floor(dur / 60);
    }
  }

  const totalMinutes = Math.floor(totalDurationSeconds / 60);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const sessionCount = currentSessions.length;
  const averageSessionMinutes = sessionCount > 0 ? Math.round(totalMinutes / sessionCount) : 0;
  const longestSessionMinutes = Math.floor(longestSessionSeconds / 60);
  const deepWorkMinutes = Math.floor(deepWorkSeconds / 60);
  const deepWorkRatioPercent = totalMinutes > 0 ? Math.round((deepWorkMinutes / totalMinutes) * 100) : 0;

  const priorityAlignedMinutes = Math.floor(priorityAlignedSeconds / 60);
  const priorityAlignedPercent = totalMinutes > 0 ? Math.round((priorityAlignedMinutes / totalMinutes) * 100) : 0;

  // Build pillar details
  const pillarDetails: PillarTimeDetail[] = PILLARS.map((p) => {
    const pSessions = sessionsByPillar[p.id] || [];
    const pSecs = pSessions.reduce((acc, cur) => acc + (cur.durationSeconds || 0), 0);
    const pMins = Math.floor(pSecs / 60);
    const pHours = Math.round((pMins / 60) * 10) / 10;
    const pCount = pSessions.length;
    const pAvg = pCount > 0 ? Math.round(pMins / pCount) : 0;
    const pLongest = pSessions.reduce((max, cur) => Math.max(max, Math.floor((cur.durationSeconds || 0) / 60)), 0);
    const pShare = totalMinutes > 0 ? Math.round((pMins / totalMinutes) * 1000) / 10 : 0;

    const pByCat: Record<string, number> = {};
    for (const s of pSessions) {
      const c = s.category || 'General';
      pByCat[c] = (pByCat[c] || 0) + Math.floor((s.durationSeconds || 0) / 60);
    }

    const prevMins = prevMinutesByPillar[p.id] || 0;
    let changePct: number | null = null;
    if (prevMins > 0) {
      changePct = Math.round(((pMins - prevMins) / prevMins) * 1000) / 10;
    } else if (prevMins === 0 && pMins > 0) {
      changePct = null; // New activity (division by zero avoided)
    } else if (prevMins === 0 && pMins === 0) {
      changePct = 0;
    }

    return {
      pillarId: p.id,
      title: p.title,
      color: p.color,
      priorityRank: p.priorityRank,
      minutes: pMins,
      hours: pHours,
      sharePercent: pShare,
      sessionCount: pCount,
      averageSessionMinutes: pAvg,
      longestSessionMinutes: pLongest,
      byCategory: pByCat,
      previousPeriodMinutes: prevMins,
      changePercent: changePct,
    };
  });

  // Overall previous period comparison
  const prevTotalSeconds = prevSessions.reduce((acc, cur) => acc + (cur.durationSeconds || 0), 0);
  const prevTotalMinutes = Math.floor(prevTotalSeconds / 60);
  let overallChangePercent: number | null = null;
  if (prevTotalMinutes > 0) {
    overallChangePercent = Math.round(((totalMinutes - prevTotalMinutes) / prevTotalMinutes) * 1000) / 10;
  }

  const prevPillarMins: Record<PillarSlug, number> = {
    job_hunt: prevMinutesByPillar.job_hunt || 0,
    agency: prevMinutesByPillar.agency || 0,
    trading_os: prevMinutesByPillar.trading_os || 0,
    forex: prevMinutesByPillar.forex || 0,
    fitness: prevMinutesByPillar.fitness || 0,
    voire: prevMinutesByPillar.voire || 0,
  };

  return {
    totalMinutes,
    totalHours,
    byPillar,
    pillarDetails,
    byCategory,
    sessionCount,
    averageSessionMinutes,
    longestSessionMinutes,
    deepWorkMinutes,
    deepWorkSessionCount,
    deepWorkRatioPercent,
    priorityAlignedMinutes,
    priorityAlignedPercent,
    period: currentPeriod,
    previousPeriod: previousPeriod
      ? {
          totalMinutes: prevTotalMinutes,
          byPillar: prevPillarMins,
        }
      : undefined,
    changePercent: overallChangePercent,
  };
}

/**
 * Loads all FocusSessions from IndexedDB.
 */
export async function loadAllFocusSessions(): Promise<FocusSession[]> {
  try {
    return await dbGetAll<FocusSession>(STORES.FOCUS_SESSIONS);
  } catch (err) {
    console.error('Failed to load focus sessions:', err);
    return [];
  }
}
