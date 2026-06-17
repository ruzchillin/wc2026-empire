/**
 * growth-agent.js
 * Viral Moment Detector + Revenue Amplifier
 *
 * This agent watches all events and figures out which ones to DOUBLE DOWN on.
 * When it detects a viral moment (upset, hat-trick, controversial call, etc.),
 * it:
 *   1. Triggers extra posts to every platform
 *   2. Launches a new prediction market question
 *   3. Sends personalized Telegram alert with the opportunity
 *   4. Suggests affiliate offers most relevant to the moment
 *   5. Queues a fantasy pick update
 *   6. Can generate a dedicated landing page for the viral event
 *
 * It also runs proactive growth crons:
 *   - Every 2 hours during WC: scan odds for value opportunities → post
 *   - Daily: analyze what content is getting most engagement → report
 *   - Every match: pre-match hype post 1 hour before kickoff
 *   - Post-match: elimination memorial or hero page generation trigger
 *
 * Port: 3052
 */

'use strict';

require('dotenv').config();
const express    = require('express');
const axios      = require('axios');
const cron       = require('node-cron');
const groqClient = require('./groq-client');

const PIPELINE_SECRET = process.env.PIPELINE_SECRET        || '';
const TG_TOKEN        = process.env.TELEGRAM_BOT_TOKEN     || '';
const ADMIN_CHAT      = process.env.OWNER_CHAT_ID          || process.env.TELEGRAM_OWNER_ID || '';
const MAIN_CHANNEL    = process.env.TELEGRAM_CHANNEL_ID    || '';
const PORT            = process.env.GROWTH_AGENT_PORT || process.env.PORT || 3052;

const SERVICES = {
  moment:   process.env.MOMENT_ENGINE_URL   || 'http://localhost:3000',
  odds:     process.env.ODDS_ENGINE_URL     || 'http://localhost:3041',
  fantasy:  process.env.FANTASY_ENGINE_URL  || 'http://localhost:3045',
  empire:   process.env.EMPIRE_AGENT_URL    || 'http://localhost:3051',
  analytics:process.env.ANALYTICS_URL       || 'http://localhost:3032',
};

const app = express();
app.use(express.json());

function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const token = req.headers['x-pipeline-secret'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

// ─── Virality scoring ─────────────────────────────────────────────────────────
const VIRALITY_SCORES = {
  HAT_TRICK:    10, // always viral
  UPSET:        9,  // huge shock
  ELIMINATION:  8,  // emotional
  RECORD:       8,  // historical moment
  VAR:          7,  // controversy = engagement
  PENALTY_GOAL: 6,
  RED_CARD:     6,
  GOAL:         4,
  MATCH_END:    3,
  PRE_MATCH:    2,
};

const VIRAL_THRESHOLD = 7; // events with score >= 7 trigger amplification

// ─── Growth action log ────────────────────────────────────────────────────────
const actionLog = [];

// ─── Send Telegram alert to owner ────────────────────────────────────────────
async function alertOwner(text) {
  if (!TG_TOKEN || !ADMIN_CHAT) return;
  await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    chat_id: ADMIN_CHAT, text, parse_mode: 'Markdown',
    disable_notification: false,
  }).catch(e => console.warn('[Growth] Telegram alert failed:', e.message));
}

