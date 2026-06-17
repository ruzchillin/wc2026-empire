/**
 * kakao-engine.js
 * KakaoTalk + KakaoStory — South Korea
 *
 * KakaoTalk: 93% of South Koreans use it daily (45M users)
 * KakaoStory: Korea's Facebook equivalent (40M+ users)
 * Korea is football-mad — 2002 WC semi-finalists, always qualify.
 *
 * KakaoTalk Bot API:
 *   - Requires Business Channel (카카오 채널)
 *   - Sends messages via KakaoTalk Channel to subscribers
 *   - Supports text, image, quick replies, buttons
 *
 * Required env:
 *   KAKAO_ACCESS_TOKEN    — from developers.kakao.com → My Application → REST API Key
 *   KAKAO_CHANNEL_ID      — KakaoTalk Channel ID (starts with _)
 *   KAKAO_TEMPLATE_ID_GOAL — approved message template IDs
 *
 * Port: 3046
 */

'use strict';

require('dotenv').config();
const express    = require('express');
const axios      = require('axios');
const groqClient = require('./groq-client');

const ACCESS_TOKEN   = process.env.KAKAO_ACCESS_TOKEN  || '';
const CHANNEL_ID     = process.env.KAKAO_CHANNEL_ID    || '';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET    || '';
const PORT           = process.env.KAKAO_ENGINE_PORT || process.env.PORT || 3046;

const KAKAO_API = 'https://kapi.kakao.com/v1';
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

// ─── Korean content templates ─────────────────────────────────────────────────
const KO_TEMPLATES = {
  GOAL:        d => `⚽ 골! ${d.homeTeam} ${d.homeScore||''}-${d.awayScore||''} ${d.awayTeam}\n${d.player?d.player+' 득점!':''}\n${d.minute?d.minute+'분':''}`,
  PENALTY_GOAL:d => `⚽ 페널티킥 성공! ${d.homeTeam} ${d.homeScore||''}-${d.awayScore||''} ${d.awayTeam}`,
  RED_CARD:    d => `🟥 퇴장! ${d.player||'선수'} 레드카드\n${d.homeTeam} vs ${d.awayTeam}`,
  HAT_TRICK:   d => `🎩 해트트릭! ${d.player||'선수'} 환상적인 3골!\n#2026월드컵`,
  MATCH_END:   d => `🏁 경기 종료\n${d.homeTeam} ${d.homeScore??'?'}-${d.awayScore??'?'} ${d.awayTeam}`,
  UPSET:       d => `😱 이변! ${d.homeTeam} ${d.homeScore??'?'}-${d.awayScore??'?'} ${d.awayTeam}\n#2026월드컵 충격 결과!`,
  ELIMINATION: d => `💔 탈락! ${d.team||d.awayTeam} 2026 월드컵 탈락`,
  PRE_MATCH:   d => `⚽ 경기 예고: ${d.homeTeam} vs ${d.awayTeam}${d.kickoff?'\n킥오프: '+d.kickoff:''}`,
};

async function generateKoreanContent(eventType, payload) {
  const tmpl = KO_TEMPLATES[eventType];
  if (tmpl) return tmpl(payload);
  try {
    return await groqClient.complete({
      engine: 'kakao-engine', eventType,
      messages: [{ role: 'user', content: `Write a short Korean (한국어) KakaoTalk message for this WC 2026 event: ${eventType}. ${JSON.stringify(payload)}. Max 150 chars.` }],
      max_tokens: 80, temperature: 0.7,
    }) || `⚽ ${eventType} - 2026 월드컵`;
  } catch { return `⚽ ${eventType} - 2026 월드컵`; }
}

// ─── KakaoTalk Message API ────────────────────────────────────────────────────
async function sendChannelMessage(text, buttonUrl = null) {
  if (!ACCESS_TOKEN || !CHANNEL_ID) throw new Error('KAKAO_ACCESS_TOKEN or KAKAO_CHANNEL_ID not configured');

  // KakaoTalk Channel Message (to all subscribers)
  const body = {
    channel_public_id: CHANNEL_ID,
    object_type: 'text',
    text,
    link: buttonUrl ? { web_url: buttonUrl, mobile_web_url: buttonUrl } : undefined,
    button_title: buttonUrl ? '예측하기 →' : undefined,
  };

  const res = await axios.post(`${KAKAO_API}/api/talk/channels/${CHANNEL_ID}/message`, body, {
    headers: {
      'Authorization': `KakaoAK ${ACCESS_TOKEN}`,
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
    return res.json({ ok: true, service: 'kakao-engine', action: 'skipped', reason: `${eventType} not handled` });
  }
  try {
    const text = await generateKoreanContent(eventType, payload);
    await sendChannelMessage(text, 'https://wc2026picks.com?ref=kakao');
    postLog.unshift({ eventType, text: text.slice(0,60), timestamp: new Date().toISOString() });
    if (postLog.length > 100) postLog.length = 100;
    console.log(`[Kakao] ${eventType} sent`);
    res.json({ ok: true, service: 'kakao-engine', eventType });
  } catch(e) {
    console.error('[Kakao] send failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/log', (req, res) => res.json({ ok: true, log: postLog.slice(0,20) }));
app.get('/status', (req, res) => res.json({
  ok: true, service: 'kakao-engine',
  configured: !!ACCESS_TOKEN,
  markets: ['South Korea 🇰🇷 (45M KakaoTalk users, 93% penetration)'],
  reach: '45M daily active users',
  postsToday: postLog.filter(p => p.timestamp?.startsWith(new Date().toISOString().split('T')[0])).length,
}));
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[Kakao Engine] listening on :${PORT}`);
  if (!ACCESS_TOKEN) console.warn('[Kakao] KAKAO_ACCESS_TOKEN not set — visit developers.kakao.com');
});
