/**
 * WC 2026 Sports Empire — YouTube Uploader
 * Deploy on Railway.app as service "youtube-uploader"
 *
 * Handles actual YouTube video uploads via the YouTube Data API v3.
 * Works in conjunction with youtube-engine.js (which generates scripts and metadata).
 *
 * Upload flow:
 *   1. Watch `youtube-scripts/` directory for new .json job files
 *   2. Each job has: title, description, tags, categoryId, privacyStatus, videoPath (or URL to download)
 *   3. Download/locate video → upload to YouTube via resumable upload
 *   4. On success: post premiere thumbnail to social channels
 *
 * OAuth2 setup (REQUIRED — YouTube requires user consent):
 *   1. console.cloud.google.com → New project → Enable YouTube Data API v3
 *   2. Credentials → OAuth 2.0 Client ID → Desktop app
 *   3. Download JSON → extract client_id and client_secret
 *   4. Run: node youtube-uploader.js --auth
 *      → Opens browser → Sign in as your channel → Paste code back
 *      → Saves refresh token to .youtube-token.json
 *   5. Set YOUTUBE_REFRESH_TOKEN from .youtube-token.json in .env
 *
 * Required env vars:
 *   YOUTUBE_CLIENT_ID       — OAuth2 client ID from Google Cloud Console
 *   YOUTUBE_CLIENT_SECRET   — OAuth2 client secret
 *   YOUTUBE_REFRESH_TOKEN   — Long-lived refresh token (from --auth flow below)
 *   PIPELINE_SECRET         — shared inter-service secret
 *   VERCEL_URL              — main site URL (added to video descriptions)
 *   SCRIPTS_DIR             — path to youtube-scripts dir (default: ./youtube-scripts)
 *   VIDEO_DIR               — path to local video files (default: ./videos)
 *
 * Install: npm install googleapis
 * Port: 3025
 *
 * Endpoints:
 *   POST /trigger              — moment-engine webhook
 *   POST /upload               — manual upload { title, description, tags, videoPath/videoUrl }
 *   POST /schedule             — queue a video for upload
 *   GET  /uploads              — list recent uploads
 *   GET  /quota                — YouTube API quota usage estimate
 *   GET  /status
 *
 * YouTube quota:
 *   - Upload: 1600 units per video
 *   - Daily quota: 10,000 units = ~6 uploads/day
 *   - Request more at console.cloud.google.com → IAM → Quotas
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const http    = require('https');
const express = require('express');
const cron    = require('node-cron');
const axios   = require('axios');

const YT_CLIENT_ID     = process.env.YOUTUBE_CLIENT_ID     || '';
const YT_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || '';
const YT_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN || '';
const PIPELINE_SECRET  = process.env.PIPELINE_SECRET       || '';
const VERCEL_URL       = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const SCRIPTS_DIR      = process.env.SCRIPTS_DIR || path.join(process.cwd(), 'youtube-scripts');
const VIDEO_DIR        = process.env.VIDEO_DIR   || path.join(process.cwd(), 'videos');

const uploadLog  = [];
let accessToken  = null;
let tokenExpiry  = 0;
let quotaUsed    = 0; // estimate, resets at midnight PT

// ─── OAuth2 token management ──────────────────────────────────────────────────

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) return accessToken;
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
    throw new Error('YouTube OAuth2 credentials not configured. Run: node youtube-uploader.js --auth');
  }

  const r = await axios.post('https://oauth2.googleapis.com/token', null, {
    params: {
      client_id:     YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
      refresh_token: YT_REFRESH_TOKEN,
      grant_type:    'refresh_token'
    },
    timeout: 15000
  });

  accessToken = r.data.access_token;
  tokenExpiry = Date.now() + (r.data.expires_in || 3600) * 1000;
  return accessToken;
}

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadVideo(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? require('https') : require('http');
    protocol.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
    }).on('error', e => {
      fs.unlink(destPath, () => {});
      reject(e);
    });
  });
}

// ─── YouTube resumable upload ─────────────────────────────────────────────────

async function uploadToYouTube({ title, description, tags = [], categoryId = '17', privacyStatus = 'public', videoPath }) {
  const token = await getAccessToken();

  if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);

  const stat     = fs.statSync(videoPath);
  const fileSize = stat.size;

  const metadata = {
    snippet: {
      title:       title.slice(0, 100),
      description: `${description}\n\n🔴 Live scores & predictions: ${VERCEL_URL}\n\n#WC2026 #WorldCup2026 #Football`,
      tags:        [...tags, 'WC2026', 'WorldCup2026', 'FIFA2026', 'Football'].slice(0, 500),
      categoryId,
      defaultLanguage: 'en'
    },
    status: { privacyStatus, selfDeclaredMadeForKids: false }
  };

  // Step 1: Initiate resumable upload
  const initRes = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    metadata,
    {
      headers: {
        Authorization:    `Bearer ${token}`,
        'Content-Type':   'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/*',
        'X-Upload-Content-Length': fileSize
      },
      timeout: 20000
    }
  );

  const uploadUrl = initRes.headers.location;
  if (!uploadUrl) throw new Error('No upload URL returned from YouTube');

  // Step 2: Upload video bytes
  const videoStream = fs.createReadStream(videoPath);
  const uploadRes = await axios.put(uploadUrl, videoStream, {
    headers: {
      'Content-Type':   'video/*',
      'Content-Length': fileSize
    },
    maxContentLength: Infinity,
    maxBodyLength:    Infinity,
    timeout:          600000 // 10 min for large uploads
  });

  const videoId  = uploadRes.data?.id;
  const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;

  quotaUsed += 1600; // upload cost

  console.log(`[YouTube] uploaded: ${videoId} — "${title}"`);
  uploadLog.unshift({
    videoId, videoUrl, title,
    privacyStatus, fileSize,
    uploadedAt: new Date().toISOString()
  });
  if (uploadLog.length > 100) uploadLog.length = 100;

  return { videoId, videoUrl };
}

// ─── Process job queue ────────────────────────────────────────────────────────

async function processScriptsDir() {
  if (!fs.existsSync(SCRIPTS_DIR)) return;

  const files = fs.readdirSync(SCRIPTS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_done_'))
    .slice(0, 2); // max 2 per cycle to protect quota

  for (const file of files) {
    const jobPath  = path.join(SCRIPTS_DIR, file);
    let job;
    try { job = JSON.parse(fs.readFileSync(jobPath, 'utf8')); }
    catch (e) { console.error(`[YouTube] bad job file ${file}:`, e.message); continue; }

    // Check quota
    if (quotaUsed + 1600 > 10000) {
      console.warn('[YouTube] daily quota nearly exhausted — stopping uploads');
      break;
    }

    try {
      let videoPath = job.videoPath;

      // Download if URL provided instead of local path
      if (!videoPath && job.videoUrl) {
        const ext  = path.extname(new URL(job.videoUrl).pathname) || '.mp4';
        videoPath  = path.join(VIDEO_DIR, `yt_${Date.now()}${ext}`);
        if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
        console.log(`[YouTube] downloading ${job.videoUrl}...`);
        await downloadVideo(job.videoUrl, videoPath);
      }

      if (!videoPath || !fs.existsSync(videoPath)) {
        console.error(`[YouTube] no video file for job ${file}`);
        fs.renameSync(jobPath, path.join(SCRIPTS_DIR, `_error_${file}`));
        continue;
      }

      const result = await uploadToYouTube({
        title:         job.title       || 'WC 2026 Highlights',
        description:   job.description || '',
        tags:          job.tags        || [],
        categoryId:    job.categoryId  || '17',
        privacyStatus: job.privacyStatus || 'public',
        videoPath
      });

      // Mark job done
      const doneData = { ...job, ...result, completedAt: new Date().toISOString() };
      fs.writeFileSync(path.join(SCRIPTS_DIR, `_done_${file}`), JSON.stringify(doneData, null, 2));
      fs.unlinkSync(jobPath);

      // Clean up downloaded video (keep local originals)
      if (job.videoUrl && videoPath.includes('yt_')) fs.unlink(videoPath, () => {});

      // 5s between uploads
      await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
      console.error(`[YouTube] upload failed for ${file}:`, e.message);
      // Mark with error but don't delete — allow manual retry
      fs.writeFileSync(
        path.join(SCRIPTS_DIR, `_failed_${file}`),
        JSON.stringify({ ...job, error: e.message, failedAt: new Date().toISOString() }, null, 2)
      );
      fs.unlinkSync(jobPath);
    }
  }
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
  // Only process MATCH_END for highlight compilation
  const { eventType } = req.body;
  if (!['MATCH_END', 'ELIMINATION', 'HAT_TRICK'].includes(eventType)) return res.json({ ok: true, skipped: true });

  // Trigger scan
  processScriptsDir().catch(e => console.error('[YouTube trigger]', e.message));
  res.json({ ok: true, message: 'upload scan triggered' });
});

app.post('/upload', auth, async (req, res) => {
  const { title, description, tags, videoPath, videoUrl, privacyStatus } = req.body;
  if (!title) return res.status(400).json({ ok: false, error: 'title required' });
  if (!videoPath && !videoUrl) return res.status(400).json({ ok: false, error: 'videoPath or videoUrl required' });

  try {
    let vPath = videoPath;
    if (!vPath && videoUrl) {
      if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
      vPath = path.join(VIDEO_DIR, `upload_${Date.now()}.mp4`);
      await downloadVideo(videoUrl, vPath);
    }

    const result = await uploadToYouTube({ title, description, tags, videoPath: vPath, privacyStatus });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/schedule', auth, (req, res) => {
  const { title, description, tags, videoPath, videoUrl, privacyStatus = 'public', categoryId = '17' } = req.body;
  if (!title) return res.status(400).json({ ok: false, error: 'title required' });

  if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  const jobFile = path.join(SCRIPTS_DIR, `job_${Date.now()}.json`);
  fs.writeFileSync(jobFile, JSON.stringify({ title, description, tags, videoPath, videoUrl, privacyStatus, categoryId, queuedAt: new Date().toISOString() }, null, 2));

  res.json({ ok: true, jobFile: path.basename(jobFile), message: 'queued for next upload cycle' });
});

app.get('/uploads', (req, res) => {
  res.json({ ok: true, count: uploadLog.length, uploads: uploadLog.slice(0, 20) });
});

app.get('/quota', (req, res) => {
  // Quota resets at midnight Pacific time
  const nowPT   = new Date(Date.now() - 8 * 3600000); // approximate PT offset
  const resetAt  = new Date(nowPT);
  resetAt.setHours(24, 0, 0, 0);
  const remaining = Math.max(0, 10000 - quotaUsed);

  res.json({
    ok:            true,
    quotaUsed,
    remaining,
    maxDaily:      10000,
    uploadsRemaining: Math.floor(remaining / 1600),
    resetsAt:      new Date(resetAt.getTime() + 8 * 3600000).toISOString()
  });
});

app.get('/status', (req, res) => {
  const pendingJobs = fs.existsSync(SCRIPTS_DIR)
    ? fs.readdirSync(SCRIPTS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).length
    : 0;

  res.json({
    ok:           true,
    service:      'youtube-uploader',
    configured:   !!(YT_CLIENT_ID && YT_REFRESH_TOKEN),
    tokenReady:   !!(accessToken && Date.now() < tokenExpiry),
    quotaUsed,
    pendingJobs,
    uploadsToday: uploadLog.filter(u => u.uploadedAt?.startsWith(new Date().toISOString().slice(0, 10))).length
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── One-time auth flow (run locally, not on Railway) ─────────────────────────

async function runAuthFlow() {
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET) {
    console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env first');
    process.exit(1);
  }
  const readline = require('readline');
  const authUrl  = `https://accounts.google.com/o/oauth2/auth?client_id=${YT_CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/youtube.upload&response_type=code&access_type=offline`;

  console.log('\n=== YouTube OAuth2 Auth Flow ===');
  console.log('1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Sign in as your YouTube channel account');
  console.log('3. Paste the authorization code below:\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Authorization code: ', async (code) => {
    rl.close();
    try {
      const r = await axios.post('https://oauth2.googleapis.com/token', null, {
        params: {
          code: code.trim(),
          client_id:     YT_CLIENT_ID,
          client_secret: YT_CLIENT_SECRET,
          redirect_uri:  'urn:ietf:wg:oauth:2.0:oob',
          grant_type:    'authorization_code'
        }
      });
      const { access_token, refresh_token } = r.data;
      console.log('\n✅ Success!');
      console.log(`\nAdd this to your .env file:\nYOUTUBE_REFRESH_TOKEN=${refresh_token}\n`);
      fs.writeFileSync('.youtube-token.json', JSON.stringify({ access_token, refresh_token, timestamp: new Date().toISOString() }, null, 2));
      console.log('Token also saved to .youtube-token.json');
    } catch (e) {
      console.error('Auth failed:', e.response?.data || e.message);
    }
    process.exit(0);
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

if (process.argv.includes('--auth')) {
  runAuthFlow();
} else {
  async function boot() {
    const PORT = process.env.YOUTUBE_PORT || process.env.PORT || 3025;
    app.listen(PORT, () => console.log(`[YouTube Uploader] listening on :${PORT}`));

    if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
    if (!fs.existsSync(VIDEO_DIR))   fs.mkdirSync(VIDEO_DIR, { recursive: true });

    if (!YT_CLIENT_ID)     console.warn('[YouTube] YOUTUBE_CLIENT_ID not set');
    if (!YT_REFRESH_TOKEN) console.warn('[YouTube] YOUTUBE_REFRESH_TOKEN not set — run: node youtube-uploader.js --auth');

    // Reset quota estimate at midnight UTC
    cron.schedule('0 0 * * *', () => { quotaUsed = 0; console.log('[YouTube] quota counter reset'); });

    // Scan for jobs every 30 min (don't scan too often — preserve quota)
    cron.schedule('*/30 * * * *', () => {
      processScriptsDir().catch(e => console.error('[YouTube scan]', e.message));
    });

    // Initial scan after 30s
    setTimeout(() => processScriptsDir().catch(e => console.error('[YouTube boot scan]', e.message)), 30000);

    console.log(`[YouTube Uploader] running on :${PORT} — scanning ${SCRIPTS_DIR} every 30min`);
  }

  boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
}
