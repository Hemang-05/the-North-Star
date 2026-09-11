// ============================================================================
// PERSONAL OS — SaaS Distribution View (Business Loop)
// First-class distribution activity console across channels.
// ============================================================================

import { useState } from 'react';
import {
  Plus,
  Filter,
  Trash2,
  X,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type {
  SaasDistributionActivity,
  DistributionChannel,
  DistributionActivityType,
} from '../../types';
import { ALL_DISTRIBUTION_CHANNELS } from '../../services/saasKpi';
import { generateId, now, formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';

interface DistributionViewProps {
  distribution: SaasDistributionActivity[];
  distributionFocusSeconds: number;
}

const CHANNEL_ICONS: Record<DistributionChannel, { label: string; color: string }> = {
  LINKEDIN: { label: 'LinkedIn', color: '#0a66c2' },
  X: { label: 'X / Twitter', color: '#38bdf8' },
  REDDIT: { label: 'Reddit', color: '#ff4500' },
  DISCORD: { label: 'Discord', color: '#5865f2' },
  COMMUNITY: { label: 'Community', color: '#8b5cf6' },
  DIRECT_OUTREACH: { label: 'Direct Outreach', color: '#22c55e' },
  PRODUCT_HUNT: { label: 'Product Hunt', color: '#da552f' },
  CONTENT: { label: 'Content / Blog', color: '#ec4899' },
  REFERRAL: { label: 'Referral', color: '#f59e0b' },
  OTHER: { label: 'Other', color: '#a1a1aa' },
};

const ACTIVITY_TYPES: DistributionActivityType[] = [
  'POST',
  'DEMO',
  'OUTREACH',
  'COMMUNITY',
  'CONTENT',
  'LAUNCH',
  'PARTNERSHIP',
  'OTHER',
];

export function DistributionView({ distribution, distributionFocusSeconds: _distributionFocusSeconds }: DistributionViewProps) {
  const { add, remove } = useStore<SaasDistributionActivity>(STORES.SAAS_DISTRIBUTION);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterChannel, setFilterChannel] = useState<string>('ALL');

  // Form state
  const [form, setForm] = useState({
    channel: 'LINKEDIN' as DistributionChannel,
    activityType: 'POST' as DistributionActivityType,
    quantity: '1',
    notes: '',
  });

  const handleLogActivity = async () => {
    const act: SaasDistributionActivity = {
      id: generateId('dist'),
      channel: form.channel,
      activityType: form.activityType,
      quantity: form.quantity ? Number(form.quantity) : 1,
      notes: form.notes.trim() || undefined,
      createdAt: now(),
    };

    await add(act);
    await logEvent('trading_os', 'SAAS_DISTRIBUTION_ACTIVITY', {
      entityRefType: 'SaasDistributionActivity',
      entityRefId: act.id,
      quantity: act.quantity,
      unit: 'activity',
      metadata: {
        channel: act.channel,
        activityType: act.activityType,
        notes: act.notes,
      },
    });

    showToast(`Distribution activity logged: ${act.activityType} on ${CHANNEL_ICONS[act.channel].label}`, 'success');
    setShowAddModal(false);
    setForm({ channel: 'LINKEDIN', activityType: 'POST', quantity: '1', notes: '' });
  };

  const handleDelete = async (act: SaasDistributionActivity) => {
    if (confirm('Delete this distribution log?')) {
      await remove(act.id);
      showToast('Distribution log deleted', 'info');
    }
  };

  // Channel breakdown
  const channelCounts: Record<string, number> = {};
  for (const item of distribution) {
    channelCounts[item.channel] = (channelCounts[item.channel] || 0) + 1;
  }

  // Filter
  const filteredActivities = distribution.filter((d) => {
    if (filterChannel !== 'ALL' && d.channel !== filterChannel) return false;
    return true;
  });

  const sortedActivities = [...filteredActivities].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* CHANNEL BREAKDOWN CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {ALL_DISTRIBUTION_CHANNELS.map((ch) => {
          const cfg = CHANNEL_ICONS[ch];
          const count = channelCounts[ch] || 0;
          return (
            <div
              key={ch}
              className="card"
              style={{
                padding: '10px 12px',
                background: count > 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                border: count > 0 ? `1px solid ${cfg.color}30` : '1px solid rgba(255, 255, 255, 0.04)',
                cursor: 'pointer',
              }}
              onClick={() => setFilterChannel(filterChannel === ch ? 'ALL' : ch)}
            >
              <div style={{ fontSize: '10px', color: cfg.color, fontWeight: 600, marginBottom: 2 }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {count}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                {count === 1 ? 'activity' : 'activities'}
              </div>
            </div>
          );
        })}
      </div>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="input"
            style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', width: 'auto' }}
          >
            <option value="ALL">All Channels</option>
            {ALL_DISTRIBUTION_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_ICONS[ch].label}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
          style={{ gap: 6 }}
        >
          <Plus size={14} /> Log Distribution
        </button>
      </div>

      {/* ACTIVITIES LOG TABLE */}
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Channel</th>
              <th style={{ padding: '12px 16px' }}>Activity Type</th>
              <th style={{ padding: '12px 16px' }}>Quantity</th>
              <th style={{ padding: '12px 16px' }}>Notes / Context</th>
              <th style={{ padding: '12px 16px' }}>Logged At</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedActivities.map((act) => {
              const cfg = CHANNEL_ICONS[act.channel] || CHANNEL_ICONS.OTHER;
              return (
                <tr key={act.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '10px', padding: '2px 8px', borderRadius: 4,
                      background: `${cfg.color}20`, color: cfg.color, fontWeight: 700,
                    }}>
                      {cfg.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {act.activityType}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {act.quantity || 1}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)', maxWidth: 300 }}>
                    {act.notes || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {formatDate(act.createdAt)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      className="btn-icon btn-ghost"
                      onClick={() => handleDelete(act)}
                      title="Delete log"
                    >
                      <Trash2 size={14} style={{ color: '#ef4444' }} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {sortedActivities.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No distribution activities logged yet. Distribution is the lifeline of SaaS. Click "Log Distribution" to record your outbound work.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* LOG ACTIVITY MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Log Distribution Activity</h3>
              <button className="btn-icon btn-ghost" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Channel</label>
                  <select
                    className="input"
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value as DistributionChannel })}
                  >
                    {ALL_DISTRIBUTION_CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>{CHANNEL_ICONS[ch].label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Activity Type</label>
                  <select
                    className="input"
                    value={form.activityType}
                    onChange={(e) => setForm({ ...form, activityType: e.target.value as DistributionActivityType })}
                  >
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Quantity / Volume</label>
                <input
                  type="number"
                  placeholder="e.g. 1 post, 5 DMs, 10 outreach messages"
                  className="input"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Notes / Content Link / Target Audience</label>
                <textarea
                  placeholder="What was posted or shared? Who did you contact? What response or interest did you observe?"
                  className="input"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleLogActivity}>
                  Record Distribution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
