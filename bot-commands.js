/**
 * bot-commands.js — WC 2026 Intel Telegram Command Interface
 *
 * Handles all /commands from the bot owner's phone.
 * Message your bot privately, get instant empire updates.
 *
 * SETUP:
 *   1. Deploy to Railway alongside agent-system.py
 *   2. Set env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID, GROQ_API_KEY,
 *      RAPIDAPI_KEY, THE_ODDS_API_KEY (all in .env)
 *   3. Run: node bot-commands.js
 *
 * COMMANDS (send from phone):
 *   /status     — all systems health check
 *   /revenue    — today's estimated earnings
 *   /stats      — subscribers + traffic
 *   /predict BRA MEX  — AI prediction for any match
 *   /fatigue Brazil   — team fatigue score
 *   /referee Name     — referee card stats
 *   /top        — top performing pages today
 *   /alert Msg  — broadcast to free channel
 *   /vip Msg    — broadcast to premium channel
 *   /report     — full daily briefing now
 *   /pages      — how many pages are live
 *   /accuracy   — AI prediction win rate
 *   /odds BRA MEX — live odds comparison
 *   /help       — show all commands
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Groq        = require('groq-sdk');
const fs          = require('fs');
const path        = require('path');

// ── INIT ────────────────────────────────────────────────────────────────────────
const bot    = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });
const OWNER  = parseInt(process.env.TELEGRAM_OWNER_ID, 10);   // Your Telegram user ID
const FREE_CH   = process.env.TELEGRAM_FREE_CHANNEL_ID;       // @wc2026intel
const PREMIUM_CH = process.env.TELEGRAM_PREMIUM_CHANNEL_ID;  // @wc2026vip

// State tracking (in-memory, survives restart via JSON file)
const STATE_FILE = path.join(__dirname, 'bot-state.json');
let state = {
  predictions: [],    // { home, away, prediction, actual, correct, date }
  subscribers: { email: 0, tgFree: 0, tgPremium: 0 },
  revenue: { affiliates: 0, premium: 0, ads: 0 },
  pages: { teams: 0, matches: 0, players: 0 },
  visitors: { today: 0, total: 0 },
  lastUpdated: null,
};
try {
  const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  state = { ...state, ...saved };
} catch (e) { /* first run */ }

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── AUTH MIDDLEWARE ─────────────────────────────────────────────────────────────
function isOwner(chatId) {
  return chatId === OWNER;
}

async function ownerOnly(msg, fn) {
  if (!isOwner(msg.chat.id)) {
    await bot.sendMessage(msg.chat.id, '🔒 Owner-only command.');
    return;
  }
  await fn();
}

// ── HELPERS ─────────────────────────────────────────────────────────────────────
function formatCurrency(n) {
  return n >= 1000 ? `$${(n/1000).toFixed(1)}K` : `$${n.toFixed(0)}`;
}

async function fetchLiveScores() {
  try {
    const resp = await fetch(
      `https://v3.football.api-sports.io/fixtures?live=all&league=1&season=2026`,
      { headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' } }
    );
    const data = await resp.json();
    return data.response || [];
  } catch { return []; }
}

async function fetchTodayFixtures() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const resp = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}&league=1&season=2026`,
      { headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' } }
    );
    const data = await resp.json();
    return data.response || [];
  } catch { return []; }
}

async function askGroq(prompt, maxTokens = 500) {
  const resp = await groq.chat.completions.create({
    model: 'llama3-70b-8192',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.7,
  });
  return resp.choices[0]?.message?.content || '—';
}

// ── COMMAND HANDLERS ────────────────────────────────────────────────────────────

// /start — welcome
bot.onText(/\/start/, async (msg) => {
  const name = msg.from.first_name || 'Boss';
  await bot.sendMessage(msg.chat.id,
    `⚡ *WC 2026 Intel — Command Center*\n\nWelcome back, ${name}.\n\nType /help to see all commands.`,
    { parse_mode: 'Markdown' }
  );
});

// /help — command list
bot.onText(/\/help/, async (msg) => {
  await ownerOnly(msg, async () => {
    await bot.sendMessage(msg.chat.id,
`⚡ *WC 2026 Intel — Your Commands*

