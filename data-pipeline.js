/**
 * WC 2026 Sports Empire — Data Pipeline
 * Deploy on Railway.app as service "data-pipeline"
 *
 * Responsibilities:
 *   1. Poll API-Football every 60s for live match events
 *   2. Detect new goals, red cards, VAR, substitutions
 *   3. Fire moment-engine actions for each event type
 *   4. Call ai-engine for AI analysis on significant events
 *   5. Store all events to PostgreSQL
 *   6. Broadcast updates to connected dashboards via api-server WebSocket
 *   7. Mark predictions correct/incorrect when matches end
 *
 * Required env vars:
 *   API_FOOTBALL_KEY, REDIS_URL, DATABASE_URL
 *   API_SERVER_URL       — e.g. https://api-server-xxx.railway.app
 *   AI_ENGINE_URL        — e.g. https://ai-engine-xxx.railway.app
 *   MOMENT_ENGINE_URL    — e.g. https://moment-engine-xxx.railway.app
 *   PIPELINE_SECRET      — shared secret for inter-service calls
 */

'use strict';

require('dotenv').config();
const axios    = require('axios');
const cron     = require('node-cron');
const express  = require('express');
const { createClient } = require('redis');
const { Pool } = require('pg');

const AF_BASE   = 'https://v3.football.api-sports.io';
const AF_KEY    = process.env.API_FOOTBALL_KEY;
const AF_LEAGUE = 1;    // Update when FIFA WC 2026 ID is confirmed on api-sports.io
const AF_SEASON = 2026;

// Service URLs (set these in Railway env vars after deploying each service)
const API_SERVER_URL     = process.env.API_SERVER_URL     || 'http://localhost:3001';
const AI_ENGINE_URL      = process.env.AI_ENGINE_URL      || 'http://localhost:3002';
const MOMENT_ENGINE_URL  = process.env.MOMENT_ENGINE_URL  || 'http://localhost:3003';
const PIPELINE_SECRET    = process.env.PIPELINE_SECRET    || '';

// ─── Redis ─────────────────────────────────────────────────────────────────────

let redis;
async function connectRedis() {
  if (!process.env.REDIS_URL) {
    console.warn('[Redis] Not configured — state tracking will restart on every deploy');
    return;
  }
  redis = createClient({ url: process.env.REDIS_URL });
  redis.on('error', e => console.error('[Redis]', e.message));
  await redis.connect();
  console.log('[Redis] connected');
}

async function redisGet(key) {
  if (!redis) return null;
  try { return await redis.get(key); } catch { return null; }
}

async function redisSet(key, val, ttl = 86400) {
  if (!redis) return;
  try { await redis.set(key, String(val), { EX: ttl }); } catch {}
}

// ─── PostgreSQL ────────────────────────────────────────────────────────────────

let db;
function connectDB() {
  if (!process.env.DATABASE_URL) {
    console.warn('[DB] Not configured — events won\'t persist');
    return;
  }
  db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  db.on('error', e => console.error('[DB]', e.message));
}

async function dbQuery(sql, params = []) {
  if (!db) return { rows: [] };
  try { return await db.query(sql, params); } catch (e) {
    console.error('[DB query]', e.message);
    return { rows: [] };
  }
}

