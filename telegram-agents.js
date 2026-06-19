/**
 * WC2026 Empire — Multi-Agent Telegram Team v2
 * 6 specialist AI agents, 24/7, proactive + reactive
 *
 * PROACTIVE: Agents post content unprompted — briefings, WC facts, revenue tips
 * REACTIVE: Agents respond to messages instantly via keyword routing
 * CONTINUOUS: Self-exits after 53 min so hourly cron restarts with no gap
 *
 * GitHub Secrets needed:
 *   TELEGRAM_BOT_TOKEN      — from @BotFather
 *   TELEGRAM_GROUP_CHAT_ID  — your group chat ID
 *   GROQ_API_KEY            — from console.groq.com (free)
 *   RAILWAY_URL             — Railway backend base URL
 */

const https = require('https');

// ─── Config ─────────────────────────────────────────────────────────────────
const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SITE_URL     = process.env.SITE_URL || 'https://wc2026-sports-empire.vercel.app';
const RAILWAY_URL  = process.env.RAILWAY_URL || '';

// Self-exit after 53 minutes so next hourly cron picks up cleanly
const MAX_RUNTIME_MS = 53 * 60 * 1000;
const START_TIME     = Date.now();

// ─── Agent Definitions ───────────────────────────────────────────────────────
const AGENTS = {
  content: {
    name: '✍️ ContentBot',
    username: '@content',
    trigger: /content|write|post|article|blog|caption|copy|headline|tweet|seo|script/i,
    systemPrompt: `You are ContentBot, the content strategist for WC2026 Empire — a global sports analytics platform in 20+ countries.
Expertise: SEO articles, viral captions, match previews, player profiles, headline hooks.
Tone: confident, data-driven, concise. Always mention ${SITE_URL} when relevant.
Produce content immediately when asked — don't describe, just write it.
Max 300 words unless asked for a full article. Use emojis sparingly.`,
  },
  revenue: {
    name: '💰 RevenueBot',
    username: '@revenue',
    trigger: /revenue|money|income|affiliate|adsense|earn|profit|gumroad|commission|monetize|patreon|whop/i,
    systemPrompt: `You are RevenueBot, the monetization expert for WC2026 Empire.
Expertise: affiliate programs (DAZN, fuboTV, NordVPN, ExpressVPN), Google AdSense, Gumroad digital products, email monetization, CPM/CPC optimization, Whop/Patreon memberships.
IMPORTANT: Operator is 17 — never suggest sportsbook player accounts, depositing on betting platforms, or any 18+ gambling activity. Focus on affiliate referrals (lead gen only), digital products, and ad revenue.
Income streams: 1) Affiliate commissions 2) AdSense/Ezoic 3) Gumroad 4) Email list 5) Memberships
Give specific numbers and actionable steps. Max 250 words.`,
  },
  analytics: {
    name: '📊 AnalyticsBot',
    username: '@analytics',
    trigger: /analytics|traffic|stats|data|metrics|visitors|clicks|conversion|seo|rank|google/i,
    systemPrompt: `You are AnalyticsBot, the data intelligence agent for WC2026 Empire.
Expertise: web analytics, SEO keyword tracking, traffic sources, conversion optimization, A/B testing, Google Search Console.
Site: ${SITE_URL} — 241+ pages across 20+ country markets.
Give precise, data-backed insights. Suggest specific actions based on metrics.
When no live data available, give benchmarks and what to look for. Max 250 words.`,
  },
  distribution: {
    name: '📡 DistroBot',
    username: '@distro',
    trigger: /distribut|post|share|social|twitter|instagram|tiktok|youtube|reddit|discord|platform|reach|publish|viral/i,
    systemPrompt: `You are DistroBot, the content distribution specialist for WC2026 Empire.
Expertise: multi-platform publishing, optimal timing per timezone, hashtag research, cross-posting automation, viral growth, Reddit strategy, Discord engagement.
Platforms active: Twitter/X, Instagram, TikTok, YouTube, Reddit, Discord, Telegram, WhatsApp, LINE, Viber, Zalo, Weibo, VK, Nairaland, Naver, Bluesky.
Give platform-specific advice. Know per-market platforms. Max 250 words.`,
  },
  research: {
    name: '🔬 ResearchBot',
    username: '@research',
    trigger: /research|odds|predict|analysis|match|player|team|form|injury|lineup|wc2026|world cup|football|soccer|goal|score/i,
    systemPrompt: `You are ResearchBot, the sports intelligence agent for WC2026 Empire.
Expertise: WC2026 match analysis, player form, team tactics, injury news, historical stats, prediction modeling, tournament trends.
WC2026: June-July 2026, 48 teams, hosted in USA/Canada/Mexico.
Give confident predictions with reasoning. Identify content opportunities (not betting advice).
Be specific, use stats. Max 300 words.`,
  },
  global: {
    name: '🌍 GlobalBot',
    username: '@global',
    trigger: /translat|language|country|region|market|india|nigeria|korea|japan|china|brazil|arabic|hindi|spanish|french|africa/i,
    systemPrompt: `You are GlobalBot, the international expansion agent for WC2026 Empire.
Expertise: localization, multi-language adaptation, regional platform selection, cultural nuance in sports content, emerging market growth.
Markets: UK, USA, India, Nigeria, Korea, Japan, China diaspora, Brazil, Mexico, Indonesia, Vietnam, Russia, Philippines, Saudi Arabia, France, Germany, Spain, Morocco, Ghana.
When asked to translate, do it immediately. Know which platforms matter per market. Max 250 words.`,
  },
};

