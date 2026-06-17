/**
 * WC 2026 Sports Empire — Translation Processor
 * Deploy on Railway.app as service "translation-processor"
 *
 * Translates WC 2026 content into 10 languages using Groq (Llama3-70b),
 * then routes each translation to the correct platform engine.
 *
 * Language → Platform routing:
 *   es (Spanish)    → Bluesky (international) + Mastodon + Reddit r/soccer_es
 *   pt (Portuguese) → Bluesky + Mastodon + Reddit r/futebol
 *   fr (French)     → Bluesky + Mastodon + Reddit r/football
 *   ar (Arabic)     → Snapchat engine (huge in MENA WC2026 markets)
 *   de (German)     → Bluesky + Mastodon
 *   hi (Hindi)      → ShareChat engine (350M users in India)
 *   id (Indonesian) → Bluesky + Mastodon (large football market)
 *   sw (Swahili)    → Mastodon + Africa's Talking SMS
 *   tr (Turkish)    → Bluesky + Mastodon
 *   ko (Korean)     → Naver engine (South Korea's dominant social platform)
 *   ja (Japanese)   → Bluesky + Mastodon
 *   zh (Chinese)    → Mastodon (Weibo blocked in most markets, skip for now)
 *
 * Why this matters:
 *   WC 2026 is in USA/Canada/Mexico — massive Spanish/Portuguese audience.
 *   Arabic coverage is near-zero from English accounts.
 *   Hindi/ShareChat = ~350M users who currently get NO WC 2026 live content.
 *   This positions us as the only multilingual real-time WC 2026 source on most platforms.
 *
 * Required env vars:
 *   GROQ_API_KEY            — Groq API key (free 500K tokens/day)
 *   PIPELINE_SECRET         — shared inter-service secret
 *   BLUESKY_ENGINE_URL      — bluesky-engine.js Railway URL
 *   MASTODON_ENGINE_URL     — mastodon-engine.js Railway URL
 *   SNAPCHAT_ENGINE_URL     — snapchat-engine.js Railway URL
 *   SHARECHAT_ENGINE_URL    — sharechat-engine.js Railway URL
 *   NAVER_ENGINE_URL        — naver-engine.js Railway URL
 *   REDDIT_BOT_URL          — reddit-bot.js Railway URL
 *   FACEBOOK_ENGINE_URL     — facebook-engine.js Railway URL (for Spanish FB groups)
 *   AT_API_KEY              — Africa's Talking SMS key (for Swahili)
 *   AT_USERNAME             — Africa's Talking username
 *
 * Port: 3026
 *
 * Endpoints:
 *   POST /translate         — translate and dispatch { text, targetLanguages, eventType, metadata }
 *   POST /trigger           — moment-engine webhook (auto-translates all events)
 *   GET  /log
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const express = require('express');
const axios   = require('axios');

const PIPELINE_SECRET = process.env.PIPELINE_SECRET        || '';
const BLUESKY_URL     = (process.env.BLUESKY_ENGINE_URL    || 'http://localhost:3006').replace(/\/$/, '');
const MASTODON_URL    = (process.env.MASTODON_ENGINE_URL   || 'http://localhost:3007').replace(/\/$/, '');
const SNAPCHAT_URL    = (process.env.SNAPCHAT_ENGINE_URL   || 'http://localhost:3010').replace(/\/$/, '');
const SHARECHAT_URL   = (process.env.SHARECHAT_ENGINE_URL  || 'http://localhost:3012').replace(/\/$/, '');
const NAVER_URL       = (process.env.NAVER_ENGINE_URL      || 'http://localhost:3011').replace(/\/$/, '');
const REDDIT_URL      = (process.env.REDDIT_BOT_URL        || 'http://localhost:3023').replace(/\/$/, '');
const FACEBOOK_URL    = (process.env.FACEBOOK_ENGINE_URL   || 'http://localhost:3021').replace(/\/$/, '');
const AT_API_KEY      = process.env.AT_API_KEY             || '';
const AT_USERNAME     = process.env.AT_USERNAME            || 'sandbox';

// Default target languages for match events
const DEFAULT_LANGUAGES = ['es', 'pt', 'ar', 'fr', 'hi', 'ko'];
// Extended set for major events (GOAL, HAT_TRICK, UPSET)
const EXTENDED_LANGUAGES = ['es', 'pt', 'ar', 'fr', 'de', 'hi', 'id', 'tr', 'ko', 'sw'];

const translationLog = [];
let translated = 0;
let dispatched = 0;

// ─── Language metadata ────────────────────────────────────────────────────────

const LANG_META = {
  es: { name: 'Spanish',    emoji: '🇪🇸', platforms: ['bluesky', 'mastodon', 'facebook'] },
  pt: { name: 'Portuguese', emoji: '🇧🇷', platforms: ['bluesky', 'mastodon'] },
  ar: { name: 'Arabic',     emoji: '🇸🇦', platforms: ['snapchat'], rtl: true },
  fr: { name: 'French',     emoji: '🇫🇷', platforms: ['bluesky', 'mastodon'] },
  de: { name: 'German',     emoji: '🇩🇪', platforms: ['bluesky', 'mastodon'] },
  hi: { name: 'Hindi',      emoji: '🇮🇳', platforms: ['sharechat'] },
  id: { name: 'Indonesian', emoji: '🇮🇩', platforms: ['bluesky', 'mastodon'] },
  sw: { name: 'Swahili',    emoji: '🌍',  platforms: ['mastodon', 'sms'] },
  tr: { name: 'Turkish',    emoji: '🇹🇷', platforms: ['bluesky', 'mastodon'] },
  ko: { name: 'Korean',     emoji: '🇰🇷', platforms: ['naver'] },
  ja: { name: 'Japanese',   emoji: '🇯🇵', platforms: ['bluesky', 'mastodon'] },
  zh: { name: 'Chinese',    emoji: '🇨🇳', platforms: ['mastodon'] }
};

// Subreddits per language
const LANG_SUBREDDITS = {
  es: 'soccer_es',
  pt: 'futebol',
  fr: 'football'
};

// ─── Groq translation ─────────────────────────────────────────────────────────

async function translateText(text, targetLang) {
  if (!process.env.GROQ_API_KEY) return null;

  const langName = LANG_META[targetLang]?.name || targetLang;
  
  const prompt = `Translate this football/soccer social media post about the 2026 FIFA World Cup into ${langName}.

RULES:
- Keep ALL emojis exactly as they are
- Translate ONLY the text, never team names, player names, or scores
- Keep the same tone and energy
- Keep hashtags in English (e.g., #WC2026)
- Maximum 280 characters in the translation
- For Arabic: use Modern Standard Arabic (فصحى)
- Output ONLY the translated text, nothing else

TEXT TO TRANSLATE:
${text}`;

  try {
    const result = await groqClient.complete({ engine: 'translation-processor', eventType: 'TRANSLATION', messages: [{ role: 'user', content: prompt }], max_tokens: 150, temperature: 0.3 });
    if (result) translated++;
    return result || null;
  } catch (e) {
    console.error(`[Translation] Groq error for ${targetLang}:`, e.message);
    return null;
  }
}

// ─── Platform dispatchers ─────────────────────────────────────────────────────

const authHeaders = (secret) => ({
  'Content-Type': 'application/json',
  'x-pipeline-secret': secret || PIPELINE_SECRET
});

async function dispatchToBluesky(text, lang, tags, eventData) {
  const allTags = ['WC2026', 'WorldCup2026', ...(tags || [])];
  try {
    await axios.post(`${BLUESKY_URL}/post`,
      { text: text.slice(0, 300), tags: allTags, lang },
      { headers: authHeaders(), timeout: 20000 });
    dispatched++;
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function dispatchToMastodon(text, lang) {
  try {
    await axios.post(`${MASTODON_URL}/toot`,
      { status: text.slice(0, 500), language: lang },
      { headers: authHeaders(), timeout: 20000 });
    dispatched++;
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function dispatchToSnapchat(text, eventData) {
  // Arabic content → Snapchat (huge in Saudi/UAE/Morocco)
  try {
    await axios.post(`${SNAPCHAT_URL}/trigger`,
      { eventType: eventData.eventType || 'GOAL', text, ...eventData },
      { headers: authHeaders(), timeout: 20000 });
    dispatched++;
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function dispatchToShareChat(text, eventData) {
  // Hindi content → ShareChat (India)
  try {
    await axios.post(`${SHARECHAT_URL}/trigger`,
      { eventType: eventData.eventType || 'GOAL', text, ...eventData },
      { headers: authHeaders(), timeout: 20000 });
    dispatched++;
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function dispatchToNaver(text, eventData) {
  // Korean content → Naver (South Korea's #1 social platform)
  try {
    await axios.post(`${NAVER_URL}/trigger`,
      { eventType: eventData.eventType || 'GOAL', text, ...eventData },
      { headers: authHeaders(), timeout: 20000 });
    dispatched++;
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function dispatchToFacebook(text, eventData) {
  // Spanish Facebook posts
  try {
    await axios.post(`${FACEBOOK_URL}/post/facebook`,
      { message: text },
      { headers: authHeaders(), timeout: 20000 });
    dispatched++;
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function dispatchSMS(text, eventData) {
  // Swahili SMS to East Africa (via Africa's Talking)
  if (!AT_API_KEY) return { ok: false, error: 'AT_API_KEY not configured' };
  // For SMS, we'd need recipient numbers — this is more of a broadcast channel
  // In practice, use AT's premium SMS shortcode for subscribers who opted in
  console.log(`[Translation/SMS] Swahili text ready: ${text.slice(0, 80)}...`);
  dispatched++;
  return { ok: true, note: 'SMS requires subscriber list — logged for AT batch send' };
}

async function dispatchToReddit(text, lang, subreddit, eventData) {
  if (!LANG_SUBREDDITS[lang]) return { ok: false, error: 'no subreddit for this language' };
  try {
    await axios.post(`${REDDIT_URL}/post`,
      { subreddit: subreddit || LANG_SUBREDDITS[lang], title: text.slice(0, 300), text },
      { headers: authHeaders(), timeout: 30000 });
    dispatched++;
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ─── Main translation + dispatch flow ────────────────────────────────────────

async function translateAndDispatch(englishText, targetLanguages, eventType, eventData = {}) {
  const results = {};
  const metaPayload = { eventType, ...eventData };

  // Translate all languages in parallel
  const translations = await Promise.all(
    targetLanguages.map(async lang => {
      const translated = await translateText(englishText, lang);
      return { lang, text: translated };
    })
  );

  // Dispatch each translation to its target platforms
  for (const { lang, text } of translations) {
    if (!text) { results[lang] = { ok: false, error: 'translation failed' }; continue; }

    const meta = LANG_META[lang];
    if (!meta) { results[lang] = { ok: false, error: 'unknown language' }; continue; }

    const langResults = {};
    const dispatchTasks = meta.platforms.map(async platform => {
      try {
        switch (platform) {
          case 'bluesky':    langResults.bluesky    = await dispatchToBluesky(text, lang, [], metaPayload); break;
          case 'mastodon':   langResults.mastodon   = await dispatchToMastodon(text, lang); break;
          case 'snapchat':   langResults.snapchat   = await dispatchToSnapchat(text, metaPayload); break;
          case 'sharechat':  langResults.sharechat  = await dispatchToShareChat(text, metaPayload); break;
          case 'naver':      langResults.naver      = await dispatchToNaver(text, metaPayload); break;
          case 'facebook':   langResults.facebook   = await dispatchToFacebook(text, metaPayload); break;
          case 'sms':        langResults.sms        = await dispatchSMS(text, metaPayload); break;
        }
      } catch (e) { langResults[platform] = { ok: false, error: e.message }; }
    });

    // Also dispatch to language-specific Reddit if applicable
    if (LANG_SUBREDDITS[lang] && ['MATCH_END', 'UPSET'].includes(eventType)) {
      dispatchTasks.push(
        dispatchToReddit(text, lang, null, metaPayload).then(r => langResults.reddit = r)
      );
    }

    await Promise.allSettled(dispatchTasks);
    results[lang] = { ok: true, translation: text.slice(0, 100), platforms: langResults };
    console.log(`[Translation] ${meta.emoji} ${lang} → ${Object.keys(langResults).join(', ')}`);
  }

  translationLog.unshift({
    eventType,
    originalText: englishText.slice(0, 100),
    languages:    targetLanguages,
    results,
    timestamp:    new Date().toISOString()
  });
  if (translationLog.length > 300) translationLog.length = 300;

  return results;
}

// ─── Auto-generate English text from event data ───────────────────────────────

function buildEnglishText(eventType, data) {
  const VERCEL_URL = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
  const map = {
    GOAL:         `⚽ GOAL! ${data.player||''} scores for ${data.homeTeam||''}! ${data.homeScore??0}-${data.awayScore??0} vs ${data.awayTeam||''} (${data.minute||''}') | WC 2026 Live: ${VERCEL_URL}`,
    PENALTY_GOAL: `⚽ PENALTY! ${data.player||''} converts for ${data.homeTeam||''}! ${data.homeScore??0}-${data.awayScore??0} | WC 2026: ${VERCEL_URL}`,
    HAT_TRICK:    `🎩🎩🎩 HAT TRICK! ${data.player||''} scores three goals at WC 2026! ${data.homeTeam||''} ${data.homeScore??0}-${data.awayScore??0} ${data.awayTeam||''} | ${VERCEL_URL}`,
    RED_CARD:     `🟥 RED CARD! ${data.player||'A player'} sent off (${data.minute||''}') | ${data.homeTeam||''} vs ${data.awayTeam||''} | WC 2026: ${VERCEL_URL}`,
    MATCH_END:    `🏁 FULL TIME: ${data.homeTeam||''} ${data.homeScore??0}-${data.awayScore??0} ${data.awayTeam||''} | WC 2026 Final Result | ${VERCEL_URL}`,
    UPSET:        `🔥 UPSET! ${data.homeTeam||''} beats ${data.awayTeam||''} at WC 2026! What a result! | ${VERCEL_URL}`,
    ELIMINATION:  `💔 ${data.eliminatedTeam||data.awayTeam||''} are eliminated from WC 2026. Their tournament is over. | ${VERCEL_URL}`,
    PRE_MATCH:    `📅 MATCH PREVIEW: ${data.homeTeam||''} vs ${data.awayTeam||''} at WC 2026 | ${VERCEL_URL}`
  };
  return map[eventType] || `⚽ WC 2026 Live: ${data.homeTeam||''} vs ${data.awayTeam||''} | ${VERCEL_URL}`;
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.post('/translate', auth, async (req, res) => {
  const { text, targetLanguages = DEFAULT_LANGUAGES, eventType = 'UPDATE', ...metadata } = req.body;
  if (!text) return res.status(400).json({ ok: false, error: 'text required' });

  // Fire async, respond immediately
  translateAndDispatch(text, targetLanguages, eventType, metadata)
    .catch(e => console.error('[Translation]', e.message));

  res.json({ ok: true, message: 'translation started', languages: targetLanguages });
});

app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  const handled = ['GOAL','PENALTY_GOAL','HAT_TRICK','RED_CARD','MATCH_END','UPSET','ELIMINATION','PRE_MATCH'];
  if (!handled.includes(eventType)) return res.json({ ok: true, skipped: true });

  const englishText = buildEnglishText(eventType, data);
  // Use extended language set for high-impact events
  const langs = ['GOAL','HAT_TRICK','UPSET'].includes(eventType) ? EXTENDED_LANGUAGES : DEFAULT_LANGUAGES;

  translateAndDispatch(englishText, langs, eventType, data)
    .catch(e => console.error('[Translation trigger]', e.message));

  res.json({ ok: true, eventType, languages: langs, text: englishText.slice(0, 80) });
});

app.get('/log', (req, res) => {
  res.json({ ok: true, translated, dispatched, count: translationLog.length, log: translationLog.slice(0, 20) });
});

app.get('/status', (req, res) => {
  res.json({
    ok:            true,
    service:       'translation-processor',
    groqConfigured: !!process.env.GROQ_API_KEY,
    translated,
    dispatched,
    languages:     Object.entries(LANG_META).map(([code, m]) => ({ code, name: m.name, platforms: m.platforms })),
    defaultLangs:  DEFAULT_LANGUAGES,
    extendedLangs: EXTENDED_LANGUAGES
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function boot() {
  const PORT = process.env.TRANSLATION_PORT || process.env.PORT || 3026;
  app.listen(PORT, () => console.log(`[Translation Processor] listening on :${PORT}`));

  if (!process.env.GROQ_API_KEY) console.warn('[Translation] GROQ_API_KEY not set — translations will fail');

  console.log(`[Translation Processor] running on :${PORT}`);
  console.log(`[Translation] Languages: ${Object.keys(LANG_META).join(', ')}`);
  console.log(`[Translation] Platforms: Bluesky, Mastodon, Snapchat, ShareChat, Naver, Facebook, Reddit, SMS`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
