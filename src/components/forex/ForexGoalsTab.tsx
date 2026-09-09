// ============================================================================
// PERSONAL OS — Forex Goals & Targets View
// Live target tracking with optional quick-add templates for Pillar 4: Forex Learning.
// User-controlled, editable, and synchronized with deterministic facts.
// ============================================================================

import { useState } from 'react';
import {
  Target, Plus, Trash2, CheckCircle2, AlertCircle, Edit2, X,
  TrendingUp, BookOpen, Microscope, ShieldCheck, Flame,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { Goal, GoalCadence, GoalTargetType } from '../../types';
import type { ForexKpiSummary } from '../../services/forexKpi';
import { generateId, now, formatSafePercent } from '../../utils/helpers';
import { showToast } from '../Toast';

interface ForexGoalsTabProps {
  kpis: ForexKpiSummary;
  goals: Goal[];
}

// Optional quick-add templates (NOT automatically created)
const OPTIONAL_GOAL_TEMPLATES: {
  title: string;
  description: string;
  targetValue: number;
  targetType: GoalTargetType;
  cadence: GoalCadence;
  unit: string;
  icon: typeof BookOpen;
  color: string;
}[] = [
  {
    title: '10h Study this Month',
    description: 'Master fundamentals, market structure, and liquidity concepts',
    targetValue: 10,
    targetType: 'COUNT',
    cadence: 'MONTHLY',
    unit: 'hours',
    icon: BookOpen,
    color: '#f59e0b',
  },
  {
    title: '50 Backtested Trades',
    description: 'Gather statistically significant sample size before forward execution',
    targetValue: 50,
    targetType: 'COUNT',
    cadence: 'MONTHLY',
    unit: 'trades',
    icon: Microscope,
    color: '#3b82f6',
  },
  {
    title: '90% Rule Adherence',
    description: 'Maintain strict process adherence across all paper trade executions',
    targetValue: 90,
    targetType: 'PERCENT',
    cadence: 'MONTHLY',
    unit: '%',
    icon: ShieldCheck,
    color: '#10b981',
  },
  {
    title: '1 Setup Validated',
    description: 'Prove statistical edge and rules clarity to promote setup to VALIDATED',
    targetValue: 1,
    targetType: 'COUNT',
    cadence: 'NORTH_STAR',
    unit: 'setups',
    icon: Target,
    color: '#8b5cf6',
  },
  {
    title: '20 Clean Paper Trades',
    description: 'Execute consecutive trades without emotional leaks or rule breaches',
    targetValue: 20,
    targetType: 'COUNT',
    cadence: 'MONTHLY',
    unit: 'trades',
    icon: Flame,
    color: '#ec4899',
  },
];

export function ForexGoalsTab({ kpis, goals }: ForexGoalsTabProps) {
  const { add, update, remove } = useStore<Goal>(STORES.GOALS);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [form, setForm] = useState({
    title: '',
    targetValue: '',
    targetType: 'COUNT' as GoalTargetType,
    cadence: 'MONTHLY' as GoalCadence,
    unit: '',
  });

  const forexGoals = goals.filter((g) => g.pillarId === 'forex' && g.isActive);

  // Compute live current value based on goal title and type
  const getComputedValue = (goal: Goal): number => {
    const title = goal.title.toLowerCase();
    if (title.includes('study') || title.includes('hour')) {
      return Math.floor(kpis.totalStudyMinutes / 60);
    }
    if (title.includes('backtest') || title.includes('sample')) {
      return kpis.totalBacktestedTrades;
    }
    if (title.includes('adherence') || title.includes('rule')) {
      return Math.round(kpis.ruleAdherenceRate ?? 0);
    }
    if (title.includes('validated') || title.includes('setup')) {
      return kpis.setupsValidated;
    }
    if (title.includes('streak') || title.includes('clean')) {
      return kpis.cleanTradeStreak;
    }
    if (title.includes('paper') || title.includes('trade')) {
      return kpis.totalPaperTrades;
    }
    return goal.currentComputedValue || 0;
  };

  const handleOpenCreate = () => {
    setEditingGoal(null);
    setForm({
      title: '',
      targetValue: '',
      targetType: 'COUNT',
      cadence: 'MONTHLY',
      unit: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setForm({
      title: goal.title,
      targetValue: goal.targetValue.toString(),
      targetType: goal.targetType,
      cadence: goal.cadence,
      unit: goal.unit || '',
    });
    setShowModal(true);
  };

  const handleQuickAdd = async (template: typeof OPTIONAL_GOAL_TEMPLATES[0]) => {
    const alreadyExists = forexGoals.some((g) => g.title === template.title);
    if (alreadyExists) {
      showToast(`Goal "${template.title}" is already active`, 'info');
      return;
    }

    const newGoal: Goal = {
      id: generateId('goal_fx'),
      pillarId: 'forex',
      title: template.title,
      description: template.description,
      targetValue: template.targetValue,
      targetType: template.targetType,
      cadence: template.cadence,
      unit: template.unit,
      currentComputedValue: 0,
      isActive: true,
      createdAt: now(),
    };

    newGoal.currentComputedValue = getComputedValue(newGoal);

    await add(newGoal);

    await logEvent('forex', 'GOAL_CREATED', {
      quantity: template.targetValue,
      unit: template.unit,
      entityRefType: 'Goal',
      entityRefId: newGoal.id,
      metadata: { title: template.title, cadence: template.cadence },
    });

    showToast(`Added goal: ${template.title}`, 'success');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetVal = parseFloat(form.targetValue);
    if (!form.title.trim() || isNaN(targetVal)) {
      showToast('Please enter a title and numeric target value', 'error');
      return;
    }

    if (editingGoal) {
      const updated: Goal = {
        ...editingGoal,
        title: form.title.trim(),
        targetValue: targetVal,
        targetType: form.targetType,
        cadence: form.cadence,
        unit: form.unit.trim() || undefined,
      };
      updated.currentComputedValue = getComputedValue(updated);
      await update(updated);
      showToast('Goal updated', 'success');
    } else {
      const newGoal: Goal = {
        id: generateId('goal_fx'),
        pillarId: 'forex',
        title: form.title.trim(),
        targetValue: targetVal,
        targetType: form.targetType,
        cadence: form.cadence,
        unit: form.unit.trim() || undefined,
        currentComputedValue: 0,
        isActive: true,
        createdAt: now(),
      };
      newGoal.currentComputedValue = getComputedValue(newGoal);
      await add(newGoal);

      await logEvent('forex', 'GOAL_CREATED', {
        quantity: targetVal,
        unit: form.unit.trim() || undefined,
        entityRefType: 'Goal',
        entityRefId: newGoal.id,
        metadata: { title: newGoal.title, cadence: newGoal.cadence },
      });

      showToast('Custom goal added', 'success');
    }

    setShowModal(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Delete goal "${title}"?`)) {
      await remove(id);
      showToast('Goal removed', 'info');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Active Goals Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={18} style={{ color: '#f59e0b' }} /> Active Forex Goals ({forexGoals.length})
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Goals represent user-controlled targets. Live progress is deterministically computed from your reality.
            </p>
          </div>

          <button
            className="btn btn-primary btn-sm"
            style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
            onClick={handleOpenCreate}
          >
            <Plus size={14} /> Custom Goal
          </button>
        </div>

        {forexGoals.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <Target size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 4 }}>
              No Active Goals Configured
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', maxWidth: 420, margin: '0 auto 16px' }}>
              Goals remain user-controlled. Click any optional template below or create a custom goal to measure variance.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {forexGoals.map((goal) => {
              const current = getComputedValue(goal);
              const target = goal.targetValue || 1;
              const pct = Math.min(150, Math.round((current / target) * 100));
              const isMet = current >= target;

              return (
                <div
                  key={goal.id}
                  className="card"
                  style={{
                    padding: 16,
                    borderLeft: `4px solid ${isMet ? '#10b981' : '#f59e0b'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge" style={{ fontSize: 10, background: 'rgba(255, 255, 255, 0.06)', marginBottom: 4 }}>
                        {goal.cadence}
                      </span>
                      <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: '4px 0 0' }}>
                        {goal.title}
                      </h3>
                      {goal.description && (
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                          {goal.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn-icon"
                        style={{ color: 'var(--text-subtle)' }}
                        onClick={() => handleOpenEdit(goal)}
                        title="Edit Goal"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ color: 'var(--text-subtle)' }}
                        onClick={() => handleDelete(goal.id, goal.title)}
                        title="Delete Goal"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Value */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: isMet ? '#10b981' : 'var(--text-primary)' }}>
                        {current} / {target} {goal.unit || ''}
                      </span>
                      <span style={{ color: isMet ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                        {pct}%
                      </span>
                    </div>

                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, pct)}%`,
                          background: isMet ? '#10b981' : '#f59e0b',
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Optional Quick-Add Templates */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} style={{ color: '#f59e0b' }} /> Optional Quick-Add Goal Templates
        </h3>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 16px' }}>
          These are pre-configured learning targets. They are not active until you choose to add them.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {OPTIONAL_GOAL_TEMPLATES.map((tmpl) => {
            const Icon = tmpl.icon;
            const isAlreadyActive = forexGoals.some((g) => g.title === tmpl.title);

            return (
              <div
                key={tmpl.title}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-sm)',
                      background: `${tmpl.color}20`,
                      color: tmpl.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={15} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>
                    {tmpl.title}
                  </div>
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                  {tmpl.description}
                </p>

                <button
                  className={`btn btn-xs ${isAlreadyActive ? 'btn-ghost' : 'btn-primary'}`}
                  style={!isAlreadyActive ? { background: `${tmpl.color}25`, color: tmpl.color, borderColor: `${tmpl.color}50`, marginTop: 'auto' } : { marginTop: 'auto' }}
                  disabled={isAlreadyActive}
                  onClick={() => handleQuickAdd(tmpl)}
                >
                  {isAlreadyActive ? '✓ Active' : '+ Add Goal'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Goal Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={18} style={{ color: '#f59e0b' }} /> {editingGoal ? 'Edit Goal' : 'Add Custom Goal'}
              </h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Goal Title *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 15h Study this Month"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Target Value *</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    placeholder="15"
                    value={form.targetValue}
                    onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Unit (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="hours, trades, %"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Target Type</label>
                  <select
                    className="select"
                    value={form.targetType}
                    onChange={(e) => setForm({ ...form, targetType: e.target.value as GoalTargetType })}
                  >
                    <option value="COUNT">Count</option>
                    <option value="PERCENT">Percent (%)</option>
                    <option value="BOOLEAN">Boolean</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Cadence</label>
                  <select
                    className="select"
                    value={form.cadence}
                    onChange={(e) => setForm({ ...form, cadence: e.target.value as GoalCadence })}
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="NORTH_STAR">North Star</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 6 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
                >
                  {editingGoal ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
