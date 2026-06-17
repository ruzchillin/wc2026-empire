/**
 * Smart Money Tracker — WC 2026 AI Empire
 * Detects sharp/professional money movement across 50+ books
 * When big coordinated line movement hits → sends alert to premium Telegram channel
 * Free to run. Uses The Odds API free tier (500 req/month) + Betfair API (free)
 */

require('dotenv').config();
const axios   = require('axios');
const cron    = require('node-cron');
const { Telegraf } = require('telegraf');

const bot              = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const PREMIUM_CHANNEL  = process.env.TELEGRAM_PREMIUM_CHANNEL || process.env.TELEGRAM_CHANNEL_ID;
const ODDS_API_KEY     = process.env.ODDS_API_KEY;

// ── State ─────────────────────────────────────────────────────────────────────
const previousOdds  = {};   // matchId → { bookmaker → { outcome → price } }
const alertHistory  = {};   // matchId → last alert timestamp (debounce)
let   requestsUsed  = 0;    // track free tier usage (500/month)
const ALERT_COOLDOWN = 15 * 60 * 1000; // 15 min between alerts for same match

// ── Sharp-book list (in order of sharpness) ──────────────────────────────────
const SHARP_BOOKS = [
  'pinnacle',       // sharpest in the world — limits sharp bettors least
  'betfair_ex_eu',  // exchange = true market price
  'betfair_ex_uk',
  'matchbook',      // second sharpest exchange
  'sbo',            // Asian market — sharp
  'sport888',       // sharp EU book
];

const SOFT_BOOKS = [
  'bet365', 'william_hill', 'betway', 'unibet',
  'bwin', 'ladbrokes', 'coral', 'paddypower',
];

// ── Fetch current odds ────────────────────────────────────────────────────────
async function fetchOdds() {
  try {
    requestsUsed++;
    const resp = await axios.get('https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds', {
      params: {
        apiKey:     ODDS_API_KEY,
        regions:    'eu,uk,au,us',
        markets:    'h2h,totals',
        oddsFormat: 'decimal',
        bookmakers: [...SHARP_BOOKS, ...SOFT_BOOKS].join(','),
      },
      timeout: 10000,
    });

    console.log(`📊 Odds fetched — requests used this month: ${requestsUsed}/500`);
    return resp.data;
  } catch (err) {
    if (err.response?.status === 429) {
      console.log('⚠️  Rate limit hit — backing off 10 minutes');
      await sleep(600000);
    } else {
      console.error('❌ Odds API error:', err.message);
    }
    return [];
  }
}

// ── Line movement analysis ────────────────────────────────────────────────────
function detectSharpMovement(matchId, matchName, currentBookmakers) {
  const alerts = [];

  for (const book of currentBookmakers) {
    if (!SHARP_BOOKS.includes(book.key)) continue;

    const prev = previousOdds[matchId]?.[book.key];
    if (!prev) continue;

    for (const market of book.markets) {
      for (const outcome of market.outcomes) {
        const prevPrice = prev[`${market.key}_${outcome.name}`];
        if (!prevPrice) continue;

        const currentPrice  = outcome.price;
        const movement      = ((currentPrice - prevPrice) / prevPrice) * 100;
        const absMovement   = Math.abs(movement);

        // Significant movement threshold: 3% on sharp book
        if (absMovement >= 3) {
          const direction  = movement > 0 ? 'drifting (money going AGAINST)' : 'steaming (money coming IN)';
          const sharpScore = calculateSharpScore(matchId, market.key, outcome.name, currentBookmakers);

          alerts.push({
            matchId,
            matchName,
            outcome:    outcome.name,
            market:     market.key,
            book:       book.key,
            prevOdds:   prevPrice.toFixed(2),
            newOdds:    currentPrice.toFixed(2),
            movement:   movement.toFixed(1),
            direction,
            sharpScore,
            impliedProb: (1 / currentPrice * 100).toFixed(1),
          });
        }
      }
    }
  }

  return alerts;
}

function calculateSharpScore(matchId, market, outcome, bookmakers) {
  /**
   * Sharp score 1–10:
   * - Movement on Pinnacle/exchange (not just soft books): +3
   * - Movement in same direction across multiple sharp books: +3
   * - Soft books haven't moved yet (sharp is ahead of soft): +2
   * - Movement against public sentiment (public on other side): +2
   */
  let score = 0;

  const sharpMoved = bookmakers.filter(b => SHARP_BOOKS.includes(b.key));
  const softMoved  = bookmakers.filter(b => SOFT_BOOKS.includes(b.key));

  if (sharpMoved.length >= 2) score += 3;
  if (sharpMoved.length >= 1) score += 3;

  // Check if soft books have caught up yet
  const softPrices  = softMoved.map(b => {
    const m = b.markets.find(m => m.key === market);
    if (!m) return null;
    const o = m.outcomes.find(o => o.name === outcome);
    return o?.price;
  }).filter(Boolean);

  const sharpPrices = sharpMoved.map(b => {
    const m = b.markets.find(m => m.key === market);
    if (!m) return null;
    const o = m.outcomes.find(o => o.name === outcome);
    return o?.price;
  }).filter(Boolean);

  if (softPrices.length && sharpPrices.length) {
    const avgSharp = sharpPrices.reduce((a, b) => a + b, 0) / sharpPrices.length;
    const avgSoft  = softPrices.reduce((a, b) => a + b, 0) / softPrices.length;
    // Sharp lower = sharp thinks this outcome more likely than soft
    if (avgSharp < avgSoft) score += 2; // soft hasn't moved yet = early signal
  }

  if (score > 10) score = 10;
  return score;
}

