// ============================================================================
// PERSONAL OS — Focus Timer Component
// Full timer with start/pause/resume/stop, category selection, and ring display.
// ============================================================================

import { useState } from 'react';
import { Timer, Play, Pause, Square, ChevronDown } from 'lucide-react';
import { useActiveTimer } from '../hooks/useDatabase';
import { PILLARS, FOCUS_CATEGORIES } from '../config/pillars';
import { formatDuration } from '../utils/helpers';
import { showToast } from './Toast';
import type { PillarSlug } from '../types';

export function FocusTimer() {
  const { session, elapsed, startTimer, pauseTimer, resumeTimer, stopTimer } = useActiveTimer();
  const [selectedPillar, setSelectedPillar] = useState<PillarSlug>('job_hunt');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const currentPillar = PILLARS.find((p) => p.id === (session?.pillarId || selectedPillar));
  const categories = FOCUS_CATEGORIES[selectedPillar] || [];

  const handleStart = async () => {
    if (!selectedCategory) {
      showToast('Please select a category', 'warning');
      return;
    }
    await startTimer(selectedPillar, selectedCategory, selectedSubcategory || undefined);
    showToast('Timer started — Focus mode on!', 'success');
  };

  const handlePause = async () => {
    await pauseTimer();
    showToast('Timer paused', 'info');
  };

  const handleResume = async () => {
    await resumeTimer();
    showToast('Timer resumed — Let\'s go!', 'success');
  };

  const handleStop = async () => {
    if (elapsed < 30) {
      showToast('Session too short (< 30s). Discarded.', 'warning');
    } else {
      await stopTimer();
      showToast(`Session saved: ${formatDuration(elapsed)}`, 'success');
    }
  };

  const isActive = session && (session.status === 'RUNNING' || session.status === 'PAUSED');
  const isRunning = session?.status === 'RUNNING';
  const isPaused = session?.status === 'PAUSED';

  // Ring progress (1 full circle = 25 minutes pomodoro, wrapping)
  const circumference = 2 * Math.PI * 88;
  const progress = (elapsed % 1500) / 1500;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="page-body">
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        {/* Timer Ring */}
        <div
          className={`timer-ring ${isRunning ? 'timer-running' : ''}`}
          style={{ marginBottom: 24 }}
        >
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle
              className="timer-ring-track"
              cx="100" cy="100" r="88"
            />
            <circle
              className="timer-ring-fill"
              cx="100" cy="100" r="88"
              stroke={currentPillar?.color || '#6366f1'}
              strokeDasharray={circumference}
              strokeDashoffset={isActive ? dashOffset : circumference}
            />
          </svg>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div className="timer-display" style={{ color: currentPillar?.color }}>
              {formatDuration(elapsed)}
            </div>
            {isActive && (
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                {session?.category}
                {session?.subcategory ? ` · ${session.subcategory}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="timer-controls" style={{ marginBottom: 32 }}>
          {!isActive ? (
            <button className="btn btn-primary btn-lg" onClick={handleStart}>
              <Play size={18} />
              Start Focus
            </button>
          ) : (
            <>
              {isRunning && (
                <button className="btn btn-ghost btn-lg" onClick={handlePause}>
                  <Pause size={18} />
                  Pause
                </button>
              )}
              {isPaused && (
                <button className="btn btn-primary btn-lg" onClick={handleResume}>
                  <Play size={18} />
                  Resume
                </button>
              )}
              <button className="btn btn-danger btn-lg" onClick={handleStop}>
                <Square size={18} />
                Stop
              </button>
            </>
          )}
        </div>

        {/* Category Selector — only show when not active */}
        {!isActive && (
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Timer size={16} />
                Session Setup
              </div>
            </div>
            <div className="card-body">
              {/* Pillar Select */}
              <div className="form-group">
                <label className="form-label">Pillar</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PILLARS.map((p) => (
                    <button
                      key={p.id}
                      className={`btn btn-sm ${selectedPillar === p.id ? 'btn-primary' : 'btn-ghost'}`}
                      style={selectedPillar === p.id ? { background: p.color, boxShadow: `0 2px 12px ${p.color}44` } : {}}
                      onClick={() => {
                        setSelectedPillar(p.id);
                        setSelectedCategory('');
                        setSelectedSubcategory('');
                      }}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="form-group">
                <label className="form-label">Category</label>
                <button
                  className="form-input"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    background: 'var(--bg-elevated)',
                  }}
                  onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <span style={{ color: selectedCategory ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {selectedCategory || 'Select category…'}
                  </span>
                  <ChevronDown size={14} />
                </button>
                {showCategoryPicker && (
                  <div style={{
                    marginTop: 4,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}>
                    {categories.map((cat) => (
                      <div key={cat.label}>
                        <button
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            textAlign: 'left',
                            fontSize: 'var(--text-base)',
                            fontWeight: 600,
                            color: selectedCategory === cat.label ? currentPillar?.color : 'var(--text-secondary)',
                            background: selectedCategory === cat.label ? 'var(--bg-hover)' : 'transparent',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                          onClick={() => {
                            setSelectedCategory(cat.label);
                            setSelectedSubcategory('');
                            setShowCategoryPicker(false);
                          }}
                        >
                          {cat.label}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subcategory */}
              {selectedCategory && (
                <div className="form-group">
                  <label className="form-label">Subcategory (optional)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {categories
                      .find((c) => c.label === selectedCategory)
                      ?.subcategories.map((sub) => (
                        <button
                          key={sub}
                          className={`btn btn-sm ${selectedSubcategory === sub ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setSelectedSubcategory(sub === selectedSubcategory ? '' : sub)}
                        >
                          {sub}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Session Info Card */}
        {isActive && (
          <div className="card card-pillar" style={{ '--pillar-color': currentPillar?.color } as React.CSSProperties}>
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div className="badge badge-info" style={{
                background: `${currentPillar?.color}20`,
                color: currentPillar?.color,
                marginBottom: 8,
              }}>
                {currentPillar?.title}
              </div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>
                {session?.category}
              </div>
              {session?.subcategory && (
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                  {session.subcategory}
                </div>
              )}
              <div className="text-xs text-muted" style={{ marginTop: 8 }}>
                {isPaused ? '⏸ Paused' : '🔴 Recording'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
