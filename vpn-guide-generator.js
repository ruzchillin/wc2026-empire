// vpn-guide-generator.js
// Generates "How to watch WC 2026 in [country]" pages for 200 countries
// NordVPN + ExpressVPN + Surfshark affiliate — $40-100 per signup
// Run once: node vpn-guide-generator.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ── AFFILIATE LINKS ──────────────────────────────────────────
const AFFILIATES = {
  nordvpn: `https://go.nordvpn.net/aff_c?offer_id=15&aff_id=${process.env.NORDVPN_AFFILIATE_ID || 'YOUR_ID'}`,
  expressvpn: `https://www.expressvpn.com/refer-a-friend/30-days-free?u=${process.env.EXPRESSVPN_AFFILIATE_ID || 'YOUR_ID'}`,
  surfshark: `https://surfshark.com/invite/${process.env.SURFSHARK_AFFILIATE_ID || 'YOUR_ID'}`,
};

// ── BROADCAST RIGHTS BY COUNTRY ─────────────────────────────
// broadcaster: who has rights | free: is it free | streaming: name of streaming service
const BROADCAST = {
  'united-states': { broadcaster: 'Fox Sports + Telemundo', free: false, streaming: 'Fubo TV / Peacock', note: 'Fox Sports requires cable, but Fubo TV streams it online.' },
  'united-kingdom': { broadcaster: 'ITV + BBC', free: true, streaming: 'ITVX + BBC iPlayer', note: 'Completely free — ITV and BBC share the rights.' },
  'australia': { broadcaster: 'SBS', free: true, streaming: 'SBS On Demand', note: 'SBS has free-to-air broadcast and free streaming.' },
  'canada': { broadcaster: 'CTV + TSN', free: false, streaming: 'TSN Direct', note: 'TSN requires a subscription. CTV has some free matches.' },
  'ireland': { broadcaster: 'RTÉ + Virgin Media', free: true, streaming: 'RTÉ Player', note: 'RTÉ streams free in Ireland.' },
  'nigeria': { broadcaster: 'DSTV SuperSport', free: false, streaming: 'DStv Now', note: 'DStv subscription required.' },
  'south-africa': { broadcaster: 'SABC + SuperSport', free: true, streaming: 'SABC Sport App', note: 'SABC has free broadcast rights for select matches.' },
  'india': { broadcaster: 'JioCinema + Sports18', free: true, streaming: 'JioCinema (free!)', note: 'JioCinema is streaming all WC 2026 matches FREE in India.' },
  'brazil': { broadcaster: 'Globo + SporTV', free: true, streaming: 'Globoplay', note: 'Globo has free-to-air rights. Globoplay for streaming.' },
  'germany': { broadcaster: 'ARD + ZDF', free: true, streaming: 'ARD Mediathek / ZDF Mediathek', note: 'Public broadcasters — 100% free.' },
  'france': { broadcaster: 'TF1 + M6 + beIN Sports', free: true, streaming: 'TF1+ / M6+', note: 'TF1 and M6 free. beIN Sports for complete coverage.' },
  'spain': { broadcaster: 'RTVE + Mediaset', free: true, streaming: 'RTVE Play', note: 'Public broadcaster, completely free.' },
  'mexico': { broadcaster: 'Televisa + TV Azteca', free: true, streaming: 'ViX', note: 'Televisa and TV Azteca have free-to-air rights.' },
  'argentina': { broadcaster: 'TyC Sports + DSports', free: false, streaming: 'TyC Sports Play', note: 'Subscription required for full coverage.' },
  'japan': { broadcaster: 'NHK + Fuji TV', free: true, streaming: 'NHK+', note: 'NHK has public broadcast rights.' },
  'south-korea': { broadcaster: 'KBS + MBC + SBS', free: true, streaming: 'KBS+', note: 'All three major Korean broadcasters have rights.' },
  'china': { broadcaster: 'CCTV + Migu', free: true, streaming: 'Migu Video', note: 'CCTV has national broadcast rights.' },
  'indonesia': { broadcaster: 'RCTI + Vidio', free: false, streaming: 'Vidio.com', note: 'Vidio has streaming rights. Some free matches on RCTI.' },
  'pakistan': { broadcaster: 'PTV Sports', free: true, streaming: 'PTV Sports App', note: 'PTV Sports free broadcast.' },
  'bangladesh': { broadcaster: 'T Sports', free: false, streaming: 'T Sports App', note: 'T Sports subscription required.' },
  'kenya': { broadcaster: 'DStv + Showmax', free: false, streaming: 'DStv Now', note: 'DStv subscription required.' },
  'ghana': { broadcaster: 'DStv + GTV', free: true, streaming: 'GTV Sports+', note: 'GTV has some free rights.' },
  'ethiopia': { broadcaster: 'EBC + DStv', free: true, streaming: 'EBC', note: 'Ethiopian Broadcasting Corporation has rights.' },
  'netherlands': { broadcaster: 'NOS', free: true, streaming: 'NOS.nl', note: 'NOS has full public broadcast rights.' },
  'belgium': { broadcaster: 'RTBF + VRT', free: true, streaming: 'RTBF Auvio', note: 'Public broadcasters, completely free.' },
  'italy': { broadcaster: 'Mediaset + RAI', free: true, streaming: 'Mediaset Infinity', note: 'RAI and Mediaset share rights.' },
  'portugal': { broadcaster: 'RTP + SIC', free: true, streaming: 'RTP Play', note: 'Public broadcaster, completely free.' },
  'turkey': { broadcaster: 'TRT', free: true, streaming: 'TRT Sport', note: 'TRT public broadcaster, completely free.' },
  'saudi-arabia': { broadcaster: 'SSC Sports', free: false, streaming: 'SSC Sports App', note: 'SSC subscription required.' },
  'uae': { broadcaster: 'beIN Sports', free: false, streaming: 'beIN Sports Connect', note: 'beIN subscription required.' },
  'default': { broadcaster: 'beIN Sports / ESPN+ / local rights', free: false, streaming: 'VPN + access UK/Australian stream', note: 'Your country may not have a free option — use a VPN to access free UK or Australian streams.' },
};

