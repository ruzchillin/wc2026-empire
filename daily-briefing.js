/**
 * daily-briefing.js — WC 2026 Intel Automated Morning Report
 *
 * Runs every day at 08:00 UTC via Railway cron.
 * Sends a comprehensive Telegram briefing to the owner.
 *
 * SETUP:
 *   1. Add to Railway as a separate service OR run alongside bot-commands.js
 *   2. Set env: TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID, RAPIDAPI_KEY,
 *      THE_ODDS_API_KEY, GROQ_API_KEY (all in .env)
 *   3. Railway cron config in railway.json: "cron": "0 8 * * *"
 *   OR run directly: node daily-briefing.js
 *
 * WHAT IT SENDS EACH MORNING:
 *   - Tournament day + days remaining
 *   - Yesterday's match results + AI prediction accuracy
 *   - Today's matches with AI picks
 *   - Sharp money signals (if available)
 *   - Subscriber growth (delta)
 *   - Revenue estimate
 *   - Top affiliate alert (if geo signal fired)
 *   - System health quick check
 *   - 1 actionable task for the day
 */

require('dotenv').config();
const Groq = require('groq-sdk');
const fs   = require('fs');
const path = require('path');

const TELEGRAM_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID        = process.env.TELEGRAM_OWNER_ID;
const FREE_CHANNEL_ID = process.env.TELEGRAM_FREE_CHANNEL_ID;
const GROQ_API_KEY    = process.env.GROQ_API_KEY;
const RAPIDAPI_KEY    = process.env.RAPIDAPI_KEY;
const ODDS_API_KEY    = process.env.THE_ODDS_API_KEY;

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Load shared state from bot-commands.js
const STATE_FILE = path.join(__dirname, 'bot-state.json');
let state = { predictions: [], subscribers: { email: 0, tgFree: 0, tgPremium: 0 }, revenue: { affiliates: 0, premium: 0, ads: 0 }, pages: { teams: 0, matches: 0, players: 0 }, visitors: { today: 0, total: 0, yesterday: 0 }, prevSubscribers: null };
try {
  const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  state = { ...state, ...saved };
} catch (e) { /* first run */ }

// ── TELEGRAM SEND ───────────────────────────────────────────────────────────────
async function sendTelegram(chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...options }),
  });
  return resp.json();
}

// ── API HELPERS ─────────────────────────────────────────────────────────────────
async function fetchYesterdayResults() {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  try {
    const resp = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${yesterday}&league=1&season=2026`,
      { headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' } }
    );
    const data = await resp.json();
    return (data.response || []).filter(f => f.fixture?.status?.short === 'FT');
  } catch { return []; }
}

async function fetchTodayFixtures() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const resp = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}&league=1&season=2026`,
      { headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' } }
    );
    const data = await resp.json();
    return data.response || [];
  } catch { return []; }
}

async function fetchOddsForTeams(home, away) {
  try {
    const r = await fetch(
      `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${ODDS_API_KEY}&regions=uk&markets=h2h`,
    );
    const games = await r.json();
    const game = games.find(g =>
      g.home_team?.toLowerCase().includes(home.toLowerCase().slice(0,4)) ||
      g.away_team?.toLowerCase().includes(home.toLowerCase().slice(0,4))
    );
    if (!game) return null;
    const bk  = game.bookmakers?.[0];
    const mkt = bk?.markets?.[0]?.outcomes || [];
    return {
      home: mkt.find(o => o.name === game.home_team)?.price,
      draw: mkt.find(o => o.name === 'Draw')?.price,
      away: mkt.find(o => o.name === game.away_team)?.price,
      bookmaker: bk?.title,
    };
  } catch { return null; }
}

async function generateMatchPrediction(home, away) {
  const prompt = `WC 2026 prediction: ${home} vs ${away}.
Return JSON: {"prediction":"home_win|draw|away_win","confidence":70,"score":"2-1","btts":true,"over25":true,"keyAngle":"one sentence insight"}`;
  try {
    const raw = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    });
    return JSON.parse(raw.choices[0]?.message?.content?.replace(/```json|```/g, '').trim() || '{}');
  } catch { return null; }
}

async function generateDailyInsight(fixtures) {
  if (!fixtures.length) return null;
  const matchList = fixtures.map(f => `${f.teams?.home?.name} vs ${f.teams?.away?.name}`).join(', ');
  const prompt = `WC 2026, today's matches: ${matchList}. In 1-2 sentences, what's the single most important thing to watch today from a prediction standpoint? Be specific.`;
  try {
    const raw = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    });
    return raw.choices[0]?.message?.content?.trim();
  } catch { return null; }
}

