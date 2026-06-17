// ===========================================
// WC2026 AUTOMATED CONTENT PREVIEW ENGINE
// ===========================================
// Fetches every upcoming WC match, generates AI content in 5 languages,
// and publishes to WordPress, Beehiiv, Buffer, Telegram, and Discord.
//
// DEPLOY: Push to Railway.app (free) — it runs on cron automatically.
// SETUP:  Copy .env.example to .env, fill in your API keys.
// RUN:    node preview-engine.js
// ===========================================

require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');

// ─── CONFIG (reads from .env) ───────────────────────────────────────────────
const C = {
  apiFootball: {
    key:    process.env.API_FOOTBALL_KEY,
    base:   'https://v3.football.api-sports.io',
    league: 1,       // FIFA World Cup
    season: 2026,
  },
  oddsApi: {
    key:   process.env.ODDS_API_KEY,
    base:  'https://api.the-odds-api.com/v4',
    sport: 'soccer_fifa_world_cup',
  },
  groq: {
    key:   process.env.GROQ_API_KEY,
    model: 'llama3-70b-8192',
  },
  wordpress: {
    url:  process.env.WORDPRESS_URL,   // e.g. https://yoursite.com
    user: process.env.WORDPRESS_USER,
    pass: process.env.WORDPRESS_PASS,
  },
  beehiiv: {
    key:   process.env.BEEHIIV_KEY,
    pubId: process.env.BEEHIIV_PUB_ID,
  },
  buffer: {
    token:      process.env.BUFFER_TOKEN,
    profileIds: (process.env.BUFFER_PROFILE_IDS || '').split(',').filter(Boolean),
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    channels: {
      en: process.env.TELEGRAM_EN_CHANNEL,
      es: process.env.TELEGRAM_ES_CHANNEL,
      pt: process.env.TELEGRAM_PT_CHANNEL,
      fr: process.env.TELEGRAM_FR_CHANNEL,
      ar: process.env.TELEGRAM_AR_CHANNEL,
    },
  },
  discord: {
    webhook: process.env.DISCORD_WEBHOOK_URL,
  },
  affiliates: {
    draftkings: process.env.AFF_DRAFTKINGS || 'https://draftkings.com',
    fanduel:    process.env.AFF_FANDUEL    || 'https://fanduel.com',
    betmgm:     process.env.AFF_BETMGM    || 'https://betmgm.com',
    nordvpn:    process.env.AFF_NORDVPN   || 'https://nordvpn.com',
    bet365:     process.env.AFF_BET365    || 'https://bet365.com',
    betano:     process.env.AFF_BETANO    || 'https://betano.com',
  },
};

// ─── STEP 1: FETCH FIXTURES ─────────────────────────────────────────────────
async function getUpcomingFixtures() {
  const today    = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  try {
    const r = await axios.get(`${C.apiFootball.base}/fixtures`, {
      headers: { 'x-apisports-key': C.apiFootball.key },
      params:  { league: C.apiFootball.league, season: C.apiFootball.season, from: today, to: tomorrow },
    });
    return r.data.response || [];
  } catch (e) {
    console.error('Fixtures error:', e.message);
    return [];
  }
}

// ─── STEP 2: FETCH BEST ODDS ────────────────────────────────────────────────
async function getBestOdds(homeTeam, awayTeam) {
  try {
    const r = await axios.get(`${C.oddsApi.base}/sports/${C.oddsApi.sport}/odds`, {
      params: { apiKey: C.oddsApi.key, regions: 'us,uk,eu', markets: 'h2h', oddsFormat: 'american' },
    });
    const match = r.data.find(m =>
      m.home_team.toLowerCase().includes(homeTeam.split(' ')[0].toLowerCase()) ||
      m.away_team.toLowerCase().includes(awayTeam.split(' ')[0].toLowerCase())
    );
    if (!match) return null;

    const best = { home: -9999, draw: -9999, away: -9999, homeBook: '', drawBook: '', awayBook: '' };
    for (const book of match.bookmakers) {
      const market = book.markets.find(m => m.key === 'h2h');
      if (!market) continue;
      for (const o of market.outcomes) {
        if (o.name === match.home_team && o.price > best.home) { best.home = o.price; best.homeBook = book.title; }
        if (o.name === 'Draw'          && o.price > best.draw) { best.draw = o.price; best.drawBook = book.title; }
        if (o.name === match.away_team && o.price > best.away) { best.away = o.price; best.awayBook = book.title; }
      }
    }
    return { ...best, homeTeam: match.home_team, awayTeam: match.away_team };
  } catch (e) {
    console.error('Odds error:', e.message);
    return null;
  }
}

