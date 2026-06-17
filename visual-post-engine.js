/**
 * WC 2026 Sports Empire — Visual Post Engine
 * Deploy on Railway.app as service "visual-post-engine"
 *
 * The "last mile" for image posting — takes PNG buffers from image-engine.js
 * and uploads them to Instagram and TikTok via their official APIs.
 *
 * Flow:
 *   1. Receive event from moment-engine via POST /trigger
 *   2. Call image-engine to generate PNG cards (base64)
 *   3. Upload PNG to Instagram Graph API (container → publish)
 *   4. Upload PNG to TikTok Content Posting API (photo post)
 *   5. Log results
 *
 * Instagram Graph API:
 *   Step 1: POST /v19.0/{ig-user-id}/media  → creates container → returns creation_id
 *   Step 2: POST /v19.0/{ig-user-id}/media_publish {creation_id} → publishes
 *   Supports: image_url (must be publicly accessible) OR file upload via form-data
 *
 * TikTok Content Posting API:
 *   POST open.tiktokapis.com/v2/post/publish/content/init/
 *   source_type: PULL_FROM_URL → provide publicly accessible image URL
 *   post_mode: DIRECT_POST or AUTO_ADD_MUSIC
 *
 * IMPORTANT: Both APIs require a publicly accessible image URL.
 *   Strategy: image-engine.js saves PNGs to a temp dir, and this engine
 *   serves them on GET /img/:filename — Vercel/Railway public URL used.
 *
 * Required env vars:
 *   IMAGE_ENGINE_URL         — URL of image-engine service (e.g. https://image-engine.railway.app)
 *   INSTAGRAM_ACCESS_TOKEN   — long-lived user access token (Facebook Graph API)
 *   INSTAGRAM_USER_ID        — numeric IG user ID (from Graph API /me)
 *   TIKTOK_ACCESS_TOKEN      — TikTok Content Posting API OAuth2 token
 *   VISUAL_ENGINE_PUBLIC_URL — public URL of THIS service (for img serving)
 *   PIPELINE_SECRET          — shared inter-service secret
 *   GROQ_API_KEY             — for caption generation
 *   VERCEL_URL               — main site URL for captions
 *
 * Endpoints:
 *   POST /trigger              — moment-engine webhook
 *   POST /post/instagram       — post manually to Instagram
 *   POST /post/tiktok          — post manually to TikTok
 *   POST /post/both            — post to both simultaneously
 *   GET  /img/:filename        — serve generated PNGs (for API image URLs)
 *   GET  /posts                — log of published posts
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');
const { v4: uuidv4 } = require('uuid');

const IMAGE_ENGINE_URL    = (process.env.IMAGE_ENGINE_URL    || 'http://localhost:3016').replace(/\/$/, '');
const IG_ACCESS_TOKEN     = process.env.INSTAGRAM_ACCESS_TOKEN  || '';
const IG_USER_ID          = process.env.INSTAGRAM_USER_ID       || '';
const TT_ACCESS_TOKEN     = process.env.TIKTOK_ACCESS_TOKEN     || '';
const PUBLIC_URL          = (process.env.VISUAL_ENGINE_PUBLIC_URL || 'http://localhost:3017').replace(/\/$/, '');
const PIPELINE_SECRET     = process.env.PIPELINE_SECRET          || '';
const VERCEL_URL          = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');

const IMG_DIR  = path.join(__dirname, 'visual-images');
const LOG_FILE = path.join(__dirname, 'visual-posts.json');

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

let postCount = { instagram: 0, tiktok: 0 };

// ─── Image generation (calls image-engine) ───────────────────────────────────

async function generateCard(type, data) {
  const endpoint = `/card/${type}`;
  const r = await axios.post(`${IMAGE_ENGINE_URL}${endpoint}`, data, {
    headers: {
      'Content-Type': 'application/json',
      'x-pipeline-secret': PIPELINE_SECRET
    },
    responseType: 'arraybuffer',
    timeout: 30000
  });
  // Save to disk so we can serve via /img/
  const filename = `${type}-${uuidv4()}.png`;
  fs.writeFileSync(path.join(IMG_DIR, filename), r.data);
  return filename;
}

function imgUrl(filename) {
  return `${PUBLIC_URL}/img/${filename}`;
}

// Clean up images older than 1 hour (keep disk tidy on Railway)
function cleanOldImages() {
  const cutoff = Date.now() - 3600000;
  try {
    for (const f of fs.readdirSync(IMG_DIR)) {
      const fp = path.join(IMG_DIR, f);
      if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
    }
  } catch (_) {}
}

// ─── Caption generation ───────────────────────────────────────────────────────

async function generateCaption(type, data) {
  if (!process.env.GROQ_API_KEY) return defaultCaption(type, data);
  
  let prompt;
  if (type === 'goal') {
    prompt = `Write a short, exciting Instagram caption for a goal in the 2026 FIFA World Cup.
Match: ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam}
Goal scorer: ${data.player || 'Unknown'} (${data.minute || '?'}')
Max 150 characters. Include 1-2 football emojis. Add these hashtags: #WC2026 #WorldCup2026 #${(data.homeTeam || '').replace(/\s/g, '')} #${(data.awayTeam || '').replace(/\s/g, '')}`;
  } else if (type === 'result') {
    const winner = data.result === 'home_win' ? data.homeTeam : data.result === 'away_win' ? data.awayTeam : null;
    prompt = `Write a short Instagram caption for a World Cup result.
Match: ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam}
${winner ? `Winner: ${winner}` : 'Result: Draw'}
Max 120 chars. 1-2 emojis. Hashtags: #WC2026 #WorldCup2026 #FT #FullTime`;
  } else if (type === 'preview') {
    prompt = `Write a short hype Instagram caption for an upcoming World Cup match.
${data.homeTeam} vs ${data.awayTeam}. Kick-off: ${data.kickoffTime || 'today'}.
Max 100 chars. 2 emojis. Hashtags: #WC2026 #WorldCup2026`;
  } else {
    return defaultCaption(type, data);
  }

  try {
    const text = await groqClient.complete({ engine: 'visual-post-engine', eventType: type.toUpperCase(), messages: [{ role: 'user', content: prompt }], max_tokens: 200, temperature: 0.8 });
    return text || defaultCaption(type, data);
  } catch (e) {
    return defaultCaption(type, data);
  }
}

function defaultCaption(type, data) {
  if (type === 'goal') return `⚽ GOAL! ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} (${data.minute}') #WC2026 #WorldCup2026`;
  if (type === 'result') return `🏁 FT: ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} #WC2026`;
  if (type === 'preview') return `⚽ TODAY: ${data.homeTeam} vs ${data.awayTeam} #WC2026 #WorldCup2026`;
  return `🏆 WC 2026 Live — ${VERCEL_URL} #WC2026`;
}

// ─── Instagram Graph API ──────────────────────────────────────────────────────

async function instagramPost(imageUrl, caption) {
  if (!IG_ACCESS_TOKEN || !IG_USER_ID) throw new Error('INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID not configured');

  // Step 1: Create media container
  const create = await axios.post(
    `https://graph.facebook.com/v19.0/${IG_USER_ID}/media`,
    null,
    {
      params: {
        image_url:    imageUrl,
        caption:      caption,
        access_token: IG_ACCESS_TOKEN
      },
      timeout: 30000
    }
  );

  const creationId = create.data?.id;
  if (!creationId) throw new Error(`Instagram media container creation failed: ${JSON.stringify(create.data)}`);

  // Wait for container to be ready (Instagram needs a moment)
  await new Promise(r => setTimeout(r, 5000));

  // Step 2: Publish
  const publish = await axios.post(
    `https://graph.facebook.com/v19.0/${IG_USER_ID}/media_publish`,
    null,
    {
      params: {
        creation_id:  creationId,
        access_token: IG_ACCESS_TOKEN
      },
      timeout: 30000
    }
  );

  const mediaId = publish.data?.id;
  if (!mediaId) throw new Error(`Instagram publish failed: ${JSON.stringify(publish.data)}`);

  postCount.instagram++;
  console.log(`[Instagram] published: ${mediaId}`);
  return { mediaId, creationId };
}

// ─── TikTok Content Posting API ──────────────────────────────────────────────

async function tiktokPost(imageUrl, caption) {
  if (!TT_ACCESS_TOKEN) throw new Error('TIKTOK_ACCESS_TOKEN not configured');

  // TikTok photo post via PULL_FROM_URL
  // For photo posts (not video), TikTok supports single-image and carousel
  const r = await axios.post(
    'https://open.tiktokapis.com/v2/post/publish/content/init/',
    {
      post_info: {
        title:             caption.slice(0, 150),
        privacy_level:     'PUBLIC_TO_EVERYONE',
        disable_duet:      false,
        disable_comment:   false,
        disable_stitch:    false,
        video_cover_timestamp_ms: 0
      },
      source_info: {
        source:     'PULL_FROM_URL',
        photo_images: [imageUrl],
        photo_cover_index: 0
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO'
    },
    {
      headers: {
        Authorization:  `Bearer ${TT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      timeout: 30000
    }
  );

  if (r.data?.error?.code !== 'ok' && r.data?.error?.code !== 0) {
    throw new Error(`TikTok API error: ${JSON.stringify(r.data?.error)}`);
  }

  const publishId = r.data?.data?.publish_id;
  postCount.tiktok++;
  console.log(`[TikTok] published: ${publishId}`);
  return { publishId };
}

// ─── Post to both ─────────────────────────────────────────────────────────────

async function postToBoth(cardType, cardData) {
  const filename = await generateCard(cardType, cardData);
  const url      = imgUrl(filename);
  const caption  = await generateCaption(cardType, cardData);

  const results = {};

  // Run Instagram + TikTok in parallel
  const [igResult, ttResult] = await Promise.allSettled([
    instagramPost(url, caption),
    tiktokPost(url, caption)
  ]);

  results.instagram = igResult.status === 'fulfilled' ? { ok: true, ...igResult.value } : { ok: false, error: igResult.reason.message };
  results.tiktok    = ttResult.status === 'fulfilled' ? { ok: true, ...ttResult.value } : { ok: false, error: ttResult.reason.message };

  // Log
  const log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];
  log.unshift({
    timestamp: new Date().toISOString(),
    cardType,
    imageUrl:  url,
    caption:   caption.slice(0, 100),
    instagram: results.instagram,
    tiktok:    results.tiktok
  });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log.slice(0, 200), null, 2));

  // Schedule image cleanup after 2h
  setTimeout(() => {
    try { fs.unlinkSync(path.join(IMG_DIR, filename)); } catch (_) {}
  }, 7200000);

  return { url, caption, ...results };
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Serve generated PNGs (Instagram/TikTok need a public URL to pull from)
app.use('/img', express.static(IMG_DIR, { maxAge: '1h' }));

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// moment-engine webhook
app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  try {
    let cardType;
    switch (eventType) {
      case 'GOAL':
      case 'PENALTY_GOAL':
      case 'OWN_GOAL':
        cardType = 'goal';
        break;
      case 'MATCH_END':
        cardType = 'result';
        break;
      case 'PRE_MATCH':
        cardType = 'preview';
        break;
      default:
        return res.json({ ok: true, skipped: true, reason: `event ${eventType} not mapped to card` });
    }

    const result = await postToBoth(cardType, data);
    res.json({ ok: true, eventType, cardType, ...result });
  } catch (e) {
    console.error('[Visual trigger]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/instagram', auth, async (req, res) => {
  try {
    const { cardType = 'preview', imageUrl, caption, ...cardData } = req.body;
    let url = imageUrl, cap = caption;
    if (!url) {
      const filename = await generateCard(cardType, cardData);
      url = imgUrl(filename);
    }
    if (!cap) cap = await generateCaption(cardType, cardData);
    const result = await instagramPost(url, cap);
    res.json({ ok: true, ...result, imageUrl: url });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/tiktok', auth, async (req, res) => {
  try {
    const { cardType = 'preview', imageUrl, caption, ...cardData } = req.body;
    let url = imageUrl, cap = caption;
    if (!url) {
      const filename = await generateCard(cardType, cardData);
      url = imgUrl(filename);
    }
    if (!cap) cap = await generateCaption(cardType, cardData);
    const result = await tiktokPost(url, cap);
    res.json({ ok: true, ...result, imageUrl: url });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/both', auth, async (req, res) => {
  try {
    const { cardType = 'preview', ...cardData } = req.body;
    const result = await postToBoth(cardType, cardData);
    res.json({ ok: true, cardType, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/posts', (req, res) => {
  const log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];
  res.json({ ok: true, count: log.length, posts: log.slice(0, 20), totals: postCount });
});

app.get('/status', (req, res) => {
  res.json({
    ok:           true,
    service:      'visual-post-engine',
    imageEngine:  IMAGE_ENGINE_URL,
    publicUrl:    PUBLIC_URL,
    instagram: {
      configured: !!(IG_ACCESS_TOKEN && IG_USER_ID),
      postsThisSession: postCount.instagram
    },
    tiktok: {
      configured: !!TT_ACCESS_TOKEN,
      postsThisSession: postCount.tiktok
    },
    storedImages: fs.readdirSync(IMG_DIR).length
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.VISUAL_PORT || process.env.PORT || 3017;
  app.listen(PORT, () => console.log(`[Visual Post Engine] listening on :${PORT}`));

  // Daily pre-match preview posts at 09:00 UTC
  cron.schedule('0 9 * * *', async () => {
    try {
      // Fetch today's matches from API server and post preview cards
      const API = process.env.API_SERVER_URL || 'http://localhost:3001';
      const r   = await axios.get(`${API}/api/v1/matches/today`, { timeout: 15000 });
      const matches = r.data?.matches || r.data?.response || [];
      // Post top 3 matches
      for (const match of matches.slice(0, 3)) {
        const data = {
          homeTeam:    match.teams?.home?.name || match.homeTeam,
          awayTeam:    match.teams?.away?.name || match.awayTeam,
          kickoffTime: match.fixture?.date ? new Date(match.fixture.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : '',
          venue:       match.fixture?.venue?.name || '',
          groupStage:  match.league?.round || ''
        };
        await postToBoth('preview', data).catch(e => console.error('[cron preview]', e.message));
        await new Promise(r => setTimeout(r, 10000)); // 10s between posts
      }
    } catch (e) {
      console.error('[Visual cron]', e.message);
    }
  });

  // Clean images hourly
  cron.schedule('0 * * * *', cleanOldImages);

  if (!IG_ACCESS_TOKEN) console.warn('[Visual] INSTAGRAM_ACCESS_TOKEN not set');
  if (!TT_ACCESS_TOKEN) console.warn('[Visual] TIKTOK_ACCESS_TOKEN not set');
  if (!IMAGE_ENGINE_URL.includes('localhost') === false && IMAGE_ENGINE_URL.includes('localhost')) {
    console.warn('[Visual] IMAGE_ENGINE_URL points to localhost — set to Railway URL in production');
  }

  console.log(`[Visual Post Engine] running on :${PORT}
  Instagram: ${IG_ACCESS_TOKEN ? 'configured' : 'NOT configured'}
  TikTok:    ${TT_ACCESS_TOKEN ? 'configured' : 'NOT configured'}
  Image engine: ${IMAGE_ENGINE_URL}
  Public URL: ${PUBLIC_URL}
  Daily preview posts: 09:00 UTC
  `);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
