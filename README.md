# CalenderAI — GenAI-Powered Event & Milestone Planning Assistant

[![PromptWars Virtual](https://img.shields.io/badge/PromptWars-Virtual%20Challenge-indigo.svg)](https://github.com/safolyadas-hue/CalenderAI)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%207.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.3-cyan.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.3-38bdf8.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-48%2F48%20Passing-emerald.svg)](https://vitest.dev/)
[![WCAG](https://img.shields.io/badge/WCAG-2.1%20AA%20Compliant-purple.svg)](https://www.w3.org/WAI/standards-guidelines/wcag/)
[![Bundle Size](https://img.shields.io/badge/Bundle-~103%20KB%20gzipped-success.svg)](#)

> **Repository:** [https://github.com/safolyadas-hue/CalenderAI](https://github.com/safolyadas-hue/CalenderAI)  
> **Problem Statement:** *"Create a GenAI-powered planning assistant that helps users organize weddings, birthdays, and community events with budgets, timelines, vendor checklists, and personalized ideas."*

---

## 1. Chosen Vertical & Persona Architecture

CalenderAI specializes in **Personal Milestone & Community Event Management**, spanning three distinct personas with dedicated algorithmic heuristics, risk calculators, and compliance checklists:

| Vertical Persona | Primary Audience & Scale | Heuristic Focus | Regulatory & Safety Demands |
|---|---|---|---|
| 💍 **Wedding Architect** | Couples & families (100–500+ guests; multi-lakh / high budgets) | Venue aesthetics, multi-vendor coordination, high-lead-time milestones (6–12 months), guest hospitality tiers | Vendor cancellation clauses, force-majeure rescheduling, catering tasting deadlines |
| 🎂 **Birthday Celebration Planner** | Parents, friends, milestone celebrants (10–100 guests; fixed/compact budgets) | Entertainment pacing, age-appropriate activities, personalized memory elements, custom cake logistics | Allergen & dietary disclosures for kids/adults, decoration safety policies |
| 🤝 **Community Event Organizer** | Neighborhood associations, non-profits, civic clubs (100–1,000+ attendees; strict public accountability) | Crowdsourced budgets, staging/AV throughput, public safety, volunteer coordination | Municipal NOCs, sound decibel permits, emergency medical exits, public liability |

---

## 2. Approach and Decision-Making Logic

CalenderAI pairs a **deterministic mathematical decision engine** (`src/engines/decisionEngine.ts`) with a **secure GenAI cascade layer** (`netlify/functions/ai-planner.ts`) so plans are mathematically sound, legally vetted, and creatively personalized.

```
+---------------------------------------------------------------------------------------+
|                                  CALENDER-AI ENGINE                                   |
+---------------------------------------------------------------------------------------+
|  User Context: Event Type | City Tier | Venue Setting | Budget | Guests | Date       |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                       1. CONTEXT-WEIGHTED BUDGET ALLOCATION                           |
|  - Baseline persona weights + dynamic condition shifts (+4% Weather for Outdoor)     |
|  - Tier-1 Metro price adjustments (+5% Venue cost scale)                              |
|  - Per-Guest budget adequacy benchmarks & locked-category proportional rebalancing     |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                    2. BACKWARD-HORIZON DYNAMIC TIMELINE SCHEDULING                    |
|  - Milestones scheduled backward from Event Date (Days Before Event)                 |
|  - Compressed Sprint Detection: if < 30 days, re-scales lead times & flags risks      |
|  - Critical path dependency warnings for venue, caterer, permits & deposit dates      |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                      3. VENDOR & CONTRACT COMPLIANCE ENGINE                           |
|  - Persona-specific vendor shortlists with min-max cost estimation bands               |
|  - Mandatory contractual clauses (rain roll-over, municipal NOC, power backup)       |
|  - High-yield vetting questions to prevent hidden fees & deposit disputes             |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                         4. DUAL-ENGINE GENAI & IDEATION                               |
|  - Netlify Serverless Function (/api/ai-planner) -> Gemini Flash Cascade              |
|  - Server-Side & Client-Side Deterministic Fallback: always returns 200 uptime        |
+---------------------------------------------------------------------------------------+
```

### Algorithmic Highlights

1. **Proportional Locked-Category Rebalancing (`rebalanceBudget`)**:
   When a user modifies a category amount, CalenderAI keeps locked categories static and proportionally redistributes the remainder across all unlocked categories:
   $$\text{NewWeight}_i = \text{CurrentWeight}_i \times \frac{\text{Budget} - \sum \text{LockedAmounts}}{\sum \text{UnlockedAmounts}}$$
   This guarantees that the sum of all allocated categories always equals exactly 100% of the total budget.

2. **Accelerated Planning Sprint Compression**:
   If the event is fewer than 30 days away, `generateDynamicTimeline` proportionally compresses template lead times into the remaining window and automatically injects critical dependency warnings (`⚠️ Accelerated schedule: High-lead-time task requires immediate action`).

3. **Adequacy Scoring & Real-Time Risk Alerts**:
   Per-guest budget calculations evaluate whether allocated funds meet city-tier minimums (e.g. ₹1,500/guest in Tier-1 Metro weddings). If allocations drop below baseline thresholds, live `aria-live="polite"` warning banners alert the user before deposits are committed.

---

## 3. How the Solution Works (Architecture & User Flow)

### System Architecture

```
+-----------------------------------------------------------------------------+
|                            CLIENT BROWSER (Vite + React 19)                 |
|  Accessible UI (WCAG 2.1 AA) | Theme Accents | LocalStorage State Cache     |
+-----------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                     CLIENT SECURITY & RESILIENCE LAYER                      |
|  sanitizeInput() (XSS) | detectPromptInjection() | LRUCache (10-min TTL)    |
|  Client Token-Bucket RateLimiter (12 req/min burst)                         |
+-----------------------------------------------------------------------------+
                                      |
                     POST /api/ai-planner (JSON Payload)
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                      SERVERLESS BACKEND LAYER                               |
|  Netlify Functions v2 (netlify/functions/ai-planner.ts)                     |
|  - Vite Dev Middleware Plugin for instant zero-config local development    |
|  - IP-based Rate Limiter (15 req/min) & Payload Guard (max 15 KB)           |
|  - Server-side EventContext Schema Validation & Injection Guard             |
+-----------------------------------------------------------------------------+
           |                                                      |
    (GEMINI_API_KEY present)                              (Offline / Fallback)
           v                                                      v
+---------------------------------------+        +----------------------------+
|        GEMINI MODEL CASCADE           |        | SERVER CONTEXTUAL ENGINE   |
| 1. gemini-3.8-flash (Default)         |  FAIL  | Deterministic rule-based   |
| 2. gemini-3.5-flash-lite (Fallback)   | -----> | generator using user-level |
| 3. gemini-2.5-flash (Emergency)       |        | budget, setting & theme    |
+---------------------------------------+        +----------------------------+
           |                                                      |
           +--------------------------+---------------------------+
                                      |
                         HTTP 200 OK Response Payload
                                      v
                     Header Badge: "Netlify AI Online"
```

### Interactive User Modules

1. **Header & Persona Switcher**: Instant switching between Wedding, Birthday, and Community Event; 1-click evaluator preset loader; export plan to JSON or structured Markdown checklist.
2. **Context Configurator**: Real-time context controls for Guest Count, Currency (INR/USD), City Tier, Venue Setting (Indoor/Outdoor/Hybrid), Dietary Tags, Cultural Themes, and 1-click **14-Day Sprint** evaluator testing.
3. **Smart Budget Planner**: Multi-segment progress bar distribution, category lock toggles, slider/input adjustments with proportional rebalancing, and actual spend tracking.
4. **Dynamic Timeline Scheduler**: Chronological milestone pipeline with phase badges, interactive completion checkboxes, critical dependency warnings, and custom milestone addition.
5. **Vendor Checklist**: Persona-specific vendor cards with budget-scaled cost ranges, vetting interview questions, and contractual agreement checklist (weather clauses, insurance, permits).
6. **Personalized Ideas Hub & AI Co-Pilot**: 6 curated contextual ideas across 4 categories (Theme & Decor, Food & Beverage, Guest Experience, Sustainability & Cost-Saving) + interactive conversational Co-Pilot with prompt injection security guards.

---

## 4. Assumptions Made

1. **Dual-Currency & Regional Purchasing Power**:
   Supports Indian Rupee (`INR`) and US Dollar (`USD`). City tiers (`tier1_metro`, `tier2_urban`, `tier3_town`) dynamically scale cost minimums to reflect realistic local vendor pricing.
2. **Mandatory 5–10% Emergency Contingency**:
   Every generated budget enforces an untouchable Contingency Reserve (5–10%) to protect against vendor price revisions, overtime surcharges, and weather emergencies.
3. **Zero-Config Evaluator Experience**:
   Evaluators running `npm run dev` locally do **NOT** need a Gemini API key. The built-in Vite server middleware and dual-engine architecture gracefully handle all requests via the local context engine with 100% feature availability. When deployed to Netlify with `GEMINI_API_KEY`, it seamlessly elevates to live Gemini Flash generation.
4. **Zero Binary Artifact Policy**:
   The repository contains zero raster/binary image assets to ensure maximum load speed, negligible repository weight (< 500 KB), and complete reliance on scalable SVG icon primitives (`lucide-react`).

---

## 5. Evaluation Focus Areas Alignment Matrix

| Evaluation Pillar | Priority | Implementation in CalenderAI | Key File References |
|---|---|---|---|
| **Problem Statement Alignment** | **HIGH** | Dedicated GenAI planning assistant covering budgets, dynamic timelines, vendor contracts, and ideas for Weddings, Birthdays, and Community Events. | [`src/types/event.ts`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/types/event.ts)<br>[`src/App.tsx`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/App.tsx) |
| **Code Quality & Modularity** | **HIGH** | Strict TypeScript 7.0 (`noEmit`, `verbatimModuleSyntax`, `erasableSyntaxOnly`), clean component decomposition (< 250 lines/file), pure mathematical engine separation. | [`src/engines/decisionEngine.ts`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/engines/decisionEngine.ts)<br>[`src/components/`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/components/) |
| **Security Architecture** | **MEDIUM** | Strict XSS sanitization (`sanitizeInput`), multi-pattern prompt injection defense (`detectPromptInjection`), server-side IP rate limiting (15 req/min), 15 KB payload guards, server-only API keys, CSP & HTTP security headers. | [`src/utils/security.ts`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/utils/security.ts)<br>[`netlify/functions/ai-planner.ts`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/netlify/functions/ai-planner.ts)<br>[`netlify.toml`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/netlify.toml) |
| **Efficiency & Bundle Size** | **MEDIUM** | Lightweight LRU cache (10-min TTL), client token-bucket rate limiter, zero raster images, Tailwind CSS v4, total production bundle **~103 KB gzipped** (< 350 KB uncompressed). | [`src/utils/cache.ts`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/utils/cache.ts)<br>[`dist/`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/dist/) |
| **Testing Coverage** | **MEDIUM** | 48 automated Vitest unit & integration tests across 4 test suites verifying decision algorithms, serverless function endpoints, security vectors, cache eviction, and React UI rendering. | [`src/__tests__/decisionEngine.test.ts`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/__tests__/decisionEngine.test.ts)<br>[`src/__tests__/netlifyFunction.test.ts`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/__tests__/netlifyFunction.test.ts)<br>[`src/__tests__/securityAndCache.test.ts`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/__tests__/securityAndCache.test.ts)<br>[`src/__tests__/App.integration.test.tsx`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/__tests__/App.integration.test.tsx) |
| **Accessibility (WCAG 2.1 AA)** | **LOW / POLISH** | "Skip to main content" link, semantic landmarks (`header`, `main`, `nav`), `aria-pressed`, `aria-live="polite"` status announcements, `role="progressbar"`, and high-contrast light mode palette. | [`src/components/Header.tsx`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/components/Header.tsx)<br>[`src/components/ContextConfigurator.tsx`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/components/ContextConfigurator.tsx)<br>[`src/components/BudgetPlanner.tsx`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/src/components/BudgetPlanner.tsx) |

---

## 6. Local Development, Testing & Deployment Guide

### Prerequisites
- Node.js 18+ (tested on Node 20 / 22)
- npm 9+

### Quick Start (Local Development)

```bash
# 1. Clone repository
git clone https://github.com/safolyadas-hue/CalenderAI.git
cd CalenderAI

# 2. Install dependencies
npm install

# 3. Start local Vite development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173). The local Vite server includes an integrated API middleware plugin that routes `/api/ai-planner` requests locally without needing the Netlify CLI.

### Running Test Suites

```bash
# Run all 48 unit & integration tests
npm run test
```

### Production Build Validation

```bash
# Typecheck & build production bundle
npm run build
```

### Netlify Deployment

1. Connect the GitHub repository `safolyadas-hue/CalenderAI` to Netlify.
2. Netlify will automatically detect [`netlify.toml`](file:///c:/Users/Safolya%20Das/Desktop/Pprompt/CalenderAI/netlify.toml) with build command `npm run build` and publish directory `dist`.
3. In **Site Configuration > Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `GEMINI_MODEL`: *(Optional)* `gemini-3.8-flash` (default).

---

## 7. License

MIT License. Built with ❤️ for the PromptWars Virtual Challenge.
