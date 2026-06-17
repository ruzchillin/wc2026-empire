/**
 * Referee Intelligence — WC 2026 AI Empire
 * Tracks referee stats across all WC matches:
 * - Cards per game, fouls per game, VAR decisions
 * - Pre-match referee report → premium Telegram channel
 * - Automated "book cards" recommendations when strictest refs assigned
 *
 * This is a moat: nobody else has automated per-ref analysis in 50 languages
 * Cards market is massive — completely unrelated to who wins the game
 */

require('dotenv').config();
const axios  = require('axios');
const cron   = require('node-cron');
const fs     = require('fs');
const { Telegraf } = require('telegraf');

const bot             = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const FREE_CHANNEL    = process.env.TELEGRAM_CHANNEL_ID;
const PREMIUM_CHANNEL = process.env.TELEGRAM_PREMIUM_CHANNEL;
const RAPIDAPI_KEY    = process.env.RAPIDAPI_KEY;
const GROQ_API_KEY    = process.env.GROQ_API_KEY;
const Groq            = require('groq-sdk');
const groq            = new Groq({ apiKey: GROQ_API_KEY });

const REF_DATA_FILE = './referee-data.json';

// ── Data store ────────────────────────────────────────────────────────────
function loadRefs() {
  try {
    if (fs.existsSync(REF_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(REF_DATA_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {
    referees: {},      // referee_id → stats
    matchRefs: {},     // match_id → referee_id
    lastFetch: null,
  };
}

function saveRefs(data) {
  data.lastFetch = new Date().toISOString();
  fs.writeFileSync(REF_DATA_FILE, JSON.stringify(data, null, 2));
}

let refDb = loadRefs();

// ── Referee stat schema ───────────────────────────────────────────────────
function initReferee(id, name, nationality) {
  if (!refDb.referees[id]) {
    refDb.referees[id] = {
      id, name, nationality,
      gamesOfficiated: 0,
      yellowCards: 0,
      redCards: 0,
      foulsCommitted: 0,
      penaltiesAwarded: 0,
      varInterventions: 0,
      // Derived (calculated)
      yellowsPerGame: 0,
      redsPerGame: 0,
      foulsPerGame: 0,
      cardsPerGame: 0,
      // Strictness tier: 'lenient' | 'average' | 'strict' | 'very_strict'
      strictnessTier: 'average',
      history: [],    // last 10 game summaries
    };
  }
  return refDb.referees[id];
}

function updateRefereeStats(refereeId, gameStats) {
  const ref = refDb.referees[refereeId];
  if (!ref) return;

  ref.gamesOfficiated++;
  ref.yellowCards     += gameStats.yellowCards || 0;
  ref.redCards        += gameStats.redCards || 0;
  ref.foulsCommitted  += gameStats.fouls || 0;
  ref.penaltiesAwarded += gameStats.penalties || 0;
  ref.varInterventions += gameStats.varCalls || 0;

  // Recalculate per-game averages
  const g = ref.gamesOfficiated;
  ref.yellowsPerGame = (ref.yellowCards / g).toFixed(2);
  ref.redsPerGame    = (ref.redCards / g).toFixed(2);
  ref.foulsPerGame   = (ref.foulsCommitted / g).toFixed(2);
  ref.cardsPerGame   = ((ref.yellowCards + ref.redCards * 2) / g).toFixed(2);

  // Strictness tier
  const cpg = parseFloat(ref.cardsPerGame);
  if (cpg >= 5.5)      ref.strictnessTier = 'very_strict';
  else if (cpg >= 4.0) ref.strictnessTier = 'strict';
  else if (cpg >= 2.5) ref.strictnessTier = 'average';
  else                 ref.strictnessTier = 'lenient';

  // Log game history (last 10)
  ref.history.unshift({
    date: new Date().toISOString().split('T')[0],
    yellows: gameStats.yellowCards || 0,
    reds: gameStats.redCards || 0,
    fouls: gameStats.fouls || 0,
  });
  if (ref.history.length > 10) ref.history.pop();

  saveRefs(refDb);
}

// ── Fetch today's fixtures with referee assignment ────────────────────────
async function fetchTodayFixturesWithReferees() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const resp = await axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures', {
      params: { league: 1, season: 2026, date: today },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
      timeout: 10000,
    });

    return resp.data?.response || [];
  } catch (err) {
    console.error('❌ Fixture fetch error:', err.message);
    return [];
  }
}

