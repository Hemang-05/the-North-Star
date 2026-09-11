// ============================================================================
// PERSONAL OS — Activity Feed Component
// Timeline of recent events.
// ============================================================================

import { useState, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useRecentEvents } from '../hooks/useDatabase';
import { PILLARS, PILLAR_MAP } from '../config/pillars';
import { timeAgo, formatINR } from '../utils/helpers';
import type { ActivityEvent, PillarSlug } from '../types';

type TimeFilter = 'ALL' | 'TODAY' | '7D' | '30D';

// Human-readable event type labels
const EVENT_LABELS: Record<string, string> = {
  JOB_APPLICATION_SUBMITTED: 'Submitted application',
  JOB_OUTREACH_SENT: 'Sent outreach message',
  JOB_REPLY_RECEIVED: 'Received reply',
  JOB_INTERVIEW_BOOKED: 'Interview booked',
  JOB_ASSESSMENT_DONE: 'Completed assessment',
  JOB_OPPORTUNITY_DISCOVERED: 'Discovered opportunity',
  AGENCY_CLIENT_CALL: 'Client call',
  AGENCY_PROPOSAL_SENT: 'Sent proposal',
  AGENCY_PAYMENT_RECEIVED: 'Payment received',
  AGENCY_LEAD_FOUND: 'Found new lead',
  AGENCY_DELIVERABLE_DONE: 'Delivered work',
  AGENCY_FOLLOW_UP: 'Sent follow-up',
  SAAS_FEATURE_COMPLETED: 'Completed feature',
  SAAS_BUG_FIXED: 'Fixed bug',
  SAAS_USER_REGISTERED: 'New user registered',
  SAAS_CONTENT_PUBLISHED: 'Published content',
  SAAS_FEEDBACK_RECEIVED: 'Received feedback',
  SAAS_VERSION_RELEASED: 'Released version',
  FOREX_STUDY_SESSION: 'Study session',
  FOREX_PAPER_TRADE: 'Paper trade executed',
  FOREX_BACKTEST_RUN: 'Backtest completed',
  FOREX_RULE_VIOLATION: 'Rule violation logged',
  FOREX_SETUP_DOCUMENTED: 'Setup documented',
  FITNESS_MEAL_LOGGED: 'Logged meal',
  FITNESS_RUN_COMPLETED: 'Completed run',
  FITNESS_WORKOUT_DONE: 'Completed workout',
  FITNESS_WEIGHT_LOGGED: 'Logged weight',
  FITNESS_SUPPLEMENT_TAKEN: 'Took supplement',
  FITNESS_SLEEP_LOGGED: 'Logged sleep',
  VOIRE_DESIGN_IDEA: 'New design idea',
  VOIRE_ORDER_RECEIVED: 'Order received',
  VOIRE_CONTENT_POSTED: 'Posted content',
  VOIRE_EXPENSE_LOGGED: 'Logged expense',
  VOIRE_SAMPLE_READY: 'Sample ready',
  VOIRE_DESIGN_APPROVED: 'Design approved',
  VOIRE_DESIGN_CREATED: 'Created design',
  VOIRE_DESIGN_UPDATED: 'Updated design',
  VOIRE_DESIGN_STAGE_CHANGED: 'Design stage changed',
  VOIRE_PRODUCT_CREATED: 'Created product',
  VOIRE_PRODUCT_UPDATED: 'Updated product',
  VOIRE_DROP_CREATED: 'Created drop',
  VOIRE_DROP_UPDATED: 'Updated drop',
  VOIRE_DROP_LAUNCHED: 'Launched drop',
  VOIRE_ORDER_RECORDED: 'Order recorded',
  VOIRE_MARKETING_CAMPAIGN_LOGGED: 'Campaign logged',
  ORDER_RECORDED: 'Order recorded',
  PAYMENT_STATUS_UPDATED: 'Payment status updated',
  CAMPAIGN_CREATED: 'Created campaign',
  CAMPAIGN_UPDATED: 'Updated campaign',
  FINANCIAL_PERIOD_LOGGED: 'Financial period logged',
  PRODUCT_CREATED: 'Created product',
  PRODUCT_UPDATED: 'Updated product',
  DROP_CREATED: 'Created drop',
  DROP_UPDATED: 'Updated drop',
  DESIGN_CREATED: 'Created design',
  DESIGN_UPDATED: 'Updated design',
  FOCUS_SESSION_COMPLETED: 'Focus session completed',
};

