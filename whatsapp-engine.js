/**
 * WC 2026 Sports Empire — WhatsApp Business Engine
 * Deploy on Railway.app as service "whatsapp-engine"
 * Port: 3034
 *
 * Sends WC 2026 alerts to opted-in WhatsApp subscribers via the
 * Meta WhatsApp Business Cloud API (completely free to set up, pay per message).
 *
 * Market opportunity:
 *   - WhatsApp has 2.7B users worldwide
 *   - #1 messaging app in Africa, South Asia, LATAM, Middle East
 *   - Open rate ~98% (vs ~20% email)
 *   - WC 2026 markets: Morocco (97% WhatsApp), Nigeria (97%), Brazil (99%), India (83%)
 *   - These markets have ZERO competition for WC 2026 content via WhatsApp
 *
 * Message costs (Meta pricing):
 *   - Marketing template: £0.05/message
 *   - Utility template (confirmations): £0.02/message
 *   - Service (user-initiated): FREE (first 1000/month free)
 *   - Strategy: user sends "WC2026" to start → all subsequent alerts are service tier = FREE
 *
 * Setup (free):
 *   1. business.facebook.com → Meta Business Suite
 *   2. WhatsApp → API Setup → Get Started
 *   3. Create a System User → generate access token
 *   4. Add phone number (can use your own mobile, verified via SMS)
 *   5. Create message templates in the WhatsApp Manager (required for outbound)
 *   6. Set webhook URL → this service /webhook endpoint
 *
 * Required env vars:
 *   WA_PHONE_NUMBER_ID     — from Meta Business Suite (WhatsApp → API Setup)
 *   WA_ACCESS_TOKEN        — System User access token (never expires if permanent)
 *   WA_VERIFY_TOKEN        — any string you choose for webhook verification
 *   WA_TEMPLATE_GOAL       — approved template name for goal alerts
 *   WA_TEMPLATE_RESULT     — approved template name for match results
 *   WA_TEMPLATE_WELCOME    — approved template name for new subscribers
 *   PIPELINE_SECRET
 *   VERCEL_URL
 *
 * Template examples (submit these for approval in WhatsApp Manager):
 *   "wc2026_goal" → "⚽ GOAL! {{1}} scores for {{2}}!\n{{3}} {{4}}-{{5}} {{6}}\n\nLive coverage: {{7}}"
 *   "wc2026_result" → "🏁 FT: {{1}} {{2}}-{{3}} {{4}}\n\nFull stats: {{5}}"
 *   "wc2026_welcome" → "⚽ Welcome to WC 2026 Live alerts!\n\nYou'll receive:\n• Goal alerts\n• Match results\n• Breaking news\n\nReply STOP any time to unsubscribe."
 *
 * Port: 3034
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const express = require('express');
const axios   = require('axios');
const cron    = require('node-cron');

const WA_PHONE_ID    = process.env.WA_PHONE_NUMBER_ID  || '';
const WA_TOKEN       = process.env.WA_ACCESS_TOKEN     || '';
const WA_VERIFY_TOKEN= process.env.WA_VERIFY_TOKEN     || 'wc2026-whatsapp-verify';
const WA_TEMPLATE    = {
  goal:    process.env.WA_TEMPLATE_GOAL    || 'wc2026_goal',
  result:  process.env.WA_TEMPLATE_RESULT  || 'wc2026_result',
  welcome: process.env.WA_TEMPLATE_WELCOME || 'wc2026_welcome',
  preview: process.env.WA_TEMPLATE_PREVIEW || 'wc2026_preview',
  upset:   process.env.WA_TEMPLATE_UPSET   || 'wc2026_upset'
};
const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';
const VERCEL_URL      = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');

const DATA_DIR      = path.join(process.cwd(), 'data');
const SUBS_FILE     = path.join(DATA_DIR, 'whatsapp-subscribers.json');

const WA_API_BASE   = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}`;

const stats = { sent: 0, failed: 0, subscribers: 0, inbound: 0 };
const sendLog = [];

// ─── Subscriber management ────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSubs() {
  ensureDataDir();
  if (!fs.existsSync(SUBS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); }
  catch { return []; }
}

function saveSubs(subs) {
  ensureDataDir();
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
}

function addSubscriber(phone, name = '', source = 'whatsapp') {
  const subs = loadSubs();
  const existing = subs.find(s => s.phone === phone);
  if (existing) {
    existing.active = true;
    saveSubs(subs);
    return false; // already existed
  }
  subs.push({ phone, name, source, active: true, subscribedAt: new Date().toISOString() });
  saveSubs(subs);
  stats.subscribers++;
  return true; // new
}

function removeSubscriber(phone) {
  const subs = loadSubs();
  const sub  = subs.find(s => s.phone === phone);
  if (sub) { sub.active = false; sub.unsubscribedAt = new Date().toISOString(); saveSubs(subs); }
}

// ─── WhatsApp Cloud API ───────────────────────────────────────────────────────

async function sendTemplate(to, templateName, components = []) {
  if (!WA_PHONE_ID || !WA_TOKEN) throw new Error('WhatsApp not configured (WA_PHONE_NUMBER_ID + WA_ACCESS_TOKEN required)');

  // Normalize phone: must be E.164 without + (e.g., 447911123456)
  const phone = to.replace(/[^\d]/g, '');

  const body = {
    messaging_product: 'whatsapp',
    to:      phone,
    type:    'template',
    template: {
      name:     templateName,
      language: { code: 'en' },
      components
    }
  };

  try {
    const r = await axios.post(`${WA_API_BASE}/messages`, body, {
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 20000
    });
    stats.sent++;
    return r.data?.messages?.[0]?.id;
  } catch (e) {
    stats.failed++;
    const err = e.response?.data?.error?.message || e.message;
    console.error(`[WhatsApp] send failed to ${phone}: ${err}`);
    throw new Error(err);
  }
}

async function sendText(to, text) {
  if (!WA_PHONE_ID || !WA_TOKEN) throw new Error('WhatsApp not configured');
  const phone = to.replace(/[^\d]/g, '');
  const r = await axios.post(`${WA_API_BASE}/messages`, {
    messaging_product: 'whatsapp',
    to: phone, type: 'text',
    text: { body: text, preview_url: true }
  }, {
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    timeout: 20000
  });
  stats.sent++;
  return r.data?.messages?.[0]?.id;
}

// ─── Event dispatchers ────────────────────────────────────────────────────────

function makeComponents(params) {
  return [{
    type: 'body',
    parameters: params.map(p => ({ type: 'text', text: String(p) }))
  }];
}

async function broadcastGoal(data) {
  const subs = loadSubs().filter(s => s.active);
  // wc2026_goal template: {{1}}=player {{2}}=team {{3}}=homeTeam {{4}}=homeScore {{5}}=awayScore {{6}}=awayTeam {{7}}=link
  const components = makeComponents([
    data.player    || 'Goal scored',
    data.team      || data.homeTeam || '',
    data.homeTeam  || '', data.homeScore ?? 0,
    data.awayScore ?? 0,  data.awayTeam  || '',
    VERCEL_URL
  ]);
  const results = { sent: 0, failed: 0 };
  for (const sub of subs.slice(0, 1000)) { // cap at 1000/blast
    try {
      await sendTemplate(sub.phone, WA_TEMPLATE.goal, components);
      results.sent++;
      await new Promise(r => setTimeout(r, 100)); // ~10 msg/sec
    } catch { results.failed++; }
  }
  return results;
}

async function broadcastResult(data) {
  const subs = loadSubs().filter(s => s.active);
  // wc2026_result template: {{1}}=homeTeam {{2}}=homeScore {{3}}=awayScore {{4}}=awayTeam {{5}}=link
  const components = makeComponents([
    data.homeTeam || '', data.homeScore ?? 0,
    data.awayScore ?? 0, data.awayTeam || '',
    VERCEL_URL
  ]);
  const results = { sent: 0, failed: 0 };
  for (const sub of subs.slice(0, 1000)) {
    try {
      await sendTemplate(sub.phone, WA_TEMPLATE.result, components);
      results.sent++;
      await new Promise(r => setTimeout(r, 100));
    } catch { results.failed++; }
  }
  return results;
}

async function sendWelcome(phone) {
  return sendTemplate(phone, WA_TEMPLATE.welcome, []);
}

// ─── Inbound webhook (user messages) ─────────────────────────────────────────

async function handleInbound(message, contact) {
  const phone = message.from;
  const text  = message.text?.body?.trim().toUpperCase() || '';
  const name  = contact?.profile?.name || '';
  stats.inbound++;

  console.log(`[WhatsApp] inbound from ${phone}: "${text}"`);

  if (['START','WC2026','SUBSCRIBE','YES','HI','HELLO','JOIN'].some(k => text.includes(k))) {
    const isNew = addSubscriber(phone, name);
    if (isNew) {
      await sendWelcome(phone).catch(e => console.error('[WA welcome]', e.message));
    } else {
      await sendText(phone, `⚽ You're already subscribed to WC 2026 Live alerts!\n\nReply STOP to unsubscribe.\n\nLive scores: ${VERCEL_URL}`).catch(() => {});
    }
    return;
  }

  if (['STOP','UNSUBSCRIBE','NO','QUIT','CANCEL'].some(k => text.includes(k))) {
    removeSubscriber(phone);
    await sendText(phone, `✅ You've been unsubscribed from WC 2026 Live alerts.\n\nReply START any time to re-subscribe.`).catch(() => {});
    return;
  }

  if (text.includes('SCORE') || text.includes('LIVE')) {
    await sendText(phone, `🔴 Live WC 2026 scores: ${VERCEL_URL}\n\nYou're also subscribed for instant alerts! 🔔`).catch(() => {});
    return;
  }

  // Default reply
  await sendText(phone, `⚽ WC 2026 Live\n\nCommands:\n• SCORE — live scores\n• STOP — unsubscribe\n\nLive coverage: ${VERCEL_URL}`).catch(() => {});
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

// Webhook verification (GET) — Meta sends this to verify the endpoint
app.get('/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
    console.log('[WhatsApp] webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Incoming messages (POST) — Meta sends user messages here
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // always 200 immediately

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    if (!changes?.messages) return;

    for (const msg of changes.messages) {
      const contact = changes.contacts?.find(c => c.wa_id === msg.from);
      await handleInbound(msg, contact).catch(e => console.error('[WA inbound]', e.message));
    }
  } catch (e) {
    console.error('[WhatsApp webhook]', e.message);
  }
});

// moment-engine trigger
app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  const subs = loadSubs().filter(s => s.active);
  if (!subs.length) return res.json({ ok: true, skipped: true, reason: 'no subscribers' });

  let result;
  try {
    if (eventType === 'GOAL' || eventType === 'PENALTY_GOAL') {
      result = await broadcastGoal(data);
    } else if (eventType === 'MATCH_END') {
      result = await broadcastResult(data);
    } else {
      return res.json({ ok: true, skipped: true, reason: `no template for ${eventType}` });
    }
    sendLog.unshift({ eventType, ...result, timestamp: new Date().toISOString() });
    if (sendLog.length > 200) sendLog.length = 200;
    res.json({ ok: true, eventType, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Manual send
app.post('/send', auth, async (req, res) => {
  const { phone, text, templateName, components } = req.body;
  if (!phone) return res.status(400).json({ ok: false, error: 'phone required' });
  try {
    let id;
    if (templateName) {
      id = await sendTemplate(phone, templateName, components || []);
    } else {
      id = await sendText(phone, text || 'WC 2026 Live update');
    }
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/subscribers', auth, (req, res) => {
  const subs = loadSubs();
  res.json({ ok: true, total: subs.length, active: subs.filter(s => s.active).length, subscribers: subs.slice(0, 50) });
});

app.get('/log', (req, res) => res.json({ ok: true, count: sendLog.length, log: sendLog.slice(0, 30) }));

app.get('/status', (req, res) => {
  const subs = loadSubs();
  res.json({
    ok:          true,
    service:     'whatsapp-engine',
    configured:  !!(WA_PHONE_ID && WA_TOKEN),
    phoneNumberId: WA_PHONE_ID || 'not set',
    subscribers: { total: subs.length, active: subs.filter(s => s.active).length },
    stats,
    templates:   WA_TEMPLATE
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function boot() {
  const PORT = process.env.WHATSAPP_PORT || process.env.PORT || 3034;
  app.listen(PORT, () => console.log(`[WhatsApp Engine] listening on :${PORT}`));

  ensureDataDir();

  if (!WA_PHONE_ID) {
    console.warn('[WhatsApp] WA_PHONE_NUMBER_ID not set');
    console.warn('[WhatsApp] Setup: business.facebook.com → WhatsApp → API Setup');
  }

  const subs = loadSubs().filter(s => s.active);
  console.log(`[WhatsApp Engine] running on :${PORT}`);
  console.log(`[WhatsApp] ${subs.length} subscribers | Webhook: POST /webhook`);
  console.log(`[WhatsApp] Verify token: ${WA_VERIFY_TOKEN} (set WA_VERIFY_TOKEN env var)`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