function fmtOdds(n) { return n > 0 ? `+${n}` : `${n}`; }

// ─── STEP 3: AI CONTENT GENERATION ─────────────────────────────────────────
async function generateContent(fixture, odds) {
  const home  = fixture.teams.home.name;
  const away  = fixture.teams.away.name;
  const date  = new Date(fixture.fixture.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const venue = `${fixture.fixture.venue?.name || 'TBD'}, ${fixture.fixture.venue?.city || 'USA'}`;
  const oddsStr = odds
    ? `${home}: ${fmtOdds(odds.home)} (${odds.homeBook}) | Draw: ${fmtOdds(odds.draw)} | ${away}: ${fmtOdds(odds.away)} (${odds.awayBook})`
    : 'Odds TBD';

  const prompt = `You are a professional soccer journalist covering the 2026 FIFA World Cup. Write original, specific, engaging content.

Match: ${home} vs ${away}
Date: ${date} | Venue: ${venue}
Best odds (American format): ${oddsStr}

Output ONLY a valid JSON object with these exact keys — no markdown, no explanation:
{
  "headline": "compelling headline under 80 characters",
  "preview": "400-word match preview with tactical analysis, key players, historical context, and what's at stake. Be specific and confident.",
  "prediction": "2-sentence confident prediction with reasoning",
  "confidence": 75,
  "bettingAngles": ["specific angle 1", "specific angle 2", "specific angle 3"],
  "captions": {
    "tiktok": "energetic caption under 140 chars + 5 relevant hashtags",
    "instagram": "engaging caption under 200 chars + 5 hashtags",
    "twitter": "punchy tweet under 200 chars with score prediction"
  },
  "emailSubject": "subject line under 55 chars that creates urgency",
  "podcastScript": "60-second spoken intro script for podcast episode",
  "memeTop": "short meme setup text",
  "memeBottom": "short meme punchline"
}`;

  try {
    const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: C.groq.model,
      messages: [
        { role: 'system', content: 'Professional soccer analyst. Respond with valid JSON only. No markdown. No extra text.' },
        { role: 'user',   content: prompt },
      ],
      temperature: 0.75,
      max_tokens: 2000,
    }, { headers: { Authorization: `Bearer ${C.groq.key}`, 'Content-Type': 'application/json' } });

    const raw = r.data.choices[0].message.content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Groq error:', e.message);
    return null;
  }
}

// ─── STEP 4: TRANSLATE ───────────────────────────────────────────────────────
async function translate(text, target) {
  try {
    const r = await axios.post('https://libretranslate.com/translate', {
      q: text, source: 'en', target, format: 'text',
      api_key: process.env.LIBRETRANSLATE_KEY || '',
    }, { timeout: 12000 });
    return r.data.translatedText;
  } catch {
    return text; // fall back to English
  }
}

async function translateAll(content, langs = ['es', 'pt', 'fr', 'ar']) {
  const out = { en: content };
  await Promise.all(langs.map(async lang => {
    const [preview, headline, caption, subject] = await Promise.all([
      translate(content.preview,             lang),
      translate(content.headline,            lang),
      translate(content.captions.tiktok,     lang),
      translate(content.emailSubject,        lang),
    ]);
    out[lang] = {
      ...content,
      preview,
      headline,
      emailSubject: subject,
      captions: { ...content.captions, tiktok: caption },
    };
  }));
  return out;
}

