/**
 * YouTube Content Engine — WC 2026 AI Empire
 *
 * Auto-generates for every WC match:
 * - Video title (SEO-optimized, 10 languages)
 * - Script (full narration, 3-5 minutes)
 * - Description (YouTube SEO, affiliate links, timestamps)
 * - Tags (100 relevant tags)
 * - Thumbnail text (for Canva/DALL-E)
 *
 * Output: one JSON file per match per language
 * Use: manually upload OR connect YouTube Data API for auto-upload
 *
 * 104 matches × 10 languages = 1,040+ video packages generated automatically
 */

require('dotenv').config();
const Groq  = require('groq-sdk');
const axios = require('axios');
const fs    = require('fs');
const path  = require('path');
const cron  = require('node-cron');

const groq         = new Groq({ apiKey: process.env.GROQ_API_KEY });
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// ── Languages to generate for ─────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en',    name: 'English',    viewers: '1.5B' },
  { code: 'es',    name: 'Spanish',    viewers: '500M' },
  { code: 'pt',    name: 'Portuguese', viewers: '250M' },
  { code: 'fr',    name: 'French',     viewers: '280M' },
  { code: 'ar',    name: 'Arabic',     viewers: '400M' },
  { code: 'hi',    name: 'Hindi',      viewers: '600M' },
  { code: 'id',    name: 'Indonesian', viewers: '270M' },
  { code: 'sw',    name: 'Swahili',    viewers: '200M' },
  { code: 'tr',    name: 'Turkish',    viewers: '80M'  },
  { code: 'de',    name: 'German',     viewers: '90M'  },
];

// ── Affiliate links to include in descriptions ────────────────────────────
const AFFILIATE_LINKS = {
  en: {
    vpn:     { name: 'NordVPN', url: 'https://nordvpn.com', desc: '🔒 Watch WC 2026 from anywhere' },
    stream:  { name: 'ESPN+',   url: 'https://espnplus.com', desc: '📺 Stream every match' },
    tips:    { name: 'WC Intel Newsletter', url: 'https://wc2026intel.beehiiv.com', desc: '🗞️ Free daily picks' },
    bet:     { name: '1xBet',   url: 'https://1xbet.com',   desc: '⚽ Best WC odds' },
  },
  es: {
    vpn:     { name: 'NordVPN', url: 'https://nordvpn.com', desc: '🔒 Ve el Mundial desde cualquier lugar' },
    stream:  { name: 'ViX',     url: 'https://vix.com',     desc: '📺 Transmisión en vivo' },
    tips:    { name: 'WC Intel', url: 'https://wc2026intel.beehiiv.com', desc: '🗞️ Pronósticos gratis' },
    bet:     { name: '1xBet',   url: 'https://1xbet.com',   desc: '⚽ Mejores cuotas' },
  },
  // Other languages use English links as fallback
};

const OUTPUT_DIR = './youtube-scripts';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// ── Generate video script for one match in one language ───────────────────
async function generateMatchScript(match, lang) {
  const { home, away, date, venue, competition } = match;
  const langName  = lang.name;
  const kickoff   = new Date(date).toLocaleString('en-GB', { weekday:'long', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'UTC' });

  const prompt = `You are a professional football YouTube presenter. Generate content for WC 2026.

Match: ${home} vs ${away}
Date: ${kickoff} UTC
Venue: ${venue}
Language: ${langName}

Generate ALL of the following in ${langName}:

1. VIDEO_TITLE: (max 70 chars, SEO-optimized, includes WC 2026, team names, compelling word)

2. VIDEO_SCRIPT: (3-4 minute script, spoken word for voiceover)
Structure:
- Hook (15 sec): One dramatic sentence that makes viewer stay
- Team intro (45 sec): ${home}'s journey to this match, key players, form
- Team intro (45 sec): ${away}'s journey, key players, form
- Key battle (30 sec): The tactical matchup that decides the game
- Prediction (30 sec): Confident prediction with reasoning
- Call to action (15 sec): Subscribe + free newsletter link + Telegram

3. DESCRIPTION: (YouTube description, 300 words)
Include: match overview, key info, affiliate links, timestamps, hashtags

4. TAGS: (comma-separated, 50 tags)
Include: team names, player names, WC 2026, predictions, match, FIFA

5. THUMBNAIL_TEXT: (3-5 bold words for thumbnail graphic, creates curiosity)

Format as JSON with keys: title, script, description, tags, thumbnail_text`;

  try {
    const resp = await groq.chat.completions.create({
      model:      'llama3-70b-8192',
      messages:   [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const content = resp.choices[0].message.content;

    // Try to parse JSON, fallback to raw text
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { script: content };
    } catch (e) {
      parsed = { script: content };
    }

    // Add affiliate links to description
    const aff = AFFILIATE_LINKS[lang.code] || AFFILIATE_LINKS.en;
    const affSection = `\n\n--- USEFUL LINKS ---\n${Object.values(aff).map(a => `${a.desc}: ${a.url}`).join('\n')}`;

    if (parsed.description) {
      parsed.description += affSection;
    }

    parsed.language = lang.code;
    parsed.match    = `${home} vs ${away}`;
    parsed.date     = date;
    parsed.generated = new Date().toISOString();

    return parsed;
  } catch (err) {
    console.error(`❌ Script gen error (${lang.code}):`, err.message);
    return null;
  }
}

// ── Fetch upcoming WC fixtures ────────────────────────────────────────────
async function fetchUpcomingFixtures(days = 2) {
  try {
    const from = new Date().toISOString().split('T')[0];
    const to   = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

    const resp = await axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures', {
      params: { league: 1, season: 2026, from, to },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
      timeout: 10000,
    });

    return (resp.data?.response || []).map(f => ({
      id:    f.fixture.id,
      home:  f.teams.home.name,
      away:  f.teams.away.name,
      date:  f.fixture.date,
      venue: f.fixture.venue?.name || 'TBC',
      competition: 'FIFA World Cup 2026',
    }));
  } catch (err) {
    console.error('❌ Fixture fetch error:', err.message);
    return [];
  }
}

