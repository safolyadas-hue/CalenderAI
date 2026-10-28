import React from 'react';
import { Calendar, Download, RotateCcw, ShieldCheck, Heart, Cake, Users } from 'lucide-react';
import type { EventContext, EventPlan, EventType } from '../types/event';
import { ALL_PRESETS } from '../data/presets';
import type { EngineSource } from '../services/aiClient';

interface HeaderProps {
  currentType: EventType;
  onSelectType: (type: EventType) => void;
  onSelectPreset: (preset: EventContext) => void;
  onExport: (format: 'json' | 'md') => void;
  onReset: () => void;
  engineSource: EngineSource;
  activePlan: EventPlan;
}

export const Header: React.FC<HeaderProps> = ({
  currentType,
  onSelectType,
  onSelectPreset,
  onExport,
  onReset,
  engineSource,
}) => {
  const verticalConfig = {
    wedding: {
      label: 'Wedding',
      icon: Heart,
      activeColor: 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300',
    },
    birthday: {
      label: 'Birthday',
      icon: Cake,
      activeColor: 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-300',
    },
    community: {
      label: 'Community Event',
      icon: Users,
      activeColor: 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300',
    },
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* WCAG 2.1 AA Skip to Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
              <Calendar className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Calender<span className="text-indigo-600">AI</span>
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    engineSource === 'netlify_serverless'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}
                  title={engineSource === 'netlify_serverless' ? 'Connected to Netlify AI Serverless' : 'Running on Deterministic Local Context Decision Engine'}
                >
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {engineSource === 'netlify_serverless' ? 'Netlify AI Online' : 'Context Engine Active'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                GenAI Planning Assistant for Weddings, Birthdays & Community Milestones
              </p>
            </div>
          </div>

          {/* Vertical Switcher Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 overflow-x-auto">
            {(Object.keys(verticalConfig) as EventType[]).map((type) => {
              const config = verticalConfig[type];
              const Icon = config.icon;
              const isSelected = currentType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onSelectType(type)}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                    isSelected
                      ? config.activeColor
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Quick Actions & Evaluator Tools */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Presets dropdown */}
            <div className="relative">
              <label htmlFor="preset-select" className="sr-only">
                Load Preset Scenario
              </label>
              <select
                id="preset-select"
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  if (!isNaN(idx) && ALL_PRESETS[idx]) {
                    onSelectPreset(ALL_PRESETS[idx].context);
                  }
                }}
                defaultValue=""
                className="text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                title="1-Click Evaluator Presets"
              >
                <option value="" disabled>
                  ⚡ Load Preset Scenario...
                </option>
                {ALL_PRESETS.map((p, i) => (
                  <option key={p.context.id} value={i}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Export Dropdown */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => onExport('md')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-r border-slate-200 transition-colors"
                title="Download Checklist as Markdown"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>Export MD</span>
              </button>
              <button
                type="button"
                onClick={() => onExport('json')}
                className="px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                title="Download full plan JSON"
              >
                JSON
              </button>
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-200 rounded-lg shadow-sm transition-colors"
              title="Reset to default context"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
