/**
 * WC 2026 Sports Empire — AI Engine
 * Deploy on Railway.app as service "ai-engine"
 *
 * This service owns all AI analysis generation. It:
 *   1. Listens for match events from moment-engine.js
 *   2. Fetches real team stats, H2H, odds from API-Football
 *   3. Builds structured prompts — no hardcoded numbers
 *   4. Calls Groq (free tier: 500K tokens/day)
 *   5. Caches results 6 hours in Redis
 *   6. Stores accuracy record in PostgreSQL
 *   7. Exposes HTTP API consumed by api-server.js
 *
 * Required env vars:
 *   GROQ_API_KEY, API_FOOTBALL_KEY, REDIS_URL, DATABASE_URL, PORT
 */

'use strict';

require('dotenv').config();
const express = require('express');
const groqClient = require('./groq-client');
const axios   = require('axios');
const { createClient } = require('redis');
const { Pool } = require('pg');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3002;
const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';

app.use(express.json());

function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

// ─── Groq ─────────────────────────────────────────────────────────────────────

const MODEL = 'llama3-70b-8192';

// Token budget tracking (500K/day free tier)
let tokenBudget = { used: 0, date: new Date().toDateString() };

function checkAndResetBudget() {
  const today = new Date().toDateString();
  if (tokenBudget.date !== today) { tokenBudget = { used: 0, date: today }; }
}

function recordTokens(n) {
  checkAndResetBudget();
  tokenBudget.used += n;
}

// ─── Redis ─────────────────────────────────────────────────────────────────────

let redis;
async function connectRedis() {
  if (!process.env.REDIS_URL) return;
  redis = createClient({ url: process.env.REDIS_URL });
  redis.on('error', e => console.error('[Redis]', e.message));
  await redis.connect();
}

async function cacheGet(key) {
  if (!redis) return null;
  try { return JSON.parse(await redis.get(key)); } catch { return null; }
}

async function cacheSet(key, val, ttl = 21600) {
  if (!redis) return;
  try { await redis.set(key, JSON.stringify(val), { EX: ttl }); } catch {}
}

// ─── PostgreSQL ────────────────────────────────────────────────────────────────

