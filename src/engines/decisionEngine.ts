import type {
  EventContext,
  BudgetCategory,
  TimelineMilestone,
  VendorItem,
  PersonalizedIdea,
} from '../types/event';

// ─── Helpers ───────────────────────────────────────────────────────────

/** Generates a simple unique ID */
function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Calculates days between today and a target date string (YYYY-MM-DD) */
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Formats a date object as ISO YYYY-MM-DD */
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Computes a due date by subtracting days from event date */
function dueDateFromEvent(eventDate: string, daysBefore: number): string {
  const d = new Date(eventDate + 'T00:00:00');
  d.setDate(d.getDate() - daysBefore);
  return formatDate(d);
}

/** Per-guest budget thresholds for risk alerts */
const PER_GUEST_THRESHOLDS: Record<string, Record<string, number>> = {
  wedding: { INR: 1500, USD: 45 },
  birthday: { INR: 600, USD: 20 },
  community: { INR: 300, USD: 10 },
};

// ─── Budget Engine ─────────────────────────────────────────────────────

interface BudgetTemplate {
  name: string;
  basePercentage: number;
  priority: 'essential' | 'important' | 'optional';
  rationale: string;
}

const WEDDING_BUDGET: BudgetTemplate[] = [
  { name: 'Venue & Decor', basePercentage: 30, priority: 'essential', rationale: 'The venue sets the tone for the entire celebration and is typically the largest fixed cost.' },
  { name: 'Catering & Beverages', basePercentage: 25, priority: 'essential', rationale: 'Quality food and service are the most remembered aspect of any wedding.' },
  { name: 'Photography & Video', basePercentage: 12, priority: 'important', rationale: 'Professional documentation preserves memories for a lifetime.' },
  { name: 'Attire & Grooming', basePercentage: 8, priority: 'important', rationale: 'Wedding attire is a core part of the experience for the couple.' },
  { name: 'Music & Entertainment', basePercentage: 7, priority: 'important', rationale: 'Live music or DJ sets keep the energy high and guests engaged.' },
  { name: 'Invitations & Stationery', basePercentage: 3, priority: 'optional', rationale: 'Sets expectations and theme before the event.' },
  { name: 'Transportation & Logistics', basePercentage: 5, priority: 'important', rationale: 'Smooth logistics prevent day-of stress.' },
  { name: 'Contingency Reserve', basePercentage: 10, priority: 'essential', rationale: 'A safety buffer for unexpected costs — industry best practice is 10-15%.' },
];

const BIRTHDAY_BUDGET: BudgetTemplate[] = [
  { name: 'Venue & Setup', basePercentage: 25, priority: 'essential', rationale: 'The venue and setup create the first impression for guests.' },
  { name: 'Catering & Cake', basePercentage: 30, priority: 'essential', rationale: 'Food, drinks, and a show-stopping cake are central to any birthday celebration.' },
  { name: 'Entertainment & Activities', basePercentage: 15, priority: 'important', rationale: 'Activities and entertainment keep all age groups engaged.' },
  { name: 'Decorations & Theme', basePercentage: 12, priority: 'important', rationale: 'Themed decorations bring the birthday vision to life.' },
  { name: 'Photography', basePercentage: 6, priority: 'optional', rationale: 'Captures candid moments and group photos.' },
  { name: 'Favors & Gifts', basePercentage: 4, priority: 'optional', rationale: 'Party favors leave a lasting impression on guests.' },
  { name: 'Contingency Reserve', basePercentage: 8, priority: 'essential', rationale: 'Buffer for last-minute additions or vendor overruns.' },
];

const COMMUNITY_BUDGET: BudgetTemplate[] = [
  { name: 'Venue & Infrastructure', basePercentage: 28, priority: 'essential', rationale: 'Community events need reliable infrastructure — seating, staging, power, and sanitation.' },
  { name: 'Catering & Refreshments', basePercentage: 22, priority: 'essential', rationale: 'Communal meals and refreshments drive attendance and satisfaction.' },
  { name: 'Sound & AV Equipment', basePercentage: 10, priority: 'important', rationale: 'Clear audio and visuals are critical for speeches, performances, and announcements.' },
  { name: 'Permits & Compliance', basePercentage: 8, priority: 'essential', rationale: 'Municipal permits, insurance, and safety compliance are non-negotiable for public events.' },
  { name: 'Marketing & Outreach', basePercentage: 7, priority: 'important', rationale: 'Promotion ensures turnout and community engagement.' },
  { name: 'Volunteer & Staff Coordination', basePercentage: 6, priority: 'important', rationale: 'Even volunteer-driven events need coordination supplies, badges, and communication tools.' },
  { name: 'Safety & Medical', basePercentage: 5, priority: 'essential', rationale: 'First aid stations and crowd safety measures are essential for large gatherings.' },
  { name: 'Activities & Programming', basePercentage: 6, priority: 'important', rationale: 'Workshops, performances, and activities drive engagement.' },
  { name: 'Contingency Reserve', basePercentage: 8, priority: 'essential', rationale: 'Buffer for weather contingencies, crowd overflow, or last-minute requirements.' },
];