async function initSchema() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS pipeline_state (
      match_id        VARCHAR(50) PRIMARY KEY,
      last_event_id   VARCHAR(100),
      home_score      INT DEFAULT 0,
      away_score      INT DEFAULT 0,
      status          VARCHAR(20),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS processed_events (
      event_key  VARCHAR(200) PRIMARY KEY,
      processed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[DB] schema ready');
}

// ─── API-Football ──────────────────────────────────────────────────────────────

async function afGet(endpoint, params = {}) {
  if (!AF_KEY) throw new Error('API_FOOTBALL_KEY not set');
  const res = await axios.get(`${AF_BASE}${endpoint}`, {
    headers: {
      'x-rapidapi-key': AF_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    },
    params: { league: AF_LEAGUE, season: AF_SEASON, ...params },
    timeout: 15000
  });
  return res.data?.response ?? [];
}

// ─── Event deduplication ───────────────────────────────────────────────────────

async function isProcessed(eventKey) {
  // Check Redis first (fast)
  const inRedis = await redisGet(`processed:${eventKey}`);
  if (inRedis) return true;
  // Then DB (persistent across restarts)
  const { rows } = await dbQuery(
    'SELECT 1 FROM processed_events WHERE event_key = $1', [eventKey]
  );
  return rows.length > 0;
}

async function markProcessed(eventKey) {
  await redisSet(`processed:${eventKey}`, '1', 86400);
  await dbQuery(
    'INSERT INTO processed_events (event_key) VALUES ($1) ON CONFLICT DO NOTHING',
    [eventKey]
  );
}

// ─── Inter-service calls ───────────────────────────────────────────────────────

const serviceHeaders = { 'x-pipeline-secret': PIPELINE_SECRET, 'Content-Type': 'application/json' };

async function callMomentEngine(eventType, payload) {
  try {
    await axios.post(`${MOMENT_ENGINE_URL}/trigger`, { eventType, ...payload }, {
      headers: serviceHeaders, timeout: 30000
    });
    console.log(`[MomentEngine] triggered ${eventType} for match ${payload.matchId}`);
  } catch (e) {
    console.error(`[MomentEngine] failed: ${e.message}`);
    // Log failure to api-server so dashboard shows it
    await logEvent('MOMENT_ENGINE_ERROR', payload.matchId, null,
      { eventType, error: e.message });
  }
}

async function callAIEngine(endpoint, payload) {
  try {
    const r = await axios.post(`${AI_ENGINE_URL}${endpoint}`, payload, {
      headers: serviceHeaders, timeout: 60000
    });
    return r.data;
  } catch (e) {
    console.error(`[AIEngine ${endpoint}] failed: ${e.message}`);
    return null;
  }
}

async function logEvent(type, matchId, team, detail) {
  try {
    await axios.post(`${API_SERVER_URL}/api/v1/events`,
      { type, match_id: matchId, team, detail },
      { headers: serviceHeaders, timeout: 5000 }
    );
  } catch (e) {
    console.error('[logEvent]', e.message);
  }
}

// ─── Event classifier ──────────────────────────────────────────────────────────

function classifyEvent(event) {
  const type   = event.type?.toLowerCase();
  const detail = event.detail?.toLowerCase() || '';

  if (type === 'goal') {
    if (detail.includes('own goal'))      return 'OWN_GOAL';
    if (detail.includes('penalty'))       return 'PENALTY_GOAL';
    return 'GOAL';
  }
  if (type === 'card') {
    if (detail.includes('red card'))      return 'RED_CARD';
    if (detail.includes('yellow card'))   return 'YELLOW_CARD';
    if (detail.includes('second yellow')) return 'SECOND_YELLOW';
    return 'CARD';
  }
  if (type === 'var')                     return 'VAR';
  if (type === 'subst')                   return 'SUBSTITUTION';
  if (type === 'missed penalty' || detail.includes('missed penalty')) return 'MISSED_PENALTY';
  return 'UNKNOWN';
}

// ─── Match event processor ────────────────────────────────────────────────────

async function processMatchEvents(fixture) {
  const matchId   = String(fixture.fixture?.id);
  const homeTeam  = fixture.teams?.home?.name;
  const awayTeam  = fixture.teams?.away?.name;
  const homeScore = fixture.goals?.home ?? 0;
  const awayScore = fixture.goals?.away ?? 0;
  const status    = fixture.fixture?.status?.short;
  const minute    = fixture.fixture?.status?.elapsed;
  const events    = fixture.events || [];

  // Load previous state
  const { rows: stateRows } = await dbQuery(
    'SELECT home_score, away_score, status FROM pipeline_state WHERE match_id = $1',
    [matchId]
  );
  const prevState = stateRows[0];
  const prevHome  = prevState?.home_score ?? -1;
  const prevAway  = prevState?.away_score ?? -1;
  const prevStatus = prevState?.status;

  // Process each event
  for (const event of events) {
    const eventKey  = `${matchId}:${event.time?.elapsed}:${event.type}:${event.player?.id || event.team?.id}`;
    if (await isProcessed(eventKey)) continue;

    const eventType = classifyEvent(event);
    const eventTeam = event.team?.name;

    console.log(`[Event] ${matchId} ${minute}' — ${eventType} — ${eventTeam} — ${event.player?.name || ''}`);

    const payload = {
      matchId,
      homeTeam, awayTeam, homeScore, awayScore,
      minute,
      team: eventTeam,
      player: event.player?.name,
      assist: event.assist?.name,
      detail: event.detail,
      rawEvent: event
    };

    // Trigger moment-engine for significant events
    if (['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'RED_CARD', 'SECOND_YELLOW', 'MISSED_PENALTY', 'VAR'].includes(eventType)) {
      await callMomentEngine(eventType, payload);

      // Request AI analysis for goals and red cards
      if (['GOAL', 'PENALTY_GOAL', 'RED_CARD'].includes(eventType)) {
        const endpoint = eventType.includes('GOAL') ? '/analyse/goal' : '/analyse/live';
        callAIEngine(endpoint, { matchId, goalEvent: event }) // fire-and-forget
          .then(result => {
            if (result?.ok) console.log(`[AI] analysis complete for ${matchId} ${eventType}`);
          });
      }

      // VAR: log to VAR tracker
      if (eventType === 'VAR') {
        await logEvent('VAR', matchId, eventTeam, {
          decision: event.detail,
          player: event.player?.name,
          minute,
          homeTeam, awayTeam
        });
      }
    }

    await logEvent(eventType, matchId, eventTeam, payload);
    await markProcessed(eventKey);
  }

  // Detect match status transitions
  if (status !== prevStatus) {
    if (status === 'FT') {
      console.log(`[Pipeline] Match ${matchId} FT: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`);

      // Determine result and update AI accuracy
      const result = homeScore > awayScore ? 'home_win' : awayScore > homeScore ? 'away_win' : 'draw';
      callAIEngine(`/predictions/${matchId}/result`, { result });

      await callMomentEngine('MATCH_END', {
        matchId, homeTeam, awayTeam, homeScore, awayScore, result
      });

      await logEvent('MATCH_END', matchId, null, {
        homeTeam, awayTeam, homeScore, awayScore, result, status: 'FT'
      });
    }

    if (['R16', 'QF', 'SF', 'F'].some(r => status?.includes(r)) && status !== prevStatus) {
      console.log(`[Pipeline] Knockout match detected: ${matchId}`);
    }
  }

  // Update pipeline state
  await dbQuery(`
    INSERT INTO pipeline_state (match_id, home_score, away_score, status, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (match_id)
    DO UPDATE SET home_score = $2, away_score = $3, status = $4, updated_at = NOW()
  `, [matchId, homeScore, awayScore, status]);
}

// ─── Main poll loop ────────────────────────────────────────────────────────────

let isPolling = false;

async function pollLiveMatches() {
  if (isPolling) {
    console.log('[Pipeline] Previous poll still running — skipping');
    return;
  }
  isPolling = true;

  try {
    if (!AF_KEY) {
      console.warn('[Pipeline] API_FOOTBALL_KEY not set — skipping poll');
      return;
    }

    const liveFixtures = await afGet('/fixtures', { live: 'all' });

    if (!liveFixtures.length) {
      // No live matches — check if any start today
      const today = new Date().toISOString().split('T')[0];
      const todayFixtures = await afGet('/fixtures', { date: today });
      const upcoming = todayFixtures.filter(f =>
        ['NS', 'TBD'].includes(f.fixture?.status?.short)
      );
      if (upcoming.length) {
        console.log(`[Pipeline] ${upcoming.length} match(es) scheduled today. Next: ${upcoming[0]?.fixture?.date}`);
      }
      return;
    }

    console.log(`[Pipeline] ${liveFixtures.length} live match(es)`);
    await Promise.all(liveFixtures.map(f => processMatchEvents(f)));

  } catch (e) {
    console.error('[Pipeline] Poll error:', e.message);
    await logEvent('PIPELINE_ERROR', null, null, { error: e.message, ts: new Date().toISOString() });
  } finally {
    isPolling = false;
  }
}

// Daily pre-match AI generation (run 2 hours before kick-off)
async function generatePreMatchAnalysis() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayFixtures = await afGet('/fixtures', { date: today });
    const notStarted = todayFixtures.filter(f => f.fixture?.status?.short === 'NS');

    console.log(`[PreMatch] Generating AI analysis for ${notStarted.length} today's match(es)`);

    for (const f of notStarted) {
      const matchId = String(f.fixture?.id);
      callAIEngine('/analyse/pre-match', { matchId })
        .then(r => {
          if (r?.ok) console.log(`[PreMatch] Analysis ready for ${matchId}`);
        });
      // Stagger calls to respect Groq rate limits
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (e) {
    console.error('[PreMatch] Error:', e.message);
  }
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  console.log('[Data Pipeline] starting...');
  await connectRedis();
  connectDB();
  await initSchema();

  // Poll every 60 seconds for live match events
  cron.schedule('* * * * *', pollLiveMatches);

  // Generate pre-match AI analysis at 10:00 UTC daily
  cron.schedule('0 10 * * *', generatePreMatchAnalysis);

  // Initial poll after 5s startup delay
  setTimeout(pollLiveMatches, 5000);

  // ── Minimal HTTP server (Railway needs /health to mark service healthy) ──────
  const app  = express();
  const PORT = process.env.PORT || 3004;
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'data-pipeline', uptime: process.uptime() }));
  app.get('/status', (_req, res) => res.json({
    ok:          true,
    service:     'data-pipeline',
    uptime:      process.uptime(),
    afKeySet:    !!AF_KEY,
    momentUrl:   MOMENT_ENGINE_URL,
    aiUrl:       AI_ENGINE_URL,
    apiUrl:      API_SERVER_URL,
    ts:          Date.now(),
  }));
  // POST /trigger — manual poll kick (used by monitor-bot or admin)
  app.post('/trigger', (_req, res) => {
    pollLiveMatches().catch(e => console.error('[Trigger] poll error:', e));
    res.json({ ok: true, triggered: 'pollLiveMatches' });
  });
  app.listen(PORT, () => console.log(`[Data Pipeline] HTTP server on :${PORT}`));

  console.log(`[Data Pipeline] running
  - Live match polling: every 60 seconds
  - Pre-match AI: daily at 10:00 UTC
  - Moment engine: ${MOMENT_ENGINE_URL}
  - AI engine:     ${AI_ENGINE_URL}
  - API server:    ${API_SERVER_URL}
  `);

  if (!AF_KEY) console.warn('[Config] API_FOOTBALL_KEY not set — polling is disabled');
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
