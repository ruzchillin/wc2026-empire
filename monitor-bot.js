/**
 * WC 2026 Sports Empire — Monitor Bot
 * Deploy on Railway.app as service "monitor-bot"
 *
 * Health-checks all Railway services every 60 seconds.
 * Sends Telegram DM alert to owner when a service goes down.
 * Attempts auto-restart via Railway API.
 *
 * Required env vars:
 *   RAILWAY_API_TOKEN  — Railway.app API token (from account settings)
 *   RAILWAY_PROJECT_ID — your Railway project ID
 *   TELEGRAM_BOT_TOKEN — bot token (from @BotFather)
 *   TELEGRAM_OWNER_ID  — your personal Telegram chat ID (from @userinfobot)
 *   PIPELINE_SECRET    — shared inter-service secret
 *
 * Each service registers its health endpoint here at boot.
 * Or configure them statically in SERVICES below.
 *
 * Endpoints:
 *   POST /register     — services self-register their health URL
 *   GET  /services     — list all monitored services + status
 *   GET  /status
 *   GET  /health
 */

'use strict';

require('dotenv').config();
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const RAILWAY_TOKEN    = process.env.RAILWAY_API_TOKEN   || '';
const RAILWAY_PROJECT  = process.env.RAILWAY_PROJECT_ID  || '';
const TG_BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN  || '';
const TG_OWNER_ID      = process.env.TELEGRAM_OWNER_ID   || '';
const PIPELINE_SECRET  = process.env.PIPELINE_SECRET     || '';

// ─── Service registry ─────────────────────────────────────────────────────────

