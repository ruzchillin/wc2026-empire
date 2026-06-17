// ===========================================
// WC2026 LIVE GOAL & EVENT MONITOR
// ===========================================
// Polls API-Football every 60 seconds during match hours.
// Detects goals, red cards, penalties — posts reactions to
// ALL platforms in 5 languages within 90 seconds.
//
// THIS IS YOUR MOST VALUABLE SCRIPT.
// Being first on a major WC moment = millions of impressions.
//
// DEPLOY: Same Railway project as preview-engine.js
// RUN:    node goal-monitor.js
// ===========================================

require('dotenv').config();
const axios = require('axios');
const cron  = require('node-cron');

const C = {
  apiFootball: { key: process.env.API_FOOTBALL_KEY, base: 'https://v3.football.api-sports.io' },
  groq:        { key: process.env.GROQ_API_KEY, model: 'llama3-70b-8192' },
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
  discord:  { webhook: process.env.DISCORD_WEBHOOK_URL },
  buffer:   { token: process.env.BUFFER_TOKEN, ids: (process.env.BUFFER_PROFILE_IDS || '').split(',').filter(Boolean) },
  twilio: {
    sid:   process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from:  process.env.TWILIO_FROM_NUMBER,
    // Comma-separated list of premium subscriber phone numbers
    subscribers: (process.env.SMS_SUBSCRIBERS || '').split(',').filter(Boolean),
  },
  affiliates: {
    draftkings: process.env.AFF_DRAFTKINGS || 'https://draftkings.com',
    fanduel:    process.env.AFF_FANDUEL    || 'https://fanduel.com',
  },
};

// ─── STATE: track what we've already reacted to ─────────────────────────────
// Map<fixtureId, { events: Set<string> }>
const seenEvents = new Map();

// ─── MATCH HOURS: only poll during live windows to save API credits ──────────
function isLikelyMatchTime() {
  const h = new Date().getUTCHours();
  // WC 2026 matches: roughly 15:00–03:00 UTC
  return h >= 14 || h <= 4;
}

// ─── STEP 1: GET ALL LIVE WC MATCHES ────────────────────────────────────────
async function getLiveMatches() {
  try {
    const r = await axios.get(`${C.apiFootball.base}/fixtures`, {
      headers: { 'x-apisports-key': C.apiFootball.key },
      params:  { live: 'all', league: 1, season: 2026 },
    });
    return r.data.response || [];
  } catch { return []; }
}

