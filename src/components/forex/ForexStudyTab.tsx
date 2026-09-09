// ============================================================================
// PERSONAL OS — Forex Study & Curriculum Tab
// Tracks learning velocity, curriculum phase progression, and study notes.
// ============================================================================

import { useState } from 'react';
import {
  BookOpen, Plus, Clock, ExternalLink, Calendar,
  Trash2, Filter, Layers, HelpCircle, CheckCircle2,
} from 'lucide-react';
import { useStore, logEvent } from '../../hooks/useDatabase';
import { STORES } from '../../services/db';
import type {
  ForexStudySession,
  CurriculumPhase,
  StudyType,
} from '../../types';
import {
  ALL_CURRICULUM_PHASES,
  ALL_STUDY_TYPES,
  type ForexKpiSummary,
} from '../../services/forexKpi';
import { generateId, now, formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';

interface ForexStudyTabProps {
  kpis: ForexKpiSummary;
}

const PHASE_LABELS: Record<CurriculumPhase, string> = {
  FOUNDATION: 'Foundation',
  MARKET_UNDERSTANDING: 'Market Understanding',
  STRATEGY: 'Strategy & Edge',
  TECHNICAL_ANALYSIS: 'Technical Analysis',
  PSYCHOLOGY: 'Psychology',
  EXECUTION: 'Execution Mechanics',
};

const STUDY_TYPE_LABELS: Record<StudyType, string> = {
  VIDEO: 'Video / Lesson',
  BOOK: 'Book Reading',
  ARTICLE: 'Article / Research',
  CHART_STUDY: 'Chart Study',
  NOTES: 'Notes Review',
  COURSE: 'Course Module',
  OTHER: 'Other Study',
};

export function ForexStudyTab({ kpis }: ForexStudyTabProps) {
  const { items: sessions, add, remove } = useStore<ForexStudySession>(STORES.FOREX_STUDY);
  const [showModal, setShowModal] = useState(false);
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>('ALL');

  // Form State
  const [form, setForm] = useState({
    topic: '',
    subtopic: '',
    curriculumPhase: 'FOUNDATION' as CurriculumPhase,
    studyType: 'VIDEO' as StudyType,
    durationMinutes: 30,
    resourceUrl: '',
    conceptsLearned: '',
    questions: '',
    notes: '',
    studiedAt: new Date().toISOString().slice(0, 10),
  });

  const resetForm = () => {
    setForm({
      topic: '',
      subtopic: '',
      curriculumPhase: 'FOUNDATION',
      studyType: 'VIDEO',
      durationMinutes: 30,
      resourceUrl: '',
      conceptsLearned: '',
      questions: '',
      notes: '',
      studiedAt: new Date().toISOString().slice(0, 10),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic.trim()) {
      showToast('Please enter a study topic', 'error');
      return;
    }

    const newSession: ForexStudySession = {
      id: generateId('fx_study'),
      topic: form.topic.trim(),
      subtopic: form.subtopic.trim() || undefined,
      curriculumPhase: form.curriculumPhase,
      studyType: form.studyType,
      durationMinutes: Number(form.durationMinutes) || 30,
      resourceUrl: form.resourceUrl.trim() || undefined,
      conceptsLearned: form.conceptsLearned.trim() || undefined,
      questions: form.questions.trim() || undefined,
      notes: form.notes.trim() || undefined,
      studiedAt: new Date(form.studiedAt).toISOString(),
      createdAt: now(),
    };

    await add(newSession);

    // Ledger Activity Event with full entity reference and metadata
    await logEvent('forex', 'FOREX_STUDY_SESSION', {
      quantity: newSession.durationMinutes,
      unit: 'minutes',
      entityRefType: 'ForexStudySession',
      entityRefId: newSession.id,
      metadata: {
        topic: newSession.topic,
        curriculumPhase: newSession.curriculumPhase,
        studyType: newSession.studyType,
        durationMinutes: newSession.durationMinutes,
      },
    });

    showToast(`Logged study session: ${newSession.topic}`, 'success');
    setShowModal(false);
    resetForm();
  };

  const handleDelete = async (id: string, topic: string) => {
    if (window.confirm(`Delete study session "${topic}"?`)) {
      await remove(id);
      showToast('Study session deleted', 'info');
    }
  };

  // Filter sessions
  const filteredSessions = sessions
    .filter((s) => selectedPhaseFilter === 'ALL' || s.curriculumPhase === selectedPhaseFilter)
    .sort((a, b) => (b.studiedAt || b.createdAt).localeCompare(a.studiedAt || a.createdAt));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} style={{ color: '#f59e0b' }} /> Total Study Time
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#f59e0b' }}>
            {kpis.totalStudyHoursFormatted}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            {kpis.totalStudySessions} session(s) all-time
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} style={{ color: '#3b82f6' }} /> Pacing This Week
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#3b82f6' }}>
            {kpis.studySessionsThisWeek} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>sessions</span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            {Math.floor(kpis.studyMinutesThisWeek / 60)}h {kpis.studyMinutesThisWeek % 60}m logged
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={14} style={{ color: '#10b981' }} /> Active Phase
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#10b981' }}>
            {sessions.length > 0 ? PHASE_LABELS[sessions[sessions.length - 1].curriculumPhase] || 'Foundation' : 'Foundation'}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>
            Curriculum learning track
          </div>
        </div>
      </div>

      {/* Action Bar & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />
          <button
            className={`btn btn-sm ${selectedPhaseFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelectedPhaseFilter('ALL')}
          >
            All Phases ({sessions.length})
          </button>
          {ALL_CURRICULUM_PHASES.map((phase) => {
            const count = kpis.sessionsByPhase[phase] || 0;
            return (
              <button
                key={phase}
                className={`btn btn-sm ${selectedPhaseFilter === phase ? 'btn-primary' : 'btn-ghost'}`}
                style={
                  selectedPhaseFilter === phase
                    ? { background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', borderColor: '#f59e0b' }
                    : {}
                }
                onClick={() => setSelectedPhaseFilter(phase)}
              >
                {PHASE_LABELS[phase]} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        <button
          className="btn btn-primary"
          style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} /> Log Study Session
        </button>
      </div>

      {/* Sessions Feed */}
      {filteredSessions.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <BookOpen size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 6 }}>
            No study sessions found
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', maxWidth: 460, margin: '0 auto 16px' }}>
            {selectedPhaseFilter === 'ALL'
              ? 'Log your foundational Forex study notes, books, videos, and chart breakdown sessions.'
              : `No sessions recorded under "${PHASE_LABELS[selectedPhaseFilter as CurriculumPhase]}".`}
          </p>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000' }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={14} /> Log First Session
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className="card"
              style={{
                padding: 18,
                borderLeft: '4px solid #f59e0b',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>
                      {session.topic}
                    </h3>
                    {session.subtopic && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        — {session.subtopic}
                      </span>
                    )}
                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: 11 }}>
                      {PHASE_LABELS[session.curriculumPhase] || session.curriculumPhase}
                    </span>
                    <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: 11 }}>
                      {STUDY_TYPE_LABELS[session.studyType] || session.studyType}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {session.durationMinutes} minutes
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} /> {formatDate(session.studiedAt || session.createdAt)}
                    </span>
                    {session.resourceUrl && (
                      <a
                        href={session.resourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#3b82f6', textDecoration: 'none' }}
                      >
                        <ExternalLink size={12} /> Source Link
                      </a>
                    )}
                  </div>
                </div>

                <button
                  className="btn-icon"
                  style={{ color: 'var(--text-subtle)' }}
                  onClick={() => handleDelete(session.id, session.topic)}
                  title="Delete Session"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {session.conceptsLearned && (
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <CheckCircle2 size={12} /> Key Concepts Learned:
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {session.conceptsLearned}
                  </p>
                </div>
              )}

              {session.questions && (
                <div style={{ background: 'rgba(239, 68, 68, 0.04)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <HelpCircle size={12} /> Questions / Open Doubts:
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {session.questions}
                  </p>
                </div>
              )}

              {session.notes && !session.conceptsLearned && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                  {session.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Log Study Session Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={18} style={{ color: '#f59e0b' }} /> Log Study Session
              </h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Study Topic *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Market Structure & Liquidity Sweeps"
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Subtopic (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. London Killzone"
                    value={form.subtopic}
                    onChange={(e) => setForm({ ...form, subtopic: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Curriculum Phase</label>
                  <select
                    className="select"
                    value={form.curriculumPhase}
                    onChange={(e) => setForm({ ...form, curriculumPhase: e.target.value as CurriculumPhase })}
                  >
                    {ALL_CURRICULUM_PHASES.map((p) => (
                      <option key={p} value={p}>
                        {PHASE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Study Type</label>
                  <select
                    className="select"
                    value={form.studyType}
                    onChange={(e) => setForm({ ...form, studyType: e.target.value as StudyType })}
                  >
                    {ALL_STUDY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {STUDY_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="600"
                    step="5"
                    className="input"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Resource URL / Source (Optional)</label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://..."
                    value={form.resourceUrl}
                    onChange={(e) => setForm({ ...form, resourceUrl: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Date Studied</label>
                  <input
                    type="date"
                    className="input"
                    value={form.studiedAt}
                    onChange={(e) => setForm({ ...form, studiedAt: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Concepts Learned (Key Insights)</label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="What clicked? e.g. Liquidity pools rest above equal highs; wait for displacement before entry..."
                  value={form.conceptsLearned}
                  onChange={(e) => setForm({ ...form, conceptsLearned: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Questions & Clarifications Needed</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="e.g. How to differentiate a valid sweep from a genuine breakout on 15m?"
                  value={form.questions}
                  onChange={(e) => setForm({ ...form, questions: e.target.value })}
                />
              </div>

              <div className="modal-footer" style={{ marginTop: 6 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }}
                >
                  Save Study Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
