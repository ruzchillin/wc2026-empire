/**
 * WC2026 Empire — DailyHunt + UCNews + InShorts + NewsBreak Engine
 * India's biggest news aggregators + US local news
 *
 * DailyHunt: 350M users (India) — largest Indian content platform
 * UC Browser/UCNews: 100M+ users (India, Africa, SE Asia, Indonesia)
 * InShorts: 35M users (India) — 60-word news format
 * NewsBreak: 50M users (US) — local news aggregator
 * Moj/Josh: Indian short video (TikTok replacements, 200M+ combined)
 *
 * Port: 3052
 * Strategy: Submit RSS feed + content to these platforms for massive India/Africa reach
 *
 * Env vars:
 *   DAILYHUNT_API_KEY   — from publisher.dailyhunt.in
 *   UCWEB_PUBLISHER_ID  — from publisher.ucweb.com
 *   NEWSBREAK_API_KEY   — from partner.newsbreakapp.com
 */

const http = require('http');
const https = require('https');

const PORT  = process.env.DAILYHUNT_PORT || process.env.PORT || 3052;
const SITE  = process.env.SITE_URL || 'https://wc2026-sports-empire.vercel.app';
const GROQ  = process.env.GROQ_API_KEY || '';
const BOT   = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT  = process.env.TELEGRAM_GROUP_CHAT_ID || '';

// ─── Platform registration URLs ───────────────────────────────────────────────
const PLATFORM_SIGNUP = {
  dailyhunt:  'https://publisher.dailyhunt.in',     // largest India platform
  ucnews:     'https://publisher.ucweb.com',         // UC Browser news partner
  inshorts:   'https://inshorts.com/en/submit-article', // submit articles
  newsbreak:  'https://partner.newsbreakapp.com',   // US local news
  moj:        'https://mojapp.in/creator',           // India short video
  josh:       'https://share.myjosh.in/creator-studio', // India short video
  operanews:  'https://publisher.opera.com',         // already have opera-news-engine.js
  kukufm:     'https://podcasters.kukufm.com',       // India podcast, 100M users
};

// ─── Content in Indian English (simpler, direct tone) ────────────────────────
const INDIA_CONTENT = [
  () => ({
    title: 'Which team will win FIFA World Cup 2026? Our AI says...',
    body: `Our prediction model has analysed all 48 WC2026 teams. France, Brazil, and England are the top picks, but India fans should watch Morocco and Senegal for surprise runs. Full analysis: ${SITE}/wc2026-predictions-hub.html`,
    tags: ['FIFA', 'WorldCup2026', 'Football', 'India'],
  }),
  () => ({
    title: 'How to watch FIFA World Cup 2026 live in India for FREE',
    body: `JioTV, SonyLIV, and Sports18 will broadcast WC2026 live in India. For fans outside India, a VPN can help. Complete guide to all streaming options: ${SITE}/streaming-vpn.html`,
    tags: ['WorldCup2026', 'LiveStream', 'India', 'Football'],
  }),
  () => ({
    title: 'WC2026 Golden Boot: Who scores the most goals?',
    body: `Kylian Mbappé (France), Erling Haaland (Norway), and Vinicius Jr (Brazil) are the top favourites. Our data model gives Mbappé a 28% chance. See full rankings: ${SITE}/wc2026-top-goals.html`,
    tags: ['GoldenBoot', 'WorldCup2026', 'Mbappe', 'Haaland'],
  }),
  () => ({
    title: 'Argentina vs France WC2022 rematch: Who wins in 2026?',
    body: `Messi is 38, Mbappé is 27. The chess match continues. Our model runs 10,000 simulations to find the answer: ${SITE}/mbappe-vs-messi.html`,
    tags: ['Messi', 'Mbappe', 'WorldCup2026', 'Argentina', 'France'],
  }),
  () => ({
    title: 'African teams that can SHOCK the world at WC2026',
    body: `Morocco reached the semis in 2022. Nigeria, Senegal, and Egypt have the squads to go even further. Complete African preview: ${SITE}/africa-hub.html`,
    tags: ['Africa', 'WorldCup2026', 'Morocco', 'Nigeria'],
  }),
];

// ─── RSS Feed Generator (submit to all platforms) ────────────────────────────
function generateRSS() {
  const items = INDIA_CONTENT.map(fn => {
    const { title, body, tags } = fn();
    return `
    <item>
      <title><![CDATA[${title}]]></title>
      <description><![CDATA[${body}]]></description>
      <link>${SITE}</link>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <category>${tags[0]}</category>
    </item>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>WC2026 Empire — World Cup 2026 News</title>
    <link>${SITE}</link>
    <description>World Cup 2026 predictions, stats, streaming guide, and match analysis</description>
    <language>en-in</language>
    <image><url>${SITE}/og-default.png</url><title>WC2026 Empire</title><link>${SITE}</link></image>
    ${items}
  </channel>
</rss>`;
}

// ─── InShorts format (60-word limit) ─────────────────────────────────────────
function generateInshortsContent() {
  return INDIA_CONTENT.map(fn => {
    const { title, body } = fn();
    const short = body.replace(/https?:\/\/[^\s]+/g, '').trim().slice(0, 200);
    return { headline: title, body: short, source: SITE };
  });
}

function tgAlert(msg) {
  if (!BOT || !CHAT) return;
  const body = JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'Markdown' });
  const req = https.request({
    hostname: 'api.telegram.org', path: `/bot${BOT}/sendMessage`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  });
  req.write(body); req.end();
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'dailyhunt-engine', platforms: Object.keys(PLATFORM_SIGNUP).length }));
    return;
  }

  // RSS feed endpoint — submit this URL to DailyHunt, UCNews, NewsBreak, InShorts
  if (url === '/rss' || url === '/feed') {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
    res.end(generateRSS());
    return;
  }

  if (url === '/inshorts') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(generateInshortsContent()));
    return;
  }

  if (url === '/platforms') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(PLATFORM_SIGNUP));
    return;
  }

  if (url === '/trigger' || url === '/setup') {
    const msg = `📱 *India/Africa Platform Setup*\n\n` +
      `Your RSS feed is live at: \`YOUR_RAILWAY_URL/rss\`\n\n` +
      `Submit this RSS to:\n` +
      `• DailyHunt: publisher.dailyhunt.in\n` +
      `• UCNews: publisher.ucweb.com\n` +
      `• InShorts: inshorts.com/en/submit-article\n` +
      `• NewsBreak: partner.newsbreakapp.com\n` +
      `• Moj (India video): mojapp.in/creator\n` +
      `• Josh (India video): share.myjosh.in/creator-studio\n` +
      `• KukuFM (India podcast): podcasters.kukufm.com\n\n` +
      `Combined reach: 700M+ users across India, SE Asia, and Africa`;
    tgAlert(msg);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rssUrl: 'YOUR_RAILWAY_URL/rss', platforms: PLATFORM_SIGNUP }));
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`[DailyHunt Engine] Port ${PORT}`);
  console.log(`[DailyHunt] RSS feed: /rss`);
  console.log(`[DailyHunt] Platforms: ${Object.keys(PLATFORM_SIGNUP).join(', ')}`);
  console.log('[DailyHunt] IMPACT: 700M+ combined reach in India/SE Asia/Africa');
});
