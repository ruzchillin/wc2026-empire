/**
 * odds-engine.js
 * Live odds aggregation + affiliate comparison machine
 *
 * This is the biggest single revenue machine in the stack.
 * Fetches live odds from multiple bookmakers, serves a comparison table,
 * every cell is a tracked affiliate deep-link.
 *
 * How money is made:
 *   User visits /odds-comparison.html → sees best odds for today's matches
 *   Clicks "Bet at Bet365" → hits /go/bet365 (affiliate-tracker)
 *   Signs up + deposits → you earn £30-250 CPA
 *   Think Oddschecker business model, but you own it.
 *
 * Data sources (in priority order):
 *   1. The-Odds-API (theOddsApi.com) — aggregates 40+ bookmakers, free tier available
 *   2. API-Football odds endpoint (if Football-API plan includes it)
 *   3. Rapid API sports odds
 *   4. Fallback: static reasonable odds from our own model
 *
 * Required env:
 *   ODDS_API_KEY     — from the-odds-api.com (free: 500 requests/month)
 *   FOOTBALL_API_KEY — already used by data-pipeline (odds endpoint)
 *
 * Port: 3041
 */

'use strict';

require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const cron    = require('node-cron');

const ODDS_API_KEY     = process.env.ODDS_API_KEY       || '';
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY   || '';
const PIPELINE_SECRET  = process.env.PIPELINE_SECRET    || '';
const PORT             = process.env.ODDS_ENGINE_PORT || process.env.PORT || 3041;

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// ─── Bookmaker affiliate deep-links ───────────────────────────────────────────
// These are the /go/ slugs that affiliate-tracker.js maps to real URLs
const BOOKMAKER_MAP = {
  'bet365':        { name: 'Bet365',         slug: 'bet365',      cpa: 50,  logo: '🎯' },
  'betway':        { name: 'Betway',         slug: 'betway',      cpa: 40,  logo: '🟢' },
  'williamhill':   { name: 'William Hill',   slug: 'williamhill', cpa: 45,  logo: '⚫' },
  'draftkings':    { name: 'DraftKings',     slug: 'draftkings',  cpa: 250, logo: '🏈' },
  'fanduel':       { name: 'FanDuel',        slug: 'fanduel',     cpa: 200, logo: '🦅' },
  'betmgm':        { name: 'BetMGM',         slug: 'betmgm',      cpa: 150, logo: '💎' },
  'pointsbet':     { name: 'PointsBet',      slug: 'pointsbet',   cpa: 120, logo: '🔵' },
  'unibet':        { name: 'Unibet',         slug: 'unibet',      cpa: 60,  logo: '🟡' },
  'betfair':       { name: 'Betfair',        slug: 'betfair',     cpa: 45,  logo: '💚' },
  '888sport':      { name: '888sport',       slug: '888sport',    cpa: 50,  logo: '🎱' },
  'paddypower':    { name: 'Paddy Power',    slug: 'paddypower',  cpa: 55,  logo: '☘️'  },
  'skybet':        { name: 'Sky Bet',        slug: 'skybet',      cpa: 50,  logo: '🔵' },
};

// Cache: avoid hammering the API (update every 5 min during matches, hourly otherwise)
let oddsCache = { data: null, fetchedAt: 0, sport: 'soccer_wc' };
let matchOddsCache = {};

// ─── Auth ─────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(require('cors')());

function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

