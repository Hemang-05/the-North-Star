// ============================================================================
// PERSONAL OS — Fitness Bio & Recovery Tab
// Body weight, overnight sleep calculation, and cognitive habits tracker.
// ============================================================================

import { useState } from 'react';
import { Scale, Moon, Brain, Plus, Trash2, Calendar, Clock, AlertTriangle, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type { DailyBioSnapshot } from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { calculateSleepDurationMins } from '../../services/fitnessKpi';
import { formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';

interface BioRecoveryTabProps {
  snapshots: DailyBioSnapshot[];
  latestWeightKg: number | null;
  weightDeltaMonthKg: number | null;
  avgSleepHoursWeek: number | null;
  avgSleepQualityWeek: number | null;
  sleepDeficitFlag: boolean;
  chessSudokuMinutesWeek: number;
}

export function BioRecoveryTab({
  snapshots,
  latestWeightKg,
  weightDeltaMonthKg,
  avgSleepHoursWeek,
  avgSleepQualityWeek,
  sleepDeficitFlag,
  chessSudokuMinutesWeek,
}: BioRecoveryTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weightKg, setWeightKg] = useState<number | ''>(latestWeightKg ?? 68.5);
  const [sleepBedtime, setSleepBedtime] = useState('23:30');
  const [sleepWaketime, setSleepWaketime] = useState('07:00');
  const [manualDurationMins, setManualDurationMins] = useState<number | ''>('');
  const [sleepQuality, setSleepQuality] = useState<number | ''>(8);
  const [energyLevel, setEnergyLevel] = useState<number | ''>(8);
  const [chessSudokuMins, setChessSudokuMins] = useState<number | ''>(20);

  // Compute live sleep duration
  const computedSleepMins = calculateSleepDurationMins(sleepBedtime, sleepWaketime);
  const effectiveSleepMins = typeof manualDurationMins === 'number' ? manualDurationMins : computedSleepMins;
  const sleepHoursFormatted = effectiveSleepMins !== null ? (effectiveSleepMins / 60).toFixed(1) : '—';

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();

    const numSleepQuality = typeof sleepQuality === 'number' ? sleepQuality : undefined;
    const numEnergyLevel = typeof energyLevel === 'number' ? energyLevel : undefined;
    const numChessSudoku = typeof chessSudokuMins === 'number' ? chessSudokuMins : 0;

    try {
      const snapshotId = crypto.randomUUID();
      const newSnapshot: DailyBioSnapshot = {
        id: snapshotId,
        date,
        weightKg: typeof weightKg === 'number' ? weightKg : undefined,
        sleepBedtime: sleepBedtime.trim() || undefined,
        sleepWaketime: sleepWaketime.trim() || undefined,
        sleepDurationMins: effectiveSleepMins ?? undefined,
        sleepQuality: numSleepQuality,
        energyLevel: numEnergyLevel,
        chessSudokuMins: numChessSudoku > 0 ? numChessSudoku : undefined,
      };

      await dbPut(STORES.BIO_SNAPSHOTS, newSnapshot);

      // Emits events for weight and sleep
      if (typeof weightKg === 'number') {
        await logEvent(
          'fitness',
          'FITNESS_WEIGHT_LOGGED',
          weightKg,
          'kg',
          'DailyBioSnapshot',
          snapshotId,
          { weightKg, date }
        );
      }

      if (effectiveSleepMins !== null && effectiveSleepMins > 0) {
        await logEvent(
          'fitness',
          'FITNESS_SLEEP_LOGGED',
          effectiveSleepMins,
          'minutes',
          'DailyBioSnapshot',
          snapshotId,
          {
            sleepDurationMins: effectiveSleepMins,
            sleepQuality,
            sleepBedtime,
            sleepWaketime,
          }
        );
      }

      notifyDataChange(STORES.BIO_SNAPSHOTS);

      showToast(`Saved bio & recovery snapshot for ${date}!`, 'success');
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save bio snapshot:', err);
      showToast('Failed to save snapshot', 'error');
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm('Delete this bio snapshot?')) return;
    try {
      await dbDelete(STORES.BIO_SNAPSHOTS, id);
      notifyDataChange(STORES.BIO_SNAPSHOTS);
      showToast('Bio snapshot deleted', 'info');
    } catch (err) {
      console.error('Failed to delete snapshot:', err);
      showToast('Error deleting snapshot', 'error');
    }
  };

  const sortedSnapshots = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#18181b]/60 border border-white/5 p-4 rounded-xl backdrop-blur-md">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Moon className="w-5 h-5 text-red-400" />
            Bio, Sleep & Recovery Log
          </h3>
          <p className="text-sm text-zinc-400">
            Authoritative body weight, overnight sleep calculations, and cognitive habits.
          </p>
        </div>
        <button
          id="btn-log-bio"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-red-500/20"
        >
          <Plus className="w-4 h-4" />
          Log Daily Snapshot
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#18181b]/50 border border-white/5 p-4 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-blue-400" />
            Current Weight
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {latestWeightKg !== null ? `${latestWeightKg} kg` : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
            {weightDeltaMonthKg !== null ? (
              <>
                {weightDeltaMonthKg > 0 ? (
                  <TrendingUp className="w-3 h-3 text-red-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-emerald-400" />
                )}
                <span>{weightDeltaMonthKg > 0 ? `+${weightDeltaMonthKg}` : weightDeltaMonthKg} kg (30d)</span>
              </>
            ) : (
              'Target: 65–70 kg band'
            )}
          </div>
        </div>

        <div className="bg-[#18181b]/50 border border-white/5 p-4 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            Weekly Avg Sleep
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {avgSleepHoursWeek !== null ? `${avgSleepHoursWeek} h` : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {avgSleepQualityWeek !== null ? `Quality: ${avgSleepQualityWeek}/10` : 'Target: >= 7.5h'}
          </div>
        </div>

        <div className="bg-[#18181b]/50 border border-white/5 p-4 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-amber-400" />
            Cognitive Habits (Week)
          </div>
          <div className="text-xl font-bold text-amber-400 mt-1">
            {chessSudokuMinutesWeek}m
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Chess / Sudoku (segregated from training)
          </div>
        </div>

        <div className="bg-[#18181b]/50 border border-white/5 p-4 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium">Recovery Deficit Alert</div>
          <div className="text-xl font-bold mt-1">
            {sleepDeficitFlag ? (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> DEFICIT
              </span>
            ) : (
              <span className="text-emerald-400">OPTIMAL</span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {sleepDeficitFlag ? '< 6.0h avg over logged days' : 'Adequate rest baseline'}
          </div>
        </div>
      </div>

      {/* Snapshots Table */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-white">Daily Snapshots History</h4>
        {sortedSnapshots.length === 0 ? (
          <div className="text-center py-12 bg-[#18181b]/30 border border-white/5 rounded-xl">
            <Moon className="w-10 h-10 text-zinc-600 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-zinc-400 font-medium">No bio snapshots logged yet</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Record daily weight, bedtime, waketime, and cognitive minutes.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSnapshots.map((s) => {
              const durHours = s.sleepDurationMins ? (s.sleepDurationMins / 60).toFixed(1) : null;
              return (
                <div
                  key={s.id}
                  className="bg-[#18181b]/40 border border-white/5 hover:border-white/10 p-4 rounded-xl transition flex justify-between items-center"
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      {s.date}
                    </span>

                    {s.weightKg !== undefined && (
                      <span className="text-xs text-zinc-300 bg-black/40 px-2 py-1 rounded border border-white/5">
                        Weight: <strong className="text-white">{s.weightKg} kg</strong>
                      </span>
                    )}

                    {durHours !== null && (
                      <span className="text-xs text-zinc-300 bg-black/40 px-2 py-1 rounded border border-white/5">
                        Sleep: <strong className="text-indigo-400">{durHours}h</strong>
                        {s.sleepBedtime && s.sleepWaketime && (
                          <span className="text-zinc-500 ml-1">
                            ({s.sleepBedtime} → {s.sleepWaketime})
                          </span>
                        )}
                        {s.sleepQuality && (
                          <span className="text-zinc-400 ml-1">[{s.sleepQuality}/10]</span>
                        )}
                      </span>
                    )}

                    {s.chessSudokuMins !== undefined && s.chessSudokuMins > 0 && (
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        Chess/Sudoku: {s.chessSudokuMins}m
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteSnapshot(s.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                    title="Delete snapshot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Snapshot Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Moon className="w-5 h-5 text-red-400" />
                Log Daily Bio & Sleep Snapshot
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveSnapshot} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={30}
                    max={250}
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="e.g. 68.5"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                  />
                </div>
              </div>

              {/* Overnight Sleep Times */}
              <div className="border border-white/10 rounded-xl p-3.5 bg-black/20 space-y-3">
                <div className="text-xs font-bold text-zinc-300 uppercase flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Overnight Sleep Window
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Bedtime (HH:mm)</label>
                    <input
                      type="time"
                      value={sleepBedtime}
                      onChange={(e) => setSleepBedtime(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Waketime (HH:mm)</label>
                    <input
                      type="time"
                      value={sleepWaketime}
                      onChange={(e) => setSleepWaketime(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="bg-black/30 border border-white/5 p-2.5 rounded-lg text-xs flex justify-between items-center">
                  <span className="text-zinc-400">Calculated Sleep Duration:</span>
                  <span className="text-indigo-300 font-bold">
                    {effectiveSleepMins ? `${effectiveSleepMins} min (${sleepHoursFormatted} hrs)` : '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Sleep Quality (1-10)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={sleepQuality}
                      onChange={(e) => setSleepQuality(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Energy Level (1-10)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={energyLevel}
                      onChange={(e) => setEnergyLevel(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Cognitive Habits */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-amber-400" />
                  Chess / Sudoku Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  value={chessSudokuMins}
                  onChange={(e) => setChessSudokuMins(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Tracked under cognitive duration, segregated from physical training.
                </p>
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
                  Save Snapshot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
