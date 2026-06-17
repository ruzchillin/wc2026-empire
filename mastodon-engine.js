/**
 * WC 2026 Sports Empire — Mastodon / Fediverse Engine
 * Deploy on Railway.app as service "mastodon-engine"
 *
 * Posts to Mastodon via API v1. Target sports.social or any public instance.
 * Fediverse has 10M+ active users, heavy football community on sports.social.
 * Free, open, no algorithmic suppression.
 *
 * Required env vars:
 *   MASTODON_INSTANCE      — e.g. https://sports.social (or mastodon.social)
 *   MASTODON_ACCESS_TOKEN  — from Settings -> Development -> New Application
 *   PIPELINE_SECRET        — shared inter-service secret
 *
 * Endpoints:
 *   POST /trigger          — moment-engine webhook
 *   POST /post/custom      — post any text
 *   POST /post/pre-match   — pre-match preview
 *   GET  /status           — health
 */

'use strict';

require('dotenv').config();
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const INSTANCE        = (process.env.MASTODON_INSTANCE || 'https://mastodon.social').replace(/\/$/, '');
const ACCESS_TOKEN    = process.env.MASTODON_ACCESS_TOKEN || '';
const API_SERVER_URL  = process.env.API_SERVER_URL || 'http://localhost:3001';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';

let postCount = 0;

// ─── Core toot ────────────────────────────────────────────────────────────────

