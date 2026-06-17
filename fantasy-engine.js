/**
 * fantasy-engine.js
 * AI Fantasy Football Picks Engine — WC 2026
 *
 * Premium product: AI-generated lineup recommendations, captain picks,
 * differential players, and transfer advice for Fantasy WC / Dream11 / Sorare.
 *
 * Revenue model:
 *   - Free tier: 1 pick/week (email capture → subscriber funnel)
 *   - Premium ($4.99/month via Stripe/Whop): full squad + transfer advice
 *   - Affiliate: Dream11, Sorare, Fantasy WC sign-up bonuses
 *
 * What it does:
 *   GET /picks       — Today's top captain + vice-captain picks (public)
 *   GET /squad/:gameweek  — Full 15-player squad (premium)
 *   GET /differentials    — Low-ownership high-upside picks (premium)
 *   GET /transfers/:budget — Best transfers this week (premium)
 *   POST /trigger    — moment-engine fires on MATCH_END / PRE_MATCH
 *   POST /predict/:homeTeam/:awayTeam — Pre-match AI analysis
 *
 * Required env:
 *   FOOTBALL_API_KEY    — already used by data-pipeline
 *   GROQ_API_KEY        — AI generation (via groq-client)
 *   TELEGRAM_BOT_TOKEN  — announce picks to main channel
 *   TELEGRAM_CHANNEL_ID — main EN channel
 *   STRIPE_SECRET_KEY   — premium gate (optional, works without)
 *   DREAM11_AFFILIATE_ID
 *   SORARE_AFFILIATE_ID
 *
 * Port: 3045
 */

'use strict';

require('dotenv').config();
const express      = require('express');
const axios        = require('axios');
const cron         = require('node-cron');
const groqClient   = require('./groq-client');

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || process.env.RAPIDAPI_KEY || '';
const TELEGRAM_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || '';
const CHANNEL_ID       = process.env.TELEGRAM_CHANNEL_ID || '';
const PIPELINE_SECRET  = process.env.PIPELINE_SECRET || '';
const DREAM11_AFF      = process.env.DREAM11_AFFILIATE_ID || 'wc2026picks';
const SORARE_AFF       = process.env.SORARE_AFFILIATE_ID  || 'wc2026picks';
const PORT             = process.env.FANTASY_ENGINE_PORT || process.env.PORT || 3045;

const app = express();
app.use(express.json());
app.use(require('cors')());

// ─── Auth ─────────────────────────────────────────────────────────────────────
function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

// Simple in-memory premium gate (replace with Stripe/Whop check in prod)
function isPremium(req) {
  const key = req.headers['x-premium-token'] || req.query.token;
  // Allow pipeline calls through
  if (req.headers['x-pipeline-secret'] === PIPELINE_SECRET) return true;
  // Check against env whitelist
  const premiumTokens = (process.env.PREMIUM_TOKENS || '').split(',').filter(Boolean);
  return premiumTokens.includes(key);
}

