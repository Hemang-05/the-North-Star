// ============================================================================
// PERSONAL OS — useDatabase hook
// Reactive data access layer with automatic re-fetching.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  dbGetAll,
  dbPut,
  dbDelete,
  getRecentEvents,
  getEventsByTimeRange,
  getActiveTimer,
  STORES,
} from '../services/db';
import type { ActivityEvent, FocusSession, Goal, LogEventInput, ActivityEventType, ActivityEntityType } from '../types';
import { generateId, now, startOfToday, endOfToday } from '../utils/helpers';
import type { PillarSlug } from '../types';

// Simple event bus for cross-component reactivity
type Listener = () => void;
const listeners = new Set<Listener>();
export function notifyDataChange() {
  listeners.forEach((fn) => fn());
}
export function useDataChangeListener(callback: Listener) {
  useEffect(() => {
    listeners.add(callback);
    return () => { listeners.delete(callback); };
  }, [callback]);
}

// --- Activity Events ---
export function useRecentEvents(limit: number = 30) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getRecentEvents(limit);
    setEvents(data);
    setLoading(false);
  }, [limit]);

  useEffect(() => { refresh(); }, [refresh]);
  useDataChangeListener(refresh);

  return { events, loading, refresh };
}

export function useTodayEvents() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getEventsByTimeRange(startOfToday(), endOfToday());
    setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useDataChangeListener(refresh);

  return { events, loading, refresh };
}

export interface LogEventOptions {
  quantity?: number;
  unit?: string;
  entityRefType?: string;
  entityRefId?: string;
  metadata?: Record<string, unknown>;
}

export async function logEvent(
  inputOrPillar: LogEventInput | PillarSlug,
  legacyEventType?: ActivityEventType | string,
  arg3?: number | Record<string, unknown> | LogEventOptions,
  unit?: string,
  entityRefType?: string,
  entityRefId?: string,
  metadata?: Record<string, unknown>
): Promise<ActivityEvent> {
  const timestamp = now();

  // Canonical object signature: logEvent({ pillarId, eventType, ... })
  if (typeof inputOrPillar === 'object' && 'pillarId' in inputOrPillar) {
    const input = inputOrPillar;
    const event: ActivityEvent = {
      id: generateId('evt'),
      pillarId: input.pillarId,
      eventType: input.eventType,
      occurredAt: input.occurredAt || timestamp,
      createdAt: timestamp,
      source: input.source || 'USER',
      quantity: input.quantity ?? 1,
      unit: input.unit,
      entityRef: input.entityRef,
      entityRefType: input.entityRef?.type,
      entityRefId: input.entityRef?.id,
      metadata: input.metadata,
      schemaVersion: 1,
    };

    await dbPut(STORES.EVENTS, event);
    notifyDataChange();
    return event;
  }

  // Legacy fallback support for transitional positional callers
  const pillarId = inputOrPillar as PillarSlug;
  const eventType = legacyEventType as ActivityEventType;
  let quantity = 1;
  let finalUnit: string | undefined = unit;
  let finalRefType: string | undefined = entityRefType;
  let finalRefId: string | undefined = entityRefId;
  let finalMeta: Record<string, unknown> | undefined = metadata;

  if (typeof arg3 === 'number') {
    quantity = arg3;
  } else if (arg3 && typeof arg3 === 'object') {
    if ('quantity' in arg3 || 'entityRefType' in arg3 || 'entityRefId' in arg3 || 'unit' in arg3) {
      const opts = arg3 as LogEventOptions;
      quantity = opts.quantity ?? 1;
      finalUnit = opts.unit;
      finalRefType = opts.entityRefType;
      finalRefId = opts.entityRefId;
      finalMeta = opts.metadata;
    } else {
      finalMeta = arg3 as Record<string, unknown>;
    }
  }

  const entityRef = (finalRefType && finalRefId)
    ? { type: finalRefType as ActivityEntityType, id: finalRefId }
    : undefined;

  const event: ActivityEvent = {
    id: generateId('evt'),
    pillarId,
    eventType,
    occurredAt: timestamp,
    createdAt: timestamp,
    source: eventType.startsWith('FOCUS_SESSION') ? 'TIMER' : 'USER',
    quantity,
    unit: finalUnit,
    entityRef,
    entityRefType: finalRefType,
    entityRefId: finalRefId,
    metadata: finalMeta,
    schemaVersion: 1,
  };

  await dbPut(STORES.EVENTS, event);
  notifyDataChange();
  return event;
}

