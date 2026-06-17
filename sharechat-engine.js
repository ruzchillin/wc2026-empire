/**
 * WC 2026 Sports Empire — ShareChat Engine (India)
 * Deploy on Railway.app as service "sharechat-engine"
 *
 * ShareChat: India's largest regional language social media platform.
 * 250M+ registered users, 60M+ DAU. Heavy in Hindi, Tamil, Telugu, Bengali.
 * India is NOT in WC2026 but has ~500M football fans (ISL, EPL popularity).
 *
 * Also covers Moj (short video — ShareChat-owned, 160M users).
 *
 * ShareChat doesn't have a public posting API for organic content.
 * This engine:
 *   1. Generates ShareChat-optimized content in Hindi + 5 Indian regional languages
 *   2. Creates image cards sized for ShareChat (1:1 square format)
 *   3. Saves content + cards for manual posting or Creator Studio upload
 *   4. Generates content schedule for 5 daily posts (optimal for ShareChat algorithm)
 *
 * Required env vars:
 *   GROQ_API_KEY         — for multilingual content generation
 *   API_SERVER_URL       — for match data
 *   PIPELINE_SECRET      — shared inter-service secret
 *
 * Endpoints:
 *   POST /trigger            — moment-engine webhook → generates content
 *   POST /generate/post      — generate ShareChat post in specified language
 *   GET  /schedule           — today's content schedule
 *   GET  /content            — list generated content
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const API_SERVER_URL  = process.env.API_SERVER_URL  || 'http://localhost:3001';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';

const CONTENT_DIR  = path.join(__dirname, 'sharechat-content');
const CONTENT_FILE = path.join(__dirname, 'sharechat-log.json');
if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

// ─── Indian language config ───────────────────────────────────────────────────

const LANGUAGES = {
  hi: { name: 'Hindi',   dir: 'ltr', audience: 'North India — 500M Hindi speakers' },
  ta: { name: 'Tamil',   dir: 'ltr', audience: 'Tamil Nadu, Sri Lanka — 80M speakers' },
  te: { name: 'Telugu',  dir: 'ltr', audience: 'Andhra Pradesh, Telangana — 100M speakers' },
  bn: { name: 'Bengali', dir: 'ltr', audience: 'West Bengal, Bangladesh — 270M speakers' },
  mr: { name: 'Marathi', dir: 'ltr', audience: 'Maharashtra — 90M speakers' },
  kn: { name: 'Kannada', dir: 'ltr', audience: 'Karnataka — 60M speakers' }
};

// ─── Content generation ───────────────────────────────────────────────────────

async function generateShareChatPost(type, data, langCode = 'hi') {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

  const lang = LANGUAGES[langCode] || LANGUAGES.hi;
  
  let prompt;
  let hashtags;

  if (type === 'GOAL') {
    const { homeTeam, awayTeam, homeScore, awayScore, minute, player } = data;
    prompt = `Write a short, exciting ${lang.name} social media post about a GOAL scored at the 2026 FIFA World Cup.
Match: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}, ${minute}' ${player ? `(${player})` : ''}
Write in ${lang.name} language. 50-80 words. Exciting, emoji-rich. Include WC2026 hashtag in ${lang.name}.
End with 3-4 relevant hashtags in ${lang.name}.`;
    hashtags = ['#WorldCup2026', '#WC2026', '#Football'];
  } else if (type === 'MATCH_PREVIEW') {
    const { homeTeam, awayTeam, kickoff } = data;
    prompt = `Write a match preview post in ${lang.name} for ShareChat.
Match: ${homeTeam} vs ${awayTeam} at the 2026 FIFA World Cup.
Write in ${lang.name} language. 80-100 words. Include key facts, excitement about the match.
Add 4-5 relevant hashtags in ${lang.name} at the end.`;
    hashtags = ['#WorldCup2026', '#WC2026'];
  } else if (type === 'MATCH_RESULT') {
    const { homeTeam, awayTeam, homeScore, awayScore, result } = data;
    const winner = result === 'home_win' ? homeTeam : result === 'away_win' ? awayTeam : null;
    prompt = `Write a match result post in ${lang.name} for ShareChat.
Result: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}. ${winner ? `${winner} won.` : 'Draw.'}
Write in ${lang.name} language. 60-80 words. Analyze the result's impact.
Add 4-5 relevant hashtags in ${lang.name}.`;
    hashtags = ['#WorldCup2026', '#WC2026', '#Football'];
  } else if (type === 'GENERAL_FOOTBALL') {
    prompt = `Write an engaging football fact or trivia post in ${lang.name} about the FIFA World Cup.
Something interesting about WC history, memorable moments, or legendary players.
Write in ${lang.name}. 60-80 words. Educational but fun. Add 4-5 relevant hashtags.`;
    hashtags = ['#WorldCup2026', '#Football', '#FIFA'];
  }

  const text = await groqClient.complete({ engine: 'sharechat-engine', eventType, messages: [{ role: 'user', content: prompt }], max_tokens: 300, temperature: 0.8 }) || '';
  return { text, hashtags, language: langCode, langName: lang.name };
}

// ─── Image card generator (1080x1080 square for ShareChat) ───────────────────

function generateShareChatCard(type, data, content) {
  const colors = {
    GOAL:          { bg: '#1a0a3d', accent: '#FFD700', emoji: '⚽' },
    MATCH_PREVIEW: { bg: '#003366', accent: '#c8a951', emoji: '🏆' },
    MATCH_RESULT:  { bg: '#0d1b2a', accent: '#4fc3f7', emoji: '🏁' },
    GENERAL:       { bg: '#1a2a1a', accent: '#4caf50', emoji: '⚽' }
  };

  const { bg, accent, emoji } = colors[type] || colors.GENERAL;
  const { homeTeam, awayTeam, homeScore, awayScore, minute } = data;

  const scoreRow = homeTeam ? `
    <div class="score-row">
      <span class="team">${homeTeam || ''}</span>
      <span class="score">${homeScore ?? ''} ${homeScore !== undefined ? '-' : ''} ${awayScore ?? ''}</span>
      <span class="team">${awayTeam || ''}</span>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="${content.language}">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px; height: 1080px;
    background: ${bg};
    font-family: 'Noto Sans', Arial, sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: white; padding: 60px; overflow: hidden;
  }
  .emoji { font-size: 100px; margin-bottom: 30px; }
  .badge {
    background: ${accent}; color: ${bg};
    font-size: 28px; font-weight: 900;
    padding: 10px 36px; border-radius: 50px;
    margin-bottom: 40px; letter-spacing: 2px;
  }
  .content {
    font-size: 36px; line-height: 1.5;
    text-align: center; margin-bottom: 40px;
    opacity: 0.95; max-width: 900px;
  }
  .score-row {
    display: flex; gap: 30px; align-items: center;
    font-size: 48px; font-weight: 900;
    margin-bottom: 30px;
    background: rgba(255,255,255,0.08);
    padding: 20px 40px; border-radius: 20px;
  }
  .score { font-size: 72px; color: ${accent}; min-width: 150px; text-align: center; }
  .team { font-size: 36px; }
  .brand { font-size: 28px; opacity: 0.5; margin-top: 40px; letter-spacing: 3px; }
</style>
</head>
<body>
  <div class="emoji">${emoji}</div>
  <div class="badge">2026 FIFA World Cup 🌍</div>
  ${scoreRow}
  <div class="content">${content.text.slice(0, 200)}</div>
  <div class="brand">WC2026LIVE.COM</div>
</body>
</html>`;
}

// ─── Save content ─────────────────────────────────────────────────────────────

function saveContent(type, data, posts) {
  const ts       = Date.now();
  const filename = `sharechat-${type.toLowerCase()}-${ts}`;

  // Save each language variant
  for (const post of posts) {
    const htmlFile = path.join(CONTENT_DIR, `${filename}-${post.language}.html`);
    const card     = generateShareChatCard(type, data, post);
    fs.writeFileSync(htmlFile, card, 'utf8');

    const textFile = path.join(CONTENT_DIR, `${filename}-${post.language}.txt`);
    fs.writeFileSync(textFile, post.text, 'utf8');
  }

  const log = fs.existsSync(CONTENT_FILE)
    ? JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'))
    : [];
  log.unshift({ type, data: { homeTeam: data.homeTeam, awayTeam: data.awayTeam }, posts: posts.map(p => ({ language: p.language, langName: p.langName, textPreview: p.text.slice(0, 100) })), filename, createdAt: new Date().toISOString() });
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(log.slice(0, 100), null, 2));

  return filename;
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/files', express.static(CONTENT_DIR));

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

async function generateAllLanguages(type, data) {
  const targetLangs = ['hi', 'ta', 'te', 'bn']; // 4 main languages for ShareChat
  const posts = await Promise.allSettled(
    targetLangs.map(lang => generateShareChatPost(type, data, lang))
  );
  return posts
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  try {
    let type;
    if (['GOAL', 'PENALTY_GOAL', 'OWN_GOAL'].includes(eventType)) type = 'GOAL';
    else if (eventType === 'MATCH_END') type = 'MATCH_RESULT';
    else return res.json({ ok: true, skipped: true });

    const posts    = await generateAllLanguages(type, data);
    const filename = saveContent(type, data, posts);
    res.json({ ok: true, filename, languageCount: posts.length, languages: posts.map(p => p.language) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/generate/post', auth, async (req, res) => {
  try {
    const { type = 'MATCH_PREVIEW', data = {}, language = 'hi' } = req.body;
    const post     = await generateShareChatPost(type, data, language);
    const filename = saveContent(type, data, [post]);
    res.json({ ok: true, ...post, filename });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/generate/all-languages', auth, async (req, res) => {
  try {
    const { type = 'MATCH_PREVIEW', data = {} } = req.body;
    const posts    = await generateAllLanguages(type, data);
    const filename = saveContent(type, data, posts);
    res.json({ ok: true, filename, count: posts.length, posts });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/schedule', async (req, res) => {
  // Return optimal 5-post daily schedule for ShareChat
  res.json({
    ok: true,
    todaySchedule: [
      { time: '08:30 IST', type: 'MATCH_PREVIEW',   note: 'Morning match preview' },
      { time: '11:00 IST', type: 'GENERAL_FOOTBALL', note: 'Football trivia/fact' },
      { time: '14:00 IST', type: 'MATCH_PREVIEW',   note: 'Afternoon preview' },
      { time: '19:30 IST', type: 'LIVE_UPDATE',      note: 'Evening match updates' },
      { time: '22:00 IST', type: 'MATCH_RESULT',    note: 'Day results recap' }
    ],
    languages: Object.entries(LANGUAGES).map(([code, lang]) => ({ code, name: lang.name, audience: lang.audience }))
  });
});

app.get('/content', (req, res) => {
  const log = fs.existsSync(CONTENT_FILE)
    ? JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'))
    : [];
  res.json({ ok: true, count: log.length, content: log.slice(0, 20) });
});

app.get('/status', (req, res) => {
  res.json({
    ok:       true,
    service:  'sharechat-engine',
    platform: 'ShareChat + Moj',
    market:   'India',
    users:    '250M+ ShareChat, 160M+ Moj',
    languages: Object.keys(LANGUAGES),
    note:     'Content generated automatically. Upload via ShareChat Creator Studio or manually.'
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.SHARECHAT_PORT || process.env.PORT || 3012;
  app.listen(PORT, () => console.log(`[ShareChat Engine] listening on :${PORT}`));

  if (!process.env.GROQ_API_KEY) console.warn('[ShareChat] GROQ_API_KEY not set — content generation disabled');

  // Daily match previews at 03:00 UTC (08:30 IST)
  cron.schedule('0 3 * * *', async () => {
    try {
      const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/today`, { timeout: 15000 });
      const matches = r.data?.matches || r.data?.response || [];
      for (const m of matches) {
        const homeTeam = m.teams?.home?.name || m.homeTeam;
        const awayTeam = m.teams?.away?.name || m.awayTeam;
        if (!homeTeam || !awayTeam) continue;
        const posts = await generateAllLanguages('MATCH_PREVIEW', { homeTeam, awayTeam, kickoff: m.fixture?.date });
        saveContent('MATCH_PREVIEW', { homeTeam, awayTeam }, posts);
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error('[ShareChat] daily preview failed:', e.message);
    }
  });

  console.log('[ShareChat Engine] running — India market (IN) in 6 languages');
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
