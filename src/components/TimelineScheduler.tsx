import { useState } from 'react';
import { Calendar, Clock, AlertTriangle, Plus, Zap } from 'lucide-react';
import type { TimelineMilestone } from '../types/event';

interface TimelineSchedulerProps {
  milestones: TimelineMilestone[];
  daysUntilEvent: number;
  onToggleComplete: (id: string) => void;
  onAddMilestone: (milestone: Omit<TimelineMilestone, 'id' | 'completed'>) => void;
}

type PhaseFilter = 'All' | TimelineMilestone['phase'];

export const TimelineScheduler: React.FC<TimelineSchedulerProps> = ({
  milestones,
  daysUntilEvent,
  onToggleComplete,
  onAddMilestone,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<PhaseFilter>('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDays, setNewDays] = useState(14);
  const [newPhase, setNewPhase] = useState<TimelineMilestone['phase']>('Logistics & Details');
  const [newPriority, setNewPriority] = useState<TimelineMilestone['priority']>('high');

  const isAccelerated = daysUntilEvent < 30;
  const completedCount = milestones.filter((m) => m.completed).length;
  const progressPct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  const filteredMilestones = selectedPhase === 'All'
    ? milestones
    : milestones.filter((m) => m.phase === selectedPhase);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + newDays);

    onAddMilestone({
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom planning task',
      daysBeforeEvent: newDays,
      dueDate: dueDate.toISOString().split('T')[0],
      phase: newPhase,
      priority: newPriority,
    });

    setNewTitle('');
    setNewDesc('');
    setShowAddForm(false);
  };

  const phases: PhaseFilter[] = [
    'All',
    'Conceptualization',
    'Vendor Booking',
    'Logistics & Details',
    'Final Week',
    'Event Day',
  ];

  return (
    <section aria-labelledby="timeline-heading" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header & Planning Horizon Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="timeline-heading" className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              Dynamic Milestone Timeline
            </h2>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isAccelerated
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {isAccelerated ? <Zap className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
              {isAccelerated ? `Accelerated Sprint (${daysUntilEvent} Days Left)` : `Standard Horizon (${daysUntilEvent} Days Left)`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-compressing milestone schedule based on target date. High-lead-time tasks trigger dependency warnings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors self-start sm:self-auto shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {showAddForm ? 'Cancel' : 'Add Milestone'}
        </button>
      </div>

      {/* Accessible Progress Bar */}
      <div>
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
          <span>Execution Progress</span>
          <span>{completedCount} of {milestones.length} Completed ({progressPct}%)</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Planning milestones completion progress"
          className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner"
        >
          <div
            style={{ width: `${progressPct}%` }}
            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
          />
        </div>
      </div>

      {/* Phase Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {phases.map((phase) => (
          <button
            key={phase}
            type="button"
            onClick={() => setSelectedPhase(phase)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedPhase === phase
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {phase}
          </button>
        ))}
      </div>

      {/* Inline Add Custom Milestone Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">Add Custom Planning Milestone</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="milestone-title" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Milestone Title
              </label>
              <input
                id="milestone-title"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Schedule Sound Check & Rehearsal"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="milestone-phase" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Phase
              </label>
              <select
                id="milestone-phase"
                value={newPhase}
                onChange={(e) => setNewPhase(e.target.value as TimelineMilestone['phase'])}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Conceptualization">Conceptualization</option>
                <option value="Vendor Booking">Vendor Booking</option>
                <option value="Logistics & Details">Logistics & Details</option>
                <option value="Final Week">Final Week</option>
                <option value="Event Day">Event Day</option>
              </select>
            </div>
            <div>
              <label htmlFor="milestone-priority" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Priority
              </label>
              <select
                id="milestone-priority"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TimelineMilestone['priority'])}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label htmlFor="milestone-desc" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Description
              </label>
              <input
                id="milestone-desc"
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Detailed instructions or context"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="milestone-days" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Days Before Event
              </label>
              <input
                id="milestone-days"
                type="number"
                min="0"
                value={newDays}
                onChange={(e) => setNewDays(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm"
            >
              Save Milestone
            </button>
          </div>
        </form>
      )}

      {/* Milestone Cards List */}
      <div className="space-y-2.5">
        {filteredMilestones.map((m) => (
          <div
            key={m.id}
            className={`p-3.5 rounded-xl border transition-all ${
              m.completed
                ? 'bg-slate-50/60 border-slate-200 opacity-75'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={m.completed}
                onChange={() => onToggleComplete(m.id)}
                aria-label={`Mark "${m.title}" as ${m.completed ? 'incomplete' : 'complete'}`}
                className="mt-1 h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`text-sm font-bold ${m.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                    {m.title}
                  </h4>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      m.priority === 'critical'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : m.priority === 'high'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {m.priority}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {m.phase}
                  </span>
                  <span className="text-xs text-slate-400 font-medium ml-auto">
                    Due: {m.dueDate} ({m.daysBeforeEvent}d before)
                  </span>
                </div>

                <p className="text-xs text-slate-500 mt-1">{m.description}</p>

                {/* Dependency Warning */}
                {m.dependencyWarning && (
                  <div className="mt-2 flex items-start gap-1.5 p-2 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{m.dependencyWarning}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
