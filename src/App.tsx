import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type {
  EventContext,
  EventPlan,
  EventType,
  BudgetCategory,
  TimelineMilestone,
  VendorItem,
  PersonalizedIdea,
} from './types/event';
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

type ActiveTab = 'overview' | 'budget' | 'timeline' | 'vendors' | 'ideas_copilot';

const WORKSPACE_TABS: {
  id: ActiveTab;
  step: string;
  label: string;
  subtitle: string;
}[] = [
    {
      id: 'overview',
      step: '01',
      label: 'Event Setup',
      subtitle: 'Parameters & Theme',
    },
    {
      id: 'budget',
      step: '02',
      label: 'Smart Budget',
      subtitle: 'Allocation & Locks',
    },
    {
      id: 'timeline',
      step: '03',
      label: 'Timeline & Sprint',
      subtitle: 'Milestones & Urgency',
    },
    {
      id: 'vendors',
      step: '04',
      label: 'Vendor Checklist',
      subtitle: 'Quotes & Contracts',
    },
    {
      id: 'ideas_copilot',
      step: '05',
      label: 'AI Studio & Co-Pilot',
      subtitle: 'Gemini 3.8 Assistant',
    },
  ];

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

  // Default to clean single-tab 'overview' view instead of stacking everything
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [engineSource, setEngineSource] = useState<EngineSource>('local_context_engine');

  // Decision Engine baseline computations
  const budgetComputation = useMemo(() => calculateSmartBudget(context), [context]);

  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>(
    () => budgetComputation.categories
  );
  const [timeline, setTimeline] = useState<TimelineMilestone[]>(() =>
    generateDynamicTimeline(context)
  );
  const [vendors, setVendors] = useState<VendorItem[]>(() =>
    generateVendorChecklist(context)
  );
  const [ideas, setIdeas] = useState<PersonalizedIdea[]>(() =>
    generateContextualIdeas(context)
  );

  // Sync budget when context changes
  useEffect(() => {
    setBudgetCategories(budgetComputation.categories);
    setTimeline(generateDynamicTimeline(context));
    setVendors(generateVendorChecklist(context));
    setIdeas(generateContextualIdeas(context));
  }, [
    context.eventType,
    context.eventDate,
    context.totalBudget,
    context.cityTier,
    context.setting,
  ]);

  // Auto-sync engine source badge with Netlify AI Serverless on mount (run once)
  const initialProbeDone = useRef(false);
  useEffect(() => {
    if (initialProbeDone.current) return;
    initialProbeDone.current = true;
    let isMounted = true;
    requestPersonalizedIdeas(context)
      .then((res) => {
        if (isMounted) {
          setIdeas(res.ideas);
          setEngineSource(res.source);
        }
      })
      .catch(() => {
        // Silently retain fallback on error
      });
    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          lightBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        };
      case 'birthday':
        return {
          banner: 'from-rose-500 via-rose-600 to-amber-600',
          pill: 'bg-rose-600',
          text: 'text-rose-600',
          border: 'border-rose-200',
          lightBg: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'community':
        return {
          banner: 'from-emerald-600 via-teal-700 to-slate-800',
          pill: 'bg-emerald-600',
          text: 'text-emerald-600',
          border: 'border-emerald-200',
          lightBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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

  const handleCreateCustomBlankEvent = useCallback(() => {
    const sixtyDaysOut = new Date();
    sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);
    const isoDate = sixtyDaysOut.toISOString().split('T')[0];

    setContext({
      id: `custom_${Date.now()}`,
      title: 'My Custom Celebration',
      eventType: context.eventType,
      eventDate: isoDate,
      guestCount: 150,
      totalBudget: context.currency === 'INR' ? 500000 : 10000,
      currency: context.currency,
      cityTier: 'tier2',
      setting: 'indoor',
      culturalTheme: 'Modern Minimalist & Warm Lighting',
      dietaryPreferences: ['Vegetarian', 'Custom Menu'],
      priorityFocus: 'Guest Experience & Smooth Logistics',
    });
    setActiveTab('overview');
  }, [context.eventType, context.currency]);

  const handleReset = useCallback(() => {
    setContext(PRESET_WEDDING);
    setActiveTab('overview');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Budget Handlers
  const handleUpdateCategoryAmount = useCallback(
    (categoryId: string, newAmount: number) => {
      setBudgetCategories((prev) =>
        rebalanceBudget(prev, context.totalBudget, categoryId, newAmount)
      );
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
  const handleUpdateVendorStatus = useCallback(
    (id: string, status: VendorItem['status']) => {
      setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
    },
    []
  );

  const handleUpdateActualQuoted = useCallback((id: string, quoted: number) => {
    setVendors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, actualQuoted: quoted } : v))
    );
  }, []);

  const handleToggleContractItem = useCallback(
    (vendorId: string, checklistId: string) => {
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
    },
    []
  );

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
        const dataStr =
          'data:text/json;charset=utf-8,' +
          encodeURIComponent(JSON.stringify(activePlan, null, 2));
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

## Smart Budget Allocation
${budgetCategories
            .map(
              (c) =>
                `- **${c.name}**: ${context.currency} ${c.allocatedAmount.toLocaleString()} (${c.percentage}%) [${c.priority.toUpperCase()}]${c.actualSpent
                  ? ` | Actual Spent: ${context.currency} ${c.actualSpent.toLocaleString()}`
                  : ''
                }`
            )
            .join('\n')}

---

## Planning Milestones
${timeline
            .map(
              (m) =>
                `- [${m.completed ? 'x' : ' '}] **${m.dueDate}** (${m.daysBeforeEvent}d before): **${m.title}** [${m.phase}] - ${m.description}${m.dependencyWarning ? `\n  - *Warning: ${m.dependencyWarning}*` : ''
                }`
            )
            .join('\n')}

---

## Vendor & Compliance Checklist
${vendors
            .map(
              (v) =>
                `- **${v.category}** (${v.status.toUpperCase()}): Est. ${context.currency} ${v.estimatedCost.toLocaleString()}`
            )
            .join('\n')}

---

## Personalized Ideas
${ideas.map((i) => `- **${i.title}** (${i.category}): ${i.description} [${i.estimatedCostImpact}]`).join('\n')}
`;
        const dataStr = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `${titleSlug}-plan.md`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    },
    [activePlan, budgetCategories, context, daysUntilEvent, ideas, timeline, vendors]
  );

  // Quick helper for step navigation
  const currentTabIndex = WORKSPACE_TABS.findIndex((t) => t.id === activeTab);
  const prevTab = currentTabIndex > 0 ? WORKSPACE_TABS[currentTabIndex - 1] : null;
  const nextTab =
    currentTabIndex < WORKSPACE_TABS.length - 1 ? WORKSPACE_TABS[currentTabIndex + 1] : null;

  const completedTasksCount = timeline.filter((m) => m.completed).length;
  const bookedVendorsCount = vendors.filter(
    (v) => v.status === 'booked' || v.status === 'paid'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* WCAG 2.1 AA Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Top Application Header */}
      <Header
        activeType={context.eventType}
        onSelectType={handleSelectType}
        onSelectPreset={handleSelectPreset}
        onExport={handleExport}
        onReset={handleReset}
        engineSource={engineSource}
        efficiencyScore={activePlan.efficiencyScore}
      />

      {/* Main Single-Tab Workspace */}
      <main
        id="main-content"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
      >
        {/* Compact Hero Banner + Custom Event Action */}
        <section
          aria-label="Active Event Summary"
          className={`rounded-2xl bg-gradient-to-r ${verticalAccent.banner} text-white p-5 sm:p-6 shadow-md transition-all`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-xs">
                  {context.eventType} Blueprint
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-black/20">
                  {context.setting.toUpperCase()} • {context.cityTier.toUpperCase()}
                </span>
                {daysUntilEvent <= 30 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                    ⚡ Accelerated Sprint ({daysUntilEvent}d left)
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {context.title}
              </h1>
              <p className="text-xs sm:text-sm text-white/85 max-w-2xl">
                Theme: <span className="font-semibold text-white">{context.culturalTheme}</span> •{' '}
                Priority: <span className="font-semibold text-white">{context.priorityFocus}</span>
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCreateCustomBlankEvent}
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-xs transition cursor-pointer"
              >
                ✨ Start Custom Blank Event
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ideas_copilot')}
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 transition cursor-pointer"
              >
                💬 Ask AI Co-Pilot
              </button>
            </div>
          </div>

          {/* 4-Metric KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/15">
            <div className="bg-black/15 rounded-xl px-3.5 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-white/70">Total Budget</p>
              <p className="text-sm sm:text-base font-bold mt-0.5">
                {context.currency} {context.totalBudget.toLocaleString()}
              </p>
              <p className="text-[11px] text-white/75">
                {context.currency} {budgetComputation.perGuestCost.toLocaleString()} / guest
              </p>
            </div>

            <div className="bg-black/15 rounded-xl px-3.5 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-white/70">Guest Capacity</p>
              <p className="text-sm sm:text-base font-bold mt-0.5">{context.guestCount} Guests</p>
              <p className="text-[11px] text-white/75">Target: {context.eventDate}</p>
            </div>

            <div className="bg-black/15 rounded-xl px-3.5 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-white/70">Milestone Progress</p>
              <p className="text-sm sm:text-base font-bold mt-0.5">
                {completedTasksCount} / {timeline.length} Done
              </p>
              <div
                role="progressbar"
                aria-valuenow={
                  timeline.length > 0
                    ? Math.round((completedTasksCount / timeline.length) * 100)
                    : 0
                }
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Timeline completion progress"
                className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mt-1.5"
              >
                <div
                  className="h-full bg-emerald-400 transition-all duration-300"
                  style={{
                    width: `${timeline.length > 0
                        ? Math.round((completedTasksCount / timeline.length) * 100)
                        : 0
                      }%`,
                  }}
                />
              </div>
            </div>

            <div className="bg-black/15 rounded-xl px-3.5 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-white/70">Vendors Locked</p>
              <p className="text-sm sm:text-base font-bold mt-0.5">
                {bookedVendorsCount} / {vendors.length} Booked
              </p>
              <p className="text-[11px] text-white/75">
                Efficiency: {activePlan.efficiencyScore}/100
              </p>
            </div>
          </div>
        </section>

        {/* Clean 5-Tab Segmented Navigation Bar */}
        <nav
          aria-label="Workspace Modules"
          className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-2 sm:grid-cols-5 gap-2"
        >
          {WORKSPACE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-start px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer border ${isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50/70 text-slate-700 border-transparent hover:bg-slate-100 hover:border-slate-200'
                  }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                      }`}
                  >
                    Step {tab.step}
                  </span>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
                  )}
                </div>
                <span className="text-sm font-bold mt-1.5 leading-snug">{tab.label}</span>
                <span
                  className={`text-[11px] mt-0.5 line-clamp-1 ${isActive ? 'text-slate-300' : 'text-slate-500'
                    }`}
                >
                  {tab.subtitle}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Active Risk Alerts Strip (Only shows if there are active warnings) */}
        {budgetComputation.riskAlerts.length > 0 && activeTab !== 'ideas_copilot' && (
          <div
            role="region"
            aria-label="Planning Risk Alerts"
            className="bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          >
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-bold uppercase tracking-wider text-amber-800">
                ⚠️ Active Decision Engine Advisories ({budgetComputation.riskAlerts.length})
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {budgetComputation.riskAlerts.slice(0, 2).map((alert, idx) => (
                  <li key={idx}>{alert}</li>
                ))}
              </ul>
            </div>
            {activeTab !== 'budget' && (
              <button
                type="button"
                onClick={() => setActiveTab('budget')}
                className="self-start sm:self-center shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-900 text-white hover:bg-amber-800 transition cursor-pointer"
              >
                Inspect in Budget →
              </button>
            )}
          </div>
        )}

        {/* Strictly Single-Tab Content Area (Zero Clutter) */}
        <div className="min-h-[480px]">
          {activeTab === 'overview' && (
            <div className="max-w-4xl mx-auto">
              <ContextConfigurator context={context} onChange={setContext} />
            </div>
          )}

          {activeTab === 'budget' && (
            <div className="max-w-5xl mx-auto">
              <BudgetPlanner
                categories={budgetCategories}
                totalBudget={context.totalBudget}
                guestCount={context.guestCount}
                currency={context.currency}
                riskAlerts={budgetComputation.riskAlerts}
                onUpdateCategoryAmount={handleUpdateCategoryAmount}
                onToggleLock={handleToggleLock}
                onUpdateActualSpent={handleUpdateActualSpent}
                onResetToSmartDefaults={handleResetToSmartDefaults}
              />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="max-w-5xl mx-auto">
              <TimelineScheduler
                milestones={timeline}
                daysUntilEvent={daysUntilEvent}
                onToggleComplete={handleToggleComplete}
                onAddMilestone={handleAddMilestone}
              />
            </div>
          )}

          {activeTab === 'vendors' && (
            <div className="max-w-5xl mx-auto">
              <VendorChecklist
                vendors={vendors}
                currency={context.currency}
                onUpdateStatus={handleUpdateVendorStatus}
                onUpdateActualQuoted={handleUpdateActualQuoted}
                onToggleContractItem={handleToggleContractItem}
                onAddVendor={handleAddVendor}
              />
            </div>
          )}

          {activeTab === 'ideas_copilot' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                <PersonalizedIdeasHub
                  ideas={ideas}
                  context={context}
                  isGenerating={isGeneratingIdeas}
                  engineSource={engineSource}
                  onRegenerateWithAI={handleRegenerateIdeas}
                />
              </div>
              <div className="lg:col-span-5 lg:sticky lg:top-6">
                <AICoPilotPanel
                  context={context}
                  plan={activePlan}
                  onSourceChange={setEngineSource}
                />
              </div>
            </div>
          )}
        </div>

        {/* Clean Step-by-Step Footer Navigation Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center justify-between shadow-xs">
          <div>
            {prevTab ? (
              <button
                type="button"
                onClick={() => setActiveTab(prevTab.id)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                ← Step {prevTab.step}: {prevTab.label}
              </button>
            ) : (
              <span className="text-xs text-slate-400 font-medium">
                Step 01 of 05 • Event Setup
              </span>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            {WORKSPACE_TABS.map((t) => (
              <span
                key={t.id}
                className={`h-2 rounded-full transition-all ${t.id === activeTab ? 'w-6 bg-slate-900' : 'w-2 bg-slate-200'
                  }`}
              />
            ))}
          </div>

          <div>
            {nextTab ? (
              <button
                type="button"
                onClick={() => setActiveTab(nextTab.id)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs"
              >
                Next: {nextTab.label} (Step {nextTab.step}) →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleExport('md')}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer shadow-xs"
              >
                📥 Export Complete Plan (.MD)
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>
            <strong>CalenderAI</strong> — Multi-Vertical Event & Milestone Planning Assistant
          </p>
          <p>Powered by Context Decision Engine & Gemini 3.8 Flash Serverless Architecture</p>
        </div>
      </footer>
    </div>
  );
}