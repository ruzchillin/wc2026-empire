/**
 * personal-agent.js
 * Your personal AI command centre — lives in your Telegram.
 *
 * TWO-WAY: you text it commands, it texts you proactively.
 *
 * Proactive (no action needed from you):
 *   07:00 UTC  — Morning briefing: today's matches, yesterday revenue est., token budget, service health
 *   -60 min    — Match kickoff alert: "Brazil vs France in 60 min, pipeline armed"
 *   Revenue    — Milestone alerts: £10, £50, £100, £500, £1000 thresholds
 *   Failures   — Service down alerts (works alongside monitor-bot)
 *
 * Commands (text from anywhere):
 *   /status    — health grid for all services (✅/❌)
 *   /revenue   — today's affiliate clicks + revenue estimate
 *   /matches   — today's WC matches + kickoff times
 *   /trigger GOAL Brazil France 45  — manually fire event through full pipeline
 *   /budget    — Groq token usage vs 480K daily limit
 *   /post [msg]— broadcast message to all Telegram channels
 *   /stats     — post counts by platform today
 *   /services  — list all 43 services + status
 *   /health    — 3-line system summary
 *   /help      — full command reference
 *
 * Security: only responds to OWNER_CHAT_ID. All others get a polite rejection.
 *
 * Port: 3038
 */

'use strict';

require('dotenv').config();
const express   = require('express');
const axios     = require('axios');
const cron      = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');

// ─── Config ──────────────────────────────────────────────────────────────────
const BOT_TOKEN      = process.env.PERSONAL_BOT_TOKEN     || '';
const OWNER_CHAT_ID  = process.env.OWNER_CHAT_ID          || '';  // your personal Telegram user ID
const PIPELINE_SECRET = process.env.PIPELINE_SECRET       || '';
const PORT           = process.env.PERSONAL_AGENT_PORT    || process.env.PORT || 3038;

// Internal service URLs
const API_URL        = process.env.API_SERVER_URL         || 'http://localhost:3000';
const MOMENT_URL     = process.env.MOMENT_ENGINE_URL      || 'http://localhost:3001';
const BUDGET_URL     = process.env.GROQ_BUDGET_GUARD_URL  || 'http://localhost:3004';
const ANALYTICS_URL  = process.env.ANALYTICS_URL          || 'http://localhost:3032';
const AFFILIATE_URL  = process.env.AFFILIATE_TRACKER_URL  || 'http://localhost:3031';
const TELEGRAM_URL   = process.env.TELEGRAM_ENGINE_URL    || 'http://localhost:3029';

const authHeaders = () => ({ 'x-pipeline-secret': PIPELINE_SECRET, 'Content-Type': 'application/json' });