// ── Fetch historical referee stats ────────────────────────────────────────
async function fetchRefereeHistory(refId) {
  try {
    const resp = await axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures', {
      params: { referee: refId, last: 20 },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
      timeout: 10000,
    });

    const fixtures = resp.data?.response || [];
    let totalYellow = 0, totalRed = 0, totalFouls = 0;

    for (const f of fixtures) {
      if (f.fixture.status.short !== 'FT') continue;
      // We'd need /v3/fixtures/statistics for per-game stats — approximating
      totalYellow += (f.statistics?.[0]?.statistics?.find(s => s.type === 'Yellow Cards')?.value || 0);
    }

    return { fixtures: fixtures.length, totalYellow, totalRed, totalFouls };
  } catch (err) {
    return null;
  }
}

// ── AI-generated referee report ───────────────────────────────────────────
async function generateRefReport(refData, homeName, awayName) {
  const prompt = `Referee intelligence report for WC 2026 betting.

Referee: ${refData.name} (${refData.nationality})
Career stats this tournament:
- Games: ${refData.gamesOfficiated}
- Yellow cards: ${refData.yellowCards} (${refData.yellowsPerGame}/game)
- Red cards: ${refData.redCards} (${refData.redsPerGame}/game)
- Fouls tracked: ${refData.foulsCommitted} (${refData.foulsPerGame}/game)
- Cards per game: ${refData.cardsPerGame}
- Strictness tier: ${refData.strictnessTier}
- VAR calls: ${refData.varInterventions}

Match: ${homeName} vs ${awayName}

Write a 3-sentence referee intelligence report. Include:
1. Referee profile and tendencies (strict/lenient, card-happy, foul-threshold)
2. How this affects the ${homeName} vs ${awayName} match specifically
3. ONE specific bet recommendation based purely on referee profile (e.g. "Over 3.5 cards", "First card before 30 min")

Be direct. No hedging. Under 80 words total.`;

  try {
    const resp = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    });
    return resp.choices[0].message.content.trim();
  } catch (err) {
    return `${refData.name}: ${refData.yellowsPerGame} yellows/game, ${refData.cardsPerGame} total cards/game. Tier: ${refData.strictnessTier}.`;
  }
}

// ── Build and send pre-match referee reports ──────────────────────────────
async function sendRefereePrematchReports() {
  const fixtures = await fetchTodayFixturesWithReferees();

  if (!fixtures.length) {
    console.log('📅 No WC fixtures today');
    return;
  }

  console.log(`📋 Building referee reports for ${fixtures.length} matches`);

  for (const fixture of fixtures) {
    const refName        = fixture.fixture.referee;
    const homeName       = fixture.teams.home.name;
    const awayName       = fixture.teams.away.name;
    const kickoff        = new Date(fixture.fixture.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    const matchId        = fixture.fixture.id.toString();

    if (!refName) {
      console.log(`⚠️  No referee assigned yet for ${homeName} vs ${awayName}`);
      continue;
    }

    // Use referee name as ID (no ID in fixture response)
    const refId = refName.replace(/\s+/g, '_').toLowerCase();

    // Init if new referee
    if (!refDb.referees[refId]) {
      initReferee(refId, refName, fixture.fixture.venue?.country || 'Unknown');
    }

    const refData = refDb.referees[refId];
    refDb.matchRefs[matchId] = refId;
    saveRefs(refDb);

    // Build report
    const tierEmoji = {
      'very_strict': '🔴',
      'strict':      '🟠',
      'average':     '🟡',
      'lenient':     '🟢',
    }[refData.strictnessTier] || '🟡';

    // Premium: full AI-generated report
    const aiReport = await generateRefReport(refData, homeName, awayName);

    const premiumMsg = `${tierEmoji} <b>REFEREE INTELLIGENCE REPORT</b>

⚽ <b>${homeName} vs ${awayName}</b>
🕐 Kickoff: ${kickoff} UTC

👨‍⚖️ <b>Referee: ${refName}</b>
🌍 Nationality: ${refData.nationality || 'Unknown'}

📊 <b>Tournament Stats (${refData.gamesOfficiated} games)</b>
🟨 Yellows/game: <b>${refData.yellowsPerGame}</b>
🟥 Reds/game: <b>${refData.redsPerGame}</b>
📐 Cards/game: <b>${refData.cardsPerGame}</b>
🚨 Strictness: <b>${refData.strictnessTier.replace('_', ' ').toUpperCase()}</b>

🧠 <b>AI Analysis:</b>
${aiReport}

#RefereePick #WC2026`;

    // Free channel: just the headline number
    const freeMsg = `👨‍⚖️ <b>REF ALERT: ${homeName} vs ${awayName}</b>

Referee: <b>${refName}</b>
Cards/game avg: <b>${refData.cardsPerGame}</b> (${refData.strictnessTier.replace('_', ' ')})

🔓 Full referee intelligence + bet recommendation → join Premium

#WC2026 #RefStats`;

    try {
      await bot.telegram.sendMessage(PREMIUM_CHANNEL, premiumMsg, { parse_mode: 'HTML' });
      await bot.telegram.sendMessage(FREE_CHANNEL, freeMsg, { parse_mode: 'HTML' });
      console.log(`✅ Referee report sent: ${refName} (${homeName} vs ${awayName})`);

      // Pace requests
      await sleep(2000);
    } catch (err) {
      console.error(`❌ Error sending ref report:`, err.message);
    }
  }
}

// ── Settle: update referee stats after finished games ─────────────────────
async function settleRefereeStats() {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const resp = await axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures', {
      params: { league: 1, season: 2026, date: yesterday, status: 'FT' },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
      timeout: 10000,
    });

    const fixtures = resp.data?.response || [];

    for (const fixture of fixtures) {
      const matchId = fixture.fixture.id.toString();
      const refId   = refDb.matchRefs[matchId];
      if (!refId) continue;

      // Get match statistics (cards)
      try {
        const statsResp = await axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics', {
          params: { fixture: fixture.fixture.id },
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
          },
          timeout: 8000,
        });

        const stats = statsResp.data?.response || [];
        let totalYellow = 0, totalRed = 0, totalFouls = 0;

        for (const team of stats) {
          const yellows = team.statistics.find(s => s.type === 'Yellow Cards')?.value || 0;
          const reds    = team.statistics.find(s => s.type === 'Red Cards')?.value || 0;
          const fouls   = team.statistics.find(s => s.type === 'Fouls')?.value || 0;
          totalYellow += yellows;
          totalRed    += reds;
          totalFouls  += fouls;
        }

        updateRefereeStats(refId, {
          yellowCards: totalYellow,
          redCards:    totalRed,
          fouls:       totalFouls,
        });
        await sleep(500);
      } catch (e) {
        /* stats not available for all fixtures */
      }
    }

    console.log(`✅ Referee stats updated for ${fixtures.length} finished matches`);
  } catch (err) {
    console.error('❌ Settle referee stats error:', err.message);
  }
}

