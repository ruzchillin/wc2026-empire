/**
 * WC 2026 Sports Empire — Groq Budget Guard
 * Deploy on Railway.app as service "groq-budget-guard"
 * Port: 3036
 *
 * Problem: With 25+ engines all calling Groq on a GOAL event simultaneously,
 * the 500K free daily tokens can burn out in ~15 minutes during a busy match.
 * After that, ALL content engines produce nothing for the rest of the day.
 *
 * Solution:
 *   1. Engines call POST /tokens/request { engine, estimatedTokens } BEFORE calling Groq
 *   2. Budget guard approves or denies based on remaining pool
 *   3. Engines call POST /tokens/report { engine, actualTokens } AFTER Groq returns
 *   4. Budget guard tracks real usage and updates projections
 *   5. When budget is low, returns fallback templates from groq-fallback-templates.js
 *
 * Per-engine daily budgets (tokens):
 *   - Commentary (live match): 120,000  — highest priority, core product
 *   - Translation:              80,000  — multiplies reach across 6 languages
 *   - Twitter:                  40,000  — short posts, high frequency
 *   - Facebook:                 40,000
 *   - Telegram:                 30,000
 *   - Reddit:                   30,000
 *   - Email digest:             20,000  — runs once/day
 *   - Discord:                  15,000
 *   - YouTube:                  15,000
 *   - Bluesky:                  10,000
 *   - Mastodon:                 10,000
 *   - WhatsApp:                  5,000
 *   - Other:                    85,000  — shared pool
 *   TOTAL POOL:                500,000  (Groq free tier limit)
 *
 * Usage:
 *   const axios = require('axios');
 *   const BUDGET_URL = process.env.GROQ_BUDGET_URL || 'http://localhost:3036';
 *
 *   // Before Groq call:
 *   const { approved, fallback } = await axios.post(`${BUDGET_URL}/tokens/request`, {
 *     engine: 'twitter', estimatedTokens: 800, eventType: 'GOAL', data
 *   }).then(r => r.data).catch(() => ({ approved: true })); // fail-open
 *   if (!approved) { return useFallback(fallback, eventType, data); }
 *
 *   // After Groq call:
 *   await axios.post(`${BUDGET_URL}/tokens/report`, {
 *     engine: 'twitter', actualTokens: response.usage.total_tokens
 *   }).catch(() => {});
 *
 * Required env vars:
 *   PIPELINE_SECRET
 *   GROQ_DAILY_LIMIT    — default 480000 (leaving 20K buffer from 500K)
 *
 * Port: 3036
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cron    = require('node-cron');
const path    = require('path');
const fs      = require('fs');

// Try to load fallback templates if available
let fallbackTemplates;
try {
  fallbackTemplates = require('./groq-fallback-templates');
} catch {
  fallbackTemplates = null;
}

const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';
const DAILY_LIMIT     = parseInt(process.env.GROQ_DAILY_LIMIT || '480000', 10);
const DATA_DIR        = path.join(process.cwd(), 'data');
const USAGE_FILE      = path.join(DATA_DIR, 'groq-usage.json');

// ─── Per-engine budgets ────────────────────────────────────────────────────────

const ENGINE_BUDGETS = {
  commentary:   120000,
  translation:   80000,
  twitter:       40000,
  facebook:      40000,
  telegram:      30000,
  reddit:        30000,
  email:         20000,
  discord:       15000,
  youtube:       15000,
  bluesky:       10000,
  mastodon:      10000,
  whatsapp:       5000,
  // Everything else shares the remainder
  _shared:       85000
};

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  date:         todayStr(),
  totalUsed:    0,
  byEngine:     {},  // { engine: { used, requests, lastCall } }
  deniedCount:  0,
  approvedCount: 0,
  pendingRequests: {} // requestId → { engine, estimatedTokens, timestamp }
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState() {
  ensureDataDir();
  if (!fs.existsSync(USAGE_FILE)) return;
  try {
    const saved = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    if (saved.date === todayStr()) {
      state = saved;
    }
    // If different day, start fresh (daily reset)
  } catch { /* start fresh */ }
}

function saveState() {
  ensureDataDir();
  try { fs.writeFileSync(USAGE_FILE, JSON.stringify(state, null, 2)); }
  catch { /* non-critical */ }
}