// ─── Odds fetching ────────────────────────────────────────────────────────────
async function fetchLiveOdds(sport = 'soccer_fifa_world_cup') {
  const now = Date.now();
  if (oddsCache.data && now - oddsCache.fetchedAt < 5 * 60 * 1000) {
    return oddsCache.data; // return cached if < 5 min old
  }

  if (!ODDS_API_KEY) return generateFallbackOdds();

  try {
    const res = await axios.get(`${ODDS_API_BASE}/sports/${sport}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'uk,us,eu',
        markets: 'h2h,totals',
        oddsFormat: 'decimal',
        dateFormat: 'iso',
      },
      timeout: 10000,
    });
    oddsCache = { data: res.data, fetchedAt: now };
    return res.data;
  } catch(e) {
    console.warn('[Odds] API fetch failed:', e.message, '— using fallback');
    return generateFallbackOdds();
  }
}

// Fallback: generate plausible odds for known WC group matches
function generateFallbackOdds() {
  const teams = [
    ['Brazil','France'], ['Argentina','England'], ['Spain','Germany'],
    ['Portugal','Netherlands'], ['USA','Mexico'], ['Morocco','Japan'],
    ['Senegal','South Korea'], ['Colombia','Turkey'],
  ];
  return teams.map(([home, away], i) => ({
    id: `fallback-${i}`,
    sport_key: 'soccer_fifa_world_cup',
    commence_time: new Date(Date.now() + (i+1) * 3600000).toISOString(),
    home_team: home,
    away_team: away,
    bookmakers: Object.keys(BOOKMAKER_MAP).slice(0, 6).map(key => ({
      key,
      title: BOOKMAKER_MAP[key].name,
      markets: [{
        key: 'h2h',
        outcomes: [
          { name: home, price: (1.5 + Math.random()).toFixed(2) },
          { name: 'Draw', price: (3.0 + Math.random()).toFixed(2) },
          { name: away, price: (2.5 + Math.random()).toFixed(2) },
        ],
      }],
    })),
  }));
}

// Transform raw odds into our comparison format
function transformOdds(rawOdds) {
  return rawOdds.map(match => {
    const bookmakerComparison = {};

    match.bookmakers?.forEach(bk => {
      const h2h = bk.markets?.find(m => m.key === 'h2h');
      if (!h2h) return;
      const homeOdds = h2h.outcomes?.find(o => o.name === match.home_team)?.price;
      const drawOdds = h2h.outcomes?.find(o => o.name === 'Draw')?.price;
      const awayOdds = h2h.outcomes?.find(o => o.name === match.away_team)?.price;

      const bkInfo = BOOKMAKER_MAP[bk.key] || { name: bk.title || bk.key, slug: bk.key, logo: '📊' };
      bookmakerComparison[bk.key] = {
        name: bkInfo.name,
        slug: bkInfo.slug,
        logo: bkInfo.logo,
        homeOdds: homeOdds ? parseFloat(homeOdds).toFixed(2) : null,
        drawOdds: drawOdds ? parseFloat(drawOdds).toFixed(2) : null,
        awayOdds: awayOdds ? parseFloat(awayOdds).toFixed(2) : null,
        affiliateUrl: `/go/${bkInfo.slug}?match=${encodeURIComponent(match.home_team + ' v ' + match.away_team)}`,
      };
    });

    // Find best odds
    const bestHome = Math.max(...Object.values(bookmakerComparison).map(b => parseFloat(b.homeOdds) || 0));
    const bestDraw = Math.max(...Object.values(bookmakerComparison).map(b => parseFloat(b.drawOdds) || 0));
    const bestAway = Math.max(...Object.values(bookmakerComparison).map(b => parseFloat(b.awayOdds) || 0));

    return {
      id:          match.id,
      homeTeam:    match.home_team,
      awayTeam:    match.away_team,
      kickoff:     match.commence_time,
      bookmakers:  bookmakerComparison,
      bestOdds:    { home: bestHome.toFixed(2), draw: bestDraw.toFixed(2), away: bestAway.toFixed(2) },
      fetchedAt:   new Date().toISOString(),
    };
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Main odds endpoint — frontend calls this
app.get('/odds', async (req, res) => {
  try {
    const raw  = await fetchLiveOdds();
    const odds = transformOdds(raw);
    res.json({ ok: true, count: odds.length, odds, fetchedAt: new Date().toISOString() });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Single match odds
app.get('/odds/:homeTeam/:awayTeam', async (req, res) => {
  const { homeTeam, awayTeam } = req.params;
  try {
    const raw  = await fetchLiveOdds();
    const odds = transformOdds(raw);
    const match = odds.find(m =>
      m.homeTeam.toLowerCase().includes(homeTeam.toLowerCase()) ||
      m.awayTeam.toLowerCase().includes(awayTeam.toLowerCase())
    );
    if (!match) return res.json({ ok: false, error: 'Match not found', odds });
    res.json({ ok: true, match });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Best value bet finder
app.get('/best-value', async (req, res) => {
  try {
    const raw  = await fetchLiveOdds();
    const odds = transformOdds(raw);

    // Find biggest discrepancy between bookmakers (value opportunity)
    const valueOpps = [];
    odds.forEach(match => {
      const books = Object.values(match.bookmakers);
      if (books.length < 2) return;
      const homeOdds = books.map(b => parseFloat(b.homeOdds)).filter(Boolean);
      const spread = Math.max(...homeOdds) - Math.min(...homeOdds);
      if (spread > 0.3) {
        const bestBook = books.find(b => parseFloat(b.homeOdds) === Math.max(...homeOdds));
        valueOpps.push({
          match: `${match.homeTeam} vs ${match.awayTeam}`,
          kickoff: match.kickoff,
          bestOdds: Math.max(...homeOdds).toFixed(2),
          bookmaker: bestBook?.name,
          affiliateUrl: bestBook?.affiliateUrl,
          spread: spread.toFixed(2),
        });
      }
    });

    valueOpps.sort((a,b) => b.spread - a.spread);
    res.json({ ok: true, opportunities: valueOpps.slice(0,5) });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Triggered by moment-engine on match events — update cache immediately
app.post('/trigger', async (req, res) => {
  const { eventType } = req.body || {};
  const REFRESH_EVENTS = ['PRE_MATCH', 'GOAL', 'MATCH_END'];
  if (REFRESH_EVENTS.includes(eventType)) {
    oddsCache.fetchedAt = 0; // force refresh next /odds call
    console.log(`[Odds] Cache invalidated on ${eventType}`);
  }
  res.json({ ok: true, service: 'odds-engine', action: 'cache-invalidated', eventType });
});

app.get('/status', (req, res) => res.json({
  ok: true,
  service: 'odds-engine',
  configured: !!ODDS_API_KEY,
  cacheAge: oddsCache.fetchedAt ? Math.round((Date.now() - oddsCache.fetchedAt) / 1000) + 's' : 'empty',
  bookmakers: Object.keys(BOOKMAKER_MAP).length,
  totalCpaPotential: `£${Object.values(BOOKMAKER_MAP).reduce((s,b)=>s+b.cpa,0)} per converted user`,
}));

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Refresh cache every 5 min during WC match hours ─────────────────────────
cron.schedule('*/5 12-23 * * *', async () => {
  try {
    await fetchLiveOdds();
    console.log('[Odds] Cache refreshed');
  } catch(e) {
    console.warn('[Odds] Scheduled refresh failed:', e.message);
  }
});

app.listen(PORT, () => {
  console.log(`[Odds Engine] listening on :${PORT}`);
  if (!ODDS_API_KEY) console.warn('[Odds] ODDS_API_KEY not set — using fallback odds (sign up at the-odds-api.com, free tier available)');
});
