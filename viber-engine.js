/**
 * viber-engine.js
 * Viber REST API — Philippines / Eastern Europe / Middle East
 *
 * Viber: 260M+ registered users
 *   Philippines: dominant messaging app (40M+ users)
 *   Ukraine, Bulgaria, Croatia, Serbia: #1 or #2 app
 *   Israel, Palestine, Arab world: heavy usage
 *
 * Broadcasts to Viber Public Account / Bot subscribers.
 * Viber allows rich messages: text + image + buttons.
 *
 * Required env:
 *   VIBER_AUTH_TOKEN  — from Viber Admin Panel (create Public Account)
 *   VIBER_BOT_NAME    — your bot's display name
 *   VIBER_WEBHOOK_URL — public URL for webhook registration (your Railway URL)
 *
 * Port: 3040
 */

'use strict';

require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const groqClient = require('./groq-client');

const AUTH_TOKEN     = process.env.VIBER_AUTH_TOKEN    || '';
const BOT_NAME       = process.env.VIBER_BOT_NAME      || 'WC 2026 Picks';
const WEBHOOK_URL    = process.env.VIBER_WEBHOOK_URL   || '';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET    || '';
const PORT           = process.env.VIBER_ENGINE_PORT || process.env.PORT || 3040;

const VIBER_API = 'https://chatapi.viber.com/pa';

const postLog = [];

const app = express();
app.use(express.json());

function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

// ─── Viber API helpers ────────────────────────────────────────────────────────
function viberHeaders() {
  return { 'X-Viber-Auth-Token': AUTH_TOKEN, 'Content-Type': 'application/json' };
}

async function viberPost(endpoint, body) {
  if (!AUTH_TOKEN) throw new Error('VIBER_AUTH_TOKEN not configured');
  const res = await axios.post(`${VIBER_API}/${endpoint}`, body, { headers: viberHeaders(), timeout: 10000 });
  if (res.data.status !== 0) throw new Error(`Viber error ${res.data.status}: ${res.data.status_message}`);
  return res.data;
}

// Broadcast to all subscribers (Viber Public Account)
async function broadcastMessage(text, keyboard = null) {
  const body = {
    broadcast_list: [], // empty = all subscribers for Public Account
    sender: { name: BOT_NAME },
    type: 'text',
    text,
    ...(keyboard ? { keyboard } : {}),
  };
  // For Public Account broadcast, use send_message with no specific receiver
  // Viber broadcasts to all PA subscribers automatically when receiver is omitted
  return viberPost('broadcast_message', body);
}

// Rich message with button
async function broadcastRich(text, buttonText, buttonUrl) {
  return broadcastMessage(text, {
    Type: 'keyboard',
    Buttons: [{
      ActionType: 'open-url',
      ActionBody: buttonUrl,
      Text: buttonText,
      BgColor: '#0088cc',
      TextSize: 'medium',
    }],
  });
}

// ─── Content generation ───────────────────────────────────────────────────────
const VIBER_TEMPLATES = {
  GOAL:        (d) => `⚽ GOAL! ${d.homeTeam} ${d.homeScore||''}-${d.awayScore||''} ${d.awayTeam}${d.player?'\nScorer: '+d.player:''}${d.minute?'\nMinute: '+d.minute+"'":''}`,
  RED_CARD:    (d) => `🟥 RED CARD!\n${d.player||'Player'} off!\n${d.homeTeam} vs ${d.awayTeam}`,
  HAT_TRICK:   (d) => `🎩 HAT-TRICK!\n${d.player||'Player'} is sensational!\n${d.homeTeam} vs ${d.awayTeam}`,
  MATCH_END:   (d) => `🏁 FULL TIME\n${d.homeTeam} ${d.homeScore??'?'}-${d.awayScore??'?'} ${d.awayTeam}`,
  UPSET:       (d) => `😱 SHOCK RESULT!\n${d.homeTeam} ${d.homeScore??'?'}-${d.awayScore??'?'} ${d.awayTeam}\nMassive upset in WC 2026!`,
  ELIMINATION: (d) => `💔 OUT!\n${d.team||d.awayTeam} eliminated from WC 2026`,
  PRE_MATCH:   (d) => `⚽ UPCOMING: ${d.homeTeam} vs ${d.awayTeam}${d.kickoff?'\nKickoff: '+d.kickoff:''}`,
};

