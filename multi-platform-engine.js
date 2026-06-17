// multi-platform-engine.js
// Posts content to ALL platforms automatically
// Extends preview-engine.js and goal-monitor.js
// Handles: Telegram, Twitter/X API v2, Meta (Facebook+Instagram),
//          YouTube Community Posts, Viber, Zalo, LINE, KakaoTalk, OneSignal push
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const axios = require('axios');
const { generateQualityContent, formatForTelegram, formatForTwitter } = require('./quality-engine');
const { PLATFORM_PRIORITY } = require('./platform-matrix');

// ── ENV VARIABLES NEEDED ──────────────────────────────────────
// Add to .env:
// TWITTER_BEARER_TOKEN, TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
// META_ACCESS_TOKEN, META_PAGE_IDS (comma-separated), META_IG_USER_IDS (comma-separated)
// YOUTUBE_API_KEY, YOUTUBE_CHANNEL_IDS (comma-separated)
// VIBER_AUTH_TOKEN, VIBER_SENDER_NAME
// ZALO_ACCESS_TOKEN, ZALO_OA_ID
// LINE_CHANNEL_ACCESS_TOKEN
// KAKAO_REST_API_KEY, KAKAO_CHANNEL_PUBLIC_ID
// ONESIGNAL_APP_ID, ONESIGNAL_API_KEY

// ── TWITTER / X ───────────────────────────────────────────────

class TwitterPoster {
  constructor(bearerToken, apiKey, apiSecret, accessToken, accessSecret) {
    this.bearerToken = bearerToken;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.accessToken = accessToken;
    this.accessSecret = accessSecret;
    this.baseUrl = 'https://api.twitter.com/2';
  }

  // OAuth 1.0a signature (required for posting tweets)
  getOAuthHeader(method, url, params = {}) {
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    const oauthParams = {
      oauth_consumer_key: this.apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: this.accessToken,
      oauth_version: '1.0'
    };

    const allParams = { ...oauthParams, ...params };
    const paramStr = Object.keys(allParams).sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
      .join('&');

    const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
    const signingKey = `${encodeURIComponent(this.apiSecret)}&${encodeURIComponent(this.accessSecret)}`;
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

    oauthParams.oauth_signature = signature;
    const headerStr = Object.keys(oauthParams)
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ');

    return `OAuth ${headerStr}`;
  }

  async tweet(text, accountIndex = 0) {
    // Each language account has separate credentials stored in env
    const token = process.env[`TWITTER_ACCESS_TOKEN_${accountIndex}`] || this.accessToken;
    const secret = process.env[`TWITTER_ACCESS_SECRET_${accountIndex}`] || this.accessSecret;

    const url = `${this.baseUrl}/tweets`;
    const body = { text: text.substring(0, 280) };

    try {
      const res = await axios.post(url, body, {
        headers: {
          'Authorization': this.getOAuthHeader('POST', url),
          'Content-Type': 'application/json'
        }
      });
      return { success: true, id: res.data.data?.id };
    } catch (err) {
      console.error(`[Twitter] Post failed:`, err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  // Thread: for match previews (multiple connected tweets)
  async thread(tweets, accountIndex = 0) {
    let replyToId = null;
    for (const text of tweets) {
      const body = { text: text.substring(0, 280) };
      if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };

      try {
        const res = await axios.post(`${this.baseUrl}/tweets`, body, {
          headers: { 'Authorization': this.getOAuthHeader('POST', `${this.baseUrl}/tweets`), 'Content-Type': 'application/json' }
        });
        replyToId = res.data.data?.id;
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`[Twitter Thread] Error:`, err.message);
        break;
      }
    }
  }
}

// ── META (FACEBOOK + INSTAGRAM) ──────────────────────────────

class MetaPoster {
  constructor(accessToken) {
    this.token = accessToken;
    this.baseUrl = 'https://graph.facebook.com/v18.0';
  }

