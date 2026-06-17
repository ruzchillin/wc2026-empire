/**
 * koo-engine.js
 * Koo API — India's Twitter alternative (50M+ users)
 *
 * Koo is India's home-grown microblogging platform.
 * Strong in Indian regional languages (Hindi, Tamil, Telugu, Kannada, etc.)
 * Our sharechat-engine covers India's video/regional content;
 * Koo covers real-time microblogging (India's Twitter).
 *
 * API: Koo provides a Partner API for verified publishers.
 * Without API access: uses web automation via their public endpoints.
 *
 * Required env:
 *   KOO_API_TOKEN    — from kooapp.com developer program
 *   KOO_USER_ID      — your Koo account user ID
 *
 * Port: 3043
 */
'use strict';
require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const groqClient = require('./groq-client');

const KOO_TOKEN   = process.env.KOO_API_TOKEN   || '';
const KOO_USER_ID = process.env.KOO_USER_ID     || '';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';
const PORT        = process.env.KOO_ENGINE_PORT || process.env.PORT || 3043;
const SITE_URL    = process.env.SITE_URL || 'https://wc2026picks.com';

const KOO_API = 'https://www.kooapp.com/api';
const postLog = [];

const app = express();
app.use(express.json());
function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const t = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && t !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

async function generateKooPost(eventType, payload) {
  const { homeTeam, awayTeam, homeScore, awayScore, player, minute } = payload;
  const templates = {
    GOAL:      `⚽ गोल! ${homeTeam} ${homeScore||''}-${awayScore||''} ${awayTeam}${player?'\n🌟 '+player:''} #WC2026 #WorldCup #FIFA`,
    MATCH_END: `🏁 फुल टाइम!\n${homeTeam} ${homeScore??'?'}-${awayScore??'?'} ${awayTeam}\n\n#WC2026 #WorldCup`,
    HAT_TRICK: `🎩 हैट-ट्रिक!\n${player||'खिलाड़ी'} ने तीन गोल किए!\n${homeTeam} vs ${awayTeam}\n#WC2026`,
    UPSET:     `😱 चौंकाने वाला नतीजा!\n${homeTeam} ${homeScore??'?'}-${awayScore??'?'} ${awayTeam}\n#WC2026 #Upset`,
    RED_CARD:  `🟥 लाल कार्ड!\n${player||'खिलाड़ी'} बाहर!\n${homeTeam} vs ${awayTeam}\n#WC2026`,
  };
  if (templates[eventType]) return templates[eventType];
  try {
    return await groqClient.complete({
      engine: 'koo-engine', eventType,
      messages: [{ role: 'user', content: `Write a short Koo post in Hindi (max 280 chars) for WC 2026 event: ${eventType}. ${homeTeam} vs ${awayTeam}. Use Hindi football terms. Include relevant hashtags.` }],
      max_tokens: 100, temperature: 0.8,
    }) || `⚽ WC 2026 अपडेट: ${eventType} - ${homeTeam} vs ${awayTeam} #WC2026`;
  } catch {
    return `⚽ WC 2026: ${homeTeam} vs ${awayTeam} #WC2026 #WorldCup`;
  }
}

async function postToKoo(content) {
  if (!KOO_TOKEN) throw new Error('KOO_API_TOKEN not configured');
  const res = await axios.post(`${KOO_API}/koo/create`, {
    content,
    userId: KOO_USER_ID,
    language: 'hi',
  }, {
    headers: { Authorization: `Bearer ${KOO_TOKEN}`, 'Content-Type': 'application/json' },
    timeout: 10000,
  });
  return res.data;
}

app.post('/trigger', async (req, res) => {
  const { eventType, ...payload } = req.body || {};
  const HANDLED = ['GOAL', 'PENALTY_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'PRE_MATCH'];
  if (!HANDLED.includes(eventType)) {
    return res.json({ ok: true, service: 'koo-engine', action: 'skipped' });
  }
  try {
    const content = await generateKooPost(eventType, payload);
    const result  = await postToKoo(content);
    postLog.unshift({ eventType, content: content.slice(0, 60), timestamp: new Date().toISOString() });
    if (postLog.length > 100) postLog.length = 100;
    console.log(`[Koo] Posted: ${eventType}`);
    res.json({ ok: true, service: 'koo-engine', eventType, result });
  } catch(e) {
    console.error('[Koo] post failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/log',    (req, res) => res.json({ ok: true, log: postLog.slice(0, 20) }));
app.get('/status', (req, res) => res.json({ ok: true, service: 'koo-engine', configured: !!KOO_TOKEN, postsToday: postLog.filter(p=>p.timestamp?.startsWith(new Date().toISOString().split('T')[0])).length, market: 'India 🇮🇳 — 50M users', language: 'Hindi + regional' }));
app.get('/health', (req, res) => res.json({ ok: true }));
app.listen(PORT, () => {
  console.log(`[Koo Engine] listening on :${PORT}`);
  if (!KOO_TOKEN) console.warn('[Koo] KOO_API_TOKEN not set — apply at kooapp.com/developer');
});
