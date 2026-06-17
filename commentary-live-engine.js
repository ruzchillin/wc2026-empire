/**
 * WC 2026 Sports Empire — Commentary Live Engine
 * Deploy on Railway.app as service "commentary-live-engine"
 *
 * Every 5 minutes during live matches, Groq generates a 2-sentence
 * live commentary snippet from the current match state, then posts
 * it to Telegram free channel, Bluesky, and Mastodon simultaneously.
 *
 * This creates a "live blog" feel on all text platforms without
 * needing a human to write anything.
 *
 * Required env vars:
 *   GROQ_API_KEY         — Groq API (free, 500K tokens/day)
 *   API_SERVER_URL       — for live match data
 *   TELEGRAM_BOT_TOKEN   — bot token
 *   TELEGRAM_CHANNEL_ID  — your free Telegram channel (e.g. @wc2026live)
 *   BLUESKY_ENGINE_URL   — bluesky-engine.js Railway URL
 *   MASTODON_ENGINE_URL  — mastodon-engine.js Railway URL
 *   PIPELINE_SECRET      — shared inter-service secret
 *   VERCEL_URL           — main site URL
 *
 * Endpoints:
 *   POST /trigger          — immediate commentary generation
 *   POST /commentary/manual — post manual text to all platforms
 *   GET  /log              — recent commentary log
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');
const groqClient = require('./groq-client');

const GROQ_KEY           = process.env.GROQ_API_KEY          || ''; // still checked so startup warns if unset
const API_SERVER_URL     = (process.env.API_SERVER_URL       || 'http://localhost:3001').replace(/\/$/, '');
const TG_BOT_TOKEN       = process.env.TELEGRAM_BOT_TOKEN    || '';
const TG_CHANNEL_ID      = process.env.TELEGRAM_CHANNEL_ID   || '';
const BLUESKY_ENGINE_URL = (process.env.BLUESKY_ENGINE_URL   || 'http://localhost:3006').replace(/\/$/, '');
const MASTODON_ENGINE_URL = (process.env.MASTODON_ENGINE_URL || 'http://localhost:3007').replace(/\/$/, '');
const PIPELINE_SECRET    = process.env.PIPELINE_SECRET        || '';
const VERCEL_URL         = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');

const commentaryLog = []; // in-memory ring buffer
let commentaryCount = 0;
let lastMatchState  = {};  // matchId -> { lastMinute, lastScore }

// ─── Groq commentary generation ───────────────────────────────────────────────

async function generateCommentary(match, recentEvent) {
  const homeTeam  = match.teams?.home?.name  || match.homeTeam  || 'Home';
  const awayTeam  = match.teams?.away?.name  || match.awayTeam  || 'Away';
  const homeScore = match.goals?.home        ?? match.homeScore ?? 0;
  const awayScore = match.goals?.away        ?? match.awayScore ?? 0;
  const minute    = match.fixture?.status?.elapsed || match.minute || '?';
  const venue     = match.fixture?.venue?.name     || '';

  let eventContext = '';
  if (recentEvent) {
    eventContext = `\nRecent event: ${recentEvent.type || ''} — ${recentEvent.player?.name || recentEvent.player || ''} (${recentEvent.time?.elapsed || recentEvent.minute || '?'}')`;
  }

  const prompt = `You are an exciting live football commentator for the 2026 FIFA World Cup.
Write EXACTLY 2 sentences of live commentary for this moment:

Match: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}
Minute: ${minute}'
${venue ? `Venue: ${venue}` : ''}${eventContext}

Rules:
- Maximum 280 characters total (for Twitter/Bluesky character limit)
- Be exciting and vivid
- Reference the score and minute naturally
- Second sentence can speculate on what might happen next
- No hashtags (will be added after)`;

  // Uses shared budget guard — prevents burning 480K/day in a single busy match
  return groqClient.complete({
    engine:      'commentary-live-engine',
    eventType:   'COMMENTARY',
    messages:    [{ role: 'user', content: prompt }],
    max_tokens:  120,
    temperature: 0.85,
  });
}

// ─── Platform posting ─────────────────────────────────────────────────────────

async function postToTelegram(text) {
  if (!TG_BOT_TOKEN || !TG_CHANNEL_ID) return { ok: false, error: 'Telegram not configured' };
  try {
    const r = await axios.post(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      { chat_id: TG_CHANNEL_ID, text, parse_mode: 'HTML' },
      { timeout: 10000 }
    );
    return { ok: true, messageId: r.data?.result?.message_id };
  } catch (e) {
    return { ok: false, error: e.response?.data?.description || e.message };
  }
}

async function postToBluesky(text, tags) {
  try {
    const r = await axios.post(
      `${BLUESKY_ENGINE_URL}/post`,
      { text, tags },
      { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 20000 }
    );
    return { ok: true, uri: r.data?.uri };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function postToMastodon(text) {
  try {
    const r = await axios.post(
      `${MASTODON_ENGINE_URL}/toot`,
      { status: text },
      { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 20000 }
    );
    return { ok: true, id: r.data?.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── Live commentary cycle ────────────────────────────────────────────────────

async function getLiveMatches() {
  const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/live`, { timeout: 15000 });
  return r.data?.matches || r.data?.response || [];
}

async function runCommentaryCycle() {
  let matches;
  try {
    matches = await getLiveMatches();
  } catch (e) {
    console.error('[Commentary] failed to fetch live matches:', e.message);
    return;
  }

  if (!matches.length) {
    console.log('[Commentary] no live matches — skipping');
    return;
  }

  console.log(`[Commentary] ${matches.length} live match(es) — generating commentary`);

  for (const match of matches) {
    const id        = match.fixture?.id || match.id || JSON.stringify(match).slice(0, 20);
    const homeScore = match.goals?.home ?? match.homeScore ?? 0;
    const awayScore = match.goals?.away ?? match.awayScore ?? 0;
    const minute    = match.fixture?.status?.elapsed || match.minute || 0;
    const homeTeam  = match.teams?.home?.name || match.homeTeam || '';
    const awayTeam  = match.teams?.away?.name || match.awayTeam || '';

    // Detect if anything changed since last cycle
    const prev = lastMatchState[id] || {};
    const scoreChanged  = (prev.homeScore !== homeScore || prev.awayScore !== awayScore);
    const minuteChanged = Math.abs((prev.minute || 0) - minute) >= 4; // 5-min intervals

    // Skip if nothing to comment on
    if (!scoreChanged && !minuteChanged) continue;

    lastMatchState[id] = { homeScore, awayScore, minute };

    try {
      const commentary = await generateCommentary(match, null);
      if (!commentary) continue;

      // Build platform-specific posts
      const tags = ['WC2026', 'WorldCup2026', homeTeam.replace(/\s/g, ''), awayTeam.replace(/\s/g, '')];
      const hashtagStr = tags.map(t => `#${t}`).join(' ');
      const fullText   = `${commentary}\n\n${hashtagStr}`;
      const bskyText   = commentary.length + hashtagStr.length + 2 <= 300
        ? fullText : commentary.slice(0, 280 - hashtagStr.length - 2) + '\n\n' + hashtagStr;

      // Post to all platforms simultaneously
      const [tgResult, bskyResult, mastoResult] = await Promise.allSettled([
        postToTelegram(`⚽ <b>LIVE ${minute}'</b> — ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\n${commentary}\n\n🔗 ${VERCEL_URL}`),
        postToBluesky(bskyText, tags),
        postToMastodon(fullText.slice(0, 500))
      ]);

      commentaryCount++;

      const logEntry = {
        timestamp: new Date().toISOString(),
        matchId:   id,
        match:     `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
        minute,
        text:      commentary,
        telegram:  tgResult.status === 'fulfilled' ? tgResult.value : { ok: false, error: tgResult.reason.message },
        bluesky:   bskyResult.status === 'fulfilled' ? bskyResult.value : { ok: false, error: bskyResult.reason.message },
        mastodon:  mastoResult.status === 'fulfilled' ? mastoResult.value : { ok: false, error: mastoResult.reason.message }
      };

      commentaryLog.unshift(logEntry);
      if (commentaryLog.length > 200) commentaryLog.length = 200;

      console.log(`[Commentary] posted for ${homeTeam} vs ${awayTeam} (${minute}') — TG:${logEntry.telegram.ok} BS:${logEntry.bluesky.ok} MD:${logEntry.mastodon.ok}`);
    } catch (e) {
      console.error(`[Commentary] ${homeTeam} vs ${awayTeam}:`, e.message);
    }

    // Stagger between matches
    await new Promise(r => setTimeout(r, 3000));
  }
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// Immediate trigger (e.g. from moment-engine on GOAL)
app.post('/trigger', auth, async (req, res) => {
  const { eventType, homeTeam, awayTeam, homeScore, awayScore, minute, player } = req.body;
  if (!['GOAL', 'PENALTY_GOAL', 'RED_CARD'].includes(eventType)) {
    return res.json({ ok: true, skipped: true });
  }

  try {
    const match    = { homeTeam, awayTeam, goals: { home: homeScore, away: awayScore }, fixture: { status: { elapsed: minute } } };
    const event    = { type: eventType, player, minute };
    const commentary = await generateCommentary(match, event);
    const tags     = ['WC2026', 'WorldCup2026', (homeTeam || '').replace(/\s/g, ''), (awayTeam || '').replace(/\s/g, '')];
    const fullText = `${commentary}\n\n${tags.map(t => `#${t}`).join(' ')}`;

    const [tg, bs, md] = await Promise.allSettled([
      postToTelegram(`⚽ <b>${eventType} — ${minute}'</b>\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\n${commentary}\n\n🔗 ${VERCEL_URL}`),
      postToBluesky(fullText.slice(0, 300), tags),
      postToMastodon(fullText.slice(0, 500))
    ]);

    commentaryCount++;
    res.json({
      ok:        true,
      commentary,
      telegram:  tg.status  === 'fulfilled' ? tg.value  : { ok: false, error: tg.reason.message },
      bluesky:   bs.status  === 'fulfilled' ? bs.value  : { ok: false, error: bs.reason.message },
      mastodon:  md.status  === 'fulfilled' ? md.value  : { ok: false, error: md.reason.message }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Manual post override
app.post('/commentary/manual', auth, async (req, res) => {
  const { text, matchLabel } = req.body;
  if (!text) return res.status(400).json({ ok: false, error: 'text required' });

  const [tg, bs, md] = await Promise.allSettled([
    postToTelegram(text),
    postToBluesky(text.slice(0, 300), ['WC2026']),
    postToMastodon(text.slice(0, 500))
  ]);

  res.json({
    ok:       true,
    telegram: tg.status === 'fulfilled' ? tg.value : { ok: false, error: tg.reason.message },
    bluesky:  bs.status === 'fulfilled' ? bs.value : { ok: false, error: bs.reason.message },
    mastodon: md.status === 'fulfilled' ? md.value : { ok: false, error: md.reason.message }
  });
});

app.get('/log', (req, res) => {
  res.json({ ok: true, count: commentaryLog.length, log: commentaryLog.slice(0, 50) });
});

app.get('/status', (req, res) => {
  res.json({
    ok:                   true,
    service:              'commentary-live-engine',
    commentaryCount,
    groqConfigured:       !!GROQ_KEY,
    telegramConfigured:   !!(TG_BOT_TOKEN && TG_CHANNEL_ID),
    blueskyEngineUrl:     BLUESKY_ENGINE_URL,
    mastodonEngineUrl:    MASTODON_ENGINE_URL,
    schedule:             'Every 5 minutes during live matches',
    trackedMatches:       Object.keys(lastMatchState).length
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.COMMENTARY_PORT || process.env.PORT || 3018;
  app.listen(PORT, () => console.log(`[Commentary Engine] listening on :${PORT}`));

  if (!GROQ_KEY)       console.warn('[Commentary] GROQ_API_KEY not set');
  if (!TG_BOT_TOKEN)   console.warn('[Commentary] TELEGRAM_BOT_TOKEN not set');
  if (!TG_CHANNEL_ID)  console.warn('[Commentary] TELEGRAM_CHANNEL_ID not set');

  // Every 5 minutes — check for live matches and generate commentary
  cron.schedule('*/5 * * * *', runCommentaryCycle);

  console.log(`[Commentary Engine] running on :${PORT}
  Cycle: every 5 minutes
  Platforms: Telegram + Bluesky + Mastodon
  `);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
