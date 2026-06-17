/**
 * WC 2026 Sports Empire — Affiliate Tracker
 * Deploy on Railway.app as service "affiliate-tracker"
 * Port: 3031
 *
 * Tracks every affiliate click and attributes revenue to its source platform.
 * Without this you're flying blind — you won't know if Discord or Twitter
 * is driving £5,000/month in Bet365 signups vs £50.
 *
 * How it works:
 *   1. All affiliate links are wrapped: /go/bet365?src=twitter&evt=GOAL
 *   2. This service redirects to the real affiliate URL
 *   3. Logs: timestamp, partner, source platform, event type, referrer, IP region
 *   4. Conversion endpoint: POST /conversion when affiliate confirms a signup
 *   5. Revenue dashboard: GET /dashboard
 *
 * Usage in engines:
 *   Instead of: https://www.bet365.com?affid=xxx
 *   Use:        https://affiliate-tracker.up.railway.app/go/bet365?src=twitter&evt=GOAL
 *   Or shorter: ${VERCEL_URL}/go/bet365?src=twitter (Vercel rewrites /go/* to this service)
 *
 * Partners configured (add your real affiliate IDs):
 *   - Bet365 (UK #1 sportsbook, 35% RevShare, £50 CPA)
 *   - DraftKings (US, $250 CPA)
 *   - FanDuel (US, $200 CPA)
 *   - Betfair Exchange (RevShare lifetime)
 *   - William Hill (£30 CPA)
 *   - Paddy Power (£30 CPA)
 *   - 888Sport (£25 CPA)
 *   - Unibet (£25 CPA)
 *   - bet-at-home (EU)
 *   - NordVPN (30% recurring — WC 2026 VPN guide pages)
 *   - ExpressVPN (£13/sale)
 *   - Amazon (watches WC2026 on various channels)
 *   - Fanatics (WC 2026 merchandise)
 *
 * Required env vars (fill in your real affiliate IDs):
 *   BET365_AFFILIATE_ID        — your Bet365 affiliate code
 *   DRAFTKINGS_AFFILIATE_ID    — DraftKings affiliate tag
 *   FANDUEL_AFFILIATE_ID       — FanDuel partner ID
 *   BETFAIR_AFFILIATE_ID       — Betfair Exchange code
 *   WILLIAMHILL_AFFILIATE_ID
 *   PADDYPOWER_AFFILIATE_ID
 *   NORDVPN_AFFILIATE_ID       — NordVPN affiliate ID
 *   EXPRESSVPN_AFFILIATE_ID
 *   PIPELINE_SECRET
 *   VERCEL_URL
 *
 * IMPORTANT: Always respect platform policies.
 * 18+ content restrictions apply to sportsbook links — do NOT
 * place these on pages targeting minors or in educational contexts.
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const express = require('express');
const cron    = require('node-cron');

const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';
const VERCEL_URL      = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');

const DATA_DIR    = path.join(process.cwd(), 'data');
const CLICKS_FILE = path.join(DATA_DIR, 'affiliate-clicks.json');
const CONV_FILE   = path.join(DATA_DIR, 'affiliate-conversions.json');

// ─── Partner configuration ────────────────────────────────────────────────────

const PARTNERS = {
  bet365: {
    name:   'Bet365',
    url:    (id) => `https://www.bet365.com/olp/open-account/?affiliate=${id || process.env.BET365_AFFILIATE_ID || 'YOUR_ID'}`,
    cpa:    50, revShare: 0.35, currency: 'GBP',
    geo:    ['GB','IE','AU','CA'],
    minAge: 18
  },
  draftkings: {
    name:   'DraftKings',
    url:    (id) => `https://sportsbook.draftkings.com/?affiliateId=${id || process.env.DRAFTKINGS_AFFILIATE_ID || 'YOUR_ID'}`,
    cpa:    250, currency: 'USD',
    geo:    ['US'],
    minAge: 21
  },
  fanduel: {
    name:   'FanDuel',
    url:    (id) => `https://www.fanduel.com/promos?btag=${id || process.env.FANDUEL_AFFILIATE_ID || 'YOUR_ID'}`,
    cpa:    200, currency: 'USD',
    geo:    ['US'],
    minAge: 21
  },
  betfair: {
    name:   'Betfair Exchange',
    url:    (id) => `https://www.betfair.com/sport/football?AffiliateCode=${id || process.env.BETFAIR_AFFILIATE_ID || 'YOUR_ID'}`,
    revShare: 0.30, currency: 'GBP',
    geo:    ['GB','IE'],
    minAge: 18
  },
  williamhill: {
    name:   'William Hill',
    url:    (id) => `https://www.williamhill.com/?affiliateCode=${id || process.env.WILLIAMHILL_AFFILIATE_ID || 'YOUR_ID'}`,
    cpa:    30, currency: 'GBP',
    geo:    ['GB'],
    minAge: 18
  },
  paddypower: {
    name:   'Paddy Power',
    url:    (id) => `https://www.paddypower.com/?affiliate=${id || process.env.PADDYPOWER_AFFILIATE_ID || 'YOUR_ID'}`,
    cpa:    30, currency: 'GBP',
    geo:    ['GB','IE'],
    minAge: 18
  },
  '888sport': {
    name:   '888Sport',
    url:    (id) => `https://www.888sport.com/?affid=${id || process.env.EIGHTSPORT_AFFILIATE_ID || 'YOUR_ID'}`,
    cpa:    25, currency: 'GBP',
    geo:    ['GB'],
    minAge: 18
  },
  unibet: {
    name:   'Unibet',
    url:    (id) => `https://www.unibet.co.uk/betting/sports/filter/football?affiliateId=${id || process.env.UNIBET_AFFILIATE_ID || 'YOUR_ID'}`,
    cpa:    25, currency: 'GBP',
    geo:    ['GB','SE','NO'],
    minAge: 18
  },
  nordvpn: {
    name:   'NordVPN',
    url:    (id) => `https://nordvpn.com/?coupon=${id || process.env.NORDVPN_AFFILIATE_ID || 'wc2026'}`,
    revShare: 0.30, cpa: 13, currency: 'USD',
    geo:    ['ALL'],
    minAge: 0
  },
  expressvpn: {
    name:   'ExpressVPN',
    url:    (id) => `https://www.expressvpn.com/order?a_fid=${id || process.env.EXPRESSVPN_AFFILIATE_ID || 'YOUR_ID'}`,
    cpa:    13, currency: 'USD',
    geo:    ['ALL'],
    minAge: 0
  },
  amazon: {
    name:   'Amazon Associates',
    url:    (id) => `https://www.amazon.com/dp/B08M9HND4F?tag=${id || process.env.AMAZON_AFFILIATE_ID || 'wc2026-20'}`,
    revShare: 0.04, currency: 'USD',
    geo:    ['US','GB','DE','FR'],
    minAge: 0
  },
  fanatics: {
    name:   'Fanatics',
    url:    (id) => `https://www.fanatics.com/soccer?affid=${id || process.env.FANATICS_AFFILIATE_ID || 'YOUR_ID'}`,
    revShare: 0.10, currency: 'USD',
    geo:    ['US','GB'],
    minAge: 0
  }
};

// Source platforms
const PLATFORMS = ['twitter','bluesky','mastodon','telegram','discord','reddit','facebook','instagram','tiktok','email','web','prediction-game','news','direct'];

// ─── Storage ──────────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadClicks() {
  ensureDataDir();
  if (!fs.existsSync(CLICKS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(CLICKS_FILE, 'utf8')); }
  catch { return []; }
}

function logClick(click) {
  const clicks = loadClicks();
  clicks.unshift(click);
  if (clicks.length > 100000) clicks.length = 100000;
  fs.writeFileSync(CLICKS_FILE, JSON.stringify(clicks, null, 2), 'utf8');
}

function loadConversions() {
  ensureDataDir();
  if (!fs.existsSync(CONV_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(CONV_FILE, 'utf8')); }
  catch { return []; }
}

function logConversion(conv) {
  const convs = loadConversions();
  convs.unshift(conv);
  fs.writeFileSync(CONV_FILE, JSON.stringify(convs, null, 2), 'utf8');
}

// ─── Analytics helpers ────────────────────────────────────────────────────────

function summarizeClicks(clicks, days = 30) {
  const since = Date.now() - days * 86400000;
  const recent = clicks.filter(c => new Date(c.timestamp).getTime() > since);

  const byPartner  = {};
  const byPlatform = {};
  const byEvent    = {};
  const byDay      = {};

  for (const c of recent) {
    byPartner[c.partner]   = (byPartner[c.partner]   || 0) + 1;
    byPlatform[c.platform] = (byPlatform[c.platform] || 0) + 1;
    byEvent[c.event]       = (byEvent[c.event]       || 0) + 1;
    const day = c.timestamp?.slice(0, 10);
    if (day) byDay[day] = (byDay[day] || 0) + 1;
  }

  return { total: recent.length, byPartner, byPlatform, byEvent, byDay };
}

function summarizeRevenue(conversions) {
  const byPartner = {};
  let totalEstimate = 0;

  for (const conv of conversions) {
    const p = PARTNERS[conv.partner];
    if (!byPartner[conv.partner]) byPartner[conv.partner] = { conversions: 0, estimatedRevenue: 0 };
    byPartner[conv.partner].conversions++;
    const revenue = conv.revenue || (p?.cpa || 0);
    byPartner[conv.partner].estimatedRevenue += revenue;
    totalEstimate += revenue;
  }

  return { totalEstimate, byPartner };
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

// ─── Main redirect endpoint ───────────────────────────────────────────────────

app.get('/go/:partner', (req, res) => {
  const { partner } = req.params;
  const config = PARTNERS[partner.toLowerCase()];

  if (!config) return res.redirect(302, VERCEL_URL);

  const src      = req.query.src || 'direct';
  const evt      = req.query.evt || 'organic';
  const ref      = req.get('Referer') || '';
  const ua       = req.get('User-Agent') || '';
  const ip       = req.ip || req.connection.remoteAddress || '';
  const clickId  = crypto.randomBytes(8).toString('hex');

  // Log click
  logClick({
    clickId, partner, platform: src, event: evt,
    referrer: ref.slice(0, 200), ua: ua.slice(0, 100),
    ipHash:   crypto.createHash('md5').update(ip).digest('hex').slice(0, 8), // hashed for privacy
    timestamp: new Date().toISOString()
  });

  const destUrl = config.url() + (config.url().includes('?') ? '&' : '?') + `_clid=${clickId}`;
  console.log(`[Affiliate] ${src} → ${config.name} (${evt}) → ${clickId}`);

  res.redirect(302, destUrl);
});

// ─── Conversion tracking ──────────────────────────────────────────────────────

app.post('/conversion', auth, (req, res) => {
  const { partner, clickId, revenue, conversionType = 'signup', metadata = {} } = req.body;
  if (!partner) return res.status(400).json({ ok: false, error: 'partner required' });

  // Try to match click
  const clicks = loadClicks();
  const click  = clickId ? clicks.find(c => c.clickId === clickId) : null;

  const conv = {
    partner, clickId, revenue: revenue || PARTNERS[partner]?.cpa || 0,
    conversionType, platform: click?.platform || 'unknown',
    event: click?.event || 'unknown', metadata,
    timestamp: new Date().toISOString()
  };
  logConversion(conv);
  console.log(`[Affiliate] conversion: ${partner} £${conv.revenue} from ${conv.platform}`);
  res.json({ ok: true, conversion: conv });
});

// ─── Analytics dashboard ──────────────────────────────────────────────────────

app.get('/dashboard', auth, (req, res) => {
  const clicks      = loadClicks();
  const conversions = loadConversions();
  const days        = parseInt(req.query.days) || 30;

  const clickSummary = summarizeClicks(clicks, days);
  const revSummary   = summarizeRevenue(conversions);

  // Best performing platform (clicks)
  const bestPlatform = Object.entries(clickSummary.byPlatform).sort((a,b) => b[1]-a[1])[0];
  const bestPartner  = Object.entries(clickSummary.byPartner).sort((a,b) => b[1]-a[1])[0];

  res.json({
    ok:         true,
    period:     `Last ${days} days`,
    clicks:     clickSummary,
    conversions: { total: conversions.length, ...revSummary },
    insights: {
      bestPlatform: bestPlatform ? { platform: bestPlatform[0], clicks: bestPlatform[1] } : null,
      bestPartner:  bestPartner  ? { partner:  bestPartner[0],  clicks: bestPartner[1]  } : null
    }
  });
});

app.get('/links', (req, res) => {
  // Generate all affiliate links for a given source platform
  const src = req.query.src || 'web';
  const evt = req.query.evt || 'organic';
  const base = `${VERCEL_URL}/go`;
  const links = Object.entries(PARTNERS).map(([key, p]) => ({
    partner:  p.name,
    key,
    geo:      p.geo,
    cpa:      p.cpa,
    revShare: p.revShare,
    link:     `${base}/${key}?src=${src}&evt=${evt}`
  }));
  res.json({ ok: true, src, links });
});

app.get('/clicks', auth, (req, res) => {
  const clicks = loadClicks();
  const limit  = parseInt(req.query.limit) || 100;
  res.json({ ok: true, total: clicks.length, clicks: clicks.slice(0, limit) });
});

app.get('/status', (req, res) => {
  const clicks      = loadClicks();
  const conversions = loadConversions();
  res.json({ ok: true, service: 'affiliate-tracker', totalClicks: clicks.length, totalConversions: conversions.length, partners: Object.keys(PARTNERS) });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.AFFILIATE_PORT || process.env.PORT || 3031;
  app.listen(PORT, () => console.log(`[Affiliate Tracker] listening on :${PORT}`));
  ensureDataDir();

  // Weekly revenue report
  cron.schedule('0 8 * * 1', () => {
    const clicks      = loadClicks();
    const conversions = loadConversions();
    const clickSummary = summarizeClicks(clicks, 7);
    const revSummary   = summarizeRevenue(conversions.filter(c => new Date(c.timestamp) > new Date(Date.now() - 7*86400000)));
    console.log(`[Affiliate Weekly] ${clickSummary.total} clicks | £${revSummary.totalEstimate} revenue | Top platform: ${Object.entries(clickSummary.byPlatform).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'none'}`);
  });

  console.log(`[Affiliate Tracker] running on :${PORT} — tracking ${Object.keys(PARTNERS).length} partners`);
  console.log(`[Affiliate] Link format: /go/{partner}?src={platform}&evt={eventType}`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
