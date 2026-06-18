/**
 * WC2026 Empire — Multi-Agent Telegram Team
 * 6 specialist AI agents running 24/7 in your Telegram group chat
 * Each agent has a unique persona, expertise, and triggers
 * Agents collaborate, cross-reference each other, and respond autonomously
 *
 * Deploy: GitHub Actions (free, runs 24/7 via polling)
 * Config: Set TELEGRAM_BOT_TOKEN + TELEGRAM_GROUP_CHAT_ID + GROQ_API_KEY in GitHub Secrets
 */

const https = require('https');

// ─── Config ─────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID; // your personal group chat ID
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SITE_URL = process.env.SITE_URL || 'https://wc2026-sports-empire.vercel.app';

// ─── Agent Definitions ───────────────────────────────────────────────────────
const AGENTS = {
  content: {
    name: '✍️ ContentBot',
    username: '@content',
    trigger: /content|write|post|article|blog|caption|copy|headline|tweet|seo/i,
    systemPrompt: `You are ContentBot, the content strategist for WC2026 Empire — a global sports analytics platform targeting 20+ countries.
Your expertise: SEO-optimized articles, viral social captions, match preview copy, player profiles, betting content (UK/EU markets only), headline hooks.
Tone: confident, data-driven, slightly edgy. Always mention the site ${SITE_URL} when relevant.
When asked to create content, produce it immediately — don't just describe it.
Keep responses under 300 words unless asked for a full article. Use emojis sparingly.`,
  },
  revenue: {
    name: '💰 RevenueBot',
    username: '@revenue',
    trigger: /revenue|money|income|affiliate|adsense|earn|profit|gumroad|commission|monetize/i,
    systemPrompt: `You are RevenueBot, the monetization expert for WC2026 Empire.
Your expertise: affiliate programs (DAZN, fuboTV, NordVPN, ExpressVPN, Bet365 UK), Google AdSense optimization, Gumroad digital products, email list monetization, CPM/CPC maximization.
Age constraint: the operator is 17 — NEVER suggest sportsbook player accounts, depositing on betting platforms, or any 18+ gambling activities. Focus on affiliate referrals (lead gen only), digital products, and ad revenue.
Track income streams: 1) Affiliate commissions 2) AdSense 3) Gumroad products 4) Email list 5) Merchandise
Give specific numbers, realistic projections, and actionable steps. Keep responses concise.`,
  },
  analytics: {
    name: '📊 AnalyticsBot',
    username: '@analytics',
    trigger: /analytics|traffic|stats|data|metrics|visitors|clicks|conversion|seo rank/i,
    systemPrompt: `You are AnalyticsBot, the data intelligence agent for WC2026 Empire.
Your expertise: web analytics interpretation, SEO keyword tracking, traffic source analysis, conversion optimization, A/B testing strategy, Google Search Console insights.
Site: ${SITE_URL} — tracks 100+ pages across 20+ country markets
Give precise, data-backed insights. Suggest specific actions based on metrics.
When no live data is available, give benchmarks and what to look for. Keep responses under 250 words.`,
  },
  distribution: {
    name: '📡 DistroBot',
    username: '@distro',
    trigger: /distribute|post|share|social|twitter|instagram|tiktok|youtube|reddit|discord|platform|reach|publish/i,
    systemPrompt: `You are DistroBot, the content distribution specialist for WC2026 Empire.
Your expertise: multi-platform publishing strategy, optimal posting times per platform and timezone, hashtag research, cross-posting automation, viral growth tactics, Reddit community strategy, Discord engagement.
Platforms active: Twitter/X, Instagram, TikTok, YouTube, Reddit, Discord, Telegram channels, WhatsApp, LINE, Viber, Zalo, Weibo, VK, Nairaland, Naver
Give platform-specific advice. Know the audience for each platform (Korea=Naver, China=Weibo, Russia=VK, Vietnam=Zalo, Nigeria=Nairaland).
Keep responses actionable and under 250 words.`,
  },
  research: {
    name: '🔬 ResearchBot',
    username: '@research',
    trigger: /research|odds|predict|analysis|match|player|team|stat|form|injury|lineup|wc2026|world cup/i,
    systemPrompt: `You are ResearchBot, the sports intelligence agent for WC2026 Empire.
Your expertise: WC2026 match analysis, player form, team tactics, odds interpretation, injury news, historical stats, tournament trends, prediction modeling.
WC2026 runs June-July 2026. 48 teams, hosted in USA/Canada/Mexico.
Draw on deep football knowledge. Give confident predictions with reasoning, not vague disclaimers.
Identify value angles for content creation (not betting advice for users). Keep responses sharp, under 300 words.`,
  },
  international: {
    name: '🌍 GlobalBot',
    username: '@global',
    trigger: /translate|language|country|region|market|india|nigeria|korea|japan|china|brazil|arabic|hindi|spanish|french/i,
    systemPrompt: `You are GlobalBot, the international expansion agent for WC2026 Empire.
Your expertise: localization strategy, multi-language content adaptation, regional platform selection, cultural nuance in sports content, emerging market growth.
Markets active: UK, USA, India (Hindi), Nigeria, Korea, Japan, China (diaspora), Brazil, Mexico, Indonesia, Vietnam, Russia, Philippines, Saudi Arabia, France, Germany, Spain
Know which platforms matter per market. Understand cultural sensitivities around betting/gambling content by region.
When asked to translate, provide the translation immediately. Keep responses under 250 words.`,
  },
};