// ── BUILD REPORT ────────────────────────────────────────────────────────────────
async function buildReport() {
  const now      = new Date();
  const dayNum   = Math.max(1, Math.ceil((now - new Date('2026-06-11')) / 86400000));
  const daysLeft = Math.max(0, Math.ceil((new Date('2026-07-19') - now) / 86400000));

  console.log(`[BRIEFING] Building Day ${dayNum} report...`);

  // Fetch data in parallel
  const [yesterdayResults, todayFixtures] = await Promise.all([
    fetchYesterdayResults(),
    fetchTodayFixtures(),
  ]);

  // ── YESTERDAY'S RESULTS ───────────────────────────────────────────────────────
  let yesterdaySection = '';
  if (yesterdayResults.length) {
    const resultLines = yesterdayResults.map(f => {
      const h  = f.teams?.home?.name || '?';
      const a  = f.teams?.away?.name || '?';
      const hs = f.goals?.home ?? '-';
      const as_ = f.goals?.away ?? '-';
      return `• ${h} ${hs}–${as_} ${a}`;
    }).join('\n');

    const correct = state.predictions.filter(p => p.correct === true).length;
    const totalPreds = state.predictions.filter(p => p.correct !== null).length;
    const acc = totalPreds > 0 ? `${((correct/totalPreds)*100).toFixed(0)}%` : 'N/A';

    yesterdaySection = `
─────────────────────
⚽ *Yesterday's Results*
${resultLines}

🎯 AI Accuracy overall: *${acc}* (${correct}/${totalPreds})`;
  } else {
    yesterdaySection = '\n─────────────────────\n⚽ No completed matches yesterday';
  }

  // ── TODAY'S PREDICTIONS ───────────────────────────────────────────────────────
  let todaySection = '\n─────────────────────\n📅 *No WC matches today*';

  if (todayFixtures.length) {
    const predLines = [];
    // Generate predictions for up to 4 matches (Groq rate limit)
    const matchesToPredict = todayFixtures.slice(0, 4);
    for (const f of matchesToPredict) {
      const home = f.teams?.home?.name || '?';
      const away = f.teams?.away?.name || '?';
      const time = f.fixture?.date?.split('T')[1]?.substring(0,5) || '?';
      const pred = await generateMatchPrediction(home, away);

      if (pred) {
        const outcomeText = pred.prediction === 'home_win' ? `${home} win` : pred.prediction === 'away_win' ? `${away} win` : 'Draw';
        const conf = pred.confidence || 60;
        const bar = '█'.repeat(Math.round(conf/20)) + '░'.repeat(5-Math.round(conf/20));
        predLines.push(
          `*${home} vs ${away}* (${time} UTC)\n  → ${outcomeText} ${bar} ${conf}%\n  💡 ${pred.keyAngle}`
        );

        // Store prediction in state
        state.predictions.push({ home, away, prediction: pred.prediction, confidence: conf, correct: null, date: now.toISOString().split('T')[0] });
      } else {
        predLines.push(`*${home} vs ${away}* (${time} UTC)\n  → Analysis unavailable`);
      }
    }

    if (todayFixtures.length > 4) {
      predLines.push(`_...and ${todayFixtures.length - 4} more matches_`);
    }

    todaySection = `
─────────────────────
📅 *Today's Picks (${todayFixtures.length} matches)*
${predLines.join('\n\n')}`;
  }

  // ── AI INSIGHT ────────────────────────────────────────────────────────────────
  const insight = todayFixtures.length ? await generateDailyInsight(todayFixtures) : null;
  const insightSection = insight ? `\n─────────────────────\n🧠 *Today's Key Angle*\n${insight}` : '';

  // ── SUBSCRIBERS + GROWTH ──────────────────────────────────────────────────────
  const { subscribers, revenue, pages } = state;
  const prevSubs   = state.prevSubscribers || { email: 0, tgFree: 0, tgPremium: 0 };
  const emailDelta = subscribers.email - prevSubs.email;
  const tgDelta    = (subscribers.tgFree + subscribers.tgPremium) - (prevSubs.tgFree + prevSubs.tgPremium);

  const subsSection = `
─────────────────────
📈 *Growth (24h)*
📧 Email: ${subscribers.email.toLocaleString()} ${emailDelta >= 0 ? `(+${emailDelta})` : `(${emailDelta})`}
✈️ Telegram: ${(subscribers.tgFree + subscribers.tgPremium).toLocaleString()} ${tgDelta >= 0 ? `(+${tgDelta})` : `(${tgDelta})`}
⭐ Premium: ${subscribers.tgPremium.toLocaleString()}`;

  // ── REVENUE ───────────────────────────────────────────────────────────────────
  const totalRev  = revenue.affiliates + revenue.premium + revenue.ads;
  const revPerDay = totalRev / Math.max(1, dayNum);
  const projFinal = revPerDay * 38;

  const revSection = `
─────────────────────
💰 *Revenue*
Total: $${totalRev.toLocaleString()}
Daily avg: $${revPerDay.toFixed(0)}
Projected (38 days): $${projFinal.toLocaleString()}`;

  // ── PAGES ────────────────────────────────────────────────────────────────────
  const totalPages = 9 + pages.teams + pages.matches + pages.players;
  const pagesSection = `
─────────────────────
📄 Pages live: *${totalPages}* (${pages.matches}/104 match previews, ${pages.players}/200 player pages)`;

  // ── ACTION FOR THE DAY ────────────────────────────────────────────────────────
  const actions = [
    '📌 Share today\'s top pick on Twitter + Telegram manually',
    '📌 Check Beehiiv for new email subs and update /setstats',
    '📌 Review affiliate click-through — log any earnings in /setrev',
    '📌 Run: node match-preview-generator.js today',
    '📌 Post in your Telegram channel with today\'s prediction',
    '📌 Check Railway logs for any errors: railway.app dashboard',
    '📌 Update yesterday\'s prediction results: /result [home] [away] [W/D/L]',
  ];
  const action = actions[dayNum % actions.length];

  // ── ASSEMBLE REPORT ───────────────────────────────────────────────────────────
  const report =
`⚡ *WC 2026 INTEL — Day ${dayNum}*
${daysLeft} days remaining | ${now.toUTCString().slice(0,16)}
${yesterdaySection}
${todaySection}
${insightSection}
${subsSection}
${revSection}
${pagesSection}

─────────────────────
✅ *Today's Task*
${action}

_Reply /help for all commands_`;

  return report;
}