function resetDaily() {
  console.log('[GroqBudget] Daily reset — new token pool:', DAILY_LIMIT);
  state = {
    date:          todayStr(),
    totalUsed:     0,
    byEngine:      {},
    deniedCount:   0,
    approvedCount: 0,
    pendingRequests: {}
  };
  saveState();
}

// ─── Budget logic ─────────────────────────────────────────────────────────────

function getEngineUsed(engine) {
  return state.byEngine[engine]?.used || 0;
}

function getEngineBudget(engine) {
  return ENGINE_BUDGETS[engine] || ENGINE_BUDGETS._shared / 4; // Unknown engines share from shared pool
}

function getRemaining() {
  return Math.max(0, DAILY_LIMIT - state.totalUsed);
}

function getBudgetLevel() {
  const pct = state.totalUsed / DAILY_LIMIT;
  if (pct >= 0.95) return 'critical';  // <5% left
  if (pct >= 0.80) return 'low';       // <20% left
  if (pct >= 0.60) return 'moderate';  // <40% left
  return 'healthy';
}

function approveRequest(engine, estimatedTokens) {
  const remaining = getRemaining();

  // Always deny if global pool is exhausted
  if (remaining < 100) {
    return { approved: false, reason: 'global_budget_exhausted', remaining };
  }

  const engineUsed   = getEngineUsed(engine);
  const engineBudget = getEngineBudget(engine);
  const engineLeft   = engineBudget - engineUsed;

  // Deny if this engine has exhausted its own budget
  // BUT allow if the global pool still has >20% left (flex capacity)
  if (engineLeft < estimatedTokens && remaining < DAILY_LIMIT * 0.2) {
    return { approved: false, reason: `engine_budget_exhausted`, engineLeft, remaining };
  }

  // Deny if single request is suspiciously huge (>20K tokens)
  if (estimatedTokens > 20000) {
    return { approved: false, reason: 'request_too_large', estimatedTokens, max: 20000 };
  }

  // Warn at 80% usage but still approve
  const level = getBudgetLevel();

  return {
    approved:       true,
    remaining,
    engineLeft:     Math.max(0, engineLeft),
    budgetLevel:    level,
    // When budget is low, hint to use shorter outputs
    maxTokenHint:   level === 'critical' ? 150 : level === 'low' ? 300 : null
  };
}

