// ============================================================================
// PERSONAL OS — Fitness Goals & Target Variance Tab
// User-controlled goal manager with optional quick-add templates.
// Goals are NEVER auto-created; user maintains full discretion.
// ============================================================================

import { useState } from 'react';
import { Target, Plus, Trash2, CheckCircle2, TrendingUp, Sparkles, Award } from 'lucide-react';
import type { Goal, CadenceType } from '../../types';
import type { FitnessKpiSummary } from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { notifyDataChange } from '../../hooks/useDatabase';
import { showToast } from '../Toast';

interface FitnessGoalsTabProps {
  goals: Goal[];
  kpis: FitnessKpiSummary;
}

interface GoalTemplate {
  title: string;
  cadence: CadenceType;
  targetValue: number;
  unit: string;
  description: string;
  metricKey: keyof FitnessKpiSummary;
}

const OPTIONAL_TEMPLATES: GoalTemplate[] = [
  {
    title: '30 kg Bench Each Side',
    cadence: 'NORTH_STAR',
    targetValue: 30,
    unit: 'kg/side',
    description: 'Strength target of 30 kg per side on the barbell bench press.',
    metricKey: 'benchPressMaxPerSideKg',
  },
  {
    title: '5 km Run Completed',
    cadence: 'WEEKLY',
    targetValue: 1,
    unit: 'runs',
    description: 'Complete at least one continuous 5.0+ km run per week.',
    metricKey: 'fiveKmRunsThisWeek',
  },
  {
    title: '4 Workouts per Week',
    cadence: 'WEEKLY',
    targetValue: 4,
    unit: 'workouts',
    description: 'Maintain 4 resistance training sessions per week.',
    metricKey: 'workoutsThisWeek',
  },
  {
    title: '140g Daily Protein',
    cadence: 'DAILY',
    targetValue: 140,
    unit: 'g',
    description: 'Maintain 140g average daily protein intake on logged days.',
    metricKey: 'avgDailyProteinWeek',
  },
  {
    title: '7.5h Average Sleep',
    cadence: 'DAILY',
    targetValue: 7.5,
    unit: 'hours',
    description: 'Ensure at least 7.5 hours of average sleep duration across logged nights.',
    metricKey: 'avgSleepHoursWeek',
  },
  {
    title: 'Body Weight 65–70 kg',
    cadence: 'MONTHLY',
    targetValue: 68,
    unit: 'kg',
    description: 'Maintain healthy target body mass within the 65–70 kg range.',
    metricKey: 'latestWeightKg',
  },
];

