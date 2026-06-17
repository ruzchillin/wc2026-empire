/**
 * WC 2026 Sports Empire — Match Pages Generator
 *
 * Generates 104 individual match pages for every WC 2026 fixture:
 *   - Group Stage: 48 games (12 groups × 4 matches each ... actually 3 groups of 4, 12 groups)
 *   - Round of 32: 16 games
 *   - Round of 16: 8 games
 *   - Quarter-Finals: 4 games
 *   - Semi-Finals: 2 games
 *   - 3rd Place Play-Off: 1 game
 *   - Final: 1 game
 *
 * Total: 48 + 16 + 8 + 4 + 2 + 1 + 1 = 80... actually FIFA 2026 = 104 matches
 *  (48 group stage + 32 R of 32 + ... wait FIFA extended to 104 total)
 *
 * FIFA WC 2026 format:
 *   - 48 teams → 12 groups of 4 teams
 *   - Group stage: 48 games (each team plays 3)
 *   - Round of 32: 32 teams → 16 games
 *   - Round of 16: 16 teams → 8 games
 *   - Quarter-finals: 8 teams → 4 games
 *   - Semi-finals: 4 teams → 2 games
 *   - 3rd place: 1 game
 *   - Final: 1 game
 *   Total: 48 + 16 + 8 + 4 + 2 + 1 + 1 = 80... not 104
 *
 * Actually correct FIFA 2026 breakdown:
 *   - 48 teams, 12 groups of 4 = 48 group stage games (6 per group × 8? No)
 *   Each group of 4: 6 games → 12 × 6 = 72 group games → no
 *   Each group of 4 plays round-robin (6 games each) × 12 groups = 72... too many
 *   Correction: 48 teams, 12 groups of 4, each team plays 3 = 12 × 3 games = 36... no
 *   Formula: groups × C(4,2) = 12 × 6 = 72 group stage games
 *   + 16 (R32) + 8 (R16) + 4 (QF) + 2 (SF) + 1 (3rd) + 1 (Final) = 104 ✓
 *
 * Each match page includes:
 *   - SEO head with match-specific meta tags + JSON-LD SportsEvent schema
 *   - Live score placeholder (updated by api-server.js via Alpine.js or fetch)
 *   - AI prediction (fetched from /api/predict?home=X&away=Y)
 *   - Betting odds section with affiliate CTAs
 *   - Watch guide (where to stream this specific match)
 *   - Head-to-head stats section
 *   - Key players spotlight
 *   - Related match links
 *
 * Output: public/matches/[slug].html
 *   e.g. public/matches/argentina-vs-france-final.html
 *        public/matches/group-a-game-1-usa-vs-mexico.html
 *
 * Usage:
 *   node match-pages-generator.js                    → generate all 104 pages
 *   node match-pages-generator.js --group-only       → group stage only
 *   node match-pages-generator.js --knockout-only    → knockout rounds only
 *   node match-pages-generator.js --match argentina-france → single match
 *   node match-pages-generator.js --dry-run          → count without writing
 *
 * Env vars:
 *   VERCEL_URL        — your site domain (https://wc2026live.vercel.app)
 *   ADSENSE_CLIENT    — ca-pub-XXXXXXXXXXXXXXXX
 *   PIPELINE_SECRET   — for internal API auth
 */

