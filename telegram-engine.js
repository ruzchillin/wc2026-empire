/**
 * WC 2026 Sports Empire — Centralized Telegram Engine
 * Deploy on Railway.app as service "telegram-engine"
 * Port: 3029
 *
 * Single service that manages ALL Telegram channel posting.
 * Replaces scattered telegram calls in commentary-live-engine, news-monitor,
 * monitor-bot, etc. — they should all point here via /trigger.
 *
 * Channels managed:
 *   🇬🇧 Main English channel     — TELEGRAM_CHANNEL_ID
 *   🇪🇸 Spanish channel          — TELEGRAM_ES_CHANNEL_ID
 *   🇧🇷 Portuguese channel       — TELEGRAM_PT_CHANNEL_ID
 *   🇸🇦 Arabic channel           — TELEGRAM_AR_CHANNEL_ID
 *   🇫🇷 French channel           — TELEGRAM_FR_CHANNEL_ID
 *   ⭐  Premium members channel  — TELEGRAM_PREMIUM_CHAT_ID
 *
 * Special features:
 *   - Pin messages on GOAL, HAT_TRICK, UPSET, MATCH_END (auto-unpin after next)
 *   - Inline keyboard buttons (Live Stats, AI Predictions, Enter Game)
 *   - Photo posts for image-engine cards
 *   - Batched sending to avoid Telegram 30msg/sec rate limit
 *   - Per-channel rate limiter (20 messages/minute to avoid flood bans)
 *   - Subscriber count polling (vanity metric + growth tracking)
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN           — @BotFather
 *   TELEGRAM_CHANNEL_ID          — @your_main_channel or numeric ID
 *   TELEGRAM_ES_CHANNEL_ID       — Spanish channel (optional)
 *   TELEGRAM_PT_CHANNEL_ID       — Portuguese channel (optional)
 *   TELEGRAM_AR_CHANNEL_ID       — Arabic channel (optional)
 *   TELEGRAM_FR_CHANNEL_ID       — French channel (optional)
 *   TELEGRAM_PREMIUM_CHAT_ID     — Premium members (optional)
 *   TELEGRAM_OWNER_ID            — your personal chat ID for alerts
 *   VERCEL_URL                   — main site URL
 *   PIPELINE_SECRET              — shared inter-service secret
 *   GROQ_API_KEY                 — for message generation
 *   IMAGE_ENGINE_URL             — for card images
 */

'use strict';

require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const cron    = require('node-cron');
const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN        || '';
const CHANNELS = {
  en:      process.env.TELEGRAM_CHANNEL_ID      || '',
  es:      process.env.TELEGRAM_ES_CHANNEL_ID   || '',
  pt:      process.env.TELEGRAM_PT_CHANNEL_ID   || '',
  ar:      process.env.TELEGRAM_AR_CHANNEL_ID   || '',
  fr:      process.env.TELEGRAM_FR_CHANNEL_ID   || '',
  premium: process.env.TELEGRAM_PREMIUM_CHAT_ID || ''
};
const OWNER_ID       = process.env.TELEGRAM_OWNER_ID         || '';
const VERCEL_URL     = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const PIPELINE_SECRET= process.env.PIPELINE_SECRET            || '';
const GROQ_KEY       = process.env.GROQ_API_KEY               || '';
const IMAGE_ENGINE   = (process.env.IMAGE_ENGINE_URL || 'http://localhost:3016').replace(/\/$/, '');

const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Per-channel: track last pinned message ID for auto-unpin
const pinnedMessages = {};
// Per-channel rate limiting
const channelLastSent = {};
const CHANNEL_RATE_MS = 3000; // 3 sec between messages per channel

const postLog = [];
const stats   = { sent: 0, pinned: 0, failed: 0 };

// ─── Core Telegram API helpers ────────────────────────────────────────────────

async function tgCall(method, body) {
  const r = await axios.post(`${BASE}/${method}`, body, { timeout: 15000 });
  return r.data;
}

