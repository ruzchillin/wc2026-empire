/**
 * zalo-engine.js
 * Zalo — Vietnam's Dominant Super-App
 *
 * Zalo: 75M monthly active users in Vietnam (population 98M)
 * Vietnam QUALIFIED for WC 2026 — massive, captive football audience.
 * Zalo is WhatsApp + Facebook + WeChat for Vietnam.
 * Zalo Official Account (OA) = business broadcast channel.
 *
 * Required env:
 *   ZALO_ACCESS_TOKEN    — from developers.zalo.me → Your App → Access Token
 *   ZALO_OA_ID           — Official Account ID (from Zalo OA management)
 *   ZALO_APP_ID          — App ID from developers.zalo.me
 *   ZALO_APP_SECRET      — App Secret
 *
 * Port: 3047
 */

'use strict';

require('dotenv').config();
const express    = require('express');
const axios      = require('axios');
const groqClient = require('./groq-client');

const ACCESS_TOKEN    = process.env.ZALO_ACCESS_TOKEN  || '';
const OA_ID           = process.env.ZALO_OA_ID         || '';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET    || '';
const PORT            = process.env.ZALO_ENGINE_PORT || process.env.PORT || 3047;

const ZALO_API = 'https://openapi.zalo.me/v2.0/oa';
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

// ─── Vietnamese content templates ─────────────────────────────────────────────
const VI_TEMPLATES = {
  GOAL:        d => `⚽ BÀN THẮNG! ${d.homeTeam} ${d.homeScore||''}-${d.awayScore||''} ${d.awayTeam}\n${d.player?d.player+' ghi bàn!':''}\n${d.minute?'Phút '+d.minute:''}`,
  PENALTY_GOAL:d => `⚽ Phạt đền thành công! ${d.homeTeam} ${d.homeScore||''}-${d.awayScore||''} ${d.awayTeam}`,
  RED_CARD:    d => `🟥 THẺ ĐỎ! ${d.player||'Cầu thủ'} bị đuổi!\n${d.homeTeam} vs ${d.awayTeam}`,
  HAT_TRICK:   d => `🎩 HAT-TRICK! ${d.player||'Cầu thủ'} ghi 3 bàn!\n${d.homeTeam} vs ${d.awayTeam}\n#WorldCup2026`,
  MATCH_END:   d => `🏁 KẾT THÚC TRẬN ĐẤU\n${d.homeTeam} ${d.homeScore??'?'}-${d.awayScore??'?'} ${d.awayTeam}\n#WorldCup2026`,
  UPSET:       d => `😱 BẤT NGỜ LỚN!\n${d.homeTeam} ${d.homeScore??'?'}-${d.awayScore??'?'} ${d.awayTeam}\nKết quả gây sốc tại World Cup 2026!`,
  ELIMINATION: d => `💔 DỪNG BƯỚC! ${d.team||d.awayTeam} bị loại khỏi World Cup 2026`,
  PRE_MATCH:   d => `⚽ SẮP BẮT ĐẦU: ${d.homeTeam} vs ${d.awayTeam}${d.kickoff?'\nKhai mạc: '+d.kickoff:''}`,
};

async function generateVietnameseContent(eventType, payload) {
  const tmpl = VI_TEMPLATES[eventType];
  if (tmpl) return tmpl(payload);
  try {
    return await groqClient.complete({
      engine: 'zalo-engine', eventType,
      messages: [{ role: 'user', content: `Write a short Vietnamese (tiếng Việt) Zalo message for this WC 2026 event: ${eventType}. ${JSON.stringify(payload)}. Max 200 chars. Use Vietnamese football terms.` }],
      max_tokens: 80, temperature: 0.7,
    }) || `⚽ ${eventType} - World Cup 2026`;
  } catch { return `⚽ ${eventType} - World Cup 2026`; }
}

// ─── Zalo OA broadcast ────────────────────────────────────────────────────────
async function broadcastMessage(text) {
  if (!ACCESS_TOKEN || !OA_ID) throw new Error('ZALO_ACCESS_TOKEN or ZALO_OA_ID not configured');

  // Zalo OA Broadcast Message
  const res = await axios.post(`${ZALO_API}/message/broadcast`, {
    recipient: { message_tag: 'CONFIRMED_EVENT_UPDATE' },
    message: {
      text,
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons: [{
            title: 'Dự đoán ngay →',
            type: 'oa.open.url',
            payload: { url: 'https://wc2026picks.com?ref=zalo' },
          }],
        },
      },
    },
  }, {
    headers: {
      'access_token': ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
  return res.data;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.post('/trigger', async (req, res) => {
  const { eventType, ...payload } = req.body || {};
  const HANDLED = ['GOAL','PENALTY_GOAL','RED_CARD','HAT_TRICK','MATCH_END','UPSET','ELIMINATION','PRE_MATCH'];
  if (!HANDLED.includes(eventType)) {
    return res.json({ ok: true, service: 'zalo-engine', action: 'skipped', reason: `${eventType} not handled` });
  }
  try {
    const text = await generateVietnameseContent(eventType, payload);
    await broadcastMessage(text);
    postLog.unshift({ eventType, text: text.slice(0,60), timestamp: new Date().toISOString() });
    if (postLog.length > 100) postLog.length = 100;
    console.log(`[Zalo] ${eventType} broadcast sent`);
    res.json({ ok: true, service: 'zalo-engine', eventType });
  } catch(e) {
    console.error('[Zalo] broadcast failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/log', (req, res) => res.json({ ok: true, log: postLog.slice(0,20) }));
app.get('/status', (req, res) => res.json({
  ok: true, service: 'zalo-engine',
  configured: !!ACCESS_TOKEN,
  markets: ['Vietnam 🇻🇳 (75M MAU, Vietnam QUALIFIED for WC 2026)'],
  reach: '75M monthly active users',
  note: 'Vietnam qualified for WC 2026 — massive captive audience',
  postsToday: postLog.filter(p => p.timestamp?.startsWith(new Date().toISOString().split('T')[0])).length,
}));
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[Zalo Engine] listening on :${PORT}`);
  if (!ACCESS_TOKEN) console.warn('[Zalo] ZALO_ACCESS_TOKEN not set — visit developers.zalo.me');
});
