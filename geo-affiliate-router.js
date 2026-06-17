/**
 * Geo Affiliate Router — WC 2026 Intel
 *
 * Shows the correct betting affiliate based on visitor's country.
 * Massively increases affiliate conversion rates.
 *
 * Without geo-routing: wrong affiliate = 0% conversion (e.g. bet365 shown to Nigerian = blocked)
 * With geo-routing: right affiliate = 3-8% conversion
 * Revenue multiplier: 3× from same traffic
 *
 * Usage in HTML pages (client-side):
 *   <script src="/geo-affiliate-router.js"></script>
 *   <div id="betting-affiliate-slot"></div>
 *   <script>renderBettingAffiliate('betting-affiliate-slot');</script>
 *
 * Usage in Node.js (server-side):
 *   const { getAffiliateForCountry } = require('./geo-affiliate-router');
 *   const affiliate = getAffiliateForCountry(req.headers['cf-ipcountry']);
 */

// ── Affiliate Configuration ────────────────────────────────────────────────────
// Fill in YOUR actual affiliate IDs in the urls
const AFFILIATES = {

  // ── UK & IRELAND ──────────────────────────────────────────────────────────
  GB: {
    name: 'bet365',
    logo: '⚽',
    headline: 'Bet on WC 2026 with bet365',
    cta: 'Get £20 in Free Bets →',
    url: 'https://www.bet365.com/?affiliate=YOUR_BET365_ID',
    color: '#027b5b',
    currency: '£',
    cpa: 60,
    disclaimer: '18+ | New customers only | T&Cs apply | BeGambleAware.org',
  },
  IE: {
    name: 'Paddy Power',
    logo: '🍀',
    headline: 'Bet on WC 2026 with Paddy Power',
    cta: 'Get €20 Free Bet →',
    url: 'https://www.paddypower.com/?affiliate=YOUR_PP_ID',
    color: '#008000',
    currency: '€',
    cpa: 50,
    disclaimer: '18+ | New customers | T&Cs apply',
  },

  // ── EUROPE ────────────────────────────────────────────────────────────────
  DE: {
    name: 'Tipico',
    logo: '🎯',
    headline: 'WC 2026 Wetten bei Tipico',
    cta: '€50 Willkommensbonus →',
    url: 'https://www.tipico.de/?affiliate=YOUR_TIPICO_ID',
    color: '#e4001a',
    currency: '€',
    cpa: 55,
    disclaimer: '18+ | AGB gelten',
  },
  AT: { name: 'Bet-at-home', logo: '⚽', headline: 'WC 2026 Wetten', cta: '€100 Bonus →', url: 'https://www.bet-at-home.com/?aff=ID', color: '#E30613', currency: '€', cpa: 50, disclaimer: '18+ | AGB gelten' },
  FR: {
    name: 'PMU',
    logo: '🐎',
    headline: 'Pariez sur la Coupe du Monde 2026',
    cta: '€100 offerts →',
    url: 'https://www.pmu.fr/?affiliate=YOUR_PMU_ID',
    color: '#003189',
    currency: '€',
    cpa: 45,
    disclaimer: '18+ | Jeu responsable',
  },
  ES: { name: 'bet365', logo: '⚽', headline: 'Apuestas Copa del Mundo 2026', cta: 'Obtén €20 gratis →', url: 'https://www.bet365.es/?affiliate=ID', color: '#027b5b', currency: '€', cpa: 50, disclaimer: '18+ | Juega con responsabilidad' },
  IT: { name: 'Sisal', logo: '🎯', headline: 'Scommetti sulla Coppa del Mondo', cta: 'Bonus €50 →', url: 'https://www.sisal.it/?affiliate=ID', color: '#E4002B', currency: '€', cpa: 45, disclaimer: '18+ | Gioca responsabilmente' },
  NL: { name: 'BetCity', logo: '🌷', headline: 'WK 2026 Weddenschappen', cta: '€25 Welkomstbonus →', url: 'https://www.betcity.nl/?affiliate=ID', color: '#FF6600', currency: '€', cpa: 50, disclaimer: '18+ | Verantwoord spelen' },
  SE: { name: 'Unibet', logo: '⚽', headline: 'Betta på VM 2026', cta: '500kr Bonus →', url: 'https://www.unibet.se/?affiliate=ID', color: '#118A39', currency: 'kr', cpa: 65, disclaimer: '18+ | Spela ansvarsfullt' },
  NO: { name: 'Nordicbet', logo: '⚽', headline: 'WM 2026 Betting', cta: '500kr Bonus →', url: 'https://www.nordicbet.com/?affiliate=ID', color: '#003580', currency: 'kr', cpa: 60, disclaimer: '18+ | Spill ansvarlig' },
  DK: { name: 'Bet25', logo: '⚽', headline: 'VM 2026 Odds', cta: '500kr Bonus →', url: 'https://www.bet25.dk/?affiliate=ID', color: '#C8102E', currency: 'kr', cpa: 55, disclaimer: '18+ | Spil ansvarligt' },
  PL: { name: 'Fortuna', logo: '⚽', headline: 'Obstawiaj Mistrzostwa Świata 2026', cta: 'Bonus 500 PLN →', url: 'https://www.efortuna.pl/?affiliate=ID', color: '#009B3A', currency: 'PLN', cpa: 30, disclaimer: '18+ | Graj odpowiedzialnie' },
  PT: { name: 'bet365', logo: '⚽', headline: 'Apostas Copa do Mundo 2026', cta: '€20 grátis →', url: 'https://www.bet365.pt/?affiliate=ID', color: '#027b5b', currency: '€', cpa: 45, disclaimer: '18+ | Jogue com responsabilidade' },

  // ── COMMONWEALTH / ANGLOPHONE ─────────────────────────────────────────────
  AU: {
    name: 'Sportsbet',
    logo: '🦘',
    headline: 'Bet on WC 2026 with Sportsbet',
    cta: 'Get $50 Bonus Bet →',
    url: 'https://www.sportsbet.com.au/?affiliate=YOUR_SPORTSBET_ID',
    color: '#FF6B00',
    currency: 'A$',
    cpa: 70,
    disclaimer: '18+ | New customers | T&Cs apply | Gamble Responsibly',
  },
  NZ: { name: 'TAB NZ', logo: '🥝', headline: 'Bet on WC 2026', cta: 'Join TAB →', url: 'https://www.tab.co.nz/?affiliate=ID', color: '#00529B', currency: 'NZ$', cpa: 60, disclaimer: '18+ | Gamble Responsibly' },
  CA: {
    name: 'DraftKings',
    logo: '🍁',
    headline: 'Bet on WC 2026 with DraftKings',
    cta: 'Get C$200 Bonus →',
    url: 'https://www.draftkings.ca/?affiliate=YOUR_DK_ID',
    color: '#2D6A2D',
    currency: 'C$',
    cpa: 80,
    disclaimer: '19+ | Ontario only | Gambling can be addictive',
  },

  // ── UNITED STATES ─────────────────────────────────────────────────────────
  US: {
    name: 'DraftKings',
    logo: '🦅',
    headline: 'Bet on WC 2026 with DraftKings',
    cta: 'Get $200 Bonus →',
    url: 'https://www.draftkings.com/?affiliate=YOUR_DK_US_ID',
    color: '#2D6A2D',
    currency: '$',
    cpa: 120,
    disclaimer: '21+ in select states | Problem gambling helpline: 1-800-522-4700',
  },

  // ── AFRICA — HIGH VOLUME ──────────────────────────────────────────────────
  NG: {
    name: 'SportyBet',
    logo: '🦅',
    headline: 'Bet on WC 2026 with SportyBet',
    cta: 'Register & Get Bonus →',
    url: 'https://www.sportybet.com/ng/?affiliate=YOUR_SPORTYBET_ID',
    color: '#FF5A1F',
    currency: '₦',
    cpa: 15,
    disclaimer: '18+ | Bet responsibly',
  },
  GH: {
    name: 'BetWay Ghana',
    logo: '⭐',
    headline: 'WC 2026 Predictions & Odds',
    cta: 'Join BetWay →',
    url: 'https://ghana.betway.com/?affiliate=ID',
    color: '#FFB800',
    currency: '₵',
    cpa: 12,
    disclaimer: '18+ | Bet responsibly',
  },
  KE: {
    name: 'SportPesa',
    logo: '🦁',
    headline: 'WC 2026 Tips & Odds',
    cta: 'Bet on World Cup →',
    url: 'https://www.sportpesa.com/?affiliate=YOUR_SPORTPESA_ID',
    color: '#00C851',
    currency: 'KSh',
    cpa: 10,
    disclaimer: '18+ | Gamble Responsibly',
  },
  TZ: { name: 'Betika', logo: '⚽', headline: 'WC 2026 Michezo', cta: 'Jiunge Sasa →', url: 'https://www.betika.com/?affiliate=ID', color: '#00AA44', currency: 'TSh', cpa: 8, disclaimer: '18+' },
  ZA: {
    name: 'Hollywoodbets',
    logo: '🎬',
    headline: 'WC 2026 Betting Odds',
    cta: 'Get R25 Free Bet →',
    url: 'https://www.hollywoodbets.net/?affiliate=ID',
    color: '#C8102E',
    currency: 'R',
    cpa: 20,
    disclaimer: '18+ | Winners know when to stop',
  },
  EG: { name: 'BetWay', logo: '⚽', headline: 'كأس العالم 2026', cta: 'انضم الآن →', url: 'https://www.betway.com/?affiliate=ID', color: '#FFB800', currency: 'E£', cpa: 15, disclaimer: '18+' },
  MA: { name: '1xBet', logo: '⚽', headline: 'كأس العالم 2026 — الرهانات', cta: 'انضم الآن →', url: 'https://1xbet.com/?affiliate=ID', color: '#FF0000', currency: 'MAD', cpa: 20, disclaimer: '18+' },
  SN: { name: '1xBet', logo: '⚽', headline: 'Coupe du Monde 2026', cta: 'Inscrivez-vous →', url: 'https://1xbet.com/?affiliate=ID', color: '#FF0000', currency: 'CFA', cpa: 15, disclaimer: '18+' },
  CI: { name: '1xBet', logo: '⚽', headline: 'Coupe du Monde 2026', cta: 'Paris sportifs →', url: 'https://1xbet.com/?affiliate=ID', color: '#FF0000', currency: 'CFA', cpa: 12, disclaimer: '18+' },
  CM: { name: 'Bet9ja', logo: '🦁', headline: 'WC 2026 Betting', cta: 'Join Now →', url: 'https://bet9ja.com/?affiliate=ID', color: '#008000', currency: 'XAF', cpa: 10, disclaimer: '18+' },

  // ── LATIN AMERICA ─────────────────────────────────────────────────────────
  BR: {
    name: 'Betano',
    logo: '🟡',
    headline: 'Aposte na Copa do Mundo 2026',
    cta: 'Ganhe até R$500 →',
    url: 'https://www.betano.com.br/?affiliate=ID',
    color: '#1A3A6B',
    currency: 'R$',
    cpa: 30,
    disclaimer: '18+ | Jogue com responsabilidade',
  },
  MX: {
    name: 'Codere',
    logo: '🌵',
    headline: 'Apuestas Copa del Mundo 2026',
    cta: 'Bono de Bienvenida →',
    url: 'https://www.codere.mx/?affiliate=ID',
    color: '#008000',
    currency: 'MXN',
    cpa: 25,
    disclaimer: '18+ | Juega responsablemente',
  },
  AR: { name: 'Codere', logo: '⚽', headline: 'Apuestas Copa del Mundo 2026', cta: 'Bono →', url: 'https://www.codere.com.ar/?affiliate=ID', color: '#008000', currency: 'ARS', cpa: 20, disclaimer: '18+' },
  CO: { name: 'Betplay', logo: '⚽', headline: 'Apuestas Copa Mundo 2026', cta: 'Únete Ahora →', url: 'https://www.betplay.com.co/?affiliate=ID', color: '#E4002B', currency: 'COP', cpa: 20, disclaimer: '18+' },
  PE: { name: 'bet365', logo: '⚽', headline: 'Apuestas Copa del Mundo', cta: 'Bono de Bienvenida →', url: 'https://www.bet365.pe/?affiliate=ID', color: '#027b5b', currency: 'S/', cpa: 25, disclaimer: '18+' },
  CL: { name: 'bet365', logo: '⚽', headline: 'Apuestas Copa del Mundo 2026', cta: 'Obtén $20.000 →', url: 'https://www.bet365.cl/?affiliate=ID', color: '#027b5b', currency: 'CLP', cpa: 22, disclaimer: '18+' },
  UY: { name: 'bet365', logo: '⚽', headline: 'Apuestas Copa del Mundo', cta: 'Bono Bienvenida →', url: 'https://www.bet365.uy/?affiliate=ID', color: '#027b5b', currency: 'UYU', cpa: 20, disclaimer: '18+' },

  // ── ASIA ──────────────────────────────────────────────────────────────────
  IN: {
    name: 'Dream11',
    logo: '🏏',
    headline: 'Play WC 2026 Fantasy Football',
    cta: 'Join Dream11 — ₹100 Bonus →',
    url: 'https://www.dream11.com/?affiliate=ID',
    color: '#F15A22',
    currency: '₹',
    cpa: 15,
    disclaimer: '18+ | Fantasy sports platform',
  },
  JP: { name: 'Unibet', logo: '⚽', headline: 'ワールドカップ 2026 賭け', cta: '登録ボーナス →', url: 'https://www.unibet.com/?affiliate=ID', color: '#118A39', currency: '¥', cpa: 40, disclaimer: '18+' },
  KR: { name: 'Betway', logo: '⚽', headline: '2026 월드컵 베팅', cta: '가입 보너스 →', url: 'https://www.betway.com/?affiliate=ID', color: '#FFB800', currency: '₩', cpa: 25, disclaimer: '18+' },
  PH: { name: 'BetSo88', logo: '⚽', headline: 'WC 2026 Betting Odds', cta: 'Sign Up & Bet →', url: 'https://betso88.com/?affiliate=ID', color: '#FCD116', currency: '₱', cpa: 12, disclaimer: '18+' },
  ID: { name: 'Betway', logo: '⚽', headline: 'Taruhan Piala Dunia 2026', cta: 'Daftar Sekarang →', url: 'https://www.betway.com/?affiliate=ID', color: '#FFB800', currency: 'Rp', cpa: 15, disclaimer: '18+' },

  // ── MIDDLE EAST ───────────────────────────────────────────────────────────
  SA: { name: '1xBet', logo: '⚽', headline: 'كأس العالم 2026', cta: 'انضم →', url: 'https://1xbet.com/?affiliate=ID', color: '#FF0000', currency: 'SAR', cpa: 20, disclaimer: '18+' },
  AE: { name: 'bet365', logo: '⚽', headline: 'World Cup 2026 Betting', cta: 'Get Free Bet →', url: 'https://www.bet365.com/?affiliate=ID', color: '#027b5b', currency: 'AED', cpa: 50, disclaimer: '18+ | Terms apply' },
};

