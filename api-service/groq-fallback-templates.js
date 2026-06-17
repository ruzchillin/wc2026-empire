/**
 * WC 2026 Sports Empire — Groq Fallback Templates
 * Used when:
 *   (a) Groq API is down
 *   (b) Daily token budget is exhausted (groq-budget-guard.js denies request)
 *   (c) Network timeout during a live match
 *
 * Templates are designed to look natural — NOT robotic copy-paste.
 * Each event has 10 variations; getFallback() picks one based on minute/matchId
 * (deterministic so the same event always gets the same fallback within a session).
 *
 * Usage:
 *   const fallback = require('./groq-fallback-templates');
 *
 *   // Simple:
 *   const text = fallback.getFallback('GOAL', { player: 'Mbappé', team: 'France', minute: 45 });
 *
 *   // With platform-specific formatting:
 *   const tweet = fallback.getFallbackForPlatform('GOAL', data, 'twitter');  // ≤280 chars
 *   const post  = fallback.getFallbackForPlatform('GOAL', data, 'facebook'); // longer
 */

'use strict';

// ─── Template pools ───────────────────────────────────────────────────────────

const TEMPLATES = {

  GOAL: [
    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `⚽ GOAL! ${player || 'Goal'} puts ${team || homeTeam} ahead!\n${homeTeam} ${homeScore ?? ''}-${awayScore ?? ''} ${awayTeam} (${minute}')`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `🚨 ${player || 'GOAL'} scores for ${team || homeTeam}! (${minute}')\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\n#WC2026 #WorldCup2026`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `IT'S IN! ⚽\n\n${player} with the goal for ${team || homeTeam} at ${minute} minutes!\n\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `GOOOAL! ⚽⚽⚽\n${player || 'The player'} fires home for ${team || homeTeam}!\nMinute ${minute}: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `⚽ ${player || 'GOAL'} (${minute}')\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\nLive coverage on our site ↗`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `The net is BULGING! ${player || 'Goal'} delivers for ${team || homeTeam} at the ${minute}-minute mark.\n\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam} 🔥`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `⚽ ${minute}' — GOAL\n${player || 'Goal scorer'} • ${team || homeTeam}\nScore: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\n#WC2026`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `What a moment! ${player || 'The striker'} scores for ${team || homeTeam}!\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam} | Min ${minute} ⚽`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `GOAL FOR ${(team || homeTeam || 'THEM').toUpperCase()}! 🎉\n${player} (${minute}')\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `⚡ LIVE: ${player || 'GOAL'} scores at ${minute}' for ${team || homeTeam}!\n\n📊 ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\nFollow for more live WC 2026 updates!`
  ],

  PENALTY_GOAL: [
    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `⚽ PENALTY CONVERTED! ${player || 'The player'} steps up and scores for ${team || homeTeam}!\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam} (${minute}')`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `🎯 PENALTY GOAL! ${player} (${minute}') — ${team || homeTeam}\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\n#WC2026 #Penalty`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `PENALTY GOAL ⚽ The keeper goes the wrong way!\n${player || 'Penalty'} scores coolly for ${team || homeTeam}.\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `No nerves at all! ${player || 'Penalty taker'} slots home the penalty for ${team || homeTeam} in minute ${minute}.\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam} ⚽`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `🎯 Penalty coolly converted by ${player || 'the player'}!\n${team || homeTeam} score from the spot — ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`
  ],

  OWN_GOAL: [
    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `😬 OWN GOAL! ${player || 'The defender'} puts it past their own keeper!\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam} (${minute}')`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `That's an own goal from ${player || 'the defender'} in minute ${minute}!\n\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam} 😬`,

    ({ player, team, minute, homeTeam, awayTeam, homeScore, awayScore }) =>
      `OWN GOAL ❌ ${player || 'Defender'} (${minute}') — ${team || ''}\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\n#WC2026`
  ],

  HAT_TRICK: [
    ({ player, team, homeTeam, awayTeam, homeScore, awayScore }) =>
      `🎩🎩🎩 HAT-TRICK! ${player} has scored THREE for ${team || homeTeam} today! What a performance!\n\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}\n\n#HatTrick #WC2026`,

    ({ player, team, homeTeam, awayTeam, homeScore, awayScore }) =>
      `${player} with a WORLD CUP HAT-TRICK! 🎩⚽⚽⚽\n\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\nHistoric stuff at WC 2026!`,

    ({ player, team, homeTeam, awayTeam, homeScore, awayScore }) =>
      `HAT-TRICK HERO! 🎩\n${player} scores his third for ${team || homeTeam}!\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}\n\nThat's a WC 2026 moment right there. 🌟`,

    ({ player, team, homeTeam, awayTeam, homeScore, awayScore }) =>
      `THREE goals. ONE player. ${player} rewrites history with a WC 2026 hat-trick! 🎩🎩🎩\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,

    ({ player, team, homeTeam, awayTeam, homeScore, awayScore }) =>
      `⭐ INCREDIBLE! ${player} notches a hat-trick for ${team || homeTeam}!\n\n📊 ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}\n\n#HatTrick #WC2026`
  ],

  RED_CARD: [
    ({ player, team, minute, homeTeam, awayTeam }) =>
      `🟥 RED CARD! ${player || 'The player'} from ${team || homeTeam} is sent off in minute ${minute}!\n${homeTeam} vs ${awayTeam} — down to 10 men.`,

    ({ player, team, minute, homeTeam, awayTeam }) =>
      `SENT OFF! 🟥 ${player || 'Player'} (${team || homeTeam}) — ${minute}'\n${homeTeam} vs ${awayTeam}\n\nGame changes dramatically. #WC2026`,

    ({ player, team, minute, homeTeam, awayTeam }) =>
      `🟥 ${player || 'The player'} sees RED at minute ${minute}!\n${team || homeTeam} down to 10 men.\n${homeTeam} vs ${awayTeam} — this just got interesting.`,

    ({ player, team, minute, homeTeam, awayTeam }) =>
      `Dramatic moment! ${player || 'Player'} is dismissed — Red card for ${team || homeTeam} (${minute}').\n${homeTeam} vs ${awayTeam} 🟥`,

    ({ player, team, minute, homeTeam, awayTeam }) =>
      `OFF YOU GO! 🟥\n${player} (${minute}') is sent off for ${team || homeTeam}.\n\nCan ${homeTeam} vs ${awayTeam} still go their way with 10 men?`
  ],

  MATCH_END: [
    ({ homeTeam, awayTeam, homeScore, awayScore, stage }) =>
      `⏱️ FULL TIME!\n\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}\n\n${stage ? `(${stage})` : ''}\n\nFollow for all WC 2026 results! #WC2026`,

    ({ homeTeam, awayTeam, homeScore, awayScore }) =>
      `FT: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} 🏁\n\n${homeScore > awayScore ? `${homeTeam} win!` : homeScore < awayScore ? `${awayTeam} win!` : 'It ends all square!'}\n\n#WC2026 #WorldCup2026`,

    ({ homeTeam, awayTeam, homeScore, awayScore, stage }) =>
      `The final whistle blows!\n\n📊 ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}\n${stage || 'World Cup 2026'}\n\nFull report on our site ↗`,

    ({ homeTeam, awayTeam, homeScore, awayScore }) => {
      const winner = homeScore > awayScore ? homeTeam : homeScore < awayScore ? awayTeam : null;
      return `FULL TIME! ${winner ? `🏆 ${winner} take all 3 points!` : '🤝 Honours even!'}\n\n${homeTeam} ${homeScore}-${awayScore} ${awayTeam} #WC2026`;
    },

    ({ homeTeam, awayTeam, homeScore, awayScore }) =>
      `⏱️ FT: ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}\n\n${homeScore === awayScore ? 'A draw.' : `${homeScore > awayScore ? homeTeam : awayTeam} win it.`}\n\n#WorldCup2026 results ↗`
  ],

  UPSET: [
    ({ homeTeam, awayTeam, homeScore, awayScore }) =>
      `🚨 SHOCK RESULT! ${homeScore > awayScore ? homeTeam : awayTeam} pulls off a MASSIVE UPSET at WC 2026!\n\nFT: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} 😱\n\n#WC2026Upset`,

    ({ homeTeam, awayTeam, homeScore, awayScore }) =>
      `Nobody saw that coming! 😱\n\nFT: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\n${homeScore > awayScore ? homeTeam : awayTeam} stun the tournament! #WC2026 #Upset`,

    ({ homeTeam, awayTeam, homeScore, awayScore }) =>
      `🌍 WC 2026 SHOCK! ${homeScore > awayScore ? homeTeam : awayTeam} beat the odds!\n\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}\n\nFull-time. Football is beautiful. 🌟`
  ],

  ELIMINATION: [
    ({ homeTeam, awayTeam, homeScore, awayScore }) => {
      const loser = homeScore > awayScore ? awayTeam : homeTeam;
      return `💔 ${loser} are OUT of WC 2026!\n\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}\n\nThank you for the memories. 🙏 #WC2026`;
    },
    ({ homeTeam, awayTeam, homeScore, awayScore }) => {
      const winner = homeScore > awayScore ? homeTeam : awayTeam;
      return `🎉 ${winner} ADVANCE at WC 2026!\n\nFT: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}\n\nWho goes through next? Follow for live WC 2026 updates! #WorldCup2026`;
    },
    ({ homeTeam, awayTeam, homeScore, awayScore }) => {
      const loser = homeScore > awayScore ? awayTeam : homeTeam;
      return `The journey ends for ${loser} at WC 2026. 💔\n\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}\n\n#WC2026`;
    }
  ],

  PRE_MATCH: [
    ({ homeTeam, awayTeam, kickoffTime, stage }) =>
      `⚽ COMING UP: ${homeTeam} vs ${awayTeam}${stage ? ` — ${stage}` : ''}\n${kickoffTime ? `Kickoff: ${kickoffTime}` : 'Coming up soon!'}\n\n🔴 Live coverage on our site! #WC2026`,

    ({ homeTeam, awayTeam, kickoffTime, stage }) =>
      `📅 NEXT MATCH: ${homeTeam} vs ${awayTeam}\n${stage || 'WC 2026'}${kickoffTime ? ` • ${kickoffTime}` : ''}\n\nWho wins this one? Let us know! #WorldCup2026`,

    ({ homeTeam, awayTeam, kickoffTime }) =>
      `🔔 ${homeTeam} vs ${awayTeam} — Kickoff${kickoffTime ? ` at ${kickoffTime}` : ' soon!'}\n\nDon't miss a second of WC 2026 action! ⚽ Follow for live updates.`
  ],

  VAR: [
    ({ homeTeam, awayTeam, minute }) =>
      `🎥 VAR REVIEW in progress — ${homeTeam} vs ${awayTeam} (${minute}')\n\nStand by for the decision... #WC2026 #VAR`,

    ({ homeTeam, awayTeam, minute }) =>
      `📺 VAR CHECK! (${minute}') ${homeTeam} vs ${awayTeam}\n\nThe referee is checking the pitchside monitor. #WC2026`,
  ],

  RECORD: [
    ({ player, team }) =>
      `🌟 HISTORY MADE! ${player || 'A player'} from ${team || 'their nation'} sets a NEW WC 2026 RECORD!\n\n#WC2026 #History #WorldRecord`,

    ({ player, team }) =>
      `📖 Record-breaking moment at WC 2026!\n${player || 'The player'} from ${team || 'their team'} writes their name in the history books. 🏆\n\n#WC2026`
  ],

  INJURY: [
    ({ player, team, minute }) =>
      `🤕 ${player || 'Player'} from ${team || 'the team'} appears to be injured (${minute}').\nMedical staff on the pitch.\n\n#WC2026`,

    ({ player, team }) =>
      `⚠️ Injury concern — ${player || 'Player'} (${team || ''}) receiving treatment. Updates to follow. #WC2026`
  ]
};