function getBaseTemplate(eventType: string): BudgetTemplate[] {
  switch (eventType) {
    case 'wedding': return WEDDING_BUDGET.map((t) => ({ ...t }));
    case 'birthday': return BIRTHDAY_BUDGET.map((t) => ({ ...t }));
    case 'community': return COMMUNITY_BUDGET.map((t) => ({ ...t }));
    default: return WEDDING_BUDGET.map((t) => ({ ...t }));
  }
}

/**
 * Generates a smart, context-aware budget breakdown with risk alerts
 * and an efficiency score.
 */
export function calculateSmartBudget(context: EventContext): {
  categories: BudgetCategory[];
  riskAlerts: string[];
  efficiencyScore: number;
} {
  const templates = getBaseTemplate(context.eventType);
  const riskAlerts: string[] = [];

  // ── Dynamic shifts ───────────────────────────────────────────────────

  // Outdoor setting: add Weather Backup & Logistics category
  if (context.setting === 'outdoor') {
    const shiftAmount = 4;
    // Find categories to take from (non-essential, non-contingency)
    const donors = templates.filter(
      (t) => t.priority === 'optional' || t.priority === 'important'
    );
    if (donors.length > 0) {
      const perDonor = shiftAmount / donors.length;
      donors.forEach((d) => {
        d.basePercentage = Math.max(1, d.basePercentage - perDonor);
      });
    }
    templates.push({
      name: 'Weather Backup & Logistics',
      basePercentage: shiftAmount,
      priority: 'essential',
      rationale:
        'Outdoor events require waterproof tents, portable generators, drainage solutions, and weather monitoring services.',
    });
  }

  // Tier-1 metro: increase venue weight
  if (context.cityTier === 'tier1_metro') {
    const venueTemplate = templates.find((t) =>
      t.name.toLowerCase().includes('venue')
    );
    if (venueTemplate) {
      venueTemplate.basePercentage += 5;
      venueTemplate.rationale += ' Metro cities command premium venue pricing (+5% adjustment).';
      // Take from contingency slightly
      const contingency = templates.find((t) =>
        t.name.toLowerCase().includes('contingency')
      );
      if (contingency) {
        contingency.basePercentage = Math.max(5, contingency.basePercentage - 3);
      }
      // Take the remaining 2% from optional categories
      const optionals = templates.filter((t) => t.priority === 'optional');
      if (optionals.length > 0) {
        const perOptional = 2 / optionals.length;
        optionals.forEach((o) => {
          o.basePercentage = Math.max(1, o.basePercentage - perOptional);
        });
      }
    }
  }

  // ── Normalize percentages to exactly 100% ────────────────────────────

  const totalPct = templates.reduce((sum, t) => sum + t.basePercentage, 0);
  const normalizationFactor = 100 / totalPct;
  templates.forEach((t) => {
    t.basePercentage = Math.round(t.basePercentage * normalizationFactor * 100) / 100;
  });
  // Fix rounding: adjust largest category
  const roundedTotal = templates.reduce((sum, t) => sum + t.basePercentage, 0);
  const diff = 100 - roundedTotal;
  if (Math.abs(diff) > 0.001) {
    const largest = templates.reduce((a, b) =>
      a.basePercentage > b.basePercentage ? a : b
    );
    largest.basePercentage = Math.round((largest.basePercentage + diff) * 100) / 100;
  }

  // ── Build BudgetCategory array ───────────────────────────────────────

  const categories: BudgetCategory[] = templates.map((t) => ({
    id: uid('bud'),
    name: t.name,
    percentage: t.basePercentage,
    allocatedAmount: Math.round(context.totalBudget * t.basePercentage) / 100,
    actualSpent: 0,
    priority: t.priority,
    rationale: t.rationale,
    isLocked: false,
  }));

  // ── Risk alerts ──────────────────────────────────────────────────────

  const thresholds = PER_GUEST_THRESHOLDS[context.eventType];
  if (thresholds && context.cityTier === 'tier1_metro') {
    const perGuest = context.totalBudget / context.guestCount;
    const threshold = thresholds[context.currency] ?? 0;
    if (perGuest < threshold) {
      riskAlerts.push(
        `⚠️ Per-guest budget (${context.currency} ${Math.round(perGuest)}) is below the realistic metro threshold of ${context.currency} ${threshold} for ${context.eventType} events. Consider reducing guest count or increasing budget.`
      );
    }
  }

  const contingency = categories.find((c) =>
    c.name.toLowerCase().includes('contingency')
  );
  if (contingency && contingency.percentage < 7) {
    riskAlerts.push(
      '⚠️ Contingency reserve is below 7% — consider increasing to absorb unexpected costs.'
    );
  }

  const daysLeft = daysUntil(context.eventDate);
  if (daysLeft < 30) {
    riskAlerts.push(
      `⚠️ Only ${daysLeft} days until the event — accelerated planning required. Some vendor options may be limited.`
    );
  } else if (daysLeft < 60) {
    riskAlerts.push(
      `⚡ ${daysLeft} days until the event — plan is feasible but prioritize vendor bookings immediately.`
    );
  }

  // ── Efficiency score (0-100) ─────────────────────────────────────────

  let score = 50; // Base score

  // Contingency health (0-20 points)
  if (contingency) {
    score += Math.min(20, (contingency.percentage / 10) * 20);
  }

  // Per-guest adequacy (0-30 points)
  if (thresholds) {
    const perGuest = context.totalBudget / context.guestCount;
    const threshold = thresholds[context.currency] ?? 1;
    const adequacyRatio = Math.min(perGuest / threshold, 2);
    score += Math.round(adequacyRatio * 15);
  }

  // Lead-time feasibility (0-20 points)
  if (daysLeft >= 90) score += 20;
  else if (daysLeft >= 60) score += 15;
  else if (daysLeft >= 30) score += 8;
  else score += 2;

  const efficiencyScore = Math.min(100, Math.max(0, Math.round(score)));

  return { categories, riskAlerts, efficiencyScore };
}

