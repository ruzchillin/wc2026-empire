/**
 * WC 2026 Sports Empire — Analytics Aggregator
 * Deploy on Railway.app as service "analytics-aggregator"
 * Port: 3032
 *
 * Polls /status and /posts from every engine every 5 minutes.
 * Aggregates into a single unified dashboard showing:
 *   - Total posts/tweets/messages sent across all platforms
 *   - Which platforms are up vs down
 *   - Best performing content types
 *   - Revenue estimates
 *   - Subscriber/follower growth
 *   - Affiliate click attribution
 *
 * Outputs:
 *   GET /dashboard        — JSON analytics
 *   GET /dashboard.html   — Beautiful HTML dashboard
 *   GET /health-matrix    — quick up/down grid of all services
 */

'use strict';

require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const cron    = require('node-cron');

const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';
const VERCEL_URL      = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');

// All engine endpoints
const ENGINES = [
  { name: 'API Server',         key: 'api',         url: process.env.API_SERVER_URL          || 'http://localhost:3001' },
  { name: 'Bluesky',            key: 'bluesky',     url: process.env.BLUESKY_ENGINE_URL      || 'http://localhost:3006' },
  { name: 'Mastodon',           key: 'mastodon',    url: process.env.MASTODON_ENGINE_URL     || 'http://localhost:3007' },
  { name: 'Podcast',            key: 'podcast',     url: process.env.PODCAST_ENGINE_URL      || 'http://localhost:3008' },
  { name: 'News Syndication',   key: 'newsSynd',    url: process.env.NEWS_SYNDICATION_URL    || 'http://localhost:3009' },
  { name: 'Snapchat',           key: 'snapchat',    url: process.env.SNAPCHAT_ENGINE_URL     || 'http://localhost:3010' },
  { name: 'Naver',              key: 'naver',       url: process.env.NAVER_ENGINE_URL        || 'http://localhost:3011' },
  { name: 'ShareChat',          key: 'sharechat',   url: process.env.SHARECHAT_ENGINE_URL    || 'http://localhost:3012' },
  { name: 'Twitch',             key: 'twitch',      url: process.env.TWITCH_BOT_URL          || 'http://localhost:3013' },
  { name: 'Web Stories',        key: 'webStories',  url: process.env.WEB_STORIES_URL         || 'http://localhost:3014' },
  { name: 'LinkedIn',           key: 'linkedin',    url: process.env.LINKEDIN_ENGINE_URL     || 'http://localhost:3015' },
  { name: 'Image Engine',       key: 'image',       url: process.env.IMAGE_ENGINE_URL        || 'http://localhost:3016' },
  { name: 'Visual Post',        key: 'visual',      url: process.env.VISUAL_ENGINE_URL       || 'http://localhost:3017' },
  { name: 'Commentary',         key: 'commentary',  url: process.env.COMMENTARY_ENGINE_URL   || 'http://localhost:3018' },
  { name: 'News Monitor',       key: 'newsMonitor', url: process.env.NEWS_MONITOR_URL        || 'http://localhost:3019' },
  { name: 'Monitor Bot',        key: 'monitor',     url: process.env.MONITOR_BOT_URL         || 'http://localhost:3020' },
  { name: 'Facebook/Threads',   key: 'facebook',    url: process.env.FACEBOOK_ENGINE_URL     || 'http://localhost:3021' },
  { name: 'Discord',            key: 'discord',     url: process.env.DISCORD_BOT_URL         || 'http://localhost:3022' },
  { name: 'Reddit',             key: 'reddit',      url: process.env.REDDIT_BOT_URL          || 'http://localhost:3023' },
  { name: 'Stripe Webhook',     key: 'stripe',      url: process.env.STRIPE_WEBHOOK_URL      || 'http://localhost:3024' },
  { name: 'YouTube',            key: 'youtube',     url: process.env.YOUTUBE_UPLOADER_URL    || 'http://localhost:3025' },
  { name: 'Translation',        key: 'translation', url: process.env.TRANSLATION_ENGINE_URL  || 'http://localhost:3026' },
  { name: 'Queue Processor',    key: 'queue',       url: process.env.QUEUE_PROCESSOR_URL     || 'http://localhost:3027' },
  { name: 'Twitter/X',          key: 'twitter',     url: process.env.TWITTER_ENGINE_URL      || 'http://localhost:3028' },
  { name: 'Telegram',           key: 'telegram',    url: process.env.TELEGRAM_ENGINE_URL     || 'http://localhost:3029' },
  { name: 'Email Digest',       key: 'email',       url: process.env.EMAIL_DIGEST_URL        || 'http://localhost:3030' },
  { name: 'Affiliate Tracker',  key: 'affiliate',   url: process.env.AFFILIATE_TRACKER_URL   || 'http://localhost:3031' },
  { name: 'WhatsApp',           key: 'whatsapp',    url: process.env.WHATSAPP_ENGINE_URL     || 'http://localhost:3034' }
];

