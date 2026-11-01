/**
 * CalenderAI — Netlify Serverless AI Planner Function
 *
 * Dual-engine architecture:
 *  1. Live Gemini Mode (when GEMINI_API_KEY is set) with free-tier model cascade
 *  2. Server-Side Smart Contextual Engine fallback (always succeeds with HTTP 200)
 *
 * Security: Server-side rate limiting, payload size checks, prompt injection
 * detection, and input validation. API key is NEVER exposed to the client.
 */

// Declare process for Node/Netlify serverless environment
declare const process: { env?: Record<string, string | undefined> } | undefined;

import type { EventContext } from '../../src/types/event';
import {
  sanitizeInput,
  detectPromptInjection,
  validateEventContext,
  RateLimiter,
} from '../../src/utils/security';
import { generateContextualIdeas } from '../../src/engines/decisionEngine';

// ─── Server-Side Rate Limiter (per-IP, 15 req/min) ────────────────────

const ipRateLimiters = new Map<string, RateLimiter>();
const MAX_BODY_SIZE = 15 * 1024; // 15 KB

function getIpLimiter(ip: string): RateLimiter {
  let limiter = ipRateLimiters.get(ip);
  if (!limiter) {
    limiter = new RateLimiter(15, 0.25); // 15 burst, ~15 per minute
    ipRateLimiters.set(ip, limiter);
    // Prune old IPs periodically to avoid memory leak
    if (ipRateLimiters.size > 500) {
      const firstKey = ipRateLimiters.keys().next().value;
      if (firstKey !== undefined) ipRateLimiters.delete(firstKey);
    }
  }
  return limiter;
}

// ─── Free-Tier Gemini Model Cascade ────────────────────────────────────

const MODEL_CASCADE = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

async function callGemini(
  apiKey: string,
  model: string,
  fullPromptString: string
): Promise<{ text: string | null; error: string | null }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: fullPromptString }],
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errText = '';
      try {
        errText = await response.text();
      } catch {
        // ignore
      }
      const shortErr = errText ? errText.slice(0, 150) : response.statusText;
      return { text: null, error: `HTTP ${response.status}: ${shortErr}` };
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const nonThought = parts
        .filter((p: any) => p && typeof p.text === 'string' && !p.thought)
        .map((p: any) => p.text)
        .join('\n');
      const allText = parts
        .filter((p: any) => p && typeof p.text === 'string')
        .map((p: any) => p.text)
        .join('\n');
      const text = nonThought.trim().length > 0 ? nonThought : allText;
      if (text.trim().length > 0) {
        return { text: text.trim(), error: null };
      }
    }
    return { text: null, error: 'Empty parts returned by Gemini' };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return { text: null, error: msg || 'Network error or timeout' };
  }
}

interface CascadeResult {
  text: string | null;
  model: string | null;
  lastModelTried: string;
  lastError: string | null;
}

async function callGeminiWithCascade(
  apiKey: string,
  preferredModel: string,
  fullPromptString: string
): Promise<CascadeResult> {
  const modelsToTry = [preferredModel, ...MODEL_CASCADE.filter((m) => m !== preferredModel)];
  let lastModelTried = preferredModel;
  let lastError: string | null = null;

  for (const model of modelsToTry) {
    lastModelTried = model;
    const res = await callGemini(apiKey, model, fullPromptString);
    if (res.text) {
      return { text: res.text, model, lastModelTried, lastError: null };
    }
    lastError = `[${model}] ${res.error}`;
  }
  return { text: null, model: null, lastModelTried, lastError };
}

// ─── System Instructions ───────────────────────────────────────────────

const IDEAS_SYSTEM_INSTRUCTION = `You are CalenderAI, a professional event planning assistant specializing in weddings, birthdays, and community events.

Generate exactly 6 creative, context-specific event planning ideas as a JSON array.

Each idea MUST have these fields:
- "id": a unique string (e.g., "idea_1")
- "category": one of "Theme & Decor", "Food & Beverage", "Guest Experience", "Sustainability & Cost-Saving"
- "title": short creative title
- "description": 2-3 sentence detailed description
- "estimatedImpact": 1 sentence on expected guest/planning impact
- "costTier": "low", "medium", or "high"
- "whyItFitsContext": 1 sentence explaining why this idea fits the user's specific event context

Respond ONLY with a JSON object: {"ideas": [...]}`;