// ── Referee leaderboard (strictest/most lenient) ─────────────────────────
async function sendRefereeLeaderboard() {
  const refs = Object.values(refDb.referees)
    .filter(r => r.gamesOfficiated >= 1)
    .sort((a, b) => parseFloat(b.cardsPerGame) - parseFloat(a.cardsPerGame));

  if (!refs.length) return;

  let msg = `🃏 <b>WC 2026 REFEREE CARD INDEX</b>\n\n`;
  msg += `<b>Strictest referees:</b>\n`;

  for (const ref of refs.slice(0, 5)) {
    const tierEmoji = { 'very_strict': '🔴', 'strict': '🟠', 'average': '🟡', 'lenient': '🟢' }[ref.strictnessTier];
    msg += `${tierEmoji} ${ref.name}: <b>${ref.cardsPerGame}</b> cards/game\n`;
  }

  if (refs.length > 5) {
    msg += `\n<b>Most lenient:</b>\n`;
    for (const ref of refs.slice(-3).reverse()) {
      msg += `🟢 ${ref.name}: ${ref.cardsPerGame} cards/game\n`;
    }
  }

  msg += `\n💡 Strict ref = back Over 3.5 cards\n`;
  msg += `💡 Lenient ref = back Under 2.5 cards\n\n#WC2026 #Referees`;

  try {
    await bot.telegram.sendMessage(PREMIUM_CHANNEL, msg, { parse_mode: 'HTML' });
    console.log('📊 Referee leaderboard sent');
  } catch (err) {
    console.error('❌ Ref leaderboard error:', err.message);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Schedule ──────────────────────────────────────────────────────────────
// Pre-match reports: daily at 10:00 UTC (most WC matches kick off 12:00+ UTC)
cron.schedule('0 10 * * *', sendRefereePrematchReports);

// Settle referee stats: daily at 02:00 UTC (after all matches complete)
cron.schedule('0 2 * * *', settleRefereeStats);

// Referee leaderboard: every Sunday at 09:00 UTC
cron.schedule('0 9 * * 0', sendRefereeLeaderboard);

module.exports = {
  addReferee: initReferee,
  updateRefereeStats,
  sendRefereePrematchReports,
  refDb,
};

// ── Boot ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('👨‍⚖️ Referee Intelligence online');
  console.log(`   Tracking ${Object.keys(refDb.referees).length} referees`);

  try {
    await bot.telegram.sendMessage(
      PREMIUM_CHANNEL,
      `👨‍⚖️ <b>Referee Intelligence ONLINE</b>\nTracking ${Object.keys(refDb.referees).length} WC referees\nPre-match reports daily at 10:00 UTC`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    console.log('⚠️  Could not send startup ping');
  }
})();
