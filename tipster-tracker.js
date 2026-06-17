/**
 * Tipster Tracker — WC 2026 AI Empire
 * Tracks prediction accuracy for all tipsters across all markets
 * Publishes daily leaderboard to Telegram free + premium channels
 * Also tracks YOUR bot's AI prediction accuracy (the moat: verified results)
 */

require('dotenv').config();
const axios  = require('axios');
const cron   = require('node-cron');
const fs     = require('fs');
const { Telegraf } = require('telegraf');

const bot             = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const FREE_CHANNEL    = process.env.TELEGRAM_CHANNEL_ID;
const PREMIUM_CHANNEL = process.env.TELEGRAM_PREMIUM_CHANNEL;
const GROQ_API_KEY    = process.env.GROQ_API_KEY;
const RAPIDAPI_KEY    = process.env.RAPIDAPI_KEY;

// ── Data store (persist to JSON for Railway restarts) ──────────────────────
const DATA_FILE = './tipster-data.json';

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {
    tipsters: {},
    predictions: [],
    aiStats: { total: 0, correct: 0, totalOdds: 0, profitUnits: 0 },
    lastUpdated: null,
  };
}

function saveData(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();

// ── Tipster management ────────────────────────────────────────────────────
/**
 * Add a prediction. tipsterId can be a Telegram user ID or 'AI_BOT'
 * outcome: 'home' | 'draw' | 'away' | 'over' | 'under' | 'btts_yes' | 'btts_no'
 * odds: decimal odds at time of tip
 */
function addPrediction({ tipsterId, tipsterName, matchId, home, away, market, prediction, odds, confidence }) {
  const id = `${tipsterId}_${matchId}_${market}`;

  // Prevent duplicate tips per tipster per market per match
  const existing = db.predictions.find(p => p.id === id);
  if (existing) return { success: false, reason: 'Already tipped this market' };

  const tip = {
    id,
    tipsterId,
    tipsterName,
    matchId,
    home,
    away,
    market,
    prediction,
    odds,
    confidence: confidence || 50,
    timestamp: new Date().toISOString(),
    result: null,  // 'win' | 'loss' | 'void'
    settled: false,
  };

  db.predictions.push(tip);

  // Init tipster record
  if (!db.tipsters[tipsterId]) {
    db.tipsters[tipsterId] = {
      name: tipsterName,
      total: 0, wins: 0, losses: 0, voids: 0,
      totalOdds: 0,
      profitUnits: 0,    // +1 per win (at odds), -1 per loss
      streak: 0,
      bestStreak: 0,
      currentStreakType: null,
      joinedAt: new Date().toISOString(),
      markets: {},       // market → { total, wins }
    };
  }

  saveData(db);
  return { success: true, tip };
}

/**
 * Settle a prediction once match result is known
 * result: 'home' | 'draw' | 'away' | score like '2-1'
 */
function settlePrediction(matchId, finalResult) {
  let settled = 0;

  const matchPredictions = db.predictions.filter(p => p.matchId === matchId && !p.settled);

  for (const tip of matchPredictions) {
    let outcome;

    // Determine if prediction was correct based on market
    if (tip.market === 'h2h') {
      // finalResult: 'home' | 'draw' | 'away'
      outcome = tip.prediction === finalResult ? 'win' : 'loss';
    } else if (tip.market === 'totals') {
      // finalResult: total goals scored e.g. 3
      if (tip.prediction === 'over' && finalResult > 2.5) outcome = 'win';
      else if (tip.prediction === 'under' && finalResult <= 2.5) outcome = 'win';
      else outcome = 'loss';
    } else if (tip.market === 'btts') {
      // finalResult: true | false
      if (tip.prediction === 'btts_yes' && finalResult === true) outcome = 'win';
      else if (tip.prediction === 'btts_no' && finalResult === false) outcome = 'win';
      else outcome = 'loss';
    } else {
      outcome = 'void'; // Unknown market
    }

    tip.result  = outcome;
    tip.settled = true;

    // Update tipster stats
    const tipster = db.tipsters[tip.tipsterId];
    if (!tipster) continue;

    tipster.total++;
    tipster.totalOdds += tip.odds;

    if (outcome === 'win') {
      tipster.wins++;
      tipster.profitUnits += (tip.odds - 1); // e.g. odds 2.5 → +1.5 units
      if (tipster.currentStreakType === 'W') {
        tipster.streak++;
      } else {
        tipster.streak = 1;
        tipster.currentStreakType = 'W';
      }
      tipster.bestStreak = Math.max(tipster.bestStreak, tipster.streak);
    } else if (outcome === 'loss') {
      tipster.losses++;
      tipster.profitUnits -= 1; // -1 unit staked
      if (tipster.currentStreakType === 'L') {
        tipster.streak++;
      } else {
        tipster.streak = 1;
        tipster.currentStreakType = 'L';
      }
    } else {
      tipster.voids++;
    }

    // Per-market tracking
    if (!tipster.markets[tip.market]) {
      tipster.markets[tip.market] = { total: 0, wins: 0 };
    }
    tipster.markets[tip.market].total++;
    if (outcome === 'win') tipster.markets[tip.market].wins++;

    // Track AI bot separately
    if (tip.tipsterId === 'AI_BOT') {
      db.aiStats.total++;
      db.aiStats.totalOdds += tip.odds;
      if (outcome === 'win') {
        db.aiStats.correct++;
        db.aiStats.profitUnits += (tip.odds - 1);
      } else if (outcome === 'loss') {
        db.aiStats.profitUnits -= 1;
      }
    }

    settled++;
  }

  saveData(db);
  return settled;
}

// ── Leaderboard generation ─────────────────────────────────────────────────
function buildLeaderboard(limit = 10) {
  const tipsters = Object.entries(db.tipsters)
    .filter(([, t]) => t.total >= 3)  // minimum 3 tips to appear
    .map(([id, t]) => ({
      id,
      name: t.name,
      total: t.total,
      wins: t.wins,
      winRate: t.total > 0 ? ((t.wins / t.total) * 100).toFixed(1) : 0,
      profitUnits: t.profitUnits.toFixed(2),
      avgOdds: t.total > 0 ? (t.totalOdds / t.total).toFixed(2) : 0,
      streak: `${t.currentStreakType || '-'}${t.streak || 0}`,
    }))
    .sort((a, b) => parseFloat(b.profitUnits) - parseFloat(a.profitUnits))
    .slice(0, limit);

  return tipsters;
}

// ── Fetch match results from API-Football ────────────────────────────────
async function fetchAndSettleResults() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const resp = await axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures', {
      params: { league: 1, season: 2026, from: yesterday, to: today, status: 'FT' },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
      timeout: 10000,
    });

    const fixtures = resp.data?.response || [];
    let totalSettled = 0;

    for (const fixture of fixtures) {
      const matchId = fixture.fixture.id.toString();
      const homeGoals = fixture.goals.home;
      const awayGoals = fixture.goals.away;

      let h2hResult;
      if (homeGoals > awayGoals) h2hResult = 'home';
      else if (awayGoals > homeGoals) h2hResult = 'away';
      else h2hResult = 'draw';

      // Settle h2h predictions
      const h2hSettled = settlePrediction(matchId, h2hResult);
      // Settle totals (total goals)
      const totalsSettled = settlePrediction(`${matchId}_totals`, homeGoals + awayGoals);
      // Settle BTTS
      const bttsSettled = settlePrediction(`${matchId}_btts`, homeGoals > 0 && awayGoals > 0);

      totalSettled += h2hSettled + totalsSettled + bttsSettled;
    }

    if (totalSettled > 0) {
      console.log(`✅ Settled ${totalSettled} predictions from ${fixtures.length} matches`);
    }
    return totalSettled;
  } catch (err) {
    console.error('❌ Fetch results error:', err.message);
    return 0;
  }
}

