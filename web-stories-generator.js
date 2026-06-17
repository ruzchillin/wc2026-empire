/**
 * WC 2026 Sports Empire — Google Web Stories Generator
 * Deploy on Railway.app as service "web-stories-generator"
 * OR run as a build script (node web-stories-generator.js --build)
 *
 * Generates AMP Web Stories (Visual Stories) — a tap-through story format
 * that appears PROMINENTLY in Google Discover and Google Search.
 * Massive organic traffic driver during major sporting events.
 *
 * Each story = 5-7 visual "pages" (slides) covering:
 *   - Page 1: Match title card
 *   - Page 2: Teams + key players
 *   - Page 3: AI prediction
 *   - Page 4: Head-to-head stats
 *   - Page 5: Tournament context
 *   - Page 6 (optional): Live goal update
 *
 * Stories are valid HTML files deployed to Vercel.
 * They're auto-discovered by Google via your sitemap.
 *
 * Required env vars:
 *   VERCEL_URL          — your site URL
 *   API_SERVER_URL      — for match data
 *   GROQ_API_KEY        — for story text generation
 *   OUTPUT_DIR          — where to save stories (default: ./web-stories)
 *   PIPELINE_SECRET     — shared inter-service secret
 *
 * Endpoints:
 *   POST /generate/match   — generate story for a match
 *   POST /generate/today   — generate stories for all today's matches
 *   POST /trigger          — moment-engine webhook (goal stories)
 *   GET  /stories          — list generated stories
 *   GET  /sitemap          — sitemap XML of all stories
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const VERCEL_URL      = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const API_SERVER_URL  = process.env.API_SERVER_URL || 'http://localhost:3001';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'web-stories');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const STORIES_LOG = path.join(__dirname, 'web-stories-log.json');

// ─── Color palettes per match situation ──────────────────────────────────────

const PALETTES = {
  default: { bg1: '#0a0f2c', bg2: '#1a1f4c', accent: '#FFD700', text: '#ffffff' },
  goal:    { bg1: '#1a2800', bg2: '#2d4a00', accent: '#76ff03', text: '#ffffff' },
  result:  { bg1: '#1a0028', bg2: '#2d0045', accent: '#ea80fc', text: '#ffffff' },
};

// ─── AMP Web Story HTML builder ───────────────────────────────────────────────

function buildWebStory({ title, slug, description, poster, pages, publishDate }) {
  const pagesHTML = pages.map((page, i) => buildPage(page, i)).join('\n');
  const posterUrl = poster || `${VERCEL_URL}/images/wc2026-og.jpg`;

  return `<!DOCTYPE html>
<html amp lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">
  <meta name="description" content="${escAttr(description)}">
  <title>${escAttr(title)}</title>
  <link rel="canonical" href="${VERCEL_URL}/stories/${slug}.html">
  <meta name="robots" content="index,follow">
  <meta property="og:title" content="${escAttr(title)}">
  <meta property="og:description" content="${escAttr(description)}">
  <meta property="og:image" content="${posterUrl}">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <script async custom-element="amp-story" src="https://cdn.ampproject.org/v0/amp-story-1.0.js"></script>
  <script async custom-element="amp-video" src="https://cdn.ampproject.org/v0/amp-video-0.1.js"></script>
  <style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
  <style amp-custom>
    amp-story { font-family: 'Arial', sans-serif; }
    amp-story-page { background: #0a0f2c; }
    .cover-bg { background: linear-gradient(160deg, #0a0f2c 0%, #1a1f4c 100%); }
    h1 { font-size: 2.2em; line-height: 1.2; font-weight: 900; }
    h2 { font-size: 1.8em; font-weight: 700; }
    p  { font-size: 1.1em; line-height: 1.6; opacity: 0.9; }
    .badge { display: inline-block; background: #FFD700; color: #0a0f2c; padding: 6px 18px; border-radius: 40px; font-size: 0.9em; font-weight: 900; letter-spacing: 1px; }
    .score-big { font-size: 3em; font-weight: 900; color: #FFD700; }
    .dim { opacity: 0.7; }
  </style>
</head>
<body>
<amp-story standalone
  title="${escAttr(title)}"
  publisher="WC 2026 Live"
  publisher-logo-src="${VERCEL_URL}/logo-96.png"
  poster-portrait-src="${posterUrl}"
  poster-square-src="${posterUrl}"
>
${pagesHTML}
  <amp-story-bookend src="${VERCEL_URL}/bookend.json" layout="nodisplay"></amp-story-bookend>
</amp-story>
</body>
</html>`;
}

function buildPage(page, index) {
  const { bg = '#0a0f2c', accent = '#FFD700', layers = [] } = page;
  const layersHTML = layers.map(l => buildLayer(l, accent)).join('\n');

  return `
  <amp-story-page id="page-${index + 1}" auto-advance-after="${page.autoAdvance || '5s'}">
    <amp-story-grid-layer template="fill">
      <div style="width:100%;height:100%;background:${bg};"></div>
    </amp-story-grid-layer>
    ${layersHTML}
  </amp-story-page>`;
}

function buildLayer(layer, accent) {
  if (layer.type === 'cover') {
    return `
    <amp-story-grid-layer template="cover" class="cover-bg">
      <h1 style="color:#fff;padding:0 20px 10px;margin-top:60%;">${escHTML(layer.title)}</h1>
      ${layer.subtitle ? `<p style="color:${accent};padding:0 20px;">${escHTML(layer.subtitle)}</p>` : ''}
    </amp-story-grid-layer>`;
  }

  if (layer.type === 'thirds') {
    return `
    <amp-story-grid-layer template="thirds">
      <div grid-area="upper-third" style="padding:20px 24px 0;color:#fff;">
        ${layer.upper ? `<h2 style="color:${accent};">${escHTML(layer.upper)}</h2>` : ''}
      </div>
      <div grid-area="middle-third" style="padding:10px 24px;color:#fff;">
        ${layer.middle ? `<p>${escHTML(layer.middle)}</p>` : ''}
      </div>
      <div grid-area="lower-third" style="padding:0 24px 20px;color:#fff;">
        ${layer.lower ? `<p class="dim" style="font-size:0.9em;">${escHTML(layer.lower)}</p>` : ''}
      </div>
    </amp-story-grid-layer>`;
  }

  if (layer.type === 'vertical') {
    const items = (layer.items || []).map(item =>
      `<p style="color:#fff;padding:8px 24px;font-size:1.05em;">${escHTML(item)}</p>`
    ).join('');
    return `
    <amp-story-grid-layer template="vertical" style="padding-top:80px;">
      ${layer.title ? `<h2 style="color:${accent};padding:0 24px 16px;">${escHTML(layer.title)}</h2>` : ''}
      ${items}
    </amp-story-grid-layer>`;
  }

  return '';
}

function escHTML(s)  { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s)  { return String(s || '').replace(/"/g,'&quot;').replace(/&/g,'&amp;'); }

// ─── Story content builders ───────────────────────────────────────────────────

async function buildMatchPreviewPages(homeTeam, awayTeam, kickoff, venue, prediction) {
  const timeUTC = kickoff
    ? new Date(kickoff).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
    : 'TBD';

  const pages = [
    // Page 1: Cover
    {
      bg: '#0a0f2c',
      autoAdvance: '6s',
      layers: [{
        type:     'cover',
        title:    `${homeTeam} vs ${awayTeam}`,
        subtitle: `2026 FIFA World Cup — ${timeUTC}`
      }]
    },
    // Page 2: Match info
    {
      bg: '#1a1f4c',
      autoAdvance: '6s',
      layers: [{
        type:   'vertical',
        title:  'Match Details',
        items:  [
          `⏰ Kick-off: ${timeUTC}`,
          venue ? `📍 Venue: ${venue}` : null,
          `🌍 Tournament: 2026 FIFA World Cup`,
          `📊 Full preview at wc2026live.vercel.app`
        ].filter(Boolean)
      }]
    },
    // Page 3: AI prediction
    prediction ? {
      bg: '#0d1a0d',
      accent: '#76ff03',
      autoAdvance: '7s',
      layers: [{
        type:   'thirds',
        upper:  '🤖 AI Prediction',
        middle: `${homeTeam} ${prediction.homeWinPct}% · Draw ${prediction.drawPct}% · ${awayTeam} ${prediction.awayWinPct}%`,
        lower:  prediction.keyFactor || 'Based on real match data and tournament form'
      }]
    } : null,
    // Page 4: Where to watch
    {
      bg: '#1a0a2c',
      accent: '#ea80fc',
      autoAdvance: '6s',
      layers: [{
        type:  'vertical',
        title: '📺 Follow Live',
        items: [
          '⚽ Live scores on wc2026live.vercel.app',
          '📱 Goal alerts via push notification',
          '🤖 AI predictions updated in real-time',
          '📊 Full stats & standings'
        ]
      }]
    }
  ].filter(Boolean);

  return pages;
}

async function buildGoalStoryPages(data) {
  const { homeTeam, awayTeam, homeScore, awayScore, minute, player } = data;
  return [
    {
      bg: '#1a2800',
      accent: '#76ff03',
      autoAdvance: '5s',
      layers: [{
        type:     'cover',
        title:    `⚽ GOAL!`,
        subtitle: `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`
      }]
    },
    {
      bg: '#0d1a00',
      accent: '#76ff03',
      autoAdvance: '6s',
      layers: [{
        type:   'thirds',
        upper:  `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
        middle: player ? `⚽ Scored by: ${player} (${minute}')` : `⚽ Goal in the ${minute}th minute!`,
        lower:  'Follow for more live WC 2026 updates'
      }]
    }
  ];
}

// ─── Generate and save story ──────────────────────────────────────────────────

async function generateMatchStory(homeTeam, awayTeam, kickoff, venue, prediction) {
  const slug = `${homeTeam}-vs-${awayTeam}-${new Date(kickoff || Date.now()).toISOString().split('T')[0]}`
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

  const title       = `${homeTeam} vs ${awayTeam} — WC 2026 Preview`;
  const description = `Preview, AI predictions and live updates for ${homeTeam} vs ${awayTeam} at the 2026 FIFA World Cup.`;
  const pages       = await buildMatchPreviewPages(homeTeam, awayTeam, kickoff, venue, prediction);

  const html = buildWebStory({ title, slug, description, pages, publishDate: new Date().toISOString() });
  const filepath = path.join(OUTPUT_DIR, `${slug}.html`);
  fs.writeFileSync(filepath, html, 'utf8');

  const log = fs.existsSync(STORIES_LOG) ? JSON.parse(fs.readFileSync(STORIES_LOG, 'utf8')) : [];
  const entry = { type: 'MATCH_PREVIEW', slug, title, homeTeam, awayTeam, kickoff, filepath, url: `${VERCEL_URL}/stories/${slug}.html`, createdAt: new Date().toISOString() };
  log.unshift(entry);
  fs.writeFileSync(STORIES_LOG, JSON.stringify(log.slice(0, 200), null, 2));

  console.log(`[Web Stories] generated: ${slug}.html`);
  return entry;
}

async function generateGoalStory(data) {
  const { homeTeam, awayTeam, homeScore, awayScore, minute } = data;
  const slug = `goal-${homeTeam}-${awayTeam}-${homeScore}-${awayScore}-${minute}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const title       = `GOAL! ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} — WC 2026`;
  const description = `Goal alert: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} at WC 2026.`;
  const pages       = await buildGoalStoryPages(data);

  const html = buildWebStory({ title, slug, description, pages, publishDate: new Date().toISOString() });
  const filepath = path.join(OUTPUT_DIR, `${slug}.html`);
  fs.writeFileSync(filepath, html, 'utf8');

  const log = fs.existsSync(STORIES_LOG) ? JSON.parse(fs.readFileSync(STORIES_LOG, 'utf8')) : [];
  const entry = { type: 'GOAL', slug, title, filepath, url: `${VERCEL_URL}/stories/${slug}.html`, createdAt: new Date().toISOString() };
  log.unshift(entry);
  fs.writeFileSync(STORIES_LOG, JSON.stringify(log.slice(0, 200), null, 2));

  return entry;
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/stories', express.static(OUTPUT_DIR));

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  try {
    if (['GOAL', 'PENALTY_GOAL', 'OWN_GOAL'].includes(eventType)) {
      const story = await generateGoalStory(data);
      return res.json({ ok: true, ...story });
    }
    res.json({ ok: true, skipped: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/generate/match', auth, async (req, res) => {
  try {
    const { homeTeam, awayTeam, kickoff, venue, prediction } = req.body;
    if (!homeTeam || !awayTeam) return res.status(400).json({ ok: false, error: 'homeTeam and awayTeam required' });
    const story = await generateMatchStory(homeTeam, awayTeam, kickoff, venue, prediction);
    res.json({ ok: true, ...story });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/generate/today', auth, async (req, res) => {
  try {
    const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/today`, { timeout: 15000 });
    const matches = r.data?.matches || r.data?.response || [];
    const stories = [];

    for (const m of matches) {
      const homeTeam = m.teams?.home?.name || m.homeTeam;
      const awayTeam = m.teams?.away?.name || m.awayTeam;
      if (!homeTeam || !awayTeam) continue;

      let prediction = null;
      if (m.fixture?.id) {
        const pred = await axios.get(`${API_SERVER_URL}/api/v1/ai/predictions/${m.fixture.id}`, { timeout: 10000 }).catch(() => null);
        prediction = pred?.data?.prediction;
      }

      const story = await generateMatchStory(homeTeam, awayTeam, m.fixture?.date, m.fixture?.venue?.name, prediction);
      stories.push(story);
      await new Promise(r => setTimeout(r, 2000));
    }

    res.json({ ok: true, count: stories.length, stories });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/stories', (req, res) => {
  const log = fs.existsSync(STORIES_LOG) ? JSON.parse(fs.readFileSync(STORIES_LOG, 'utf8')) : [];
  res.json({ ok: true, count: log.length, stories: log.slice(0, 30) });
});

app.get('/sitemap', (req, res) => {
  const log = fs.existsSync(STORIES_LOG) ? JSON.parse(fs.readFileSync(STORIES_LOG, 'utf8')) : [];
  const urls = log.map(s => `
  <url>
    <loc>${VERCEL_URL}/stories/${s.slug}.html</loc>
    <lastmod>${s.createdAt}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`).join('\n');

  res.setHeader('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
});

app.get('/status', (req, res) => {
  const log = fs.existsSync(STORIES_LOG) ? JSON.parse(fs.readFileSync(STORIES_LOG, 'utf8')) : [];
  res.json({
    ok:          true,
    service:     'web-stories-generator',
    storiesTotal: log.length,
    outputDir:   OUTPUT_DIR,
    sitemapUrl:  `${VERCEL_URL}/stories-sitemap.xml`,
    googleNote:  'Add sitemap URL to Google Search Console for Discover inclusion'
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.STORIES_PORT || process.env.PORT || 3014;
  app.listen(PORT, () => console.log(`[Web Stories Generator] listening on :${PORT}`));

  // Generate stories for today's matches at 08:30 UTC daily
  cron.schedule('30 8 * * *', async () => {
    try {
      const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/today`, { timeout: 15000 });
      const matches = r.data?.matches || r.data?.response || [];
      for (const m of matches) {
        const homeTeam = m.teams?.home?.name || m.homeTeam;
        const awayTeam = m.teams?.away?.name || m.awayTeam;
        if (!homeTeam || !awayTeam) continue;
        await generateMatchStory(homeTeam, awayTeam, m.fixture?.date, m.fixture?.venue?.name, null);
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (e) {
      console.error('[Web Stories] daily generation failed:', e.message);
    }
  });

  console.log(`[Web Stories Generator] running
  Stories: ${OUTPUT_DIR}
  Sitemap: ${VERCEL_URL}/stories-sitemap.xml
  Daily generation: 08:30 UTC
  Submit sitemap to: Google Search Console → Sitemaps
  `);
}

// CLI mode: node web-stories-generator.js --build (for manual builds)
if (process.argv.includes('--build')) {
  console.log('[Web Stories] build mode — use API endpoints after deployment');
  process.exit(0);
} else {
  boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
}
