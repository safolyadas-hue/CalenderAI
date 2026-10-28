import { useState } from 'react';
import { Lightbulb, RotateCw, Sparkles, TrendingUp } from 'lucide-react';
import type { PersonalizedIdea } from '../types/event';

interface PersonalizedIdeasHubProps {
  ideas: PersonalizedIdea[];
  onRegenerate: () => void;
  isLoading: boolean;
}

type CategoryFilter = 'All' | PersonalizedIdea['category'];

export const PersonalizedIdeasHub: React.FC<PersonalizedIdeasHubProps> = ({
  ideas,
  onRegenerate,
  isLoading,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');

  const categories: CategoryFilter[] = [
    'All',
    'Theme & Decor',
    'Food & Beverage',
    'Guest Experience',
    'Sustainability & Cost-Saving',
  ];

  const filteredIdeas = selectedCategory === 'All'
    ? ideas
    : ideas.filter((idea) => idea.category === selectedCategory);

  return (
    <section aria-labelledby="ideas-heading" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header & Regenerate */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 id="ideas-heading" className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            Contextual AI Ideas Hub
          </h2>
          <p className="text-xs text-slate-500">
            Tailored creative concepts referencing your exact theme, dietary accommodations, guest size, and setting.
          </p>
        </div>

        <button
          type="button"
          onClick={onRegenerate}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors self-start sm:self-auto shadow-sm"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {isLoading ? 'Synthesizing...' : 'Regenerate Ideas'}
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Ideas Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredIdeas.map((idea) => (
          <div
            key={idea.id}
            className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
          >
            <div>
              {/* Category & Cost Badge */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  {idea.category}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    idea.costTier === 'low'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : idea.costTier === 'medium'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {idea.costTier} Cost
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-sm font-bold text-slate-900 mb-1">{idea.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{idea.description}</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              {/* Estimated Impact */}
              <div className="flex items-start gap-1.5 text-xs text-slate-700 font-medium">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Impact:</strong> {idea.estimatedImpact}
                </span>
              </div>

              {/* Why It Fits Context Highlight Box */}
              <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 leading-snug">
                <div className="flex items-center gap-1 font-bold text-[11px] text-indigo-700 uppercase tracking-wider mb-0.5">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Why It Fits Your Context:
                </div>
                {idea.whyItFitsContext}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