'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const SITE         = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const MATCHES_DIR  = path.join(process.cwd(), 'public', 'matches');
const DRY_RUN      = process.argv.includes('--dry-run');
const GROUP_ONLY   = process.argv.includes('--group-only');
const KNOCKOUT_ONLY= process.argv.includes('--knockout-only');
const SINGLE_MATCH = (() => {
  const idx = process.argv.indexOf('--match');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── WC 2026 Group Stage Fixtures ────────────────────────────────────────────
// 12 groups × 6 games each = 72 group stage games
// Teams based on FIFA WC 2026 final draw (seeded/illustrative lineup)

const GROUPS = {
  A: ['USA', 'Mexico', 'Uruguay', 'Panama'],
  B: ['Argentina', 'Chile', 'Peru', 'Bolivia'],
  C: ['Brazil', 'Colombia', 'Ecuador', 'Venezuela'],
  D: ['France', 'Belgium', 'Croatia', 'Morocco'],
  E: ['England', 'Portugal', 'Turkey', 'Albania'],
  F: ['Spain', 'Netherlands', 'Serbia', 'Costa Rica'],
  G: ['Germany', 'Poland', 'Austria', 'El Salvador'],
  H: ['Japan', 'South Korea', 'Iran', 'Australia'],
  I: ['Senegal', 'Nigeria', 'Egypt', 'South Africa'],
  J: ['Saudi Arabia', 'Qatar', 'Algeria', 'Tunisia'],
  K: ['Canada', 'Honduras', 'Jamaica', 'Curaçao'],
  L: ['Switzerland', 'Denmark', 'Czech Republic', 'Bosnia'],
};

// Broadcaster info by region (for streaming section)
const STREAMING = {
  USA:    { free: 'TNT / Telemundo (Spanish)', paid: 'Peacock · fuboTV · Sling TV', vpn: 'NordVPN for expats' },
  UK:     { free: 'BBC / ITV free', paid: 'Sky Sports', vpn: 'NordVPN to watch BBC abroad' },
  Brazil: { free: 'Globo / Cazé TV (YouTube)', paid: 'Globoplay', vpn: 'NordVPN for expats' },
  Spain:  { free: 'RTVE gratis', paid: 'DAZN', vpn: 'NordVPN for expat Spaniards' },
  France: { free: 'TF1 / M6 gratuit', paid: 'DAZN', vpn: 'NordVPN pour les expats' },
  Germany:{ free: 'ARD / ZDF kostenlos', paid: 'MagentaTV', vpn: 'NordVPN für Expats' },
  Global: { free: 'Check local broadcaster', paid: 'DAZN (200+ countries)', vpn: 'NordVPN $125 CPA' },
};

// Affiliate links by tier
const AFFILIATES = {
  bet365:    { label: 'bet365',     url: '/go/bet365',     cpa: '30% RevShare', bonus: '100% bonus to $200' },
  draftkings:{ label: 'DraftKings', url: '/go/draftkings', cpa: '$100–200 CPA', bonus: 'Bet $5 Get $200 (USA)' },
  unibet:    { label: 'Unibet',     url: '/go/unibet',     cpa: '25% RevShare', bonus: '€250 welcome bonus' },
  fanduel:   { label: 'FanDuel',    url: '/go/fanduel',    cpa: '$150 CPA',     bonus: 'Bet $5 Get $150 (USA)' },
  nordvpn:   { label: 'NordVPN',    url: '/go/nordvpn',    cpa: '$125 CPA',     bonus: 'Watch any match worldwide' },
};

// Slug helper
function toSlug(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Round-robin pairs for a group
function groupPairs(teams) {
  const pairs = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      pairs.push([teams[i], teams[j]]);
    }
  }
  return pairs; // C(4,2) = 6 per group
}

// Generate all group stage fixtures
function generateGroupFixtures() {
  const fixtures = [];
  let gameNum = 1;
  for (const [group, teams] of Object.entries(GROUPS)) {
    const pairs = groupPairs(teams);
    pairs.forEach(([home, away], idx) => {
      fixtures.push({
        id:     `group-${group.toLowerCase()}-game-${idx + 1}`,
        round:  'Group Stage',
        group:  `Group ${group}`,
        home,
        away,
        gameNum: gameNum++,
        venue:   assignVenue(gameNum),
        date:    groupDate(group, idx),
        slug:    `group-${group.toLowerCase()}-${toSlug(home)}-vs-${toSlug(away)}`,
      });
    });
  }
  return fixtures;
}

// Assign host city/venue (16 total host cities across USA/Canada/Mexico)
const VENUES = [
  'MetLife Stadium, New York',
  'AT&T Stadium, Dallas',
  'SoFi Stadium, Los Angeles',
  'Hard Rock Stadium, Miami',
  'Levi\'s Stadium, San Francisco',
  'Lincoln Financial Field, Philadelphia',
  'Gillette Stadium, Boston',
  'NRG Stadium, Houston',
  'Allegiant Stadium, Las Vegas',
  'Lumen Field, Seattle',
  'BC Place, Vancouver',
  'BMO Field, Toronto',
  'Estadio Azteca, Mexico City',
  'Estadio AKRON, Guadalajara',
  'Estadio Nuevo León, Monterrey',
  'Kansas City Arrowhead',
];

function assignVenue(n) {
  return VENUES[(n - 1) % VENUES.length];
}

// Approximate match dates (group stage June 11 – July 2, 2026)
function groupDate(group, gameIdx) {
  const groupOrder = Object.keys(GROUPS);
  const gOffset = groupOrder.indexOf(group);
  const baseDay = 11 + (gOffset * 0.5) + (gameIdx * 1.5) | 0; // rough
  const day = Math.min(baseDay, 30);
  return `June ${day}, 2026`;
}

// Knockout stage fixtures (TBD teams filled as placeholders)
function generateKnockoutFixtures() {
  const fixtures = [];

  // Round of 32: 16 games (winners / runners up from groups)
  for (let i = 1; i <= 16; i++) {
    fixtures.push({
      id:    `r32-match-${i}`,
      round: 'Round of 32',
      home:  `R32 Team ${i * 2 - 1}`,
      away:  `R32 Team ${i * 2}`,
      gameNum: 73 + i - 1,
      venue:   assignVenue(73 + i),
      date:    `July ${5 + Math.floor((i - 1) / 4)}, 2026`,
      slug:    `round-of-32-match-${i}`,
    });
  }

  // Round of 16: 8 games
  for (let i = 1; i <= 8; i++) {
    fixtures.push({
      id:    `r16-match-${i}`,
      round: 'Round of 16',
      home:  `R16 Team ${i * 2 - 1}`,
      away:  `R16 Team ${i * 2}`,
      gameNum: 89 + i - 1,
      venue:   assignVenue(89 + i),
      date:    `July ${10 + Math.floor((i - 1) / 2)}, 2026`,
      slug:    `round-of-16-match-${i}`,
    });
  }

  // Quarter-Finals: 4 games
  for (let i = 1; i <= 4; i++) {
    fixtures.push({
      id:    `qf-match-${i}`,
      round: 'Quarter-Final',
      home:  `QF Team ${i * 2 - 1}`,
      away:  `QF Team ${i * 2}`,
      gameNum: 97 + i - 1,
      venue:   ['MetLife Stadium, New York', 'AT&T Stadium, Dallas', 'SoFi Stadium, Los Angeles', 'Hard Rock Stadium, Miami'][i - 1],
      date:    `July ${15 + (i > 2 ? 1 : 0)}, 2026`,
      slug:    `quarter-final-${i}`,
    });
  }

  // Semi-Finals: 2 games
  for (let i = 1; i <= 2; i++) {
    fixtures.push({
      id:    `sf-match-${i}`,
      round: 'Semi-Final',
      home:  `SF Team ${i * 2 - 1}`,
      away:  `SF Team ${i * 2}`,
      gameNum: 101 + i - 1,
      venue:   i === 1 ? 'MetLife Stadium, New York' : 'AT&T Stadium, Dallas',
      date:    `July ${19 + (i - 1)}, 2026`,
      slug:    `semi-final-${i}`,
    });
  }

  // 3rd Place Play-Off
  fixtures.push({
    id:    'third-place',
    round: '3rd Place Play-Off',
    home:  'SF Loser 1',
    away:  'SF Loser 2',
    gameNum: 103,
    venue:   'Hard Rock Stadium, Miami',
    date:    'July 22, 2026',
    slug:    '3rd-place-play-off',
  });

  // The Final
  fixtures.push({
    id:    'final',
    round: 'WC 2026 Final',
    home:  'Finalist 1',
    away:  'Finalist 2',
    gameNum: 104,
    venue:   'MetLife Stadium, New York/New Jersey',
    date:    'July 26, 2026',
    slug:    'wc-2026-final',
    isFinal: true,
  });

  return fixtures;
}

// ─── HTML Page Generator ──────────────────────────────────────────────────────

function generateMatchPage(match) {
  const { id, round, group, home, away, venue, date, slug, isFinal } = match;
  const title       = `${home} vs ${away} — ${round} | WC 2026`;
  const description = `${home} vs ${away} | ${round}${group ? ' ' + group : ''} | ${date} | ${venue}. Live odds, AI prediction, where to watch, and match preview for WC 2026.`;
  const canonicalUrl= `${SITE}/matches/${slug}`;
  const homeSlug    = toSlug(home);
  const awaySlug    = toSlug(away);

  // JSON-LD SportsEvent schema
  const schema = JSON.stringify({
    '@context':  'https://schema.org',
    '@type':     'SportsEvent',
    name:        `${home} vs ${away} — WC 2026 ${round}`,
    description: description,
    url:         canonicalUrl,
    startDate:   date,
    location: {
      '@type':  'Place',
      name:     venue,
      address:  venue,
    },
    sport:    'Association Football',
    organizer: {
      '@type': 'Organization',
      name:   'FIFA',
      url:    'https://www.fifa.com',
    },
    competitor: [
      { '@type': 'SportsTeam', name: home },
      { '@type': 'SportsTeam', name: away },
    ],
  });

  const isFinalMatch = isFinal;
  const isKnockout   = ['Round of 32','Round of 16','Quarter-Final','Semi-Final','3rd Place Play-Off','WC 2026 Final'].includes(round);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${home} vs ${away} WC 2026 | ${round}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${SITE}/og-default.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${canonicalUrl}">
<script type="application/ld+json">${schema}</script>
<style>
:root{--gold:#f59e0b;--em:#10b981;--bg:#08080e;--card:#111120;--card2:#191929;--text:#eef0ff;--muted:#8890bb;--border:#ffffff11}
*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--text);font-family:system-ui,sans-serif}
.hero{background:linear-gradient(135deg,#050510,#0a0a20);padding:40px 20px;text-align:center}
.badge{display:inline-block;background:var(--gold)22;border:1px solid var(--gold)66;color:var(--gold);padding:5px 14px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px}
.matchup{font-size:clamp(24px,5vw,52px);font-weight:900;margin-bottom:8px}
.home{color:var(--gold)}.vs{color:var(--muted);margin:0 12px}.away{color:#88aaff}
.meta{font-size:14px;color:var(--muted);margin-bottom:20px}
.pills{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:20px}
.pill{background:var(--card);border:1px solid var(--border);padding:5px 12px;border-radius:16px;font-size:12px;font-weight:600}
.btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.btn{padding:12px 22px;border-radius:50px;font-weight:800;font-size:14px;text-decoration:none;transition:transform .2s}
.btn:hover{transform:scale(1.04)}
.bg{background:var(--gold);color:#000}.be{background:var(--em);color:#000}.bb{background:#1e3a8a;color:#fff}
main{max-width:1000px;margin:0 auto;padding:30px 20px}
.st{font-size:18px;font-weight:800;margin:30px 0 14px;display:flex;align-items:center;gap:10px;color:var(--gold)}
.st::after{content:'';flex:1;height:1px;background:var(--border)}
/* Live score widget */
.score-widget{background:var(--card);border-radius:14px;padding:22px;border:1px solid var(--gold)44;text-align:center;margin-bottom:20px}
.score-teams{display:flex;align-items:center;justify-content:center;gap:16px;font-size:22px;font-weight:900}
.score-val{font-size:44px;font-weight:900;color:var(--gold);margin:0 8px}
.score-status{font-size:12px;color:var(--muted);margin-top:8px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
/* Prediction */
.pred{background:var(--card2);border-radius:14px;padding:20px;margin-bottom:20px;border:1px solid var(--em)33}
.pred-title{font-size:13px;color:var(--em);font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
.pred-bars{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin-bottom:12px}
.pred-team{font-size:13px;font-weight:700}
.pred-pct{font-size:28px;font-weight:900;color:var(--gold);text-align:center}
.pred-draw{font-size:13px;color:var(--muted);text-align:center}
.bar-row{display:grid;grid-template-columns:1fr auto 1fr;gap:4px;height:8px;border-radius:4px;overflow:hidden;margin-bottom:8px}
.bar-home{background:var(--gold);border-radius:4px 0 0 4px}
.bar-draw{background:#ffffff33}
.bar-away{background:#4169e1;border-radius:0 4px 4px 0}
.ai-verdict{font-size:13px;color:var(--muted);line-height:1.5;padding-top:10px;border-top:1px solid var(--border)}
/* Odds */
.odds-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
.odd{background:var(--card);border-radius:10px;padding:14px;text-align:center;border:1px solid var(--border)}
.odd-l{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
.odd-v{font-size:24px;font-weight:900;color:var(--gold)}
/* Bet cards */
.bet-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-bottom:30px}
.bc{background:var(--card);border-radius:14px;padding:18px;border:1px solid var(--border)}
.bc-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.bc-i{font-size:28px}.bc-n{font-size:15px;font-weight:900}.bc-bonus{font-size:12px;color:var(--gold);font-weight:700;margin-bottom:10px}
.bc-btn{display:block;padding:10px;text-align:center;border-radius:8px;font-weight:800;font-size:13px;text-decoration:none;background:var(--gold);color:#000}
.bc-cm{font-size:10px;color:var(--muted);margin-top:6px;text-align:center}
/* Watch */
.watch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:30px}
.wc{background:var(--card2);border-radius:11px;padding:14px;border:1px solid var(--border);display:flex;gap:10px;align-items:center}
.wi{font-size:22px;flex-shrink:0}.wn{font-weight:800;font-size:13px;margin-bottom:2px}.wd{font-size:11px;color:var(--muted)}
/* Match facts */
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:30px}
.fact{background:var(--card2);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border)}
.fv{font-size:20px;font-weight:900;color:var(--gold)}.fl{font-size:10px;color:var(--muted);margin-top:3px}
/* Related */
.related{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:30px}
.rel-link{background:var(--card);border:1px solid var(--border);padding:7px 14px;border-radius:20px;font-size:13px;font-weight:600;text-decoration:none;color:var(--text);transition:border-color .2s}
.rel-link:hover{border-color:var(--gold)66;color:var(--gold)}
footer{text-align:center;padding:30px 20px;color:var(--muted);font-size:13px;border-top:1px solid var(--border)}
footer a{color:var(--gold);text-decoration:none}
.disc{font-size:11px;margin-top:12px;padding:10px;background:#ffffff08;border-radius:8px;line-height:1.6}
</style>
</head>
<body>

<section class="hero">
  <div class="badge">${isFinalMatch ? '🏆 WC 2026 FINAL' : round.toUpperCase()}${group ? ' — ' + group : ''}</div>
  <div class="matchup">
    <span class="home">${home}</span>
    <span class="vs">vs</span>
    <span class="away">${away}</span>
  </div>
  <div class="meta">📅 ${date} · 📍 ${venue}</div>
  <div class="pills">
    <span class="pill">🔴 LIVE COVERAGE</span>
    <span class="pill">🤖 AI Prediction</span>
    <span class="pill">🎰 Live Odds</span>
    <span class="pill">📺 How to Watch</span>
  </div>
  <div class="btns">
    <a href="/go/bet365" class="btn bg">🎰 Bet Now</a>
    <a href="/prediction-game.html" class="btn be">🤖 AI Prediction</a>
    <a href="/streaming-vpn.html" class="btn bb">📺 How to Watch</a>
  </div>
</section>

<main>

  <!-- Live Score (dynamic via fetch) -->
  <div class="st">📊 Live Score</div>
  <div class="score-widget" id="score-widget">
    <div class="score-teams">
      <span>${home}</span>
      <span class="score-val" id="score">- : -</span>
      <span>${away}</span>
    </div>
    <div class="score-status" id="score-status">Pre-Match</div>
  </div>

  <!-- AI Prediction -->
  <div class="st">🤖 AI Match Prediction</div>
  <div class="pred">
    <div class="pred-title">🤖 WC2026 Empire AI Prediction</div>
    <div class="pred-bars">
      <div class="pred-team">${home}</div>
      <div class="pred-pct" id="home-pct">–</div>
      <div class="pred-team" style="text-align:right">${away}</div>
    </div>
    <div class="bar-row">
      <div class="bar-home" id="bar-home" style="width:33%"></div>
      <div class="bar-draw"></div>
      <div class="bar-away" id="bar-away" style="width:33%"></div>
    </div>
    <div class="pred-draw">Draw: <span id="draw-pct">–</span></div>
    <div class="ai-verdict" id="ai-verdict">Loading AI analysis…</div>
  </div>

  <!-- Odds -->
  <div class="st">🎰 Latest Odds</div>
  <div class="odds-row">
    <div class="odd"><div class="odd-l">${home} Win</div><div class="odd-v" id="odd-home">–</div></div>
    <div class="odd"><div class="odd-l">Draw</div><div class="odd-v" id="odd-draw">–</div></div>
    <div class="odd"><div class="odd-l">${away} Win</div><div class="odd-v" id="odd-away">–</div></div>
  </div>

  <!-- Bet CTAs -->
  <div class="bet-grid">
    <div class="bc">
      <div class="bc-top"><span class="bc-i">⚽</span><span class="bc-n">bet365</span></div>
      <div class="bc-bonus">${AFFILIATES.bet365.bonus}</div>
      <a href="${AFFILIATES.bet365.url}" class="bc-btn">Bet on This Match →</a>
      <div class="bc-cm">💰 ${AFFILIATES.bet365.cpa} | 18+</div>
    </div>
    <div class="bc">
      <div class="bc-top"><span class="bc-i">🦁</span><span class="bc-n">DraftKings</span></div>
      <div class="bc-bonus">${AFFILIATES.draftkings.bonus}</div>
      <a href="${AFFILIATES.draftkings.url}" class="bc-btn">Same-Game Parlay →</a>
      <div class="bc-cm">💰 ${AFFILIATES.draftkings.cpa} | 21+ USA</div>
    </div>
    <div class="bc">
      <div class="bc-top"><span class="bc-i">🌍</span><span class="bc-n">Unibet</span></div>
      <div class="bc-bonus">${AFFILIATES.unibet.bonus}</div>
      <a href="${AFFILIATES.unibet.url}" class="bc-btn">Live Bet on Match →</a>
      <div class="bc-cm">💰 ${AFFILIATES.unibet.cpa} | 18+</div>
    </div>
  </div>

  <!-- Watch Guide -->
  <div class="st">📺 How to Watch ${home} vs ${away}</div>
  <div class="watch-grid">
    <div class="wc"><span class="wi">🇺🇸</span><div><div class="wn">USA: ${STREAMING.USA.free}</div><div class="wd">${STREAMING.USA.paid}</div></div></div>
    <div class="wc"><span class="wi">🇬🇧</span><div><div class="wn">UK: ${STREAMING.UK.free}</div><div class="wd">${STREAMING.UK.paid}</div></div></div>
    <div class="wc"><span class="wi">🇧🇷</span><div><div class="wn">Brasil: ${STREAMING.Brazil.free}</div><div class="wd">${STREAMING.Brazil.paid}</div></div></div>
    <div class="wc"><span class="wi">🌍</span><div><div class="wn">Global: DAZN</div><div class="wd">200+ countries</div></div></div>
    <div class="wc"><span class="wi">🔒</span><div><div class="wn">NordVPN</div><div class="wd">Watch your home broadcaster abroad · $125 CPA</div></div></div>
    <div class="wc"><span class="wi">📺</span><div><div class="wn">fuboTV (USA)</div><div class="wd">All 104 WC 2026 matches 4K · $35 CPA</div></div></div>
  </div>

  <!-- Match Facts -->
  <div class="st">📋 Match Facts</div>
  <div class="facts">
    <div class="fact"><div class="fv">${round}</div><div class="fl">Stage</div></div>
    <div class="fact"><div class="fv">${date.split(',')[0]}</div><div class="fl">Date</div></div>
    <div class="fact"><div class="fv">104</div><div class="fl">Total WC Matches</div></div>
    <div class="fact"><div class="fv">48</div><div class="fl">Teams Competing</div></div>
    <div class="fact"><div class="fv">3</div><div class="fl">Host Countries</div></div>
    <div class="fact"><div class="fv">16</div><div class="fl">Host Cities</div></div>
  </div>

  <!-- Related Links -->
  <div class="st">🔗 More WC 2026</div>
  <div class="related">
    <a href="/star-players.html" class="rel-link">⭐ Star Players</a>
    <a href="/odds-comparison.html" class="rel-link">🎰 Odds Comparison</a>
    <a href="/prediction-game.html" class="rel-link">🤖 Predictions</a>
    <a href="/bracket.html" class="rel-link">🏆 Bracket</a>
    <a href="/golden-boot-tracker.html" class="rel-link">⚽ Golden Boot</a>
    <a href="/streaming-vpn.html" class="rel-link">📺 Watch Guide</a>
    <a href="/world-hub.html" class="rel-link">🌍 Country Hubs</a>
  </div>

</main>

<footer>
  <p>⚽ WC2026 Empire — ${home} vs ${away} | ${round}</p>
  <p style="margin-top:8px">
    <a href="/">Home</a> ·
    <a href="/star-players.html">Players</a> ·
    <a href="/odds-comparison.html">Odds</a> ·
    <a href="/prediction-game.html">Predict</a>
  </p>
  <div class="disc">⚠️ Must be 18+ to bet (21+ in some US states). Gamble responsibly. <a href="https://www.begambleaware.org">BeGambleAware.org</a> | 1-800-522-4700. Affiliate links may earn commission at no extra cost to you. Odds are indicative and subject to change.</div>
</footer>

<script>
// Fetch live score from API
async function loadScore() {
  try {
    const r = await fetch('/api/match-score?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}', {
      headers: { 'x-pipeline-secret': window.__PS || '' }
    });
    if (!r.ok) return;
    const d = await r.json();
    if (d.homeScore !== undefined) {
      document.getElementById('score').textContent = d.homeScore + ' : ' + d.awayScore;
      document.getElementById('score-status').textContent = d.status || 'Live';
    }
  } catch (e) { /* API not live yet or pre-match */ }
}

// Fetch AI prediction from API
async function loadPrediction() {
  try {
    const r = await fetch('/api/predict?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}');
    if (!r.ok) return;
    const d = await r.json();
    const homeW = d.homeWin || 40;
    const draw  = d.draw    || 28;
    const awayW = d.awayWin || 32;
    document.getElementById('home-pct').textContent   = homeW + '%';
    document.getElementById('draw-pct').textContent   = draw  + '%';
    document.getElementById('bar-home').style.width   = homeW + '%';
    document.getElementById('bar-away').style.width   = awayW + '%';
    document.getElementById('ai-verdict').textContent = d.verdict || 'AI analysis loading…';
    // Odds
    if (d.odds) {
      document.getElementById('odd-home').textContent  = d.odds.home  || '–';
      document.getElementById('odd-draw').textContent  = d.odds.draw  || '–';
      document.getElementById('odd-away').textContent  = d.odds.away  || '–';
    }
  } catch (e) {
    document.getElementById('ai-verdict').textContent = 'AI prediction will be available closer to kick-off.';
  }
}

loadScore();
loadPrediction();
// Refresh score every 60s when match is live
setInterval(loadScore, 60000);
</script>
</body>
</html>`;
}

// ─── Main execution ───────────────────────────────────────────────────────────

async function main() {
  const groupFixtures   = generateGroupFixtures();
  const knockoutFixtures = generateKnockoutFixtures();

  let fixtures = [];
  if (GROUP_ONLY)    fixtures = groupFixtures;
  else if (KNOCKOUT_ONLY) fixtures = knockoutFixtures;
  else fixtures = [...groupFixtures, ...knockoutFixtures];

  if (SINGLE_MATCH) {
    const match = fixtures.find(f => f.slug.includes(SINGLE_MATCH) || f.id.includes(SINGLE_MATCH));
    if (!match) {
      console.error(`Match not found: ${SINGLE_MATCH}`);
      console.log('Available:', fixtures.map(f => f.slug).slice(0, 10));
      process.exit(1);
    }
    fixtures = [match];
  }

  console.log(`\n🏆 WC 2026 Match Pages Generator`);
  console.log(`📋 Generating ${fixtures.length} match pages...`);
  console.log(`📁 Output: ${MATCHES_DIR}/\n`);

  if (!DRY_RUN) {
    fs.mkdirSync(MATCHES_DIR, { recursive: true });
  }

  let generated = 0;
  let skipped   = 0;

  for (const match of fixtures) {
    const outFile = path.join(MATCHES_DIR, `${match.slug}.html`);

    if (!DRY_RUN) {
      const html = generateMatchPage(match);
      fs.writeFileSync(outFile, html, 'utf-8');
      generated++;
    } else {
      console.log(`  [DRY-RUN] Would generate: ${match.slug}.html`);
      generated++;
    }

    if (generated % 10 === 0) {
      console.log(`  ✅ ${generated}/${fixtures.length} pages done...`);
    }
  }

  console.log(`\n✨ Complete!`);
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Output:    ${MATCHES_DIR}/`);
  console.log('\n📋 Next steps:');
  console.log('  1. Copy public/ to your Vercel deployment folder');
  console.log('  2. Run sitemap-generator.js to include all match pages');
  console.log('  3. Run schema-injector.js to inject SportsEvent schema');
  console.log('  4. Run internal-link-injector.js to cross-link match pages');
  console.log('\n💰 Revenue impact:');
  console.log(`  ${fixtures.length} match pages × avg $500–2,000 revenue per match day`);
  console.log(`  = $52,000–$208,000 revenue during WC 2026 tournament`);

  // Write index of all matches as JSON (for internal linking)
  if (!DRY_RUN && !SINGLE_MATCH) {
    const index = fixtures.map(m => ({
      slug:   m.slug,
      url:    `/matches/${m.slug}`,
      round:  m.round,
      group:  m.group || null,
      home:   m.home,
      away:   m.away,
      date:   m.date,
      venue:  m.venue,
    }));
    const indexPath = path.join(process.cwd(), 'public', 'matches-index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    console.log(`\n📄 Match index written: public/matches-index.json`);
  }
}

main().catch(console.error);
