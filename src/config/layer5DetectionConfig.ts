// ============================================================================
// PERSONAL OS — Layer 5 System Detection Configuration
// Centralized, deterministic thresholds for Cross-Pillar Intelligence,
// Alerts & Exceptions, and Data Quality.
//
// NOTE:
//   These thresholds are SYSTEM DETECTION PARAMETERS, NOT user goals or KPIs.
//   They configure heuristic sensitivity for anomaly, trade-off, and
//   exception detection.
// ============================================================================

export const Layer5DetectionConfig = {
  // --- Cross-Pillar Priority & Time Allocation System Detection Thresholds ---
  /**
   * Threshold (%) below which Top 3 priority pillars (Job Hunt, Agency, Trading OS)
   * are considered under-allocated relative to total focus time.
   */
  PRIORITY_TIME_MISMATCH_TOP_MAX_SHARE: 20,

  /**
   * Threshold (%) above which Lower priority pillars (Forex, Fitness, VOIRE)
   * are considered over-concentrated during normal focus cycles.
   */
  PRIORITY_TIME_MISMATCH_LOWER_MIN_SHARE: 60,

  /**
   * Focus time share threshold (%) above which a single pillar's focus
   * is flagged as heavily concentrated.
   */
  TIME_CONCENTRATION_SINGLE_PILLAR_SHARE: 70,

  /**
   * Focus days threshold below which a priority 1-3 pillar is evaluated for neglect.
   */
  TIME_NEGLECT_ACTIVE_DAYS_THRESHOLD: 0,

  /**
   * Minimum percentage shift (increase in Pillar A, decrease in Pillar B)
   * between comparable periods to flag an observable trade-off.
   */
  TRADEOFF_CHANGE_PERCENT_MIN: 25,

  // --- Goal Pressure System Detection Thresholds ---
  /**
   * Progress ratio threshold below which a goal is flagged as experiencing pressure
   * despite significant focus allocation.
   */
  GOAL_PRESSURE_BEHIND_PROGRESS_RATIO: 0.50,

  /**
   * Focus time threshold (hours) above which lack of goal progress indicates
   * friction or misalignment.
   */
  GOAL_PRESSURE_HIGH_TIME_HOURS: 5,

  // --- Alerts & Exceptions System Detection Thresholds ---
  /**
   * Focus share threshold (%) below which Priority 1 (Job Hunt) triggers a TIME_MISMATCH alert.
   */
  ALERT_TIME_MISMATCH_PRIORITY_1_MIN_SHARE: 10,

  /**
   * Progress ratio threshold below which an active goal is flagged with GOAL_BEHIND alert.
   */
  ALERT_GOAL_BEHIND_PROGRESS_THRESHOLD: 0.40,

  /**
   * Accounts Receivable to Billed Revenue ratio threshold (40%) above which
   * an elevated AR business exception is triggered.
   */
  ALERT_AGENCY_AR_RATIO_THRESHOLD: 0.40,

  // --- SaaS Product vs Distribution System Detection Thresholds ---
  /**
   * Active development time threshold (seconds: 3600 = 1 hour) marking active product build.
   */
  SAAS_ACTIVE_DEV_SECONDS_THRESHOLD: 3600,

  /**
   * Minimum distribution-to-development focus ratio (15%). If distribution focus
   * falls below this ratio during active development, distribution lag is detected.
   */
  SAAS_MIN_DISTRIBUTION_FOCUS_RATIO: 0.15,

  /**
   * Activity count threshold (0) for distribution activities when features are
   * actively in progress or completed, matching statusEngine.ts Distribution Starvation.
   */
  SAAS_DISTRIBUTION_STARVATION_ACTIVITIES: 0,

  // --- Forex Learning Process System Detection Thresholds (from authoritative forexKpi.ts) ---
  /**
   * From authoritative CRITICAL_MISTAKE_COUNT_THRESHOLD in forexKpi.ts.
   * Severe emotional breaches (FOMO + Revenge) >= 2 trigger discipline exception.
   */
  FOREX_CRITICAL_MISTAKE_COUNT_THRESHOLD: 2,

  /**
   * Process rule adherence rate minimum (%) from statusEngine.ts.
   */
  FOREX_MIN_RULE_ADHERENCE_PERCENT: 70,

  /**
   * Minimum sample size of paper trades required before rule adherence is evaluated.
   */
  FOREX_MIN_PAPER_TRADES_FOR_ADHERENCE_CHECK: 3,
} as const;
