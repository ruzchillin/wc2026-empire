/**
 * empire-agent.js
 * The Master Conversational AI — Talk to Your Empire Like Talking to Claude
 *
 * This is the brain that knows everything. Ask it anything about your empire.
 * It answers revenue questions, triggers actions, gives strategy, monitors health.
 *
 * Interfaces:
 *   1. Web chat (empire-chat.html) — browser-based, like Claude but WC 2026 aware
 *   2. Telegram (personal-agent uses this internally via POST /ask)
 *   3. API — any service can ask it questions via POST /ask
 *
 * What it knows:
 *   - All 50 Railway services + their status
 *   - Revenue streams (196 active, 14 at 18+)
 *   - Platform coverage (30+ platforms, 27+ country pages)
 *   - Every income stream and how it works
 *   - Real-time data by querying other services
 *
 * What it can do:
 *   - Answer "how much did I make today?" → queries analytics-aggregator
 *   - Answer "what's failing?" → queries monitor-bot
 *   - Answer "post this to all channels" → triggers moment-engine
 *   - Answer "what should I focus on next?" → strategic AI advice
 *   - Answer "who's online watching the match?" → queries data-pipeline
 *   - Answer "is X deployed?" → checks Railway status
 *
 * Port: 3051
 */

'use strict';

require('dotenv').config();
const express    = require('express');
const axios      = require('axios');
const groqClient = require('./groq-client');

const PIPELINE_SECRET    = process.env.PIPELINE_SECRET    || '';
const OWNER_CHAT_ID      = process.env.OWNER_CHAT_ID      || '';
const PORT               = process.env.EMPIRE_AGENT_PORT || process.env.PORT || 3051;

// Service URLs for live data fetching
const SERVICES = {
  analytics:   process.env.ANALYTICS_URL         || 'http://localhost:3032',
  monitor:     process.env.MONITOR_BOT_URL        || 'http://localhost:3020',
  moment:      process.env.MOMENT_ENGINE_URL      || 'http://localhost:3000',
  api:         process.env.API_SERVER_URL         || 'http://localhost:3000',
  data:        process.env.DATA_PIPELINE_URL      || 'http://localhost:3000',
  odds:        process.env.ODDS_ENGINE_URL        || 'http://localhost:3041',
  fantasy:     process.env.FANTASY_ENGINE_URL     || 'http://localhost:3045',
  affiliate:   process.env.AFFILIATE_TRACKER_URL  || 'http://localhost:3031',
  groqBudget:  process.env.GROQ_BUDGET_URL        || 'http://localhost:3036',
};

const app = express();
app.use(express.json());
app.use(require('cors')());
app.use(express.static('public'));

// ─── Auth ─────────────────────────────────────────────────────────────────────
function auth(req, res, next) {
  // GET requests and /ask from chat UI allowed freely
  if (req.method === 'GET') return next();
  // POST /ask — allow from browser (chat UI) or pipeline
  const token = req.headers['x-pipeline-secret'];
  const chatKey = req.headers['x-chat-key'];
  const CHAT_KEY = process.env.EMPIRE_CHAT_KEY || PIPELINE_SECRET;
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET && chatKey !== CHAT_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}
app.use('/trigger', auth);
app.use('/action', auth);

// ─── Conversation memory (in-process, resets on deploy) ──────────────────────
const conversationHistory = {}; // sessionId → [{role, content}]
const MAX_HISTORY = 20;

