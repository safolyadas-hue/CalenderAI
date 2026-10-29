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

const MODEL_CASCADE = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];

async function callGemini(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userPrompt: string
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const runAttempt = async (useJsonMime: boolean): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const generationConfig: Record<string, unknown> = {
        temperature: 0.7,
        maxOutputTokens: 2048,
      };
      if (useJsonMime) {
        generationConfig.responseMimeType = 'application/json';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        // If 400 with JSON mime, retry once without JSON mime constraint
        if (useJsonMime && response.status === 400) {
          return runAttempt(false);
        }
        return null;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return typeof text === 'string' && text.trim().length > 0 ? text : null;
    } catch {
      return null;
    }
  };

  return runAttempt(true);
}

async function callGeminiWithCascade(
  apiKey: string,
  preferredModel: string,
  systemInstruction: string,
  userPrompt: string
): Promise<{ text: string; model: string } | null> {
  // Try preferred model first, then cascade across all free-tier models
  const modelsToTry = [preferredModel, ...MODEL_CASCADE.filter((m) => m !== preferredModel)];

  for (const model of modelsToTry) {
    const result = await callGemini(apiKey, model, systemInstruction, userPrompt);
    if (result) {
      return { text: result, model };
    }
  }
  return null;
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
  const lower = userPrompt.toLowerCase();
  const score = planSummary?.efficiencyScore ?? 70;
  const daysLeft = planSummary?.daysUntilEvent ?? 90;

  if (lower.includes('budget') || lower.includes('cut') || lower.includes('save') || lower.includes('cost')) {
    const perGuest = Math.round(context.totalBudget / Math.max(context.guestCount, 1));
    return {
      reply: `Based on your ${context.currency} ${context.totalBudget.toLocaleString()} total budget for ${context.guestCount} guests (${context.currency} ${perGuest}/guest), to safely optimize expenses:\n1. Re-negotiate venue packages by bundling AV/sound or off-peak hours (saves ~10-15%).\n2. Switch cut florals to sustainable potted arrangements or ambient lighting.\n3. Keep the Contingency Reserve locked at 8-10% to protect against unexpected costs.`,
      suggestedActions: ['Lock Contingency Reserve', 'Review Vendor Quotes', 'Adjust Guest Count'],
    };
  } else if (lower.includes('weather') || lower.includes('rain') || lower.includes('outdoor')) {
    return {
      reply: `For your ${context.setting} setting (${context.culturalTheme || 'Standard'} theme):\n1. Ensure the venue contract includes an explicit waterproof marquee or indoor hall rollover clause.\n2. Verify dual-generator power backup for sound and lighting in case of grid outage.\n3. Deploy covered misting fans or radiant patio heaters depending on the season.`,
      suggestedActions: ['Add Weather Backup to Checklist', 'Review Venue Contract Clause', 'Check Generator Capacity'],
    };
  } else if (lower.includes('timeline') || lower.includes('urgent') || lower.includes('schedule')) {
    if (daysLeft < 30) {
      return {
        reply: `⚡ Urgent Schedule Alert: With only ${daysLeft} days remaining, you are in an Accelerated Sprint. Focus immediately on:\n1. Locking Venue & Caterer deposits within 48 hours.\n2. Sending digital invitations with instant RSVP links.\n3. Finalizing municipal/sound permits if applicable.`,
        suggestedActions: ['Filter Critical Milestones', 'Send Digital RSVPs', 'Contact Venue Manager'],
      };
    }
    return {
      reply: `You have ${daysLeft} days until the event — your planning horizon is on track. Your current priority is completing vendor selections and confirming bookings before peak seasonal rate spikes.`,
      suggestedActions: ['Review Vendor Pipeline', 'Schedule Tasting Sessions', 'Draft Invitations'],
    };
  } else if (lower.includes('diet') || lower.includes('food') || lower.includes('menu') || lower.includes('catering')) {
    const diets = context.dietaryPreferences.length > 0 ? context.dietaryPreferences.join(', ') : 'standard';
    return {
      reply: `For your menu catering to ${diets} preferences across ${context.guestCount} guests:\n1. Designate segregated prep and serving counters with visible dietary icon markers.\n2. Implement live chef-crafted stations to maximize freshness and reduce food waste by 25%.\n3. Require the head caterer to provide allergen disclosure sheets before final payment.`,
      suggestedActions: ['Add Dietary Badges to Checklist', 'Schedule Menu Tasting', 'Confirm Plate Minimums'],
    };
  } else if (lower.includes('contract') || lower.includes('vendor')) {
    return {
      reply: `Key clauses to verify across all vendor contracts:\n1. Explicit cancellation, date-rescheduling, and force-majeure refund percentages.\n2. Specific arrival, sound-check, and teardown buffer times.\n3. Backup staff or equipment replacement guarantees in case of emergencies.`,
      suggestedActions: ['Inspect Vendor Checklist', 'Add Deposit Dates to Timeline', 'Verify FSSAI/Insurance'],
    };
  }

  return {
    reply: `CalenderAI Server Assistant: Your plan for "${context.title}" has an efficiency score of ${score}/100 with ${daysLeft} days until the event. I can help optimize your ${context.currency} ${context.totalBudget.toLocaleString()} budget, organize vendor contracts, adapt your timeline, or tailor ideas for your ${context.culturalTheme || 'custom'} theme.`,
    suggestedActions: ['Optimize Budget by 10%', 'Review Weather Contingency', 'Check Urgent Milestones'],
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
  const apiKey = typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || '') : '';
  const preferredModel = typeof process !== 'undefined' ? (process.env?.GEMINI_MODEL || 'gemini-3.8-flash') : 'gemini-3.8-flash';

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

      const geminiResult = await callGeminiWithCascade(apiKey, preferredModel, IDEAS_SYSTEM_INSTRUCTION, contextPrompt);
      if (geminiResult && geminiResult.text) {
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
            });
          }
        } catch {
          // Gemini returned non-JSON ideas, fall through to contextual engine
        }
      }
    }

    // Server-side contextual engine fallback
    const ideas = generateContextualIdeas(safeContext);
    return jsonResponse(200, {
      ideas,
      source: 'netlify_serverless',
      aiMode: 'server_contextual_engine',
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

      const geminiResult = await callGeminiWithCascade(apiKey, preferredModel, COPILOT_SYSTEM_INSTRUCTION, contextPrompt);
      if (geminiResult && geminiResult.text) {
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
