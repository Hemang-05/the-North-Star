// ============================================================================
// PERSONAL OS — Job Opportunity Manager
// Pipeline management with Kanban & List views, stage transitions, search,
// filters, and unified creation/editing.
// ============================================================================

import { useState } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List as ListIcon,
  ExternalLink,
  Edit2,
  Trash2,
  Send,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { dbPut, dbDelete, dbGetAll, STORES } from '../../services/db';
import type {
  JobOpportunity,
  JobStage,
  WorkMode,
  InterviewRecord,
  InterviewRoundType,
  InterviewOutcome,
} from '../../types';
import { ALL_JOB_STAGES } from '../../services/jobHuntKpi';
import { generateId, now, timeAgo, formatINR, todayDate } from '../../utils/helpers';
import { showToast } from '../Toast';
import { QuickApplyForm } from './QuickApplyForm';

interface OpportunityManagerProps {
  opportunities: JobOpportunity[];
  loading: boolean;
  onOpenQuickApply?: (opp?: JobOpportunity) => void;
  onOpenOutreach?: (opp?: JobOpportunity) => void;
}

// Kanban column grouping
const KANBAN_COLUMNS: { id: string; title: string; stages: JobStage[]; color: string }[] = [
  { id: 'discovered', title: 'Discovered', stages: ['DISCOVERED'], color: '#64748b' },
  { id: 'applied', title: 'Applied / In Review', stages: ['APPLIED'], color: '#3b82f6' },
  { id: 'outreach', title: 'Outreach & Sourced', stages: ['OUTREACH', 'REPLIED'], color: '#8b5cf6' },
  { id: 'interviewing', title: 'Interviews & Screening', stages: ['SCREENING', 'INTERVIEW', 'ASSESSMENT', 'FINAL_ROUND'], color: '#ec4899' },
  { id: 'offers', title: 'Offers', stages: ['OFFER'], color: '#22c55e' },
  { id: 'archived', title: 'Archived / Closed', stages: ['REJECTED', 'WITHDRAWN', 'GHOSTED'], color: '#71717a' },
];

