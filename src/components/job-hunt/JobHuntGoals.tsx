// ============================================================================
// PERSONAL OS — Job Hunt Goals & Progress Component
// View and configure Job Hunt goals with deterministic live progress computation.
// ============================================================================

import { useState } from 'react';
import { Target, Plus, Check, Edit2, Trash2, TrendingUp, Sparkles } from 'lucide-react';
import { useGoals } from '../../hooks/useDatabase';
import type { Goal, GoalCadence, GoalTargetType } from '../../types';
import type { JobHuntKpiSummary } from '../../services/jobHuntKpi';
import { formatSafePercent, safePct } from '../../utils/helpers';
import { showToast } from '../Toast';

interface JobHuntGoalsProps {
  kpis: JobHuntKpiSummary;
}

const DEFAULT_TEMPLATES = [
  {
    title: 'Weekly Applications',
    description: 'Submit tailored or high-priority applications each week',
    cadence: 'WEEKLY' as GoalCadence,
    targetType: 'COUNT' as GoalTargetType,
    targetValue: 10,
    unit: 'apps',
    weight: 90,
  },
  {
    title: 'Weekly Outbound Outreach',
    description: 'Direct founder and recruiter outreach messages sent',
    cadence: 'WEEKLY' as GoalCadence,
    targetType: 'COUNT' as GoalTargetType,
    targetValue: 15,
    unit: 'messages',
    weight: 85,
  },
  {
    title: 'Interviews & Screenings',
    description: 'Active interviews or screenings reached',
    cadence: 'MONTHLY' as GoalCadence,
    targetType: 'COUNT' as GoalTargetType,
    targetValue: 3,
    unit: 'interviews',
    weight: 95,
  },
  {
    title: 'Weekly Job Hunt Focus Time',
    description: 'Dedicated focus hours for applications, outreach, and interview prep',
    cadence: 'WEEKLY' as GoalCadence,
    targetType: 'COUNT' as GoalTargetType,
    targetValue: 10,
    unit: 'hours',
    weight: 80,
  },
];

export function computeGoalCurrentValue(goal: Goal, kpis: JobHuntKpiSummary): number {
  const title = (goal.title || '').toLowerCase();
  const unit = (goal.unit || '').toLowerCase();

  if (title.includes('application') || unit.includes('app')) {
    if (goal.cadence === 'DAILY') return kpis.applicationsToday;
    if (goal.cadence === 'WEEKLY') return kpis.applicationsThisWeek;
    if (goal.cadence === 'MONTHLY') return kpis.applicationsThisMonth;
    return kpis.totalApplications;
  }

  if (title.includes('outreach') || unit.includes('message')) {
    if (goal.cadence === 'DAILY') return kpis.outreachToday;
    if (goal.cadence === 'WEEKLY') return kpis.outreachThisWeek;
    return kpis.totalOutreach;
  }

  if (title.includes('interview') || title.includes('screening')) {
    return kpis.interviewsReached;
  }

  if (title.includes('offer')) {
    return kpis.offersReceived;
  }

  if (title.includes('focus') || title.includes('hour') || unit.includes('hour')) {
    const hours = kpis.focusTimeThisWeekSeconds / 3600;
    return Math.round(hours * 10) / 10;
  }

  return goal.currentComputedValue || 0;
}