async function sendMessage(chatId, text, options = {}) {
  if (!BOT_TOKEN || !chatId) return null;
  // Rate limit per channel
  const last = channelLastSent[chatId] || 0;
  const wait  = CHANNEL_RATE_MS - (Date.now() - last);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  channelLastSent[chatId] = Date.now();

  try {
    const r = await tgCall('sendMessage', {
      chat_id:    chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...options
    });
    stats.sent++;
    return r?.result?.message_id;
  } catch (e) {
    stats.failed++;
    console.error(`[Telegram] sendMessage failed to ${chatId}:`, e.response?.data?.description || e.message);
    return null;
  }
}

async function sendPhoto(chatId, photoUrl, caption, options = {}) {
  if (!BOT_TOKEN || !chatId) return null;
  try {
    const r = await tgCall('sendPhoto', {
      chat_id:    chatId,
      photo:      photoUrl,
      caption,
      parse_mode: 'HTML',
      ...options
    });
    stats.sent++;
    return r?.result?.message_id;
  } catch (e) {
    // Fall back to text
    return sendMessage(chatId, caption, options);
  }
}

async function pinMessage(chatId, messageId) {
  if (!messageId) return;
  // Unpin previous
  if (pinnedMessages[chatId]) {
    await tgCall('unpinChatMessage', { chat_id: chatId, message_id: pinnedMessages[chatId] }).catch(() => {});
  }
  await tgCall('pinChatMessage', { chat_id: chatId, message_id: messageId, disable_notification: true }).catch(() => {});
  pinnedMessages[chatId] = messageId;
  stats.pinned++;
}

// ─── Inline keyboard buttons ──────────────────────────────────────────────────

function matchButtons(matchSlug = '') {
  const url = matchSlug ? `${VERCEL_URL}/match/${matchSlug}` : VERCEL_URL;
  return {
    inline_keyboard: [[
      { text: '📊 Live Stats',       url },
      { text: '🤖 AI Predictions',   url: `${VERCEL_URL}/predictions` }
    ],[
      { text: '🎯 Enter Prediction Game', url: `${VERCEL_URL}/prediction-game.html` }
    ]]
  };
}

function newsButtons(articleUrl) {
  return {
    inline_keyboard: [[
      { text: '📰 Read Full Article', url: articleUrl },
      { text: '⚽ Live Scores',       url: VERCEL_URL }
    ]]
  };
}

// ─── Message formatters ───────────────────────────────────────────────────────

function formatGoal(data) {
  return `⚽ <b>GOAL!</b> — WC 2026

🏟️ <b>${data.homeTeam}</b> ${data.homeScore ?? 0}–${data.awayScore ?? 0} <b>${data.awayTeam}</b>

👟 <b>${data.player || 'Goal scored'}</b>${data.assist ? `\n🎯 Assist: ${data.assist}` : ''}
⏱️ Minute: <b>${data.minute}'</b>${data.team ? `\nTeam: ${data.team}` : ''}

🔴 <a href="${VERCEL_URL}">Live Coverage</a>`;
}

function formatResult(data) {
  const winner = (data.homeScore ?? 0) > (data.awayScore ?? 0) ? data.homeTeam
    : (data.awayScore ?? 0) > (data.homeScore ?? 0) ? data.awayTeam : 'Draw';
  return `🏁 <b>FULL TIME — WC 2026</b>

🏆 ${data.homeTeam} <b>${data.homeScore ?? 0}–${data.awayScore ?? 0}</b> ${data.awayTeam}

${winner !== 'Draw' ? `✅ Winner: <b>${winner}</b>` : '🤝 <b>It finishes a draw!</b>'}${data.keyMoment ? `\n⭐ Key moment: ${data.keyMoment}` : ''}

📊 <a href="${VERCEL_URL}">Full stats & analysis</a>`;
}

function formatRedCard(data) {
  return `🟥 <b>RED CARD!</b> — WC 2026

🏟️ ${data.homeTeam} vs ${data.awayTeam}
👤 <b>${data.player || 'A player'}</b> sent off!
⏱️ ${data.minute}'${data.team ? ` | ${data.team}` : ''}

🔴 <a href="${VERCEL_URL}">Live Coverage</a>`;
}

function formatHatTrick(data) {
  return `🎩🎩🎩 <b>HAT TRICK!!!</b> — WC 2026

🌟 <b>${data.player || 'A player'}</b> scores THREE goals!

🏟️ ${data.homeTeam} <b>${data.homeScore ?? 0}–${data.awayScore ?? 0}</b> ${data.awayTeam}

🔥 One of the performances of WC 2026!

📊 <a href="${VERCEL_URL}">Full Stats</a>`;
}

