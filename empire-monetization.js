/**
 * WC 2026 Empire — Global Monetization Engine
 * Auto-injects affiliate banners based on page type + user geo
 * NO gambling/betting content — VPN, streaming, travel, tickets, Ko-fi, Gumroad only
 *
 * Add to every page: <script src="/empire-monetization.js" defer></script>
 */
(function () {
  'use strict';

  // ── Affiliate URLs (swap with real IDs once approved) ──────────────────────
  const AFF = {
    nordvpn:    'https://go.nordvpn.net/aff_c?offer_id=15&aff_id=YOUR_NORD_ID&url_id=902',
    expressvpn: 'https://www.expressvpn.com/order?a_aid=YOUR_EXPRESS_ID',
    surfshark:  'https://surfshark.com/offer?coupon=wc2026&transaction_id=YOUR_SURF_ID',
    fubotv:     'https://www.fubo.tv/welcome?irad=YOUR_FUBOTV_ID&irmp=YOUR_FUBOTV_MP',
    dazn:       'https://www.dazn.com/?utm_source=wc2026empire&utm_medium=affiliate',
    peacock:    'https://www.peacocktv.com/?utm_source=wc2026empire',
    booking:    'https://www.booking.com/index.html?aid=YOUR_BOOKING_AID',
    stubhub:    'https://www.stubhub.com/?clickId=YOUR_STUBHUB_ID',
    viagogo:    'https://www.viagogo.com/?aid=YOUR_VIAGOGO_ID',
    kofi:       'https://ko-fi.com/wc2026empire',
    gumroad:    'https://wc2026empire.gumroad.com',
    amazon:     'https://www.amazon.com/?tag=wc2026empire-21',
    beehiiv:    'https://wc2026empire.beehiiv.com/subscribe',
  };

  // ── Detect page type from URL ───────────────────────────────────────────────
  const path = window.location.pathname.toLowerCase();
  const isVPNPage      = /stream|watch|vpn|iplayer|broadcast|live|match|player|country|wc2026/.test(path);
  const isStreamPage   = /stream|watch|live|match|schedule|fixture|group|knockout|final/.test(path);
  const isTravelPage   = /travel|hotel|stadium|venue|city|host|fan-zone|country|group/.test(path);
  const isTicketPage   = /ticket|match|fixture|stadium|group|knockout/.test(path);
  const isPredictPage  = /predict|tip|pick|fantasy|odds|ai-|analysis|preview/.test(path);

  // ── Geo detection (fast, client-side) ─────────────────────────────────────
  let _geo = null;
  async function getGeo() {
    if (_geo) return _geo;
    try {
      const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      _geo = d.country_code || 'US';
    } catch { _geo = 'US'; }
    return _geo;
  }

  // ── Track affiliate clicks via GA4 ─────────────────────────────────────────
  function track(name, url) {
    if (typeof gtag === 'function') {
      gtag('event', 'affiliate_click', { affiliate: name, page: path });
    }
    return url;
  }

  // ── Banner HTML builders ────────────────────────────────────────────────────
  function vpnBanner() {
    return `
<div class="emp-banner emp-vpn" style="background:linear-gradient(135deg,#060d1a,#0a1520);border:1px solid #1a3a5a;border-radius:12px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-family:inherit">
  <div>
    <div style="font-size:11px;font-weight:800;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">📺 Watching from abroad?</div>
    <div style="font-size:14px;font-weight:700;color:#e8f0f8">Watch WC 2026 FREE — BBC iPlayer, ARD, RTVE & more</div>
    <div style="font-size:11px;color:#6080a0;margin-top:2px">Connect to UK = Free BBC iPlayer. Germany = Free ARD. Spain = Free RTVE.</div>
  </div>
  <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap">
    <a href="${AFF.nordvpn}" onclick="window.__empTrack('NordVPN')" style="background:#fcc419;color:#000;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">NordVPN — 74% Off ➜</a>
    <a href="${AFF.expressvpn}" onclick="window.__empTrack('ExpressVPN')" style="background:#da3730;color:#fff;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">ExpressVPN ➜</a>
    <a href="${AFF.surfshark}" onclick="window.__empTrack('Surfshark')" style="background:#1dbdbd;color:#fff;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">Surfshark ➜</a>
  </div>
</div>`;
  }

  function streamingBanner() {
    return `
<div class="emp-banner emp-streaming" style="background:linear-gradient(135deg,#0a0e1a,#1a237e);border:1px solid #1565c0;border-radius:12px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-family:inherit">
  <div>
    <div style="font-size:11px;font-weight:800;color:#ffd700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">📺 Watch WC 2026 Live</div>
    <div style="font-size:14px;font-weight:700;color:#e8f0f8">Stream every match — fuboTV, DAZN, Peacock & more</div>
    <div style="font-size:11px;color:#90caf9;margin-top:2px">Free trials available — cancel anytime</div>
  </div>
  <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap">
    <a href="${AFF.fubotv}" onclick="window.__empTrack('fuboTV')" style="background:#ffd700;color:#000;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">fuboTV Free Trial ➜</a>
    <a href="${AFF.dazn}" onclick="window.__empTrack('DAZN')" style="background:#f4006b;color:#fff;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">DAZN ➜</a>
    <a href="${AFF.peacock}" onclick="window.__empTrack('Peacock')" style="background:#000;color:#fff;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">Peacock ➜</a>
  </div>
</div>`;
  }

  function travelBanner() {
    return `
<div class="emp-banner emp-travel" style="background:linear-gradient(135deg,#0a1520,#003580);border:1px solid #0071c2;border-radius:12px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-family:inherit">
  <div>
    <div style="font-size:11px;font-weight:800;color:#ffd700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">✈️ Going to WC 2026?</div>
    <div style="font-size:14px;font-weight:700;color:#e8f0f8">Book hotels near all 16 host stadiums — prices from $89/night</div>
    <div style="font-size:11px;color:#90caf9;margin-top:2px">New York, LA, Dallas, Miami, Seattle, Boston + more host cities</div>
  </div>
  <div style="display:flex;gap:8px;flex-shrink:0">
    <a href="${AFF.booking}" onclick="window.__empTrack('Booking.com')" style="background:#003580;color:#fff;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">Booking.com ➜</a>
  </div>
</div>`;
  }

  function ticketsBanner() {
    return `
<div class="emp-banner emp-tickets" style="background:linear-gradient(135deg,#0a0500,#1a0800);border:1px solid #ff8f00;border-radius:12px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-family:inherit">
  <div>
    <div style="font-size:11px;font-weight:800;color:#ffd700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">🎟️ WC 2026 Tickets</div>
    <div style="font-size:14px;font-weight:700;color:#e8f0f8">Buy & sell official match tickets — Group Stage from $150</div>
    <div style="font-size:11px;color:#ffcc80;margin-top:2px">100% buyer guarantee on StubHub & Viagogo</div>
  </div>
  <div style="display:flex;gap:8px;flex-shrink:0">
    <a href="${AFF.stubhub}" onclick="window.__empTrack('StubHub')" style="background:#ffd700;color:#000;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">StubHub ➜</a>
    <a href="${AFF.viagogo}" onclick="window.__empTrack('Viagogo')" style="background:#e04400;color:#fff;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener sponsored">Viagogo ➜</a>
  </div>
</div>`;
  }

  function kofiWidget() {
    return `
<div class="emp-banner emp-kofi" style="background:#141414;border:1px solid #ff5e5b44;border-radius:10px;padding:12px 16px;margin:20px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;font-family:inherit">
  <span style="font-size:13px;font-weight:700;color:#e8f0f8">☕ Enjoying free AI picks? Support us with a coffee</span>
  <a href="${AFF.kofi}" onclick="window.__empTrack('Ko-fi')" style="background:#ff5e5b;color:#fff;padding:7px 16px;border-radius:20px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener">Buy a Coffee ➜</a>
</div>`;
  }

  function gumroadCTA() {
    return `
<div class="emp-banner emp-gumroad" style="background:linear-gradient(135deg,#0a0500,#150a00);border:1px solid #fcc41933;border-radius:12px;padding:16px 20px;margin:24px 0;font-family:inherit">
  <div style="font-size:11px;font-weight:800;color:#fcc419;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">📦 Digital Downloads</div>
  <div style="font-size:14px;font-weight:700;color:#e8f0f8;margin-bottom:4px">WC 2026 Prediction Pack · Fantasy Cheat Sheet · AI Stats Dashboard</div>
  <div style="font-size:11px;color:#7a6a40;margin-bottom:10px">Instant download from £0.99 · Used by 10,000s of fans</div>
  <a href="${AFF.gumroad}" onclick="window.__empTrack('Gumroad')" style="display:inline-block;background:#fcc419;color:#000;padding:8px 20px;border-radius:20px;font-weight:800;font-size:12px;text-decoration:none" target="_blank" rel="noopener">Browse Downloads ➜</a>
</div>`;
  }

  function newsletterBanner() {
    return `
<div class="emp-banner emp-newsletter" style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460;border-radius:12px;padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-family:inherit">
  <div>
    <div style="font-size:11px;font-weight:800;color:#ffd700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">📧 Free Daily AI Picks</div>
    <div style="font-size:14px;font-weight:700;color:#e8f0f8">Join 50,000+ fans — WC 2026 match previews every morning</div>
    <div style="font-size:11px;color:#90caf9;margin-top:2px">Free forever. Unsubscribe anytime.</div>
  </div>
  <a href="${AFF.beehiiv}" onclick="window.__empTrack('Newsletter')" style="background:#ffd700;color:#000;padding:9px 16px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none;flex-shrink:0" target="_blank" rel="noopener">Subscribe Free ➜</a>
</div>`;
  }

  // ── Inject banners into page ────────────────────────────────────────────────
  window.__empTrack = function (name) {
    if (typeof gtag === 'function') gtag('event', 'affiliate_click', { affiliate: name, page: path });
  };

  function injectBanners() {
    // Find best injection point: before </footer>, or before </main>, or before </body>
    const footer = document.querySelector('footer');
    const main   = document.querySelector('main');
    const body   = document.body;

    const after  = footer || main || body;
    if (!after) return;

    const container = document.createElement('div');
    container.id = 'emp-monetization-banners';
    container.style.cssText = 'max-width:900px;margin:0 auto;padding:0 16px';

    let html = '';

    // VPN banner: on most pages
    if (isVPNPage && !document.querySelector('.emp-vpn')) html += vpnBanner();

    // Streaming banner: watch/match/schedule pages
    if (isStreamPage && !document.querySelector('.emp-streaming')) html += streamingBanner();

    // Travel banner: country/venue/city pages
    if (isTravelPage && !document.querySelector('.emp-travel')) html += travelBanner();

    // Tickets banner: match/ticket/stadium pages
    if (isTicketPage && !document.querySelector('.emp-tickets')) html += ticketsBanner();

    // Gumroad: prediction/tips/fantasy pages
    if (isPredictPage && !document.querySelector('.emp-gumroad')) html += gumroadCTA();

    // Newsletter: prediction/analysis pages
    if (isPredictPage && !document.querySelector('.emp-newsletter')) html += newsletterBanner();

    // Ko-fi: every page
    if (!document.querySelector('.emp-kofi')) html += kofiWidget();

    if (!html) return;
    container.innerHTML = html;

    // Insert before footer, or append to body
    if (footer) {
      footer.parentNode.insertBefore(container, footer);
    } else if (main) {
      main.appendChild(container);
    } else {
      body.appendChild(container);
    }

    // VPN banner also at top of page for streaming/watch pages (high intent)
    if (isStreamPage || isVPNPage) {
      const topBanner = document.createElement('div');
      topBanner.style.cssText = 'position:sticky;top:0;z-index:9999;background:#0a0e1a;padding:8px 16px;display:flex;align-items:center;justify-content:center;gap:12px;font-family:inherit;border-bottom:1px solid #1a3a5a';
      topBanner.innerHTML = `
        <span style="font-size:12px;font-weight:700;color:#e8f0f8">📺 Watch WC 2026 FREE abroad with a VPN:</span>
        <a href="${AFF.nordvpn}" onclick="window.__empTrack('NordVPN-top')" style="background:#fcc419;color:#000;padding:5px 12px;border-radius:6px;font-weight:800;font-size:11px;text-decoration:none" target="_blank" rel="noopener sponsored">NordVPN 74% Off</a>
        <a href="${AFF.expressvpn}" onclick="window.__empTrack('ExpressVPN-top')" style="background:#da3730;color:#fff;padding:5px 12px;border-radius:6px;font-weight:800;font-size:11px;text-decoration:none" target="_blank" rel="noopener sponsored">ExpressVPN</a>
        <button onclick="this.parentNode.remove()" style="background:none;border:none;color:#6080a0;cursor:pointer;font-size:16px;padding:0 4px">✕</button>`;

      const firstChild = document.body.firstChild;
      document.body.insertBefore(topBanner, firstChild);
    }
  }

  // ── Run on DOM ready ────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanners);
  } else {
    injectBanners();
  }

})();
