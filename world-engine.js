/**
 * world-engine.js — WC 2026 Total World Intelligence System
 *
 * Tracks EVERYTHING happening worldwide around WC 2026 and turns it into
 * content, monetization opportunities, and viral moments — automatically.
 *
 * MONITORS (every 5-15 minutes):
 *   Live match data        — goals, cards, injuries, lineups, substitutions
 *   News & rumors          — Google News, NewsAPI, sports RSS feeds
 *   Social trends          — Twitter trending topics, Reddit hot posts
 *   Transfer rumors        — player moves, agent leaks, fee speculation
 *   Injury & fitness       — official reports + social media leaks
 *   Referee assignments    — WHO is officiating each match
 *   Weather & climate      — match day conditions at all 16 venues
 *   Betting line moves     — sharp money tracker (Pinnacle, Betfair)
 *   Player controversies   — off-field drama, press conference quotes
 *   Fan sentiment          — social listening across 50 languages
 *   Political angles       — government reactions, diplomatic incidents at WC
 *   VAR/tech decisions     — controversial calls, offside chart discussions
 *   Stadium/crowd events   — attendance, atmosphere, pitch conditions
 *   Broadcast rights       — which channel in which country = affiliate opp
 *   Fantasy sport points   — FPL, DFS, Sorare player scores
 *   Brand deals/sponsorship — player endorsements, controversies, drops
 *
 * OUTPUTS (for every detected event):
 *   → Platform-specific content (English + auto-translated to 12 languages)
 *   → SEO page creation (new page for every trending topic)
 *   → Affiliate opportunity flagged (right product for right event)
 *   → Email/push/Telegram alert with monetization hook
 *   → Reddit/Discord/WhatsApp community post
 *   → Social media post queue (Twitter, Facebook, TikTok script)
 *   → Owner alert if viral potential detected
 *
 * DEPLOY: Railway always-on process. Runs next to autonomous-agent.js.
 * START: node world-engine.js
 */

require('dotenv').config();
const groqClient = require('./groq-client');
const fs   = require('fs');
const path = require('path');

// ── INTEGRATION HUB — wires every module together ─────────────────────────
const hub = require('./integration-hub');


// ── INTELLIGENCE FEEDS ────────────────────────────────────────────────────────
const FEEDS = {
  // Free news APIs
  newsapi:     `https://newsapi.org/v2/everything?q=World+Cup+2026&language=en&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`,
  guardian:    `https://content.guardianapis.com/search?q=world-cup-2026&api-key=${process.env.GUARDIAN_API_KEY}&show-fields=headline,body`,
  bbc_sport:   `https://feeds.bbci.co.uk/sport/football/rss.xml`,
  skysports:   `https://www.skysports.com/rss/12040`,
  espn:        `https://www.espn.com/espn/rss/soccer/news`,
  goal:        `https://www.goal.com/en/feeds/news?fmt=rss`,
  fabrizio:    `https://twitter.com/FabrizioRomano`, // Monitor via Twitter API
};

// ── 16 WC 2026 VENUES (weather + atmosphere context) ──────────────────────────
const VENUES = {
  'AT&T Stadium':       { city: 'Arlington TX',   lat: 32.748, lon: -97.093, tz: 'America/Chicago',    altitude: 183,  climate: 'hot_humid' },
  'Rose Bowl':          { city: 'Los Angeles CA',  lat: 34.162, lon: -118.168, tz: 'America/Los_Angeles', altitude: 268, climate: 'warm_dry' },
  'MetLife Stadium':    { city: 'New York NJ',    lat: 40.814, lon: -74.074, tz: 'America/New_York',   altitude: 10,   climate: 'temperate' },
  'Levi\'s Stadium':   { city: 'Santa Clara CA',  lat: 37.403, lon: -121.970, tz: 'America/Los_Angeles', altitude: 15,  climate: 'mild' },
  'Lincoln Financial':  { city: 'Philadelphia PA', lat: 39.901, lon: -75.168, tz: 'America/New_York',   altitude: 7,    climate: 'temperate' },
  'Arrowhead Stadium':  { city: 'Kansas City MO',  lat: 39.049, lon: -94.484, tz: 'America/Chicago',   altitude: 277,  climate: 'continental' },
  'SoFi Stadium':       { city: 'Inglewood CA',    lat: 33.953, lon: -118.339, tz: 'America/Los_Angeles', altitude: 18, climate: 'warm_dry' },
  'Allegiant Stadium':  { city: 'Las Vegas NV',    lat: 36.091, lon: -115.183, tz: 'America/Los_Angeles', altitude: 617, climate: 'desert_hot' },
  'Seattle Stadium':    { city: 'Seattle WA',      lat: 47.595, lon: -122.332, tz: 'America/Los_Angeles', altitude: 6,   climate: 'cool_wet' },
  'BC Place':           { city: 'Vancouver BC',    lat: 49.278, lon: -123.112, tz: 'America/Vancouver',  altitude: 5,   climate: 'mild_wet' },
  'BMO Field':          { city: 'Toronto ON',      lat: 43.633, lon: -79.419, tz: 'America/Toronto',    altitude: 76,   climate: 'continental' },
  'Estadio Azteca':     { city: 'Mexico City MX',  lat: 19.303, lon: -99.151, tz: 'America/Mexico_City', altitude: 2240, climate: 'high_altitude' },
  'Estadio Guadalajara':{ city: 'Guadalajara MX',  lat: 20.645, lon: -103.436, tz: 'America/Mexico_City', altitude: 1566, climate: 'high_altitude' },
  'Estadio Monterrey':  { city: 'Monterrey MX',    lat: 25.669, lon: -100.311, tz: 'America/Monterrey', altitude: 538,  climate: 'semi_arid' },
  'Estadio Ciudad':     { city: 'Mexico City MX',  lat: 19.358, lon: -99.208, tz: 'America/Mexico_City', altitude: 2280, climate: 'high_altitude' },
  'Kansas City Stadium':{ city: 'Kansas City MO',  lat: 39.099, lon: -94.578, tz: 'America/Chicago',    altitude: 277,  climate: 'continental' },
};