/**
 * Rebalances the budget after a user updates one category's amount.
 * Locked categories and the updated category are preserved;
 * the remainder is distributed proportionally among unlocked categories.
 */
export function rebalanceBudget(
  categories: BudgetCategory[],
  totalBudget: number,
  updatedCategoryId: string,
  newAmount: number
): BudgetCategory[] {
  const updated = categories.map((c) => ({ ...c }));
  const target = updated.find((c) => c.id === updatedCategoryId);
  if (!target) return updated;

  // Set the updated category
  target.allocatedAmount = newAmount;
  target.percentage = Math.round((newAmount / totalBudget) * 10000) / 100;
  target.isLocked = true;

  // Calculate remaining budget for unlocked categories
  const lockedTotal = updated
    .filter((c) => c.isLocked)
    .reduce((sum, c) => sum + c.allocatedAmount, 0);
  const remaining = totalBudget - lockedTotal;

  // Get unlocked categories
  const unlocked = updated.filter((c) => !c.isLocked);
  const unlockedTotalPct = unlocked.reduce((sum, c) => sum + c.percentage, 0);

  if (unlocked.length === 0 || remaining <= 0) return updated;

  // Proportionally redistribute
  unlocked.forEach((c) => {
    const proportion = unlockedTotalPct > 0 ? c.percentage / unlockedTotalPct : 1 / unlocked.length;
    c.allocatedAmount = Math.round(remaining * proportion);
    c.percentage = Math.round((c.allocatedAmount / totalBudget) * 10000) / 100;
  });

  // Normalize all percentages to sum to 100%
  const totalPct = updated.reduce((sum, c) => sum + c.percentage, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    const adjustment = 100 - totalPct;
    const largestUnlocked = unlocked.reduce((a, b) =>
      a.percentage > b.percentage ? a : b
    );
    largestUnlocked.percentage = Math.round((largestUnlocked.percentage + adjustment) * 100) / 100;
  }

  return updated;
}

// ─── Timeline Engine ───────────────────────────────────────────────────

interface MilestoneTemplate {
  title: string;
  description: string;
  daysBeforeEvent: number;
  phase: TimelineMilestone['phase'];
  priority: TimelineMilestone['priority'];
  isHighLeadTime: boolean;
}