function formatUpset(data) {
  return `🚨 <b>SHOCK RESULT!</b> — WC 2026

😱 <b>${data.homeTeam} ${data.homeScore ?? 0}–${data.awayScore ?? 0} ${data.awayTeam}</b>

💥 One of the biggest upsets of the tournament!

📊 <a href="${VERCEL_URL}">Live Coverage</a>`;
}

function formatElimination(data) {
  const team = data.eliminatedTeam || data.awayTeam || '';
  return `💔 <b>ELIMINATED</b> — WC 2026

${team} are OUT of the 2026 World Cup.

Their tournament run is over.

🏆 <a href="${VERCEL_URL}">See who's still in it</a>`;
}

function formatPreMatch(data) {
  return `📅 <b>UPCOMING MATCH — WC 2026</b>

⚽ <b>${data.homeTeam}</b> 🆚 <b>${data.awayTeam}</b>
${data.kickoffTime ? `⏰ Kick-off: <b>${data.kickoffTime}</b>` : ''}${data.venue ? `\n🏟️ ${data.venue}` : ''}${data.groupStage ? `\n📋 ${data.groupStage}` : ''}

🤖 <a href="${VERCEL_URL}/predictions">AI Predictions Available</a>`;
}

function formatNews(data) {
  return `📰 <b>WC 2026 Breaking News</b>

${data.headline || data.title || ''}

${data.body || data.rewritten || ''}

🔗 <a href="${data.sourceUrl || VERCEL_URL}">Read more</a>`;
}

function getFormatter(eventType, data) {
  switch (eventType) {
    case 'GOAL':
    case 'PENALTY_GOAL': return formatGoal(data);
    case 'OWN_GOAL':     return formatGoal({ ...data, player: `${data.player || 'Own goal'} (OG)` });
    case 'RED_CARD':     return formatRedCard(data);
    case 'HAT_TRICK':    return formatHatTrick(data);
    case 'MATCH_END':    return formatResult(data);
    case 'UPSET':        return formatUpset(data);
    case 'ELIMINATION':  return formatElimination(data);
    case 'PRE_MATCH':    return formatPreMatch(data);
    case 'BREAKING_NEWS':return formatNews(data);
    default: return `⚽ WC 2026 Update\n\n${data.homeTeam || ''} vs ${data.awayTeam || ''}\n\n<a href="${VERCEL_URL}">Live Coverage</a>`;
  }
}

// ─── Broadcast to appropriate channels ───────────────────────────────────────

const SHOULD_PIN = ['GOAL','PENALTY_GOAL','HAT_TRICK','MATCH_END','UPSET','ELIMINATION'];

async function broadcastEvent(eventType, data, options = {}) {
  const text     = options.customText || getFormatter(eventType, data);
  const buttons  = options.buttons    || matchButtons(data.matchSlug);
  const imageUrl = options.imageUrl   || null;
  const shouldPin = SHOULD_PIN.includes(eventType);

  // Determine which channels to post to (default: all configured channels)
  const targetChannels = options.channels || Object.entries(CHANNELS)
    .filter(([, id]) => !!id)
    .map(([lang, id]) => ({ lang, id }));

  const results = {};

  for (const { lang, id } of targetChannels) {
    try {
      let msgId;
      if (imageUrl) {
        msgId = await sendPhoto(id, imageUrl, text, { reply_markup: buttons });
      } else {
        msgId = await sendMessage(id, text, { reply_markup: buttons });
      }

      if (shouldPin && msgId) await pinMessage(id, msgId);
      results[lang] = { ok: true, msgId };
    } catch (e) {
      results[lang] = { ok: false, error: e.message };
    }
  }

  postLog.unshift({ eventType, text: text.slice(0, 100), results, timestamp: new Date().toISOString() });
  if (postLog.length > 500) postLog.length = 500;

  return results;
}

// ─── Owner DM alerts ──────────────────────────────────────────────────────────

