// ============================================================================
// PERSONAL OS — Fitness Nutrition & Supplements Tab
// Nutrition log, macro aggregator, and daily supplement checklist.
// Never assumes 0 for missing days; distinguishes unlogged from genuine 0.
// ============================================================================

import { useState } from 'react';
import { Utensils, Plus, Pill, CheckCircle2, Circle, Trash2, Calendar, Flame, Beef } from 'lucide-react';
import type { NutritionLog, SupplementLog, MealType } from '../../types/pillars';
import { dbPut, dbDelete, STORES } from '../../services/db';
import { logEvent, notifyDataChange } from '../../hooks/useDatabase';
import { formatDate } from '../../utils/helpers';
import { showToast } from '../Toast';

interface NutritionTabProps {
  nutrition: NutritionLog[];
  supplements: SupplementLog[];
  avgDailyCaloriesWeek: number | null;
  avgDailyProteinWeek: number | null;
}

export function NutritionTab({
  nutrition,
  supplements,
  avgDailyCaloriesWeek,
  avgDailyProteinWeek,
}: NutritionTabProps) {
  // Meal Form State
  const [showMealModal, setShowMealModal] = useState(false);
  const [foodName, setFoodName] = useState('Chicken Breast & White Rice');
  const [mealType, setMealType] = useState<MealType>('LUNCH');
  const [calories, setCalories] = useState<number | ''>(650);
  const [proteinG, setProteinG] = useState<number | ''>(45);
  const [carbsG, setCarbsG] = useState<number | ''>(70);
  const [fatG, setFatG] = useState<number | ''>(12);
  const [eatenAt, setEatenAt] = useState(new Date().toISOString().slice(0, 16));

  // Supplement Form State
  const [showSuppModal, setShowSuppModal] = useState(false);
  const [suppName, setSuppName] = useState('Creatine Monohydrate');
  const [suppQuantity, setSuppQuantity] = useState('5g');

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMeals = nutrition.filter((m) => m.eatenAt.slice(0, 10) === todayStr);
  const todayCalories = todayMeals.reduce((acc, m) => acc + (m.calories || 0), 0);
  const todayProtein = todayMeals.reduce((acc, m) => acc + (m.proteinG || 0), 0);
  const todayCarbs = todayMeals.reduce((acc, m) => acc + (m.carbsG || 0), 0);
  const todayFat = todayMeals.reduce((acc, m) => acc + (m.fatG || 0), 0);

  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName.trim()) {
      showToast('Please enter a food name', 'error');
      return;
    }

    const numCalories = typeof calories === 'number' ? calories : parseInt(String(calories), 10) || 0;
    const numProtein = typeof proteinG === 'number' ? proteinG : parseInt(String(proteinG), 10) || 0;
    const numCarbs = typeof carbsG === 'number' ? carbsG : parseInt(String(carbsG), 10) || 0;
    const numFat = typeof fatG === 'number' ? fatG : parseInt(String(fatG), 10) || 0;

    try {
      const mealId = crypto.randomUUID();
      const newMeal: NutritionLog = {
        id: mealId,
        eatenAt: new Date(eatenAt).toISOString(),
        foodName: foodName.trim(),
        mealType,
        calories: numCalories,
        proteinG: numProtein,
        carbsG: numCarbs,
        fatG: numFat,
      };

      await dbPut(STORES.NUTRITION, newMeal);

      await logEvent(
        'fitness',
        'FITNESS_MEAL_LOGGED',
        numCalories,
        'kcal',
        'NutritionLog',
        mealId,
        {
          foodName: foodName.trim(),
          mealType,
          calories,
          proteinG,
        }
      );

      notifyDataChange(STORES.NUTRITION);

      showToast(`Logged meal: ${foodName} (${calories} kcal, ${proteinG}g protein)`, 'success');
      setShowMealModal(false);
      setFoodName('');
    } catch (err) {
      console.error('Failed to log meal:', err);
      showToast('Failed to save meal', 'error');
    }
  };

  const handleDeleteMeal = async (id: string) => {
    if (!confirm('Delete this meal log?')) return;
    try {
      await dbDelete(STORES.NUTRITION, id);
      notifyDataChange(STORES.NUTRITION);
      showToast('Meal deleted', 'info');
    } catch (err) {
      console.error('Failed to delete meal:', err);
      showToast('Error deleting meal', 'error');
    }
  };

  const handleToggleSupplement = async (supp: SupplementLog) => {
    try {
      const nextTaken = !supp.taken;
      const updated: SupplementLog = {
        ...supp,
        taken: nextTaken,
        takenAt: nextTaken ? new Date().toISOString() : undefined,
      };

      await dbPut(STORES.SUPPLEMENTS, updated);

      if (nextTaken) {
        await logEvent(
          'fitness',
          'FITNESS_SUPPLEMENT_TAKEN',
          1,
          'dose',
          'SupplementLog',
          supp.id,
          {
            supplement: supp.supplement,
            quantity: supp.quantity,
          }
        );
      }

      notifyDataChange(STORES.SUPPLEMENTS);
      showToast(
        nextTaken ? `Marked ${supp.supplement} as taken` : `Unmarked ${supp.supplement}`,
        'info'
      );
    } catch (err) {
      console.error('Failed to update supplement:', err);
      showToast('Error updating supplement', 'error');
    }
  };

  const handleSaveSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppName.trim()) return;

    try {
      const newSupp: SupplementLog = {
        id: crypto.randomUUID(),
        supplement: suppName.trim(),
        quantity: suppQuantity.trim() || '1 dose',
        taken: false,
      };

      await dbPut(STORES.SUPPLEMENTS, newSupp);
      notifyDataChange(STORES.SUPPLEMENTS);

      showToast(`Added ${newSupp.supplement} to daily checklist`, 'success');
      setShowSuppModal(false);
      setSuppName('');
    } catch (err) {
      console.error('Failed to add supplement:', err);
      showToast('Error saving supplement', 'error');
    }
  };

  const handleDeleteSupplement = async (id: string) => {
    try {
      await dbDelete(STORES.SUPPLEMENTS, id);
      notifyDataChange(STORES.SUPPLEMENTS);
      showToast('Supplement removed', 'info');
    } catch (err) {
      console.error('Failed to delete supplement:', err);
      showToast('Error deleting supplement', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#18181b]/60 border border-white/5 p-4 rounded-xl backdrop-blur-md">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Utensils className="w-5 h-5 text-red-400" />
            Nutrition & Macro Intake
          </h3>
          <p className="text-sm text-zinc-400">
            Authoritative calorie, protein, macro tracker and daily supplement adherence.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            id="btn-add-supplement"
            onClick={() => setShowSuppModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition"
          >
            <Pill className="w-3.5 h-3.5 text-amber-400" />
            + Supplement
          </button>
          <button
            id="btn-log-meal"
            onClick={() => setShowMealModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-red-500/20"
          >
            <Plus className="w-4 h-4" />
            Log Meal
          </button>
        </div>
      </div>

      {/* Daily & Trailing Macro Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#18181b]/50 border border-white/5 p-4 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            Today's Calories
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {todayCalories > 0 ? `${todayCalories} kcal` : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {todayMeals.length} meal(s) logged today
          </div>
        </div>

        <div className="bg-[#18181b]/50 border border-white/5 p-4 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
            <Beef className="w-3.5 h-3.5 text-red-400" />
            Today's Protein
          </div>
          <div className="text-xl font-bold text-red-400 mt-1">
            {todayProtein > 0 ? `${todayProtein}g` : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Carbs: {todayCarbs}g | Fat: {todayFat}g
          </div>
        </div>

        <div className="bg-[#18181b]/50 border border-white/5 p-4 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium">Trailing Weekly Avg Calories</div>
          <div className="text-xl font-bold text-white mt-1">
            {avgDailyCaloriesWeek !== null ? `${avgDailyCaloriesWeek} kcal/d` : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Computed strictly over active days
          </div>
        </div>

        <div className="bg-[#18181b]/50 border border-white/5 p-4 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium">Trailing Weekly Avg Protein</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {avgDailyProteinWeek !== null ? `${avgDailyProteinWeek}g/d` : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Target: 140g/day baseline</div>
        </div>
      </div>

      {/* Daily Supplement Checklist */}
      <div className="bg-[#18181b]/40 border border-white/5 p-5 rounded-xl backdrop-blur-md">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Pill className="w-4 h-4 text-amber-400" />
            Daily Supplement Adherence Checklist
          </h4>
          <span className="text-xs text-zinc-400">
            {supplements.filter((s) => s.taken).length} / {supplements.length} taken today
          </span>
        </div>

        {supplements.length === 0 ? (
          <p className="text-xs text-zinc-500 py-2">
            No supplements added to your daily stack yet. Click "+ Supplement" to add Creatine, Whey, Vitamin D, etc.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {supplements.map((s) => (
              <div
                key={s.id}
                onClick={() => handleToggleSupplement(s)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                  s.taken
                    ? 'bg-amber-500/10 border-amber-500/30 text-white'
                    : 'bg-black/30 border-white/5 text-zinc-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {s.taken ? (
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-600" />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-white">{s.supplement}</div>
                    <div className="text-[11px] text-zinc-400">{s.quantity}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSupplement(s.id);
                  }}
                  className="text-zinc-600 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meals Log Feed */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-white">Recent Meals Logged</h4>
        {nutrition.length === 0 ? (
          <div className="text-center py-12 bg-[#18181b]/30 border border-white/5 rounded-xl">
            <Utensils className="w-10 h-10 text-zinc-600 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-zinc-400 font-medium">No meals recorded yet</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Log your meals to calculate daily calories and protein averages.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {nutrition.map((m) => (
              <div
                key={m.id}
                className="bg-[#18181b]/40 border border-white/5 hover:border-white/10 p-4 rounded-xl transition flex justify-between items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{m.foodName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                      {m.mealType}
                    </span>
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(m.eatenAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                    <span className="text-white font-medium">{m.calories} kcal</span>
                    <span className="text-red-400 font-medium">{m.proteinG}g Protein</span>
                    <span>{m.carbsG}g Carbs</span>
                    <span>{m.fatG}g Fat</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteMeal(m.id)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                  title="Delete meal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Meal Modal */}
      {showMealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Utensils className="w-5 h-5 text-red-400" />
                Log Meal
              </h3>
              <button
                onClick={() => setShowMealModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveMeal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Food / Meal Description
                </label>
                <input
                  type="text"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="e.g. Chicken & Rice, Protein Shake, Eggs"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Meal Type
                  </label>
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value as MealType)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                  >
                    <option value="BREAKFAST">Breakfast</option>
                    <option value="LUNCH">Lunch</option>
                    <option value="DINNER">Dinner</option>
                    <option value="SNACK">Snack</option>
                    <option value="PRE_WORKOUT">Pre-Workout</option>
                    <option value="POST_WORKOUT">Post-Workout</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Eaten At
                  </label>
                  <input
                    type="datetime-local"
                    value={eatenAt}
                    onChange={(e) => setEatenAt(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Calories (kcal)</label>
                  <input
                    type="number"
                    min={0}
                    value={calories}
                    onChange={(e) => setCalories(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-red-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-red-400 font-semibold mb-1">Protein (g)</label>
                  <input
                    type="number"
                    min={0}
                    value={proteinG}
                    onChange={(e) => setProteinG(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-red-400 focus:border-red-500 outline-none font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Carbs (g)</label>
                  <input
                    type="number"
                    min={0}
                    value={carbsG}
                    onChange={(e) => setCarbsG(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Fat (g)</label>
                  <input
                    type="number"
                    min={0}
                    value={fatG}
                    onChange={(e) => setFatG(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-red-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowMealModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-red-500/20"
                >
                  Save Meal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplement Modal */}
      {showSuppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pill className="w-4 h-4 text-amber-400" />
                Add Daily Supplement
              </h3>
              <button
                onClick={() => setShowSuppModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveSupplement} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Supplement Name
                </label>
                <input
                  type="text"
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  placeholder="e.g. Creatine, Whey Protein, Vitamin D3"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Daily Dosage
                </label>
                <input
                  type="text"
                  value={suppQuantity}
                  onChange={(e) => setSuppQuantity(e.target.value)}
                  placeholder="e.g. 5g, 1 scoop, 2000 IU"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSuppModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg text-sm transition"
                >
                  Add to Stack
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
