// ============================================================================
// PERSONAL OS — Agency Goals View
// Live target tracking with pre-configured Agency goal templates.
// ============================================================================

import { Target, Plus, Trash2 } from 'lucide-react';
import { useGoals } from '../../hooks/useDatabase';
import type { AgencyKpiSummary } from '../../services/agencyKpi';
import { formatINR } from '../../utils/helpers';
import { showToast } from '../Toast';

interface AgencyGoalsProps {
  kpis: AgencyKpiSummary;
}

const GOAL_TEMPLATES = [
  { title: 'Monthly Realized Cash', targetValue: 200000, unit: '₹', cadence: 'MONTHLY' as const, targetType: 'CURRENCY' as const },
  { title: 'Active Retainer Clients', targetValue: 3, unit: 'clients', cadence: 'MONTHLY' as const, targetType: 'COUNT' as const },
  { title: 'Weekly Leads Generated', targetValue: 5, unit: 'leads', cadence: 'WEEKLY' as const, targetType: 'COUNT' as const },
  { title: 'Monthly Proposals Sent', targetValue: 4, unit: 'proposals', cadence: 'MONTHLY' as const, targetType: 'COUNT' as const },
  { title: 'Weekly Agency Focus Hours', targetValue: 20, unit: 'hours', cadence: 'WEEKLY' as const, targetType: 'COUNT' as const },
];

export function AgencyGoals({ kpis: _kpis }: AgencyGoalsProps) {
  const { goals, addGoal, deleteGoal } = useGoals();
  const agencyGoals = goals.filter(g => g.pillarId === 'agency');

  const handleAddTemplate = async (template: typeof GOAL_TEMPLATES[0]) => {
    // Check if similar goal already exists
    const existing = agencyGoals.find(g =>
      g.title.toLowerCase() === template.title.toLowerCase()
    );
    if (existing) {
      showToast(`Goal "${template.title}" already exists`, 'error');
      return;
    }
    await addGoal({
      pillarId: 'agency',
      title: template.title,
      targetType: template.targetType,
      targetValue: template.targetValue,
      unit: template.unit,
      cadence: template.cadence,
      weight: 50,
      isActive: true,
    });
    showToast(`Goal added: ${template.title}`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Active Goals */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={20} style={{ color: '#8b5cf6' }} />
          Agency Goals & Targets
        </h3>

        {agencyGoals.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <Target size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <div className="empty-state-title">No goals configured</div>
            <div className="empty-state-text">Add goals from the templates below to start tracking progress.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {agencyGoals.map(goal => {
              const pct = goal.targetValue > 0
                ? Math.min((goal.currentComputedValue / goal.targetValue) * 100, 100)
                : 0;
              const isExceeding = goal.currentComputedValue >= goal.targetValue && goal.targetValue > 0;
              const color = isExceeding ? '#22c55e' : pct >= 75 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444';

              return (
                <div key={goal.id} style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{goal.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {goal.cadence} • {goal.unit || ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)',
                          color,
                        }}>
                          {goal.targetType === 'CURRENCY'
                            ? formatINR(goal.currentComputedValue)
                            : goal.currentComputedValue
                          }
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          / {goal.targetType === 'CURRENCY' ? formatINR(goal.targetValue) : goal.targetValue} {goal.unit || ''}
                        </div>
                      </div>
                      <button
                        className="btn-icon"
                        style={{ color: 'var(--text-muted)' }}
                        onClick={() => deleteGoal(goal.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    height: 6, borderRadius: 3,
                    background: 'rgba(255, 255, 255, 0.06)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(pct, 100)}%`,
                      borderRadius: 3,
                      background: `linear-gradient(90deg, ${color}80, ${color})`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '10px', color: 'var(--text-muted)', marginTop: 4,
                  }}>
                    <span>{Math.round(pct)}% complete</span>
                    {isExceeding && <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Target Met</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Goal Templates */}
      <div className="card" style={{ padding: '20px' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Quick-Add Goal Templates
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {GOAL_TEMPLATES.map(t => {
            const exists = agencyGoals.some(g => g.title.toLowerCase() === t.title.toLowerCase());
            return (
              <button
                key={t.title}
                className="btn btn-secondary"
                disabled={exists}
                style={{
                  justifyContent: 'flex-start', gap: 8, padding: '10px 14px',
                  opacity: exists ? 0.5 : 1,
                }}
                onClick={() => handleAddTemplate(t)}
              >
                <Plus size={14} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{t.title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Target: {t.targetType === 'CURRENCY' ? formatINR(t.targetValue) : t.targetValue} {t.unit} / {t.cadence.toLowerCase()}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
