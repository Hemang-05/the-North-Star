// ============================================================================
// PERSONAL OS — IndexedDB Database Service
// Local-first storage engine for all Personal OS data.
// ============================================================================

import type { ActivityEvent, FocusSession, Goal } from '../types';

const DB_NAME = 'PersonalOS';
const DB_VERSION = 9;

// Store names
export const STORES = {
  EVENTS: 'activityEvents',
  FOCUS_SESSIONS: 'focusSessions',
  GOALS: 'goals',
  // Pillar-specific stores
  JOB_OPPORTUNITIES: 'jobOpportunities',
  JOB_APPLICATIONS: 'jobApplications',
  JOB_OUTREACH: 'jobOutreach',
  JOB_INTERVIEWS: 'jobInterviews',
  CAREER_CAPITAL: 'careerCapital',
  AGENCY_CLIENTS: 'agencyClients',
  AGENCY_PROJECTS: 'agencyProjects',
  AGENCY_LEADS: 'agencyLeads',
  AGENCY_INVOICES: 'agencyInvoices',
  SAAS_FEATURES: 'saasFeatures',
  SAAS_TEST_RUNS: 'saasTestRuns',
  SAAS_RELEASES: 'saasReleases',
  SAAS_DISTRIBUTION: 'saasDistribution',
  SAAS_USER_SNAPSHOTS: 'saasUserSnapshots',
  SAAS_FEEDBACK: 'saasFeedback',
  FOREX_STUDY: 'forexStudy',
  FOREX_SETUPS: 'forexSetups',
  FOREX_BACKTESTS: 'forexBacktests',
  FOREX_PAPER_TRADES: 'forexPaperTrades',
  NUTRITION: 'nutrition',
  SUPPLEMENTS: 'supplements',
  WORKOUTS: 'workouts',
  EXERCISES: 'exercises',
  RUNS: 'runs',
  BIO_SNAPSHOTS: 'bioSnapshots',
  VOIRE_DESIGNS: 'voireDesigns',
  VOIRE_PRODUCTS: 'voireProducts',
  VOIRE_DROPS: 'voireDrops',
  VOIRE_ORDERS: 'voireOrders',
  VOIRE_ORDER_ITEMS: 'voireOrderItems',
  VOIRE_MARKETING: 'voireMarketing',
  VOIRE_FINANCIAL_PERIODS: 'voireFinancialPeriods',
  AI_REVIEWS: 'aiReviews',
} as const;


