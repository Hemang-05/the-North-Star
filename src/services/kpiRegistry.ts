// ============================================================================
// PERSONAL OS — Universal Metric Registry
// Central catalog of measurable KPIs across the six pillars and North Star.
// Stable metricKey is the authoritative link between user Goals and reality.
// Axioms:
//   "I define what I want. The system measures what is actually happening."
//   "Metric keys are stable identifiers, not display labels."
// ============================================================================

import type { MetricDefinition, PillarSlug } from '../types';

export const METRIC_REGISTRY: MetricDefinition[] = [
  // ==========================================================================
  // PILLAR 1: JOB HUNT
  // ==========================================================================
  {
    metricKey: 'job_hunt.applicationsToday',
    name: 'Applications Today',
    description: 'Number of tailored or direct job applications submitted today',
    pillarId: 'job_hunt',
    unit: 'apps',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'DAILY',
    category: 'Pipeline Volume',
  },
  {
    metricKey: 'job_hunt.applicationsThisWeek',
    name: 'Weekly Applications',
    description: 'Number of job applications submitted in the current calendar week',
    pillarId: 'job_hunt',
    unit: 'apps',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'WEEKLY',
    category: 'Pipeline Volume',
  },
  {
    metricKey: 'job_hunt.applicationsThisMonth',
    name: 'Monthly Applications',
    description: 'Number of job applications submitted in the current calendar month',
    pillarId: 'job_hunt',
    unit: 'apps',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Pipeline Volume',
  },
  {
    metricKey: 'job_hunt.totalApplications',
    name: 'Total Applications All-Time',
    description: 'Total cumulative job applications submitted',
    pillarId: 'job_hunt',
    unit: 'apps',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'YEARLY',
    category: 'Pipeline Volume',
  },
  {
    metricKey: 'job_hunt.outreachThisWeek',
    name: 'Weekly Outbound Outreach',
    description: 'Direct recruiter, founder, or peer outbound messages sent this week',
    pillarId: 'job_hunt',
    unit: 'messages',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'WEEKLY',
    category: 'Outreach & Network',
  },
  {
    metricKey: 'job_hunt.interviewsReached',
    name: 'Interviews Reached',
    description: 'Total opportunities that advanced to screening, interview, or offer stages',
    pillarId: 'job_hunt',
    unit: 'interviews',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Pipeline Conversion',
  },
  {
    metricKey: 'job_hunt.offersReceived',
    name: 'Offers Received',
    description: 'Formal job offers received',
    pillarId: 'job_hunt',
    unit: 'offers',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'YEARLY',
    category: 'Pipeline Conversion',
  },
  {
    metricKey: 'job_hunt.focusTimeHoursThisWeek',
    name: 'Weekly Job Hunt Focus Hours',
    description: 'Hours spent in focused job hunt sessions (prep, outreach, coding) this week',
    pillarId: 'job_hunt',
    unit: 'hours',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'WEEKLY',
    category: 'Execution Focus',
  },

  // ==========================================================================
  // PILLAR 2: FREELANCE → AGENCY
  // ==========================================================================
  {
    metricKey: 'agency.realizedCash',
    name: 'Realized Cash (Money in Bank)',
    description: 'Authoritative sum of received payments for PAID client invoices',
    pillarId: 'agency',
    unit: '₹',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Financial Reality',
    isNorthStarContributor: true,
  },
  {
    metricKey: 'agency.billedRevenue',
    name: 'Billed Revenue',
    description: 'Sum of SENT, OVERDUE, and PAID invoices',
    pillarId: 'agency',
    unit: '₹',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Financial Reality',
  },
  {
    metricKey: 'agency.accountsReceivable',
    name: 'Accounts Receivable (Pending Collections)',
    description: 'Outstanding invoice amounts due from clients (SENT and OVERDUE)',
    pillarId: 'agency',
    unit: '₹',
    direction: 'LOWER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Financial Reality',
  },
  {
    metricKey: 'agency.activeClients',
    name: 'Active Retainer Clients',
    description: 'Number of active paying client accounts',
    pillarId: 'agency',
    unit: 'clients',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Client Operations',
  },
  {
    metricKey: 'agency.leadsThisWeek',
    name: 'Weekly Leads Generated',
    description: 'New agency prospects and leads acquired this week',
    pillarId: 'agency',
    unit: 'leads',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'WEEKLY',
    category: 'Sales Pipeline',
  },
  {
    metricKey: 'agency.proposalsThisWeek',
    name: 'Weekly Proposals Sent',
    description: 'Formal proposals or quotes delivered to qualified leads this week',
    pillarId: 'agency',
    unit: 'proposals',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'WEEKLY',
    category: 'Sales Pipeline',
  },
  {
    metricKey: 'agency.deliveryHours',
    name: 'Total Client Delivery Hours',
    description: 'Logged billable delivery hours dedicated to active client projects',
    pillarId: 'agency',
    unit: 'hours',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Client Operations',
  },

  // ==========================================================================
  // PILLAR 3: TRADING OS → SAAS
  // ==========================================================================
  {
    metricKey: 'saas.activeUsers',
    name: 'Active SaaS Users',
    description: 'Active users recorded in the latest snapshot',
    pillarId: 'trading_os',
    unit: 'users',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'User Traction',
  },
  {
    metricKey: 'saas.totalUsers',
    name: 'Total Registered Users',
    description: 'Total cumulative user signups recorded in the latest snapshot',
    pillarId: 'trading_os',
    unit: 'users',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'User Traction',
  },
  {
    metricKey: 'saas.payingUsers',
    name: 'Paying Subscribers',
    description: 'Paying customer count from latest snapshot',
    pillarId: 'trading_os',
    unit: 'subscribers',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Commercial Traction',
  },
  {
    metricKey: 'saas.mrr',
    name: 'Monthly Recurring Revenue (MRR)',
    description: 'Recurring monthly subscription run-rate recorded in latest snapshot',
    pillarId: 'trading_os',
    unit: '₹',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Commercial Traction',
    isNorthStarContributor: true,
  },
  {
    metricKey: 'saas.payingConversionRate',
    name: 'Paying-User Conversion Rate',
    description: 'Percentage of total users converted to paying subscribers',
    pillarId: 'trading_os',
    unit: '%',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Commercial Traction',
  },
  {
    metricKey: 'saas.featuresDone',
    name: 'Features Completed (DONE)',
    description: 'Number of roadmap features marked as completed and deployed',
    pillarId: 'trading_os',
    unit: 'features',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Product Build Loop',
  },
  {
    metricKey: 'saas.distributionThisWeek',
    name: 'Weekly Distribution Activities',
    description: 'Marketing, social posts, demos, or community outreach performed this week',
    pillarId: 'trading_os',
    unit: 'activities',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'WEEKLY',
    category: 'Distribution Loop',
  },

  // ==========================================================================
  // PILLAR 4: FOREX (LEARNING & DISCIPLINE ONLY — NO P&L GOALS!)
  // ==========================================================================
  {
    metricKey: 'forex.studyHoursMonth',
    name: 'Monthly Study Hours',
    description: 'Hours dedicated to curriculum, price action, and market structure study',
    pillarId: 'forex',
    unit: 'hours',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Education Loop',
  },
  {
    metricKey: 'forex.backtestedTrades',
    name: 'Backtested Trade Samples',
    description: 'Total backtested trade executions recorded across validated setups',
    pillarId: 'forex',
    unit: 'trades',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Backtesting Sample',
  },
  {
    metricKey: 'forex.ruleAdherenceRate',
    name: 'Rule Adherence Rate',
    description: 'Percentage of paper trade executions with zero critical rule breaks',
    pillarId: 'forex',
    unit: '%',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Discipline & Execution',
  },
  {
    metricKey: 'forex.validatedSetups',
    name: 'Validated Trading Setups',
    description: 'Number of playbook setups with complete statistical validation',
    pillarId: 'forex',
    unit: 'setups',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'QUARTERLY',
    category: 'Playbook',
  },
  {
    metricKey: 'forex.cleanTradeStreak',
    name: 'Clean Trade Streak',
    description: 'Consecutive disciplined paper trade executions without FOMO or rule breaks',
    pillarId: 'forex',
    unit: 'trades',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Discipline & Execution',
  },

  // ==========================================================================
  // PILLAR 5: FITNESS & HEALTH
  // ==========================================================================
  {
    metricKey: 'fitness.workoutsThisWeek',
    name: 'Weekly Resistance Workouts',
    description: 'Resistance training sessions completed in the trailing 7 days',
    pillarId: 'fitness',
    unit: 'workouts',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'WEEKLY',
    category: 'Training',
  },
  {
    metricKey: 'fitness.distanceThisWeekKm',
    name: 'Weekly Run Distance',
    description: 'Total kilometers logged running during the trailing 7 days',
    pillarId: 'fitness',
    unit: 'km',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'WEEKLY',
    category: 'Cardio & Running',
  },
  {
    metricKey: 'fitness.fiveKmRunsThisWeek',
    name: '5 km Runs Completed',
    description: 'Continuous running sessions of 5.0+ km completed this week',
    pillarId: 'fitness',
    unit: 'runs',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'WEEKLY',
    category: 'Cardio & Running',
  },
  {
    metricKey: 'fitness.avgDailyProteinWeek',
    name: 'Average Daily Protein Intake',
    description: 'Average daily protein consumed on logged days during the current week',
    pillarId: 'fitness',
    unit: 'g',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'DAILY',
    category: 'Nutrition',
  },
  {
    metricKey: 'fitness.benchPressMaxPerSideKg',
    name: 'Bench Press Max Per Side',
    description: 'Maximum weight loaded per side on the barbell flat bench press',
    pillarId: 'fitness',
    unit: 'kg/side',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'NORTH_STAR',
    category: 'Strength Targets',
  },
  {
    metricKey: 'fitness.latestWeightKg',
    name: 'Body Weight',
    description: 'Most recent recorded body weight snapshot',
    pillarId: 'fitness',
    unit: 'kg',
    direction: 'LOWER_IS_BETTER',
    defaultCadence: 'WEEKLY',
    category: 'Body Composition',
  },
  {
    metricKey: 'fitness.avgSleepHoursWeek',
    name: 'Average Nightly Sleep',
    description: 'Average sleep duration per night across logged days this week',
    pillarId: 'fitness',
    unit: 'hours',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'DAILY',
    category: 'Recovery & Bio',
  },

  // ==========================================================================
  // PILLAR 6: VOIRE (D2C / POD BRAND)
  // ==========================================================================
  {
    metricKey: 'voire.netSales',
    name: 'Net Sales Revenue',
    description: 'Gross merchandise sales minus discounts and refunds',
    pillarId: 'voire',
    unit: '₹',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Commercial Reality',
    isNorthStarContributor: true,
  },
  {
    metricKey: 'voire.cashReceived',
    name: 'Cash Received (Proceeds)',
    description: 'Actual collected payments received from customers for paid orders',
    pillarId: 'voire',
    unit: '₹',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Commercial Reality',
    isNorthStarContributor: true,
  },
  {
    metricKey: 'voire.contributionProfit',
    name: 'Net Contribution Profit',
    description: 'Net sales minus COGS production, shipping, marketing spend, and expenses',
    pillarId: 'voire',
    unit: '₹',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Commercial Reality',
  },
  {
    metricKey: 'voire.paidOrdersCount',
    name: 'Paid Customer Orders',
    description: 'Fulfilled or paid customer transactions',
    pillarId: 'voire',
    unit: 'orders',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Sales Traction',
  },
  {
    metricKey: 'voire.roas',
    name: 'Blended ROAS',
    description: 'Return on ad spend: Net Sales / Marketing Ad Spend',
    pillarId: 'voire',
    unit: 'x',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'MONTHLY',
    category: 'Marketing Efficiency',
  },
  {
    metricKey: 'voire.totalDesigns',
    name: 'Design Concepts in Studio',
    description: 'Cumulative artwork, silhouette, or graphic concepts created',
    pillarId: 'voire',
    unit: 'designs',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'QUARTERLY',
    category: 'Creative Studio',
  },
  {
    metricKey: 'voire.activeProducts',
    name: 'Active Catalog Product SKUs',
    description: 'Commercial-grade products live or ready in catalog',
    pillarId: 'voire',
    unit: 'SKUs',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'QUARTERLY',
    category: 'Product Catalog',
  },

  // ==========================================================================
  // NORTH STAR (TOP-LEVEL OS GOAL)
  // ==========================================================================
  {
    metricKey: 'north_star.financialProceeds',
    name: 'Cumulative Cash & Commercial Proceeds',
    description: 'Deterministic sum of collected cash flows: Agency Realized Cash + VOIRE Cash Received (actual money in bank)',
    pillarId: null,
    unit: '₹',
    direction: 'HIGHER_IS_BETTER',
    defaultCadence: 'NORTH_STAR',
    category: 'North Star',
  },
];

// Map lookup index for O(1) retrieval
const METRIC_MAP = new Map<string, MetricDefinition>(
  METRIC_REGISTRY.map((m) => [m.metricKey, m])
);

/**
 * Retrieve a metric definition by its unique metricKey.
 */
export function getMetricDefinition(metricKey: string): MetricDefinition | undefined {
  return METRIC_MAP.get(metricKey);
}

/**
 * Get all registered metric definitions in the OS.
 */
export function getAllMetricDefinitions(): MetricDefinition[] {
  return [...METRIC_REGISTRY];
}

/**
 * Filter registered metric definitions by owning pillar (or null for Global/North Star).
 */
export function getMetricsByPillar(pillarId: PillarSlug | null): MetricDefinition[] {
  return METRIC_REGISTRY.filter((m) => m.pillarId === pillarId);
}

/**
 * Validates if a metricKey is officially registered.
 */
export function isRegisteredMetric(metricKey: string): boolean {
  return METRIC_MAP.has(metricKey);
}