async function generateContent(eventType, payload) {
  const tmpl = VIBER_TEMPLATES[eventType];
  if (tmpl) return tmpl(payload);
  try {
    return await groqClient.complete({
      engine: 'viber-engine', eventType,
      messages: [{ role: 'user', content: `Short Viber message (max 200 chars) for WC 2026 event: ${eventType}. ${JSON.stringify(payload)}` }],
      max_tokens: 80, temperature: 0.7,
    }) || `⚽ ${eventType} — WC 2026`;
  } catch { return `⚽ ${eventType} — WC 2026`; }
}

// ─── Webhook registration ─────────────────────────────────────────────────────
async function registerWebhook() {
  if (!AUTH_TOKEN || !WEBHOOK_URL) return;
  try {
    await viberPost('set_webhook', {
      url: `${WEBHOOK_URL}/viber-webhook`,
      event_types: ['delivered', 'seen', 'failed', 'subscribed', 'unsubscribed', 'conversation_started'],
    });
    console.log('[Viber] Webhook registered at', WEBHOOK_URL);
  } catch(e) {
    console.warn('[Viber] Webhook registration failed:', e.message);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────
// Viber webhook (receives events from Viber)
app.post('/viber-webhook', async (req, res) => {
  res.json({ status: 0 }); // always acknowledge
  const event = req.body;
  if (event.event === 'subscribed') {
    console.log(`[Viber] New subscriber: ${event.user?.name}`);
  }
});

app.post('/trigger', async (req, res) => {
  const { eventType, ...payload } = req.body || {};
  const HANDLED = ['GOAL','PENALTY_GOAL','RED_CARD','HAT_TRICK','MATCH_END','UPSET','ELIMINATION','PRE_MATCH'];
  if (!HANDLED.includes(eventType)) {
    return res.json({ ok: true, service: 'viber-engine', action: 'skipped', reason: `${eventType} not in Viber list` });
  }
  try {
    const text = await generateContent(eventType, payload);
    await broadcastRich(text, 'Get Full Predictions →', 'https://wc2026picks.com/prediction-game.html');
    postLog.unshift({ eventType, text: text.slice(0,60), timestamp: new Date().toISOString() });
    if (postLog.length > 100) postLog.length = 100;
    console.log(`[Viber] ${eventType} broadcast sent`);
    res.json({ ok: true, service: 'viber-engine', eventType });
  } catch(e) {
    console.error('[Viber] broadcast failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/send', async (req, res) => {
  const { message, buttonText, buttonUrl } = req.body || {};
  if (!message) return res.status(400).json({ ok: false, error: 'message required' });
  try {
    await broadcastRich(message, buttonText || 'Visit Site', buttonUrl || 'https://wc2026picks.com');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/log', (req, res) => res.json({ ok: true, count: postLog.length, log: postLog.slice(0,20) }));

app.get('/status', (req, res) => res.json({
  ok: true,
  service: 'viber-engine',
  configured: !!AUTH_TOKEN,
  postsToday: postLog.filter(p => p.timestamp?.startsWith(new Date().toISOString().split('T')[0])).length,
  markets: ['Philippines 🇵🇭', 'Ukraine 🇺🇦', 'Bulgaria 🇧🇬', 'Croatia 🇭🇷', 'Serbia 🇷🇸', 'Israel 🇮🇱', 'Arab world'],
  reach: '260M+ registered users',
}));

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, async () => {
  console.log(`[Viber Engine] listening on :${PORT}`);
  if (!AUTH_TOKEN) console.warn('[Viber] VIBER_AUTH_TOKEN not set — broadcasting disabled');
  await registerWebhook();
});
