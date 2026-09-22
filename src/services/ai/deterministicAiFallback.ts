// ============================================================================
// PERSONAL OS — Layer 4: Deterministic AI Fallback Engine
// Generates fully structured AIAnalysis grounded in canonical OS facts and the
// evidence catalog whenever external LLM endpoints are offline, rate-limited,
// or experiencing connectivity/configuration failures.
//
// Core Axiom:
//   "Code calculates. Deterministic logic interprets reality when LLM is offline."
// ============================================================================

import type {
  AIAnalysis,
  AIAnalysisMode,
  AIContext,
  AIObservation,
  AIPattern,
  AIContradiction,
  AIPriority,
  AIGoalAnalysis,
  AIRisk,
  AIOpportunity,
} from '../../types/ai.ts';

/**
 * Generates an evidence-grounded AIAnalysis directly from deterministic OS context.
 */
export function generateDeterministicAnalysis(
  context: AIContext,
  mode: AIAnalysisMode
): AIAnalysis {
  const isBrutal = mode === 'BRUTAL';
  const evidenceIds = context.evidenceCatalog.map((e) => e.id);
  const evidenceSet = new Set(evidenceIds);

  const safeEvidenceRef = (id: string): string[] => (evidenceSet.has(id) ? [id] : []);

  // 1. Observations from Evidence Catalog
  const observations: AIObservation[] = context.evidenceCatalog.slice(0, 10).map((ev, idx) => ({
    id: `obs_det_${idx + 1}`,
    type: 'FACT',
    category: (ev.category as any) || 'OUTCOME',
    statement: `${ev.label}: deterministic value is ${typeof ev.value === 'number' ? ev.value.toLocaleString() : ev.value} (${ev.source})`,
    evidenceRefs: [ev.id],
  }));

  // 2. Goal Analysis & Deficits
  const goalAnalysis: AIGoalAnalysis[] = [];
  const behindGoals = context.goals.filter((g) => g.status === 'BEHIND' || (g.progressPercent !== null && g.progressPercent < 60));
  const onTrackGoals = context.goals.filter((g) => g.status === 'ON_TRACK' || g.status === 'ACHIEVED');

  for (const goal of context.goals) {
    const goalEvidence = safeEvidenceRef(`goal.${goal.goalId}.gap`);
    const isBehind = goal.status === 'BEHIND' || (goal.progressPercent !== null && goal.progressPercent < 70);

    goalAnalysis.push({
      goalId: goal.goalId,
      goalTitle: goal.title,
      status: goal.status,
      varianceExplanation: isBehind
        ? `Goal "${goal.title}" is operating below target (${goal.current ?? 0} of ${goal.target}, gap of ${goal.gap ?? (goal.target - (goal.current ?? 0))}). Cadence pace requires immediate focus.`
        : `Goal "${goal.title}" is on schedule at ${goal.progressPercent ?? 100}% attainment.`,
      trajectory: isBehind ? 'DETERIORATING' : 'STABLE',
      evidenceRefs: goalEvidence.length > 0 ? goalEvidence : evidenceIds.slice(0, 1),
    });
  }

  // 3. Time Allocation Patterns
  const patterns: AIPattern[] = [];
  const topPillars = [...context.time.pillars].sort((a, b) => b.hours - a.hours);
  const totalHours = context.time.summary.totalHours;

  if (topPillars.length > 0) {
    const leadPillar = topPillars[0];
    const leadEvidence = safeEvidenceRef(`time.${leadPillar.pillarId}.hours`);
    patterns.push({
      id: 'pat_time_allocation',
      title: `${leadPillar.pillarName} Time Concentration`,
      description: `${leadPillar.pillarName} absorbed ${leadPillar.hours.toFixed(1)}h (${leadPillar.sharePercent.toFixed(1)}%) of total recorded focus time (${totalHours.toFixed(1)}h).`,
      pillarIds: [leadPillar.pillarId],
      significance: leadPillar.sharePercent > 50 ? 'HIGH' : 'MEDIUM',
      evidenceRefs: leadEvidence.length > 0 ? leadEvidence : evidenceIds.slice(0, 1),
    });
  }

  // Deep work ratio pattern
  const deepWorkRatio = context.time.summary.deepWorkRatioPercent;
  const deepWorkEvidence = safeEvidenceRef('time.deep_work_ratio');
  patterns.push({
    id: 'pat_deep_work_quality',
    title: `Deep Work Quality (${deepWorkRatio.toFixed(1)}%)`,
    description: `Deep work ratio is recorded at ${deepWorkRatio.toFixed(1)}%. ${deepWorkRatio >= 65 ? 'High cognitive intensity maintained across blocks.' : 'Interruption and fragmented shallow work detected.'}`,
    pillarIds: topPillars.slice(0, 2).map((p) => p.pillarId),
    significance: deepWorkRatio < 50 ? 'HIGH' : 'MEDIUM',
    evidenceRefs: deepWorkEvidence.length > 0 ? deepWorkEvidence : evidenceIds.slice(0, 1),
  });

  // 4. Contradictions (Intent vs Reality)
  const contradictions: AIContradiction[] = [];
  for (const pillar of context.time.pillars) {
    const matchingGoals = context.goals.filter((g) => g.pillarId === pillar.pillarId);
    const hasBehindGoals = matchingGoals.some((g) => g.status === 'BEHIND');

    if (hasBehindGoals && pillar.sharePercent < 15 && totalHours > 5) {
      const timeRef = safeEvidenceRef(`time.${pillar.pillarId}.hours`);
      contradictions.push({
        id: `con_${pillar.pillarId}`,
        statedIntent: `Pillar "${pillar.pillarName}" has milestone goals behind schedule`,
        observedReality: `Allocated only ${pillar.hours.toFixed(1)} hours (${pillar.sharePercent.toFixed(1)}% of total focus time) this period`,
        severity: isBrutal ? 'CRITICAL' : 'WARNING',
        evidenceRefs: timeRef.length > 0 ? timeRef : evidenceIds.slice(0, 1),
      });
    }
  }

  // 5. Risks & Opportunities
  const risks: AIRisk[] = [];
  if (behindGoals.length > 0) {
    risks.push({
      id: 'risk_goal_slippage',
      title: `${behindGoals.length} Target Goals at Risk of Slippage`,
      description: `Goals: ${behindGoals.map((g) => g.title).slice(0, 3).join(', ')} are tracking behind schedule.`,
      severity: behindGoals.length >= 2 ? 'HIGH' : 'MEDIUM',
      mitigationFact: 'Dedicate the next 2 focus blocks exclusively to overdue goal metrics.',
    });
  }

  const opportunities: AIOpportunity[] = [];
  if (onTrackGoals.length > 0) {
    opportunities.push({
      id: 'opp_momentum_compounding',
      title: `Momentum Compounding in ${onTrackGoals[0].title}`,
      description: `Pacing on "${onTrackGoals[0].title}" is healthy. Lock in the gains and shift excess bandwidth to bottleneck areas.`,
      pillarId: onTrackGoals[0].pillarId || undefined,
    });
  }

  // 6. Actionable Priorities
  const priorities: AIPriority[] = [];
  if (behindGoals.length > 0) {
    const topBehind = behindGoals[0];
    priorities.push({
      id: 'prio_close_top_gap',
      rank: 1,
      area: topBehind.title,
      rationale: `Execute dedicated sprint to close gap on "${topBehind.title}" (need ${topBehind.gap ?? 1} units)`,
      nature: 'PRIORITY',
    });
  }

  if (topPillars.length > 1 && contradictions.length > 0) {
    const starvedPillar = contradictions[0];
    priorities.push({
      id: 'prio_rebalance_time',
      rank: 2,
      area: starvedPillar.statedIntent,
      rationale: `Rebalance focus hours toward starved priority: ${starvedPillar.statedIntent}`,
      nature: 'INFERRED',
    });
  }

  // 7. Headline & Summary Synthesis
  let headline = '';
  let summary = '';

  if (context.northStar) {
    const ns = context.northStar;
    headline = isBrutal
      ? `Brutal Reality: €${ns.gap.toLocaleString()} Gap Remains (${ns.progressPercent.toFixed(1)}% Achieved)`
      : `Strategic Status: €${ns.current.toLocaleString()} Realized of €${ns.target.toLocaleString()} North Star (${ns.progressPercent.toFixed(1)}%)`;
    summary = `Personal OS ledger recorded ${totalHours.toFixed(1)}h total focus (${deepWorkRatio.toFixed(1)}% deep work) across ${context.time.summary.sessionCount} sessions. ${
      behindGoals.length > 0
        ? `${behindGoals.length} goal(s) are tracking behind schedule, requiring immediate focus reallocation.`
        : 'All active targets are pacing on track.'
    } Analysis compiled deterministically from immutable activity logs.`;
  } else {
    headline = isBrutal
      ? `Brutal Audit: Execution Disparity Across Active Pillars`
      : `Deterministic Strategic Audit: ${totalHours.toFixed(1)}h Focused Across ${topPillars.length} Pillars`;
    summary = `Observed reality shows ${totalHours.toFixed(1)} focus hours with ${deepWorkRatio.toFixed(1)}% deep work discipline. ${
      contradictions.length > 0 ? `${contradictions.length} time-to-goal priority mismatch detected.` : 'Pillar velocity is steady.'
    }`;
  }

  return {
    headline,
    summary,
    confidence: 'HIGH',
    observations,
    patterns,
    contradictions,
    risks,
    opportunities,
    priorities,
    goalAnalysis,
  };
}
