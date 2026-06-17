/**
 * nairaland-engine.js
 * Nairaland — Nigeria's Biggest Forum
 *
 * Nairaland: 3M+ registered users, 90M+ posts, hugely active Sports section.
 * Nigeria's online community hub — more engaged than Twitter for long-form.
 * Football section is massive — Super Eagles fans, Premier League watchers.
 *
 * Nairaland has no official API. Two approaches:
 *   1. Direct HTTP post (session-based, requires login cookies)
 *   2. Save posts as drafts → user copy-pastes (safe, always works)
 *
 * This engine generates Nairaland-style forum posts (engaging, discussion-starting)
 * and can POST if session cookies are provided, otherwise outputs to Telegram for manual posting.
 *
 * Required env:
 *   NAIRALAND_SESSION    — session cookie (log in, get cookie from browser DevTools)
 *   NAIRALAND_USERNAME   — your Nairaland username
 *   NAIRALAND_BOARD      — board ID to post to (Sports = 4, Football = ?)
 *   TELEGRAM_BOT_TOKEN   — for draft delivery
 *   TELEGRAM_ADMIN_CHAT_ID — your personal chat ID
 *
 * Port: 3050
 */

'use strict';

require('dotenv').config();
const express    = require('express');
const axios      = require('axios');
const groqClient = require('./groq-client');

const SESSION       = process.env.NAIRALAND_SESSION       || '';
const USERNAME      = process.env.NAIRALAND_USERNAME      || '';
const BOARD         = process.env.NAIRALAND_BOARD         || '4'; // Sports
const TG_TOKEN      = process.env.TELEGRAM_BOT_TOKEN      || '';
const ADMIN_CHAT    = process.env.TELEGRAM_ADMIN_CHAT_ID  || process.env.TELEGRAM_OWNER_ID || '';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET       || '';
const PORT          = process.env.NAIRALAND_ENGINE_PORT || process.env.PORT || 3050;

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

// ─── Generate Nairaland-style post ───────────────────────────────────────────
// Nairaland has a very specific voice: energetic, opinionated, uses local slang,
// asks engaging questions to drive replies.
async function generateNairalandPost(eventType, payload) {
  const TOPIC_MAP = {
    GOAL:        `${payload.homeTeam} ${payload.homeScore||''}-${payload.awayScore||''} ${payload.awayTeam} — GOAL! ${payload.player||''} ${payload.minute?payload.minute+"'":''} | WC 2026 LIVE`,
    MATCH_END:   `FULL TIME: ${payload.homeTeam} ${payload.homeScore??'?'}-${payload.awayScore??'?'} ${payload.awayTeam} | WC 2026 Result`,
    HAT_TRICK:   `HAT-TRICK ALERT! ${payload.player||'Player'} Scores Three! | WC 2026`,
    UPSET:       `WC 2026 SHOCK RESULT: ${payload.homeTeam} ${payload.homeScore??''}-${payload.awayScore??''} ${payload.awayTeam} — Who Saw This Coming?`,
    ELIMINATION: `${payload.team||payload.awayTeam} Eliminated From WC 2026 — React Here`,
    PRE_MATCH:   `WC 2026 Match Preview: ${payload.homeTeam} vs ${payload.awayTeam} — Your Prediction?`,
    RED_CARD:    `RED CARD! ${payload.player||'Player'} Sent Off | ${payload.homeTeam} vs ${payload.awayTeam} | WC 2026`,
  };

  const topic = TOPIC_MAP[eventType] || `WC 2026: ${eventType} — ${payload.homeTeam||''} vs ${payload.awayTeam||''}`;

  try {
    const body = await groqClient.complete({
      engine: 'nairaland-engine', eventType,
      messages: [{
        role: 'system',
        content: 'You are writing a Nairaland forum post. Nigerian internet culture: energetic, use phrases like "Na today?", "As e be so", mix pidgin English naturally, ask questions to get people to reply. NOT formal. Short paragraphs. End with a discussion question.',
      }, {
        role: 'user',
        content: `Write a Nairaland Sports/Football forum post about this WC 2026 event: ${eventType}. Details: ${JSON.stringify(payload)}. Include pidgin English, ask for people's reactions, max 400 words.`,
      }],
      max_tokens: 400, temperature: 0.85,
    }) || `WC 2026 update! ${eventType} just happened. ${payload.homeTeam||''} vs ${payload.awayTeam||''}. What una think? Drop una reaction below!`;
    return { topic, body };
  } catch {
    return {
      topic,
      body: `Wetin una think about this result? ${payload.homeTeam||''} vs ${payload.awayTeam||''} — world cup 2026 no dey disappoint! Drop your reaction below, Nairaland fam!`,
    };
  }
}

