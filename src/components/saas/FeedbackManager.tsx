// ============================================================================
// PERSONAL OS — SaaS Feedback Manager
// Triage bugs, UX issues, and feature requests linked to features.
// ============================================================================

import { useState } from 'react';
import {
  Plus, MessageSquare, AlertCircle, Bug, Sparkles,
  Filter, Trash2, X, Link, Check,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type {
  SaasFeedback,
  SaasFeature,
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus,
} from '../../types';
import { generateId, now } from '../../utils/helpers';
import { showToast } from '../Toast';

interface FeedbackManagerProps {
  feedback: SaasFeedback[];
  features: SaasFeature[];
}

const SEVERITY_CONFIG: Record<FeedbackSeverity, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: 'Critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  HIGH: { label: 'High', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  MEDIUM: { label: 'Medium', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  LOW: { label: 'Low', color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.15)' },
};

const TYPE_ICONS: Record<FeedbackType, { label: string; icon: typeof Bug }> = {
  BUG: { label: 'Bug', icon: Bug },
  FEATURE_REQUEST: { label: 'Feature Request', icon: Sparkles },
  UX: { label: 'UX / Design', icon: MessageSquare },
  PERFORMANCE: { label: 'Performance', icon: AlertCircle },
  OTHER: { label: 'Other', icon: MessageSquare },
};

