/**
 * WC 2026 Sports Empire — Twitch Bot
 * Deploy on Railway.app as service "twitch-bot"
 *
 * Joins top WC2026 watch-party streams and posts live scores, goals,
 * and AI predictions in chat. Reaches the active live-viewing audience.
 *
 * Strategy:
 *   - Monitor Twitch for streams tagged "WorldCup2026", "WC2026", "soccer"
 *   - Auto-join top streams by viewer count during match times
 *   - Post goal alerts within 30 seconds of detection
 *   - Respond to !score, !predict, !bracket, !odds commands
 *   - Never spam: max 1 message per 90 seconds per channel
 *   - Leave when match ends, join next active stream
 *
 * Required env vars:
 *   TWITCH_BOT_USERNAME   — your Twitch bot account username
 *   TWITCH_BOT_TOKEN      — OAuth token (get at twitchapps.com/tmi/)
 *                           format: oauth:xxxxxx
 *   TWITCH_CLIENT_ID      — from dev.twitch.tv -> Your Applications
 *   TWITCH_CLIENT_SECRET  — from dev.twitch.tv -> Your Applications
 *   TWITCH_APP_TOKEN      — app access token (auto-fetched on boot)
 *   VERCEL_URL            — your main site for linking
 *   API_SERVER_URL        — for live match data
 *   PIPELINE_SECRET       — shared inter-service secret
 *
 * Bot account setup:
 *   1. Create a separate Twitch account (e.g. WC2026LiveBot)
 *   2. Go to twitchapps.com/tmi/ → connect → copy oauth token
 *   3. Set TWITCH_BOT_USERNAME and TWITCH_BOT_TOKEN env vars
 *
 * Endpoints:
 *   POST /trigger          — moment-engine webhook → alert in all joined channels
 *   POST /join             — join a channel manually
 *   POST /leave            — leave a channel
 *   GET  /channels         — list joined channels
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const tmi     = require('tmi.js');
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const BOT_USERNAME  = process.env.TWITCH_BOT_USERNAME || '';
const BOT_TOKEN     = process.env.TWITCH_BOT_TOKEN    || ''; // oauth:xxxxx
const CLIENT_ID     = process.env.TWITCH_CLIENT_ID    || '';
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const VERCEL_URL    = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const API_SERVER_URL = process.env.API_SERVER_URL     || 'http://localhost:3001';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET   || '';

// ─── State ────────────────────────────────────────────────────────────────────

let client        = null;
let appToken      = null;
const joinedChannels = new Set();
const lastMessageTime = {}; // channel -> timestamp
const messageCount    = { total: 0 };

// Rate limit: 1 message per 90s per channel (Twitch chat etiquette)
function canSend(channel) {
  const now  = Date.now();
  const last = lastMessageTime[channel] || 0;
  if (now - last < 90000) return false;
  lastMessageTime[channel] = now;
  return true;
}

async function sendMessage(channel, message) {
  if (!client) return;
  const chan = channel.startsWith('#') ? channel : `#${channel}`;
  if (!canSend(chan)) {
    console.log(`[Twitch] rate limited in ${chan} — skipping`);
    return;
  }
  try {
    await client.say(chan, message);
    messageCount.total++;
    console.log(`[Twitch] ${chan}: ${message.slice(0, 80)}`);
  } catch (e) {
    console.error(`[Twitch] send error in ${chan}:`, e.message);
  }
}

// ─── Twitch Helix API (stream discovery) ─────────────────────────────────────

async function getAppToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  const r = await axios.post(
    'https://id.twitch.tv/oauth2/token',
    new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'client_credentials'
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
  );
  return r.data.access_token;
}

async function findWC2026Streams() {
  if (!appToken || !CLIENT_ID) return [];
  try {
    const searchTerms = ['worldcup2026', 'wc2026', 'world cup 2026', 'copa mundo 2026'];
    const results = [];

    for (const query of searchTerms) {
      const r = await axios.get('https://api.twitch.tv/helix/streams', {
        params: { game_id: '1229', first: 20 }, // 1229 = Soccer game category on Twitch
        headers: { 'Client-ID': CLIENT_ID, Authorization: `Bearer ${appToken}` },
        timeout: 10000
      });
      if (r.data?.data) results.push(...r.data.data);
    }

    // Also search by title
    const byTitle = await axios.get('https://api.twitch.tv/helix/streams', {
      params: { query: 'world cup 2026', first: 20 },
      headers: { 'Client-ID': CLIENT_ID, Authorization: `Bearer ${appToken}` },
      timeout: 10000
    }).catch(() => ({ data: { data: [] } }));

    results.push(...(byTitle.data?.data || []));

    // Deduplicate by user_login, sort by viewer count
    const seen = new Set();
    return results
      .filter(s => { if (seen.has(s.user_login)) return false; seen.add(s.user_login); return true; })
      .sort((a, b) => b.viewer_count - a.viewer_count)
      .slice(0, 5); // join top 5 streams
  } catch (e) {
    console.error('[Twitch Discovery]', e.message);
    return [];
  }
}

// ─── Auto-join WC2026 streams ─────────────────────────────────────────────────

async function joinWC2026Streams() {
  const streams = await findWC2026Streams();
  if (!streams.length) {
    console.log('[Twitch] no WC2026 streams found currently');
    return;
  }

  for (const stream of streams) {
    const channel = stream.user_login;
    if (!joinedChannels.has(channel)) {
      try {
        await client?.join(channel);
        joinedChannels.add(channel);
        console.log(`[Twitch] joined #${channel} (${stream.viewer_count} viewers)`);
        // Send welcome message
        await new Promise(r => setTimeout(r, 3000));
        await sendMessage(channel, `⚽ WC 2026 Live Bot is here! Commands: !score !predict !bracket | Live updates at ${VERCEL_URL}`);
      } catch (e) {
        console.error(`[Twitch] failed to join ${channel}:`, e.message);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ─── Chat commands ────────────────────────────────────────────────────────────

async function handleCommand(channel, command, tags) {
  try {
    switch (command.toLowerCase()) {
      case '!score':
      case '!scores': {
        const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/live`, { timeout: 10000 });
        const matches = r.data?.matches || r.data?.response || [];
        if (!matches.length) {
          await sendMessage(channel, '⚽ No matches live right now. Check the schedule at ' + VERCEL_URL);
        } else {
          const scores = matches.map(m => {
            const ht = m.teams?.home?.name || m.homeTeam;
            const at = m.teams?.away?.name || m.awayTeam;
            const hs = m.goals?.home ?? m.homeScore ?? 0;
            const as_ = m.goals?.away ?? m.awayScore ?? 0;
            const min = m.fixture?.status?.elapsed || '?';
            return `${ht} ${hs}-${as_} ${at} (${min}')`;
          }).join(' | ');
          await sendMessage(channel, `⚽ LIVE: ${scores}`);
        }
        break;
      }

      case '!predict':
      case '!prediction': {
        const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/live`, { timeout: 10000 });
        const matches = r.data?.matches || r.data?.response || [];
        if (!matches.length) {
          await sendMessage(channel, '🤖 No live matches for AI prediction. Visit ' + VERCEL_URL + ' for pre-match predictions!');
        } else {
          const m = matches[0];
          const id = m.fixture?.id || m.id;
          if (id) {
            const pred = await axios.get(`${API_SERVER_URL}/api/v1/ai/predictions/${id}`, { timeout: 15000 });
            const p = pred.data?.prediction;
            if (p) {
              const ht = m.teams?.home?.name || m.homeTeam;
              const at = m.teams?.away?.name || m.awayTeam;
              await sendMessage(channel, `🤖 AI: ${ht} win ${p.homeWinPct}% | Draw ${p.drawPct}% | ${at} win ${p.awayWinPct}% — ${VERCEL_URL}`);
            }
          }
        }
        break;
      }

      case '!bracket':
      case '!standings': {
        await sendMessage(channel, `🏆 WC 2026 bracket & standings: ${VERCEL_URL}/bracket.html — Updated live!`);
        break;
      }

      case '!odds': {
        await sendMessage(channel, `📊 Live odds & AI predictions: ${VERCEL_URL}/predictions.html`);
        break;
      }

      case '!help': {
        await sendMessage(channel, `⚽ WC 2026 Bot commands: !score (live scores) !predict (AI prediction) !bracket (bracket) !odds | Full stats: ${VERCEL_URL}`);
        break;
      }
    }
  } catch (e) {
    console.error(`[Twitch command ${command}]`, e.message);
  }
}

// ─── TMI.js client setup ──────────────────────────────────────────────────────

function createClient() {
  if (!BOT_USERNAME || !BOT_TOKEN) {
    console.warn('[Twitch] BOT_USERNAME / BOT_TOKEN not set — chat bot disabled');
    return null;
  }

  const tmiClient = new tmi.Client({
    options:  { debug: false },
    identity: { username: BOT_USERNAME, password: BOT_TOKEN },
    channels: []
  });

  tmiClient.on('message', async (channel, tags, message, self) => {
    if (self) return; // ignore own messages
    const trimmed = message.trim();
    if (trimmed.startsWith('!')) {
      await handleCommand(channel, trimmed.split(' ')[0], tags);
    }
  });

  tmiClient.on('connected', () => console.log('[Twitch] connected to chat'));
  tmiClient.on('disconnected', (reason) => console.warn('[Twitch] disconnected:', reason));
  tmiClient.on('join', (channel) => console.log(`[Twitch] joined ${channel}`));

  return tmiClient;
}

// ─── Event alerts (called by moment-engine) ───────────────────────────────────

async function broadcastToAllChannels(message) {
  if (!client || !joinedChannels.size) return;
  for (const channel of joinedChannels) {
    await sendMessage(channel, message);
    await new Promise(r => setTimeout(r, 1500)); // stagger between channels
  }
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

app.post('/trigger', auth, async (req, res) => {
  const { eventType, homeTeam, awayTeam, homeScore, awayScore, minute, player } = req.body;
  try {
    let message;
    switch (eventType) {
      case 'GOAL':
      case 'PENALTY_GOAL':
        message = `⚽ GOAL! ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}${player ? ` — ${player}` : ''} (${minute}') | AI predictions: ${VERCEL_URL}/predictions.html`;
        break;
      case 'OWN_GOAL':
        message = `😬 OWN GOAL! ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} (${minute}') | ${VERCEL_URL}`;
        break;
      case 'RED_CARD':
      case 'SECOND_YELLOW':
        message = `🟥 RED CARD! (${minute}') ${homeTeam} vs ${awayTeam} | ${VERCEL_URL}`;
        break;
      case 'MATCH_END':
        const winner = req.body.result === 'home_win' ? homeTeam : req.body.result === 'away_win' ? awayTeam : null;
        message = `🏁 FULL TIME: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}${winner ? ` — ${winner} WIN!` : ''} | ${VERCEL_URL}`;
        break;
      default:
        return res.json({ ok: true, skipped: true });
    }

    await broadcastToAllChannels(message);
    res.json({ ok: true, channels: joinedChannels.size, message });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/join', auth, async (req, res) => {
  const { channel } = req.body;
  if (!channel) return res.status(400).json({ ok: false, error: 'channel required' });
  try {
    await client?.join(channel);
    joinedChannels.add(channel.replace('#', ''));
    res.json({ ok: true, channel, totalChannels: joinedChannels.size });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/leave', auth, async (req, res) => {
  const { channel } = req.body;
  if (!channel) return res.status(400).json({ ok: false, error: 'channel required' });
  try {
    await client?.part(channel);
    joinedChannels.delete(channel.replace('#', ''));
    res.json({ ok: true, channel, totalChannels: joinedChannels.size });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/channels', (req, res) => {
  res.json({ ok: true, channels: [...joinedChannels], count: joinedChannels.size });
});

app.get('/status', (req, res) => {
  res.json({
    ok:             true,
    service:        'twitch-bot',
    botUsername:    BOT_USERNAME || 'not configured',
    connected:      !!client,
    joinedChannels: [...joinedChannels],
    messagesTotal:  messageCount.total,
    commands:       ['!score', '!predict', '!bracket', '!odds', '!help']
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.TWITCH_PORT || process.env.PORT || 3013;
  app.listen(PORT, () => console.log(`[Twitch Bot] listening on :${PORT}`));

  // Get app token for stream discovery
  if (CLIENT_ID && CLIENT_SECRET) {
    appToken = await getAppToken().catch(e => {
      console.warn('[Twitch] app token failed:', e.message);
      return null;
    });
  }

  // Connect TMI client
  client = createClient();
  if (client) {
    await client.connect().catch(e => console.error('[Twitch] connect failed:', e.message));

    // Auto-discover and join WC2026 streams
    await joinWC2026Streams();

    // Re-scan for streams every 15 minutes (matches start at different times)
    cron.schedule('*/15 * * * *', joinWC2026Streams);
  }

  console.log(`[Twitch Bot] running
  Bot: ${BOT_USERNAME || 'not configured'}
  Channels: ${joinedChannels.size}
  Commands: !score !predict !bracket !odds !help
  Stream discovery: every 15 minutes
  `);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