// All 35 Railway services — priority order matches deploy order
// CRITICAL (P1) services alert immediately on first failure
// SOCIAL (P4) services alert after 2 consecutive failures (some flakiness is normal)
const SERVICES = [
  // ── Priority 1: Guards ────────────────────────────────────────────────────
  { name: 'dedup-guard',            url: process.env.DEDUP_GUARD_URL            || 'http://localhost:3033', port: 3033, critical: true  },
  { name: 'groq-budget-guard',      url: process.env.GROQ_BUDGET_URL            || 'http://localhost:3036', port: 3036, critical: true  },
  // ── Priority 2: Infrastructure ────────────────────────────────────────────
  { name: 'queue-processor',        url: process.env.QUEUE_PROCESSOR_URL        || 'http://localhost:3027', port: 3027, critical: true  },
  { name: 'stripe-webhook',         url: process.env.STRIPE_WEBHOOK_URL         || 'http://localhost:3024', port: 3024, critical: true  },
  { name: 'affiliate-tracker',      url: process.env.AFFILIATE_TRACKER_URL      || 'http://localhost:3031', port: 3031, critical: true  },
  // ── Priority 3: Core ──────────────────────────────────────────────────────
  { name: 'world-engine',           url: process.env.WORLD_ENGINE_URL           || 'http://localhost:3003', port: 3003, critical: true  },
  { name: 'moment-engine',          url: process.env.MOMENT_ENGINE_URL          || 'http://localhost:3001', port: 3001, critical: true  },
  { name: 'api-server',             url: process.env.API_SERVER_URL             || 'http://localhost:3002', port: 3002, critical: true  },
  { name: 'data-pipeline',          url: process.env.DATA_PIPELINE_URL          || 'http://localhost:3004', port: 3004, critical: true  },
  // ── Priority 4: Social engines ────────────────────────────────────────────
  { name: 'telegram-engine',        url: process.env.TELEGRAM_ENGINE_URL        || 'http://localhost:3029', port: 3029, critical: true  },
  { name: 'email-digest-engine',    url: process.env.EMAIL_DIGEST_URL           || 'http://localhost:3030', port: 3030, critical: true  },
  { name: 'twitter-engine',         url: process.env.TWITTER_ENGINE_URL         || 'http://localhost:3028', port: 3028, critical: false },
  { name: 'facebook-engine',        url: process.env.FACEBOOK_ENGINE_URL        || 'http://localhost:3021', port: 3021, critical: false },
  { name: 'discord-bot',            url: process.env.DISCORD_BOT_URL            || 'http://localhost:3022', port: 3022, critical: false },
  { name: 'reddit-bot',             url: process.env.REDDIT_BOT_URL             || 'http://localhost:3023', port: 3023, critical: false },
  { name: 'whatsapp-engine',        url: process.env.WHATSAPP_ENGINE_URL        || 'http://localhost:3034', port: 3034, critical: false },
  { name: 'translation-processor',  url: process.env.TRANSLATION_ENGINE_URL     || 'http://localhost:3026', port: 3026, critical: false },
  // ── Priority 5: Secondary ─────────────────────────────────────────────────
  { name: 'bluesky-engine',         url: process.env.BLUESKY_ENGINE_URL         || 'http://localhost:3006', port: 3006, critical: false },
  { name: 'mastodon-engine',        url: process.env.MASTODON_ENGINE_URL        || 'http://localhost:3007', port: 3007, critical: false },
  { name: 'commentary-live-engine',  url: process.env.COMMENTARY_ENGINE_URL      || 'http://localhost:3018', port: 3018, critical: false },
  { name: 'news-monitor',           url: process.env.NEWS_MONITOR_URL           || 'http://localhost:3019', port: 3019, critical: false },
  { name: 'youtube-uploader',       url: process.env.YOUTUBE_UPLOADER_URL       || 'http://localhost:3025', port: 3025, critical: false },
  { name: 'linkedin-post-engine',   url: process.env.LINKEDIN_ENGINE_URL        || 'http://localhost:3015', port: 3015, critical: false },
  { name: 'snapchat-engine',        url: process.env.SNAPCHAT_ENGINE_URL        || 'http://localhost:3010', port: 3010, critical: false },
  { name: 'twitch-bot',             url: process.env.TWITCH_BOT_URL             || 'http://localhost:3013', port: 3013, critical: false },
  { name: 'web-stories-generator',  url: process.env.WEB_STORIES_URL            || 'http://localhost:3014', port: 3014, critical: false },
  { name: 'podcast-engine',         url: process.env.PODCAST_ENGINE_URL         || 'http://localhost:3008', port: 3008, critical: false },
  { name: 'news-syndication-engine',url: process.env.NEWS_SYNDICATION_URL       || 'http://localhost:3009', port: 3009, critical: false },
  { name: 'naver-engine',           url: process.env.NAVER_ENGINE_URL           || 'http://localhost:3011', port: 3011, critical: false },
  { name: 'sharechat-engine',       url: process.env.SHARECHAT_ENGINE_URL       || 'http://localhost:3012', port: 3012, critical: false },
  { name: 'image-engine',           url: process.env.IMAGE_ENGINE_URL           || 'http://localhost:3016', port: 3016, critical: false },
  { name: 'visual-post-engine',     url: process.env.VISUAL_ENGINE_URL          || 'http://localhost:3017', port: 3017, critical: false },
  { name: 'ai-engine',              url: process.env.AI_ENGINE_URL              || 'http://localhost:3005', port: 3005, critical: false },
  // ── Priority 6: Analytics + sitemap ──────────────────────────────────────
  { name: 'analytics-aggregator',   url: process.env.ANALYTICS_URL              || 'http://localhost:3032', port: 3032, critical: false },
  { name: 'sitemap-generator',      url: process.env.SITEMAP_URL                || 'http://localhost:3037', port: 3037, critical: false },
  // ── New engines (Phase 2) ─────────────────────────────────────────────────
  { name: 'personal-agent',         url: process.env.PERSONAL_AGENT_URL         || 'http://localhost:3038', port: 3038, critical: true  },
  { name: 'line-engine',            url: process.env.LINE_ENGINE_URL            || 'http://localhost:3039', port: 3039, critical: false },
  { name: 'viber-engine',           url: process.env.VIBER_ENGINE_URL           || 'http://localhost:3040', port: 3040, critical: false },
  { name: 'odds-engine',            url: process.env.ODDS_ENGINE_URL            || 'http://localhost:3041', port: 3041, critical: true  },
  { name: 'medium-engine',          url: process.env.MEDIUM_ENGINE_URL          || 'http://localhost:3042', port: 3042, critical: false },
  { name: 'koo-engine',             url: process.env.KOO_ENGINE_URL             || 'http://localhost:3043', port: 3043, critical: false },
  { name: 'merchandise-engine',     url: process.env.MERCH_ENGINE_URL           || 'http://localhost:3044', port: 3044, critical: false },
  { name: 'fantasy-engine',         url: process.env.FANTASY_ENGINE_URL         || 'http://localhost:3045', port: 3045, critical: false },
  // Phase 3 — global expansion + agents
  { name: 'kakao-engine',           url: process.env.KAKAO_ENGINE_URL           || 'http://localhost:3046', port: 3046, critical: false },
  { name: 'zalo-engine',            url: process.env.ZALO_ENGINE_URL            || 'http://localhost:3047', port: 3047, critical: false },
  { name: 'vk-engine',              url: process.env.VK_ENGINE_URL              || 'http://localhost:3048', port: 3048, critical: false },
  { name: 'weibo-engine',           url: process.env.WEIBO_ENGINE_URL           || 'http://localhost:3049', port: 3049, critical: false },
  { name: 'nairaland-engine',       url: process.env.NAIRALAND_ENGINE_URL       || 'http://localhost:3050', port: 3050, critical: false },
  { name: 'empire-agent',           url: process.env.EMPIRE_AGENT_URL           || 'http://localhost:3051', port: 3051, critical: true  },
  { name: 'growth-agent',           url: process.env.GROWTH_AGENT_URL           || 'http://localhost:3052', port: 3052, critical: false },
  { name: 'traffic-amplifier',      url: process.env.TRAFFIC_AMPLIFIER_URL      || 'http://localhost:3053', port: 3053, critical: false },
];