let db;
function connectDB() {
  if (!process.env.DATABASE_URL) return;
  db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

async function dbQuery(sql, params = []) {
  if (!db) return { rows: [] };
  try { return await db.query(sql, params); } catch (e) {
    console.error('[DB]', e.message);
    return { rows: [] };
  }
}

async function initSchema() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS predictions (
      id            SERIAL PRIMARY KEY,
      match_id      VARCHAR(50),
      home_team     VARCHAR(100),
      away_team     VARCHAR(100),
      prompt_hash   VARCHAR(64),
      prediction    JSONB,
      actual_result VARCHAR(20),
      correct       BOOLEAN,
      tokens_used   INT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS match_analyses (
      id          SERIAL PRIMARY KEY,
      match_id    VARCHAR(50),
      event_type  VARCHAR(50),
      content     TEXT,
      language    VARCHAR(10) DEFAULT 'en',
      tokens_used INT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ─── API-Football ──────────────────────────────────────────────────────────────

const AF_BASE   = 'https://v3.football.api-sports.io';
const AF_LEAGUE = 1;      // FIFA World Cup 2026 — confirm ID when released
const AF_SEASON = 2026;

async function afGet(endpoint, params = {}) {
  if (!process.env.API_FOOTBALL_KEY) {
    throw new Error('API_FOOTBALL_KEY not configured');
  }
  const cacheKey = `af:${endpoint}:${JSON.stringify(params)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const res = await axios.get(`${AF_BASE}${endpoint}`, {
    headers: {
      'x-rapidapi-key': process.env.API_FOOTBALL_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    },
    params: { league: AF_LEAGUE, season: AF_SEASON, ...params },
    timeout: 10000
  });

  const data = res.data?.response ?? [];
  await cacheSet(cacheKey, data, endpoint.includes('live') ? 60 : 600);
  return data;
}

// ─── Data gathering ────────────────────────────────────────────────────────────

async function gatherMatchContext(matchId) {
  const [fixtures, h2hData] = await Promise.allSettled([
    afGet('/fixtures', { id: matchId }),
    afGet('/fixtures', { id: matchId }) // placeholder — we need team IDs first
  ]);

  const fixture = fixtures.value?.[0];
  if (!fixture) throw new Error(`Match ${matchId} not found in API-Football`);

  const homeId = fixture.teams?.home?.id;
  const awayId = fixture.teams?.away?.id;

  // Fetch H2H and team stats in parallel
  const [h2h, homeStats, awayStats] = await Promise.allSettled([
    afGet('/fixtures/headtohead', { h2h: `${homeId}-${awayId}` }),
    afGet('/teams/statistics', { team: homeId }),
    afGet('/teams/statistics', { team: awayId })
  ]);

  return {
    fixture,
    homeTeam: fixture.teams?.home,
    awayTeam: fixture.teams?.away,
    h2hMatches: (h2h.value || []).slice(0, 5),
    homeStats:  homeStats.value?.[0] || null,
    awayStats:  awayStats.value?.[0] || null,
    score: { home: fixture.goals?.home, away: fixture.goals?.away },
    status: fixture.fixture?.status?.short,
    minute: fixture.fixture?.status?.elapsed
  };
}

function buildH2HSummary(matches) {
  if (!matches.length) return 'No previous World Cup meetings available.';
  return matches.map(m => {
    const d   = m.fixture?.date?.slice(0, 4) || '????';
    const hn  = m.teams?.home?.name;
    const an  = m.teams?.away?.name;
    const hg  = m.goals?.home ?? '?';
    const ag  = m.goals?.away ?? '?';
    const res = hg > ag ? `${hn} won` : hg < ag ? `${an} won` : 'Draw';
    return `${d}: ${hn} ${hg}-${ag} ${an} (${res})`;
  }).join('\n');
}

function buildStatsLine(stats) {
  if (!stats) return 'Statistics unavailable.';
  const f = stats.fixtures;
  if (!f) return 'No fixtures data.';
  const played = (f.played?.total || 0);
  const wins   = (f.wins?.total   || 0);
  const draws  = (f.draws?.total  || 0);
  const losses = (f.loses?.total  || 0);
  const gf     = stats.goals?.for?.total?.total || 0;
  const ga     = stats.goals?.against?.total?.total || 0;
  return `${played} played: ${wins}W ${draws}D ${losses}L | Goals: ${gf} for, ${ga} against`;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildPreMatchPrompt(ctx) {
  const { homeTeam, awayTeam, h2hMatches, homeStats, awayStats } = ctx;
  return `You are an expert football analyst covering the 2026 FIFA World Cup.

MATCH: ${homeTeam.name} vs ${awayTeam.name}
STAGE: ${ctx.fixture?.league?.round || 'Group Stage'}
VENUE: ${ctx.fixture?.fixture?.venue?.name || 'Unknown'}, ${ctx.fixture?.fixture?.venue?.city || ''}

HISTORICAL HEAD-TO-HEAD (World Cup only where available):
${buildH2HSummary(h2hMatches)}

${homeTeam.name.toUpperCase()} TOURNAMENT RECORD:
${buildStatsLine(homeStats)}

${awayTeam.name.toUpperCase()} TOURNAMENT RECORD:
${buildStatsLine(awayStats)}

Generate a JSON object with this exact structure:
{
  "homeWinPct": <integer, data-grounded estimate of probability home team wins in 90 mins>,
  "drawPct":    <integer>,
  "awayWinPct": <integer>,
  "homeGoalsExpected": <decimal, e.g. 1.3>,
  "awayGoalsExpected": <decimal>,
  "keyBattleground": "<the single tactical matchup that will decide this game, max 15 words>",
  "homeStrength": "<main attacking threat for home team, one sentence>",
  "awayStrength": "<main attacking threat for away team, one sentence>",
  "prediction": "<2-3 sentence match prediction grounded only in the data provided>",
  "predictedScore": "<e.g. 2-1>",
  "confidence": "<low|medium|high>",
  "dataQuality": "<good|limited|very-limited — reflects how much real data was available>"
}

STRICT RULES:
- homeWinPct + drawPct + awayWinPct MUST equal exactly 100
- Do NOT fabricate player names, injuries, or statistics not in the data above
- If data is limited, say so in confidence and dataQuality fields
- predictedScore must be consistent with expected goals
- Return ONLY valid JSON, no markdown, no commentary`;
}

function buildInMatchPrompt(ctx) {
  const { homeTeam, awayTeam, score, minute, fixture } = ctx;
  const events = fixture.events || [];
  const recentEvents = events.slice(-8).map(e =>
    `${e.time?.elapsed}' — ${e.team?.name}: ${e.type} (${e.detail}) — ${e.player?.name || ''}`
  ).join('\n');

  return `LIVE MATCH ANALYSIS — ${homeTeam.name} ${score.home ?? 0}-${score.away ?? 0} ${awayTeam.name} (${minute}')

RECENT EVENTS:
${recentEvents || 'No events yet'}

Analyse the current match situation and provide:
{
  "momentum": "<home|away|balanced — which team has momentum right now>",
  "nextGoalFavourite": "<home team name|away team name|too close to call>",
  "homeWinPct":    <integer, updated probability for home win>,
  "drawPct":       <integer>,
  "awayWinPct":    <integer>,
  "keyMoment":     "<the turning point so far, max 20 words>",
  "analysis":      "<2-3 sentences on current match state based on events shown>",
  "finalScorePrediction": "<e.g. 2-1>"
}

STRICT RULES: percentages sum to 100. Base analysis only on events shown. Return ONLY valid JSON.`;
}

function buildEliminationPrompt(teamName, opponentName, score) {
  return `Write an elimination analysis for ${teamName} who have just been knocked out of the 2026 World Cup by ${opponentName} (score: ${score}).

Return JSON:
{
  "headline":  "<punchy 8-word headline for the elimination>",
  "verdict":   "<2 sentence verdict on why they went out>",
  "topMoment": "<the defining moment of their tournament, max 20 words>",
  "legacy":    "<what this team's World Cup 2026 will be remembered for, 1 sentence>",
  "nextChance": "<earliest next major tournament for this nation, e.g. 'AFCON 2027', 'World Cup 2030'>",
  "managerVerdict": "<one line on the manager's performance>",
  "rating": <integer 1-10, tournament performance rating>
}

Return ONLY valid JSON.`;
}

function buildGoalAnalysisPrompt(ctx, goalEvent) {
  const scorer     = goalEvent?.player?.name || 'Unknown';
  const scorerTeam = goalEvent?.team?.name;
  const minute     = goalEvent?.time?.elapsed;
  const assist     = goalEvent?.assist?.name;
  const isOG       = goalEvent?.detail?.includes('Own Goal');
  const newScore   = `${ctx.score.home ?? 0}-${ctx.score.away ?? 0}`;

  return `GOAL ANALYSIS — World Cup 2026
Match: ${ctx.homeTeam.name} vs ${ctx.awayTeam.name}
Goal: ${isOG ? 'Own Goal by' : 'Scored by'} ${scorer} (${scorerTeam}) — ${minute}'${assist ? ` | Assist: ${assist}` : ''}
Score now: ${newScore}

Return JSON:
{
  "impact":      "<immediate impact of this goal on the match, 1 sentence>",
  "significance":"<what this goal means for the team's tournament, 1 sentence>",
  "momentType":  "<routine|important|crucial|decisive|historic>",
  "updatedHomeWinPct": <integer>,
  "updatedDrawPct":    <integer>,
  "updatedAwayWinPct": <integer>
}

Return ONLY valid JSON. Percentages must sum to 100.`;
}

// ─── Core AI call ──────────────────────────────────────────────────────────────

async function callGroq(prompt, matchId = null) {
  checkAndResetBudget();
  if (tokenBudget.used > 480000) {
    throw new Error(`Daily token budget nearly exhausted (${tokenBudget.used}/500000). Analysis paused until midnight UTC.`);
  }

  const hash = crypto.createHash('sha256').update(prompt).digest('hex');

  // Check if we already generated this exact analysis
  const { rows } = await dbQuery(
    'SELECT prediction FROM predictions WHERE prompt_hash = $1 AND created_at > NOW() - INTERVAL \'6 hours\'',
    [hash]
  );
  if (rows[0]) {
    console.log('[Groq] Cache hit for prompt hash', hash.slice(0, 8));
    return rows[0].prediction;
  }

  const raw    = await groqClient.complete({ engine: 'ai-engine', eventType: 'PREDICTION', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 600, response_format: { type: 'json_object' } });
  recordTokens(0); // actual tokens tracked by groq-budget-guard
  const parsed = JSON.parse(raw || '{}');

  if (matchId) {
    await dbQuery(
      'INSERT INTO predictions (match_id, prompt_hash, prediction, tokens_used) VALUES ($1, $2, $3, $4)',
      [matchId, hash, JSON.stringify(parsed), tokens]
    );
  }

  return parsed;
}

// ─── HTTP API ──────────────────────────────────────────────────────────────────

// Pre-match prediction
app.post('/analyse/pre-match', async (req, res) => {
  const { matchId } = req.body;
  if (!matchId) return res.status(400).json({ ok: false, error: 'matchId required' });

  const cacheKey = `analysis:pre:${matchId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ ok: true, cached: true, matchId, analysis: cached });

  try {
    const ctx      = await gatherMatchContext(matchId);
    const prompt   = buildPreMatchPrompt(ctx);
    const analysis = await callGroq(prompt, matchId);

    await cacheSet(cacheKey, analysis, 21600); // 6 hours
    res.json({ ok: true, cached: false, matchId, analysis,
      meta: { homeTeam: ctx.homeTeam.name, awayTeam: ctx.awayTeam.name }
    });
  } catch (e) {
    console.error('[/analyse/pre-match]', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// In-match live analysis
app.post('/analyse/live', async (req, res) => {
  const { matchId } = req.body;
  if (!matchId) return res.status(400).json({ ok: false, error: 'matchId required' });

  try {
    const ctx    = await gatherMatchContext(matchId);
    const prompt = buildInMatchPrompt(ctx);
    // In-match: shorter cache (10 min)
    const cacheKey = `analysis:live:${matchId}:${ctx.minute}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ ok: true, cached: true, matchId, analysis: cached });

    const analysis = await callGroq(prompt, matchId);
    await cacheSet(cacheKey, analysis, 600);
    res.json({ ok: true, cached: false, matchId, analysis });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Elimination verdict
app.post('/analyse/elimination', async (req, res) => {
  const { teamName, opponentName, score, matchId } = req.body;
  if (!teamName || !opponentName || !score) {
    return res.status(400).json({ ok: false, error: 'teamName, opponentName, score required' });
  }

  const cacheKey = `analysis:elim:${teamName.replace(/\s/g, '_')}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ ok: true, cached: true, analysis: cached });

  try {
    const prompt   = buildEliminationPrompt(teamName, opponentName, score);
    const analysis = await callGroq(prompt, matchId);
    await cacheSet(cacheKey, analysis, 604800); // 7 days
    res.json({ ok: true, cached: false, teamName, analysis });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Goal analysis
app.post('/analyse/goal', async (req, res) => {
  const { matchId, goalEvent } = req.body;
  if (!matchId || !goalEvent) return res.status(400).json({ ok: false, error: 'matchId and goalEvent required' });

  try {
    const ctx      = await gatherMatchContext(matchId);
    const prompt   = buildGoalAnalysisPrompt(ctx, goalEvent);
    const analysis = await callGroq(prompt, matchId);
    res.json({ ok: true, matchId, analysis });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Token budget status
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'ai-engine', uptime: process.uptime(), ts: Date.now() });
});

app.get('/status', (req, res) => {
  checkAndResetBudget();
  res.json({
    ok: true,
    service: 'ai-engine',
    model: MODEL,
    tokenBudget: {
      used: tokenBudget.used,
      limit: 500000,
      remaining: 500000 - tokenBudget.used,
      resetAt: 'midnight UTC',
      percentUsed: ((tokenBudget.used / 500000) * 100).toFixed(1)
    },
    uptime: process.uptime()
  });
});

// Accuracy leaderboard
app.get('/accuracy', async (req, res) => {
  const { rows } = await dbQuery(`
    SELECT
      COUNT(*)                                              AS total_predictions,
      SUM(CASE WHEN correct = true THEN 1 ELSE 0 END)      AS correct,
      SUM(CASE WHEN correct = false THEN 1 ELSE 0 END)     AS incorrect,
      SUM(CASE WHEN correct IS NULL THEN 1 ELSE 0 END)     AS pending,
      AVG(tokens_used)                                     AS avg_tokens
    FROM predictions
  `);
  const s = rows[0] || {};
  const total = parseInt(s.total_predictions || 0);
  const correct = parseInt(s.correct || 0);
  res.json({
    ok: true,
    accuracy: total > 0 ? ((correct / total) * 100).toFixed(1) + '%' : 'No results yet',
    total, correct,
    incorrect: parseInt(s.incorrect || 0),
    pending: parseInt(s.pending || 0),
    avgTokensPerPrediction: Math.round(s.avg_tokens || 0)
  });
});

// Update prediction result (called when match ends)
app.patch('/predictions/:matchId/result', async (req, res) => {
  const { result } = req.body; // 'home_win' | 'draw' | 'away_win'
  if (!result) return res.status(400).json({ ok: false, error: 'result required' });

  const { rows } = await dbQuery(
    'SELECT * FROM predictions WHERE match_id = $1 ORDER BY created_at DESC LIMIT 1',
    [req.params.matchId]
  );

  if (!rows[0]) return res.status(404).json({ ok: false, error: 'Prediction not found' });

  const pred     = rows[0].prediction;
  const homeWin  = pred.homeWinPct > pred.awayWinPct && pred.homeWinPct > pred.drawPct;
  const awayWin  = pred.awayWinPct > pred.homeWinPct && pred.awayWinPct > pred.drawPct;
  const drawPred = pred.drawPct > pred.homeWinPct && pred.drawPct > pred.awayWinPct;

  const correct =
    (result === 'home_win' && homeWin) ||
    (result === 'away_win' && awayWin) ||
    (result === 'draw'     && drawPred);

  await dbQuery(
    'UPDATE predictions SET actual_result = $1, correct = $2 WHERE match_id = $3',
    [result, correct, req.params.matchId]
  );

  res.json({ ok: true, correct, predicted: homeWin ? 'home_win' : awayWin ? 'away_win' : 'draw', actual: result });
});

// ─── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  await connectRedis();
  connectDB();
  await initSchema();

  app.listen(PORT, () => {
    console.log(`[AI Engine] listening on :${PORT}`);
    if (!process.env.GROQ_API_KEY)      console.warn('[Config] GROQ_API_KEY not set');
    if (!process.env.API_FOOTBALL_KEY)  console.warn('[Config] API_FOOTBALL_KEY not set');
  });
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
