/**
 * moment-engine.js
 * Fires 8-18 automated revenue actions within 60 seconds of any match event.
 * 
 * Events handled:
 *   GOAL, SAVE, RED_CARD, HAT_TRICK, ELIMINATION, UPSET, INJURY, VAR, RECORD
 * 
 * Each event fires: SEO page, social posts (all platforms), email segment,
 * push notifications, merch trigger, affiliate CTA, drama bar, co-reg burst.
 * 
 * Plugs into: integration-hub.js (EventEmitter), content-multiplier.js,
 *             affiliate-matrix.js, world-engine.js
 */

'use strict';

const EventEmitter = require('events');
const path  = require('path');
const fs    = require('fs');
const axios = require('axios');

// ─── Groq AI (routed through shared budget guard — prevents token burn-out) ───
const groqClient = require('./groq-client');

// ─── Sibling modules ──────────────────────────────────────────────────────────
const { getBestAffiliate, getAffiliates } = require('./affiliate-matrix');

// ─── Output directories ───────────────────────────────────────────────────────
const QUEUES_DIR   = path.join(__dirname, 'queues');
const SEO_DIR      = path.join(__dirname, 'seo-pages');
const DRAMA_FILE   = path.join(__dirname, 'drama-queue.json');
const MERCH_FILE   = path.join(__dirname, 'merch-queue.json');