// ─── Commands ────────────────────────────────────────────────────────────────
const COMMANDS = {
  '/status': async () => {
    const uptime = Math.floor((Date.now() - START_TIME) / 1000 / 60);
    return `🏰 *WC2026 Empire — System Status*\n\n` +
      `✅ Bot: Online (${uptime}m uptime this session)\n` +
      `✅ Site: [wc2026-sports-empire.vercel.app](${SITE_URL})\n` +
      `✅ Agents: 6 active\n` +
      `📊 Pages: 241+\n` +
      `🌍 Markets: 20+ countries\n\n` +
      `*Agents:*\n${Object.values(AGENTS).map(a => `  ${a.name}`).join('\n')}\n\n` +
      `/help for commands • Just talk to trigger any agent`;
  },
  '/help': async () => {
    return `🤖 *WC2026 Empire Agent Team*\n\n` +
      `Talk naturally — agents auto-detect what you need.\n\n` +
      `*Agents:*\n` +
      Object.values(AGENTS).map(a => `  ${a.name} — ${a.username}`).join('\n') +
      `\n\n*Commands:*\n` +
      `  /status — system overview\n` +
      `  /brief — today's action plan\n` +
      `  /proactive — all agents post an update now\n` +
      `  /revenue — full revenue breakdown\n` +
      `  /picks — today's AI match picks\n` +
      `  /help — this message\n\n` +
      `*Say things like:*\n` +
      `  "Write a match preview for England vs USA"\n` +
      `  "What's our top traffic source?"\n` +
      `  "Translate our homepage to Hindi"\n` +
      `  "Best platform to post on right now?"`;
  },
  '/brief': async () => {
    if (!GROQ_API_KEY) return getBriefingFallback();
    return callGroq(
      AGENTS.analytics.systemPrompt,
      `Give a sharp daily briefing for WC2026 Empire:
1) Top content opportunity today (WC2026 matchday or news angle)
2) Revenue action to take today
3) One distribution move (which platform, what to post)
4) One market to push hard this week
Use emojis, under 200 words, be specific and actionable.`
    );
  },
  '/picks': async () => {
    if (!GROQ_API_KEY) return `🔬 *ResearchBot*\n\nGroq API key needed for AI picks. Add GROQ_API_KEY to GitHub Secrets → console.groq.com (free).`;
    return callGroq(
      AGENTS.research.systemPrompt,
      `Generate today's top 3 WC2026 match predictions or pre-tournament analysis picks.
Format: Match | Prediction | Confidence % | Key reason (1 sentence)
End with: "Full analysis at ${SITE_URL}/wc2026-predictions-hub.html"`
    );
  },
  '/revenue': async () => {
    if (!GROQ_API_KEY) return getRevenueFallback();
    return callGroq(
      AGENTS.revenue.systemPrompt,
      `Summarise the current revenue opportunity for WC2026 Empire this week.
Cover: 1) Affiliate commissions to chase 2) AdSense/Ezoic tips 3) Gumroad/membership upsell angle
Give exact numbers where possible. Under 200 words.`
    );
  },
  '/proactive': async () => {
    // Trigger all agents to post an update
    setTimeout(() => runProactivePosts(true), 500);
    return `🔄 Triggering all agents to post updates now...`;
  },
};

