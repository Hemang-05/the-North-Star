// ============================================================================
// PERSONAL OS — PILLAR-SPECIFIC TYPES
// Domain entities for each of the six pillars.
// ============================================================================

// ======================
// PILLAR 1: JOB HUNT
// ======================
export type JobStage =
  | 'DISCOVERED'
  | 'APPLIED'
  | 'OUTREACH'
  | 'REPLIED'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'ASSESSMENT'
  | 'FINAL_ROUND'
  | 'OFFER'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'GHOSTED';

export type WorkMode = 'REMOTE' | 'HYBRID' | 'ONSITE';
export type CustomizationLevel = 'QUICK' | 'TAILORED' | 'DEEP';
export type OutreachContactType = 'FOUNDER' | 'RECRUITER' | 'HR' | 'PEER' | 'OTHER';
export type OutreachChannel = 'LINKEDIN' | 'EMAIL' | 'TWITTER' | 'REFERRAL' | 'OTHER';
export type CareerAssetType = 'PORTFOLIO_PROJECT' | 'GITHUB_REPO' | 'RESUME_VERSION' | 'ARTICLE' | 'OPEN_SOURCE' | 'INTERVIEW_PREP';
export type CareerAssetStatus = 'ACTIVE' | 'IN_PROGRESS' | 'PLANNED' | 'ARCHIVED';

