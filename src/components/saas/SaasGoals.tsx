// ============================================================================
// PERSONAL OS — SaaS Goals View
// Live target tracking with optional quick-add templates for Trading OS → SaaS.
// User-controlled, editable, and synchronized with deterministic facts.
// ============================================================================

import { useState } from 'react';
import {
  Target, Plus, Trash2, Edit2, X,
  TrendingUp, Users, DollarSign, Sparkles, Megaphone,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { Goal, GoalCadence, GoalTargetType } from '../../types';
import type { SaasKpiSummary } from '../../services/saasKpi';
import { generateId, now } from '../../utils/helpers';
import { showToast } from '../Toast';

interface SaasGoalsProps {
  kpis: SaasKpiSummary;
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
  icon: typeof Users;
  color: string;
}[] = [
  {
    title: '100+ Active Users',
    description: 'Grow trading community and active platform users',
    targetValue: 100,
    targetType: 'COUNT',
    cadence: 'MONTHLY',
    unit: 'users',
    icon: Users,
    color: '#3b82f6',
  },
  {
    title: '15% Paying-User Conversion',
    description: 'Convert free/trial users to paying subscribers',
    targetValue: 15,
    targetType: 'PERCENT',
    cadence: 'MONTHLY',
    unit: '%',
    icon: TrendingUp,
    color: '#22c55e',
  },
  {
    title: '₹10,000 Recurring Revenue',
    description: 'Monthly recurring revenue from subscription tiers',
    targetValue: 10000,
    targetType: 'CURRENCY',
    cadence: 'MONTHLY',
    unit: '₹',
    icon: DollarSign,
    color: '#8b5cf6',
  },
  {
    title: '5 Features Completed',
    description: 'Ship tested capabilities to improve product utility',
    targetValue: 5,
    targetType: 'COUNT',
    cadence: 'MONTHLY',
    unit: 'features',
    icon: Sparkles,
    color: '#06b6d4',
  },
  {
    title: '10 Distribution Activities',
    description: 'Weekly outbound outreach, social content, and demos',
    targetValue: 10,
    targetType: 'COUNT',
    cadence: 'WEEKLY',
    unit: 'activities',
    icon: Megaphone,
    color: '#ec4899',
  },
];

export function SaasGoals({ kpis, goals }: SaasGoalsProps) {
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

  const saasGoals = goals.filter((g) => g.pillarId === 'trading_os' && g.isActive);

  // Compute live current value based on goal title and type
  const getComputedValue = (goal: Goal): number => {
    const title = goal.title.toLowerCase();
    if (title.includes('conversion')) {
      return Math.round(kpis.payingConversionRate || 0);
    }
    if (title.includes('paying') && !title.includes('conversion')) {
      return kpis.payingUsers;
    }
    if (title.includes('user')) {
      return kpis.activeUsers > 0 ? kpis.activeUsers : kpis.totalUsers;
    }
    if (title.includes('revenue') || title.includes('mrr')) {
      return kpis.recurringRevenue;
    }
    if (title.includes('feature')) {
      return kpis.featuresDone;
    }
    if (title.includes('distribution')) {
      return goal.cadence === 'WEEKLY' ? kpis.distributionThisWeek : kpis.totalDistributionActivities;
    }
    return goal.currentComputedValue || 0;
  };

  const handleApplyTemplate = (tpl: typeof OPTIONAL_GOAL_TEMPLATES[0]) => {
    setEditingGoal(null);
    setForm({
      title: tpl.title,
      targetValue: String(tpl.targetValue),
      targetType: tpl.targetType,
      cadence: tpl.cadence,
      unit: tpl.unit,
    });
    setShowModal(true);
  };

  const handleSaveGoal = async () => {
    if (!form.title.trim() || !form.targetValue) {
      showToast('Title and target value are required', 'error');
      return;
    }

    const val = Number(form.targetValue);

    if (editingGoal) {
      const updated: Goal = {
        ...editingGoal,
        title: form.title.trim(),
        targetValue: val,
        targetType: form.targetType,
        cadence: form.cadence,
        unit: form.unit.trim() || undefined,
        currentComputedValue: getComputedValue({ ...editingGoal, title: form.title }),
      };
      await update(updated);
      showToast('Goal updated', 'success');
    } else {
      const newGoal: Goal = {
        id: generateId('goal'),
        pillarId: 'trading_os',
        title: form.title.trim(),
        targetValue: val,
        targetType: form.targetType,
        cadence: form.cadence,
        unit: form.unit.trim() || undefined,
        currentComputedValue: 0,
        weight: 100,
        isActive: true,
        createdAt: now(),
      };
      newGoal.currentComputedValue = getComputedValue(newGoal);
      await add(newGoal);
      await logEvent('trading_os', 'GOAL_CREATED', {
        entityRefType: 'Goal',
        entityRefId: newGoal.id,
        metadata: { title: newGoal.title, targetValue: newGoal.targetValue },
      });
      showToast('Goal created', 'success');
    }

    setShowModal(false);
    setEditingGoal(null);
    setForm({ title: '', targetValue: '', targetType: 'COUNT', cadence: 'MONTHLY', unit: '' });
  };

  const handleDeleteGoal = async (goal: Goal) => {
    if (confirm(`Delete goal "${goal.title}"?`)) {
      await remove(goal.id);
      showToast('Goal removed', 'info');
    }
  };

  const handleOpenEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setForm({
      title: goal.title,
      targetValue: String(goal.targetValue),
      targetType: goal.targetType,
      cadence: goal.cadence,
      unit: goal.unit || '',
    });
    setShowModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Active SaaS Goals & Variance Tracking
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Live performance calculated directly from observed reality.
          </div>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditingGoal(null);
            setForm({ title: '', targetValue: '', targetType: 'COUNT', cadence: 'MONTHLY', unit: '' });
            setShowModal(true);
          }}
          style={{ gap: 6 }}
        >
          <Plus size={14} /> Custom Goal
        </button>
      </div>

      {/* ACTIVE GOALS CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {saasGoals.map((goal) => {
          const current = getComputedValue(goal);
          const pct = goal.targetValue > 0 ? Math.round((current / goal.targetValue) * 100) : 0;
          const isDone = pct >= 100;

          return (
            <div
              key={goal.id}
              className="card"
              style={{
                padding: 16,
                border: isDone ? '1px solid rgba(34, 197, 94, 0.3)' : undefined,
                background: isDone ? 'rgba(34, 197, 94, 0.02)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Target size={16} style={{ color: isDone ? '#22c55e' : '#06b6d4' }} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                      {goal.title}
                    </span>
                    <span style={{
                      fontSize: '10px', padding: '1px 6px', borderRadius: 4,
                      background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)',
                    }}>
                      {goal.cadence}
                    </span>
                  </div>

                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    Current: <strong>{current}</strong> / Target: {goal.targetValue} {goal.unit || ''}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 'var(--text-base)', fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: isDone ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444',
                  }}>
                    {pct}%
                  </span>

                  <button
                    className="btn-icon btn-ghost"
                    onClick={() => handleOpenEdit(goal)}
                    title="Edit goal"
                  >
                    <Edit2 size={14} />
                  </button>

                  <button
                    className="btn-icon btn-ghost"
                    onClick={() => handleDeleteGoal(goal)}
                    title="Delete goal"
                  >
                    <Trash2 size={14} style={{ color: '#ef4444' }} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                height: 6, width: '100%', background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: 3, marginTop: 12, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(pct, 100)}%`,
                  background: isDone ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#06b6d4',
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          );
        })}

        {saasGoals.length === 0 && (
          <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
            No active SaaS goals configured. Use the quick-add templates below or click "Custom Goal" to define your targets.
          </div>
        )}
      </div>

      {/* OPTIONAL QUICK-ADD TEMPLATES */}
      <div>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Optional Goal Templates (Click to Pre-fill)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {OPTIONAL_GOAL_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            const alreadyAdded = saasGoals.some((g) => g.title === tpl.title);
            return (
              <div
                key={tpl.title}
                className="card"
                style={{
                  padding: 14,
                  cursor: alreadyAdded ? 'default' : 'pointer',
                  border: alreadyAdded ? '1px solid rgba(255, 255, 255, 0.04)' : `1px solid ${tpl.color}30`,
                  background: alreadyAdded ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.03)',
                  opacity: alreadyAdded ? 0.6 : 1,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}
                onClick={() => !alreadyAdded && handleApplyTemplate(tpl)}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Icon size={14} style={{ color: tpl.color }} />
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                      {tpl.title}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {tpl.description}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    Target: {tpl.targetValue} {tpl.unit} ({tpl.cadence})
                  </span>
                  <span style={{ fontSize: '10px', color: tpl.color, fontWeight: 600 }}>
                    {alreadyAdded ? 'Added ✓' : '+ Add'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>
                {editingGoal ? 'Edit Goal' : 'Create SaaS Goal'}
              </h3>
              <button className="btn-icon btn-ghost" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Goal Title *</label>
                <input
                  type="text"
                  placeholder="e.g. 100+ Active Users, 5 Features Completed"
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Target Value *</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    className="input"
                    value={form.targetValue}
                    onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Unit (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. users, %, ₹, features"
                    className="input"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Target Type</label>
                  <select
                    className="input"
                    value={form.targetType}
                    onChange={(e) => setForm({ ...form, targetType: e.target.value as GoalTargetType })}
                  >
                    <option value="COUNT">Count</option>
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="CURRENCY">Currency (₹)</option>
                    <option value="DURATION">Duration (Minutes)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Cadence</label>
                  <select
                    className="input"
                    value={form.cadence}
                    onChange={(e) => setForm({ ...form, cadence: e.target.value as GoalCadence })}
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSaveGoal}>
                  {editingGoal ? 'Update Goal' : 'Create Goal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
