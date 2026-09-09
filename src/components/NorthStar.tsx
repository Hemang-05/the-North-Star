// ============================================================================
// PERSONAL OS — North Star Report View
// Top-level goal tracking and revenue attribution.
// ============================================================================

import { useState } from 'react';
import { Star, Target, TrendingUp, AlertTriangle, Edit3, Check } from 'lucide-react';
import { useGoals } from '../hooks/useDatabase';
import { PILLARS } from '../config/pillars';
import { formatINR, formatPercent, generateId, now } from '../utils/helpers';
import { showToast } from './Toast';
import { AIAnalysisCard } from './ai/AIAnalysisCard';
import type { Goal } from '../types';

export function NorthStarView() {
  const { goals, addGoal, updateGoal } = useGoals();
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  const northStar = goals.find((g) => g.cadence === 'NORTH_STAR' && g.pillarId === null);
  const pillarGoals = goals.filter((g) => g.cadence !== 'NORTH_STAR' || g.pillarId !== null);

  // Group goals by pillar
  const goalsByPillar = PILLARS.map((p) => ({
    pillar: p,
    goals: pillarGoals.filter((g) => g.pillarId === p.id),
  }));

  // North Star target
  const northStarTarget = northStar?.targetValue || 10000000;
  const northStarCurrent = northStar?.currentComputedValue || 0;
  const northStarProgress = (northStarCurrent / northStarTarget) * 100;

  const handleCreateNorthStar = async () => {
    if (northStar) return;
    await addGoal({
      pillarId: null,
      title: 'North Star',
      description: '₹1 Crore total business value / revenue / proceeds within one year',
      targetType: 'CURRENCY',
      targetValue: 10000000,
      unit: 'INR',
      cadence: 'NORTH_STAR',
      targetDate: '2027-09-04',
      weight: 100,
      isActive: true,
    });
    showToast('North Star goal created!', 'success');
  };

  const handleUpdateTarget = async () => {
    if (!northStar) return;
    const val = parseFloat(targetInput);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid amount', 'warning');
      return;
    }
    await updateGoal({ ...northStar, targetValue: val });
    setEditingTarget(false);
    showToast('North Star target updated', 'success');
  };

  const handleAddPillarGoal = async (pillarId: string) => {
    const title = prompt('Goal title:');
    if (!title) return;
    const targetStr = prompt('Target value:');
    if (!targetStr) return;
    const target = parseFloat(targetStr);
    if (isNaN(target)) return;

    await addGoal({
      pillarId: pillarId as Goal['pillarId'],
      title,
      targetType: 'COUNT',
      targetValue: target,
      unit: '',
      cadence: 'MONTHLY',
      weight: 50,
      isActive: true,
    });
    showToast(`Goal "${title}" added`, 'success');
  };

  return (
    <div className="page-body">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Star size={24} style={{ color: 'var(--clr-north-star)' }} />
            <h1 style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--clr-north-star)',
            }}>
              North Star Report
            </h1>
          </div>
          <p className="text-sm text-muted">
            Is actual behavior converging toward the North Star?
          </p>
        </div>

        {/* North Star Hero Card */}
        <div className="card card-north-star" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ position: 'relative', zIndex: 1, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--clr-north-star)',
              }}>
                Target
              </div>
              {northStar && (
                <button
                  className="btn-icon"
                  style={{ width: 28, height: 28, border: 'none', background: 'rgba(251,191,36,0.1)' }}
                  onClick={() => {
                    setEditingTarget(!editingTarget);
                    setTargetInput(northStar.targetValue.toString());
                  }}
                >
                  <Edit3 size={12} style={{ color: 'var(--clr-north-star)' }} />
                </button>
              )}
            </div>

            {editingTarget ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--text-2xl)', color: 'var(--clr-north-star)' }}>₹</span>
                <input
                  type="number"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="form-input"
                  style={{ fontSize: 'var(--text-xl)', maxWidth: 200 }}
                  autoFocus
                />
                <button className="btn btn-sm btn-primary" onClick={handleUpdateTarget}>
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div style={{
                fontSize: 'var(--text-4xl)',
                fontWeight: 900,
                color: 'var(--clr-north-star)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}>
                {formatINR(northStarTarget)}
              </div>
            )}

            {/* Progress */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Progress: {formatINR(northStarCurrent)}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--clr-north-star)' }}>
                  {formatPercent(northStarProgress)}
                </span>
              </div>
              <div className="progress-bar" style={{ height: 8 }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(northStarProgress, 100)}%`,
                    background: 'var(--grad-north-star)',
                  }}
                />
              </div>
            </div>

            {!northStar && (
              <button
                className="btn btn-primary"
                onClick={handleCreateNorthStar}
                style={{ marginTop: 16 }}
              >
                <Target size={16} />
                Initialize North Star Goal
              </button>
            )}
          </div>
        </div>

        {/* Revenue Contributing Pillars */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} />
            Revenue-Contributing Pillars
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {goalsByPillar.map(({ pillar, goals: pGoals }) => (
              <div
                key={pillar.id}
                className="card card-pillar"
                style={{ '--pillar-color': pillar.color } as React.CSSProperties}
              >
                <div className="card-body" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: pGoals.length > 0 ? 10 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: pillar.color,
                      }} />
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>
                        {pillar.title}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                        P{pillar.priorityRank}
                      </span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleAddPillarGoal(pillar.id)}
                    >
                      + Goal
                    </button>
                  </div>

                  {pGoals.length === 0 ? (
                    <div className="text-xs text-muted">
                      No goals defined yet. Click "+ Goal" to add one.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {pGoals.map((g) => {
                        const progress = g.targetValue > 0 ? (g.currentComputedValue / g.targetValue) * 100 : 0;
                        return (
                          <div key={g.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span className="text-sm">{g.title}</span>
                              <span className="text-xs text-muted">
                                {g.currentComputedValue} / {g.targetValue} {g.unit}
                              </span>
                            </div>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${Math.min(progress, 100)}%`,
                                  background: pillar.color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strategic AI Intelligence (Layer 4) */}
        <div style={{ marginBottom: 24 }}>
          <AIAnalysisCard
            mode="NORTH_STAR"
            title="Strategic North Star Interpretation"
            allowBrutal={true}
          />
        </div>

        {/* Strategic Warning */}
        <div className="card" style={{ border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <AlertTriangle size={18} style={{ color: 'var(--clr-warning)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', marginBottom: 4 }}>
                Evidence-Based Only
              </div>
              <div className="text-sm text-muted">
                The North Star progress is computed solely from actual recorded revenue events
                and concrete financial data. No estimates, no projections, no assumptions.
                Record reality — the system shows you where you stand.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