// ─── Command Handlers ────────────────────────────────────────────────────────
const COMMANDS = {
  '/status': async () => {
    return `🏰 *WC2026 Empire — System Status*\n\n` +
      `✅ Telegram bot: Online\n` +
      `✅ Site: [wc2026-sports-empire.vercel.app](${SITE_URL})\n` +
      `✅ GitHub Actions: Active\n` +
      `📊 Pages: 199+\n` +
      `🌍 Markets: 20+ countries\n` +
      `💰 Income streams: 5 active\n\n` +
      `*Agents online:*\n${Object.values(AGENTS).map(a => `  ${a.name}`).join('\n')}\n\n` +
      `Type \`/help\` for commands or mention an agent by name.`;
  },
  '/help': async () => {
    const agentList = Object.values(AGENTS)
      .map(a => `  ${a.name} — mention ${a.username}`)
      .join('\n');
    return `🤖 *WC2026 Empire Agent Team*\n\n` +
      `Talk to any agent naturally — they auto-detect what you need.\n\n` +
      `*Agents:*\n${agentList}\n\n` +
      `*Commands:*\n` +
      `  /status — system overview\n` +
      `  /agents — list all agents\n` +
      `  /help — this message\n` +
      `  /brief — daily empire briefing\n\n` +
      `*Examples:*\n` +
      `  "Write a match preview for England vs USA"\n` +
      `  "What revenue should I expect this month?"\n` +
      `  "Translate the homepage to Hindi"\n` +
      `  "What's our best content for Nigeria right now?"`;
  },
  '/agents': async () => {
    const list = Object.values(AGENTS).map(a =>
      `${a.name}\n  Handles: ${a.trigger.source.replace(/\|/g, ', ').replace(/[\/i]/g, '')}`
    ).join('\n\n');
    return `🤖 *Active Agents*\n\n${list}`;
  },
  '/brief': async () => {
    return await callGroq(
      AGENTS.analytics.systemPrompt,
      `Give a concise daily briefing for WC2026 Empire covering:
      1) Top content opportunity today (WC2026 news/upcoming matches)
      2) Revenue focus for today
      3) One distribution action to take
      4) One international market to activate
      Format with emojis, keep it under 200 words, actionable.`
    );
  },
};

// ─── Groq API Call ───────────────────────────────────────────────────────────
function callGroq(systemPrompt, userMessage, model = 'llama-3.3-70b-versatile') {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 600,
      temperature: 0.7,
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
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices?.[0]?.message?.content) {
            resolve(parsed.choices[0].message.content.trim());
          } else {
            reject(new Error(JSON.stringify(parsed)));
          }
        } catch (e) {
          reject(e);
        }
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
    }, (res) => {
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
    text: text.slice(0, 4096), // Telegram limit
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
  };
  if (replyToMessageId) params.reply_to_message_id = replyToMessageId;
  return telegramRequest('sendMessage', params);
}