function recordUsage(engine, tokens) {
  if (!state.byEngine[engine]) {
    state.byEngine[engine] = { used: 0, requests: 0, lastCall: null };
  }
  state.byEngine[engine].used      += tokens;
  state.byEngine[engine].requests  += 1;
  state.byEngine[engine].lastCall   = new Date().toISOString();
  state.totalUsed                  += tokens;
  saveState();
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

/**
 * POST /tokens/request
 * Body: { engine, estimatedTokens, eventType?, data? }
 * Returns: { approved, remaining, budgetLevel, fallback? }
 *
 * Engines MUST call this before calling Groq.
 * If approved: false, engines should use the returned fallback text.
 */
app.post('/tokens/request', auth, (req, res) => {
  const { engine = 'unknown', estimatedTokens = 500, eventType, data } = req.body;

  // Always reset if it's a new day
  if (state.date !== todayStr()) resetDaily();

  const decision = approveRequest(engine, estimatedTokens);

  if (decision.approved) {
    state.approvedCount++;
    // Reserve tokens optimistically
    if (!state.byEngine[engine]) {
      state.byEngine[engine] = { used: 0, requests: 0, lastCall: null };
    }
    console.log(`[GroqBudget] ✅ ${engine} approved ${estimatedTokens} tokens | level: ${decision.budgetLevel} | pool remaining: ${decision.remaining}`);
  } else {
    state.deniedCount++;
    // Provide fallback content so the engine can still post SOMETHING
    if (fallbackTemplates && eventType) {
      const fallback = fallbackTemplates.getFallback(eventType, data || {});
      decision.fallback = fallback;
    }
    console.log(`[GroqBudget] ❌ ${engine} denied: ${decision.reason} | remaining: ${decision.remaining}`);
  }

  res.json({ ok: true, ...decision });
});

/**
 * POST /tokens/report
 * Body: { engine, actualTokens, requestId? }
 * Call this AFTER Groq returns with the actual token count from response.usage.total_tokens
 */
app.post('/tokens/report', auth, (req, res) => {
  const { engine = 'unknown', actualTokens = 0 } = req.body;

  if (typeof actualTokens === 'number' && actualTokens > 0) {
    recordUsage(engine, actualTokens);
    console.log(`[GroqBudget] 📊 ${engine} used ${actualTokens} tokens | total today: ${state.totalUsed.toLocaleString()}`);
  }

  res.json({ ok: true, totalUsed: state.totalUsed, remaining: getRemaining() });
});

/**
 * GET /budget
 * Returns current budget state and per-engine breakdown
 */
app.get('/budget', auth, (req, res) => {
  const byEngine = Object.entries(state.byEngine).map(([engine, data]) => ({
    engine,
    budget:   getEngineBudget(engine),
    used:     data.used,
    remaining: Math.max(0, getEngineBudget(engine) - data.used),
    requests: data.requests,
    lastCall: data.lastCall,
    pctUsed:  Math.round(data.used / getEngineBudget(engine) * 100)
  })).sort((a, b) => b.used - a.used);

  res.json({
    ok: true,
    date:          state.date,
    dailyLimit:    DAILY_LIMIT,
    totalUsed:     state.totalUsed,
    remaining:     getRemaining(),
    pctUsed:       Math.round(state.totalUsed / DAILY_LIMIT * 100),
    budgetLevel:   getBudgetLevel(),
    approvedCount: state.approvedCount,
    deniedCount:   state.deniedCount,
    byEngine,
    engineBudgets: ENGINE_BUDGETS
  });
});

/**
 * GET /dashboard.html — visual budget tracker
 */
app.get('/dashboard.html', (req, res) => {
  const pct     = Math.round(state.totalUsed / DAILY_LIMIT * 100);
  const level   = getBudgetLevel();
  const barColor = level === 'critical' ? '#ff3333' : level === 'low' ? '#ff9900' : level === 'moderate' ? '#ffdd00' : '#76ff03';

  const rows = Object.entries(ENGINE_BUDGETS)
    .filter(([k]) => k !== '_shared')
    .map(([engine, budget]) => {
      const used    = state.byEngine[engine]?.used || 0;
      const pctEng  = Math.round(used / budget * 100);
      const color   = pctEng >= 90 ? '#ff3333' : pctEng >= 70 ? '#ff9900' : '#76ff03';
      return `<tr>
        <td style="padding:8px 12px;color:#ddd;text-transform:capitalize">${engine}</td>
        <td style="padding:8px 12px;color:#888">${budget.toLocaleString()}</td>
        <td style="padding:8px 12px;color:${color}">${used.toLocaleString()}</td>
        <td style="padding:8px 12px;color:#888">${Math.max(0, budget - used).toLocaleString()}</td>
        <td style="padding:8px 12px">
          <div style="background:#222;border-radius:4px;height:8px;width:100px">
            <div style="background:${color};height:8px;border-radius:4px;width:${Math.min(100, pctEng)}%"></div>
          </div>
        </td>
      </tr>`;
    }).join('');

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="60">
  <title>Groq Budget — WC 2026</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0a; color: #fff; font-family: 'Segoe UI', Arial, sans-serif; }
    .header { background: #111; padding: 24px; text-align: center; border-bottom: 1px solid #222; }
    h1 { color: #76ff03; font-size: 20px; letter-spacing: 2px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; padding: 24px; }
    .card { background: #111; border-radius: 10px; padding: 20px; text-align: center; }
    .val { font-size: 28px; font-weight: bold; }
    .lbl { font-size: 11px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .bar-wrap { margin: 0 24px 24px; background: #111; border-radius: 10px; padding: 20px; }
    .bar-bg { background: #222; border-radius: 8px; height: 20px; margin-top: 12px; }
    .bar-fill { height: 20px; border-radius: 8px; transition: width 0.3s; }
    .section { margin: 0 24px 24px; background: #111; border-radius: 10px; overflow: hidden; }
    .section h2 { padding: 16px; color: #76ff03; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #222; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 12px; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; background: #0d0d0d; }
    tr:nth-child(even) { background: #0d0d0d; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 GROQ TOKEN BUDGET</h1>
    <p style="color:#888;font-size:12px;margin-top:6px">${new Date().toUTCString()} • Auto-refreshes every 60s</p>
  </div>

  <div class="summary">
    <div class="card"><div class="val" style="color:${barColor}">${pct}%</div><div class="lbl">Used Today</div></div>
    <div class="card"><div class="val">${state.totalUsed.toLocaleString()}</div><div class="lbl">Tokens Used</div></div>
    <div class="card"><div class="val" style="color:#76ff03">${getRemaining().toLocaleString()}</div><div class="lbl">Remaining</div></div>
    <div class="card"><div class="val">${state.approvedCount}</div><div class="lbl">Approved</div></div>
    <div class="card"><div class="val" style="color:${state.deniedCount > 0 ? '#ff3333' : '#888'}">${state.deniedCount}</div><div class="lbl">Denied</div></div>
    <div class="card"><div class="val" style="color:${level === 'healthy' ? '#76ff03' : level === 'critical' ? '#ff3333' : '#ff9900'}">${level.toUpperCase()}</div><div class="lbl">Budget Level</div></div>
  </div>

  <div class="bar-wrap">
    <div style="display:flex;justify-content:space-between;color:#888;font-size:12px">
      <span>0</span><span>Daily Pool: ${DAILY_LIMIT.toLocaleString()} tokens</span>
    </div>
    <div class="bar-bg">
      <div class="bar-fill" style="background:${barColor};width:${pct}%"></div>
    </div>
  </div>

  <div class="section">
    <h2>📊 Per-Engine Breakdown</h2>
    <table>
      <thead><tr><th>Engine</th><th>Budget</th><th>Used</th><th>Left</th><th>Progress</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>`);
});

/**
 * POST /reset — manual daily reset (admin only)
 */
app.post('/reset', auth, (req, res) => {
  resetDaily();
  res.json({ ok: true, message: 'Budget reset for today' });
});

app.get('/status', (req, res) => {
  res.json({
    ok:          true,
    service:     'groq-budget-guard',
    date:        state.date,
    dailyLimit:  DAILY_LIMIT,
    totalUsed:   state.totalUsed,
    remaining:   getRemaining(),
    budgetLevel: getBudgetLevel(),
    pctUsed:     Math.round(state.totalUsed / DAILY_LIMIT * 100)
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function boot() {
  loadState();

  const PORT = process.env.GROQ_BUDGET_PORT || process.env.PORT || 3036;
  app.listen(PORT, () => console.log(`[GroqBudget] listening on :${PORT}`));

  // Daily reset at midnight UTC
  cron.schedule('0 0 * * *', resetDaily);

  console.log(`[GroqBudget] running on :${PORT}`);
  console.log(`[GroqBudget] Daily pool: ${DAILY_LIMIT.toLocaleString()} tokens | Today used: ${state.totalUsed.toLocaleString()}`);
  console.log(`[GroqBudget] Dashboard: http://localhost:${PORT}/dashboard.html`);

  // INTEGRATION GUIDE (printed on startup for developer reference):
  console.log(`
[GroqBudget] INTEGRATION — add to any engine that calls Groq:

  const BUDGET_URL = process.env.GROQ_BUDGET_URL || 'http://localhost:3036';
  const SECRET     = process.env.PIPELINE_SECRET || '';
  const budgetHeaders = { 'x-pipeline-secret': SECRET };

  async function callGroqWithBudget(engine, prompt, eventType, data) {
    // 1. Request token budget
    const budget = await axios.post(BUDGET_URL + '/tokens/request', {
      engine, estimatedTokens: 800, eventType, data
    }, { headers: budgetHeaders }).then(r => r.data).catch(() => ({ approved: true }));

    if (!budget.approved) {
      // Use fallback text when budget is exhausted
      return budget.fallback?.text || 'WC 2026 Live update. Visit our site for full coverage.';
    }

    // 2. Call Groq
    const resp = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-70b-8192',
      max_tokens: budget.maxTokenHint || 500
    });
    const text = resp.choices[0].message.content.trim();

    // 3. Report actual usage
    await axios.post(BUDGET_URL + '/tokens/report', {
      engine, actualTokens: resp.usage?.total_tokens || 800
    }, { headers: budgetHeaders }).catch(() => {});

    return text;
  }
`);
}

boot().catch(e => { console.error('[GroqBudget boot]', e); process.exit(1); });