// ── Format and send leaderboard ───────────────────────────────────────────
async function sendDailyLeaderboard() {
  await fetchAndSettleResults();

  const leaders = buildLeaderboard(10);
  const aiStat  = db.aiStats;
  const aiWinRate = aiStat.total > 0
    ? ((aiStat.correct / aiStat.total) * 100).toFixed(1)
    : '—';

  // Medal emojis
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  let leaderMsg = `🏆 <b>TIPSTER LEADERBOARD — WC 2026</b>\n`;
  leaderMsg += `📅 Updated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}\n\n`;

  if (leaders.length === 0) {
    leaderMsg += '<i>No tips yet — send /predict to make your first call!</i>\n';
  } else {
    for (let i = 0; i < leaders.length; i++) {
      const t = leaders[i];
      const profitSign = parseFloat(t.profitUnits) >= 0 ? '+' : '';
      leaderMsg += `${medals[i]} <b>${t.name}</b>\n`;
      leaderMsg += `   ${t.winRate}% (${t.wins}/${t.total}) | P&L: ${profitSign}${t.profitUnits}u | Avg odds: ${t.avgOdds} | ${t.streak}\n\n`;
    }
  }

  // AI Bot stats
  leaderMsg += `\n🤖 <b>AI Oracle Track Record</b>\n`;
  leaderMsg += `   Accuracy: <b>${aiWinRate}%</b> (${aiStat.correct}/${aiStat.total} tips)\n`;
  leaderMsg += `   P&L: <b>${aiStat.profitUnits >= 0 ? '+' : ''}${aiStat.profitUnits.toFixed(2)} units</b>\n\n`;
  leaderMsg += `💡 Make your prediction: /predict [home] vs [away]\n`;
  leaderMsg += `🔓 Premium tips: /premium\n\n#WC2026 #Tipster`;

  try {
    await bot.telegram.sendMessage(FREE_CHANNEL, leaderMsg, { parse_mode: 'HTML' });
    console.log('📊 Leaderboard sent to free channel');
  } catch (err) {
    console.error('❌ Leaderboard send error:', err.message);
  }

  // Premium channel gets FULL detail: all stats, market breakdowns
  const premiumLeaders = buildLeaderboard(20);
  let premiumMsg = `📊 <b>FULL LEADERBOARD (PREMIUM)</b>\n\n`;

  for (let i = 0; i < premiumLeaders.length; i++) {
    const t = premiumLeaders[i];
    const markets = Object.entries(t.markets || {})
      .map(([m, s]) => `${m}: ${((s.wins/s.total)*100).toFixed(0)}%`)
      .join(', ');
    premiumMsg += `${i+1}. <b>${t.name}</b>\n`;
    premiumMsg += `   Win rate: ${t.winRate}% | P&L: ${t.profitUnits}u\n`;
    if (markets) premiumMsg += `   Markets: ${markets}\n`;
    premiumMsg += '\n';
  }

  try {
    await bot.telegram.sendMessage(PREMIUM_CHANNEL, premiumMsg, { parse_mode: 'HTML' });
    console.log('📊 Full leaderboard sent to premium channel');
  } catch (err) {
    console.error('❌ Premium leaderboard error:', err.message);
  }
}