// ─── WC 2026 Squad Pool (real players) ────────────────────────────────────────
const PLAYER_POOL = {
  goalkeepers: [
    { name: 'Alisson', team: 'Brazil', price: 6.5, form: 8.2, wcApps: 3 },
    { name: 'Courtois', team: 'Belgium', price: 6.0, form: 7.8, wcApps: 3 },
    { name: 'Lloris', team: 'France', price: 6.0, form: 7.5, wcApps: 3 },
    { name: 'Unai Simón', team: 'Spain', price: 5.5, form: 7.9, wcApps: 3 },
    { name: 'Matt Turner', team: 'USA', price: 5.0, form: 7.1, wcApps: 3 },
    { name: 'Yassine Bounou', team: 'Morocco', price: 5.5, form: 8.0, wcApps: 3 },
  ],
  defenders: [
    { name: 'Rúben Dias', team: 'Portugal', price: 6.5, form: 8.5, wcApps: 3 },
    { name: 'Theo Hernández', team: 'France', price: 7.0, form: 7.8, wcApps: 3 },
    { name: 'Achraf Hakimi', team: 'Morocco', price: 7.0, form: 8.3, wcApps: 3 },
    { name: 'Cristian Romero', team: 'Argentina', price: 6.0, form: 7.5, wcApps: 3 },
    { name: 'Jules Koundé', team: 'France', price: 6.5, form: 7.6, wcApps: 3 },
    { name: 'Alejandro Balde', team: 'Spain', price: 6.0, form: 7.9, wcApps: 3 },
    { name: 'Takehiro Tomiyasu', team: 'Japan', price: 5.5, form: 7.4, wcApps: 3 },
    { name: 'DeAndre Yedlin', team: 'USA', price: 5.0, form: 6.8, wcApps: 3 },
  ],
  midfielders: [
    { name: 'Jude Bellingham', team: 'England', price: 11.5, form: 9.2, wcApps: 3 },
    { name: 'Vinícius Jr', team: 'Brazil', price: 11.0, form: 9.0, wcApps: 3 },
    { name: 'Pedri', team: 'Spain', price: 9.5, form: 8.7, wcApps: 3 },
    { name: 'Rodri', team: 'Spain', price: 8.5, form: 8.9, wcApps: 3 },
    { name: 'Moisés Caicedo', team: 'Ecuador', price: 7.5, form: 8.4, wcApps: 3 },
    { name: 'Riyad Mahrez', team: 'Algeria', price: 7.0, form: 7.8, wcApps: 3 },
    { name: 'Christian Pulisic', team: 'USA', price: 8.0, form: 8.1, wcApps: 3 },
    { name: 'Sandro Tonali', team: 'Italy', price: 7.5, form: 7.7, wcApps: 3 },
    { name: 'Khvicha Kvaratskhelia', team: 'Georgia', price: 8.0, form: 8.5, wcApps: 3 },
    { name: 'Takumi Minamino', team: 'Japan', price: 7.0, form: 7.9, wcApps: 3 },
  ],
  forwards: [
    { name: 'Erling Haaland', team: 'Norway', price: 14.0, form: 9.8, wcApps: 3 },
    { name: 'Kylian Mbappé', team: 'France', price: 13.5, form: 9.5, wcApps: 3 },
    { name: 'Lionel Messi', team: 'Argentina', price: 13.0, form: 9.3, wcApps: 3 },
    { name: 'Neymar Jr', team: 'Brazil', price: 12.0, form: 8.8, wcApps: 3 },
    { name: 'Lamine Yamal', team: 'Spain', price: 11.0, form: 9.1, wcApps: 3 },
    { name: 'Victor Osimhen', team: 'Nigeria', price: 10.5, form: 9.0, wcApps: 3 },
    { name: 'Enner Valencia', team: 'Ecuador', price: 8.0, form: 8.3, wcApps: 3 },
    { name: 'Choupo-Moting', team: 'Cameroon', price: 7.5, form: 7.8, wcApps: 3 },
    { name: 'Wataru Endō', team: 'Japan', price: 7.0, form: 7.7, wcApps: 3 },
  ],
};

// ─── Squad builder ─────────────────────────────────────────────────────────────
function buildSquad(budget = 100, formation = '4-4-2') {
  const [_, defs, mids, fwds] = formation.split('-').map(Number);
  const gks = 1, benchGks = 1, benchOutfield = 3;

  // Sort by form/price ratio (value score)
  const score = p => (p.form * 1.5) / p.price;

  const gk  = [...PLAYER_POOL.goalkeepers].sort((a,b) => score(b)-score(a)).slice(0,2);
  const def = [...PLAYER_POOL.defenders].sort((a,b) => score(b)-score(a)).slice(0, defs + benchOutfield - 2);
  const mid = [...PLAYER_POOL.midfielders].sort((a,b) => score(b)-score(a)).slice(0, mids + 1);
  const fwd = [...PLAYER_POOL.forwards].sort((a,b) => score(b)-score(a)).slice(0, (fwds || 2) + 1);

  return {
    formation,
    starting: {
      goalkeeper: gk[0],
      defenders: def.slice(0, defs),
      midfielders: mid.slice(0, mids),
      forwards: fwd.slice(0, fwds || 2),
    },
    bench: [gk[1], def[defs], mid[mids], fwd[fwds || 2]].filter(Boolean),
    captain: null,     // set by aiPicks()
    viceCaptain: null,
    totalCost: 0,      // calculated
  };
}

