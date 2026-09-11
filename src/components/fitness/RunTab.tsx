// ============================================================================
// PERSONAL OS — Fitness Running Tab
// Pure deterministic run tracker with pace calculation and 5K milestone detection.
// ============================================================================

import { useState } from 'react';
import { Footprints, Plus, Award, Trash2, Calendar, Clock, Gauge } from 'lucide-react';
import type { RunLog } from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';

interface RunTabProps {
  runs: RunLog[];
}

export function RunTab({ runs }: RunTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | ''>(5.0);
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(28);
  const [durationSecondsRemaining, setDurationSecondsRemaining] = useState<number | ''>(0);
  const [heartRateAvg] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 16));

  const numDistance = typeof distanceKm === 'number' ? distanceKm : parseFloat(String(distanceKm)) || 0;
  const numMinutes = typeof durationMinutes === 'number' ? durationMinutes : parseInt(String(durationMinutes), 10) || 0;
  const numSeconds = typeof durationSecondsRemaining === 'number' ? durationSecondsRemaining : parseInt(String(durationSecondsRemaining), 10) || 0;

  const totalDurationSeconds = numMinutes * 60 + numSeconds;
  const calculatedPaceMinKm = numDistance > 0 ? Number((totalDurationSeconds / 60 / numDistance).toFixed(2)) : 0;
  const is5K = numDistance >= 5.0;

  const handleSaveRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numDistance <= 0 || totalDurationSeconds <= 0) {
      showToast('Distance and duration must be greater than 0', 'error');
      return;
    }

    try {
      const runId = crypto.randomUUID();
      const newRun: RunLog = {
        id: runId,
        startedAt: new Date(startedAt).toISOString(),
        distanceKm: numDistance,
        durationSeconds: totalDurationSeconds,
        paceMinKm: calculatedPaceMinKm,
        heartRateAvg: typeof heartRateAvg === 'number' ? heartRateAvg : undefined,
        completed5k: is5K,
        notes: notes.trim() || undefined,
      };

      await dbPut(STORES.RUNS, newRun);

      await logEvent(
        'fitness',
        'FITNESS_RUN_COMPLETED',
        numDistance,
        'km',
        'RunLog',
        runId,
        {
          distanceKm: numDistance,
          durationSeconds: totalDurationSeconds,
          paceMinKm: calculatedPaceMinKm,
          completed5k: is5K,
        }
      );

      notifyDataChange(STORES.RUNS);

      showToast(
        is5K
          ? `Logged ${distanceKm} km Run! 5K Milestone Achieved!`
          : `Logged ${distanceKm} km Run (${calculatedPaceMinKm} min/km)`,
        'success'
      );

      setShowModal(false);
      setNotes('');
    } catch (err) {
      console.error('Failed to log run:', err);
      showToast('Failed to log run', 'error');
    }
  };

  const handleDeleteRun = async (id: string) => {
    if (!confirm('Are you sure you want to delete this run log?')) return;
    try {
      await dbDelete(STORES.RUNS, id);
      notifyDataChange(STORES.RUNS);
      showToast('Run log deleted', 'info');
    } catch (err) {
      console.error('Failed to delete run:', err);
      showToast('Error deleting run', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#18181b]/60 border border-white/5 p-4 rounded-xl backdrop-blur-md">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Footprints className="w-5 h-5 text-red-400" />
            Cardio & Running Log
          </h3>
          <p className="text-sm text-zinc-400">
            Authoritative distance, duration, pace tracker, and 5K milestone validator.
          </p>
        </div>
        <button
          id="btn-log-run"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-red-500/20"
        >
          <Plus className="w-4 h-4" />
          Log Run
        </button>
      </div>

      {/* Runs Feed */}
      {runs.length === 0 ? (
        <div className="text-center py-16 bg-[#18181b]/30 border border-white/5 rounded-xl">
          <Footprints className="w-12 h-12 text-zinc-600 mx-auto mb-3 opacity-50" />
          <h4 className="text-base font-semibold text-zinc-300">No Runs Logged Yet</h4>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
            Record road runs, interval sessions, or 5 km distance benchmarks.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((r) => {
            const mins = Math.floor(r.durationSeconds / 60);
            const secs = r.durationSeconds % 60;
            const isCompleted5k = r.distanceKm >= 5.0 || r.completed5k;

            return (
              <div
                key={r.id}
                className="bg-[#18181b]/40 border border-white/5 hover:border-white/10 p-5 rounded-xl transition backdrop-blur-md flex flex-col sm:flex-row justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl font-bold text-white flex items-center gap-1.5">
                      {r.distanceKm} km
                    </span>
                    {isCompleted5k && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        5K Completed
                      </span>
                    )}
                    <span className="text-sm font-medium text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {mins}m {secs > 0 ? `${secs}s` : ''}
                    </span>
                    {r.paceMinKm && (
                      <span className="text-xs text-zinc-300 bg-black/40 px-2 py-0.5 rounded border border-white/5 flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-red-400" />
                        {r.paceMinKm} min/km
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(r.startedAt)}
                    </span>
                  </div>
                  {r.notes && <p className="text-sm text-zinc-300 mt-2">{r.notes}</p>}
                </div>

                <div className="flex items-center self-end sm:self-center gap-2">
                  <button
                    onClick={() => handleDeleteRun(r.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                    title="Delete run"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Run Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Footprints className="w-5 h-5 text-red-400" />
                Log Run Session
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveRun} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Distance (km)
                </label>
                <input
                  type="number"
                  step={0.01}
                  min={0.1}
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:border-red-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Seconds
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={durationSecondsRemaining}
                    onChange={(e) => setDurationSecondsRemaining(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                  />
                </div>
              </div>

              {/* Live Calculations */}
              <div className="bg-black/30 border border-white/5 p-3 rounded-lg flex justify-between items-center text-xs">
                <div>
                  <span className="text-zinc-400">Calculated Pace: </span>
                  <span className="text-white font-bold">{calculatedPaceMinKm} min/km</span>
                </div>
                {is5K && (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> 5K Milestone
                  </span>
                )}
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
                  placeholder="Route, weather, footwear, exertion..."
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
                  Save Run Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