📊 *Data & Stats*
/status — all systems health
/stats — subs + traffic
/accuracy — AI prediction win rate
/pages — pages live count

💰 *Revenue*
/revenue — today's earnings breakdown

⚽ *Intelligence*
/predict [home] [away] — AI match prediction
/odds [home] [away] — live odds
/fatigue [team] — fatigue score
/referee [name] — card stats

📣 *Broadcast*
/alert [message] — send to free channel
/vip [message] — send to premium channel

📋 *Reports*
/report — full daily briefing now
/live — live match scores

❓ /help — this message`,
      { parse_mode: 'Markdown' }
    );
  });
});

// /status — system health
bot.onText(/\/status/, async (msg) => {
  await ownerOnly(msg, async () => {
    const checks = [];

    // Groq
    try {
      await groq.chat.completions.create({ model: 'llama3-70b-8192', messages: [{ role:'user', content:'ping' }], max_tokens: 5 });
      checks.push('✅ Groq AI — online');
    } catch { checks.push('❌ Groq AI — error'); }

    // API-Football
    try {
      const r = await fetch('https://v3.football.api-sports.io/status', { headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' } });
      const d = await r.json();
      const used = d.response?.requests?.current || '?';
      const limit = d.response?.requests?.limit_day || 100;
      checks.push(`✅ API-Football — ${used}/${limit} req used today`);
    } catch { checks.push('❌ API-Football — error'); }

    // The Odds API
    try {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${process.env.THE_ODDS_API_KEY}`);
      const remaining = r.headers.get('x-requests-remaining');
      checks.push(`✅ Odds API — ${remaining || '?'} req remaining`);
    } catch { checks.push('❌ Odds API — error'); }

    // Telegram bot itself (obviously working if we received this message)
    checks.push('✅ Telegram Bot — online');

    const now = new Date().toUTCString();
    await bot.sendMessage(msg.chat.id,
      `🖥️ *System Status*\n${now}\n\n${checks.join('\n')}`,
      { parse_mode: 'Markdown' }
    );
  });
});

// /stats — subscribers + traffic
bot.onText(/\/stats/, async (msg) => {
  await ownerOnly(msg, async () => {
    const { subscribers, visitors, pages } = state;
    const totalSubs = subscribers.email + subscribers.tgFree + subscribers.tgPremium;
    const totalPages = 9 + pages.teams + pages.matches + pages.players;

    await bot.sendMessage(msg.chat.id,
`📊 *WC 2026 Intel Stats*

*Subscribers*
📧 Email: ${subscribers.email.toLocaleString()}
✈️ Telegram Free: ${subscribers.tgFree.toLocaleString()}
⭐ Telegram Premium: ${subscribers.tgPremium.toLocaleString()}
👥 Total: ${totalSubs.toLocaleString()}

*Traffic (today)*
👁️ Visitors: ${visitors.today.toLocaleString()}
📈 Total all-time: ${visitors.total.toLocaleString()}

*Pages Live*
🏆 Team hubs: ${pages.teams}/48
⚽ Match previews: ${pages.matches}/104
👤 Player pages: ${pages.players}/200
📄 Core pages: 9
📌 Total: ${totalPages}

_Last updated: ${state.lastUpdated || 'awaiting first update'}_`,
      { parse_mode: 'Markdown' }
    );
  });
});