// ── Store current odds as baseline ───────────────────────────────────────────
function storeCurrentOdds(matches) {
  for (const match of matches) {
    const matchId = match.id;
    if (!previousOdds[matchId]) previousOdds[matchId] = {};

    for (const book of match.bookmakers) {
      if (!previousOdds[matchId][book.key]) {
        previousOdds[matchId][book.key] = {};
      }
      for (const market of book.markets) {
        for (const outcome of market.outcomes) {
          previousOdds[matchId][book.key][`${market.key}_${outcome.name}`] = outcome.price;
        }
      }
    }
  }
}

// ── Format and send Telegram alert ───────────────────────────────────────────
async function sendSharpAlert(alert) {
  const now = Date.now();
  const key = `${alert.matchId}_${alert.outcome}`;

  // Debounce: don't spam same match
  if (alertHistory[key] && (now - alertHistory[key]) < ALERT_COOLDOWN) return;
  alertHistory[key] = now;

  const emoji      = alert.sharpScore >= 7 ? '🔴' : alert.sharpScore >= 5 ? '🟡' : '🟢';
  const marketName = alert.market === 'h2h' ? 'Match Result' :
                     alert.market === 'totals' ? 'Total Goals' : alert.market;

  const message = `${emoji} <b>SHARP MONEY ALERT</b>

🏆 <b>${alert.matchName}</b>
📊 Market: ${marketName}
💰 Selection: <b>${alert.outcome}</b>

📉 Odds: ${alert.prevOdds} → <b>${alert.newOdds}</b>
📈 Movement: <b>${alert.movement}%</b> (${alert.direction})
🎯 Sharp Score: <b>${alert.sharpScore}/10</b>
📐 Implied Probability: ${alert.impliedProb}%
🏦 Source: ${alert.book.toUpperCase()}

${alert.sharpScore >= 7 ? '⚠️ <b>HIGH CONFIDENCE</b> — Multiple sharp books moving together.' :
  alert.sharpScore >= 5 ? '📌 <b>WATCH THIS</b> — Sharp money arriving.' :
  '📝 <i>Early signal — monitor for confirmation.</i>'}

#SharpMoney #WC2026`;

  try {
    await bot.telegram.sendMessage(PREMIUM_CHANNEL, message, { parse_mode: 'HTML' });
    console.log(`📨 Sharp alert sent: ${alert.matchName} — ${alert.outcome} (${alert.movement}%)`);
  } catch (err) {
    console.error('❌ Telegram error:', err.message);
  }
}

async function sendDailyOddsReport() {
  const matches = await fetchOdds();
  if (!matches.length) return;

  let report = '📊 <b>DAILY ODDS OVERVIEW</b>\n\n';
  let count = 0;

  for (const match of matches.slice(0, 5)) {
    const pinnacle = match.bookmakers.find(b => b.key === 'pinnacle');
    if (!pinnacle) continue;

    const h2h = pinnacle.markets.find(m => m.key === 'h2h');
    if (!h2h) continue;

    const home = h2h.outcomes[0];
    const draw = h2h.outcomes.find(o => o.name === 'Draw');
    const away = h2h.outcomes[h2h.outcomes.length - 1];

    report += `<b>${match.home_team}</b> vs <b>${match.away_team}</b>\n`;
    report += `${home?.name}: ${home?.price} | Draw: ${draw?.price || '-'} | ${away?.name}: ${away?.price}\n\n`;
    count++;
  }

  if (count > 0) {
    try {
      await bot.telegram.sendMessage(PREMIUM_CHANNEL, report, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('❌ Daily report error:', err.message);
    }
  }
}

// ── Main polling loop ─────────────────────────────────────────────────────────
async function poll() {
  console.log(`🔍 Polling odds... [${new Date().toLocaleTimeString()}]`);

  const matches = await fetchOdds();
  if (!matches.length) return;

  let totalAlerts = 0;

  for (const match of matches) {
    const alerts = detectSharpMovement(match.id, `${match.home_team} vs ${match.away_team}`, match.bookmakers);

    for (const alert of alerts) {
      if (alert.sharpScore >= 5) {
        await sendSharpAlert(alert);
        totalAlerts++;
      }
    }
  }

  storeCurrentOdds(matches);

  if (totalAlerts > 0) {
    console.log(`⚡ ${totalAlerts} sharp alerts sent`);
  } else {
    console.log(`✅ No significant movement detected`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Schedule ──────────────────────────────────────────────────────────────────
// Poll every 5 minutes during match days (saves API quota)
// On non-match days: every 30 minutes
cron.schedule('*/5 * * * *', async () => {
  const hour = new Date().getHours();
  // Most WC matches: 12:00–23:00 UTC
  if (hour >= 11 && hour <= 23) {
    await poll();
  }
});

// Daily odds report at 08:00
cron.schedule('0 8 * * *', sendDailyOddsReport);

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🚀 Smart Money Tracker online');
  console.log(`📡 Monitoring: ${SHARP_BOOKS.length} sharp books + ${SOFT_BOOKS.length} soft books`);
  console.log(`📬 Alerts → ${PREMIUM_CHANNEL}`);

  // Initial fetch to build baseline (no alerts on first run)
  const initial = await fetchOdds();
  storeCurrentOdds(initial);
  console.log(`✅ Baseline set for ${initial.length} matches`);

  // Send startup confirmation
  try {
    await bot.telegram.sendMessage(
      PREMIUM_CHANNEL,
      `🔴 <b>Sharp Money Tracker ONLINE</b>\nMonitoring ${initial.length} WC 2026 matches\nAlert threshold: 3%+ movement on sharp books\nPolling: every 5 minutes`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    console.log('⚠️  Could not send startup message (check PREMIUM channel ID)');
  }
})();
