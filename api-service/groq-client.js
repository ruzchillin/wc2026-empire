/**
 * WC 2026 Sports Empire — Shared Groq Client
 * ============================================
 * Drop-in wrapper around the Groq SDK that automatically:
 *   1. Checks groq-budget-guard BEFORE calling Groq
 *   2. Reports actual token usage AFTER the call
 *   3. Returns a fallback from groq-fallback-templates.js if budget is denied
 *
 * Usage (replace direct Groq calls in any engine):
 *
 *   // OLD:
 *   const Groq = require('groq-sdk');
 *   const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
 *   const res = await groq.chat.completions.create({ model, messages, ... });
 *   const text = res.choices[0].message.content;
 *
 *   // NEW (one line change):
 *   const groqClient = require('./groq-client');
 *   const text = await groqClient.complete({ engine: 'twitter', eventType: 'GOAL', data, messages });
 *
 * The wrapper is backwards-compatible — if the budget guard is unreachable it
 * falls through to Groq directly (fail-open, never drops content).
 */

'use strict';

require('dotenv').config();
const Groq = require('groq-sdk');
const http = require('http');
const https = require('https');

const { getFallback, getFallbackForPlatform } = require('./groq-fallback-templates');

// ─── Config ───────────────────────────────────────────────────────────────────

const GROQ_API_KEY   = process.env.GROQ_API_KEY;
const BUDGET_URL     = process.env.GROQ_BUDGET_URL || 'http://localhost:3036';
const DEFAULT_MODEL  = 'llama3-70b-8192';

// Groq SDK instance (lazy — only created on first actual call)
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: GROQ_API_KEY });
  return _groq;
}

// ─── Budget guard HTTP helpers ─────────────────────────────────────────────────

function budgetPost(path, body) {
  return new Promise((resolve) => {
    const json = JSON.stringify(body);
    const url  = new URL(BUDGET_URL + path);
    const proto = url.protocol === 'https:' ? https : http;

    const req = proto.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) },
      timeout: 3000,  // never block content on slow budget guard
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, body: JSON.parse(data) }); }
        catch { resolve({ ok: false, body: {} }); }
      });
    });
    req.on('error', () => resolve({ ok: false, body: {} }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, body: {} }); });
    req.write(json);
    req.end();
  });
}

// ─── Token estimator ─────────────────────────────────────────────────────────

function estimateTokens(messages, maxTokens = 300) {
  const chars = messages.reduce((sum, m) => sum + (m.content || '').length, 0);
  return Math.ceil(chars / 4) + maxTokens; // rough: 4 chars per token
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * groqClient.complete(options) → string
 *
 * @param {object}   options
 * @param {string}   options.engine        - engine name (e.g. 'twitter', 'commentary')
 * @param {string}   options.eventType     - event type (e.g. 'GOAL')
 * @param {object}   [options.data]        - event data (passed to fallback templates)
 * @param {Array}    options.messages      - Groq chat messages array
 * @param {string}   [options.model]       - defaults to llama3-70b-8192
 * @param {number}   [options.maxTokens]   - defaults to 300
 * @param {number}   [options.temperature] - defaults to 0.8
 * @param {string}   [options.platform]    - if set, truncates fallback for platform char limits
 * @returns {Promise<string>}              - generated text (or fallback)
 */
async function complete(options) {
  const {
    engine      = 'unknown',
    eventType   = 'GOAL',
    data        = {},
    messages,
    model       = DEFAULT_MODEL,
    temperature = 0.8,
    platform    = null,
  } = options;
  // Accept both camelCase (maxTokens) and snake_case (max_tokens) from callers
  const maxTokens = options.maxTokens ?? options.max_tokens ?? 300;

  if (!messages || !messages.length) {
    throw new Error('[groq-client] messages array is required');
  }

  const estimatedTokens = estimateTokens(messages, maxTokens);

  // ── Step 1: Request budget allocation ────────────────────────────────────
  let approved = true;
  let fallbackText = null;

  try {
    const result = await budgetPost('/tokens/request', {
      engine,
      estimatedTokens,
      eventType,
      data,
    });

    if (result.ok && result.body.approved === false) {
      approved = false;
      fallbackText = result.body.fallbackText || null;
      console.warn(`[groq-client] Budget denied for ${engine}/${eventType} — using fallback`);
    }
  } catch {
    // Budget guard unreachable — fail open, proceed with Groq
    console.warn('[groq-client] Budget guard unreachable — proceeding without check');
  }

  // ── Step 2: Return fallback if denied ─────────────────────────────────────
  if (!approved) {
    if (fallbackText) return fallbackText;
    const fb = platform
      ? getFallbackForPlatform(eventType, data, platform)
      : getFallback(eventType, data);
    return fb.text;
  }

  // ── Step 3: Call Groq ─────────────────────────────────────────────────────
  const startTime = Date.now();
  let actualTokens = estimatedTokens;
  let text = '';

  // Optional passthrough params (e.g. response_format for JSON mode)
  const extraParams = {};
  if (options.response_format) extraParams.response_format = options.response_format;

  try {
    const response = await getGroq().chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...extraParams,
    });

    text = response.choices[0]?.message?.content?.trim() || '';
    actualTokens = response.usage?.total_tokens || estimatedTokens;

    // ── Step 4: Report actual usage ─────────────────────────────────────────
    budgetPost('/tokens/report', { engine, actualTokens }).catch(() => {});

    return text;

  } catch (err) {
    // Groq failed (rate limit, network, etc.) → use fallback
    console.error(`[groq-client] Groq error for ${engine}:`, err.message);
    const fb = platform
      ? getFallbackForPlatform(eventType, data, platform)
      : getFallback(eventType, data);
    return fb.text;
  }
}