  // Post to Facebook Page
  async postToFacebook(pageId, message, link = null) {
    const params = { message, access_token: this.token };
    if (link) params.link = link;

    try {
      const res = await axios.post(`${this.baseUrl}/${pageId}/feed`, params);
      return { success: true, id: res.data.id };
    } catch (err) {
      console.error(`[Facebook] Post failed for page ${pageId}:`, err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  // Post Reel/Video to Instagram
  async postToInstagram(igUserId, caption, mediaUrl = null) {
    try {
      // Step 1: Create media container
      const containerParams = { caption, access_token: this.token };
      if (mediaUrl) {
        containerParams.image_url = mediaUrl;
        containerParams.media_type = 'IMAGE';
      }

      const containerRes = await axios.post(`${this.baseUrl}/${igUserId}/media`, containerParams);
      const containerId = containerRes.data.id;

      // Wait for media to process
      await new Promise(r => setTimeout(r, 3000));

      // Step 2: Publish
      const publishRes = await axios.post(`${this.baseUrl}/${igUserId}/media_publish`, {
        creation_id: containerId,
        access_token: this.token
      });

      return { success: true, id: publishRes.data.id };
    } catch (err) {
      console.error(`[Instagram] Post failed for ${igUserId}:`, err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  // Post to all configured pages + IG accounts
  async broadcastToMeta(messagesByLang) {
    const pageIds = (process.env.META_PAGE_IDS || '').split(',').filter(Boolean);
    const igIds = (process.env.META_IG_USER_IDS || '').split(',').filter(Boolean);
    const results = [];

    for (let i = 0; i < pageIds.length; i++) {
      const langCode = Object.keys(messagesByLang)[i] || 'en';
      const message = messagesByLang[langCode] || messagesByLang.en;

      if (pageIds[i]) results.push(await this.postToFacebook(pageIds[i], message));
      if (igIds[i]) results.push(await this.postToInstagram(igIds[i], message));

      await new Promise(r => setTimeout(r, 1000));
    }

    return results;
  }
}

// ── YOUTUBE COMMUNITY POSTS ───────────────────────────────────

class YouTubePoster {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  // Community posts (like a tweet on YouTube)
  async postCommunityUpdate(channelOAuthToken, text) {
    // Requires OAuth 2.0 token with youtube.force-ssl scope
    try {
      const res = await axios.post(`${this.baseUrl}/activities`, {
        snippet: {
          description: text.substring(0, 5000),
          type: 'bulletin'
        }
      }, {
        params: { part: 'snippet' },
        headers: { 'Authorization': `Bearer ${channelOAuthToken}`, 'Content-Type': 'application/json' }
      });
      return { success: true, id: res.data.id };
    } catch (err) {
      console.error(`[YouTube Community] Post failed:`, err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }
}

// ── VIBER (Balkans + Eastern Europe) ─────────────────────────

class ViberPoster {
  constructor(authToken, senderName) {
    this.authToken = authToken;
    this.senderName = senderName;
    this.baseUrl = 'https://chatapi.viber.com/pa';
  }

  async broadcast(text, langTag = '') {
    // Viber Public Account broadcast
    try {
      const res = await axios.post(`${this.baseUrl}/broadcast_message`, {
        broadcast_list: [], // Populated from subscriber list
        from: this.senderName,
        type: 'text',
        text: text,
        min_api_version: 1
      }, {
        headers: { 'X-Viber-Auth-Token': this.authToken, 'Content-Type': 'application/json' }
      });
      return { success: true, status: res.data.status };
    } catch (err) {
      console.error(`[Viber] Broadcast failed:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

// ── ZALO (Vietnam — 74M users) ────────────────────────────────

class ZaloPoster {
  constructor(accessToken, oaId) {
    this.accessToken = accessToken;
    this.oaId = oaId;
    this.baseUrl = 'https://openapi.zalo.me/v2.0/oa';
  }

  async broadcast(message, imageUrl = null) {
    // Zalo Official Account broadcast
    const body = {
      recipient: { message_tag: 'CONFIRMED_EVENT_UPDATE' },
      message: {
        text: message.substring(0, 2000),
        ...(imageUrl ? { attachment: { type: 'image', payload: { url: imageUrl } } } : {})
      }
    };

    try {
      const res = await axios.post(`${this.baseUrl}/message/cs`, body, {
        headers: { 'access_token': this.accessToken, 'Content-Type': 'application/json' }
      });
      return { success: true, data: res.data };
    } catch (err) {
      console.error(`[Zalo] Broadcast failed:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

// ── LINE (Thailand + Japan) ───────────────────────────────────

class LINEPoster {
  constructor(channelAccessToken) {
    this.token = channelAccessToken;
    this.baseUrl = 'https://api.line.me/v2/bot';
  }

  async multicast(userIds, text) {
    try {
      const res = await axios.post(`${this.baseUrl}/message/multicast`, {
        to: userIds.slice(0, 500), // LINE limit: 500 per request
        messages: [{ type: 'text', text: text.substring(0, 5000) }]
      }, {
        headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
      });
      return { success: true, status: res.status };
    } catch (err) {
      console.error(`[LINE] Multicast failed:`, err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  async broadcast(text) {
    // Broadcast to ALL followers (requires verified LINE Official Account)
    try {
      const res = await axios.post(`${this.baseUrl}/message/broadcast`, {
        messages: [{ type: 'text', text: text.substring(0, 5000) }]
      }, {
        headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
      });
      return { success: true, status: res.status };
    } catch (err) {
      console.error(`[LINE] Broadcast failed:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

// ── ONESIGNAL PUSH NOTIFICATIONS ─────────────────────────────

class PushNotifier {
  constructor(appId, apiKey) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.baseUrl = 'https://onesignal.com/api/v1';
  }

  async sendGoalAlert(homeTeam, awayTeam, scorer, minute, score, langSegment = 'All') {
    const message = `⚽ GOAL! ${scorer} (${minute}') — ${homeTeam} ${score} ${awayTeam}`;

    try {
      const res = await axios.post(`${this.baseUrl}/notifications`, {
        app_id: this.appId,
        included_segments: [langSegment === 'All' ? 'Subscribed Users' : langSegment],
        headings: { en: '⚽ GOAL ALERT — WC 2026' },
        contents: { en: message },
        url: 'https://wc2026.vercel.app/live',
        priority: 10,
        ttl: 3600 // expire after 1 hour (goal alerts stale quickly)
      }, {
        headers: { 'Authorization': `Basic ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      return { success: true, id: res.data.id };
    } catch (err) {
      console.error(`[OneSignal] Push failed:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async sendMatchReminder(homeTeam, awayTeam, kickoffIn, url) {
    try {
      const res = await axios.post(`${this.baseUrl}/notifications`, {
        app_id: this.appId,
        included_segments: ['Subscribed Users'],
        headings: { en: `⏰ Match starting in ${kickoffIn}` },
        contents: { en: `${homeTeam} vs ${awayTeam} — Tap for preview, odds, and AI picks` },
        url,
        priority: 8
      }, {
        headers: { 'Authorization': `Basic ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      return { success: true, id: res.data.id };
    } catch (err) {
      console.error(`[OneSignal] Reminder push failed:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

// ── MASTER BROADCAST FUNCTION ─────────────────────────────────
// Called by preview-engine.js and goal-monitor.js
// Sends content to ALL relevant platforms for each language simultaneously

async function broadcastToAll(matchData, contentType = 'preview') {
  const { generateAllLanguages } = require('./quality-engine');
  const TelegramBot = require('node-telegram-bot-api');

  // Generate content for all languages
  console.log(`\n[MultiPlatform] Broadcasting ${contentType} for ${matchData.home} vs ${matchData.away}`);
  const allContent = await generateAllLanguages(matchData, contentType);

  // Initialize platform clients
  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
  const twitter = new TwitterPoster(
    process.env.TWITTER_BEARER_TOKEN,
    process.env.TWITTER_API_KEY,
    process.env.TWITTER_API_SECRET,
    process.env.TWITTER_ACCESS_TOKEN,
    process.env.TWITTER_ACCESS_SECRET
  );
  const meta = new MetaPoster(process.env.META_ACCESS_TOKEN);
  const viber = new ViberPoster(process.env.VIBER_AUTH_TOKEN, process.env.VIBER_SENDER_NAME || 'WC2026');
  const zalo = new ZaloPoster(process.env.ZALO_ACCESS_TOKEN, process.env.ZALO_OA_ID);
  const line = new LINEPoster(process.env.LINE_CHANNEL_ACCESS_TOKEN);
  const push = new PushNotifier(process.env.ONESIGNAL_APP_ID, process.env.ONESIGNAL_API_KEY);

  const results = { telegram: [], twitter: [], meta: [], viber: 0, zalo: 0, line: 0, push: 0 };

  for (const contentResult of allContent) {
    const { langCode, content, hashtags, telegramChannel } = contentResult;
    const platforms = PLATFORM_PRIORITY[langCode] || ['telegram'];

    // ── TELEGRAM (already automated, highest priority) ────
    if (platforms.includes('telegram') && telegramChannel) {
      const msg = formatForTelegram(contentResult, matchData);
      try {
        await bot.sendMessage(telegramChannel, msg, { parse_mode: 'HTML' });
        results.telegram.push({ lang: langCode, success: true });
      } catch (err) {
        results.telegram.push({ lang: langCode, success: false, error: err.message });
      }
    }

    // ── TWITTER/X ─────────────────────────────────────────
    if (platforms.includes('twitter_x') && process.env.TWITTER_API_KEY) {
      const tweet = formatForTwitter(contentResult, matchData);
      const langIndex = allContent.indexOf(contentResult);
      await twitter.tweet(tweet, langIndex);
      results.twitter.push(langCode);
      await new Promise(r => setTimeout(r, 800)); // rate limit
    }

    // ── VIBER (Balkans/Eastern Europe) ────────────────────
    if (platforms.includes('viber') && process.env.VIBER_AUTH_TOKEN) {
      const viberMsg = `${matchData.homeFlag} ${matchData.home} vs ${matchData.away} ${matchData.awayFlag}\n\n${content}\n\n${hashtags}`;
      await viber.broadcast(viberMsg, langCode);
      results.viber++;
    }

    // ── ZALO (Vietnam) ────────────────────────────────────
    if (platforms.includes('zalo') && process.env.ZALO_ACCESS_TOKEN && langCode === 'vi') {
      await zalo.broadcast(`${matchData.homeFlag} ${matchData.home} vs ${matchData.away} ${matchData.awayFlag}\n\n${content}`);
      results.zalo++;
    }

    // ── LINE (Thailand + Japan) ───────────────────────────
    if (platforms.includes('line') && process.env.LINE_CHANNEL_ACCESS_TOKEN && ['th', 'ja'].includes(langCode)) {
      await line.broadcast(`${matchData.homeFlag} ${matchData.home} vs ${matchData.away} ${matchData.awayFlag}\n\n${content}`);
      results.line++;
    }

    await new Promise(r => setTimeout(r, 400)); // global rate limit
  }

  // ── META (all Facebook + Instagram pages at once) ────────
  if (process.env.META_ACCESS_TOKEN) {
    const metaMessages = {};
    allContent.forEach(c => { metaMessages[c.langCode] = `${matchData.homeFlag} ${matchData.home} vs ${matchData.away} ${matchData.awayFlag}\n\n${c.content}\n\n${c.hashtags}`; });
    await meta.broadcastToMeta(metaMessages);
    console.log(`  ✅ Meta: broadcast sent to all pages`);
  }

  // ── PUSH NOTIFICATION (match reminder, not goal alert) ───
  if (process.env.ONESIGNAL_APP_ID && contentType === 'preview') {
    await push.sendMatchReminder(matchData.home, matchData.away, '2 hours', 'https://wc2026.vercel.app/live');
    results.push = 1;
    console.log(`  ✅ Push: match reminder sent to all subscribers`);
  }

  // Summary
  console.log(`\n[MultiPlatform] Broadcast complete:`);
  console.log(`  Telegram: ${results.telegram.filter(r=>r.success).length}/${results.telegram.length} channels`);
  console.log(`  Twitter: ${results.twitter.length} accounts`);
  console.log(`  Viber: ${results.viber} broadcasts`);
  console.log(`  Zalo: ${results.zalo} broadcasts`);
  console.log(`  LINE: ${results.line} broadcasts`);
  console.log(`  Push: ${results.push} notifications sent`);

  return results;
}

// ── GOAL ALERT — fires to EVERYTHING in <30 seconds ──────────
async function fireGoalAlert(goalData) {
  const { home, away, homeFlag, awayFlag, scorer, team, minute, score } = goalData;
  const { LANGUAGES, LANGUAGE_PRIORITY } = require('./languages-config');
  const { LANGUAGES_EXTENDED } = require('./languages-extended');
  const ALL_LANGS = { ...LANGUAGES, ...LANGUAGES_EXTENDED };

  const TelegramBot = require('node-telegram-bot-api');
  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
  const push = new PushNotifier(process.env.ONESIGNAL_APP_ID, process.env.ONESIGNAL_API_KEY);

  console.log(`\n🔴 GOAL ALERT: ${scorer} (${minute}') — ${home} ${score} ${away}`);

  // STEP 1: Push notification to ALL subscribers IMMEDIATELY (< 5 seconds)
  if (process.env.ONESIGNAL_APP_ID) {
    await push.sendGoalAlert(home, away, scorer, minute, score);
    console.log(`  ✅ Push sent (< 5s)`);
  }

  // STEP 2: Telegram to ALL channels simultaneously
  const telegramPromises = LANGUAGE_PRIORITY.map(async (langCode) => {
    const lang = ALL_LANGS[langCode];
    if (!lang?.telegramChannel) return;

    const reaction = lang.goalReaction || '⚽ GOAL!';
    const msg = `${reaction}\n\n${homeFlag} <b>${home} ${score} ${away}</b> ${awayFlag}\n${scorer} · ${minute}'\n\n#WC2026`;

    try {
      await bot.sendMessage(lang.telegramChannel, msg, { parse_mode: 'HTML' });
    } catch (err) {
      // Silent fail — channel might not be configured yet
    }
  });

  await Promise.allSettled(telegramPromises);
  console.log(`  ✅ Telegram: all channels fired`);

  // STEP 3: Generate full reactions in all languages (runs in background)
  const matchData = { home, away, homeFlag, awayFlag, ...goalData };
  setImmediate(() => broadcastToAll(matchData, 'goal').catch(console.error));

  return { success: true, timestamp: Date.now() };
}

module.exports = {
  TwitterPoster,
  MetaPoster,
  YouTubePoster,
  ViberPoster,
  ZaloPoster,
  LINEPoster,
  PushNotifier,
  broadcastToAll,
  fireGoalAlert
};
