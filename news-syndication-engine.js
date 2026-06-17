/**
 * WC 2026 Sports Empire — News Syndication Engine
 * Deploy on Railway.app as service "news-syndication-engine"
 *
 * Syndicates match content to:
 *   - Apple News (Apple News Format JSON — 125M readers)
 *   - Google News (sitemap ping — 800M+ readers)
 *   - Flipboard (RSS + API — 100M users)
 *   - SmartNews (RSS — 50M users)
 *   - Microsoft Start (RSS feed — 75M users)
 *   - Feedly (RSS — 14M users, surfaces automatically via RSS)
 *   - Pocket / Instapaper (via RSS)
 *
 * Apple News API requires publisher approval (apply at news.apple.com/publisher)
 * All others work immediately via RSS feed + sitemap ping.
 *
 * Required env vars:
 *   VERCEL_URL            — your main site URL e.g. https://wc2026live.vercel.app
 *   APPLE_NEWS_CHANNEL_ID — from Apple News Publisher
 *   APPLE_NEWS_API_KEY    — from Apple News Publisher
 *   APPLE_NEWS_API_SECRET — from Apple News Publisher
 *   API_SERVER_URL        — for fetching match data + AI analysis
 *   GROQ_API_KEY          — for article body generation
 *   PIPELINE_SECRET       — shared inter-service secret
 *
 * Endpoints:
 *   GET  /rss             — main RSS feed (submit to Flipboard, SmartNews, MSN)
 *   GET  /rss/goals       — goal-only breaking news feed
 *   POST /publish/article — publish article to all channels
 *   POST /publish/goal    — publish goal alert
 *   POST /trigger         — moment-engine webhook
 *   GET  /sitemap-news    — Google News sitemap XML
 *   GET  /status          — health
 */

'use strict';

require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const axios  = require('axios');
const express = require('express');
const cron    = require('node-cron');

const VERCEL_URL       = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const APPLE_CHANNEL_ID = process.env.APPLE_NEWS_CHANNEL_ID || '';
const APPLE_API_KEY    = process.env.APPLE_NEWS_API_KEY    || '';
const APPLE_API_SECRET = process.env.APPLE_NEWS_API_SECRET || '';
const API_SERVER_URL   = process.env.API_SERVER_URL        || 'http://localhost:3001';
const PIPELINE_SECRET  = process.env.PIPELINE_SECRET       || '';

const ARTICLES_FILE = path.join(__dirname, 'syndicated-articles.json');

// ─── Article store ────────────────────────────────────────────────────────────

function loadArticles() {
  if (!fs.existsSync(ARTICLES_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf8')); } catch { return []; }
}

function saveArticles(articles) {
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2));
}

function addArticle(article) {
  const articles = loadArticles();
  articles.unshift(article);
  saveArticles(articles.slice(0, 100)); // keep last 100
}

// ─── Article generation via Groq ──────────────────────────────────────────────

async function generateArticle(type, data) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

  
  let prompt;
  let title;
  let keywords;

  if (type === 'MATCH_PREVIEW') {
    const { homeTeam, awayTeam, kickoff, venue, prediction } = data;
    const time = new Date(kickoff).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    title = `${homeTeam} vs ${awayTeam} — WC 2026 Preview, Predictions & Kick-off Time`;
    keywords = ['WC 2026', 'World Cup 2026', homeTeam, awayTeam, 'preview', 'prediction'];
    const predStr = prediction
      ? `AI model gives ${homeTeam} a ${prediction.homeWinPct}% chance, draw ${prediction.drawPct}%, ${awayTeam} ${prediction.awayWinPct}%.`
      : '';
    prompt = `Write a 300-word match preview article for ${homeTeam} vs ${awayTeam} at the 2026 FIFA World Cup. Kick-off: ${time} UTC, Venue: ${venue || 'TBD'}. ${predStr}
Include: head-to-head context, key players to watch, what's at stake in the tournament.
Format: professional sports news style with 3-4 short paragraphs. No subheadings. No markdown.`;
  } else if (type === 'GOAL_ALERT') {
    const { homeTeam, awayTeam, homeScore, awayScore, minute, player, team } = data;
    title = `GOAL! ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} — WC 2026`;
    keywords = ['WC 2026', 'World Cup 2026', homeTeam, awayTeam, 'goal', 'live'];
    prompt = `Write a 100-word breaking news article about: ${player || 'A player'} scores for ${team} — ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} in the ${minute}th minute at WC 2026.
Professional sports news style. 2 short paragraphs. No markdown.`;
  } else if (type === 'MATCH_RESULT') {
    const { homeTeam, awayTeam, homeScore, awayScore, result } = data;
    const winner = result === 'home_win' ? homeTeam : result === 'away_win' ? awayTeam : null;
    title = `${homeTeam} ${homeScore}-${awayScore} ${awayTeam} — WC 2026 Full Time Result`;
    keywords = ['WC 2026', 'World Cup 2026', homeTeam, awayTeam, 'result', 'full time'];
    prompt = `Write a 200-word match report for: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} at the 2026 FIFA World Cup.${winner ? ` ${winner} win.` : ' Match ends in a draw.'}
Professional sports news report. 3 paragraphs: result summary, key moments, tournament implications. No markdown.`;
  }

  const body = await groqClient.complete({ engine: 'news-syndication-engine', eventType, messages: [{ role: 'user', content: prompt }], max_tokens: 600, temperature: 0.6 }) || '';
  return { title, body, keywords };
}