// ─── All services (mirrors monitor-bot — used for /status command) ────────────
const ALL_SERVICES = [
  { name: 'dedup-guard',            url: process.env.DEDUP_GUARD_URL            || 'http://localhost:3033' },
  { name: 'groq-budget-guard',      url: process.env.GROQ_BUDGET_GUARD_URL      || 'http://localhost:3004' },
  { name: 'queue-processor',        url: process.env.QUEUE_PROCESSOR_URL        || 'http://localhost:3005' },
  { name: 'stripe-webhook',         url: process.env.STRIPE_WEBHOOK_URL         || 'http://localhost:3006' },
  { name: 'affiliate-tracker',      url: process.env.AFFILIATE_TRACKER_URL      || 'http://localhost:3031' },
  { name: 'world-engine',           url: process.env.WORLD_ENGINE_URL           || 'http://localhost:3003' },
  { name: 'moment-engine',          url: process.env.MOMENT_ENGINE_URL          || 'http://localhost:3001' },
  { name: 'api-server',             url: process.env.API_SERVER_URL             || 'http://localhost:3000' },
  { name: 'data-pipeline',          url: process.env.DATA_PIPELINE_URL          || 'http://localhost:3002' },
  { name: 'telegram-engine',        url: process.env.TELEGRAM_ENGINE_URL        || 'http://localhost:3029' },
  { name: 'email-digest-engine',    url: process.env.EMAIL_DIGEST_URL           || 'http://localhost:3030' },
  { name: 'twitter-engine',         url: process.env.TWITTER_ENGINE_URL         || 'http://localhost:3028' },
  { name: 'facebook-engine',        url: process.env.FACEBOOK_ENGINE_URL        || 'http://localhost:3017' },
  { name: 'discord-bot',            url: process.env.DISCORD_BOT_URL            || 'http://localhost:3018' },
  { name: 'reddit-bot',             url: process.env.REDDIT_BOT_URL             || 'http://localhost:3020' },
  { name: 'whatsapp-engine',        url: process.env.WHATSAPP_ENGINE_URL        || 'http://localhost:3034' },
  { name: 'translation-processor',  url: process.env.TRANSLATION_ENGINE_URL     || 'http://localhost:3026' },
  { name: 'bluesky-engine',         url: process.env.BLUESKY_ENGINE_URL         || 'http://localhost:3006' },
  { name: 'mastodon-engine',        url: process.env.MASTODON_ENGINE_URL        || 'http://localhost:3007' },
  { name: 'commentary-live-engine', url: process.env.COMMENTARY_ENGINE_URL      || 'http://localhost:3021' },
  { name: 'news-monitor',           url: process.env.NEWS_MONITOR_URL           || 'http://localhost:3019' },
  { name: 'youtube-uploader',       url: process.env.YOUTUBE_UPLOADER_URL       || 'http://localhost:3025' },
  { name: 'linkedin-post-engine',   url: process.env.LINKEDIN_ENGINE_URL        || 'http://localhost:3015' },
  { name: 'snapchat-engine',        url: process.env.SNAPCHAT_ENGINE_URL        || 'http://localhost:3010' },
  { name: 'twitch-bot',             url: process.env.TWITCH_BOT_URL             || 'http://localhost:3013' },
  { name: 'web-stories-generator',  url: process.env.WEB_STORIES_URL            || 'http://localhost:3014' },
  { name: 'podcast-engine',         url: process.env.PODCAST_ENGINE_URL         || 'http://localhost:3008' },
  { name: 'news-syndication-engine',url: process.env.NEWS_SYNDICATION_URL       || 'http://localhost:3009' },
  { name: 'naver-engine',           url: process.env.NAVER_ENGINE_URL           || 'http://localhost:3011' },
  { name: 'sharechat-engine',       url: process.env.SHARECHAT_ENGINE_URL       || 'http://localhost:3012' },
  { name: 'image-engine',           url: process.env.IMAGE_ENGINE_URL           || 'http://localhost:3016' },
  { name: 'visual-post-engine',     url: process.env.VISUAL_POST_ENGINE_URL     || 'http://localhost:3027' },
  { name: 'monitor-bot',            url: process.env.MONITOR_BOT_URL            || 'http://localhost:3022' },
  { name: 'ai-engine',              url: process.env.AI_ENGINE_URL              || 'http://localhost:3005' },
  { name: 'analytics-aggregator',   url: process.env.ANALYTICS_URL              || 'http://localhost:3032' },
  { name: 'sitemap-generator',      url: process.env.SITEMAP_GENERATOR_URL      || 'http://localhost:3037' },
  { name: 'line-engine',            url: process.env.LINE_ENGINE_URL            || 'http://localhost:3039' },
  { name: 'viber-engine',           url: process.env.VIBER_ENGINE_URL           || 'http://localhost:3040' },
  { name: 'odds-engine',            url: process.env.ODDS_ENGINE_URL            || 'http://localhost:3041' },
  { name: 'medium-engine',          url: process.env.MEDIUM_ENGINE_URL          || 'http://localhost:3042' },
  { name: 'koo-engine',             url: process.env.KOO_ENGINE_URL             || 'http://localhost:3043' },
  { name: 'merchandise-engine',     url: process.env.MERCH_ENGINE_URL           || 'http://localhost:3044' },
];

// ─── Revenue milestone tracking ───────────────────────────────────────────────
const MILESTONES    = [10, 50, 100, 250, 500, 1000, 2500, 5000];
let milestonesHit   = new Set();
let lastRevenueEst  = 0;

// ─── Bot setup ────────────────────────────────────────────────────────────────
let bot;
if (BOT_TOKEN) {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  console.log('[PersonalAgent] Telegram bot started (polling)');
} else {
  console.warn('[PersonalAgent] PERSONAL_BOT_TOKEN not set — Telegram bot disabled');
}

// ─── Security: only respond to owner ─────────────────────────────────────────
function isOwner(chatId) {
  if (!OWNER_CHAT_ID) return true; // if not configured, allow (dev mode)
  return String(chatId) === String(OWNER_CHAT_ID);
}

