// ============================================================================
// PERSONAL OS — SaaS Feature Manager (Build Loop)
// Kanban + Table hybrid for tracking features from Idea to Done.
// ============================================================================

import { useState } from 'react';
import {
  Plus,
  Filter, LayoutGrid, List, Trash2, X,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { SaasFeature, FeatureStatus, FeaturePriority, SaasTestRun } from '../../types';
import { ALL_FEATURE_STATUSES } from '../../services/saasKpi';
import { generateId, now, formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';

interface FeatureManagerProps {
  features: SaasFeature[];
  tests: SaasTestRun[];
  onSelectFeature?: (feature: SaasFeature) => void;
}

const STATUS_COLUMNS: { status: FeatureStatus; label: string; color: string }[] = [
  { status: 'IDEA', label: 'Idea', color: '#64748b' },
  { status: 'PLANNED', label: 'Planned', color: '#8b5cf6' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: '#06b6d4' },
  { status: 'TESTING', label: 'Testing', color: '#f59e0b' },
  { status: 'DONE', label: 'Done ✓', color: '#22c55e' },
  { status: 'BLOCKED', label: 'Blocked ⚠️', color: '#ef4444' },
];

const PRIORITY_BADGES: Record<FeaturePriority, { label: string; color: string; bg: string }> = {
  P0: { label: 'P0 Critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  P1: { label: 'P1 High', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  P2: { label: 'P2 Medium', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  P3: { label: 'P3 Low', color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.15)' },
};

export function FeatureManager({ features, tests, onSelectFeature }: FeatureManagerProps) {
  const { add, update, remove } = useStore<SaasFeature>(STORES.SAAS_FEATURES);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'KANBAN' | 'LIST'>('KANBAN');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [selectedFeature, setSelectedFeature] = useState<SaasFeature | null>(null);

  // New feature form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Core Trading',
    priority: 'P1' as FeaturePriority,
    status: 'PLANNED' as FeatureStatus,
  });

  const handleCreateFeature = async () => {
    if (!form.name.trim()) {
      showToast('Feature name is required', 'error');
      return;
    }

    const feature: SaasFeature = {
      id: generateId('feat'),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      category: form.category.trim() || 'Core Trading',
      createdAt: now(),
      updatedAt: now(),
      completedAt: form.status === 'DONE' ? now() : undefined,
    };

    await add(feature);
    await logEvent('trading_os', 'SAAS_FEATURE_CREATED', {
      entityRefType: 'SaasFeature',
      entityRefId: feature.id,
      metadata: {
        name: feature.name,
        priority: feature.priority,
        category: feature.category,
        status: feature.status,
      },
    });

    showToast(`Feature created: ${feature.name}`, 'success');
    setShowAddModal(false);
    setForm({
      name: '',
      description: '',
      category: 'Core Trading',
      priority: 'P1',
      status: 'PLANNED',
    });
  };

  const handleStatusChange = async (feature: SaasFeature, newStatus: FeatureStatus) => {
    if (feature.status === newStatus) return;

    const updated: SaasFeature = {
      ...feature,
      status: newStatus,
      updatedAt: now(),
      completedAt: newStatus === 'DONE' ? now() : feature.completedAt,
    };

    await update(updated);

    let eventType = 'SAAS_FEATURE_STATUS_CHANGED';
    if (newStatus === 'IN_PROGRESS') eventType = 'SAAS_FEATURE_STARTED';
    else if (newStatus === 'TESTING') eventType = 'SAAS_FEATURE_TESTED';
    else if (newStatus === 'DONE') eventType = 'SAAS_FEATURE_COMPLETED';
    else if (newStatus === 'BLOCKED') eventType = 'SAAS_FEATURE_BLOCKED';

    await logEvent('trading_os', eventType, {
      entityRefType: 'SaasFeature',
      entityRefId: feature.id,
      metadata: {
        name: feature.name,
        from: feature.status,
        to: newStatus,
      },
    });

    showToast(`${feature.name} → ${newStatus.replace('_', ' ')}`, 'success');
  };

  const handleDelete = async (feature: SaasFeature) => {
    if (confirm(`Delete feature "${feature.name}"?`)) {
      await remove(feature.id);
      showToast('Feature deleted', 'info');
      if (selectedFeature?.id === feature.id) setSelectedFeature(null);
    }
  };

  // Filter features
  const filteredFeatures = features.filter((f) => {
    if (filterPriority !== 'ALL' && f.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* TOOLBAR */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={`btn btn-sm ${viewMode === 'KANBAN' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('KANBAN')}
            style={{ gap: 6 }}
          >
            <LayoutGrid size={14} /> Kanban
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'LIST' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('LIST')}
            style={{ gap: 6 }}
          >
            <List size={14} /> Table
          </button>

          {/* Priority filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="input"
              style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', width: 'auto' }}
            >
              <option value="ALL">All Priorities</option>
              <option value="P0">P0 Critical</option>
              <option value="P1">P1 High</option>
              <option value="P2">P2 Medium</option>
              <option value="P3">P3 Low</option>
            </select>
          </div>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
          style={{ gap: 6 }}
        >
          <Plus size={14} /> Add Feature
        </button>
      </div>

      {/* KANBAN VIEW */}
      {viewMode === 'KANBAN' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          alignItems: 'start',
        }}>
          {STATUS_COLUMNS.map((col) => {
            const colFeatures = filteredFeatures.filter((f) => f.status === col.status);
            return (
              <div
                key={col.status}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  minHeight: 320,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {/* Column header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingBottom: 8, borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: col.color }}>
                    {col.label}
                  </span>
                  <span style={{
                    fontSize: '10px', padding: '1px 6px', borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)',
                  }}>
                    {colFeatures.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colFeatures.map((feat) => {
                    const featTests = tests.filter((t) => t.featureId === feat.id);
                    const pBadge = PRIORITY_BADGES[feat.priority] || PRIORITY_BADGES.P2;
                    return (
                      <div
                        key={feat.id}
                        className="card"
                        style={{
                          padding: 12,
                          background: 'rgba(255, 255, 255, 0.03)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: feat.status === 'BLOCKED' ? '1px solid rgba(239, 68, 68, 0.3)' : undefined,
                        }}
                        onClick={() => {
                          setSelectedFeature(feat);
                          onSelectFeature?.(feat);
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                          <span style={{
                            fontSize: '9px', padding: '2px 6px', borderRadius: 4,
                            background: pBadge.bg, color: pBadge.color, fontWeight: 700,
                          }}>
                            {pBadge.label}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {feat.category}
                          </span>
                        </div>

                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                          {feat.name}
                        </div>

                        {feat.description && (
                          <div style={{
                            fontSize: '11px', color: 'var(--text-secondary)',
                            lineHeight: 1.4, marginBottom: 8,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>
                            {feat.description}
                          </div>
                        )}

                        {/* Associated test info */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                          fontSize: '10px', color: 'var(--text-muted)',
                        }}>
                          <span>
                            {featTests.length > 0 ? (
                              <span style={{ color: featTests.some((t) => t.result === 'FAIL') ? '#ef4444' : '#22c55e' }}>
                                ✓ {featTests.length} test{featTests.length > 1 ? 's' : ''}
                              </span>
                            ) : (
                              'No tests'
                            )}
                          </span>

                          {/* Quick stage selector */}
                          <select
                            value={feat.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleStatusChange(feat, e.target.value as FeatureStatus);
                            }}
                            className="input"
                            style={{
                              padding: '2px 4px', fontSize: '9px', width: 'auto',
                              background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {ALL_FEATURE_STATUSES.map((s) => (
                              <option key={s} value={s}>→ {s.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}

                  {colFeatures.length === 0 && (
                    <div style={{
                      textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted)',
                      fontSize: '11px', fontStyle: 'italic',
                    }}>
                      No features
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'LIST' && (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Feature</th>
                <th style={{ padding: '12px 16px' }}>Category</th>
                <th style={{ padding: '12px 16px' }}>Priority</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Tests</th>
                <th style={{ padding: '12px 16px' }}>Created</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFeatures.map((feat) => {
                const featTests = tests.filter((t) => t.featureId === feat.id);
                const pBadge = PRIORITY_BADGES[feat.priority] || PRIORITY_BADGES.P2;
                return (
                  <tr
                    key={feat.id}
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', cursor: 'pointer' }}
                    onClick={() => setSelectedFeature(feat)}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{feat.name}</div>
                      {feat.description && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                          {feat.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{feat.category}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: 4,
                        background: pBadge.bg, color: pBadge.color, fontWeight: 700,
                      }}>
                        {pBadge.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={feat.status}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleStatusChange(feat, e.target.value as FeatureStatus);
                        }}
                        className="input"
                        style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', width: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {ALL_FEATURE_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {featTests.length} ({featTests.filter((t) => t.result === 'PASS').length} pass)
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {formatDate(feat.createdAt)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        className="btn-icon btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(feat);
                        }}
                        title="Delete feature"
                      >
                        <Trash2 size={14} style={{ color: '#ef4444' }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredFeatures.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No features recorded yet. Click "Add Feature" above to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE FEATURE MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Add New SaaS Feature</h3>
              <button className="btn-icon btn-ghost" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Feature Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dashboard Redesign, Order Book Stream"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Core Trading, Analytics, User Management"
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Priority</label>
                  <select
                    className="input"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as FeaturePriority })}
                  >
                    <option value="P0">P0 — Critical (Blocker)</option>
                    <option value="P1">P1 — High</option>
                    <option value="P2">P2 — Medium</option>
                    <option value="P3">P3 — Low</option>
                  </select>
                </div>

                <div>
                  <label className="label">Initial Status</label>
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as FeatureStatus })}
                  >
                    <option value="IDEA">Idea</option>
                    <option value="PLANNED">Planned</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="TESTING">Testing</option>
                    <option value="DONE">Done</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Description / Scope</label>
                <textarea
                  placeholder="What does this feature accomplish? What are the acceptance criteria?"
                  className="input"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleCreateFeature}>
                  Create Feature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
