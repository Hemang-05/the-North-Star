// ============================================================================
// PERSONAL OS — Quick Apply Form
// Ultra-low friction application logging that simultaneously creates or updates
// the JobOpportunity, stores the JobApplication record, and logs an ActivityEvent.
// ============================================================================

import { useState } from 'react';
import { Send } from 'lucide-react';
import { dbPut, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { generateId, now } from '../../utils/helpers';
import { showToast } from '../Toast';
import confetti from 'canvas-confetti';
import { JdPasteAutoFill } from './JdPasteAutoFill';
import type { ParsedJdResult } from '../../services/jdParser';
import type {
  JobOpportunity,
  JobApplication,
  CustomizationLevel,
  WorkMode,
} from '../../types';

interface QuickApplyFormProps {
  opportunities: JobOpportunity[];
  initialOpportunity?: JobOpportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function QuickApplyForm({
  opportunities,
  initialOpportunity,
  isOpen,
  onClose,
  onSuccess,
}: QuickApplyFormProps) {
  const [selectedOppId, setSelectedOppId] = useState<string>(initialOpportunity?.id || 'new');
  const [company, setCompany] = useState(initialOpportunity?.company || '');
  const [role, setRole] = useState(initialOpportunity?.role || '');
  const [workMode, setWorkMode] = useState<WorkMode>(initialOpportunity?.workMode || 'REMOTE');
  const [method, setMethod] = useState('LinkedIn Easy Apply');
  const [customizationLevel, setCustomizationLevel] = useState<CustomizationLevel>('TAILORED');
  const [jobUrl, setJobUrl] = useState(initialOpportunity?.jobUrl || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const isNewOpp = selectedOppId === 'new';

  const handleSelectOpp = (id: string) => {
    setSelectedOppId(id);
    if (id !== 'new') {
      const opp = opportunities.find((o) => o.id === id);
      if (opp) {
        setCompany(opp.company);
        setRole(opp.role);
        setWorkMode(opp.workMode);
        setJobUrl(opp.jobUrl || '');
      }
    } else {
      setCompany('');
      setRole('');
      setJobUrl('');
    }
  };

  const handleJdParsed = (result: ParsedJdResult) => {
    if (result.company) setCompany(result.company);
    if (result.role) setRole(result.role);
    if (result.workMode) setWorkMode(result.workMode);
    if (result.skills || result.summary) {
      const extraParts: string[] = [];
      if (result.skills && result.skills.length > 0) {
        extraParts.push(`Key Skills: ${result.skills.join(', ')}`);
      }
      if (result.summary) {
        extraParts.push(result.summary);
      }
      if (extraParts.length > 0) {
        const extra = extraParts.join('\n');
        setNotes((prev) => (prev ? `${prev}\n\n${extra}` : extra));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) {
      showToast('Company and role are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const timestamp = now();
      let oppId = selectedOppId;

      // 1. Create or update opportunity
      if (isNewOpp) {
        oppId = generateId('opp');
        const newOpp: JobOpportunity = {
          id: oppId,
          company: company.trim(),
          role: role.trim(),
          source: method,
          discoveredAt: timestamp,
          jobUrl: jobUrl.trim() || undefined,
          workMode,
          stage: 'APPLIED',
          currency: 'INR',
          priority: 'MEDIUM',
          notes: notes.trim() || undefined,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await dbPut(STORES.JOB_OPPORTUNITIES, newOpp);
      } else {
        const existing = opportunities.find((o) => o.id === oppId);
        if (existing) {
          const updatedStage =
            existing.stage === 'DISCOVERED' || existing.stage === 'OUTREACH'
              ? 'APPLIED'
              : existing.stage;
          const updatedOpp: JobOpportunity = {
            ...existing,
            stage: updatedStage,
            updatedAt: timestamp,
          };
          await dbPut(STORES.JOB_OPPORTUNITIES, updatedOpp);
        }
      }

      // 2. Create JobApplication entity
      const appId = generateId('app');
      const applicationRecord: JobApplication = {
        id: appId,
        opportunityId: oppId,
        company: company.trim(),
        role: role.trim(),
        appliedAt: timestamp,
        method,
        customizationLevel,
        status: 'SUBMITTED',
        notes: notes.trim() || undefined,
      };
      await dbPut(STORES.JOB_APPLICATIONS, applicationRecord);

      // 3. Log ActivityEvent to immutable ledger
      await logEvent(
        'job_hunt',
        'JOB_APPLICATION_SUBMITTED',
        1,
        'apps',
        'JOB_APPLICATION',
        appId,
        {
          company: company.trim(),
          role: role.trim(),
          customizationLevel,
          method,
        }
      );

      // 4. Trigger celebration
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });

      notifyDataChange();
      showToast(`Logged application to ${company} — ${role}!`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Error saving application', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
            }}>
              <Send size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>Quick Apply</h3>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Record application & simultaneously create opportunity + ledger event
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Opportunity selector */}
          <div>
            <label className="form-label">Link to Existing Opportunity or New</label>
            <select
              className="form-input"
              value={selectedOppId}
              onChange={(e) => handleSelectOpp(e.target.value)}
            >
              <option value="new">+ Create New Opportunity & Apply</option>
              {opportunities.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.company} — {opp.role} ({opp.stage})
                </option>
              ))}
            </select>
          </div>

          {/* Smart JD Auto-Fill */}
          {isNewOpp && (
            <JdPasteAutoFill onParsed={handleJdParsed} />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Company Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Stripe, Razorpay"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={!isNewOpp && Boolean(initialOpportunity)}
                required
              />
            </div>
            <div>
              <label className="form-label">Role Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Senior Frontend Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={!isNewOpp && Boolean(initialOpportunity)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Work Mode</label>
              <select
                className="form-input"
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value as WorkMode)}
              >
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ONSITE">Onsite</option>
              </select>
            </div>
            <div>
              <label className="form-label">Application Method</label>
              <select
                className="form-input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="LinkedIn Easy Apply">LinkedIn Easy Apply</option>
                <option value="Company Careers Page">Company Careers Page</option>
                <option value="Referral">Referral</option>
                <option value="Direct Email">Direct Email</option>
                <option value="Wellfound (AngelList)">Wellfound (AngelList)</option>
                <option value="Twitter/X DM">Twitter/X DM</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Customization Level</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {(['QUICK', 'TAILORED', 'DEEP'] as CustomizationLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setCustomizationLevel(lvl)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: customizationLevel === lvl ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                    background: customizationLevel === lvl ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                    color: customizationLevel === lvl ? '#818cf8' : 'var(--text-secondary)',
                    fontWeight: customizationLevel === lvl ? 600 : 400,
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {lvl === 'QUICK' && '⚡ Quick'}
                  {lvl === 'TAILORED' && '🎯 Tailored'}
                  {lvl === 'DEEP' && '🔥 Deep Prep'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Job / Posting URL (Optional)</label>
            <input
              type="url"
              className="form-input"
              placeholder="https://jobs.example.com/..."
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Notes or Keywords</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Key skills mentioned, referral name, compensation noted..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ minWidth: 140 }}
            >
              {saving ? 'Recording...' : 'Record Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