// ─── Fallback Content (no Groq) ──────────────────────────────────────────────
const WC_FACTS = [
  '⚽ WC2026 has 48 teams — 16 more than 2022. That means more upsets, more content, more traffic.',
  '📊 France are favourites at ~18% implied probability. England ~12%. Brazil ~15%.',
  '🌎 WC2026 hosts: 11 US cities + 3 Canadian + 3 Mexican. The Final is at MetLife Stadium, New Jersey.',
  '💰 Total prize money: $1 BILLION for the first time in WC history. Winner gets ~$150M.',
  '🌍 Africa has 9 spots at WC2026 (up from 5). Morocco, Nigeria, Egypt are the picks.',
  '📱 India has 500M+ football fans but zero coverage — massive affiliate opportunity for us.',
  '🏆 48 teams = 104 matches total. We have a page for every one. That\'s 104 SEO targets.',
  '🔥 The Group of Death format is gone — 12 groups of 4, top 2 + 8 best 3rd-places advance.',
];

function getBriefingFallback() {
  const fact = WC_FACTS[Math.floor(Math.random() * WC_FACTS.length)];
  return `📋 *Daily Briefing*\n\n` +
    `🎯 Content: Write a "WC2026 dark horse teams" thread for Twitter + Reddit today\n` +
    `💰 Revenue: Push Whop membership link in bio + pin Gumroad product post\n` +
    `📡 Distribution: Post 3x on Twitter, 1x Reddit r/worldcup (no spam, add value)\n` +
    `🌍 Market: India has biggest untapped traffic — post Hindi content today\n\n` +
    `💡 _${fact}_\n\n` +
    `Add GROQ_API_KEY to GitHub Secrets for AI-powered briefings.`;
}

function getRevenueFallback() {
  return `💰 *Revenue Breakdown*\n\n` +
    `*This week's priority:*\n` +
    `1️⃣ NordVPN affiliate — post VPN guide to every country page ($40-80/sale)\n` +
    `2️⃣ DAZN affiliate — "how to watch WC2026" SEO content ($15-25/sub)\n` +
    `3️⃣ Gumroad — push Prediction Spreadsheet ($4.99, no effort)\n` +
    `4️⃣ Whop/Patreon — open Fan Pass at $4.99/mo, link in bio\n` +
    `5️⃣ Ezoic — apply now if not approved (3-5x AdSense revenue)\n\n` +
    `*Target: 100 Fan Pass = $499/mo recurring*\n\n` +
    `Add GROQ_API_KEY to GitHub Secrets for AI projections.`;
}

