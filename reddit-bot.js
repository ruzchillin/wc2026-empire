/**
 * WC 2026 Sports Empire — Reddit Bot
 * Deploy on Railway.app as service "reddit-bot"
 *
 * Posts WC 2026 content to Reddit using snoowrap (official Reddit API wrapper).
 * Targets: r/worldcup, r/soccer, r/football, r/fifaworldcup
 *
 * Reddit rate limits:
 *   - 1 post per subreddit per 10 minutes (enforced here)
 *   - Karma gate: new accounts can't post to large subs immediately
 *   - Solution: warm account with comments first, then enable posting
 *
 * Post strategies:
 *   1. GOAL/HAT_TRICK   → link post to our match page (drives traffic)
 *   2. MATCH_END        → text post with full result + key stats
 *   3. UPSET/ELIMINATION→ text post, story-style
 *   4. PRE_MATCH        → link post to match preview page
 *   5. BREAKING_NEWS    → link to news article
 *
 * Required env vars:
 *   REDDIT_CLIENT_ID      — OAuth app client ID (Reddit App Dashboard)
 *   REDDIT_CLIENT_SECRET  — OAuth app client secret
 *   REDDIT_USERNAME       — bot account username (no r/)
 *   REDDIT_PASSWORD       — bot account password
 *   REDDIT_USER_AGENT     — e.g. "WC2026Bot/1.0 by u/yourname"
 *   VERCEL_URL            — main site URL
 *   PIPELINE_SECRET       — shared inter-service secret
 *   GROQ_API_KEY          — for post body generation
 *
 * Reddit App setup:
 *   1. Go to https://www.reddit.com/prefs/apps/
 *   2. Click "create another app" → choose "script"
 *   3. Name: "WC2026Bot", redirect: http://localhost:8080
 *   4. Copy client_id (under app name) and client_secret
 *
 * Install: npm install snoowrap
 * Port: 3023
 *
 * Endpoints:
 *   POST /trigger   — moment-engine webhook (GOAL, MATCH_END, etc.)
 *   POST /post      — manual post { subreddit, title, text?, url?, flair? }
 *   POST /comment   — manual comment { postId, text }
 *   GET  /log
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cron    = require('node-cron');
const axios   = require('axios');
const groqClient = require('./groq-client');

const REDDIT_CLIENT_ID     = process.env.REDDIT_CLIENT_ID     || '';
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || '';
const REDDIT_USERNAME      = process.env.REDDIT_USERNAME      || '';
const REDDIT_PASSWORD      = process.env.REDDIT_PASSWORD      || '';
const REDDIT_USER_AGENT    = process.env.REDDIT_USER_AGENT    || `WC2026Bot/1.0 by u/${REDDIT_USERNAME}`;
const VERCEL_URL           = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const PIPELINE_SECRET      = process.env.PIPELINE_SECRET || '';

// Per-subreddit rate limiting: last post timestamp
const lastPostTime = {};
const POST_INTERVAL_MS = 12 * 60 * 1000; // 12 min safety margin (Reddit says 10)

const postLog = [];
const postCount = { total: 0, bySubreddit: {} };

// Target subreddits per event type
const SUBREDDIT_MAP = {
  GOAL:        ['worldcup', 'soccer'],
  PENALTY_GOAL:['worldcup', 'soccer'],
  HAT_TRICK:   ['worldcup', 'soccer', 'football'],
  RED_CARD:    ['worldcup', 'soccer'],
  MATCH_END:   ['worldcup', 'soccer', 'football'],
  UPSET:       ['worldcup', 'soccer', 'football'],
  ELIMINATION: ['worldcup', 'soccer', 'football'],
  PRE_MATCH:   ['worldcup'],
  BREAKING_NEWS:['worldcup']
};

// ─── snoowrap client ──────────────────────────────────────────────────────────

let r = null; // snoowrap instance

function getReddit() {
  if (r) return r;
  if (!REDDIT_CLIENT_ID || !REDDIT_USERNAME) throw new Error('Reddit credentials not configured');
  try {
    const Snoowrap = require('snoowrap');
    r = new Snoowrap({
      userAgent:    REDDIT_USER_AGENT,
      clientId:     REDDIT_CLIENT_ID,
      clientSecret: REDDIT_CLIENT_SECRET,
      username:     REDDIT_USERNAME,
      password:     REDDIT_PASSWORD
    });
    r.config({ requestDelay: 1100, continueAfterRatelimitError: true });
    return r;
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') throw new Error('snoowrap not installed — run: npm install snoowrap');
    throw e;
  }
}

// ─── Rate limit check ─────────────────────────────────────────────────────────

function canPostTo(subreddit) {
  const last = lastPostTime[subreddit] || 0;
  return Date.now() - last >= POST_INTERVAL_MS;
}

function markPosted(subreddit) {
  lastPostTime[subreddit] = Date.now();
  postCount.bySubreddit[subreddit] = (postCount.bySubreddit[subreddit] || 0) + 1;
  postCount.total++;
}

// ─── Content generator ────────────────────────────────────────────────────────

async function generatePostContent(eventType, data) {
  // Title (required for Reddit)
  const titleTemplates = {
    GOAL:         `⚽ GOAL | ${data.homeTeam} ${data.homeScore??0}-${data.awayScore??0} ${data.awayTeam} | ${data.player||'Goal'} (${data.minute}') | WC 2026`,
    PENALTY_GOAL: `⚽ PENALTY GOAL | ${data.homeTeam} ${data.homeScore??0}-${data.awayScore??0} ${data.awayTeam} | ${data.player||''} (${data.minute}') | WC 2026`,
    HAT_TRICK:    `🎩 HAT TRICK | ${data.player||'A player'} scores 3 goals | ${data.homeTeam} vs ${data.awayTeam} | WC 2026`,
    RED_CARD:     `🟥 RED CARD | ${data.player||'A player'} sent off (${data.minute}') | ${data.homeTeam} vs ${data.awayTeam} | WC 2026`,
    MATCH_END:    `📊 FINAL | ${data.homeTeam} ${data.homeScore??0}-${data.awayScore??0} ${data.awayTeam} | WC 2026`,
    UPSET:        `🔥 UPSET | ${data.homeTeam} beats ${data.awayTeam} | WC 2026`,
    ELIMINATION:  `💔 ELIMINATED | ${data.eliminatedTeam||data.awayTeam} exit the tournament | WC 2026`,
    PRE_MATCH:    `📅 MATCH THREAD | ${data.homeTeam} vs ${data.awayTeam} | WC 2026`,
    BREAKING_NEWS:`📰 ${data.title||'Breaking News'} | WC 2026`
  };

  const title = titleTemplates[eventType] || `WC 2026 | ${data.homeTeam||''} vs ${data.awayTeam||''} | Match Update`;
  const url   = data.matchSlug ? `${VERCEL_URL}/match/${data.matchSlug}` : VERCEL_URL;

  // For text posts: generate body with Groq (via budget guard)
  let body = '';
  if (['MATCH_END', 'UPSET', 'ELIMINATION'].includes(eventType)) {
    try {
      const prompt = {
        MATCH_END:   `Write a Reddit post body (2-3 short paragraphs) about this World Cup result: ${data.homeTeam} ${data.homeScore??0}-${data.awayScore??0} ${data.awayTeam}. Key moment: ${data.keyMoment||'See full match stats'}. Include interesting stats or talking points. Don't include the score in the first sentence (it's in the title). End with: "Full stats and analysis: ${url}"`,
        UPSET:       `Write a Reddit post body (2-3 paragraphs) about this World Cup upset: ${data.homeTeam} beat ${data.awayTeam}. Be engaging, ask readers what they think. End with: "Full stats: ${url}"`,
        ELIMINATION: `Write a Reddit post body (2 paragraphs) about ${data.eliminatedTeam||data.awayTeam} being eliminated from WC 2026. Reflect on their tournament run. End with: "Full bracket: ${url}"`
      }[eventType];
      body = await groqClient.complete({ engine: 'reddit-bot', eventType, messages: [{ role: 'user', content: prompt }], max_tokens: 300, temperature: 0.7 }) || '';
    } catch (_) {}
  }

  // Minimal body fallback
  if (!body) {
    body = `**${data.homeTeam||''} ${eventType === 'MATCH_END' ? 'vs' : 'vs'} ${data.awayTeam||''}** — WC 2026\n\n`;
    if (data.player) body += `Player involved: ${data.player}\n\n`;
    body += `Full stats and live coverage: ${url}`;
  }

  return { title, body, url };
}

// ─── Post to Reddit ───────────────────────────────────────────────────────────

async function submitPost(subreddit, title, { body, url, isLink = false, flair = null }) {
  const reddit = getReddit();
  const sub = reddit.getSubreddit(subreddit);

  let post;
  if (isLink && url) {
    post = await sub.submitLink({ title, url });
  } else {
    post = await sub.submitSelfpost({ title, text: body || url });
  }

  // Try to set flair if provided
  if (flair) {
    try { await post.selectFlair({ text: flair }); } catch (_) {}
  }

  const postId  = post?.id || post?.name || 'unknown';
  const postUrl = `https://reddit.com/r/${subreddit}/comments/${postId}`;
  markPosted(subreddit);
  console.log(`[Reddit] posted to r/${subreddit}: ${postUrl}`);
  return { id: postId, url: postUrl };
}

async function dispatchToSubreddits(eventType, data) {
  const subreddits = SUBREDDIT_MAP[eventType] || ['worldcup'];
  const { title, body, url } = await generatePostContent(eventType, data);

  // Use link posts for goals/prematch (drives traffic), text for match ends
  const isLink = ['GOAL','PENALTY_GOAL','HAT_TRICK','RED_CARD','PRE_MATCH'].includes(eventType);

  const results = [];
  for (const sub of subreddits) {
    if (!canPostTo(sub)) {
      const wait = Math.ceil((POST_INTERVAL_MS - (Date.now() - (lastPostTime[sub]||0))) / 1000 / 60);
      console.log(`[Reddit] r/${sub} rate limited — ${wait}min remaining`);
      results.push({ subreddit: sub, skipped: true, reason: 'rate-limited' });
      continue;
    }

    try {
      const res = await submitPost(sub, title, { body, url, isLink });
      results.push({ subreddit: sub, ok: true, ...res });
    } catch (e) {
      console.error(`[Reddit] r/${sub} failed: ${e.message}`);
      results.push({ subreddit: sub, ok: false, error: e.message });
    }

    // 5s between subreddit posts
    await new Promise(res => setTimeout(res, 5000));
  }

  postLog.unshift({ eventType, title, subreddits, results, timestamp: new Date().toISOString() });
  if (postLog.length > 200) postLog.length = 200;
  return results;
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  if (!SUBREDDIT_MAP[eventType]) return res.json({ ok: true, skipped: true });

  try {
    const results = await dispatchToSubreddits(eventType, data);
    res.json({ ok: true, eventType, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post', auth, async (req, res) => {
  const { subreddit = 'worldcup', title, text, url, flair, isLink } = req.body;
  if (!title) return res.status(400).json({ ok: false, error: 'title required' });

  if (!canPostTo(subreddit)) {
    return res.status(429).json({ ok: false, error: `Rate limited for r/${subreddit}` });
  }

  try {
    const result = await submitPost(subreddit, title, { body: text, url, isLink: isLink || !!url, flair });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/comment', auth, async (req, res) => {
  const { postId, text } = req.body;
  if (!postId || !text) return res.status(400).json({ ok: false, error: 'postId and text required' });
  try {
    const reddit = getReddit();
    const post   = reddit.getSubmission(postId);
    const comment = await post.reply(text);
    res.json({ ok: true, commentId: comment?.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/log', (req, res) => {
  res.json({ ok: true, count: postLog.length, log: postLog.slice(0, 30) });
});

app.get('/status', (req, res) => {
  const rateLimits = {};
  for (const [sub, last] of Object.entries(lastPostTime)) {
    const nextPost = new Date(last + POST_INTERVAL_MS);
    rateLimits[sub] = { nextPost, canPost: Date.now() >= last + POST_INTERVAL_MS };
  }
  res.json({
    ok:          true,
    service:     'reddit-bot',
    configured:  !!(REDDIT_CLIENT_ID && REDDIT_USERNAME),
    username:    REDDIT_USERNAME || 'not set',
    postCount,
    rateLimits,
    subreddits:  Object.keys(SUBREDDIT_MAP)
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function boot() {
  const PORT = process.env.REDDIT_PORT || process.env.PORT || 3023;
  app.listen(PORT, () => console.log(`[Reddit Bot] listening on :${PORT}`));

  if (!REDDIT_CLIENT_ID) {
    console.warn('[Reddit] REDDIT_CLIENT_ID not set — posts will fail');
    console.warn('[Reddit] Setup: https://www.reddit.com/prefs/apps/ → create script app');
  }

  // Daily pre-match digest at 11:00 UTC (before first matches)
  cron.schedule('0 11 * * *', async () => {
    if (!canPostTo('worldcup')) return;
    try {
      const API = process.env.API_SERVER_URL || 'http://localhost:3001';
      const r = await axios.get(`${API}/api/v1/matches/today`, { timeout: 15000 });
      const matches = r.data?.matches || r.data?.response || [];
      if (!matches.length) return;

      const matchList = matches.map(m =>
        `- ${m.teams?.home?.name||m.homeTeam} vs ${m.teams?.away?.name||m.awayTeam}`
      ).join('\n');

      await submitPost('worldcup',
        `📅 Today's WC 2026 Matches | ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long' })}`,
        {
          body: `Here are today's World Cup matches:\n\n${matchList}\n\nLive scores and AI predictions: ${VERCEL_URL}\n\n*Discuss today's games in the comments!*`,
          isLink: false
        }
      );
    } catch (e) { console.error('[Reddit cron]', e.message); }
  });

  console.log(`[Reddit Bot] running on :${PORT} — targeting r/${Object.values(SUBREDDIT_MAP).flat().filter((v,i,a)=>a.indexOf(v)===i).join(', r/')}`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