export function FeedbackManager({ feedback, features }: FeedbackManagerProps) {
  const { add, update, remove } = useStore<SaasFeedback>(STORES.SAAS_FEEDBACK);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('OPEN_ONLY');

  // Form state
  const [form, setForm] = useState({
    source: 'Direct Outreach',
    userReference: '',
    feedbackType: 'PERFORMANCE' as FeedbackType,
    severity: 'HIGH' as FeedbackSeverity,
    status: 'OPEN' as FeedbackStatus,
    content: '',
    relatedFeatureId: '',
  });

  const handleAddFeedback = async () => {
    if (!form.content.trim()) {
      showToast('Feedback content is required', 'error');
      return;
    }

    const item: SaasFeedback = {
      id: generateId('fb'),
      source: form.source.trim() || 'Direct',
      userReference: form.userReference.trim() || undefined,
      feedbackType: form.feedbackType,
      severity: form.severity,
      status: form.status,
      content: form.content.trim(),
      relatedFeatureId: form.relatedFeatureId || undefined,
      createdAt: now(),
      resolvedAt: form.status === 'RESOLVED' ? now() : undefined,
    };

    await add(item);
    await logEvent('trading_os', 'SAAS_FEEDBACK_RECEIVED', {
      entityRefType: 'SaasFeedback',
      entityRefId: item.id,
      metadata: {
        feedbackType: item.feedbackType,
        severity: item.severity,
        source: item.source,
        relatedFeatureId: item.relatedFeatureId,
      },
    });

    showToast(`Feedback logged: ${item.feedbackType} (${item.severity})`, 'success');
    setShowAddModal(false);
    setForm({
      source: 'Direct Outreach',
      userReference: '',
      feedbackType: 'PERFORMANCE',
      severity: 'HIGH',
      status: 'OPEN',
      content: '',
      relatedFeatureId: '',
    });
  };

  const handleResolve = async (item: SaasFeedback) => {
    const updated: SaasFeedback = {
      ...item,
      status: 'RESOLVED',
      resolvedAt: now(),
    };
    await update(updated);
    await logEvent('trading_os', 'SAAS_FEEDBACK_RESOLVED', {
      entityRefType: 'SaasFeedback',
      entityRefId: item.id,
      metadata: {
        feedbackType: item.feedbackType,
        severity: item.severity,
      },
    });
    showToast('Feedback marked as resolved', 'success');
  };

  const handleDelete = async (item: SaasFeedback) => {
    if (confirm('Delete this feedback entry?')) {
      await remove(item.id);
      showToast('Feedback deleted', 'info');
    }
  };

  // Filter
  const filtered = feedback.filter((fb) => {
    if (filterSeverity !== 'ALL' && fb.severity !== filterSeverity) return false;
    if (filterStatus === 'OPEN_ONLY' && fb.status === 'RESOLVED') return false;
    if (filterStatus === 'RESOLVED_ONLY' && fb.status !== 'RESOLVED') return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input"
            style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', width: 'auto' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN_ONLY">Open & In Progress</option>
            <option value="RESOLVED_ONLY">Resolved Only</option>
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="input"
            style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', width: 'auto' }}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="LOW">Low Only</option>
          </select>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
          style={{ gap: 6 }}
        >
          <Plus size={14} /> Add Feedback
        </button>
      </div>

      {/* FEEDBACK LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map((item) => {
          const sev = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.MEDIUM;
          const typeCfg = TYPE_ICONS[item.feedbackType] || TYPE_ICONS.OTHER;
          const TypeIcon = typeCfg.icon;
          const linkedFeature = features.find((f) => f.id === item.relatedFeatureId);

          return (
            <div
              key={item.id}
              className="card"
              style={{
                padding: 14,
                border: item.severity === 'CRITICAL' && item.status !== 'RESOLVED'
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : undefined,
                opacity: item.status === 'RESOLVED' ? 0.75 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '10px', padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-secondary)',
                  }}>
                    <TypeIcon size={12} /> {typeCfg.label}
                  </span>

                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: 4,
                    background: sev.bg, color: sev.color, fontWeight: 700,
                  }}>
                    {sev.label}
                  </span>

                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: 4,
                    background: item.status === 'RESOLVED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: item.status === 'RESOLVED' ? '#22c55e' : '#f59e0b',
                    fontWeight: 600,
                  }}>
                    {item.status}
                  </span>

                  {item.source && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      via {item.source} {item.userReference ? `(${item.userReference})` : ''}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.status !== 'RESOLVED' && (
                    <button
                      className="btn btn-sm"
                      style={{
                        background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e',
                        border: '1px solid rgba(34, 197, 94, 0.3)', gap: 4, padding: '4px 8px',
                      }}
                      onClick={() => handleResolve(item)}
                    >
                      <Check size={12} /> Resolve
                    </button>
                  )}

                  <button
                    className="btn-icon btn-ghost"
                    onClick={() => handleDelete(item)}
                    title="Delete feedback"
                  >
                    <Trash2 size={14} style={{ color: '#ef4444' }} />
                  </button>
                </div>
              </div>

              {/* Feedback Content */}
              <div style={{
                marginTop: 10, fontSize: 'var(--text-xs)', color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}>
                {item.content}
              </div>

              {/* Linked feature tag */}
              {linkedFeature && (
                <div style={{
                  marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: '10px', color: '#06b6d4', background: 'rgba(6, 182, 212, 0.08)',
                  padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(6, 182, 212, 0.2)',
                }}>
                  <Link size={10} /> Linked Feature: <strong>{linkedFeature.name}</strong>
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
            No user feedback matching current filters. Log feedback from outreach calls, demos, or support inquiries.
          </div>
        )}
      </div>

      {/* ADD FEEDBACK MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Log User Feedback</h3>
              <button className="btn-icon btn-ghost" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Feedback Content *</label>
                <textarea
                  placeholder="What did the user say? What bug or feature did they request?"
                  className="input"
                  rows={3}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Feedback Type</label>
                  <select
                    className="input"
                    value={form.feedbackType}
                    onChange={(e) => setForm({ ...form, feedbackType: e.target.value as FeedbackType })}
                  >
                    <option value="BUG">Bug</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                    <option value="UX">UX / Usability</option>
                    <option value="PERFORMANCE">Performance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="label">Severity</label>
                  <select
                    className="input"
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value as FeedbackSeverity })}
                  >
                    <option value="CRITICAL">Critical (Blocks usage)</option>
                    <option value="HIGH">High (Pain point)</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low (Cosmetic)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Channel / Source</label>
                  <input
                    type="text"
                    placeholder="e.g. LinkedIn DM, Demo call"
                    className="input"
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">User Name / Handle (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. trader_bob"
                    className="input"
                    value={form.userReference}
                    onChange={(e) => setForm({ ...form, userReference: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Link to Feature (Optional)</label>
                <select
                  className="input"
                  value={form.relatedFeatureId}
                  onChange={(e) => setForm({ ...form, relatedFeatureId: e.target.value })}
                >
                  <option value="">No linked feature</option>
                  {features.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.status})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleAddFeedback}>
                  Record Feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
