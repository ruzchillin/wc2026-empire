/**
 * WC2026 Empire — Threads Engine
 * Meta's Twitter competitor: 200M+ users, Instagram graph, no algorithm penalty yet
 *
 * Threads uses Instagram Graph API — same credentials as Instagram
 * Port: 3050
 *
 * Env vars needed:
 *   THREADS_USER_ID         — your Threads/Instagram user ID
 *   INSTAGRAM_ACCESS_TOKEN  — Instagram Graph API long-lived token
 *   TELEGRAM_BOT_TOKEN      — for status alerts
 *   TELEGRAM_GROUP_CHAT_ID
 */

const http = require('http');
const https = require('https');

const PORT = process.env.THREADS_PORT || process.env.PORT || 3050;
const USER_ID = process.env.THREADS_USER_ID || process.env.INSTAGRAM_USER_ID || '';
const TOKEN   = process.env.INSTAGRAM_ACCESS_TOKEN || '';
const BOT     = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT    = process.env.TELEGRAM_GROUP_CHAT_ID || '';
const SITE    = process.env.SITE_URL || 'https://wc2026-sports-empire.vercel.app';

// ─── Threads API ──────────────────────────────────────────────────────────────
// Threads API is part of Instagram Graph API
// Step 1: Create media container
// Step 2: Publish container
// Docs: developers.facebook.com/docs/threads-api

function apiRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const url = new URL(`https://graph.threads.net${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WC2026-Empire/1.0',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createTextPost(text) {
  if (!USER_ID || !TOKEN) {
    console.log('[Threads] No credentials — skip');
    return null;
  }

  // Step 1: Create container
  const containerUrl = `/${USER_ID}/threads?media_type=TEXT&text=${encodeURIComponent(text)}&access_token=${TOKEN}`;
  const container = await apiRequest('POST', containerUrl, null);

  if (!container.data?.id) {
    console.error('[Threads] Container creation failed:', container.data);
    return null;
  }

  // Wait 500ms for processing
  await new Promise(r => setTimeout(r, 500));

  // Step 2: Publish
  const publishUrl = `/${USER_ID}/threads_publish?creation_id=${container.data.id}&access_token=${TOKEN}`;
  const result = await apiRequest('POST', publishUrl, null);

  if (result.data?.id) {
    console.log(`[Threads] Posted: ${result.data.id}`);
    return result.data.id;
  } else {
    console.error('[Threads] Publish failed:', result.data);
    return null;
  }
}

// ─── WC2026 Content Templates ─────────────────────────────────────────────────
const WC2026_THREADS = [
  // Threads favors conversational, opinion-based content — not just links
  () => `Who wins the World Cup? Drop your prediction below 👇\n\nOur AI model has run 50,000 simulations. See the results → ${SITE}/wc2026-predictions-hub.html`,
  () => `The referees are already deciding this World Cup and we're only in the group stage.\n\nEvery red card, every VAR call tracked → ${SITE}/wc2026-referees.html`,
  () => `Unpopular opinion: The Golden Boot winner won't be Mbappé, Haaland, or Ronaldo.\n\nWho do YOU think scores most? → ${SITE}/wc2026-top-goals.html`,
  () => `This is the best bracket predictor tool I've seen for WC2026 → ${SITE}/wc2026-bracket-predictor.html\n\nFree, no sign-up needed. Drop your bracket 🏆`,
  () => `Real talk: which streaming service is actually worth it to watch WC2026?\n\nHonest breakdown of every option → ${SITE}/streaming-vpn.html`,
  () => `The injury list going into WC2026 is wild. Multiple starting 11s already affected.\n\nFull tracker → ${SITE}/wc2026-injuries.html`,
  () => `Every WC2026 stadium ranked by atmosphere, capacity, and travel difficulty.\n\nDoing the Los Angeles leg? Read this first → ${SITE}/wc2026-stadiums.html`,
  () => `The dark horses at this World Cup are genuinely terrifying.\n\nTeams that could win it all → ${SITE}/dark-horses-wc2026.html`,
];

function getThreadsPost() {
  const fn = WC2026_THREADS[Math.floor(Math.random() * WC2026_THREADS.length)];
  return fn();
}

// ─── Telegram Alert ───────────────────────────────────────────────────────────
function tgAlert(msg) {
  if (!BOT || !CHAT) return;
  const body = JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'Markdown' });
  const req = https.request({
    hostname: 'api.telegram.org', path: `/bot${BOT}/sendMessage`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  });
  req.write(body); req.end();
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'threads-engine', credentialed: !!(USER_ID && TOKEN) }));
    return;
  }

  if (url === '/trigger' || url === '/post') {
    const text = getThreadsPost();
    const id = await createTextPost(text);
    if (id) tgAlert(`🧵 *Threads posted*\n${text.slice(0, 100)}...`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: !!id, id, text: text.slice(0, 80) }));
    return;
  }

  res.writeHead(404); res.end();
});

// ─── Auto-post schedule: 4x per day ──────────────────────────────────────────
async function autoPost() {
  const text = getThreadsPost();
  console.log(`[Threads] Auto-posting: ${text.slice(0, 60)}...`);
  const id = await createTextPost(text);
  if (id) tgAlert(`🧵 *Threads auto-post*\n${text.slice(0, 100)}`);
}

server.listen(PORT, () => {
  console.log(`[Threads Engine] Port ${PORT}`);
  if (!USER_ID || !TOKEN) {
    console.warn('[Threads] THREADS_USER_ID + INSTAGRAM_ACCESS_TOKEN not set');
    console.warn('[Threads] Get via: Meta Developer → Instagram Basic Display → Long-lived Token');
    console.warn('[Threads] Threads API docs: developers.facebook.com/docs/threads-api');
  }

  // Post 4x per day: 08:00, 12:00, 17:00, 21:00 UTC
  const POST_HOURS = [8, 12, 17, 21];
  setInterval(() => {
    const h = new Date().getUTCHours();
    const m = new Date().getUTCMinutes();
    if (POST_HOURS.includes(h) && m === 0) autoPost();
  }, 60 * 1000);
});