// /revenue — earnings breakdown
bot.onText(/\/revenue/, async (msg) => {
  await ownerOnly(msg, async () => {
    const { revenue } = state;
    const total = revenue.affiliates + revenue.premium + revenue.ads;
    const today = total / Math.max(1, Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000));

    await bot.sendMessage(msg.chat.id,
`💰 *Revenue Breakdown*

*Tournament total*
🔗 Affiliates: ${formatCurrency(revenue.affiliates)}
⭐ Premium subs: ${formatCurrency(revenue.premium)}
📰 Display ads: ${formatCurrency(revenue.ads)}
💵 *Total: ${formatCurrency(total)}*

*Est. today: ${formatCurrency(today)}*

*Next milestones*
→ $1K: ${total >= 1000 ? '✅ DONE' : `$${(1000-total).toFixed(0)} away`}
→ $10K: ${total >= 10000 ? '✅ DONE' : `$${(10000-total).toFixed(0)} away`}
→ $100K: ${total >= 100000 ? '✅ DONE' : `$${(100000-total).toFixed(0)} away`}

_Update revenue: /setrev [affiliates] [premium] [ads]_`,
      { parse_mode: 'Markdown' }
    );
  });
});

// /setrev — update revenue manually (for when you check Beehiiv/affiliate dashboards)
bot.onText(/\/setrev (\d+) (\d+) (\d+)/, async (msg, match) => {
  await ownerOnly(msg, async () => {
    state.revenue = { affiliates: parseInt(match[1]), premium: parseInt(match[2]), ads: parseInt(match[3]) };
    state.lastUpdated = new Date().toUTCString();
    saveState();
    await bot.sendMessage(msg.chat.id, `✅ Revenue updated: $${(state.revenue.affiliates + state.revenue.premium + state.revenue.ads).toLocaleString()} total`);
  });
});

// /predict [home] [away] — AI match prediction
bot.onText(/\/predict (.+)/, async (msg, match) => {
  await ownerOnly(msg, async () => {
    const parts = match[1].trim().split(/\s+/);
    const home = parts.slice(0, Math.floor(parts.length/2)).join(' ');
    const away = parts.slice(Math.floor(parts.length/2)).join(' ');

    await bot.sendMessage(msg.chat.id, `🤖 Generating AI prediction for ${home} vs ${away}...`);

    const prompt = `WC 2026. Predict: ${home} vs ${away}.
Return JSON only: {"prediction":"home_win|away_win|draw","confidence":75,"score":"2-1","reasoning":"2 sentences","btts":true,"over25":true,"keyAngle":"1 sentence"}`;

    try {
      const raw = await askGroq(prompt, 300);
      const result = JSON.parse(raw.replace(/```json|```/g, '').trim());

      const outcomeEmoji = result.prediction === 'home_win' ? '🏠' : result.prediction === 'away_win' ? '✈️' : '🤝';
      const outcomeText = result.prediction === 'home_win' ? `${home} win` : result.prediction === 'away_win' ? `${away} win` : 'Draw';
      const bar = '█'.repeat(Math.round(result.confidence / 10)) + '░'.repeat(10 - Math.round(result.confidence / 10));

      await bot.sendMessage(msg.chat.id,
`${outcomeEmoji} *${home} vs ${away}*

*Prediction: ${outcomeText}*
Confidence: ${bar} ${result.confidence}%
Score: ${result.score}

📊 BTTS: ${result.btts ? '✅ Yes' : '❌ No'}
⚽ Over 2.5: ${result.over25 ? '✅ Yes' : '❌ No'}

💡 *Key angle:* ${result.keyAngle}

🧠 *Analysis:* ${result.reasoning}`,
        { parse_mode: 'Markdown' }
      );
    } catch {
      await bot.sendMessage(msg.chat.id, `❌ Could not generate prediction. Try: /predict Brazil Mexico`);
    }
  });
});

