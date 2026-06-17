/**
 * WC 2026 Sports Empire — Bluesky Engine
 * Deploy on Railway.app as service "bluesky-engine"
 *
 * Posts to Bluesky via AT Protocol. Covers 20M+ users,
 * heavy football/sports community. Free, no rate limits like Twitter.
 *
 * Required env vars:
 *   BLUESKY_HANDLE        — e.g. wc2026live.bsky.social
 *   BLUESKY_APP_PASSWORD  — generate at bsky.app -> Settings -> App Passwords
 *   API_SERVER_URL        — for fetching live match data
 *   MOMENT_ENGINE_URL     — called by moment-engine triggers
 *   PIPELINE_SECRET       — shared inter-service secret
 *
 * Endpoints:
 *   POST /post/match-update  — manual post for a match
 *   POST /post/goal          — goal alert post
 *   POST /post/prediction    — AI prediction post
 *   POST /post/pre-match     — daily pre-match preview
 *   POST /trigger            — moment-engine webhook
 *   GET  /status             — service health + post count
 */

'use strict';

require('dotenv').config();
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const HANDLE          = process.env.BLUESKY_HANDLE        || '';
const APP_PASSWORD    = process.env.BLUESKY_APP_PASSWORD  || '';
const API_SERVER_URL  = process.env.API_SERVER_URL        || 'http://localhost:3001';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET       || '';

const BSKY_PDS = 'https://bsky.social';

// ─── Auth ─────────────────────────────────────────────────────────────────────

let session = null;
let sessionExpiry = 0;

async function getSession() {
  if (session && Date.now() < sessionExpiry) return session;

  if (!HANDLE || !APP_PASSWORD) {
    throw new Error('BLUESKY_HANDLE and BLUESKY_APP_PASSWORD not configured');
  }

  const r = await axios.post(`${BSKY_PDS}/xrpc/com.atproto.server.createSession`, {
    identifier: HANDLE,
    password:   APP_PASSWORD
  });

  session       = r.data;
  sessionExpiry = Date.now() + 2 * 60 * 60 * 1000; // 2hr (sessions last 24hr, refresh at 2)
  console.log(`[Bluesky] authenticated as ${HANDLE} (DID: ${session.did})`);
  return session;
}

// ─── Rich text helper ─────────────────────────────────────────────────────────
// Bluesky requires byte offsets for facets (hashtags, mentions, links)

function buildFacets(text, tags = [], links = []) {
  const facets = [];
  const encoder = new TextEncoder();

  for (const tag of tags) {
    const marker = `#${tag}`;
    const idx = text.indexOf(marker);
    if (idx === -1) continue;
    const byteStart = encoder.encode(text.slice(0, idx)).length;
    const byteEnd   = byteStart + encoder.encode(marker).length;
    facets.push({
      index:    { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag }]
    });
  }

  for (const { url, display } of links) {
    const idx = text.indexOf(display);
    if (idx === -1) continue;
    const byteStart = encoder.encode(text.slice(0, idx)).length;
    const byteEnd   = byteStart + encoder.encode(display).length;
    facets.push({
      index:    { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }]
    });
  }

  return facets;
}

// ─── Core post ────────────────────────────────────────────────────────────────

let postCount = 0;

async function createPost(text, { tags = [], links = [], embed = null } = {}) {
  const s      = await getSession();
  const facets = buildFacets(text, tags, links);

  const record = {
    $type:     'app.bsky.feed.post',
    text,
    facets:    facets.length ? facets : undefined,
    embed:     embed || undefined,
    createdAt: new Date().toISOString(),
    langs:     ['en']
  };

  const r = await axios.post(
    `${BSKY_PDS}/xrpc/com.atproto.repo.createRecord`,
    {
      repo:       s.did,
      collection: 'app.bsky.feed.post',
      record
    },
    {
      headers: {
        Authorization:  `Bearer ${s.accessJwt}`,
        'Content-Type': 'application/json'
      }
    }
  );

  postCount++;
  console.log(`[Bluesky] posted: ${text.slice(0, 60)}…`);
  return r.data; // { uri, cid }
}