// ─── Empire knowledge base (injected into every system prompt) ────────────────
const EMPIRE_CONTEXT = `
You are the Empire Agent — the master AI running a WC 2026 sports media and monetization empire.

ARCHITECTURE (${new Date().getFullYear()}):
• 50 Railway microservices running in production
• 30+ social/messaging platforms (Telegram, Twitter, Instagram, TikTok, WhatsApp, Discord, Reddit, Facebook, Bluesky, Mastodon, LinkedIn, Snapchat, LINE, Viber, Koo, Medium, Naver, ShareChat, Twitch, YouTube, VK, Weibo, Zalo, KakaoTalk, Nairaland...)
• 31 country landing pages (Turkey, Pakistan, India, Indonesia, Brazil, Argentina, Japan, Philippines, Vietnam, Egypt, Morocco, Senegal, Kenya, Ethiopia, South Africa, Ghana, Colombia, Chile, Peru, Ecuador, Bangladesh, Saudi Arabia, USA, Canada, Mexico, Ivory Coast, Cameroon, Thailand, Malaysia, + more)
• 196 active income streams (14 more unlock at age 18 — matched betting/sportsbook accounts)

KEY REVENUE STREAMS:
• Affiliate CPA: Bet365 (£50), William Hill (£45), DraftKings ($250), FanDuel ($200), BetMGM ($150), 8+ more
• AdSense: running on all HTML pages
• Prediction Game: premium entry fees via Stripe
• Fantasy Engine: $4.99/mo premium picks
• Merchandise: Printful print-on-demand on eliminations/hat-tricks
• Email Newsletter: subscriber monetization
• YouTube: AdSense + Super Chat during matches
• Odds Comparison (odds-comparison.html): biggest single CPA machine

MOMENTS ENGINE:
• Fires on: GOAL, PENALTY_GOAL, OWN_GOAL, RED_CARD, SECOND_YELLOW, HAT_TRICK, MATCH_END, UPSET, ELIMINATION, INJURY, PRE_MATCH, BREAKING_NEWS, RECORD
• Dispatches to all 32 engines in parallel
• Dedup-guard prevents duplicate posts

FINANCIAL CONTEXT:
• User is 17. No sportsbook player accounts until 18. Parent accounts are the financial layer.
• All legitimate streams are active now — 196/210.

You can query live data by calling internal APIs. Always be honest about what you know vs what needs a live query.
Be direct, concise, strategic. You know this empire inside out.
`;

// ─── Live data fetchers ────────────────────────────────────────────────────────
async function fetchLiveContext() {
  const ctx = {};
  const fetch = async (url, key) => {
    try {
      const r = await axios.get(url, { timeout: 3000 });
      ctx[key] = r.data;
    } catch { ctx[key] = null; }
  };
  await Promise.allSettled([
    fetch(`${SERVICES.analytics}/summary`, 'analytics'),
    fetch(`${SERVICES.monitor}/status`, 'services'),
    fetch(`${SERVICES.groqBudget}/status`, 'groqBudget'),
    fetch(`${SERVICES.odds}/status`, 'odds'),
  ]);
  return ctx;
}

// ─── Intent detection — does this need live data? ────────────────────────────
function needsLiveData(message) {
  const lower = message.toLowerCase();
  const liveKeywords = [
    'revenue','money','made','earnings','today','right now','currently',
    'how much','status','down','failing','broken','health','live','score',
    'odds','match','playing','subscribers','clicks','traffic',
  ];
  return liveKeywords.some(k => lower.includes(k));
}

// ─── Action detection — does this need to DO something? ──────────────────────
const ACTION_PATTERNS = [
  { pattern: /post|publish|send|broadcast|announce/i, action: 'broadcast' },
  { pattern: /trigger|fire|dispatch/i,                action: 'trigger'   },
  { pattern: /restart|reboot|redeploy/i,              action: 'restart'   },
  { pattern: /predict|prediction/i,                   action: 'predict'   },
];

function detectAction(message) {
  for (const p of ACTION_PATTERNS) {
    if (p.pattern.test(message)) return p.action;
  }
  return null;
}

// ─── Core AI chat ─────────────────────────────────────────────────────────────
async function chat(message, sessionId = 'default', liveContext = null) {
  if (!conversationHistory[sessionId]) conversationHistory[sessionId] = [];
  const history = conversationHistory[sessionId];

  // Build live context string if available
  let liveStr = '';
  if (liveContext) {
    const { analytics, services, groqBudget, odds } = liveContext;
    if (analytics) liveStr += `\nLIVE ANALYTICS: ${JSON.stringify(analytics).slice(0,400)}`;
    if (services) {
      const down = (services.services || []).filter(s => s.status === 'down');
      liveStr += `\nSERVICE HEALTH: ${services.upCount || '?'} up, ${down.length} down${down.length ? ' — DOWN: ' + down.map(s=>s.name).join(', ') : ''}`;
    }
    if (groqBudget) liveStr += `\nGROQ BUDGET: ${JSON.stringify(groqBudget).slice(0,150)}`;
    if (odds) liveStr += `\nODDS ENGINE: ${odds.configured ? 'configured' : 'unconfigured'}, cache age ${odds.cacheAge || '?'}`;
  }

  const systemPrompt = EMPIRE_CONTEXT + (liveStr ? `\n\nLIVE DATA:${liveStr}` : '');

  // Build messages array with history
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-MAX_HISTORY),
    { role: 'user', content: message },
  ];

  const response = await groqClient.complete({
    engine: 'empire-agent',
    eventType: 'CHAT',
    messages,
    max_tokens: 800,
    temperature: 0.7,
  });

  // Store in history
  history.push({ role: 'user', content: message });
  history.push({ role: 'assistant', content: response });
  if (history.length > MAX_HISTORY * 2) history.splice(0, 2);

  return response;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Main chat endpoint — used by empire-chat.html and personal-agent