// ─── Apple News API ───────────────────────────────────────────────────────────

function appleNewsAuth(method, url, body = '') {
  const date    = new Date().toISOString();
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const hash    = bodyStr ? crypto.createHash('sha256').update(bodyStr, 'utf8').digest('base64') : '';
  const msg     = `${method}${url}${date}application/json${hash}`;
  const sig     = crypto.createHmac('sha256', Buffer.from(APPLE_API_SECRET, 'base64')).update(msg).digest('base64');
  return {
    Authorization:   `HHMAC; key=${APPLE_API_KEY}; signature=${sig}; date=${date}`,
    'Content-Type':  'application/json'
  };
}

async function publishToAppleNews(title, body, keywords) {
  if (!APPLE_CHANNEL_ID || !APPLE_API_KEY || !APPLE_API_SECRET) {
    console.log('[Apple News] not configured — skipping');
    return null;
  }

  const url = `https://news-api.apple.com/channels/${APPLE_CHANNEL_ID}/articles`;

  // Apple News Format (ANF) document
  const anf = {
    version:      '1.9',
    identifier:   `wc2026-${Date.now()}`,
    title,
    language:     'en',
    layout:       { columns: 7, width: 1024, gutter: 20, margin: 60 },
    componentTextStyles: {
      default: { fontName: 'Helvetica Neue', fontSize: 16, lineHeight: 24, textColor: '#1a1a1a' },
      title:   { fontName: 'Helvetica Neue', fontSize: 36, lineHeight: 44, fontWeight: 700 }
    },
    components: [
      { role: 'title', text: title, textStyle: 'title' },
      { role: 'body',  text: body,  textStyle: 'default', format: 'markdown' }
    ],
    metadata: {
      authors:  ['WC 2026 Live'],
      keywords: keywords || [],
      excerpt:  body.slice(0, 200)
    }
  };

  const headers = appleNewsAuth('POST', url, anf);
  const r = await axios.post(url, anf, { headers, timeout: 20000 });
  console.log(`[Apple News] published: ${r.data?.data?.id}`);
  return r.data?.data?.id;
}

// ─── Google News sitemap ping ─────────────────────────────────────────────────

async function pingGoogleNews() {
  const sitemapUrl = encodeURIComponent(`${VERCEL_URL}/sitemap-news.xml`);
  try {
    await axios.get(`https://www.google.com/ping?sitemap=${sitemapUrl}`, { timeout: 10000 });
    console.log('[Google News] sitemap pinged');
  } catch (e) {
    // Google ping often returns 200 empty — not an error
    console.log('[Google News] sitemap ping sent');
  }
}

// ─── RSS feed ─────────────────────────────────────────────────────────────────