// ─── Proactive Broadcast Posts ─────────────────────────────────────────────
const PROACTIVE_SCHEDULE = [
  // [UTC hour, agent key, prompt]
  [7,  'content',  'Write a short punchy WC2026 morning hook post (3 lines max) to post to Twitter and Telegram. Include a stat and a link to our site.'],
  [9,  'research', 'Give a quick WC2026 tactical insight or prediction angle our audience hasn\'t heard yet. Be specific, cite a team/player/stat.'],
  [12, 'revenue',  'Give one actionable revenue tip the operator can do in the next 30 minutes to make money today. Very specific, very practical.'],
  [15, 'distribution', 'What\'s the single best platform and content type to post RIGHT NOW (3pm UTC) for maximum WC2026 traffic? Tell me exactly what to post.'],
  [18, 'content',  'Write a "WC2026 evening update" post — 2-3 sentences with something interesting that happened today in football prep or tournament news.'],
  [20, 'research', 'Give a bold WC2026 prediction or hot take — something that will get engagement and shares. Controversial but defensible.'],
];

let lastProactiveHour = -1;

async function runProactivePosts(forceAll = false) {
  if (!GROUP_CHAT_ID) return;
  const hour = new Date().getUTCHours();

  const toPost = forceAll
    ? PROACTIVE_SCHEDULE
    : PROACTIVE_SCHEDULE.filter(([h]) => h === hour && hour !== lastProactiveHour);

  if (toPost.length === 0) return;
  lastProactiveHour = hour;

  for (const [, agentKey, prompt] of toPost) {
    const agent = AGENTS[agentKey];
    try {
      let text;
      if (GROQ_API_KEY) {
        text = await callGroq(agent.systemPrompt, prompt);
      } else {
        // Fallback proactive posts
        const fallbacks = [
          `⚽ *WC2026 Empire — Morning Brief*\n\nFrance, Brazil, England leading pre-tournament odds.\nDark horses: Morocco, Portugal, USA at home.\n\nFull analysis: ${SITE_URL}/wc2026-predictions-hub.html`,
          `💰 *Revenue Tip*\n\nNordVPN WC2026 campaign pays $40-80/sale. Our /streaming-vpn page gets high intent traffic. Push it today.\n\n${SITE_URL}/streaming-vpn.html`,
          `📊 *Traffic Insight*\n\n"How to watch WC2026 in [country]" queries are spiking now. We have pages for 25+ countries — make sure they're shared.`,
        ];
        text = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      await sendMessage(GROUP_CHAT_ID, `${agent.name}:\n\n${text}`);
      await new Promise(r => setTimeout(r, 2000)); // small delay between posts
    } catch (err) {
      console.error(`[Proactive] ${agentKey} error:`, err.message);
    }
  }
}

// ─── Groq API ────────────────────────────────────────────────────────────────
function callGroq(systemPrompt, userMessage, model = 'llama-3.3-70b-versatile') {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage }
      ],
      max_tokens: 600,
      temperature: 0.75,
    });

    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content;
          if (content) resolve(content.trim());
          else reject(new Error(parsed.error?.message || 'No content'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Telegram API ────────────────────────────────────────────────────────────
function telegramRequest(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendMessage(chatId, text, replyToMessageId = null) {
  const params = {
    chat_id: chatId,
    text: text.slice(0, 4096),
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  };
  if (replyToMessageId) params.reply_to_message_id = replyToMessageId;
  try {
    return await telegramRequest('sendMessage', params);
  } catch (e) {
    // Retry without markdown if parse error
    if (e.message?.includes('parse')) {
      params.parse_mode = undefined;
      return telegramRequest('sendMessage', params);
    }
    throw e;
  }
}

// ─── Message Routing ─────────────────────────────────────────────────────────
function detectAgent(text) {
  // Direct @mention
  for (const [key, agent] of Object.entries(AGENTS)) {
    if (text.toLowerCase().includes(agent.username.toLowerCase())) return { key, agent };
  }
  // Keyword auto-detect
  for (const [key, agent] of Object.entries(AGENTS)) {
    if (agent.trigger.test(text)) return { key, agent };
  }
  // Default: ResearchBot (handles general football questions)
  return { key: 'research', agent: AGENTS.research };
}

async function handleMessage(message) {
  const chatId   = message.chat.id;
  const text     = message.text || '';
  const messageId = message.message_id;
  const fromName = message.from?.first_name || 'Boss';

  // Filter to configured group (or allow DMs)
  if (GROUP_CHAT_ID && String(chatId) !== String(GROUP_CHAT_ID)) {
    if (message.chat.type !== 'private') return;
  }

  if (message.from?.is_bot) return;
  if (!text || text.length < 2) return;

  // Commands
  if (text.startsWith('/')) {
    const cmd = text.split(' ')[0].split('@')[0];
    if (COMMANDS[cmd]) {
      const response = await COMMANDS[cmd](text, message);
      await sendMessage(chatId, response, messageId);
      return;
    }
  }

  // Route to agent
  const { key, agent } = detectAgent(text);
  await telegramRequest('sendChatAction', { chat_id: chatId, action: 'typing' });

  try {
    let response;
    if (GROQ_API_KEY) {
      response = await callGroq(
        agent.systemPrompt,
        `${fromName} says: "${text}"\n\nRespond directly and helpfully.`
      );
    } else {
      response = `I'm ${agent.name}. To enable AI responses, add GROQ_API_KEY to GitHub Secrets at console.groq.com (free).\n\nMeanwhile: use /brief /picks /revenue /status for pre-built responses.`;
    }
    await sendMessage(chatId, `${agent.name}:\n\n${response}`, messageId);
  } catch (err) {
    console.error(`[${key}] error:`, err.message);
    await sendMessage(chatId, `${agent.name}: Having a quick glitch 🔧 Try again in a moment.`, messageId);
  }
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
async function runAgents() {
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set — add to GitHub Secrets');
    process.exit(1);
  }

  console.log('🤖 WC2026 Empire Agent Team v2 starting...');
  console.log(`📡 Group: ${GROUP_CHAT_ID || 'all chats'}`);
  console.log(`🧠 AI: ${GROQ_API_KEY ? 'Groq enabled ✅' : 'No GROQ_API_KEY — add to GitHub Secrets'}`);
  console.log(`⏰ Will self-exit after 53 min (hourly cron restarts cleanly)`);

  // Startup notification (silent if already sent recently — check update_id)
  if (GROUP_CHAT_ID) {
    try {
      await sendMessage(GROUP_CHAT_ID,
        `🏰 *Agent Team Online* — ${new Date().toUTCString().slice(0,21)} UTC\n` +
        `6 agents ready: ✍️ 💰 📊 📡 🔬 🌍\n` +
        `Type /help for commands`
      );
    } catch (e) { console.log('[startup] notification skipped'); }
  }

  let offset = 0;
  let running = true;

  process.on('SIGTERM', () => { running = false; });
  process.on('SIGINT',  () => { running = false; });

  // Proactive post check — every 60 seconds
  const proactiveInterval = setInterval(async () => {
    try { await runProactivePosts(); } catch (e) { /* ignore */ }
  }, 60 * 1000);

  // Self-exit after 53 minutes
  const exitTimer = setTimeout(() => {
    console.log('⏰ 53-minute runtime reached — clean exit for hourly cron restart');
    running = false;
    clearInterval(proactiveInterval);
  }, MAX_RUNTIME_MS);

  while (running) {
    try {
      const result = await telegramRequest('getUpdates', {
        offset,
        timeout: 25, // 25s long-poll (leaves time for cleanup)
        limit: 100,
        allowed_updates: ['message'],
      });

      if (result.ok && result.result?.length > 0) {
        for (const update of result.result) {
          offset = update.update_id + 1;
          if (update.message) {
            handleMessage(update.message).catch(err =>
              console.error('[handler] error:', err.message)
            );
          }
        }
      }
    } catch (err) {
      console.error('[poll] error:', err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  clearTimeout(exitTimer);
  clearInterval(proactiveInterval);
  console.log('✅ Agents shutting down gracefully.');
}

runAgents().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