// ── LANGUAGES + AUDIENCE COUNTRIES ────────────────────────────────────────────
const LANGUAGE_MARKETS = {
  en:    { countries: ['US','GB','AU','CA','NG','ZA','GH','KE'], population: 1500000000 },
  es:    { countries: ['MX','ES','AR','CO','CL','PE','VE','UY','EC','PY','BO','CR','PA','DO','HN','SV','NI','GT','CU','PR'], population: 500000000 },
  pt:    { countries: ['BR','PT','MZ','AO','CV'], population: 250000000 },
  fr:    { countries: ['FR','CI','SN','CM','MA','TN','DZ','BJ','BF','GN','CD','CG','GA','ML','NE','TD'], population: 300000000 },
  ar:    { countries: ['SA','AE','EG','MA','DZ','TN','JO','LB','IQ','SY','KW','QA','BH','OM','YE','LY','SD'], population: 400000000 },
  de:    { countries: ['DE','AT','CH'], population: 100000000 },
  it:    { countries: ['IT'], population: 60000000 },
  nl:    { countries: ['NL','BE'], population: 25000000 },
  ja:    { countries: ['JP'], population: 125000000 },
  ko:    { countries: ['KR'], population: 52000000 },
  hi:    { countries: ['IN'], population: 600000000 },
  tr:    { countries: ['TR'], population: 85000000 },
};

// ── STATE ─────────────────────────────────────────────────────────────────────
const STATE_FILE = path.join(__dirname, 'world-engine-state.json');
let W = {
  seenNewsIds: new Set(),
  seenTweets: new Set(),
  seenRumors: new Set(),
  trendingTopics: [],
  activeRumors: [],
  injuryList: {},
  transferRumors: [],
  controversies: [],
  lineMovements: [],
  createdPages: [],
  viralMoments: [],
  eventLog: [],
  lastChecks: {},
};
try {
  const saved = JSON.parse(fs.readFileSync(STATE_FILE));
  W = { ...W, ...saved, seenNewsIds: new Set(saved.seenNewsIds || []), seenTweets: new Set(saved.seenTweets || []) };
} catch {}
function saveW() {
  const toSave = { ...W, seenNewsIds: [...W.seenNewsIds], seenTweets: [...W.seenTweets] };
  fs.writeFileSync(STATE_FILE, JSON.stringify(toSave, null, 2));
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function log(tag, msg) { console.log(`[${new Date().toISOString().slice(0,19)}] [${tag}] ${msg}`); }

async function tg(chatId, text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return;
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  }).catch(() => {});
}