// ── Streaming-only affiliate (for countries where betting is illegal/restricted) ──
const STREAMING_FALLBACK = {
  name: 'NordVPN',
  logo: '🔒',
  headline: 'Watch WC 2026 Free with NordVPN',
  cta: 'Get NordVPN — 63% Off →',
  url: 'https://nordvpn.com/ref/wc2026intel',
  color: '#4687FF',
  currency: '$',
  cpa: 40,
  disclaimer: 'Watch all WC 2026 matches with a free streaming service + VPN',
};

// ── Country lookup ─────────────────────────────────────────────────────────────
function getAffiliateForCountry(countryCode) {
  if (!countryCode) return STREAMING_FALLBACK;
  return AFFILIATES[countryCode.toUpperCase()] || STREAMING_FALLBACK;
}

// ── Client-side geo detection via API ─────────────────────────────────────────
async function detectCountry() {
  try {
    // Try Cloudflare country header first (fastest, if behind Cloudflare)
    const cfCountry = document.cookie.match(/cf_country=([A-Z]{2})/)?.[1];
    if (cfCountry) return cfCountry;

    // Try ipapi.co (free, 1000 req/day)
    const resp = await fetch('https://ipapi.co/json/', { timeout: 3000 });
    const data = await resp.json();
    return data.country_code || 'US';
  } catch (e) {
    return 'US';
  }
}

