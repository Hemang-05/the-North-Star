// ============================================================================
// PERSONAL OS — CORE UNIVERSAL TYPES
// These entities are shared across ALL six pillars.
// ============================================================================

// --- Pillar Registry ---
export type PillarSlug =
  | 'job_hunt'
  | 'agency'
  | 'trading_os'
  | 'forex'
  | 'fitness'
  | 'voire';

export interface Pillar {
  id: PillarSlug;
  title: string;
  icon: string;
  color: string;
  priorityRank: number; // 1 = highest
  activeDays: number[]; // 0=Sun, 1=Mon ... 6=Sat. Empty = all days.
  isActive: boolean;
}

// --- Universal ActivityEvent Contract (Append-Only Ledger) ---
export type ActivityEventSource =
  | 'USER'
  | 'SYSTEM'
  | 'TIMER'
  | 'IMPORT';

export type JobHuntEventType =
  | 'JOB_OPPORTUNITY_DISCOVERED'
  | 'JOB_APPLICATION_SUBMITTED'
  | 'JOB_OUTREACH_SENT'
  | 'JOB_REPLY_RECEIVED'
  | 'JOB_INTERVIEW_BOOKED'
  | 'JOB_INTERVIEW_SCHEDULED'
  | 'JOB_INTERVIEW_COMPLETED'
  | 'JOB_ASSESSMENT_DONE'
  | 'JOB_OFFER_RECEIVED'
  | 'JOB_REJECTED'
  | 'JOB_WITHDRAWN'
  | 'JOB_GHOSTED'
  | 'CAREER_CAPITAL_LOGGED';

export type AgencyEventType =
  | 'AGENCY_CLIENT_CALL'
  | 'AGENCY_PROPOSAL_SENT'
  | 'AGENCY_PAYMENT_RECEIVED'
  | 'AGENCY_LEAD_FOUND'
  | 'AGENCY_LEAD_QUALIFIED'
  | 'AGENCY_LEAD_CONTACTED'
  | 'AGENCY_LEAD_REPLIED'
  | 'AGENCY_LEAD_CALL'
  | 'AGENCY_LEAD_PROPOSAL'
  | 'AGENCY_LEAD_NEGOTIATION'
  | 'AGENCY_LEAD_WON'
  | 'AGENCY_LEAD_LOST'
  | 'AGENCY_LEAD_NOT_INTERESTED'
  | 'AGENCY_LEAD_NO_RESPONSE'
  | 'AGENCY_INVOICE_CREATED'
  | 'AGENCY_INVOICE_PAID'
  | 'AGENCY_CLIENT_ADDED'
  | 'AGENCY_CLIENT_WON'
  | 'AGENCY_PROJECT_CREATED'
  | 'AGENCY_PROJECT_PROPOSAL'
  | 'AGENCY_PROJECT_ACTIVE'
  | 'AGENCY_PROJECT_DELIVERED'
  | 'AGENCY_PROJECT_PAID'
  | 'AGENCY_PROJECT_ON_HOLD'
  | 'AGENCY_PROJECT_CANCELLED'
  | 'AGENCY_DELIVERABLE_DONE'
  | 'AGENCY_FOLLOW_UP';

export type SaasEventType =
  | 'SAAS_FEATURE_CREATED'
  | 'SAAS_FEATURE_STATUS_CHANGED'
  | 'SAAS_FEATURE_STARTED'
  | 'SAAS_FEATURE_TESTED'
  | 'SAAS_FEATURE_COMPLETED'
  | 'SAAS_FEATURE_BLOCKED'
  | 'SAAS_BUG_FIXED'
  | 'SAAS_TEST_RUN'
  | 'SAAS_RELEASE_CREATED'
  | 'SAAS_RELEASE_PUBLISHED'
  | 'SAAS_DISTRIBUTION_ACTIVITY'
  | 'SAAS_USER_METRIC_RECORDED'
  | 'SAAS_USER_REGISTERED'
  | 'SAAS_CONTENT_PUBLISHED'
  | 'SAAS_FEEDBACK_RECEIVED'
  | 'SAAS_FEEDBACK_RESOLVED'
  | 'SAAS_VERSION_RELEASED';

export type ForexEventType =
  | 'FOREX_STUDY_SESSION'
  | 'FOREX_SETUP_DOCUMENTED'
  | 'FOREX_BACKTEST_RUN'
  | 'FOREX_PAPER_TRADE'
  | 'FOREX_RULE_VIOLATION';