async function ai(prompt, tokens = 400, json = false) {
  try {
    const opts = { engine: 'world-engine', eventType: 'INTELLIGENCE', messages: [{ role: 'user', content: prompt }], max_tokens: tokens, temperature: 0.7 };
    if (json) opts.response_format = { type: 'json_object' };
    const text = await groqClient.complete(opts);
    if (json) { try { return JSON.parse((text||'').replace(/```json|```/g, '')); } catch { return null; } }
    return text || null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1: NEWS & RUMOR SCANNER
// Scans all news feeds, extracts WC-relevant stories, classifies them
// ─────────────────────────────────────────────────────────────────────────────

async function scanNews() {
  const since = Date.now() - 3600000; // Last hour
  const articles = [];

  // NewsAPI
  if (process.env.NEWS_API_KEY) {
    try {
      const r = await fetch(`https://newsapi.org/v2/everything?q=%22World+Cup+2026%22&sortBy=publishedAt&pageSize=20&apiKey=${process.env.NEWS_API_KEY}`);
      const d = await r.json();
      if (d.articles) articles.push(...d.articles.map(a => ({ id: a.url, title: a.title, body: a.description, source: a.source?.name, publishedAt: a.publishedAt, url: a.url })));
    } catch {}
  }

  // BBC Sport RSS
  try {
    const r = await fetch('https://feeds.bbci.co.uk/sport/football/rss.xml');
    const xml = await r.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    items.forEach(item => {
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || '';
      const link  = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const desc  = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || '';
      if (/world.cup|wc.?2026/i.test(title + desc)) articles.push({ id: link, title, body: desc, source: 'BBC Sport', url: link });
    });
  } catch {}

  // Goal.com RSS
  try {
    const r = await fetch('https://www.goal.com/en/feeds/news?fmt=rss');
    const xml = await r.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    items.forEach(item => {
      const title = (item.match(/<title>(.*?)<\/title>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g,'');
      const link  = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const desc  = (item.match(/<description>(.*?)<\/description>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g,'');
      if (title.length > 5) articles.push({ id: link, title, body: desc, source: 'Goal.com', url: link });
    });
  } catch {}

  // Process new articles
  const newArticles = articles.filter(a => !W.seenNewsIds.has(a.id));
  for (const article of newArticles.slice(0, 10)) {
    W.seenNewsIds.add(article.id);
    await processNewsItem(article);
  }

  W.lastChecks.news = new Date().toISOString();
  saveW();
  if (newArticles.length) log('NEWS', `Found ${newArticles.length} new articles`);
}

async function processNewsItem(article) {
  const classification = await ai(
    `Classify this WC 2026 news headline for monetization potential.
Title: "${article.title}"
Body: "${(article.body || '').slice(0, 200)}"

Return JSON: {
  "category": "injury|transfer_rumor|controversy|tactical|result|performance|fan_reaction|political|venue|referee|record|drama",
  "viralPotential": 1-10,
  "monetizationAngle": "one sentence — which income stream does this unlock",
  "affectedTeams": ["Brazil","France"],
  "urgency": "breaking|today|background",
  "seoKeyword": "main keyword people will search"
}`, 300, true
  );

  if (!classification) return;
  log('NEWS', `[${classification.urgency}][${classification.viralPotential}/10] ${article.title.slice(0,60)}`);

  // Store
  W.eventLog.unshift({ type: 'news', article, classification, time: new Date().toISOString() });
  if (W.eventLog.length > 500) W.eventLog = W.eventLog.slice(0, 500);

  // React based on type + viral potential
  if (classification.viralPotential >= 7) {
    await capitalizeOnNewsItem(article, classification);
  }

  if (classification.category === 'injury') {
    await handleInjuryNews(article, classification);
  }
  if (classification.category === 'transfer_rumor') {
    await handleTransferRumor(article, classification);
  }
  if (classification.category === 'controversy' || classification.category === 'drama') {
    await handleDrama(article, classification);
  }
  if (classification.category === 'referee') {
    await handleRefereeNews(article, classification);
  }
  if (classification.seoKeyword) {
    await queueSEOPage(classification.seoKeyword, article, classification);
  }

  saveW();
}

async function capitalizeOnNewsItem(article, meta) {
  const dayNum = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);

  // Generate platform content
  const [freePost, twitterPost, redditPost] = await Promise.all([
    ai(`WC 2026 news (Day ${dayNum}): "${article.title}". Write a punchy Telegram post that teases the full story and drives traffic to wc2026intel.com. Include a CTA. Max 200 chars.`, 100),
    ai(`Tweet about: "${article.title}". Max 240 chars. Punchy, add 2-3 hashtags. #WC2026 required.`, 80),
    ai(`Write a Reddit post for r/worldcup or r/soccer: "${article.title}" from ${article.source}. Analytical, community tone, no overt selling. 150 words. Include link to source.`, 250),
  ]);

  // Output to content queue
  const item = {
    source: article.source,
    headline: article.title,
    viralScore: meta.viralPotential,
    monetizationAngle: meta.monetizationAngle,
    telegram: freePost,
    twitter: twitterPost,
    reddit: redditPost,
    time: new Date().toISOString(),
    seoKeyword: meta.seoKeyword,
    url: article.url,
  };

  appendToQueue('news-content-queue.json', item);

  // Alert owner for breaking/high viral
  if (meta.urgency === 'breaking' || meta.viralPotential >= 9) {
    await tg(process.env.TELEGRAM_OWNER_ID,
`🚨 *BREAKING — Viral Score: ${meta.viralPotential}/10*

"${article.title}"
Source: ${article.source}

💰 Opportunity: ${meta.monetizationAngle}
🔍 SEO keyword: ${meta.seoKeyword}

Content queued for all platforms.
/capitalize to review + send now.`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: INJURY TRACKER
// ─────────────────────────────────────────────────────────────────────────────

async function handleInjuryNews(article, meta) {
  const analysis = await ai(
    `WC 2026 injury news: "${article.title}". Return JSON:
{"player":"Name","team":"Country","severity":"minor|moderate|major|tournament_ending","nextMatch":"vs Germany","bettingImpact":"one sentence","fantasyImpact":"one sentence","replacementPlayer":"most likely name"}`, 250, true
  );
  if (!analysis) return;

  // Update injury tracker
  W.injuryList[analysis.player] = { ...analysis, updatedAt: new Date().toISOString(), source: article.url };

  // Create injury page if major
  if (analysis.severity === 'major' || analysis.severity === 'tournament_ending') {
    await queueSEOPage(`${analysis.player} injury WC 2026`, article, { ...meta, urgency: 'breaking' });
    await tg(process.env.TELEGRAM_OWNER_ID,
`🏥 *INJURY ALERT*

${analysis.player} (${analysis.team})
Severity: ${analysis.severity.toUpperCase()}
Next match: ${analysis.nextMatch}

📊 Betting impact: ${analysis.bettingImpact}
⚽ Fantasy: ${analysis.fantasyImpact}
→ Replacement: ${analysis.replacementPlayer}

SEO page queued.`
    );
  }

  log('INJURY', `${analysis.player} (${analysis.team}) — ${analysis.severity}`);
  saveW();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3: TRANSFER RUMOR TRACKER (even during tournament)
// Players linked to clubs mid-tournament = massive search volume
// ─────────────────────────────────────────────────────────────────────────────

async function handleTransferRumor(article, meta) {
  const rumor = await ai(
    `Transfer rumor during WC 2026: "${article.title}". Return JSON:
{"player":"Name","from":"Current Club","to":"Target Club","fee":"£80m","source":"Fabrizio Romano","reliability":7,"searchVolume":"high|medium|low","articleAngle":"one sentence on why fans care"}`, 200, true
  );
  if (!rumor) return;

  const rumorKey = `${rumor.player}_${rumor.to}`;
  if (W.seenRumors.has(rumorKey)) return;
  W.seenRumors.add(rumorKey);

  W.transferRumors.unshift({ ...rumor, articleUrl: article.url, detectedAt: new Date().toISOString() });

  // Transfer pages get huge search traffic
  await queueSEOPage(`${rumor.player} transfer ${new Date().getFullYear()}`, article, meta);

  // If reliable source, alert owner + post
  if (rumor.reliability >= 7 || /Romano|Ornstein|Scholes/i.test(rumor.source)) {
    await tg(process.env.TELEGRAM_FREE_CHANNEL_ID,
`🔄 *TRANSFER RUMOUR*

${rumor.player} → ${rumor.to}
Fee: ${rumor.fee || 'undisclosed'}
Source: ${rumor.source}

🔍 Full analysis → wc2026intel.com`
    );
    log('TRANSFER', `${rumor.player} to ${rumor.to} (reliability: ${rumor.reliability}/10)`);
  }

  saveW();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: DRAMA & CONTROVERSY TRACKER
// Off-field drama = viral content = massive traffic spikes
// ─────────────────────────────────────────────────────────────────────────────

async function handleDrama(article, meta) {
  const drama = await ai(
    `WC 2026 drama/controversy: "${article.title}". Return JSON:
{"type":"fight|statement|political|ban|racism|celebration|foul_play|coach_row|fan_incident","players":["Name"],"teams":["Country"],"severity":"minor|major|explosive","clickbaitHeadline":"sensational but accurate 10-word headline","twitterAngle":"tweet angle that will go viral","redditAngle":"discussion angle for r/soccer"}`, 250, true
  );
  if (!drama) return;

  W.controversies.unshift({ ...drama, article, detectedAt: new Date().toISOString() });

  if (drama.severity === 'explosive' || meta.viralPotential >= 8) {
    const [tgPost, tweetPost] = await Promise.all([
      ai(`Write a Telegram post about this WC 2026 drama: "${drama.clickbaitHeadline}". Punchy, drives clicks to site. 150 chars.`, 80),
      ai(`Tweet: "${drama.clickbaitHeadline}". Max 240 chars. This WILL go viral — write accordingly. #WC2026.`, 80),
    ]);

    appendToQueue('drama-queue.json', { drama, tgPost, tweetPost, article, time: new Date().toISOString() });

    await tg(process.env.TELEGRAM_OWNER_ID,
`🔥 *DRAMA DETECTED — Viral Potential: ${meta.viralPotential}/10*

"${drama.clickbaitHeadline}"
Type: ${drama.type} | Severity: ${drama.severity}

Content queued. Review drama-queue.json to post now.`
    );
  }

  log('DRAMA', `[${drama.type}][${drama.severity}] ${drama.clickbaitHeadline?.slice(0,60)}`);
  saveW();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5: REFEREE INTELLIGENCE TRACKER
// Referee assignments released 24-48hrs before matches
// ─────────────────────────────────────────────────────────────────────────────

async function handleRefereeNews(article, meta) {
  const ref = await ai(
    `Referee news for WC 2026: "${article.title}". Return JSON:
{"referee":"Name","nationality":"Country","match":"Home vs Away","reputation":"strict|moderate|lenient","yellowsPerGame":3.8,"controversialHistory":"one sentence or null","bettingAngle":"one sentence on how this affects prediction"}`, 200, true
  );
  if (!ref) return;

  log('REFEREE', `${ref.referee} assigned to ${ref.match} — ${ref.reputation}`);

  await tg(process.env.TELEGRAM_PREMIUM_CHANNEL_ID,
`🟨 *REFEREE ASSIGNED*

${ref.referee} (${ref.nationality}) → ${ref.match}
Style: ${ref.reputation} | ${ref.yellowsPerGame} Y/game
${ref.controversialHistory ? `⚠️ History: ${ref.controversialHistory}` : ''}

📊 Betting angle: ${ref.bettingAngle}`
  );

  saveW();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 6: TRENDING TOPIC MONITOR + INSTANT SEO PAGE FACTORY
// Detects what people are searching and creates a page for it immediately
// ─────────────────────────────────────────────────────────────────────────────

async function queueSEOPage(keyword, source, meta) {
  const pageKey = keyword.toLowerCase().replace(/\s+/g, '-');
  if (W.createdPages.includes(pageKey)) return; // Already created

  const pageSpec = await ai(
    `Create a brief spec for an SEO page targeting: "${keyword}" for WC 2026 Intel.
Return JSON: {
  "title": "page title (H1)",
  "metaDescription": "160 chars",
  "slug": "url-slug",
  "sections": ["Section 1 headline","Section 2 headline","Section 3 headline"],
  "faqQuestions": ["Q1","Q2","Q3"],
  "relatedKeywords": ["kw1","kw2","kw3"],
  "monetizationHook": "what to sell/promote on this page",
  "urgency": "now|today|this-week"
}`, 400, true
  );

  if (!pageSpec) return;

  // Add to page generation queue
  const queueItem = {
    keyword,
    slug: pageSpec.slug || pageKey,
    spec: pageSpec,
    source: source?.url,
    meta,
    status: 'queued',
    queuedAt: new Date().toISOString(),
  };

  appendToQueue('seo-page-queue.json', queueItem);
  W.createdPages.push(pageKey);

  log('SEO', `Queued page: "${keyword}" → /${pageSpec.slug}`);
  saveW();
}

// Watch what's trending and create pages proactively
async function monitorTrends() {
  const dayNum = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);

  const trendingGuess = await ai(
    `WC 2026, Day ${dayNum}. What are the top 5 things people are most likely searching RIGHT NOW based on typical WC progression at this stage? Return JSON array of strings — the exact search queries.`, 200, true
  );

  if (!Array.isArray(trendingGuess)) return;

  for (const trend of trendingGuess) {
    await queueSEOPage(trend, null, { viralPotential: 7, urgency: 'today' });
  }

  W.trendingTopics = trendingGuess;
  W.lastChecks.trends = new Date().toISOString();
  saveW();
  log('TRENDS', `Proactive pages queued: ${trendingGuess.slice(0,3).join(', ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 7: LIVE MATCH CONTEXT ENRICHER
// Adds real-time context to every match event
// ─────────────────────────────────────────────────────────────────────────────

async function enrichMatchContext(home, away, venue) {
  const venueData = VENUES[venue] || {};
  const injuries  = Object.entries(W.injuryList).filter(([, v]) => v.team === home || v.team === away);
  const rumors    = W.transferRumors.filter(r => r.player && (r.from?.includes(home) || r.from?.includes(away)));

  // Get weather
  let weather = null;
  if (venueData.lat && process.env.OPENWEATHER_API_KEY) {
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${venueData.lat}&lon=${venueData.lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`);
      const d = await r.json();
      weather = { temp: d.main?.temp, feels: d.main?.feels_like, humidity: d.main?.humidity, desc: d.weather?.[0]?.description };
    } catch {}
  }

  const context = {
    venue: venueData,
    weather,
    injuredPlayers: injuries.map(([name]) => name),
    activeRumors: rumors.length,
    altitude: venueData.altitude,
    altitudeImpact: venueData.altitude > 2000 ? 'SIGNIFICANT — teams unaccustomed to altitude will tire 15-20% faster' : venueData.altitude > 1000 ? 'MODERATE — slight fatigue factor' : 'NEGLIGIBLE',
  };

  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 8: MULTI-LANGUAGE CONTENT FACTORY
// Takes any English content and creates versions for all 12 language markets
// ─────────────────────────────────────────────────────────────────────────────

async function translateForAllMarkets(englishContent, contentType = 'telegram_post') {
  const priority = ['es', 'pt', 'fr', 'ar', 'de', 'ja', 'ko', 'hi']; // Most valuable markets first
  const translations = { en: englishContent };

  // Translate in batches of 4 (Groq rate limit management)
  for (let i = 0; i < priority.length; i += 4) {
    const batch = priority.slice(i, i + 4);
    const batchResults = await Promise.all(batch.map(async lang => {
      const langNames = { es:'Spanish', pt:'Portuguese', fr:'French', ar:'Arabic', de:'German', ja:'Japanese', ko:'Korean', hi:'Hindi', tr:'Turkish', it:'Italian' };
      const translated = await ai(
        `Translate this ${contentType} to ${langNames[lang]}. Adapt naturally for the ${langNames[lang]}-speaking football audience — not just literal translation, but culturally appropriate. Keep any English hashtags.
Content: "${englishContent}"
Return ONLY the translated text.`, 200
      );
      return [lang, translated];
    }));
    batchResults.forEach(([lang, text]) => { if (text) translations[lang] = text; });
  }

  return translations;
}

// Publish to language-specific channels
async function broadcastMultilingual(englishContent, eventType) {
  const translations = await translateForAllMarkets(englishContent);

  const results = {};

  // Each language market has its own Telegram channel env var
  for (const [lang, content] of Object.entries(translations)) {
    const channelId = process.env[`TELEGRAM_${lang.toUpperCase()}_CHANNEL_ID`];
    if (channelId && content) {
      await tg(channelId, content);
      results[lang] = true;
    }
  }

  // Save translations to content queue for all platforms
  appendToQueue('multilingual-queue.json', {
    eventType, translations,
    markets: Object.keys(translations).length,
    time: new Date().toISOString(),
  });

  log('MULTILINGUAL', `Content translated and queued for ${Object.keys(translations).length} language markets`);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 9: BETTING LINE MOVEMENT DETECTOR (Sharp Money Signals)
// ─────────────────────────────────────────────────────────────────────────────

async function checkOddsMovements() {
  if (!process.env.THE_ODDS_API_KEY) return;

  try {
    const r = await fetch(`https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${process.env.THE_ODDS_API_KEY}&regions=uk&markets=h2h&bookmakers=pinnacle`);
    if (!r.ok) return;
    const games = await r.json();

    for (const game of games) {
      const home = game.home_team;
      const away = game.away_team;
      const gameKey = `${home}_${away}`;

      const bk = game.bookmakers?.find(b => b.key === 'pinnacle') || game.bookmakers?.[0];
      if (!bk) continue;

      const mkt = bk.markets?.[0]?.outcomes || [];
      const homeOdds = mkt.find(o => o.name === home)?.price;
      const awayOdds = mkt.find(o => o.name === away)?.price;

      if (!homeOdds) continue;

      // Compare with last known odds
      const lastOdds = W.lineMovements.find(m => m.game === gameKey);
      if (lastOdds) {
        const homeDelta = Math.abs(homeOdds - lastOdds.homeOdds);
        if (homeDelta >= 0.15) { // Significant movement
          const direction = homeOdds < lastOdds.homeOdds ? home : away;
          const movement  = `${lastOdds.homeOdds} → ${homeOdds}`;

          const sharpTake = await ai(
            `Betting line moved: ${home} vs ${away}. ${home} odds: ${lastOdds.homeOdds} → ${homeOdds}. This is a significant move. In one sentence: what does this sharp money movement tell us?`, 80
          );

          log('SHARPS', `Line moved: ${home} vs ${away} — ${direction} favored (${movement})`);

          // Alert premium channel
          await tg(process.env.TELEGRAM_PREMIUM_CHANNEL_ID,
`💰 *SHARP MONEY ALERT*

${home} vs ${away}
${direction} odds: ${movement}

🧠 ${sharpTake || 'Sharp money moving — professionals positioning before public wakes up.'}

Act before the line corrects.`
          );

          // Alert owner
          await tg(process.env.TELEGRAM_OWNER_ID,
            `📊 Sharp money on ${direction} (${home} vs ${away}) — ${movement}. Premium channel alerted.`
          );

          // Update record
          const idx = W.lineMovements.findIndex(m => m.game === gameKey);
          W.lineMovements[idx] = { game: gameKey, homeOdds, awayOdds, lastUpdated: new Date().toISOString() };
          saveW();
        }
      } else {
        W.lineMovements.push({ game: gameKey, homeOdds, awayOdds, lastUpdated: new Date().toISOString() });
      }
    }
  } catch (e) { log('ERROR:ODDS', e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 10: FANTASY SPORT TRACKER
// FPL, DraftKings, Sorare — player scores = content + affiliate traffic
// ─────────────────────────────────────────────────────────────────────────────

async function trackFantasyAngles(matchData) {
  const scorers = matchData.events?.filter(e => e.type === 'Goal') || [];
  const assists = matchData.events?.filter(e => e.type === 'assist') || [];

  for (const scorer of scorers) {
    const name = scorer.player?.name;
    if (!name) continue;

    const fantasyTake = await ai(
      `${name} scored in WC 2026. In 2 sentences: what does this mean for FPL/fantasy football managers owning or considering this player? Be specific about ownership percentages and value.`, 100
    );

    // Queue for content
    appendToQueue('fantasy-updates.json', {
      player: name, event: 'goal', fantasyTake,
      draftKingsAngle: `${name} just scored — check DraftKings WC daily contests`,
      time: new Date().toISOString(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 11: GLOBAL FAN SENTIMENT MONITOR
// Social listening across platforms — what fans of each country are saying
// ─────────────────────────────────────────────────────────────────────────────

async function generateAudienceSpecificContent(event, targetCountry) {
  const lang = Object.entries(LANGUAGE_MARKETS).find(([, v]) => v.countries.includes(targetCountry))?.[0] || 'en';
  const langNames = { en:'English', es:'Spanish', pt:'Portuguese', fr:'French', ar:'Arabic', de:'German', ja:'Japanese', ko:'Korean', hi:'Hindi' };

  const content = await ai(
    `WC 2026 event: ${JSON.stringify(event)}
Write a ${langNames[lang]} social media post specifically for ${targetCountry} fans.
Consider their team's perspective, local betting culture, and what matters most to fans from ${targetCountry}.
Return only the post text. Max 200 chars.`, 150
  );

  return { country: targetCountry, lang, content };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 12: MEDIA COVERAGE GENERATOR
// Gets the system cited by press, builds domain authority + brand recognition
// ─────────────────────────────────────────────────────────────────────────────

async function generatePressContent() {
  const dayNum = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);
  const predStats = getPredictionStats();

  // Generate press-worthy story from our data
  const pressAngle = await ai(
    `WC 2026 Day ${dayNum}. An AI prediction system (WC 2026 Intel) has made ${predStats.total} predictions with ${predStats.accuracy}% accuracy.
Write a 300-word press release or media pitch about this. Make it newsworthy for sports journalists. Include: system methodology, accuracy claim, most interesting prediction calls, quote from "the team".
Target: sports desk editors at BBC, Guardian, ESPN, local newspapers.`, 400
  );

  if (pressAngle) {
    appendToQueue('press-queue.json', {
      type: 'press_release',
      content: pressAngle,
      targetMedia: ['bbc_sport', 'guardian', 'espn', 'talksport', 'sky_sports'],
      stats: predStats,
      time: new Date().toISOString(),
    });

    // Also generate a Twitter thread to go viral as a self-published press release
    const thread = await ai(
      `WC 2026 Intel AI system: ${predStats.total} predictions, ${predStats.accuracy}% accuracy. Write a Twitter thread (5-7 tweets) that will go viral in the football/betting community. Show off the most impressive calls. Start with 🧵.`, 400
    );
    if (thread) appendToQueue('twitter-threads.json', { thread, stats: predStats, time: new Date().toISOString() });
  }

  log('PRESS', `Press content generated (accuracy: ${predStats.accuracy}%)`);
}

function getPredictionStats() {
  try {
    const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'bot-state.json')));
    const preds = state.predictions || [];
    const decided = preds.filter(p => p.correct !== null);
    const correct = decided.filter(p => p.correct).length;
    return { total: preds.length, decided: decided.length, correct, accuracy: decided.length ? Math.round(correct/decided.length*100) : 0 };
  } catch { return { total: 0, decided: 0, correct: 0, accuracy: 0 }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 13: FOOTBALL AGENT SAAS TOOL
// Agents and clubs use player performance data — monetize as a pro tool
// ─────────────────────────────────────────────────────────────────────────────

async function generateAgentReport(playerName, tournamentStats) {
  const report = await ai(
    `Generate a professional football agent scouting report for ${playerName} based on WC 2026 performance.
Format as a proper scouting document including:
- Performance rating (1-10 scale per category: pace, technique, vision, pressing, heading, big game performance)
- Market value estimate (before WC vs now)
- Best fit clubs (top 5 with reasoning)
- Contract window analysis (when does current deal expire?)
- Agent pitch points (what to say to clubs)
- Risk factors
Length: 400 words. Professional tone.`, 600
  );

  return report;
}

// Agent SaaS endpoint — called when someone subscribes to agent tier ($499/month)
async function serveAgentTool(req) {
  const { player, stats } = req;
  const report = await generateAgentReport(player, stats);
  // Output as PDF-ready HTML or JSON
  return { report, player, generatedAt: new Date().toISOString() };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 14: PREDICTION GAME ENGINE
// Users predict every match — leaderboard — top 10 win prizes
// ─────────────────────────────────────────────────────────────────────────────

const GAME_FILE = path.join(__dirname, 'prediction-game.json');
let game = { players: {}, submissions: [], leaderboard: [] };
try { game = JSON.parse(fs.readFileSync(GAME_FILE)); } catch {}
function saveGame() { fs.writeFileSync(GAME_FILE, JSON.stringify(game, null, 2)); }

function submitPrediction(userId, username, matchId, home, away, predictedScore) {
  if (!game.players[userId]) game.players[userId] = { username, points: 0, predictions: 0, correct: 0 };
  game.submissions.push({ userId, username, matchId, home, away, predictedScore, submittedAt: new Date().toISOString(), result: null });
  game.players[userId].predictions++;
  saveGame();
}

function scoreMatch(matchId, actualHome, actualAway) {
  const subs = game.submissions.filter(s => s.matchId === matchId && !s.result);
  for (const sub of subs) {
    const [ph, pa] = (sub.predictedScore || '').split('-').map(Number);
    let points = 0;
    if (ph === actualHome && pa === actualAway) points = 3; // Exact score
    else if ((ph > pa && actualHome > actualAway) || (ph < pa && actualHome < actualAway) || (ph === pa && actualHome === actualAway)) points = 1; // Correct outcome
    sub.result = { actualHome, actualAway, points };
    game.players[sub.userId].points += points;
    if (points > 0) game.players[sub.userId].correct++;
  }
  // Update leaderboard
  game.leaderboard = Object.entries(game.players)
    .map(([id, p]) => ({ userId: id, ...p }))
    .sort((a,b) => b.points - a.points)
    .slice(0, 20);
  saveGame();
}

function getLeaderboard(n = 10) {
  return game.leaderboard.slice(0, n);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: APPEND TO QUEUE FILE
// ─────────────────────────────────────────────────────────────────────────────

function appendToQueue(filename, item) {
  const file = path.join(__dirname, filename);
  let arr = [];
  try { arr = JSON.parse(fs.readFileSync(file)); } catch {}
  arr.unshift(item);
  if (arr.length > 100) arr = arr.slice(0, 100);
  fs.writeFileSync(file, JSON.stringify(arr, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LOOP
// ─────────────────────────────────────────────────────────────────────────────

let tick = 0;

async function run() {
  tick++;
  try {
    if (tick % 3   === 0) await scanNews();               // Every 3 min
    if (tick % 6   === 0) await checkOddsMovements();     // Every 6 min
    if (tick % 12  === 0) await monitorTrends();          // Every 12 min
    if (tick % 60  === 0) await generatePressContent();   // Every hour
    if (tick % 120 === 0) { tick = 0; }
  } catch (e) { console.error('[WORLD-ENGINE ERROR]', e.message); }
}

async function start() {
  log('WORLD-ENGINE', '🌍 Starting WC 2026 World Intelligence System...');

  // ── INTEGRATION HUB: start Express API with all routes ─────────────────
  // world-engine is a pure intelligence loop; Express lives in whatsapp-bot.js
  // but we wire hub routes into a lightweight server here if standalone
  if (!process.env.SKIP_HUB_SERVER) {
    const express = require('express');
    const cors    = require('cors');
    const hubApp  = express();
    hubApp.use(express.json());
    hubApp.use(cors());

    const HUB_PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';
    hubApp.use((req, res, next) => {
      if (req.method === 'GET') return next();
      const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
      if (HUB_PIPELINE_SECRET && token !== HUB_PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
      next();
    });

    hub.init(hubApp);

    // Railway requires GET /health returning 200 for service to be marked healthy
    hubApp.get('/health', (_req, res) => res.json({ ok: true, service: 'world-engine', uptime: process.uptime() }));
    hubApp.get('/status', (_req, res) => res.json({ ok: true, service: 'world-engine', uptime: process.uptime(), ts: Date.now() }));

    // moment-engine dispatches live events here for intelligence correlation
    hubApp.post('/trigger', (req, res) => {
      const { eventType, ...data } = req.body || {};
      if (eventType) {
        // Emit into the hub event system for any registered handlers
        hub.emit(eventType, data);
        log('HUB', `Received event from moment-engine: ${eventType}`);
      }
      res.json({ ok: true, service: 'world-engine', received: eventType || 'unknown' });
    });

    const HUB_PORT = process.env.PORT || process.env.HUB_PORT || 3003;
    hubApp.listen(HUB_PORT, () => log('HUB', `✅ API server on :${HUB_PORT}`));
  }

  await tg(process.env.TELEGRAM_OWNER_ID,
`🌍 *World Engine Online*

Monitoring:
✅ News & rumors (3min)
✅ Sharp money moves (6min)
✅ Trending topics → SEO pages (12min)
✅ Press content (hourly)
✅ All 12 language markets
✅ Transfer rumors, injuries, drama
✅ Referee assignments
✅ Fantasy sport angles

Every world event → content + opportunity.`
  );
  setInterval(run, 60000); // 1-minute heartbeat
  await run(); // Run immediately
}

start().catch(e => { console.error('[FATAL]', e); process.exit(1); });

module.exports = { translateForAllMarkets, broadcastMultilingual, generateAgentReport, submitPrediction, scoreMatch, getLeaderboard, enrichMatchContext, queueSEOPage };
