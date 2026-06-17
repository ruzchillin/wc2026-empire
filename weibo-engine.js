/**
 * weibo-engine.js
 * Sina Weibo — China
 *
 * Weibo: China's Twitter — 600M registered, 250M daily active users.
 * Also covers: WeChat Channels (公众号 content push via API), Douyin notes.
 * China is the biggest football market that isn't competing — they watch everything.
 *
 * Weibo Open API:
 *   - POST statuses/share (with app access token + uid)
 *   - Supports text, images, links
 *   - Requires ICP registration for commercial use (mainland China)
 *
 * Required env:
 *   WEIBO_ACCESS_TOKEN  — OAuth2 from open.weibo.com (user-level token)
 *   WEIBO_UID           — your Weibo user ID (numeric)
 *   WECHAT_APP_ID       — WeChat Official Account App ID (optional — extends to WeChat)
 *   WECHAT_APP_SECRET   — WeChat Official Account App Secret
 *
 * Port: 3049
 */

'use strict';

require('dotenv').config();
const express    = require('express');
const axios      = require('axios');
const groqClient = require('./groq-client');

const WEIBO_TOKEN     = process.env.WEIBO_ACCESS_TOKEN || '';
const WEIBO_UID       = process.env.WEIBO_UID          || '';
const WECHAT_APP_ID   = process.env.WECHAT_APP_ID      || '';
const WECHAT_SECRET   = process.env.WECHAT_APP_SECRET  || '';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET    || '';
const PORT            = process.env.WEIBO_ENGINE_PORT || process.env.PORT || 3049;

const WEIBO_API  = 'https://api.weibo.com/2';
const WECHAT_API = 'https://api.weixin.qq.com/cgi-bin';
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

// ─── Chinese content templates ────────────────────────────────────────────────
const ZH_TEMPLATES = {
  GOAL:        d => `⚽ 进球！${d.homeTeam} ${d.homeScore||''}-${d.awayScore||''} ${d.awayTeam}\n${d.player?d.player+'射门得分！':''}\n${d.minute?d.minute+'分钟':''}\n#2026世界杯`,
  PENALTY_GOAL:d => `⚽ 点球命中！${d.homeTeam} ${d.homeScore||''}-${d.awayScore||''} ${d.awayTeam}\n#2026世界杯`,
  RED_CARD:    d => `🟥 红牌出局！${d.player||'球员'}被驱逐出场！\n${d.homeTeam} vs ${d.awayTeam}\n#2026世界杯`,
  HAT_TRICK:   d => `🎩 帽子戏法！${d.player||'球员'}上演大四喜！\n${d.homeTeam} vs ${d.awayTeam}\n#世界杯2026 #帽子戏法`,
  MATCH_END:   d => `🏁 比赛结束\n${d.homeTeam} ${d.homeScore??'?'}-${d.awayScore??'?'} ${d.awayTeam}\n#2026世界杯`,
  UPSET:       d => `😱 爆冷门！${d.homeTeam} ${d.homeScore??'?'}-${d.awayScore??'?'} ${d.awayTeam}\n2026年世界杯大冷门！#2026世界杯`,
  ELIMINATION: d => `💔 止步！${d.team||d.awayTeam}止步2026世界杯`,
  PRE_MATCH:   d => `⚽ 赛前预告：${d.homeTeam} vs ${d.awayTeam}${d.kickoff?'\n开球时间：'+d.kickoff:''}\n#2026世界杯`,
};

async function generateChineseContent(eventType, payload) {
  const tmpl = ZH_TEMPLATES[eventType];
  if (tmpl) return tmpl(payload);
  try {
    return await groqClient.complete({
      engine: 'weibo-engine', eventType,
      messages: [{ role: 'user', content: `Write a short Chinese (中文) Weibo post for this WC 2026 event: ${eventType}. ${JSON.stringify(payload)}. Max 280 chars. Use Chinese football terms and appropriate hashtags.` }],
      max_tokens: 120, temperature: 0.7,
    }) || `⚽ ${eventType} — #2026世界杯`;
  } catch { return `⚽ ${eventType} — #2026世界杯`; }
}