const WEDDING_MILESTONES: MilestoneTemplate[] = [
  { title: 'Define Vision & Budget', description: 'Finalize event vision, set total budget, and identify must-haves vs nice-to-haves.', daysBeforeEvent: 180, phase: 'Conceptualization', priority: 'critical', isHighLeadTime: false },
  { title: 'Book Venue', description: 'Research, visit, and book the ceremony and reception venues.', daysBeforeEvent: 150, phase: 'Vendor Booking', priority: 'critical', isHighLeadTime: true },
  { title: 'Hire Photographer & Videographer', description: 'Review portfolios, schedule consultations, and book photography/videography team.', daysBeforeEvent: 120, phase: 'Vendor Booking', priority: 'critical', isHighLeadTime: true },
  { title: 'Select Caterer & Menu Tasting', description: 'Shortlist caterers, attend tastings, finalize menu with dietary accommodations.', daysBeforeEvent: 100, phase: 'Vendor Booking', priority: 'critical', isHighLeadTime: true },
  { title: 'Send Save-the-Dates', description: 'Design and mail or digitally send save-the-date notices to all guests.', daysBeforeEvent: 90, phase: 'Logistics & Details', priority: 'high', isHighLeadTime: false },
  { title: 'Book Music & Entertainment', description: 'Book DJ, live band, or entertainment acts. Confirm setlist and logistics.', daysBeforeEvent: 80, phase: 'Vendor Booking', priority: 'high', isHighLeadTime: true },
  { title: 'Finalize Attire', description: 'Order wedding attire, schedule fittings, and coordinate accessories.', daysBeforeEvent: 75, phase: 'Logistics & Details', priority: 'high', isHighLeadTime: false },
  { title: 'Send Formal Invitations', description: 'Mail or send formal invitations with RSVP deadline and meal preferences.', daysBeforeEvent: 60, phase: 'Logistics & Details', priority: 'high', isHighLeadTime: false },
  { title: 'Finalize Decor & Floral', description: 'Confirm decorations, floral arrangements, table settings, and lighting design.', daysBeforeEvent: 45, phase: 'Logistics & Details', priority: 'medium', isHighLeadTime: false },
  { title: 'Confirm Transportation', description: 'Arrange guest shuttles, bridal car, and any special transport needs.', daysBeforeEvent: 30, phase: 'Logistics & Details', priority: 'medium', isHighLeadTime: false },
  { title: 'Final Vendor Confirmations', description: 'Confirm all vendor timings, deliveries, and access arrangements.', daysBeforeEvent: 7, phase: 'Final Week', priority: 'critical', isHighLeadTime: false },
  { title: 'Rehearsal & Final Walkthrough', description: 'Complete ceremony rehearsal and venue walkthrough with all key vendors.', daysBeforeEvent: 2, phase: 'Final Week', priority: 'critical', isHighLeadTime: false },
  { title: 'Event Day Execution', description: 'Execute the event plan — coordinator manages vendor arrivals, timeline, and guest flow.', daysBeforeEvent: 0, phase: 'Event Day', priority: 'critical', isHighLeadTime: false },
];

const BIRTHDAY_MILESTONES: MilestoneTemplate[] = [
  { title: 'Set Theme & Budget', description: 'Decide on a birthday theme, set budget limits, and draft the guest list.', daysBeforeEvent: 60, phase: 'Conceptualization', priority: 'critical', isHighLeadTime: false },
  { title: 'Book Venue', description: 'Reserve the party venue or confirm home setup requirements.', daysBeforeEvent: 45, phase: 'Vendor Booking', priority: 'critical', isHighLeadTime: true },
  { title: 'Order Custom Cake', description: 'Design and order custom birthday cake with preferred flavors and decorations.', daysBeforeEvent: 30, phase: 'Vendor Booking', priority: 'high', isHighLeadTime: true },
  { title: 'Book Entertainment', description: 'Book entertainers, magician, DJ, or activity coordinator.', daysBeforeEvent: 30, phase: 'Vendor Booking', priority: 'high', isHighLeadTime: true },
  { title: 'Send Invitations', description: 'Send digital or printed invitations with RSVP tracking.', daysBeforeEvent: 21, phase: 'Logistics & Details', priority: 'high', isHighLeadTime: false },
  { title: 'Order Decorations & Supplies', description: 'Purchase or order themed decorations, balloons, tableware, and party supplies.', daysBeforeEvent: 14, phase: 'Logistics & Details', priority: 'medium', isHighLeadTime: false },
  { title: 'Finalize Catering Menu', description: 'Confirm food order, snacks, beverages, and any dietary accommodations.', daysBeforeEvent: 10, phase: 'Logistics & Details', priority: 'high', isHighLeadTime: false },
  { title: 'Prepare Party Favors', description: 'Assemble party favor bags or gift boxes for guests.', daysBeforeEvent: 5, phase: 'Final Week', priority: 'medium', isHighLeadTime: false },
  { title: 'Final Setup & Dry Run', description: 'Set up decorations, test AV equipment, and do a final venue walk-through.', daysBeforeEvent: 1, phase: 'Final Week', priority: 'critical', isHighLeadTime: false },
  { title: 'Party Day!', description: 'Execute the birthday plan — enjoy the celebration!', daysBeforeEvent: 0, phase: 'Event Day', priority: 'critical', isHighLeadTime: false },
];