function buildRSS(articles, feedTitle, feedDesc) {
  const escXML = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const items = articles.slice(0, 50).map(a => `
    <item>
      <title>${escXML(a.title)}</title>
      <description>${escXML(a.body?.slice(0, 300))}...</description>
      <link>${VERCEL_URL}/articles/${a.slug}</link>
      <guid isPermaLink="false">${a.guid}</guid>
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
      <author>news@wc2026live.com (${escXML(a.author || 'WC 2026 Live')})</author>
      ${(a.keywords || []).map(k => `<category>${escXML(k)}</category>`).join('\n      ')}
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escXML(feedTitle || 'WC 2026 Live — Latest News')}</title>
    <description>${escXML(feedDesc || '2026 FIFA World Cup news, goals, match reports and AI predictions.')}</description>
    <link>${VERCEL_URL}</link>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${VERCEL_URL}/rss" rel="self" type="application/rss+xml"/>
    <image>
      <url>${VERCEL_URL}/logo.png</url>
      <title>WC 2026 Live</title>
      <link>${VERCEL_URL}</link>
    </image>
    ${items}
  </channel>
</rss>`;
}

// ─── Google News sitemap ──────────────────────────────────────────────────────

function buildGoogleNewsSitemap(articles) {
  const escXML = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const recent = articles.filter(a => Date.now() - new Date(a.publishedAt).getTime() < 2 * 24 * 60 * 60 * 1000); // 48h

  const urls = recent.map(a => `
  <url>
    <loc>${VERCEL_URL}/articles/${a.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>WC 2026 Live</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(a.publishedAt).toISOString()}</news:publication_date>
      <news:title>${escXML(a.title)}</news:title>
      <news:keywords>${escXML((a.keywords || []).join(', '))}</news:keywords>
    </news:news>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  ${urls}
</urlset>`;
}

// ─── Orchestrate publication ──────────────────────────────────────────────────

async function publishArticle(type, data) {
  const { title, body, keywords } = await generateArticle(type, data);

  const slug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) + '-' + Date.now();

  const article = {
    guid:        `wc2026-${Date.now()}`,
    slug,
    title,
    body,
    keywords,
    type,
    publishedAt: new Date().toISOString(),
    author:      'WC 2026 Live'
  };

  addArticle(article);

  // Publish to Apple News
  const appleId = await publishToAppleNews(title, body, keywords).catch(e => {
    console.error('[Apple News] failed:', e.message);
    return null;
  });

  // Ping Google News sitemap
  pingGoogleNews().catch(() => {});

  console.log(`[Syndication] article published: "${title.slice(0, 50)}"`);

  return { ...article, appleNewsId: appleId };
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

// Submit THIS URL to: Flipboard Partner Program, SmartNews Publisher, Microsoft Start
app.get('/rss', (req, res) => {
  const articles = loadArticles();
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=900');
  res.send(buildRSS(articles, 'WC 2026 Live — Latest News', '2026 FIFA World Cup news, goals, match reports and AI predictions.'));
});

app.get('/rss/goals', (req, res) => {
  const articles = loadArticles().filter(a => a.type === 'GOAL_ALERT');
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(buildRSS(articles, 'WC 2026 Live — Goal Alerts', 'Live goal alerts from the 2026 FIFA World Cup.'));
});

// Google News sitemap — add this URL to Google Search Console
app.get('/sitemap-news', (req, res) => {
  const articles = loadArticles();
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(buildGoogleNewsSitemap(articles));
});

// moment-engine webhook
app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  try {
    let type;
    if (['GOAL', 'PENALTY_GOAL', 'OWN_GOAL'].includes(eventType)) type = 'GOAL_ALERT';
    else if (eventType === 'MATCH_END') type = 'MATCH_RESULT';
    else return res.json({ ok: true, skipped: true, reason: `${eventType} not newsworthy` });

    const result = await publishArticle(type, data);
    res.json({ ok: true, slug: result.slug, title: result.title });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/publish/article', auth, async (req, res) => {
  try {
    const { type, data } = req.body;
    if (!type || !data) return res.status(400).json({ ok: false, error: 'type and data required' });
    const result = await publishArticle(type, data);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/publish/previews', auth, async (req, res) => {
  try {
    const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/today`, { timeout: 15000 });
    const matches = r.data?.matches || r.data?.response || [];
    const published = [];

    for (const m of matches) {
      const homeTeam = m.teams?.home?.name || m.homeTeam;
      const awayTeam = m.teams?.away?.name || m.awayTeam;
      const kickoff  = m.fixture?.date || m.kickoff;
      const venue    = m.fixture?.venue?.name || m.venue;
      if (!homeTeam || !awayTeam) continue;

      const result = await publishArticle('MATCH_PREVIEW', { homeTeam, awayTeam, kickoff, venue });
      published.push(result.slug);
      await new Promise(r => setTimeout(r, 5000)); // stagger
    }

    res.json({ ok: true, count: published.length, slugs: published });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/articles', (req, res) => {
  const articles = loadArticles();
  res.json({ ok: true, count: articles.length, articles: articles.slice(0, 20) });
});

app.get('/status', (req, res) => {
  const articles = loadArticles();
  res.json({
    ok:             true,
    service:        'news-syndication-engine',
    articlesTotal:  articles.length,
    appleNewsConfigured: !!(APPLE_CHANNEL_ID && APPLE_API_KEY && APPLE_API_SECRET),
    rssUrl:         `${VERCEL_URL}/rss`,
    googleNewsSitemap: `${VERCEL_URL}/sitemap-news`,
    submitTo: {
      flipboard:     'https://flipboard.com/publisher/',
      smartnews:     'https://publishers.smartnews.com',
      microsoftStart: 'https://www.msn.com/en-us/news/contactus',
      appleNews:     'https://news.apple.com/publisher'
    }
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.NEWS_PORT || process.env.PORT || 3009;
  app.listen(PORT, () => console.log(`[News Syndication Engine] listening on :${PORT}`));

  // Daily match preview articles at 08:00 UTC
  cron.schedule('0 8 * * *', async () => {
    console.log('[Syndication] publishing daily match previews');
    try {
      const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/today`, { timeout: 15000 });
      const matches = r.data?.matches || r.data?.response || [];
      for (const m of matches) {
        const homeTeam = m.teams?.home?.name || m.homeTeam;
        const awayTeam = m.teams?.away?.name || m.awayTeam;
        if (!homeTeam || !awayTeam) continue;
        await publishArticle('MATCH_PREVIEW', {
          homeTeam, awayTeam,
          kickoff: m.fixture?.date,
          venue:   m.fixture?.venue?.name
        });
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error('[Syndication] daily preview failed:', e.message);
    }
  });

  console.log(`[News Syndication Engine] running
  RSS:     ${VERCEL_URL}/rss
  Sitemap: ${VERCEL_URL}/sitemap-news
  Articles: daily previews 08:00 UTC + goal alerts via /trigger
  Apple News: ${APPLE_CHANNEL_ID ? 'configured' : 'not configured (apply at news.apple.com/publisher)'}
  `);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
