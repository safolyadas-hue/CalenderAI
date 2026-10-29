import React from 'react';
import { Lock, Unlock, RotateCcw, AlertCircle, PieChart } from 'lucide-react';
import type { BudgetCategory, EventContext } from '../types/event';

interface BudgetPlannerProps {
  context: EventContext;
  categories: BudgetCategory[];
  onUpdateCategoryAmount: (categoryId: string, newAmount: number) => void;
  onToggleLock: (categoryId: string) => void;
  onUpdateActualSpent: (categoryId: string, spent: number) => void;
  onResetToSmartDefaults: () => void;
}

const CATEGORY_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-sky-500',
  'bg-purple-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-slate-500',
];

export const BudgetPlanner: React.FC<BudgetPlannerProps> = ({
  context,
  categories,
  onUpdateCategoryAmount,
  onToggleLock,
  onUpdateActualSpent,
  onResetToSmartDefaults,
}) => {
  const totalAllocated = categories.reduce((sum, c) => sum + c.allocatedAmount, 0);
  const totalSpent = categories.reduce((sum, c) => sum + c.actualSpent, 0);
  const remainingBuffer = context.totalBudget - totalSpent;
  const perGuestCost = Math.round(context.totalBudget / Math.max(context.guestCount, 1));

  return (
    <section aria-labelledby="budget-heading" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header & Reset Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 id="budget-heading" className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PieChart className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            Smart Budget Rebalancing Engine
          </h2>
          <p className="text-xs text-slate-500">
            Dynamically proportional allocation — lock essential items and adjust sliders. Unlocked categories automatically rebalance to 100%.
          </p>
        </div>
        <button
          type="button"
          onClick={onResetToSmartDefaults}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset to Smart Defaults
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Budget</span>
          <span className="text-base font-bold text-slate-900">
            {context.currency} {context.totalBudget.toLocaleString()}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Allocated</span>
          <span className="text-base font-bold text-indigo-600">
            {context.currency} {totalAllocated.toLocaleString()}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Actual Logged</span>
          <span className={`text-base font-bold ${totalSpent > context.totalBudget ? 'text-rose-600' : 'text-slate-900'}`}>
            {context.currency} {totalSpent.toLocaleString()}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Remaining Buffer</span>
          <span className={`text-base font-bold ${remainingBuffer < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {context.currency} {remainingBuffer.toLocaleString()}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Per-Guest Cost</span>
          <span className="text-base font-bold text-slate-900">
            {context.currency} {perGuestCost.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Multi-Segment Visual Allocation Bar */}
      <div>
        <div className="flex justify-between items-center text-xs text-slate-500 mb-1.5 font-medium">
          <span>Allocation Distribution</span>
          <span>100% of {context.currency} {context.totalBudget.toLocaleString()}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Budget Allocation Distribution"
          className="h-3 w-full rounded-full bg-slate-100 flex overflow-hidden shadow-inner"
        >
          {categories.map((cat, i) => (
            <div
              key={cat.id}
              style={{ width: `${Math.max(cat.percentage, 0.5)}%` }}
              className={`${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} transition-all duration-300 relative group`}
              title={`${cat.name}: ${cat.percentage}% (${context.currency} ${cat.allocatedAmount.toLocaleString()})`}
            />
          ))}
        </div>
      </div>

      {/* Category List */}
      <div className="space-y-3">
        {categories.map((cat, i) => {
          const isOverbudget = cat.actualSpent > cat.allocatedAmount;
          return (
            <div
              key={cat.id}
              className={`p-4 rounded-xl border transition-all ${
                cat.isLocked
                  ? 'bg-slate-50/80 border-slate-300'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Name, Priority, & Rationale */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`} />
                    <h3 className="text-sm font-bold text-slate-900">{cat.name}</h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        cat.priority === 'essential'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : cat.priority === 'important'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {cat.priority}
                    </span>
                    {cat.isLocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <Lock className="h-2.5 w-2.5" /> Locked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{cat.rationale}</p>
                </div>

                {/* Controls: Slider, Number input, Actual Spent, Lock toggle */}
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  {/* Slider & Allocated Input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max={context.totalBudget}
                      step={Math.max(100, Math.round(context.totalBudget / 200))}
                      value={cat.allocatedAmount}
                      onChange={(e) => onUpdateCategoryAmount(cat.id, Number(e.target.value))}
                      aria-label={`${cat.name} budget allocation slider`}
                      className="w-24 sm:w-32 accent-indigo-600 cursor-pointer"
                    />
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900">
                        {context.currency} {cat.allocatedAmount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">{cat.percentage}%</div>
                    </div>
                  </div>

                  {/* Actual Spent Input */}
                  <div className="w-24">
                    <label htmlFor={`spent-${cat.id}`} className="sr-only">
                      Actual Spent on {cat.name}
                    </label>
                    <input
                      id={`spent-${cat.id}`}
                      type="number"
                      min="0"
                      value={cat.actualSpent || ''}
                      onChange={(e) => onUpdateActualSpent(cat.id, Math.max(0, Number(e.target.value)))}
                      placeholder="Actual"
                      className={`w-full px-2 py-1 text-xs rounded border text-right font-medium focus:outline-none focus:ring-1 ${
                        isOverbudget
                          ? 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-500'
                          : 'border-slate-200 bg-white text-slate-700 focus:ring-indigo-500'
                      }`}
                    />
                  </div>

                  {/* Lock/Unlock Toggle */}
                  <button
                    type="button"
                    onClick={() => onToggleLock(cat.id)}
                    aria-label={cat.isLocked ? `Unlock ${cat.name}` : `Lock ${cat.name}`}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      cat.isLocked
                        ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                        : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Overbudget Warning */}
              {isOverbudget && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    Overbudget: Actual spent exceeds allocation by {context.currency}{' '}
                    {(cat.actualSpent - cat.allocatedAmount).toLocaleString()}!
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
