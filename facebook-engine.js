/**
 * WC 2026 Sports Empire — Facebook Pages + Threads Engine
 * Deploy on Railway.app as service "facebook-engine"
 *
 * Posts WC 2026 content to:
 *   1. Facebook Page — Graph API v19.0 /page-id/feed
 *   2. Meta Threads  — Threads API (threads.net) using Instagram credentials
 *
 * Same credentials as Instagram (visual-post-engine) — reuse the long-lived token.
 *
 * Facebook: 3 billion users, organic reach is lower than 2015 but still massive
 *           for sports/events content during tournaments.
 * Threads:  200M+ users, Twitter/X alternative, chronological feed favors burst posting.
 *
 * Required env vars:
 *   FACEBOOK_PAGE_ID       — numeric Page ID (facebook.com/about → see Page ID)
 *   FACEBOOK_PAGE_TOKEN    — Page access token (different from user token)
 *                            Get via: Graph API Explorer → select your Page → Generate Token
 *   INSTAGRAM_ACCESS_TOKEN — long-lived token (same one used for Instagram posting)
 *   INSTAGRAM_USER_ID      — numeric IG user ID (Threads uses same ID)
 *   VERCEL_URL             — main site URL
 *   IMAGE_ENGINE_URL       — image-engine.js Railway URL
 *   PIPELINE_SECRET        — shared inter-service secret
 *   GROQ_API_KEY           — for caption generation
 *
 * Facebook token refresh:
 *   Long-lived Page tokens DON'T expire (unlike user tokens). Get it once and keep it.
 *   GET https://graph.facebook.com/v19.0/me/accounts?access_token=USER_TOKEN
 *   → use the access_token from your page's entry.
 *
 * Threads API:
 *   POST https://graph.threads.net/v1.0/{user-id}/threads
 *   POST https://graph.threads.net/v1.0/{user-id}/threads_publish
 *
 * Endpoints:
 *   POST /trigger          — moment-engine webhook
 *   POST /post/facebook    — manual Facebook post
 *   POST /post/threads     — manual Threads post
 *   POST /post/both        — post to both
 *   GET  /posts
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');
const groqClient = require('./groq-client');

const FB_PAGE_ID      = process.env.FACEBOOK_PAGE_ID      || '';
const FB_PAGE_TOKEN   = process.env.FACEBOOK_PAGE_TOKEN   || '';
const IG_TOKEN        = process.env.INSTAGRAM_ACCESS_TOKEN || '';
const IG_USER_ID      = process.env.INSTAGRAM_USER_ID     || '';
const VERCEL_URL      = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const IMAGE_ENGINE    = (process.env.IMAGE_ENGINE_URL || 'http://localhost:3016').replace(/\/$/, '');
const PIPELINE_SECRET = process.env.PIPELINE_SECRET       || '';

const postLog   = [];
const postCount = { facebook: 0, threads: 0 };

// ─── Caption generator ────────────────────────────────────────────────────────

async function generateCaption(eventType, data) {
  if (!GROQ_KEY) return defaultCaption(eventType, data);


  const prompts = {
    GOAL:      `Write a Facebook post about a goal in the 2026 FIFA World Cup. Player: ${data.player || 'Unknown'}, Teams: ${data.homeTeam} ${data.homeScore??0}-${data.awayScore??0} ${data.awayTeam}, Minute: ${data.minute}'. Exciting, 2-3 sentences, include emojis. End with: ${VERCEL_URL}`,
    MATCH_END: `Write a Facebook post about this World Cup result: ${data.homeTeam} ${data.homeScore??0}-${data.awayScore??0} ${data.awayTeam}. 2 sentences, include key fact. End with: ${VERCEL_URL}`,
    RED_CARD:  `Write a Facebook post about a red card: ${data.player||'A player'} sent off in minute ${data.minute}' (${data.homeTeam} vs ${data.awayTeam}). 2 sentences, debatable tone. End with: ${VERCEL_URL}`,
    HAT_TRICK: `Write a celebratory Facebook post about ${data.player||'A player'} scoring a hat trick at WC 2026 (${data.homeTeam} vs ${data.awayTeam}). Maximum hype, 2-3 sentences. End with: ${VERCEL_URL}`,
    UPSET:     `Write a shocked Facebook post about this World Cup upset: ${data.homeTeam} beats ${data.awayTeam}. 2-3 sentences, capture the shock. End with: ${VERCEL_URL}`,
    PRE_MATCH: `Write a hyped Facebook preview post for: ${data.homeTeam} vs ${data.awayTeam} at WC 2026 (kick-off: ${data.kickoffTime||'today'}). 2 sentences, build excitement. End with: ${VERCEL_URL}`
  };

  const prompt = prompts[eventType] || prompts.PRE_MATCH;
  try {
    const text = await groqClient.complete({ engine: 'facebook-engine', eventType, messages: [{ role: 'user', content: prompt }], max_tokens: 200, temperature: 0.75 });
    return text || defaultCaption(eventType, data);
  } catch (_) { return defaultCaption(eventType, data); }
}

function defaultCaption(eventType, data) {
  if (eventType === 'GOAL')      return `⚽ GOAL! ${data.player||''} scores for ${data.homeTeam}! Score: ${data.homeScore??0}-${data.awayScore??0} (${data.minute}') 🔥 ${VERCEL_URL}`;
  if (eventType === 'MATCH_END') return `🏁 Full Time: ${data.homeTeam} ${data.homeScore??0}-${data.awayScore??0} ${data.awayTeam} | ${VERCEL_URL}`;
  if (eventType === 'RED_CARD')  return `🟥 RED CARD! ${data.player||'A player'} sent off (${data.minute}') | ${data.homeTeam} vs ${data.awayTeam} | ${VERCEL_URL}`;
  if (eventType === 'HAT_TRICK') return `🎩🎩🎩 HAT TRICK! ${data.player||'A player'} scores THREE goals at WC 2026! | ${VERCEL_URL}`;
  if (eventType === 'UPSET')     return `🔥 UPSET! ${data.homeTeam} beats ${data.awayTeam}! | ${VERCEL_URL}`;
  return `⚽ WC 2026 Live — ${data.homeTeam||''} vs ${data.awayTeam||''} | ${VERCEL_URL}`;
}

// ─── Facebook Graph API ───────────────────────────────────────────────────────

async function facebookPost(message, imageUrl = null) {
  if (!FB_PAGE_ID || !FB_PAGE_TOKEN) throw new Error('FACEBOOK_PAGE_ID or FACEBOOK_PAGE_TOKEN not configured');

  // If image URL provided, create photo post; otherwise text post
  if (imageUrl) {
    const r = await axios.post(
      `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`,
      null,
      {
        params: { caption: message, url: imageUrl, access_token: FB_PAGE_TOKEN },
        timeout: 30000
      }
    );
    const id = r.data?.id;
    postCount.facebook++;
    console.log(`[Facebook] photo posted: ${id}`);
    return id;
  } else {
    const r = await axios.post(
      `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`,
      null,
      {
        params: { message, access_token: FB_PAGE_TOKEN },
        timeout: 20000
      }
    );
    const id = r.data?.id;
    postCount.facebook++;
    console.log(`[Facebook] text posted: ${id}`);
    return id;
  }
}

// ─── Meta Threads API ─────────────────────────────────────────────────────────

async function threadsPost(text, imageUrl = null) {
  if (!IG_TOKEN || !IG_USER_ID) throw new Error('INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_USER_ID not configured (Threads reuses these)');

  // Step 1: Create container
  const createParams = {
    text,
    access_token: IG_TOKEN,
    media_type:   imageUrl ? 'IMAGE' : 'TEXT'
  };
  if (imageUrl) createParams.image_url = imageUrl;

  const create = await axios.post(
    `https://graph.threads.net/v1.0/${IG_USER_ID}/threads`,
    null,
    { params: createParams, timeout: 20000 }
  );

  const creationId = create.data?.id;
  if (!creationId) throw new Error(`Threads container creation failed: ${JSON.stringify(create.data)}`);

  // Wait for processing
  await new Promise(r => setTimeout(r, 3000));

  // Step 2: Publish
  const publish = await axios.post(
    `https://graph.threads.net/v1.0/${IG_USER_ID}/threads_publish`,
    null,
    { params: { creation_id: creationId, access_token: IG_TOKEN }, timeout: 20000 }
  );

  const postId = publish.data?.id;
  postCount.threads++;
  console.log(`[Threads] published: ${postId}`);
  return postId;
}

// ─── Generate card image ──────────────────────────────────────────────────────

async function getCardImage(eventType, data) {
  const cardType = eventType === 'GOAL' || eventType === 'PENALTY_GOAL' || eventType === 'HAT_TRICK' ? 'goal'
    : eventType === 'MATCH_END' ? 'result'
    : eventType === 'PRE_MATCH' ? 'preview'
    : 'twitter';  // landscape fallback

  try {
    // Ask image-engine for a base64 card, then we serve via a temp endpoint
    // For Facebook/Threads we need a public URL — use visual-post-engine if available
    // or skip image for now and use text-only post
    return null; // TODO: wire through visual-post-engine's /img endpoint
  } catch (_) { return null; }
}

// ─── Post to both ─────────────────────────────────────────────────────────────

async function postToBoth(eventType, data) {
  const caption  = await generateCaption(eventType, data);
  const imageUrl = await getCardImage(eventType, data);
  const results  = {};

  const [fbRes, thRes] = await Promise.allSettled([
    facebookPost(caption, imageUrl),
    threadsPost(caption, imageUrl)
  ]);

  results.facebook = fbRes.status === 'fulfilled' ? { ok: true, id: fbRes.value } : { ok: false, error: fbRes.reason.message };
  results.threads  = thRes.status === 'fulfilled' ? { ok: true, id: thRes.value } : { ok: false, error: thRes.reason.message };

  postLog.unshift({ eventType, caption: caption.slice(0, 100), imageUrl, ...results, timestamp: new Date().toISOString() });
  if (postLog.length > 200) postLog.length = 200;

  return { caption, ...results };
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
  const handled = ['GOAL','PENALTY_GOAL','OWN_GOAL','RED_CARD','MATCH_END','HAT_TRICK','UPSET','ELIMINATION','PRE_MATCH'];
  if (!handled.includes(eventType)) return res.json({ ok: true, skipped: true });

  try {
    const result = await postToBoth(eventType, data);
    res.json({ ok: true, eventType, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/facebook', auth, async (req, res) => {
  try {
    const { message, imageUrl } = req.body;
    const id = await facebookPost(message, imageUrl);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/post/threads', auth, async (req, res) => {
  try {
    const { text, imageUrl } = req.body;
    const id = await threadsPost(text, imageUrl);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/post/both', auth, async (req, res) => {
  try {
    const { eventType = 'GOAL', ...data } = req.body;
    const result = await postToBoth(eventType, data);
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/posts', (req, res) => {
  res.json({ ok: true, totals: postCount, log: postLog.slice(0, 20) });
});

app.get('/status', (req, res) => {
  res.json({
    ok:       true,
    service:  'facebook-engine',
    facebook: { configured: !!(FB_PAGE_ID && FB_PAGE_TOKEN), posts: postCount.facebook },
    threads:  { configured: !!(IG_TOKEN && IG_USER_ID), posts: postCount.threads }
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function boot() {
  const PORT = process.env.FACEBOOK_PORT || process.env.PORT || 3021;
  app.listen(PORT, () => console.log(`[Facebook Engine] listening on :${PORT}`));

  if (!FB_PAGE_TOKEN) console.warn('[Facebook] FACEBOOK_PAGE_TOKEN not set');
  if (!IG_TOKEN)      console.warn('[Facebook/Threads] INSTAGRAM_ACCESS_TOKEN not set');

  // Daily preview posts at 10:00 UTC
  cron.schedule('0 10 * * *', async () => {
    try {
      const API = process.env.API_SERVER_URL || 'http://localhost:3001';
      const r = await axios.get(`${API}/api/v1/matches/today`, { timeout: 15000 });
      const matches = r.data?.matches || r.data?.response || [];
      for (const match of matches.slice(0, 2)) {
        const data = {
          homeTeam: match.teams?.home?.name || match.homeTeam,
          awayTeam: match.teams?.away?.name || match.awayTeam,
          kickoffTime: match.fixture?.date ? new Date(match.fixture.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : ''
        };
        await postToBoth('PRE_MATCH', data).catch(e => console.error('[cron]', e.message));
        await new Promise(r => setTimeout(r, 15000));
      }
    } catch (e) { console.error('[Facebook cron]', e.message); }
  });

  console.log(`[Facebook Engine] running on :${PORT} — Facebook + Threads`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
