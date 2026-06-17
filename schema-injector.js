/**
 * WC 2026 Sports Empire — Schema + AdSense Injector
 * Run locally or in CI after generating HTML pages.
 *
 * Five jobs in one script:
 *
 * 1. SCHEMA INJECTION
 *    Injects application/ld+json structured data into every HTML page.
 *    - SportsEvent schema     → match preview + result pages → Google rich results
 *    - FAQPage schema         → FAQ/tips pages
 *    - BreadcrumbList schema  → all pages → sitelink hierarchy
 *    - WebSite schema         → index.html → sitelinks searchbox
 *    - Organization schema    → index.html → brand panel
 *
 * 2. ADSENSE INJECTION
 *    Adds Google AdSense auto-ads snippet to every HTML page.
 *    Currently only command-center.html has it; 58 pages are missing it.
 *
 * 3. COOKIE CONSENT INJECTION (GDPR — required for AdSense approval)
 *    Adds <script src="/cookie-consent.js" defer></script> to every page.
 *    Without this on all pages, Google AdSense WILL NOT approve the account.
 *
 * 4. OG + TWITTER CARD INJECTION
 *    Adds Open Graph and Twitter Card meta tags to every page.
 *    Without these, every share on WhatsApp/Twitter/Facebook shows a blank card.
 *    50/61 pages were missing OG tags; this fixes all of them in one run.
 *
 * 5. SUBSCRIBE EMBED + SERVICE WORKER INJECTION
 *    Adds floating subscribe button + push notification registration to every page.
 *    Without this, email/push capture only works on prediction-game.html.
 *
 * Usage:
 *   node schema-injector.js                        # inject all four things into ./public/
 *   node schema-injector.js --dir ./dist           # custom dir
 *   node schema-injector.js --schema-only          # schema only, skip adsense
 *   node schema-injector.js --adsense-only         # adsense only, skip schema
 *   node schema-injector.js --scripts-only         # cookie + subscribe + SW only
 *   node schema-injector.js --dry-run              # preview changes, don't write
 *
 * CONFIGURE:
 *   Set ADSENSE_CLIENT below (ca-pub-XXXXXXXXXXXXXXXX)
 *   Set SITE_URL below (your Vercel URL)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────

const SITE_URL       = process.env.VERCEL_URL      || 'https://wc2026live.vercel.app';
const ADSENSE_CLIENT = process.env.ADSENSE_CLIENT  || 'ca-pub-XXXXXXXXXXXXXXXX'; // ← replace
const SITE_NAME      = 'WC 2026 Live';
const SITE_DESC      = 'Live scores, AI predictions, and real-time coverage of the 2026 FIFA World Cup';

// Parse args
const args       = process.argv.slice(2);
const HTML_DIR   = args.find(a => a.startsWith('--dir='))?.replace('--dir=', '') ||
                   args[args.findIndex(a => a === '--dir') + 1] ||
                   path.join(__dirname, 'public');
const SCHEMA_ONLY   = args.includes('--schema-only');
const ADSENSE_ONLY  = args.includes('--adsense-only');
const SCRIPTS_ONLY  = args.includes('--scripts-only');
const DRY_RUN       = args.includes('--dry-run');

let injectedSchema   = 0;
let injectedAdsense  = 0;
let injectedOG       = 0;
let injectedConsent  = 0;
let injectedSubscribe= 0;
let injectedSW       = 0;
let skipped          = 0;

// ─── AdSense snippet ──────────────────────────────────────────────────────────

const ADSENSE_SNIPPET = `
<!-- Google AdSense Auto Ads -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;

// ─── Schema builders ──────────────────────────────────────────────────────────

function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type':    'WebSite',
    name:       SITE_NAME,
    url:        SITE_URL,
    description: SITE_DESC,
    potentialAction: {
      '@type':      'SearchAction',
      target:       `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
}

function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type':    'Organization',
    name:       SITE_NAME,
    url:        SITE_URL,
    logo:       `${SITE_URL}/logo.png`,
    sameAs:     [
      'https://twitter.com/wc2026live',
      'https://t.me/wc2026live',
      `${SITE_URL}`
    ]
  };
}

function breadcrumbSchema(pageTitle, pageUrl, parentTitle = SITE_NAME, parentUrl = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: parentTitle, item: parentUrl },
      { '@type': 'ListItem', position: 2, name: pageTitle, item: pageUrl }
    ]
  };
}

function sportsEventSchema(homeTeam, awayTeam, kickoffDate, venue, description = '') {
  return {
    '@context':    'https://schema.org',
    '@type':       'SportsEvent',
    name:          `${homeTeam} vs ${awayTeam} — 2026 FIFA World Cup`,
    description:   description || `Watch ${homeTeam} vs ${awayTeam} at the 2026 FIFA World Cup. Live scores, AI predictions, and real-time coverage.`,
    startDate:     kickoffDate || '2026-06-11',
    location:      {
      '@type': 'Place',
      name:    venue || '2026 FIFA World Cup Venue',
      address: { '@type': 'PostalAddress', addressCountry: 'US' }
    },
    organizer:     { '@type': 'Organization', name: 'FIFA', url: 'https://www.fifa.com' },
    sport:         'https://en.wikipedia.org/wiki/Association_football',
    competitor:    [
      { '@type': 'SportsTeam', name: homeTeam },
      { '@type': 'SportsTeam', name: awayTeam }
    ],
    url:           `${SITE_URL}/matches/${homeTeam.toLowerCase().replace(/\s/g, '-')}-vs-${awayTeam.toLowerCase().replace(/\s/g, '-')}.html`
  };
}

function faqSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({
      '@type':           'Question',
      name:              q,
      acceptedAnswer:    { '@type': 'Answer', text: a }
    }))
  };
}

// ─── Page classifier ──────────────────────────────────────────────────────────

function classifyPage(filename, html) {
  const name  = path.basename(filename, '.html').toLowerCase();
  const lower = html.toLowerCase();

  if (name === 'index' || name === 'home')          return 'home';
  if (name.includes('predict'))                      return 'predictions';
  if (name.includes('bracket'))                      return 'bracket';
  if (name.includes('match') || name.includes('vs')) return 'match';
  if (name.includes('player'))                       return 'player';
  if (name.includes('faq') || name.includes('help')) return 'faq';
  if (name.includes('vpn') || name.includes('watch')) return 'vpn';
  if (name.includes('sweepstake') || name.includes('pool')) return 'sweepstake';
  if (lower.includes('live score') || lower.includes('livescore')) return 'live';
  return 'generic';
}

function buildSchemas(filename, html) {
  const slug    = path.basename(filename, '.html');
  const pageUrl = `${SITE_URL}/${path.basename(filename)}`;
  const pageType = classifyPage(filename, html);

  const schemas = [];

  if (pageType === 'home') {
    schemas.push(websiteSchema());
    schemas.push(organizationSchema());
    schemas.push(faqSchema([
      ['When does the 2026 FIFA World Cup start?', 'The 2026 FIFA World Cup starts on June 11, 2026, hosted across 16 cities in the USA, Canada, and Mexico.'],
      ['How many teams are in the 2026 World Cup?', 'The 2026 FIFA World Cup features 48 teams — expanded from 32 in previous editions.'],
      ['Where can I watch the 2026 World Cup?', `You can find the best live streaming options and VPN guides at ${SITE_URL}/watch.html`],
      ['How accurate are the AI predictions?', 'Our AI model uses current form, historical head-to-head records, and tournament context to generate win probability percentages.']
    ]));
  } else if (pageType === 'predictions') {
    schemas.push(breadcrumbSchema('AI Predictions', pageUrl));
    schemas.push(faqSchema([
      ['How does the AI predict World Cup matches?', 'Our AI analyzes team form, head-to-head history, player availability, and tournament context to calculate win probabilities.'],
      ['How accurate are the 2026 World Cup predictions?', 'AI predictions are probabilistic — they give the likelihood of each outcome. A 70% win chance still means a 30% chance of something different happening.'],
      ['What is the predicted winner of the 2026 World Cup?', `View our current AI bracket prediction at ${SITE_URL}/bracket.html — updated live as the tournament progresses.`]
    ]));
  } else if (pageType === 'match' || slug.includes('-vs-')) {
    // Try to extract team names from slug
    const match = slug.match(/^(.+?)-vs-(.+?)(?:-\d+)?$/);
    if (match) {
      const home = match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const away = match[2].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      schemas.push(sportsEventSchema(home, away, '2026-06-11', 'USA/Canada/Mexico'));
    }
    schemas.push(breadcrumbSchema(slug.replace(/-/g, ' '), pageUrl));
  } else if (pageType === 'faq' || pageType === 'vpn' || pageType === 'sweepstake') {
    schemas.push(breadcrumbSchema(slug.replace(/-/g, ' '), pageUrl));
    if (pageType === 'vpn') {
      schemas.push(faqSchema([
        ['Do I need a VPN to watch the 2026 World Cup?', 'A VPN can help you access streaming services from different regions. This guide shows you the legal options available in your country.'],
        ['What is the best VPN for the 2026 World Cup?', `See our updated comparison at ${SITE_URL}/vpn-guide.html — ranked by speed, price, and streaming support.`],
        ['Is using a VPN to watch football legal?', 'VPN legality varies by country. Always check your local laws and the terms of service of your streaming provider.']
      ]));
    }
  } else {
    schemas.push(breadcrumbSchema(slug.replace(/-/g, ' '), pageUrl));
  }

  return schemas;
}

// ─── HTML injection ───────────────────────────────────────────────────────────

function injectSchema(html, schemas) {
  if (!schemas.length) return html;

  const schemaBlocks = schemas.map(s => `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`);
  const injection    = '\n' + schemaBlocks.join('\n') + '\n';

  // Insert before </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `${injection}</head>`);
  }
  // Fallback: insert before </html>
  if (html.includes('</html>')) {
    return html.replace('</html>', `${injection}</html>`);
  }
  return html + injection;
}

function injectAdsense(html, filename) {
  // Skip if already has AdSense
  if (html.includes('adsbygoogle') || html.includes('pagead2.googlesyndication')) {
    return null; // null = already has it
  }
  // Skip admin pages
  const name = path.basename(filename, '.html').toLowerCase();
  if (['command-center', 'admin', 'dashboard', 'login'].includes(name)) return null;

  // Insert before </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `${ADSENSE_SNIPPET}\n</head>`);
  }
  return html + ADSENSE_SNIPPET;
}

// ─── Cookie consent injection ─────────────────────────────────────────────────
// Required for GDPR compliance + Google AdSense approval.
// Skips pages that already have it, and the privacy-policy page itself.

const COOKIE_CONSENT_SNIPPET = `
<!-- GDPR Cookie Consent (required for AdSense) -->
<script src="/cookie-consent.js" defer></script>`;

// ─── OG + Twitter Card injection ─────────────────────────────────────────────
// Without these, every share on Twitter/Facebook/WhatsApp shows a blank card.
// We generate page-specific tags from the filename + existing <title> tag.

const OG_IMAGE_URL = `${SITE_URL}/og-default.png`; // 1200×630px image (create once)

function getPageOGMeta(filename) {
  const name  = path.basename(filename, '.html').toLowerCase();
  const title = name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace('Wc2026', 'WC 2026')
    .replace('Wc 2026', 'WC 2026')
    .replace('Vpn', 'VPN')
    .replace('Var', 'VAR')
    .replace('Nfl', 'NFL')
    .replace('Ai ', 'AI ')
    .replace('Pnl', 'P&L');

  const descriptions = {
    'command-center':      'Live WC 2026 scores, AI predictions, and real-time match updates all in one place.',
    'live-scores':         'Real-time World Cup 2026 live scores, match timelines, and minute-by-minute updates.',
    'prediction-game':     'Predict match results, earn points, and climb the WC 2026 leaderboard.',
    'leaderboard':         'WC 2026 prediction leaderboard — see where you rank against thousands of fans.',
    'odds-comparison':     'Compare betting odds across sportsbooks for every World Cup 2026 match.',
    'freebets2026':        'Free bets, bonuses and promotions for the 2026 FIFA World Cup.',
    'streaming-guide':     'How to watch World Cup 2026 live — streaming guide for every country.',
    'watch-guide':         'How to watch WC 2026 live online from anywhere in the world.',
    'privacy-policy':      'Privacy Policy for WC 2026 Live — how we use your data.',
    'admin-dashboard':     'WC 2026 Empire operations dashboard.',
    'ai-command-center':   'AI-powered control center for the WC 2026 content empire.',
  };

  const desc = descriptions[name] ||
    `${title} — WC 2026 Live. Real-time World Cup 2026 coverage, AI predictions, and match analysis.`;

  return { title: `${title} | WC 2026 Live`, desc };
}

function extractExistingTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function injectOGTags(html, filename) {
  // Skip if OG tags already exist
  if (html.includes('og:title') || html.includes('og:description')) return null;
  if (!html.includes('</head>')) return null;

  const { title, desc } = getPageOGMeta(filename);
  const pageTitle = extractExistingTitle(html) || title;
  const canonicalUrl = `${SITE_URL}/${path.basename(filename)}`.replace('/index.html', '/');

  const ogTags = `
<!-- Canonical URL (prevents duplicate content SEO penalty) -->
<link rel="canonical" href="${canonicalUrl}">
<!-- Open Graph / Social sharing -->
<meta property="og:type"        content="website">
<meta property="og:url"         content="${canonicalUrl}">
<meta property="og:title"       content="${pageTitle}">
<meta property="og:description" content="${desc}">
<meta property="og:image"       content="${OG_IMAGE_URL}">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name"   content="${SITE_NAME}">
<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${pageTitle}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image"       content="${OG_IMAGE_URL}">`;

  return html.replace('</head>', `${ogTags}\n</head>`);
}

function injectCookieConsent(html, filename) {
  if (html.includes('cookie-consent.js')) return null; // already has it
  if (html.includes('</head>')) {
    return html.replace('</head>', `${COOKIE_CONSENT_SNIPPET}\n</head>`);
  }
  return null;
}

// ─── Subscribe embed injection ────────────────────────────────────────────────
// Adds floating 🔔 subscribe button to every page.
// Skip pages where it would be redundant or unwanted.

const SUBSCRIBE_EMBED_SNIPPET = `
<!-- Subscribe widget — goal alerts for every visitor -->
<script src="/subscribe-embed.js" defer></script>`;

const SUBSCRIBE_SKIP_PAGES = ['privacy-policy', 'unsubscribe', 'subscribe', 'admin', 'command-center', 'ai-command-center'];

function injectSubscribeEmbed(html, filename) {
  if (html.includes('subscribe-embed.js')) return null;
  const name = path.basename(filename, '.html').toLowerCase();
  if (SUBSCRIBE_SKIP_PAGES.includes(name)) return null;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${SUBSCRIBE_EMBED_SNIPPET}\n</body>`);
  }
  return null;
}

// ─── Service worker registration injection ────────────────────────────────────
// Required for browser push notifications to work. Registers service-worker.js
// on every page so the push subscription is established site-wide.

const SW_SNIPPET = `
<!-- Service Worker registration (push notifications) -->
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => { console.log('[SW] registered', reg.scope); })
      .catch(err => { console.warn('[SW] registration failed', err); });
  }
</script>`;

function injectServiceWorker(html, filename) {
  if (html.includes('service-worker.js') || html.includes('serviceWorker')) return null;
  const name = path.basename(filename, '.html').toLowerCase();
  if (['admin', 'command-center'].includes(name)) return null;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${SW_SNIPPET}\n</body>`);
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[Injector] scanning: ${HTML_DIR}`);
  const modeLabel = SCHEMA_ONLY ? 'schema only' : ADSENSE_ONLY ? 'adsense only' : SCRIPTS_ONLY ? 'scripts only' : 'schema + adsense + scripts';
  console.log(`[Injector] mode: ${modeLabel}${DRY_RUN ? ' [DRY RUN]' : ''}`);

  if (!fs.existsSync(HTML_DIR)) {
    console.error(`[Injector] directory not found: ${HTML_DIR}`);
    console.error(`  Hint: run "node programmatic-seo.js" first to generate HTML, or set --dir`);
    process.exit(1);
  }

  const files = fs.readdirSync(HTML_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(HTML_DIR, f));

  if (!files.length) {
    console.warn('[Injector] no HTML files found in', HTML_DIR);
    process.exit(0);
  }

  console.log(`[Injector] found ${files.length} HTML files`);

  for (const filepath of files) {
    let html = fs.readFileSync(filepath, 'utf8');
    let modified = false;

    if (!ADSENSE_ONLY && !SCRIPTS_ONLY) {
      const schemas = buildSchemas(filepath, html);
      if (schemas.length) {
        html = injectSchema(html, schemas);
        modified = true;
        injectedSchema++;
      }
    }

    if (!SCHEMA_ONLY && !SCRIPTS_ONLY) {
      const withAdsense = injectAdsense(html, filepath);
      if (withAdsense !== null) {
        html = withAdsense;
        modified = true;
        injectedAdsense++;
      }
    }

    // OG + Twitter Card tags — run unless schema-only or adsense-only
    if (!SCHEMA_ONLY && !ADSENSE_ONLY) {
      const withOG = injectOGTags(html, filepath);
      if (withOG !== null) {
        html = withOG;
        modified = true;
        injectedOG++;
      }
    }

    // Always inject scripts (unless --schema-only or --adsense-only)
    if (!SCHEMA_ONLY && !ADSENSE_ONLY) {
      const withConsent = injectCookieConsent(html, filepath);
      if (withConsent !== null) {
        html = withConsent;
        modified = true;
        injectedConsent++;
      }

      const withEmbed = injectSubscribeEmbed(html, filepath);
      if (withEmbed !== null) {
        html = withEmbed;
        modified = true;
        injectedSubscribe++;
      }

      const withSW = injectServiceWorker(html, filepath);
      if (withSW !== null) {
        html = withSW;
        modified = true;
        injectedSW++;
      }
    }

    if (modified) {
      if (!DRY_RUN) fs.writeFileSync(filepath, html, 'utf8');
      console.log(`  ✅ ${path.basename(filepath)}`);
    } else {
      skipped++;
    }
  }

  console.log(`
[Injector] Complete${DRY_RUN ? ' (DRY RUN — no files written)' : ''}:
  Schema injected:         ${injectedSchema}
  AdSense injected:        ${injectedAdsense}
  OG + Twitter Cards:      ${injectedOG}
  Cookie consent injected: ${injectedConsent}
  Subscribe embed injected:${injectedSubscribe}
  Service worker injected: ${injectedSW}
  Skipped (no changes):    ${skipped}
  Total files:             ${files.length}
`);

  if (ADSENSE_CLIENT.includes('XXXXXXXX')) {
    console.warn('⚠️  ADSENSE_CLIENT is placeholder — set env var ADSENSE_CLIENT=ca-pub-XXXXXXXX');
  }
}

main().catch(e => { console.error('[Injector error]', e); process.exit(1); });
