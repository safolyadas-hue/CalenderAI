import { useState } from 'react';
import { Briefcase, ChevronDown, ChevronUp, Plus, FileText } from 'lucide-react';
import type { VendorItem, CurrencyCode } from '../types/event';

interface VendorChecklistProps {
  vendors: VendorItem[];
  currency: CurrencyCode;
  onUpdateVendorStatus: (id: string, status: VendorItem['status']) => void;
  onUpdateActualQuoted: (id: string, quoted: number) => void;
  onToggleContractItem: (vendorId: string, checklistId: string) => void;
  onAddVendor: (vendor: Omit<VendorItem, 'id'>) => void;
}

type StatusFilter = 'All' | VendorItem['status'];

export const VendorChecklist: React.FC<VendorChecklistProps> = ({
  vendors,
  currency,
  onUpdateVendorStatus,
  onUpdateActualQuoted,
  onToggleContractItem,
  onAddVendor,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('All');
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newRole, setNewRole] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newMin, setNewMin] = useState(5000);
  const [newMax, setNewMax] = useState(15000);

  const bookedCount = vendors.filter((v) => v.status === 'booked' || v.status === 'paid').length;

  const filteredVendors = selectedStatus === 'All'
    ? vendors
    : vendors.filter((v) => v.status === selectedStatus);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.trim()) return;

    onAddVendor({
      roleName: newRole.trim(),
      category: newCategory.trim() || 'General Services',
      estimatedCostMin: newMin,
      estimatedCostMax: newMax,
      status: 'shortlisted',
      questionsToAsk: ['What is your cancellation & rescheduling policy?', 'Are travel and equipment fees included?'],
      contractChecklist: [
        { id: `c_${Date.now()}_1`, label: 'Written contract signed', checked: false },
        { id: `c_${Date.now()}_2`, label: 'Advance deposit confirmed', checked: false },
      ],
      notes: '',
    });

    setNewRole('');
    setNewCategory('');
    setShowAddForm(false);
  };

  const statusOptions: VendorItem['status'][] = ['shortlisted', 'contacted', 'booked', 'paid'];

  return (
    <section aria-labelledby="vendor-heading" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header & Status Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="vendor-heading" className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              Vendor & Contract Pipeline
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {bookedCount} of {vendors.length} Secured
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track quotes, vetting questions, and essential compliance clauses before signing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors self-start sm:self-auto shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {showAddForm ? 'Cancel' : 'Add Vendor'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(['All', 'shortlisted', 'contacted', 'booked', 'paid'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setSelectedStatus(status)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
              selectedStatus === status
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Inline Add Vendor Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">Add Custom Vendor Provider</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="vendor-role" className="block text-[11px] font-semibold text-slate-700 mb-1">Role</label>
              <input
                id="vendor-role"
                type="text"
                required
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="e.g. Drone Videographer"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="vendor-cat" className="block text-[11px] font-semibold text-slate-700 mb-1">Category</label>
              <input
                id="vendor-cat"
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Media"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="vendor-min" className="block text-[11px] font-semibold text-slate-700 mb-1">Min Est ({currency})</label>
              <input
                id="vendor-min"
                type="number"
                value={newMin}
                onChange={(e) => setNewMin(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="vendor-max" className="block text-[11px] font-semibold text-slate-700 mb-1">Max Est ({currency})</label>
              <input
                id="vendor-max"
                type="number"
                value={newMax}
                onChange={(e) => setNewMax(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
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
            <button type="submit" className="px-4 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md">
              Save Vendor
            </button>
          </div>
        </form>
      )}

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredVendors.map((vendor) => {
          const isExpanded = expandedVendorId === vendor.id;
          const completedChecks = vendor.contractChecklist.filter((c) => c.checked).length;

          return (
            <div key={vendor.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{vendor.roleName}</h3>
                    <span className="text-xs text-slate-400 font-medium">{vendor.category}</span>
                  </div>
                  <select
                    aria-label={`Status for ${vendor.roleName}`}
                    value={vendor.status}
                    onChange={(e) => onUpdateVendorStatus(vendor.id, e.target.value as VendorItem['status'])}
                    className="text-xs font-bold uppercase rounded-lg px-2.5 py-1 border border-slate-200 bg-slate-50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pricing summary */}
                <div className="mt-3 flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Est. Range</span>
                    <span className="font-semibold text-slate-700">
                      {currency} {vendor.estimatedCostMin.toLocaleString()} – {vendor.estimatedCostMax.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <label htmlFor={`quoted-${vendor.id}`} className="text-[10px] uppercase font-bold text-slate-400 block">
                      Actual Quoted
                    </label>
                    <input
                      id={`quoted-${vendor.id}`}
                      type="number"
                      placeholder="Add quote"
                      value={vendor.actualQuoted || ''}
                      onChange={(e) => onUpdateActualQuoted(vendor.id, Number(e.target.value))}
                      className="w-24 text-right px-1.5 py-0.5 text-xs bg-white border border-slate-200 rounded font-bold text-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Contract Checklist progress summary */}
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    Contract Clauses: {completedChecks}/{vendor.contractChecklist.length} verified
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedVendorId(isExpanded ? null : vendor.id)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-0.5 text-xs"
                  >
                    {isExpanded ? 'Hide Details' : 'View Checklist'}
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {/* Expanded Checklist & Questions */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                  {/* Contract checklist */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Compliance & Contract Items
                    </span>
                    <div className="space-y-1">
                      {vendor.contractChecklist.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => onToggleContractItem(vendor.id, item.id)}
                            className="h-3.5 w-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <span className={item.checked ? 'line-through text-slate-400' : ''}>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Questions to ask */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Key Vetting Questions
                    </span>
                    <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                      {vendor.questionsToAsk.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