export interface JobOpportunity {
  id: string;
  company: string;
  role: string;
  source: string;
  discoveredAt: string;
  jobUrl?: string;
  location?: string;
  workMode: WorkMode;
  stage: JobStage;
  minSalary?: number;
  maxSalary?: number;
  currency: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplication {
  id: string;
  opportunityId: string;
  company?: string;
  role?: string;
  appliedAt: string;
  method: string;
  resumeVersionId?: string;
  portfolioUrl?: string;
  customizationLevel: CustomizationLevel;
  status?: 'SUBMITTED' | 'SCREENING' | 'INTERVIEWING' | 'OFFER' | 'REJECTED' | 'WITHDRAWN';
  notes?: string;
}

export interface JobOutreach {
  id: string;
  opportunityId?: string;
  company?: string;
  role?: string;
  contactName: string;
  contactType: OutreachContactType;
  channel: OutreachChannel;
  sentAt: string;
  repliedAt?: string;
  followUpCount: number;
  notes?: string;
}

export interface CareerCapital {
  id: string;
  assetType: CareerAssetType;
  title: string;
  url?: string;
  status: CareerAssetStatus;
  notes?: string;
  lastUpdatedAt: string;
}

export type InterviewRoundType =
  | 'SCREENING'
  | 'TECHNICAL'
  | 'SYSTEM_DESIGN'
  | 'BEHAVIORAL'
  | 'TAKE_HOME'
  | 'FINAL_ROUND'
  | 'OTHER';

export type InterviewOutcome = 'PENDING' | 'PASSED' | 'FAILED' | 'CANCELLED';

export interface InterviewRecord {
  id: string;
  opportunityId: string;
  applicationId?: string;
  company?: string;
  roundType: InterviewRoundType;
  roundNumber: number;
  scheduledAt: string; // ISO 8601
  completedAt?: string;
  interviewerName?: string;
  interviewerRole?: string;
  notes?: string;
  outcome: InterviewOutcome;
  createdAt: string;
  updatedAt: string;
}

// ======================
// PILLAR 2: AGENCY
// ======================
export type ClientStatus = 'LEAD' | 'ACTIVE' | 'CHURNED' | 'PAST';
export type BillingType = 'RETAINER' | 'FIXED_PROJECT' | 'HOURLY';
export type LeadStage =
  | 'LEAD_FOUND'
  | 'QUALIFIED'
  | 'CONTACTED'
  | 'REPLIED'
  | 'CALL'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST'
  | 'NOT_INTERESTED'
  | 'NO_RESPONSE';

export type ProjectStatus = 'PROPOSAL' | 'ACTIVE' | 'DELIVERED' | 'PAID' | 'ON_HOLD' | 'CANCELLED';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
export type AgencyMaturityTier = 'FREELANCER' | 'SOLO_OPERATOR' | 'REPEATABLE_AGENCY' | 'SCALING_AGENCY';

export interface AgencyClient {
  id: string;
  name: string;
  company?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  clientType?: string;
  billingType?: BillingType;
  acquisitionChannel: string;
  icpScore: number; // 1-100
  status: ClientStatus;
  lifetimeRevenue: number;
  startDate: string;
  leadId?: string; // links back to the lead that was converted
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyProject {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  startDate: string;
  deadline?: string;
  targetEndDate?: string;
  completedDate?: string;
  status: ProjectStatus;
  agreedAmount: number;
  receivedAmount: number;
  currency: string;
  hoursSpent: number;
  deliverables?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyLead {
  id: string;
  companyName: string;
  contactPerson?: string;
  role?: string;
  email?: string;
  phone?: string;
  industry?: string;
  source: string;
  problemStatement?: string;
  proposedService?: string;
  estimatedDealValue?: number;
  dealProbability?: number; // 0-100
  stage: LeadStage;
  discoveredAt: string;
  clientId?: string; // set when converted to client
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyInvoice {
  id: string;
  invoiceNumber: string;
  projectId: string;
  clientId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt?: string;
  notes?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyMaturitySnapshot {
  tier: AgencyMaturityTier;
  label: string;
  score: number; // 0-100 within tier
  criteria: {
    name: string;
    met: boolean;
    detail: string;
  }[];
  nextTier?: {
    tier: AgencyMaturityTier;
    label: string;
    requirements: string[];
  };
}

// ======================
// PILLAR 3: TRADING OS → SAAS
// ======================

export type FeatureStatus = 'IDEA' | 'PLANNED' | 'IN_PROGRESS' | 'TESTING' | 'DONE' | 'BLOCKED';
export type FeaturePriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface SaasFeature {
  id: string;
  name: string;
  description?: string;
  status: FeatureStatus;
  priority: FeaturePriority;
  category: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type TestResult = 'PASS' | 'FAIL' | 'BLOCKED';

export interface SaasTestRun {
  id: string;
  featureId: string;
  testType: string;
  result: TestResult;
  notes?: string;
  executedAt: string;
  createdAt: string;
}

export type ReleaseStatus = 'DRAFT' | 'STAGING' | 'PUBLISHED' | 'ROLLED_BACK';

export interface SaasRelease {
  id: string;
  version: string;
  releaseName: string;
  releaseNotes: string;
  status: ReleaseStatus;
  releasedAt?: string;
  createdAt: string;
}

export type DistributionChannel =
  | 'LINKEDIN'
  | 'X'
  | 'REDDIT'
  | 'DISCORD'
  | 'COMMUNITY'
  | 'DIRECT_OUTREACH'
  | 'PRODUCT_HUNT'
  | 'CONTENT'
  | 'REFERRAL'
  | 'OTHER';

export type DistributionActivityType =
  | 'POST'
  | 'DEMO'
  | 'OUTREACH'
  | 'COMMUNITY'
  | 'CONTENT'
  | 'LAUNCH'
  | 'PARTNERSHIP'
  | 'OTHER';

export interface SaasDistributionActivity {
  id: string;
  channel: DistributionChannel;
  activityType: DistributionActivityType;
  quantity?: number;
  notes?: string;
  createdAt: string;
}

export interface SaasUserMetricSnapshot {
  id: string;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  payingUsers: number;
  churnedUsers: number;
  revenue: number;
  recurringRevenue: number;
  activationRate?: number;
  retentionRate?: number;
  recordedAt: string;
  createdAt: string;
}

export type FeedbackType = 'BUG' | 'FEATURE_REQUEST' | 'UX' | 'PERFORMANCE' | 'OTHER';
export type FeedbackSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';

export interface SaasFeedback {
  id: string;
  source: string;
  userReference?: string;
  feedbackType: FeedbackType;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  content: string;
  relatedFeatureId?: string;
  createdAt: string;
  resolvedAt?: string;
}

// ======================
// PILLAR 4: FOREX LEARNING
// ======================
export type CurriculumPhase =
  | 'FOUNDATION'
  | 'MARKET_UNDERSTANDING'
  | 'STRATEGY'
  | 'TECHNICAL_ANALYSIS'
  | 'PSYCHOLOGY'
  | 'EXECUTION';

export type StudyType =
  | 'VIDEO'
  | 'BOOK'
  | 'ARTICLE'
  | 'CHART_STUDY'
  | 'NOTES'
  | 'COURSE'
  | 'OTHER';

export type SetupStatus =
  | 'DRAFT'
  | 'BACKTESTING'
  | 'PAPER_TRADING'
  | 'VALIDATED'
  | 'REJECTED';

export type TradeMistake =
  | 'NONE'
  | 'FOMO'
  | 'EARLY_ENTRY'
  | 'LATE_ENTRY'
  | 'MOVED_SL'
  | 'MOVED_TP'
  | 'OVERTRADING'
  | 'REVENGE'
  | 'BROKE_RULES'
  | 'INCREASED_RISK'
  | 'EARLY_EXIT'
  | 'HESITATION'
  | 'OTHER';

export interface ForexStudySession {
  id: string;
  topic: string;
  subtopic?: string;
  studyType: StudyType;
  curriculumPhase: CurriculumPhase;
  durationMinutes: number;
  resourceUrl?: string;
  conceptsLearned?: string;
  questions?: string;
  notes?: string;
  studiedAt: string;
  createdAt: string;
}

export interface ForexSetup {
  id: string;
  name: string;
  marketContext: string; // e.g. Trend Continuation, Range Reversal, Liquidity Sweep
  timeframe: string; // e.g. 5m, 15m, 1h, 4h, Daily
  entryRules: string;
  slRules: string;
  tpRules: string;
  status: SetupStatus;
  winRateBacktested?: number;
  sampleSize?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForexBacktestBatch {
  id: string;
  setupId: string;
  pair: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  sampleSize: number; // total trades in this historical sample
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number; // system-calculated (wins / sampleSize) or recorded
  recordedExpectancyR?: number; // explicitly recorded/entered statistic from backtest log
  expectancyR?: number; // backwards compatibility alias for recordedExpectancyR
  ruleViolations: number;
  notes?: string;
  backtestedAt: string;
  createdAt: string;
}

// Alias for backwards compatibility
export type ForexBacktest = ForexBacktestBatch;

export type PaperTradeResult = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';

export interface ForexPaperTrade {
  id: string;
  setupId?: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  exitPrice?: number;
  riskPct?: number;
  rMultiple?: number;
  result: PaperTradeResult;
  ruleAdhered: boolean;
  mistakeTag: TradeMistake;
  entryReason?: string;
  notes?: string;
  tradedAt: string;
  createdAt: string;
}

// ======================
// PILLAR 5: FITNESS
// ======================
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'PRE_WORKOUT' | 'POST_WORKOUT';
export type WorkoutType = 'GYM_PUSH' | 'GYM_PULL' | 'GYM_LEGS' | 'GYM_UPPER' | 'GYM_LOWER' | 'GYM_FULL' | 'FOOTBALL' | 'RUNNING' | 'WALKING' | 'OTHER';

export interface NutritionLog {
  id: string;
  eatenAt: string;
  foodName: string;
  quantity?: string;
  mealType: MealType;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface SupplementLog {
  id: string;
  supplement: string;
  quantity: string;
  taken: boolean;
  takenAt?: string;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  startedAt: string;
  durationMinutes: number;
  workoutType: WorkoutType;
  notes?: string;
}

export interface ExerciseLog {
  id: string;
  workoutId: string;
  exerciseName: string;
  setIndex: number;
  reps: number;
  weightKg: number; // Total system load
  weightPerSideKg?: number; // Optional load per side
  barWeightKg?: number; // Optional explicit bar weight if known/provided
  isPR: boolean;
  notes?: string;
}

export interface RunLog {
  id: string;
  startedAt: string;
  distanceKm: number;
  durationSeconds: number;
  paceMinKm?: number;
  heartRateAvg?: number;
  completed5k?: boolean;
  notes?: string;
}

export interface DailyBioSnapshot {
  id: string;
  date: string;
  weightKg?: number;
  sleepBedtime?: string;
  sleepWaketime?: string;
  sleepDurationMins?: number;
  sleepQuality?: number; // 1-10
  energyLevel?: number; // 1-10
  chessSudokuMins?: number;
}

export interface FitnessKpiSummary {
  // Activity Durations (strictly segregated and distinguishable)
  gymDurationMinutes: number;
  runningDurationMinutes: number;
  footballDurationMinutes: number;
  mobilityDurationMinutes: number;
  cognitiveDurationMinutes: number;
  totalActiveMinutes: number;

  // Workouts
  workoutsCount: number;
  workoutsThisWeek: number;
  benchPressMaxKg: number;
  benchPressMaxPerSideKg: number;
  benchPressBarWeightKg: number | null; // explicit bar weight if known

  // Running
  totalDistanceKm: number;
  distanceThisWeekKm: number;
  fiveKmRunsCount: number;
  fiveKmRunsThisWeek: number;
  avgPaceMinKm: number | null;

  // Football
  footballSessionsCount: number;
  footballSessionsThisWeek: number;

  // Nutrition
  daysWithMealsLogged: number;
  avgDailyCaloriesWeek: number | null;
  avgDailyProteinWeek: number | null;
  todayCalories: number;
  todayProteinG: number;
  supplementsTakenToday: number;
  totalSupplementsTracked: number;

  // Recovery & Bio
  latestWeightKg: number | null;
  weightDeltaMonthKg: number | null;
  avgSleepHoursWeek: number | null;
  avgSleepQualityWeek: number | null;
  sleepDeficitFlag: boolean;

  // Cognitive
  chessSudokuMinutesWeek: number;

  // Mathematical Adherence Score (0-100, strictly measures recorded habit adherence, NOT objective medical health)
  fitnessAdherenceScore: number;
  adherenceScoreBreakdown: {
    trainingConsistency: number; // max 30
    cardioAndSports: number;     // max 25
    recoveryAndSleep: number;    // max 25
    nutritionAndHabits: number;  // max 20
  };
}

// ======================
// PILLAR 6: VOIRE
// ======================
export type VoireDesignStage =
  | 'IDEA'
  | 'CONCEPT'
  | 'DESIGNING'
  | 'MOCKUP'
  | 'SAMPLE'
  | 'APPROVED'
  | 'ARCHIVED';
// Backward compatibility alias
export type DesignStage = VoireDesignStage;

export interface VoireDesign {
  id: string;
  name?: string;
  title?: string;
  theme?: string;
  stage?: VoireDesignStage;
  status?: string;
  notes?: string;
  conceptNotes?: string;
  techPackUrl?: string;
  assetUrl?: string;
  estimatedProductionCost?: number;
  isWeekendCreation?: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export type VoireProductCategory =
  | 'HOODIE'
  | 'TEE'
  | 'SWEATSHIRT'
  | 'HEADWEAR'
  | 'PRINT'
  | 'ACCESSORY'
  | 'OTHER';

export type VoireProductStatus =
  | 'ACTIVE'
  | 'DRAFT'
  | 'PAUSED'
  | 'ARCHIVED'
  | 'DEVELOPMENT'
  | 'READY'
  | 'LIVE'
  | 'DISCONTINUED';

export interface VoireProduct {
  id: string;
  designId?: string; // Optional link to design
  name?: string;
  title?: string;
  sku: string;
  category: VoireProductCategory | string;
  status: VoireProductStatus | string;
  retailPrice: number;           // Current listing price in INR
  baseCost: number;              // Current blanks + print cost in INR
  shippingCostEst?: number;
  shippingCostEstimate?: number; // Estimated fulfillment cost
  inventoryCount?: number;
  inventoryQty?: number;          // 0 for POD (on-demand), >0 for pre-printed stock
  isPrintOnDemand?: boolean;      // True = on-demand production, False = physical stock
  editionName?: string;
  createdAt: string;
  updatedAt: string;
}

export type VoireDropStatus =
  | 'PLANNING'
  | 'DESIGNING'
  | 'SCHEDULED'
  | 'LIVE'
  | 'ENDED'
  | 'CANCELLED';

export interface VoireDrop {
  id: string;
  name: string;
  editionCode?: string; // e.g. "DROP-001"
  theme?: string;
  status: VoireDropStatus | string;
  launchDate?: string;  // ISO string
  scheduledAt?: string;
  endDate?: string;
  endedAt?: string;
  targetRevenue?: number;
  productIds?: string[];
  designIds?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type VoireOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'UNFULFILLED'
  | 'IN_PRODUCTION';

export type VoireFulfillmentStatus =
  | 'UNFULFILLED'
  | 'IN_PRODUCTION'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type VoirePaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface VoireOrder {
  id: string;
  orderNumber: string; // e.g. "#VR-1001"
  orderedAt?: string;   // ISO 8601
  orderDate?: string;
  customerName?: string;
  customerEmail?: string;
  shippingAddress?: string;
  channel?: string;
  status?: VoireOrderStatus | string;
  fulfillmentStatus?: VoireFulfillmentStatus | string;
  paymentStatus: VoirePaymentStatus;
  paidAt?: string;

  // Order-level charges & adjustments
  subtotal?: number;
  discountAmount?: number;
  shippingFee?: number;
  shippingCharged?: number;    // Shipping fee charged to customer
  shippingCostActual?: number; // Actual shipping expense incurred
  orderDiscount?: number;      // Cart/order-wide discount voucher
  orderRefund?: number;        // Global order refund amount
  totalAmount: number;
  refundAmount?: number;
  platformFee?: number;        // Payment gateway or platform processing fee

  dropId?: string;
  attributedCampaignId?: string; // Lightweight marketing attribution
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoireOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName?: string;
  productSku?: string;
  dropId?: string;            // Optional link if sold during a drop
  units?: number;              // >= 1
  quantity?: number;

  // MANDATORY SNAPSHOT: Unit economics at moment of purchase
  unitPriceAtSale: number;          // Snapshot of selling price
  unitProductionCostAtSale: number;  // Snapshot of POD/blanks COGS
  totalPrice?: number;

  lineDiscount?: number;       // Item-specific discount
  lineRefund?: number;         // Item-specific refund
  notes?: string;
}

export type VoireMarketingChannel =
  | 'META_ADS'
  | 'TIKTOK_ADS'
  | 'GOOGLE_ADS'
  | 'INFLUENCER'
  | 'EMAIL_MARKETING'
  | 'COMMUNITY'
  | 'INSTAGRAM'
  | 'TIKTOK'
  | 'EMAIL'
  | 'PAID_ADS'
  | 'OTHER';

export type VoireMarketingStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED';

export interface VoireMarketingCampaign {
  id: string;
  name?: string;
  title?: string;
  channel: VoireMarketingChannel | string;
  campaignType?: string;
  contentType?: 'REEL' | 'POST' | 'STORY' | 'NEWSLETTER' | 'AD' | 'LOOKBOOK' | string;
  status?: VoireMarketingStatus | string;
  publishedAt?: string;        // ISO string
  startDate?: string;
  endDate?: string;
  spendAmount: number;        // Authoritative marketing expense in INR
  impressions?: number;
  clicks?: number;
  conversions?: number;
  dropId?: string;
  linkedDropId?: string;
  linkedProductId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface VoireFinancialPeriod {
  id: string;
  periodName: string; // e.g. "Sept 2026"
  startDate: string;  // ISO string
  endDate: string;    // ISO string
  isClosed: boolean;
  otherExpenses?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// KPI Summary interface for VOIRE
export interface VoireKpiSummary {
  // Creative / Production
  totalDesigns: number;
  readyOrSampledDesigns: number;
  totalIdeas?: number;
  approvedDesigns?: number;
  designsInProgress?: number;
  weekendCreativeSessionsCount?: number;
  weekendCreativeMinutes?: number;
  weekendOutputLast14Days?: number;

  // Products & Drops
  activeProducts: number;
  totalProducts?: number;
  liveProducts?: number;
  activeDrops: number;
  totalDrops?: number;
  liveDrops?: number;
  completedDrops?: number;

  // Commercial / Sales (Authoritative Financial Reality)
  totalOrders: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  ordersThisWeek?: number;
  totalUnitsSold?: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  refundCount: number;
  netSales: number;
  cogsProduction: number;
  cogsShipping: number;
  totalCogs: number;
  marketingSpend: number;
  otherExpenses: number;
  contributionProfit: number;
  contributionMarginPercent: number;
  cashReceived: number;
  accountsReceivablePending: number;
  aov: number;
  roas: number;
  cac: number;

  // Marketing performance
  campaignsCount: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  overallCtr: number;
  overallCvr: number;

  // Weekend Creative Rule
  isWeekend: boolean;
  creativePauseExcused: boolean;

  // Backward compatibility aliases
  merchandiseGrossSales?: number;
  totalDiscounts?: number;
  totalRefunds?: number;
  netMerchandiseSales?: number;
  shippingRevenueTotal?: number;
  netCustomerRevenue?: number;
  cashReceivedTotal?: number;
  cashRefundOutflowTotal?: number;
  accountsReceivableTotal?: number;
  productionCogsTotal?: number;
  grossProfitTotal?: number;
  fulfillmentExpenseTotal?: number;
  platformFeesTotal?: number;
  marketingSpendTotal?: number;
  netContributionProfit?: number;
  averageOrderValue?: number;
  overallGrossMarginPct?: number;

  // Creative -> Commercial Funnel
  funnel?: {
    ideasCount: number;
    designsCount: number;
    productsCount: number;
    dropsCount: number;
    ordersCount: number;
    ideasToDesignsPct: number;
    designsToProductsPct: number;
    productsToOrdersPct: number;
  };
}