export type FitnessEventType =
  | 'FITNESS_MEAL_LOGGED'
  | 'FITNESS_RUN_COMPLETED'
  | 'FITNESS_WORKOUT_DONE'
  | 'FITNESS_WEIGHT_LOGGED'
  | 'FITNESS_SUPPLEMENT_TAKEN'
  | 'FITNESS_SLEEP_LOGGED'
  | 'FITNESS_FOOTBALL_MATCH'
  | 'FITNESS_FOOTBALL_PRACTICE'
  | 'FITNESS_COGNITIVE_SESSION';

export type VoireEventType =
  | 'VOIRE_DESIGN_IDEA'
  | 'VOIRE_DESIGN_CREATED'
  | 'VOIRE_DESIGN_UPDATED'
  | 'VOIRE_DESIGN_STAGE_CHANGED'
  | 'VOIRE_DESIGN_APPROVED'
  | 'VOIRE_PRODUCT_CREATED'
  | 'VOIRE_PRODUCT_UPDATED'
  | 'VOIRE_DROP_CREATED'
  | 'VOIRE_DROP_UPDATED'
  | 'VOIRE_DROP_LAUNCHED'
  | 'VOIRE_ORDER_RECORDED'
  | 'VOIRE_ORDER_RECEIVED'
  | 'VOIRE_PAYMENT_STATUS_UPDATED'
  | 'VOIRE_MARKETING_CAMPAIGN_LOGGED'
  | 'VOIRE_CAMPAIGN_CREATED'
  | 'VOIRE_CAMPAIGN_UPDATED'
  | 'VOIRE_FINANCIAL_PERIOD_LOGGED'
  | 'VOIRE_CONTENT_POSTED'
  | 'VOIRE_EXPENSE_LOGGED'
  | 'VOIRE_SAMPLE_READY'
  | 'DESIGN_CREATED'
  | 'DESIGN_UPDATED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'DROP_CREATED'
  | 'DROP_UPDATED'
  | 'ORDER_RECORDED'
  | 'PAYMENT_STATUS_UPDATED'
  | 'CAMPAIGN_CREATED'
  | 'CAMPAIGN_UPDATED'
  | 'FINANCIAL_PERIOD_LOGGED';

export type CoreEventType =
  | 'FOCUS_SESSION_STARTED'
  | 'FOCUS_SESSION_COMPLETED'
  | 'GOAL_CREATED'
  | 'GOAL_UPDATED'
  | 'GOAL_STATUS_CHANGED';

export type ActivityEventType =
  | JobHuntEventType
  | AgencyEventType
  | SaasEventType
  | ForexEventType
  | FitnessEventType
  | VoireEventType
  | CoreEventType;

export type ActivityEntityType =
  | 'JobOpportunity'
  | 'JOB_OPPORTUNITY'
  | 'JobApplication'
  | 'JOB_APPLICATION'
  | 'JobOutreach'
  | 'JOB_OUTREACH'
  | 'JobInterview'
  | 'JOB_INTERVIEW'
  | 'CareerCapital'
  | 'CAREER_CAPITAL'
  | 'AgencyClient'
  | 'AgencyProject'
  | 'AgencyLead'
  | 'AgencyInvoice'
  | 'SaasFeature'
  | 'SaasTestRun'
  | 'SaasRelease'
  | 'SaasDistributionActivity'
  | 'SaasUserMetricSnapshot'
  | 'SaasFeedback'
  | 'ForexStudySession'
  | 'ForexSetup'
  | 'ForexBacktestBatch'
  | 'ForexPaperTrade'
  | 'WorkoutSession'
  | 'ExerciseLog'
  | 'RunLog'
  | 'NutritionLog'
  | 'SupplementLog'
  | 'BioSnapshot'
  | 'VoireDesign'
  | 'VOIRE_DESIGN'
  | 'VoireProduct'
  | 'VOIRE_PRODUCT'
  | 'VoireDrop'
  | 'VOIRE_DROP'
  | 'VoireOrder'
  | 'VOIRE_ORDER'
  | 'VoireOrderItem'
  | 'VOIRE_ORDER_ITEM'
  | 'VoireMarketingCampaign'
  | 'VOIRE_MARKETING_CAMPAIGN'
  | 'VoireFinancialPeriod'
  | 'VOIRE_FINANCIAL_PERIOD'
  | 'Goal'
  | 'FocusSession';

export interface ActivityEvent {
  id: string;
  pillarId: PillarSlug;
  eventType: ActivityEventType;
  occurredAt: string; // ISO 8601
  createdAt: string;  // ISO 8601
  source: ActivityEventSource;
  quantity: number;
  unit?: string;
  entityRef?: {
    type: ActivityEntityType;
    id: string;
  };
  // Deprecated legacy fields preserved during migration
  entityRefType?: string;
  entityRefId?: string;
  metadata?: Record<string, unknown>;
  schemaVersion: number;
}