// ─── STEP 5: BUILD ARTICLE HTML WITH AFFILIATE LINKS ────────────────────────
function buildArticle(t, odds, lang, siteUrl) {
  const home = odds?.homeTeam || 'the home team';
  const isEN = lang === 'en';

  const affiliateBlock = isEN ? `
<hr>
<h3>🎰 Best Odds for This Match</h3>
<p>Get the best value before kick-off:</p>
<ul>
  <li><strong>DraftKings:</strong> <a href="${C.affiliates.draftkings}" rel="sponsored nofollow" target="_blank">Bet $5, get $200 in bonus bets →</a></li>
  <li><strong>FanDuel:</strong> <a href="${C.affiliates.fanduel}" rel="sponsored nofollow" target="_blank">$200 bonus + $100 fantasy cash →</a></li>
  <li><strong>BetMGM:</strong> <a href="${C.affiliates.betmgm}" rel="sponsored nofollow" target="_blank">Up to $1,500 first bet insurance →</a></li>
</ul>
<p>📺 <em>Watching from abroad? <a href="${C.affiliates.nordvpn}" rel="sponsored nofollow" target="_blank">NordVPN</a> unlocks every live stream.</em></p>
` : `
<hr>
<p>🎰 <a href="${C.affiliates.bet365}" rel="sponsored nofollow" target="_blank">Best odds at bet365</a> |
   <a href="${C.affiliates.betano}" rel="sponsored nofollow" target="_blank">Betano bonus offer</a> |
   📺 <a href="${C.affiliates.nordvpn}" rel="sponsored nofollow" target="_blank">Watch live – NordVPN</a></p>
`;

  return `
<div class="wc2026-article">
${t.preview}

<h3>⚽ Our Prediction</h3>
<p><strong>${t.prediction}</strong></p>
<p><em>Confidence: ${t.confidence}%</em></p>

<h3>📊 Betting Angles</h3>
<ul>
${t.bettingAngles.map(a => `  <li>${a}</li>`).join('\n')}
</ul>
${affiliateBlock}
<hr>
<p><em>Subscribe to our <a href="${siteUrl}/newsletter">free newsletter</a> for picks before every match.
Join 10,000+ fans on our <a href="${siteUrl}/discord">Discord</a>.</em></p>
</div>`;
}

// ─── STEP 6: PUBLISH TO WORDPRESS ───────────────────────────────────────────
async function publishWordPress(title, body, lang, tags = ['world-cup-2026', 'soccer', 'betting']) {
  const auth = Buffer.from(`${C.wordpress.user}:${C.wordpress.pass}`).toString('base64');
  try {
    const r = await axios.post(`${C.wordpress.url}/wp-json/wp/v2/posts`, {
      title,
      content: body,
      status: 'publish',
      tags,
      meta: { _yoast_wpseo_focuskw: title },
    }, { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } });
    console.log(`  ✅ WordPress [${lang}]: ${r.data.link}`);
    return r.data.link;
  } catch (e) {
    console.error(`  ❌ WordPress [${lang}]:`, e.response?.data?.message || e.message);
    return null;
  }
}

// ─── STEP 7: BEEHIIV NEWSLETTER ─────────────────────────────────────────────
async function sendBeehiiv(subject, body) {
  const sendAt = new Date(Date.now() + 3600000).toISOString(); // 1hr from now
  try {
    await axios.post(
      `https://api.beehiiv.com/v2/publications/${C.beehiiv.pubId}/posts`,
      { subject, content_html: body, status: 'confirmed', audience: 'free', send_at: sendAt },
      { headers: { Authorization: `Bearer ${C.beehiiv.key}`, 'Content-Type': 'application/json' } }
    );
    console.log('  ✅ Beehiiv: scheduled');
  } catch (e) {
    console.error('  ❌ Beehiiv:', e.message);
  }
}

// ─── STEP 8: TELEGRAM ───────────────────────────────────────────────────────
async function postTelegram(chatId, msg) {
  try {
    await axios.post(`https://api.telegram.org/bot${C.telegram.token}/sendMessage`, {
      chat_id: chatId, text: msg, parse_mode: 'HTML', disable_web_page_preview: false,
    });
    console.log(`  ✅ Telegram [${chatId}]`);
  } catch (e) {
    console.error(`  ❌ Telegram [${chatId}]:`, e.message);
  }
}