// ─── Content builders ─────────────────────────────────────────────────────────

function goalPost(data) {
  const { homeTeam, awayTeam, homeScore, awayScore, minute, player, team } = data;
  const scorer = player ? ` — ${player}` : '';
  const text = `⚽ GOAL! ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} (${minute}')${scorer}\n\n#WC2026 #WorldCup2026 #${homeTeam.replace(/\s/g,'')} #${awayTeam.replace(/\s/g,'')}`;
  return { text, tags: ['WC2026', 'WorldCup2026', homeTeam.replace(/\s/g,''), awayTeam.replace(/\s/g,'')] };
}

function redCardPost(data) {
  const { homeTeam, awayTeam, homeScore, awayScore, minute, player, team } = data;
  const name = player ? ` — ${player} (${team})` : '';
  const text = `🟥 RED CARD! ${minute}'${name}\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\n#WC2026 #WorldCup2026`;
  return { text, tags: ['WC2026', 'WorldCup2026'] };
}

function matchEndPost(data) {
  const { homeTeam, awayTeam, homeScore, awayScore, result } = data;
  const emoji = result === 'draw' ? '🤝' : '🏆';
  const winner = result === 'home_win' ? homeTeam : result === 'away_win' ? awayTeam : null;
  const resultLine = winner ? `${winner} win!` : "It's a draw!";
  const text = `${emoji} FINAL: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n${resultLine}\n\n#WC2026 #WorldCup2026 #${homeTeam.replace(/\s/g,'')} #${awayTeam.replace(/\s/g,'')}`;
  return { text, tags: ['WC2026', 'WorldCup2026', homeTeam.replace(/\s/g,''), awayTeam.replace(/\s/g,'')] };
}

function predictionPost(match, prediction) {
  const { homeTeam, awayTeam } = match;
  const { homeWinPct, drawPct, awayWinPct, keyFactor, predictedScore } = prediction;
  const scoreStr = predictedScore ? ` Predicted score: ${predictedScore}.` : '';
  const text = [
    `🤖 AI Prediction: ${homeTeam} vs ${awayTeam}`,
    `${homeTeam} win: ${homeWinPct}%`,
    `Draw: ${drawPct}%`,
    `${awayTeam} win: ${awayWinPct}%`,
    keyFactor ? `Key factor: ${keyFactor}` : null,
    scoreStr,
    `\n#WC2026 #WorldCup2026 #AI`
  ].filter(Boolean).join('\n');
  return { text, tags: ['WC2026', 'WorldCup2026', 'AI'] };
}

function preMatchPost(homeTeam, awayTeam, kickoff, venue) {
  const time = new Date(kickoff).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const text = `📅 TODAY: ${homeTeam} 🆚 ${awayTeam}\nKick-off: ${time} UTC${venue ? ` @ ${venue}` : ''}\n\nFollow for live goals, AI predictions & real-time analysis 👉\n\n#WC2026 #WorldCup2026 #${homeTeam.replace(/\s/g,'')} #${awayTeam.replace(/\s/g,'')}`;
  return { text, tags: ['WC2026', 'WorldCup2026', homeTeam.replace(/\s/g,''), awayTeam.replace(/\s/g,'')] };
}

function varPost(data) {
  const { homeTeam, awayTeam, decision, player, minute } = data;
  const playerStr = player ? ` — ${player}` : '';
  const text = `📺 VAR DECISION (${minute}')${playerStr}\n${decision || 'Under review'}\n${homeTeam} vs ${awayTeam}\n\n#WC2026 #WorldCup2026 #VAR`;
  return { text, tags: ['WC2026', 'WorldCup2026', 'VAR'] };
}

// ─── Scheduled: pre-match posts at 09:00 UTC ─────────────────────────────────

