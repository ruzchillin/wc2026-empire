/**
 * affiliate-matrix.js
 * Every income stream × every country = correct affiliate link.
 * Returns the highest-value affiliate available for a given country + stream type.
 *
 * Revenue per stream per country (best available):
 *   UK sportsbooks:   £25-65 CPA
 *   US DFS:           $30-80 CPA
 *   Africa sportsbooks: £5-20 CPA (acquire at £0.50 = 13,000% ROI)
 *   VPN (all):        £90-100 CPA (NordVPN/ExpressVPN)
 *   Streaming:        £5-30 CPA
 *   Travel:           3-8% commission
 *   Products:         4-10% commission
 */

'use strict';

// ─── Master Affiliate Registry ────────────────────────────────────────────────
// Each entry: { id, label, link, cpa, payout_type, age_gated, countries }
const AFFILIATES = {

  // ── UK Sportsbooks ──────────────────────────────────────────────────────
  bet365_uk: {
    label: 'Bet365 — Bet £10 Get £50',
    baseLink: 'https://www.bet365.com/olp/open-account',
    cpa: 65, currency: 'GBP', ageGated: true,
    countries: ['GB','IE'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  betway_uk: {
    label: 'Betway — Deposit £10 Get £30',
    baseLink: 'https://betway.com/en/sports/promo/welcome-sports',
    cpa: 45, currency: 'GBP', ageGated: true,
    countries: ['GB'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  williamhill_uk: {
    label: 'William Hill — Bet £10 Win £40',
    baseLink: 'https://sports.williamhill.com/betting/en-gb',
    cpa: 40, currency: 'GBP', ageGated: true,
    countries: ['GB'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  paddypower_uk: {
    label: 'Paddy Power — Money Back Special',
    baseLink: 'https://www.paddypower.com',
    cpa: 35, currency: 'GBP', ageGated: true,
    countries: ['GB','IE'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  betfair_uk: {
    label: 'Betfair Exchange',
    baseLink: 'https://www.betfair.com/exchange/plus/football',
    cpa: 40, currency: 'GBP', ageGated: true,
    countries: ['GB','IE','AU'],
    streamTypes: ['affiliate_sportsbook','tip'],
  },
  draftkings_us: {
    label: 'DraftKings — Bet $5 Get $200',
    baseLink: 'https://sportsbook.draftkings.com',
    cpa: 250, currency: 'USD', ageGated: true,
    countries: ['US'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  fanduel_us: {
    label: 'FanDuel Sportsbook',
    baseLink: 'https://sportsbook.fanduel.com',
    cpa: 75, currency: 'USD', ageGated: true,
    countries: ['US'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  bet9ja_ng: {
    label: 'Bet9ja — Register & Win',
    baseLink: 'https://www.bet9ja.com',
    cpa: 20, currency: 'GBP', ageGated: true,
    countries: ['NG'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  sportybet_ng: {
    label: 'SportyBet Nigeria',
    baseLink: 'https://www.sportybet.com/ng',
    cpa: 12, currency: 'GBP', ageGated: true,
    countries: ['NG','KE','GH','TZ','UG'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  betika_ke: {
    label: 'Betika Kenya',
    baseLink: 'https://www.betika.com',
    cpa: 15, currency: 'GBP', ageGated: true,
    countries: ['KE'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  betpawa_africa: {
    label: 'BetPawa Africa',
    baseLink: 'https://www.betpawa.net',
    cpa: 10, currency: 'GBP', ageGated: true,
    countries: ['GH','KE','TZ','UG','CM','CI','SN'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  parimatch_za: {
    label: 'Parimatch South Africa',
    baseLink: 'https://parimatch.co.za',
    cpa: 18, currency: 'GBP', ageGated: true,
    countries: ['ZA'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  betano_br: {
    label: 'Betano Brasil',
    baseLink: 'https://www.betano.com.br',
    cpa: 35, currency: 'USD', ageGated: true,
    countries: ['BR'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  bwin_de: {
    label: 'bwin Deutschland',
    baseLink: 'https://sports.bwin.de',
    cpa: 45, currency: 'EUR', ageGated: true,
    countries: ['DE','AT'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  unibet_fr: {
    label: 'Unibet France',
    baseLink: 'https://www.unibet.fr',
    cpa: 40, currency: 'EUR', ageGated: true,
    countries: ['FR'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  codere_es: {
    label: 'Codere España',
    baseLink: 'https://www.codere.es',
    cpa: 35, currency: 'EUR', ageGated: true,
    countries: ['ES','MX','AR','CO'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },
  betclic_pt: {
    label: 'Betclic Portugal',
    baseLink: 'https://www.betclic.pt',
    cpa: 35, currency: 'EUR', ageGated: true,
    countries: ['PT','BR'],
    streamTypes: ['affiliate_sportsbook','prediction','tip'],
  },

  // ── VPN (Global, ALL countries, highest CPA) ──────────────────────────
  nordvpn: {
    label: 'NordVPN — Watch every WC2026 game',
    baseLink: 'https://go.nordvpn.net/aff_c?offer_id=15&aff_id=YOUR_ID',
    cpa: 100, currency: 'GBP', ageGated: false,
    countries: 'ALL',
    streamTypes: ['affiliate_vpn','streaming','programmatic_seo','general'],
  },
  expressvpn: {
    label: 'ExpressVPN — Unblock your country',
    baseLink: 'https://www.expressvpn.com/vpn-service/football-vpn?offer=YOUR_ID',
    cpa: 90, currency: 'GBP', ageGated: false,
    countries: 'ALL',
    streamTypes: ['affiliate_vpn','streaming','programmatic_seo','general'],
  },
  surfshark: {
    label: 'Surfshark — Best value VPN',
    baseLink: 'https://surfshark.com/affiliates/YOUR_ID',
    cpa: 60, currency: 'GBP', ageGated: false,
    countries: 'ALL',
    streamTypes: ['affiliate_vpn','streaming'],
  },
  cyberghost: {
    label: 'CyberGhost VPN',
    baseLink: 'https://www.cyberghostvpn.com/affiliates/YOUR_ID',
    cpa: 55, currency: 'GBP', ageGated: false,
    countries: 'ALL',
    streamTypes: ['affiliate_vpn','streaming'],
  },

  // ── Streaming Services ────────────────────────────────────────────────
  dazn: {
    label: 'DAZN — Watch WC2026 Live',
    baseLink: 'https://www.dazn.com/?af=YOUR_ID',
    cpa: 20, currency: 'GBP', ageGated: false,
    countries: ['DE','AT','ES','IT','CA','JP','US'],
    streamTypes: ['affiliate_streaming','streaming'],
  },
  fubo: {
    label: 'FuboTV — Stream Soccer Live',
    baseLink: 'https://www.fubo.tv/welcome?irad=YOUR_ID',
    cpa: 30, currency: 'USD', ageGated: false,
    countries: ['US','CA'],
    streamTypes: ['affiliate_streaming','streaming'],
  },
  nowtv_uk: {
    label: 'NOW TV Sports — WC2026',
    baseLink: 'https://www.nowtv.com/sport?affil=YOUR_ID',
    cpa: 25, currency: 'GBP', ageGated: false,
    countries: ['GB'],
    streamTypes: ['affiliate_streaming','streaming'],
  },
  hotstar_in: {
    label: 'Disney+ Hotstar Premium',
    baseLink: 'https://www.hotstar.com/in/subscribe?affil=YOUR_ID',
    cpa: 8, currency: 'GBP', ageGated: false,
    countries: ['IN'],
    streamTypes: ['affiliate_streaming','streaming'],
  },

  // ── Travel (WC2026 — US/Canada/Mexico host cities) ────────────────────
  booking_travel: {
    label: 'Booking.com — WC2026 Hotels',
    baseLink: 'https://www.booking.com/index.html?aid=YOUR_ID',
    cpa: null, commission: '4%', ageGated: false,
    countries: 'ALL',
    streamTypes: ['affiliate_travel'],
  },
  expedia_travel: {
    label: 'Expedia — WC2026 Packages',
    baseLink: 'https://www.expedia.com/?AFFCID=YOUR_ID',
    cpa: null, commission: '3%', ageGated: false,
    countries: 'ALL',
    streamTypes: ['affiliate_travel'],
  },
  skyscanner: {
    label: 'Skyscanner — Cheapest flights to WC2026',
    baseLink: 'https://www.skyscanner.net/?associateid=YOUR_ID',
    cpa: null, commission: '50% of rev share', ageGated: false,
    countries: 'ALL',
    streamTypes: ['affiliate_travel'],
  },

  // ── Products / Tech ───────────────────────────────────────────────────
  amazon_uk: {
    label: 'Amazon UK — Official Kits & Merch',
    baseLink: 'https://www.amazon.co.uk?tag=YOUR_TAG',
    cpa: null, commission: '4%', ageGated: false,
    countries: ['GB'],
    streamTypes: ['merchandise','digital_product'],
  },
  amazon_us: {
    label: 'Amazon US — Official Kits & Gear',
    baseLink: 'https://www.amazon.com?tag=YOUR_TAG',
    cpa: null, commission: '4%', ageGated: false,
    countries: ['US','CA'],
    streamTypes: ['merchandise','digital_product'],
  },
  amazon_de: {
    label: 'Amazon.de — Fußball Shop',
    baseLink: 'https://www.amazon.de?tag=YOUR_TAG',
    cpa: null, commission: '4%', ageGated: false,
    countries: ['DE','AT','NL'],
    streamTypes: ['merchandise','digital_product'],
  },
  aliexpress: {
    label: 'AliExpress — WC2026 Merch',
    baseLink: 'https://s.click.aliexpress.com/e/YOUR_ID',
    cpa: null, commission: '8%', ageGated: false,
    countries: ['IN','ID','TR','PK','VN','SA','EG'],
    streamTypes: ['merchandise'],
  },
  jumia_ng: {
    label: 'Jumia Nigeria — Sports Gear',
    baseLink: 'https://www.jumia.com.ng?affil=YOUR_ID',
    cpa: null, commission: '5%', ageGated: false,
    countries: ['NG','KE','GH','CI','CM'],
    streamTypes: ['merchandise'],
  },

  // ── CASINO AFFILIATES (highest CPAs in the market) ───────────────────────
  bet365_casino: {
    label: 'Bet365 Casino', baseLink: 'https://casino.bet365.com',
    cpa: 250, currency: 'GBP', ageGated: true, countries: ['GB','IE','AU','CA','NZ'],
    streamTypes: ['casino'], envKey: 'BET365_CASINO_AFF_ID',
  },
  888casino: {
    label: '888 Casino', baseLink: 'https://www.888casino.com',
    cpa: 200, currency: 'GBP', ageGated: true, countries: ['GB','IE','DE','ES','IT'],
    streamTypes: ['casino'], envKey: 'CASINO_888_AFF_ID',
  },
  betway_casino: {
    label: 'Betway Casino', baseLink: 'https://casino.betway.com',
    cpa: 150, currency: 'GBP', ageGated: true, countries: 'ALL',
    streamTypes: ['casino'], envKey: 'BETWAY_CASINO_AFF_ID',
  },
  draftkings_casino: {
    label: 'DraftKings Casino', baseLink: 'https://casino.draftkings.com',
    cpa: 300, currency: 'USD', ageGated: true, countries: ['US'],
    streamTypes: ['casino'], envKey: 'DK_CASINO_AFF_ID',
  },
  betmgm_casino: {
    label: 'BetMGM Casino', baseLink: 'https://casino.betmgm.com',
    cpa: 250, currency: 'USD', ageGated: true, countries: ['US'],
    streamTypes: ['casino'], envKey: 'BETMGM_CASINO_AFF_ID',
  },

  // ── PREDICTION MARKETS (not age-gated in US) ─────────────────────────────
  kalshi: {
    label: 'Kalshi Prediction Markets', baseLink: 'https://kalshi.com',
    cpa: 100, currency: 'USD', ageGated: false, countries: ['US'],
    streamTypes: ['prediction','affiliate_sportsbook'], envKey: 'KALSHI_AFF_ID',
  },
  polymarket: {
    label: 'Polymarket Prediction Markets', baseLink: 'https://polymarket.com',
    cpa: 50, currency: 'USD', ageGated: false, countries: 'ALL',
    streamTypes: ['prediction'], envKey: 'POLYMARKET_AFF_ID',
  },

  // ── TRAVEL AFFILIATES ─────────────────────────────────────────────────────
  booking_com: {
    label: 'Booking.com Hotels', baseLink: 'https://booking.com',
    cpa: null, commission: '4%', ageGated: false, countries: 'ALL',
    streamTypes: ['travel'], envKey: 'BOOKING_AFF_ID',
  },
  skyscanner: {
    label: 'Skyscanner Flights', baseLink: 'https://skyscanner.com',
    cpa: null, commission: '3%', ageGated: false, countries: 'ALL',
    streamTypes: ['travel'], envKey: 'SKYSCANNER_AFF_ID',
  },
  stubhub: {
    label: 'StubHub Tickets', baseLink: 'https://stubhub.com',
    cpa: null, commission: '10%', ageGated: false, countries: 'ALL',
    streamTypes: ['travel'], envKey: 'STUBHUB_AFF_ID',
  },
  world_nomads: {
    label: 'World Nomads Travel Insurance', baseLink: 'https://worldnomads.com',
    cpa: null, commission: '20%', ageGated: false, countries: 'ALL',
    streamTypes: ['travel'], envKey: 'WORLDNOMADS_AFF_ID',
  },
  airalo_esim: {
    label: 'Airalo eSIM', baseLink: 'https://airalo.com',
    cpa: null, commission: '15%', ageGated: false, countries: 'ALL',
    streamTypes: ['travel'], envKey: 'AIRALO_AFF_ID',
  },
  fubo_tv: {
    label: 'FuboTV Streaming', baseLink: 'https://fubo.tv',
    cpa: 40, currency: 'USD', ageGated: false, countries: ['US','CA'],
    streamTypes: ['streaming'], envKey: 'FUBO_AFF_ID',
  },

  // ── FINANCIAL SERVICES (highest CPA per lead — non-betting) ──────────────
  etoro: {
    label: 'eToro Investing', baseLink: 'https://etoro.com',
    cpa: 150, currency: 'USD', ageGated: false, countries: 'ALL',
    streamTypes: ['finance'], envKey: 'ETORO_AFF_ID',
  },
  trading212: {
    label: 'Trading 212', baseLink: 'https://trading212.com',
    cpa: 80, currency: 'GBP', ageGated: false, countries: ['GB','EU'],
    streamTypes: ['finance'], envKey: 'TRADING212_AFF_ID',
  },
  coinbase: {
    label: 'Coinbase Crypto', baseLink: 'https://coinbase.com',
    cpa: 50, currency: 'USD', ageGated: false, countries: 'ALL',
    streamTypes: ['crypto','finance'], envKey: 'COINBASE_AFF_ID',
  },
  binance: {
    label: 'Binance Crypto', baseLink: 'https://binance.com',
    cpa: 30, currency: 'USD', ageGated: false, countries: 'ALL',
    streamTypes: ['crypto','finance'], envKey: 'BINANCE_AFF_ID',
  },
  uswitch_energy: {
    label: 'Uswitch Energy Comparison', baseLink: 'https://uswitch.com/energy',
    cpa: 90, currency: 'GBP', ageGated: false, countries: ['GB'],
    streamTypes: ['finance','energy'], envKey: 'USWITCH_AFF_ID',
  },
  comparethemarket: {
    label: 'Compare The Market', baseLink: 'https://comparethemarket.com',
    cpa: 60, currency: 'GBP', ageGated: false, countries: ['GB'],
    streamTypes: ['finance','insurance'], envKey: 'CTM_AFF_ID',
  },
  habito_mortgages: {
    label: 'Habito Mortgages', baseLink: 'https://habito.com',
    cpa: 700, currency: 'GBP', ageGated: false, countries: ['GB'],
    streamTypes: ['finance','mortgage'], envKey: 'HABITO_AFF_ID',
  },
  pensionbee: {
    label: 'PensionBee', baseLink: 'https://pensionbee.com',
    cpa: 120, currency: 'GBP', ageGated: false, countries: ['GB'],
    streamTypes: ['finance'], envKey: 'PENSIONBEE_AFF_ID',
  },

  // ── FOOD DELIVERY / LIFESTYLE ─────────────────────────────────────────────
  ubereats: {
    label: 'Uber Eats Watch Party', baseLink: 'https://ubereats.com',
    cpa: 15, currency: 'USD', ageGated: false, countries: 'ALL',
    streamTypes: ['lifestyle'], envKey: 'UBEREATS_AFF_ID',
  },
  hellofresh: {
    label: 'HelloFresh Meal Kits', baseLink: 'https://hellofresh.com',
    cpa: 45, currency: 'GBP', ageGated: false, countries: ['GB','US','DE','AU'],
    streamTypes: ['lifestyle'], envKey: 'HELLOFRESH_AFF_ID',
  },
  babbel_language: {
    label: 'Babbel Language Learning', baseLink: 'https://babbel.com',
    cpa: 25, currency: 'USD', ageGated: false, countries: 'ALL',
    streamTypes: ['education'], envKey: 'BABBEL_AFF_ID',
  },
};

// ─── Geo-Affiliate Router ──────────────────────────────────────────────────────
/**
 * Returns ordered list of best affiliates for a given country + stream type.
 * Highest CPA first. Age-gated streams always include the note.
 */
function getAffiliates(countryCode, streamType) {
  const results = [];

  for (const [id, aff] of Object.entries(AFFILIATES)) {
    const countryMatch = aff.countries === 'ALL' || aff.countries.includes(countryCode);
    const streamMatch  = aff.streamTypes.includes(streamType) || aff.streamTypes.includes('general');

    if (!countryMatch || !streamMatch) continue;

    // Build the link — replace YOUR_ID placeholder with env var when deployed
    const envKey  = `AFF_${id.toUpperCase()}_ID`;
    const affId   = process.env[envKey] || 'YOUR_ID';
    const link    = aff.baseLink.replace(/YOUR_ID|YOUR_TAG/g, affId);

    results.push({
      id,
      label:    aff.label,
      link,
      cpa:      aff.cpa,
      currency: aff.currency || 'GBP',
      ageGated: aff.ageGated,
      commission: aff.commission || null,
    });
  }

  // Sort: CPA affiliates first (highest CPA), then commission-based
  results.sort((a, b) => {
    if (a.cpa && b.cpa) return b.cpa - a.cpa;
    if (a.cpa && !b.cpa) return -1;
    if (!a.cpa && b.cpa) return 1;
    return 0;
  });

  return results;
}

/**
 * Returns the single best affiliate for a country + stream type.
 * Used by content-multiplier for link injection.
 */
function getBestAffiliate(countryCode, streamType) {
  return getAffiliates(countryCode, streamType)[0] || null;
}

/**
 * Returns all affiliate IDs that need to be registered/applied for.
 * Used at setup time to know which affiliate programs to join.
 */
function getAllAffiliatePrograms() {
  const programs = new Map();
  for (const [id, aff] of Object.entries(AFFILIATES)) {
    programs.set(id, {
      id,
      label:    aff.label,
      cpa:      aff.cpa,
      currency: aff.currency,
      ageGated: aff.ageGated,
      envKey:   `AFF_${id.toUpperCase()}_ID`,
      countries: aff.countries,
      applyUrl: aff.baseLink.split('?')[0] + '/affiliates',
    });
  }
  return [...programs.values()].sort((a, b) => (b.cpa || 0) - (a.cpa || 0));
}

/**
 * Returns all programs that need to be applied for (YOUR_ID not yet set in .env).
 */
function getPendingRegistrations() {
  return getAllAffiliatePrograms().filter(p => {
    const envKey = `AFF_${p.id.toUpperCase()}_ID`;
    return !process.env[envKey];
  });
}

module.exports = { AFFILIATES, getAffiliates, getBestAffiliate, getAllAffiliatePrograms, getPendingRegistrations };

// ─── CLI: list all programs to register ───────────────────────────────────────
if (require.main === module) {
  const all = getAllAffiliatePrograms();
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         AFFILIATE MATRIX — ALL PROGRAMS TO JOIN          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`Total affiliate programs: ${all.length}\n`);

  console.log('AGE-GATED (18+ streams — parent account strategy):');
  all.filter(p => p.ageGated).forEach(p => {
    const val = p.cpa ? `£${p.cpa} CPA` : p.commission;
    const countries = p.countries === 'ALL' ? 'ALL' : p.countries.join(', ');
    console.log(`  ${p.id.padEnd(25)} ${val.padEnd(15)} [${countries}]`);
    console.log(`    Env: ${p.envKey}`);
  });

  console.log('\nOPEN (all ages):');
  all.filter(p => !p.ageGated).forEach(p => {
    const val = p.cpa ? `£${p.cpa} CPA` : p.commission;
    const countries = p.countries === 'ALL' ? 'ALL countries' : p.countries.join(', ');
    console.log(`  ${p.id.padEnd(25)} ${val.padEnd(20)} [${countries}]`);
    console.log(`    Env: ${p.envKey}`);
  });

  console.log('\nAdd all IDs to your .env file once approved.');
  console.log('NordVPN & ExpressVPN (open, highest CPA) — apply first!');
}
