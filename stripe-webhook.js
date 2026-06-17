/**
 * WC 2026 Sports Empire — Stripe Webhook Handler
 * Deploy on Railway.app as service "stripe-webhook"
 *
 * Handles Stripe payment events for the paid prediction game.
 * On successful payment:
 *   1. Saves entry to a local JSON store (replace with DB in production)
 *   2. Queues confirmation email (→ queue-processor email queue)
 *   3. Sends Telegram alert to owner (instant notification)
 *   4. Optionally grants premium Telegram channel access via invite link
 *   5. Queues OneSignal push tag update (marks subscriber as "premium")
 *
 * Revenue streams covered:
 *   - $5 prediction game entry (prediction-game.html Stripe Checkout integration)
 *   - Premium membership (monthly subscription for tournament duration)
 *   - Corporate sweepstake entries
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY          — starts with sk_live_ or sk_test_
 *   STRIPE_WEBHOOK_SECRET      — starts with whsec_
 *                                Get via: stripe listen --forward-to localhost:3024/webhook
 *                                Or Stripe Dashboard → Developers → Webhooks → Add endpoint
 *   TELEGRAM_BOT_TOKEN         — for owner alerts
 *   TELEGRAM_OWNER_ID          — your personal Telegram user ID (@userinfobot to get it)
 *   TELEGRAM_PREMIUM_CHAT_ID   — ID of premium members channel (optional)
 *   PIPELINE_SECRET            — shared inter-service secret
 *   VERCEL_URL                 — main site URL
 *   QUEUE_DIR                  — path to queue files (default: ./queues)
 *
 * Stripe setup:
 *   1. stripe.com → Dashboard → Developers → API keys → copy STRIPE_SECRET_KEY
 *   2. Dashboard → Developers → Webhooks → Add endpoint
 *      URL: https://your-railway-url.railway.app/webhook
 *      Events: payment_intent.succeeded, checkout.session.completed,
 *              customer.subscription.created, customer.subscription.deleted
 *   3. After adding, click endpoint → Signing Secret → copy STRIPE_WEBHOOK_SECRET
 *
 * Install: npm install stripe
 * Port: 3024
 *
 * Endpoints:
 *   POST /webhook    — Stripe webhook (raw body, NO json middleware)
 *   GET  /entries    — List recent entries (admin)
 *   GET  /revenue    — Revenue summary
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const axios    = require('axios');

const STRIPE_SECRET_KEY      = process.env.STRIPE_SECRET_KEY         || '';
const STRIPE_WEBHOOK_SECRET  = process.env.STRIPE_WEBHOOK_SECRET     || '';
const TG_BOT_TOKEN           = process.env.TELEGRAM_BOT_TOKEN        || '';
const TG_OWNER_ID            = process.env.TELEGRAM_OWNER_ID         || '';
const TG_PREMIUM_CHAT_ID     = process.env.TELEGRAM_PREMIUM_CHAT_ID  || '';
const PIPELINE_SECRET        = process.env.PIPELINE_SECRET           || '';
const VERCEL_URL             = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const QUEUE_DIR              = process.env.QUEUE_DIR || path.join(process.cwd(), 'queues');
const ENTRIES_FILE           = path.join(QUEUE_DIR, 'prediction-entries.json');

// Revenue tracking
const revenue = { total: 0, entries: 0, subscriptions: 0, sweepstakes: 0, currency: 'GBP' };

// ─── Storage helpers ──────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

function loadEntries() {
  ensureDir();
  if (!fs.existsSync(ENTRIES_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(ENTRIES_FILE, 'utf8')); }
  catch { return []; }
}

function saveEntry(entry) {
  const entries = loadEntries();
  entries.unshift(entry);
  if (entries.length > 10000) entries.length = 10000;
  fs.writeFileSync(ENTRIES_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function appendQueue(queueName, item) {
  ensureDir();
  const file = path.join(QUEUE_DIR, `${queueName}-queue.json`);
  let q = [];
  if (fs.existsSync(file)) {
    try { q = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  q.push(item);
  fs.writeFileSync(file, JSON.stringify(q, null, 2), 'utf8');
}

// ─── Telegram owner alert ─────────────────────────────────────────────────────

async function tgOwnerAlert(text) {
  if (!TG_BOT_TOKEN || !TG_OWNER_ID) return;
  try {
    await axios.post(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      { chat_id: TG_OWNER_ID, text, parse_mode: 'HTML' },
      { timeout: 10000 }
    );
  } catch (e) { console.error('[TG alert]', e.message); }
}

// ─── Premium Telegram invite ──────────────────────────────────────────────────

async function createTelegramInvite() {
  if (!TG_BOT_TOKEN || !TG_PREMIUM_CHAT_ID) return null;
  try {
    const r = await axios.post(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/createChatInviteLink`,
      {
        chat_id:      TG_PREMIUM_CHAT_ID,
        member_limit: 1,        // single-use link
        expire_date:  Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
        name:         'Premium prediction game entry'
      },
      { timeout: 10000 }
    );
    return r.data?.result?.invite_link || null;
  } catch (e) {
    console.error('[TG invite]', e.message);
    return null;
  }
}

// ─── Handle checkout.session.completed ───────────────────────────────────────

async function handleCheckoutComplete(session) {
  const email       = session.customer_details?.email || session.customer_email || 'unknown';
  const amountTotal = (session.amount_total || 0) / 100; // pence → pounds
  const currency    = (session.currency || 'gbp').toUpperCase();
  const productType = session.metadata?.product_type || 'prediction_entry';
  const predictions = session.metadata?.predictions  || '';
  const sessionId   = session.id;

  console.log(`[Stripe] checkout complete: ${email} £${amountTotal} (${productType})`);

  // Update revenue
  revenue.total += amountTotal;
  if (productType === 'subscription')     revenue.subscriptions++;
  else if (productType === 'sweepstake') revenue.sweepstakes++;
  else                                   revenue.entries++;

  // 1. Save entry
  const entry = {
    email, amountTotal, currency, productType,
    predictions, sessionId,
    paidAt:    new Date().toISOString(),
    status:    'confirmed'
  };
  saveEntry(entry);

  // 2. Create premium Telegram invite link
  const inviteLink = await createTelegramInvite();

  // 3. Queue confirmation email
  const emailHtml = `
<h2>🎉 You're in the WC 2026 Prediction Game!</h2>
<p>Hi ${email},</p>
<p>Your entry has been confirmed! Here's what you submitted:</p>
<blockquote style="border-left:3px solid #007bff;padding-left:1rem;color:#555">${predictions || 'Entry recorded'}</blockquote>
<p><strong>Amount paid:</strong> ${currency} ${amountTotal.toFixed(2)}</p>
${inviteLink ? `<p>🔐 <strong>Join the Premium Telegram channel</strong> for exclusive live alerts and updates:<br><a href="${inviteLink}">${inviteLink}</a></p><p>This link expires in 7 days and is single-use.</p>` : ''}
<p>Winners will be announced after the final on 19 July 2026!</p>
<p>Track your picks and live scores at: <a href="${VERCEL_URL}">${VERCEL_URL}</a></p>
<hr>
<small>WC 2026 Live | Prediction Reference: ${sessionId.slice(-8)}</small>
`;

  appendQueue('email', {
    to:      email,
    subject: '✅ WC 2026 Prediction Game — Entry Confirmed!',
    html:    emailHtml,
    text:    `Your WC 2026 prediction entry is confirmed! Amount: ${currency} ${amountTotal.toFixed(2)}. Track scores at ${VERCEL_URL}`
  });

  // 4. Queue push tag update (marks this subscriber as premium)
  appendQueue('push', {
    heading:  '🎉 Entry confirmed!',
    content:  `Your WC 2026 prediction game entry is in! Good luck!`,
    url:      VERCEL_URL,
    filters:  [{ field: 'email', relation: '=', value: email }],
    data:     { type: 'entry_confirmed', sessionId }
  });

  // 5. Alert owner on Telegram
  await tgOwnerAlert(
    `💰 <b>NEW PAYMENT!</b>\n\n` +
    `📧 ${email}\n` +
    `💵 ${currency} ${amountTotal.toFixed(2)}\n` +
    `🏷️ ${productType}\n` +
    `🔑 ${sessionId.slice(-8)}\n\n` +
    `📊 Total today: £${revenue.total.toFixed(2)} (${revenue.entries} entries, ${revenue.subscriptions} subs)`
  );
}

// ─── Handle payment_intent.succeeded ─────────────────────────────────────────

async function handlePaymentSucceeded(intent) {
  // Only process if not already handled via checkout session
  if (intent.metadata?.handled) return;
  const amount   = (intent.amount || 0) / 100;
  const currency = (intent.currency || 'gbp').toUpperCase();
  console.log(`[Stripe] payment succeeded: ${intent.id} ${currency} ${amount}`);
  revenue.total += amount;
  await tgOwnerAlert(`💳 Payment succeeded: ${currency} ${amount.toFixed(2)} (${intent.id.slice(-8)})`);
}

// ─── Handle subscription events ──────────────────────────────────────────────

async function handleSubscriptionCreated(sub) {
  console.log(`[Stripe] subscription created: ${sub.id}`);
  revenue.subscriptions++;
  await tgOwnerAlert(`🔁 New subscription: ${sub.id.slice(-8)} — Status: ${sub.status}`);
}

async function handleSubscriptionDeleted(sub) {
  console.log(`[Stripe] subscription cancelled: ${sub.id}`);
  await tgOwnerAlert(`❌ Subscription cancelled: ${sub.id.slice(-8)}`);
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();

// CRITICAL: /webhook needs raw body for Stripe signature verification
// Must come BEFORE express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!STRIPE_SECRET_KEY) {
    console.error('[Stripe] STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ ok: false, error: 'Stripe not configured' });
  }

  let stripe;
  try {
    stripe = require('stripe')(STRIPE_SECRET_KEY);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'stripe package not installed — run: npm install stripe' });
  }

  let event;
  try {
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
    } else {
      console.warn('[Stripe] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (INSECURE)');
      event = JSON.parse(req.body.toString());
    }
  } catch (e) {
    console.error('[Stripe] webhook signature verification failed:', e.message);
    return res.status(400).json({ ok: false, error: `Webhook signature error: ${e.message}` });
  }

  // Acknowledge immediately — Stripe times out at 30s
  res.json({ ok: true, received: true, type: event.type });

  // Process async
  try {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
        if (obj.payment_status === 'paid') await handleCheckoutComplete(obj);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(obj);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(obj);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(obj);
        break;
      default:
        console.log(`[Stripe] unhandled event: ${event.type}`);
    }
  } catch (e) {
    console.error(`[Stripe] event processing error for ${event.type}:`, e.message);
  }
});

// JSON middleware for all other routes
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.get('/entries', auth, (req, res) => {
  const entries = loadEntries();
  const limit   = parseInt(req.query.limit) || 50;
  res.json({ ok: true, total: entries.length, entries: entries.slice(0, limit) });
});

app.get('/revenue', auth, (req, res) => {
  const entries = loadEntries();
  const today   = new Date().toISOString().slice(0, 10);
  const todayRevenue = entries
    .filter(e => e.paidAt?.startsWith(today))
    .reduce((sum, e) => sum + (e.amountTotal || 0), 0);

  res.json({
    ok: true,
    allTime: revenue,
    today: { revenue: todayRevenue, entries: entries.filter(e => e.paidAt?.startsWith(today)).length }
  });
});

app.get('/status', (req, res) => {
  res.json({
    ok:              true,
    service:         'stripe-webhook',
    stripeConfigured: !!STRIPE_SECRET_KEY,
    webhookSecretSet: !!STRIPE_WEBHOOK_SECRET,
    telegramAlerts:   !!(TG_BOT_TOKEN && TG_OWNER_ID),
    premiumChannel:   !!TG_PREMIUM_CHAT_ID,
    revenue
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function boot() {
  const PORT = process.env.STRIPE_PORT || process.env.PORT || 3024;
  app.listen(PORT, () => console.log(`[Stripe Webhook] listening on :${PORT}`));
  ensureDir();

  if (!STRIPE_SECRET_KEY)     console.warn('[Stripe] STRIPE_SECRET_KEY not set');
  if (!STRIPE_WEBHOOK_SECRET) console.warn('[Stripe] STRIPE_WEBHOOK_SECRET not set — set this after creating the webhook endpoint in Stripe Dashboard');

  console.log(`[Stripe Webhook] running on :${PORT}`);
  console.log(`[Stripe Webhook] Webhook URL for Stripe Dashboard: https://YOUR_RAILWAY_URL/webhook`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