const COMMUNITY_MILESTONES: MilestoneTemplate[] = [
  { title: 'Define Purpose & Scope', description: 'Establish event goals, target attendance, key activities, and secure organizational approval.', daysBeforeEvent: 120, phase: 'Conceptualization', priority: 'critical', isHighLeadTime: false },
  { title: 'Obtain Permits & Insurance', description: 'Apply for municipal NOC, event permits, crowd safety clearance, and public liability insurance.', daysBeforeEvent: 90, phase: 'Vendor Booking', priority: 'critical', isHighLeadTime: true },
  { title: 'Book Venue & Infrastructure', description: 'Reserve public grounds or community hall; arrange staging, seating, power, and sanitation.', daysBeforeEvent: 75, phase: 'Vendor Booking', priority: 'critical', isHighLeadTime: true },
  { title: 'Engage Sound & AV Vendors', description: 'Book PA systems, projectors, microphones, and any live-streaming equipment.', daysBeforeEvent: 60, phase: 'Vendor Booking', priority: 'high', isHighLeadTime: true },
  { title: 'Launch Marketing Campaign', description: 'Design and launch promotional materials — social media, posters, community boards, local press.', daysBeforeEvent: 45, phase: 'Logistics & Details', priority: 'high', isHighLeadTime: false },
  { title: 'Recruit & Brief Volunteers', description: 'Recruit volunteer team, assign roles, and conduct a briefing session.', daysBeforeEvent: 30, phase: 'Logistics & Details', priority: 'high', isHighLeadTime: false },
  { title: 'Finalize Catering & Refreshments', description: 'Confirm food stalls, refreshment stations, and water supply arrangements.', daysBeforeEvent: 21, phase: 'Logistics & Details', priority: 'high', isHighLeadTime: false },
  { title: 'Safety & Medical Planning', description: 'Set up first aid stations, brief security, and confirm emergency evacuation routes.', daysBeforeEvent: 14, phase: 'Logistics & Details', priority: 'critical', isHighLeadTime: false },
  { title: 'Dress Rehearsal', description: 'Run a full rehearsal with performers, speakers, and technical crew.', daysBeforeEvent: 3, phase: 'Final Week', priority: 'high', isHighLeadTime: false },
  { title: 'Event Day Execution', description: 'Run the event — manage crowd flow, coordinate program, handle contingencies.', daysBeforeEvent: 0, phase: 'Event Day', priority: 'critical', isHighLeadTime: false },
];

function getMilestoneTemplates(eventType: string): MilestoneTemplate[] {
  switch (eventType) {
    case 'wedding': return WEDDING_MILESTONES;
    case 'birthday': return BIRTHDAY_MILESTONES;
    case 'community': return COMMUNITY_MILESTONES;
    default: return WEDDING_MILESTONES;
  }
}

/**
 * Generates a dynamic, context-aware timeline of planning milestones.
 * Compresses milestones and attaches dependency warnings when time is short.
 */
export function generateDynamicTimeline(
  context: EventContext
): TimelineMilestone[] {
  const templates = getMilestoneTemplates(context.eventType);
  const daysLeft = daysUntil(context.eventDate);
  const isAccelerated = daysLeft < 30;

  return templates.map((t) => {
    // Scale days-before-event if accelerated
    let adjustedDays = t.daysBeforeEvent;
    if (isAccelerated && t.daysBeforeEvent > 0) {
      // Compress proportionally into the available window
      const maxTemplateDays = templates[0].daysBeforeEvent || 1;
      adjustedDays = Math.max(
        0,
        Math.round((t.daysBeforeEvent / maxTemplateDays) * Math.max(daysLeft - 1, 0))
      );
    }

    const dueDate = dueDateFromEvent(context.eventDate, adjustedDays);

    // Dependency warnings for high-lead-time tasks in compressed schedules
    let dependencyWarning: string | undefined;
    if (isAccelerated && t.isHighLeadTime) {
      dependencyWarning = `⚠️ Accelerated schedule: "${t.title}" normally requires ${t.daysBeforeEvent}+ days lead time. Only ${daysLeft} days remain — contact vendors immediately and confirm availability urgently.`;
    } else if (daysLeft < 60 && t.isHighLeadTime && adjustedDays > daysLeft) {
      dependencyWarning = `⚡ This task's ideal start date has passed. Prioritize immediately to avoid delays.`;
    }

    return {
      id: uid('tl'),
      title: t.title,
      description: t.description,
      daysBeforeEvent: adjustedDays,
      dueDate,
      phase: t.phase,
      priority: t.priority,
      completed: false,
      dependencyWarning,
    };
  });
}

// ─── Vendor Checklist Engine ───────────────────────────────────────────

interface VendorTemplate {
  category: string;
  roleName: string;
  costMinPct: number; // Percentage of total budget
  costMaxPct: number;
  questions: string[];
  checklistLabels: string[];
}

