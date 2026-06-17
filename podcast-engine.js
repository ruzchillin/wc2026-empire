/**
 * WC 2026 Sports Empire — Podcast Engine
 * Deploy on Railway.app as service "podcast-engine"
 *
 * Generates daily audio podcasts from AI match analysis using TTS,
 * then serves a valid podcast RSS feed (ingested by Spotify, Apple Podcasts,
 * Google Podcasts, Amazon Music, Pocket Casts, 15+ other apps automatically).
 *
 * TTS options (priority order):
 *   1. ElevenLabs free tier (10,000 chars/month — enough for 2-3 episodes)
 *   2. Google Cloud TTS free tier (1M chars/month — best option)
 *   3. Groq TTS (when available)
 *
 * Audio files stored on Railway volume or Cloudflare R2 (free tier).
 *
 * Required env vars:
 *   ELEVENLABS_API_KEY    — from elevenlabs.io (free tier available)
 *   GOOGLE_TTS_KEY        — Google Cloud TTS API key (1M chars free/month)
 *   PODCAST_BASE_URL      — public URL where audio files are served
 *                           e.g. https://podcast-engine.up.railway.app
 *   PODCAST_TITLE         — e.g. "WC 2026 Daily — AI Match Analysis"
 *   PODCAST_AUTHOR        — e.g. "WC 2026 Live"
 *   API_SERVER_URL        — for fetching match data
 *   GROQ_API_KEY          — for generating podcast scripts
 *   PIPELINE_SECRET       — shared inter-service secret
 *
 * Endpoints:
 *   GET  /rss             — podcast RSS feed (submit this URL to Spotify/Apple)
 *   GET  /audio/:file     — serve audio files
 *   POST /generate        — manually trigger episode generation
 *   GET  /episodes        — list all episodes
 *   GET  /status          — health
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const ELEVENLABS_KEY  = process.env.ELEVENLABS_API_KEY  || '';
const GOOGLE_TTS_KEY  = process.env.GOOGLE_TTS_KEY      || '';
const API_SERVER_URL  = process.env.API_SERVER_URL      || 'http://localhost:3001';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET     || '';

const PODCAST_BASE_URL = (process.env.PODCAST_BASE_URL || 'http://localhost:3008').replace(/\/$/, '');
const PODCAST_TITLE    = process.env.PODCAST_TITLE    || 'WC 2026 Daily — AI Match Analysis';
const PODCAST_AUTHOR   = process.env.PODCAST_AUTHOR   || 'WC 2026 Live';
const PODCAST_DESC     = process.env.PODCAST_DESC     || 'Daily AI-powered match previews, predictions, and tournament analysis for the 2026 FIFA World Cup.';

const AUDIO_DIR = path.join(__dirname, 'podcast-audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const EPISODES_FILE = path.join(__dirname, 'podcast-episodes.json');

// ─── Episode store ─────────────────────────────────────────────────────────────

function loadEpisodes() {
  if (!fs.existsSync(EPISODES_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf8')); } catch { return []; }
}

function saveEpisodes(episodes) {
  fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodes, null, 2));
}

// ─── Script generation via Groq ───────────────────────────────────────────────

async function generatePodcastScript(matches, results) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

  
  const matchList = matches.map(m => {
    const ht = m.teams?.home?.name || m.homeTeam || 'TBD';
    const at = m.teams?.away?.name || m.awayTeam || 'TBD';
    const ko = m.fixture?.date ? new Date(m.fixture.date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : 'TBD';
    return `${ht} vs ${at} at ${ko} UTC`;
  }).join('; ');

  const resultsList = results.length
    ? results.map(r => `${r.homeTeam} ${r.homeScore}-${r.awayScore} ${r.awayTeam}`).join('; ')
    : 'No completed matches today';

  const today = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  const prompt = `You are the host of "WC 2026 Daily", a short daily podcast covering the 2026 FIFA World Cup.

Write a natural, engaging 3-4 minute podcast script for ${today}.

Today's matches: ${matchList || 'No matches scheduled'}
Recent results: ${resultsList}

Script requirements:
- Warm, conversational tone — NOT robotic
- Intro: welcome listeners, date, quick tournament context
- Recap any recent results with commentary on what they mean for the tournament
- Preview today's matches: tactical storylines, key players, what's at stake
- Brief AI prediction segment (frame as "our model says...")
- Outro: remind listeners to follow for live goal alerts
- Total length: 350-500 words (reads in ~3-4 minutes at podcast pace)
- NO stage directions, NO section headers, NO asterisks — just the spoken words
- Write as if speaking naturally, include natural pauses via commas and periods

Return ONLY the spoken script text, nothing else.`;

  return await groqClient.complete({ engine: 'podcast-engine', eventType, messages: [{ role: 'user', content: prompt }], max_tokens: 700, temperature: 0.7 }) || '';
}

// ─── TTS: ElevenLabs ─────────────────────────────────────────────────────────

async function ttsElevenLabs(text, outputPath) {
  // Voice ID: "21m00Tcm4TlvDq8ikWAM" = Rachel (neutral, clear)
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

  const r = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    },
    {
      headers: {
        'xi-api-key':   ELEVENLABS_KEY,
        'Content-Type': 'application/json',
        Accept:         'audio/mpeg'
      },
      responseType: 'arraybuffer',
      timeout:      60000
    }
  );

  fs.writeFileSync(outputPath, Buffer.from(r.data));
  console.log(`[TTS:ElevenLabs] written ${outputPath}`);
}

// ─── TTS: Google Cloud ─────────────────────────────────────────────────────────

async function ttsGoogle(text, outputPath) {
  const r = await axios.post(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
    {
      input: { text },
      voice: { languageCode: 'en-US', name: 'en-US-Neural2-D', ssmlGender: 'MALE' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 }
    },
    { timeout: 60000 }
  );

  const audioBuffer = Buffer.from(r.data.audioContent, 'base64');
  fs.writeFileSync(outputPath, audioBuffer);
  console.log(`[TTS:Google] written ${outputPath}`);
}

// ─── Generate audio from script ───────────────────────────────────────────────

async function generateAudio(script, outputPath) {
  if (ELEVENLABS_KEY) {
    await ttsElevenLabs(script, outputPath);
    return 'elevenlabs';
  }
  if (GOOGLE_TTS_KEY) {
    await ttsGoogle(script, outputPath);
    return 'google';
  }
  throw new Error('No TTS configured. Set ELEVENLABS_API_KEY or GOOGLE_TTS_KEY');
}

// ─── Full episode generation ───────────────────────────────────────────────────

async function generateEpisode(context = {}) {
  console.log('[Podcast] generating episode...', context.eventType ? `(triggered by ${context.eventType})` : '');

  const today    = new Date().toISOString().split('T')[0];
  const filename = `wc2026-${today}.mp3`;
  const filepath = path.join(AUDIO_DIR, filename);

  if (fs.existsSync(filepath)) {
    console.log(`[Podcast] episode for ${today} already exists`);
    return { skipped: true, date: today };
  }

  // Fetch today's matches + recent results
  const [todayRes, liveRes] = await Promise.allSettled([
    axios.get(`${API_SERVER_URL}/api/v1/matches/today`, { timeout: 15000 }),
    axios.get(`${API_SERVER_URL}/api/v1/events/recent?limit=20`, { timeout: 15000 })
  ]);

  const matches = todayRes.status === 'fulfilled'
    ? (todayRes.value.data?.matches || todayRes.value.data?.response || [])
    : [];

  const recentEvents = liveRes.status === 'fulfilled'
    ? (liveRes.value.data?.events || [])
    : [];

  const results = recentEvents.filter(e => e.type === 'MATCH_END').map(e => e.detail).filter(Boolean);

  // Generate script
  console.log(`[Podcast] generating script for ${matches.length} match(es)...`);
  const script = await generatePodcastScript(matches, results);
  if (!script) throw new Error('Script generation returned empty');

  console.log(`[Podcast] script ready (${script.length} chars) — generating audio...`);

  // Generate audio
  const ttsProvider = await generateAudio(script, filepath);
  const stats = fs.statSync(filepath);

  // Build episode metadata
  const episode = {
    guid:        `wc2026-episode-${today}`,
    date:        today,
    pubDate:     new Date().toUTCString(),
    title:       `WC 2026 Daily — ${new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}`,
    description: `AI-generated match preview and analysis for ${today}. ${matches.length} match(es) today.`,
    filename,
    audioUrl:    `${PODCAST_BASE_URL}/audio/${filename}`,
    duration:    Math.ceil(stats.size / 16000), // rough estimate: 128kbps
    fileSize:    stats.size,
    ttsProvider,
    scriptPreview: script.slice(0, 200)
  };

  const episodes = loadEpisodes();
  episodes.unshift(episode);
  // Keep 30 days of episodes
  saveEpisodes(episodes.slice(0, 30));

  console.log(`[Podcast] episode generated: ${filename} (${Math.round(stats.size / 1024)}KB)`);
  return episode;
}

// ─── RSS feed generator ───────────────────────────────────────────────────────

function buildRSS(episodes) {
  const escXML = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const items = episodes.map(ep => `
    <item>
      <title>${escXML(ep.title)}</title>
      <description>${escXML(ep.description)}</description>
      <pubDate>${ep.pubDate}</pubDate>
      <guid isPermaLink="false">${ep.guid}</guid>
      <enclosure url="${escXML(ep.audioUrl)}" length="${ep.fileSize}" type="audio/mpeg"/>
      <itunes:duration>${ep.duration}</itunes:duration>
      <itunes:summary>${escXML(ep.description)}</itunes:summary>
      <itunes:explicit>false</itunes:explicit>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escXML(PODCAST_TITLE)}</title>
    <description>${escXML(PODCAST_DESC)}</description>
    <link>${PODCAST_BASE_URL}</link>
    <language>en</language>
    <itunes:author>${escXML(PODCAST_AUTHOR)}</itunes:author>
    <itunes:category text="Sports"/>
    <itunes:category text="Sports"><itunes:category text="Soccer"/></itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <atom:link href="${PODCAST_BASE_URL}/rss" rel="self" type="application/rss+xml"/>
    <image>
      <url>${PODCAST_BASE_URL}/cover.jpg</url>
      <title>${escXML(PODCAST_TITLE)}</title>
      <link>${PODCAST_BASE_URL}</link>
    </image>
    ${items}
  </channel>
</rss>`;
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// Podcast RSS feed — submit THIS URL to Spotify for Podcasters + Apple Podcasts Connect
app.get('/rss', (req, res) => {
  const episodes = loadEpisodes();
  const rss = buildRSS(episodes);
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(rss);
});

// Serve audio files
app.use('/audio', express.static(AUDIO_DIR));

// Manual trigger
app.post('/generate', auth, async (req, res) => {
  try {
    const result = await generateEpisode();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/episodes', (req, res) => {
  const episodes = loadEpisodes();
  res.json({ ok: true, count: episodes.length, episodes });
});

app.get('/status', (req, res) => {
  const episodes = loadEpisodes();
  res.json({
    ok:         true,
    service:    'podcast-engine',
    rssUrl:     `${PODCAST_BASE_URL}/rss`,
    ttsProvider: ELEVENLABS_KEY ? 'elevenlabs' : GOOGLE_TTS_KEY ? 'google' : 'none configured',
    episodeCount: episodes.length,
    latestEpisode: episodes[0]?.date || null,
    submitTo: {
      spotify:       'https://podcasters.spotify.com/pod/submit',
      apple:         'https://podcastsconnect.apple.com',
      amazon:        'https://music.amazon.com/podcasts/submit',
      google:        'Automatic via Spotify/Apple after approval'
    }
  });
});

// moment-engine event trigger — queue episode generation for high-value events
app.post('/trigger', auth, async (req, res) => {
  const { eventType, homeTeam, awayTeam, player, matchId } = req.body || {};
  const EPISODE_EVENTS = ['MATCH_END', 'ELIMINATION', 'UPSET', 'HAT_TRICK'];
  if (!EPISODE_EVENTS.includes(eventType)) {
    return res.json({ ok: true, service: 'podcast-engine', action: 'skipped', reason: `event ${eventType} not in episode trigger list` });
  }
  // Queue async — don't block moment-engine's 8s dispatch window
  setImmediate(async () => {
    try {
      await generateEpisode({ eventType, homeTeam, awayTeam, player, matchId });
    } catch (e) {
      console.error(`[Podcast /trigger] episode generation failed:`, e.message);
    }
  });
  res.json({ ok: true, service: 'podcast-engine', action: 'queued', eventType });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.PODCAST_PORT || process.env.PORT || 3008;
  app.listen(PORT, () => console.log(`[Podcast Engine] listening on :${PORT}`));

  if (!process.env.GROQ_API_KEY) console.warn('[Podcast] GROQ_API_KEY not set — episode generation disabled');
  if (!ELEVENLABS_KEY && !GOOGLE_TTS_KEY) console.warn('[Podcast] No TTS configured — set ELEVENLABS_API_KEY or GOOGLE_TTS_KEY');

  // Generate episode daily at 07:00 UTC (pre-match, before today's games)
  cron.schedule('0 7 * * *', async () => {
    console.log('[Podcast] daily episode generation triggered');
    try { await generateEpisode(); }
    catch (e) { console.error('[Podcast] episode generation failed:', e.message); }
  });

  console.log(`[Podcast Engine] running
  RSS feed: ${PODCAST_BASE_URL}/rss
  Episode generation: daily 07:00 UTC
  TTS: ${ELEVENLABS_KEY ? 'ElevenLabs' : GOOGLE_TTS_KEY ? 'Google TTS' : 'NOT CONFIGURED'}

  After first episode is generated, submit RSS URL to:
    Spotify:  https://podcasters.spotify.com/pod/submit
    Apple:    https://podcastsconnect.apple.com
  `);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