// ─── Selection logic ──────────────────────────────────────────────────────────

/**
 * Pick a template variation deterministically (same event → same template in a session).
 * Uses matchId + minute as seed so different matches get different variations.
 */
function pickVariation(templates, data) {
  const seed = parseInt(
    String(data.matchId || data.fixtureId || '0').replace(/\D/g, '').slice(-4) +
    String(data.minute || '0'),
    10
  ) || Math.floor(Math.random() * templates.length);
  return templates[seed % templates.length];
}

/**
 * getFallback(eventType, data) → { text, source: 'fallback', eventType }
 *
 * Returns fallback text for any event type.
 * Safe: never throws — returns a generic message if templates are missing.
 */
function getFallback(eventType, data = {}) {
  const pool = TEMPLATES[eventType];

  if (!pool || pool.length === 0) {
    // Generic fallback for unknown event types
    return {
      text:      `⚽ WC 2026 LIVE — ${data.homeTeam || ''} vs ${data.awayTeam || ''} | Follow for updates! #WC2026`,
      source:    'fallback',
      eventType,
      variation: 0
    };
  }

  const fn        = pickVariation(pool, data);
  const variation = pool.indexOf(fn);

  let text;
  try {
    text = fn(data);
  } catch (e) {
    text = `⚽ WC 2026 Live: ${data.homeTeam || ''} ${data.homeScore ?? ''} - ${data.awayScore ?? ''} ${data.awayTeam || ''} #WC2026`;
  }

  // Trim whitespace and ensure it doesn't end with undefined
  text = text.replace(/undefined/g, '').replace(/\bnull\b/g, '').replace(/\s+/g, ' ').trim();

  return { text, source: 'fallback', eventType, variation };
}

