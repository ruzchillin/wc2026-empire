/**
 * line-engine.js
 * LINE Messaging API — Japan / Thailand / Taiwan / Indonesia
 *
 * LINE has 82M daily active users in Japan alone.
 * Broadcasts match events to LINE Official Account followers via Push API.
 * Also supports LINE Notify (simpler, no Official Account required).
 *
 * Required env:
 *   LINE_CHANNEL_ACCESS_TOKEN  — from LINE Developers Console (Messaging API)
 *   LINE_NOTIFY_TOKEN          — from notify.line.me (simpler broadcast)
 *   LINE_CHANNEL_SECRET        — for webhook signature verification
 *
 * Port: 3039
 */

'use strict';

require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const groqClient = require('./groq-client');

const CHANNEL_TOKEN  = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const NOTIFY_TOKEN   = process.env.LINE_NOTIFY_TOKEN         || '';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET          || '';
const PORT           = process.env.LINE_ENGINE_PORT || process.env.PORT || 3039;

const LINE_API    = 'https://api.line.me/v2/bot';
const NOTIFY_API  = 'https://notify-api.line.me/api/notify';

const postLog = [];

// ─── Auth ─────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

// ─── Content generation ───────────────────────────────────────────────────────
const EVENT_TEMPLATES = {
  GOAL:        (d) => `⚽ GOAL!\n${d.homeTeam} ${d.homeScore || ''} - ${d.awayScore || ''} ${d.awayTeam}\n${d.player ? `Scored by: ${d.player}` : ''}\n${d.minute ? `${d.minute}' min` : ''}\n\n#WC2026 #WorldCup`,
  RED_CARD:    (d) => `🟥 RED CARD!\n${d.player || 'Player'} is sent off!\n${d.homeTeam} vs ${d.awayTeam}\n\n#WC2026`,
  HAT_TRICK:   (d) => `🎩 HAT-TRICK!\n${d.player || 'Player'} scores THREE!\n${d.homeTeam} vs ${d.awayTeam}\n\n#WC2026 #WorldCup`,
  MATCH_END:   (d) => `🏁 FULL TIME\n${d.homeTeam} ${d.homeScore ?? '?'} - ${d.awayScore ?? '?'} ${d.awayTeam}\n\n#WC2026 #WorldCup`,
  UPSET:       (d) => `😱 SHOCK RESULT!\n${d.homeTeam} ${d.homeScore ?? '?'} - ${d.awayScore ?? '?'} ${d.awayTeam}\n\n#WC2026 #Shock`,
  ELIMINATION: (d) => `💔 ELIMINATED\n${d.team || d.awayTeam} are OUT of WC 2026\n\n#WC2026 #WorldCup`,
  PRE_MATCH:   (d) => `⚽ UPCOMING MATCH\n${d.homeTeam} vs ${d.awayTeam}\n${d.kickoff ? `Kickoff: ${d.kickoff}` : ''}\n\n#WC2026`,
};

async function generateLineContent(eventType, payload) {
  const tmpl = EVENT_TEMPLATES[eventType];
  if (tmpl) return tmpl(payload);

  // Fallback to AI
  try {
    return await groqClient.complete({
      engine: 'line-engine',
      eventType,
      messages: [{ role: 'user', content: `Write a short LINE message (max 150 chars) for this WC 2026 event: ${eventType}. ${JSON.stringify(payload)}. Japanese/international audience. No hashtags, just clean text.` }],
      max_tokens: 100,
      temperature: 0.7,
    }) || `⚽ ${eventType} — WC 2026 Update`;
  } catch {
    return `⚽ ${eventType} — WC 2026 Update`;
  }
}

// ─── LINE Notify broadcast (simplest — one token = one group/user) ────────────
async function notifyBroadcast(message) {
  if (!NOTIFY_TOKEN) throw new Error('LINE_NOTIFY_TOKEN not configured');
  await axios.post(NOTIFY_API,
    `message=${encodeURIComponent('\n' + message)}`,
    { headers: { Authorization: `Bearer ${NOTIFY_TOKEN}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
  );
}

// ─── LINE Messaging API broadcast (Official Account — reaches all followers) ──
async function messagingBroadcast(message) {
  if (!CHANNEL_TOKEN) throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
  await axios.post(`${LINE_API}/message/broadcast`,
    { messages: [{ type: 'text', text: message }] },
    { headers: { Authorization: `Bearer ${CHANNEL_TOKEN}`, 'Content-Type': 'application/json' }, timeout: 10000 }
  );
}

async function broadcast(message) {
  const results = {};
  if (CHANNEL_TOKEN) {
    try { await messagingBroadcast(message); results.messaging = 'sent'; }
    catch(e) { results.messaging = `error: ${e.message}`; }
  }
  if (NOTIFY_TOKEN) {
    try { await notifyBroadcast(message); results.notify = 'sent'; }
    catch(e) { results.notify = `error: ${e.message}`; }
  }
  if (!CHANNEL_TOKEN && !NOTIFY_TOKEN) results.warning = 'no LINE credentials configured';
  return results;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.post('/trigger', async (req, res) => {
  const { eventType, ...payload } = req.body || {};
  const HANDLED = ['GOAL','PENALTY_GOAL','RED_CARD','HAT_TRICK','MATCH_END','UPSET','ELIMINATION','PRE_MATCH'];
  if (!HANDLED.includes(eventType)) {
    return res.json({ ok: true, service: 'line-engine', action: 'skipped', reason: `${eventType} not in LINE event list` });
  }

  try {
    const message = await generateLineContent(eventType, payload);
    const results = await broadcast(message);
    postLog.unshift({ eventType, message: message.slice(0,80), results, timestamp: new Date().toISOString() });
    if (postLog.length > 100) postLog.length = 100;
    console.log(`[LINE] ${eventType} broadcast:`, results);
    res.json({ ok: true, service: 'line-engine', eventType, results });
  } catch(e) {
    console.error('[LINE] broadcast failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/send', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ ok: false, error: 'message required' });
  try {
    const results = await broadcast(message);
    res.json({ ok: true, results });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/log', (req, res) => res.json({ ok: true, log: postLog }));

app.get('/status', (req, res) => res.json({
  ok: true,
  service: 'line-engine',
  configured: { messaging: !!CHANNEL_TOKEN, notify: !!NOTIFY_TOKEN },
  postsToday: postLog.filter(p => p.timestamp?.startsWith(new Date().toISOString().split('T')[0])).length,
  markets: ['Japan 🇯🇵', 'Thailand 🇹🇭', 'Taiwan 🇹🇼', 'Indonesia 🇮🇩'],
  totalReach: '82M+ daily active users (Japan alone)',
}));

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[LINE Engine] listening on :${PORT}`);
  if (!CHANNEL_TOKEN && !NOTIFY_TOKEN) console.warn('[LINE] No credentials — set LINE_CHANNEL_ACCESS_TOKEN or LINE_NOTIFY_TOKEN');
});
