/**
 * WC2026 Empire — Skimlinks + Ezoic + Awin Revenue Engine
 * Auto-monetization layers that work on top of existing content
 *
 * Skimlinks: Auto-converts product mentions into affiliate links (25K+ merchants)
 * Ezoic: AI-powered ad network — 3-5x more revenue than AdSense alone
 * Awin: 21K advertisers, includes sports/travel/VPN brands
 * CJ Affiliate: Commission Junction — ESPN+, Paramount+, sports brands
 * Dream11 Affiliate: India fantasy sports — massive WC traffic
 * MPL Affiliate: India gaming platform
 *
 * Port: 3053
 * Zero code needed on pages — just add one JS snippet per network
 *
 * SIGNUP LINKS (all free):
 * Skimlinks:  skimlinks.com/join
 * Ezoic:      ezoic.com/publishers  (replaces/supplements AdSense)
 * Awin:       awin.com/us/publisher
 * CJ:         cj.com/publisher
 * Dream11:    affiliates.dream11.com
 * MPL:        partners.mpl.live
 */

const http = require('http');
const https = require('https');

const PORT = process.env.SKIMLINKS_PORT || process.env.PORT || 3053;
const SITE = process.env.SITE_URL || 'https://wc2026-sports-empire.vercel.app';
const BOT  = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT = process.env.TELEGRAM_GROUP_CHAT_ID || '';

// ─── Auto-monetization network snippets ───────────────────────────────────────
// Add these to ALL your HTML pages (in <head> or before </body>)

const SNIPPETS = {
  skimlinks: {
    name: 'Skimlinks',
    description: 'Auto-converts any product/brand mention into affiliate links. Works on existing content.',
    revenue: '$0.50-5 per click through (varies by merchant)',
    snippet: `<!-- Skimlinks — Auto-affiliate all product mentions -->
<script type="text/javascript">
(function() {
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  s.src = 'https://s.skimresources.com/js/YOUR_PUBLISHER_ID.skimlinks.js';
  var x = document.getElementsByTagName('script')[0];
  x.parentNode.insertBefore(s, x);
})();
</script>`,
    signup: 'https://skimlinks.com/join',
    timeToApproval: '24-48 hours',
  },

  ezoic: {
    name: 'Ezoic',
    description: 'AI-powered ad optimization — averages 3-5x more revenue than AdSense alone.',
    revenue: '$4-20 EPMV (per 1000 visitors) — much higher than AdSense $1-5 RPM',
    snippet: `<!-- Ezoic — AI Ad Optimization (replaces/enhances AdSense) -->
<script async src="//www.ezojs.com/ezoic/sa.min.js"></script>`,
    setup: 'Point your domain to Ezoic nameservers OR add Cloudflare integration',
    signup: 'https://ezoic.com/publishers',
    timeToApproval: '1-7 days, 10K monthly views minimum',
  },

  awin: {
    name: 'Awin',
    description: '21K advertisers — VPNs, travel, sports streaming, betting affiliates',
    revenue: 'Varies by advertiser — VPNs $30-80, travel 2-8%',
    programs: [
      'NordVPN (on Awin) — $40-80 CPA',
      'Booking.com (on Awin) — 4% commission',
      'AirBnB (on Awin) — 5% commission',
      'Sky Sports (on Awin) — £10 per signup',
      'Betway (on Awin) — £30 CPA (UK, 18+ only)',
    ],
    signup: 'https://www.awin.com/us/publisher',
    timeToApproval: '3-7 days',
  },

  cj: {
    name: 'CJ Affiliate (Commission Junction)',
    description: 'Sports streaming brands — ESPN+, Paramount+, Peacock, beIN Sports',
    revenue: '$10-30 per subscription signup',
    programs: [
      'ESPN+ — $10 per signup',
      'Paramount+ — $8 per signup',
      'Peacock — $8 per signup',
      'FuboTV — $20 per signup',
      'DAZN — $15 per signup',
    ],
    signup: 'https://www.cj.com/publisher',
    timeToApproval: '3-7 days',
  },

  dream11: {
    name: 'Dream11 Affiliate',
    description: 'India\'s #1 fantasy sports — 200M users. Earns ₹100-500 per referral.',
    revenue: '₹100-500 per new user who deposits (≈ $1.20-6 USD)',
    volume: 'During WC2026: millions of Indians playing fantasy → massive conversion',
    snippet: `<!-- Dream11 Affiliate Banner -->
<a href="https://www.dream11.com/?referralCode=YOUR_REF_CODE" target="_blank" rel="nofollow">
  <img src="https://dreams.dream11.com/referral-banner.jpg" alt="Play Dream11 Fantasy World Cup">
</a>`,
    signup: 'https://affiliates.dream11.com',
    timeToApproval: 'Instant (Indian phone number required)',
  },

  mpl: {
    name: 'MPL (Mobile Premier League) Affiliate',
    description: 'India gaming + fantasy sports, 100M users. Higher commissions than Dream11.',
    revenue: '₹200-800 per new depositing user',
    signup: 'https://partners.mpl.live',
    timeToApproval: '1-3 days',
  },

  sovrn: {
    name: 'Sovrn //Commerce (formerly VigLink)',
    description: 'Like Skimlinks — auto-monetizes links. Good for Amazon + general ecommerce.',
    revenue: '1-15% commission on purchases driven',
    snippet: `<!-- Sovrn //Commerce — auto-monetize links -->
<script type="text/javascript">var vglnk = {key: 'YOUR_SOVRN_KEY'};</script>
<script async src="//cdn.viglink.com/api/vglnk.js"></script>`,
    signup: 'https://sovrn.com/publishers/commerce/',
  },

  adsterra: {
    name: 'Adsterra',
    description: 'High-CPM ad network especially for international (non-US) traffic. Great for your 20+ country audience.',
    revenue: '$1-8 CPM for international traffic',
    snippet: `<!-- Adsterra — Works well for India/Africa/LatAm traffic -->
<!-- Add YOUR Adsterra zone code from dashboard -->`,
    signup: 'https://publishers.adsterra.com',
    timeToApproval: 'Instant auto-approval',
  },
};