/**
 * getFallbackForPlatform(eventType, data, platform)
 *
 * Platform-specific truncation:
 *   twitter:   ≤280 chars
 *   bluesky:   ≤300 chars
 *   mastodon:  ≤500 chars
 *   facebook:  full
 *   telegram:  full
 *   discord:   full
 */
function getFallbackForPlatform(eventType, data, platform = 'generic') {
  const result = getFallback(eventType, data);

  const LIMITS = { twitter: 280, bluesky: 300, mastodon: 500 };
  const limit  = LIMITS[platform];

  if (limit && result.text.length > limit) {
    // Trim to limit, keep at word boundary
    result.text = result.text.slice(0, limit - 3).replace(/\s+\S*$/, '') + '...';
  }

  return result;
}

/**
 * getAllEventTypes() → string[]
 */
function getAllEventTypes() {
  return Object.keys(TEMPLATES);
}

/**
 * getTemplateCount(eventType) → number
 */
function getTemplateCount(eventType) {
  return TEMPLATES[eventType]?.length || 0;
}

// ─── Test / demo ──────────────────────────────────────────────────────────────

if (require.main === module) {
  const testData = {
    homeTeam:  'France',
    awayTeam:  'Brazil',
    homeScore: 2,
    awayScore: 1,
    player:    'Mbappé',
    team:      'France',
    minute:    73,
    matchId:   'FRA-BRA-QF',
    stage:     'Quarter Final'
  };

  console.log('\n🧪 WC 2026 Fallback Template Demo\n' + '─'.repeat(50));
  const events = ['GOAL', 'HAT_TRICK', 'RED_CARD', 'MATCH_END', 'UPSET', 'ELIMINATION', 'PRE_MATCH'];

  for (const evt of events) {
    const result = getFallback(evt, testData);
    console.log(`\n[${evt}] (variation ${result.variation + 1}/${getTemplateCount(evt)}):`);
    console.log(result.text);
    console.log(`  Twitter version (≤280): ${getFallbackForPlatform(evt, testData, 'twitter').text.length} chars`);
  }

  console.log('\n✅ All fallback templates working\n');
}

module.exports = {
  getFallback,
  getFallbackForPlatform,
  getAllEventTypes,
  getTemplateCount,
  TEMPLATES
};