const COPILOT_SYSTEM_INSTRUCTION = `You are CalenderAI Co-Pilot, an expert AI event planning assistant and creative advisor.
You help organize weddings, birthdays, community milestones, budgets, timelines, vendor contracts, as well as creative and general requests (including writing haikus, poems, toasts, speeches, greetings, theme concepts, jokes, or invitations).

Directly and creatively answer the user's prompt:
- If the user asks a creative question (e.g., write a haiku, poem, toast, speech, greeting, or joke), fulfill the creative request completely with high flair, incorporating their event context when appropriate.
- If the user asks a strategic or logistical planning question, provide actionable advice tailored to their exact budget, guest count, event type, setting, and timeline.

Your response MUST be in JSON format:
{
  "reply": "Your complete, beautifully formatted response (support markdown formatting, verses, bullet points, etc.)",
  "suggestedActions": ["3 short, relevant follow-up actions or questions"]
}`;

// ─── Server-Side Contextual CoPilot Fallback ──────────────────────────

function generateServerCopilotReply(
  context: EventContext,
  userPrompt: string,
  planSummary?: { efficiencyScore?: number; daysUntilEvent?: number }
): { reply: string; suggestedActions: string[] } {
  const lower = userPrompt.toLowerCase().trim();
  const score = planSummary?.efficiencyScore ?? 75;
  const daysLeft = planSummary?.daysUntilEvent ?? 90;

  // 1. Greetings & Introductory Help
  if (/\b(hi|hello|hey|yo|greetings|good morning|good afternoon|good evening|who are you|help|what can you do)\b/i.test(lower)) {
    return {
      reply: `Hey there! 👋 I'm your CalenderAI Co-Pilot. Right now we're looking at "${context.title}" (${context.guestCount} guests, ${context.currency} ${context.totalBudget.toLocaleString()}). Tell me what you'd like to do—we can brainstorm creative themes, trim the budget, write speeches/haikus, or check your vendor checklist!`,
      suggestedActions: ['Brainstorm creative themes', 'Optimize my budget', 'Write a custom toast or haiku'],
    };
  }

  // 2. Creative Requests (haiku, poem, joke, toast, speech, slogan, invite, song)
  if (/\b(haiku|poem|poetry|rhyme|toast|speech|joke|slogan|invite|invitation|song|vow|vows)\b/i.test(lower)) {
    if (lower.includes('haiku')) {
      let haikuText = '';
      if (context.eventType === 'wedding') {
        haikuText = 'Lanterns soft and bright,\nTwo hearts dance beneath the stars,\nLove begins tonight.';
      } else if (context.eventType === 'birthday') {
        haikuText = 'Candles glowing bright,\nAnother year of laughter,\nMake a wish tonight.';
      } else {
        haikuText = 'Hands joined side by side,\nStreets alive with shared delight,\nCommunity shines.';
      }
      return {
        reply: haikuText,
        suggestedActions: ['Write another verse', 'Add to speeches or vows', 'Save to event notes'],
      };
    }

    if (lower.includes('toast') || lower.includes('speech')) {
      return {
        reply: `Here is a custom celebratory toast for "${context.title}":\n\n"To everyone gathered here today under the ${context.setting} sky—may this celebration bring unforgettable memories, enduring warmth, and boundless joy to our incredible community. Here's to making today truly magical!" 🥂`,
        suggestedActions: ['Make it shorter', 'Make it humorous', 'Save toast to notes'],
      };
    }

    if (lower.includes('joke')) {
      return {
        reply: `Why did the event planner bring a ladder to "${context.title}"?\n\nBecause the expectations were sky-high, but the budget was grounded! 😄`,
        suggestedActions: ['Tell another joke', 'Back to planning', 'Check vendor checklist'],
      };
    }

    if (lower.includes('invite') || lower.includes('invitation')) {
      return {
        reply: `💌 **Invitation Draft for ${context.title}**\n\n"You are warmly invited to celebrate with us on ${context.eventDate}!\nJoin us for an unforgettable ${context.eventType} celebration featuring delicious cuisine, joyful music, and cherished moments.\n\nRSVP requested by 3 weeks prior. Dress code: ${context.culturalTheme || 'Celebratory Festive'}."`,
        suggestedActions: ['Create digital RSVP link', 'Adjust invitation tone', 'Export invitation'],
      };
    }

    return {
      reply: `Here is a celebratory verse crafted for "${context.title}":\n\n"Gather friends from near and far,\nUnder lantern light and star.\nCelebrate with joyous cheer,\nFor the milestone of the year!"`,
      suggestedActions: ['Write another verse', 'Refine for programs', 'Print on invitations'],
    };
  }

  // 3. Budget / Cost / Save / Cheap / Expensive
  if (/\b(budget|cost|costs|save|saving|cut|cheap|expensive|price|discount|optimize)\b/i.test(lower)) {
    const perGuest = Math.round(context.totalBudget / Math.max(context.guestCount, 1));
    return {
      reply: `Strategic budget breakdown for "${context.title}" (${context.currency} ${context.totalBudget.toLocaleString()} total, ~${context.currency} ${perGuest}/guest):\n1. Bundle Venue & Production: Inquire if your venue offers preferred AV packages to save 12-18% immediately.\n2. Optimize High-Volume Rentals: Standardize table linens and glassware to avoid premium customization surcharges.\n3. Safeguard Contingency: Maintain an 8-10% reserve (${context.currency} ${Math.round(context.totalBudget * 0.08).toLocaleString()}) for day-of logistical surprises.`,
      suggestedActions: ['Lock Contingency Reserve', 'Review High-Cost Categories', 'Adjust Guest Count'],
    };
  }

  // 4. Catering / Food / Menu / Drinks
  if (/\b(diet|food|menu|catering|drinks|drink|beverage|bar|cocktail|mocktail|plate|tasting)\b/i.test(lower)) {
    const perPlate = Math.round((context.totalBudget * 0.35) / Math.max(context.guestCount, 1));
    const diets = context.dietaryPreferences.length > 0 ? context.dietaryPreferences.join(', ') : 'standard';
    return {
      reply: `For catering "${context.title}" across ${context.guestCount} guests (allocated target: ~${context.currency} ${perPlate}/plate, accounting for ${diets} preferences):\n1. Establish dedicated live interactive counters for specialty items to prevent queue bottlenecks.\n2. Curate 2 signature mocktails/cocktails reflecting your ${context.culturalTheme || 'festive'} theme rather than a costly full open bar.\n3. Demand certified allergen and dietary disclosure sheets from the head caterer 14 days before the event.`,
      suggestedActions: ['Add Dietary Badges to Checklist', 'Schedule Menu Tasting', 'Review Caterer Contract'],
    };
  }

  // 5. Decor / Theme / Vibe / Music / Entertainment
  if (/\b(decor|theme|vibe|music|dj|entertainment|lighting|flowers|floral|sound|ambiance|stage)\b/i.test(lower)) {
    return {
      reply: `Decor & Entertainment recommendations for your ${context.setting} ${context.culturalTheme || 'celebratory'} theme:\n1. Use warm architectural uplighting and kinetic fairy lights—they transform the venue at 1/3 the cost of fresh cut florals.\n2. Curate a 3-stage sound journey: acoustic background during guest arrival, curated playlist through dinner, and high-energy live performance/DJ for the finale.\n3. Incorporate sustainable potted greenery and regional decorative motifs that guests can take home as eco-friendly favors.`,
      suggestedActions: ['Add AV & Sound to Checklist', 'Review Decor Quotes', 'Explore Theme Ideas'],
    };
  }

  // 6. Timeline / Urgent / Next Steps / Schedule
  if (/\b(timeline|urgent|next step|schedule|date|when|milestone|deadline)\b/i.test(lower)) {
    if (daysLeft < 30) {
      return {
        reply: `⚡ Urgent Schedule Priorities (${daysLeft} days remaining — Accelerated Sprint):\n1. Lock signed vendor contracts & initial deposits for Venue and Lead Caterer within 48 hours.\n2. Dispatch digital RSVP links with strict 7-day confirmation deadlines.\n3. Secure municipal noise/sound permits and confirm venue load-in timeframes.`,
        suggestedActions: ['Filter Critical Milestones', 'Send Digital RSVPs', 'Contact Venue Manager'],
      };
    }
    return {
      reply: `Planning Horizon Priorities (${daysLeft} days until ${context.eventDate}):\n1. Finalize your core vendor shortlist and lock in tastings/walkthroughs.\n2. Send Save-the-Date notices to lock in guest availability.\n3. Establish your payment milestone calendar to avoid last-minute cashflow pinches.`,
      suggestedActions: ['Review Vendor Pipeline', 'Schedule Tasting Sessions', 'Draft Invitations'],
    };
  }

  // 7. Venue / Weather / Contracts
  if (/\b(weather|rain|wind|outdoor|marquee|shelter|contract|vendor)\b/i.test(lower)) {
    return {
      reply: `For your ${context.setting} setting and vendor contracts:\n1. Ensure the venue contract includes an explicit waterproof marquee rollover clause with a 48-hour call time.\n2. Verify dual-generator power backup for sound and lighting in case of grid outage.\n3. Confirm explicit cancellation, date-rescheduling, and force-majeure refund percentages across all contracts.`,
      suggestedActions: ['Add Weather Backup to Checklist', 'Review Venue Contract Clause', 'Check Generator Capacity'],
    };
  }

  // 8. Specific Efficiency Score query
  if (/\b(score|efficiency|feasibility)\b/i.test(lower)) {
    return {
      reply: `Your plan for "${context.title}" currently has an efficiency score of ${score}/100 with ${daysLeft} days until the event date. Key factors boosting your score include balanced budget distribution and complete vendor coverage.`,
      suggestedActions: ['Optimize Budget by 10%', 'Review Milestone Timeline', 'Check Checklist Completion'],
    };
  }

  // 9. Any Other Custom Question — Contextual and tailored conversational paragraph
  return {
    reply: `Great question regarding "${userPrompt.slice(0, 60)}" for your upcoming ${context.eventType} ("${context.title}")!\nFor a ${context.setting} event with ${context.guestCount} guests and a budget of ${context.currency} ${context.totalBudget.toLocaleString()}, the key is balancing memorable guest experiences with tight vendor coordination. Let me know if you would like me to draft a specific checklist item, calculate itemized cost estimates, or generate tailored timeline milestones for this!`,
    suggestedActions: ['Explore Personalized Ideas', 'Review Budget Allocation', 'Ask Another Question'],
  };
}

