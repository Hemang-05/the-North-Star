// ============================================================================
// PERSONAL OS — Fitness Football Tab
// Independent athletic team sport tracker with weekend neutrality.
// ============================================================================

import { useState } from 'react';
import { Trophy, Plus, Trash2, Calendar, Clock, Sparkles } from 'lucide-react';
import type { WorkoutSession } from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';

interface FootballTabProps {
  workouts: WorkoutSession[];
}

export function FootballTab({ workouts }: FootballTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(90);
  const [matchType, setMatchType] = useState<'MATCH' | 'PRACTICE' | 'SCRIMMAGE'>('MATCH');
  const [notes, setNotes] = useState('');
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 16));

  const footballSessions = workouts.filter((w) => w.workoutType === 'FOOTBALL');

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const numDuration = typeof durationMinutes === 'number' ? durationMinutes : parseInt(String(durationMinutes), 10);
    if (isNaN(numDuration) || numDuration <= 0) {
      showToast('Duration must be greater than 0', 'error');
      return;
    }

    try {
      const sessionId = crypto.randomUUID();
      const dateObj = new Date(startedAt);
      const day = dateObj.getDay();
      const isWeekend = day === 0 || day === 6;

      const newSession: WorkoutSession = {
        id: sessionId,
        startedAt: dateObj.toISOString(),
        durationMinutes: numDuration,
        workoutType: 'FOOTBALL',
        notes: notes.trim() ? `[${matchType}] ${notes.trim()}` : `[${matchType}]`,
      };

      await dbPut(STORES.WORKOUTS, newSession);

      await logEvent(
        'fitness',
        'FITNESS_WORKOUT_DONE',
        numDuration,
        'minutes',
        'WorkoutSession',
        sessionId,
        {
          workoutType: 'FOOTBALL',
          matchType,
          durationMinutes: numDuration,
          isWeekend,
        }
      );

      notifyDataChange(STORES.WORKOUTS);

      showToast(`Logged ${numDuration}m Football ${matchType}!`, 'success');
      setShowModal(false);
      setNotes('');
    } catch (err) {
      console.error('Failed to log football session:', err);
      showToast('Failed to log football session', 'error');
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Delete this football session?')) return;
    try {
      await dbDelete(STORES.WORKOUTS, id);
      notifyDataChange(STORES.WORKOUTS);
      showToast('Football session deleted', 'info');
    } catch (err) {
      console.error('Failed to delete football session:', err);
      showToast('Error deleting session', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#18181b]/60 border border-white/5 p-4 rounded-xl backdrop-blur-md">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-red-400" />
            Football Match & Training
          </h3>
          <p className="text-sm text-zinc-400">
            Dedicated team athletic sport tracker. Absence on weekdays is never penalized.
          </p>
        </div>
        <button
          id="btn-log-football"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-red-500/20"
        >
          <Plus className="w-4 h-4" />
          Log Football Session
        </button>
      </div>

      {/* Weekday Neutrality Banner */}
      <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-xs text-zinc-300 flex items-center gap-2.5">
        <Sparkles className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span>
          <strong className="text-white">Weekend Sport Neutrality:</strong> Football is primarily a weekend activity. The status engine rewards logged sessions with cardio bonuses, but zero weekday sessions will never trigger a status penalty.
        </span>
      </div>

      {/* Sessions Feed */}
      {footballSessions.length === 0 ? (
        <div className="text-center py-16 bg-[#18181b]/30 border border-white/5 rounded-xl">
          <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-3 opacity-50" />
          <h4 className="text-base font-semibold text-zinc-300">No Football Sessions Logged</h4>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
            Log weekend 11v11, 7v7, turf matches, or team drills.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {footballSessions.map((s) => {
            const dateObj = new Date(s.startedAt);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            return (
              <div
                key={s.id}
                className="bg-[#18181b]/40 border border-white/5 hover:border-white/10 p-5 rounded-xl transition backdrop-blur-md flex flex-col sm:flex-row justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-white flex items-center gap-1.5">
                      Football Session
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                      {s.durationMinutes} min
                    </span>
                    {isWeekend && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Weekend Fixture
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(s.startedAt)}
                    </span>
                  </div>
                  {s.notes && <p className="text-sm text-zinc-300 mt-2">{s.notes}</p>}
                </div>

                <div className="flex items-center self-end sm:self-center gap-2">
                  <button
                    onClick={() => handleDeleteSession(s.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Session Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-red-400" />
                Log Football Session
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Session Type
                </label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                >
                  <option value="MATCH">Competitive Match (90m / Turf)</option>
                  <option value="SCRIMMAGE">Friendly Scrimmage / Pick-up</option>
                  <option value="PRACTICE">Technical Drills / Conditioning</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Started At
                </label>
                <input
                  type="datetime-local"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Goals scored, position played, intensity..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-red-500/20"
                >
                  Save Football Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