// /fatigue [team] — fatigue score
bot.onText(/\/fatigue (.+)/, async (msg, match) => {
  await ownerOnly(msg, async () => {
    const team = match[1].trim();
    await bot.sendMessage(msg.chat.id, `🏃 Calculating fatigue for ${team}...`);

    const prompt = `WC 2026. Calculate fatigue for ${team} at this point in the tournament.
Return JSON: {"score":72,"label":"High","travelKm":4200,"restDays":2,"climateLoad":7,"venueAltitude":2240,"keyFactor":"1 sentence","recommendation":"1 sentence"}`;

    try {
      const raw = await askGroq(prompt, 250);
      const f = JSON.parse(raw.replace(/```json|```/g, '').trim());

      const score = parseInt(f.score);
      const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
      const emoji = score >= 70 ? '🔴' : score >= 40 ? '🟡' : '🟢';

      await bot.sendMessage(msg.chat.id,
`${emoji} *${team} — Fatigue Report*

Score: ${bar} ${score}/100 (${f.label})

📍 Travel: ${f.travelKm.toLocaleString()}km
😴 Rest days: ${f.restDays}
🌡️ Climate load: ${f.climateLoad}/10
⛰️ Venue altitude: ${f.venueAltitude}m

⚠️ *Key factor:* ${f.keyFactor}
✅ *Tip:* ${f.recommendation}`,
        { parse_mode: 'Markdown' }
      );
    } catch {
      await bot.sendMessage(msg.chat.id, `❌ Could not calculate fatigue. Try: /fatigue Brazil`);
    }
  });
});

// /referee [name] — referee stats
bot.onText(/\/referee (.+)/, async (msg, match) => {
  await ownerOnly(msg, async () => {
    const name = match[1].trim();
    await bot.sendMessage(msg.chat.id, `🟨 Looking up ${name}...`);

    const prompt = `FIFA WC 2026 referee: ${name}. Give realistic analysis.
Return JSON: {"yellows_per_game":3.8,"reds_per_game":0.4,"penalties_per_game":0.3,"strictness":"Strict|Moderate|Lenient","favorsTechnical":false,"keyPattern":"1 sentence","risk":"High|Medium|Low"}`;

    try {
      const raw = await askGroq(prompt, 250);
      const r = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const emoji = r.risk === 'High' ? '🔴' : r.risk === 'Medium' ? '🟡' : '🟢';

      await bot.sendMessage(msg.chat.id,
`🟨 *Referee: ${name}*

Cards per game: ${r.yellows_per_game}Y / ${r.reds_per_game}R
Penalties: ${r.penalties_per_game}/game
Style: ${r.strictness}
Favors technical teams: ${r.favorsTechnical ? 'Yes' : 'No'}

${emoji} Match risk: *${r.risk}*
📌 Pattern: ${r.keyPattern}`,
        { parse_mode: 'Markdown' }
      );
    } catch {
      await bot.sendMessage(msg.chat.id, `❌ Try: /referee Bjorn Kuipers`);
    }
  });
});