/**
 * groqClient.completeRaw(options) → full Groq response object
 * Use when you need token counts, multiple choices, or raw response fields.
 * Budget guard still applies.
 */
async function completeRaw(options) {
  const {
    engine      = 'unknown',
    eventType   = 'GOAL',
    data        = {},
    messages,
    model       = DEFAULT_MODEL,
    temperature = 0.8,
  } = options;
  const maxTokens = options.maxTokens ?? options.max_tokens ?? 300;

  const estimatedTokens = estimateTokens(messages, maxTokens);

  try {
    const result = await budgetPost('/tokens/request', { engine, estimatedTokens, eventType, data });
    if (result.ok && result.body.approved === false) {
      const fb = getFallback(eventType, data);
      return {
        choices: [{ message: { content: fb.text } }],
        usage: { total_tokens: 0 },
        _fallback: true,
      };
    }
  } catch {}

  try {
    const response = await getGroq().chat.completions.create({ model, messages, max_tokens: maxTokens, temperature });
    const actualTokens = response.usage?.total_tokens || estimatedTokens;
    budgetPost('/tokens/report', { engine, actualTokens }).catch(() => {});
    return response;
  } catch (err) {
    const fb = getFallback(eventType, data);
    return {
      choices: [{ message: { content: fb.text } }],
      usage: { total_tokens: 0 },
      _fallback: true,
      _error: err.message,
    };
  }
}

/**
 * groqClient.translate(text, targetLang, engine) → string
 * Convenience wrapper for translation calls.
 */
async function translate(text, targetLang, engine = 'translation') {
  return complete({
    engine,
    eventType: 'TRANSLATION',
    messages: [
      {
        role: 'system',
        content: `You are a professional sports translator. Translate the following text to ${targetLang}. Keep the energy and excitement. Return only the translation, no explanation.`,
      },
      { role: 'user', content: text },
    ],
    maxTokens: Math.ceil(text.length / 3) + 50, // translations are ~same length
    temperature: 0.3, // lower temp for translation accuracy
  });
}

/**
 * groqClient.budgetStatus() → object
 * Get current token usage across all engines.
 */
async function budgetStatus() {
  return new Promise((resolve) => {
    const url  = new URL(BUDGET_URL + '/budget');
    const proto = url.protocol === 'https:' ? https : http;
    proto.get(url.toString(), { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({}); }
      });
    }).on('error', () => resolve({}));
  });
}

// ─── Module export ─────────────────────────────────────────────────────────────

module.exports = {
  complete,
  completeRaw,
  translate,
  budgetStatus,
};

// ─── Self-test (node groq-client.js) ─────────────────────────────────────────

if (require.main === module) {
  (async () => {
    console.log('[groq-client] Self-test...\n');

    // Test budget status
    const budget = await budgetStatus();
    console.log('Budget status:', budget.totalUsed !== undefined ? `${budget.totalUsed}/${budget.totalLimit} tokens used` : 'budget guard not reachable (OK for local test)');

    // Test complete
    const text = await complete({
      engine: 'test',
      eventType: 'GOAL',
      data: { player: 'Mbappe', team: 'France', minute: 23 },
      messages: [
        { role: 'system', content: 'You are a football commentator. Write one exciting sentence about a goal.' },
        { role: 'user', content: 'Mbappe scores in the 23rd minute for France vs Argentina.' },
      ],
      maxTokens: 100,
    });
    console.log('\nGroq response:', text);

    // Test fallback (no GROQ_API_KEY set → groq will error → fallback kicks in)
    console.log('\n[groq-client] Self-test complete ✅');
  })();
}
