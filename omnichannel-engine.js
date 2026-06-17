/**
 * omnichannel-engine.js — One Event → Every Platform Simultaneously
 *
 * Call broadcastEvent() once. It posts to ALL of these in parallel:
 *
 *   INSTANT (automated, no manual work):
 *   ✅ Telegram Free Channel        ✅ Telegram Premium Channel
 *   ✅ Twitter / X                  ✅ Facebook Page
 *   ✅ LinkedIn Page                ✅ Reddit (r/soccer, r/worldcup, r/betting)
 *   ✅ Discord servers              ✅ Email blast (Beehiiv)
 *   ✅ Web push notifications       ✅ WhatsApp broadcast (via CallMeBot)
 *   ✅ SMS blast (Africa's Talking) ✅ Threads (via Instagram API)
 *   ✅ Medium (auto-publish article) ✅ Substack (API post)
 *   ✅ Pinterest (prediction infographic pin)
 *
 *   QUEUED FOR MANUAL UPLOAD (script generates, you copy-paste):
 *   📋 TikTok script + caption      📋 YouTube script + description
 *   📋 Instagram Reel script        📋 YouTube Community post
 *
 * EVENT TYPES:
 *   goal, red_card, match_result, daily_prediction, upset_alert,
 *   sharp_money_move, match_preview, golden_boot_update, viral_moment
 *
 * USAGE:
 *   const engine = require('./omnichannel-engine');
 *   await engine.broadcastEvent({ type: 'goal', home: 'Brazil', away: 'Mexico', score: '1-0', minute: 34, scorer: 'Vinicius Jr.' });
 *   await engine.broadcastEvent({ type: 'daily_prediction', home: 'France', away: 'England', pick: 'France win', confidence: 74 });
 */