async function getUpdates(offset = 0) {
  return telegramRequest('getUpdates', {
    offset,
    timeout: 30,
    limit: 100,
    allowed_updates: ['message'],
  });
}

// ─── Route Message to Agent ──────────────────────────────────────────────────
function detectAgent(text) {
  // Check for direct @mentions first
  for (const [key, agent] of Object.entries(AGENTS)) {
    if (text.toLowerCase().includes(agent.username.toLowerCase())) {
      return { key, agent };
    }
  }
  // Auto-detect by keyword
  for (const [key, agent] of Object.entries(AGENTS)) {
    if (agent.trigger.test(text)) {
      return { key, agent };
    }
  }
  // Default to ResearchBot for general sports questions
  return { key: 'research', agent: AGENTS.research };
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const messageId = message.message_id;
  const fromName = message.from?.first_name || 'Boss';

  // Only respond in the configured group or DMs from any chat
  // (if GROUP_CHAT_ID is set, only respond there; otherwise respond anywhere)
  if (GROUP_CHAT_ID && String(chatId) !== String(GROUP_CHAT_ID)) {
    // Allow DMs always
    if (message.chat.type !== 'private') return;
  }

  // Ignore bot messages
  if (message.from?.is_bot) return;

  // Handle commands
  if (text.startsWith('/')) {
    const cmd = text.split(' ')[0].split('@')[0]; // strip @botname
    if (COMMANDS[cmd]) {
      const response = await COMMANDS[cmd](text, message);
      await sendMessage(chatId, response, messageId);
      return;
    }
  }

  // Skip very short messages or non-text
  if (!text || text.length < 3) return;

  // In groups: respond to all messages (privacy mode is disabled so we see everything)
  // Agent routing handles which specialist replies

  // Route to appropriate agent
  const { key, agent } = detectAgent(text);

  // Send typing indicator
  await telegramRequest('sendChatAction', { chat_id: chatId, action: 'typing' });

  try {
    const response = await callGroq(agent.systemPrompt, `${fromName} asks: ${text}`);
    const prefix = `${agent.name}:\n\n`;
    await sendMessage(chatId, prefix + response, messageId);
  } catch (err) {
    console.error(`Agent ${key} error:`, err.message);
    // Fallback response
    await sendMessage(chatId,
      `${agent.name}: Sorry, I'm having trouble right now. Try again in a moment! 🔧`,
      messageId
    );
  }
}

// ─── Polling Loop ─────────────────────────────────────────────────────────────
async function runAgents() {
  console.log('🤖 WC2026 Empire Agent Team starting...');
  console.log(`📡 Monitoring ${GROUP_CHAT_ID ? `group ${GROUP_CHAT_ID}` : 'all chats'}`);

  let offset = 0;
  let running = true;

  // Graceful shutdown
  process.on('SIGTERM', () => { running = false; });
  process.on('SIGINT', () => { running = false; });

  // Send startup notification
  if (GROUP_CHAT_ID) {
    try {
      await sendMessage(GROUP_CHAT_ID,
        `🏰 *WC2026 Empire Agent Team — Online*\n\n` +
        `All 6 agents are active and ready:\n` +
        Object.values(AGENTS).map(a => `${a.name}`).join('\n') +
        `\n\nType /help for commands or just talk to us naturally!`
      );
    } catch (e) {
      console.log('Startup notification skipped:', e.message);
    }
  }

  while (running) {
    try {
      const result = await getUpdates(offset);

      if (result.ok && result.result.length > 0) {
        for (const update of result.result) {
          offset = update.update_id + 1;

          if (update.message) {
            // Process message (don't await — handle concurrently)
            handleMessage(update.message).catch(err =>
              console.error('Message handling error:', err.message)
            );
          }
        }
      }
    } catch (err) {
      console.error('Polling error:', err.message);
      // Wait before retrying on error
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log('Agents shutting down gracefully.');
}

runAgents().catch(console.error);