export function FitnessGoalsTab({ goals, kpis }: FitnessGoalsTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<CadenceType>('WEEKLY');
  const [targetValue, setTargetValue] = useState<number | ''>(1);
  const [unit, setUnit] = useState('runs');

  const fitnessGoals = goals.filter((g) => g.pillarId === 'fitness');

  // Calculates live progress against KPI reality
  const getLiveProgress = (goal: Goal) => {
    let current = goal.currentValue ?? 0;

    // Check if matching KPI metric can provide live automatic reflection
    const titleLower = goal.title.toLowerCase();
    if (titleLower.includes('bench')) {
      if (titleLower.includes('side') || titleLower.includes('per side')) {
        current = kpis.benchPressMaxPerSideKg;
      } else {
        current = kpis.benchPressPeakTotalKg ?? (kpis.benchPressMaxPerSideKg > 0 ? kpis.benchPressMaxPerSideKg * 2 + 20 : 0);
      }
    } else if (titleLower.includes('5 km') || titleLower.includes('5k')) {
      current = goal.cadence === 'WEEKLY' ? kpis.fiveKmRunsThisWeek : kpis.fiveKmRunsCount;
    } else if (titleLower.includes('workout') || titleLower.includes('training')) {
      current = kpis.workoutsThisWeek;
    } else if (titleLower.includes('protein')) {
      current = kpis.avgDailyProteinWeek ?? kpis.todayProteinG;
    } else if (titleLower.includes('sleep')) {
      current = kpis.avgSleepHoursWeek ?? 0;
    } else if (titleLower.includes('weight')) {
      current = kpis.latestWeightKg ?? current;
    }

    const target = goal.targetValue || 1;
    const pct = Math.min(200, Math.round((current / target) * 100));
    return { current, target, pct };
  };

  const handleApplyTemplate = async (template: GoalTemplate) => {
    // Check if goal with same title already exists
    if (fitnessGoals.some((g) => g.title.toLowerCase() === template.title.toLowerCase())) {
      showToast(`Goal "${template.title}" is already active`, 'info');
      return;
    }

    try {
      const rawVal = kpis[template.metricKey];
      const initialVal = typeof rawVal === 'number' ? rawVal : 0;

      const newGoal: Goal = {
        id: crypto.randomUUID(),
        pillarId: 'fitness',
        title: template.title,
        description: template.description,
        cadence: template.cadence,
        targetType: 'COUNT',
        targetValue: template.targetValue,
        currentValue: initialVal,
        unit: template.unit,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await dbPut(STORES.GOALS, newGoal);
      notifyDataChange(STORES.GOALS);
      showToast(`Added goal: ${template.title}`, 'success');
    } catch (err) {
      console.error('Failed to apply template:', err);
      showToast('Error adding goal', 'error');
    }
  };

  const handleCreateCustomGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const numTarget = typeof targetValue === 'number' ? targetValue : parseFloat(String(targetValue));
    if (isNaN(numTarget) || numTarget <= 0) {
      showToast('Please enter a target value greater than 0', 'error');
      return;
    }

    try {
      const newGoal: Goal = {
        id: crypto.randomUUID(),
        pillarId: 'fitness',
        title: title.trim(),
        cadence,
        targetType: 'COUNT',
        targetValue: numTarget,
        currentValue: 0,
        unit: unit.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await dbPut(STORES.GOALS, newGoal);
      notifyDataChange(STORES.GOALS);

      showToast(`Created goal: ${newGoal.title}`, 'success');
      setShowModal(false);
      setTitle('');
    } catch (err) {
      console.error('Failed to create goal:', err);
      showToast('Error creating goal', 'error');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fitness goal?')) return;
    try {
      await dbDelete(STORES.GOALS, id);
      notifyDataChange(STORES.GOALS);
      showToast('Goal removed', 'info');
    } catch (err) {
      console.error('Failed to delete goal:', err);
      showToast('Error deleting goal', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#18181b]/60 border border-white/5 p-4 rounded-xl backdrop-blur-md">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-red-400" />
            Fitness & Health Goals
          </h3>
          <p className="text-sm text-zinc-400">
            User-controlled objectives. Observed reality is compared against these targets.
          </p>
        </div>
        <button
          id="btn-custom-goal"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-red-500/20"
        >
          <Plus className="w-4 h-4" />
          Custom Goal
        </button>
      </div>

      {/* Optional Templates Quick-Add Banner */}
      <div className="bg-[#18181b]/40 border border-white/5 p-5 rounded-xl backdrop-blur-md space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-bold text-white">Optional Goal Templates</h4>
          <span className="text-xs text-zinc-500">(Click to activate, never auto-created)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {OPTIONAL_TEMPLATES.map((tmpl) => {
            const isAlreadyActive = fitnessGoals.some(
              (g) => g.title.toLowerCase() === tmpl.title.toLowerCase()
            );

            return (
              <div
                key={tmpl.title}
                className="bg-black/30 border border-white/5 hover:border-white/10 p-3 rounded-lg flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-white">{tmpl.title}</span>
                    <span className="text-[10px] font-semibold uppercase text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                      {tmpl.cadence}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">{tmpl.description}</p>
                </div>
                <button
                  type="button"
                  disabled={isAlreadyActive}
                  onClick={() => handleApplyTemplate(tmpl)}
                  className={`text-xs font-semibold py-1.5 px-2.5 rounded transition mt-1 flex items-center justify-center gap-1 ${
                    isAlreadyActive
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                  }`}
                >
                  {isAlreadyActive ? '✓ Already Active' : '+ Add to Active Goals'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Goals Feed */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-white">Active Goals ({fitnessGoals.length})</h4>
        {fitnessGoals.length === 0 ? (
          <div className="text-center py-12 bg-[#18181b]/30 border border-white/5 rounded-xl">
            <Target className="w-10 h-10 text-zinc-600 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-zinc-400 font-medium">No active fitness goals configured</p>
            <p className="text-xs text-zinc-500 mt-0.5 max-w-sm mx-auto">
              Select one of the optional templates above or create a custom goal to begin tracking variance.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fitnessGoals.map((g) => {
              const { current, target, pct } = getLiveProgress(g);
              const isAchieved = current >= target;

              return (
                <div
                  key={g.id}
                  className="bg-[#18181b]/40 border border-white/5 hover:border-white/10 p-4 rounded-xl transition flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-bold text-white flex items-center gap-1.5">
                          {g.title}
                          {isAchieved && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </span>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          Target: {g.targetValue} {g.unit || ''} ({g.cadence})
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteGoal(g.id)}
                        className="p-1 text-zinc-500 hover:text-red-400 transition"
                        title="Delete goal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">Observed Reality</span>
                        <span className={`font-bold ${isAchieved ? 'text-emerald-400' : 'text-white'}`}>
                          {current} / {target} {g.unit || ''} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isAchieved ? 'bg-emerald-500' : pct >= 50 ? 'bg-red-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Goal Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-red-400" />
                Create Custom Fitness Goal
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateCustomGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 50 Pull-ups in a Session"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Cadence
                  </label>
                  <select
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value as CadenceType)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="NORTH_STAR">North Star Milestone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Target Value
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Unit Label
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. kg, reps, km, runs"
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
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
