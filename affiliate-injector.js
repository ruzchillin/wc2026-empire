#!/usr/bin/env node
/**
 * WC 2026 Empire — Affiliate Link Injector
 * 
 * Scans every HTML page and injects contextual affiliate links:
 *   - VPN links on streaming/watch pages and player pages
 *   - Booking.com on city guide pages
 *   - Gumroad product links on prediction/fantasy pages
 *   - Ko-fi support button on high-traffic pages
 * 
 * Run: node affiliate-injector.js
 * Run dry: node affiliate-injector.js --dry-run
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ARGS    = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const DIR     = ARGS.find(a=>a.startsWith('--dir='))?.replace('--dir=','') || __dirname;

// ── Your affiliate IDs — fill these in after approval ──────────────────────
const IDS = {
  NORD_ID:        process.env.NORDVPN_AFFILIATE_ID    || 'YOUR_NORD_ID',
  EXPRESS_ID:     process.env.EXPRESSVPN_AFFILIATE_ID || 'YOUR_EXPRESS_ID',
  SURFSHARK_ID:   process.env.SURFSHARK_AFFILIATE_ID  || 'YOUR_SURFSHARK_ID',
  BOOKING_ID:     process.env.BOOKING_AFFILIATE_ID    || 'YOUR_BOOKING_ID',
  STUBHUB_ID:     process.env.STUBHUB_AFFILIATE_ID    || 'YOUR_STUBHUB_ID',
  VIAGOGO_ID:     process.env.VIAGOGO_AFFILIATE_ID    || 'YOUR_VIAGOGO_ID',
  FUBOTV_ID:      process.env.FUBOTV_AFFILIATE_ID     || 'YOUR_FUBOTV_ID',
  DAZN_ID:        process.env.DAZN_AFFILIATE_ID       || 'YOUR_DAZN_ID',
  GUMROAD_URL:    process.env.GUMROAD_PROFILE_URL     || 'https://gumroad.com/wc2026empire',
  KOFI_URL:       process.env.KOFI_URL                || 'https://ko-fi.com/wc2026empire',
  BEEHIIV_URL:    process.env.BEEHIIV_URL             || 'https://wc2026empire.beehiiv.com/subscribe',
  AMAZON_TAG:     process.env.AMAZON_TAG              || 'wc2026empire-21',
};

// ── VPN Banner snippet ──────────────────────────────────────────────────────
const VPN_BANNER = `
<!-- VPN Affiliate Banner — WC2026 Empire -->
<div style="background:linear-gradient(135deg,#060d1a,#0a1520);border:1px solid #1a3a5a;border-radius:12px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <div>
    <div style="font-size:12px;font-weight:800;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">📺 Watching from abroad?</div>
    <div style="font-size:14px;font-weight:700;color:#e8f0f8">Use a VPN to watch WC 2026 free on BBC iPlayer, ARD, RTVE</div>
    <div style="font-size:12px;color:#6080a0;margin-top:2px">Connect to UK → Free BBC. Germany → Free ARD. Spain → Free RTVE.</div>
  </div>
  <div style="display:flex;gap:8px;flex-shrink:0">
    <a href="https://go.nordvpn.net/aff_c?offer_id=15&aff_id=${IDS.NORD_ID}" style="background:#fcc419;color:#000;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">NordVPN — 72% Off →</a>
    <a href="/streaming-vpn" style="background:#1a2a3a;color:#60a5fa;padding:9px 16px;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;border:1px solid #1a3a5a">Compare VPNs</a>
  </div>
</div>`;

// ── Ko-fi support widget ────────────────────────────────────────────────────
const KOFI_WIDGET = `
<!-- Ko-fi Support Widget -->
<div style="background:var(--card,#101510);border:1px solid #ff5e5b44;border-radius:10px;padding:12px 16px;margin:20px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
  <span style="font-size:13px;font-weight:700">☕ Enjoying our free content? Support us with a coffee</span>
  <a href="${IDS.KOFI_URL}" style="background:#ff5e5b;color:#fff;padding:7px 16px;border-radius:20px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener">Buy a Coffee →</a>
</div>`;

// ── Gumroad CTA ─────────────────────────────────────────────────────────────
const GUMROAD_CTA = `
<!-- Gumroad Products CTA -->
<div style="background:linear-gradient(135deg,#0a0500,#150a00);border:1px solid #fcc41933;border-radius:12px;padding:16px 20px;margin:24px 0">
  <div style="font-size:12px;font-weight:800;color:#fcc419;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">📦 Digital Downloads</div>
  <div style="font-size:14px;font-weight:700;margin-bottom:4px">WC 2026 Prediction Pack, Fantasy Cheat Sheet, Stats Dashboard</div>
  <div style="font-size:12px;color:#7a6a40;margin-bottom:10px">Instant downloads from £0.99. Used by 1000s of fans.</div>
  <a href="${IDS.GUMROAD_URL}" style="display:inline-block;background:#fcc419;color:#000;padding:8px 20px;border-radius:20px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener">Browse Products →</a>
</div>`;

// ── Streaming affiliate banner ───────────────────────────────────────────────
const STREAMING_BANNER = `
<!-- Streaming Affiliate Banner — WC2026 Empire -->
<div style="background:linear-gradient(135deg,#0a0e1a,#1a237e);border:1px solid #1565c0;border-radius:12px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <div>
    <div style="font-size:12px;font-weight:800;color:#ffd700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">📺 Watch WC2026 Live</div>
    <div style="font-size:14px;font-weight:700;color:#e8f0f8">Stream every match — fuboTV, DAZN, Peacock & more</div>
    <div style="font-size:12px;color:#90caf9;margin-top:2px">Compare all streaming options for your country</div>
  </div>
  <div style="display:flex;gap:8px;flex-shrink:0">
    <a href="/go/fubotv" style="background:#ffd700;color:#000;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">fuboTV Free Trial →</a>
    <a href="/watch-wc2026" style="background:#1a2a3a;color:#90caf9;padding:9px 16px;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;border:1px solid #1565c0">All Options</a>
  </div>
</div>`;

// ── Travel affiliate banner ───────────────────────────────────────────────
const TRAVEL_BANNER = `
<!-- Travel Affiliate Banner — WC2026 Empire -->
<div style="background:linear-gradient(135deg,#0a1520,#003580);border:1px solid #0071c2;border-radius:12px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <div>
    <div style="font-size:12px;font-weight:800;color:#ffd700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">✈️ Going to WC2026?</div>
    <div style="font-size:14px;font-weight:700;color:#e8f0f8">Book hotels near all 16 host city stadiums</div>
    <div style="font-size:12px;color:#90caf9;margin-top:2px">Prices from $90/night — book before they sell out</div>
  </div>
  <div style="display:flex;gap:8px;flex-shrink:0">
    <a href="/go/booking" style="background:#003580;color:#fff;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">Booking.com →</a>
    <a href="/wc2026-travel" style="background:#1a2a3a;color:#90caf9;padding:9px 16px;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;border:1px solid #1565c0">Travel Guide</a>
  </div>
</div>`;

// ── Tickets affiliate banner ───────────────────────────────────────────────
const TICKETS_BANNER = `
<!-- Tickets Affiliate Banner — WC2026 Empire -->
<div style="background:linear-gradient(135deg,#0a0500,#1a0800);border:1px solid #ff8f00;border-radius:12px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <div>
    <div style="font-size:12px;font-weight:800;color:#ffd700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">🎟️ WC2026 Tickets</div>
    <div style="font-size:14px;font-weight:700;color:#e8f0f8">Buy & sell match tickets — Group Stage from $150</div>
    <div style="font-size:12px;color:#ffcc80;margin-top:2px">100% guarantee on StubHub, Viagogo & SeatGeek</div>
  </div>
  <div style="display:flex;gap:8px;flex-shrink:0">
    <a href="/go/stubhub" style="background:#ffd700;color:#000;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">Find Tickets →</a>
    <a href="/wc2026-tickets" style="background:#1a2a3a;color:#90caf9;padding:9px 16px;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;border:1px solid #ff8f00">Compare All</a>
  </div>
</div>`;

// ── Newsletter banner ───────────────────────────────────────────────
const NEWSLETTER_BANNER = `
<!-- Newsletter Banner — WC2026 Empire -->
<div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460;border-radius:12px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <div>
    <div style="font-size:12px;font-weight:800;color:#ffd700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">📧 Free Daily Picks</div>
    <div style="font-size:14px;font-weight:700;color:#e8f0f8">Join 47,000+ fans — WC2026 previews every morning</div>
    <div style="font-size:12px;color:#90caf9;margin-top:2px">Free forever. Premium tier for exclusive tips.</div>
  </div>
  <div style="display:flex;gap:8px;flex-shrink:0">
    <a href="/wc2026-newsletter" style="background:#ffd700;color:#000;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none">Subscribe Free →</a>
  </div>
</div>`;

// ── Page classification rules ──────────────────────────────────────────────
const RULES = [
  // VPN banner → streaming pages, player pages, country pages, match pages
  {
    pattern: /streaming|vpn|watch|broadcast|iplayer|dazn|fubotv|espn|player|country|wc2026|match|preview|prediction|live/i,
    snippet: VPN_BANNER,
    anchor: '</main>',
    skip_if: /vpn-banner|nordvpn\.net/,
    label: 'VPN banner'
  },
  // Streaming banner → match preview pages, group pages, tournament pages
  {
    pattern: /group-[a-l]|match|preview|schedule|fixture|bracket|knockout|final|semifinal/i,
    snippet: STREAMING_BANNER,
    anchor: '</footer>',
    fallback_anchor: '</body>',
    skip_if: /streaming-banner|fubotv/,
    label: 'Streaming banner'
  },
  // Travel banner → country pages, group pages, venue pages
  {
    pattern: /group-[a-l]|-wc2026|country|venue|city|stadium|host/i,
    snippet: TRAVEL_BANNER,
    anchor: '</footer>',
    fallback_anchor: '</body>',
    skip_if: /travel-banner|booking\.com/,
    label: 'Travel banner'
  },
  // Tickets banner → match pages, group pages, fixture pages
  {
    pattern: /group-[a-l]|match|fixture|schedule|knockout|stadium/i,
    snippet: TICKETS_BANNER,
    anchor: '</footer>',
    fallback_anchor: '</body>',
    skip_if: /tickets-banner|stubhub/,
    label: 'Tickets banner'
  },
  // Newsletter banner → prediction, tips, analysis pages (high engagement)
  {
    pattern: /prediction|tips|picks|odds|fantasy|analysis|preview/i,
    snippet: NEWSLETTER_BANNER,
    anchor: '</footer>',
    fallback_anchor: '</body>',
    skip_if: /newsletter-banner|beehiiv/,
    label: 'Newsletter banner'
  },
  // Ko-fi → all pages with decent content (everything)
  {
    pattern: /.*/,
    snippet: KOFI_WIDGET,
    anchor: '</footer>',
    fallback_anchor: '</body>',
    skip_if: /ko-fi\.com|kofi-widget/,
    label: 'Ko-fi widget'
  },
  // Gumroad CTA → prediction, fantasy, quiz, odds, picks pages
  {
    pattern: /prediction|fantasy|quiz|picks|odds|acca|betting|tips|ai-/i,
    snippet: GUMROAD_CTA,
    anchor: '</main>',
    skip_if: /gumroad\.com|gumroad-products/,
    label: 'Gumroad CTA'
  },
];