async function ownerAlert(text) {
  if (!OWNER_ID) return;
  await sendMessage(OWNER_ID, text).catch(e => console.error('[TG Owner alert]', e.message));
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

const HANDLED = ['GOAL','PENALTY_GOAL','OWN_GOAL','HAT_TRICK','RED_CARD','MATCH_END','UPSET','ELIMINATION','PRE_MATCH','VAR_REVIEW','RECORD','INJURY','BREAKING_NEWS'];

app.post('/trigger', auth, async (req, res) => {
  const { eventType, channels, customText, imageUrl, ...data } = req.body;
  if (!HANDLED.includes(eventType)) return res.json({ ok: true, skipped: true });

  const results = await broadcastEvent(eventType, data, { channels, customText, imageUrl });
  res.json({ ok: true, eventType, results });
});

app.post('/send', auth, async (req, res) => {
  const { chatId, text, buttons, imageUrl } = req.body;
  if (!chatId || !text) return res.status(400).json({ ok: false, error: 'chatId and text required' });

  try {
    let msgId;
    if (imageUrl) {
      msgId = await sendPhoto(chatId, imageUrl, text, buttons ? { reply_markup: buttons } : {});
    } else {
      msgId = await sendMessage(chatId, text, buttons ? { reply_markup: buttons } : {});
    }
    res.json({ ok: true, msgId });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/alert', auth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ ok: false, error: 'text required' });
  await ownerAlert(text);
  res.json({ ok: true });
});

app.post('/broadcast', auth, async (req, res) => {
  const { text, imageUrl, buttons } = req.body;
  if (!text) return res.status(400).json({ ok: false, error: 'text required' });
  const results = await broadcastEvent('BREAKING_NEWS', {}, { customText: text, imageUrl, buttons });
  res.json({ ok: true, results });
});

app.get('/channels', async (req, res) => {
  // Get subscriber counts for all channels
  const counts = {};
  for (const [lang, chatId] of Object.entries(CHANNELS)) {
    if (!chatId) continue;
    try {
      const r = await tgCall('getChatMembersCount', { chat_id: chatId });
      counts[lang] = { chatId, subscribers: r?.result || 0 };
    } catch (e) {
      counts[lang] = { chatId, error: e.message };
    }
  }
  res.json({ ok: true, channels: counts });
});

app.get('/log', (req, res) => res.json({ ok: true, stats, count: postLog.length, log: postLog.slice(0, 30) }));

app.get('/status', (req, res) => {
  const configured = Object.entries(CHANNELS).filter(([, v]) => !!v).map(([k]) => k);
  res.json({ ok: true, service: 'telegram-engine', configured, stats, botConfigured: !!BOT_TOKEN });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.TELEGRAM_ENGINE_PORT || process.env.PORT || 3029;
  app.listen(PORT, () => console.log(`[Telegram Engine] listening on :${PORT}`));

  if (!BOT_TOKEN) console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set');

  const configured = Object.entries(CHANNELS).filter(([, v]) => !!v).map(([k]) => k);
  console.log(`[Telegram Engine] managing channels: ${configured.join(', ') || 'none configured'}`);

  // Daily schedule summary at 07:00 UTC
  cron.schedule('0 7 * * *', async () => {
    try {
      const API = process.env.API_SERVER_URL || 'http://localhost:3001';
      const r = await axios.get(`${API}/api/v1/matches/today`, { timeout: 15000 });
      const matches = r.data?.matches || r.data?.response || [];
      if (!matches.length) return;

      const lines = matches.map(m => {
        const ht   = m.teams?.home?.name || m.homeTeam;
        const at   = m.teams?.away?.name || m.awayTeam;
        const time = m.fixture?.date ? new Date(m.fixture.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : '';
        return `⚽ <b>${ht}</b> vs <b>${at}</b>${time ? ` — ${time}` : ''}`;
      }).join('\n');

      const text = `📅 <b>Today's WC 2026 Matches</b>\n\n${lines}\n\n🤖 <a href="${VERCEL_URL}/predictions">AI Predictions</a> | 🎯 <a href="${VERCEL_URL}/prediction-game.html">Enter Game</a>`;
      await broadcastEvent('PRE_MATCH', {}, { customText: text, buttons: matchButtons() });
    } catch (e) { console.error('[Telegram daily]', e.message); }
  });

  // Alert owner on boot
  if (OWNER_ID) {
    await ownerAlert(`✅ <b>Telegram Engine started</b>\nChannels: ${configured.join(', ') || 'none'}`).catch(() => {});
  }
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
