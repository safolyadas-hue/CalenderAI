import type { EventContext, PersonalizedIdea } from '../types/event';
import { sanitizeInput, detectPromptInjection, RateLimiter } from '../utils/security';
import { LRUCache } from '../utils/cache';
import { generateContextualIdeas } from '../engines/decisionEngine';

// Client rate limiter: 12 requests per minute (1 token every 5s, burst capacity 12)
const clientRateLimiter = new RateLimiter(12, 0.2);

// Cache for AI responses: 30 entries, 10-minute TTL
const ideasCache = new LRUCache<string, { ideas: PersonalizedIdea[]; source: EngineSource }>(30, 10 * 60 * 1000);
const copilotCache = new LRUCache<string, { reply: string; suggestedActions: string[]; source: EngineSource }>(30, 10 * 60 * 1000);

export type EngineSource = 'netlify_serverless' | 'local_context_engine';

/**
 * Requests personalized ideas, attempting the Netlify serverless endpoint first,
 * falling back seamlessly to the deterministic local decision engine.
 */
export async function requestPersonalizedIdeas(
  context: EventContext
): Promise<{ ideas: PersonalizedIdea[]; source: EngineSource }> {
  const cacheKey = `ideas_${context.eventType}_${context.setting}_${context.culturalTheme}_${context.guestCount}`;
  const cached = ideasCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Attempt remote Netlify function if available
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch('/api/ai-planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_ideas', context }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.ideas) && data.ideas.length > 0) {
        const result = { ideas: data.ideas as PersonalizedIdea[], source: 'netlify_serverless' as const };
        ideasCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Network error or timeout, seamlessly proceed to fallback
  }

  // Fallback to local deterministic decision engine
  const localIdeas = generateContextualIdeas(context);
  const result = { ideas: localIdeas, source: 'local_context_engine' as const };
  ideasCache.set(cacheKey, result);
  return result;
}

/**
 * Queries the AI Co-Pilot with security guards and smart context-aware local fallback.
 */
