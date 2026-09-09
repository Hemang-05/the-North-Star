// ============================================================================
// PERSONAL OS — Goal Validation Guard
// Validates goal definitions before persistence.
// Prevents invalid configurations without arbitrarily over-constraining the user.
// ============================================================================

import type { Goal } from '../types';
import { isRegisteredMetric } from './kpiRegistry';

export interface GoalValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGoal(goal: Partial<Goal>): GoalValidationResult {
  const errors: string[] = [];

  // Title validation
  if (!goal.title || !goal.title.trim()) {
    errors.push('Goal title is required.');
  }

  // Target value validation
  if (goal.targetValue === undefined || goal.targetValue === null || Number.isNaN(goal.targetValue)) {
    errors.push('A valid target value is required.');
  } else if (goal.targetValue <= 0) {
    errors.push('Target value must be greater than zero.');
  }

  // Cadence validation
  const validCadences = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'NORTH_STAR', 'CUSTOM'];
  if (!goal.cadence || !validCadences.includes(goal.cadence)) {
    errors.push(`Invalid goal cadence: ${goal.cadence}. Supported cadences: ${validCadences.join(', ')}`);
  }

  // Metric key validation (if provided)
  if (goal.metricKey && !isRegisteredMetric(goal.metricKey)) {
    errors.push(`Unknown metric key: "${goal.metricKey}". Goal must reference an officially registered KPI.`);
  }

  // Date range validation (if both provided)
  if (goal.startDate && goal.endDate) {
    const start = new Date(goal.startDate).getTime();
    const end = new Date(goal.endDate).getTime();
    if (!isNaN(start) && !isNaN(end) && start > end) {
      errors.push('Goal startDate cannot be after endDate.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