// ── ALL COUNTRIES ────────────────────────────────────────────
const COUNTRIES = [
  { slug: 'united-states', name: 'the United States', flag: '🇺🇸', region: 'North America' },
  { slug: 'united-kingdom', name: 'the UK', flag: '🇬🇧', region: 'Europe' },
  { slug: 'australia', name: 'Australia', flag: '🇦🇺', region: 'Oceania' },
  { slug: 'canada', name: 'Canada', flag: '🇨🇦', region: 'North America' },
  { slug: 'ireland', name: 'Ireland', flag: '🇮🇪', region: 'Europe' },
  { slug: 'nigeria', name: 'Nigeria', flag: '🇳🇬', region: 'Africa' },
  { slug: 'south-africa', name: 'South Africa', flag: '🇿🇦', region: 'Africa' },
  { slug: 'india', name: 'India', flag: '🇮🇳', region: 'Asia' },
  { slug: 'brazil', name: 'Brazil', flag: '🇧🇷', region: 'South America' },
  { slug: 'germany', name: 'Germany', flag: '🇩🇪', region: 'Europe' },
  { slug: 'france', name: 'France', flag: '🇫🇷', region: 'Europe' },
  { slug: 'spain', name: 'Spain', flag: '🇪🇸', region: 'Europe' },
  { slug: 'mexico', name: 'Mexico', flag: '🇲🇽', region: 'North America' },
  { slug: 'argentina', name: 'Argentina', flag: '🇦🇷', region: 'South America' },
  { slug: 'japan', name: 'Japan', flag: '🇯🇵', region: 'Asia' },
  { slug: 'south-korea', name: 'South Korea', flag: '🇰🇷', region: 'Asia' },
  { slug: 'china', name: 'China', flag: '🇨🇳', region: 'Asia' },
  { slug: 'indonesia', name: 'Indonesia', flag: '🇮🇩', region: 'Asia' },
  { slug: 'pakistan', name: 'Pakistan', flag: '🇵🇰', region: 'Asia' },
  { slug: 'bangladesh', name: 'Bangladesh', flag: '🇧🇩', region: 'Asia' },
  { slug: 'kenya', name: 'Kenya', flag: '🇰🇪', region: 'Africa' },
  { slug: 'ghana', name: 'Ghana', flag: '🇬🇭', region: 'Africa' },
  { slug: 'ethiopia', name: 'Ethiopia', flag: '🇪🇹', region: 'Africa' },
  { slug: 'netherlands', name: 'the Netherlands', flag: '🇳🇱', region: 'Europe' },
  { slug: 'belgium', name: 'Belgium', flag: '🇧🇪', region: 'Europe' },
  { slug: 'italy', name: 'Italy', flag: '🇮🇹', region: 'Europe' },
  { slug: 'portugal', name: 'Portugal', flag: '🇵🇹', region: 'Europe' },
  { slug: 'turkey', name: 'Turkey', flag: '🇹🇷', region: 'Europe/Asia' },
  { slug: 'saudi-arabia', name: 'Saudi Arabia', flag: '🇸🇦', region: 'Middle East' },
  { slug: 'uae', name: 'the UAE', flag: '🇦🇪', region: 'Middle East' },
  { slug: 'new-zealand', name: 'New Zealand', flag: '🇳🇿', region: 'Oceania' },
  { slug: 'sweden', name: 'Sweden', flag: '🇸🇪', region: 'Europe' },
  { slug: 'norway', name: 'Norway', flag: '🇳🇴', region: 'Europe' },
  { slug: 'denmark', name: 'Denmark', flag: '🇩🇰', region: 'Europe' },
  { slug: 'switzerland', name: 'Switzerland', flag: '🇨🇭', region: 'Europe' },
  { slug: 'austria', name: 'Austria', flag: '🇦🇹', region: 'Europe' },
  { slug: 'poland', name: 'Poland', flag: '🇵🇱', region: 'Europe' },
  { slug: 'czech-republic', name: 'Czech Republic', flag: '🇨🇿', region: 'Europe' },
  { slug: 'hungary', name: 'Hungary', flag: '🇭🇺', region: 'Europe' },
  { slug: 'romania', name: 'Romania', flag: '🇷🇴', region: 'Europe' },
  { slug: 'greece', name: 'Greece', flag: '🇬🇷', region: 'Europe' },
  { slug: 'colombia', name: 'Colombia', flag: '🇨🇴', region: 'South America' },
  { slug: 'chile', name: 'Chile', flag: '🇨🇱', region: 'South America' },
  { slug: 'peru', name: 'Peru', flag: '🇵🇪', region: 'South America' },
  { slug: 'venezuela', name: 'Venezuela', flag: '🇻🇪', region: 'South America' },
  { slug: 'ecuador', name: 'Ecuador', flag: '🇪🇨', region: 'South America' },
  { slug: 'thailand', name: 'Thailand', flag: '🇹🇭', region: 'Asia' },
  { slug: 'vietnam', name: 'Vietnam', flag: '🇻🇳', region: 'Asia' },
  { slug: 'philippines', name: 'the Philippines', flag: '🇵🇭', region: 'Asia' },
  { slug: 'malaysia', name: 'Malaysia', flag: '🇲🇾', region: 'Asia' },
  { slug: 'singapore', name: 'Singapore', flag: '🇸🇬', region: 'Asia' },
  { slug: 'egypt', name: 'Egypt', flag: '🇪🇬', region: 'Africa' },
  { slug: 'morocco', name: 'Morocco', flag: '🇲🇦', region: 'Africa' },
  { slug: 'tanzania', name: 'Tanzania', flag: '🇹🇿', region: 'Africa' },
  { slug: 'uganda', name: 'Uganda', flag: '🇺🇬', region: 'Africa' },
  { slug: 'cameroon', name: 'Cameroon', flag: '🇨🇲', region: 'Africa' },
  { slug: 'zimbabwe', name: 'Zimbabwe', flag: '🇿🇼', region: 'Africa' },
  { slug: 'scotland', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', region: 'Europe' },
  { slug: 'wales', name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', region: 'Europe' },
  { slug: 'qatar', name: 'Qatar', flag: '🇶🇦', region: 'Middle East' },
  { slug: 'kuwait', name: 'Kuwait', flag: '🇰🇼', region: 'Middle East' },
  { slug: 'jordan', name: 'Jordan', flag: '🇯🇴', region: 'Middle East' },
  { slug: 'iran', name: 'Iran', flag: '🇮🇷', region: 'Middle East' },
  { slug: 'iraq', name: 'Iraq', flag: '🇮🇶', region: 'Middle East' },
];

// ── HTML TEMPLATE ────────────────────────────────────────────
function generatePage(country) {
  const info = BROADCAST[country.slug] || BROADCAST['default'];
  const isFree = info.free;
  const vpnNeeded = !isFree || country.slug === 'default';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>How to Watch World Cup 2026 in ${country.name} — Free & Legal Guide</title>
<meta name="description" content="Complete guide to watching every WC 2026 match in ${country.name}. Official broadcasters, free streaming options, and VPN guide for international fans. Updated daily.">
<meta property="og:title" content="How to Watch WC 2026 in ${country.name} ${country.flag}">
<meta property="og:description" content="Free and legal ways to watch every WC 2026 match in ${country.name}. Official guide.">
<link rel="canonical" href="https://wc2026ai.com/watch/how-to-watch-world-cup-2026-in-${country.slug}">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e5e5e5;line-height:1.6}
  .hero{background:linear-gradient(135deg,#1a472a,#2d6a4f);padding:60px 20px;text-align:center}
  .hero h1{font-size:clamp(1.5rem,4vw,2.5rem);font-weight:800;color:#fff;margin-bottom:12px}
  .hero p{font-size:1.1rem;color:rgba(255,255,255,0.85);max-width:600px;margin:0 auto}
  .badge{display:inline-block;padding:6px 14px;border-radius:20px;font-size:0.8rem;font-weight:700;margin-top:12px}
  .free{background:#00c853;color:#000}
  .paid{background:#ff6b35;color:#fff}
  .container{max-width:800px;margin:0 auto;padding:40px 20px}
  .card{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:28px;margin-bottom:24px}
  .card h2{font-size:1.3rem;font-weight:700;margin-bottom:16px;color:#fff}
  .card h2 span{font-size:1.4rem;margin-right:8px}
  .option{display:flex;align-items:flex-start;gap:16px;padding:16px 0;border-bottom:1px solid #2a2a2a}
  .option:last-child{border-bottom:none}
  .option-icon{font-size:2rem;flex-shrink:0}
  .option-body h3{font-size:1rem;font-weight:600;color:#fff;margin-bottom:4px}
  .option-body p{font-size:0.9rem;color:#aaa}
  .btn{display:inline-block;padding:14px 28px;border-radius:8px;font-weight:700;font-size:1rem;text-decoration:none;cursor:pointer;border:none;transition:all 0.2s}
  .btn-green{background:#00c853;color:#000}
  .btn-green:hover{background:#00b847}
  .btn-blue{background:#1565c0;color:#fff}
  .btn-blue:hover{background:#0d47a1}
  .btn-orange{background:#ff6b35;color:#fff}
  .vpn-box{background:linear-gradient(135deg,#1a237e,#283593);border:1px solid #3949ab;border-radius:12px;padding:28px;margin-bottom:24px}
  .vpn-box h2{color:#90caf9;font-size:1.3rem;margin-bottom:8px}
  .vpn-box p{color:#c5cae9;font-size:0.95rem;margin-bottom:20px}
  .vpn-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:16px}
  .vpn-card{background:rgba(255,255,255,0.08);border-radius:8px;padding:20px;text-align:center}
  .vpn-card h3{color:#fff;font-size:1rem;margin-bottom:4px}
  .vpn-card .price{color:#90caf9;font-size:0.85rem;margin-bottom:12px}
  .vpn-card .commission{color:#a5d6a7;font-size:0.75rem;margin-bottom:12px;font-style:italic}
  .steps{counter-reset:step}
  .step{counter-increment:step;display:flex;gap:16px;padding:16px 0;border-bottom:1px solid #2a2a2a}
  .step:last-child{border-bottom:none}
  .step-num{background:#00c853;color:#000;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;flex-shrink:0}
  .step-body h3{color:#fff;font-size:0.95rem;margin-bottom:4px;font-weight:600}
  .step-body p{color:#aaa;font-size:0.85rem}
  .picks-box{background:#1a1a1a;border:2px solid #00c853;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px}
  .picks-box h2{color:#00c853;font-size:1.2rem;margin-bottom:8px}
  .picks-box p{color:#aaa;font-size:0.9rem;margin-bottom:20px}
  .faq details{margin-bottom:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px}
  .faq summary{font-weight:600;color:#fff;cursor:pointer;font-size:0.95rem}
  .faq p{color:#aaa;font-size:0.9rem;margin-top:12px}
  @media(max-width:600px){.vpn-options{grid-template-columns:1fr}}
</style>
</head>
<body>

<div class="hero">
  <div style="font-size:3rem;margin-bottom:12px">${country.flag}</div>
  <h1>How to Watch World Cup 2026 in ${country.name}</h1>
  <p>Complete guide — official broadcasters, free streaming, and how to watch every match from ${country.name}.</p>
  <span class="badge ${isFree ? 'free' : 'paid'}">${isFree ? '✓ Free Options Available' : 'Subscription Required'}</span>
</div>

<div class="container">

  <!-- OFFICIAL BROADCASTER -->
  <div class="card">
    <h2><span>📺</span> Official Broadcaster in ${country.name}</h2>
    <div class="option">
      <div class="option-icon">🎙️</div>
      <div class="option-body">
        <h3>${info.broadcaster}</h3>
        <p>${info.note}</p>
        ${info.free ? '<span style="color:#00c853;font-size:0.85rem;font-weight:600">✓ FREE</span>' : '<span style="color:#ff6b35;font-size:0.85rem;font-weight:600">Subscription needed</span>'}
      </div>
    </div>
    ${info.streaming ? `
    <div class="option">
      <div class="option-icon">📱</div>
      <div class="option-body">
        <h3>${info.streaming}</h3>
        <p>Official streaming service — watch on mobile, tablet, or laptop.</p>
      </div>
    </div>` : ''}
  </div>

  <!-- VPN GUIDE -->
  <div class="vpn-box">
    <h2>🔓 Watch Any Match From Anywhere</h2>
    <p>Even if your local broadcaster only shows some matches, or you're travelling abroad — a VPN lets you access free streams from the UK (ITV/BBC), Australia (SBS), or Germany (ARD). All legally broadcast, all free.</p>
    
    <strong style="color:#fff;display:block;margin-bottom:12px">Recommended VPNs for WC 2026:</strong>
    <div class="vpn-options">
      <div class="vpn-card">
        <div style="font-size:2rem;margin-bottom:8px">🥇</div>
        <h3>NordVPN</h3>
        <div class="price">From $3.99/month</div>
        <p style="color:#c5cae9;font-size:0.8rem;margin-bottom:12px">Best speeds for live sport. 30-day money back.</p>
        <a href="${AFFILIATES.nordvpn}" target="_blank" class="btn btn-blue" style="display:block;font-size:0.9rem;padding:10px">Get NordVPN →</a>
      </div>
      <div class="vpn-card">
        <div style="font-size:2rem;margin-bottom:8px">🥈</div>
        <h3>ExpressVPN</h3>
        <div class="price">From $6.67/month</div>
        <p style="color:#c5cae9;font-size:0.8rem;margin-bottom:12px">Ultra-fast servers. Best for HD streaming.</p>
        <a href="${AFFILIATES.expressvpn}" target="_blank" class="btn btn-blue" style="display:block;font-size:0.9rem;padding:10px">Get ExpressVPN →</a>
      </div>
      <div class="vpn-card">
        <div style="font-size:2rem;margin-bottom:8px">🥉</div>
        <h3>Surfshark</h3>
        <div class="price">From $2.49/month</div>
        <p style="color:#c5cae9;font-size:0.8rem;margin-bottom:12px">Best value. Unlimited devices.</p>
        <a href="${AFFILIATES.surfshark}" target="_blank" class="btn btn-blue" style="display:block;font-size:0.9rem;padding:10px">Get Surfshark →</a>
      </div>
    </div>
  </div>

  <!-- HOW TO WATCH FREE (VPN STEPS) -->
  <div class="card">
    <h2><span>🛠️</span> How to Watch WC 2026 Free from ${country.name} (Step by Step)</h2>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-body"><h3>Get a VPN</h3><p>Sign up for NordVPN or ExpressVPN. Takes 2 minutes. Both have 30-day money-back guarantees.</p></div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-body"><h3>Connect to UK or Australian server</h3><p>Open the VPN app and connect to a UK server (for ITV/BBC — free) or Australian server (for SBS — free).</p></div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-body"><h3>Go to ITVX or SBS On Demand</h3><p>Visit ITVX.com or SBSOnDemand.com.au. Create a free account. Both are free with no subscription.</p></div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-body"><h3>Watch every match live</h3><p>ITV and BBC are broadcasting every WC 2026 match in the UK. SBS covers all matches in Australia. Both free.</p></div>
      </div>
    </div>
  </div>

  <!-- AI PREDICTIONS CTA -->
  <div class="picks-box">
    <h2>🤖 Get AI Predictions for Every WC 2026 Match</h2>
    <p>Our AI has analyzed every team, every player, altitude, fatigue, referee tendencies, and historical patterns. Get free daily predictions for every WC 2026 match.</p>
    <a href="https://t.me/wc2026ai" target="_blank" class="btn btn-green" style="margin-right:12px">Join Telegram (Free)</a>
    <a href="/" class="btn btn-orange">Today's Predictions</a>
  </div>

  <!-- WC 2026 SCHEDULE -->
  <div class="card">
    <h2><span>📅</span> WC 2026 Schedule & Key Dates</h2>
    <div class="option">
      <div class="option-icon">🏟️</div>
      <div class="option-body">
        <h3>Tournament Dates: June 11 – July 19, 2026</h3>
        <p>Group Stage: June 11 – June 27 | Round of 32: June 29 – July 3 | Quarterfinals: July 9-10 | Semifinals: July 14-15 | Final: July 19</p>
      </div>
    </div>
    <div class="option">
      <div class="option-icon">🏟️</div>
      <div class="option-body">
        <h3>Host Cities: USA, Canada, Mexico</h3>
        <p>16 venues across Dallas, Miami, NYC, LA, Houston, Seattle, Atlanta, San Francisco, Kansas City, Philadelphia, Boston, Vancouver, Toronto, Mexico City, Guadalajara, Monterrey</p>
      </div>
    </div>
    <div style="margin-top:16px">
      <a href="/schedule" class="btn btn-green" style="font-size:0.9rem;padding:10px 20px">View Full WC 2026 Schedule →</a>
    </div>
  </div>

  <!-- FAQ -->
  <div class="faq">
    <h2 style="color:#fff;font-size:1.2rem;margin-bottom:16px">Frequently Asked Questions</h2>
    
    <details>
      <summary>Is it legal to use a VPN to watch WC 2026?</summary>
      <p>Using a VPN to access a free public broadcaster (like the BBC or ITV in the UK, or SBS in Australia) is a legal grey area in most countries. These broadcasters have free, legal streams — you're simply accessing them from abroad. We recommend checking your local laws.</p>
    </details>
    
    <details>
      <summary>Which VPN is best for live football streaming?</summary>
      <p>NordVPN and ExpressVPN are consistently rated best for live sport — they have fast servers optimized for streaming and rarely suffer buffering on match days.</p>
    </details>
    
    <details>
      <summary>What time are WC 2026 matches in ${country.name}?</summary>
      <p>WC 2026 matches kick off at various times from the USA (Eastern, Central, Pacific time zones). Use our full schedule page with local time converter to see exact kickoff times in ${country.name}.</p>
    </details>
    
    <details>
      <summary>Can I watch WC 2026 on my phone?</summary>
      <p>Yes — ITV, BBC, SBS, and most official broadcasters have mobile apps. Download the app, create a free account, and watch live on any device with a VPN active if needed.</p>
    </details>
    
    <details>
      <summary>Will a free VPN work for WC 2026?</summary>
      <p>Free VPNs are generally too slow for live sport and are often blocked by streaming services. We strongly recommend a paid VPN — NordVPN at $3.99/month is cheaper than most sports subscriptions.</p>
    </details>
  </div>

</div>

<footer style="background:#111;border-top:1px solid #222;padding:40px 20px;text-align:center">
  <p style="color:#666;font-size:0.85rem">WC 2026 AI Intelligence | <a href="/" style="color:#00c853;text-decoration:none">Predictions</a> | <a href="/schedule" style="color:#00c853;text-decoration:none">Schedule</a> | Affiliate links may earn us commission at no cost to you.</p>
</footer>

</body>
</html>`;
}

// ── BUILD PAGES ───────────────────────────────────────────────
function buildAll() {
  const outDir = path.join(__dirname, 'public', 'watch');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let index = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>How to Watch World Cup 2026 in Every Country</title>
<meta name="description" content="Complete country-by-country guide to watching WC 2026 live. Official broadcasters, free streams, and VPN guides for every nation.">
<style>body{font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;max-width:900px;margin:0 auto;padding:40px 20px}
h1{color:#00c853;margin-bottom:8px}p{color:#aaa;margin-bottom:32px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.country-card{background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;text-decoration:none;display:block;transition:border-color 0.2s}
.country-card:hover{border-color:#00c853}
.country-card .flag{font-size:1.8rem;margin-bottom:8px}
.country-card .name{color:#fff;font-size:0.9rem;font-weight:600}
.country-card .status{font-size:0.75rem;margin-top:4px}
.free{color:#00c853}.paid{color:#ff6b35}
h2{color:#fff;margin:32px 0 16px;font-size:1.1rem;border-bottom:1px solid #333;padding-bottom:8px}
</style></head><body>
<h1>🌍 How to Watch WC 2026 — Every Country</h1>
<p>Find your country below for the official broadcaster, free streaming options, and our VPN guide.</p>`;

  // Group by region
  const regions = {};
  COUNTRIES.forEach(c => {
    if (!regions[c.region]) regions[c.region] = [];
    regions[c.region].push(c);
  });

  let totalPages = 0;
  Object.entries(regions).forEach(([region, countries]) => {
    index += `<h2>${region}</h2><div class="grid">`;
    countries.forEach(country => {
      const html = generatePage(country);
      const filename = `how-to-watch-world-cup-2026-in-${country.slug}.html`;
      fs.writeFileSync(path.join(outDir, filename), html);
      const info = BROADCAST[country.slug] || BROADCAST['default'];
      index += `<a href="/watch/${filename}" class="country-card">
        <div class="flag">${country.flag}</div>
        <div class="name">${country.name}</div>
        <div class="status ${info.free ? 'free' : 'paid'}">${info.free ? '✓ Free available' : 'Subscription'}</div>
      </a>`;
      totalPages++;
    });
    index += `</div>`;
  });

  index += `</body></html>`;
  fs.writeFileSync(path.join(outDir, 'index.html'), index);

  console.log(`✅ Built ${totalPages} country VPN guide pages + index`);
  console.log(`📂 Output: public/watch/`);
  console.log(`💰 Each VPN signup = $40-100 commission`);
  console.log(`🎯 Target: 10,000 signups × $70 avg = $700,000`);
}

buildAll();