// ─── STEP 9: DISCORD ────────────────────────────────────────────────────────
async function postDiscord(content, articleUrl) {
  if (!C.discord.webhook) return;
  try {
    await axios.post(C.discord.webhook, {
      embeds: [{
        title: content.headline,
        description: `${content.prediction}\n\n**Confidence:** ${content.confidence}%`,
        color: 0x2ECC71,
        fields: [
          { name: '📊 Betting Angles', value: content.bettingAngles.map(a => `• ${a}`).join('\n'), inline: false },
          { name: '🔗 Full Analysis', value: articleUrl || C.wordpress.url, inline: false },
        ],
        footer: { text: 'WC2026 AI Predictions' },
        timestamp: new Date().toISOString(),
      }],
    });
    console.log('  ✅ Discord');
  } catch (e) {
    console.error('  ❌ Discord:', e.message);
  }
}

// ─── STEP 10: BUFFER SOCIAL SCHEDULING ──────────────────────────────────────
async function scheduleBuffer(text, scheduledAt) {
  if (!C.buffer.token || !C.buffer.profileIds.length) return;
  try {
    await axios.post('https://api.bufferapp.com/1/updates/create.json', null, {
      params: {
        access_token: C.buffer.token,
        'profile_ids[]': C.buffer.profileIds,
        text,
        scheduled_at: new Date(scheduledAt).toISOString(),
      },
    });
    console.log(`  ✅ Buffer: scheduled for ${new Date(scheduledAt).toLocaleTimeString()}`);
  } catch (e) {
    console.error('  ❌ Buffer:', e.message);
  }
}

// ─── MAIN ENGINE ────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🚀 WC2026 Preview Engine — ${new Date().toLocaleString()}`);

  const fixtures = await getUpcomingFixtures();
  if (!fixtures.length) {
    console.log('No upcoming WC fixtures found. Nothing to publish.');
    return;
  }
  console.log(`Found ${fixtures.length} upcoming match(es)\n`);

  for (const fixture of fixtures) {
    const home      = fixture.teams.home.name;
    const away      = fixture.teams.away.name;
    const kickOff   = new Date(fixture.fixture.date);

    console.log(`⚽ ${home} vs ${away} — kick-off: ${kickOff.toLocaleString()}`);

    // Get odds
    const odds    = await getBestOdds(home, away);

    // Generate AI content
    const content = await generateContent(fixture, odds);
    if (!content) { console.log('  ⚠️  Content generation failed — skipping\n'); continue; }
    console.log(`  ✍️  "${content.headline}"`);

    // Translate
    console.log('  🌍 Translating...');
    const translations = await translateAll(content);

    // Publish + distribute per language
    const urls = {};
    for (const [lang, t] of Object.entries(translations)) {
      const body = buildArticle(t, odds, lang, C.wordpress.url);
      urls[lang] = await publishWordPress(t.headline, body, lang);
      await new Promise(r => setTimeout(r, 500)); // gentle rate limit
    }

    // Beehiiv (English newsletter)
    const enBody = buildArticle(translations.en, odds, 'en', C.wordpress.url);
    await sendBeehiiv(content.emailSubject, enBody);

    // Telegram — all language channels
    for (const [lang, chatId] of Object.entries(C.telegram.channels)) {
      if (!chatId) continue;
      const t   = translations[lang] || translations.en;
      const url = urls[lang] || urls.en || C.wordpress.url;
      const msg = `⚽ <b>${t.headline}</b>\n\n${t.prediction}\n\n📊 ${t.bettingAngles[0]}\n\n🔗 ${url}`;
      await postTelegram(chatId, msg);
    }

    // Discord
    await postDiscord(content, urls.en);

    // Buffer — schedule social posts 6hr and 2hr before kick-off
    const siteUrl = urls.en || C.wordpress.url;
    for (const offset of [21600000, 7200000]) {
      const schedAt = kickOff.getTime() - offset;
      if (schedAt > Date.now()) {
        await scheduleBuffer(`${content.captions.tiktok}\n🔗 ${siteUrl}`, schedAt);
      }
    }

    console.log(`  🎉 Done!\n`);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('✅ Preview Engine finished.\n');
}

// ─── CRON SCHEDULES ─────────────────────────────────────────────────────────
// Runs at 6:00 AM and 12:00 PM UTC daily
cron.schedule('0 6  * * *', () => run().catch(console.error));
cron.schedule('0 12 * * *', () => run().catch(console.error));

console.log('⚽ WC2026 Preview Engine running');
console.log('📋 Fires daily at 06:00 UTC and 12:00 UTC');
console.log('💡 To test now, uncomment the last line\n');
// run(); // ← uncomment to run immediately