// ─── Weibo post ────────────────────────────────────────────────────────────────
async function postToWeibo(text) {
  if (!WEIBO_TOKEN) throw new Error('WEIBO_ACCESS_TOKEN not configured');

  const params = new URLSearchParams({
    access_token: WEIBO_TOKEN,
    status: text,
  });

  const res = await axios.post(`${WEIBO_API}/statuses/share.json`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  if (res.data.error) throw new Error(`Weibo error: ${res.data.error}`);
  return res.data;
}

// ─── WeChat access token (auto-refresh) ──────────────────────────────────────
let wcToken = { token: '', expiresAt: 0 };

async function getWechatToken() {
  if (wcToken.token && Date.now() < wcToken.expiresAt) return wcToken.token;
  if (!WECHAT_APP_ID || !WECHAT_SECRET) return null;
  const res = await axios.get(`${WECHAT_API}/token`, {
    params: { grant_type: 'client_credential', appid: WECHAT_APP_ID, secret: WECHAT_SECRET },
    timeout: 5000,
  });
  wcToken = { token: res.data.access_token, expiresAt: Date.now() + (res.data.expires_in - 60) * 1000 };
  return wcToken.token;
}

// WeChat template message (push to followers)
async function pushWechatTemplateMsg(text) {
  const token = await getWechatToken();
  if (!token) return { skipped: 'no WeChat credentials' };
  // WeChat Broadcast to all followers via mass messaging
  const res = await axios.post(`${WECHAT_API}/message/mass/sendall?access_token=${token}`, {
    filter: { is_to_all: true },
    text: { content: text },
    msgtype: 'text',
  }, { timeout: 10000 });
  return res.data;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.post('/trigger', async (req, res) => {
  const { eventType, ...payload } = req.body || {};
  const HANDLED = ['GOAL','PENALTY_GOAL','RED_CARD','HAT_TRICK','MATCH_END','UPSET','ELIMINATION','PRE_MATCH'];
  if (!HANDLED.includes(eventType)) {
    return res.json({ ok: true, service: 'weibo-engine', action: 'skipped', reason: `${eventType} not handled` });
  }
  try {
    const text = await generateChineseContent(eventType, payload);
    const results = {};

    if (WEIBO_TOKEN) {
      try { results.weibo = await postToWeibo(text); } catch(e) { results.weibo = `error: ${e.message}`; }
    }
    if (WECHAT_APP_ID) {
      try { results.wechat = await pushWechatTemplateMsg(text); } catch(e) { results.wechat = `error: ${e.message}`; }
    }
    if (!WEIBO_TOKEN && !WECHAT_APP_ID) results.warning = 'no credentials configured';

    postLog.unshift({ eventType, text: text.slice(0,60), results, timestamp: new Date().toISOString() });
    if (postLog.length > 100) postLog.length = 100;
    console.log(`[Weibo] ${eventType}:`, results);
    res.json({ ok: true, service: 'weibo-engine', eventType, results });
  } catch(e) {
    console.error('[Weibo] failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/log', (req, res) => res.json({ ok: true, log: postLog.slice(0,20) }));
app.get('/status', (req, res) => res.json({
  ok: true, service: 'weibo-engine',
  configured: { weibo: !!WEIBO_TOKEN, wechat: !!WECHAT_APP_ID },
  markets: ['China 🇨🇳 — Weibo 600M registered, WeChat 1.3B users'],
  reach: '250M+ Weibo daily active users',
  postsToday: postLog.filter(p => p.timestamp?.startsWith(new Date().toISOString().split('T')[0])).length,
}));
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[Weibo Engine] listening on :${PORT}`);
  if (!WEIBO_TOKEN) console.warn('[Weibo] WEIBO_ACCESS_TOKEN not set — visit open.weibo.com');
  if (!WECHAT_APP_ID) console.warn('[Weibo] WECHAT_APP_ID not set — optional WeChat broadcast disabled');
});
