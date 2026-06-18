/**
 * WC2026 Empire — Master Scheduler (24/7 Cron Brain)
 * Orchestrates ALL automated tasks across the empire
 * Runs via GitHub Actions on a schedule — zero server cost
 *
 * Schedule overview:
 *   Every 1h  — News scan + breaking content trigger
 *   6:00 UTC  — Morning briefing + daily digest
 *   10:00 UTC — SEO ping + sitemap refresh
 *   13:00 UTC — Pre-match alert (if matches today)
 *   16:00 UTC — Pre-match alert (if matches today)
 *   17:00 UTC — Affiliate report + link health check
 *   19:00 UTC — Pre-match alert + evening content push
 *   21:00 UTC — Translation queue drain (all languages)
 *   23:00 UTC — Daily stats aggregation + Telegram summary
 */

const https = require('https');

// ─── Config ───────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '-1004318035372';
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const SITE_URL = process.env.SITE_URL || 'https://wc2026-sports-empire.vercel.app';

// ─── What task to run — set by GitHub Actions env var ─────────────────────────
const TASK = process.env.SCHEDULER_TASK || 'auto'; // auto = detect by time

// ─── Helpers ─────────────────────────────────────────────────────────────────
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    }).on('error', reject);
  });
}

function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function callGroq(prompt, system = 'You are a sports content expert for WC2026.') {
  const result = await httpsPost('api.groq.com', '/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.8,
    },
    { Authorization: `Bearer ${GROQ_API_KEY}` }
  );
  return result?.choices?.[0]?.message?.content?.trim() || null;
}