let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction!;

      // Activity Events — indexed by pillar, time, and type
      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const eventStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
        eventStore.createIndex('by_pillar', 'pillarId', { unique: false });
        eventStore.createIndex('by_time', 'occurredAt', { unique: false });
        eventStore.createIndex('by_type', 'eventType', { unique: false });
        eventStore.createIndex('by_pillar_time', ['pillarId', 'occurredAt'], { unique: false });
      }

      // Focus Sessions
      if (!db.objectStoreNames.contains(STORES.FOCUS_SESSIONS)) {
        const focusStore = db.createObjectStore(STORES.FOCUS_SESSIONS, { keyPath: 'id' });
        focusStore.createIndex('by_pillar', 'pillarId', { unique: false });
        focusStore.createIndex('by_start', 'startedAt', { unique: false });
        focusStore.createIndex('by_status', 'status', { unique: false });
      }

      // Goals
      if (!db.objectStoreNames.contains(STORES.GOALS)) {
        const goalStore = db.createObjectStore(STORES.GOALS, { keyPath: 'id' });
        goalStore.createIndex('by_pillar', 'pillarId', { unique: false });
        goalStore.createIndex('by_cadence', 'cadence', { unique: false });
      }

      // Dedicated Job Interviews store
      if (!db.objectStoreNames.contains(STORES.JOB_INTERVIEWS)) {
        const interviewStore = db.createObjectStore(STORES.JOB_INTERVIEWS, { keyPath: 'id' });
        interviewStore.createIndex('by_opportunity', 'opportunityId', { unique: false });
        interviewStore.createIndex('by_schedule', 'scheduledAt', { unique: false });
      }

      // Create all pillar-specific stores with id keyPath
      const simpleStores = [
        STORES.JOB_OPPORTUNITIES, STORES.JOB_APPLICATIONS, STORES.JOB_OUTREACH,
        STORES.CAREER_CAPITAL, STORES.AGENCY_CLIENTS, STORES.AGENCY_PROJECTS,
        STORES.AGENCY_LEADS, STORES.AGENCY_INVOICES, STORES.SAAS_FEATURES,
        STORES.SAAS_TEST_RUNS, STORES.SAAS_RELEASES, STORES.SAAS_DISTRIBUTION,
        STORES.SAAS_USER_SNAPSHOTS, STORES.SAAS_FEEDBACK, STORES.FOREX_STUDY, STORES.FOREX_SETUPS,
        STORES.FOREX_BACKTESTS, STORES.FOREX_PAPER_TRADES, STORES.NUTRITION,
        STORES.SUPPLEMENTS, STORES.WORKOUTS, STORES.EXERCISES, STORES.RUNS,
        STORES.BIO_SNAPSHOTS, STORES.VOIRE_DESIGNS, STORES.VOIRE_PRODUCTS,
        STORES.VOIRE_DROPS, STORES.VOIRE_ORDERS, STORES.VOIRE_ORDER_ITEMS,
        STORES.VOIRE_MARKETING, STORES.VOIRE_FINANCIAL_PERIODS,
        STORES.AI_REVIEWS,
      ];


      for (const storeName of simpleStores) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      }

      // Add indexes to existing stores if missing
      try {
        if (db.objectStoreNames.contains(STORES.JOB_OPPORTUNITIES)) {
          const oppStore = tx.objectStore(STORES.JOB_OPPORTUNITIES);
          if (!oppStore.indexNames.contains('by_stage')) {
            oppStore.createIndex('by_stage', 'stage', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.JOB_APPLICATIONS)) {
          const appStore = tx.objectStore(STORES.JOB_APPLICATIONS);
          if (!appStore.indexNames.contains('by_opportunity')) {
            appStore.createIndex('by_opportunity', 'opportunityId', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.JOB_OUTREACH)) {
          const outStore = tx.objectStore(STORES.JOB_OUTREACH);
          if (!outStore.indexNames.contains('by_opportunity')) {
            outStore.createIndex('by_opportunity', 'opportunityId', { unique: false });
          }
        }
      } catch (e) {
        console.warn('Index creation notice:', e);
      }

      // Add Agency-specific secondary indexes (v3+)
      try {
        if (db.objectStoreNames.contains(STORES.AGENCY_PROJECTS)) {
          const projStore = tx.objectStore(STORES.AGENCY_PROJECTS);
          if (!projStore.indexNames.contains('by_client')) {
            projStore.createIndex('by_client', 'clientId', { unique: false });
          }
          if (!projStore.indexNames.contains('by_status')) {
            projStore.createIndex('by_status', 'status', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.AGENCY_INVOICES)) {
          const invStore = tx.objectStore(STORES.AGENCY_INVOICES);
          if (!invStore.indexNames.contains('by_client')) {
            invStore.createIndex('by_client', 'clientId', { unique: false });
          }
          if (!invStore.indexNames.contains('by_project')) {
            invStore.createIndex('by_project', 'projectId', { unique: false });
          }
          if (!invStore.indexNames.contains('by_status')) {
            invStore.createIndex('by_status', 'status', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.AGENCY_LEADS)) {
          const leadStore = tx.objectStore(STORES.AGENCY_LEADS);
          if (!leadStore.indexNames.contains('by_stage')) {
            leadStore.createIndex('by_stage', 'stage', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.AGENCY_CLIENTS)) {
          const clientStore = tx.objectStore(STORES.AGENCY_CLIENTS);
          if (!clientStore.indexNames.contains('by_status')) {
            clientStore.createIndex('by_status', 'status', { unique: false });
          }
        }
      } catch (e) {
        console.warn('Agency index creation notice:', e);
      }

      // Add SaaS-specific secondary indexes (v4+)
      try {
        if (db.objectStoreNames.contains(STORES.SAAS_FEATURES)) {
          const featStore = tx.objectStore(STORES.SAAS_FEATURES);
          if (!featStore.indexNames.contains('by_status')) {
            featStore.createIndex('by_status', 'status', { unique: false });
          }
          if (!featStore.indexNames.contains('by_priority')) {
            featStore.createIndex('by_priority', 'priority', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.SAAS_TEST_RUNS)) {
          const testStore = tx.objectStore(STORES.SAAS_TEST_RUNS);
          if (!testStore.indexNames.contains('by_featureId')) {
            testStore.createIndex('by_featureId', 'featureId', { unique: false });
          }
          if (!testStore.indexNames.contains('by_result')) {
            testStore.createIndex('by_result', 'result', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.SAAS_RELEASES)) {
          const relStore = tx.objectStore(STORES.SAAS_RELEASES);
          if (!relStore.indexNames.contains('by_status')) {
            relStore.createIndex('by_status', 'status', { unique: false });
          }
          if (!relStore.indexNames.contains('by_releasedAt')) {
            relStore.createIndex('by_releasedAt', 'releasedAt', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.SAAS_DISTRIBUTION)) {
          const distStore = tx.objectStore(STORES.SAAS_DISTRIBUTION);
          if (!distStore.indexNames.contains('by_channel')) {
            distStore.createIndex('by_channel', 'channel', { unique: false });
          }
          if (!distStore.indexNames.contains('by_activityType')) {
            distStore.createIndex('by_activityType', 'activityType', { unique: false });
          }
          if (!distStore.indexNames.contains('by_createdAt')) {
            distStore.createIndex('by_createdAt', 'createdAt', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.SAAS_USER_SNAPSHOTS)) {
          const userStore = tx.objectStore(STORES.SAAS_USER_SNAPSHOTS);
          if (!userStore.indexNames.contains('by_recordedAt')) {
            userStore.createIndex('by_recordedAt', 'recordedAt', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.SAAS_FEEDBACK)) {
          const feedStore = tx.objectStore(STORES.SAAS_FEEDBACK);
          if (!feedStore.indexNames.contains('by_status')) {
            feedStore.createIndex('by_status', 'status', { unique: false });
          }
          if (!feedStore.indexNames.contains('by_severity')) {
            feedStore.createIndex('by_severity', 'severity', { unique: false });
          }
          if (!feedStore.indexNames.contains('by_featureId')) {
            feedStore.createIndex('by_featureId', 'relatedFeatureId', { unique: false });
          }
        }
      } catch (e) {
        console.warn('SaaS index creation notice:', e);
      }

      // Add Forex-specific secondary indexes (v5+)
      try {
        if (db.objectStoreNames.contains(STORES.FOREX_STUDY)) {
          const studyStore = tx.objectStore(STORES.FOREX_STUDY);
          if (!studyStore.indexNames.contains('by_curriculumPhase')) {
            studyStore.createIndex('by_curriculumPhase', 'curriculumPhase', { unique: false });
          }
          if (!studyStore.indexNames.contains('by_studiedAt')) {
            studyStore.createIndex('by_studiedAt', 'studiedAt', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.FOREX_SETUPS)) {
          const setupStore = tx.objectStore(STORES.FOREX_SETUPS);
          if (!setupStore.indexNames.contains('by_status')) {
            setupStore.createIndex('by_status', 'status', { unique: false });
          }
          if (!setupStore.indexNames.contains('by_timeframe')) {
            setupStore.createIndex('by_timeframe', 'timeframe', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.FOREX_BACKTESTS)) {
          const btStore = tx.objectStore(STORES.FOREX_BACKTESTS);
          if (!btStore.indexNames.contains('by_setupId')) {
            btStore.createIndex('by_setupId', 'setupId', { unique: false });
          }
          if (!btStore.indexNames.contains('by_backtestedAt')) {
            btStore.createIndex('by_backtestedAt', 'backtestedAt', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.FOREX_PAPER_TRADES)) {
          const ptStore = tx.objectStore(STORES.FOREX_PAPER_TRADES);
          if (!ptStore.indexNames.contains('by_setupId')) {
            ptStore.createIndex('by_setupId', 'setupId', { unique: false });
          }
          if (!ptStore.indexNames.contains('by_result')) {
            ptStore.createIndex('by_result', 'result', { unique: false });
          }
          if (!ptStore.indexNames.contains('by_ruleAdhered')) {
            ptStore.createIndex('by_ruleAdhered', 'ruleAdhered', { unique: false });
          }
          if (!ptStore.indexNames.contains('by_mistakeTag')) {
            ptStore.createIndex('by_mistakeTag', 'mistakeTag', { unique: false });
          }
          if (!ptStore.indexNames.contains('by_tradedAt')) {
            ptStore.createIndex('by_tradedAt', 'tradedAt', { unique: false });
          }
        }
      } catch (e) {
        console.warn('Forex index creation notice:', e);
      }

      // Add Fitness-specific secondary indexes (v6+)
      try {
        if (db.objectStoreNames.contains(STORES.WORKOUTS)) {
          const wStore = tx.objectStore(STORES.WORKOUTS);
          if (!wStore.indexNames.contains('by_workoutType')) {
            wStore.createIndex('by_workoutType', 'workoutType', { unique: false });
          }
          if (!wStore.indexNames.contains('by_startedAt')) {
            wStore.createIndex('by_startedAt', 'startedAt', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.EXERCISES)) {
          const exStore = tx.objectStore(STORES.EXERCISES);
          if (!exStore.indexNames.contains('by_workoutId')) {
            exStore.createIndex('by_workoutId', 'workoutId', { unique: false });
          }
          if (!exStore.indexNames.contains('by_exerciseName')) {
            exStore.createIndex('by_exerciseName', 'exerciseName', { unique: false });
          }
          if (!exStore.indexNames.contains('by_isPR')) {
            exStore.createIndex('by_isPR', 'isPR', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.RUNS)) {
          const runStore = tx.objectStore(STORES.RUNS);
          if (!runStore.indexNames.contains('by_startedAt')) {
            runStore.createIndex('by_startedAt', 'startedAt', { unique: false });
          }
          if (!runStore.indexNames.contains('by_distanceKm')) {
            runStore.createIndex('by_distanceKm', 'distanceKm', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.NUTRITION)) {
          const nutStore = tx.objectStore(STORES.NUTRITION);
          if (!nutStore.indexNames.contains('by_eatenAt')) {
            nutStore.createIndex('by_eatenAt', 'eatenAt', { unique: false });
          }
          if (!nutStore.indexNames.contains('by_mealType')) {
            nutStore.createIndex('by_mealType', 'mealType', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.SUPPLEMENTS)) {
          const suppStore = tx.objectStore(STORES.SUPPLEMENTS);
          if (!suppStore.indexNames.contains('by_takenAt')) {
            suppStore.createIndex('by_takenAt', 'takenAt', { unique: false });
          }
          if (!suppStore.indexNames.contains('by_supplement')) {
            suppStore.createIndex('by_supplement', 'supplement', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.BIO_SNAPSHOTS)) {
          const bioStore = tx.objectStore(STORES.BIO_SNAPSHOTS);
          if (!bioStore.indexNames.contains('by_date')) {
            bioStore.createIndex('by_date', 'date', { unique: false });
          }
        }
      } catch (e) {
        console.warn('Fitness index creation notice:', e);
      }

      // Add VOIRE-specific secondary indexes (v7+)
      try {
        if (db.objectStoreNames.contains(STORES.VOIRE_DESIGNS)) {
          const desStore = tx.objectStore(STORES.VOIRE_DESIGNS);
          if (!desStore.indexNames.contains('by_stage')) {
            desStore.createIndex('by_stage', 'stage', { unique: false });
          }
          if (!desStore.indexNames.contains('by_createdAt')) {
            desStore.createIndex('by_createdAt', 'createdAt', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.VOIRE_PRODUCTS)) {
          const prodStore = tx.objectStore(STORES.VOIRE_PRODUCTS);
          if (!prodStore.indexNames.contains('by_status')) {
            prodStore.createIndex('by_status', 'status', { unique: false });
          }
          if (!prodStore.indexNames.contains('by_designId')) {
            prodStore.createIndex('by_designId', 'designId', { unique: false });
          }
          if (!prodStore.indexNames.contains('by_category')) {
            prodStore.createIndex('by_category', 'category', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.VOIRE_DROPS)) {
          const dropStore = tx.objectStore(STORES.VOIRE_DROPS);
          if (!dropStore.indexNames.contains('by_status')) {
            dropStore.createIndex('by_status', 'status', { unique: false });
          }
          if (!dropStore.indexNames.contains('by_launchDate')) {
            dropStore.createIndex('by_launchDate', 'launchDate', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.VOIRE_ORDERS)) {
          const ordStore = tx.objectStore(STORES.VOIRE_ORDERS);
          if (!ordStore.indexNames.contains('by_status')) {
            ordStore.createIndex('by_status', 'status', { unique: false });
          }
          if (!ordStore.indexNames.contains('by_paymentStatus')) {
            ordStore.createIndex('by_paymentStatus', 'paymentStatus', { unique: false });
          }
          if (!ordStore.indexNames.contains('by_orderedAt')) {
            ordStore.createIndex('by_orderedAt', 'orderedAt', { unique: false });
          }
          if (!ordStore.indexNames.contains('by_attributedCampaignId')) {
            ordStore.createIndex('by_attributedCampaignId', 'attributedCampaignId', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.VOIRE_ORDER_ITEMS)) {
          const itemStore = tx.objectStore(STORES.VOIRE_ORDER_ITEMS);
          if (!itemStore.indexNames.contains('by_orderId')) {
            itemStore.createIndex('by_orderId', 'orderId', { unique: false });
          }
          if (!itemStore.indexNames.contains('by_productId')) {
            itemStore.createIndex('by_productId', 'productId', { unique: false });
          }
          if (!itemStore.indexNames.contains('by_dropId')) {
            itemStore.createIndex('by_dropId', 'dropId', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.VOIRE_MARKETING)) {
          const mktStore = tx.objectStore(STORES.VOIRE_MARKETING);
          if (!mktStore.indexNames.contains('by_channel')) {
            mktStore.createIndex('by_channel', 'channel', { unique: false });
          }
          if (!mktStore.indexNames.contains('by_publishedAt')) {
            mktStore.createIndex('by_publishedAt', 'publishedAt', { unique: false });
          }
          if (!mktStore.indexNames.contains('by_linkedDropId')) {
            mktStore.createIndex('by_linkedDropId', 'linkedDropId', { unique: false });
          }
        }
        if (db.objectStoreNames.contains(STORES.VOIRE_FINANCIAL_PERIODS)) {
          const finStore = tx.objectStore(STORES.VOIRE_FINANCIAL_PERIODS);
          if (!finStore.indexNames.contains('by_startDate')) {
            finStore.createIndex('by_startDate', 'startDate', { unique: false });
          }
        }
      } catch (e) {
        console.warn('VOIRE index creation notice:', e);
      }

      // OS Layer 1: Universal ActivityEvent System Migration (v8+)
      try {
        if (event.oldVersion < 8 && db.objectStoreNames.contains(STORES.EVENTS)) {
          const eventStore = tx.objectStore(STORES.EVENTS);
          const cursorReq = eventStore.openCursor();
          cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              const val = cursor.value as Record<string, unknown>;
              let modified = false;

              if (!val.schemaVersion) {
                val.schemaVersion = 1;
                modified = true;
              }

              if (!val.source) {
                val.source = (typeof val.eventType === 'string' && val.eventType.startsWith('FOCUS_SESSION'))
                  ? 'TIMER'
                  : 'USER';
                modified = true;
              }

              const fallbackTime = (val.timestamp as string) || new Date().toISOString();
              if (!val.occurredAt) {
                val.occurredAt = fallbackTime;
                modified = true;
              }
              if (!val.createdAt) {
                val.createdAt = val.occurredAt || fallbackTime;
                modified = true;
              }

              if (!val.entityRef && (val.entityRefType && val.entityRefId)) {
                val.entityRef = {
                  type: val.entityRefType,
                  id: val.entityRefId,
                };
                modified = true;
              }

              if (typeof val.quantity !== 'number') {
                val.quantity = 1;
                modified = true;
              }

              if (modified) {
                cursor.update(val);
              }
              cursor.continue();
            }
          };
        }
      } catch (e) {
        console.warn('ActivityEvent migration notice:', e);
      }
    };


    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };
  });
}

// --- Generic CRUD Operations ---

export async function dbPut<T extends { id: string }>(
  storeName: string,
  item: T
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
}

export async function dbGet<T>(
  storeName: string,
  id: string
): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function dbDelete(storeName: string, id: string): Promise<void> {
  if (storeName === STORES.EVENTS) {
    return Promise.reject(new Error('ActivityEvents are immutable and cannot be deleted.'));
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function dbGetByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function dbCount(storeName: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Specialized Queries ---

export async function getEventsByPillarAndTimeRange(
  pillarId: string,
  startTime: string,
  endTime: string
): Promise<ActivityEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVENTS, 'readonly');
    const store = tx.objectStore(STORES.EVENTS);
    const index = store.index('by_pillar_time');
    const range = IDBKeyRange.bound([pillarId, startTime], [pillarId, endTime]);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result as ActivityEvent[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getEventsByTimeRange(
  startTime: string,
  endTime: string
): Promise<ActivityEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVENTS, 'readonly');
    const store = tx.objectStore(STORES.EVENTS);
    const index = store.index('by_time');
    const range = IDBKeyRange.bound(startTime, endTime);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result as ActivityEvent[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getRecentEvents(limit: number = 50): Promise<ActivityEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVENTS, 'readonly');
    const store = tx.objectStore(STORES.EVENTS);
    const index = store.index('by_time');
    const results: ActivityEvent[] = [];

    const request = index.openCursor(null, 'prev');
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as ActivityEvent);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getFocusSessionsByPillar(
  pillarId: string
): Promise<FocusSession[]> {
  return dbGetByIndex<FocusSession>(STORES.FOCUS_SESSIONS, 'by_pillar', pillarId);
}

export async function getActiveTimer(): Promise<FocusSession | null> {
  const running = await dbGetByIndex<FocusSession>(
    STORES.FOCUS_SESSIONS,
    'by_status',
    'RUNNING'
  );
  if (running.length > 0) return running[0];

  const paused = await dbGetByIndex<FocusSession>(
    STORES.FOCUS_SESSIONS,
    'by_status',
    'PAUSED'
  );
  if (paused.length > 0) return paused[0];

  return null;
}

export async function getGoalsByPillar(pillarId: string): Promise<Goal[]> {
  return dbGetByIndex<Goal>(STORES.GOALS, 'by_pillar', pillarId);
}

// --- Initialize DB on import ---
export const initDB = openDB;
