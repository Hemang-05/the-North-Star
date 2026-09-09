// ============================================================================
// PERSONAL OS — SaaS KPI Engine
// Pure, deterministic metrics calculation for Pillar 3: Trading OS → SaaS.
// Separates Product/Build loop from Business/Distribution loop.
// ============================================================================

import { dbGetAll, STORES } from './db';
import type {
  SaasFeature,
  SaasTestRun,
  SaasRelease,
  SaasDistributionActivity,
  SaasUserMetricSnapshot,
  SaasFeedback,
  FocusSession,
  ActivityEvent,
  FeatureStatus,
  DistributionChannel,
  DistributionActivityType,
  FeedbackType,
} from '../types';
import { safePct } from '../utils/helpers';

export const ALL_FEATURE_STATUSES: FeatureStatus[] = [
  'IDEA',
  'PLANNED',
  'IN_PROGRESS',
  'TESTING',
  'DONE',
  'BLOCKED',
];

export const ALL_DISTRIBUTION_CHANNELS: DistributionChannel[] = [
  'LINKEDIN',
  'X',
  'REDDIT',
  'DISCORD',
  'COMMUNITY',
  'DIRECT_OUTREACH',
  'PRODUCT_HUNT',
  'CONTENT',
  'REFERRAL',
  'OTHER',
];

export interface SaasKpiSummary {
  // === PRODUCT / BUILD LOOP ===
  totalFeatures: number;
  featuresByStatus: Record<FeatureStatus, number>;
  featuresIdea: number;
  featuresPlanned: number;
  featuresInProgress: number;
  featuresTesting: number;
  featuresDone: number;
  featuresBlocked: number;
  featureCompletionRate: number | null; // % of features DONE

  // Testing & Quality
  totalTestRuns: number;
  passTestRuns: number;
  failTestRuns: number;
  blockedTestRuns: number;
  testPassRate: number | null; // % of tests PASS

  // Releases
  totalReleases: number;
  publishedReleases: number;
  latestRelease: SaasRelease | null;

  // Development & Testing Focus
  developmentFocusSeconds: number;
  testingFocusSeconds: number;

  // === BUSINESS / DISTRIBUTION LOOP ===
  totalDistributionActivities: number;
  distributionByChannel: Record<DistributionChannel, number>;
  distributionByActivityType: Record<DistributionActivityType, number>;
  distributionThisWeek: number;
  distributionThisMonth: number;
  distributionFocusSeconds: number;

  // === BUSINESS & USER TRACTION (SNAPSHOT-BASED) ===
  latestSnapshot: SaasUserMetricSnapshot | null;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  payingUsers: number;
  churnedUsers: number;
  revenue: number;
  recurringRevenue: number; // MRR
  payingConversionRate: number | null; // % (paying / total)
  activationRate: number | null;
  retentionRate: number | null;

  // === USER FEEDBACK ===
  totalFeedback: number;
  openFeedback: number;
  resolvedFeedback: number;
  criticalOrHighFeedback: number;
  feedbackByType: Record<FeedbackType, number>;

  // === PRODUCT VS DISTRIBUTION BALANCE (OBSERVED MEASUREMENT) ===
  buildEffortScore: number;
  distributionEffortScore: number;
  buildRatioPercent: number; // 0-100
  distributionRatioPercent: number; // 0-100
  balanceLabel: string; // e.g. "60% Build / 40% Distribution"

  // === FOCUS & ACTIVITY ===
  focusTimeTodaySeconds: number;
  focusTimeThisWeekSeconds: number;
  focusTimeTotalSeconds: number;
  focusTimeByCategory: Record<string, number>;
  daysActiveThisWeek: number;
}

/**
 * Pure calculation function for SaaS KPIs from in-memory arrays.
 */