// /odds [home] [away]
bot.onText(/\/odds (.+)/, async (msg, match) => {
  await ownerOnly(msg, async () => {
    const parts = match[1].trim().split(/\s+/);
    const home = parts.slice(0, Math.floor(parts.length/2)).join(' ');
    const away = parts.slice(Math.floor(parts.length/2)).join(' ');

    try {
      const r = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${process.env.THE_ODDS_API_KEY}&regions=uk,us&markets=h2h&bookmakers=bet365,draftkings`,
      );
      const games = await r.json();
      const match_ = games.find(g =>
        (g.home_team?.toLowerCase().includes(home.toLowerCase()) ||
         g.away_team?.toLowerCase().includes(home.toLowerCase()))
      );

      if (!match_) throw new Error('not found');

      const bk = match_.bookmakers[0];
      const mkt = bk?.markets?.[0]?.outcomes || [];
      const h1 = mkt.find(o => o.name === match_.home_team)?.price;
      const d  = mkt.find(o => o.name === 'Draw')?.price;
      const a  = mkt.find(o => o.name === match_.away_team)?.price;

      await bot.sendMessage(msg.chat.id,
`📊 *Live Odds: ${match_.home_team} vs ${match_.away_team}*
Via ${bk?.title || 'Bookmaker'}

🏠 ${match_.home_team}: *${h1 || '?'}*
🤝 Draw: *${d || '?'}*
✈️ ${match_.away_team}: *${a || '?'}*`,
        { parse_mode: 'Markdown' }
      );
    } catch {
      await bot.sendMessage(msg.chat.id, `⚡ Live odds not available — try /predict ${match[1]} for AI analysis`);
    }
  });
});

// /accuracy — prediction win rate
bot.onText(/\/accuracy/, async (msg) => {
  await ownerOnly(msg, async () => {
    const preds = state.predictions;
    const total = preds.length;
    const correct = preds.filter(p => p.correct === true).length;
    const wrong   = preds.filter(p => p.correct === false).length;
    const pending = preds.filter(p => p.correct === null).length;
    const pct = total > 0 ? ((correct / (correct + wrong)) * 100).toFixed(1) : 0;
    const bar = total > 0 ? '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10)) : '░░░░░░░░░░';

    await bot.sendMessage(msg.chat.id,
`🎯 *AI Prediction Accuracy*

${bar} ${pct}%

✅ Correct: ${correct}
❌ Wrong: ${wrong}
⏳ Pending: ${pending}
📊 Total: ${total}

_Add results: /result [home] [away] [W/D/L]_`,
      { parse_mode: 'Markdown' }
    );
  });
});

// /result [home] [away] [W/D/L] — log result for accuracy tracking
bot.onText(/\/result (.+) (.+) ([WDL])/i, async (msg, match) => {
  await ownerOnly(msg, async () => {
    const home = match[1];
    const away = match[2];
    const result = match[3].toUpperCase();

    const pred = state.predictions.find(p => p.home === home && p.away === away);
    if (pred) {
      pred.actual = result;
      pred.correct = (pred.prediction === 'home_win' && result === 'W') ||
                     (pred.prediction === 'draw' && result === 'D') ||
                     (pred.prediction === 'away_win' && result === 'L');
      saveState();
      await bot.sendMessage(msg.chat.id,
        `${pred.correct ? '✅' : '❌'} Logged: ${home} vs ${away} — ${result} — AI was ${pred.correct ? 'correct' : 'wrong'}`
      );
    } else {
      await bot.sendMessage(msg.chat.id, `❓ No prediction found for ${home} vs ${away}. Use /predict first.`);
    }
  });
});

// /live — live scores
bot.onText(/\/live/, async (msg) => {
  await ownerOnly(msg, async () => {
    const fixtures = await fetchLiveScores();
    if (!fixtures.length) {
      await bot.sendMessage(msg.chat.id, '⚽ No live WC 2026 matches right now.');
      return;
    }

    const lines = fixtures.map(f => {
      const h = f.teams?.home?.name || '?';
      const a = f.teams?.away?.name || '?';
      const hs = f.goals?.home ?? '-';
      const as_ = f.goals?.away ?? '-';
      const min = f.fixture?.status?.elapsed || '?';
      return `⚽ ${h} *${hs}–${as_}* ${a} (${min}')`;
    });

    await bot.sendMessage(msg.chat.id,
      `🔴 *LIVE WC 2026 Scores*\n\n${lines.join('\n')}`,
      { parse_mode: 'Markdown' }
    );
  });
});

// /pages — page inventory
bot.onText(/\/pages/, async (msg) => {
  await ownerOnly(msg, async () => {
    const { pages } = state;
    const total = 9 + pages.teams + pages.matches + pages.players;
    await bot.sendMessage(msg.chat.id,
`📄 *Pages Live*

🏆 Team hubs: ${pages.teams}/48
⚽ Match previews: ${pages.matches}/104
👤 Player pages: ${pages.players}/200
📌 Core: 9 (live scores, groups, golden boot, quiz, watch guide, merch...)
🔢 *Total: ${total}*

_Update: /setpages [teams] [matches] [players]_`,
      { parse_mode: 'Markdown' }
    );
  });
});

// /setpages [teams] [matches] [players]
bot.onText(/\/setpages (\d+) (\d+) (\d+)/, async (msg, match) => {
  await ownerOnly(msg, async () => {
    state.pages = { teams: parseInt(match[1]), matches: parseInt(match[2]), players: parseInt(match[3]) };
    saveState();
    await bot.sendMessage(msg.chat.id, `✅ Pages updated: ${9 + state.pages.teams + state.pages.matches + state.pages.players} total live`);
  });
});

