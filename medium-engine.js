/**
 * medium-engine.js
 * Medium Publication auto-posting via Medium API
 *
 * Medium: 100M+ monthly readers. Auto-publishes match analysis articles.
 * Each article = backlinks to your site + direct traffic + follower growth.
 *
 * Required env:
 *   MEDIUM_INTEGRATION_TOKEN — from medium.com/me/settings > Integration token
 *   MEDIUM_PUBLICATION_ID    — optional, publish to your publication vs personal blog
 *
 * Port: 3042
 */
'use strict';
require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const groqClient = require('./groq-client');

const MEDIUM_TOKEN   = process.env.MEDIUM_INTEGRATION_TOKEN || '';
const PUB_ID         = process.env.MEDIUM_PUBLICATION_ID   || '';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET        || '';
const PORT           = process.env.MEDIUM_ENGINE_PORT || process.env.PORT || 3042;
const SITE_URL       = process.env.SITE_URL || 'https://wc2026picks.com';

const MEDIUM_API = 'https://api.medium.com/v1';
const postLog    = [];

const app = express();
app.use(express.json());
function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const t = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && t !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

function mediumHeaders() {
  return { Authorization: `Bearer ${MEDIUM_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

async function getMediumUserId() {
  const res = await axios.get(`${MEDIUM_API}/me`, { headers: mediumHeaders(), timeout: 8000 });
  return res.data.data.id;
}

async function publishArticle({ title, content, tags = [], canonicalUrl }) {
  if (!MEDIUM_TOKEN) throw new Error('MEDIUM_INTEGRATION_TOKEN not configured');
  const userId = await getMediumUserId();
  const endpoint = PUB_ID
    ? `${MEDIUM_API}/publications/${PUB_ID}/posts`
    : `${MEDIUM_API}/users/${userId}/posts`;

  const body = {
    title,
    contentFormat: 'html',
    content,
    tags: tags.slice(0, 5),
    publishStatus: 'public',
    ...(canonicalUrl ? { canonicalUrl } : {}),
  };
  const res = await axios.post(endpoint, body, { headers: mediumHeaders(), timeout: 15000 });
  return res.data.data;
}

async function generateArticle(eventType, payload) {
  const { homeTeam, awayTeam, homeScore, awayScore, player, minute } = payload;
  const matchStr = homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : 'WC 2026 Match';
  const scoreStr = homeScore != null ? `${homeScore}-${awayScore}` : '';

  const prompts = {
    MATCH_END: `Write a 400-word match report for Medium article: "${matchStr} ${scoreStr} — WC 2026 Full Time". 
      Include: tactical analysis, standout performers, what it means for tournament progression. 
      End with a call-to-action linking to predictions at ${SITE_URL}/prediction-game.html.
      Format as HTML with <h2> subheadings.`,
    HAT_TRICK: `Write a 300-word celebration article for Medium: "${player||'Player'} Hat-Trick: ${matchStr} WC 2026".
      Cover: goals description, historical context, player profile, tournament impact.
      Include link to ${SITE_URL}/squad-tracker.html.
      HTML format with <h2> subheadings.`,
    UPSET: `Write a 350-word shock result analysis for Medium: "${matchStr} — The Biggest WC 2026 Upset Yet?".
      Cover: what went wrong, tactical breakdown, historical comparable upsets, knockout implications.
      HTML format.`,
    ELIMINATION: `Write a 300-word elimination article: "${payload.team||awayTeam} Exit WC 2026 — What Went Wrong?".
      Cover: tournament review, key moments, star player performances, legacy.
      HTML format.`,
  };

  const prompt = prompts[eventType] || `Write a 300-word WC 2026 match update for Medium about: ${eventType} - ${matchStr}. HTML format.`;

  try {
    return await groqClient.complete({
      engine: 'medium-engine', eventType,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600, temperature: 0.75,
    }) || `<p>WC 2026: ${matchStr} ${scoreStr}</p>`;
  } catch {
    return `<p>WC 2026 Update: ${matchStr} ${scoreStr}</p><p><a href="${SITE_URL}">Get predictions →</a></p>`;
  }
}

app.post('/trigger', async (req, res) => {
  const { eventType, ...payload } = req.body || {};
  const ARTICLE_EVENTS = ['MATCH_END', 'HAT_TRICK', 'UPSET', 'ELIMINATION'];
  if (!ARTICLE_EVENTS.includes(eventType)) {
    return res.json({ ok: true, service: 'medium-engine', action: 'skipped', reason: `${eventType} doesn't warrant a Medium article` });
  }
  try {
    const { homeTeam, awayTeam, homeScore, awayScore, player } = payload;
    const titleMap = {
      MATCH_END:   `${homeTeam} ${homeScore}-${awayScore} ${awayTeam} — WC 2026 Full Time Report`,
      HAT_TRICK:   `${player||'Player'} Hat-Trick: ${homeTeam} vs ${awayTeam} | WC 2026`,
      UPSET:       `SHOCK: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} — WC 2026 Biggest Upset`,
      ELIMINATION: `${payload.team||awayTeam} Eliminated: WC 2026 Exit Analysis`,
    };
    const title   = titleMap[eventType] || `WC 2026: ${eventType}`;
    const content = await generateArticle(eventType, payload);
    const tags    = ['worldcup', 'soccer', 'football', 'WC2026', homeTeam||'sports'].filter(Boolean);
    const canonicalUrl = `${SITE_URL}/head-to-head.html`;
    const article = await publishArticle({ title, content, tags, canonicalUrl });
    postLog.unshift({ eventType, title, url: article.url, timestamp: new Date().toISOString() });
    if (postLog.length > 50) postLog.length = 50;
    console.log(`[Medium] Published: ${article.url}`);
    res.json({ ok: true, service: 'medium-engine', url: article.url, title });
  } catch(e) {
    console.error('[Medium] publish failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/log',    (req, res) => res.json({ ok: true, articles: postLog }));
app.get('/status', (req, res) => res.json({ ok: true, service: 'medium-engine', configured: !!MEDIUM_TOKEN, articlesPublished: postLog.length }));
app.get('/health', (req, res) => res.json({ ok: true }));
app.listen(PORT, () => {
  console.log(`[Medium Engine] listening on :${PORT}`);
  if (!MEDIUM_TOKEN) console.warn('[Medium] MEDIUM_INTEGRATION_TOKEN not set — get from medium.com/me/settings');
});