export function JobHuntGoals({ kpis }: JobHuntGoalsProps) {
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCadence, setFormCadence] = useState<GoalCadence>('WEEKLY');
  const [formTargetValue, setFormTargetValue] = useState<number>(10);
  const [formUnit, setFormUnit] = useState('apps');

  const jobGoals = goals.filter((g) => g.pillarId === 'job_hunt');

  const handleApplyTemplate = async (template: typeof DEFAULT_TEMPLATES[0]) => {
    // Avoid duplicate title
    if (jobGoals.some((g) => g.title.toLowerCase() === template.title.toLowerCase())) {
      showToast(`Goal "${template.title}" already exists`, 'info');
      return;
    }

    await addGoal({
      pillarId: 'job_hunt',
      title: template.title,
      description: template.description,
      targetType: template.targetType,
      targetValue: template.targetValue,
      unit: template.unit,
      cadence: template.cadence,
      weight: template.weight,
      isActive: true,
    });
    showToast(`Added goal: ${template.title}`, 'success');
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('Please enter a goal title', 'warning');
      return;
    }

    if (editingGoal) {
      await updateGoal({
        ...editingGoal,
        title: formTitle.trim(),
        description: formDescription.trim(),
        cadence: formCadence,
        targetValue: formTargetValue,
        unit: formUnit.trim(),
      });
      showToast('Goal updated', 'success');
      setEditingGoal(null);
    } else {
      await addGoal({
        pillarId: 'job_hunt',
        title: formTitle.trim(),
        description: formDescription.trim(),
        targetType: 'COUNT',
        targetValue: formTargetValue,
        unit: formUnit.trim(),
        cadence: formCadence,
        weight: 80,
        isActive: true,
      });
      showToast('New goal added', 'success');
    }

    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCadence('WEEKLY');
    setFormTargetValue(10);
    setFormUnit('apps');
  };

  const openEdit = (g: Goal) => {
    setEditingGoal(g);
    setFormTitle(g.title);
    setFormDescription(g.description || '');
    setFormCadence(g.cadence);
    setFormTargetValue(g.targetValue);
    setFormUnit(g.unit || '');
    setShowAddModal(true);
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={20} style={{ color: '#6366f1' }} />
            Job Hunt Goals & Live Target Tracking
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            System automatically calculates current progress from your real-world activity ledger
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            resetForm();
            setEditingGoal(null);
            setShowAddModal(true);
          }}
        >
          <Plus size={16} /> Add Goal
        </button>
      </div>

      {/* If no goals exist, suggest templates */}
      {jobGoals.length === 0 && (
        <div style={{
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(99, 102, 241, 0.05)',
          border: '1px dashed rgba(99, 102, 241, 0.25)',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={18} style={{ color: '#6366f1' }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Recommended Quick-Start Goal Templates</span>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Initialize your targets with one click. Real values will immediately calculate from your data.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {DEFAULT_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.title}
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '10px 14px' }}
                onClick={() => handleApplyTemplate(tmpl)}
              >
                <Plus size={14} style={{ flexShrink: 0, color: '#6366f1' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>{tmpl.title}</div>
                  <div style={{ fontSize: '11px', opacity: 0.7 }}>{tmpl.targetValue} {tmpl.unit} / {tmpl.cadence.toLowerCase()}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Goal Cards Grid */}
      {jobGoals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {jobGoals.map((goal) => {
            const current = computeGoalCurrentValue(goal, kpis);
            const progress = goal.targetValue > 0 ? (current / goal.targetValue) * 100 : 0;
            const cappedProgress = Math.min(progress, 100);
            const isCompleted = current >= goal.targetValue;

            return (
              <div
                key={goal.id}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {goal.title}
                      </span>
                      {isCompleted && (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(34, 197, 94, 0.15)',
                          color: '#22c55e',
                          fontWeight: 700,
                        }}>
                          MET
                        </span>
                      )}
                    </div>
                    {goal.description && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {goal.description}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn-icon"
                      style={{ width: 26, height: 26, padding: 4 }}
                      onClick={() => openEdit(goal)}
                      title="Edit Goal"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn-icon"
                      style={{ width: 26, height: 26, padding: 4, color: '#ef4444' }}
                      onClick={async () => {
                        if (confirm(`Delete goal "${goal.title}"?`)) {
                          await deleteGoal(goal.id);
                          showToast('Goal deleted', 'info');
                        }
                      }}
                      title="Delete Goal"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Numbers */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {current}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginLeft: 4 }}>
                      / {goal.targetValue} {goal.unit || ''}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: isCompleted ? '#22c55e' : '#6366f1',
                  }}>
                    {Math.round(progress)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="progress-bar-container" style={{ height: 6 }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${cappedProgress}%`,
                      background: isCompleted
                        ? 'linear-gradient(90deg, #10b981, #22c55e)'
                        : 'linear-gradient(90deg, #6366f1, #818cf8)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Cadence: {goal.cadence}</span>
                  <span>Auto-computed</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)' }}>
              {editingGoal ? 'Edit Job Hunt Goal' : 'Create Job Hunt Goal'}
            </h3>
            <form onSubmit={handleSaveGoal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Goal Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Weekly Tailored Applications"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">Description (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. High priority senior roles"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Cadence</label>
                  <select
                    className="form-input"
                    value={formCadence}
                    onChange={(e) => setFormCadence(e.target.value as GoalCadence)}
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Target Value</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={formTargetValue}
                    onChange={(e) => setFormTargetValue(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Unit Label</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. apps, messages, hours"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingGoal ? 'Update Goal' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
