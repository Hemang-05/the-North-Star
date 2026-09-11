// ============================================================================
// PERSONAL OS — SaaS Release Manager
// Version control, release deployment tracking, and changelog management.
// ============================================================================

import { useState } from 'react';
import {
  Plus, Tag, Trash2, X, Send,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type { SaasRelease, ReleaseStatus } from '../../types';
import { generateId, now, formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';

interface ReleaseManagerProps {
  releases: SaasRelease[];
}

const STATUS_CONFIG: Record<ReleaseStatus, { color: string; bg: string; label: string }> = {
  PUBLISHED: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', label: 'Published' },
  STAGING: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'Staging' },
  DRAFT: { color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.15)', label: 'Draft' },
  ROLLED_BACK: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Rolled Back' },
};

export function ReleaseManager({ releases }: ReleaseManagerProps) {
  const { add, update, remove } = useStore<SaasRelease>(STORES.SAAS_RELEASES);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    version: '',
    releaseName: '',
    releaseNotes: '',
    status: 'DRAFT' as ReleaseStatus,
  });

  const handleCreateRelease = async () => {
    if (!form.version.trim()) {
      showToast('Version tag is required (e.g. v0.1.0)', 'error');
      return;
    }

    const release: SaasRelease = {
      id: generateId('rel'),
      version: form.version.trim(),
      releaseName: form.releaseName.trim() || form.version.trim(),
      releaseNotes: form.releaseNotes.trim(),
      status: form.status,
      releasedAt: form.status === 'PUBLISHED' ? now() : undefined,
      createdAt: now(),
    };

    await add(release);
    await logEvent('trading_os', 'SAAS_RELEASE_CREATED', {
      entityRefType: 'SaasRelease',
      entityRefId: release.id,
      metadata: {
        version: release.version,
        releaseName: release.releaseName,
        status: release.status,
      },
    });

    if (release.status === 'PUBLISHED') {
      await logEvent('trading_os', 'SAAS_RELEASE_PUBLISHED', {
        entityRefType: 'SaasRelease',
        entityRefId: release.id,
        metadata: {
          version: release.version,
          releaseName: release.releaseName,
        },
      });
    }

    showToast(`Release ${release.version} created`, 'success');
    setShowAddModal(false);
    setForm({ version: '', releaseName: '', releaseNotes: '', status: 'DRAFT' });
  };

  const handlePublish = async (release: SaasRelease) => {
    const updated: SaasRelease = {
      ...release,
      status: 'PUBLISHED',
      releasedAt: now(),
    };
    await update(updated);
    await logEvent('trading_os', 'SAAS_RELEASE_PUBLISHED', {
      entityRefType: 'SaasRelease',
      entityRefId: release.id,
      metadata: {
        version: release.version,
        releaseName: release.releaseName,
      },
    });
    showToast(`🚀 Release ${release.version} published!`, 'success');
  };

  const handleDelete = async (release: SaasRelease) => {
    if (confirm(`Delete release ${release.version}?`)) {
      await remove(release.id);
      showToast('Release deleted', 'info');
    }
  };

  // Sort releases by releasedAt / createdAt descending
  const sortedReleases = [...releases].sort((a, b) => {
    const timeA = new Date(a.releasedAt || a.createdAt).getTime();
    const timeB = new Date(b.releasedAt || b.createdAt).getTime();
    return timeB - timeA;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* HEADER & ACTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Releases & Deployment Timeline
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Track deployed software versions and public changelogs.
          </div>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
          style={{ gap: 6 }}
        >
          <Plus size={14} /> New Release
        </button>
      </div>

      {/* RELEASES LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedReleases.map((rel) => {
          const cfg = STATUS_CONFIG[rel.status] || STATUS_CONFIG.DRAFT;
          return (
            <div
              key={rel.id}
              className="card"
              style={{
                padding: 18,
                border: rel.status === 'PUBLISHED' ? '1px solid rgba(34, 197, 94, 0.25)' : undefined,
                background: rel.status === 'PUBLISHED' ? 'rgba(34, 197, 94, 0.02)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag size={16} style={{ color: cfg.color }} />
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {rel.version}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      — {rel.releaseName}
                    </span>
                    <span style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: 4,
                      background: cfg.bg, color: cfg.color, fontWeight: 700,
                    }}>
                      {cfg.label}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {rel.releasedAt ? `Released on ${formatDate(rel.releasedAt)}` : `Draft created on ${formatDate(rel.createdAt)}`}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {rel.status !== 'PUBLISHED' && (
                    <button
                      className="btn btn-sm"
                      style={{
                        background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e',
                        border: '1px solid rgba(34, 197, 94, 0.3)', gap: 6,
                      }}
                      onClick={() => handlePublish(rel)}
                    >
                      <Send size={12} /> Mark as Released
                    </button>
                  )}

                  <button
                    className="btn-icon btn-ghost"
                    onClick={() => handleDelete(rel)}
                    title="Delete release"
                  >
                    <Trash2 size={14} style={{ color: '#ef4444' }} />
                  </button>
                </div>
              </div>

              {rel.releaseNotes && (
                <div style={{
                  marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap', lineHeight: 1.5,
                }}>
                  {rel.releaseNotes}
                </div>
              )}
            </div>
          );
        })}

        {sortedReleases.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
            No releases created yet. Click "New Release" to ship your first build (e.g. v0.1.0).
          </div>
        )}
      </div>

      {/* CREATE RELEASE MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Create New Release</h3>
              <button className="btn-icon btn-ghost" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div>
                  <label className="label">Version *</label>
                  <input
                    type="text"
                    placeholder="e.g. v0.1.0"
                    className="input"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label">Release Name</label>
                  <input
                    type="text"
                    placeholder="e.g. MVP Launch, Core Engine Alpha"
                    className="input"
                    value={form.releaseName}
                    onChange={(e) => setForm({ ...form, releaseName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Release Status</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ReleaseStatus })}
                >
                  <option value="PUBLISHED">Published (Released Now)</option>
                  <option value="STAGING">Staging / Release Candidate</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>

              <div>
                <label className="label">Release Notes & Changelog</label>
                <textarea
                  placeholder="Bullet points of what changed, new features, bug fixes, or breaking changes..."
                  className="input"
                  rows={4}
                  value={form.releaseNotes}
                  onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleCreateRelease}>
                  Save Release
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
