// ============================================================================
// PERSONAL OS — Job Outreach Tracker
// Track cold & warm outreach to founders, recruiters, and peers.
// Manages reply tracking, follow-up cadence, and logs activity events.
// ============================================================================

import { useState } from 'react';
import {
  MessageSquare,
  Plus,
  CheckCircle,
  Trash2,
  Edit2,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useStore, logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { dbPut, dbDelete, STORES } from '../../services/db';
import type {
  JobOutreach,
  OutreachChannel,
  OutreachContactType,
  JobOpportunity,
} from '../../types';
import { generateId, now, timeAgo, safePct, formatSafePercent } from '../../utils/helpers';
import { showToast } from '../Toast';

interface OutreachTrackerProps {
  opportunities: JobOpportunity[];
  onOpenOutreachModal?: () => void;
}

const CHANNELS: OutreachChannel[] = ['LINKEDIN', 'EMAIL', 'TWITTER', 'REFERRAL', 'OTHER'];
const CONTACT_TYPES: OutreachContactType[] = ['FOUNDER', 'RECRUITER', 'HR', 'PEER', 'OTHER'];

export function OutreachTracker({ opportunities }: OutreachTrackerProps) {
  const { items: outreaches, loading } = useStore<JobOutreach>(STORES.JOB_OUTREACH);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'REPLIED' | 'WAITING'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOutreach, setEditingOutreach] = useState<JobOutreach | null>(null);

  // Form states
  const [formContactName, setFormContactName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formContactType, setFormContactType] = useState<OutreachContactType>('FOUNDER');
  const [formChannel, setFormChannel] = useState<OutreachChannel>('LINKEDIN');
  const [formOppId, setFormOppId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFollowUps, setFormFollowUps] = useState(0);

  // Reset form
  const resetForm = () => {
    setFormContactName('');
    setFormCompany('');
    setFormRole('');
    setFormContactType('FOUNDER');
    setFormChannel('LINKEDIN');
    setFormOppId('');
    setFormNotes('');
    setFormFollowUps(0);
    setEditingOutreach(null);
  };

  const openAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEdit = (o: JobOutreach) => {
    setEditingOutreach(o);
    setFormContactName(o.contactName);
    setFormCompany(o.company || '');
    setFormRole(o.role || '');
    setFormContactType(o.contactType);
    setFormChannel(o.channel);
    setFormOppId(o.opportunityId || '');
    setFormNotes(o.notes || '');
    setFormFollowUps(o.followUpCount || 0);
    setShowAddModal(true);
  };

  const handleSaveOutreach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContactName.trim()) {
      showToast('Contact name is required', 'warning');
      return;
    }

    try {
      const timestamp = now();
      if (editingOutreach) {
        const updated: JobOutreach = {
          ...editingOutreach,
          contactName: formContactName.trim(),
          company: formCompany.trim() || undefined,
          role: formRole.trim() || undefined,
          contactType: formContactType,
          channel: formChannel,
          opportunityId: formOppId || undefined,
          notes: formNotes.trim() || undefined,
          followUpCount: formFollowUps,
        };
        await dbPut(STORES.JOB_OUTREACH, updated);
        showToast('Outreach record updated', 'success');
      } else {
        const newId = generateId('out');
        const newOutreach: JobOutreach = {
          id: newId,
          contactName: formContactName.trim(),
          company: formCompany.trim() || undefined,
          role: formRole.trim() || undefined,
          contactType: formContactType,
          channel: formChannel,
          opportunityId: formOppId || undefined,
          sentAt: timestamp,
          followUpCount: 0,
          notes: formNotes.trim() || undefined,
        };
        await dbPut(STORES.JOB_OUTREACH, newOutreach);

        // Also log activity event
        await logEvent(
          'job_hunt',
          'JOB_OUTREACH_SENT',
          1,
          'messages',
          'JOB_OUTREACH',
          newId,
          {
            contactName: formContactName.trim(),
            company: formCompany.trim(),
            channel: formChannel,
            contactType: formContactType,
          }
        );
        showToast('Outreach logged!', 'success');
      }

      notifyDataChange();
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
      showToast('Failed to save outreach', 'error');
    }
  };

  const handleToggleReply = async (outreach: JobOutreach) => {
    const isCurrentlyReplied = Boolean(outreach.repliedAt);
    const updated: JobOutreach = {
      ...outreach,
      repliedAt: isCurrentlyReplied ? undefined : now(),
    };
    await dbPut(STORES.JOB_OUTREACH, updated);

    if (!isCurrentlyReplied) {
      await logEvent(
        'job_hunt',
        'JOB_REPLY_RECEIVED',
        1,
        'replies',
        'JOB_OUTREACH',
        outreach.id,
        {
          contactName: outreach.contactName,
          company: outreach.company,
        }
      );
      showToast(`Marked reply from ${outreach.contactName}!`, 'success');
    } else {
      showToast('Reverted reply status', 'info');
    }
    notifyDataChange();
  };

  const handleIncrementFollowUp = async (outreach: JobOutreach) => {
    const nextCount = (outreach.followUpCount || 0) + 1;
    const updated: JobOutreach = {
      ...outreach,
      followUpCount: nextCount,
    };
    await dbPut(STORES.JOB_OUTREACH, updated);

    await logEvent(
      'job_hunt',
      'JOB_OUTREACH_FOLLOWUP',
      1,
      'followups',
      'JOB_OUTREACH',
      outreach.id,
      {
        contactName: outreach.contactName,
        company: outreach.company,
        followUpNumber: nextCount,
      }
    );

    notifyDataChange();
    showToast(`Follow-up #${nextCount} logged for ${outreach.contactName}`, 'success');
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete outreach to ${name}?`)) {
      await dbDelete(STORES.JOB_OUTREACH, id);
      notifyDataChange();
      showToast('Outreach deleted', 'info');
    }
  };

  // Filtered list
  const filtered = outreaches.filter((o) => {
    const matchesSearch =
      (o.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.notes || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesChannel = selectedChannel === 'ALL' || o.channel === selectedChannel;
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'REPLIED' && Boolean(o.repliedAt)) ||
      (selectedStatus === 'WAITING' && !o.repliedAt);

    return matchesSearch && matchesChannel && matchesStatus;
  });

  // Calculate quick stats
  const totalSent = outreaches.length;
  const totalReplied = outreaches.filter((o) => o.repliedAt).length;
  const responseRate = safePct(totalReplied, totalSent);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header Card */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={20} style={{ color: '#8b5cf6' }} />
              Direct Outreach & Networking Engine
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Target founders, hiring managers, and recruiters with tailored messaging and tracked follow-ups
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={16} /> Log Outreach
          </button>
        </div>

        {/* Quick stat chips */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12,
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Sent</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{totalSent}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Replies Received</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>{totalReplied}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Response Rate</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#8b5cf6' }}>
              {formatSafePercent(responseRate)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Awaiting Reply</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>
              {totalSent - totalReplied}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 34 }}
            placeholder="Search contact, company, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Channel filter pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {['ALL', ...CHANNELS].map((ch) => (
            <button
              key={ch}
              onClick={() => setSelectedChannel(ch)}
              className="btn btn-sm"
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: selectedChannel === ch ? '#8b5cf6' : 'var(--bg-card)',
                color: selectedChannel === ch ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {ch}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          className="form-input"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as any)}
        >
          <option value="ALL">All Statuses</option>
          <option value="REPLIED">Replied Only</option>
          <option value="WAITING">Awaiting Reply</option>
        </select>
      </div>

      {/* Outreach Cards / List */}
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading outreach history...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state" style={{ padding: 40 }}>
          <MessageSquare size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div className="empty-state-title">No outreach recorded</div>
          <div className="empty-state-text">
            Start reaching out to founders and recruiters directly. Messages sent and replies received will appear here.
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={openAdd}>
            <Plus size={14} /> Log First Outreach
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {filtered.map((o) => {
            const hasReplied = Boolean(o.repliedAt);

            return (
              <div
                key={o.id}
                className="card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  borderLeft: `3px solid ${hasReplied ? '#22c55e' : '#8b5cf6'}`,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{o.contactName}</span>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(139, 92, 246, 0.15)',
                        color: '#a78bfa',
                        fontWeight: 600,
                      }}>
                        {o.contactType}
                      </span>
                    </div>
                    {(o.company || o.role) && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {[o.role, o.company].filter(Boolean).join(' at ')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn-icon"
                      style={{ width: 26, height: 26, padding: 4 }}
                      onClick={() => openEdit(o)}
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn-icon"
                      style={{ width: 26, height: 26, padding: 4, color: '#ef4444' }}
                      onClick={() => handleDelete(o.id, o.contactName)}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Notes if any */}
                {o.notes && (
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-subtle)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    lineHeight: 1.4,
                  }}>
                    {o.notes}
                  </div>
                )}

                {/* Metadata badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: '11px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(255, 255, 255, 0.05)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {o.channel}
                    </span>
                    <span>Sent {timeAgo(o.sentAt)}</span>
                  </div>

                  {o.followUpCount > 0 && (
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                      {o.followUpCount} Follow-up{o.followUpCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Actions row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 10,
                  borderTop: '1px solid var(--border-subtle)',
                  gap: 8,
                }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: hasReplied ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: hasReplied ? '#22c55e' : 'var(--text-secondary)',
                      fontSize: '11px',
                      padding: '4px 10px',
                      gap: 4,
                    }}
                    onClick={() => handleToggleReply(o)}
                  >
                    <CheckCircle size={13} />
                    {hasReplied ? `Replied (${timeAgo(o.repliedAt!)})` : 'Mark Replied'}
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '4px 8px', gap: 4 }}
                    onClick={() => handleIncrementFollowUp(o)}
                    title="Increment follow-up counter and log event"
                  >
                    <RefreshCw size={12} />
                    + Follow-up
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)' }}>
              {editingOutreach ? 'Edit Outreach' : 'Log Direct Outreach'}
            </h3>
            <form onSubmit={handleSaveOutreach} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Contact Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rahul Sharma, Jane Doe"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Company</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Stripe"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Role</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. VP Engineering"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Contact Type</label>
                  <select
                    className="form-input"
                    value={formContactType}
                    onChange={(e) => setFormContactType(e.target.value as OutreachContactType)}
                  >
                    {CONTACT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Channel</label>
                  <select
                    className="form-input"
                    value={formChannel}
                    onChange={(e) => setFormChannel(e.target.value as OutreachChannel)}
                  >
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Link to Existing Opportunity (Optional)</label>
                <select
                  className="form-input"
                  value={formOppId}
                  onChange={(e) => {
                    setFormOppId(e.target.value);
                    if (e.target.value) {
                      const found = opportunities.find((o) => o.id === e.target.value);
                      if (found && !formCompany) setFormCompany(found.company);
                    }
                  }}
                >
                  <option value="">None / General Networking</option>
                  {opportunities.map((opp) => (
                    <option key={opp.id} value={opp.id}>
                      {opp.company} — {opp.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Notes or Opening Pitch Hook</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Sent personalized note referencing their recent engineering blog on distributed systems..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingOutreach ? 'Update Record' : 'Record Outreach'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