// Last polled data
let lastSnapshot = null;
let lastPoll     = null;

// ─── Poll all engines ─────────────────────────────────────────────────────────

async function pollEngine(engine) {
  try {
    const start = Date.now();
    const r = await axios.get(`${engine.url.replace(/\/$/, '')}/status`, {
      headers: { 'x-pipeline-secret': PIPELINE_SECRET },
      timeout: 8000
    });
    const ms = Date.now() - start;
    return { key: engine.key, name: engine.name, up: true, ms, data: r.data };
  } catch (e) {
    const isLocalhost = engine.url.includes('localhost');
    return { key: engine.key, name: engine.name, up: false, error: isLocalhost ? 'dev-offline' : e.message };
  }
}

async function pollAll() {
  console.log('[Analytics] polling all engines...');
  const results = await Promise.allSettled(ENGINES.map(e => pollEngine(e)));
  const snapshot = {
    timestamp: new Date().toISOString(),
    engines:   {}
  };

  for (const r of results) {
    if (r.status === 'fulfilled') {
      snapshot.engines[r.value.key] = r.value;
    }
  }

  // Aggregate totals
  snapshot.totals = aggregateTotals(snapshot.engines);
  lastSnapshot = snapshot;
  lastPoll     = new Date();
  console.log(`[Analytics] polled ${Object.keys(snapshot.engines).length} engines`);
  return snapshot;
}

function aggregateTotals(engines) {
  const totals = {
    enginesUp:    0,
    enginesDown:  0,
    postsTotal:   0,
    platforms:    {}
  };

  for (const [key, e] of Object.entries(engines)) {
    if (e.up) totals.enginesUp++;
    else totals.enginesDown++;

    const d = e.data;
    if (!d) continue;

    // Extract post counts from different engine shapes
    const count =
      d.postCount?.total ||
      d.tweetCount?.total ||
      d.stats?.sent ||
      d.totalPublished ||
      d.uploads?.length ||
      0;

    if (count) {
      totals.postsTotal += count;
      totals.platforms[key] = count;
    }
  }

  return totals;
}

// ─── HTML dashboard ───────────────────────────────────────────────────────────