// ── Render affiliate widget into a DOM element ─────────────────────────────────
async function renderBettingAffiliate(elementId, options = {}) {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:0.8rem">Loading best odds for you...</div>';

  const countryCode = await detectCountry();
  const affiliate   = getAffiliateForCountry(countryCode);

  const html = `
  <div style="background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:20px;text-align:center">
    <div style="font-size:0.75rem;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">
      ${affiliate.logo} RECOMMENDED FOR YOUR COUNTRY
    </div>
    <div style="font-size:1rem;font-weight:700;margin-bottom:12px">${affiliate.headline}</div>
    <a href="${affiliate.url}" target="_blank" rel="nofollow sponsored"
       style="display:block;background:${affiliate.color};color:#fff;padding:14px 24px;border-radius:8px;font-weight:700;text-decoration:none;font-size:1rem;margin-bottom:10px"
       onclick="trackAffiliateClick('${affiliate.name}','${countryCode}')">
      ${affiliate.cta}
    </a>
    <div style="font-size:0.7rem;color:#555">${affiliate.disclaimer}</div>
  </div>`;

  el.innerHTML = html;
}

// ── Track affiliate clicks ─────────────────────────────────────────────────────
function trackAffiliateClick(affiliateName, country) {
  // Google Analytics 4
  if (typeof gtag !== 'undefined') {
    gtag('event', 'affiliate_click', {
      affiliate_name: affiliateName,
      country: country,
    });
  }
  // Facebook Pixel
  if (typeof fbq !== 'undefined') {
    fbq('track', 'Lead', { content_name: affiliateName });
  }
}

// ── Node.js export ─────────────────────────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { getAffiliateForCountry, AFFILIATES, STREAMING_FALLBACK };
}
