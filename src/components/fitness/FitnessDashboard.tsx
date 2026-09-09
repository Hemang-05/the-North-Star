// ============================================================================
// PERSONAL OS — Fitness & Health Command Center (Master Dashboard)
// Priority #5 Console: Physical Training, Running, Football, Nutrition & Recovery.
// 
// Axioms:
//   "I record reality. The system compares reality with my goals. AI interprets the gap."
//   "Code calculates. AI judges and explains."
// 
// Note: fitnessAdherenceScore measures recorded habit adherence, NOT clinical health.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Flame, Dumbbell, Footprints, Trophy, Utensils, Moon,
  Target, Sparkles, Activity, Clock, Award, ShieldAlert,
  RefreshCw, CheckCircle2, ChevronRight, BarChart2,
} from 'lucide-react';
import { useStore, useDataChangeListener } from '../../hooks/useDatabase';
import { dbGetAll, STORES } from '../../services/db';
import type {
  WorkoutSession,
  ExerciseLog,
  RunLog,
  NutritionLog,
  SupplementLog,
  DailyBioSnapshot,
  FitnessKpiSummary,
} from '../../types/pillars';
import type { Goal, ActivityEvent } from '../../types';
import { loadFitnessKpiSummary } from '../../services/fitnessKpi';
import { evaluateFitnessStatus, type StatusEvaluation } from '../../services/statusEngine';
import {
  buildFitnessAiFacts,
  generateOfflineFitnessAudit,
  type FitnessAiFacts,
} from '../../services/aiContext';
import { formatDate, timeAgo } from '../../utils/helpers';
import { showToast } from '../Toast';
import { WorkoutTab } from './WorkoutTab';
import { RunTab } from './RunTab';
import { FootballTab } from './FootballTab';
import { NutritionTab } from './NutritionTab';
import { BioRecoveryTab } from './BioRecoveryTab';
import { FitnessGoalsTab } from './FitnessGoalsTab';
import { AIAnalysisCard } from '../ai/AIAnalysisCard';
import type { ViewId } from '../Sidebar';
import './fitness.css';

interface FitnessDashboardProps {
  onNavigate?: (view: ViewId) => void;
}

type TabType =
  | 'OVERVIEW'
  | 'WORKOUTS'
  | 'RUNS'
  | 'FOOTBALL'
  | 'NUTRITION'
  | 'BIO_RECOVERY'
  | 'GOALS'
  | 'AI_AUDIT'
  | 'ACTIVITY';