for (const d of [QUEUES_DIR, SEO_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── HTTP ENGINE DISPATCHER — the missing link ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every Railway engine has a POST /trigger endpoint. This dispatcher fires
// them all in parallel within 2s of any match event.
// Set each URL in .env — falls back to localhost for dev.

const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';

const ENGINE_URLS = {
  bluesky:      process.env.BLUESKY_ENGINE_URL       || 'http://localhost:3006',
  mastodon:     process.env.MASTODON_ENGINE_URL       || 'http://localhost:3007',
  podcast:      process.env.PODCAST_ENGINE_URL        || 'http://localhost:3008',
  newsSynd:     process.env.NEWS_SYNDICATION_URL      || 'http://localhost:3009',
  snapchat:     process.env.SNAPCHAT_ENGINE_URL       || 'http://localhost:3010',
  naver:        process.env.NAVER_ENGINE_URL          || 'http://localhost:3011',
  sharechat:    process.env.SHARECHAT_ENGINE_URL      || 'http://localhost:3012',
  twitch:       process.env.TWITCH_BOT_URL            || 'http://localhost:3013',
  webStories:   process.env.WEB_STORIES_URL           || 'http://localhost:3014',
  linkedin:     process.env.LINKEDIN_ENGINE_URL       || 'http://localhost:3015',
  imageEngine:  process.env.IMAGE_ENGINE_URL          || 'http://localhost:3016',
  visualPost:   process.env.VISUAL_ENGINE_URL         || 'http://localhost:3017',
  commentary:   process.env.COMMENTARY_ENGINE_URL     || 'http://localhost:3018',
  newsMonitor:  process.env.NEWS_MONITOR_URL          || 'http://localhost:3019',
  facebook:     process.env.FACEBOOK_ENGINE_URL       || 'http://localhost:3021',
  discord:      process.env.DISCORD_BOT_URL           || 'http://localhost:3022',
  reddit:       process.env.REDDIT_BOT_URL            || 'http://localhost:3023',
  twitter:      process.env.TWITTER_ENGINE_URL        || 'http://localhost:3028',
  telegram:     process.env.TELEGRAM_ENGINE_URL       || 'http://localhost:3029',
  email:        process.env.EMAIL_DIGEST_URL          || 'http://localhost:3030',
  whatsapp:     process.env.WHATSAPP_ENGINE_URL       || 'http://localhost:3034',
  translation:  process.env.TRANSLATION_ENGINE_URL    || 'http://localhost:3026',
  youtube:      process.env.YOUTUBE_UPLOADER_URL      || 'http://localhost:3025',
  dedup:        process.env.DEDUP_GUARD_URL           || 'http://localhost:3033',
  worldEngine:  process.env.WORLD_ENGINE_URL          || 'http://localhost:3003',
  // ── Phase 2 engines ───────────────────────────────────────────────────────
  line:         process.env.LINE_ENGINE_URL           || 'http://localhost:3039',
  viber:        process.env.VIBER_ENGINE_URL          || 'http://localhost:3040',
  oddsEngine:   process.env.ODDS_ENGINE_URL           || 'http://localhost:3041',
  medium:       process.env.MEDIUM_ENGINE_URL         || 'http://localhost:3042',
  koo:          process.env.KOO_ENGINE_URL            || 'http://localhost:3043',
  merch:        process.env.MERCH_ENGINE_URL          || 'http://localhost:3044',
  fantasy:      process.env.FANTASY_ENGINE_URL        || 'http://localhost:3045',
  // ── Phase 3 engines — global platform expansion ────────────────────────────
  kakao:        process.env.KAKAO_ENGINE_URL          || 'http://localhost:3046',
  zalo:         process.env.ZALO_ENGINE_URL           || 'http://localhost:3047',
  vk:           process.env.VK_ENGINE_URL             || 'http://localhost:3048',
  weibo:        process.env.WEIBO_ENGINE_URL          || 'http://localhost:3049',
  nairaland:    process.env.NAIRALAND_ENGINE_URL      || 'http://localhost:3050',
  empireAgent:  process.env.EMPIRE_AGENT_URL          || 'http://localhost:3051',
  growthAgent:  process.env.GROWTH_AGENT_URL          || 'http://localhost:3052',
  // ── Phase 4 — traffic + SEO amplification ─────────────────────────────────
  trafficAmp:   process.env.TRAFFIC_AMPLIFIER_URL     || 'http://localhost:3053',
};

// Events each engine cares about (optimization — don't fire podcast on every goal)
const ENGINE_EVENT_MAP = {
  bluesky:    ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'RED_CARD', 'SECOND_YELLOW', 'MATCH_END', 'HAT_TRICK', 'VAR', 'PRE_MATCH'],
  mastodon:   ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'RED_CARD', 'MATCH_END', 'HAT_TRICK', 'PRE_MATCH'],
  podcast:    ['MATCH_END', 'ELIMINATION', 'UPSET', 'HAT_TRICK'],
  newsSynd:   ['GOAL', 'RED_CARD', 'MATCH_END', 'HAT_TRICK', 'UPSET', 'ELIMINATION', 'INJURY', 'PRE_MATCH'],
  snapchat:   ['GOAL', 'MATCH_END', 'HAT_TRICK', 'UPSET', 'PRE_MATCH'],
  naver:      ['MATCH_END', 'HAT_TRICK', 'UPSET', 'ELIMINATION', 'PRE_MATCH'],
  sharechat:  ['GOAL', 'MATCH_END', 'HAT_TRICK', 'UPSET', 'PRE_MATCH'],
  twitch:     ['GOAL', 'PENALTY_GOAL', 'RED_CARD', 'SECOND_YELLOW', 'MATCH_END', 'HAT_TRICK'],
  webStories: ['GOAL', 'MATCH_END', 'HAT_TRICK', 'UPSET', 'PRE_MATCH'],
  linkedin:   ['MATCH_END', 'HAT_TRICK', 'UPSET', 'ELIMINATION'],
  imageEngine: [], // called internally by visualPost — don't double-trigger
  visualPost: ['GOAL', 'PENALTY_GOAL', 'MATCH_END', 'HAT_TRICK', 'UPSET', 'PRE_MATCH'],
  commentary: ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'RED_CARD', 'HAT_TRICK'],
  newsMonitor: [], // self-polling, no trigger needed
  facebook:    ['GOAL', 'RED_CARD', 'MATCH_END', 'HAT_TRICK', 'UPSET', 'ELIMINATION', 'PRE_MATCH'],
  discord:     ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'RED_CARD', 'MATCH_END', 'HAT_TRICK', 'UPSET'],
  reddit:      ['GOAL', 'RED_CARD', 'MATCH_END', 'HAT_TRICK', 'UPSET', 'ELIMINATION', 'VAR'],
  twitter:     ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'ELIMINATION', 'VAR', 'RECORD', 'PRE_MATCH'],
  telegram:    ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'ELIMINATION', 'PRE_MATCH', 'INJURY', 'VAR', 'RECORD'],
  email:       [], // email-digest-engine self-schedules daily digests; not event-driven
  whatsapp:    ['GOAL', 'PENALTY_GOAL', 'MATCH_END'],       // only highest-value events (paid per message)
  translation: ['GOAL', 'HAT_TRICK', 'RED_CARD', 'MATCH_END', 'UPSET', 'ELIMINATION', 'PRE_MATCH'],
  // pinterest: removed — pinterest-automation.js is a content-gen utility script, not an HTTP service
  youtube:     ['MATCH_END', 'HAT_TRICK', 'UPSET', 'ELIMINATION'],  // highlight clips + commentary videos
  dedup:       [], // dedup-guard is called internally before dispatch, not via event map
  worldEngine: ['GOAL', 'PENALTY_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'ELIMINATION', 'PRE_MATCH', 'INJURY', 'RECORD', 'BREAKING_NEWS'],
  // ── Phase 2: regional platforms + revenue machines ──────────────────────────
  line:        ['GOAL', 'PENALTY_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'ELIMINATION', 'PRE_MATCH'],
  viber:       ['GOAL', 'PENALTY_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'ELIMINATION', 'PRE_MATCH'],
  oddsEngine:  ['PRE_MATCH', 'GOAL', 'MATCH_END'],
  medium:      ['MATCH_END', 'HAT_TRICK', 'UPSET', 'ELIMINATION'],
  koo:         ['GOAL', 'PENALTY_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'PRE_MATCH'],
  merch:       ['ELIMINATION', 'HAT_TRICK', 'UPSET'],
  fantasy:     ['MATCH_END', 'PRE_MATCH', 'ELIMINATION', 'HAT_TRICK'],
  // ── Phase 3 ──────────────────────────────────────────────────────────────────
  kakao:       ['GOAL', 'PENALTY_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'ELIMINATION', 'PRE_MATCH'],
  zalo:        ['GOAL', 'PENALTY_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'ELIMINATION', 'PRE_MATCH'],
  vk:          ['GOAL', 'PENALTY_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'ELIMINATION', 'PRE_MATCH'],
  weibo:       ['GOAL', 'PENALTY_GOAL', 'RED_CARD', 'HAT_TRICK', 'MATCH_END', 'UPSET', 'ELIMINATION', 'PRE_MATCH'],
  nairaland:   ['GOAL', 'MATCH_END', 'HAT_TRICK', 'UPSET', 'ELIMINATION', 'PRE_MATCH', 'RED_CARD'],
  empireAgent: ['ELIMINATION', 'HAT_TRICK', 'UPSET', 'MATCH_END'],
  growthAgent: ['GOAL', 'HAT_TRICK', 'UPSET', 'ELIMINATION', 'RED_CARD', 'RECORD', 'BREAKING_NEWS', 'MATCH_END'],
  // ── Phase 4 ──────────────────────────────────────────────────────────────────
  trafficAmp:  ['HAT_TRICK', 'UPSET', 'ELIMINATION', 'RECORD', 'BREAKING_NEWS', 'MATCH_END'],
};

const dispatchLog = []; // recent dispatch results, in-memory

/**
 * dispatchToEngines — fire all Railway engine /trigger endpoints in parallel.
 * Called at the END of every event handler.
 *
 * @param {string} eventType - e.g. 'GOAL', 'RED_CARD'
 * @param {object} payload   - event data to forward
 */
async function dispatchToEngines(eventType, payload) {
  // ── Dedup check — prevent duplicate posts on network retries or race conditions ──
  const DEDUP_URL = ENGINE_URLS.dedup;
  try {
    const dedupRes = await axios.post(
      `${DEDUP_URL}/check`,
      { eventType, source: 'moment-engine', ...payload },
      { headers: { 'Content-Type': 'application/json', 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 2000 }
    );
    if (dedupRes.data?.duplicate) {
      console.log(`[dispatch] ⏭  ${eventType} is a duplicate — skipping (fingerprint: ${dedupRes.data.fingerprint})`);
      return [];
    }
  } catch (_) {
    // Dedup guard unreachable — fail open and proceed (never drop a real event)
    console.warn('[dispatch] dedup-guard unreachable — proceeding without dedup check');
  }

  const body    = { eventType, ...payload, dispatchedAt: new Date().toISOString() };
  const headers = {
    'Content-Type':      'application/json',
    'x-pipeline-secret': PIPELINE_SECRET
  };

  const tasks = Object.entries(ENGINE_URLS)
    .filter(([name]) => {
      if (name === 'dedup') return false; // never dispatch to dedup-guard itself
      const allowed = ENGINE_EVENT_MAP[name];
      // null/undefined = no map entry = always dispatch; [] = explicitly "never dispatch"
      if (!allowed) return true;
      if (allowed.length === 0) return false;
      return allowed.includes(eventType);
    })
    .map(async ([name, baseUrl]) => {
      const url = `${baseUrl.replace(/\/$/, '')}/trigger`;
      const start = Date.now();
      try {
        await axios.post(url, body, { headers, timeout: 8000 });
        const ms = Date.now() - start;
        console.log(`[dispatch] ✅ ${name} (${ms}ms)`);
        return { engine: name, ok: true, ms };
      } catch (e) {
        const ms = Date.now() - start;
        // Don't log localhost errors (engine not running in dev)
        if (!baseUrl.includes('localhost')) {
          console.warn(`[dispatch] ❌ ${name}: ${e.message}`);
        }
        return { engine: name, ok: false, error: e.message, ms };
      }
    });

  const results = await Promise.allSettled(tasks);
  const summary = results.map(r => r.status === 'fulfilled' ? r.value : { ok: false, error: r.reason?.message });

  // Log last 100 dispatches
  dispatchLog.unshift({ eventType, timestamp: new Date().toISOString(), results: summary });
  if (dispatchLog.length > 100) dispatchLog.length = 100;

  const ok  = summary.filter(r => r.ok).length;
  const err = summary.filter(r => !r.ok).length;
  console.log(`[dispatch] ${eventType} → ${ok} engines reached, ${err} failed/offline`);

  return summary;
}

// ─── Platform queue helpers (keep for queue-processor to drain) ───────────────
function enqueue(platform, item) {
  const file = path.join(QUEUES_DIR, `${platform}-queue.json`);
  const q = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  q.push({ ...item, queuedAt: new Date().toISOString() });
  fs.writeFileSync(file, JSON.stringify(q, null, 2));
}

// ─── AI content generator (budget-aware via groq-client) ─────────────────────
async function aiWrite(prompt, maxTokens = 300, eventType = 'MOMENT') {
  return groqClient.complete({
    engine:    'moment-engine',
    eventType,
    messages: [
      { role: 'system', content: 'You are a sports content writer. Write engaging, concise content. No hashtags unless requested. Output only the content itself.' },
      { role: 'user',   content: prompt }
    ],
    max_tokens: maxTokens,
  });
}

// ─── Language burst helper (top 5 languages for a country) ───────────────────
const COUNTRY_LANG = {
  GB:'en', US:'en', NG:'en', KE:'sw', GH:'en', ZA:'en', BR:'pt', IN:'hi',
  MX:'es', AR:'es', CO:'es', DE:'de', FR:'fr', ES:'es', NL:'nl', PT:'pt',
  MA:'ar', SN:'fr', CM:'fr', JP:'ja', KR:'ko', AU:'en', CA:'en', TR:'tr',
  ID:'id', SA:'ar', EG:'ar', PK:'ur', VN:'vi', CI:'fr', UG:'sw', TZ:'sw'
};

function topCountriesForNation(nationCode) {
  // Returns countries most likely to engage with content about this nation
  const map = {
    ENG: ['GB','AU','IN','NG','ZA'], FRA: ['FR','MA','SN','CI','CM'],
    BRA: ['BR','PT','AR','US'],      ARG: ['AR','ES','IT','US'],
    GER: ['DE','AT','NL','CH'],      ESP: ['ES','MX','AR','CO','US'],
    POR: ['PT','BR','MZ','AO'],      USA: ['US','CA','MX'],
    MEX: ['MX','US','CO','AR'],      NGA: ['NG','GH','KE','ZA'],
    KEN: ['KE','TZ','UG','NG'],      MAR: ['MA','EG','SA','FR'],
    JPN: ['JP','KR','AU'],           KOR: ['KR','JP','US'],
    AUS: ['AU','NZ','GB'],           IND: ['IN','PK','SL'],
    SAU: ['SA','EG','MA','AE'],      SEN: ['SN','CI','CM','FR'],
  };
  return map[nationCode] || ['GB','US','BR','ES','DE'];
}

// ─── Affiliate CTA templates ──────────────────────────────────────────────────
function buildCTA(aff, context) {
  if (!aff) return '';
  if (aff.ageGated) {
    return `18+ | Gamble Responsibly | [${aff.label}](${aff.link}) — ${context}`;
  }
  return `[${aff.label}](${aff.link}) — ${context}`;
}

// ─── SEO page builder ─────────────────────────────────────────────────────────
async function buildSEOPage(slug, title, content, affiliates = []) {
  const affHtml = affiliates.slice(0, 3).map(a =>
    `<div class="cta-box"><a href="${a.link}" rel="sponsored noopener">${a.label}</a></div>`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | WC2026.ai</title>
<meta name="description" content="${content.slice(0,160)}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${content.slice(0,200)}">
</head>
<body>
<article>
<h1>${title}</h1>
<div class="content">${content.replace(/\n/g,'<br>')}</div>
${affHtml}
</article>
<script src="/squeeze-engine.js"></script>
</body>
</html>`;

  const file = path.join(SEO_DIR, `${slug}.html`);
  fs.writeFileSync(file, html);
  return `/seo/${slug}`;
}

// ─── DRAMA BAR updater ────────────────────────────────────────────────────────
function fireDramaBar(text, level = 'high', link = null) {
  const q = fs.existsSync(DRAMA_FILE) ? JSON.parse(fs.readFileSync(DRAMA_FILE, 'utf8')) : [];
  q.unshift({ text, level, link, timestamp: Date.now() });
  // Keep only last 20 drama items
  fs.writeFileSync(DRAMA_FILE, JSON.stringify(q.slice(0, 20), null, 2));
  console.log(`[drama] ${level.toUpperCase()} — ${text}`);
}

// ─── Merch trigger ────────────────────────────────────────────────────────────
function triggerMerch(templateType, playerName, nationCode, event) {
  const q = fs.existsSync(MERCH_FILE) ? JSON.parse(fs.readFileSync(MERCH_FILE, 'utf8')) : [];
  q.push({
    templateType,  // 'goal', 'hat_trick', 'elimination', 'upset', 'record'
    playerName,
    nationCode,
    event,
    designs: [
      `${playerName} — WC 2026`,
      `I Watched ${playerName} Score At WC 2026`,
      nationCode ? `${nationCode} — WC 2026` : null,
    ].filter(Boolean),
    timestamp: new Date().toISOString(),
    status: 'pending',
  });
  fs.writeFileSync(MERCH_FILE, JSON.stringify(q, null, 2));
}

// ─── Push notification payload ────────────────────────────────────────────────
function buildPush(title, body, url, urgency = 'normal') {
  enqueue('push', { title, body, url, urgency });
}

// ─── Email segment trigger ────────────────────────────────────────────────────
function triggerEmail(segment, subject, body, cta) {
  enqueue('email', { segment, subject, body, cta, priority: 'urgent' });
}

// ─── Co-registration burst ────────────────────────────────────────────────────
function fireCoReg(eventType, metadata) {
  enqueue('coreg', { eventType, metadata, burst: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── EVENT HANDLERS ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GOAL — 14 simultaneous actions
 * eventData: { player, team, opponent, nationCode, minute, xG, matchId }
 */
async function onGoal(eventData) {
  const { player, team, opponent, nationCode, minute, xG = 0.3, matchId } = eventData;
  const timestamp = new Date().toISOString();
  console.log(`[moment-engine] ⚽ GOAL: ${player} (${team} vs ${opponent}) ${minute}'`);

  const countries = topCountriesForNation(nationCode);
  const primaryCountry = countries[0];
  const sbAff = getBestAffiliate(primaryCountry, 'affiliate_sportsbook');
  const vpnAff = getBestAffiliate('GB', 'affiliate_vpn');
  const slug = `${player.replace(/\s+/g,'-').toLowerCase()}-goal-wc-2026-${matchId || Date.now()}`;
  const title = `${player} Goal vs ${opponent} — WC 2026 Analysis`;

  // 1. Generate AI analysis
  const [analysis, twitterThread, emailBody] = await Promise.all([
    aiWrite(`Write a 150-word tactical analysis of ${player}'s goal in minute ${minute} vs ${opponent}. xG was ${xG}. Include technique, positioning, defensive error.`),
    aiWrite(`Write a 3-tweet thread about ${player}'s goal for ${team} vs ${opponent} in minute ${minute}. Tweet 1: the moment. Tweet 2: stats/xG (${xG}). Tweet 3: what this means for the game. Keep each under 280 chars. Separate with ---`),
    aiWrite(`Write a 100-word exciting email paragraph about ${player} scoring vs ${opponent} in minute ${minute}. End with "Here's the best value bet right now:" — excite the reader, don't be boring.`)
  ]);

  // 2. SEO page
  const affiliates = getAffiliates(primaryCountry, 'affiliate_sportsbook').slice(0, 3);
  const seoUrl = await buildSEOPage(slug, title, analysis || '', affiliates);

  // 3. Twitter/X
  if (twitterThread) {
    const tweets = twitterThread.split('---').map(t => t.trim()).filter(Boolean);
    tweets.forEach((tweet, i) => {
      enqueue('twitter', { text: tweet, thread: true, threadIndex: i, matchId, eventType: 'goal', player });
    });
  }

  // 4. TikTok script (for Kling AI video)
  const tiktokScript = `${player} just scored in minute ${minute}! ${analysis?.slice(0,100) || ''} Watch the full breakdown 👆`;
  enqueue('tiktok', { script: tiktokScript, player, team, eventType: 'goal', seoUrl, affiliateCTA: buildCTA(sbAff, 'Bet now') });

  // 5. Instagram stat card
  enqueue('instagram', {
    type: 'stat_card',
    data: { player, team, opponent, minute, xG, title: `GOAL ⚽` },
    caption: `${player} scores vs ${opponent} in minute ${minute}!\n\nLink in bio for value bets 👆`,
    eventType: 'goal'
  });

  // 6. Telegram — free alert
  const telegramFree = `⚽ GOAL: ${player} scores for ${team} vs ${opponent} (${minute}')\n\nxG: ${xG} — Was this lucky?\n\n👇 Deep analysis + value bets in premium`;
  enqueue('telegram', { channel: 'free', text: telegramFree, eventType: 'goal' });

  // 7. Telegram — premium deep analysis
  const telegramPremium = `⚽ GOAL ANALYSIS [PREMIUM]\n\n${analysis || 'Analysis generating...'}\n\n${buildCTA(sbAff, 'Best available odds')}`;
  enqueue('telegram', { channel: 'premium', text: telegramPremium, eventType: 'goal' });

  // 8. WhatsApp broadcast (Africa + diaspora)
  enqueue('whatsapp', {
    segments: countries.filter(c => ['NG','KE','GH','ZA','TZ','UG'].includes(c)),
    text: `⚽ ${player} scores! ${team} vs ${opponent}\n\nMinute ${minute} | xG: ${xG}\n\nGet free tips: [LINK]`,
    eventType: 'goal'
  });

  // 9. Push notification
  buildPush(
    `⚽ GOAL — ${player}!`,
    `${player} scores for ${team} in minute ${minute}. See analysis + value bet →`,
    seoUrl,
    'high'
  );

  // 10. Email to betting/tips segments
  triggerEmail(
    ['betting', 'tips', `nation_${nationCode}`],
    `⚽ ${player} just scored — here's the value bet`,
    `${emailBody || `${player} just scored for ${team} in minute ${minute}!`}\n\n${buildCTA(sbAff, 'Claim your bonus now')}`,
    sbAff?.link
  );

  // 11. Merch trigger
  triggerMerch('goal', player, nationCode, eventData);

  // 12. Drama bar
  fireDramaBar(`⚽ GOAL: ${player} (${minute}') — ${team} ${'>'.repeat(1)} ${opponent}`, 'high', seoUrl);

  // 13. Co-reg burst — all active forms
  fireCoReg('goal', { player, team, opponent, minute, seoUrl });

  // 14. Odds CTA refresh — Golden Boot
  enqueue('odds-refresh', {
    markets: ['golden_boot', `match_result_${matchId}`, `anytime_scorer_${player.replace(/\s+/g,'_')}`],
    reason: 'goal_scored',
    player,
    affId: sbAff?.id
  });

  // HTTP dispatch to all Railway engines
  await dispatchToEngines('GOAL', { player, team, opponent, nationCode, minute, xG, matchId, homeScore: eventData.homeScore, awayScore: eventData.awayScore, homeTeam: team, awayTeam: opponent, seoUrl });

  console.log(`[moment-engine] ⚽ GOAL: 14 actions fired for ${player}`);
  return { actions: 14, slug, seoUrl };
}

/**
 * RED CARD — 11 simultaneous actions
 * eventData: { player, team, referee, minute, matchId, nationCode }
 */
async function onRedCard(eventData) {
  const { player, team, referee, minute, matchId, nationCode } = eventData;
  console.log(`[moment-engine] 🟥 RED CARD: ${player} (${team}) min ${minute} — Referee: ${referee}`);

  const slug = `${referee?.replace(/\s+/g,'-').toLowerCase() || 'referee'}-red-card-wc-2026-${matchId || Date.now()}`;
  const title = `${player} Red Card — WC 2026 | Was It Right?`;

  const [analysis, refHistory] = await Promise.all([
    aiWrite(`Write 120 words on whether ${player}'s red card in minute ${minute} was justified. Was it harsh? What does it mean for ${team}? Include match impact analysis.`),
    aiWrite(`Write a tweet thread (2 tweets, under 280 chars each, separated by ---) on the controversy of ${player}'s red card at WC 2026. Make it debate-starting.`)
  ]);

  const countries = topCountriesForNation(nationCode);
  const primaryCountry = countries[0];
  const sbAff = getBestAffiliate(primaryCountry, 'affiliate_sportsbook');
  const affiliates = getAffiliates(primaryCountry, 'affiliate_sportsbook').slice(0, 3);

  // 1. SEO page (referee database update)
  await buildSEOPage(slug, title, analysis || '', affiliates);

  // 2. Referee DB update
  enqueue('referee-db', { referee, action: 'red_card', player, team, minute, matchId });

  // 3. Twitter controversy thread
  if (refHistory) {
    refHistory.split('---').forEach((t, i) =>
      enqueue('twitter', { text: t.trim(), thread: true, threadIndex: i, eventType: 'red_card' })
    );
    // Add poll tweet
    enqueue('twitter', {
      text: `Was ${player}'s red card fair? 🟥\n\nYes, clear red → \nNo, way too harsh →`,
      type: 'poll',
      options: ['Yes, clear red', 'No, too harsh', 'Borderline'],
      eventType: 'red_card'
    });
  }

  // 4. TikTok frame-by-frame breakdown script
  enqueue('tiktok', { script: `Was this red card FAIR? Here's the frame-by-frame breakdown of ${player}'s tackle in minute ${minute}... ${analysis?.slice(0,80) || ''}`, eventType: 'red_card', player });

  // 5. Drama bar — maximum level
  fireDramaBar(`🟥 RED CARD: ${player} (${team}) — Was it fair? Vote now`, 'max', `/${slug}`);

  // 6. Odds refresh (team now a man down)
  enqueue('odds-refresh', { markets: [`match_result_${matchId}`], reason: 'red_card', team, affId: sbAff?.id });

  // 7. Email to betting segment
  triggerEmail(
    ['betting', 'tips'],
    `🟥 ${player} red card — odds just shifted`,
    `${player} has been sent off in minute ${minute}. ${team} down to 10 men. Here's how the odds have moved:\n\n${buildCTA(sbAff, 'Get the value bet')}`,
    sbAff?.link
  );

  // 8. Push notification
  buildPush(`🟥 RED CARD — ${player}!`, `${player} off in minute ${minute}. Was it fair? Odds shifting NOW.`, `/${slug}`, 'high');

  // 9. Reddit posts
  enqueue('reddit', { subreddits: ['soccer', 'football', `r_${team.replace(/\s+/g,'')}`], title: `${player} red card — justified or daylight robbery?`, body: analysis || '', eventType: 'red_card' });

  // 10. Co-reg burst
  fireCoReg('red_card', { player, team, minute, matchId });

  // 11. Telegram poll + analysis
  enqueue('telegram', { channel: 'free', text: `🟥 RED CARD: ${player} sent off!\n\nFair? Reply YES or NO 👇\n\nFull breakdown + value bets in premium channel`, eventType: 'red_card' });

  await dispatchToEngines('RED_CARD', { player, team, referee, minute, matchId, nationCode, homeTeam: team });

  console.log(`[moment-engine] 🟥 RED CARD: 11 actions fired`);
  return { actions: 11 };
}

/**
 * HAT TRICK — 16 simultaneous actions
 * eventData: { player, team, opponent, nationCode, matchId, goals }
 */
async function onHatTrick(eventData) {
  const { player, team, opponent, nationCode, matchId, goals = [] } = eventData;
  console.log(`[moment-engine] 🎩 HAT TRICK: ${player} (${team} vs ${opponent})`);

  const countries = topCountriesForNation(nationCode);
  const primaryCountry = countries[0];
  const sbAff = getBestAffiliate(primaryCountry, 'affiliate_sportsbook');
  const vpnAff = getBestAffiliate('GB', 'affiliate_vpn');
  const slug = `${player.replace(/\s+/g,'-').toLowerCase()}-hat-trick-wc-2026-${matchId || Date.now()}`;
  const title = `${player} Hat Trick vs ${opponent} — WC 2026 | Full Analysis`;

  const [analysis, emailSubject] = await Promise.all([
    aiWrite(`Write 200 words celebrating ${player}'s hat trick against ${opponent} at WC 2026. Include where each goal ranks in terms of difficulty. Mention Golden Boot implications. High energy writing.`),
    aiWrite(`Write an email subject line (max 60 chars) for a breaking news email about ${player}'s hat trick at WC 2026. Make it incredible. Just the subject line.`, 60)
  ]);

  const affiliates = getAffiliates(primaryCountry, 'affiliate_sportsbook').slice(0, 3);

  // 1. SEO monument page
  await buildSEOPage(slug, title, analysis || '', affiliates);

  // 2-4. Twitter storm (3 tweets — one per goal)
  goals.forEach((g, i) => {
    enqueue('twitter', {
      text: `Goal ${i+1}/3: ${g.description || `${player} scores again vs ${opponent} (${g.minute}')`}\n\n#WC2026 #HatTrick`,
      thread: true, threadIndex: i, eventType: 'hat_trick', player
    });
  });

  // 5. TikTok compilation script
  enqueue('tiktok', { script: `${player} JUST GOT A HAT TRICK AT THE WORLD CUP! All 3 goals in under 60 seconds 🎩🎩🎩`, player, team, eventType: 'hat_trick', seoUrl: `/${slug}` });

  // 6. Instagram carousel
  enqueue('instagram', {
    type: 'carousel',
    slides: [
      { title: '🎩 HAT TRICK!', subtitle: `${player} makes history` },
      { title: 'Goal 1', data: goals[0] },
      { title: 'Goal 2', data: goals[1] },
      { title: 'Goal 3', data: goals[2] },
      { title: 'Golden Boot Odds', cta: sbAff?.label }
    ],
    caption: `${player} writes his name in WC 2026 history 🎩\n\nGolden Boot odds in bio 👆`,
    eventType: 'hat_trick'
  });

  // 7. Push (maximum urgency)
  buildPush(`🎩 HAT TRICK — ${player}!!!`, `${player} has scored THREE goals vs ${opponent}. Golden Boot odds shifting NOW.`, `/${slug}`, 'urgent');

  // 8. Email (emergency send)
  triggerEmail(
    ['all', 'betting', 'tips', `nation_${nationCode}`],
    (emailSubject || `🎩 ${player} HAT TRICK — you won't believe this`).slice(0, 60),
    `${analysis || `${player} just scored a hat trick!`}\n\n${buildCTA(sbAff, 'Golden Boot odds now')}`,
    sbAff?.link
  );

  // 9. WhatsApp burst to nation
  enqueue('whatsapp', {
    segments: countries,
    text: `🎩🎩🎩 HAT TRICK! ${player} scores THREE goals for ${team} vs ${opponent}!\n\nGolden Boot odds shifting — [LINK]`,
    eventType: 'hat_trick'
  });

  // 10. Merch trigger (highest priority)
  triggerMerch('hat_trick', player, nationCode, { ...eventData, priority: 'urgent' });

  // 11-15. Multi-language content burst (5 languages)
  const langBurst = ['es','pt','fr','ar','de'];
  langBurst.forEach(lang => {
    enqueue('translation-queue', { content: analysis, targetLang: lang, eventType: 'hat_trick', player, affId: sbAff?.id });
  });

  // 16. Golden Boot odds refresh
  enqueue('odds-refresh', { markets: ['golden_boot', `anytime_scorer_${player.replace(/\s+/g,'_')}`], reason: 'hat_trick', player, affId: sbAff?.id });

  // Drama bar
  fireDramaBar(`🎩 HAT TRICK: ${player} makes history at WC 2026!`, 'max', `/${slug}`);

  // Co-reg burst
  fireCoReg('hat_trick', { player, team, matchId, priority: 'urgent' });

  await dispatchToEngines('HAT_TRICK', { player, team, opponent, nationCode, matchId, homeTeam: team, awayTeam: opponent });

  console.log(`[moment-engine] 🎩 HAT TRICK: 16 actions fired for ${player}`);
  return { actions: 16, slug };
}

/**
 * ELIMINATION — 12 simultaneous actions
 * eventData: { nation, nationCode, lostTo, stage, matchId }
 */
async function onElimination(eventData) {
  const { nation, nationCode, lostTo, stage, matchId } = eventData;
  console.log(`[moment-engine] 💔 ELIMINATION: ${nation} out at ${stage}`);

  const countries = topCountriesForNation(nationCode);
  const primaryCountry = countries[0];
  const sbAff = getBestAffiliate(primaryCountry, 'affiliate_sportsbook');
  const slug = `${nation.replace(/\s+/g,'-').toLowerCase()}-eliminated-wc-2026`;
  const title = `${nation} Eliminated at WC 2026 — ${stage} | Their Journey`;

  const [tribute, consolation] = await Promise.all([
    aiWrite(`Write a 180-word emotional tribute to ${nation}'s WC 2026 campaign. They were knocked out in the ${stage} by ${lostTo}. Celebrate their journey, mention standout moments, give fans comfort.`),
    aiWrite(`Write a short 60-word "they'll be back" message for ${nation} fans after WC 2026 elimination. Warm, not preachy. End with something hopeful about 2030.`)
  ]);

  const affiliates = getAffiliates(primaryCountry, 'affiliate_sportsbook').slice(0, 3);

  // 1. Tribute SEO page
  await buildSEOPage(slug, title, tribute || '', affiliates);

  // 2. Twitter tribute thread
  enqueue('twitter', { text: `💔 ${nation} are out of WC 2026.\n\n${consolation || 'Their journey ends in the ' + stage + '. Thank you for the memories.'}\n\n🧵 Thread: Their greatest moments →`, thread: false, eventType: 'elimination', nation: nationCode });

  // 3. TikTok tribute
  enqueue('tiktok', { script: `${nation} are out of the World Cup 2026. Here's their incredible journey in 60 seconds... ${tribute?.slice(0,80) || ''}`, eventType: 'elimination', nation: nationCode });

  // 4. Instagram tribute carousel
  enqueue('instagram', { type: 'tribute_carousel', nation, nationCode, stage, lostTo, caption: `💔 ${nation} — thank you for WC 2026\n\n${consolation || ''}`, eventType: 'elimination' });

  // 5. Push to nation's subscribers
  buildPush(`💔 ${nation} eliminated`, `${nation} out at the ${stage}. Read our tribute to their incredible WC 2026 journey.`, `/${slug}`, 'normal');

  // 6. Email to nation segment
  triggerEmail(
    [`nation_${nationCode}`],
    `💔 ${nation} are out — but what a journey`,
    `${tribute || `${nation} have been eliminated at the ${stage}`}\n\n${buildCTA(sbAff, 'Bet on who wins the World Cup now')}`,
    sbAff?.link
  );

  // 7. WhatsApp to nation fans
  enqueue('whatsapp', {
    segments: countries,
    text: `💔 ${nation} are out of WC 2026 (${stage})\n\nThank you for the memories. Read our tribute: [LINK]`,
    eventType: 'elimination'
  });

  // 8. Merch trigger — "I supported X 2026" shirt
  triggerMerch('elimination', nation, nationCode, eventData);

  // 9. Survivor pool — update participants
  enqueue('survivor-pool', { action: 'elimination', nation: nationCode, matchId, stage });

  // 10. Drama bar
  fireDramaBar(`💔 ${nation} ELIMINATED — ${stage} exit vs ${lostTo}`, 'high', `/${slug}`);

  // 11. "Is your team still alive?" page update
  enqueue('viral-page-update', { page: 'is-your-team-still-alive', nation: nationCode, status: 'out', stage });

  // 12. Co-reg burst (grief traffic converts well)
  fireCoReg('elimination', { nation: nationCode, stage, matchId });

  await dispatchToEngines('ELIMINATION', { nation, nationCode, lostTo, stage, matchId, homeTeam: nation, awayTeam: lostTo });

  console.log(`[moment-engine] 💔 ELIMINATION: 12 actions fired for ${nation}`);
  return { actions: 12, slug };
}

/**
 * GIANT UPSET — 18 simultaneous actions (maximum viral event)
 * eventData: { winner, winnerCode, loser, loserCode, scoreline, stage, matchId }
 */
async function onUpset(eventData) {
  const { winner, winnerCode, loser, loserCode, scoreline, stage, matchId } = eventData;
  console.log(`[moment-engine] 🔥 UPSET: ${winner} beats ${loser} (${scoreline})`);

  const winCountries = topCountriesForNation(winnerCode);
  const loseCountries = topCountriesForNation(loserCode);
  const allCountries = [...new Set([...winCountries, ...loseCountries])];
  const sbAff = getBestAffiliate('GB', 'affiliate_sportsbook');
  const slug = `${winner.replace(/\s+/g,'-').toLowerCase()}-beats-${loser.replace(/\s+/g,'-').toLowerCase()}-wc-2026-upset`;
  const title = `${winner} Shocks ${loser} ${scoreline} — Biggest WC 2026 Upsets`;

  const [breaking, analysis, loserTribute] = await Promise.all([
    aiWrite(`Write a 50-word breaking news style tweet about ${winner} beating ${loser} ${scoreline} in the ${stage} of WC 2026. Maximum shock energy.`, 80),
    aiWrite(`Write 150 words on how ${winner} pulled off the upset against ${loser} at WC 2026. Tactical reasons, key moments, what ${loser} got wrong. High energy.`),
    aiWrite(`Write 80 words consoling ${loser} fans after being knocked out by ${winner}. Acknowledge the pain, give context, don't be dismissive.`)
  ]);

  const affiliates = getAffiliates('GB', 'affiliate_sportsbook').slice(0, 3);

  // 1. Breaking tweet
  enqueue('twitter', { text: breaking || `🚨 SHOCK RESULT: ${winner} beats ${loser} ${scoreline}! #WC2026 #Upset`, urgent: true, eventType: 'upset' });

  // 2. Full analysis thread (5 tweets)
  const tweetThread = analysis?.split('. ').reduce((acc, s, i) => { acc[Math.floor(i/2)] = (acc[Math.floor(i/2)] || '') + s + '. '; return acc; }, []) || [];
  tweetThread.slice(0,4).forEach((t, i) => enqueue('twitter', { text: t.trim(), thread: true, threadIndex: i+1, eventType: 'upset' }));

  // 3. SEO monument page (+ "Greatest WC 2026 upsets" page update)
  await buildSEOPage(slug, title, analysis || '', affiliates);
  enqueue('seo-page-update', { page: 'greatest-wc-2026-upsets', add: { winner, loser, scoreline, stage, slug } });

  // 4. TikTok reaction script
  enqueue('tiktok', { script: `NOBODY saw this coming... ${winner} just beat ${loser} ${scoreline} at the World Cup 2026! Here's how it happened 🔥`, eventType: 'upset' });

  // 5. Instagram (celebration for winner fans)
  enqueue('instagram', { type: 'breaking_graphic', winner, loser, scoreline, stage, caption: `🔥 SHOCK RESULT: ${winner} ${scoreline} ${loser}\n\nBiggest upset of WC 2026?\n\nLink in bio for full analysis 👆`, eventType: 'upset' });

  // 6. Push — maximum urgency
  buildPush(`🔥 SHOCK RESULT!`, `${winner} just beat ${loser} ${scoreline}! This is massive.`, `/${slug}`, 'urgent');

  // 7. Email (emergency — all segments)
  triggerEmail(
    ['all', 'betting', 'tips'],
    `🔥 ${winner} just shocked the world — new tournament favourites?`,
    `${analysis || ''}\n\n${buildCTA(sbAff, 'Updated winner odds — get the value')}`,
    sbAff?.link
  );

  // 8. WhatsApp — winner nation celebration
  enqueue('whatsapp', { segments: winCountries, text: `🔥🔥🔥 ${winner} BEATS ${loser} ${scoreline}!\n\nHISTORICAL! Full analysis: [LINK]`, eventType: 'upset' });

  // 9. WhatsApp — loser nation tribute
  enqueue('whatsapp', { segments: loseCountries, text: `💔 ${loser} eliminated by ${winner}\n\n${loserTribute || 'It\'s not what we wanted, but what a tournament it\'s been'}\n\nFull tribute: [LINK]`, eventType: 'upset' });

  // 10. Merch — winner celebration
  triggerMerch('upset', winner, winnerCode, { ...eventData, priority: 'urgent' });

  // 11. Telegram drama post
  enqueue('telegram', { channel: 'free', text: `🔥 SHOCK: ${winner} beats ${loser} ${scoreline}\n\nBig money was on ${loser}. New winner odds in premium 👇`, eventType: 'upset' });

  // 12. Telegram premium — odds shift analysis
  enqueue('telegram', { channel: 'premium', text: `🔥 UPSET ANALYSIS [PREMIUM]\n\n${analysis || ''}\n\nUpdated tournament winner odds:\n${buildCTA(sbAff, 'Best odds now')}`, eventType: 'upset' });

  // 13. Odds refresh (tournament winner market)
  enqueue('odds-refresh', { markets: ['tournament_winner', 'next_eliminated'], reason: 'upset', affId: sbAff?.id });

  // 14. Reddit posts (maximum engagement for upsets)
  enqueue('reddit', {
    subreddits: ['soccer', 'worldcup2026', `r_${winner.replace(/\s+/g,'')}`, `r_${loser.replace(/\s+/g,'')}`],
    title: `[Match Thread] ${winner} ${scoreline} ${loser} — Biggest upset of WC 2026?`,
    body: analysis || '',
    eventType: 'upset'
  });

  // 15. Drama bar — MAX
  fireDramaBar(`🔥 GIANT UPSET: ${winner} ${scoreline} ${loser} — WC 2026 in shock!`, 'max', `/${slug}`);

  // 16. Survivor pool update
  enqueue('survivor-pool', { action: 'upset', loser: loserCode, winner: winnerCode, matchId });

  // 17. B2B media pitch — data story
  enqueue('b2b-pitch', { type: 'upset_data', winner, loser, scoreline, stage, analysis, mediaTargets: ['BBCSport', 'SkySports', 'ESPN', 'TNT'] });

  // 18. Co-reg burst — highest spike
  fireCoReg('upset', { winner, loser, matchId, priority: 'max' });

  await dispatchToEngines('UPSET', { winner, winnerCode, loser, loserCode, scoreline, stage, matchId, homeTeam: winner, awayTeam: loser, result: 'home_win' });

  console.log(`[moment-engine] 🔥 UPSET: 18 actions fired`);
  return { actions: 18, slug };
}

/**
 * STAR INJURY — 9 actions
 * eventData: { player, team, nationCode, bodyPart, severity, matchId }
 */
async function onInjury(eventData) {
  const { player, team, nationCode, bodyPart, severity = 'unknown', matchId } = eventData;
  console.log(`[moment-engine] 🏥 INJURY: ${player} (${team}) — ${bodyPart || 'unknown'}`);

  const countries = topCountriesForNation(nationCode);
  const sbAff = getBestAffiliate(countries[0], 'affiliate_sportsbook');
  const slug = `${player.replace(/\s+/g,'-').toLowerCase()}-injury-wc-2026-${Date.now()}`;
  const title = `${player} Injury WC 2026 — Latest Update & Return Timeline`;

  const analysis = await aiWrite(`Write 100 words on ${player}'s injury (${bodyPart || 'unknown area'}) at WC 2026. Discuss likely severity, impact on ${team}, whether they'll play again in the tournament. Include a realistic return timeline range.`);

  const affiliates = getAffiliates(countries[0], 'affiliate_sportsbook').slice(0, 2);

  // 1. SEO page (monitors for "latest update" searches)
  await buildSEOPage(slug, title, analysis || '', affiliates);

  // 2. Twitter update thread
  enqueue('twitter', { text: `🏥 INJURY UPDATE: ${player} down for ${team}.\n\nBodyPart: ${bodyPart || 'Unknown'} | Severity: ${severity}\n\nFull analysis and timeline → [LINK]`, eventType: 'injury', player });

  // 3. Fantasy alert (critical — DFS/FPL users need to act NOW)
  enqueue('telegram', { channel: 'premium', text: `🏥 FANTASY ALERT: ${player} injured!\n\n⚠️ Drop/transfer recommendation:\n${analysis || ''}\n\nBest replacement options: [LINK]`, eventType: 'injury', priority: 'urgent' });

  // 4. Push
  buildPush(`🏥 ${player} injured`, `${player} injury update for ${team}. Get the latest timeline and replacement picks.`, `/${slug}`, 'high');

  // 5. Email (fantasy + tips segments)
  triggerEmail(['fantasy', 'tips', `nation_${nationCode}`], `🏥 BREAKING: ${player} injury — what it means`, `${analysis || ''}\n\n${buildCTA(sbAff, 'Updated odds now')}`, sbAff?.link);

  // 6. Odds refresh (team outright + match result)
  enqueue('odds-refresh', { markets: [`match_result_${matchId}`, 'tournament_winner'], reason: 'star_injury', player, team, affId: sbAff?.id });

  // 7. SEO cluster queued (all injury-related queries)
  enqueue('seo-cluster', { seed: `${player} injury`, queries: [`${player} injury update`, `${player} return date`, `${player} wc 2026 fitness`, `${team} injury news`], slug });

  // 8. fatigue-model prediction queued
  enqueue('data-analysis', { type: 'injury_prediction_accuracy', player, bodyPart, matchId, publishResult: true });

  // 9. Drama bar
  fireDramaBar(`🏥 INJURY: ${player} (${team}) — severity unknown, monitoring live`, 'medium', `/${slug}`);

  await dispatchToEngines('INJURY', { player, team, nationCode, bodyPart, severity, matchId, homeTeam: team });

  console.log(`[moment-engine] 🏥 INJURY: 9 actions fired for ${player}`);
  return { actions: 9, slug };
}

/**
 * VAR DECISION — 10 actions
 */
async function onVAR(eventData) {
  const { decision, player, team, referee, reason, matchId, nationCode } = eventData;
  console.log(`[moment-engine] 📺 VAR: ${decision} — ${reason}`);

  const countries = topCountriesForNation(nationCode || 'GB');
  const sbAff = getBestAffiliate(countries[0], 'affiliate_sportsbook');
  const slug = `var-decision-wc-2026-${matchId || Date.now()}`;
  const title = `VAR Decision WC 2026 — What VAR Actually Saw | ${decision}`;

  const analysis = await aiWrite(`Write 120 words explaining what the VAR officials saw when reviewing ${reason} in this WC 2026 match (${team}). Why did they ${decision}? Include the technical details VAR uses (goal line tech, offside millimetres, etc.) and whether it was the right call.`);

  const affiliates = getAffiliates(countries[0], 'affiliate_sportsbook').slice(0, 2);
  await buildSEOPage(slug, title, analysis || '', affiliates);

  enqueue('twitter', { text: `📺 VAR UPDATE: Decision — ${decision}\nReason: ${reason}\n\n"What VAR Actually Saw" thread below 👇`, thread: false, eventType: 'var' });
  enqueue('tiktok', { script: `Here's EXACTLY what the VAR officials were looking at when they made this controversial call... ${analysis?.slice(0,80) || ''}`, eventType: 'var' });
  enqueue('referee-db', { referee, action: 'var_decision', decision, reason, matchId });
  fireDramaBar(`📺 VAR: ${decision} — ${reason} | Controversy rising`, 'high', `/${slug}`);
  enqueue('twitter', { text: `Was VAR right to ${decision.toLowerCase()}?\n\nFull breakdown: [LINK]`, type: 'poll', options: ['Yes, correct decision', 'No, wrong call', 'Too close to call'], eventType: 'var' });
  enqueue('telegram', { channel: 'free', text: `📺 VAR DRAMA: ${decision}!\n\n${reason}\n\nFull breakdown in premium 👇`, eventType: 'var' });
  enqueue('email', { segment: ['betting', 'tips'], subject: `📺 VAR just changed everything — new value bet`, body: `${analysis || ''}\n\n${buildCTA(sbAff, 'Updated odds post-VAR')}`, priority: 'urgent' });
  enqueue('odds-refresh', { markets: [`match_result_${matchId}`], reason: 'var_decision', affId: sbAff?.id });
  fireCoReg('var', { decision, matchId });
  buildPush(`📺 VAR: ${decision}`, `${reason} — here's what the officials actually saw.`, `/${slug}`, 'high');

  await dispatchToEngines('VAR', { decision, player, team, referee, reason, matchId, nationCode, homeTeam: team });

  console.log(`[moment-engine] 📺 VAR: 10 actions fired`);
  return { actions: 10, slug };
}

/**
 * RECORD BROKEN — 13 actions
 */
async function onRecord(eventData) {
  const { player, nationCode, recordType, previousHolder, matchId } = eventData;
  console.log(`[moment-engine] 📊 RECORD: ${player} — ${recordType}`);

  const countries = topCountriesForNation(nationCode);
  const sbAff = getBestAffiliate(countries[0], 'affiliate_sportsbook');
  const slug = `${player.replace(/\s+/g,'-').toLowerCase()}-${recordType.replace(/\s+/g,'-').toLowerCase()}-wc-2026-record`;
  const title = `${player} Breaks ${recordType} Record at WC 2026 — History Made`;

  const [monument, emailBody] = await Promise.all([
    aiWrite(`Write 200 words on ${player} breaking the ${recordType} record at WC 2026 (previously held by ${previousHolder || 'unknown'}). Include full historical context, what this means for their legacy, comparisons to all-time greats.`),
    aiWrite(`Write an exciting 80-word email opener for breaking news about ${player} breaking the ${recordType} record at WC 2026. Make it feel like witnessing history.`)
  ]);

  const affiliates = getAffiliates(countries[0], 'affiliate_sportsbook').slice(0, 3);
  await buildSEOPage(slug, title, monument || '', affiliates);

  enqueue('twitter', { text: `📊 HISTORY: ${player} just broke the ${recordType} record at WC 2026!\n\nPreviously: ${previousHolder || 'unknown'}\n\nFull historical context 🧵`, thread: false, eventType: 'record', player });
  enqueue('tiktok', { script: `${player} just made HISTORY at WC 2026 by breaking the ${recordType} record! Here's why this moment is so special... ${monument?.slice(0,80) || ''}`, player, eventType: 'record' });
  enqueue('instagram', { type: 'record_graphic', player, recordType, previousHolder, caption: `📊 History made. ${player} breaks the ${recordType} record.\n\nFull story in bio link 👆`, eventType: 'record' });
  buildPush(`📊 HISTORY: ${player} breaks ${recordType} record!`, `${player} makes WC 2026 history. Read the full story →`, `/${slug}`, 'high');
  triggerEmail(['all', `nation_${nationCode}`], `📊 History: ${player} just broke the record`, `${emailBody || monument || ''}\n\n${buildCTA(sbAff, 'Golden Boot odds now')}`, sbAff?.link);
  enqueue('whatsapp', { segments: countries, text: `📊 HISTORY: ${player} breaks ${recordType} record at WC 2026!\n\nFull story: [LINK]`, eventType: 'record' });
  triggerMerch('record', player, nationCode, eventData);
  enqueue('telegram', { channel: 'premium', text: `📊 RECORD BROKEN [PREMIUM]\n\n${monument || ''}\n\n${buildCTA(sbAff, 'Golden Boot odds')}`, eventType: 'record' });
  enqueue('b2b-pitch', { type: 'record_data', player, recordType, previousHolder, monument, mediaTargets: ['BBCSport', 'ESPN', 'SkySports'] });
  enqueue('odds-refresh', { markets: ['golden_boot', 'golden_glove', 'player_of_tournament'], reason: 'record_broken', player, affId: sbAff?.id });
  fireDramaBar(`📊 RECORD: ${player} breaks ${recordType}! History at WC 2026!`, 'high', `/${slug}`);
  fireCoReg('record', { player, recordType, matchId });
  enqueue('seo-page-update', { page: 'wc-2026-records', add: { player, recordType, previousHolder, slug } });

  await dispatchToEngines('RECORD', { player, nationCode, recordType, previousHolder, matchId, homeTeam: player });

  console.log(`[moment-engine] 📊 RECORD: 13 actions fired for ${player}`);
  return { actions: 13, slug };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MomentEngine class — plugs into integration-hub EventEmitter ─────────────
// ═══════════════════════════════════════════════════════════════════════════════
class MomentEngine {
  constructor(hub) {
    this.hub = hub;
    this.stats = { goal: 0, red_card: 0, hat_trick: 0, elimination: 0, upset: 0, injury: 0, var: 0, record: 0 };
    this._attachListeners();
    console.log('[moment-engine] ✅ Attached to integration hub — all events monitored');
  }

  _attachListeners() {
    const wrap = (type, fn) => async (data) => {
      try {
        const result = await fn(data);
        this.stats[type]++;
        if (this.hub) this.hub.emit('MOMENT_FIRED', { type, data, result, timestamp: new Date().toISOString() });
      } catch (e) {
        console.error(`[moment-engine] Error in ${type} handler:`, e.message);
      }
    };

    if (this.hub) {
      this.hub.on('GOAL',        wrap('goal',        onGoal));
      this.hub.on('RED_CARD',    wrap('red_card',    onRedCard));
      this.hub.on('HAT_TRICK',   wrap('hat_trick',   onHatTrick));
      this.hub.on('ELIMINATION', wrap('elimination', onElimination));
      this.hub.on('UPSET',       wrap('upset',       onUpset));
      this.hub.on('INJURY',      wrap('injury',      onInjury));
      this.hub.on('VAR',         wrap('var',         onVAR));
      this.hub.on('RECORD',      wrap('record',      onRecord));
    }
  }

  // Manual trigger for testing
  async fire(eventType, data) {
    const handlers = { goal: onGoal, red_card: onRedCard, hat_trick: onHatTrick, elimination: onElimination, upset: onUpset, injury: onInjury, var: onVAR, record: onRecord };
    const fn = handlers[eventType];
    if (!fn) throw new Error(`Unknown event type: ${eventType}`);
    return fn(data);
  }

  getStats() {
    return {
      ...this.stats,
      total: Object.values(this.stats).reduce((a,b) => a+b, 0)
    };
  }

  getDispatchLog() {
    return dispatchLog;
  }

  getEngineUrls() {
    return ENGINE_URLS;
  }
}

module.exports = { MomentEngine, onGoal, onRedCard, onHatTrick, onElimination, onUpset, onInjury, onVAR, onRecord, dispatchToEngines, ENGINE_URLS, dispatchLog };

// ─── HTTP server (Railway requires /health; also exposes /trigger for pipeline) ─
if (!process.env.MOMENT_HTTP_DISABLED) {
  const express  = require('express');
  const httpApp  = express();
  httpApp.use(express.json());
  const MOMENT_PORT = process.env.MOMENT_PORT || process.env.PORT || 3001;

  httpApp.get('/health', (_req, res) => res.json({ ok: true, service: 'moment-engine', uptime: process.uptime() }));
  httpApp.get('/status', (_req, res) => res.json({ ok: true, service: 'moment-engine', engines: Object.keys(ENGINE_URLS).length, uptime: process.uptime(), ts: Date.now() }));

  // POST /trigger — data-pipeline fires this on live match events
  httpApp.post('/trigger', async (req, res) => {
    const { type, data } = req.body || {};
    const handlers = { GOAL: onGoal, RED_CARD: onRedCard, HAT_TRICK: onHatTrick, ELIMINATION: onElimination, UPSET: onUpset, INJURY: onInjury, VAR: onVAR, RECORD: onRecord };
    const fn = handlers[type];
    if (!fn) return res.status(400).json({ ok: false, error: `Unknown event type: ${type}` });
    try {
      const result = await fn(data || {});
      res.json({ ok: true, type, result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  httpApp.listen(MOMENT_PORT, () => console.log(`[Moment Engine] HTTP server on :${MOMENT_PORT}`));
}

// ─── CLI test mode (only when --test flag passed; not triggered in Railway deploy) ──
if (require.main === module && process.argv.includes('--test')) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              MOMENT ENGINE — TEST FIRE                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('Testing GOAL event for Mbappé...\n');

  onGoal({
    player: 'Kylian Mbappé',
    team: 'France',
    opponent: 'England',
    nationCode: 'FRA',
    minute: 67,
    xG: 0.42,
    matchId: 'test-001'
  }).then(r => {
    console.log('\n✅ Result:', r);
    console.log('\nQueues written. Check /queues/ directory.');
    console.log('SEO page written. Check /seo-pages/ directory.');
    console.log('\nFull test: node moment-engine.js');
  }).catch(console.error);
}