// ─── Post to Nairaland (session-based) ────────────────────────────────────────
async function postToNairaland(topic, body) {
  if (!SESSION || !USERNAME) throw new Error('No Nairaland session — sending to Telegram draft instead');

  // Nairaland uses form POST for new topics
  const res = await axios.post('https://www.nairaland.com/new', new URLSearchParams({
    topic,
    body,
    board: BOARD,
  }), {
    headers: {
      'Cookie': `nairaland=${SESSION}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (compatible)',
      'Referer': 'https://www.nairaland.com/',
    },
    timeout: 15000,
    maxRedirects: 3,
  });

  // Check if post succeeded (redirect to new thread)
  const ok = res.request?.path && res.request.path !== '/new';
  return { ok, url: `https://www.nairaland.com${res.request?.path || ''}` };
}

// ─── Send draft to Telegram as fallback ──────────────────────────────────────
async function sendDraftToTelegram(topic, body) {
  if (!TG_TOKEN || !ADMIN_CHAT) return { skipped: 'no Telegram config' };
  const msg = `📋 *Nairaland Draft Ready*\n\n*Topic:* ${topic}\n\n${body.slice(0,800)}${body.length>800?'…':''}\n\n_Paste this to Nairaland Sports board_`;
  await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    chat_id: ADMIN_CHAT, text: msg, parse_mode: 'Markdown',
  });
  return { sent: 'telegram', note: 'Draft delivered to your Telegram' };
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.post('/trigger', async (req, res) => {
  const { eventType, ...payload } = req.body || {};
  const HANDLED = ['GOAL','MATCH_END','HAT_TRICK','UPSET','ELIMINATION','PRE_MATCH','RED_CARD'];
  if (!HANDLED.includes(eventType)) {
    return res.json({ ok: true, service: 'nairaland-engine', action: 'skipped', reason: `${eventType} not in list` });
  }
  try {
    const { topic, body } = await generateNairalandPost(eventType, payload);
    let result;
    if (SESSION && USERNAME) {
      try {
        result = await postToNairaland(topic, body);
      } catch(e) {
        result = await sendDraftToTelegram(topic, body);
      }
    } else {
      result = await sendDraftToTelegram(topic, body);
    }
    postLog.unshift({ eventType, topic: topic.slice(0,60), result, timestamp: new Date().toISOString() });
    if (postLog.length > 100) postLog.length = 100;
    console.log(`[Nairaland] ${eventType}:`, result);
    res.json({ ok: true, service: 'nairaland-engine', eventType, result });
  } catch(e) {
    console.error('[Nairaland] failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/log', (req, res) => res.json({ ok: true, log: postLog.slice(0,20) }));
app.get('/status', (req, res) => res.json({
  ok: true, service: 'nairaland-engine',
  mode: SESSION ? 'direct-posting' : 'telegram-draft',
  markets: ['Nigeria 🇳🇬 (3M+ registered Nairaland users, Sports section)'],
  note: 'No official API — uses session cookies for direct posts, Telegram for drafts',
  postsToday: postLog.filter(p => p.timestamp?.startsWith(new Date().toISOString().split('T')[0])).length,
}));
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[Nairaland Engine] listening on :${PORT}`);
  console.log(`[Nairaland] Mode: ${SESSION ? 'direct posting' : 'Telegram draft delivery'}`);
});
