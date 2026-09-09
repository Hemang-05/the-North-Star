// ============================================================================
// PERSONAL OS — Quick Capture Pad
// Single-tap event recording for all pillars.
// ============================================================================

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { PILLARS, QUICK_EVENTS } from '../config/pillars';
import { logEvent } from '../hooks/useDatabase';
import { showToast } from './Toast';
import type { PillarSlug } from '../types';

export function QuickCapture() {
  const [activePillar, setActivePillar] = useState<PillarSlug>('job_hunt');
  const [recentlyTapped, setRecentlyTapped] = useState<string | null>(null);

  const currentPillar = PILLARS.find((p) => p.id === activePillar)!;
  const events = QUICK_EVENTS[activePillar] || [];

  const handleQuickLog = async (eventType: string, label: string) => {
    setRecentlyTapped(eventType);
    await logEvent(activePillar, eventType);
    showToast(`✓ ${label} recorded`, 'success', 2000);
    setTimeout(() => setRecentlyTapped(null), 600);
  };

  return (
    <div className="page-body">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 4,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(34, 197, 94, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--clr-success)',
            }}>
              <Zap size={20} />
            </div>
            <div>
              <h1 style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}>
                Quick Capture
              </h1>
              <p className="text-xs text-muted">
                Single tap to record reality. The system counts.
              </p>
            </div>
          </div>
        </div>

        {/* Pillar Tabs */}
        <div style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          overflowX: 'auto',
          paddingBottom: 4,
        }}>
          {PILLARS.map((p) => (
            <button
              key={p.id}
              className={`btn btn-sm ${activePillar === p.id ? '' : 'btn-ghost'}`}
              style={activePillar === p.id ? {
                background: p.color,
                color: 'white',
                boxShadow: `0 2px 12px ${p.color}44`,
                border: 'none',
              } : {}}
              onClick={() => setActivePillar(p.id)}
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Quick Action Grid */}
        <div className="card card-pillar" style={{ '--pillar-color': currentPillar.color } as React.CSSProperties}>
          <div className="card-body">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 10,
            }}>
              {events.map((evt) => (
                <button
                  key={evt.eventType}
                  className="quick-action-btn"
                  style={{
                    borderColor: recentlyTapped === evt.eventType ? currentPillar.color : undefined,
                    background: recentlyTapped === evt.eventType ? `${currentPillar.color}15` : undefined,
                    transform: recentlyTapped === evt.eventType ? 'scale(0.95)' : undefined,
                  }}
                  onClick={() => handleQuickLog(evt.eventType, evt.label)}
                >
                  <span className="emoji">{evt.emoji}</span>
                  <span>{evt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tip */}
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>💡</span>
          <span>
            Each tap instantly records an event with the current timestamp.
            The system calculates your daily totals, streaks, and conversion rates automatically.
          </span>
        </div>
      </div>
    </div>
  );
}