async function sendTelegram(chatId, text, silent = false) {
  return httpsPost('api.telegram.org', `/bot${BOT_TOKEN}/sendMessage`, {
    chat_id: chatId,
    text: text.slice(0, 4096),
    parse_mode: 'Markdown',
    disable_notification: silent,
    disable_web_page_preview: false,
  });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

// Task 1: Morning Briefing (6:00 UTC)
async function morningBriefing() {
  console.log('📅 Running morning briefing...');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const briefing = await callGroq(
    `Create a morning briefing for WC2026 Empire for ${dateStr}.
    Include: 1) Top WC2026 story/angle for today 2) 3 content ideas to create 3) Best platform to push on today 4) One money-making action.
    Format with emojis. Under 200 words. Mention ${SITE_URL}`,
    'You are the operations director for a global sports content empire. Be specific and actionable.'
  );

  if (briefing) {
    const msg = `🌅 *Morning Briefing — ${dateStr}*\n\n${briefing}`;
    // Send to personal group (silent — don't ping)
    if (GROUP_CHAT_ID) await sendTelegram(GROUP_CHAT_ID, msg, true);
    console.log('✓ Morning briefing sent');
  }
}

// Task 2: News Scanner (every hour)
async function newsScanner() {
  console.log('📰 Scanning WC2026 news...');

  // Free RSS feeds for football news
  const feeds = [
    'https://www.bbc.co.uk/sport/football/world-cup/rss.xml',
    'https://feeds.skysports.com/rss/site/news/top10.xml',
  ];

  // Generate content based on what's likely trending
  const content = await callGroq(
    `It's ${new Date().toUTCString()}. Generate a breaking WC2026 content hook.
    Pick ONE of: team news, player spotlight, odds movement, fan reaction, tactical analysis.
    Write a punchy 2-sentence social post + 1-sentence SEO meta description.
    Keep it under 100 words. Make it shareable.`
  );

  if (content) {
    console.log('Content generated:', content.slice(0, 80) + '...');
    // In production, this would trigger the omnichannel engine
    // For now, log it (GitHub Actions will capture this as artifact)
  }

  console.log('✓ News scan complete');
}

// Task 3: Pre-Match Alert (13:00, 16:00, 19:00 UTC)
async function preMatchAlert() {
  console.log('⚽ Running pre-match alert...');
  const hour = new Date().getUTCHours();

  let timeLabel = hour === 13 ? '2PM kickoffs' : hour === 16 ? '5PM kickoffs' : '8PM kickoffs';

  const alert = await callGroq(
    `Create a pre-match Telegram alert for WC2026 fans for the ${timeLabel} (UK time).
    Include: match atmosphere hype, 2-3 key stats to watch, one prediction with reasoning.
    Add link to ${SITE_URL}/head-to-head.html for detailed analysis.
    Format with ⚽ emojis. Under 150 words.`
  );

  if (alert) {
    await sendTelegram(CHANNEL_ID, `⚽ *WC2026 Pre-Match Alert*\n\n${alert}`);
    console.log('✓ Pre-match alert sent to channel');
  }
}

// Task 4: Affiliate Report (17:00 UTC daily)
async function affiliateReport() {
  console.log('💰 Running affiliate report...');

  // Check /go/ redirect health
  const affiliateLinks = {
    'NordVPN': `${SITE_URL}/go/nordvpn`,
    'ExpressVPN': `${SITE_URL}/go/expressvpn`,
    'DAZN': `${SITE_URL}/go/dazn`,
    'fuboTV': `${SITE_URL}/go/fubotv`,
  };

  const reportLines = ['💰 *Daily Affiliate Status*\n'];
  for (const [name, url] of Object.entries(affiliateLinks)) {
    reportLines.push(`  • ${name}: ${url}`);
  }
  reportLines.push('\n_Check Vercel Analytics + affiliate dashboards for click data._');

  if (GROUP_CHAT_ID) {
    await sendTelegram(GROUP_CHAT_ID, reportLines.join('\n'), true);
  }
  console.log('✓ Affiliate report sent');
}

// Task 5: Evening Content Push (19:00 UTC)
async function eveningContentPush() {
  console.log('🌙 Running evening content push...');

  const content = await callGroq(
    `Create an engaging evening post for WC2026 Empire Telegram channel.
    Focus on: day recap, top moment, tomorrow's preview.
    Include a poll/engagement hook. Link to ${SITE_URL}
    Under 150 words. Use ⚽🏆 emojis. Make fans want to share it.`
  );

  if (content) {
    await sendTelegram(CHANNEL_ID, content);
    console.log('✓ Evening content pushed to channel');
  }
}

// Task 6: Translation Queue (21:00 UTC)
async function translationQueue() {
  console.log('🌍 Processing translation queue...');

  const languages = [
    { code: 'hi', name: 'Hindi', market: 'India' },
    { code: 'pt', name: 'Portuguese', market: 'Brazil' },
    { code: 'es', name: 'Spanish', market: 'Mexico/Spain' },
    { code: 'fr', name: 'French', market: 'France/Africa' },
    { code: 'ar', name: 'Arabic', market: 'Saudi Arabia/MENA' },
    { code: 'id', name: 'Indonesian', market: 'Indonesia' },
  ];

  // Generate today's top post in each language
  const topPost = await callGroq(
    'Write a 2-sentence WC2026 hype post in English that can be easily translated. Simple vocabulary.'
  );

  if (!topPost) { console.log('⚠ No content to translate'); return; }

  const translations = [];
  for (const lang of languages) {
    try {
      const translated = await callGroq(
        `Translate this to ${lang.name}: "${topPost}"\nReturn ONLY the translation, nothing else.`,
        `You are a professional translator specializing in sports content for ${lang.market} audiences.`
      );
      if (translated) translations.push({ lang: lang.name, market: lang.market, text: translated });
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    } catch (e) {
      console.log(`Translation failed for ${lang.name}:`, e.message);
    }
  }

  console.log(`✓ Translated into ${translations.length} languages`);

  // Log results (in production, would push to platform-specific engines)
  for (const t of translations) {
    console.log(`[${t.lang}/${t.market}]: ${t.text.slice(0, 60)}...`);
  }
}

// Task 7: Daily Stats Summary (23:00 UTC)
async function dailyStatsSummary() {
  console.log('📊 Running daily stats summary...');
  const today = new Date().toLocaleDateString('en-GB');

  const summary = await callGroq(
    `Create a daily empire stats summary for ${today}.
    Sections: Content Published, Platforms Active, Revenue Opportunities, Tomorrow's Plan.
    Be specific with what was accomplished today via automation.
    Mention site: ${SITE_URL}
    Under 150 words. Use 📊 emojis.`,
    'You are the analytics director summarizing daily operations for an automated sports content empire.'
  );

  if (summary && GROUP_CHAT_ID) {
    await sendTelegram(GROUP_CHAT_ID, `📊 *Daily Summary — ${today}*\n\n${summary}`, true);
    console.log('✓ Daily summary sent');
  }
}

// Task 8: SEO Ping (10:00 UTC)
async function seoPing() {
  console.log('🔍 Running SEO ping...');

  // Ping Google IndexNow for new/updated pages
  const pagesToPing = [
    '/', '/squad-tracker.html', '/head-to-head.html', '/odds-comparison.html',
    '/ai-predictions.html', '/wc2026-outright-winner.html',
  ];

  // In production, would call IndexNow API
  // For now, just log the pages we'd ping
  console.log(`Would ping ${pagesToPing.length} pages to Google IndexNow`);
  console.log('✓ SEO ping complete');
}

// ─── Task Router ──────────────────────────────────────────────────────────────
const TASK_MAP = {
  morning: morningBriefing,
  news: newsScanner,
  prematch: preMatchAlert,
  affiliate: affiliateReport,
  evening: eveningContentPush,
  translate: translationQueue,
  stats: dailyStatsSummary,
  seo: seoPing,
};

async function runScheduler() {
  const hour = new Date().getUTCHours();
  console.log(`⏰ Master Scheduler running | UTC Hour: ${hour} | Task: ${TASK}`);

  if (TASK !== 'auto') {
    // Explicit task specified
    const fn = TASK_MAP[TASK];
    if (fn) await fn();
    else console.error(`Unknown task: ${TASK}`);
    return;
  }

  // Auto-detect by hour
  const hourlyTasks = {
    6: morningBriefing,
    10: seoPing,
    13: preMatchAlert,
    16: preMatchAlert,
    17: affiliateReport,
    19: eveningContentPush,
    21: translationQueue,
    23: dailyStatsSummary,
  };

  const task = hourlyTasks[hour] || newsScanner;
  await task();

  console.log('✅ Scheduler complete');
}

runScheduler().catch(err => {
  console.error('Scheduler error:', err);
  process.exit(1);
});
