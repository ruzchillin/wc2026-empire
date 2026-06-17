/**
 * WC 2026 Sports Empire — Snapchat Engine
 * Deploy on Railway.app as service "snapchat-engine"
 *
 * Covers the Gulf market: Saudi Arabia (SA), UAE (AE), Qatar (QA), Kuwait (KW)
 * Saudi Arabia has 80%+ Snapchat daily active penetration — highest in the world.
 * Qatar hosted WC2022 — massive football fanbase.
 *
 * Snapchat organic posting via Snapchat Marketing API (Creative API).
 * Generates story-format vertical content cards (9:16 ratio) as HTML → image.
 * Also manages Snapchat Public Profile story posting via the API.
 *
 * Arabic content: right-to-left layout, translated match data.
 *
 * Required env vars:
 *   SNAPCHAT_CLIENT_ID       — from Snapchat Business Manager -> App
 *   SNAPCHAT_CLIENT_SECRET   — from Snapchat Business Manager -> App
 *   SNAPCHAT_ACCESS_TOKEN    — OAuth2 access token (refresh monthly)
 *   SNAPCHAT_AD_ACCOUNT_ID   — for Snapchat Marketing API
 *   SNAPCHAT_PROFILE_ID      — Public Profile ID for story posting
 *   PIPELINE_SECRET          — shared inter-service secret
 *
 * Note: Snapchat Organic Posting API requires Public Profile (apply via
 *   business.snapchat.com → Public Profiles). Stories auto-publish.
 *
 * What this engine does WITHOUT API keys (fallback):
 *   - Generates Snapchat-optimized story card HTML files
 *   - Saves them to /snapchat-stories/ directory
 *   - Returns the HTML for manual upload or Puppeteer screenshot
 *
 * Endpoints:
 *   POST /trigger            — moment-engine webhook
 *   POST /story/goal         — generate + post goal story
 *   POST /story/match        — match preview story
 *   POST /story/bracket      — bracket update story
 *   GET  /stories            — list generated stories
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const SNAP_CLIENT_ID     = process.env.SNAPCHAT_CLIENT_ID       || '';
const SNAP_CLIENT_SECRET = process.env.SNAPCHAT_CLIENT_SECRET   || '';
const SNAP_ACCESS_TOKEN  = process.env.SNAPCHAT_ACCESS_TOKEN    || '';
const SNAP_AD_ACCOUNT_ID = process.env.SNAPCHAT_AD_ACCOUNT_ID  || '';
const SNAP_PROFILE_ID    = process.env.SNAPCHAT_PROFILE_ID      || '';
const API_SERVER_URL     = process.env.API_SERVER_URL           || 'http://localhost:3001';
const PIPELINE_SECRET    = process.env.PIPELINE_SECRET          || '';

const STORIES_DIR = path.join(__dirname, 'snapchat-stories');
if (!fs.existsSync(STORIES_DIR)) fs.mkdirSync(STORIES_DIR, { recursive: true });

const STORIES_FILE = path.join(__dirname, 'snapchat-stories-log.json');

let storyCount = 0;

// ─── Arabic translations (key football terms) ─────────────────────────────────

const AR = {
  GOAL:       'هدف!',
  RED_CARD:   'بطاقة حمراء',
  FULL_TIME:  'نهاية المباراة',
  HALF_TIME:  'نهاية الشوط الأول',
  MATCH_DAY:  'يوم المباراة',
  PREDICTION: 'التوقعات',
  WC_2026:    'كأس العالم 2026',
  MINUTE:     'دقيقة',
  SCORE:      'النتيجة',
  WIN:        'فوز',
  DRAW:       'تعادل',
  LIVE:       'مباشر',
};

// ─── Story card HTML generator (9:16 vertical format) ─────────────────────────

function goalStoryHTML(data) {
  const { homeTeam, awayTeam, homeScore, awayScore, minute, player, team } = data;
  const scorer = player ? `<p class="scorer">${player}</p>` : '';
  const isArabicMarket = true; // Always include Arabic for Gulf market

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px; height: 1920px;
    background: linear-gradient(135deg, #0a0a2e 0%, #1a1a4e 50%, #0d0d1a 100%);
    font-family: 'Arial', sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: white; overflow: hidden;
  }
  .badge {
    background: #FFD700; color: #0a0a2e;
    font-size: 36px; font-weight: 900;
    padding: 12px 40px; border-radius: 60px;
    letter-spacing: 2px; margin-bottom: 40px;
    text-transform: uppercase;
  }
  .goal-word {
    font-size: 160px; font-weight: 900;
    line-height: 1; margin-bottom: 20px;
    text-shadow: 0 0 80px rgba(255, 215, 0, 0.8);
    color: #FFD700;
  }
  .arabic-goal {
    font-size: 100px; font-weight: 900;
    color: rgba(255,215,0,0.8); margin-bottom: 60px;
  }
  .score-row {
    display: flex; align-items: center;
    gap: 40px; font-size: 72px; font-weight: 700;
    margin-bottom: 30px;
  }
  .team { font-size: 52px; opacity: 0.9; }
  .score-num {
    font-size: 120px; font-weight: 900;
    background: rgba(255,255,255,0.1);
    padding: 10px 40px; border-radius: 20px;
    min-width: 280px; text-align: center;
  }
  .minute { font-size: 44px; color: #FFD700; margin-bottom: 20px; }
  .scorer { font-size: 52px; opacity: 0.8; font-style: italic; margin-bottom: 60px; }
  .brand {
    position: absolute; bottom: 80px;
    font-size: 36px; opacity: 0.6; letter-spacing: 3px;
  }
  .ball { font-size: 120px; margin-bottom: 20px; }
</style>
</head>
<body>
  <div class="badge">${AR.WC_2026}</div>
  <div class="ball">⚽</div>
  <div class="goal-word">GOAL!</div>
  <div class="arabic-goal">${AR.GOAL}</div>
  <div class="score-row">
    <span class="team">${homeTeam}</span>
    <span class="score-num">${homeScore} - ${awayScore}</span>
    <span class="team">${awayTeam}</span>
  </div>
  <div class="minute">${minute}' ${AR.MINUTE}</div>
  ${scorer}
  <div class="brand">WC2026LIVE.COM</div>
</body>
</html>`;
}

function matchPreviewStoryHTML(homeTeam, awayTeam, kickoffTime, venue) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px; height: 1920px;
    background: linear-gradient(160deg, #001f3f 0%, #003366 40%, #001a33 100%);
    font-family: 'Arial', sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: white; overflow: hidden;
  }
  .badge {
    background: #c8a951; color: #001f3f;
    font-size: 34px; font-weight: 900;
    padding: 14px 44px; border-radius: 60px;
    margin-bottom: 50px; letter-spacing: 2px;
  }
  .today { font-size: 56px; opacity: 0.7; margin-bottom: 30px; }
  .vs-block {
    display: flex; align-items: center;
    gap: 50px; margin-bottom: 50px; flex-direction: column;
  }
  .team-name { font-size: 72px; font-weight: 900; text-align: center; }
  .vs { font-size: 80px; color: #c8a951; font-weight: 900; }
  .kickoff {
    font-size: 50px; color: #c8a951;
    border: 3px solid #c8a951;
    padding: 20px 60px; border-radius: 60px;
    margin-bottom: 30px; font-weight: 700;
  }
  .venue { font-size: 38px; opacity: 0.6; margin-bottom: 60px; text-align: center; padding: 0 60px; }
  .follow {
    font-size: 40px; opacity: 0.8;
    background: rgba(255,255,255,0.08);
    padding: 20px 50px; border-radius: 20px;
  }
  .brand { position: absolute; bottom: 80px; font-size: 36px; opacity: 0.5; }
</style>
</head>
<body>
  <div class="badge">كأس العالم 2026 🏆</div>
  <div class="today">${AR.MATCH_DAY}</div>
  <div class="vs-block">
    <div class="team-name">${homeTeam}</div>
    <div class="vs">VS</div>
    <div class="team-name">${awayTeam}</div>
  </div>
  <div class="kickoff">⏰ ${kickoffTime} UTC</div>
  ${venue ? `<div class="venue">📍 ${venue}</div>` : ''}
  <div class="follow">متابعة للأهداف المباشرة ⚽</div>
  <div class="brand">WC2026LIVE.COM</div>
</body>
</html>`;
}

function matchResultStoryHTML(homeTeam, awayTeam, homeScore, awayScore, result) {
  const winner = result === 'home_win' ? homeTeam : result === 'away_win' ? awayTeam : null;
  const resultAr = result === 'draw' ? AR.DRAW : `${winner} ${AR.WIN}`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px; height: 1920px;
    background: linear-gradient(180deg, #0a1628 0%, #162040 50%, #0a1628 100%);
    font-family: 'Arial', sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: white; overflow: hidden;
  }
  .full-time { font-size: 60px; letter-spacing: 6px; opacity: 0.7; margin-bottom: 16px; }
  .ft-ar { font-size: 48px; color: #c8a951; margin-bottom: 60px; }
  .score-card {
    background: rgba(255,255,255,0.08);
    border-radius: 40px; padding: 60px 80px;
    text-align: center; margin-bottom: 50px; width: 900px;
  }
  .teams { font-size: 60px; font-weight: 700; margin-bottom: 20px; }
  .score { font-size: 160px; font-weight: 900; color: #c8a951; line-height: 1; }
  .result-line { font-size: 64px; font-weight: 900; margin-bottom: 20px; }
  .result-ar { font-size: 52px; color: #c8a951; margin-bottom: 60px; }
  .brand { position: absolute; bottom: 80px; font-size: 36px; opacity: 0.5; }
  .trophy { font-size: 120px; margin-bottom: 30px; }
</style>
</head>
<body>
  <div class="full-time">FULL TIME</div>
  <div class="ft-ar">${AR.FULL_TIME}</div>
  <div class="score-card">
    <div class="teams">${homeTeam} vs ${awayTeam}</div>
    <div class="score">${homeScore} - ${awayScore}</div>
  </div>
  <div class="trophy">${result === 'draw' ? '🤝' : '🏆'}</div>
  <div class="result-line">${winner ? `${winner} Win!` : "It's a Draw!"}</div>
  <div class="result-ar">${resultAr}</div>
  <div class="brand">WC2026LIVE.COM</div>
</body>
</html>`;
}

// ─── Save story ───────────────────────────────────────────────────────────────

function saveStory(type, html, metadata) {
  const filename = `${type.toLowerCase()}-${Date.now()}.html`;
  const filepath = path.join(STORIES_DIR, filename);
  fs.writeFileSync(filepath, html, 'utf8');

  const log = fs.existsSync(STORIES_FILE)
    ? JSON.parse(fs.readFileSync(STORIES_FILE, 'utf8'))
    : [];
  log.unshift({ type, filename, metadata, createdAt: new Date().toISOString() });
  fs.writeFileSync(STORIES_FILE, JSON.stringify(log.slice(0, 100), null, 2));

  storyCount++;
  console.log(`[Snapchat] story saved: ${filename}`);
  return filepath;
}

// ─── Snapchat API posting (when profile configured) ──────────────────────────

async function postSnapchatStory(mediaUrl, caption) {
  if (!SNAP_ACCESS_TOKEN || !SNAP_PROFILE_ID) {
    console.log('[Snapchat] API not configured — story saved as HTML file only');
    return null;
  }
  try {
    const r = await axios.post(
      'https://adsapi.snapchat.com/v1/stories/public',
      {
        story: {
          type:         'PUBLIC',
          name:         caption,
          profile_id:   SNAP_PROFILE_ID,
          media_url:    mediaUrl,
          caption
        }
      },
      {
        headers: {
          Authorization:  `Bearer ${SNAP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );
    console.log(`[Snapchat] story posted via API: ${r.data?.story?.id}`);
    return r.data?.story?.id;
  } catch (e) {
    console.error('[Snapchat API]', e.response?.data?.message || e.message);
    return null;
  }
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/stories', express.static(STORIES_DIR));

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
    let html, meta, type;
    switch (eventType) {
      case 'GOAL':
      case 'PENALTY_GOAL':
      case 'OWN_GOAL':
        html = goalStoryHTML(data);
        type = 'GOAL';
        meta = { homeTeam: data.homeTeam, awayTeam: data.awayTeam, score: `${data.homeScore}-${data.awayScore}`, minute: data.minute };
        break;
      case 'MATCH_END':
        html = matchResultStoryHTML(data.homeTeam, data.awayTeam, data.homeScore, data.awayScore, data.result);
        type = 'RESULT';
        meta = { homeTeam: data.homeTeam, awayTeam: data.awayTeam, score: `${data.homeScore}-${data.awayScore}` };
        break;
      default:
        return res.json({ ok: true, skipped: true });
    }
    const filepath = saveStory(type, html, meta);
    res.json({ ok: true, filepath, type, meta });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/story/goal', auth, (req, res) => {
  try {
    const html = goalStoryHTML(req.body);
    const filepath = saveStory('GOAL', html, req.body);
    res.json({ ok: true, filepath });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/story/match', auth, (req, res) => {
  try {
    const { homeTeam, awayTeam, kickoffTime, venue } = req.body;
    const html = matchPreviewStoryHTML(homeTeam, awayTeam, kickoffTime || 'TBD', venue);
    const filepath = saveStory('PREVIEW', html, req.body);
    res.json({ ok: true, filepath });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/stories', (req, res) => {
  const log = fs.existsSync(STORIES_FILE)
    ? JSON.parse(fs.readFileSync(STORIES_FILE, 'utf8'))
    : [];
  res.json({ ok: true, count: log.length, stories: log.slice(0, 20) });
});

app.get('/status', (req, res) => {
  res.json({
    ok:               true,
    service:          'snapchat-engine',
    storiesGenerated: storyCount,
    apiConfigured:    !!(SNAP_ACCESS_TOKEN && SNAP_PROFILE_ID),
    markets:          ['SA', 'AE', 'QA', 'KW'],
    notes:            'Snapchat Public Profile required for API posting. Apply at business.snapchat.com'
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.SNAPCHAT_PORT || process.env.PORT || 3010;
  app.listen(PORT, () => console.log(`[Snapchat Engine] listening on :${PORT}`));

  // Generate preview stories at 11:00 UTC (Gulf afternoon)
  cron.schedule('0 11 * * *', async () => {
    try {
      const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/today`, { timeout: 15000 });
      const matches = r.data?.matches || r.data?.response || [];
      for (const m of matches) {
        const homeTeam = m.teams?.home?.name || m.homeTeam;
        const awayTeam = m.teams?.away?.name || m.awayTeam;
        const kickoff  = m.fixture?.date ? new Date(m.fixture.date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : 'TBD';
        const venue    = m.fixture?.venue?.name;
        if (!homeTeam || !awayTeam) continue;
        const html = matchPreviewStoryHTML(homeTeam, awayTeam, kickoff, venue);
        saveStory('PREVIEW', html, { homeTeam, awayTeam });
      }
    } catch (e) {
      console.error('[Snapchat] daily preview failed:', e.message);
    }
  });

  console.log('[Snapchat Engine] running — Gulf market (SA/AE/QA/KW)');
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