// ─── STEP 2: DETECT NEW EVENTS ───────────────────────────────────────────────
function getNewEvents(fixture) {
  const id     = String(fixture.fixture.id);
  const events = fixture.events || [];

  if (!seenEvents.has(id)) seenEvents.set(id, new Set());
  const seen = seenEvents.get(id);

  const fresh = events.filter(e => {
    const key = `${e.type}-${e.time?.elapsed}-${e.player?.id || 'x'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return fresh;
}

// ─── STEP 3: GENERATE REACTION WITH GROQ ────────────────────────────────────
async function generateReaction(event, fixture) {
  const home    = fixture.teams.home.name;
  const away    = fixture.teams.away.name;
  const hGoals  = fixture.goals.home ?? 0;
  const aGoals  = fixture.goals.away ?? 0;
  const score   = `${hGoals}–${aGoals}`;
  const player  = event.player?.name  || 'Unknown player';
  const team    = event.team?.name    || '';
  const minute  = event.time?.elapsed || '?';
  const type    = event.type;          // 'Goal' | 'Card' | 'Var' | 'subst'
  const detail  = event.detail || '';  // 'Normal Goal' | 'Yellow Card' | etc.

  const prompt = `WC 2026 match event. Write immediate, electric reactions.

Match: ${home} vs ${away}
Score now: ${score}
Event: ${type} — ${detail}
Player: ${player} (${team})
Minute: ${minute}'

Output ONLY valid JSON — no markdown, no extra text:
{
  "twitter":   "tweet max 200 chars, include score, energetic, no hashtags yet",
  "telegram":  "telegram message max 300 chars, HTML bold allowed, slightly more detail",
  "instagram": "instagram caption max 150 chars + exactly 5 WC hashtags",
  "discord":   "discord message max 200 chars, use discord emoji",
  "sms":       "SMS alert max 160 chars, include score and affiliate link placeholder {{LINK}}",
  "memeTop":   "meme setup line — short and punchy",
  "memeBottom":"meme punchline — short and funny"
}`;

  try {
    const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: C.groq.model,
      messages: [
        { role: 'system', content: 'Sports journalist. Immediate exciting reactions. Valid JSON only.' },
        { role: 'user',   content: prompt },
      ],
      temperature: 0.85,
      max_tokens:  500,
    }, { headers: { Authorization: `Bearer ${C.groq.key}`, 'Content-Type': 'application/json' } });

    const raw = r.data.choices[0].message.content.trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(raw);
  } catch {
    // Fallback if AI fails — still posts something within 90 seconds
    const emoji  = type === 'Goal' ? '⚽' : type === 'Card' ? '🟥' : '🔔';
    const action = type === 'Goal' ? 'GOAL!' : type === 'Card' ? 'RED CARD!' : 'BIG MOMENT!';
    return {
      twitter:   `${emoji} ${action} ${player} | ${home} ${score} ${away} (${minute}')`,
      telegram:  `${emoji} <b>${action}</b>\n${player} (${team}) | <b>${home} ${score} ${away}</b> — ${minute}'`,
      instagram: `${action} ${player} | ${home} ${score} ${away} ${minute}' #WorldCup2026 #WC2026 #soccer #football #FIFA`,
      discord:   `${emoji} **${action}** ${player} | ${home} ${score} ${away} (${minute}')`,
      sms:       `WC2026: ${action} ${player} | ${home} ${score} ${away} (${minute}') — {{LINK}}`,
      memeTop:   `${team} fans in the ${minute}th minute`,
      memeBottom: `${player} said "it's me, I'm the moment"`,
    };
  }
}

// ─── STEP 4: QUICK TRANSLATIONS ─────────────────────────────────────────────
async function translateQuick(text, lang) {
  try {
    const r = await axios.post('https://libretranslate.com/translate', {
      q: text, source: 'en', target: lang, format: 'text',
      api_key: process.env.LIBRETRANSLATE_KEY || '',
    }, { timeout: 8000 });
    return r.data.translatedText;
  } catch { return text; }
}

// ─── STEP 5: POST EVERYWHERE ─────────────────────────────────────────────────
async function postTelegram(chatId, msg) {
  if (!chatId || !C.telegram.token) return;
  try {
    await axios.post(`https://api.telegram.org/bot${C.telegram.token}/sendMessage`, {
      chat_id: chatId, text: msg, parse_mode: 'HTML',
    });
  } catch { /* silent */ }
}

async function postDiscord(msg) {
  if (!C.discord.webhook) return;
  try { await axios.post(C.discord.webhook, { content: msg }); } catch { /* silent */ }
}

async function postBuffer(text) {
  if (!C.buffer.token || !C.buffer.ids.length) return;
  try {
    await axios.post('https://api.bufferapp.com/1/updates/create.json', null, {
      params: { access_token: C.buffer.token, 'profile_ids[]': C.buffer.ids, text, now: true },
    });
  } catch { /* silent */ }
}

async function sendSMS(message) {
  if (!C.twilio.sid || !C.twilio.subscribers.length) return;
  const smsText = message.replace('{{LINK}}', C.affiliates.draftkings);
  await Promise.allSettled(
    C.twilio.subscribers.map(to =>
      axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${C.twilio.sid}/Messages.json`,
        new URLSearchParams({ From: C.twilio.from, To: to, Body: smsText }),
        { auth: { username: C.twilio.sid, password: C.twilio.token } }
      )
    )
  );
}

// ─── MAIN REACTION DISPATCHER ────────────────────────────────────────────────
async function fireReaction(event, fixture) {
  const type   = event.type;
  const home   = fixture.teams.home.name;
  const away   = fixture.teams.away.name;
  const minute = event.time?.elapsed;

  // Only react to meaningful events
  const actionable = ['Goal', 'Card', 'Var'];
  if (!actionable.includes(type)) return;
  // Ignore yellow cards — only red cards worth posting about
  if (type === 'Card' && event.detail !== 'Red Card') return;

  console.log(`\n🔔 ${type}: ${event.player?.name} | ${home} vs ${away} (${minute}')`);
  const started = Date.now();

  // 1. Generate EN reaction
  const reaction = await generateReaction(event, fixture);
  console.log(`   ✍️  Generated in ${Date.now() - started}ms`);

  // 2. Translate telegram message to ES, PT, FR in parallel
  const [teleES, telePT, teleFR] = await Promise.all([
    translateQuick(reaction.telegram, 'es'),
    translateQuick(reaction.telegram, 'pt'),
    translateQuick(reaction.telegram, 'fr'),
  ]);
  const teleTranslations = {
    en: reaction.telegram, es: teleES, pt: telePT, fr: teleFR, ar: reaction.telegram,
  };

  // 3. Fire all posts simultaneously
  await Promise.allSettled([
    // Telegram — all 5 language channels
    ...Object.entries(C.telegram.channels).map(([lang, chatId]) =>
      postTelegram(chatId, teleTranslations[lang] || reaction.telegram)
    ),
    // Discord
    postDiscord(reaction.discord),
    // Twitter/X + other social via Buffer (posts immediately with now:true)
    postBuffer(reaction.twitter),
    // SMS to premium subscribers
    sendSMS(reaction.sms),
  ]);

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`   ✅ All platforms fired in ${elapsed}s`);
}

// ─── KICK-OFF AND HALF-TIME ALERTS ───────────────────────────────────────────
const announcedKickoffs   = new Set();
const announcedHalftimes  = new Set();

async function checkMatchMilestones(fixture) {
  const id     = String(fixture.fixture.id);
  const status = fixture.fixture.status?.short;
  const home   = fixture.teams.home.name;
  const away   = fixture.teams.away.name;
  const hg     = fixture.goals.home ?? 0;
  const ag     = fixture.goals.away ?? 0;

  // Kick-off alert
  if (status === '1H' && !announcedKickoffs.has(id)) {
    announcedKickoffs.add(id);
    const msg = `🚨 <b>KICK-OFF!</b>\n${home} vs ${away} is LIVE\n\nOur pick: see pinned post\n💰 Best odds: <a href="${C.affiliates.draftkings}">DraftKings</a> | <a href="${C.affiliates.fanduel}">FanDuel</a>`;
    await Promise.allSettled(
      Object.values(C.telegram.channels).filter(Boolean).map(ch => postTelegram(ch, msg))
    );
    await postDiscord(`⚽ **KICK-OFF:** ${home} vs ${away} is LIVE now!`);
    console.log(`🟢 Kick-off alert: ${home} vs ${away}`);
  }

  // Half-time alert
  if (status === 'HT' && !announcedHalftimes.has(id)) {
    announcedHalftimes.add(id);
    const msg = `⏸️ <b>HALF-TIME</b>\n${home} ${hg}–${ag} ${away}\n\nSecond half preview dropping shortly. Stay tuned 👇`;
    await Promise.allSettled(
      Object.values(C.telegram.channels).filter(Boolean).map(ch => postTelegram(ch, msg))
    );
    console.log(`⏸️  Half-time: ${home} ${hg}–${ag} ${away}`);
  }

  // Full-time alert
  if (['FT', 'AET', 'PEN'].includes(status) && !seenEvents.get(`ft-${id}`)) {
    seenEvents.set(`ft-${id}`, new Set(['done']));
    const msg = `🏁 <b>FULL TIME</b>\n${home} ${hg}–${ag} ${away}\n\nFull analysis + next match preview incoming 📊`;
    await Promise.allSettled(
      Object.values(C.telegram.channels).filter(Boolean).map(ch => postTelegram(ch, msg))
    );
    await postDiscord(`🏁 **FT:** ${home} ${hg}–${ag} ${away}`);
    console.log(`🏁 Full-time: ${home} ${hg}–${ag} ${away}`);
  }
}

// ─── MAIN POLL LOOP ──────────────────────────────────────────────────────────
async function poll() {
  if (!isLikelyMatchTime()) return; // save API credits outside match hours

  const matches = await getLiveMatches();
  if (!matches.length) return;

  for (const fixture of matches) {
    // Check kick-off / HT / FT milestones
    await checkMatchMilestones(fixture);

    // Check for new events (goals, red cards, VAR)
    const newEvents = getNewEvents(fixture);
    for (const event of newEvents) {
      await fireReaction(event, fixture);
    }
  }
}

// ─── SCHEDULE: every 60 seconds ─────────────────────────────────────────────
cron.schedule('* * * * *', () => {
  poll().catch(e => console.error('Poll error:', e.message));
});

console.log('🔴 WC2026 Live Goal Monitor running');
console.log('📡 Polling every 60 seconds — active during match hours');
console.log('⚡ Goal detection → all platforms in under 90 seconds\n');
