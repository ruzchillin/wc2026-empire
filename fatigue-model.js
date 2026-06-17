/**
 * Player Fatigue Model — WC 2026 AI Empire
 * Models cumulative player fatigue across the tournament:
 * - Minutes played per player
 * - Travel distance between match cities
 * - Heat/humidity index at venue
 * - Days since last match
 * Predicts: fatigue-affected team → underperformance edge
 *
 * MOAT: This is what professional quant funds pay for. You're giving it free.
 * The premium upsell: "which team will drop off in the 75th minute"
 */

require('dotenv').config();
const axios  = require('axios');
const cron   = require('node-cron');
const fs     = require('fs');
const { Telegraf } = require('telegraf');
const Groq   = require('groq-sdk');

const bot             = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const FREE_CHANNEL    = process.env.TELEGRAM_CHANNEL_ID;
const PREMIUM_CHANNEL = process.env.TELEGRAM_PREMIUM_CHANNEL;
const RAPIDAPI_KEY    = process.env.RAPIDAPI_KEY;
const groq            = new Groq({ apiKey: process.env.GROQ_API_KEY });

const FATIGUE_FILE = './fatigue-data.json';

// ── WC 2026 host city climate data ────────────────────────────────────────
// Heat Stress Index: 0 (cool) → 10 (extreme heat)
const VENUE_CLIMATE = {
  'MetLife Stadium':           { city: 'New Jersey', heatIndex: 5.5, humidity: 65 },
  'SoFi Stadium':              { city: 'Los Angeles', heatIndex: 7.0, humidity: 40 },
  'AT&T Stadium':              { city: 'Dallas', heatIndex: 8.5, humidity: 55 },
  'NRG Stadium':               { city: 'Houston', heatIndex: 9.0, humidity: 75 },
  'Levi\'s Stadium':           { city: 'San Francisco', heatIndex: 4.0, humidity: 70 },
  'Arrowhead Stadium':         { city: 'Kansas City', heatIndex: 7.0, humidity: 60 },
  'Empower Field':             { city: 'Denver', heatIndex: 6.0, humidity: 35 },
  'Lincoln Financial Field':   { city: 'Philadelphia', heatIndex: 6.0, humidity: 68 },
  'Gillette Stadium':          { city: 'Boston', heatIndex: 5.0, humidity: 65 },
  'Seattle Sounders':          { city: 'Seattle', heatIndex: 3.5, humidity: 75 },
  'BC Place':                  { city: 'Vancouver', heatIndex: 3.0, humidity: 72 },
  'BMO Field':                 { city: 'Toronto', heatIndex: 5.5, humidity: 68 },
  'Estadio Azteca':            { city: 'Mexico City', heatIndex: 4.0, humidity: 45, altitude: 2240 },
  'Estadio Akron':             { city: 'Guadalajara', heatIndex: 6.5, humidity: 55 },
  'Estadio BBVA':              { city: 'Monterrey', heatIndex: 9.5, humidity: 60 },
};

// ── Distance matrix between WC cities (km, approximate) ──────────────────
const CITY_DISTANCES = {
  'New York-Los Angeles': 3940,
  'New York-Dallas': 2200,
  'New York-Houston': 2550,
  'New York-Boston': 350,
  'New York-Philadelphia': 150,
  'Los Angeles-Dallas': 2240,
  'Los Angeles-San Francisco': 560,
  'Los Angeles-Seattle': 1540,
  'Dallas-Houston': 390,
  'Dallas-Kansas City': 930,
  'Dallas-Denver': 1480,
  'Houston-Miami': 1740,
  'Vancouver-Seattle': 230,
  'Vancouver-San Francisco': 1460,
  'Toronto-Boston': 800,
  'Toronto-Philadelphia': 750,
  'Mexico City-Guadalajara': 500,
  'Mexico City-Monterrey': 910,
  'Monterrey-Dallas': 990,
};

function getTravelDistance(city1, city2) {
  const key1 = `${city1}-${city2}`;
  const key2 = `${city2}-${city1}`;
  return CITY_DISTANCES[key1] || CITY_DISTANCES[key2] || 1000; // default 1000km
}