export async function askAICoPilot(
  context: EventContext,
  rawPrompt: string,
  planSummary: { efficiencyScore: number; daysUntilEvent: number }
): Promise<{
  reply: string;
  suggestedActions: string[];
  isBlocked?: boolean;
  source: EngineSource;
}> {
  // Step 1: Prompt Injection Guard
  const injectionCheck = detectPromptInjection(rawPrompt);
  if (!injectionCheck.isSafe) {
    return {
      reply: `🛡️ Security Guard: Prompt blocked due to detected instruction-override or injection pattern (${injectionCheck.reason || 'Adversarial pattern'}).`,
      suggestedActions: ['Ask about budget distribution', 'Ask for weather backup tips', 'Review critical milestone dates'],
      isBlocked: true,
      source: 'local_context_engine',
    };
  }

  // Step 2: Input Sanitization
  const cleanPrompt = sanitizeInput(rawPrompt, 500);
  if (!cleanPrompt) {
    return {
      reply: 'Please provide a valid question or planning instruction.',
      suggestedActions: [],
      source: 'local_context_engine',
    };
  }

  // Step 3: Rate Limiting
  if (!clientRateLimiter.consume(1)) {
    return {
      reply: '⚠️ Rate limit reached. Please wait a moment before sending another request.',
      suggestedActions: [],
      source: 'local_context_engine',
    };
  }

  const cacheKey = `copilot_${context.eventType}_${cleanPrompt.toLowerCase().slice(0, 80)}`;
  const cached = copilotCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Step 4: Attempt Netlify Serverless API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch('/api/ai-planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'copilot_query',
        context,
        userPrompt: cleanPrompt,
        planSummary,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.reply) {
        const result = {
          reply: data.reply,
          suggestedActions: data.suggestedActions || [],
          source: 'netlify_serverless' as const,
        };
        copilotCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Proceed to deterministic fallback
  }

  // Step 5: Smart Multi-Intent Local Fallback based on live context
  const lower = cleanPrompt.toLowerCase().trim();
  let reply = '';
  let suggestedActions: string[] = [];

  // 1. Greetings & Introductory Help
  if (/\b(hi|hello|hey|yo|greetings|good morning|good afternoon|good evening|who are you|help|what can you do)\b/i.test(lower)) {
    reply = `Hey there! 👋 I'm your CalenderAI Co-Pilot. Right now we're looking at "${context.title}" (${context.guestCount} guests, ${context.currency} ${context.totalBudget.toLocaleString()}). Tell me what you'd like to do—we can brainstorm creative themes, trim the budget, write speeches/haikus, or check your vendor checklist!`;
    suggestedActions = ['Brainstorm creative themes', 'Optimize my budget', 'Write a custom toast or haiku'];
  } else if (/\b(haiku|poem|poetry|rhyme|toast|speech|joke|slogan|invite|invitation|song|vow|vows)\b/i.test(lower)) {
    // 2. Creative Requests
    if (lower.includes('haiku')) {
      if (context.eventType === 'wedding') {
        reply = 'Lanterns soft and bright,\nTwo hearts dance beneath the stars,\nLove begins tonight.';
      } else if (context.eventType === 'birthday') {
        reply = 'Candles glowing bright,\nAnother year of laughter,\nMake a wish tonight.';
      } else {
        reply = 'Hands joined side by side,\nStreets alive with shared delight,\nCommunity shines.';
      }
      suggestedActions = ['Write another verse', 'Add to speeches or vows', 'Save to event notes'];
    } else if (lower.includes('toast') || lower.includes('speech')) {
      reply = `Here is a custom celebratory toast for "${context.title}":\n\n"To everyone gathered here today under the ${context.setting} sky—may this celebration bring unforgettable memories, enduring warmth, and boundless joy to our incredible community. Here's to making today truly magical!" 🥂`;
      suggestedActions = ['Make it shorter', 'Make it humorous', 'Save toast to notes'];
    } else if (lower.includes('joke')) {
      reply = `Why did the event planner bring a ladder to "${context.title}"?\n\nBecause the expectations were sky-high, but the budget was grounded! 😄`;
      suggestedActions = ['Tell another joke', 'Back to planning', 'Check vendor checklist'];
    } else if (lower.includes('invite') || lower.includes('invitation')) {
      reply = `💌 **Invitation Draft for ${context.title}**\n\n"You are warmly invited to celebrate with us on ${context.eventDate}!\nJoin us for an unforgettable ${context.eventType} celebration featuring delicious cuisine, joyful music, and cherished moments.\n\nRSVP requested by 3 weeks prior. Dress code: ${context.culturalTheme || 'Celebratory Festive'}."`;
      suggestedActions = ['Create digital RSVP link', 'Adjust invitation tone', 'Export invitation'];
    } else {
      reply = `Here is a celebratory verse crafted for "${context.title}":\n\n"Gather friends from near and far,\nUnder lantern light and star.\nCelebrate with joyous cheer,\nFor the milestone of the year!"`;
      suggestedActions = ['Write another verse', 'Refine for programs', 'Print on invitations'];
    }
  } else if (/\b(budget|cost|costs|save|saving|cut|cheap|expensive|price|discount|optimize)\b/i.test(lower)) {
    // 3. Budget Optimization
    const perGuest = Math.round(context.totalBudget / Math.max(context.guestCount, 1));
    reply = `Strategic budget breakdown for "${context.title}" (${context.currency} ${context.totalBudget.toLocaleString()} total, ~${context.currency} ${perGuest}/guest):\n1. Bundle Venue & Production: Inquire if your venue offers preferred AV packages to save 12-18% immediately.\n2. Optimize High-Volume Rentals: Standardize table linens and glassware to avoid premium customization surcharges.\n3. Safeguard Contingency: Maintain an 8-10% reserve (${context.currency} ${Math.round(context.totalBudget * 0.08).toLocaleString()}) for day-of logistical surprises.`;
    suggestedActions = ['Lock Contingency Reserve', 'Review High-Cost Categories', 'Adjust Guest Count'];
  } else if (/\b(diet|food|menu|catering|drinks|drink|beverage|bar|cocktail|mocktail|plate|tasting)\b/i.test(lower)) {
    // 4. Catering / Food / Drinks
    const perPlate = Math.round((context.totalBudget * 0.35) / Math.max(context.guestCount, 1));
    const diets = context.dietaryPreferences.length > 0 ? context.dietaryPreferences.join(', ') : 'standard';
    reply = `For catering "${context.title}" across ${context.guestCount} guests (allocated target: ~${context.currency} ${perPlate}/plate, accounting for ${diets} preferences):\n1. Establish dedicated live interactive counters for specialty items to prevent queue bottlenecks.\n2. Curate 2 signature mocktails/cocktails reflecting your ${context.culturalTheme || 'festive'} theme rather than a costly full open bar.\n3. Demand certified allergen and dietary disclosure sheets from the head caterer 14 days before the event.`;
    suggestedActions = ['Add Dietary Badges to Checklist', 'Schedule Menu Tasting', 'Review Caterer Contract'];
  } else if (/\b(decor|theme|vibe|music|dj|entertainment|lighting|flowers|floral|sound|ambiance|stage)\b/i.test(lower)) {
    // 5. Decor & Entertainment
    reply = `Decor & Entertainment recommendations for your ${context.setting} ${context.culturalTheme || 'celebratory'} theme:\n1. Use warm architectural uplighting and kinetic fairy lights—they transform the venue at 1/3 the cost of fresh cut florals.\n2. Curate a 3-stage sound journey: acoustic background during guest arrival, curated playlist through dinner, and high-energy live performance/DJ for the finale.\n3. Incorporate sustainable potted greenery and regional decorative motifs that guests can take home as eco-friendly favors.`;
    suggestedActions = ['Add AV & Sound to Checklist', 'Review Decor Quotes', 'Explore Theme Ideas'];
  } else if (/\b(timeline|urgent|next step|schedule|date|when|milestone|deadline)\b/i.test(lower)) {
    // 6. Timeline Priorities
    if (planSummary.daysUntilEvent < 30) {
      reply = `⚡ Urgent Schedule Priorities (${planSummary.daysUntilEvent} days remaining — Accelerated Sprint):\n1. Lock signed vendor contracts & initial deposits for Venue and Lead Caterer within 48 hours.\n2. Dispatch digital RSVP links with strict 7-day confirmation deadlines.\n3. Secure municipal noise/sound permits and confirm venue load-in timeframes.`;
      suggestedActions = ['Filter Critical Milestones', 'Send Digital RSVPs', 'Contact Venue Manager'];
    } else {
      reply = `Planning Horizon Priorities (${planSummary.daysUntilEvent} days until ${context.eventDate}):\n1. Finalize your core vendor shortlist and lock in tastings/walkthroughs.\n2. Send Save-the-Date notices to lock in guest availability.\n3. Establish your payment milestone calendar to avoid last-minute cashflow pinches.`;
      suggestedActions = ['Review Vendor Pipeline', 'Schedule Tasting Sessions', 'Draft Invitations'];
    }
  } else if (/\b(weather|rain|wind|outdoor|marquee|shelter|contract|vendor)\b/i.test(lower)) {
    // 7. Venue / Weather / Contracts
    reply = `For your ${context.setting} setting and vendor contracts:\n1. Ensure the venue contract includes an explicit waterproof marquee rollover clause with a 48-hour call time.\n2. Verify dual-generator power backup for sound and lighting in case of grid outage.\n3. Confirm explicit cancellation, date-rescheduling, and force-majeure refund percentages across all contracts.`;
    suggestedActions = ['Add Weather Backup to Checklist', 'Review Venue Contract Clause', 'Check Generator Capacity'];
  } else if (/\b(score|efficiency|feasibility)\b/i.test(lower)) {
    // 8. Specific Efficiency Score query
    reply = `Your plan for "${context.title}" currently has an efficiency score of ${planSummary.efficiencyScore}/100 with ${planSummary.daysUntilEvent} days until the event date. Key factors boosting your score include balanced budget distribution and complete vendor coverage.`;
    suggestedActions = ['Optimize Budget by 10%', 'Review Milestone Timeline', 'Check Checklist Completion'];
  } else {
    // 9. Any Other Custom Question — Contextual tailored paragraph
    reply = `Great question regarding "${cleanPrompt.slice(0, 60)}" for your upcoming ${context.eventType} ("${context.title}")!\nFor a ${context.setting} event with ${context.guestCount} guests and a budget of ${context.currency} ${context.totalBudget.toLocaleString()}, the key is balancing memorable guest experiences with tight vendor coordination. Let me know if you would like me to draft a specific checklist item, calculate itemized cost estimates, or generate tailored timeline milestones for this!`;
    suggestedActions = ['Explore Personalized Ideas', 'Review Budget Allocation', 'Ask Another Question'];
  }

  const result = { reply, suggestedActions, source: 'local_context_engine' as const };
  copilotCache.set(cacheKey, result);
  return result;
}