export function FitnessDashboard({ onNavigate }: FitnessDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [kpis, setKpis] = useState<FitnessKpiSummary | null>(null);
  const [statusEval, setStatusEval] = useState<StatusEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  // Data Stores
  const { items: workouts } = useStore<WorkoutSession>(STORES.WORKOUTS);
  const { items: exercises } = useStore<ExerciseLog>(STORES.EXERCISES);
  const { items: runs } = useStore<RunLog>(STORES.RUNS);
  const { items: nutrition } = useStore<NutritionLog>(STORES.NUTRITION);
  const { items: supplements } = useStore<SupplementLog>(STORES.SUPPLEMENTS);
  const { items: bioSnapshots } = useStore<DailyBioSnapshot>(STORES.BIO_SNAPSHOTS);
  const { items: goals } = useStore<Goal>(STORES.GOALS);
  const { items: events } = useStore<ActivityEvent>(STORES.EVENTS);

  // AI State
  const [aiFacts, setAiFacts] = useState<FitnessAiFacts | null>(null);
  const [strategicAudit, setStrategicAudit] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [showRawFacts, setShowRawFacts] = useState(false);

  // Reload deterministic calculations
  const refreshCalculations = useCallback(async () => {
    try {
      const summary = await loadFitnessKpiSummary();
      setKpis(summary);

      const allGoals = await dbGetAll<Goal>(STORES.GOALS);
      const activeGoals = allGoals.filter((g) => g.pillarId === 'fitness');
      const evalResult = evaluateFitnessStatus(summary, activeGoals);
      setStatusEval(evalResult);
    } catch (err) {
      console.error('Failed to load fitness KPIs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCalculations();
  }, [refreshCalculations]);

  useDataChangeListener(STORES.WORKOUTS, refreshCalculations);
  useDataChangeListener(STORES.EXERCISES, refreshCalculations);
  useDataChangeListener(STORES.RUNS, refreshCalculations);
  useDataChangeListener(STORES.NUTRITION, refreshCalculations);
  useDataChangeListener(STORES.SUPPLEMENTS, refreshCalculations);
  useDataChangeListener(STORES.BIO_SNAPSHOTS, refreshCalculations);
  useDataChangeListener(STORES.GOALS, refreshCalculations);
  useDataChangeListener(STORES.FOCUS_SESSIONS, refreshCalculations);

  const handleRunAiAudit = async () => {
    setIsAuditing(true);
    try {
      const facts = await buildFitnessAiFacts();
      setAiFacts(facts);
      const auditMarkdown = generateOfflineFitnessAudit(facts);
      setStrategicAudit(auditMarkdown);
      showToast('Strategic Habit & Adherence Audit updated', 'success');
    } catch (err) {
      console.error('Failed to run AI audit:', err);
      showToast('Error generating AI audit', 'error');
    } finally {
      setIsAuditing(false);
    }
  };

  if (loading || !kpis || !statusEval) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500" />
      </div>
    );
  }

  const fitnessEvents = events
    .filter((e) => e.pillarId === 'fitness')
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#18181b]/60 border border-white/5 p-6 rounded-2xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-red-500/20 text-red-400 border border-red-500/30">
              Pillar #5 Console
            </span>
            <span className="text-xs text-zinc-500">Physical Training & Habit Adherence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Flame className="w-7 h-7 text-red-500" />
            Fitness & Health
          </h1>
          <p className="text-sm text-zinc-400">
            Authoritative tracking of resistance training, running, weekend football, nutrition macros, and recovery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshCalculations}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
            title="Refresh calculations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            id="btn-ai-audit-header"
            onClick={() => {
              setActiveTab('AI_AUDIT');
              handleRunAiAudit();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl text-sm font-semibold transition"
          >
            <Sparkles className="w-4 h-4" />
            AI Habit Audit
          </button>
        </div>
      </div>

      {/* Hero Status & Adherence Score Banner */}
      <div className="bg-[#18181b]/60 border border-white/5 p-6 rounded-2xl backdrop-blur-xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                statusEval.verdict === 'EXCEEDING'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : statusEval.verdict === 'ON_TRACK'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : statusEval.verdict === 'AT_RISK'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {statusEval.verdict.replace('_', ' ')}
            </span>
            <h2 className="text-xl font-bold text-white">{statusEval.headline}</h2>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{statusEval.reason}</p>
          <div className="flex gap-2 flex-wrap pt-1">
            {statusEval.badges.map((b) => (
              <span
                key={b}
                className="text-[11px] bg-black/40 text-zinc-400 border border-white/5 px-2.5 py-0.5 rounded-full font-medium"
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* Deterministic Habit Adherence Score Widget */}
        <div className="bg-black/30 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold uppercase text-zinc-400">
              Habit Adherence Score
            </span>
            <span className="text-2xl font-black text-red-400">
              {kpis.fitnessAdherenceScore}
              <span className="text-xs text-zinc-500 font-normal">/100</span>
            </span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mb-3">
            <div
              className="bg-red-500 h-full transition-all duration-500"
              style={{ width: `${kpis.fitnessAdherenceScore}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 border-t border-white/5 pt-2">
            <div>Training: <strong className="text-white">{kpis.adherenceScoreBreakdown.trainingConsistency}/30</strong></div>
            <div>Cardio/Sport: <strong className="text-white">{kpis.adherenceScoreBreakdown.cardioAndSports}/25</strong></div>
            <div>Sleep/Rec: <strong className="text-white">{kpis.adherenceScoreBreakdown.recoveryAndSleep}/25</strong></div>
            <div>Nutrition: <strong className="text-white">{kpis.adherenceScoreBreakdown.nutritionAndHabits}/20</strong></div>
          </div>
          <div className="text-[10px] text-zinc-500 mt-2 italic text-center">
            *Pure adherence calculation. Not clinical health or medical advice.
          </div>
        </div>
      </div>

      {/* Distinguishable Activity Duration Strip */}
      <div className="bg-[#18181b]/40 border border-white/5 p-4 rounded-xl backdrop-blur-md">
        <div className="text-xs font-semibold uppercase text-zinc-400 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-red-400" />
            Distinguishable Activity Durations (Zero Double-Counting)
          </span>
          <span className="text-zinc-400 font-bold">
            Total Physical: <span className="text-white">{kpis.totalActiveMinutes}m</span>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-black/40 border border-white/5 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
              <Dumbbell className="w-3 h-3 text-red-400" /> Gym Resistance
            </div>
            <div className="text-lg font-bold text-white mt-0.5">{kpis.gymDurationMinutes} min</div>
            <div className="text-[10px] text-zinc-500">{kpis.workoutsCount} workout(s)</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
              <Footprints className="w-3 h-3 text-red-400" /> Running
            </div>
            <div className="text-lg font-bold text-white mt-0.5">{kpis.runningDurationMinutes} min</div>
            <div className="text-[10px] text-zinc-500">{kpis.totalDistanceKm} km total</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
              <Trophy className="w-3 h-3 text-red-400" /> Weekend Football
            </div>
            <div className="text-lg font-bold text-white mt-0.5">{kpis.footballDurationMinutes} min</div>
            <div className="text-[10px] text-zinc-500">{kpis.footballSessionsCount} match/drill</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 font-medium">Mobility & Walk</div>
            <div className="text-lg font-bold text-white mt-0.5">{kpis.mobilityDurationMinutes} min</div>
            <div className="text-[10px] text-zinc-500">Recovery sessions</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-3 rounded-lg col-span-2 sm:col-span-1">
            <div className="text-[11px] text-amber-400 font-medium">Cognitive (Mental)</div>
            <div className="text-lg font-bold text-amber-300 mt-0.5">{kpis.cognitiveDurationMinutes} min</div>
            <div className="text-[10px] text-zinc-500">Chess / Sudoku (Segregated)</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 gap-1 sm:gap-2 overflow-x-auto pb-1 text-sm font-medium">
        {[
          { id: 'OVERVIEW', label: 'Overview', icon: BarChart2 },
          { id: 'WORKOUTS', label: `Workouts (${workouts.filter((w) => w.workoutType !== 'FOOTBALL').length})`, icon: Dumbbell },
          { id: 'RUNS', label: `Runs (${runs.length})`, icon: Footprints },
          { id: 'FOOTBALL', label: `Football (${workouts.filter((w) => w.workoutType === 'FOOTBALL').length})`, icon: Trophy },
          { id: 'NUTRITION', label: `Nutrition (${nutrition.length})`, icon: Utensils },
          { id: 'BIO_RECOVERY', label: `Bio & Sleep (${bioSnapshots.length})`, icon: Moon },
          { id: 'GOALS', label: `Goals (${goals.filter((g) => g.pillarId === 'fitness').length})`, icon: Target },
          { id: 'AI_AUDIT', label: 'AI Habit Audit', icon: Sparkles },
          { id: 'ACTIVITY', label: `Ledger (${fitnessEvents.length})`, icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id.toLowerCase()}`}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg whitespace-nowrap transition ${
                isActive
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Key Milestone Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Bench Press Card */}
            <div className="bg-[#18181b]/50 border border-white/5 p-5 rounded-xl backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-zinc-400 font-semibold uppercase">Bench Press Peak</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {kpis.benchPressMaxKg > 0 ? `${kpis.benchPressMaxKg} kg total` : '—'}
                  </div>
                  <div className="text-xs text-red-400 mt-1">
                    {kpis.benchPressMaxPerSideKg > 0
                      ? `${kpis.benchPressMaxPerSideKg} kg / side${kpis.benchPressBarWeightKg ? ` (${kpis.benchPressBarWeightKg}kg bar)` : ''}`
                      : 'No bench sets logged'}
                  </div>
                </div>
                <Award className="w-6 h-6 text-amber-400/80" />
              </div>
              <div className="text-[11px] text-zinc-500 mt-3 pt-2 border-t border-white/5">
                Target: 30 kg per side (evaluated without guessing bar tare weight)
              </div>
            </div>

            {/* 5K Running Card */}
            <div className="bg-[#18181b]/50 border border-white/5 p-5 rounded-xl backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-zinc-400 font-semibold uppercase">5K Run Benchmark</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {kpis.fiveKmRunsCount} Completed
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    {kpis.distanceThisWeekKm} km this week | {kpis.avgPaceMinKm ? `${kpis.avgPaceMinKm} min/km avg` : '—'}
                  </div>
                </div>
                <Footprints className="w-6 h-6 text-red-400/80" />
              </div>
              <div className="text-[11px] text-zinc-500 mt-3 pt-2 border-t border-white/5">
                {kpis.fiveKmRunsThisWeek >= 1 ? '✓ Completed 5K this week' : 'Continuous 5.0+ km run target'}
              </div>
            </div>

            {/* Body Mass & Sleep Recovery Card */}
            <div className="bg-[#18181b]/50 border border-white/5 p-5 rounded-xl backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-zinc-400 font-semibold uppercase">Body & Sleep Recovery</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {kpis.latestWeightKg !== null ? `${kpis.latestWeightKg} kg` : '—'}
                  </div>
                  <div className="text-xs text-indigo-400 mt-1">
                    {kpis.avgSleepHoursWeek !== null ? `${kpis.avgSleepHoursWeek}h average sleep` : 'Sleep not logged'}
                  </div>
                </div>
                <Moon className="w-6 h-6 text-indigo-400/80" />
              </div>
              <div className="text-[11px] text-zinc-500 mt-3 pt-2 border-t border-white/5">
                Target band: 65–70 kg | Deficit alert: {kpis.sleepDeficitFlag ? 'ACTIVE' : 'NORMAL'}
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Sessions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Workouts */}
            <div className="bg-[#18181b]/40 border border-white/5 p-5 rounded-xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-red-400" />
                  Recent Training Sessions
                </h3>
                <button
                  onClick={() => setActiveTab('WORKOUTS')}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {workouts.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">No workouts recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {workouts.slice(0, 3).map((w) => (
                    <div
                      key={w.id}
                      className="bg-black/30 border border-white/5 p-3 rounded-lg flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{w.workoutType.replace('_', ' ')}</span>
                        <div className="text-zinc-400">{w.durationMinutes} min • {formatDate(w.startedAt)}</div>
                      </div>
                      {w.notes && <span className="text-[11px] text-zinc-400 max-w-[200px] truncate">{w.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nutrition & Supplements Today */}
            <div className="bg-[#18181b]/40 border border-white/5 p-5 rounded-xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-red-400" />
                  Today's Fuel & Stack
                </h3>
                <button
                  onClick={() => setActiveTab('NUTRITION')}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  Log Meal <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-black/30 border border-white/5 p-3 rounded-lg text-xs">
                  <div className="text-zinc-400">Today's Calories</div>
                  <div className="text-lg font-bold text-white mt-0.5">{kpis.todayCalories} kcal</div>
                </div>
                <div className="bg-black/30 border border-white/5 p-3 rounded-lg text-xs">
                  <div className="text-zinc-400">Today's Protein</div>
                  <div className="text-lg font-bold text-red-400 mt-0.5">{kpis.todayProteinG}g</div>
                </div>
              </div>

              <div className="text-xs text-zinc-400 flex justify-between items-center pt-2 border-t border-white/5">
                <span>Supplements Stack:</span>
                <span className="text-white font-medium">
                  {kpis.supplementsTakenToday} / {kpis.totalSupplementsTracked} taken
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'WORKOUTS' && <WorkoutTab workouts={workouts} exercises={exercises} />}
      {activeTab === 'RUNS' && <RunTab runs={runs} />}
      {activeTab === 'FOOTBALL' && <FootballTab workouts={workouts} />}
      {activeTab === 'NUTRITION' && (
        <NutritionTab
          nutrition={nutrition}
          supplements={supplements}
          avgDailyCaloriesWeek={kpis.avgDailyCaloriesWeek}
          avgDailyProteinWeek={kpis.avgDailyProteinWeek}
        />
      )}
      {activeTab === 'BIO_RECOVERY' && (
        <BioRecoveryTab
          snapshots={bioSnapshots}
          latestWeightKg={kpis.latestWeightKg}
          weightDeltaMonthKg={kpis.weightDeltaMonthKg}
          avgSleepHoursWeek={kpis.avgSleepHoursWeek}
          avgSleepQualityWeek={kpis.avgSleepQualityWeek}
          sleepDeficitFlag={kpis.sleepDeficitFlag}
          chessSudokuMinutesWeek={kpis.chessSudokuMinutesWeek}
        />
      )}
      {activeTab === 'GOALS' && <FitnessGoalsTab goals={goals} kpis={kpis} />}

      {/* AI Audit Tab */}
      {activeTab === 'AI_AUDIT' && (
        <div className="space-y-6">
          {/* Layer 4 Live AI Pillar Audit */}
          <AIAnalysisCard
            mode="PILLAR"
            pillarScope="fitness"
            title="Layer 4 AI Strategic Interpretation — Health & Fitness"
            allowBrutal={true}
          />

          <div className="flex justify-between items-center bg-[#18181b]/60 border border-white/5 p-4 rounded-xl backdrop-blur-md">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-red-400" />
                Strategic Habit & Adherence Audit
              </h3>
              <p className="text-xs text-zinc-400">
                Ground-truth AI evaluation consuming deterministic Fitness KPIs and goals. Non-medical.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRawFacts(!showRawFacts)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition"
              >
                {showRawFacts ? 'Hide Raw Facts' : 'Inspect Raw Facts'}
              </button>
              <button
                onClick={handleRunAiAudit}
                disabled={isAuditing}
                className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition"
              >
                {isAuditing ? 'Auditing...' : 'Run New Audit'}
              </button>
            </div>
          </div>

          {showRawFacts && aiFacts && (
            <div className="bg-black/50 border border-white/10 p-4 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto max-h-96">
              <pre>{JSON.stringify(aiFacts, null, 2)}</pre>
            </div>
          )}

          {strategicAudit ? (
            <div className="bg-[#18181b]/40 border border-white/5 p-6 rounded-2xl whitespace-pre-line text-sm text-zinc-300 leading-relaxed font-sans">
              {strategicAudit}
            </div>
          ) : (
            <div className="text-center py-16 bg-[#18181b]/30 border border-white/5 rounded-xl">
              <Sparkles className="w-10 h-10 text-zinc-600 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-zinc-400 font-medium">No audit generated yet</p>
              <button
                onClick={handleRunAiAudit}
                className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition"
              >
                Generate Strategic Audit Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Activity Ledger Tab */}
      {activeTab === 'ACTIVITY' && (
        <div className="space-y-4">
          <div className="bg-[#18181b]/60 border border-white/5 p-4 rounded-xl backdrop-blur-md">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-400" />
              Fitness Activity Ledger
            </h3>
            <p className="text-xs text-zinc-400">
              Complete append-only audit trail for all Fitness events.
            </p>
          </div>

          {fitnessEvents.length === 0 ? (
            <div className="text-center py-12 bg-[#18181b]/30 border border-white/5 rounded-xl">
              <Activity className="w-10 h-10 text-zinc-600 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-zinc-400 font-medium">No Fitness activity events recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fitnessEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-[#18181b]/40 border border-white/5 p-3.5 rounded-xl flex justify-between items-center text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{evt.eventType}</span>
                      <span className="text-[11px] text-zinc-500">
                        {evt.quantity} {evt.unit}
                      </span>
                    </div>
                    <div className="text-zinc-400 text-[11px]">
                      Entity: <strong className="text-zinc-300">{evt.entityRefType}</strong> ({evt.entityRefId})
                    </div>
                  </div>
                  <div className="text-right text-zinc-500 text-[11px]">
                    {timeAgo(evt.occurredAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