// ── Weekly summary ────────────────────────────────────────────────────────
async function sendWeeklySummary() {
  const leaders = buildLeaderboard(3);
  const aiStat = db.aiStats;

  let msg = `📈 <b>WEEKLY TIPSTER REPORT — WC 2026</b>\n\n`;
  msg += `🏆 This week's top 3:\n\n`;

  const medals = ['🥇', '🥈', '🥉'];
  for (let i = 0; i < Math.min(leaders.length, 3); i++) {
    const t = leaders[i];
    msg += `${medals[i]} <b>${t.name}</b> — ${t.winRate}% / ${t.profitUnits}u profit\n`;
  }

  msg += `\n🤖 AI Oracle this week: ${aiStat.correct}/${aiStat.total} correct (${
    aiStat.total > 0 ? ((aiStat.correct/aiStat.total)*100).toFixed(1) : 0
  }%)\n\n`;
  msg += `📊 Total community tips: ${db.predictions.filter(p => p.settled).length}\n`;
  msg += `🎯 Want to appear on the leaderboard? /predict [home] vs [away]\n\n`;
  msg += `#WC2026 #WeeklyReport`;

  try {
    await bot.telegram.sendMessage(FREE_CHANNEL, msg, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('❌ Weekly summary error:', err.message);
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────
// Settle results + send leaderboard every day at 23:30 UTC
cron.schedule('30 23 * * *', sendDailyLeaderboard);

// Weekly summary: Sunday 20:00 UTC
cron.schedule('0 20 * * 0', sendWeeklySummary);

// Settle results every 6 hours (in case of delayed updates)
cron.schedule('0 */6 * * *', fetchAndSettleResults);

// ── API exports (for bot to call) ─────────────────────────────────────────
module.exports = {
  addPrediction,
  settlePrediction,
  buildLeaderboard,
  sendDailyLeaderboard,
  db,
  loadData,
  saveData,
};

// ── Boot ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('📊 Tipster Tracker online');
  console.log(`   Tracking ${Object.keys(db.tipsters).length} tipsters`);
  console.log(`   Total predictions: ${db.predictions.length}`);
  console.log(`   AI Oracle: ${db.aiStats.correct}/${db.aiStats.total} correct`);

  // Don't send on boot — just confirm it's running
  try {
    await bot.telegram.sendMessage(
      PREMIUM_CHANNEL,
      `📊 <b>Tipster Tracker ONLINE</b>\nTracking ${Object.keys(db.tipsters).length} tipsters\nLeaderboard publishes daily at 23:30 UTC`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    console.log('⚠️  Could not ping channel (check PREMIUM_CHANNEL ID)');
  }
})();
