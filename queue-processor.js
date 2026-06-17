/**
 * WC 2026 Sports Empire — Queue Processor
 * Deploy on Railway.app as service "queue-processor"
 *
 * Drains all local JSON queue files written by moment-engine.js enqueue() calls.
 * Runs on a 30-second cron, processes:
 *
 *   queues/email-queue.json       → SMTP via nodemailer / SendGrid HTTP
 *   queues/push-queue.json        → OneSignal REST API
 *   queues/reddit-queue.json      → reddit-bot.js /post endpoint
 *   queues/translation-queue.json → translation-processor.js /translate endpoint
 *   queues/sms-queue.json         → Africa's Talking SMS API (for African markets)
 *   queues/webhook-queue.json     → outbound webhooks (Stripe confirmation etc)
 *
 * Architecture:
 *   moment-engine.enqueue(platform, item) → writes to queues/${platform}-queue.json
 *   queue-processor (this file) → reads queue file, processes each item, removes on success
 *   Failed items are retried up to MAX_RETRIES, then moved to queues/dead-letter.json
 *
 * Required env vars:
 *   PIPELINE_SECRET              — shared inter-service secret
 *
 *   Email (choose one):
 *     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS — nodemailer SMTP
 *     SENDGRID_API_KEY                           — SendGrid HTTP (preferred)
 *     EMAIL_FROM                                 — "WC 2026 <noreply@wc2026live.app>"
 *
 *   Push (OneSignal):
 *     ONESIGNAL_APP_ID
 *     ONESIGNAL_REST_API_KEY
 *
 *   Reddit (local service):
 *     REDDIT_BOT_URL             — reddit-bot.js Railway URL (default: localhost:3023)
 *
 *   Translation (local service):
 *     TRANSLATION_ENGINE_URL     — translation-processor.js Railway URL (default: localhost:3026)
 *
 *   SMS (Africa's Talking):
 *     AT_API_KEY
 *     AT_USERNAME
 *     AT_SENDER_ID               — shortcode or sender name
 *
 * Port: 3027 (admin endpoints only — this service is mostly cron-driven)
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const PIPELINE_SECRET    = process.env.PIPELINE_SECRET           || '';
const SENDGRID_KEY       = process.env.SENDGRID_API_KEY          || '';
const SMTP_HOST          = process.env.SMTP_HOST                 || '';
const SMTP_PORT          = parseInt(process.env.SMTP_PORT)       || 587;
const SMTP_USER          = process.env.SMTP_USER                 || '';
const SMTP_PASS          = process.env.SMTP_PASS                 || '';
const EMAIL_FROM         = process.env.EMAIL_FROM                || 'WC 2026 Live <noreply@wc2026live.app>';
const ONESIGNAL_APP_ID   = process.env.ONESIGNAL_APP_ID         || '';
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_API_KEY   || '';
const REDDIT_BOT_URL     = (process.env.REDDIT_BOT_URL          || 'http://localhost:3023').replace(/\/$/, '');
const TRANSLATE_URL      = (process.env.TRANSLATION_ENGINE_URL  || 'http://localhost:3026').replace(/\/$/, '');
const AT_API_KEY         = process.env.AT_API_KEY               || '';
const AT_USERNAME        = process.env.AT_USERNAME              || 'sandbox';
const AT_SENDER_ID       = process.env.AT_SENDER_ID             || 'WC2026';

const QUEUE_DIR   = path.join(process.cwd(), 'queues');
const MAX_RETRIES = 3;

const stats = {
  email: { processed: 0, failed: 0 },
  push:  { processed: 0, failed: 0 },
  reddit:{ processed: 0, failed: 0 },
  translation: { processed: 0, failed: 0 },
  sms:   { processed: 0, failed: 0 },
  webhook: { processed: 0, failed: 0 }
};

// ─── Queue file helpers ───────────────────────────────────────────────────────

function ensureQueueDir() {
  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

function readQueue(name) {
  ensureQueueDir();
  const file = path.join(QUEUE_DIR, `${name}-queue.json`);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

function writeQueue(name, items) {
  ensureQueueDir();
  const file = path.join(QUEUE_DIR, `${name}-queue.json`);
  fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
}

function appendDeadLetter(item, queue, error) {
  const file = path.join(QUEUE_DIR, 'dead-letter.json');
  let dl = [];
  if (fs.existsSync(file)) {
    try { dl = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  }
  dl.unshift({ queue, item, error, deadAt: new Date().toISOString() });
  if (dl.length > 1000) dl.length = 1000;
  fs.writeFileSync(file, JSON.stringify(dl, null, 2), 'utf8');
}

// ─── Email processor ──────────────────────────────────────────────────────────
// Item shape: { to, subject, html, text, retries? }

async function sendEmail(item) {
  if (SENDGRID_KEY) {
    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: [{ email: item.to }] }],
        from:    { email: EMAIL_FROM.match(/<(.+)>/)?.[1] || 'noreply@wc2026live.app', name: 'WC 2026 Live' },
        subject: item.subject || 'WC 2026 Update',
        content: [
          { type: 'text/plain', value: item.text || item.html?.replace(/<[^>]+>/g, '') || '' },
          ...(item.html ? [{ type: 'text/html', value: item.html }] : [])
        ]
      },
      { headers: { Authorization: `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    return;
  }

  if (SMTP_HOST && SMTP_USER) {
    // Dynamic nodemailer import (avoid crashing if not installed)
    const nodemailer = require('nodemailer');
    const transport  = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    await transport.sendMail({
      from: EMAIL_FROM, to: item.to,
      subject: item.subject || 'WC 2026 Update',
      text: item.text, html: item.html
    });
    return;
  }

  throw new Error('No email provider configured (set SENDGRID_API_KEY or SMTP_HOST)');
}

async function processEmailQueue() {
  const items = readQueue('email');
  if (!items.length) return;
  const remaining = [];
  for (const item of items) {
    try {
      await sendEmail(item);
      stats.email.processed++;
      console.log(`[Queue:email] sent to ${item.to}`);
    } catch (e) {
      const retries = (item.retries || 0) + 1;
      if (retries >= MAX_RETRIES) {
        appendDeadLetter(item, 'email', e.message);
        stats.email.failed++;
        console.error(`[Queue:email] dead-lettered ${item.to}: ${e.message}`);
      } else {
        remaining.push({ ...item, retries });
        console.warn(`[Queue:email] retry ${retries} for ${item.to}`);
      }
    }
  }
  writeQueue('email', remaining);
}

// ─── Push notification processor (OneSignal) ─────────────────────────────────
// Item shape: { heading, content, url, segments?, filters?, data? }

async function sendPush(item) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_KEY) throw new Error('OneSignal not configured');

  const payload = {
    app_id:   ONESIGNAL_APP_ID,
    headings: { en: item.heading || 'WC 2026 Update' },
    contents: { en: item.content || '' },
    ...(item.url     ? { url: item.url }         : {}),
    ...(item.data    ? { data: item.data }        : {}),
    ...(item.segments
      ? { included_segments: item.segments }
      : { included_segments: ['All'] }
    ),
    ...(item.filters ? { filters: item.filters }  : {})
  };

  const r = await axios.post(
    'https://onesignal.com/api/v1/notifications',
    payload,
    { headers: { Authorization: `Basic ${ONESIGNAL_REST_KEY}`, 'Content-Type': 'application/json' }, timeout: 20000 }
  );
  return r.data?.id;
}

async function processPushQueue() {
  const items = readQueue('push');
  if (!items.length) return;
  const remaining = [];
  for (const item of items) {
    try {
      const id = await sendPush(item);
      stats.push.processed++;
      console.log(`[Queue:push] sent notification ${id}`);
    } catch (e) {
      const retries = (item.retries || 0) + 1;
      if (retries >= MAX_RETRIES) {
        appendDeadLetter(item, 'push', e.message);
        stats.push.failed++;
      } else {
        remaining.push({ ...item, retries });
      }
    }
  }
  writeQueue('push', remaining);
}

// ─── Reddit queue processor ───────────────────────────────────────────────────
// Item shape: { subreddit, title, text, url, flair?, isLink? }

async function processRedditQueue() {
  const items = readQueue('reddit');
  if (!items.length) return;
  const remaining = [];
  for (const item of items) {
    try {
      await axios.post(
        `${REDDIT_BOT_URL}/post`,
        item,
        { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 30000 }
      );
      stats.reddit.processed++;
      console.log(`[Queue:reddit] posted to r/${item.subreddit}`);
      // Reddit: at least 10 min between posts per subreddit; stagger here
      await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
      const retries = (item.retries || 0) + 1;
      if (retries >= MAX_RETRIES) {
        appendDeadLetter(item, 'reddit', e.message);
        stats.reddit.failed++;
      } else {
        remaining.push({ ...item, retries });
      }
    }
  }
  writeQueue('reddit', remaining);
}

// ─── Translation queue processor ─────────────────────────────────────────────
// Item shape: { text, targetLanguages, originalPlatform, originalEventType, metadata }

async function processTranslationQueue() {
  const items = readQueue('translation');
  if (!items.length) return;
  const remaining = [];
  for (const item of items) {
    try {
      await axios.post(
        `${TRANSLATE_URL}/translate`,
        item,
        { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 60000 }
      );
      stats.translation.processed++;
      console.log(`[Queue:translation] dispatched for translation`);
    } catch (e) {
      const retries = (item.retries || 0) + 1;
      if (retries >= MAX_RETRIES) {
        appendDeadLetter(item, 'translation', e.message);
        stats.translation.failed++;
      } else {
        remaining.push({ ...item, retries });
      }
    }
  }
  writeQueue('translation', remaining);
}

// ─── SMS queue processor (Africa's Talking) ──────────────────────────────────
// Item shape: { to, message } — `to` is E.164 format e.g. +254712345678

async function sendSMS(item) {
  if (!AT_API_KEY) throw new Error('AT_API_KEY not configured');
  const params = new URLSearchParams({
    username: AT_USERNAME,
    to:       item.to,
    message:  item.message,
    ...(AT_SENDER_ID ? { from: AT_SENDER_ID } : {})
  });
  const r = await axios.post(
    'https://api.africastalking.com/version1/messaging',
    params.toString(),
    {
      headers: {
        apiKey:         AT_API_KEY,
        Accept:         'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 20000
    }
  );
  const status = r.data?.SMSMessageData?.Recipients?.[0]?.status;
  if (status && status !== 'Success') throw new Error(`AT SMS failed: ${status}`);
  return r.data;
}

async function processSMSQueue() {
  const items = readQueue('sms');
  if (!items.length) return;
  const remaining = [];
  for (const item of items) {
    try {
      await sendSMS(item);
      stats.sms.processed++;
      console.log(`[Queue:sms] sent to ${item.to}`);
    } catch (e) {
      const retries = (item.retries || 0) + 1;
      if (retries >= MAX_RETRIES) {
        appendDeadLetter(item, 'sms', e.message);
        stats.sms.failed++;
      } else {
        remaining.push({ ...item, retries });
      }
    }
  }
  writeQueue('sms', remaining);
}

// ─── Webhook queue processor ──────────────────────────────────────────────────
// Item shape: { url, method, headers, body }

async function processWebhookQueue() {
  const items = readQueue('webhook');
  if (!items.length) return;
  const remaining = [];
  for (const item of items) {
    try {
      await axios({
        method:  item.method || 'POST',
        url:     item.url,
        headers: item.headers || { 'Content-Type': 'application/json' },
        data:    item.body,
        timeout: 15000
      });
      stats.webhook.processed++;
      console.log(`[Queue:webhook] fired to ${item.url}`);
    } catch (e) {
      const retries = (item.retries || 0) + 1;
      if (retries >= MAX_RETRIES) {
        appendDeadLetter(item, 'webhook', e.message);
        stats.webhook.failed++;
      } else {
        remaining.push({ ...item, retries });
      }
    }
  }
  writeQueue('webhook', remaining);
}

// ─── Master drain cycle ───────────────────────────────────────────────────────

async function drainAllQueues() {
  await Promise.allSettled([
    processEmailQueue(),
    processPushQueue(),
    processRedditQueue(),
    processTranslationQueue(),
    processSMSQueue(),
    processWebhookQueue()
  ]);
}

// ─── Express (admin / status only) ───────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.get('/status', (req, res) => {
  const queues = {};
  for (const name of ['email', 'push', 'reddit', 'translation', 'sms', 'webhook']) {
    const items = readQueue(name);
    queues[name] = { pending: items.length };
  }
  res.json({ ok: true, service: 'queue-processor', stats, queues });
});

app.post('/drain', auth, async (req, res) => {
  drainAllQueues().catch(e => console.error('[Drain]', e.message));
  res.json({ ok: true, message: 'drain started' });
});

app.get('/dead-letter', auth, (req, res) => {
  const file = path.join(QUEUE_DIR, 'dead-letter.json');
  if (!fs.existsSync(file)) return res.json({ ok: true, items: [] });
  try {
    const items = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json({ ok: true, count: items.length, items: items.slice(0, 50) });
  } catch { res.json({ ok: true, items: [] }); }
});

app.delete('/dead-letter', auth, (req, res) => {
  const file = path.join(QUEUE_DIR, 'dead-letter.json');
  if (fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf8');
  res.json({ ok: true, message: 'dead-letter cleared' });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.QUEUE_PORT || process.env.PORT || 3027;
  app.listen(PORT, () => console.log(`[Queue Processor] listening on :${PORT}`));

  ensureQueueDir();

  // Drain every 30 seconds
  cron.schedule('*/1 * * * *', drainAllQueues); // every minute (cron minimum)

  // Also use setInterval for the 30s sub-minute cadence
  setInterval(drainAllQueues, 30000);

  // Initial drain after 10s boot delay
  setTimeout(drainAllQueues, 10000);

  console.log(`[Queue Processor] running on :${PORT} — draining every 30s`);
  console.log(`[Queue Processor] email:${SENDGRID_KEY?'sendgrid':SMTP_HOST?'smtp':'unconfigured'} push:${ONESIGNAL_APP_ID?'configured':'unconfigured'} sms:${AT_API_KEY?'configured':'unconfigured'}`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
