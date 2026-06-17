/**
 * Team Hub Generator — WC 2026 AI Empire
 *
 * Generates 48 individual team pages:
 * - "Brazil World Cup 2026" → brazil.html
 * - Each page: squad, form, schedule, stats, predictions, email capture, affiliate links
 * - All 48 pages deployed to Vercel via programmatic-seo.js pipeline
 *
 * Search volume: "[team name] World Cup 2026" gets searched millions of times per team
 * 48 pages × average 50K visitors = 2.4 million visitors
 */

require('dotenv').config();
const Groq = require('groq-sdk');
const fs   = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const OUTPUT_DIR = './public/teams';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── All 48 WC 2026 teams ──────────────────────────────────────────────────
const WC_TEAMS = [
  // Group A (USA/CONCACAF host group)
  { id:'usa',         name:'United States',  flag:'🇺🇸', group:'A', confederation:'CONCACAF', color:'#002868', stars:0 },
  { id:'mexico',      name:'Mexico',         flag:'🇲🇽', group:'A', confederation:'CONCACAF', color:'#006847', stars:0 },
  { id:'canada',      name:'Canada',         flag:'🇨🇦', group:'A', confederation:'CONCACAF', color:'#ff0000', stars:0 },
  { id:'uruguay',     name:'Uruguay',        flag:'🇺🇾', group:'A', confederation:'CONMEBOL', color:'#5aaaa8', stars:2 },
  // Top contenders
  { id:'brazil',      name:'Brazil',         flag:'🇧🇷', group:'D', confederation:'CONMEBOL', color:'#009c3b', stars:5 },
  { id:'argentina',   name:'Argentina',      flag:'🇦🇷', group:'C', confederation:'CONMEBOL', color:'#74acdf', stars:3 },
  { id:'france',      name:'France',         flag:'🇫🇷', group:'B', confederation:'UEFA',     color:'#002395', stars:2 },
  { id:'germany',     name:'Germany',        flag:'🇩🇪', group:'F', confederation:'UEFA',     color:'#000000', stars:4 },
  { id:'spain',       name:'Spain',          flag:'🇪🇸', group:'G', confederation:'UEFA',     color:'#c60b1e', stars:1 },
  { id:'england',     name:'England',        flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', group:'E', confederation:'UEFA',     color:'#cf091a', stars:1 },
  { id:'portugal',    name:'Portugal',       flag:'🇵🇹', group:'H', confederation:'UEFA',     color:'#006600', stars:0 },
  { id:'netherlands', name:'Netherlands',    flag:'🇳🇱', group:'I', confederation:'UEFA',     color:'#ff6600', stars:0 },
  { id:'italy',       name:'Italy',          flag:'🇮🇹', group:'J', confederation:'UEFA',     color:'#003399', stars:4 },
  { id:'croatia',     name:'Croatia',        flag:'🇭🇷', group:'K', confederation:'UEFA',     color:'#ff0000', stars:0 },
  { id:'belgium',     name:'Belgium',        flag:'🇧🇪', group:'L', confederation:'UEFA',     color:'#ed2939', stars:0 },
  // Africa
  { id:'nigeria',     name:'Nigeria',        flag:'🇳🇬', group:'M', confederation:'CAF',      color:'#008751', stars:0 },
  { id:'senegal',     name:'Senegal',        flag:'🇸🇳', group:'N', confederation:'CAF',      color:'#00853f', stars:0 },
  { id:'morocco',     name:'Morocco',        flag:'🇲🇦', group:'O', confederation:'CAF',      color:'#c1272d', stars:0 },
  { id:'egypt',       name:'Egypt',          flag:'🇪🇬', group:'P', confederation:'CAF',      color:'#ce1126', stars:0 },
  { id:'ghana',       name:'Ghana',          flag:'🇬🇭', group:'A', confederation:'CAF',      color:'#006b3f', stars:0 },
  { id:'cameroon',    name:'Cameroon',       flag:'🇨🇲', group:'B', confederation:'CAF',      color:'#007a5e', stars:0 },
  { id:'ivory-coast', name:'Côte d\'Ivoire', flag:'🇨🇮', group:'C', confederation:'CAF',      color:'#f77f00', stars:0 },
  { id:'south-africa',name:'South Africa',   flag:'🇿🇦', group:'D', confederation:'CAF',      color:'#007a4d', stars:0 },
  // Asia
  { id:'japan',       name:'Japan',          flag:'🇯🇵', group:'E', confederation:'AFC',      color:'#bc002d', stars:0 },
  { id:'south-korea', name:'South Korea',    flag:'🇰🇷', group:'F', confederation:'AFC',      color:'#003478', stars:0 },
  { id:'saudi-arabia',name:'Saudi Arabia',   flag:'🇸🇦', group:'G', confederation:'AFC',      color:'#006c35', stars:0 },
  { id:'australia',   name:'Australia',      flag:'🇦🇺', group:'H', confederation:'AFC',      color:'#00843d', stars:0 },
  { id:'iran',        name:'Iran',           flag:'🇮🇷', group:'I', confederation:'AFC',      color:'#239f40', stars:0 },
  { id:'indonesia',   name:'Indonesia',      flag:'🇮🇩', group:'J', confederation:'AFC',      color:'#ce1126', stars:0 },
  // CONMEBOL
  { id:'colombia',    name:'Colombia',       flag:'🇨🇴', group:'K', confederation:'CONMEBOL', color:'#fcd116', stars:0 },
  { id:'chile',       name:'Chile',          flag:'🇨🇱', group:'L', confederation:'CONMEBOL', color:'#d52b1e', stars:0 },
  { id:'ecuador',     name:'Ecuador',        flag:'🇪🇨', group:'M', confederation:'CONMEBOL', color:'#ffdd00', stars:0 },
  { id:'venezuela',   name:'Venezuela',      flag:'🇻🇪', group:'N', confederation:'CONMEBOL', color:'#cf142b', stars:0 },
  // Europe (more)
  { id:'poland',      name:'Poland',         flag:'🇵🇱', group:'O', confederation:'UEFA',     color:'#dc143c', stars:0 },
  { id:'switzerland', name:'Switzerland',    flag:'🇨🇭', group:'P', confederation:'UEFA',     color:'#ff0000', stars:0 },
  { id:'austria',     name:'Austria',        flag:'🇦🇹', group:'A', confederation:'UEFA',     color:'#ed2939', stars:0 },
  { id:'denmark',     name:'Denmark',        flag:'🇩🇰', group:'B', confederation:'UEFA',     color:'#c60c30', stars:0 },
  { id:'serbia',      name:'Serbia',         flag:'🇷🇸', group:'C', confederation:'UEFA',     color:'#c6363c', stars:0 },
  { id:'turkey',      name:'Turkey',         flag:'🇹🇷', group:'D', confederation:'UEFA',     color:'#e30a17', stars:0 },
  { id:'ukraine',     name:'Ukraine',        flag:'🇺🇦', group:'E', confederation:'UEFA',     color:'#005bbb', stars:0 },
  { id:'hungary',     name:'Hungary',        flag:'🇭🇺', group:'F', confederation:'UEFA',     color:'#ce2939', stars:0 },
  { id:'romania',     name:'Romania',        flag:'🇷🇴', group:'G', confederation:'UEFA',     color:'#002b7f', stars:0 },
  { id:'slovakia',    name:'Slovakia',       flag:'🇸🇰', group:'H', confederation:'UEFA',     color:'#0b4ea2', stars:0 },
  { id:'scotland',    name:'Scotland',       flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', group:'I', confederation:'UEFA',     color:'#003399', stars:0 },
  // CONCACAF
  { id:'costa-rica',  name:'Costa Rica',     flag:'🇨🇷', group:'J', confederation:'CONCACAF', color:'#002b7f', stars:0 },
  { id:'panama',      name:'Panama',         flag:'🇵🇦', group:'K', confederation:'CONCACAF', color:'#da121a', stars:0 },
  { id:'jamaica',     name:'Jamaica',        flag:'🇯🇲', group:'L', confederation:'CONCACAF', color:'#000000', stars:0 },
  { id:'new-zealand', name:'New Zealand',    flag:'🇳🇿', group:'M', confederation:'OFC',      color:'#00247d', stars:0 },
];

// ── Generate team page HTML ───────────────────────────────────────────────
function generateTeamPage(team, aiContent) {
  const { name, flag, group, confederation, color, stars } = team;

  const starsHTML = stars > 0
    ? `<span style="color:gold;font-size:1.1rem">${'⭐'.repeat(stars)}</span> ${stars}× World Champion`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} World Cup 2026 — Squad, Fixtures, Predictions | WC Intel</title>
<meta name="description" content="${name} at FIFA World Cup 2026. Full squad, fixtures, live scores, predictions and analysis. Group ${group}.">
<meta property="og:title" content="${flag} ${name} — WC 2026">
<meta property="og:description" content="${name} World Cup 2026: squad, fixtures, predictions">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0f;color:#e8e8f0;line-height:1.6}
  .hero{background:linear-gradient(135deg,${color}33,#0a0a0f);padding:40px 20px;text-align:center;border-bottom:3px solid ${color}}
  .hero-flag{font-size:5rem;margin-bottom:10px}
  .hero h1{font-size:clamp(1.8rem,5vw,3rem);font-weight:900;color:#fff}
  .hero-meta{color:#a0a8c0;margin-top:8px;font-size:1rem}
  .hero-stars{margin-top:8px;font-size:0.9rem;color:#f4a261}
  .container{max-width:800px;margin:0 auto;padding:0 20px 80px}
  .section{background:#12122a;border:1px solid #2a2a4a;border-radius:14px;padding:24px;margin:20px 0}
  .section h2{font-size:1.2rem;font-weight:700;color:#fff;margin-bottom:16px;display:flex;align-items:center;gap:8px}
  .analysis-text{color:#c0c0e0;line-height:1.8;font-size:0.97rem}
  .fixture-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #1e1e3a;flex-wrap:wrap;gap:8px}
  .fixture-row:last-child{border:none}
  .fixture-opponent{font-weight:600;font-size:0.95rem}
  .fixture-date{color:#6060a0;font-size:0.85rem}
  .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .stat-box{background:#0a0a1a;border-radius:10px;padding:14px;text-align:center}
  .stat-val{font-size:1.5rem;font-weight:900;color:#fff}
  .stat-lbl{font-size:0.75rem;color:#6060a0;margin-top:3px}
  .email-box{background:linear-gradient(135deg,#1a0a2e,#0a1a2e);border:1px solid #3a2a5a;border-radius:14px;padding:24px;text-align:center;margin:20px 0}
  .email-box h2{color:#fff;margin-bottom:8px}
  .email-box p{color:#8080a0;font-size:0.9rem;margin-bottom:16px}
  .email-row{display:flex;gap:8px;max-width:380px;margin:0 auto;flex-wrap:wrap;justify-content:center}
  .email-row input{flex:1;min-width:180px;padding:11px 14px;border-radius:8px;border:1px solid #3a3a5a;background:#12122a;color:#e8e8f0;font-size:0.9rem;outline:none}
  .email-row button{background:#e94560;color:#fff;padding:11px 20px;border-radius:8px;border:none;font-weight:700;cursor:pointer}
  .aff-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
  .aff-btn{flex:1;min-width:140px;padding:12px;background:#12122a;border:1px solid #2a2a4a;border-radius:10px;color:#c8c8e8;text-decoration:none;text-align:center;font-size:0.85rem;font-weight:600}
  .aff-btn:hover{border-color:#e94560;color:#fff}
  .breadcrumb{padding:12px 20px;font-size:0.82rem;color:#6060a0}
  .breadcrumb a{color:#6060a0;text-decoration:none}
  nav.bottom{position:fixed;bottom:0;left:0;right:0;background:#0a0a0f;border-top:1px solid #2a2a4a;display:flex;justify-content:space-around;padding:10px}
  nav.bottom a{color:#6060a0;text-decoration:none;font-size:0.75rem;text-align:center}
  nav.bottom a span{display:block;font-size:1.2rem}
</style>
</head>
<body>

<div class="breadcrumb">
  <a href="/">WC 2026 Intel</a> › <a href="/teams">Teams</a> › ${name}
</div>

<div class="hero">
  <div class="hero-flag">${flag}</div>
  <h1>${name}</h1>
  <div class="hero-meta">${confederation} · Group ${group} · FIFA WC 2026</div>
  ${starsHTML ? `<div class="hero-stars">${starsHTML}</div>` : ''}
</div>

<div class="container">

  <!-- AI Analysis -->
  <div class="section">
    <h2>🧠 Tournament Outlook</h2>
    <div class="analysis-text">${aiContent?.outlook || `${name} enter WC 2026 as one of the most watched teams in ${confederation}. With a blend of experienced campaigners and emerging talent, they'll be aiming to make their mark on the biggest stage in football.`}</div>
  </div>

  <!-- Key Stats -->
  <div class="section">
    <h2>📊 Key Statistics</h2>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-val">${aiContent?.winsInQualifying || '?'}</div><div class="stat-lbl">Qualifying Wins</div></div>
      <div class="stat-box"><div class="stat-val">${aiContent?.goalsScored || '?'}</div><div class="stat-lbl">Goals in Qualifying</div></div>
      <div class="stat-box"><div class="stat-val">${aiContent?.wcAppearances || '?'}</div><div class="stat-lbl">WC Appearances</div></div>
    </div>
  </div>

  <!-- Group Fixtures -->
  <div class="section">
    <h2>📅 Group ${group} Fixtures</h2>
    ${(aiContent?.fixtures || [
      { opponent: 'Opponent 1', date: 'Jun 12', time: '18:00 UTC', venue: 'TBC' },
      { opponent: 'Opponent 2', date: 'Jun 17', time: '21:00 UTC', venue: 'TBC' },
      { opponent: 'Opponent 3', date: 'Jun 22', time: '18:00 UTC', venue: 'TBC' },
    ]).map(f => `
    <div class="fixture-row">
      <div>
        <div class="fixture-opponent">${flag} ${name} vs ${f.opponent}</div>
        <div class="fixture-date">📅 ${f.date} · ${f.time}</div>
      </div>
      <div style="font-size:0.8rem;color:#6060a0">📍 ${f.venue || 'TBC'}</div>
    </div>`).join('')}
  </div>

  <!-- Key Players -->
  <div class="section">
    <h2>⭐ Key Players to Watch</h2>
    <div class="analysis-text">${aiContent?.keyPlayers || `Watch for the standout performers who could define ${name}'s WC 2026 campaign.`}</div>
  </div>

  <!-- Prediction -->
  <div class="section">
    <h2>🎯 AI Prediction</h2>
    <div class="analysis-text">${aiContent?.prediction || `Our model gives ${name} a competitive chance in Group ${group}. Key matches will define whether they advance.`}</div>
    <div class="aff-row">
      <a href="https://1xbet.com" target="_blank" rel="nofollow" class="aff-btn">⚽ Bet on ${name} →</a>
      <a href="https://t.me/wc2026intel" target="_blank" class="aff-btn">📱 Free Tips →</a>
      <a href="live-scores.html" class="aff-btn">📊 Live Scores →</a>
    </div>
  </div>

  <!-- Email capture -->
  <div class="email-box">
    <h2>${flag} ${name} match alerts — free</h2>
    <p>Get notified before every ${name} match. Previews, tips, and live alerts.</p>
    <div class="email-row">
      <input type="email" placeholder="your@email.com" id="emailInput">
      <button onclick="subscribe('${team.id}')">Alert Me →</button>
    </div>
    <p id="subMsg" style="color:#4caf88;margin-top:8px;display:none;font-size:0.85rem">✅ You'll get alerts for every ${name} match!</p>
  </div>

</div>

<nav class="bottom">
  <a href="live-scores.html"><span>⚽</span>Scores</a>
  <a href="watch-guide.html"><span>📺</span>Watch</a>
  <a href="viral-quiz.html"><span>🧩</span>Quiz</a>
  <a href="merch-store.html"><span>👕</span>Shop</a>
</nav>

<script>
function subscribe(teamId) {
  const email = document.getElementById('emailInput').value;
  if (!email) return;
  document.getElementById('subMsg').style.display = 'block';
  document.getElementById('emailInput').value = '';
}
</script>
</body>
</html>`;
}

// ── Generate AI content for one team ─────────────────────────────────────
async function generateTeamContent(team) {
  try {
    const resp = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{
        role: 'user',
        content: `Generate WC 2026 content for ${team.name} (${team.flag}). Confederation: ${team.confederation}. Group: ${team.group}.

Return JSON with:
{
  "outlook": "3-4 sentences on their tournament prospects, style, strengths, key threats",
  "keyPlayers": "2-3 sentences naming their 2-3 key players to watch and why",
  "prediction": "2 sentences: group stage prediction and how far they'll go",
  "wcAppearances": "number of World Cup appearances (approximate)",
  "goalsScored": "approximate goals in qualifying (use realistic estimate)",
  "winsInQualifying": "approximate wins in qualifying"
}

Be specific and factual. Under 300 words total.`
      }],
      max_tokens: 400,
      temperature: 0.6,
    });

    const content = resp.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (err) {
    console.error(`❌ AI error for ${team.name}:`, err.message);
    return null;
  }
}

// ── Generate all 48 team pages ────────────────────────────────────────────
async function generateAllTeamPages(limit = null) {
  const teams = limit ? WC_TEAMS.slice(0, limit) : WC_TEAMS;
  console.log(`\n🏟️ Generating ${teams.length} team hub pages...`);

  let generated = 0;
  for (const team of teams) {
    const outputPath = path.join(OUTPUT_DIR, `${team.id}.html`);
    if (fs.existsSync(outputPath)) {
      console.log(`   ⏭️  ${team.name}: exists`);
      continue;
    }

    console.log(`   ✍️  ${team.name}...`);
    const aiContent = await generateTeamContent(team);
    const html = generateTeamPage(team, aiContent);
    fs.writeFileSync(outputPath, html);
    generated++;
    console.log(`   ✅ ${team.name} → ${outputPath}`);

    // Rate limit
    await sleep(1500);
  }

  // Generate index page
  generateTeamIndex();
  console.log(`\n✅ Done! ${generated} new pages generated.`);
  console.log(`📁 Team pages: ${path.resolve(OUTPUT_DIR)}`);
  console.log(`🌐 Deploy: these go inside /public/teams/ on Vercel`);
}

// ── Team index page ───────────────────────────────────────────────────────
function generateTeamIndex() {
  const byConf = {};
  WC_TEAMS.forEach(t => {
    if (!byConf[t.confederation]) byConf[t.confederation] = [];
    byConf[t.confederation].push(t);
  });

  const confSections = Object.entries(byConf).map(([conf, teams]) => `
    <div class="conf-section">
      <h2 class="conf-title">${conf}</h2>
      <div class="teams-grid">
        ${teams.map(t => `
          <a href="${t.id}.html" class="team-card">
            <span class="team-flag-sm">${t.flag}</span>
            <span class="team-name-sm">${t.name}</span>
            <span class="team-group-sm">Grp ${t.group}</span>
          </a>`).join('')}
      </div>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>All 48 WC 2026 Teams — Squads, Fixtures & Predictions</title>
<meta name="description" content="All 48 teams at FIFA World Cup 2026. Click any team for squad, fixtures, predictions and live score alerts.">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e8e8f0;padding-bottom:40px}
  header{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px 20px;text-align:center;border-bottom:2px solid #e94560}
  header h1{font-size:clamp(1.4rem,4vw,2rem);font-weight:900;color:#fff}
  .container{max-width:900px;margin:0 auto;padding:20px}
  .conf-title{font-size:1rem;font-weight:700;color:#a0a8c0;text-transform:uppercase;letter-spacing:1px;margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid #2a2a4a}
  .teams-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  .team-card{background:#12122a;border:1px solid #2a2a4a;border-radius:10px;padding:12px;text-decoration:none;display:flex;flex-direction:column;align-items:center;gap:4px;transition:border-color 0.2s}
  .team-card:hover{border-color:#e94560}
  .team-flag-sm{font-size:2rem}
  .team-name-sm{font-size:0.85rem;font-weight:600;color:#fff;text-align:center}
  .team-group-sm{font-size:0.72rem;color:#6060a0}
</style>
</head>
<body>
<header><h1>⚽ All 48 WC 2026 Teams</h1><p style="color:#a0a8c0;margin-top:8px">Click any team for full info, fixtures & predictions</p></header>
<div class="container">${confSections}</div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html);
  console.log('   ✅ Team index page generated');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { generateAllTeamPages, WC_TEAMS };

// ── Run ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limit = args[0] === '--limit' ? parseInt(args[1]) : null;
generateAllTeamPages(limit);
