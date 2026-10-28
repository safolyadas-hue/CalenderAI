import { useState, useEffect, useMemo, useCallback } from 'react';
import type { EventContext, EventPlan, EventType, BudgetCategory, TimelineMilestone, VendorItem, PersonalizedIdea } from './types/event';
import { PRESET_WEDDING, PRESET_BIRTHDAY, PRESET_COMMUNITY } from './data/presets';
import {
  calculateSmartBudget,
  rebalanceBudget,
  generateDynamicTimeline,
  generateVendorChecklist,
  generateContextualIdeas,
} from './engines/decisionEngine';
import { requestPersonalizedIdeas, type EngineSource } from './services/aiClient';

import { Header } from './components/Header';
import { ContextConfigurator } from './components/ContextConfigurator';
import { BudgetPlanner } from './components/BudgetPlanner';
import { TimelineScheduler } from './components/TimelineScheduler';
import { VendorChecklist } from './components/VendorChecklist';
import { PersonalizedIdeasHub } from './components/PersonalizedIdeasHub';
import { AICoPilotPanel } from './components/AICoPilotPanel';

const STORAGE_KEY = 'calenderai_active_plan_v1';

type ActiveTab = 'overview' | 'budget' | 'timeline' | 'vendors' | 'ideas_copilot' | 'all';