// ─── Send to owner ────────────────────────────────────────────────────────────
async function sendToOwner(text, opts = {}) {
  if (!bot || !OWNER_CHAT_ID) {
    console.log('[PersonalAgent → Owner]', text.slice(0, 100));
    return;
  }
  try {
    await bot.sendMessage(OWNER_CHAT_ID, text, { parse_mode: 'HTML', ...opts });
  } catch (e) {
    console.error('[PersonalAgent] sendToOwner failed:', e.message);
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function get(url, timeout = 5000) {
  const res = await axios.get(url, { timeout });
  return res.data;
}

async function post(url, body, timeout = 8000) {
  const res = await axios.post(url, body, { headers: authHeaders(), timeout });
  return res.data;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function cmdHelp() {
  return `<b>🤖 WC 2026 Empire — Command Centre</b>

<b>System</b>
/status   — health grid (all services)
/health   — quick 3-line summary
/services — full service list

<b>Revenue</b>
/revenue  — today's clicks + revenue estimate
/stats    — post counts by platform

<b>AI Budget</b>
/budget   — Groq token usage vs 480K limit

<b>Matches</b>
/matches  — today's WC fixtures

<b>Actions</b>
/trigger GOAL Brazil France 45
/trigger MATCH_END Argentina England
/trigger UPSET Morocco Spain
/post Your message here

<b>Shortcuts</b>
/r  = /revenue
/s  = /status
/m  = /matches`;
}

async function cmdStatus() {
  const results = await Promise.allSettled(
    ALL_SERVICES.map(async svc => {
      try {
        await axios.get(`${svc.url}/health`, { timeout: 4000 });
        return { name: svc.name, ok: true };
      } catch {
        return { name: svc.name, ok: false };
      }
    })
  );

  const statuses = results.map(r => r.value || { name: '?', ok: false });
  const up   = statuses.filter(s => s.ok).length;
  const down = statuses.filter(s => !s.ok);

  let msg = `<b>🖥 System Status — ${up}/${ALL_SERVICES.length} up</b>\n\n`;
  if (down.length === 0) {
    msg += '✅ All services healthy';
  } else {
    msg += `⚠️ <b>Down (${down.length}):</b> ${down.map(s => s.name).join(', ')}\n\n`;
    // Show all as grid
    const grid = statuses.map(s => `${s.ok ? '✅' : '❌'} ${s.name}`).join('\n');
    msg += `<pre>${grid}</pre>`;
  }
  return msg;
}

async function cmdHealth() {
  const results = await Promise.allSettled(
    ALL_SERVICES.map(svc => axios.get(`${svc.url}/health`, { timeout: 3000 }).then(() => true).catch(() => false))
  );
  const up = results.filter(r => r.value === true).length;
  const budget = await get(`${BUDGET_URL}/status`, 3000).catch(() => null);
  const tokenPct = budget ? Math.round((budget.used || 0) / 4800) : '?';

  return `<b>⚡ Quick Health</b>
Services: ${up}/${ALL_SERVICES.length} up
Groq budget: ${tokenPct}% used today
Status: ${up >= ALL_SERVICES.length * 0.9 ? '🟢 Healthy' : up >= ALL_SERVICES.length * 0.7 ? '🟡 Degraded' : '🔴 Issues'}`;
}

async function cmdRevenue() {
  try {
    const aff = await get(`${AFFILIATE_URL}/status`, 5000);
    const clicks  = aff.totalClicks  || 0;
    const revenue = aff.revenueEst   || 0;
    const topLink = aff.topLink || 'N/A';

    lastRevenueEst = revenue;
    checkMilestones(revenue);

    return `<b>💰 Revenue — Today</b>

Affiliate clicks: <b>${clicks}</b>
Est. revenue: <b>£${revenue.toFixed(2)}</b>
Top converting link: ${topLink}

<i>Betting affiliates (£30-250 CPA) activate at 18+</i>`;
  } catch {
    return '⚠️ Revenue data unavailable — check affiliate-tracker service';
  }
}

async function cmdBudget() {
  try {
    const data = await get(`${BUDGET_URL}/status`, 5000);
    const used  = data.used   || 0;
    const limit = data.limit  || 480000;
    const pct   = Math.round(used / limit * 100);
    const bar   = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));

    return `<b>🧠 Groq Token Budget</b>

<pre>${bar} ${pct}%</pre>
Used today: ${used.toLocaleString()} / ${limit.toLocaleString()}
Remaining:  ${(limit - used).toLocaleString()} tokens
Reset: midnight UTC

${pct > 90 ? '🔴 CRITICAL — content may fall back to templates' : pct > 70 ? '🟡 Getting tight' : '🟢 Plenty of budget'}`;
  } catch {
    return '⚠️ Budget data unavailable — check groq-budget-guard';
  }
}

async function cmdMatches() {
  try {
    const data = await get(`${API_URL}/api/v1/matches/today`, 8000);
    const matches = data.matches || data.response || [];
    if (!matches.length) return '📅 No WC matches scheduled today.';

    let msg = `<b>⚽ Today's WC 2026 Matches</b>\n\n`;
    matches.forEach(m => {
      const home = m.teams?.home?.name || m.homeTeam || '?';
      const away = m.teams?.away?.name || m.awayTeam || '?';
      const ko   = m.fixture?.date ? new Date(m.fixture.date).toUTCString().slice(17, 22) : 'TBD';
      const venue = m.fixture?.venue?.name || '';
      msg += `🕐 <b>${ko} UTC</b>\n${home} vs ${away}\n${venue ? `📍 ${venue}\n` : ''}\n`;
    });
    msg += `\nPipeline armed and waiting 🚀`;
    return msg;
  } catch {
    return '⚠️ Match data unavailable — check api-server + data-pipeline';
  }
}

async function cmdStats() {
  try {
    const data = await get(`${ANALYTICS_URL}/summary`, 5000);
    const posts = data.postsToday || {};
    let msg = `<b>📊 Posts Today by Platform</b>\n\n`;
    const entries = Object.entries(posts).sort((a,b) => b[1] - a[1]);
    if (!entries.length) return '📊 No stats available yet — check analytics-aggregator';
    entries.forEach(([platform, count]) => {
      msg += `${platform}: <b>${count}</b>\n`;
    });
    msg += `\nTotal: <b>${entries.reduce((s,[,c])=>s+c,0)}</b> posts`;
    return msg;
  } catch {
    return '⚠️ Stats unavailable — check analytics-aggregator';
  }
}

async function cmdTrigger(args) {
  // /trigger GOAL Brazil France 45
  // /trigger MATCH_END Argentina England
  const [eventType, homeTeam, , awayTeam, minute] = args;
  if (!eventType) return '❌ Usage: /trigger GOAL Brazil France 45';

  const EVENT_TYPES = ['GOAL','PENALTY_GOAL','OWN_GOAL','RED_CARD','SECOND_YELLOW','HAT_TRICK',
    'MATCH_END','UPSET','ELIMINATION','VAR','INJURY','RECORD','PRE_MATCH','BREAKING_NEWS'];

  if (!EVENT_TYPES.includes(eventType.toUpperCase())) {
    return `❌ Unknown event. Valid: ${EVENT_TYPES.join(', ')}`;
  }

  try {
    await post(`${MOMENT_URL}/trigger`, {
      eventType: eventType.toUpperCase(),
      homeTeam:  homeTeam || 'Team A',
      awayTeam:  awayTeam || 'Team B',
      minute:    minute ? parseInt(minute) : null,
      source:    'personal-agent',
    });
    return `✅ <b>${eventType.toUpperCase()}</b> fired!\n${homeTeam || 'Team A'} vs ${awayTeam || 'Team B'}${minute ? ` (${minute}')` : ''}\n\nFull pipeline triggered — check platforms in ~60s`;
  } catch (e) {
    return `❌ Trigger failed: ${e.message}`;
  }
}

async function cmdPost(text) {
  if (!text) return '❌ Usage: /post Your message here';
  try {
    await post(`${TELEGRAM_URL}/broadcast`, { message: text, channels: 'all' });
    return `✅ Broadcast sent to all Telegram channels:\n"${text.slice(0,100)}${text.length>100?'…':''}"`;
  } catch (e) {
    return `❌ Broadcast failed: ${e.message}`;
  }
}

async function cmdServices() {
  let msg = `<b>🏗 All ${ALL_SERVICES.length} Services</b>\n\n`;
  const groups = {
    '🔒 Guards':       ALL_SERVICES.slice(0,2),
    '⚙️ Infrastructure':ALL_SERVICES.slice(2,5),
    '🧠 Core':         ALL_SERVICES.slice(5,9),
    '📣 Social':       ALL_SERVICES.slice(9,17),
    '🌐 Distribution': ALL_SERVICES.slice(17,36),
    '🆕 New engines':  ALL_SERVICES.slice(36),
  };
  for (const [label, svcs] of Object.entries(groups)) {
    msg += `<b>${label}</b>\n${svcs.map(s=>s.name).join(', ')}\n\n`;
  }
  return msg;
}

// ─── Command router ───────────────────────────────────────────────────────────
async function handleCommand(cmd, args, chatId) {
  const c = cmd.toLowerCase().replace(/^\//, '').split('@')[0];
  switch(c) {
    case 'help':            return cmdHelp();
    case 'status': case 's':return cmdStatus();
    case 'health':          return cmdHealth();
    case 'revenue': case 'r':return cmdRevenue();
    case 'budget':          return cmdBudget();
    case 'matches': case 'm':return cmdMatches();
    case 'stats':           return cmdStats();
    case 'trigger':         return cmdTrigger(args);
    case 'post':            return cmdPost(args.join(' '));
    case 'services':        return cmdServices();
    case 'start':           return `👋 <b>WC 2026 Empire online.</b>\n\nType /help for all commands.\nYour chat ID: <code>${chatId}</code>`;
    default:                return `❓ Unknown command. Type /help`;
  }
}

// ─── Telegram message handler ─────────────────────────────────────────────────
if (bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text   = msg.text || '';

    if (!isOwner(chatId)) {
      await bot.sendMessage(chatId, '🔒 This is a private command interface.');
      return;
    }

    if (!text.startsWith('/')) {
      // ── FREE-FORM AI CONVERSATION ──────────────────────────────────────────
      // Any non-command message goes to empire-agent for an intelligent response
      // This makes the personal agent feel like texting Claude who knows your empire
      try {
        await bot.sendChatAction(chatId, 'typing');
        const EMPIRE_AGENT_URL = process.env.EMPIRE_AGENT_URL || 'http://localhost:3051';
        let reply;
        try {
          const res = await require('axios').post(`${EMPIRE_AGENT_URL}/ask`, {
            message: text,
            sessionId: `telegram-owner-${chatId}`,
            includeContext: true,
          }, {
            headers: { 'x-pipeline-secret': PIPELINE_SECRET },
            timeout: 20000,
          });
          reply = res.data?.reply || 'No response from empire agent.';
        } catch(apiErr) {
          // Fallback: use groqClient directly if empire-agent is down
          reply = await require('./groq-client').complete({
            engine: 'personal-agent',
            eventType: 'CHAT',
            messages: [
              { role: 'system', content: 'You are a personal AI assistant running a WC 2026 sports media empire with 50 Railway services, 30+ social platforms, 196 income streams. Be concise and tactical.' },
              { role: 'user', content: text },
            ],
            max_tokens: 400, temperature: 0.7,
          }) || 'Empire agent offline — try a /command instead.';
        }
        // Telegram message length limit is 4096 chars
        if (reply.length > 4000) reply = reply.slice(0, 3990) + '…';
        await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' }).catch(() =>
          bot.sendMessage(chatId, reply) // retry without markdown if it fails
        );
      } catch(e) {
        await sendToOwner(`❌ AI response error: ${e.message}`);
      }
      return;
    }

    const parts = text.trim().split(/\s+/);
    const cmd   = parts[0];
    const args  = parts.slice(1);

    try {
      const reply = await handleCommand(cmd, args, chatId);
      await sendToOwner(reply);
    } catch (e) {
      await sendToOwner(`❌ Command error: ${e.message}`);
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[PersonalAgent] polling error:', err.message);
  });
}

// ─── Proactive: Morning briefing (7am UTC) ────────────────────────────────────
cron.schedule('0 7 * * *', async () => {
  console.log('[PersonalAgent] Sending morning briefing...');
  try {
    const [healthMsg, matchMsg, revenueMsg, budgetMsg] = await Promise.allSettled([
      cmdHealth(), cmdMatches(), cmdRevenue(), cmdBudget()
    ]);

    const briefing = `☀️ <b>Morning Briefing — ${new Date().toDateString()}</b>

${healthMsg.value || '⚠️ Health unavailable'}

${matchMsg.value || '📅 No matches today'}

${revenueMsg.value || '💰 Revenue unavailable'}

${budgetMsg.value || '🧠 Budget unavailable'}

<i>Have a great day. The empire is running. 🚀</i>`;

    await sendToOwner(briefing);
  } catch (e) {
    console.error('[PersonalAgent] Morning briefing failed:', e.message);
  }
}, { timezone: 'UTC' });

// ─── Proactive: Match day kickoff alerts (check every 5 min) ─────────────────
cron.schedule('*/5 * * * *', async () => {
  try {
    const data = await get(`${API_URL}/api/v1/matches/today`, 5000);
    const matches = data.matches || data.response || [];
    const now = Date.now();

    matches.forEach(async (m) => {
      const ko = m.fixture?.date ? new Date(m.fixture.date).getTime() : null;
      if (!ko) return;
      const minsToKo = (ko - now) / 60000;
      if (minsToKo > 58 && minsToKo < 62) {
        const home = m.teams?.home?.name || m.homeTeam || '?';
        const away = m.teams?.away?.name || m.awayTeam || '?';
        await sendToOwner(
          `⚽ <b>KICKOFF IN 60 MINUTES</b>\n${home} vs ${away}\n\n🚀 Pipeline armed and ready.\nUse /trigger to fire manual events if needed.`
        );
      }
    });
  } catch { /* silent — runs every 5 min */ }
});

// ─── Proactive: Revenue milestone checker (every 30 min) ──────────────────────
function checkMilestones(revenue) {
  MILESTONES.forEach(async (m) => {
    if (revenue >= m && !milestonesHit.has(m)) {
      milestonesHit.add(m);
      await sendToOwner(
        `🎉 <b>REVENUE MILESTONE: £${m} REACHED!</b>\n\nEstimated today: £${revenue.toFixed(2)}\n\nThe empire is working. 💪`
      );
    }
  });
}

cron.schedule('*/30 * * * *', async () => {
  try {
    const aff = await get(`${AFFILIATE_URL}/status`, 5000);
    const revenue = aff.revenueEst || 0;
    lastRevenueEst = revenue;
    checkMilestones(revenue);
    // Reset milestones at midnight
  } catch { /* silent */ }
});

// Reset milestones at midnight
cron.schedule('0 0 * * *', () => { milestonesHit = new Set(); lastRevenueEst = 0; });

// ─── Express HTTP server (Railway health + webhook for external calls) ─────────
const app = express();
app.use(express.json());

const PIPELINE_SEC = process.env.PIPELINE_SECRET || '';
function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SEC && token !== PIPELINE_SEC) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

