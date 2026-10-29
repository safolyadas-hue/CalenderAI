import type { EventContext } from '../types/event';

/**
 * Sanitizes user input by stripping dangerous HTML, script blocks,
 * inline event handlers, dangerous URI schemes, and control characters.
 *
 * @param input - Raw user input string
 * @param maxLength - Maximum allowed length (default: 2000)
 * @returns Sanitized string safe for rendering and processing
 */
export function sanitizeInput(input: string, maxLength: number = 2000): string {
  if (typeof input !== 'string') return '';

  let sanitized = input;

  // Remove <script> blocks (including content)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove all HTML tags
  sanitized = sanitized.replace(/<\/?[^>]+(>|$)/g, '');

  // Remove inline event handlers (onerror=, onload=, onclick=, etc.)
  sanitized = sanitized.replace(/\bon\w+\s*=\s*(['"]?)[^'"]*\1/gi, '');

  // Remove dangerous URI schemes
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/data\s*:/gi, '');
  sanitized = sanitized.replace(/vbscript\s*:/gi, '');

  // Remove control characters (except newline, tab, carriage return)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim and enforce max length
  sanitized = sanitized.trim().slice(0, maxLength);

  return sanitized;
}

/**
 * Detects adversarial prompt injection patterns commonly used to
 * jailbreak LLM assistants.
 *
 * @param input - User input to analyze
 * @returns Object indicating safety and optional reason if unsafe
 */
export function detectPromptInjection(input: string): {
  isSafe: boolean;
  reason?: string;
} {
  if (typeof input !== 'string' || input.length === 0) {
    return { isSafe: true };
  }

  const lowerInput = input.toLowerCase();

  // Adversarial jailbreak patterns
  const injectionPatterns: { pattern: RegExp; reason: string }[] = [
    {
      pattern: /ignore\s+(all\s+)?previous\s+(instructions|prompts|rules)/i,
      reason: 'Attempted to override system instructions',
    },
    {
      pattern: /system\s+prompt/i,
      reason: 'Attempted to access system prompt',
    },
    {
      pattern: /reveal\s+(your|the)\s+(instructions|prompt|system)/i,
      reason: 'Attempted to extract system instructions',
    },
    {
      pattern: /act\s+as\s+(DAN|an?\s+unrestricted|an?\s+unfiltered)/i,
      reason: 'Attempted DAN/unrestricted mode jailbreak',
    },
    {
      pattern: /do\s+anything\s+now/i,
      reason: 'Attempted DAN jailbreak',
    },
    {
      pattern: /you\s+are\s+now\s+(in\s+)?developer\s+mode/i,
      reason: 'Attempted developer mode jailbreak',
    },
    {
      pattern: /pretend\s+(you\s+)?(are|have)\s+no\s+(restrictions|rules|limits)/i,
      reason: 'Attempted restriction bypass',
    },
    {
      pattern: /system\s+override/i,
      reason: 'Attempted system override pattern',
    },
    {
      pattern: /bypass\s+(security|rules|restrictions|filters)/i,
      reason: 'Attempted security bypass pattern',
    },
    {
      pattern: /(print|output|dump|reveal|show)\s+(api[_\s]?key|credentials|secret|token)/i,
      reason: 'Attempted credential extraction',
    },
    {
      pattern: /(\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b|\bUNION\s+SELECT\b)/i,
      reason: 'SQL injection pattern detected',
    },
    {
      pattern: /<script\b/i,
      reason: 'Script injection pattern detected',
    },
    {
      pattern: /\{\{.*\}\}/,
      reason: 'Template injection pattern detected',
    },
    {
      pattern: /\$\{.*\}/,
      reason: 'Template literal injection pattern detected',
    },
  ];

  for (const { pattern, reason } of injectionPatterns) {
    if (pattern.test(input)) {
      return { isSafe: false, reason };
    }
  }

  // Check for excessive special character density (potential obfuscation)
  const specialCharCount = (lowerInput.match(/[^a-z0-9\s.,!?'"()-]/g) || []).length;
  const specialCharRatio = specialCharCount / Math.max(lowerInput.length, 1);
  if (specialCharRatio > 0.4 && lowerInput.length > 20) {
    return { isSafe: false, reason: 'Suspicious character density — possible obfuscated injection' };
  }

  return { isSafe: true };
}

/**
 * Validates an EventContext object for data integrity and safety.
 *
 * @param ctx - Partial EventContext to validate
 * @returns Validation result with list of errors
 */
export function validateEventContext(
  ctx: Partial<EventContext>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Budget validation
  if (ctx.totalBudget !== undefined) {
    if (typeof ctx.totalBudget !== 'number' || ctx.totalBudget <= 0) {
      errors.push('Total budget must be a positive number');
    }
    if (ctx.totalBudget > 1_000_000_000) {
      errors.push('Total budget exceeds maximum allowed value (1 billion)');
    }
  }

  // Guest count validation
  if (ctx.guestCount !== undefined) {
    if (typeof ctx.guestCount !== 'number' || !Number.isInteger(ctx.guestCount)) {
      errors.push('Guest count must be a whole number');
    } else if (ctx.guestCount < 1) {
      errors.push('Guest count must be at least 1');
    } else if (ctx.guestCount > 100_000) {
      errors.push('Guest count cannot exceed 100,000');
    }
  }

  // Date validation (ISO YYYY-MM-DD)
  if (ctx.eventDate !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(ctx.eventDate)) {
      errors.push('Event date must be in ISO YYYY-MM-DD format');
    } else {
      const parsed = new Date(ctx.eventDate);
      if (isNaN(parsed.getTime())) {
        errors.push('Event date is not a valid date');
      }
    }
  }

  // Title length
  if (ctx.title !== undefined && ctx.title.length > 200) {
    errors.push('Title must be 200 characters or fewer');
  }

  // Cultural theme length
  if (ctx.culturalTheme !== undefined && ctx.culturalTheme.length > 300) {
    errors.push('Cultural theme must be 300 characters or fewer');
  }

  // Custom notes length
  if (ctx.customNotes !== undefined && ctx.customNotes.length > 2000) {
    errors.push('Custom notes must be 2000 characters or fewer');
  }

  // Dietary preferences validation
  if (ctx.dietaryPreferences !== undefined) {
    if (!Array.isArray(ctx.dietaryPreferences)) {
      errors.push('Dietary preferences must be an array');
    } else if (ctx.dietaryPreferences.length > 20) {
      errors.push('Maximum of 20 dietary preferences allowed');
    } else {
      for (const pref of ctx.dietaryPreferences) {
        if (typeof pref !== 'string' || pref.length > 100) {
          errors.push('Each dietary preference must be a string of 100 characters or fewer');
          break;
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Token Bucket rate limiter for throttling excessive requests.
 * Prevents abuse of AI-powered features.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  /**
   * @param maxTokens - Maximum tokens in the bucket (burst capacity)
   * @param refillRate - Tokens added per second
   */
  constructor(
    maxTokens: number = 10,
    refillRate: number = 2
  ) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Refills the bucket based on elapsed time since last refill.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  /**
   * Attempts to consume a token. Returns true if the request is allowed.
   *
   * @param cost - Number of tokens to consume (default: 1)
   * @returns true if request is within rate limits
   */
  consume(cost: number = 1): boolean {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  /**
   * Returns the number of tokens currently available.
   */
  get availableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Resets the rate limiter to full capacity.
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}
