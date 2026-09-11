// ============================================================================
// PERSONAL OS — Universal Goals & KPI View
// Single OS-level view for tracking user-owned goals, reality, gaps, and status.
//
// Axioms:
//   "I define what I want. The system measures what is actually happening.
//    The system calculates the gap. AI interprets that gap later."
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import {
  Target, Plus, CheckCircle2, AlertTriangle, Clock,
  ArrowUpRight, ArrowDownRight, RefreshCw, X, Sparkles, Star, Edit3, Trash2
} from 'lucide-react';
import { useGoals } from '../../hooks/useDatabase';
import { PILLARS } from '../../config/pillars';
import {
  getAllMetricDefinitions,
  getMetricDefinition,
} from '../../services/kpiRegistry';
import {
  loadAllPillarsKpisContext,
  evaluateGoalSnapshot,
  type KpisEvaluationContext,
} from '../../services/kpiEvaluation';
import { validateGoal } from '../../services/goalValidation';
import { formatINR, formatPercent } from '../../utils/helpers';
import { showToast } from '../Toast';
import { AIAnalysisCard } from '../ai/AIAnalysisCard';
import type { Goal, GoalCadence, GoalKpiSnapshot, PillarSlug, GoalStatus } from '../../types';

export function GoalsView() {
  const { goals, addGoal, updateGoal, deleteGoal, loading: goalsLoading } = useGoals();
  const [pillarFilter, setPillarFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [snapshots, setSnapshots] = useState<Record<string, GoalKpiSnapshot>>({});
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [expandedAiGoalId, setExpandedAiGoalId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [metricKey, setMetricKey] = useState('');
  const [targetValue, setTargetValue] = useState<string>('');
  const [cadence, setCadence] = useState<GoalCadence>('MONTHLY');
  const [selectedPillar, setSelectedPillar] = useState<string>('agency');
  const [unit, setUnit] = useState('');

  // North star quick target editing
  const [editingNorthStar, setEditingNorthStar] = useState(false);
  const [northStarInput, setNorthStarInput] = useState('');

  const registeredMetrics = useMemo(() => getAllMetricDefinitions(), []);

  // Compute snapshots whenever goals change
  const refreshEvaluations = async () => {
    setEvaluating(true);
    try {
      const context: KpisEvaluationContext = await loadAllPillarsKpisContext();
      const newSnapshots: Record<string, GoalKpiSnapshot> = {};

      for (const g of goals) {
        newSnapshots[g.id] = await evaluateGoalSnapshot(g, context);
      }
      setSnapshots(newSnapshots);
    } catch (err) {
      console.error('Failed evaluating goals:', err);
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    if (!goalsLoading && goals.length > 0) {
      refreshEvaluations();
    }
  }, [goals, goalsLoading]);

  // Identify North Star Goal
  const northStarGoal = goals.find((g) => g.cadence === 'NORTH_STAR' && g.pillarId === null);
  const northStarSnapshot = northStarGoal ? snapshots[northStarGoal.id] : null;

  // Filter goals
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      // Exclude global North Star from regular list (it has its own hero banner)
      if (g.cadence === 'NORTH_STAR' && g.pillarId === null) return false;

      if (pillarFilter !== 'ALL' && g.pillarId !== pillarFilter) return false;

      if (statusFilter !== 'ALL') {
        const snap = snapshots[g.id];
        if (!snap || snap.status !== statusFilter) return false;
      }

      return true;
    });
  }, [goals, pillarFilter, statusFilter, snapshots]);

  // Metric dropdown handler: auto-populates unit, cadence, and pillar
  const handleMetricSelect = (mKey: string) => {
    setMetricKey(mKey);
    const def = getMetricDefinition(mKey);
    if (def) {
      setUnit(def.unit);
      setCadence(def.defaultCadence);
      if (def.pillarId) {
        setSelectedPillar(def.pillarId);
      }
      if (!title) {
        setTitle(def.name);
      }
    }
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(targetValue);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid target value', 'warning');
      return;
    }

    const goalData = {
      title: title.trim(),
      metricKey: metricKey || undefined,
      pillarId: (selectedPillar === 'global' ? null : selectedPillar) as PillarSlug | null,
      targetType: 'COUNT' as const,
      targetValue: val,
      unit: unit.trim(),
      cadence,
      weight: 50,
      isActive: true,
    };

    const validation = validateGoal(goalData);
    if (!validation.valid) {
      showToast(validation.errors[0], 'warning');
      return;
    }

    if (editingGoal) {
      await updateGoal({
        ...editingGoal,
        ...goalData,
      });
      showToast('Goal updated successfully', 'success');
    } else {
      await addGoal(goalData);
      showToast('Goal created successfully', 'success');
    }

    setShowModal(false);
    setEditingGoal(null);
    resetForm();
    await refreshEvaluations();
  };

  const resetForm = () => {
    setTitle('');
    setMetricKey('');
    setTargetValue('');
    setCadence('MONTHLY');
    setSelectedPillar('agency');
    setUnit('');
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setMetricKey(goal.metricKey || '');
    setTargetValue(goal.targetValue.toString());
    setCadence(goal.cadence);
    setSelectedPillar(goal.pillarId || 'global');
    setUnit(goal.unit || '');
    setShowModal(true);
  };

  const handleCreateDefaultNorthStar = async () => {
    await addGoal({
      pillarId: null,
      title: 'North Star',
      description: '₹1 Crore cumulative cash & commercial proceeds within one year',
      targetType: 'CURRENCY',
      targetValue: 10000000,
      metricKey: 'north_star.financialProceeds',
      unit: '₹',
      cadence: 'NORTH_STAR',
      weight: 100,
      isActive: true,
    });
    showToast('North Star Goal initialized!', 'success');
    await refreshEvaluations();
  };

  const handleUpdateNorthStarTarget = async () => {
    if (!northStarGoal) return;
    const val = parseFloat(northStarInput);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid amount', 'warning');
      return;
    }
    await updateGoal({ ...northStarGoal, targetValue: val });
    setEditingNorthStar(false);
    showToast('North Star target updated!', 'success');
    await refreshEvaluations();
  };

  const getStatusBadge = (status: GoalStatus) => {
    switch (status) {
      case 'ACHIEVED':
        return <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Achieved</span>;
      case 'AHEAD':
        return <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowUpRight size={12} /> Ahead</span>;
      case 'ON_TRACK':
        return <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> On Track</span>;
      case 'BEHIND':
        return <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowDownRight size={12} /> Behind</span>;
      case 'NOT_STARTED':
        return <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> Not Started</span>;
      case 'NO_DATA':
      default:
        return <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> No Data</span>;
    }
  };

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Target size={24} style={{ color: '#8b5cf6' }} />
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Goals & KPI Reality
            </h1>
          </div>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            Deterministic ground truth: Targets vs Reality vs Measured Gap. AI will interpret later.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={refreshEvaluations}
            disabled={evaluating}
            title="Recalculate reality across all pillars"
          >
            <RefreshCw size={14} className={evaluating ? 'spin' : ''} />
            <span>Recalculate</span>
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              resetForm();
              setEditingGoal(null);
              setShowModal(true);
            }}
          >
            <Plus size={14} />
            <span>New Goal</span>
          </button>
        </div>
      </div>

      {/* North Star Hero Card */}
      <div
        className="card"
        style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          padding: 24,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={20} style={{ color: 'var(--clr-north-star)' }} />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--clr-north-star)' }}>
              Top-Level OS Goal — North Star
            </span>
          </div>

          {northStarGoal && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {northStarSnapshot && getStatusBadge(northStarSnapshot.status)}
              <button
                className="btn-icon"
                style={{ width: 28, height: 28, border: 'none', background: 'rgba(251,191,36,0.1)' }}
                onClick={() => {
                  setEditingNorthStar(!editingNorthStar);
                  setNorthStarInput(northStarGoal.targetValue.toString());
                }}
                title="Edit North Star Target"
              >
                <Edit3 size={12} style={{ color: 'var(--clr-north-star)' }} />
              </button>
            </div>
          )}
        </div>

        {northStarGoal ? (
          <div>
            {editingNorthStar ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 16px' }}>
                <span style={{ fontSize: 'var(--text-2xl)', color: 'var(--clr-north-star)' }}>₹</span>
                <input
                  type="number"
                  className="form-input"
                  value={northStarInput}
                  onChange={(e) => setNorthStarInput(e.target.value)}
                  style={{ maxWidth: 220, fontSize: 'var(--text-lg)' }}
                  autoFocus
                />
                <button className="btn btn-sm btn-primary" onClick={handleUpdateNorthStarTarget}>Save</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditingNorthStar(false)}>Cancel</button>
              </div>
            ) : (
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: 'var(--clr-north-star)', marginBottom: 8 }}>
                {formatINR(northStarGoal.targetValue)}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>
                Measured Reality: {northStarSnapshot?.current !== null ? formatINR(northStarSnapshot?.current || 0) : 'NO_DATA'}
              </span>
              <span>
                {northStarSnapshot?.progressPercent !== null ? formatPercent(northStarSnapshot?.progressPercent || 0) : '—'}
              </span>
            </div>

            <div className="progress-bar" style={{ height: 8, marginBottom: 12 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(northStarSnapshot?.progressPercent || 0, 100)}%`,
                  background: 'var(--grad-north-star)',
                }}
              />
            </div>

            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Deterministic ground truth derived from cash proceeds: Agency Realized Cash + VOIRE Cash Received. No speculative valuation multiples.
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
              No North Star goal initialized. Set your overarching financial target.
            </p>
            <button className="btn btn-primary btn-sm" onClick={handleCreateDefaultNorthStar}>
              <Star size={14} />
              Initialize ₹1 Cr North Star
            </button>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {/* Pillar Filter */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            className={`btn btn-sm ${pillarFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setPillarFilter('ALL')}
          >
            All Pillars
          </button>
          {PILLARS.map((p) => (
            <button
              key={p.id}
              className={`btn btn-sm ${pillarFilter === p.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPillarFilter(p.id)}
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {['ALL', 'ACHIEVED', 'AHEAD', 'ON_TRACK', 'BEHIND', 'NOT_STARTED', 'NO_DATA'].map((st) => (
            <button
              key={st}
              className={`btn btn-xs ${statusFilter === st ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(st)}
              style={{ fontSize: 11 }}
            >
              {st === 'ALL' ? 'All Statuses' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="empty-state card" style={{ padding: 48, textAlign: 'center' }}>
          <Target size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div className="empty-state-title">No Goals Found</div>
          <div className="empty-state-text">
            {goals.length === 0
              ? 'You have not defined any goals yet. Click "New Goal" to map your desired state to a registered KPI.'
              : 'No goals match the selected filter.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filteredGoals.map((g) => {
            const snap = snapshots[g.id];
            const pillar = PILLARS.find((p) => p.id === g.pillarId);

            return (
              <div
                key={g.id}
                className="card"
                style={{
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: pillar ? `3px solid ${pillar.color}` : '3px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span className="badge badge-neutral" style={{ fontSize: 10, marginBottom: 4 }}>
                        {pillar?.title || 'Global'} • {g.cadence}
                      </span>
                      <h3 style={{ margin: '4px 0 2px', fontSize: 'var(--text-md)', fontWeight: 700 }}>
                        {g.title}
                      </h3>
                      {g.metricKey && (
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {g.metricKey}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {snap && getStatusBadge(snap.status)}
                      <button
                        className="btn-icon"
                        style={{
                          width: 26,
                          height: 26,
                          color: expandedAiGoalId === g.id ? 'var(--clr-primary)' : 'inherit',
                          background: expandedAiGoalId === g.id ? 'var(--surface-sunken)' : 'transparent',
                        }}
                        onClick={() => setExpandedAiGoalId(expandedAiGoalId === g.id ? null : g.id)}
                        title="AI Variance & Contributing Factors"
                      >
                        <Sparkles size={13} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ width: 26, height: 26 }}
                        onClick={() => openEditModal(g)}
                        title="Edit Goal"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ width: 26, height: 26, color: 'var(--clr-danger)' }}
                        onClick={() => deleteGoal(g.id)}
                        title="Deactivate / Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Target vs Reality Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '14px 0', background: 'var(--bg-subtle)', padding: 10, borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target</div>
                      <div style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>
                        {g.targetType === 'CURRENCY' ? formatINR(g.targetValue) : g.targetValue} {g.unit || ''}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reality</div>
                      <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: snap?.state === 'NO_DATA' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        {snap?.state === 'NO_DATA'
                          ? 'NO_DATA'
                          : g.targetType === 'CURRENCY'
                          ? formatINR(snap?.current ?? 0)
                          : `${snap?.current ?? 0} ${g.unit || ''}`}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gap</div>
                      <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: snap?.gap && snap.gap > 0 ? 'var(--clr-warning)' : 'var(--clr-success)' }}>
                        {snap?.gap === null || snap?.gap === undefined
                          ? '—'
                          : g.targetType === 'CURRENCY'
                          ? formatINR(snap.gap)
                          : `${snap.gap > 0 ? '+' : ''}${snap.gap} ${g.unit || ''}`}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span className="text-muted">Progress</span>
                      <span style={{ fontWeight: 600 }}>
                        {snap?.progressPercent !== null && snap?.progressPercent !== undefined
                          ? formatPercent(snap.progressPercent)
                          : '—'}
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: 6 }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(snap?.progressPercent || 0, 100)}%`,
                          background:
                            snap?.status === 'ACHIEVED'
                              ? 'var(--clr-success)'
                              : snap?.status === 'BEHIND'
                              ? 'var(--clr-danger)'
                              : 'var(--clr-primary)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>Period: {snap?.period.cadence}</span>
                  <span>{g.isActive ? 'Active' : 'Archived'}</span>
                </div>

                {expandedAiGoalId === g.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                    <AIAnalysisCard
                      mode="GOAL"
                      goalScope={g.id}
                      pillarScope={g.pillarId ?? undefined}
                      title={`AI Variance Intelligence: ${g.title}`}
                      allowBrutal={false}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>
                {editingGoal ? 'Edit Goal' : 'Define New Goal'}
              </h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Link to Registered KPI (Reality Source)</label>
                <select
                  className="form-input"
                  value={metricKey}
                  onChange={(e) => handleMetricSelect(e.target.value)}
                >
                  <option value="">-- Custom Goal (Manual / Unlinked) --</option>
                  {registeredMetrics.map((m) => (
                    <option key={m.metricKey} value={m.metricKey}>
                      [{m.pillarId || 'Global'}] {m.name} ({m.defaultCadence})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                  Linking to an authoritative KPI allows the system to deterministically measure reality against your target.
                </p>
              </div>

              <div>
                <label className="form-label">Goal Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Monthly Realized Cash"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Target Value *</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 500000"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Unit</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ₹, apps, orders"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Cadence *</label>
                  <select
                    className="form-input"
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value as GoalCadence)}
                  >
                    <option value="DAILY">DAILY</option>
                    <option value="WEEKLY">WEEKLY</option>
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="QUARTERLY">QUARTERLY</option>
                    <option value="YEARLY">YEARLY</option>
                    <option value="NORTH_STAR">NORTH_STAR</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Owning Pillar</label>
                  <select
                    className="form-input"
                    value={selectedPillar}
                    onChange={(e) => setSelectedPillar(e.target.value)}
                  >
                    <option value="global">Global / North Star</option>
                    {PILLARS.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingGoal ? 'Update Goal' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