// ── Process one match: generate all language versions ─────────────────────
async function processMatch(match, langCodes = null) {
  const langs = langCodes
    ? LANGUAGES.filter(l => langCodes.includes(l.code))
    : LANGUAGES;

  const matchSlug = `${match.home.replace(/\s+/g,'-')}_vs_${match.away.replace(/\s+/g,'-')}_${match.date.split('T')[0]}`;
  const matchDir  = path.join(OUTPUT_DIR, matchSlug);

  if (!fs.existsSync(matchDir)) fs.mkdirSync(matchDir, { recursive: true });

  const results = [];
  console.log(`\n📹 Generating scripts: ${match.home} vs ${match.away}`);

  for (const lang of langs) {
    const outputPath = path.join(matchDir, `${lang.code}.json`);
    if (fs.existsSync(outputPath)) {
      console.log(`   ⏭️  ${lang.name}: already exists`);
      results.push({ lang: lang.code, status: 'exists' });
      continue;
    }

    console.log(`   ✍️  ${lang.name} (${lang.viewers} speakers)...`);
    const script = await generateMatchScript(match, lang);

    if (script) {
      fs.writeFileSync(outputPath, JSON.stringify(script, null, 2));
      console.log(`   ✅ ${lang.name}: saved`);
      results.push({ lang: lang.code, status: 'generated', title: script.title });
    } else {
      results.push({ lang: lang.code, status: 'error' });
    }

    // Rate limit: 1 request per 2 seconds
    await sleep(2000);
  }

  // Save summary
  const summary = {
    match: `${match.home} vs ${match.away}`,
    date: match.date,
    venue: match.venue,
    languages: results,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(matchDir, '_summary.json'), JSON.stringify(summary, null, 2));

  return summary;
}

// ── Daily script generation job ───────────────────────────────────────────
async function dailyScriptGeneration() {
  console.log('\n📹 YouTube Engine: daily script generation starting...');

  const fixtures = await fetchUpcomingFixtures(2); // next 2 days
  if (!fixtures.length) {
    console.log('   No upcoming fixtures found.');
    return;
  }

  console.log(`   Found ${fixtures.length} upcoming matches`);
  const summaries = [];

  for (const match of fixtures) {
    const summary = await processMatch(match);
    summaries.push(summary);
    await sleep(5000); // pause between matches
  }

  // Print upload guide
  console.log('\n📋 UPLOAD GUIDE:');
  console.log('================');
  for (const s of summaries) {
    console.log(`\n${s.match} (${s.date})`);
    for (const l of s.languages) {
      if (l.title) {
        console.log(`  [${l.lang}] "${l.title}"`);
      }
    }
  }
  console.log('\nScripts saved to:', path.resolve(OUTPUT_DIR));
  console.log('Create one YouTube channel per language (10 channels = 10× monetisation)');
  console.log('Or start with English + Spanish (biggest WC audience)');
}

// ── CLI: generate for specific match ─────────────────────────────────────
async function generateForMatch(home, away, date = new Date().toISOString()) {
  const match = { home, away, date, venue: 'WC 2026 Venue', competition: 'FIFA World Cup 2026' };
  return processMatch(match);
}

// ── List generated scripts ────────────────────────────────────────────────
function listGeneratedScripts() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log('No scripts generated yet.');
    return;
  }

  const dirs = fs.readdirSync(OUTPUT_DIR).filter(d =>
    fs.statSync(path.join(OUTPUT_DIR, d)).isDirectory()
  );

  console.log(`\n📁 Generated scripts (${dirs.length} matches):\n`);
  for (const dir of dirs) {
    const summaryPath = path.join(OUTPUT_DIR, dir, '_summary.json');
    if (fs.existsSync(summaryPath)) {
      const s = JSON.parse(fs.readFileSync(summaryPath));
      const done = s.languages.filter(l => l.status !== 'error').length;
      console.log(`  ${s.match} — ${done}/${s.languages.length} languages`);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Schedule: generate scripts for tomorrow's matches at midnight ─────────
cron.schedule('0 0 * * *', dailyScriptGeneration);

// ── Exports ───────────────────────────────────────────────────────────────
module.exports = { generateForMatch, processMatch, dailyScriptGeneration, listGeneratedScripts };

// ── Boot ──────────────────────────────────────────────────────────────────
(async () => {
  const args = process.argv.slice(2);

  if (args[0] === 'generate') {
    // Manual: node youtube-engine.js generate "Brazil" "France"
    const home = args[1] || 'Brazil';
    const away = args[2] || 'France';
    console.log(`🎬 Generating scripts: ${home} vs ${away}`);
    await generateForMatch(home, away);
  } else if (args[0] === 'list') {
    listGeneratedScripts();
  } else if (args[0] === 'daily') {
    await dailyScriptGeneration();
  } else {
    console.log('📹 YouTube Engine ready.');
    console.log('Commands:');
    console.log('  node youtube-engine.js daily          — generate scripts for next 2 days');
    console.log('  node youtube-engine.js generate "Brazil" "France"  — specific match');
    console.log('  node youtube-engine.js list           — show all generated scripts');
    console.log('\nScheduled: runs daily at midnight to prep tomorrow\'s matches.');
    listGeneratedScripts();
  }
})();