// ── Main injection logic ───────────────────────────────────────────────────
let injected = 0, skipped = 0, unchanged = 0;
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));

for (const file of files) {
  const fpath = path.join(DIR, file);
  let html = fs.readFileSync(fpath, 'utf8');
  let changed = false;

  for (const rule of RULES) {
    // Check if this page matches the pattern
    if (!rule.pattern.test(file)) continue;
    // Check if already injected
    if (rule.skip_if && rule.skip_if.test(html)) continue;

    const anchor = html.includes(rule.anchor) ? rule.anchor : (rule.fallback_anchor || null);
    if (!anchor || !html.includes(anchor)) continue;

    const insertion = rule.snippet + '\n' + anchor;
    if (!DRY_RUN) {
      html = html.replace(anchor, insertion);
    }
    console.log(`  ${DRY_RUN?'[DRY]':''} ${file} → ${rule.label}`);
    injected++;
    changed = true;
  }

  if (changed && !DRY_RUN) {
    fs.writeFileSync(fpath, html, 'utf8');
  } else if (!changed) {
    unchanged++;
  }
}

console.log(`\n[AffiliateInjector] Complete:`);
console.log(`  Injections applied: ${injected}`);
console.log(`  Files unchanged:    ${unchanged}`);
console.log(`  Dry run:           ${DRY_RUN}`);
console.log(`\nNext step: update IDs in this file after affiliate approvals:`);
console.log(`  NORDVPN_AFFILIATE_ID, EXPRESSVPN_AFFILIATE_ID, etc.`);
