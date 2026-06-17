/**
 * WC 2026 Sports Empire — News Monitor
 * Deploy on Railway.app as service "news-monitor"
 *
 * Polls major sports RSS feeds every 10 minutes for WC 2026 breaking news.
 * When a relevant article is found, rewrites it via Groq then fires to
 * ALL platform engines simultaneously.
 *
 * Sources monitored:
 *   - BBC Sport Football RSS
 *   - ESPN FC RSS
 *   - Sky Sports Football RSS
 *   - FIFA.com News RSS
 *   - Goal.com RSS
 *   - The Guardian Football RSS
 *   - AS (Spanish) RSS
 *   - L'Equipe (French) RSS
 *   - Marca RSS
 *
 * Required env vars:
 *   GROQ_API_KEY              — for article rewriting
 *   PIPELINE_SECRET           — shared inter-service secret
 *   API_SERVER_URL            — world-engine / api-server base
 *   BLUESKY_ENGINE_URL        — bluesky-engine.js Railway URL
 *   MASTODON_ENGINE_URL       — mastodon-engine.js Railway URL
 *   TELEGRAM_BOT_TOKEN        — bot token
 *   TELEGRAM_CHANNEL_ID       — @yourchannel
 *   NEWS_SYNDICATION_URL      — news-syndication-engine.js Railway URL
 *   COMMENTARY_ENGINE_URL     — commentary-live-engine.js Railway URL
 *   VERCEL_URL                — main site URL
 *
 * Endpoints:
 *   GET  /feed                — latest fetched articles with relevance scores
 *   GET  /log                 — recently published rewrites
 *   POST /check-now           — immediate poll (admin)
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const PIPELINE_SECRET     = process.env.PIPELINE_SECRET        || '';
const VERCEL_URL          = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const TG_BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN     || '';
const TG_CHANNEL_ID       = process.env.TELEGRAM_CHANNEL_ID    || '';
const BLUESKY_URL         = (process.env.BLUESKY_ENGINE_URL    || 'http://localhost:3006').replace(/\/$/, '');
const MASTODON_URL        = (process.env.MASTODON_ENGINE_URL   || 'http://localhost:3007').replace(/\/$/, '');
const NEWS_SYND_URL       = (process.env.NEWS_SYNDICATION_URL  || 'http://localhost:3009').replace(/\/$/, '');
const COMMENTARY_URL      = (process.env.COMMENTARY_ENGINE_URL || 'http://localhost:3018').replace(/\/$/, '');

// ─── RSS feed sources ─────────────────────────────────────────────────────────

const FEEDS = [
  { name: 'BBC Sport',    url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', lang: 'en' },
  { name: 'ESPN FC',      url: 'https://www.espn.com/espn/rss/soccer/news',       lang: 'en' },
  { name: 'Sky Sports',   url: 'https://www.skysports.com/rss/12040',             lang: 'en' },
  { name: 'FIFA News',    url: 'https://www.fifa.com/newsrss/index.html',         lang: 'en' },
  { name: 'Goal.com',     url: 'https://www.goal.com/feeds/en/news',              lang: 'en' },
  { name: 'Guardian',     url: 'https://www.theguardian.com/football/rss',        lang: 'en' },
  { name: 'Marca',        url: 'https://www.marca.com/en/rss/other/soccer.html',  lang: 'es' },
  { name: 'L\'Equipe',    url: 'https://www.lequipe.fr/rss/actu_rss_Football.xml', lang: 'fr' },
  { name: 'AS',           url: 'https://en.as.com/rss/soccer.xml',               lang: 'es' },
];

// WC2026 relevance keywords
const WC_KEYWORDS = [
  'world cup 2026', 'wc2026', 'wc 2026', 'copa mundo 2026', 'coupe du monde 2026',
  'fifa 2026', '2026 world cup', '2026 fifa', 'mundial 2026',
  // Team names (expand as needed)
  'brazil', 'argentina', 'france', 'england', 'germany', 'spain', 'portugal',
  'netherlands', 'italy', 'usa', 'canada', 'mexico', 'morocco', 'japan',
  'south korea', 'senegal', 'nigeria', 'australia', 'saudi arabia'
];

// Track seen article URLs to avoid re-publishing
const seenUrls    = new Set();
const publishLog  = []; // ring buffer
let totalPublished = 0;

// ─── Simple RSS parser (no external dep needed) ───────────────────────────────

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get   = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, 'i')) ||
                block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };

    const title   = get('title');
    const link    = get('link') || block.match(/<link[^>]*\s+href="([^"]+)"/)?.[1] || '';
    const desc    = get('description') || get('summary');
    const pubDate = get('pubDate') || get('published') || get('dc:date') || '';

    if (title && link) items.push({ title, link, desc, pubDate });
  }

  return items;
}

function isWC2026Relevant(item) {
  const text = `${item.title} ${item.desc}`.toLowerCase();
  return WC_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
}

function relevanceScore(item) {
  const text = `${item.title} ${item.desc}`.toLowerCase();
  let score  = 0;
  for (const kw of WC_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) score++;
  }
  // Boost for direct WC2026 mentions
  if (text.includes('world cup 2026') || text.includes('wc2026')) score += 3;
  return score;
}

// ─── Groq rewriter ────────────────────────────────────────────────────────────

async function rewriteArticle(item, language = 'en') {
  if (!process.env.GROQ_API_KEY) return item.title; // fallback: just use headline

  
  const langInstructions = {
    en: 'Write in English.',
    es: 'Write in English (original source was Spanish).',
    fr: 'Write in English (original source was French).'
  };

  const prompt = `You are a social media editor covering the 2026 FIFA World Cup.

Rewrite this football news headline/summary for social media:

HEADLINE: ${item.title}
SUMMARY: ${(item.desc || '').replace(/<[^>]+>/g, '').slice(0, 500)}
SOURCE: ${item.link}

${langInstructions[language] || langInstructions.en}

Write a punchy, engaging social media post (max 250 characters):
- Start with a relevant emoji
- Include the key fact from the headline
- Add urgency/interest
- Do NOT add hashtags (added separately)
- Do NOT include links (added separately)

Just the text, nothing else.`;

  const result = await groqClient.complete({ engine: 'news-monitor', eventType: 'BREAKING_NEWS', messages: [{ role: 'user', content: prompt }], max_tokens: 120, temperature: 0.6 });
  return result || item.title;
}

// ─── Publish to all platforms ─────────────────────────────────────────────────

async function publishBreakingNews(item, rewritten, source) {
  const tags     = ['WC2026', 'WorldCup2026', 'BreakingNews', 'Football'];
  const hashStr  = tags.map(t => `#${t}`).join(' ');
  const withLink = `${rewritten}\n\n🔗 ${item.link}\n\n${hashStr}`;
  const tgText   = `📰 <b>WC 2026 News</b> — <i>${source}</i>\n\n${rewritten}\n\n🔗 ${item.link}\n\n${hashStr}`;

  const results = {};

  // Telegram
  if (TG_BOT_TOKEN && TG_CHANNEL_ID) {
    try {
      await axios.post(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
        { chat_id: TG_CHANNEL_ID, text: tgText, parse_mode: 'HTML' },
        { timeout: 10000 });
      results.telegram = { ok: true };
    } catch (e) { results.telegram = { ok: false, error: e.message }; }
  }

  // Bluesky
  try {
    const r = await axios.post(`${BLUESKY_URL}/post`,
      { text: withLink.slice(0, 300), tags, links: [{ url: item.link, text: 'Read more' }] },
      { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 20000 });
    results.bluesky = { ok: true, uri: r.data?.uri };
  } catch (e) { results.bluesky = { ok: false, error: e.message }; }

  // Mastodon
  try {
    const r = await axios.post(`${MASTODON_URL}/toot`,
      { status: withLink.slice(0, 500) },
      { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 20000 });
    results.mastodon = { ok: true, id: r.data?.id };
  } catch (e) { results.mastodon = { ok: false, error: e.message }; }

  // News Syndication (Apple News / Google News)
  try {
    await axios.post(`${NEWS_SYND_URL}/trigger`,
      { eventType: 'BREAKING_NEWS', title: item.title, body: rewritten, sourceUrl: item.link },
      { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 20000 });
    results.newsSyndication = { ok: true };
  } catch (e) { results.newsSyndication = { ok: false, error: e.message }; }

  return results;
}

// ─── Main poll cycle ──────────────────────────────────────────────────────────

async function pollFeeds() {
  console.log('[NewsMonitor] polling feeds...');
  let newArticles = 0;

  for (const feed of FEEDS) {
    try {
      const r   = await axios.get(feed.url, {
        timeout: 15000,
        headers: { 'User-Agent': 'WC2026NewsBot/1.0 (+https://wc2026live.vercel.app)' }
      });
      const items = parseRSSItems(r.data);
      const relevant = items
        .filter(i => isWC2026Relevant(i) && !seenUrls.has(i.link))
        .sort((a, b) => relevanceScore(b) - relevanceScore(a))
        .slice(0, 3); // max 3 per feed per cycle

      for (const item of relevant) {
        seenUrls.add(item.link);
        // Limit seenUrls size
        if (seenUrls.size > 5000) {
          const first = seenUrls.values().next().value;
          seenUrls.delete(first);
        }

        console.log(`[NewsMonitor] relevant: "${item.title.slice(0, 60)}" from ${feed.name}`);

        const rewritten = await rewriteArticle(item, feed.lang);
        const results   = await publishBreakingNews(item, rewritten, feed.name);

        totalPublished++;
        newArticles++;

        publishLog.unshift({
          timestamp:  new Date().toISOString(),
          source:     feed.name,
          headline:   item.title,
          rewritten,
          link:       item.link,
          relevance:  relevanceScore(item),
          results
        });
        if (publishLog.length > 500) publishLog.length = 500;

        // Rate limit — wait 5s between articles
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error(`[NewsMonitor] feed error ${feed.name}:`, e.message);
    }

    // 2s between feeds
    await new Promise(r => setTimeout(r, 2000));
  }

  if (newArticles) console.log(`[NewsMonitor] cycle complete — published ${newArticles} articles`);
  else console.log('[NewsMonitor] cycle complete — no new relevant articles');
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

app.get('/feed', (req, res) => {
  res.json({
    ok:      true,
    sources: FEEDS.map(f => f.name),
    log:     publishLog.slice(0, 20),
    seenCount: seenUrls.size
  });
});

app.get('/log', (req, res) => {
  res.json({ ok: true, count: publishLog.length, total: totalPublished, log: publishLog.slice(0, 50) });
});

app.post('/check-now', auth, async (req, res) => {
  pollFeeds().catch(e => console.error('[Poll]', e.message));
  res.json({ ok: true, message: 'polling started' });
});

app.get('/status', (req, res) => {
  res.json({
    ok:              true,
    service:         'news-monitor',
    feeds:           FEEDS.length,
    feedNames:       FEEDS.map(f => f.name),
    totalPublished,
    seenUrls:        seenUrls.size,
    groqConfigured:  !!process.env.GROQ_API_KEY,
    telegramConfigured: !!(TG_BOT_TOKEN && TG_CHANNEL_ID),
    schedule:        'Every 10 minutes',
    keywords:        WC_KEYWORDS.length
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.NEWS_MONITOR_PORT || process.env.PORT || 3019;
  app.listen(PORT, () => console.log(`[News Monitor] listening on :${PORT}`));

  if (!process.env.GROQ_API_KEY) console.warn('[NewsMonitor] GROQ_API_KEY not set — using raw headlines');

  // Initial poll 30s after boot
  setTimeout(pollFeeds, 30000);

  // Poll every 10 minutes
  cron.schedule('*/10 * * * *', pollFeeds);

  console.log(`[News Monitor] watching ${FEEDS.length} RSS feeds — polling every 10 min`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