async function postTodayMatches() {
  try {
    const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/today`, { timeout: 15000 });
    const matches = r.data?.matches || r.data?.response || [];
    if (!matches.length) return;

    for (const m of matches) {
      const homeTeam = m.teams?.home?.name || m.homeTeam;
      const awayTeam = m.teams?.away?.name || m.awayTeam;
      const kickoff  = m.fixture?.date || m.kickoff;
      const venue    = m.fixture?.venue?.name || m.venue;
      if (!homeTeam || !awayTeam) continue;

      const { text, tags } = preMatchPost(homeTeam, awayTeam, kickoff, venue);
      await createPost(text, { tags });
      await sleep(10000); // 10s between posts to avoid rate limits
    }
  } catch (e) {
    console.error('[Bluesky] pre-match post failed:', e.message);
  }
}

// ─── Express server ───────────────────────────────────────────────────────────

const app  = express();
app.use(express.json());

function requirePipelineSecret(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// moment-engine webhook — fires on every significant event
app.post('/trigger', requirePipelineSecret, async (req, res) => {
  const { eventType, ...data } = req.body;
  try {
    let content;
    switch (eventType) {
      case 'GOAL':
      case 'PENALTY_GOAL':
      case 'OWN_GOAL':
        content = goalPost(data);
        break;
      case 'RED_CARD':
      case 'SECOND_YELLOW':
        content = redCardPost(data);
        break;
      case 'MATCH_END':
        content = matchEndPost(data);
        break;
      case 'VAR':
        content = varPost(data);
        break;
      default:
        return res.json({ ok: true, skipped: true, reason: `event type ${eventType} not handled` });
    }

    const result = await createPost(content.text, { tags: content.tags });
    res.json({ ok: true, uri: result.uri });
  } catch (e) {
    console.error('[Bluesky /trigger]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/goal', requirePipelineSecret, async (req, res) => {
  try {
    const { text, tags } = goalPost(req.body);
    const result = await createPost(text, { tags });
    res.json({ ok: true, uri: result.uri });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/match-update', requirePipelineSecret, async (req, res) => {
  try {
    const { text, tags } = matchEndPost(req.body);
    const result = await createPost(text, { tags });
    res.json({ ok: true, uri: result.uri });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/prediction', requirePipelineSecret, async (req, res) => {
  try {
    const { match, prediction } = req.body;
    const { text, tags } = predictionPost(match, prediction);
    const result = await createPost(text, { tags });
    res.json({ ok: true, uri: result.uri });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/pre-match', requirePipelineSecret, async (req, res) => {
  try {
    const { homeTeam, awayTeam, kickoff, venue } = req.body;
    const { text, tags } = preMatchPost(homeTeam, awayTeam, kickoff, venue);
    const result = await createPost(text, { tags });
    res.json({ ok: true, uri: result.uri });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/custom', requirePipelineSecret, async (req, res) => {
  try {
    const { text, tags = [], links = [] } = req.body;
    if (!text) return res.status(400).json({ ok: false, error: 'text required' });
    const result = await createPost(text, { tags, links });
    res.json({ ok: true, uri: result.uri });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/status', async (req, res) => {
  const configured = !!(HANDLE && APP_PASSWORD);
  let authenticated = false;
  if (configured) {
    try { await getSession(); authenticated = true; } catch {}
  }
  res.json({
    ok: true,
    service: 'bluesky-engine',
    handle: HANDLE || 'not configured',
    configured,
    authenticated,
    postsThisSession: postCount
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function boot() {
  const PORT = process.env.BLUESKY_PORT || process.env.PORT || 3006;
  app.listen(PORT, () => console.log(`[Bluesky Engine] listening on :${PORT}`));

  // Authenticate on startup (so first post isn't slow)
  if (HANDLE && APP_PASSWORD) {
    try { await getSession(); } catch (e) { console.warn('[Bluesky] startup auth failed:', e.message); }
  } else {
    console.warn('[Bluesky] BLUESKY_HANDLE / BLUESKY_APP_PASSWORD not set — posts will fail');
  }

  // Daily pre-match posts at 09:00 UTC
  cron.schedule('0 9 * * *', () => {
    console.log('[Bluesky] posting today\'s match previews');
    postTodayMatches();
  });

  console.log('[Bluesky Engine] running\n  Pre-match posts: daily 09:00 UTC\n  Event triggers: via /trigger endpoint');
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