// /alert [message] — broadcast to free channel
bot.onText(/\/alert (.+)/, async (msg, match) => {
  await ownerOnly(msg, async () => {
    const message = match[1];
    if (!FREE_CH) { await bot.sendMessage(msg.chat.id, '❌ FREE_CHANNEL_ID not set in .env'); return; }
    await bot.sendMessage(FREE_CH, `📢 ${message}`);
    await bot.sendMessage(msg.chat.id, `✅ Broadcast to free channel: "${message}"`);
  });
});

// /vip [message] — broadcast to premium channel
bot.onText(/\/vip (.+)/, async (msg, match) => {
  await ownerOnly(msg, async () => {
    const message = match[1];
    if (!PREMIUM_CH) { await bot.sendMessage(msg.chat.id, '❌ PREMIUM_CHANNEL_ID not set in .env'); return; }
    await bot.sendMessage(PREMIUM_CH, `⭐ ${message}`);
    await bot.sendMessage(msg.chat.id, `✅ Broadcast to premium channel: "${message}"`);
  });
});

// /report — full daily briefing on demand
bot.onText(/\/report/, async (msg) => {
  await ownerOnly(msg, async () => {
    await bot.sendMessage(msg.chat.id, '📋 Generating full briefing...');

    const fixtures = await fetchTodayFixtures();
    const { subscribers, revenue, predictions, visitors, pages } = state;
    const totalRev = revenue.affiliates + revenue.premium + revenue.ads;
    const correct = predictions.filter(p => p.correct === true).length;
    const total   = predictions.filter(p => p.correct !== null).length;
    const acc     = total > 0 ? `${((correct/total)*100).toFixed(0)}%` : '—';

    const matchLines = fixtures.length
      ? fixtures.map(f => `• ${f.teams?.home?.name} vs ${f.teams?.away?.name} — ${f.fixture?.date?.split('T')[1]?.substring(0,5) || '?'} UTC`).join('\n')
      : '• No matches today';

    const now = new Date();
    const dayNum = Math.ceil((now - new Date('2026-06-11')) / 86400000);

    await bot.sendMessage(msg.chat.id,
`📋 *DAILY BRIEFING — Day ${dayNum}*
${now.toUTCString()}

─────────────────────
💰 *Revenue*
Total: ${formatCurrency(totalRev)}
Affiliates: ${formatCurrency(revenue.affiliates)}
Premium: ${formatCurrency(revenue.premium)}
Ads: ${formatCurrency(revenue.ads)}

─────────────────────
📧 *Subscribers*
Email: ${subscribers.email.toLocaleString()}
Telegram Free: ${subscribers.tgFree.toLocaleString()}
Telegram Premium: ${subscribers.tgPremium.toLocaleString()}

─────────────────────
📊 *Traffic*
Today: ${visitors.today.toLocaleString()} visitors
Total: ${visitors.total.toLocaleString()}

─────────────────────
🎯 *AI Accuracy*
${acc} (${correct}/${total} predictions)

─────────────────────
⚽ *Today's Fixtures*
${matchLines}

─────────────────────
📄 *Pages*
${9 + pages.teams + pages.matches + pages.players} total live

/predict [home] [away] for predictions`,
      { parse_mode: 'Markdown' }
    );
  });
});

// ── ERROR HANDLING ──────────────────────────────────────────────────────────────
bot.on('polling_error', (err) => {
  console.error('[BOT] Polling error:', err.message);
});

bot.on('error', (err) => {
  console.error('[BOT] Error:', err.message);
});

// ── STARTUP MESSAGE ─────────────────────────────────────────────────────────────
console.log('[WC2026] Bot commands system starting...');
if (OWNER) {
  setTimeout(() => {
    bot.sendMessage(OWNER,
      `⚡ *WC 2026 Intel Bot* is online!\n\nType /help to see all commands.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }, 3000);
}

module.exports = { bot, state, saveState };
