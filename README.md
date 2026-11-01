# CalenderAI — GenAI-Powered Event & Milestone Planning Assistant

**Repository:** `https://github.com/safolyadas-hue/CalenderAI`  
**Stack:** React 19 • TypeScript • Vite • Tailwind CSS v4 • Netlify Serverless Functions • Google Gemini (`gemini-3.8-flash`) • Vitest

---

## 1. Chosen Vertical & Persona Architecture

**CalenderAI** targets the **Personal Milestone & Community Event Management Vertical**, engineered around three specialized domain personas that dynamically reconfigure budget weights, timeline lead times, vendor compliance checklists, and AI ideation:

1. **Wedding Architect (`wedding`)**: Optimized for multi-day cultural celebrations (e.g., Royal Rajasthani / Destination & Traditional Weddings), prioritizing high-capacity catering, venue logistics, decor & floral installation, photography, and guest hospitality.
2. **Birthday Celebration Planner (`birthday`)**: Tailored for milestone parties (e.g., 21st Rooftop / Thematic Celebrations), emphasizing entertainment, experiential decor, custom F&B packages, and agile short-horizon scheduling.
3. **Community Event Organizer (`community`)**: Built for public fundraisers, tech fests, and civic gatherings, incorporating stage/AV production, municipal NOC permits, crowd safety compliance, sponsor management, and volunteer coordination.

---

## 2. Approach and Decision-Making Logic

CalenderAI combines a deterministic **Contextual Decision Engine** (`src/engines/decisionEngine.ts`) with a **Serverless GenAI Co-Pilot** (`netlify/functions/ai-planner.ts`):

- **Context-Weighted Smart Budget Allocation (`calculateSmartBudget`)**:
  - Starts from vertical-specific base percentage weights and dynamically shifts allocations based on venue setting and city tier (e.g., automatic **+4% Weather Backup & Marquee Reserve** for `outdoor` events and **+5% Venue/Logistics shift** for `Tier-1 Metro` locations).
  - Computes real-time per-guest adequacy thresholds in `INR` and `USD` and generates automated **Risk Alerts** and an **Efficiency Score (0–100)**.
- **Proportional Locked-Category Rebalancing (`rebalanceBudget`)**:
  - Allows users to lock priority budget categories while proportionally redistributing increases or reductions across unlocked categories so total allocation strictly equals 100%.
- **Backward-Horizon Dynamic Timeline Scheduling (`generateDynamicTimeline`)**:
  - Calculates milestone due dates backward from the target `eventDate`.
  - Automatically triggers **Accelerated Urgent Sprint Mode** when the event is `< 30 days` away, flagging critical-path vendor dependencies (`dependencyWarning`).
- **Context-Aware Vendor & Compliance Engine (`generateVendorChecklist`)**:
  - Generates scaled cost estimation bands (`estimatedCostMin` – `estimatedCostMax`), booking status trackers, and context-specific contract clauses (force majeure weather clauses for outdoor venues; municipal sound/fire NOC checklists for community events).
- **Dual-Engine GenAI Architecture (`gemini-3.8-flash` + Deterministic Fallback)**:
  - Routes creative ideation and Co-Pilot queries through `/api/ai-planner` to Google's latest **`gemini-3.8-flash`** model (`gemini-3.5-flash-lite` backup), paired with a multi-intent contextual fallback engine so the application remains 100% functional even offline or without API keys.

---

## 3. How the Solution Works (Architecture & User Flow)

```text
+-------------------------------------------------------------------------+
| React 19 Accessible Workspace UI (WCAG 2.1 AA, Tabbed Modules, Presets) |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| Client Security & Efficiency Layer (src/utils/security.ts & cache.ts)   |
| - XSS Input Sanitization & Prompt-Injection Guard                       |
| - Deterministic FNV-1a Hash Key + TTL LRU Response Cache                |
+------------------------------------+------------------------------------+
                                     | POST /api/ai-planner
                                     v
+-------------------------------------------------------------------------+
| Netlify Serverless Function (netlify/functions/ai-planner.ts)           |
| - Per-IP Rate Limiter (20 req/min) & Server-Side Schema Validation      |
| - Strict HTTP Security Headers (CSP, X-Frame-Options, nosniff)          |
| - Upstream Gemini 3.8 Flash Call (Server-only GEMINI_API_KEY)           |
+-------------------------------------------------------------------------+