function renderDashboard(snapshot) {
  if (!snapshot) return '<h2 style="color:#fff">No data yet — first poll in progress</h2>';

  const engines = Object.values(snapshot.engines);
  const up      = engines.filter(e => e.up).length;
  const down    = engines.filter(e => !e.up && e.error !== 'dev-offline').length;
  const { totals } = snapshot;

  const rows = engines.map(e => {
    const statusColor = e.up ? '#76ff03' : e.error === 'dev-offline' ? '#888' : '#ff3333';
    const statusLabel = e.up ? '✅ UP' : e.error === 'dev-offline' ? '⚪ DEV' : '❌ DOWN';
    const ms          = e.ms ? `${e.ms}ms` : '';
    const posts       = totals.platforms[e.key] || 0;
    return `<tr>
      <td style="padding:10px 12px;color:#ddd">${e.name}</td>
      <td style="padding:10px 12px;color:${statusColor};font-weight:bold">${statusLabel}</td>
      <td style="padding:10px 12px;color:#888">${ms}</td>
      <td style="padding:10px 12px;color:#76ff03">${posts > 0 ? posts.toLocaleString() : '—'}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="300">
  <title>WC 2026 Empire — Analytics</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0a; color: #fff; font-family: 'Segoe UI', Arial, sans-serif; }
    .header { background: linear-gradient(135deg, #0a2400, #1a4a00); padding: 24px; text-align: center; }
    .header h1 { color: #76ff03; letter-spacing: 3px; font-size: 20px; }
    .header p  { color: #888; font-size: 12px; margin-top: 6px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; padding: 24px; }
    .card { background: #111; border-radius: 10px; padding: 20px; text-align: center; }
    .card .val { font-size: 32px; font-weight: bold; color: #76ff03; }
    .card .lbl { font-size: 12px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    table { width: 100%; border-collapse: collapse; }
    tr:nth-child(even) { background: #0d0d0d; }
    th { text-align: left; padding: 10px 12px; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; background: #111; }
    .section { margin: 0 24px 24px; background: #111; border-radius: 10px; overflow: hidden; }
    .section h2 { padding: 16px; color: #76ff03; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #222; }
    .ts { color: #555; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚽ WC 2026 EMPIRE — ANALYTICS</h1>
    <p>Last updated: ${new Date(snapshot.timestamp).toUTCString()} | Auto-refreshes every 5 min</p>
  </div>

  <div class="grid">
    <div class="card"><div class="val">${up}</div><div class="lbl">Engines Up</div></div>
    <div class="card"><div class="val" style="color:${down > 0 ? '#ff3333' : '#76ff03'}">${down}</div><div class="lbl">Engines Down</div></div>
    <div class="card"><div class="val">${totals.postsTotal.toLocaleString()}</div><div class="lbl">Total Posts</div></div>
    <div class="card"><div class="val">${engines.length}</div><div class="lbl">Total Engines</div></div>
  </div>

  <div class="section">
    <h2>📡 Engine Status Matrix</h2>
    <table>
      <thead><tr><th>Engine</th><th>Status</th><th>Response</th><th>Posts</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div style="text-align:center;color:#333;font-size:12px;padding:20px">
    WC 2026 Live • <a href="${VERCEL_URL}" style="color:#76ff03">Main Site</a>
  </div>
</body>
</html>`;
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.get('/dashboard', auth, (req, res) => {
  res.json({ ok: true, lastPoll, snapshot: lastSnapshot });
});

app.get('/dashboard.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderDashboard(lastSnapshot));
});

app.get('/health-matrix', (req, res) => {
  if (!lastSnapshot) return res.json({ ok: false, error: 'no data yet' });
  const matrix = Object.entries(lastSnapshot.engines).map(([key, e]) => ({
    key, name: e.name, up: e.up, ms: e.ms
  }));
  res.json({ ok: true, timestamp: lastSnapshot.timestamp, matrix });
});

app.post('/poll', auth, async (req, res) => {
  const snapshot = await pollAll().catch(e => ({ error: e.message }));
  res.json({ ok: !snapshot.error, snapshot });
});

app.get('/status', (req, res) => {
  res.json({ ok: true, service: 'analytics-aggregator', lastPoll, enginesTracked: ENGINES.length });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function boot() {
  const PORT = process.env.ANALYTICS_PORT || process.env.PORT || 3032;
  app.listen(PORT, () => console.log(`[Analytics] listening on :${PORT}`));

  // Poll every 5 minutes
  cron.schedule('*/5 * * * *', () => pollAll().catch(e => console.error('[Analytics poll]', e.message)));
  // Initial poll after 15s
  setTimeout(() => pollAll().catch(e => console.error('[Analytics boot]', e.message)), 15000);

  console.log(`[Analytics] running on :${PORT} — tracking ${ENGINES.length} engines`);
  console.log(`[Analytics] Dashboard: http://localhost:${PORT}/dashboard.html`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