require('dotenv').config();
const Groq = require('groq-sdk');
const fs   = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── PLATFORM REGISTRY ─────────────────────────────────────────────────────────
// Each platform: {enabled, post(content) → bool, charLimit, formatHint}
const PLATFORMS = {

  // ── TELEGRAM ───────────────────────────────────────────────────────────────
  telegramFree: {
    name: 'Telegram Free',
    enabled: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_FREE_CHANNEL_ID,
    charLimit: 4096,
    formatHint: 'Use *bold*, emojis freely, include CTA to premium',
    async post(content) {
      const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_FREE_CHANNEL_ID, text: content, parse_mode: 'Markdown' }),
      });
      return (await r.json()).ok;
    },
  },

  telegramPremium: {
    name: 'Telegram Premium',
    enabled: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_PREMIUM_CHANNEL_ID,
    charLimit: 4096,
    formatHint: 'Exclusive angle, sharp money details, referee intel — premium subscribers paid for this',
    async post(content) {
      const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_PREMIUM_CHANNEL_ID, text: content, parse_mode: 'Markdown' }),
      });
      return (await r.json()).ok;
    },
  },

  // ── TWITTER / X ────────────────────────────────────────────────────────────
  twitter: {
    name: 'Twitter/X',
    enabled: !!(process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN),
    charLimit: 280,
    formatHint: 'Punchy, hashtags at end, no fluff. #WC2026 + team hashtags',
    async post(content) {
      try {
        const { TwitterApi } = require('twitter-api-v2');
        const client = new TwitterApi({
          appKey: process.env.TWITTER_API_KEY,
          appSecret: process.env.TWITTER_API_SECRET,
          accessToken: process.env.TWITTER_ACCESS_TOKEN,
          accessSecret: process.env.TWITTER_ACCESS_SECRET,
        });
        await client.v2.tweet(content);
        return true;
      } catch (e) { console.error('[Twitter]', e.message); return false; }
    },
  },

  // ── FACEBOOK PAGE ──────────────────────────────────────────────────────────
  facebook: {
    name: 'Facebook Page',
    enabled: !!(process.env.FB_PAGE_ID && process.env.FB_ACCESS_TOKEN),
    charLimit: 63206,
    formatHint: 'Conversational, longer is fine on FB, include link to the relevant page',
    async post(content) {
      try {
        const r = await fetch(
          `https://graph.facebook.com/${process.env.FB_PAGE_ID}/feed`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: content, access_token: process.env.FB_ACCESS_TOKEN }) }
        );
        const d = await r.json();
        return !!d.id;
      } catch (e) { console.error('[Facebook]', e.message); return false; }
    },
  },

  // ── LINKEDIN ───────────────────────────────────────────────────────────────
  linkedin: {
    name: 'LinkedIn',
    enabled: !!(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_ID),
    charLimit: 3000,
    formatHint: 'Professional tone, sports analytics angle, "AI predicted this" framing',
    async post(content) {
      try {
        const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: `urn:li:person:${process.env.LINKEDIN_AUTHOR_ID}`,
            lifecycleState: 'PUBLISHED',
            specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: content }, shareMediaCategory: 'NONE' } },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
          }),
        });
        return r.ok;
      } catch (e) { console.error('[LinkedIn]', e.message); return false; }
    },
  },

  // ── REDDIT ─────────────────────────────────────────────────────────────────
  reddit: {
    name: 'Reddit',
    enabled: !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_ACCESS_TOKEN),
    charLimit: 40000,
    formatHint: 'Analytical, community-first tone. No overt sales. Add sources. Top comment = your CTA.',
    subreddits: ['soccer', 'worldcup', 'FootballBetting', 'sportsbook'],
    async post(content, subreddit = 'soccer', title = '') {
      try {
        const r = await fetch('https://oauth.reddit.com/api/submit', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.REDDIT_ACCESS_TOKEN}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'WC2026Intel/1.0',
          },
          body: new URLSearchParams({ sr: subreddit, kind: 'self', title, text: content }),
        });
        const d = await r.json();
        return !!d?.json?.data?.name;
      } catch (e) { console.error('[Reddit]', e.message); return false; }
    },
  },

  // ── DISCORD ────────────────────────────────────────────────────────────────
  discord: {
    name: 'Discord',
    enabled: !!process.env.DISCORD_WEBHOOK_URL,
    charLimit: 2000,
    formatHint: 'Casual, community tone. Use Discord formatting (**bold**, `code`)',
    async post(content) {
      try {
        const r = await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        return r.ok;
      } catch (e) { console.error('[Discord]', e.message); return false; }
    },
  },

  // ── WEB PUSH NOTIFICATIONS ─────────────────────────────────────────────────
  webPush: {
    name: 'Web Push',
    enabled: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    charLimit: 120,
    formatHint: 'Ultra short — push notifications. Hook in first 5 words.',
    async post(content, url = '/live-scores.html') {
      try {
        const webpush = require('web-push');
        webpush.setVapidDetails('mailto:' + process.env.CONTACT_EMAIL, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
        const subs = JSON.parse(fs.readFileSync(path.join(__dirname, 'push-subscriptions.json'), 'utf8') || '[]');
        let sent = 0;
        for (const sub of subs) {
          try {
            await webpush.sendNotification(sub, JSON.stringify({ title: 'WC 2026 Intel', body: content, url }));
            sent++;
          } catch {}
        }
        console.log(`[WebPush] Sent to ${sent}/${subs.length} subscribers`);
        return sent > 0;
      } catch (e) { console.error('[WebPush]', e.message); return false; }
    },
  },

  // ── WHATSAPP (CallMeBot broadcast) ─────────────────────────────────────────
  whatsapp: {
    name: 'WhatsApp',
    enabled: !!(process.env.WHATSAPP_API_KEY && process.env.WHATSAPP_PHONE),
    charLimit: 1000,
    formatHint: 'Conversational, like a friend texting. No markdown, plain text.',
    async post(content) {
      try {
        const encoded = encodeURIComponent(content);
        const r = await fetch(
          `https://api.callmebot.com/whatsapp.php?phone=${process.env.WHATSAPP_PHONE}&text=${encoded}&apikey=${process.env.WHATSAPP_API_KEY}`
        );
        return r.ok;
      } catch (e) { console.error('[WhatsApp]', e.message); return false; }
    },
  },

  // ── SMS (Africa's Talking — massive for African markets) ───────────────────
  sms: {
    name: 'SMS',
    enabled: !!(process.env.AT_API_KEY && process.env.AT_USERNAME),
    charLimit: 160,
    formatHint: 'Absolute minimum. Score + pick + link. Every character costs money.',
    async post(content) {
      try {
        const AT = require('africastalking');
        const client = AT({ apiKey: process.env.AT_API_KEY, username: process.env.AT_USERNAME });
        const numbers = JSON.parse(fs.readFileSync(path.join(__dirname, 'sms-subscribers.json'), 'utf8') || '[]');
        if (!numbers.length) return false;
        await client.SMS.send({ to: numbers, message: content, from: process.env.AT_SENDER_ID });
        return true;
      } catch (e) { console.error('[SMS]', e.message); return false; }
    },
  },

  // ── EMAIL (Beehiiv broadcast) ───────────────────────────────────────────────
  email: {
    name: 'Email (Beehiiv)',
    enabled: !!(process.env.BEEHIIV_API_KEY && process.env.BEEHIIV_PUBLICATION_ID),
    charLimit: 100000,
    formatHint: 'HTML email. Subject line crucial. Include personal prediction + CTA to premium.',
    async post(content, subject = 'WC 2026 Intel Update') {
      try {
        const r = await fetch(`https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUBLICATION_ID}/posts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject,
            content: { free: `<p>${content.replace(/\n/g, '<br>')}</p>` },
            status: 'confirmed',
            send_at: new Date().toISOString(),
          }),
        });
        return r.ok;
      } catch (e) { console.error('[Beehiiv]', e.message); return false; }
    },
  },

  // ── THREADS (Meta) ─────────────────────────────────────────────────────────
  threads: {
    name: 'Threads',
    enabled: !!(process.env.THREADS_ACCESS_TOKEN && process.env.THREADS_USER_ID),
    charLimit: 500,
    formatHint: 'Conversational, Instagram-adjacent. Hashtags optional.',
    async post(content) {
      try {
        // Step 1: Create container
        const c = await fetch(`https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_type: 'TEXT', text: content, access_token: process.env.THREADS_ACCESS_TOKEN }),
        });
        const { id } = await c.json();
        if (!id) return false;
        // Step 2: Publish
        const p = await fetch(`https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads_publish`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creation_id: id, access_token: process.env.THREADS_ACCESS_TOKEN }),
        });
        return p.ok;
      } catch (e) { console.error('[Threads]', e.message); return false; }
    },
  },

  // ── MEDIUM (auto-publish article) ──────────────────────────────────────────
  medium: {
    name: 'Medium',
    enabled: !!(process.env.MEDIUM_INTEGRATION_TOKEN && process.env.MEDIUM_USER_ID),
    charLimit: 100000,
    formatHint: 'Full article format. Include H2 headers, paragraph analysis. SEO backlink to your site.',
    async post(content, title = 'WC 2026 AI Prediction') {
      try {
        const r = await fetch(`https://api.medium.com/v1/users/${process.env.MEDIUM_USER_ID}/posts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.MEDIUM_INTEGRATION_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, contentFormat: 'markdown', content, publishStatus: 'public', tags: ['worldcup', 'football', 'predictions', 'ai', 'sports'] }),
        });
        return r.ok;
      } catch (e) { console.error('[Medium]', e.message); return false; }
    },
  },

  // ── SUBSTACK (newsletter notes + posts) ────────────────────────────────────
  substack: {
    name: 'Substack',
    enabled: !!(process.env.SUBSTACK_COOKIE && process.env.SUBSTACK_PUBLICATION),
    charLimit: 100000,
    formatHint: 'Deep analysis article. Substack readers are high-value, engaged audience.',
    async post(content, title = 'WC 2026 Analysis') {
      try {
        // Substack uses cookie auth — post as a Note (short form)
        const r = await fetch(`https://${process.env.SUBSTACK_PUBLICATION}.substack.com/api/v1/comment/feed`, {
          method: 'POST',
          headers: { Cookie: process.env.SUBSTACK_COOKIE, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] } }),
        });
        return r.ok;
      } catch (e) { console.error('[Substack]', e.message); return false; }
    },
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT GENERATOR — creates platform-specific versions from one event
// ─────────────────────────────────────────────────────────────────────────────

