/**
 * vk-engine.js
 * VKontakte (VK) — Russia, Ukraine, Belarus, Kazakhstan, CIS
 *
 * VK: 100M+ monthly active users
 * Russia's dominant social network — also huge in CIS countries.
 * Football is massive: Champions League, World Cup, local leagues all huge.
 * VK Communities (groups) = broadcast channel. Post to Community wall.
 *
 * Note: Use responsibly within applicable laws/sanctions.
 *
 * Required env:
 *   VK_ACCESS_TOKEN   — from vk.com/apps → Access Tokens → Community token
 *   VK_GROUP_ID       — your VK Community ID (numeric, no minus sign)
 *   VK_API_VERSION    — VK API version (default: 5.199)
 *
 * Port: 3048
 */

'use strict';

require('dotenv').config();
const express    = require('express');
const axios      = require('axios');
const groqClient = require('./groq-client');

const ACCESS_TOKEN    = process.env.VK_ACCESS_TOKEN  || '';
const GROUP_ID        = process.env.VK_GROUP_ID      || '';
const API_VERSION     = process.env.VK_API_VERSION   || '5.199';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET  || '';
const PORT            = process.env.VK_ENGINE_PORT || process.env.PORT || 3048;

const VK_API = 'https://api.vk.com/method';
const postLog = [];

const app = express();
app.use(express.json());

function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const token = req.headers['x-pipeline-secret'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

// ─── Russian content templates ────────────────────────────────────────────────
const RU_TEMPLATES = {
  GOAL:        d => `⚽ ГОЛ! ${d.homeTeam} ${d.homeScore||''}-${d.awayScore||''} ${d.awayTeam}\n${d.player?d.player+' забил!':''}\n${d.minute?d.minute+'-я минута':''}`,
  PENALTY_GOAL:d => `⚽ Пенальти реализован! ${d.homeTeam} ${d.homeScore||''}-${d.awayScore||''} ${d.awayTeam}`,
  RED_CARD:    d => `🟥 УДАЛЕНИЕ! ${d.player||'Игрок'} получает красную карточку!\n${d.homeTeam} vs ${d.awayTeam}`,
  HAT_TRICK:   d => `🎩 ХЕТ-ТРИК! ${d.player||'Игрок'} забивает три гола!\n${d.homeTeam} vs ${d.awayTeam}\n#ЧМ2026`,
  MATCH_END:   d => `🏁 ФИНАЛЬНЫЙ СВИСТОК\n${d.homeTeam} ${d.homeScore??'?'}-${d.awayScore??'?'} ${d.awayTeam}\n#ЧМ2026`,
  UPSET:       d => `😱 СЕНСАЦИЯ! ${d.homeTeam} ${d.homeScore??'?'}-${d.awayScore??'?'} ${d.awayTeam}\nГромкая сенсация на ЧМ-2026!`,
  ELIMINATION: d => `💔 ВЫЛЕТ! ${d.team||d.awayTeam} покидает Чемпионат мира 2026`,
  PRE_MATCH:   d => `⚽ СКОРО: ${d.homeTeam} vs ${d.awayTeam}${d.kickoff?'\nНачало: '+d.kickoff:''}`,
};

async function generateRussianContent(eventType, payload) {
  const tmpl = RU_TEMPLATES[eventType];
  if (tmpl) return tmpl(payload);
  try {
    return await groqClient.complete({
      engine: 'vk-engine', eventType,
      messages: [{ role: 'user', content: `Write a short Russian (по-русски) VKontakte post for this WC 2026 event: ${eventType}. ${JSON.stringify(payload)}. Max 300 chars. Use Russian football vocabulary.` }],
      max_tokens: 100, temperature: 0.7,
    }) || `⚽ ${eventType} — ЧМ 2026`;
  } catch { return `⚽ ${eventType} — ЧМ 2026`; }
}

// ─── VK Wall Post ─────────────────────────────────────────────────────────────
async function postToWall(message) {
  if (!ACCESS_TOKEN || !GROUP_ID) throw new Error('VK_ACCESS_TOKEN or VK_GROUP_ID not configured');

  const params = new URLSearchParams({
    owner_id: `-${GROUP_ID}`,  // negative for community
    message,
    from_group: 1,
    access_token: ACCESS_TOKEN,
    v: API_VERSION,
  });

  const res = await axios.post(`${VK_API}/wall.post`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  if (res.data.error) throw new Error(`VK API error: ${res.data.error.error_msg}`);
  return res.data.response;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.post('/trigger', async (req, res) => {
  const { eventType, ...payload } = req.body || {};
  const HANDLED = ['GOAL','PENALTY_GOAL','RED_CARD','HAT_TRICK','MATCH_END','UPSET','ELIMINATION','PRE_MATCH'];
  if (!HANDLED.includes(eventType)) {
    return res.json({ ok: true, service: 'vk-engine', action: 'skipped', reason: `${eventType} not handled` });
  }
  try {
    const text = await generateRussianContent(eventType, payload);
    const result = await postToWall(text);
    postLog.unshift({ eventType, text: text.slice(0,60), postId: result?.post_id, timestamp: new Date().toISOString() });
    if (postLog.length > 100) postLog.length = 100;
    console.log(`[VK] ${eventType} posted, id: ${result?.post_id}`);
    res.json({ ok: true, service: 'vk-engine', eventType, postId: result?.post_id });
  } catch(e) {
    console.error('[VK] post failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/log', (req, res) => res.json({ ok: true, log: postLog.slice(0,20) }));
app.get('/status', (req, res) => res.json({
  ok: true, service: 'vk-engine',
  configured: !!ACCESS_TOKEN,
  markets: ['Russia 🇷🇺', 'Ukraine 🇺🇦', 'Belarus 🇧🇾', 'Kazakhstan 🇰🇿', 'CIS countries'],
  reach: '100M+ monthly active users',
  postsToday: postLog.filter(p => p.timestamp?.startsWith(new Date().toISOString().split('T')[0])).length,
}));
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[VK Engine] listening on :${PORT}`);
  if (!ACCESS_TOKEN) console.warn('[VK] VK_ACCESS_TOKEN not set — visit vk.com/apps');
});