// --- Focus Sessions ---
export function useActiveTimer() {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const active = await getActiveTimer();
    setSession(active);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useDataChangeListener(refresh);

  // Tick timer
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (session && session.status === 'RUNNING') {
      const computeElapsed = () => {
        const started = new Date(session.startedAt).getTime();
        const total = Math.floor((Date.now() - started) / 1000) - session.pausedSeconds;
        setElapsed(Math.max(0, total));
      };
      computeElapsed();
      intervalRef.current = setInterval(computeElapsed, 1000);
    } else if (session && session.status === 'PAUSED') {
      // Show frozen elapsed
      if (session.pausedAt) {
        const started = new Date(session.startedAt).getTime();
        const pauseTime = new Date(session.pausedAt).getTime();
        const total = Math.floor((pauseTime - started) / 1000) - session.pausedSeconds;
        setElapsed(Math.max(0, total));
      }
    } else {
      setElapsed(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session]);

  const startTimer = useCallback(async (
    pillarId: PillarSlug,
    category: string,
    subcategory?: string,
    projectRef?: string,
  ) => {
    const newSession: FocusSession = {
      id: generateId('foc'),
      pillarId,
      category,
      subcategory,
      projectRef,
      startedAt: now(),
      durationSeconds: 0,
      pausedSeconds: 0,
      status: 'RUNNING',
    };
    await dbPut(STORES.FOCUS_SESSIONS, newSession);
    notifyDataChange();
  }, []);

  const pauseTimer = useCallback(async () => {
    if (!session || session.status !== 'RUNNING') return;
    const updated: FocusSession = {
      ...session,
      status: 'PAUSED',
      pausedAt: now(),
    };
    await dbPut(STORES.FOCUS_SESSIONS, updated);
    notifyDataChange();
  }, [session]);

  const resumeTimer = useCallback(async () => {
    if (!session || session.status !== 'PAUSED' || !session.pausedAt) return;
    const pauseDuration = Math.floor(
      (Date.now() - new Date(session.pausedAt).getTime()) / 1000
    );
    const updated: FocusSession = {
      ...session,
      status: 'RUNNING',
      pausedSeconds: session.pausedSeconds + pauseDuration,
      pausedAt: undefined,
    };
    await dbPut(STORES.FOCUS_SESSIONS, updated);
    notifyDataChange();
  }, [session]);

  const stopTimer = useCallback(async () => {
    if (!session) return;
    let finalPausedSeconds = session.pausedSeconds;
    if (session.status === 'PAUSED' && session.pausedAt) {
      finalPausedSeconds += Math.floor(
        (Date.now() - new Date(session.pausedAt).getTime()) / 1000
      );
    }
    const endTime = now();
    const totalDuration = Math.floor(
      (new Date(endTime).getTime() - new Date(session.startedAt).getTime()) / 1000
    ) - finalPausedSeconds;

    const updated: FocusSession = {
      ...session,
      status: 'STOPPED',
      endedAt: endTime,
      durationSeconds: Math.max(0, totalDuration),
      pausedSeconds: finalPausedSeconds,
      pausedAt: undefined,
    };
    await dbPut(STORES.FOCUS_SESSIONS, updated);

    // Also log as activity event
    await logEvent({
      pillarId: session.pillarId,
      eventType: 'FOCUS_SESSION_COMPLETED',
      source: 'TIMER',
      quantity: updated.durationSeconds,
      unit: 'seconds',
      entityRef: {
        type: 'FocusSession',
        id: session.id,
      },
      metadata: {
        category: session.category,
        subcategory: session.subcategory,
        durationSeconds: updated.durationSeconds,
      },
    });

    notifyDataChange();
  }, [session]);

  return { session, elapsed, startTimer, pauseTimer, resumeTimer, stopTimer, refresh };
}

// --- Focus Session History ---
export function useFocusSessions() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await dbGetAll<FocusSession>(STORES.FOCUS_SESSIONS);
    const stopped = all.filter((s) => s.status === 'STOPPED');
    stopped.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    setSessions(stopped);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useDataChangeListener(refresh);

  return { sessions, loading };
}

// --- Goals ---
export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await dbGetAll<Goal>(STORES.GOALS);
    setGoals(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useDataChangeListener(refresh);

  const addGoal = useCallback(async (goal: Omit<Goal, 'id' | 'createdAt' | 'currentComputedValue'>) => {
    const goalId = generateId('goal');
    const newGoal: Goal = {
      ...goal,
      id: goalId,
      currentComputedValue: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    await dbPut(STORES.GOALS, newGoal);

    // Canonical ActivityEvent logging
    await logEvent({
      pillarId: newGoal.pillarId || 'agency', // default fallback if null North Star
      eventType: 'GOAL_CREATED',
      source: 'USER',
      entityRef: {
        type: 'Goal',
        id: goalId,
      },
      metadata: {
        title: newGoal.title,
        targetValue: newGoal.targetValue,
        unit: newGoal.unit,
        cadence: newGoal.cadence,
        metricKey: newGoal.metricKey,
      },
    });

    notifyDataChange();
    return newGoal;
  }, []);

  const updateGoal = useCallback(async (goal: Goal) => {
    const updated: Goal = {
      ...goal,
      updatedAt: now(),
    };
    await dbPut(STORES.GOALS, updated);

    // Log update event
    await logEvent({
      pillarId: updated.pillarId || 'agency',
      eventType: updated.isActive === false ? 'GOAL_DEACTIVATED' : 'GOAL_UPDATED',
      source: 'USER',
      entityRef: {
        type: 'Goal',
        id: updated.id,
      },
      metadata: {
        title: updated.title,
        targetValue: updated.targetValue,
        cadence: updated.cadence,
        metricKey: updated.metricKey,
      },
    });

    notifyDataChange();
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    const existing = goals.find((g) => g.id === id);
    await dbDelete(STORES.GOALS, id);

    if (existing) {
      await logEvent({
        pillarId: existing.pillarId || 'agency',
        eventType: 'GOAL_DEACTIVATED',
        source: 'USER',
        entityRef: {
          type: 'Goal',
          id,
        },
        metadata: {
          title: existing.title,
          deleted: true,
        },
      });
    }

    notifyDataChange();
  }, [goals]);

  return { goals, loading, addGoal, updateGoal, deleteGoal };
}

// --- Generic Entity CRUD ---
export function useStore<T extends { id: string }>(storeName: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await dbGetAll<T>(storeName);
    setItems(data);
    setLoading(false);
  }, [storeName]);

  useEffect(() => { refresh(); }, [refresh]);
  useDataChangeListener(refresh);

  const add = useCallback(async (item: T) => {
    await dbPut(storeName, item);
    notifyDataChange();
    return item;
  }, [storeName]);

  const update = useCallback(async (item: T) => {
    await dbPut(storeName, item);
    notifyDataChange();
  }, [storeName]);

  const remove = useCallback(async (id: string) => {
    await dbDelete(storeName, id);
    notifyDataChange();
  }, [storeName]);

  return { items, loading, add, update, remove, refresh };
}
