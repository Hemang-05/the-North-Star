// ============================================================================
// PERSONAL OS — Fitness Workout Tab
// Resistance training & exercise set tracker with total vs per-side weight calculator.
// Does NOT silently assume bar weight unless explicitly provided by the user.
// ============================================================================

import { useState } from 'react';
import { Dumbbell, Plus, CheckCircle2, Flame, Award, Trash2, Calendar, Clock, ChevronRight } from 'lucide-react';
import type { WorkoutSession, ExerciseLog, WorkoutType } from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { calculateTotalWeight, calculatePerSideWeight } from '../../services/fitnessKpi';
import { formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';

interface WorkoutTabProps {
  workouts: WorkoutSession[];
  exercises: ExerciseLog[];
}

interface SetDraft {
  id: string;
  exerciseName: string;
  setIndex: number;
  reps: number;
  weightKg: number;
  weightPerSideKg?: number;
  barWeightKg?: number;
  isPR: boolean;
}

export function WorkoutTab({ workouts, exercises }: WorkoutTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [workoutType, setWorkoutType] = useState<WorkoutType>('GYM_PUSH');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(60);
  const [notes, setNotes] = useState('');
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 16));

  // Exercise set form state
  const [exerciseName, setExerciseName] = useState('Bench Press');
  const [reps, setReps] = useState<number | ''>(8);
  const [weightKg, setWeightKg] = useState<number | ''>(80);
  const [weightPerSideKg, setWeightPerSideKg] = useState<number | ''>(30);
  const [useKnownBar, setUseKnownBar] = useState(true);
  const [barWeightKg, setBarWeightKg] = useState<number | ''>(20);
  const [isPR, setIsPR] = useState(true);

  // Draft sets for new workout
  const [draftSets, setDraftSets] = useState<SetDraft[]>([]);

  // When barWeight or weightPerSide changes and useKnownBar is active, calculate weightKg
  const handlePerSideChange = (val: number | '') => {
    setWeightPerSideKg(val);
    if (val !== '' && typeof barWeightKg === 'number' && useKnownBar) {
      const computed = calculateTotalWeight(val, barWeightKg);
      if (computed !== undefined) setWeightKg(computed);
    }
  };

  const handleTotalWeightChange = (val: number | '') => {
    setWeightKg(val);
    if (val !== '' && typeof barWeightKg === 'number' && useKnownBar) {
      const computed = calculatePerSideWeight(val, barWeightKg);
      if (computed !== undefined) setWeightPerSideKg(computed);
    } else {
      setWeightPerSideKg('');
    }
  };

  const handleBarWeightChange = (val: number | '') => {
    setBarWeightKg(val);
    if (typeof val === 'number' && typeof weightPerSideKg === 'number') {
      const computed = calculateTotalWeight(weightPerSideKg, val);
      if (computed !== undefined) setWeightKg(computed);
    }
  };

  const handleAddSetToDraft = () => {
    if (!exerciseName.trim()) {
      showToast('Please enter an exercise name', 'error');
      return;
    }

    const numReps = typeof reps === 'number' ? reps : parseInt(String(reps), 10);
    if (isNaN(numReps) || numReps <= 0) {
      showToast('Please enter a valid reps count (>= 1)', 'error');
      return;
    }

    const numWeight = typeof weightKg === 'number' ? weightKg : parseFloat(String(weightKg));
    if (isNaN(numWeight) || numWeight < 0) {
      showToast('Please enter a valid weight (>= 0 kg)', 'error');
      return;
    }

    const newSet: SetDraft = {
      id: crypto.randomUUID(),
      exerciseName: exerciseName.trim(),
      setIndex: draftSets.length + 1,
      reps: numReps,
      weightKg: numWeight,
      weightPerSideKg: typeof weightPerSideKg === 'number' ? weightPerSideKg : undefined,
      barWeightKg: useKnownBar && typeof barWeightKg === 'number' ? barWeightKg : undefined,
      isPR,
    };

    setDraftSets((prev) => [...prev, newSet]);
    setIsPR(false); // Default subsequent sets to non-PR
    showToast(`Added set ${newSet.setIndex} for ${exerciseName}`, 'info');
  };

  const handleRemoveDraftSet = (id: string) => {
    setDraftSets((prev) => prev.filter((s) => s.id !== id).map((s, idx) => ({ ...s, setIndex: idx + 1 })));
  };

  const handleSaveWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    const numDuration = typeof durationMinutes === 'number' ? durationMinutes : parseInt(String(durationMinutes), 10);
    if (isNaN(numDuration) || numDuration <= 0) {
      showToast('Workout duration must be greater than 0', 'error');
      return;
    }

    try {
      const workoutId = crypto.randomUUID();
      const newWorkout: WorkoutSession = {
        id: workoutId,
        startedAt: new Date(startedAt).toISOString(),
        durationMinutes: numDuration,
        workoutType,
        notes: notes.trim() || undefined,
      };

      await dbPut(STORES.WORKOUTS, newWorkout);

      // Save sets
      for (const set of draftSets) {
        const exLog: ExerciseLog = {
          id: set.id,
          workoutId,
          exerciseName: set.exerciseName,
          setIndex: set.setIndex,
          reps: set.reps,
          weightKg: set.weightKg,
          weightPerSideKg: set.weightPerSideKg,
          barWeightKg: set.barWeightKg,
          isPR: set.isPR,
        };
        await dbPut(STORES.EXERCISES, exLog);
      }

      // Authoritative ActivityEvent emission
      await logEvent(
        'fitness',
        'FITNESS_WORKOUT_DONE',
        numDuration,
        'minutes',
        'WorkoutSession',
        workoutId,
        {
          workoutType,
          durationMinutes: numDuration,
          exercisesCount: draftSets.length,
          hasBenchPress: draftSets.some((s) => s.exerciseName.toLowerCase().includes('bench press')),
        }
      );

      notifyDataChange(STORES.WORKOUTS);
      notifyDataChange(STORES.EXERCISES);

      showToast(`Logged ${durationMinutes}m ${workoutType.replace('_', ' ')} workout!`, 'success');
      setShowModal(false);
      setDraftSets([]);
      setNotes('');
    } catch (err) {
      console.error('Failed to save workout:', err);
      showToast('Failed to save workout session', 'error');
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workout session?')) return;
    try {
      await dbDelete(STORES.WORKOUTS, id);
      const relatedSets = exercises.filter((e) => e.workoutId === id);
      for (const s of relatedSets) {
        await dbDelete(STORES.EXERCISES, s.id);
      }
      notifyDataChange(STORES.WORKOUTS);
      notifyDataChange(STORES.EXERCISES);
      showToast('Workout session deleted', 'info');
    } catch (err) {
      console.error('Failed to delete workout:', err);
      showToast('Error deleting workout', 'error');
    }
  };

  const gymWorkouts = workouts.filter((w) => w.workoutType !== 'FOOTBALL');

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#18181b]/60 border border-white/5 p-4 rounded-xl backdrop-blur-md">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-red-400" />
            Resistance & Gym Training
          </h3>
          <p className="text-sm text-zinc-400">
            Authoritative source-of-truth for gym workouts and exercise set loads.
          </p>
        </div>
        <button
          id="btn-log-workout"
          onClick={() => {
            setDraftSets([]);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-red-500/20"
        >
          <Plus className="w-4 h-4" />
          Log Workout Session
        </button>
      </div>

      {/* Workouts Feed */}
      {gymWorkouts.length === 0 ? (
        <div className="text-center py-16 bg-[#18181b]/30 border border-white/5 rounded-xl">
          <Dumbbell className="w-12 h-12 text-zinc-600 mx-auto mb-3 opacity-50" />
          <h4 className="text-base font-semibold text-zinc-300">No Gym Workouts Logged</h4>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
            Record Push, Pull, Legs, or Full Body workouts with exercises, sets, and verified loads.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {gymWorkouts.map((w) => {
            const workoutSets = exercises.filter((e) => e.workoutId === w.id);
            return (
              <div
                key={w.id}
                className="bg-[#18181b]/40 border border-white/5 hover:border-white/10 p-5 rounded-xl transition backdrop-blur-md"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                        {w.workoutType.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-medium text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {w.durationMinutes} min
                      </span>
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(w.startedAt)}
                      </span>
                    </div>
                    {w.notes && <p className="text-sm text-zinc-300 mt-2">{w.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteWorkout(w.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                    title="Delete workout"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Sets Table */}
                {workoutSets.length > 0 && (
                  <div className="mt-4 border-t border-white/5 pt-3">
                    <div className="text-xs font-semibold uppercase text-zinc-400 mb-2">
                      Recorded Exercises ({workoutSets.length} sets)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {workoutSets.map((s) => (
                        <div
                          key={s.id}
                          className="bg-black/30 border border-white/5 px-3 py-2 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-zinc-200">{s.exerciseName}</span>
                            <div className="text-zinc-400">
                              Set {s.setIndex}: {s.reps} reps @ <span className="text-white font-medium">{s.weightKg} kg</span>
                              {s.weightPerSideKg !== undefined && (
                                <span className="text-red-400/90 ml-1">
                                  ({s.weightPerSideKg} kg/side{s.barWeightKg ? `, ${s.barWeightKg}kg bar` : ''})
                                </span>
                              )}
                            </div>
                          </div>
                          {s.isPR && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              PR
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Log Workout Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 my-8">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-red-400" />
                Log Workout Session
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveWorkout} className="space-y-6">
              {/* Workout Basics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Workout Type
                  </label>
                  <select
                    value={workoutType}
                    onChange={(e) => setWorkoutType(e.target.value as WorkoutType)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                  >
                    <option value="GYM_PUSH">Gym Push</option>
                    <option value="GYM_PULL">Gym Pull</option>
                    <option value="GYM_LEGS">Gym Legs</option>
                    <option value="GYM_UPPER">Gym Upper</option>
                    <option value="GYM_LOWER">Gym Lower</option>
                    <option value="GYM_FULL">Gym Full Body</option>
                    <option value="OTHER">Other Training</option>
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
              </div>

              {/* Set Builder Section */}
              <div className="border border-white/10 rounded-xl p-4 bg-black/20 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    Add Exercise Set
                  </h4>
                  <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useKnownBar}
                      onChange={(e) => setUseKnownBar(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-red-500 focus:ring-red-500"
                    />
                    Explicit Barbell Weight
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-zinc-400 mb-1">Exercise Name</label>
                    <input
                      type="text"
                      value={exerciseName}
                      onChange={(e) => setExerciseName(e.target.value)}
                      placeholder="e.g. Bench Press, Incline DB Press"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Reps</label>
                    <input
                      type="number"
                      min={1}
                      value={reps}
                      onChange={(e) => setReps(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                    />
                  </div>
                </div>

                {/* Weight Calculator Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {useKnownBar && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Bar Weight (kg)</label>
                      <input
                        type="number"
                        min={0}
                        value={barWeightKg}
                        onChange={(e) => handleBarWeightChange(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                        placeholder="e.g. 20"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Weight Per Side (kg)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={weightPerSideKg}
                      onChange={(e) => handlePerSideChange(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                      placeholder="e.g. 30"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Total System Load (kg)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={weightKg}
                      onChange={(e) => handleTotalWeightChange(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-red-400 focus:border-red-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPR}
                      onChange={(e) => setIsPR(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                    />
                    Mark as Personal Record (PR)
                  </label>

                  <button
                    type="button"
                    onClick={handleAddSetToDraft}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition"
                  >
                    + Add Set to Workout
                  </button>
                </div>

                {/* Draft Sets Preview */}
                {draftSets.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <div className="text-[11px] font-semibold text-zinc-400 uppercase">
                      Sets in this session ({draftSets.length})
                    </div>
                    {draftSets.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between bg-black/40 px-3 py-1.5 rounded text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">#{s.setIndex}</span>
                          <span className="text-white font-medium">{s.exerciseName}</span>
                          <span className="text-zinc-400">{s.reps} reps @ {s.weightKg} kg</span>
                          {s.weightPerSideKg !== undefined && (
                            <span className="text-red-400">({s.weightPerSideKg} kg/side)</span>
                          )}
                          {s.isPR && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1 rounded">
                              PR
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftSet(s.id)}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Focus cues, intensity, RPE notes..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
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
                  Save Workout Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