// Allow other services to push alerts to the owner
app.post('/alert', async (req, res) => {
  const { message, level = 'info' } = req.body || {};
  if (!message) return res.status(400).json({ ok: false, error: 'message required' });
  const prefix = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : 'ℹ️';
  await sendToOwner(`${prefix} ${message}`);
  res.json({ ok: true });
});

// Revenue update push (affiliate-tracker can call this on new clicks)
app.post('/revenue-update', async (req, res) => {
  const { clicks, revenueEst } = req.body || {};
  if (revenueEst) { lastRevenueEst = revenueEst; checkMilestones(revenueEst); }
  res.json({ ok: true });
});

// Manual briefing trigger (from admin dashboard)
app.post('/trigger', async (req, res) => {
  const { type = 'briefing' } = req.body || {};
  if (type === 'briefing') {
    const health = await cmdHealth().catch(() => 'unavailable');
    const revenue = await cmdRevenue().catch(() => 'unavailable');
    await sendToOwner(`📊 <b>Manual Briefing</b>\n\n${health}\n\n${revenue}`);
  }
  res.json({ ok: true, service: 'personal-agent', action: type });
});

app.get('/status', (req, res) => {
  res.json({
    ok: true,
    service: 'personal-agent',
    botActive: !!bot,
    ownerConfigured: !!OWNER_CHAT_ID,
    milestonesHit: [...milestonesHit],
    lastRevenueEst,
    services: ALL_SERVICES.length,
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`[PersonalAgent] HTTP server on :${PORT}`);
  if (!BOT_TOKEN)    console.warn('[PersonalAgent] ⚠️  PERSONAL_BOT_TOKEN not set');
  if (!OWNER_CHAT_ID) console.warn('[PersonalAgent] ⚠️  OWNER_CHAT_ID not set — get this by messaging @userinfobot on Telegram');

  // Send startup notification
  await sendToOwner(
    `🚀 <b>WC 2026 Empire — Personal Agent Online</b>\n\nAll ${ALL_SERVICES.length} services registered.\nMorning briefings: 07:00 UTC daily\nMatch alerts: 60 min before kickoff\n\nType /help to see all commands.`
  );
});