// Dynamic registrations (services can call POST /register)
const dynamicServices = [];

// State tracking
const serviceState = {}; // name -> { up, failCount, lastCheck, responseMs, lastAlert }

// ─── Telegram alerts ──────────────────────────────────────────────────────────

async function tgSend(text) {
  if (!TG_BOT_TOKEN || !TG_OWNER_ID) {
    console.warn('[Monitor] Telegram not configured — alert suppressed:', text.slice(0, 80));
    return;
  }
  await axios.post(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    chat_id:    TG_OWNER_ID,
    text,
    parse_mode: 'HTML'
  }, { timeout: 10000 }).catch(e => console.error('[Telegram alert error]', e.message));
}

// ─── Railway auto-restart ─────────────────────────────────────────────────────

async function railwayRestart(serviceName) {
  if (!RAILWAY_TOKEN || !RAILWAY_PROJECT) return false;
  try {
    // Railway GraphQL API
    const r = await axios.post(
      'https://backboard.railway.app/graphql/v2',
      {
        query: `
          mutation serviceInstanceRedeploy($serviceId: String!) {
            serviceInstanceRedeploy(serviceId: $serviceId)
          }
        `,
        variables: { serviceId: serviceName }
      },
      {
        headers: {
          Authorization: `Bearer ${RAILWAY_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    const ok = !r.data?.errors;
    console.log(`[Monitor] Railway restart ${serviceName}: ${ok ? 'triggered' : 'failed'}`);
    return ok;
  } catch (e) {
    console.error('[Railway restart]', e.message);
    return false;
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

async function checkService(svc) {
  const start = Date.now();
  const name  = svc.name;
  const prev  = serviceState[name] || { up: true, failCount: 0, lastCheck: null, lastAlert: 0 };

  try {
    const r = await axios.get(`${svc.url}/health`, { timeout: 8000 });
    const ms = Date.now() - start;
    const wasDown = !prev.up;

    serviceState[name] = { up: true, failCount: 0, lastCheck: new Date().toISOString(), responseMs: ms, lastAlert: prev.lastAlert };

    if (wasDown && prev.failCount >= 2) {
      // Service recovered
      await tgSend(`✅ <b>${name}</b> is back up (${ms}ms)\n⏱ Was down for ~${Math.round((Date.now() - prev.lastAlert) / 60000)} min`);
      console.log(`[Monitor] ✅ ${name} recovered`);
    }
  } catch (e) {
    const failCount = (prev.failCount || 0) + 1;
    serviceState[name] = { up: false, failCount, lastCheck: new Date().toISOString(), responseMs: null, lastAlert: prev.lastAlert, lastError: e.message };
    console.warn(`[Monitor] ❌ ${name} fail #${failCount}: ${e.message}`);

    // Critical services alert on 1st failure; non-critical alert after 2nd (avoids flapping)
    const alertThreshold = svc.critical ? 1 : 2;
    if (failCount === alertThreshold) {
      const restartOk = await railwayRestart(name);
      const now = Date.now();
      serviceState[name].lastAlert = now;

      await tgSend(
        `🚨 <b>${name}</b> is DOWN\n` +
        `Error: ${e.message.slice(0, 100)}\n` +
        `Fail count: ${failCount}\n` +
        `Auto-restart: ${restartOk ? '✅ triggered' : '❌ failed (check Railway)'}\n` +
        `URL: ${svc.url}`
      );
    }
  }
}

async function runHealthChecks() {
  const all = [...SERVICES, ...dynamicServices];
  // Run checks in parallel batches of 5
  for (let i = 0; i < all.length; i += 5) {
    await Promise.allSettled(all.slice(i, i + 5).map(checkService));
  }
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// Services self-register at boot
app.post('/register', auth, (req, res) => {
  const { name, url, description } = req.body;
  if (!name || !url) return res.status(400).json({ ok: false, error: 'name and url required' });
  const existing = dynamicServices.findIndex(s => s.name === name);
  if (existing >= 0) dynamicServices[existing] = { name, url, description };
  else dynamicServices.push({ name, url, description });
  console.log(`[Monitor] registered: ${name} → ${url}`);
  res.json({ ok: true, registered: name });
});

app.get('/services', (req, res) => {
  const all = [...SERVICES, ...dynamicServices];
  const result = all.map(svc => ({
    name:    svc.name,
    url:     svc.url,
    ...serviceState[svc.name] || { up: null, lastCheck: null, note: 'not yet checked' }
  }));
  const upCount   = result.filter(s => s.up === true).length;
  const downCount = result.filter(s => s.up === false).length;
  res.json({ ok: true, total: result.length, up: upCount, down: downCount, services: result });
});

app.post('/check-now', auth, async (req, res) => {
  await runHealthChecks();
  res.json({ ok: true, checked: SERVICES.length + dynamicServices.length });
});

app.post('/alert-test', auth, async (req, res) => {
  await tgSend('🔔 WC 2026 Monitor Bot test alert — all systems operational!');
  res.json({ ok: true });
});

app.get('/status', (req, res) => {
  const all     = [...SERVICES, ...dynamicServices];
  const up      = all.filter(s => serviceState[s.name]?.up === true).length;
  const down    = all.filter(s => serviceState[s.name]?.up === false).length;
  const unknown = all.filter(s => serviceState[s.name]?.up == null).length;
  res.json({
    ok:                true,
    service:           'monitor-bot',
    telegramConfigured: !!(TG_BOT_TOKEN && TG_OWNER_ID),
    railwayConfigured:  !!(RAILWAY_TOKEN && RAILWAY_PROJECT),
    monitoredServices:  all.length,
    up, down, unknown,
    checkIntervalSecs:  60
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.MONITOR_PORT || process.env.PORT || 3020;
  app.listen(PORT, () => console.log(`[Monitor Bot] listening on :${PORT}`));

  if (!TG_BOT_TOKEN)   console.warn('[Monitor] TELEGRAM_BOT_TOKEN not set — alerts disabled');
  if (!RAILWAY_TOKEN)  console.warn('[Monitor] RAILWAY_API_TOKEN not set — auto-restart disabled');

  // Run initial check after 30s (give services time to start)
  setTimeout(runHealthChecks, 30000);

  // Check every 60 seconds
  cron.schedule('* * * * *', runHealthChecks);

  // Daily summary at 08:00 UTC
  cron.schedule('0 8 * * *', async () => {
    const all    = [...SERVICES, ...dynamicServices];
    const up     = all.filter(s => serviceState[s.name]?.up === true);
    const down   = all.filter(s => serviceState[s.name]?.up === false);
    const report = [
      `📊 <b>WC 2026 Daily Status Report</b>`,
      `✅ Up: ${up.length}/${all.length}`,
      down.length > 0 ? `❌ Down: ${down.map(s => s.name).join(', ')}` : '🎉 All services healthy!',
      `Time: ${new Date().toUTCString()}`
    ].join('\n');
    await tgSend(report);
  });

  await tgSend(`🤖 <b>Monitor Bot started</b>\nWatching ${SERVICES.length} services\nCheck interval: 60s`);
  console.log(`[Monitor Bot] watching ${SERVICES.length} services — check every 60s`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