export function computeSaasKpis(
  features: SaasFeature[] = [],
  tests: SaasTestRun[] = [],
  releases: SaasRelease[] = [],
  distribution: SaasDistributionActivity[] = [],
  snapshots: SaasUserMetricSnapshot[] = [],
  feedback: SaasFeedback[] = [],
  focusSessions: FocusSession[] = [],
  events: ActivityEvent[] = [],
  referenceDate: Date = new Date()
): SaasKpiSummary {
  const refTime = referenceDate.getTime();
  const oneWeekAgo = refTime - 7 * 86400 * 1000;
  const oneMonthAgo = refTime - 30 * 86400 * 1000;
  const todayStr = referenceDate.toISOString().split('T')[0];

  // 1. Feature Counts
  const featuresByStatus: Record<FeatureStatus, number> = {
    IDEA: 0,
    PLANNED: 0,
    IN_PROGRESS: 0,
    TESTING: 0,
    DONE: 0,
    BLOCKED: 0,
  };

  for (const f of features) {
    if (featuresByStatus[f.status] !== undefined) {
      featuresByStatus[f.status]++;
    }
  }

  const totalFeatures = features.length;
  const featuresDone = featuresByStatus.DONE;
  const featureCompletionRate = safePct(featuresDone, totalFeatures);

  // 2. Testing
  const totalTestRuns = tests.length;
  const passTestRuns = tests.filter((t) => t.result === 'PASS').length;
  const failTestRuns = tests.filter((t) => t.result === 'FAIL').length;
  const blockedTestRuns = tests.filter((t) => t.result === 'BLOCKED').length;
  const testPassRate = safePct(passTestRuns, totalTestRuns);

  // 3. Releases
  const totalReleases = releases.length;
  const publishedReleases = releases.filter((r) => r.status === 'PUBLISHED').length;
  const sortedReleases = [...releases].sort((a, b) => {
    const timeA = new Date(a.releasedAt || a.createdAt).getTime();
    const timeB = new Date(b.releasedAt || b.createdAt).getTime();
    return timeB - timeA;
  });
  const latestRelease = sortedReleases[0] || null;

  // 4. Focus Sessions
  let focusTimeTodaySeconds = 0;
  let focusTimeThisWeekSeconds = 0;
  let focusTimeTotalSeconds = 0;
  let developmentFocusSeconds = 0;
  let testingFocusSeconds = 0;
  let distributionFocusSeconds = 0;
  const focusTimeByCategory: Record<string, number> = {};
  const activeDaysSet = new Set<string>();

  for (const s of focusSessions) {
    if (s.pillarId === 'trading_os') {
      const dur = s.durationSeconds || 0;
      focusTimeTotalSeconds += dur;

      const cat = s.category || 'Product Development';
      focusTimeByCategory[cat] = (focusTimeByCategory[cat] || 0) + dur;

      const lowerCat = cat.toLowerCase();
      if (
        lowerCat.includes('dev') ||
        lowerCat.includes('product development') ||
        lowerCat.includes('bug fix')
      ) {
        developmentFocusSeconds += dur;
      } else if (lowerCat.includes('test')) {
        testingFocusSeconds += dur;
      } else if (lowerCat.includes('distribut') || lowerCat.includes('marketing')) {
        distributionFocusSeconds += dur;
      }

      if (s.startedAt) {
        const sTime = new Date(s.startedAt).getTime();
        const dateStr = s.startedAt.split('T')[0];
        if (dateStr === todayStr) {
          focusTimeTodaySeconds += dur;
        }
        if (sTime >= oneWeekAgo) {
          focusTimeThisWeekSeconds += dur;
          activeDaysSet.add(dateStr);
        }
      }
    }
  }

  // Count active days from events as well
  for (const e of events) {
    if (e.pillarId === 'trading_os' && e.occurredAt) {
      const eTime = new Date(e.occurredAt).getTime();
      if (eTime >= oneWeekAgo) {
        activeDaysSet.add(e.occurredAt.split('T')[0]);
      }
    }
  }

  const daysActiveThisWeek = activeDaysSet.size;

  // 5. Distribution Activities
  const distributionByChannel: Record<DistributionChannel, number> = {
    LINKEDIN: 0,
    X: 0,
    REDDIT: 0,
    DISCORD: 0,
    COMMUNITY: 0,
    DIRECT_OUTREACH: 0,
    PRODUCT_HUNT: 0,
    CONTENT: 0,
    REFERRAL: 0,
    OTHER: 0,
  };

  const distributionByActivityType: Record<DistributionActivityType, number> = {
    POST: 0,
    DEMO: 0,
    OUTREACH: 0,
    COMMUNITY: 0,
    CONTENT: 0,
    LAUNCH: 0,
    PARTNERSHIP: 0,
    OTHER: 0,
  };

  let distributionThisWeek = 0;
  let distributionThisMonth = 0;

  for (const d of distribution) {
    if (distributionByChannel[d.channel] !== undefined) {
      distributionByChannel[d.channel]++;
    }
    if (distributionByActivityType[d.activityType] !== undefined) {
      distributionByActivityType[d.activityType]++;
    }
    const dTime = new Date(d.createdAt).getTime();
    if (dTime >= oneWeekAgo) distributionThisWeek++;
    if (dTime >= oneMonthAgo) distributionThisMonth++;
  }

  const totalDistributionActivities = distribution.length;

  // 6. User Snapshots (Latest observation)
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const timeA = new Date(a.recordedAt || a.createdAt).getTime();
    const timeB = new Date(b.recordedAt || b.createdAt).getTime();
    return timeB - timeA;
  });
  const latestSnapshot = sortedSnapshots[0] || null;

  const totalUsers = latestSnapshot ? latestSnapshot.totalUsers || 0 : 0;
  const activeUsers = latestSnapshot ? latestSnapshot.activeUsers || 0 : 0;
  const newUsers = latestSnapshot ? latestSnapshot.newUsers || 0 : 0;
  const payingUsers = latestSnapshot ? latestSnapshot.payingUsers || 0 : 0;
  const churnedUsers = latestSnapshot ? latestSnapshot.churnedUsers || 0 : 0;
  const revenue = latestSnapshot ? latestSnapshot.revenue || 0 : 0;
  const recurringRevenue = latestSnapshot ? latestSnapshot.recurringRevenue || 0 : 0;

  const payingConversionRate = safePct(payingUsers, totalUsers);
  const activationRate = latestSnapshot?.activationRate ?? safePct(activeUsers, totalUsers);
  const retentionRate = latestSnapshot?.retentionRate ?? (totalUsers > 0 ? safePct(totalUsers - churnedUsers, totalUsers) : null);

  // 7. Feedback
  const feedbackByType: Record<FeedbackType, number> = {
    BUG: 0,
    FEATURE_REQUEST: 0,
    UX: 0,
    PERFORMANCE: 0,
    OTHER: 0,
  };

  let openFeedback = 0;
  let resolvedFeedback = 0;
  let criticalOrHighFeedback = 0;

  for (const fb of feedback) {
    if (feedbackByType[fb.feedbackType] !== undefined) {
      feedbackByType[fb.feedbackType]++;
    }
    if (fb.status === 'RESOLVED') {
      resolvedFeedback++;
    } else {
      openFeedback++;
      if (fb.severity === 'CRITICAL' || fb.severity === 'HIGH') {
        criticalOrHighFeedback++;
      }
    }
  }

  // 8. Product vs Distribution Balance
  // Build Effort = Product focus minutes + feature activity count
  // Distribution Effort = Distribution focus minutes + distribution activity count
  const productFocusMinutes = Math.floor(developmentFocusSeconds / 60);
  const distributionFocusMinutes = Math.floor(distributionFocusSeconds / 60);

  // Count relevant events
  let featureEventCount = totalFeatures + tests.length + releases.length;
  let distributionEventCount = totalDistributionActivities;

  const buildEffortScore = productFocusMinutes + featureEventCount;
  const distributionEffortScore = distributionFocusMinutes + distributionEventCount;
  const totalEffort = buildEffortScore + distributionEffortScore;

  let buildRatioPercent = 50;
  let distributionRatioPercent = 50;
  if (totalEffort > 0) {
    buildRatioPercent = Math.round((buildEffortScore / totalEffort) * 100);
    distributionRatioPercent = 100 - buildRatioPercent;
  }

  const balanceLabel = `${buildRatioPercent}% Build / ${distributionRatioPercent}% Distribution`;

  return {
    totalFeatures,
    featuresByStatus,
    featuresIdea: featuresByStatus.IDEA,
    featuresPlanned: featuresByStatus.PLANNED,
    featuresInProgress: featuresByStatus.IN_PROGRESS,
    featuresTesting: featuresByStatus.TESTING,
    featuresDone: featuresByStatus.DONE,
    featuresBlocked: featuresByStatus.BLOCKED,
    featureCompletionRate,
    totalTestRuns,
    passTestRuns,
    failTestRuns,
    blockedTestRuns,
    testPassRate,
    totalReleases,
    publishedReleases,
    latestRelease,
    developmentFocusSeconds,
    testingFocusSeconds,
    totalDistributionActivities,
    distributionByChannel,
    distributionByActivityType,
    distributionThisWeek,
    distributionThisMonth,
    distributionFocusSeconds,
    latestSnapshot,
    totalUsers,
    activeUsers,
    newUsers,
    payingUsers,
    churnedUsers,
    revenue,
    recurringRevenue,
    payingConversionRate,
    activationRate,
    retentionRate,
    totalFeedback: feedback.length,
    openFeedback,
    resolvedFeedback,
    criticalOrHighFeedback,
    feedbackByType,
    buildEffortScore,
    distributionEffortScore,
    buildRatioPercent,
    distributionRatioPercent,
    balanceLabel,
    focusTimeTodaySeconds,
    focusTimeThisWeekSeconds,
    focusTimeTotalSeconds,
    focusTimeByCategory,
    daysActiveThisWeek,
  };
}

/**
 * Loads all entities from IndexedDB and calculates live SaaS KPIs.
 */
export async function loadSaasKpiSummary(): Promise<SaasKpiSummary> {
  const [features, tests, releases, distribution, snapshots, feedback, focusSessions, events] =
    await Promise.all([
      dbGetAll<SaasFeature>(STORES.SAAS_FEATURES),
      dbGetAll<SaasTestRun>(STORES.SAAS_TEST_RUNS),
      dbGetAll<SaasRelease>(STORES.SAAS_RELEASES),
      dbGetAll<SaasDistributionActivity>(STORES.SAAS_DISTRIBUTION),
      dbGetAll<SaasUserMetricSnapshot>(STORES.SAAS_USER_SNAPSHOTS),
      dbGetAll<SaasFeedback>(STORES.SAAS_FEEDBACK),
      dbGetAll<FocusSession>(STORES.FOCUS_SESSIONS),
      dbGetAll<ActivityEvent>(STORES.EVENTS),
    ]);

  return computeSaasKpis(
    features,
    tests,
    releases,
    distribution,
    snapshots,
    feedback,
    focusSessions,
    events
  );
}