export function OpportunityManager({
  opportunities,
  loading,
  onOpenOutreach,
}: OpportunityManagerProps) {
  const [viewMode, setViewMode] = useState<'KANBAN' | 'LIST'>('KANBAN');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [workModeFilter, setWorkModeFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOpp, setEditingOpp] = useState<JobOpportunity | null>(null);
  const [quickApplyTargetOpp, setQuickApplyTargetOpp] = useState<JobOpportunity | null>(null);
  const [interviewTargetOpp, setInterviewTargetOpp] = useState<JobOpportunity | null>(null);

  // Interview modal states
  const [ivRoundType, setIvRoundType] = useState<InterviewRoundType>('TECHNICAL');
  const [ivRoundNumber, setIvRoundNumber] = useState<number>(1);
  const [ivInterviewerName, setIvInterviewerName] = useState('');
  const [ivInterviewerRole, setIvInterviewerRole] = useState('');
  const [ivScheduledAt, setIvScheduledAt] = useState(todayDate());
  const [ivNotes, setIvNotes] = useState('');
  const [ivOutcome, setIvOutcome] = useState<InterviewOutcome>('PENDING');

  // Form states
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [source, setSource] = useState('LinkedIn');
  const [workMode, setWorkMode] = useState<WorkMode>('REMOTE');
  const [stage, setStage] = useState<JobStage>('DISCOVERED');
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [jobUrl, setJobUrl] = useState('');
  const [location, setLocation] = useState('');
  const [minSalary, setMinSalary] = useState<number | ''>('');
  const [maxSalary, setMaxSalary] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setCompany('');
    setRole('');
    setSource('LinkedIn');
    setWorkMode('REMOTE');
    setStage('DISCOVERED');
    setPriority('MEDIUM');
    setJobUrl('');
    setLocation('');
    setMinSalary('');
    setMaxSalary('');
    setNotes('');
    setEditingOpp(null);
  };

  const openAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEdit = (opp: JobOpportunity) => {
    setEditingOpp(opp);
    setCompany(opp.company);
    setRole(opp.role);
    setSource(opp.source || 'LinkedIn');
    setWorkMode(opp.workMode);
    setStage(opp.stage);
    setPriority(opp.priority || 'MEDIUM');
    setJobUrl(opp.jobUrl || '');
    setLocation(opp.location || '');
    setMinSalary(opp.minSalary ?? '');
    setMaxSalary(opp.maxSalary ?? '');
    setNotes(opp.notes || '');
    setShowAddModal(true);
  };

  const handleSaveOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) {
      showToast('Company and role are required', 'warning');
      return;
    }

    try {
      const timestamp = now();
      if (editingOpp) {
        const updated: JobOpportunity = {
          ...editingOpp,
          company: company.trim(),
          role: role.trim(),
          source: source.trim(),
          workMode,
          stage,
          priority,
          jobUrl: jobUrl.trim() || undefined,
          location: location.trim() || undefined,
          minSalary: minSalary === '' ? undefined : Number(minSalary),
          maxSalary: maxSalary === '' ? undefined : Number(maxSalary),
          notes: notes.trim() || undefined,
          updatedAt: timestamp,
        };
        await dbPut(STORES.JOB_OPPORTUNITIES, updated);
        showToast('Opportunity updated', 'success');
      } else {
        const newId = generateId('opp');
        const newOpp: JobOpportunity = {
          id: newId,
          company: company.trim(),
          role: role.trim(),
          source: source.trim(),
          discoveredAt: timestamp,
          workMode,
          stage,
          priority,
          currency: 'INR',
          jobUrl: jobUrl.trim() || undefined,
          location: location.trim() || undefined,
          minSalary: minSalary === '' ? undefined : Number(minSalary),
          maxSalary: maxSalary === '' ? undefined : Number(maxSalary),
          notes: notes.trim() || undefined,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await dbPut(STORES.JOB_OPPORTUNITIES, newOpp);

        await logEvent(
          'job_hunt',
          'JOB_OPPORTUNITY_DISCOVERED',
          1,
          'roles',
          'JOB_OPPORTUNITY',
          newId,
          { company: company.trim(), role: role.trim(), stage }
        );
        showToast(`Added ${company} — ${role}`, 'success');
      }

      notifyDataChange();
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
      showToast('Error saving opportunity', 'error');
    }
  };

  // Quick Stage Transition
  const handleStageChange = async (opp: JobOpportunity, nextStage: JobStage) => {
    if (opp.stage === nextStage) return;

    const updated: JobOpportunity = {
      ...opp,
      stage: nextStage,
      updatedAt: now(),
    };
    await dbPut(STORES.JOB_OPPORTUNITIES, updated);

    // Contextual activity event
    if (nextStage === 'INTERVIEW' || nextStage === 'SCREENING' || nextStage === 'FINAL_ROUND' || nextStage === 'ASSESSMENT') {
      await logEvent(
        'job_hunt',
        'JOB_INTERVIEW_BOOKED',
        1,
        'interviews',
        'JOB_OPPORTUNITY',
        opp.id,
        { company: opp.company, role: opp.role, stage: nextStage }
      );
    } else if (nextStage === 'OFFER') {
      await logEvent(
        'job_hunt',
        'JOB_OFFER_RECEIVED',
        1,
        'offers',
        'JOB_OPPORTUNITY',
        opp.id,
        { company: opp.company, role: opp.role }
      );
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    } else if (nextStage === 'REJECTED') {
      await logEvent(
        'job_hunt',
        'JOB_REJECTED',
        1,
        'roles',
        'JOB_OPPORTUNITY',
        opp.id,
        { company: opp.company, role: opp.role }
      );
    } else if (nextStage === 'WITHDRAWN') {
      await logEvent(
        'job_hunt',
        'JOB_WITHDRAWN',
        1,
        'roles',
        'JOB_OPPORTUNITY',
        opp.id,
        { company: opp.company, role: opp.role }
      );
    } else if (nextStage === 'GHOSTED') {
      await logEvent(
        'job_hunt',
        'JOB_GHOSTED',
        1,
        'roles',
        'JOB_OPPORTUNITY',
        opp.id,
        { company: opp.company, role: opp.role }
      );
    }

    notifyDataChange();
    showToast(`${opp.company} moved to ${nextStage}`, 'info');
  };

  const handleSaveInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewTargetOpp) return;

    try {
      const timestamp = now();
      const ivId = generateId('iv');
      const record: InterviewRecord = {
        id: ivId,
        opportunityId: interviewTargetOpp.id,
        company: interviewTargetOpp.company,
        roundType: ivRoundType,
        roundNumber: ivRoundNumber,
        scheduledAt: ivScheduledAt,
        interviewerName: ivInterviewerName.trim() || undefined,
        interviewerRole: ivInterviewerRole.trim() || undefined,
        notes: ivNotes.trim() || undefined,
        outcome: ivOutcome,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await dbPut(STORES.JOB_INTERVIEWS, record);

      // Auto-advance stage to INTERVIEW if in an earlier stage
      if (
        interviewTargetOpp.stage === 'DISCOVERED' ||
        interviewTargetOpp.stage === 'APPLIED' ||
        interviewTargetOpp.stage === 'OUTREACH'
      ) {
        const updatedOpp: JobOpportunity = {
          ...interviewTargetOpp,
          stage: 'INTERVIEW',
          updatedAt: timestamp,
        };
        await dbPut(STORES.JOB_OPPORTUNITIES, updatedOpp);
      }

      await logEvent(
        'job_hunt',
        'JOB_INTERVIEW_BOOKED',
        1,
        'interviews',
        'JOB_INTERVIEW',
        ivId,
        {
          company: interviewTargetOpp.company,
          role: interviewTargetOpp.role,
          roundType: ivRoundType,
          outcome: ivOutcome,
        }
      );

      notifyDataChange();
      showToast(`Interview Round #${ivRoundNumber} logged for ${interviewTargetOpp.company}`, 'success');
      setInterviewTargetOpp(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to save interview', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Remove opportunity ${name}?`)) {
      await dbDelete(STORES.JOB_OPPORTUNITIES, id);

      // Cascading cleanup of linked applications, outreach, and interviews
      const [apps, outreach, interviews] = await Promise.all([
        dbGetAll<{ id: string; opportunityId?: string }>(STORES.JOB_APPLICATIONS),
        dbGetAll<{ id: string; opportunityId?: string }>(STORES.JOB_OUTREACH),
        dbGetAll<{ id: string; opportunityId?: string }>(STORES.JOB_INTERVIEWS),
      ]);

      for (const app of apps) {
        if (app.opportunityId === id) {
          await dbDelete(STORES.JOB_APPLICATIONS, app.id);
        }
      }
      for (const out of outreach) {
        if (out.opportunityId === id) {
          await dbDelete(STORES.JOB_OUTREACH, out.id);
        }
      }
      for (const iv of interviews) {
        if (iv.opportunityId === id) {
          await dbDelete(STORES.JOB_INTERVIEWS, iv.id);
        }
      }

      notifyDataChange();
      showToast('Opportunity and linked records removed', 'info');
    }
  };

  // Filter logic
  const filtered = opportunities.filter((opp) => {
    const matchesSearch =
      (opp.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opp.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opp.source || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opp.notes || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStage = stageFilter === 'ALL' || opp.stage === stageFilter;
    const matchesWorkMode = workModeFilter === 'ALL' || opp.workMode === workModeFilter;
    const matchesPriority = priorityFilter === 'ALL' || opp.priority === priorityFilter;

    return matchesSearch && matchesStage && matchesWorkMode && matchesPriority;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: '1 1 300px' }}>
            <div style={{ position: 'relative', minWidth: 240, flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: 34 }}
                placeholder="Search company, role, keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* View switcher */}
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
              <button
                className={`btn btn-sm ${viewMode === 'KANBAN' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 10px', fontSize: '11px', gap: 4 }}
                onClick={() => setViewMode('KANBAN')}
              >
                <LayoutGrid size={13} /> Pipeline
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'LIST' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 10px', fontSize: '11px', gap: 4 }}
                onClick={() => setViewMode('LIST')}
              >
                <ListIcon size={13} /> List
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={openAdd}>
              <Plus size={16} /> New Role
            </button>
          </div>
        </div>

        {/* Filter Pills row */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '11px' }}>
            <Filter size={12} /> Stage:
          </div>
          <select
            className="form-input"
            style={{ width: 'auto', padding: '4px 8px', fontSize: '11px', height: 28 }}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="ALL">All Stages ({opportunities.length})</option>
            {ALL_JOB_STAGES.map((s) => (
              <option key={s.stage} value={s.stage}>
                {s.label} ({opportunities.filter((o) => o.stage === s.stage).length})
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '11px', marginLeft: 6 }}>
            Mode:
          </div>
          <select
            className="form-input"
            style={{ width: 'auto', padding: '4px 8px', fontSize: '11px', height: 28 }}
            value={workModeFilter}
            onChange={(e) => setWorkModeFilter(e.target.value)}
          >
            <option value="ALL">All Modes</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ONSITE">Onsite</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '11px', marginLeft: 6 }}>
            Priority:
          </div>
          <select
            className="form-input"
            style={{ width: 'auto', padding: '4px 8px', fontSize: '11px', height: 28 }}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading pipeline...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state" style={{ padding: 40 }}>
          <Briefcase size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div className="empty-state-title">No opportunities found</div>
          <div className="empty-state-text">
            {opportunities.length === 0
              ? 'Start building your job search pipeline by adding roles you discover or apply to.'
              : 'No opportunities match your search or filter criteria.'}
          </div>
          {opportunities.length === 0 && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={openAdd}>
              <Plus size={14} /> Add First Opportunity
            </button>
          )}
        </div>
      ) : viewMode === 'KANBAN' ? (
        /* KANBAN BOARD VIEW */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}>
          {KANBAN_COLUMNS.map((col) => {
            const colOpps = filtered.filter((o) => col.stages.includes(o.stage));

            return (
              <div
                key={col.id}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: '14px',
                  minHeight: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Column header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {col.title}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-secondary)',
                  }}>
                    {colOpps.length}
                  </span>
                </div>

                {/* Cards in column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {colOpps.map((opp) => (
                    <div
                      key={opp.id}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {/* Company & Role */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                            {opp.company}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            {opp.role}
                          </div>
                        </div>

                        {opp.priority === 'HIGH' && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                          }}>
                            HIGH
                          </span>
                        )}
                      </div>

                      {/* Meta chips */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '10px' }}>
                        <span style={{ padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
                          {opp.workMode}
                        </span>
                        {opp.location && (
                          <span style={{ padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
                            {opp.location}
                          </span>
                        )}
                        {opp.minSalary && opp.maxSalary && (
                          <span style={{ padding: '2px 5px', borderRadius: 3, background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
                            {formatINR(opp.minSalary)} - {formatINR(opp.maxSalary)}
                          </span>
                        )}
                      </div>

                      {/* Stage Selector & Actions */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 6,
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        gap: 6,
                      }}>
                        <select
                          className="form-input"
                          style={{
                            width: 'auto',
                            padding: '2px 6px',
                            fontSize: '10px',
                            height: 22,
                            borderRadius: 4,
                            background: 'transparent',
                          }}
                          value={opp.stage}
                          onChange={(e) => handleStageChange(opp, e.target.value as JobStage)}
                        >
                          {ALL_JOB_STAGES.map((s) => (
                            <option key={s.stage} value={s.stage}>{s.label}</option>
                          ))}
                        </select>

                        <div style={{ display: 'flex', gap: 4 }}>
                          {opp.stage === 'DISCOVERED' && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px', height: 22, gap: 2 }}
                              onClick={() => setQuickApplyTargetOpp(opp)}
                              title="Quick Apply"
                            >
                              <Send size={10} /> Apply
                            </button>
                          )}
                          <button
                            className="btn-icon"
                            style={{ width: 22, height: 22, padding: 3 }}
                            onClick={() => {
                              setInterviewTargetOpp(opp);
                              setIvRoundNumber(1);
                              setIvRoundType('TECHNICAL');
                              setIvOutcome('PENDING');
                              setIvScheduledAt(todayDate());
                            }}
                            title="Log Interview Round"
                          >
                            <Calendar size={11} />
                          </button>
                          <button
                            className="btn-icon"
                            style={{ width: 22, height: 22, padding: 3 }}
                            onClick={() => onOpenOutreach?.(opp)}
                            title="Log Outreach"
                          >
                            <MessageSquare size={11} />
                          </button>
                          {opp.jobUrl && (
                            <a
                              href={opp.jobUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-icon"
                              style={{ width: 22, height: 22, padding: 3 }}
                              title="Open Job URL"
                            >
                              <ExternalLink size={11} />
                            </a>
                          )}
                          <button
                            className="btn-icon"
                            style={{ width: 22, height: 22, padding: 3 }}
                            onClick={() => openEdit(opp)}
                            title="Edit"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            className="btn-icon"
                            style={{ width: 22, height: 22, padding: 3, color: '#ef4444' }}
                            onClick={() => handleDelete(opp.id, opp.company)}
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE / LIST VIEW */
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Company & Role</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Stage</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Mode & Location</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Priority</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Discovered</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((opp) => (
                <tr
                  key={opp.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background 0.15s',
                  }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{opp.company}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{opp.role}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      className="form-input"
                      style={{ width: 'auto', padding: '3px 8px', fontSize: '11px', height: 26 }}
                      value={opp.stage}
                      onChange={(e) => handleStageChange(opp, e.target.value as JobStage)}
                    >
                      {ALL_JOB_STAGES.map((s) => (
                        <option key={s.stage} value={s.stage}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    <div>{opp.workMode}</div>
                    {opp.location && <div style={{ fontSize: '10px' }}>{opp.location}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background:
                        opp.priority === 'HIGH'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : opp.priority === 'MEDIUM'
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(255, 255, 255, 0.05)',
                      color:
                        opp.priority === 'HIGH'
                          ? '#ef4444'
                          : opp.priority === 'MEDIUM'
                          ? '#f59e0b'
                          : 'var(--text-muted)',
                    }}>
                      {opp.priority || 'MEDIUM'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {timeAgo(opp.discoveredAt)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      {opp.stage === 'DISCOVERED' && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          onClick={() => setQuickApplyTargetOpp(opp)}
                        >
                          Apply
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        style={{ width: 26, height: 26, padding: 4 }}
                        onClick={() => {
                          setInterviewTargetOpp(opp);
                          setIvRoundNumber(1);
                          setIvRoundType('TECHNICAL');
                          setIvOutcome('PENDING');
                          setIvScheduledAt(todayDate());
                        }}
                        title="Log Interview Round"
                      >
                        <Calendar size={12} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ width: 26, height: 26, padding: 4 }}
                        onClick={() => openEdit(opp)}
                        title="Edit"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ width: 26, height: 26, padding: 4, color: '#ef4444' }}
                        onClick={() => handleDelete(opp.id, opp.company)}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)' }}>
              {editingOpp ? 'Edit Opportunity' : 'Add New Job Opportunity'}
            </h3>
            <form onSubmit={handleSaveOpp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Company Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. OpenAI, Zerodha"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Role Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Staff Full-Stack Engineer"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
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
                  <label className="form-label">Stage</label>
                  <select
                    className="form-input"
                    value={stage}
                    onChange={(e) => setStage(e.target.value as JobStage)}
                  >
                    {ALL_JOB_STAGES.map((s) => (
                      <option key={s.stage} value={s.stage}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Priority</label>
                  <select
                    className="form-input"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                  >
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Source / Discovery Channel</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. LinkedIn, Twitter, Referral"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Location (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Bengaluru / SF / Global"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Job Posting URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://..."
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Min Salary (INR or USD)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 3000000"
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="form-label">Max Salary</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 5000000"
                    value={maxSalary}
                    onChange={(e) => setMaxSalary(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Notes or Strategy</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Tech stack, recruiter contact, specific project hook..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                  {editingOpp ? 'Update Opportunity' : 'Save Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Apply Form Modal */}
      {quickApplyTargetOpp && (
        <QuickApplyForm
          opportunities={opportunities}
          initialOpportunity={quickApplyTargetOpp}
          isOpen={Boolean(quickApplyTargetOpp)}
          onClose={() => setQuickApplyTargetOpp(null)}
          onSuccess={() => notifyDataChange()}
        />
      )}

      {/* Log Interview Modal */}
      {interviewTargetOpp && (
        <div className="modal-backdrop" onClick={() => setInterviewTargetOpp(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)' }}>
              Log Interview Round — {interviewTargetOpp.company}
            </h3>
            <form onSubmit={handleSaveInterview} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Round Type</label>
                  <select
                    className="form-input"
                    value={ivRoundType}
                    onChange={(e) => setIvRoundType(e.target.value as InterviewRoundType)}
                  >
                    <option value="SCREENING">Screening Call</option>
                    <option value="TECHNICAL">Technical / Coding</option>
                    <option value="SYSTEM_DESIGN">System Design</option>
                    <option value="BEHAVIORAL">Behavioral / Culture</option>
                    <option value="TAKE_HOME">Take-home Review</option>
                    <option value="FINAL_ROUND">Final Round</option>
                    <option value="OTHER">Other Round</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Round #</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={ivRoundNumber}
                    onChange={(e) => setIvRoundNumber(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Scheduled Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={ivScheduledAt}
                    onChange={(e) => setIvScheduledAt(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Outcome</label>
                  <select
                    className="form-input"
                    value={ivOutcome}
                    onChange={(e) => setIvOutcome(e.target.value as InterviewOutcome)}
                  >
                    <option value="PENDING">Pending / Scheduled</option>
                    <option value="PASSED">Passed</option>
                    <option value="FAILED">Did Not Pass</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Interviewer Name (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alex (Engineering Lead)"
                    value={ivInterviewerName}
                    onChange={(e) => setIvInterviewerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Interviewer Role (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Staff Engineer"
                    value={ivInterviewerRole}
                    onChange={(e) => setIvInterviewerRole(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Prep Notes / Feedback</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Questions asked, topics to prepare, feedback notes..."
                  value={ivNotes}
                  onChange={(e) => setIvNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setInterviewTargetOpp(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Record Interview Round
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