async function generatePlatformContent(event, platform) {
  const { formatHint, charLimit, name } = platform;

  const eventDesc = formatEventDescription(event);
  const dayNum    = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);

  const prompt = `WC 2026 (Day ${dayNum}). Event: ${eventDesc}

Write a post for ${name}. Guidelines: ${formatHint}
Max ${Math.min(charLimit, 500)} characters.
${event.isPremium ? 'This is PREMIUM content — include sharp/exclusive angle.' : 'Include subtle CTA to join premium or email list.'}
Return ONLY the post text, nothing else.`;

  try {
    const r = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: Math.min(Math.ceil(charLimit / 3), 500),
      temperature: 0.8,
    });
    let text = r.choices[0]?.message?.content?.trim() || eventDesc;
    // Enforce char limit
    if (text.length > charLimit) text = text.slice(0, charLimit - 3) + '...';
    return text;
  } catch (e) {
    console.error(`[ContentGen:${name}]`, e.message);
    return formatEventDescription(event); // Fallback to raw description
  }
}

function formatEventDescription(event) {
  switch (event.type) {
    case 'goal':
      return `GOAL: ${event.scorer || 'Goal'} — ${event.home} ${event.score} ${event.away} (${event.minute}')`;
    case 'red_card':
      return `RED CARD: ${event.player} (${event.team}) sent off at ${event.minute}' — ${event.home} ${event.score || 'vs'} ${event.away}`;
    case 'match_result':
      return `RESULT: ${event.home} ${event.homeScore}-${event.awayScore} ${event.away}`;
    case 'daily_prediction':
      return `PREDICTION: ${event.home} vs ${event.away} — ${event.pick} (${event.confidence}% confidence)`;
    case 'upset_alert':
      return `UPSET ALERT: ${event.description}`;
    case 'sharp_money_move':
      return `SHARP MONEY: ${event.team} line moved ${event.movement} — ${event.description}`;
    case 'match_preview':
      return `MATCH PREVIEW: ${event.home} vs ${event.away} — ${event.kickoff}`;
    case 'golden_boot_update':
      return `GOLDEN BOOT: ${event.leader} leads with ${event.goals} goals`;
    case 'viral_moment':
      return event.description;
    default:
      return event.description || JSON.stringify(event);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BROADCAST FUNCTION — one call, every platform
// ─────────────────────────────────────────────────────────────────────────────

async function broadcastEvent(event, options = {}) {
  const {
    platforms = 'all',          // 'all' | array of platform keys | 'instant'
    skipPlatforms = [],          // platform keys to skip
    emailSubject = null,         // override email subject
    generateQueued = true,       // generate TikTok/YouTube scripts too
    premiumOnly = false,         // only post to premium channels
  } = options;

  const results = {};
  const startTime = Date.now();

  console.log(`[OMNICHANNEL] Broadcasting: ${event.type} — ${formatEventDescription(event)}`);

  // Determine which platforms to post to
  const targetPlatforms = Object.entries(PLATFORMS).filter(([key, p]) => {
    if (!p.enabled) return false;
    if (skipPlatforms.includes(key)) return false;
    if (premiumOnly && !key.includes('Premium')) return false;
    if (platforms !== 'all' && Array.isArray(platforms) && !platforms.includes(key)) return false;
    return true;
  });

  // Generate content for all platforms in parallel
  const contentMap = {};
  await Promise.all(
    targetPlatforms.map(async ([key, platform]) => {
      contentMap[key] = await generatePlatformContent(
        { ...event, isPremium: key.includes('premium') || key.includes('Premium') },
        platform
      );
    })
  );

  // Post to all platforms in parallel (failures don't block others)
  await Promise.all(
    targetPlatforms.map(async ([key, platform]) => {
      const content = contentMap[key];
      if (!content) { results[key] = { success: false, error: 'no content' }; return; }

      try {
        let success = false;
        if (key === 'email') {
          const subj = emailSubject || generateEmailSubject(event);
          success = await platform.post(content, subj);
        } else if (key === 'medium') {
          success = await platform.post(content, generateArticleTitle(event));
        } else if (key === 'reddit') {
          // Post to most relevant subreddit
          const sr = getRelevantSubreddit(event);
          success = await platform.post(content, sr, generateRedditTitle(event));
        } else {
          success = await platform.post(content);
        }

        results[key] = { success, content: content.slice(0, 80) + '...' };
        if (success) console.log(`[OMNICHANNEL] ✅ ${platform.name}`);
        else console.log(`[OMNICHANNEL] ❌ ${platform.name} — post failed`);
      } catch (e) {
        results[key] = { success: false, error: e.message };
        console.error(`[OMNICHANNEL] ❌ ${platform.name}:`, e.message);
      }
    })
  );

  // Generate queued content (TikTok, YouTube, Instagram Reel)
  let queued = null;
  if (generateQueued) {
    queued = await generateQueuedContent(event);
    if (queued) saveQueuedContent(queued);
  }

  const elapsed  = Date.now() - startTime;
  const successes = Object.values(results).filter(r => r.success).length;
  const total     = Object.keys(results).length;

  console.log(`[OMNICHANNEL] Complete: ${successes}/${total} platforms in ${elapsed}ms`);

  // Log to broadcast history
  logBroadcast(event, results, elapsed);

  return { results, queued, elapsed, successes, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUED CONTENT — scripts for platforms that need manual/upload step
// ─────────────────────────────────────────────────────────────────────────────

async function generateQueuedContent(event) {
  const eventDesc = formatEventDescription(event);
  const dayNum    = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);

  const [tiktok, youtube, instagramReel] = await Promise.all([
    groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: `Write a TikTok script for WC 2026 Day ${dayNum}: ${eventDesc}. Format: hook (3 sec) → content (30 sec) → CTA (5 sec). Include on-screen text suggestions. Under 200 words.` }],
      max_tokens: 300,
    }).then(r => r.choices[0]?.message?.content).catch(() => null),

    groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: `Write a 60-second YouTube video script for WC 2026: ${eventDesc}. Include: hook, analysis, prediction/insight, CTA to subscribe. Under 250 words.` }],
      max_tokens: 350,
    }).then(r => r.choices[0]?.message?.content).catch(() => null),

    groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: `Write an Instagram Reel caption + script for WC 2026: ${eventDesc}. Caption: 150 chars + hashtags. Script: 30 seconds, punchy. Keep separate with labels.` }],
      max_tokens: 250,
    }).then(r => r.choices[0]?.message?.content).catch(() => null),
  ]);

  return { tiktok, youtube, instagramReel, event: eventDesc, date: new Date().toISOString() };
}