// ─── Response Helpers ──────────────────────────────────────────────────

interface FunctionResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function jsonResponse(statusCode: number, body: Record<string, unknown>, extraHeaders?: Record<string, string>): FunctionResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

// ─── Core Request Processor (exported for testing & Vite middleware) ───

export interface AIPlannerRequest {
  method: string;
  body: string;
  clientIp: string;
}

export async function handleAIPlannerRequest(req: AIPlannerRequest): Promise<FunctionResponse> {
  // ── CORS preflight ─────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  // ── Method check ───────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed. Only POST and OPTIONS are accepted.' });
  }

  // ── Payload size check ─────────────────────────────────────────────
  if (req.body.length > MAX_BODY_SIZE) {
    return jsonResponse(413, { error: 'Payload Too Large. Maximum request body size is 15 KB.' });
  }

  // ── IP Rate Limiting ───────────────────────────────────────────────
  const limiter = getIpLimiter(req.clientIp);
  if (!limiter.consume(1)) {
    return jsonResponse(429, { error: 'Too Many Requests. Please wait before retrying.' }, { 'Retry-After': '60' });
  }

  // ── Parse request body ─────────────────────────────────────────────
  let parsed: {
    action?: string;
    context?: Partial<EventContext>;
    userPrompt?: string;
    planSummary?: { efficiencyScore?: number; daysUntilEvent?: number };
  };
  try {
    parsed = JSON.parse(req.body);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON in request body.' });
  }

  const { action, context, userPrompt, planSummary } = parsed;

  if (!action || !context) {
    return jsonResponse(400, { error: 'Missing required fields: action and context.' });
  }

  // ── Validate EventContext ──────────────────────────────────────────
  const validation = validateEventContext(context);
  if (!validation.valid) {
    return jsonResponse(400, { error: 'Invalid event context.', details: validation.errors });
  }

  // ── Prompt injection scan on user-provided strings ─────────────────
  const stringsToScan = [
    userPrompt,
    context.customNotes,
    context.culturalTheme,
    context.title,
  ].filter((s): s is string => typeof s === 'string' && s.length > 0);

  for (const str of stringsToScan) {
    const injectionCheck = detectPromptInjection(str);
    if (!injectionCheck.isSafe) {
      return jsonResponse(400, {
        error: 'Prompt injection detected.',
        reason: injectionCheck.reason,
      });
    }
  }

  // Sanitize inputs
  const safeContext = {
    ...context,
    title: sanitizeInput(context.title || '', 200),
    culturalTheme: sanitizeInput(context.culturalTheme || '', 300),
    customNotes: sanitizeInput(context.customNotes || '', 2000),
  } as EventContext;

  const safePrompt = userPrompt ? sanitizeInput(userPrompt, 500) : '';

  // ── Determine AI engine mode ───────────────────────────────────────
  const rawKey =
    (typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY) : '') ||
    (globalThis as any).Netlify?.env?.get?.('GEMINI_API_KEY') ||
    (globalThis as any).Netlify?.env?.get?.('VITE_GEMINI_API_KEY') ||
    '';
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');
  const preferredModel =
    (typeof process !== 'undefined' ? process.env?.GEMINI_MODEL : undefined) || 'gemini-2.5-flash';

  let lastModelTried = 'none';
  let lastError: string | null = null;

  // ── Route by action ────────────────────────────────────────────────

  if (action === 'generate_ideas') {
    // Try Gemini first
    if (apiKey) {
      const contextPrompt = `Generate 6 personalized event ideas for this event:
Event Type: ${safeContext.eventType}
Title: ${safeContext.title}
Guest Count: ${safeContext.guestCount}
Budget: ${safeContext.currency} ${safeContext.totalBudget}
Setting: ${safeContext.setting}
City Tier: ${safeContext.cityTier}
Cultural Theme: ${safeContext.culturalTheme || 'Not specified'}
Dietary Preferences: ${(safeContext.dietaryPreferences || []).join(', ') || 'None specified'}
Notes: ${safeContext.customNotes || 'None'}`;

      const fullPrompt = `${IDEAS_SYSTEM_INSTRUCTION}\n\n---\n\n${contextPrompt}`;
      const geminiResult = await callGeminiWithCascade(apiKey, preferredModel, fullPrompt);
      lastModelTried = geminiResult.lastModelTried;
      lastError = geminiResult.lastError;

      if (geminiResult.text && geminiResult.model) {
        try {
          const cleaned = geminiResult.text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed.ideas) && parsed.ideas.length > 0) {
            return jsonResponse(200, {
              ideas: parsed.ideas,
              source: 'netlify_serverless',
              aiMode: 'gemini_live',
              model: geminiResult.model,
              modelUsed: geminiResult.model,
              diagnostics: {
                hasApiKey: Boolean(apiKey),
                keyLength: apiKey.length,
                modelTried: lastModelTried,
                upstreamError: null,
              },
            });
          }
        } catch {
          lastError = lastError || 'Failed to parse JSON ideas from Gemini';
        }
      }
    }

    // Server-side contextual engine fallback
    const ideas = generateContextualIdeas(safeContext);
    return jsonResponse(200, {
      ideas,
      source: 'netlify_serverless',
      aiMode: 'server_contextual_engine',
      fallbackReason: apiKey ? 'gemini_cascade_exhausted' : 'missing_api_key',
      diagnostics: {
        hasApiKey: Boolean(apiKey),
        keyLength: apiKey.length,
        modelTried: lastModelTried,
        upstreamError: lastError || (apiKey ? 'Cascade exhausted' : 'API key not configured'),
      },
    });
  }

  if (action === 'copilot_query') {
    if (!safePrompt) {
      return jsonResponse(400, { error: 'Missing userPrompt for copilot_query action.' });
    }

    // Try Gemini live model cascade if API key is provided
    if (apiKey) {
      const contextPrompt = `User Prompt: ${safePrompt}

Event Context Reference:
- Event Type: ${safeContext.eventType} — "${safeContext.title}"
- Total Budget: ${safeContext.currency} ${safeContext.totalBudget} for ${safeContext.guestCount} guests
- Venue Setting: ${safeContext.setting}, City Tier: ${safeContext.cityTier}
- Cultural Theme: ${safeContext.culturalTheme || 'Not specified'}
- Dietary Preferences: ${(safeContext.dietaryPreferences || []).join(', ') || 'None'}
- Feasibility Score: ${planSummary?.efficiencyScore ?? 'N/A'}/100
- Days Until Event: ${planSummary?.daysUntilEvent ?? 'N/A'}

Instruction: Provide a direct, complete, and engaging response to the User Prompt above.`;

      const fullPrompt = `${COPILOT_SYSTEM_INSTRUCTION}\n\n---\n\n${contextPrompt}`;
      const geminiResult = await callGeminiWithCascade(apiKey, preferredModel, fullPrompt);
      lastModelTried = geminiResult.lastModelTried;
      lastError = geminiResult.lastError;

      if (geminiResult.text && geminiResult.model) {
        let reply = '';
        let suggestedActions: string[] = ['Ask a follow-up question', 'Explore more ideas', 'Save to event notes'];

        try {
          const cleaned = geminiResult.text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          const parsed = JSON.parse(cleaned);

          if (typeof parsed === 'string') {
            reply = parsed;
          } else if (parsed && typeof parsed.reply === 'string') {
            reply = parsed.reply;
            if (Array.isArray(parsed.suggestedActions) && parsed.suggestedActions.length > 0) {
              suggestedActions = parsed.suggestedActions.map((s: unknown) => String(s));
            }
          } else if (parsed && typeof parsed.response === 'string') {
            reply = parsed.response;
          } else if (parsed && typeof parsed.message === 'string') {
            reply = parsed.message;
          } else if (parsed && typeof parsed.text === 'string') {
            reply = parsed.text;
          } else if (parsed && typeof parsed.content === 'string') {
            reply = parsed.content;
          } else if (parsed && typeof parsed === 'object') {
            const firstString = Object.values(parsed).find((v) => typeof v === 'string');
            reply = firstString ? String(firstString) : cleaned;
          }
        } catch {
          // If Gemini output was plain text (e.g. haiku, verse, or freeform response), use it directly!
          reply = geminiResult.text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        }

        if (reply) {
          return jsonResponse(200, {
            reply,
            suggestedActions,
            source: 'netlify_serverless',
            aiMode: 'gemini_live',
            model: geminiResult.model,
            modelUsed: geminiResult.model,
            diagnostics: {
              hasApiKey: Boolean(apiKey),
              keyLength: apiKey.length,
              modelTried: lastModelTried,
              upstreamError: null,
            },
          });
        }
      }
    }

    // Server-side contextual engine fallback (only when API key is missing or cascade fails)
    const result = generateServerCopilotReply(safeContext, safePrompt, planSummary);
    return jsonResponse(200, {
      ...result,
      source: 'netlify_serverless',
      aiMode: 'server_contextual_engine',
      fallbackReason: apiKey ? 'gemini_cascade_exhausted' : 'missing_api_key',
      diagnostics: {
        hasApiKey: Boolean(apiKey),
        keyLength: apiKey.length,
        modelTried: lastModelTried,
        upstreamError: lastError || (apiKey ? 'Cascade exhausted' : 'API key not configured'),
      },
    });
  }

  return jsonResponse(400, { error: `Unknown action: ${action}. Supported: generate_ideas, copilot_query.` });
}

// ─── Netlify Functions v2 Handler ──────────────────────────────────────

export default async function handler(request: Request): Promise<Response> {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('client-ip')
    || 'unknown';

  let body = '';
  try {
    body = await request.text();
  } catch {
    body = '';
  }

  const result = await handleAIPlannerRequest({
    method: request.method,
    body,
    clientIp,
  });

  return new Response(result.body, {
    status: result.statusCode,
    headers: result.headers,
  });
}