const WEDDING_VENDORS: VendorTemplate[] = [
  {
    category: 'Venue',
    roleName: 'Venue Coordinator',
    costMinPct: 15, costMaxPct: 35,
    questions: ['What is your cancellation/refund policy?', 'Is in-house catering mandatory?', 'What is the maximum capacity for our setup style?', 'Are there sound/noise curfews?'],
    checklistLabels: ['Venue contract signed', 'Deposit paid', 'Insurance requirements confirmed', 'Backup rain/weather plan documented'],
  },
  {
    category: 'Catering',
    roleName: 'Head Caterer',
    costMinPct: 12, costMaxPct: 28,
    questions: ['Can you accommodate all dietary restrictions?', 'What is the per-plate minimum?', 'Do you provide tasting sessions?', 'What happens if final guest count changes?'],
    checklistLabels: ['Menu finalized', 'Tasting completed', 'Dietary accommodations confirmed', 'Service staff count agreed'],
  },
  {
    category: 'Photography',
    roleName: 'Lead Photographer',
    costMinPct: 5, costMaxPct: 15,
    questions: ['How many hours are included?', 'Do you provide a second shooter?', 'What is the turnaround time for edited photos?', 'Do we get full rights to the images?'],
    checklistLabels: ['Portfolio reviewed', 'Shot list discussed', 'Contract signed', 'Delivery timeline agreed'],
  },
  {
    category: 'Music & Entertainment',
    roleName: 'DJ / Band Leader',
    costMinPct: 3, costMaxPct: 10,
    questions: ['Can you accommodate our song requests?', 'What equipment do you bring?', 'Do you handle MC duties?', 'What is your backup plan for equipment failure?'],
    checklistLabels: ['Playlist/setlist approved', 'Equipment needs confirmed', 'Sound check time scheduled'],
  },
  {
    category: 'Floral & Decor',
    roleName: 'Floral Designer',
    costMinPct: 3, costMaxPct: 10,
    questions: ['Are seasonal flowers available for our date?', 'Can you do a site visit?', 'What is the setup/teardown timeline?'],
    checklistLabels: ['Design mockup approved', 'Flower availability confirmed', 'Setup access time confirmed'],
  },
];

const BIRTHDAY_VENDORS: VendorTemplate[] = [
  {
    category: 'Venue',
    roleName: 'Venue Manager',
    costMinPct: 10, costMaxPct: 30,
    questions: ['Is the space child-friendly / age-appropriate?', 'What is included in the rental?', 'Are decorations allowed on walls/ceilings?'],
    checklistLabels: ['Booking confirmed', 'Deposit paid', 'Decoration rules understood'],
  },
  {
    category: 'Catering',
    roleName: 'Caterer / Food Coordinator',
    costMinPct: 15, costMaxPct: 35,
    questions: ['Do you handle kids\' menus separately?', 'Can you accommodate allergies?', 'What serving style do you recommend for our group size?'],
    checklistLabels: ['Menu finalized', 'Allergy list shared', 'Delivery/setup time confirmed'],
  },
  {
    category: 'Custom Cake',
    roleName: 'Cake Designer',
    costMinPct: 3, costMaxPct: 8,
    questions: ['Can you match our theme design?', 'What flavors are available?', 'What is the order lead time?'],
    checklistLabels: ['Design approved', 'Flavor selected', 'Delivery/pickup time confirmed'],
  },
  {
    category: 'Entertainment',
    roleName: 'Entertainer / Activity Host',
    costMinPct: 5, costMaxPct: 15,
    questions: ['What age group is your act best suited for?', 'How long is the performance?', 'Do you bring your own equipment?'],
    checklistLabels: ['Act/activity confirmed', 'Duration and timing agreed', 'Space requirements met'],
  },
];

const COMMUNITY_VENDORS: VendorTemplate[] = [
  {
    category: 'Venue & Infrastructure',
    roleName: 'Venue / Grounds Manager',
    costMinPct: 15, costMaxPct: 30,
    questions: ['What is the maximum occupancy?', 'Is there adequate power supply?', 'Are sanitation facilities available on-site?', 'Is overnight setup possible?'],
    checklistLabels: ['Municipal NOC obtained', 'Venue contract signed', 'Power/water access confirmed', 'Sanitation/waste plan agreed'],
  },
  {
    category: 'Sound & AV',
    roleName: 'AV Technician',
    costMinPct: 5, costMaxPct: 12,
    questions: ['Can you provide a sound check the day before?', 'Is live-streaming equipment included?', 'What is your backup plan for equipment failure?'],
    checklistLabels: ['Sound permit obtained', 'Equipment specifications agreed', 'Sound check scheduled'],
  },
  {
    category: 'Catering & Refreshments',
    roleName: 'Catering Coordinator',
    costMinPct: 10, costMaxPct: 25,
    questions: ['Can you handle large-batch serving?', 'What are the hygiene certifications?', 'Do you provide water/beverage stations?'],
    checklistLabels: ['FSSAI/health certification verified', 'Menu finalized', 'Serving logistics confirmed'],
  },
  {
    category: 'Safety & Security',
    roleName: 'Security & Safety Lead',
    costMinPct: 3, costMaxPct: 8,
    questions: ['How many personnel for our expected crowd?', 'Do you provide first-aid trained staff?', 'What is the emergency protocol?'],
    checklistLabels: ['Crowd safety plan approved', 'First aid stations positioned', 'Emergency exits marked', 'Liaison with local authorities confirmed'],
  },
];