function getEventContext(event: ActivityEvent): string | null {
  const meta = event.metadata || {};
  if (event.pillarId === 'voire') {
    if (meta.orderNumber) {
      const amt = meta.totalAmount ? ` · ${formatINR(Number(meta.totalAmount))}` : '';
      return `Order #${meta.orderNumber}${amt}`;
    }
    if (meta.name) return String(meta.name);
    if (meta.sku) return String(meta.sku);
  }
  if (event.pillarId === 'agency') {
    if (meta.invoiceNumber) {
      const amt = meta.amount ? ` · ${formatINR(Number(meta.amount))}` : '';
      return `${meta.invoiceNumber}${amt}`;
    }
    if (meta.company) return String(meta.company);
    if (meta.name) return String(meta.name);
  }
  if (event.pillarId === 'job_hunt') {
    if (meta.company && meta.role) return `${meta.company} · ${meta.role}`;
    if (meta.company) return String(meta.company);
  }
  if (event.pillarId === 'trading_os') {
    if (meta.name) return String(meta.name);
    if (meta.title) return String(meta.title);
    if (meta.suiteName) return String(meta.suiteName);
  }
  if (event.pillarId === 'forex') {
    if (meta.pair) return `${meta.pair} ${meta.direction ? `(${meta.direction})` : ''}`.trim();
    if (meta.title) return String(meta.title);
  }
  if (event.pillarId === 'fitness') {
    if (meta.workoutType) return String(meta.workoutType);
    if (event.quantity && event.unit && event.unit !== 'workout') return `${event.quantity} ${event.unit}`;
  }
  if (meta.category) {
    const dur = meta.durationSeconds ? ` (${Math.round(Number(meta.durationSeconds) / 60)}m)` : '';
    return `${meta.category}${dur}`;
  }
  if (event.entityRef) {
    return `${event.entityRef.type}`;
  }
  return null;
}

export function ActivityFeed({ limit = 50 }: { limit?: number }) {
  const { events, loading } = useRecentEvents(limit);
  const [selectedPillar, setSelectedPillar] = useState<PillarSlug | 'ALL'>('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');

  const filteredEvents = useMemo(() => {
    const nowMs = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    return events
      .filter((event) => {
        // Pillar filter
        if (selectedPillar !== 'ALL' && event.pillarId !== selectedPillar) {
          return false;
        }
        // Time filter
        if (timeFilter === 'TODAY') {
          return event.occurredAt.startsWith(todayStr);
        }
        if (timeFilter === '7D') {
          const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
          return new Date(event.occurredAt).getTime() >= sevenDaysAgo;
        }
        if (timeFilter === '30D') {
          const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
          return new Date(event.occurredAt).getTime() >= thirtyDaysAgo;
        }
        return true;
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [events, selectedPillar, timeFilter]);

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} />
            Activity Feed
          </div>
        </div>
        <div className="card-body">
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="text-xs text-muted" style={{ animation: 'pulse 1.5s infinite' }}>
              Loading...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header" style={{ paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} />
            Activity Feed
          </div>
          <span className="badge badge-neutral">{filteredEvents.length}</span>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
          {/* Pillar Filters */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              className={`btn btn-xs ${selectedPillar === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedPillar('ALL')}
              style={{ fontSize: 11, padding: '2px 8px', height: 24 }}
            >
              All
            </button>
            {PILLARS.map((p) => (
              <button
                key={p.id}
                className={`btn btn-xs ${selectedPillar === p.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedPillar(p.id)}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  height: 24,
                  borderColor: selectedPillar === p.id ? p.color : 'transparent',
                  color: selectedPillar === p.id ? '#ffffff' : 'var(--text-secondary)',
                  background: selectedPillar === p.id ? p.color : 'transparent',
                }}
              >
                {p.title}
              </button>
            ))}
          </div>

          {/* Time Filters */}
          <div style={{ display: 'flex', gap: 3 }}>
            {(['ALL', '30D', '7D', 'TODAY'] as TimeFilter[]).map((tf) => (
              <button
                key={tf}
                className={`btn btn-xs ${timeFilter === tf ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setTimeFilter(tf)}
                style={{ fontSize: 10, padding: '2px 6px', height: 22 }}
              >
                {tf === 'ALL' ? 'All Time' : tf === 'TODAY' ? 'Today' : tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {filteredEvents.length === 0 ? (
          <div className="empty-state" style={{ padding: '36px 16px' }}>
            <div className="empty-state-icon">
              <Activity size={24} />
            </div>
            <div className="empty-state-title" style={{ fontSize: 'var(--text-sm)' }}>No activity found</div>
            <div className="empty-state-text" style={{ fontSize: 'var(--text-xs)' }}>
              {selectedPillar !== 'ALL' || timeFilter !== 'ALL'
                ? 'No events match the selected filters.'
                : 'Use Quick Capture or record actions in any pillar.'}
            </div>
          </div>
        ) : (
          filteredEvents.map((event, idx) => {
            const pillar = PILLAR_MAP[event.pillarId];
            const contextText = getEventContext(event);
            return (
              <div
                key={event.id}
                className="feed-item"
                style={{ animationDelay: `${idx * 25}ms`, padding: '8px 12px' }}
                title={`${new Date(event.occurredAt).toLocaleString()} (Source: ${event.source || 'USER'})`}
              >
                <div
                  className="feed-dot"
                  style={{ background: pillar?.color || '#6b7280' }}
                />
                <div className="feed-content" style={{ minWidth: 0 }}>
                  <div className="feed-title" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{EVENT_LABELS[event.eventType] || event.eventType.replace(/_/g, ' ')}</span>
                    {event.source && event.source !== 'USER' && (
                      <span className="badge badge-neutral" style={{ fontSize: 9, padding: '1px 4px' }}>
                        {event.source}
                      </span>
                    )}
                  </div>
                  <div className="feed-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ color: pillar?.color || 'var(--text-secondary)', fontWeight: 600 }}>
                      {pillar?.title || event.pillarId}
                    </span>
                    {contextText && (
                      <>
                        <span>·</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {contextText}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="feed-time" style={{ flexShrink: 0 }}>
                  {timeAgo(event.occurredAt)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