// ─── Inject Skimlinks into all HTML pages ─────────────────────────────────────
const SKIMLINKS_INJECTION = (publisherId) => `
<!-- === AUTO-AFFILIATE: Skimlinks === -->
<script type="text/javascript">
(function() {
  var s = document.createElement('script');
  s.type = 'text/javascript'; s.async = true;
  s.src = 'https://s.skimresources.com/js/${publisherId || 'YOUR_PUBLISHER_ID'}.skimlinks.js';
  document.head.appendChild(s);
})();
</script>`;

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
    res.end(JSON.stringify({ status: 'ok', service: 'skimlinks-ezoic-engine', networks: Object.keys(SNIPPETS).length }));
    return;
  }

  if (url === '/networks') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(SNIPPETS));
    return;
  }

  if (url === '/trigger' || url === '/setup') {
    const msg = `💰 *Auto-Monetization Networks to Add*\n\n` +
      `*HIGHEST PRIORITY:*\n` +
      `1️⃣ Ezoic — ezoic.com/publishers\n→ 3-5x more than AdSense, easy setup\n\n` +
      `2️⃣ Skimlinks — skimlinks.com/join\n→ Auto-converts ALL text to affiliate links, zero extra work\n\n` +
      `3️⃣ Awin — awin.com/us/publisher\n→ 21K advertisers, NordVPN/Booking.com etc\n\n` +
      `4️⃣ Dream11 affiliate (India)\n→ affiliates.dream11.com — ₹100-500 per referral during WC\n\n` +
      `5️⃣ Adsterra — publishers.adsterra.com\n→ Instant approval, great for India/Africa traffic\n\n` +
      `6️⃣ CJ Affiliate — cj.com/publisher\n→ ESPN+, Paramount+, Peacock signup commissions`;
    tgAlert(msg);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, networks: Object.keys(SNIPPETS), message: 'Setup guide sent to Telegram' }));
    return;
  }

  if (url === '/skimlinks-snippet') {
    const publisherId = process.env.SKIMLINKS_PUBLISHER_ID || 'YOUR_ID';
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(SKIMLINKS_INJECTION(publisherId));
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`[Skimlinks/Ezoic Engine] Port ${PORT}`);
  console.log('[Revenue] Networks: Skimlinks, Ezoic, Awin, CJ, Dream11, MPL, Sovrn, Adsterra');
  console.log('[Revenue] IMPORTANT: Ezoic alone can 3-5x your ad revenue vs AdSense');
});
