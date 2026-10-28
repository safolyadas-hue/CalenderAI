import { useState } from 'react';
import { ALL_PRESETS } from './data/presets';
import {
  calculateSmartBudget,
  generateDynamicTimeline,
  generateVendorChecklist,
  generateContextualIdeas,
} from './engines/decisionEngine';
import type { EventContext, EventPlan } from './types/event';

function generatePlan(context: EventContext): EventPlan {
  const budget = calculateSmartBudget(context);
  const timeline = generateDynamicTimeline(context);
  const vendors = generateVendorChecklist(context);
  const ideas = generateContextualIdeas(context);

  return {
    context,
    budgetCategories: budget.categories,
    timeline,
    vendors,
    ideas,
    riskAlerts: budget.riskAlerts,
    efficiencyScore: budget.efficiencyScore,
  };
}

export default function App() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [plan, setPlan] = useState<EventPlan | null>(null);

  const handleGenerate = () => {
    const ctx = ALL_PRESETS[selectedPreset].context;
    setPlan(generatePlan(ctx));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans">
      <header className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-indigo-700 mb-1">
          🗓️ CalenderAI — Diagnostic Shell
        </h1>
        <p className="text-slate-500 text-sm">
          Step 1 Verification: Decision Engine outputs for preset scenarios
        </p>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        {/* Preset Selector */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-lg font-semibold mb-3">Select a Preset Scenario</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            {ALL_PRESETS.map((p, i) => (
              <button
                key={p.context.id}
                onClick={() => setSelectedPreset(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPreset === i
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerate}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Generate Plan →
          </button>
        </section>

        {/* Results */}
        {plan && (
          <>
            {/* Efficiency Score & Risk Alerts */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Plan Overview</h2>
                <span
                  className={`text-2xl font-bold ${
                    plan.efficiencyScore >= 70
                      ? 'text-emerald-600'
                      : plan.efficiencyScore >= 50
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                >
                  {plan.efficiencyScore}/100
                </span>
              </div>
              {plan.riskAlerts.length > 0 && (
                <div className="space-y-2">
                  {plan.riskAlerts.map((alert, i) => (
                    <div
                      key={i}
                      className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2 text-sm"
                    >
                      {alert}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Budget Breakdown */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-lg font-semibold mb-3">Budget Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-2 pr-4 font-medium text-slate-500">Category</th>
                      <th className="py-2 pr-4 font-medium text-slate-500">%</th>
                      <th className="py-2 pr-4 font-medium text-slate-500">Allocated</th>
                      <th className="py-2 pr-4 font-medium text-slate-500">Priority</th>
                      <th className="py-2 font-medium text-slate-500">Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.budgetCategories.map((cat) => (
                      <tr key={cat.id} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-medium">{cat.name}</td>
                        <td className="py-2 pr-4">{cat.percentage}%</td>
                        <td className="py-2 pr-4">
                          {plan.context.currency}{' '}
                          {cat.allocatedAmount.toLocaleString()}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              cat.priority === 'essential'
                                ? 'bg-red-100 text-red-700'
                                : cat.priority === 'important'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {cat.priority}
                          </span>
                        </td>
                        <td className="py-2 text-slate-500 text-xs max-w-xs truncate">
                          {cat.rationale}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Timeline */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-lg font-semibold mb-3">Planning Timeline</h2>
              <div className="space-y-3">
                {plan.timeline.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50"
                  >
                    <div className="flex-shrink-0 w-20 text-xs text-slate-500">
                      {m.dueDate}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{m.title}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            m.priority === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : m.priority === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {m.priority}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700">
                          {m.phase}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{m.description}</p>
                      {m.dependencyWarning && (
                        <p className="text-xs text-amber-700 mt-1 font-medium">
                          {m.dependencyWarning}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Vendors */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-lg font-semibold mb-3">
                Vendor Checklist ({plan.vendors.length} vendors)
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {plan.vendors.map((v) => (
                  <div
                    key={v.id}
                    className="border border-slate-200 rounded-lg p-4"
                  >
                    <h3 className="font-medium text-sm">{v.roleName}</h3>
                    <p className="text-xs text-slate-500">{v.category}</p>
                    <p className="text-xs text-indigo-600 mt-1">
                      {plan.context.currency}{' '}
                      {v.estimatedCostMin.toLocaleString()} –{' '}
                      {v.estimatedCostMax.toLocaleString()}
                    </p>
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                        Questions to Ask
                      </p>
                      <ul className="text-xs text-slate-600 space-y-0.5">
                        {v.questionsToAsk.slice(0, 2).map((q, i) => (
                          <li key={i}>• {q}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                        Contract Checklist
                      </p>
                      <ul className="text-xs text-slate-600 space-y-0.5">
                        {v.contractChecklist.slice(0, 3).map((c) => (
                          <li key={c.id}>☐ {c.label}</li>
                        ))}
                        {v.contractChecklist.length > 3 && (
                          <li className="text-slate-400">
                            +{v.contractChecklist.length - 3} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Ideas */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-8">
              <h2 className="text-lg font-semibold mb-3">
                Personalized Ideas ({plan.ideas.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {plan.ideas.map((idea) => (
                  <div
                    key={idea.id}
                    className="border border-slate-200 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">
                        {idea.category}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          idea.costTier === 'low'
                            ? 'bg-green-100 text-green-700'
                            : idea.costTier === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {idea.costTier} cost
                      </span>
                    </div>
                    <h3 className="font-medium text-sm">{idea.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {idea.description}
                    </p>
                    <p className="text-xs text-emerald-600 mt-2 font-medium">
                      Impact: {idea.estimatedImpact}
                    </p>
                    <p className="text-xs text-indigo-600 mt-1 italic">
                      {idea.whyItFitsContext}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
