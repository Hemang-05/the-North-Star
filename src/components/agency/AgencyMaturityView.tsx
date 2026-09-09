// ============================================================================
// PERSONAL OS — Agency Maturity View
// Deterministic tier dashboard with criteria checklist and next milestones.
// ============================================================================

import { TrendingUp, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import type { AgencyMaturitySnapshot, AgencyMaturityTier } from '../../types';

interface AgencyMaturityViewProps {
  maturity: AgencyMaturitySnapshot;
}

const TIER_CONFIG: Record<AgencyMaturityTier, { label: string; color: string; emoji: string; rank: number }> = {
  FREELANCER: { label: 'Freelancer', color: '#64748b', emoji: '🌱', rank: 1 },
  SOLO_OPERATOR: { label: 'Solo Operator', color: '#3b82f6', emoji: '🚀', rank: 2 },
  REPEATABLE_AGENCY: { label: 'Repeatable Agency', color: '#8b5cf6', emoji: '🏢', rank: 3 },
  SCALING_AGENCY: { label: 'Scaling Agency', color: '#22c55e', emoji: '⚡', rank: 4 },
};

const ALL_TIERS: AgencyMaturityTier[] = ['FREELANCER', 'SOLO_OPERATOR', 'REPEATABLE_AGENCY', 'SCALING_AGENCY'];

export function AgencyMaturityView({ maturity }: AgencyMaturityViewProps) {
  const currentConfig = TIER_CONFIG[maturity.tier];
  const currentRank = currentConfig.rank;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Current Tier Card */}
      <div className="card" style={{
        padding: '24px',
        background: `linear-gradient(135deg, ${currentConfig.color}15, transparent)`,
        border: `1px solid ${currentConfig.color}30`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: '32px' }}>{currentConfig.emoji}</span>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              Current Agency Maturity
            </div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 700, color: currentConfig.color }}>
              {currentConfig.label}
            </h2>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Maturity Score</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: currentConfig.color }}>
              {maturity.score}/100
            </div>
          </div>
        </div>

        {/* Tier Progress Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
          {ALL_TIERS.map((tier, idx) => {
            const config = TIER_CONFIG[tier];
            const isActive = config.rank <= currentRank;
            const isCurrent = tier === maturity.tier;
            return (
              <div key={tier} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  height: 8, flex: 1, borderRadius: 4,
                  background: isActive
                    ? `linear-gradient(90deg, ${config.color}80, ${config.color})`
                    : 'rgba(255, 255, 255, 0.06)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                }}>
                  {isCurrent && (
                    <div style={{
                      position: 'absolute', right: -3, top: -3,
                      width: 14, height: 14, borderRadius: '50%',
                      background: config.color, border: '2px solid var(--bg-primary)',
                    }} />
                  )}
                </div>
                {idx < ALL_TIERS.length - 1 && (
                  <ArrowRight size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Tier Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          {ALL_TIERS.map(tier => {
            const config = TIER_CONFIG[tier];
            const isCurrent = tier === maturity.tier;
            return (
              <div key={tier} style={{
                fontSize: '10px', textAlign: 'center', flex: 1,
                color: isCurrent ? config.color : 'var(--text-muted)',
                fontWeight: isCurrent ? 700 : 400,
              }}>
                {config.emoji} {config.label}
              </div>
            );
          })}
        </div>

        {/* Criteria Checklist */}
        <div style={{
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>
            Current Tier Criteria
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {maturity.criteria.map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: '12px',
              }}>
                {c.met ? (
                  <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                ) : (
                  <Circle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500, color: c.met ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {c.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 8 }}>
                    ({c.detail})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Next Tier Roadmap */}
      {maturity.nextTier && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={20} style={{ color: TIER_CONFIG[maturity.nextTier.tier].color }} />
            Next Milestone: {maturity.nextTier.label}
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Achieve all of the following to reach the next tier:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {maturity.nextTier.requirements.length > 0 ? (
              maturity.nextTier.requirements.map((req, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                }}>
                  <Circle size={14} style={{ color: TIER_CONFIG[maturity.nextTier!.tier].color, flexShrink: 0 }} />
                  {req}
                </div>
              ))
            ) : (
              <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>
                ✓ All requirements met — you should be at the next tier!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