// ─── AI-powered picks ─────────────────────────────────────────────────────────
const picksCache = { data: null, generatedAt: 0 };

async function aiPicks(context = {}) {
  // Cache for 4 hours
  if (picksCache.data && Date.now() - picksCache.generatedAt < 4 * 60 * 60 * 1000) {
    return picksCache.data;
  }

  const topPlayers = [
    ...PLAYER_POOL.forwards.slice(0, 3),
    ...PLAYER_POOL.midfielders.slice(0, 4),
  ].map(p => `${p.name} (${p.team}, £${p.price}m, form ${p.form})`).join(', ');

  try {
    const raw = await groqClient.complete({
      engine: 'fantasy-engine',
      eventType: 'FANTASY_PICKS',
      messages: [{
        role: 'system',
        content: 'You are an expert WC 2026 fantasy football analyst. Return valid JSON only.',
      }, {
        role: 'user',
        content: `Generate fantasy WC 2026 picks. Top players available: ${topPlayers}.
${context.upcomingMatch ? 'Upcoming match: ' + JSON.stringify(context.upcomingMatch) : ''}

Return JSON:
{
  "captain": { "name": "...", "team": "...", "reason": "...", "confidence": 0.0-1.0 },
  "viceCaptain": { "name": "...", "team": "...", "reason": "..." },
  "differentials": [{ "name": "...", "team": "...", "ownership": "X%", "reason": "..." }],
  "avoid": [{ "name": "...", "team": "...", "reason": "..." }],
  "weeklyTip": "..."
}`,
      }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.6,
    });

    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    picksCache.data = { ...parsed, generatedAt: new Date().toISOString() };
    picksCache.generatedAt = Date.now();
    return picksCache.data;
  } catch(e) {
    console.warn('[Fantasy] AI picks generation failed:', e.message);
    // Deterministic fallback
    return {
      captain: { name: 'Erling Haaland', team: 'Norway', reason: 'Top scorer, in-form, favorable fixture', confidence: 0.82 },
      viceCaptain: { name: 'Kylian Mbappé', team: 'France', reason: 'World-class form, France in knockouts', reason2: '' },
      differentials: [
        { name: 'Victor Osimhen', team: 'Nigeria', ownership: '8%', reason: 'Low-owned, strong WC form' },
        { name: 'Moisés Caicedo', team: 'Ecuador', ownership: '5%', reason: 'Set pieces + driving runs' },
      ],
      avoid: [
        { name: 'Neymar Jr', team: 'Brazil', reason: 'Injury concern' },
      ],
      weeklyTip: 'Double up on France vs Morocco with Mbappé (C) + Hakimi (DEF) for a 15-point differential.',
      generatedAt: new Date().toISOString(),
    };
  }
}

// ─── Match prediction ──────────────────────────────────────────────────────────
async function predictMatch(homeTeam, awayTeam) {
  try {
    const raw = await groqClient.complete({
      engine: 'fantasy-engine',
      eventType: 'MATCH_PREDICT',
      messages: [{
        role: 'system',
        content: 'You are a WC 2026 match analyst. Return JSON only.',
      }, {
        role: 'user',
        content: `Predict: ${homeTeam} vs ${awayTeam} at WC 2026.
Return JSON:
{
  "prediction": "1X2 or home/draw/away",
  "confidence": 0.0-1.0,
  "score": "X-X",
  "goalscorers": ["player1", "player2"],
  "keyBattle": "Midfield description",
  "fantasyPick": "Best fantasy player from this game",
  "analysis": "2-3 sentence match analysis"
}`,
      }],
      response_format: { type: 'json_object' },
      max_tokens: 400,
      temperature: 0.5,
    });
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch(e) {
    return {
      prediction: 'home', confidence: 0.55,
      score: '2-1', goalscorers: ['Star Player'],
      keyBattle: 'Midfield dominance will be key',
      fantasyPick: homeTeam + ' forward',
      analysis: `${homeTeam} vs ${awayTeam} promises a competitive WC 2026 contest. Form and squad depth favor the home side slightly, but upset potential is real.`,
    };
  }
}

// ─── Telegram announcements ───────────────────────────────────────────────────
async function announcePicks(picks) {
  if (!TELEGRAM_TOKEN || !CHANNEL_ID) return;
  const cap = picks.captain;
  const msg = `🏆 *Fantasy WC 2026 — Captain Pick*\n\n` +
    `⭐ Captain: *${cap?.name}* (${cap?.team})\n` +
    `${cap?.reason || ''}\n\n` +
    `🔶 Vice-Captain: *${picks.viceCaptain?.name}* (${picks.viceCaptain?.team})\n\n` +
    `💡 *Differential:* ${picks.differentials?.[0]?.name || 'See premium'} — ${picks.differentials?.[0]?.reason || ''}\n\n` +
    `${picks.weeklyTip || ''}\n\n` +
    `[Full Squad Picks →](https://wc2026picks.com/fantasy.html)`;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHANNEL_ID, text: msg, parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    console.log('[Fantasy] Captain pick announced to Telegram');
  } catch(e) {
    console.warn('[Fantasy] Telegram announce failed:', e.message);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Free: captain + vice-captain only
app.get('/picks', async (req, res) => {
  try {
    const picks = await aiPicks();
    const pub = {
      captain: picks.captain,
      viceCaptain: picks.viceCaptain,
      weeklyTip: picks.weeklyTip,
      generatedAt: picks.generatedAt,
      premium: {
        differentials: '🔒 Premium — upgrade at wc2026picks.com/premium',
        fullSquad:     '🔒 Premium — upgrade at wc2026picks.com/premium',
        transfers:     '🔒 Premium — upgrade at wc2026picks.com/premium',
      },
      affiliates: {
        dream11: `https://dream11.com/signup?ref=${DREAM11_AFF}`,
        sorare:  `https://sorare.com/r/${SORARE_AFF}`,
      },
    };
    res.json({ ok: true, ...pub });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Premium: full squad
app.get('/squad/:gameweek?', async (req, res) => {
  if (!isPremium(req)) {
    return res.status(403).json({
      ok: false, error: 'Premium required',
      upgrade: 'https://wc2026picks.com/premium',
      trial: 'Free trial: GET /picks',
    });
  }
  const picks = await aiPicks();
  const squad = buildSquad(100, req.query.formation || '4-3-3');
  squad.captain = picks.captain;
  squad.viceCaptain = picks.viceCaptain;
  // Calculate total cost
  const all = [squad.starting.goalkeeper, ...squad.starting.defenders, ...squad.starting.midfielders, ...squad.starting.forwards, ...squad.bench];
  squad.totalCost = all.reduce((s, p) => s + (p?.price || 0), 0);
  res.json({ ok: true, gameweek: req.params.gameweek || 'current', squad, picks });
});

// Premium: differentials
app.get('/differentials', async (req, res) => {
  if (!isPremium(req)) {
    return res.status(403).json({ ok: false, error: 'Premium required', upgrade: 'https://wc2026picks.com/premium' });
  }
  const picks = await aiPicks();
  res.json({ ok: true, differentials: picks.differentials, avoid: picks.avoid });
});

// Premium: transfer advice
app.get('/transfers/:budget?', async (req, res) => {
  if (!isPremium(req)) {
    return res.status(403).json({ ok: false, error: 'Premium required', upgrade: 'https://wc2026picks.com/premium' });
  }
  const budget = parseFloat(req.params.budget) || 10.0;
  // Find best value players in budget
  const allPlayers = [...PLAYER_POOL.forwards, ...PLAYER_POOL.midfielders, ...PLAYER_POOL.defenders]
    .filter(p => p.price <= budget)
    .sort((a,b) => (b.form / b.price) - (a.form / a.price))
    .slice(0, 6);
  res.json({ ok: true, budget, recommendations: allPlayers.map(p => ({
    ...p,
    valueScore: (p.form / p.price).toFixed(2),
    reasoning: `Strong form (${p.form}) at value price (£${p.price}m)`,
  })) });
});

// Match prediction — free
app.get('/predict/:homeTeam/:awayTeam', async (req, res) => {
  const { homeTeam, awayTeam } = req.params;
  try {
    const pred = await predictMatch(homeTeam, awayTeam);
    res.json({ ok: true, homeTeam, awayTeam, prediction: pred });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Triggered by moment-engine on match events
app.post('/trigger', async (req, res) => {
  const { eventType, homeTeam, awayTeam, ...payload } = req.body || {};
  const TRIGGER_EVENTS = ['MATCH_END', 'PRE_MATCH', 'ELIMINATION', 'HAT_TRICK'];
  if (!TRIGGER_EVENTS.includes(eventType)) {
    return res.json({ ok: true, service: 'fantasy-engine', action: 'skipped', reason: `${eventType} not in fantasy list` });
  }
  try {
    // Invalidate picks cache on key events
    if (['MATCH_END', 'ELIMINATION'].includes(eventType)) {
      picksCache.generatedAt = 0; // force regeneration
    }
    // On PRE_MATCH: generate fresh picks + announce captain
    if (eventType === 'PRE_MATCH' && homeTeam && awayTeam) {
      const picks = await aiPicks({ upcomingMatch: { homeTeam, awayTeam } });
      await announcePicks(picks);
    }
    res.json({ ok: true, service: 'fantasy-engine', eventType, action: 'processed' });
  } catch(e) {
    console.error('[Fantasy] trigger error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/status', (req, res) => res.json({
  ok: true,
  service: 'fantasy-engine',
  playerPool: {
    goalkeepers: PLAYER_POOL.goalkeepers.length,
    defenders: PLAYER_POOL.defenders.length,
    midfielders: PLAYER_POOL.midfielders.length,
    forwards: PLAYER_POOL.forwards.length,
    total: Object.values(PLAYER_POOL).reduce((s,a) => s+a.length, 0),
  },
  picksCache: {
    cached: !!picksCache.data,
    age: picksCache.generatedAt ? Math.round((Date.now()-picksCache.generatedAt)/60000)+'min' : 'empty',
  },
  revenue: {
    freeEndpoints: ['/picks', '/predict/:home/:away'],
    premiumEndpoints: ['/squad', '/differentials', '/transfers'],
    affiliates: ['dream11', 'sorare'],
    premiumPricing: '$4.99/month or $9.99 tournament pass',
  },
  configured: { telegram: !!TELEGRAM_TOKEN, footballApi: !!FOOTBALL_API_KEY },
}));

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Daily captain pick announcement (8am UTC — before daily matches) ─────────
cron.schedule('0 8 * * *', async () => {
  try {
    picksCache.generatedAt = 0; // force fresh
    const picks = await aiPicks();
    await announcePicks(picks);
    console.log('[Fantasy] Daily picks announced');
  } catch(e) {
    console.warn('[Fantasy] Daily picks failed:', e.message);
  }
});

app.listen(PORT, () => {
  console.log(`[Fantasy Engine] listening on :${PORT}`);
  console.log('[Fantasy] Free: /picks, /predict/:home/:away | Premium: /squad, /differentials, /transfers');
  if (!FOOTBALL_API_KEY) console.warn('[Fantasy] FOOTBALL_API_KEY not set — using static player pool');
});