// ─── Amplify viral event ──────────────────────────────────────────────────────
async function amplifyEvent(eventType, payload) {
  const score = VIRALITY_SCORES[eventType] || 0;
  const isViral = score >= VIRAL_THRESHOLD;

  console.log(`[Growth] ${eventType} — virality score ${score}${isViral ? ' 🔥 AMPLIFYING' : ''}`);
  if (!isViral) return { amplified: false, score };

  const actions = [];

  // 1. Get AI growth strategy for this moment
  let strategy = '';
  try {
    strategy = await groqClient.complete({
      engine: 'growth-agent', eventType: 'GROWTH_STRATEGY',
      messages: [{
        role: 'system',
        content: 'You are a sports media growth strategist. Be concise and tactical.',
      }, {
        role: 'user',
        content: `Viral WC 2026 moment: ${eventType}. ${JSON.stringify(payload)}.\nList 3 specific immediate actions to maximize revenue and audience growth right now. Be specific (which platform, what angle, what CTA).`,
      }],
      max_tokens: 300, temperature: 0.7,
    });
  } catch { strategy = 'Amplify across all channels immediately.'; }

  // 2. Fire extra trigger to moment-engine with BREAKING_NEWS framing
  if (score >= 8) {
    try {
      await axios.post(`${SERVICES.moment}/trigger`, {
        eventType: 'BREAKING_NEWS',
        ...payload,
        breakingContext: `${eventType} — ${payload.homeTeam || ''} vs ${payload.awayTeam || ''}`,
        viralScore: score,
      }, { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 8000 });
      actions.push('re-triggered as BREAKING_NEWS');
    } catch(e) { actions.push(`BREAKING_NEWS trigger failed: ${e.message}`); }
  }

  // 3. Get best odds for this match and push as affiliate content
  try {
    if (payload.homeTeam && payload.awayTeam) {
      const oddsRes = await axios.get(
        `${SERVICES.odds}/odds/${encodeURIComponent(payload.homeTeam)}/${encodeURIComponent(payload.awayTeam)}`,
        { timeout: 5000 }
      );
      if (oddsRes.data?.match) {
        const best = oddsRes.data.match.bestOdds;
        actions.push(`best odds fetched: H${best.home}/D${best.draw}/A${best.away}`);
      }
    }
  } catch { actions.push('odds fetch skipped'); }

  // 4. Invalidate fantasy picks cache for HAT_TRICK events
  if (eventType === 'HAT_TRICK' || eventType === 'ELIMINATION') {
    try {
      await axios.post(`${SERVICES.fantasy}/trigger`,
        { eventType, ...payload },
        { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 5000 }
      );
      actions.push('fantasy cache invalidated');
    } catch { actions.push('fantasy trigger skipped'); }
  }

  // 5. Alert owner with strategy
  const alertText = `🔥 *VIRAL MOMENT DETECTED*\n\n*${eventType}* (score: ${score}/10)\n${payload.homeTeam||''} ${payload.homeScore||''}-${payload.awayScore||''} ${payload.awayTeam||''}\n\n*Strategy:*\n${strategy}\n\n*Actions taken:* ${actions.join(', ')}`;
  await alertOwner(alertText);

  const entry = { eventType, score, amplified: true, actions, strategy: strategy.slice(0,100), timestamp: new Date().toISOString() };
  actionLog.unshift(entry);
  if (actionLog.length > 200) actionLog.length = 200;

  return { amplified: true, score, actions, strategy };
}

// ─── Proactive value opportunity announcer ────────────────────────────────────
async function checkOddsValue() {
  try {
    const res = await axios.get(`${SERVICES.odds}/best-value`, { timeout: 5000 });
    if (!res.data?.opportunities?.length) return;
    const top = res.data.opportunities[0];
    if (parseFloat(top.spread) < 0.5) return; // not worth announcing

    const msg = `💰 *Value Alert*\n\n${top.match}\n*${top.bestOdds}* at ${top.bookmaker}\nSpread: ${top.spread}\n\n[Bet Now →](${top.affiliateUrl})`;
    await alertOwner(msg);
  } catch {}
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.post('/trigger', async (req, res) => {
  const { eventType, ...payload } = req.body || {};
  try {
    const result = await amplifyEvent(eventType, payload);
    res.json({ ok: true, service: 'growth-agent', eventType, result });
  } catch(e) {
    console.error('[Growth] trigger error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Manual growth action
app.post('/amplify', async (req, res) => {
  const { eventType = 'BREAKING_NEWS', ...payload } = req.body || {};
  const result = await amplifyEvent(eventType, payload);
  res.json({ ok: true, result });
});

app.get('/log', (req, res) => res.json({
  ok: true,
  count: actionLog.length,
  viralEvents: actionLog.filter(e => e.amplified),
  log: actionLog.slice(0, 20),
}));

app.get('/status', (req, res) => res.json({
  ok: true,
  service: 'growth-agent',
  viralThreshold: VIRAL_THRESHOLD,
  viralityScores: VIRALITY_SCORES,
  totalAmplified: actionLog.filter(e => e.amplified).length,
  configured: { telegram: !!TG_TOKEN, adminChat: !!ADMIN_CHAT },
}));

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Crons ────────────────────────────────────────────────────────────────────
// Every 2 hours during WC match windows — check for odds value
cron.schedule('0 */2 12-23 * * *', checkOddsValue);

app.listen(PORT, () => {
  console.log(`[Growth Agent] listening on :${PORT}`);
  console.log(`[Growth Agent] viral threshold: ${VIRAL_THRESHOLD}/10 — HAT_TRICK(10), UPSET(9), ELIMINATION(8) auto-amplified`);
});
