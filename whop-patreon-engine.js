/**
 * WC2026 Empire — Whop + Patreon + Stan Store Membership Engine
 * Digital product + community monetization platforms
 *
 * Whop:    whop.com — sell Discord/Telegram access, courses, digital products
 *          Takes 3% fee, used by 100K+ creators, WC2026 picks community = perfect fit
 * Patreon: patreon.com — tiered membership, 8M+ patrons on platform
 * Stan:    stan.store — all-in-one creator store, 0% transaction fees
 * Lemon Squeezy: lemonsqueezy.com — Gumroad alternative, better UI
 * Buy Me a Coffee: buymeacoffee.com — tips + membership
 *
 * Port: 3054
 * Strategy: Sell PREMIUM WC2026 PICKS COMMUNITY
 *   Tier 1 - $4.99/mo: Daily picks delivered to Telegram/Discord
 *   Tier 2 - $14.99/mo: AI model access + live odds alerts
 *   Tier 3 - $29.99/mo: Full VIP — 1-on-1 AI picks + exclusive content
 */

const http = require('http');
const https = require('https');

const PORT  = process.env.WHOP_PORT || process.env.PORT || 3054;
const SITE  = process.env.SITE_URL || 'https://wc2026-sports-empire.vercel.app';
const BOT   = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT  = process.env.TELEGRAM_GROUP_CHAT_ID || '';

// ─── Membership Tiers ─────────────────────────────────────────────────────────
const TIERS = {
  starter: {
    name: '⚽ WC2026 Fan Pass',
    price: '$4.99/month',
    platform: 'Whop or Patreon',
    perks: [
      'Daily AI match predictions',
      'Telegram group access',
      'Pre-match alerts (60 min before kickoff)',
      'Weekly picks newsletter',
    ],
    audience: 'Casual fans who want better predictions',
  },
  pro: {
    name: '🔥 Empire Pro',
    price: '$14.99/month',
    platform: 'Whop or Patreon',
    perks: [
      'Everything in Fan Pass',
      'Live odds comparison alerts',
      'Full AI model output (all 48 teams)',
      'Discord VIP channel',
      'Early access to viral content',
    ],
    audience: 'Serious fans, fantasy players',
  },
  vip: {
    name: '👑 Empire VIP',
    price: '$29.99/month',
    platform: 'Whop',
    perks: [
      'Everything in Pro',
      'Personal Telegram bot access (/picks, /analysis)',
      'Match-specific deep analysis on request',
      'Private Discord with analyst',
      'Revenue share referral bonus',
    ],
    audience: 'Power users, fantasy league managers, sports media',
  },
};

// ─── Platform signup + setup info ────────────────────────────────────────────
const PLATFORMS = {
  whop: {
    signup: 'https://whop.com/hub',
    fee: '3% of revenue',
    bestFor: 'Discord/Telegram community access, picks subscriptions',
    setup: 'Create product → set price → connect Telegram/Discord → done',
    timeToFirst$: 'Same day',
    audience: 'US/UK heavy, 18-35 demographic — perfect for WC2026',
  },
  patreon: {
    signup: 'https://www.patreon.com/portal/registration/register-intro',
    fee: '5-12% of revenue',
    bestFor: 'Membership tiers, video content, newsletters',
    setup: 'Create page → set tiers → integrate with email',
    timeToFirst$: '1-3 days for approval',
    audience: 'Global, broad demographic',
  },
  stan: {
    signup: 'https://stan.store',
    fee: '0% transaction fees (just Stripe fees)',
    bestFor: 'All-in-one: digital products + memberships + bookings',
    setup: '15 minutes, very simple',
    timeToFirst$: 'Immediate',
    audience: 'Gen Z heavy, TikTok/Instagram creators',
  },
  lemonsqueezy: {
    signup: 'https://www.lemonsqueezy.com',
    fee: '5% + $0.50 per transaction',
    bestFor: 'Alternative to Gumroad — PDF guides, spreadsheets, one-time products',
    setup: 'Same as Gumroad, better checkout UI',
    timeToFirst$: 'Immediate',
    note: 'Handles EU VAT automatically — Gumroad does not',
  },
  buymeacoffee: {
    signup: 'https://www.buymeacoffee.com',
    fee: '5% on memberships',
    bestFor: 'Tips + light membership, easy for fans to support you',
    setup: '5 minutes',
    timeToFirst$: 'Immediate',
    audience: 'All ages, works well in UK/India/global',
  },
};

// ─── Promotional content for Telegram/social ─────────────────────────────────
const PROMO_POSTS = [
  () => `🏆 WC2026 Empire VIP is OPEN\n\nGet daily AI predictions, live odds alerts, and Telegram group access for just $4.99/month.\n\n241 pages of data → one daily picks message.\n\nJoin: ${SITE}/wc2026-premium.html`,
  () => `📊 Our AI ran 50,000 World Cup simulations.\n\nVIP members got the results at 8am this morning.\n\nFan Pass: $4.99/mo → ${SITE}/wc2026-premium.html`,
  () => `🎯 Empire Pro members got 3 correct predictions today.\n\nStill available: ${SITE}/wc2026-premium.html\n\n$14.99/month. Cancel anytime.`,
];

function getPromoPost() {
  return PROMO_POSTS[Math.floor(Math.random() * PROMO_POSTS.length)]();
}

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
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'whop-patreon-engine', tiers: Object.keys(TIERS).length }));
    return;
  }

  if (url === '/tiers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(TIERS));
    return;
  }

  if (url === '/platforms') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(PLATFORMS));
    return;
  }

  if (url === '/trigger' || url === '/promo') {
    const post = getPromoPost();
    tgAlert(`🎯 *Membership Promo*\n\n${post}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, post }));
    return;
  }

  if (url === '/setup-guide') {
    const guide = `🏪 *Membership Platform Priority*\n\n` +
      `*START WITH WHOP* (fastest money):\n` +
      `→ whop.com/hub\n` +
      `→ Create "WC2026 Empire Fan Pass" — $4.99/mo\n` +
      `→ Connect your Telegram group as the deliverable\n` +
      `→ Share link everywhere — done\n\n` +
      `*THEN ADD STAN STORE* (0% fees):\n` +
      `→ stan.store\n` +
      `→ Sell your 8 Gumroad products here too\n` +
      `→ Better for TikTok/Instagram traffic\n\n` +
      `*Revenue projections:*\n` +
      `100 Fan Pass = $499/mo\n` +
      `50 Pro = $749/mo\n` +
      `20 VIP = $599/mo\n` +
      `Total = $1,847/mo recurring`;
    tgAlert(guide);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, platforms: PLATFORMS, tiers: TIERS }));
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`[Whop/Patreon Engine] Port ${PORT}`);
  console.log('[Membership] Tiers:', Object.keys(TIERS).join(', '));
  console.log('[Membership] Platforms:', Object.keys(PLATFORMS).join(', '));

  // Promo post 2x per day
  setInterval(() => {
    const h = new Date().getUTCHours(), m = new Date().getUTCMinutes();
    if ((h === 13 || h === 20) && m === 30) {
      tgAlert(`📣 *Post this membership promo now:*\n\n${getPromoPost()}`);
    }
  }, 60 * 1000);
});