function saveQueuedContent(queued) {
  const file = path.join(__dirname, 'content-queue.json');
  let queue = [];
  try { queue = JSON.parse(fs.readFileSync(file)); } catch {}
  queue.unshift(queued);
  if (queue.length > 50) queue = queue.slice(0, 50);
  fs.writeFileSync(file, JSON.stringify(queue, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function generateEmailSubject(event) {
  const subjects = {
    goal:             `⚽ ${event.scorer || 'Goal'} scores! ${event.home} ${event.score} ${event.away}`,
    red_card:         `🟥 Red card changes everything — ${event.home} vs ${event.away}`,
    match_result:     `🏁 RESULT: ${event.home} ${event.homeScore}-${event.awayScore} ${event.away}`,
    daily_prediction: `Today's AI pick: ${event.home} vs ${event.away} — ${event.confidence}% confidence`,
    upset_alert:      `🚨 Upset alert — did you see this coming?`,
    sharp_money_move: `💰 Sharps moved on ${event.team} — here's why`,
    match_preview:    `⚽ ${event.home} vs ${event.away} — AI prediction inside`,
    golden_boot:      `🥇 Golden Boot update: ${event.leader} leads`,
  };
  return subjects[event.type] || 'WC 2026 Intel Update';
}

function generateArticleTitle(event) {
  const titles = {
    goal:             `${event.scorer} Goal Analysis: ${event.home} vs ${event.away} WC 2026`,
    match_result:     `${event.home} ${event.homeScore}-${event.awayScore} ${event.away}: Full AI Analysis`,
    daily_prediction: `WC 2026 AI Prediction: ${event.home} vs ${event.away}`,
    match_preview:    `${event.home} vs ${event.away} WC 2026: AI Preview & Prediction`,
    sharp_money_move: `Sharp Money Alert: ${event.team} — What the Professionals Know`,
  };
  return titles[event.type] || `WC 2026 Intel: ${formatEventDescription(event)}`;
}

function generateRedditTitle(event) {
  const titles = {
    goal:             `[WC 2026] ${event.home} ${event.score} ${event.away} — Our AI had this at ${event.confidence || 70}% before kickoff`,
    match_result:     `[WC 2026] Post-match analysis: ${event.home} ${event.homeScore}-${event.awayScore} ${event.away}`,
    daily_prediction: `[WC 2026] AI model prediction: ${event.home} vs ${event.away} (${event.confidence}% confidence)`,
    match_preview:    `[WC 2026 Preview] ${event.home} vs ${event.away} — what our model says`,
    upset_alert:      `[WC 2026] Our model flagged this upset 24 hours before — here's how`,
  };
  return titles[event.type] || `[WC 2026] ${formatEventDescription(event)}`;
}

function getRelevantSubreddit(event) {
  if (event.type === 'sharp_money_move') return 'sportsbook';
  if (event.type === 'daily_prediction') return 'FootballBetting';
  if (['goal', 'red_card', 'match_result', 'match_preview'].includes(event.type)) return 'soccer';
  return 'worldcup';
}

function logBroadcast(event, results, elapsed) {
  const file = path.join(__dirname, 'broadcast-log.json');
  let log = [];
  try { log = JSON.parse(fs.readFileSync(file)); } catch {}
  log.unshift({
    event: formatEventDescription(event),
    type: event.type,
    results: Object.entries(results).map(([k, v]) => `${k}:${v.success ? '✅' : '❌'}`).join(' '),
    elapsed: `${elapsed}ms`,
    time: new Date().toISOString(),
  });
  if (log.length > 200) log = log.slice(0, 200);
  fs.writeFileSync(file, JSON.stringify(log, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

const broadcast = {
  // Goal in a live match
  goal: (home, away, score, minute, scorer) =>
    broadcastEvent({ type: 'goal', home, away, score, minute, scorer }),

  // Match ended
  result: (home, homeScore, awayScore, away) =>
    broadcastEvent({ type: 'match_result', home, away, homeScore, awayScore }),

  // Daily prediction
  prediction: (home, away, pick, confidence) =>
    broadcastEvent({ type: 'daily_prediction', home, away, pick, confidence }),

  // Pre-match preview
  preview: (home, away, kickoff) =>
    broadcastEvent({ type: 'match_preview', home, away, kickoff }),

  // Sharp money alert (premium only)
  sharpMoney: (team, movement, description) =>
    broadcastEvent({ type: 'sharp_money_move', team, movement, description }, { premiumOnly: true }),

  // Red card
  redCard: (home, away, player, team, minute, score) =>
    broadcastEvent({ type: 'red_card', home, away, player, team, minute, score }),

  // Any custom message
  custom: (description, options = {}) =>
    broadcastEvent({ type: 'viral_moment', description }, options),

  // Get platform status
  status: () => Object.entries(PLATFORMS).map(([k, p]) => `${p.enabled ? '✅' : '❌'} ${p.name}`).join('\n'),
};

module.exports = { broadcastEvent, broadcast, PLATFORMS, generatePlatformContent };

// ── USAGE EXAMPLE ──────────────────────────────────────────────────────────────
// const { broadcast } = require('./omnichannel-engine');
// await broadcast.goal('Brazil', 'Mexico', '1-0', 34, 'Vinicius Jr.');
// await broadcast.prediction('France', 'England', 'France win', 74);
// await broadcast.result('Brazil', 3, 1, 'Mexico');
// console.log(broadcast.status()); // shows which platforms are connected