function getVendorTemplates(eventType: string): VendorTemplate[] {
  switch (eventType) {
    case 'wedding': return WEDDING_VENDORS;
    case 'birthday': return BIRTHDAY_VENDORS;
    case 'community': return COMMUNITY_VENDORS;
    default: return WEDDING_VENDORS;
  }
}

/**
 * Generates a vendor checklist tailored to the event type,
 * with cost ranges scaled to the total budget and context-specific
 * contract checklist items.
 */
export function generateVendorChecklist(
  context: EventContext
): VendorItem[] {
  const templates = getVendorTemplates(context.eventType);

  const vendors: VendorItem[] = templates.map((t) => {
    const checklist = t.checklistLabels.map((label) => ({
      id: uid('chk'),
      label,
      checked: false,
    }));

    // Add outdoor-specific checklist items
    if (context.setting === 'outdoor' && t.category.toLowerCase().includes('venue')) {
      checklist.push(
        { id: uid('chk'), label: 'Weather backup clause in contract', checked: false },
        { id: uid('chk'), label: 'Generator / power backup arranged', checked: false },
        { id: uid('chk'), label: 'Drainage / waterproofing plan confirmed', checked: false }
      );
    }

    return {
      id: uid('vnd'),
      category: t.category,
      roleName: t.roleName,
      estimatedCostMin: Math.round(context.totalBudget * t.costMinPct / 100),
      estimatedCostMax: Math.round(context.totalBudget * t.costMaxPct / 100),
      actualQuoted: undefined,
      status: 'shortlisted' as const,
      questionsToAsk: [...t.questions],
      contractChecklist: checklist,
      notes: '',
    };
  });

  return vendors;
}

// ─── Personalized Ideas Engine ─────────────────────────────────────────

/**
 * Generates 6 personalized, context-aware creative ideas spanning
 * the 4 idea categories, referencing the user's specific context.
 */
