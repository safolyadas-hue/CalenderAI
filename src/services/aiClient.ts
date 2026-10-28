import type { EventContext, PersonalizedIdea } from '../types/event';
import { sanitizeInput, detectPromptInjection, RateLimiter } from '../utils/security';
import { LRUCache } from '../utils/cache';
import { generateContextualIdeas } from '../engines/decisionEngine';

// Client rate limiter: 12 requests per minute (1 token every 5s, burst capacity 12)
const clientRateLimiter = new RateLimiter(12, 0.2);

// Cache for AI responses: 30 entries, 10-minute TTL
const ideasCache = new LRUCache<string, PersonalizedIdea[]>(30, 10 * 60 * 1000);
const copilotCache = new LRUCache<string, { reply: string; suggestedActions: string[] }>(30, 10 * 60 * 1000);

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
    return { ideas: cached, source: 'local_context_engine' };
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
        ideasCache.set(cacheKey, data.ideas);
        return { ideas: data.ideas, source: 'netlify_serverless' };
      }
    }
  } catch {
    // Network error or timeout, seamlessly proceed to fallback
  }

  // Fallback to local deterministic decision engine
  const localIdeas = generateContextualIdeas(context);
  ideasCache.set(cacheKey, localIdeas);
  return { ideas: localIdeas, source: 'local_context_engine' };
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
    return { ...cached, source: 'local_context_engine' };
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
        copilotCache.set(cacheKey, { reply: data.reply, suggestedActions: data.suggestedActions || [] });
        return {
          reply: data.reply,
          suggestedActions: data.suggestedActions || [],
          source: 'netlify_serverless',
        };
      }
    }
  } catch {
    // Proceed to deterministic fallback
  }

  // Step 5: Smart Deterministic Local Fallback based on live context
  const lower = cleanPrompt.toLowerCase();
  let reply = '';
  let suggestedActions: string[] = [];

  if (lower.includes('budget') || lower.includes('cut') || lower.includes('save') || lower.includes('cost')) {
    const perGuest = Math.round(context.totalBudget / Math.max(context.guestCount, 1));
    reply = `Based on your ${context.currency} ${context.totalBudget.toLocaleString()} total budget for ${context.guestCount} guests (${context.currency} ${perGuest}/guest), to safely optimize expenses:
1. Re-negotiate venue packages by bundling AV/sound or off-peak hours (saves ~10-15%).
2. Switch cut florals to sustainable potted arrangements or ambient lighting.
3. Keep the Contingency Reserve locked at 8-10% to protect against unexpected costs.`;
    suggestedActions = ['Lock Contingency Reserve', 'Review Vendor Quotes', 'Adjust Guest Count'];
  } else if (lower.includes('weather') || lower.includes('rain') || lower.includes('outdoor')) {
    reply = `For your ${context.setting} setting (${context.culturalTheme || 'Standard'} theme):
1. Ensure the venue contract includes an explicit waterproof marquee or indoor hall rollover clause.
2. Verify dual-generator power backup for sound and lighting in case of grid outage.
3. Deploy covered misting fans or radiant patio heaters depending on the season.`;
    suggestedActions = ['Add Weather Backup to Checklist', 'Review Venue Contract Clause', 'Check Generator Capacity'];
  } else if (lower.includes('timeline') || lower.includes('urgent') || lower.includes('date') || lower.includes('schedule')) {
    if (planSummary.daysUntilEvent < 30) {
      reply = `⚡ Urgent Schedule Alert: With only ${planSummary.daysUntilEvent} days remaining, you are in an Accelerated Sprint. Focus immediately on:
1. Locking Venue & Caterer deposits within 48 hours.
2. Sending digital invitations with instant RSVP links.
3. Finalizing municipal/sound permits if applicable.`;
      suggestedActions = ['Filter Critical Milestones', 'Send Digital RSVPs', 'Contact Venue Manager'];
    } else {
      reply = `You have ${planSummary.daysUntilEvent} days until the event — your planning horizon is on track. Your current priority is completing vendor selections and confirming bookings before peak seasonal rate spikes.`;
      suggestedActions = ['Review Vendor Pipeline', 'Schedule Tasting Sessions', 'Draft Invitations'];
    }
  } else if (lower.includes('diet') || lower.includes('food') || lower.includes('menu') || lower.includes('catering')) {
    const diets = context.dietaryPreferences.length > 0 ? context.dietaryPreferences.join(', ') : 'standard';
    reply = `For your menu catering to ${diets} preferences across ${context.guestCount} guests:
1. Designate segregated prep and serving counters with visible dietary icon markers.
2. Implement live chef-crafted stations to maximize freshness and reduce food waste by 25%.
3. Require the head caterer to provide allergen disclosure sheets before final payment.`;
    suggestedActions = ['Add Dietary Badges to Checklist', 'Schedule Menu Tasting', 'Confirm Plate Minimums'];
  } else if (lower.includes('contract') || lower.includes('vendor')) {
    reply = `Key clauses to verify across all vendor contracts:
1. Explicit cancellation, date-rescheduling, and force-majeure refund percentages.
2. Specific arrival, sound-check, and teardown buffer times.
3. Backup staff or equipment replacement guarantees in case of emergencies.`;
    suggestedActions = ['Inspect Vendor Checklist', 'Add Deposit Dates to Timeline', 'Verify FSSAI/Insurance'];
  } else {
    reply = `CalenderAI Context Assistant: Your plan for "${context.title}" has an efficiency score of ${planSummary.efficiencyScore}/100 with ${planSummary.daysUntilEvent} days until the event. I can help optimize your ${context.currency} ${context.totalBudget.toLocaleString()} budget, organize vendor contracts, adapt your timeline, or tailor ideas for your ${context.culturalTheme || 'custom'} theme.`;
    suggestedActions = ['Optimize Budget by 10%', 'Review Weather Contingency', 'Check Urgent Milestones'];
  }

  const result = { reply, suggestedActions };
  copilotCache.set(cacheKey, result);
  return { ...result, source: 'local_context_engine' };
}