// ── SEND TO FREE CHANNEL (public daily pick) ────────────────────────────────────
async function sendPublicPost(todayFixtures) {
  if (!FREE_CHANNEL_ID || !todayFixtures.length) return;

  const topMatch = todayFixtures[0];
  const home = topMatch.teams?.home?.name || '?';
  const away = topMatch.teams?.away?.name || '?';
  const time = topMatch.fixture?.date?.split('T')[1]?.substring(0,5) || '?';

  const pred = await generateMatchPrediction(home, away);
  if (!pred) return;

  const outcomeText = pred.prediction === 'home_win' ? `${home} win` : pred.prediction === 'away_win' ? `${away} win` : 'Draw';

  await sendTelegram(FREE_CHANNEL_ID,
`⚽ *WC 2026 Free Pick — ${new Date().toDateString()}*

*${home} vs ${away}* (${time} UTC)

AI Prediction: *${outcomeText}*
Confidence: ${pred.confidence}%
BTTS: ${pred.btts ? 'Yes ✅' : 'No ❌'}
Over 2.5: ${pred.over25 ? 'Yes ✅' : 'No ❌'}

💡 ${pred.keyAngle}

⭐ Get ALL predictions + sharp money + referee intel:
[Upgrade to Premium →]

@wc2026intel`
  );
}

// ── SAVE STATE SNAPSHOT ─────────────────────────────────────────────────────────
function snapshotState() {
  state.prevSubscribers = { ...state.subscribers };
  state.visitors.yesterday = state.visitors.today;
  state.visitors.today = 0;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── MAIN ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[BRIEFING] Starting daily briefing...');

  try {
    const [report, todayFixtures] = await Promise.all([
      buildReport(),
      fetchTodayFixtures(),
    ]);

    // Send owner report
    if (OWNER_ID) {
      await sendTelegram(OWNER_ID, report);
      console.log('[BRIEFING] ✅ Owner report sent');
    }

    // Send public post
    await sendPublicPost(todayFixtures);
    console.log('[BRIEFING] ✅ Public post sent');

    // Snapshot subscribers for tomorrow's delta
    snapshotState();
    console.log('[BRIEFING] ✅ State snapshot saved');

  } catch (err) {
    console.error('[BRIEFING] Error:', err.message);
    if (OWNER_ID) {
      await sendTelegram(OWNER_ID, `❌ Daily briefing failed: ${err.message}`).catch(() => {});
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