export function generateContextualIdeas(
  context: EventContext
): PersonalizedIdea[] {
  const { eventType, culturalTheme, dietaryPreferences, setting, guestCount } = context;
  const dietNote = dietaryPreferences.length > 0 ? dietaryPreferences.join(', ') : 'mixed dietary';
  const sizeNote = guestCount > 200 ? 'large-scale' : guestCount > 50 ? 'mid-size' : 'intimate';

  const ideas: PersonalizedIdea[] = [];

  // ── Theme & Decor (2 ideas) ──────────────────────────────────────────

  if (eventType === 'wedding') {
    ideas.push({
      id: uid('idea'),
      category: 'Theme & Decor',
      title: `${culturalTheme || 'Signature'} Welcome Arch`,
      description: `Design a grand welcome arch incorporating ${culturalTheme || 'your personal'} motifs with locally sourced flowers and fabric draping. For an ${setting} setting, use ${setting === 'outdoor' ? 'weather-resistant natural materials like bamboo and marigold garlands' : 'hanging installations with fairy lights and silk panels'}.`,
      estimatedImpact: 'Creates a stunning first impression and becomes the most photographed spot',
      costTier: 'medium',
      whyItFitsContext: `Tailored to your ${culturalTheme || 'custom'} theme and ${setting} ${sizeNote} setup with ${guestCount} guests.`,
    });
  } else if (eventType === 'birthday') {
    ideas.push({
      id: uid('idea'),
      category: 'Theme & Decor',
      title: 'Personalized Memory Timeline Wall',
      description: `Create an interactive timeline wall showcasing the honoree's life milestones with photos, handwritten notes, and memorabilia. Decorate with ${culturalTheme || 'themed'} accents and LED strip lighting.`,
      estimatedImpact: 'Deeply personal centerpiece that sparks conversations and nostalgia',
      costTier: 'low',
      whyItFitsContext: `A heartfelt addition for a ${sizeNote} ${culturalTheme || 'themed'} birthday celebration.`,
    });
  } else {
    ideas.push({
      id: uid('idea'),
      category: 'Theme & Decor',
      title: 'Community Identity Banners & Photo Booth',
      description: `Design large-format banners showcasing the community's history and achievements. Set up a themed photo booth with ${culturalTheme || 'community'} props for attendees to share on social media.`,
      estimatedImpact: 'Strengthens community identity and generates organic social media reach',
      costTier: 'low',
      whyItFitsContext: `Designed for a ${sizeNote} community gathering of ${guestCount} attendees with ${culturalTheme || 'community pride'} theming.`,
    });
  }

  ideas.push({
    id: uid('idea'),
    category: 'Theme & Decor',
    title: setting === 'outdoor' ? 'Sunset-Timed Lighting Cascade' : 'Ambient Projection Mapping',
    description: setting === 'outdoor'
      ? `Install warm-toned string lights and lanterns programmed to gradually illuminate as the sun sets, creating a magical transition from day to evening. Use solar-powered LED stakes along pathways.`
      : `Use projectors to cast dynamic ${culturalTheme || 'themed'} patterns and visuals onto walls and ceilings, transforming the indoor space without physical decorations. Coordinate projections with the event program.`,
    estimatedImpact: 'Creates a "wow moment" transition that guests will remember and share',
    costTier: setting === 'outdoor' ? 'medium' : 'high',
    whyItFitsContext: `Optimized for your ${setting} venue setting and ${culturalTheme || 'chosen'} aesthetic.`,
  });

  // ── Food & Beverage ──────────────────────────────────────────────────

  ideas.push({
    id: uid('idea'),
    category: 'Food & Beverage',
    title: `${dietNote} Interactive Food Station`,
    description: `Set up live cooking stations where guests customize their plates — think ${dietaryPreferences.includes('vegetarian') || dietaryPreferences.includes('vegan') ? 'live dosa/pasta counters, fresh salad bars, and artisanal smoothie stations' : 'grill-your-own skewers, build-your-own taco bars, and live pasta stations'}. Label all items with allergen and dietary badges.`,
    estimatedImpact: 'Reduces food waste by 20-30% and dramatically improves guest satisfaction through personalization',
    costTier: 'medium',
    whyItFitsContext: `Specifically designed for ${dietNote} preferences across ${guestCount} guests in a ${sizeNote} setting.`,
  });

  ideas.push({
    id: uid('idea'),
    category: 'Food & Beverage',
    title: `${culturalTheme || 'Artisanal'} Signature Drink & Mocktail Bar`,
    description: `Curate two themed signature beverages (one specialty cocktail/punch, one handcrafted herbal mocktail) named after the hosts or celebration milestones, using seasonal local garnishes.`,
    estimatedImpact: 'Elevates hospitality ambiance while controlling open-bar beverage costs by up to 20%',
    costTier: 'low',
    whyItFitsContext: `Complements the ${dietNote} menu and adds memorable branding for ${context.title}.`,
  });

  // ── Guest Experience ─────────────────────────────────────────────────

  ideas.push({
    id: uid('idea'),
    category: 'Guest Experience',
    title: guestCount > 100 ? 'Digital Guestbook & Live Photo Mosaic' : 'Personalized Guest Kits',
    description: guestCount > 100
      ? `Deploy a digital guestbook tablet where guests leave video/text messages. Photos taken during the event feed into a real-time mosaic displayed on a large screen, building a collective artwork as the event progresses.`
      : `Prepare personalized welcome kits for each guest with a thank-you note, a small ${culturalTheme || 'themed'} memento, and a printed event program with the timeline and activities.`,
    estimatedImpact: guestCount > 100
      ? 'Engages large crowds and creates a shareable digital keepsake'
      : 'Makes each guest feel valued and sets a personal tone from arrival',
    costTier: guestCount > 100 ? 'medium' : 'low',
    whyItFitsContext: `Scaled for your ${sizeNote} gathering of ${guestCount} guests${culturalTheme ? ` with ${culturalTheme} touches` : ''}.`,
  });

  // ── Sustainability & Cost-Saving ─────────────────────────────────────

  ideas.push({
    id: uid('idea'),
    category: 'Sustainability & Cost-Saving',
    title: 'Eco-Smart Decor & Zero-Waste Catering',
    description: `Use rental decor instead of buying, choose potted plants over cut flowers (guests can take them home as favors), and partner with caterers who practice portion control and donate leftovers. For invitations, use digital RSVPs to save on printing costs.`,
    estimatedImpact: 'Can reduce decor costs by 30-40% and catering waste by 50%, while resonating with eco-conscious guests',
    costTier: 'low',
    whyItFitsContext: `Cost-effective approach for your ${context.currency} ${context.totalBudget.toLocaleString()} budget${setting === 'outdoor' ? ' — natural outdoor settings pair beautifully with eco-friendly decor' : ''}.`,
  });

  return ideas;
}