async function toot(status, { visibility = 'public', language = 'en', spoilerText = null } = {}) {
  if (!ACCESS_TOKEN) throw new Error('MASTODON_ACCESS_TOKEN not configured');

  const body = { status, visibility, language };
  if (spoilerText) body.spoiler_text = spoilerText;

  const r = await axios.post(
    `${INSTANCE}/api/v1/statuses`,
    body,
    {
      headers: {
        Authorization:  `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );

  postCount++;
  console.log(`[Mastodon] posted id:${r.data.id} — ${status.slice(0, 60)}…`);
  return r.data;
}

// ─── Content builders ─────────────────────────────────────────────────────────

function goalToot(data) {
  const { homeTeam, awayTeam, homeScore, awayScore, minute, player, team } = data;
  const scorer = player ? ` — ${player}` : '';
  return `⚽ GOAL! ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} (${minute}')${scorer}\n\n#WC2026 #WorldCup2026 #${homeTeam.replace(/\s/g,'')} #${awayTeam.replace(/\s/g,'')} #Football`;
}

function redCardToot(data) {
  const { homeTeam, awayTeam, homeScore, awayScore, minute, player, team } = data;
  const name = player ? ` ${player} (${team})` : '';
  return `🟥 RED CARD ${minute}'!${name}\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\n#WC2026 #WorldCup2026 #Football`;
}

function matchEndToot(data) {
  const { homeTeam, awayTeam, homeScore, awayScore, result } = data;
  const winner = result === 'home_win' ? homeTeam : result === 'away_win' ? awayTeam : null;
  const resultLine = winner ? `${winner} win!` : 'Draw!';
  return `🏁 FULL TIME\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n${resultLine}\n\n#WC2026 #WorldCup2026 #${homeTeam.replace(/\s/g,'')} #${awayTeam.replace(/\s/g,'')}`;
}

function varToot(data) {
  const { homeTeam, awayTeam, decision, player, minute } = data;
  const playerStr = player ? ` — ${player}` : '';
  return `📺 VAR (${minute}')${playerStr}: ${decision || 'Under review'}\n${homeTeam} vs ${awayTeam}\n\n#WC2026 #WorldCup2026 #VAR #Football`;
}

function predictionToot(match, prediction) {
  const { homeTeam, awayTeam } = match;
  const { homeWinPct, drawPct, awayWinPct, keyFactor } = prediction;
  return [
    `🤖 AI Match Analysis: ${homeTeam} vs ${awayTeam}`,
    ``,
    `${homeTeam} win: ${homeWinPct}%`,
    `Draw: ${drawPct}%`,
    `${awayTeam} win: ${awayWinPct}%`,
    keyFactor ? `\nKey: ${keyFactor}` : '',
    `\n#WC2026 #WorldCup2026 #AI #Football`
  ].join('\n');
}

function preMatchToot(homeTeam, awayTeam, kickoff, venue) {
  const time = new Date(kickoff).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `📅 MATCH DAY: ${homeTeam} 🆚 ${awayTeam}\nKick-off: ${time} UTC${venue ? ` @ ${venue}` : ''}\n\nFollow for live updates, goals & AI predictions!\n\n#WC2026 #WorldCup2026 #${homeTeam.replace(/\s/g,'')} #${awayTeam.replace(/\s/g,'')} #Football`;
}

// ─── Scheduled ────────────────────────────────────────────────────────────────

async function postTodayMatches() {
  try {
    const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/today`, { timeout: 15000 });
    const matches = r.data?.matches || r.data?.response || [];
    for (const m of matches) {
      const homeTeam = m.teams?.home?.name || m.homeTeam;
      const awayTeam = m.teams?.away?.name || m.awayTeam;
      const kickoff  = m.fixture?.date || m.kickoff;
      const venue    = m.fixture?.venue?.name || m.venue;
      if (!homeTeam || !awayTeam) continue;
      await toot(preMatchToot(homeTeam, awayTeam, kickoff, venue));
      await sleep(12000);
    }
  } catch (e) {
    console.error('[Mastodon] pre-match posts failed:', e.message);
  }
}

// ─── Express ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  try {
    let status;
    switch (eventType) {
      case 'GOAL':
      case 'PENALTY_GOAL':
      case 'OWN_GOAL':
        status = goalToot(data); break;
      case 'RED_CARD':
      case 'SECOND_YELLOW':
        status = redCardToot(data); break;
      case 'MATCH_END':
        status = matchEndToot(data); break;
      case 'VAR':
        status = varToot(data); break;
      default:
        return res.json({ ok: true, skipped: true });
    }
    const result = await toot(status);
    res.json({ ok: true, id: result.id, url: result.url });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/pre-match', auth, async (req, res) => {
  try {
    const { homeTeam, awayTeam, kickoff, venue } = req.body;
    const result = await toot(preMatchToot(homeTeam, awayTeam, kickoff, venue));
    res.json({ ok: true, id: result.id, url: result.url });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/prediction', auth, async (req, res) => {
  try {
    const { match, prediction } = req.body;
    const result = await toot(predictionToot(match, prediction));
    res.json({ ok: true, id: result.id, url: result.url });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/custom', auth, async (req, res) => {
  try {
    const { text, visibility = 'public', language = 'en' } = req.body;
    if (!text) return res.status(400).json({ ok: false, error: 'text required' });
    const result = await toot(text, { visibility, language });
    res.json({ ok: true, id: result.id, url: result.url });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/status', async (req, res) => {
  const configured = !!ACCESS_TOKEN;
  let authenticated = false;
  if (configured) {
    try {
      const r = await axios.get(`${INSTANCE}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }, timeout: 8000
      });
      authenticated = !!r.data?.id;
    } catch {}
  }
  res.json({
    ok: true,
    service: 'mastodon-engine',
    instance: INSTANCE,
    configured,
    authenticated,
    postsThisSession: postCount
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function boot() {
  const PORT = process.env.MASTODON_PORT || process.env.PORT || 3007;
  app.listen(PORT, () => console.log(`[Mastodon Engine] listening on :${PORT}`));

  if (!ACCESS_TOKEN) {
    console.warn('[Mastodon] MASTODON_ACCESS_TOKEN not set — posts will fail');
  }

  // Pre-match posts daily at 09:30 UTC (offset from Bluesky's 09:00)
  cron.schedule('30 9 * * *', postTodayMatches);

  console.log(`[Mastodon Engine] running\n  Instance: ${INSTANCE}\n  Pre-match: daily 09:30 UTC`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
