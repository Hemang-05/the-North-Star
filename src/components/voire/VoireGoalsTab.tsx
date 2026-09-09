// ============================================================================
// PERSONAL OS — VOIRE Goals & Target Variance Tab
// User-controlled goal manager with optional quick-add templates.
// Goals are NEVER auto-created; user maintains full discretion.
// ============================================================================

import { useState } from 'react';
import { Target, Plus, Trash2, CheckCircle2, TrendingUp, Sparkles, Award } from 'lucide-react';
import type { Goal, CadenceType } from '../../types';
import type { VoireKpiSummary } from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { showToast } from '../Toast';
import { formatINR } from '../../utils/helpers';

interface VoireGoalsTabProps {
  goals: Goal[];
  kpis: VoireKpiSummary;
}

interface GoalTemplate {
  title: string;
  cadence: CadenceType;
  targetValue: number;
  unit: string;
  description: string;
  metricKey: keyof VoireKpiSummary;
}

const OPTIONAL_TEMPLATES: GoalTemplate[] = [
  {
    title: '₹1,00,000 Net Sales',
    cadence: 'MONTHLY',
    targetValue: 100000,
    unit: '₹',
    description: 'Achieve ₹1,00,000 in net sales revenue across capsule drops.',
    metricKey: 'netSales',
  },
  {
    title: '₹35,000 Contribution Profit',
    cadence: 'MONTHLY',
    targetValue: 35000,
    unit: '₹',
    description: 'Generate ₹35,000 in net contribution profit after production, shipping, and marketing ad spend.',
    metricKey: 'contributionProfit',
  },
  {
    title: '3.0x Blended ROAS',
    cadence: 'MONTHLY',
    targetValue: 3.0,
    unit: 'x',
    description: 'Maintain a minimum blended ROAS of 3.0x on paid acquisition campaigns.',
    metricKey: 'roas',
  },
  {
    title: '25 Paid Customer Orders',
    cadence: 'MONTHLY',
    targetValue: 25,
    unit: 'orders',
    description: 'Fulfill at least 25 paid customer transactions.',
    metricKey: 'paidOrdersCount',
  },
  {
    title: '5 Design Concepts in Studio',
    cadence: 'QUARTERLY',
    targetValue: 5,
    unit: 'designs',
    description: 'Develop and sample at least 5 new apparel artwork or silhouette concepts.',
    metricKey: 'totalDesigns',
  },
  {
    title: '4 Live Product SKUs',
    cadence: 'QUARTERLY',
    targetValue: 4,
    unit: 'SKUs',
    description: 'Maintain at least 4 active, commercial-grade product SKUs in catalog.',
    metricKey: 'activeProducts',
  },
];