export interface LogEventInput {
  pillarId: PillarSlug;
  eventType: ActivityEventType;
  occurredAt?: string;
  quantity?: number;
  unit?: string;
  source?: ActivityEventSource;
  entityRef?: {
    type: ActivityEntityType;
    id: string;
  };
  metadata?: Record<string, unknown>;
}

// --- Focus Timer ---
export type FocusSessionStatus = 'RUNNING' | 'PAUSED' | 'STOPPED';

export interface FocusSession {
  id: string;
  pillarId: PillarSlug;
  category: string;
  subcategory?: string;
  projectRef?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  pausedSeconds: number;
  status: FocusSessionStatus;
  pausedAt?: string; // when current pause started
}

// --- Goals & North Star ---
export type GoalTargetType = 'CURRENCY' | 'COUNT' | 'PERCENT' | 'STAGE' | 'BOOLEAN';
export type GoalCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'NORTH_STAR' | 'CUSTOM';
export type MetricDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'TARGET_RANGE' | 'MILESTONE';
export type KpiValueState = 'AVAILABLE' | 'NO_DATA';
export type GoalStatus = 'NOT_STARTED' | 'BEHIND' | 'ON_TRACK' | 'AHEAD' | 'ACHIEVED' | 'NO_DATA';

export interface Goal {
  id: string;
  metricKey?: string; // Stable identifier into MetricRegistry
  pillarId: PillarSlug | null; // null = global North Star
  title: string;
  description?: string;
  targetType: GoalTargetType;
  targetValue: number;
  currentComputedValue: number; // Cached/materialized value for backward compatibility
  currentValue?: number; // Optional alias used in some components
  unit?: string;
  cadence: GoalCadence;
  direction?: MetricDirection;
  targetDate?: string;
  startDate?: string;
  endDate?: string;
  weight: number; // relative importance 0-100
  isActive: boolean;
  status?: 'ACTIVE' | 'ARCHIVED'; // Lifecycle status
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

// --- Metric Definitions (Code Calculates) ---
export type AggregationFn = 'SUM' | 'COUNT' | 'AVG' | 'RATE' | 'PIPELINE_CONVERSION' | 'LATEST';

export interface MetricDefinition {
  metricKey: string;
  name: string;
  description?: string;
  pillarId: PillarSlug | null;
  unit: string;
  direction: MetricDirection;
  defaultCadence: GoalCadence;
  category?: string;
  isNorthStarContributor?: boolean;
  // Backward compatibility fields
  id?: string;
  label?: string;
  formulaDescription?: string;
  aggregationFn?: AggregationFn;
  targetGoalId?: string;
}

// --- Universal Goal & KPI Snapshot (Deterministic Ground Truth for Reports & AI) ---
export interface GoalKpiSnapshot {
  goalId: string;
  title: string;
  metricKey: string;
  pillarId: PillarSlug | null;
  period: {
    start: string;
    end: string;
    cadence: GoalCadence;
  };
  target: number;
  current: number | null;
  state: KpiValueState;
  unit?: string;
  progress: number | null; // e.g. 0.4 for 40%
  progressPercent: number | null; // e.g. 40 for 40%
  gap: number | null;
  status: GoalStatus;
  direction: MetricDirection;
}

// --- AI Reviews (AI Judges & Explains) ---
export type ReviewType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'GOAL' | 'NORTH_STAR' | 'BRUTAL' | 'QUERY';
export type StatusVerdict = 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'NEGLECTED' | 'EXCEEDING';

export interface AIReview {
  id: string;
  reviewType: ReviewType;
  periodStart: string;
  periodEnd: string;
  factsPayload?: Record<string, unknown>; // deterministic numbers fed to AI
  rawMarkdownReport?: string;
  statusVerdict?: StatusVerdict;
  contradictions?: string[];
  // Layer 4 Extensions
  mode?: string;
  pillarId?: string;
  goalId?: string;
  userQueryHash?: string;
  contextHash?: string;
  contextVersion?: string;
  provider?: string;
  model?: string;
  analysis?: unknown; // AIAnalysis
  createdAt: string;
}

// --- User Query ("Ask My Personal OS") ---
export interface UserQuery {
  id: string;
  prompt: string;
  retrievedFactsContext?: Record<string, unknown>;
  aiResponse: string;
  createdAt: string;
}

// --- Time helpers ---
export interface TimeWindow {
  start: string;
  end: string;
}
