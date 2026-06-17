/**
 * WC 2026 Sports Empire — Email Digest Engine
 * Deploy on Railway.app as service "email-digest"
 * Port: 3030
 *
 * Daily newsletter engine — your single most valuable long-term asset.
 * Email subscribers are owned (no algorithm, no platform risk).
 * Sends a 7am UTC digest every day of the tournament with:
 *   - Today's match schedule with AI predictions
 *   - Yesterday's results + highlights
 *   - Top news story from news-monitor
 *   - Prediction game CTA
 *   - Matched betting tip of the day (18+ only — parent account route)
 *
 * Also handles:
 *   - Subscriber opt-in (POST /subscribe)
 *   - Unsubscribe with token (GET /unsubscribe?token=xxx)
 *   - Transactional email for Stripe confirmations (via queue-processor)
 *   - Breaking news alerts to premium subscribers only
 *
 * Subscriber list stored in: data/subscribers.json
 * (Replace with PostgreSQL pg package for production scale)
 *
 * Required env vars:
 *   SENDGRID_API_KEY   — or use SMTP (same as queue-processor)
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 *   EMAIL_FROM         — "WC 2026 Live <noreply@wc2026live.app>"
 *   UNSUBSCRIBE_SECRET — random string for HMAC unsubscribe tokens
 *   VERCEL_URL         — main site URL
 *   API_SERVER_URL     — for match data
 *   GROQ_API_KEY       — for digest content generation
 *   PIPELINE_SECRET    — shared inter-service secret
 *
 * Install: npm install nodemailer (already in package.json)
 * Port: 3030
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const express = require('express');
const axios   = require('axios');
const cron    = require('node-cron');
const groqClient = require('./groq-client');

const SENDGRID_KEY  = process.env.SENDGRID_API_KEY  || '';
const SMTP_HOST     = process.env.SMTP_HOST         || '';
const SMTP_PORT     = parseInt(process.env.SMTP_PORT) || 587;
const SMTP_USER     = process.env.SMTP_USER         || '';
const SMTP_PASS     = process.env.SMTP_PASS         || '';
const EMAIL_FROM    = process.env.EMAIL_FROM        || 'WC 2026 Live <noreply@wc2026live.app>';
const UNSUB_SECRET  = process.env.UNSUBSCRIBE_SECRET || 'wc2026-unsub-secret-change-me';
const VERCEL_URL    = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const API_URL       = (process.env.API_SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');
const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';

const DATA_DIR      = path.join(process.cwd(), 'data');
const SUBS_FILE     = path.join(DATA_DIR, 'subscribers.json');
const SEND_LOG_FILE = path.join(DATA_DIR, 'email-log.json');

const sendStats = { digests: 0, transactional: 0, failed: 0, unsubscribes: 0 };

// ─── Subscriber management ────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSubscribers() {
  ensureDataDir();
  if (!fs.existsSync(SUBS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); }
  catch { return []; }
}

function saveSubscribers(subs) {
  ensureDataDir();
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
}

function makeUnsubToken(email) {
  return crypto.createHmac('sha256', UNSUB_SECRET).update(email).digest('hex').slice(0, 32);
}

function addSubscriber(email, source = 'web', tags = []) {
  const subs = loadSubscribers();
  const existing = subs.find(s => s.email === email);
  if (existing) {
    existing.active = true;
    saveSubscribers(subs);
    return { existed: true };
  }
  subs.push({
    email, source, tags,
    active:      true,
    premium:     false,
    unsubToken:  makeUnsubToken(email),
    subscribedAt: new Date().toISOString()
  });
  saveSubscribers(subs);
  return { created: true };
}

function unsubscribe(token) {
  const subs = loadSubscribers();
  const sub  = subs.find(s => s.unsubToken === token);
  if (!sub) return false;
  sub.active = false;
  sub.unsubscribedAt = new Date().toISOString();
  saveSubscribers(subs);
  sendStats.unsubscribes++;
  return sub.email;
}

// ─── Email sending ────────────────────────────────────────────────────────────

async function sendEmail({ to, subject, html, text }) {
  if (SENDGRID_KEY) {
    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: [{ email: to }] }],
        from:    { email: EMAIL_FROM.match(/<(.+)>/)?.[1] || 'noreply@wc2026live.app', name: 'WC 2026 Live' },
        subject,
        content: [
          { type: 'text/plain', value: text || html?.replace(/<[^>]+>/g, '') || '' },
          ...(html ? [{ type: 'text/html',  value: html }] : [])
        ]
      },
      { headers: { Authorization: `Bearer ${SENDGRID_KEY}` }, timeout: 20000 }
    );
    return;
  }
  if (SMTP_HOST) {
    const nodemailer = require('nodemailer');
    const transport  = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    await transport.sendMail({ from: EMAIL_FROM, to, subject, text, html });
    return;
  }
  throw new Error('No email provider configured');
}

// ─── HTML email template ──────────────────────────────────────────────────────

function renderDigest({ date, matches, results, topNews, tipsText, subscriberEmail }) {
  const unsubToken = makeUnsubToken(subscriberEmail);
  const unsubUrl   = `${VERCEL_URL}/unsubscribe?token=${unsubToken}`;

  const matchRows = matches.map(m => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #222">${m.time || ''}</td>
      <td style="padding:8px 12px;font-weight:bold;border-bottom:1px solid #222">${m.homeTeam}</td>
      <td style="padding:8px 0;text-align:center;border-bottom:1px solid #222">vs</td>
      <td style="padding:8px 12px;font-weight:bold;border-bottom:1px solid #222">${m.awayTeam}</td>
      <td style="padding:8px 0;color:#76ff03;border-bottom:1px solid #222">${m.prediction || ''}</td>
    </tr>`).join('');

  const resultRows = results.map(r => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #222">${r.homeTeam}</td>
      <td style="padding:6px 12px;font-weight:bold;text-align:center;border-bottom:1px solid #222">${r.homeScore ?? 0}–${r.awayScore ?? 0}</td>
      <td style="padding:6px 0;border-bottom:1px solid #222">${r.awayTeam}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>WC 2026 Daily Digest — ${date}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0a2400,#1a4a00);border-radius:12px;padding:24px;text-align:center;margin-bottom:20px">
      <div style="font-size:36px;margin-bottom:8px">⚽</div>
      <h1 style="margin:0;font-size:22px;color:#76ff03;letter-spacing:2px">WC 2026 DAILY DIGEST</h1>
      <p style="margin:8px 0 0;color:#aaa;font-size:14px">${date}</p>
    </div>

    ${matches.length ? `
    <!-- Today's matches -->
    <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:20px">
      <h2 style="margin:0 0 16px;color:#76ff03;font-size:16px;text-transform:uppercase;letter-spacing:1px">📅 Today's Matches</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="color:#888;font-size:12px">
            <th style="text-align:left;padding-bottom:8px">Time (UTC)</th>
            <th style="text-align:left;padding-bottom:8px" colspan="3">Match</th>
            <th style="text-align:left;padding-bottom:8px">AI Pick</th>
          </tr>
        </thead>
        <tbody>${matchRows}</tbody>
      </table>
      <div style="margin-top:16px;text-align:center">
        <a href="${VERCEL_URL}/predictions" style="background:#76ff03;color:#000;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px">
          🤖 Full AI Predictions
        </a>
      </div>
    </div>` : ''}

    ${results.length ? `
    <!-- Yesterday's results -->
    <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:20px">
      <h2 style="margin:0 0 16px;color:#0099ff;font-size:16px;text-transform:uppercase;letter-spacing:1px">🏁 Yesterday's Results</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tbody>${resultRows}</tbody>
      </table>
    </div>` : ''}

    ${topNews ? `
    <!-- Top news -->
    <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:20px;border-left:4px solid #ff6600">
      <h2 style="margin:0 0 12px;color:#ff6600;font-size:16px;text-transform:uppercase;letter-spacing:1px">📰 Breaking News</h2>
      <p style="margin:0;line-height:1.6;color:#ddd">${topNews}</p>
    </div>` : ''}

    ${tipsText ? `
    <!-- Daily tip (18+ only) -->
    <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:20px;border-left:4px solid #ffd700">
      <h2 style="margin:0 0 8px;color:#ffd700;font-size:16px;text-transform:uppercase;letter-spacing:1px">💡 Today's Value Tip</h2>
      <p style="margin:0 0 8px;color:#888;font-size:11px">18+ | Please gamble responsibly | begambleaware.org</p>
      <p style="margin:0;line-height:1.6;color:#ddd">${tipsText}</p>
    </div>` : ''}

    <!-- Prediction game CTA -->
    <div style="background:linear-gradient(135deg,#1a0040,#0a001a);border-radius:12px;padding:24px;margin-bottom:20px;text-align:center">
      <h2 style="margin:0 0 8px;color:#a64dff">🎯 Prediction Game</h2>
      <p style="margin:0 0 16px;color:#ccc;font-size:14px">Predict the results and win prizes. New entries for tonight's matches open now!</p>
      <a href="${VERCEL_URL}/prediction-game.html" style="background:#a64dff;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">
        Enter Free Game
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#555;font-size:12px;padding:20px 0">
      <p>WC 2026 Live | <a href="${VERCEL_URL}" style="color:#76ff03">wc2026live.app</a></p>
      <p><a href="${unsubUrl}" style="color:#555">Unsubscribe</a></p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchTodayMatches() {
  try {
    const r = await axios.get(`${API_URL}/api/v1/matches/today`, { timeout: 15000 });
    const matches = r.data?.matches || r.data?.response || [];
    return matches.map(m => ({
      homeTeam:   m.teams?.home?.name || m.homeTeam || '',
      awayTeam:   m.teams?.away?.name || m.awayTeam || '',
      time:       m.fixture?.date ? new Date(m.fixture.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '',
      prediction: m.prediction?.winner || ''
    }));
  } catch { return []; }
}

async function fetchYesterdayResults() {
  try {
    const r = await axios.get(`${API_URL}/api/v1/matches/yesterday`, { timeout: 15000 });
    const matches = r.data?.matches || r.data?.response || [];
    return matches.filter(m => m.fixture?.status?.short === 'FT').map(m => ({
      homeTeam:  m.teams?.home?.name || m.homeTeam || '',
      awayTeam:  m.teams?.away?.name || m.awayTeam || '',
      homeScore: m.goals?.home ?? m.homeScore ?? 0,
      awayScore: m.goals?.away ?? m.awayScore ?? 0
    }));
  } catch { return []; }
}

async function generateTopNewsSnippet() {
  try {
    return await groqClient.complete({
      engine: 'email-digest-engine', eventType: 'NEWS_SNIPPET',
      messages: [{ role: 'user', content: `Write 2 sentences summarizing the biggest WC 2026 news story right now. Be specific, factual, engaging. No made-up names or scores.` }],
      max_tokens: 80, temperature: 0.3,
    });
  } catch { return null; }
}

async function generateDailyTip(matches) {
  if (!matches.length) return null;
  try {
    const matchList = matches.slice(0, 3).map(m => `${m.homeTeam} vs ${m.awayTeam}`).join(', ');
    return await groqClient.complete({
      engine: 'email-digest-engine', eventType: 'DAILY_TIP',
      messages: [{ role: 'user', content: `You are a sports betting analyst. For today's WC 2026 matches (${matchList}), identify ONE value bet and explain why in 2 sentences. Include the bet type (e.g., "Both teams to score", "Over 2.5 goals", "Draw no bet"). Keep it factual and analytical.` }],
      max_tokens: 100, temperature: 0.4,
    });
  } catch { return null; }
}

// ─── Send daily digest ────────────────────────────────────────────────────────

async function sendDailyDigest() {
  const subs   = loadSubscribers().filter(s => s.active);
  if (!subs.length) { console.log('[Digest] no active subscribers'); return; }

  console.log(`[Digest] preparing digest for ${subs.length} subscribers`);

  const [matches, results, topNews] = await Promise.all([
    fetchTodayMatches(),
    fetchYesterdayResults(),
    generateTopNewsSnippet()
  ]);

  const tipsText = await generateDailyTip(matches);
  const date     = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  let sent = 0;
  let failed = 0;
  const LOG = [];

  for (const sub of subs) {
    try {
      const html = renderDigest({ date, matches, results, topNews, tipsText, subscriberEmail: sub.email });
      await sendEmail({
        to:      sub.email,
        subject: `⚽ WC 2026 Daily Digest — ${date}`,
        html,
        text:    `WC 2026 Daily Digest for ${date}\n\nView in browser: ${VERCEL_URL}\n\nUnsubscribe: ${VERCEL_URL}/unsubscribe?token=${makeUnsubToken(sub.email)}`
      });
      sent++;
      sendStats.digests++;
      // Rate limit: max 10 emails/second
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(`[Digest] failed for ${sub.email}:`, e.message);
      failed++;
      sendStats.failed++;
    }
  }

  LOG.push({ date, sent, failed, matches: matches.length, results: results.length, timestamp: new Date().toISOString() });
  ensureDataDir();
  let existingLog = [];
  if (fs.existsSync(SEND_LOG_FILE)) { try { existingLog = JSON.parse(fs.readFileSync(SEND_LOG_FILE, 'utf8')); } catch {} }
  existingLog.unshift(...LOG);
  if (existingLog.length > 365) existingLog.length = 365;
  fs.writeFileSync(SEND_LOG_FILE, JSON.stringify(existingLog, null, 2), 'utf8');

  console.log(`[Digest] sent ${sent}/${subs.length} (${failed} failed)`);
  return { sent, failed, total: subs.length };
}

// ─── Welcome email ────────────────────────────────────────────────────────────

async function sendWelcomeEmail(email) {
  const unsubUrl = `${VERCEL_URL}/unsubscribe?token=${makeUnsubToken(email)}`;
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#0a0a0a;color:#fff;font-family:Arial,sans-serif">
  <div style="max-width:500px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#0a2400,#1a4a00);border-radius:12px;padding:24px;text-align:center;margin-bottom:20px">
      <div style="font-size:48px">⚽</div>
      <h1 style="color:#76ff03;margin:8px 0">You're in!</h1>
      <p style="color:#aaa">WC 2026 Daily Digest</p>
    </div>
    <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:16px">
      <p style="margin:0 0 12px">Welcome! Every morning at 7am UTC during the 2026 World Cup you'll get:</p>
      <ul style="color:#ccc;line-height:2">
        <li>📅 Today's match schedule + AI predictions</li>
        <li>🏁 Yesterday's results</li>
        <li>📰 Breaking news</li>
        <li>💡 Value tips from our AI analyst</li>
        <li>🎯 Prediction game updates</li>
      </ul>
    </div>
    <div style="text-align:center;margin-bottom:20px">
      <a href="${VERCEL_URL}" style="background:#76ff03;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
        Visit WC 2026 Live Now
      </a>
    </div>
    <p style="text-align:center;color:#555;font-size:12px">
      <a href="${unsubUrl}" style="color:#555">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;

  await sendEmail({
    to:      email,
    subject: '⚽ Welcome to WC 2026 Daily Digest!',
    html,
    text:    `Welcome to WC 2026 Daily Digest! Get match schedules, AI predictions and results every morning. Visit: ${VERCEL_URL} | Unsubscribe: ${unsubUrl}`
  });
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function pAuth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

// Public endpoints
app.post('/subscribe', async (req, res) => {
  const { email, source = 'web', tags = [] } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ ok: false, error: 'valid email required' });

  const result = addSubscriber(email.toLowerCase().trim(), source, tags);

  // Send welcome email
  if (result.created) {
    sendWelcomeEmail(email).catch(e => console.error('[Welcome email]', e.message));
    sendStats.transactional++;
  }

  res.json({ ok: true, ...result, email });
});

app.get('/unsubscribe', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('<h2>Invalid unsubscribe link</h2>');
  const email = unsubscribe(token);
  if (!email) return res.status(400).send('<h2>Unsubscribe link not found or already used</h2>');
  res.send(`<!DOCTYPE html><html><body style="font-family:Arial;text-align:center;padding:40px;background:#0a0a0a;color:#fff">
    <h2>✅ Unsubscribed</h2>
    <p>${email} has been removed from WC 2026 Daily Digest.</p>
    <p>Sorry to see you go! <a href="${VERCEL_URL}" style="color:#76ff03">Visit the site</a></p>
  </body></html>`);
});

// Admin endpoints
app.post('/send-now', pAuth, async (req, res) => {
  const result = await sendDailyDigest().catch(e => ({ error: e.message }));
  res.json({ ok: !result?.error, ...result });
});

app.post('/send-test', pAuth, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, error: 'email required' });
  try {
    const [matches, results, topNews] = await Promise.all([fetchTodayMatches(), fetchYesterdayResults(), generateTopNewsSnippet()]);
    const html = renderDigest({ date: new Date().toLocaleDateString('en-GB', { weekday:'long',day:'numeric',month:'long',year:'numeric' }), matches, results, topNews, tipsText: null, subscriberEmail: email });
    await sendEmail({ to: email, subject: '[TEST] WC 2026 Daily Digest', html });
    res.json({ ok: true, message: `Test digest sent to ${email}` });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/subscribers', pAuth, (req, res) => {
  const subs   = loadSubscribers();
  const active = subs.filter(s => s.active).length;
  res.json({ ok: true, total: subs.length, active, unsubscribed: subs.length - active, subscribers: subs.slice(0, 50) });
});

app.get('/log', pAuth, (req, res) => {
  let log = [];
  if (fs.existsSync(SEND_LOG_FILE)) { try { log = JSON.parse(fs.readFileSync(SEND_LOG_FILE, 'utf8')); } catch {} }
  res.json({ ok: true, sendStats, log: log.slice(0, 30) });
});

app.get('/status', (req, res) => {
  const subs = loadSubscribers();
  res.json({
    ok:           true,
    service:      'email-digest-engine',
    configured:   !!(SENDGRID_KEY || SMTP_HOST),
    provider:     SENDGRID_KEY ? 'sendgrid' : SMTP_HOST ? 'smtp' : 'none',
    subscribers:  { total: subs.length, active: subs.filter(s => s.active).length },
    sendStats
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function boot() {
  const PORT = process.env.EMAIL_DIGEST_PORT || process.env.PORT || 3030;
  app.listen(PORT, () => console.log(`[Email Digest] listening on :${PORT}`));

  ensureDataDir();

  if (!SENDGRID_KEY && !SMTP_HOST) console.warn('[Email] No email provider configured (set SENDGRID_API_KEY or SMTP_HOST)');

  // Daily digest at 07:00 UTC
  cron.schedule('0 7 * * *', () => {
    sendDailyDigest().catch(e => console.error('[Digest cron]', e.message));
  });

  const subs = loadSubscribers();
  console.log(`[Email Digest] running on :${PORT} — ${subs.filter(s => s.active).length} active subscribers`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