export function VoireGoalsTab({ goals, kpis }: VoireGoalsTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<CadenceType>('MONTHLY');
  const [targetValue, setTargetValue] = useState<number | ''>('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');

  const activeGoals = (goals || []).filter((g) => g.pillarId === 'voire' && g.status === 'ACTIVE');

  const getMetricValue = (metricKey?: string): number => {
    if (!metricKey || !(metricKey in kpis)) return 0;
    const val = kpis[metricKey as keyof VoireKpiSummary];
    return typeof val === 'number' ? val : 0;
  };

  const handleApplyTemplate = async (tmpl: GoalTemplate) => {
    // Check if duplicate already exists
    const exists = activeGoals.some((g) => g.title === tmpl.title);
    if (exists) {
      showToast(`Goal "${tmpl.title}" is already active`, 'info');
      return;
    }

    const now = new Date().toISOString();
    const currentVal = getMetricValue(tmpl.metricKey);
    const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const newGoal: Goal = {
      id: goalId,
      pillarId: 'voire',
      title: tmpl.title,
      description: tmpl.description,
      cadence: tmpl.cadence,
      targetValue: tmpl.targetValue,
      currentValue: currentVal,
      unit: tmpl.unit,
      status: 'ACTIVE',
      metadata: { metricKey: tmpl.metricKey },
      createdAt: now,
      updatedAt: now,
    };

    await dbPut(STORES.GOALS, newGoal);

    await logEvent({
      pillarId: 'voire',
      eventType: 'GOAL_CREATED',
      entityRef: {
        type: 'Goal',
        id: goalId,
      },
      metadata: { targetValue: tmpl.targetValue, unit: tmpl.unit, title: tmpl.title },
    });

    notifyDataChange(STORES.GOALS);
    showToast(`Activated goal: ${tmpl.title}`, 'success');
  };

  const handleCustomGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || typeof targetValue !== 'number' || targetValue <= 0) {
      showToast('Please provide a goal title and target value', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const newGoal: Goal = {
      id: goalId,
      pillarId: 'voire',
      title: title.trim(),
      description: description.trim() || undefined,
      cadence,
      targetValue,
      currentValue: 0,
      unit: unit.trim() || undefined,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await dbPut(STORES.GOALS, newGoal);

    await logEvent({
      pillarId: 'voire',
      eventType: 'GOAL_CREATED',
      entityRef: {
        type: 'Goal',
        id: goalId,
      },
      metadata: { targetValue, unit, title },
    });

    notifyDataChange(STORES.GOALS);
    showToast(`Created goal: ${title}`, 'success');
    setShowModal(false);
  };

  const handleDeleteGoal = async (id: string, goalTitle: string) => {
    if (!window.confirm(`Delete goal "${goalTitle}"?`)) return;
    await dbDelete(STORES.GOALS, id);
    notifyDataChange(STORES.GOALS);
    showToast('Goal removed', 'info');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', margin: 0 }}>Goals & Target Variance</h2>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
            User-controlled brand targets. Reality is tracked automatically; goals are never auto-created.
          </p>
        </div>
        <button className="voire-btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Custom Goal
        </button>
      </div>

      {/* Active Goals Grid */}
      {activeGoals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed rgba(255,255,255,0.08)', marginBottom: '2rem' }}>
          <Target size={36} style={{ color: '#a855f7', opacity: 0.6, margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.25rem' }}>No Active Goals Configured</h3>
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', maxWidth: '28rem', margin: '0 auto 1.25rem' }}>
            VOIRE operates on discretionary user discipline. Select one of the brand templates below or configure a custom target.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          {activeGoals.map((g) => {
            const currentVal = g.metadata?.metricKey ? getMetricValue(g.metadata.metricKey as string) : (g.currentValue ?? 0);
            const target = g.targetValue || 1;
            const progress = Math.min(100, Math.round((currentVal / target) * 100));
            const isCompleted = progress >= 100;

            return (
              <div key={g.id} style={{ background: 'rgba(24, 24, 37, 0.7)', border: `1px solid ${isCompleted ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`, borderRadius: '0.75rem', padding: '1.25rem', backdropFilter: 'blur(12px)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {g.cadence}
                    </span>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0.25rem 0' }}>{g.title}</h4>
                  </div>
                  <button className="voire-btn-danger" onClick={() => handleDeleteGoal(g.id, g.title)}>
                    <Trash2 size={12} />
                  </button>
                </div>

                {g.description && <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0.25rem 0 1rem' }}>{g.description}</p>}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', marginTop: '1rem', marginBottom: '0.375rem' }}>
                  <span style={{ color: '#9ca3af' }}>Current Reality</span>
                  <span style={{ fontWeight: 700, color: isCompleted ? '#34d399' : '#ffffff' }}>
                    {g.unit === '₹' ? formatINR(currentVal) : `${currentVal} ${g.unit || ''}`} / {g.unit === '₹' ? formatINR(g.targetValue) : `${g.targetValue} ${g.unit || ''}`}
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: isCompleted ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #9333ea, #a855f7)',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginTop: '0.375rem' }}>
                  <span>{progress}% Achieved</span>
                  {isCompleted && <span style={{ color: '#34d399', fontWeight: 600 }}>Goal Met 🎉</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Optional Quick-Add Templates */}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Sparkles size={18} style={{ color: '#a855f7' }} /> Optional Brand Goal Templates
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {OPTIONAL_TEMPLATES.map((tmpl, idx) => {
          const isAdded = activeGoals.some((g) => g.title === tmpl.title);
          return (
            <div key={idx} style={{ background: 'rgba(20, 20, 31, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>{tmpl.cadence}</span>
                  <span style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 600 }}>{tmpl.unit} Target</span>
                </div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#ffffff', margin: '0.375rem 0' }}>{tmpl.title}</h4>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0.25rem 0 1rem' }}>{tmpl.description}</p>
              </div>

              <button
                className={isAdded ? 'voire-btn-secondary' : 'voire-btn-primary'}
                style={{ width: '100%', justifyContent: 'center', padding: '0.5rem' }}
                onClick={() => handleApplyTemplate(tmpl)}
                disabled={isAdded}
              >
                {isAdded ? (
                  <>
                    <CheckCircle2 size={14} style={{ color: '#34d399' }} /> Active
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Activate Template
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="voire-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="voire-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', marginBottom: '1.25rem' }}>
              Create Custom Brand Goal
            </h3>
            <form onSubmit={handleCustomGoal}>
              <div className="voire-form-group">
                <label className="voire-form-label">Goal Title *</label>
                <input
                  type="text"
                  className="voire-form-input"
                  placeholder="e.g. Sell out 50 hoodies on Drop 01"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="voire-form-group">
                  <label className="voire-form-label">Cadence</label>
                  <select
                    className="voire-form-select"
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value as CadenceType)}
                  >
                    <option value="WEEKLY">WEEKLY</option>
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="QUARTERLY">QUARTERLY</option>
                    <option value="NORTH_STAR">NORTH STAR</option>
                  </select>
                </div>
                <div className="voire-form-group">
                  <label className="voire-form-label">Unit of Measure</label>
                  <input
                    type="text"
                    className="voire-form-input"
                    placeholder="e.g. units, ₹, ROAS"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Target Numeric Value *</label>
                <input
                  type="number"
                  className="voire-form-input"
                  placeholder="e.g. 50"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
              </div>

              <div className="voire-form-group">
                <label className="voire-form-label">Goal Strategic Rationale</label>
                <textarea
                  rows={2}
                  className="voire-form-textarea"
                  placeholder="Why this milestone matters for VOIRE unit economics..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="voire-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="voire-btn-primary">
                  Activate Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