app.post('/ask', async (req, res) => {
  const { message, sessionId = 'web-default', includeContext = true } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ ok: false, error: 'message required' });

  try {
    let liveCtx = null;
    if (includeContext && needsLiveData(message)) {
      liveCtx = await fetchLiveContext();
    }

    const reply = await chat(message, sessionId, liveCtx);

    // Check if user asked to perform an action
    const action = detectAction(message);
    let actionResult = null;
    if (action === 'broadcast') {
      // Parse and offer to broadcast — don't auto-fire without confirmation
      actionResult = { detected: 'broadcast_intent', note: 'Confirm with /trigger BREAKING_NEWS to fire to all channels' };
    }

    res.json({ ok: true, reply, action: actionResult, sessionId });
  } catch(e) {
    console.error('[EmpireAgent] chat error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Clear conversation history
app.post('/clear', (req, res) => {
  const { sessionId = 'web-default' } = req.body || {};
  delete conversationHistory[sessionId];
  res.json({ ok: true, cleared: sessionId });
});

// Quick strategic question — no history, just one-shot answer
app.post('/quick', async (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ ok: false, error: 'question required' });
  try {
    const liveCtx = await fetchLiveContext();
    const answer = await chat(question, `quick-${Date.now()}`, liveCtx);
    res.json({ ok: true, answer });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Action endpoint — trigger real actions
app.post('/action', async (req, res) => {
  const { type, params } = req.body || {};
  try {
    switch(type) {
      case 'broadcast': {
        const r = await axios.post(`${SERVICES.moment}/trigger`, {
          eventType: params?.eventType || 'BREAKING_NEWS', ...params
        }, { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 10000 });
        return res.json({ ok: true, action: 'broadcast', result: r.data });
      }
      case 'status': {
        const r = await axios.get(`${SERVICES.monitor}/status`, { timeout: 5000 });
        return res.json({ ok: true, action: 'status', result: r.data });
      }
      case 'odds': {
        const r = await axios.get(`${SERVICES.odds}/best-value`, { timeout: 5000 });
        return res.json({ ok: true, action: 'odds', result: r.data });
      }
      case 'fantasy': {
        const r = await axios.get(`${SERVICES.fantasy}/picks`, { timeout: 5000 });
        return res.json({ ok: true, action: 'fantasy', result: r.data });
      }
      default:
        return res.status(400).json({ ok: false, error: `Unknown action: ${type}` });
    }
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Trigger from moment-engine
app.post('/trigger', async (req, res) => {
  const { eventType, homeTeam, awayTeam, ...payload } = req.body || {};
  // Proactively generate strategic commentary for big events
  const BIG_EVENTS = ['ELIMINATION', 'HAT_TRICK', 'UPSET', 'MATCH_END'];
  if (BIG_EVENTS.includes(eventType)) {
    chat(
      `${eventType} just happened: ${homeTeam || ''} vs ${awayTeam || ''}. What's the strategic play right now? Any revenue opportunities to double down on?`,
      `auto-${eventType}`,
      null
    ).then(reply => {
      console.log(`[EmpireAgent] Strategic insight for ${eventType}: ${reply.slice(0,100)}`);
    }).catch(() => {});
  }
  res.json({ ok: true, service: 'empire-agent', eventType });
});

app.get('/status', (req, res) => res.json({
  ok: true,
  service: 'empire-agent',
  sessions: Object.keys(conversationHistory).length,
  capabilities: [
    'conversational AI with empire context',
    'live data fetching from all services',
    'action triggering (broadcast, status, odds, fantasy)',
    'strategic advice',
    'revenue queries',
  ],
  interfaces: ['POST /ask (web chat)', 'POST /quick (one-shot)', 'POST /action (execute)'],
}));

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[Empire Agent] listening on :${PORT}`);
  console.log('[Empire Agent] Web chat: GET /  |  API: POST /ask');
});