export default function App() {
  // Load initial context safely from localStorage or default to Wedding preset
  const [context, setContext] = useState<EventContext>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.context && parsed.context.id) {
          return parsed.context;
        }
      }
    } catch {
      // Ignore parse failure and fall back
    }
    return PRESET_WEDDING;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [engineSource, setEngineSource] = useState<EngineSource>('local_context_engine');

  // Decision Engine baseline computations
  const budgetComputation = useMemo(() => calculateSmartBudget(context), [context]);

  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>(() => budgetComputation.categories);
  const [timeline, setTimeline] = useState<TimelineMilestone[]>(() => generateDynamicTimeline(context));
  const [vendors, setVendors] = useState<VendorItem[]>(() => generateVendorChecklist(context));
  const [ideas, setIdeas] = useState<PersonalizedIdea[]>(() => generateContextualIdeas(context));

  // Sync budget when context changes (unless locked manually)
  useEffect(() => {
    setBudgetCategories(budgetComputation.categories);
    setTimeline(generateDynamicTimeline(context));
    setVendors(generateVendorChecklist(context));
    setIdeas(generateContextualIdeas(context));
  }, [context.eventType, context.eventDate, context.totalBudget, context.cityTier, context.setting]);

  // Days until event calculation
  const daysUntilEvent = useMemo(() => {
    const target = new Date(context.eventDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }, [context.eventDate]);

  // Persist state to localStorage
  useEffect(() => {
    try {
      const stateToSave = {
        context,
        budgetCategories,
        timeline,
        vendors,
        ideas,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Storage quota or privacy mode error
    }
  }, [context, budgetCategories, timeline, vendors, ideas]);

  // Active Plan assembly
  const activePlan: EventPlan = useMemo(
    () => ({
      context,
      budgetCategories,
      timeline,
      vendors,
      ideas,
      riskAlerts: budgetComputation.riskAlerts,
      efficiencyScore: budgetComputation.efficiencyScore,
    }),
    [context, budgetCategories, timeline, vendors, ideas, budgetComputation]
  );

  // Vertical theme accents
  const verticalAccent = useMemo(() => {
    switch (context.eventType) {
      case 'wedding':
        return {
          banner: 'from-indigo-600 via-indigo-700 to-violet-800',
          pill: 'bg-indigo-600',
          text: 'text-indigo-600',
          border: 'border-indigo-200',
        };
      case 'birthday':
        return {
          banner: 'from-rose-500 via-rose-600 to-amber-600',
          pill: 'bg-rose-600',
          text: 'text-rose-600',
          border: 'border-rose-200',
        };
      case 'community':
        return {
          banner: 'from-emerald-600 via-teal-700 to-slate-800',
          pill: 'bg-emerald-600',
          text: 'text-emerald-600',
          border: 'border-emerald-200',
        };
    }
  }, [context.eventType]);

  // Handlers
  const handleSelectType = useCallback((type: EventType) => {
    if (type === 'wedding') setContext(PRESET_WEDDING);
    else if (type === 'birthday') setContext(PRESET_BIRTHDAY);
    else setContext(PRESET_COMMUNITY);
  }, []);

  const handleSelectPreset = useCallback((preset: EventContext) => {
    setContext(preset);
  }, []);

  const handleReset = useCallback(() => {
    setContext(PRESET_WEDDING);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Budget Handlers
  const handleUpdateCategoryAmount = useCallback(
    (categoryId: string, newAmount: number) => {
      setBudgetCategories((prev) => rebalanceBudget(prev, context.totalBudget, categoryId, newAmount));
    },
    [context.totalBudget]
  );

  const handleToggleLock = useCallback((categoryId: string) => {
    setBudgetCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, isLocked: !c.isLocked } : c))
    );
  }, []);

  const handleUpdateActualSpent = useCallback((categoryId: string, spent: number) => {
    setBudgetCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, actualSpent: spent } : c))
    );
  }, []);

  const handleResetToSmartDefaults = useCallback(() => {
    setBudgetCategories(budgetComputation.categories);
  }, [budgetComputation]);

  // Timeline Handlers
  const handleToggleComplete = useCallback((id: string) => {
    setTimeline((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m))
    );
  }, []);

  const handleAddMilestone = useCallback(
    (milestone: Omit<TimelineMilestone, 'id' | 'completed'>) => {
      const newM: TimelineMilestone = {
        ...milestone,
        id: `tl_${Date.now()}`,
        completed: false,
      };
      setTimeline((prev) => [newM, ...prev]);
    },
    []
  );

  // Vendor Handlers
  const handleUpdateVendorStatus = useCallback((id: string, status: VendorItem['status']) => {
    setVendors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status } : v))
    );
  }, []);

  const handleUpdateActualQuoted = useCallback((id: string, quoted: number) => {
    setVendors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, actualQuoted: quoted } : v))
    );
  }, []);

  const handleToggleContractItem = useCallback((vendorId: string, checklistId: string) => {
    setVendors((prev) =>
      prev.map((v) => {
        if (v.id !== vendorId) return v;
        return {
          ...v,
          contractChecklist: v.contractChecklist.map((c) =>
            c.id === checklistId ? { ...c, checked: !c.checked } : c
          ),
        };
      })
    );
  }, []);

  const handleAddVendor = useCallback((vendor: Omit<VendorItem, 'id'>) => {
    const newV: VendorItem = {
      ...vendor,
      id: `vnd_${Date.now()}`,
    };
    setVendors((prev) => [newV, ...prev]);
  }, []);

  // Ideas Handler
  const handleRegenerateIdeas = useCallback(async () => {
    setIsGeneratingIdeas(true);
    try {
      const res = await requestPersonalizedIdeas(context);
      setIdeas(res.ideas);
      setEngineSource(res.source);
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [context]);

  // Plan Export (JSON or Markdown)
  const handleExport = useCallback(
    (format: 'json' | 'md') => {
      const titleSlug = context.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (format === 'json') {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activePlan, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `${titleSlug}-plan.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      } else {
        const md = `# CalenderAI Event Plan: ${context.title}
**Event Type:** ${context.eventType.toUpperCase()} | **Target Date:** ${context.eventDate} (${daysUntilEvent} days remaining)
**Guest Count:** ${context.guestCount} | **Total Budget:** ${context.currency} ${context.totalBudget.toLocaleString()}
**City Tier:** ${context.cityTier} | **Venue Setting:** ${context.setting} | **Theme:** ${context.culturalTheme}
**Efficiency Score:** ${activePlan.efficiencyScore}/100

---

## 💰 Smart Budget Allocation
${budgetCategories.map((c) => `- **${c.name}**: ${context.currency} ${c.allocatedAmount.toLocaleString()} (${c.percentage}%) [${c.priority.toUpperCase()}]${c.actualSpent ? ` | Actual Spent: ${context.currency} ${c.actualSpent.toLocaleString()}` : ''}`).join('\n')}

---

## 🗓️ Planning Milestones
${timeline.map((m) => `- [${m.completed ? 'x' : ' '}] **${m.dueDate}** (${m.daysBeforeEvent}d before): **${m.title}** [${m.phase}] - ${m.description}${m.dependencyWarning ? `\n  - ⚠️ *${m.dependencyWarning}*` : ''}`).join('\n')}

---

## 🤝 Vendor Pipeline & Contracts
${vendors.map((v) => `### ${v.roleName} (${v.category}) - Status: ${v.status.toUpperCase()}
- **Est. Cost Range:** ${context.currency} ${v.estimatedCostMin.toLocaleString()} - ${context.currency} ${v.estimatedCostMax.toLocaleString()}
${v.actualQuoted ? `- **Actual Quoted:** ${context.currency} ${v.actualQuoted.toLocaleString()}\n` : ''}- **Contract Checklist:**
${v.contractChecklist.map((c) => `  - [${c.checked ? 'x' : ' '}] ${c.label}`).join('\n')}
- **Vetting Questions:**
${v.questionsToAsk.map((q) => `  - ${q}`).join('\n')}`).join('\n\n')}

---

## 💡 Personalized Creative Ideas
${ideas.map((i) => `### ${i.title} (${i.category}) [${i.costTier.toUpperCase()} COST]
${i.description}
- **Impact:** ${i.estimatedImpact}
- **Context Fit:** ${i.whyItFitsContext}`).join('\n\n')}
`;
        const dataStr = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `${titleSlug}-checklist.md`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    },
    [activePlan, context, budgetCategories, timeline, vendors, ideas, daysUntilEvent]
  );

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'all', label: 'All Modules' },
    { id: 'overview', label: 'Overview & Context' },
    { id: 'budget', label: 'Smart Budget' },
    { id: 'timeline', label: 'Dynamic Timeline' },
    { id: 'vendors', label: 'Vendor Checklist' },
    { id: 'ideas_copilot', label: 'AI Ideas & Co-Pilot' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header
        currentType={context.eventType}
        onSelectType={handleSelectType}
        onSelectPreset={handleSelectPreset}
        onExport={handleExport}
        onReset={handleReset}
        engineSource={engineSource}
        activePlan={activePlan}
      />

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 focus:outline-none">
        {/* Contextual Vertical Accent Banner */}
        <div className={`p-4 rounded-2xl bg-gradient-to-r ${verticalAccent.banner} text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                {context.eventType.toUpperCase()} PLANNER
              </span>
              <span className="text-xs font-semibold text-white/90">
                {daysUntilEvent} Days Until Event
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mt-1 tracking-tight">
              {context.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-right">
              <span className="text-[10px] uppercase font-bold text-white/80 block">Budget</span>
              <span className="text-sm font-bold text-white">
                {context.currency} {context.totalBudget.toLocaleString()}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-right">
              <span className="text-[10px] uppercase font-bold text-white/80 block">Efficiency</span>
              <span className="text-sm font-bold text-white">
                {budgetComputation.efficiencyScore}/100
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modules Rendering */}
        <div className="space-y-6">
          {(activeTab === 'all' || activeTab === 'overview') && (
            <ContextConfigurator
              context={context}
              onChange={setContext}
              efficiencyScore={budgetComputation.efficiencyScore}
              riskAlerts={budgetComputation.riskAlerts}
            />
          )}

          {(activeTab === 'all' || activeTab === 'budget') && (
            <BudgetPlanner
              context={context}
              categories={budgetCategories}
              onUpdateCategoryAmount={handleUpdateCategoryAmount}
              onToggleLock={handleToggleLock}
              onUpdateActualSpent={handleUpdateActualSpent}
              onResetToSmartDefaults={handleResetToSmartDefaults}
            />
          )}

          {(activeTab === 'all' || activeTab === 'timeline') && (
            <TimelineScheduler
              milestones={timeline}
              daysUntilEvent={daysUntilEvent}
              onToggleComplete={handleToggleComplete}
              onAddMilestone={handleAddMilestone}
            />
          )}

          {(activeTab === 'all' || activeTab === 'vendors') && (
            <VendorChecklist
              vendors={vendors}
              currency={context.currency}
              onUpdateVendorStatus={handleUpdateVendorStatus}
              onUpdateActualQuoted={handleUpdateActualQuoted}
              onToggleContractItem={handleToggleContractItem}
              onAddVendor={handleAddVendor}
            />
          )}

          {(activeTab === 'all' || activeTab === 'ideas_copilot') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PersonalizedIdeasHub
                ideas={ideas}
                onRegenerate={handleRegenerateIdeas}
                isLoading={isGeneratingIdeas}
              />
              <AICoPilotPanel
                context={context}
                efficiencyScore={budgetComputation.efficiencyScore}
                daysUntilEvent={daysUntilEvent}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div>
            <strong>CalenderAI</strong> — GenAI Event & Milestone Planning Assistant. Built for PromptWars Virtual.
          </div>
          <div className="flex items-center gap-4">
            <span>WCAG 2.1 AA Compliant</span>
            <span>Client Security Guard Active</span>
            <span>Total Bundle: &lt; 300 KB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
