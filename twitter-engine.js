/**
 * WC 2026 Sports Empire — Twitter/X Engine
 * Deploy on Railway.app as service "twitter-engine"
 * Port: 3028
 *
 * Posts WC 2026 content to Twitter/X using the v2 API (free write tier).
 * Free tier: 1,500 tweets/month. Basic tier ($100/month): 50K tweets/month.
 * WC 2026 runs ~30 days with ~8 matches/day = ~240 match events.
 * At 3-4 tweets/event = ~900 tweets → comfortably within free tier.
 *
 * Auth: OAuth 1.0a (User Context) — required for posting tweets.
 * Read access NOT needed (free tier = write-only is fine).
 *
 * Required env vars:
 *   TWITTER_API_KEY           — Consumer Key (from developer.twitter.com)
 *   TWITTER_API_SECRET        — Consumer Secret
 *   TWITTER_ACCESS_TOKEN      — Access Token (your account)
 *   TWITTER_ACCESS_TOKEN_SECRET — Access Token Secret
 *   VERCEL_URL                — main site URL
 *   PIPELINE_SECRET           — shared inter-service secret
 *   GROQ_API_KEY              — for tweet text generation
 *
 * Twitter Developer Portal setup:
 *   1. developer.twitter.com → Projects & Apps → New App
 *   2. App Settings → User authentication settings → Enable OAuth 1.0a
 *      Permissions: Read and Write
 *      Type: Web App / Automated App or Bot
 *      Callback URL: https://yoursite.com (required field, doesn't matter)
 *   3. Keys and Tokens tab → copy all 4 values above
 *   4. Free tier allows posting, no reading. That's all we need.
 *
 * Strategy:
 *   - GOAL: immediate tweet with score + player + link
 *   - HAT_TRICK: celebratory thread (2 tweets)
 *   - RED_CARD: factual tweet
 *   - MATCH_END: result tweet + reply with analysis link
 *   - UPSET: shocked tweet — these go viral
 *   - PRE_MATCH: preview tweet at 8am UTC for day's matches
 *   - BREAKING_NEWS: news tweet from news-monitor trigger
 *
 * Install: npm install twitter-api-v2
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cron    = require('node-cron');
const axios   = require('axios');
const groqClient = require('./groq-client');

const TW_API_KEY      = process.env.TWITTER_API_KEY              || '';
const TW_API_SECRET   = process.env.TWITTER_API_SECRET           || '';
const TW_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN         || '';
const TW_ACCESS_SECRET= process.env.TWITTER_ACCESS_TOKEN_SECRET  || '';
const VERCEL_URL      = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';
const API_URL         = (process.env.API_SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');

const tweetLog   = [];
const tweetCount = { total: 0, byType: {} };

// Estimated monthly usage (free tier limit = 1500)
let monthlyCount = 0;
const MONTHLY_LIMIT = 1400; // leave 100 buffer

// ─── Twitter API v2 client ────────────────────────────────────────────────────

function getClient() {
  if (!TW_API_KEY) throw new Error('TWITTER_API_KEY not configured');
  try {
    const { TwitterApi } = require('twitter-api-v2');
    return new TwitterApi({
      appKey:            TW_API_KEY,
      appSecret:         TW_API_SECRET,
      accessToken:       TW_ACCESS_TOKEN,
      accessSecret:      TW_ACCESS_SECRET
    });
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') throw new Error('twitter-api-v2 not installed — run: npm install twitter-api-v2');
    throw e;
  }
}

// ─── Tweet text generator ─────────────────────────────────────────────────────

const MAX_TWEET = 280;

function buildHashtags(data) {
  const tags = ['#WC2026', '#WorldCup2026'];
  if (data.homeTeam) tags.push(`#${data.homeTeam.replace(/\s+/g, '')}`);
  if (data.awayTeam) tags.push(`#${data.awayTeam.replace(/\s+/g, '')}`);
  return tags.join(' ');
}

function clamp(text, maxLen) {
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1) + '…';
}

async function generateTweet(eventType, data) {
  const hashtags = buildHashtags(data);
  const link     = `${VERCEL_URL}`;

  // Default templates (instant, no API call needed)
  const defaults = {
    GOAL:         `⚽ GOAL! ${data.player || ''} scores for ${data.homeTeam}!\n\n${data.homeTeam} ${data.homeScore ?? 0}–${data.awayScore ?? 0} ${data.awayTeam} | ${data.minute}'\n\n${hashtags}\n${link}`,
    PENALTY_GOAL: `⚽ PENALTY! ${data.player || ''} converts!\n\n${data.homeTeam} ${data.homeScore ?? 0}–${data.awayScore ?? 0} ${data.awayTeam} | ${data.minute}'\n\n${hashtags}\n${link}`,
    OWN_GOAL:     `😬 Own goal by ${data.player || 'a player'}!\n\n${data.homeTeam} ${data.homeScore ?? 0}–${data.awayScore ?? 0} ${data.awayTeam} | ${data.minute}'\n\n${hashtags}\n${link}`,
    HAT_TRICK:    `🎩🎩🎩 HAT TRICK!! ${data.player || 'A player'} scores THREE at #WC2026!\n\n${data.homeTeam} ${data.homeScore ?? 0}–${data.awayScore ?? 0} ${data.awayTeam}\n\nAbsolutely incredible scenes!\n\n${hashtags}\n${link}`,
    RED_CARD:     `🟥 RED CARD! ${data.player || 'A player'} sent off (${data.minute}') | ${data.homeTeam} vs ${data.awayTeam}\n\n${hashtags}\n${link}`,
    MATCH_END:    `🏁 FT: ${data.homeTeam} ${data.homeScore ?? 0}–${data.awayScore ?? 0} ${data.awayTeam}\n\nFull stats & analysis 👇\n\n${hashtags}\n${link}`,
    UPSET:        `🚨 MASSIVE UPSET! ${data.homeTeam} ${data.homeScore ?? 0}–${data.awayScore ?? 0} ${data.awayTeam}\n\nNOBODY saw this coming! 😱🔥\n\n${hashtags}\n${link}`,
    ELIMINATION:  `💔 ${data.eliminatedTeam || data.awayTeam} are ELIMINATED from #WC2026\n\nTheir tournament is over.\n\n${hashtags}\n${link}`,
    PRE_MATCH:    `📅 TODAY at #WC2026: ${data.homeTeam} 🆚 ${data.awayTeam}\n\nKick-off: ${data.kickoffTime || 'Today'}\n\nAI predictions & live scores 👇\n${hashtags}\n${link}`,
    VAR_REVIEW:   `🖥️ VAR REVIEW | ${data.homeTeam} vs ${data.awayTeam} (${data.minute}')\n\n${hashtags}\n${link}`,
    RECORD:       `📊 RECORD BROKEN at #WC2026!\n\n${data.description || ''}\n\n${hashtags}\n${link}`
  };

  const defaultText = defaults[eventType] || `⚽ WC 2026 Update: ${data.homeTeam || ''} vs ${data.awayTeam || ''}\n${hashtags}\n${link}`;

  // For high-impact events, use Groq via budget guard for more engaging text
  if (['GOAL', 'HAT_TRICK', 'UPSET', 'ELIMINATION'].includes(eventType)) {
    try {
      const body = await groqClient.complete({
        engine:    'twitter-engine',
        eventType,
        messages:  [{ role: 'user', content: `Write a single tweet (MAX 200 chars, NOT counting hashtags and link) about this WC 2026 event: ${eventType} - ${JSON.stringify(data)}. Be punchy, emotional, use emojis. Just the text, no hashtags.` }],
        max_tokens:  80,
        temperature: 0.8,
      });
      if (body) {
        const tweet = clamp(`${body}\n\n${hashtags}\n${link}`, MAX_TWEET);
        return tweet;
      }
    } catch (_) {}
  }

  return clamp(defaultText, MAX_TWEET);
}

// ─── Tweet sender ─────────────────────────────────────────────────────────────

async function tweet(text, replyToId = null) {
  if (monthlyCount >= MONTHLY_LIMIT) {
    console.warn('[Twitter] monthly limit reached — skipping');
    return null;
  }

  const client = getClient();
  const rwClient = client.readWrite;

  const payload = { text };
  if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId };

  const r = await rwClient.v2.tweet(payload);
  const tweetId = r.data?.id;

  monthlyCount++;
  tweetCount.total++;
  console.log(`[Twitter] tweeted: ${tweetId} (${monthlyCount}/${MONTHLY_LIMIT} this month)`);
  return tweetId;
}

async function tweetThread(texts) {
  let replyToId = null;
  const ids = [];
  for (const text of texts) {
    const id = await tweet(clamp(text, MAX_TWEET), replyToId);
    if (!id) break;
    ids.push(id);
    replyToId = id;
    await new Promise(r => setTimeout(r, 2000));
  }
  return ids;
}

// ─── Event dispatcher ─────────────────────────────────────────────────────────

async function handleEvent(eventType, data) {
  tweetCount.byType[eventType] = (tweetCount.byType[eventType] || 0) + 1;

  // Hat trick = thread (2 tweets)
  if (eventType === 'HAT_TRICK') {
    const t1 = await generateTweet('HAT_TRICK', data);
    const link = `${VERCEL_URL}`;
    const t2 = clamp(`All the stats from this historic moment at #WC2026 👇\n${link}`, MAX_TWEET);
    const ids = await tweetThread([t1, t2]);
    const result = { ok: true, type: 'thread', ids };
    tweetLog.unshift({ eventType, ...result, timestamp: new Date().toISOString() });
    if (tweetLog.length > 200) tweetLog.length = 200;
    return result;
  }

  // Match end = tweet + reply with link
  if (eventType === 'MATCH_END') {
    const t1 = await generateTweet('MATCH_END', data);
    const analysisText = clamp(`Full match stats, AI analysis, and predictions for the next round 👇\n${VERCEL_URL}`, MAX_TWEET);
    const ids = await tweetThread([t1, analysisText]);
    const result = { ok: true, type: 'thread', ids };
    tweetLog.unshift({ eventType, ...result, timestamp: new Date().toISOString() });
    if (tweetLog.length > 200) tweetLog.length = 200;
    return result;
  }

  // All other events = single tweet
  const text = await generateTweet(eventType, data);
  const id   = await tweet(text);
  const result = { ok: !!id, id, text: text.slice(0, 80) };
  tweetLog.unshift({ eventType, ...result, timestamp: new Date().toISOString() });
  return result;
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

const HANDLED_EVENTS = ['GOAL','PENALTY_GOAL','OWN_GOAL','HAT_TRICK','RED_CARD','MATCH_END','UPSET','ELIMINATION','PRE_MATCH','VAR_REVIEW','RECORD','BREAKING_NEWS'];

app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  if (!HANDLED_EVENTS.includes(eventType)) return res.json({ ok: true, skipped: true });

  try {
    const result = await handleEvent(eventType, data);
    res.json({ ok: true, eventType, ...result });
  } catch (e) {
    console.error(`[Twitter] ${eventType} failed:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/tweet', auth, async (req, res) => {
  const { text, replyToId } = req.body;
  if (!text) return res.status(400).json({ ok: false, error: 'text required' });
  try {
    const id = await tweet(clamp(text, MAX_TWEET), replyToId);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/thread', auth, async (req, res) => {
  const { texts } = req.body;
  if (!Array.isArray(texts) || !texts.length) return res.status(400).json({ ok: false, error: 'texts array required' });
  try {
    const ids = await tweetThread(texts);
    res.json({ ok: true, ids });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/log', (req, res) => res.json({ ok: true, count: tweetLog.length, log: tweetLog.slice(0, 30) }));

app.get('/status', (req, res) => {
  res.json({
    ok:           true,
    service:      'twitter-engine',
    configured:   !!(TW_API_KEY && TW_ACCESS_TOKEN),
    monthlyCount,
    monthlyLimit: MONTHLY_LIMIT,
    remaining:    MONTHLY_LIMIT - monthlyCount,
    tweetCount
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function boot() {
  const PORT = process.env.TWITTER_PORT || process.env.PORT || 3028;
  app.listen(PORT, () => console.log(`[Twitter Engine] listening on :${PORT}`));

  if (!TW_API_KEY) {
    console.warn('[Twitter] credentials not set');
    console.warn('[Twitter] Setup: developer.twitter.com → App → Keys & Tokens');
  }

  // Reset monthly counter on 1st of each month
  cron.schedule('0 0 1 * *', () => {
    monthlyCount = 0;
    console.log('[Twitter] monthly tweet counter reset');
  });

  // Daily preview tweets at 08:00 UTC
  cron.schedule('0 8 * * *', async () => {
    try {
      const r = await axios.get(`${API_URL}/api/v1/matches/today`, { timeout: 15000 });
      const matches = r.data?.matches || r.data?.response || [];
      for (const match of matches.slice(0, 3)) {
        const data = {
          homeTeam:    match.teams?.home?.name || match.homeTeam,
          awayTeam:    match.teams?.away?.name || match.awayTeam,
          kickoffTime: match.fixture?.date ? new Date(match.fixture.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : ''
        };
        await handleEvent('PRE_MATCH', data).catch(e => console.error('[Twitter cron]', e.message));
        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (e) { console.error('[Twitter daily cron]', e.message); }
  });

  console.log(`[Twitter Engine] running on :${PORT} — free tier: ${MONTHLY_LIMIT}/month`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