// ── Data store ─────────────────────────────────────────────────────────────
function loadFatigue() {
  try {
    if (fs.existsSync(FATIGUE_FILE)) {
      return JSON.parse(fs.readFileSync(FATIGUE_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {
    teams: {},      // team_id → fatigue profile
    players: {},    // player_id → minutes played + history
    matches: [],    // processed match IDs
  };
}

function saveFatigue(data) {
  fs.writeFileSync(FATIGUE_FILE, JSON.stringify(data, null, 2));
}

let db = loadFatigue();

// ── Fatigue score algorithm ────────────────────────────────────────────────
/**
 * Returns a fatigue score 0-100 for a team going into their next match
 * Higher = more fatigued = more likely to underperform late in game
 */
function calculateTeamFatigue(teamId, nextMatchDate, nextVenue) {
  const team = db.teams[teamId];
  if (!team || !team.lastMatch) return 25; // no data = assume baseline

  const daysSinceLastMatch = Math.floor(
    (new Date(nextMatchDate) - new Date(team.lastMatch.date)) / (1000 * 60 * 60 * 24)
  );

  const travelKm = getTravelDistance(
    team.lastMatch.city || 'Unknown',
    VENUE_CLIMATE[nextVenue]?.city || 'Unknown'
  );

  const climate = VENUE_CLIMATE[nextVenue] || { heatIndex: 5, humidity: 60, altitude: 0 };

  // Component 1: Rest days (0 days = max fatigue, 7+ = fully recovered)
  const restScore = Math.max(0, Math.min(100, (daysSinceLastMatch / 7) * 100));

  // Component 2: Travel fatigue (0km = 0, 4000km = 100)
  const travelScore = Math.min(100, (travelKm / 4000) * 100);

  // Component 3: Heat stress at next venue
  const heatScore = climate.heatIndex * 10; // 0-100

  // Component 4: Cumulative minutes (across tournament)
  const avgMinutes = team.avgMinutesPerGame || 90;
  const gamesPlayed = team.gamesPlayed || 0;
  const cumulativeFatigue = Math.min(100, (gamesPlayed * avgMinutes) / 540 * 100); // 540 = 6 full games

  // Component 5: Altitude penalty
  const altitudePenalty = climate.altitude ? Math.min(20, climate.altitude / 150) : 0;

  // Weighted score
  const fatigueScore =
    (restScore * 0.35) +           // rest is most important
    (travelScore * 0.20) +          // travel
    (heatScore * 0.20) +            // heat
    (cumulativeFatigue * 0.20) +    // tournament load
    altitudePenalty;                 // bonus if altitude

  return Math.round(Math.min(100, 100 - fatigueScore + (travelScore * 0.3)));
  // Note: higher number = MORE fatigued
}

function getFatigueLabel(score) {
  if (score >= 75) return { label: 'CRITICAL FATIGUE', emoji: '🔴', edge: 'strong' };
  if (score >= 60) return { label: 'HIGH FATIGUE', emoji: '🟠', edge: 'moderate' };
  if (score >= 40) return { label: 'MODERATE FATIGUE', emoji: '🟡', edge: 'slight' };
  return { label: 'FRESH', emoji: '🟢', edge: 'none' };
}

// ── Update team data after each match ─────────────────────────────────────
function updateTeamAfterMatch(teamId, teamName, matchDate, venue, minutesPlayed) {
  if (!db.teams[teamId]) {
    db.teams[teamId] = {
      id: teamId, name: teamName,
      gamesPlayed: 0, totalMinutes: 0, avgMinutesPerGame: 0,
      lastMatch: null, previousMatches: [],
    };
  }

  const team = db.teams[teamId];
  team.gamesPlayed++;
  team.totalMinutes += minutesPlayed;
  team.avgMinutesPerGame = Math.round(team.totalMinutes / team.gamesPlayed);

  const city = VENUE_CLIMATE[venue]?.city || 'Unknown';
  team.previousMatches.unshift({ date: matchDate, venue, city, minutes: minutesPlayed });
  team.lastMatch = { date: matchDate, venue, city };

  if (team.previousMatches.length > 10) team.previousMatches.pop();
  saveFatigue(db);
}

// ── Fetch yesterday's results and update fatigue ──────────────────────────
async function updateFatigueFromResults() {
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
    for (const f of fixtures) {
      const matchId = f.fixture.id.toString();
      if (db.matches.includes(matchId)) continue;

      const homeId   = f.teams.home.id.toString();
      const awayId   = f.teams.away.id.toString();
      const homeName = f.teams.home.name;
      const awayName = f.teams.away.name;
      const venue    = f.fixture.venue?.name || 'Unknown';
      const date     = f.fixture.date;

      // Assume 90 min each (we'd need lineup API for exact minutes)
      updateTeamAfterMatch(homeId, homeName, date, venue, 90);
      updateTeamAfterMatch(awayId, awayName, date, venue, 90);

      db.matches.push(matchId);
    }

    saveFatigue(db);
    console.log(`✅ Fatigue data updated from ${fixtures.length} matches`);
  } catch (err) {
    console.error('❌ Fatigue update error:', err.message);
  }
}

// ── Send fatigue reports for today's matches ──────────────────────────────
async function sendFatigueReports() {
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

    const fixtures = resp.data?.response || [];
    if (!fixtures.length) return;

    for (const f of fixtures) {
      const homeId    = f.teams.home.id.toString();
      const awayId    = f.teams.away.id.toString();
      const homeName  = f.teams.home.name;
      const awayName  = f.teams.away.name;
      const venue     = f.fixture.venue?.name || 'Unknown';
      const kickoff   = new Date(f.fixture.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      const climate   = VENUE_CLIMATE[venue] || { heatIndex: 5, humidity: 60 };

      const homeFatigue = calculateTeamFatigue(homeId, f.fixture.date, venue);
      const awayFatigue = calculateTeamFatigue(awayId, f.fixture.date, venue);

      const homeLabel = getFatigueLabel(homeFatigue);
      const awayLabel = getFatigueLabel(awayFatigue);

      const fatigueGap = Math.abs(homeFatigue - awayFatigue);
      const moreRested = homeFatigue < awayFatigue ? homeName : awayName;
      const moreFatigued = homeFatigue > awayFatigue ? homeName : awayName;

      // AI insight
      const aiPrompt = `WC 2026 fatigue analysis for ${homeName} vs ${awayName}:
${homeName} fatigue score: ${homeFatigue}/100 (${homeLabel.label})
${awayName} fatigue score: ${awayFatigue}/100 (${awayLabel.label})
Venue: ${venue} - Heat index: ${climate.heatIndex}/10, Humidity: ${climate.humidity}%

Give ONE specific betting angle based purely on fatigue differential.
E.g.: "Back ${moreRested} to score in the final 15 minutes when ${moreFatigued} drops off"
Under 30 words. Be specific about the market.`;

      let aiInsight = '';
      try {
        const aiResp = await groq.chat.completions.create({
          model: 'llama3-70b-8192',
          messages: [{ role: 'user', content: aiPrompt }],
          max_tokens: 60,
        });
        aiInsight = aiResp.choices[0].message.content.trim();
      } catch (e) {
        aiInsight = `${fatigueGap >= 20 ? `${moreRested} has a rest advantage — bet them to score late.` : 'Fatigue levels roughly equal.'}`;
      }

      const premiumMsg = `😤 <b>FATIGUE INTELLIGENCE</b>

⚽ <b>${homeName} vs ${awayName}</b>
🕐 Kickoff: ${kickoff} UTC
🏟️ Venue: ${venue}
🌡️ Heat: ${climate.heatIndex}/10 | 💧 Humidity: ${climate.humidity}%

${homeLabel.emoji} <b>${homeName}</b>: Fatigue score ${homeFatigue}/100 — ${homeLabel.label}
${awayLabel.emoji} <b>${awayName}</b>: Fatigue score ${awayFatigue}/100 — ${awayLabel.label}

${fatigueGap >= 20
  ? `⚡ <b>EDGE: ${fatigueGap}pt fatigue gap</b>\n${moreRested} is significantly fresher.`
  : `📊 Both teams similarly rested (${fatigueGap}pt gap)`}

🧠 <b>Betting angle:</b>
${aiInsight}

#FatigueModel #WC2026`;

      const freeMsg = fatigueGap >= 25 ? `😤 <b>FATIGUE ALERT: ${homeName} vs ${awayName}</b>

${moreFatigued} flagged as HIGH FATIGUE going into this match.
${moreRested} may have a key late-game advantage.

🔓 Full fatigue model + betting angle → Premium

#WC2026` : null;

      try {
        await bot.telegram.sendMessage(PREMIUM_CHANNEL, premiumMsg, { parse_mode: 'HTML' });
        if (freeMsg) {
          await bot.telegram.sendMessage(FREE_CHANNEL, freeMsg, { parse_mode: 'HTML' });
        }
        console.log(`✅ Fatigue report: ${homeName} vs ${awayName} (gap: ${fatigueGap})`);
        await sleep(3000);
      } catch (err) {
        console.error('❌ Fatigue send error:', err.message);
      }
    }
  } catch (err) {
    console.error('❌ Fatigue reports error:', err.message);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Schedule ──────────────────────────────────────────────────────────────
// Pre-match fatigue reports: 09:00 UTC (before first matches)
cron.schedule('0 9 * * *', sendFatigueReports);

// Update from last night's results: 01:00 UTC
cron.schedule('0 1 * * *', updateFatigueFromResults);

module.exports = {
  calculateTeamFatigue,
  updateTeamAfterMatch,
  sendFatigueReports,
  db,
};

// ── Boot ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('😤 Fatigue Model online');
  console.log(`   Teams tracked: ${Object.keys(db.teams).length}`);
  console.log(`   Matches processed: ${db.matches.length}`);

  try {
    await bot.telegram.sendMessage(
      PREMIUM_CHANNEL,
      `😤 <b>Fatigue Model ONLINE</b>\nTracking ${Object.keys(db.teams).length} teams\nPre-match fatigue reports at 09:00 UTC daily`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    console.log('⚠️  Could not ping channel');
  }
})();
