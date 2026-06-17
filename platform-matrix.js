// platform-matrix.js
// Complete mapping: every language × every platform with posting strategy
// Covers: Telegram, WhatsApp Channels, TikTok, YouTube, X/Twitter, Instagram,
//         Facebook, LINE, KakaoTalk, Zalo, Viber, WeChat, Reddit, Discord
// ─────────────────────────────────────────────────────────────────────────

// ── PLATFORM DEFINITIONS ─────────────────────────────────────

const PLATFORMS = {

  telegram: {
    name: 'Telegram',
    type: 'channel',
    automatable: true,
    apiMethod: 'telegram-bot-api',
    contentTypes: ['text', 'image', 'video', 'poll', 'link'],
    postFrequency: 'every match + goal alerts',
    bestFor: ['ALL languages — Telegram is the universal platform'],
    notes: 'Already automated via telegram-bot.py. Goal monitor fires here first.'
  },

  whatsapp: {
    name: 'WhatsApp Channels',
    type: 'channel',
    automatable: false, // No official Channel broadcast API yet
    apiMethod: 'manual-post OR WhatsApp Business API (approved templates only)',
    contentTypes: ['text', 'image', 'video', 'link'],
    postFrequency: '3-5x per day max (WhatsApp penalizes over-posting)',
    bestFor: ['Africa', 'South Asia (India/Pakistan/Bangladesh)', 'Latin America', 'Middle East', 'Southeast Asia'],
    notes: `WhatsApp Channels launched 2023. 2B+ users. No API for mass broadcast — post manually.
Prioritize: Nigeria, Kenya, Tanzania, India, Pakistan, Brazil, Mexico, Indonesia, Egypt.
Manual posting still worth it — Africa/Asia WhatsApp reach dwarfs Telegram.
Alternative: WhatsApp Business API allows template messages to opted-in subscribers.`
  },

  tiktok: {
    name: 'TikTok',
    type: 'social',
    automatable: true, // via Content Posting API (requires approval)
    apiMethod: 'tiktok-content-posting-api OR buffer',
    contentTypes: ['video', 'photo-carousel'],
    postFrequency: '2-4x per day per account',
    bestFor: ['All Tier 1 languages', 'Indonesia', 'Vietnam', 'Thailand', 'Philippines', 'Nigeria', 'Kenya'],
    notes: `TikTok Content Posting API available but requires application.
Buffer can schedule to TikTok. Best content: match card + 15-sec voice-over in native language.
Algorithm heavily favors accounts posting in underserved languages — less competition = more reach.`
  },

  youtube: {
    name: 'YouTube',
    type: 'social',
    automatable: true, // via YouTube Data API v3
    apiMethod: 'youtube-data-api-v3',
    contentTypes: ['video', 'shorts', 'community-post'],
    postFrequency: '1 full video + 2-3 Shorts per match day',
    bestFor: ['Hindi', 'Indonesian', 'Tamil', 'Telugu', 'Marathi', 'Korean', 'Japanese', 'Arabic'],
    notes: `YouTube Shorts gets algorithm push. Community Posts are automatable and work like tweets.
Match previews = 3-5 min videos. Goal compilations = Shorts (15-60 sec).
Localized YouTube channels (different language per channel) qualify for separate monetization.`
  },

  twitter_x: {
    name: 'X / Twitter',
    type: 'social',
    automatable: true, // via Twitter API v2
    apiMethod: 'twitter-api-v2',
    contentTypes: ['text', 'image', 'video', 'thread', 'poll'],
    postFrequency: '10-20x per day per account (fast-moving platform)',
    bestFor: ['Japanese (Japan\'s most used social platform)', 'Turkish', 'Indonesian', 'Korean', 'English', 'Spanish', 'Arabic'],
    notes: `X API v2 Basic plan: 10,000 tweets/month free. Twitter is Japan\'s #1 social platform.
Goal reaction tweets get massive engagement during live matches. Thread format works for previews.
Revenue share now available (monetization) for eligible accounts.`
  },

  instagram: {
    name: 'Instagram',
    type: 'social',
    automatable: true, // via Meta Graph API
    apiMethod: 'meta-graph-api',
    contentTypes: ['photo', 'carousel', 'reel', 'story', 'broadcast-channel'],
    postFrequency: '1-2 feed posts + 3-5 stories per day',
    bestFor: ['Hindi', 'Urdu', 'Punjabi', 'Tamil', 'Turkish', 'Persian', 'Arabic', 'Spanish'],
    notes: `Meta Graph API allows auto-posting of photos/videos/Reels. Stories must be posted manually.
Instagram Broadcast Channels (new feature) = one-way broadcast like Telegram channels.
Reels get 10x more reach than feed posts currently.`
  },

  facebook: {
    name: 'Facebook',
    type: 'social',
    automatable: true, // via Meta Graph API
    apiMethod: 'meta-graph-api',
    contentTypes: ['text', 'photo', 'video', 'reel', 'link', 'group-post'],
    postFrequency: '3-5x per day per page',
    bestFor: ['Tagalog (Philippines)', 'Vietnamese', 'Khmer', 'Swahili (East Africa)', 'Hausa', 'Amharic', 'Lingala', 'Yoruba', 'Bengali'],
    notes: `Facebook is #1 in Philippines, Vietnam, Cambodia, much of Africa.
Facebook Groups are powerful — join/create language-specific WC groups.
In-stream video ads pay well. Facebook Reels Bonus program available in some countries.`
  },

  // ── REGIONAL DOMINANT APPS ────────────────────────────────

  line: {
    name: 'LINE',
    type: 'messaging-app',
    automatable: true, // via LINE Messaging API
    apiMethod: 'line-messaging-api',
    contentTypes: ['text', 'image', 'video', 'flex-message', 'link'],
    postFrequency: '3-5x per day',
    bestFor: ['Thai', 'Japanese'],
    notes: `LINE is #1 messaging app in Thailand and Japan (90M+ combined users).
LINE Messaging API is free up to 200 messages/month, then paid. LINE Official Accounts needed.
Flex Messages allow rich card-style posts. Very high engagement — feels premium vs basic text.
LINE in Taiwan too (25M users). Setup: developers.line.biz`
  },

  kakaotalk: {
    name: 'KakaoTalk',
    type: 'messaging-app',
    automatable: true, // via Kakao API
    apiMethod: 'kakao-developers-api',
    contentTypes: ['text', 'image', 'template', 'link'],
    postFrequency: '3-5x per day',
    bestFor: ['Korean'],
    notes: `KakaoTalk is used by 97% of South Korea's population. Non-negotiable for Korean reach.
Kakao Channel (formerly Kakao PlusFriend) = business broadcast channel, free to create.
KakaoTalk Broadcast: send to all subscribers. Setup: business.kakao.com`
  },

  zalo: {
    name: 'Zalo',
    type: 'messaging-app',
    automatable: true, // via Zalo API
    apiMethod: 'zalo-api',
    contentTypes: ['text', 'image', 'video', 'link'],
    postFrequency: '3-5x per day',
    bestFor: ['Vietnamese'],
    notes: `Zalo has 74M users in Vietnam — more than Facebook in Vietnam.
Zalo Official Account allows broadcasting to followers (up to 1,000/day free tier).
Setup: oa.zalo.me — create Official Account, apply for verification.`
  },

  viber: {
    name: 'Viber',
    type: 'messaging-app',
    automatable: true, // via Viber REST API
    apiMethod: 'viber-rest-api',
    contentTypes: ['text', 'image', 'video', 'button', 'link'],
    postFrequency: '3-5x per day',
    bestFor: ['Croatian/Serbian', 'Romanian', 'Greek', 'Bulgarian', 'Macedonian', 'Hungarian', 'Ukrainian'],
    notes: `Viber is dominant in Balkans, Eastern Europe, and Middle East.
Viber Public Accounts: broadcast to followers for free. viber.com/en/business
Croatia: 87% Viber penetration. Serbia: 70%. Romania: 60%. Greece: 55%.
Viber Bots can autopost. API is free.`
  },

  wechat: {
    name: 'WeChat',
    type: 'messaging-app',
    automatable: true, // via WeChat API (complex)
    apiMethod: 'wechat-official-account-api',
    contentTypes: ['article', 'image', 'video', 'text', 'menu'],
    postFrequency: '1-2x per day (WeChat penalizes over-posting)',
    bestFor: ['Mandarin Chinese', 'Cantonese (diaspora)'],
    notes: `WeChat Official Account required. Monthly send limit on free tier.
Primarily for diaspora (mainland WeChat = separate ecosystem, hard to penetrate without China entity).
Chinese diaspora in US/UK/Australia/Canada uses WeChat heavily. Very high CPMs.
Setup requires business registration. Partner with a Chinese-speaking admin.`
  },

  reddit: {
    name: 'Reddit',
    type: 'community',
    automatable: false, // manual posting recommended (spam detection is aggressive)
    apiMethod: 'manual + reddit-api for light automation',
    contentTypes: ['text-post', 'link', 'image', 'comment'],
    postFrequency: '1-2x per day (respect community rules)',
    bestFor: ['All languages — Reddit has language-specific subreddits for almost every country'],
    communities: {
      africa: ['r/soccer', 'r/Nigeria', 'r/Kenya', 'r/southafrica', 'r/Ethiopia', 'r/Senegal'],
      asia: ['r/soccer', 'r/india', 'r/pakistan', 'r/indonesia', 'r/vietnam', 'r/korea', 'r/japan'],
      latam: ['r/soccer', 'r/mexico', 'r/ecuador', 'r/argentina', 'r/Brazil'],
      europe: ['r/soccer', 'r/poland', 'r/croatia', 'r/czech', 'r/greece'],
      diaspora: ['r/somali', 'r/haitian', 'r/ukrainian', 'r/kurdish']
    },
    notes: `Post genuine, value-adding content — not spam. Include your Telegram link naturally.
Best approach: post unique stats/insights that drive discussion, mention your channel in comments.
r/soccer has 3.5M members — one viral post = thousands of followers.`
  },

  discord: {
    name: 'Discord',
    type: 'community',
    automatable: true, // via Discord bot
    apiMethod: 'discord-bot-api (already in goal-monitor.js)',
    contentTypes: ['text', 'embed', 'image', 'video', 'voice-channel'],
    postFrequency: 'real-time (every goal, every significant event)',
    bestFor: ['English primarily, but create language-specific servers'],
    notes: `Already configured in goal-monitor.js.
Create separate Discord servers per language for community building.
Discord Server Subscriptions: monetize premium access.
Language-specific channels within one server also works.`
  },

  // ── ADDITIONAL REACH CHANNELS ─────────────────────────────

  newsletter_beehiiv: {
    name: 'Beehiiv Newsletter',
    type: 'email',
    automatable: true,
    apiMethod: 'beehiiv-api',
    postFrequency: '1x per match day (daily during WC)',
    bestFor: ['English', 'Spanish', 'Portuguese', 'French', 'Arabic', 'Hindi', 'Swahili'],
    notes: `Already configured. Beehiiv ad network pays $2-6 CPM automatically.
Create separate publications per language (free on Beehiiv).
Email open rates (35-55%) dwarf social media (2-8%). High-value audience.`
  },

  push_onesignal: {
    name: 'Push Notifications (OneSignal)',
    type: 'push',
    automatable: true,
    apiMethod: 'onesignal-api',
    postFrequency: 'goal alerts + match start only (dont over-send)',
    bestFor: ['All languages — works on all websites'],
    notes: `Add to all 4 Vercel tools. 50-80% open rate vs 2-5% email.
OneSignal free tier: unlimited push notifications, unlimited subscribers.
Segment by language based on browser locale or user preference.
Setup: onesignal.com — add 2 lines of JS to each HTML tool.`
  },

  google_discover: {
    name: 'Google Discover',
    type: 'organic-seo',
    automatable: true,
    apiMethod: 'wordpress-seo (via preview-engine.js)',
    postFrequency: '2x per day minimum',
    bestFor: ['ALL languages — Google Discover reaches 800M users per month on Android'],
    notes: `2.8B Android users see Discover feed. WC content during tournament gets massive traffic.
Requirements: mobile-optimized site, hero image >1200px, E-E-A-T signals.
Key: publish match previews 2 hours before kickoff — Discover rewards timely content.
Non-English content on Discover is EXTREMELY underserved. Huge traffic available.`
  }
};

// ── LANGUAGE → PLATFORM PRIORITY MATRIX ─────────────────────
// For each language: which platforms to prioritize (in order)

const PLATFORM_PRIORITY = {
  // Format: [primary, secondary, regional-app, community]

  en:  ['telegram', 'twitter_x', 'tiktok', 'youtube', 'instagram', 'facebook', 'reddit', 'discord', 'newsletter_beehiiv'],
  es:  ['telegram', 'tiktok', 'instagram', 'youtube', 'twitter_x', 'facebook', 'whatsapp', 'reddit', 'newsletter_beehiiv'],
  pt:  ['telegram', 'tiktok', 'instagram', 'youtube', 'twitter_x', 'facebook', 'whatsapp', 'newsletter_beehiiv'],
  fr:  ['telegram', 'tiktok', 'instagram', 'youtube', 'twitter_x', 'facebook', 'whatsapp'],
  ar:  ['telegram', 'instagram', 'tiktok', 'youtube', 'twitter_x', 'facebook', 'whatsapp'],

  // TIER 1 — ZERO COMPETITION MARKETS
  sw:  ['telegram', 'whatsapp', 'facebook', 'tiktok', 'youtube'],                    // East Africa — WhatsApp + Facebook dominant
  ha:  ['telegram', 'whatsapp', 'facebook', 'tiktok', 'youtube'],                    // Nigeria — WhatsApp groups critical
  zu:  ['telegram', 'whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube'],       // South Africa — all platforms
  wo:  ['telegram', 'whatsapp', 'facebook', 'tiktok', 'youtube'],                    // Senegal
  tl:  ['facebook', 'tiktok', 'instagram', 'youtube', 'twitter_x', 'whatsapp', 'telegram'], // Philippines — Facebook #1
  vi:  ['facebook', 'tiktok', 'youtube', 'zalo', 'telegram'],                        // Vietnam — Zalo + Facebook
  my:  ['facebook', 'telegram', 'tiktok', 'youtube'],                                // Myanmar — Facebook dominant
  am:  ['telegram', 'facebook', 'youtube', 'tiktok'],                                // Ethiopia — Telegram dominant
  ig:  ['whatsapp', 'facebook', 'tiktok', 'instagram', 'telegram', 'youtube'],       // Nigeria Igbo
  so:  ['telegram', 'facebook', 'tiktok', 'youtube'],                                // Somali diaspora
  ber: ['youtube', 'tiktok', 'instagram', 'facebook', 'telegram', 'twitter_x'],      // Berber
  af:  ['facebook', 'instagram', 'youtube', 'twitter_x', 'telegram', 'whatsapp'],   // Afrikaans SA
  ml:  ['youtube', 'facebook', 'whatsapp', 'instagram', 'tiktok', 'telegram'],       // Malayalam — YouTube huge

  // TIER 2 — LOW COMPETITION
  hi:  ['youtube', 'instagram', 'tiktok', 'facebook', 'whatsapp', 'telegram', 'twitter_x'],
  id:  ['tiktok', 'instagram', 'youtube', 'twitter_x', 'facebook', 'telegram', 'whatsapp'],
  bn:  ['facebook', 'youtube', 'tiktok', 'whatsapp', 'telegram'],
  th:  ['facebook', 'youtube', 'tiktok', 'line', 'instagram', 'telegram'],           // LINE critical for Thailand
  fa:  ['telegram', 'instagram', 'youtube', 'twitter_x'],                            // Telegram #1 in Iran
  yo:  ['whatsapp', 'instagram', 'tiktok', 'facebook', 'twitter_x', 'telegram'],     // Nigeria Yoruba
  ln:  ['facebook', 'whatsapp', 'youtube', 'tiktok', 'telegram'],                    // Congo
  ur:  ['youtube', 'whatsapp', 'facebook', 'instagram', 'tiktok', 'telegram'],       // Urdu/Pakistan
  pa:  ['youtube', 'instagram', 'facebook', 'whatsapp', 'tiktok', 'telegram'],       // Punjabi
  ta:  ['youtube', 'facebook', 'whatsapp', 'instagram', 'tiktok', 'telegram'],       // Tamil
  gu:  ['whatsapp', 'facebook', 'youtube', 'instagram', 'tiktok', 'telegram'],       // Gujarati — WhatsApp critical
  mr:  ['youtube', 'facebook', 'whatsapp', 'instagram', 'tiktok', 'telegram'],       // Marathi
  te:  ['youtube', 'facebook', 'whatsapp', 'instagram', 'tiktok', 'telegram'],       // Telugu
  ne:  ['facebook', 'youtube', 'tiktok', 'instagram', 'telegram'],                   // Nepali
  pl:  ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter_x', 'telegram'],      // Polish
  ro:  ['facebook', 'youtube', 'instagram', 'tiktok', 'telegram'],                   // Romanian
  cs:  ['youtube', 'facebook', 'instagram', 'tiktok', 'telegram'],                   // Czech
  hr:  ['facebook', 'youtube', 'instagram', 'viber', 'tiktok', 'telegram'],          // Croatian — Viber #1
  el:  ['facebook', 'instagram', 'youtube', 'tiktok', 'telegram'],                   // Greek
  hu:  ['facebook', 'youtube', 'instagram', 'tiktok', 'telegram'],                   // Hungarian
  sv:  ['instagram', 'youtube', 'tiktok', 'twitter_x', 'telegram'],                  // Swedish
  ca:  ['instagram', 'youtube', 'tiktok', 'twitter_x', 'telegram'],                  // Catalan
  sq:  ['facebook', 'instagram', 'youtube', 'tiktok', 'telegram'],                   // Albanian
  yue: ['youtube', 'instagram', 'facebook', 'whatsapp', 'telegram', 'wechat'],       // Cantonese
  km:  ['facebook', 'youtube', 'tiktok', 'telegram'],                                // Khmer
  ku:  ['youtube', 'facebook', 'instagram', 'tiktok', 'telegram'],                   // Kurdish
  uz:  ['telegram', 'tiktok', 'youtube', 'instagram', 'facebook'],                   // Uzbek
  ht:  ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'telegram'],       // Haitian Creole
  jam: ['instagram', 'tiktok', 'youtube', 'twitter_x', 'facebook', 'telegram'],      // Jamaican
  qu:  ['facebook', 'whatsapp', 'youtube', 'tiktok', 'telegram'],                    // Quechua
  ps:  ['facebook', 'whatsapp', 'youtube', 'telegram'],                              // Pashto

  // TIER 3 — QUALIFIED TEAMS
  ko:  ['twitter_x', 'instagram', 'youtube', 'kakaotalk', 'tiktok', 'telegram'],     // Korean — KakaoTalk critical
  ja:  ['twitter_x', 'youtube', 'instagram', 'tiktok', 'line', 'telegram'],          // Japanese — LINE critical
  de:  ['youtube', 'instagram', 'tiktok', 'twitter_x', 'facebook', 'telegram'],      // German
  nl:  ['instagram', 'youtube', 'tiktok', 'twitter_x', 'facebook', 'telegram'],      // Dutch
  it:  ['instagram', 'youtube', 'tiktok', 'twitter_x', 'facebook', 'telegram'],      // Italian
  tr:  ['instagram', 'youtube', 'tiktok', 'twitter_x', 'facebook', 'telegram'],      // Turkish
  zh:  ['wechat', 'youtube', 'instagram', 'facebook', 'tiktok', 'telegram'],         // Chinese — WeChat for diaspora
  uk:  ['telegram', 'instagram', 'youtube', 'tiktok', 'facebook', 'viber'],         // Ukrainian — Viber too
};

// ── TOTAL ACCOUNT COUNT ─────────────────────────────────────
function calculateTotalAccounts() {
  const langCodes = Object.keys(PLATFORM_PRIORITY);
  let total = 0;
  const breakdown = {};

  langCodes.forEach(lang => {
    const platforms = PLATFORM_PRIORITY[lang];
    total += platforms.length;
    platforms.forEach(p => {
      breakdown[p] = (breakdown[p] || 0) + 1;
    });
  });

  return { total, breakdown };
}

const { total, breakdown } = calculateTotalAccounts();
console.log(`\n[PlatformMatrix] Total accounts needed: ${total}`);
console.log('[PlatformMatrix] Accounts per platform:');
Object.entries(breakdown).sort((a,b) => b[1]-a[1]).forEach(([p, count]) => {
  console.log(`  ${PLATFORMS[p]?.name || p}: ${count} accounts`);
});

// ── WHATSAPP CHANNEL PRIORITY LIST ───────────────────────────
// Manual posting order — which languages to prioritize for WhatsApp first
const WHATSAPP_PRIORITY_LANGS = ['sw', 'ha', 'ig', 'yo', 'so', 'ln', 'hi', 'ur', 'pa', 'bn', 'ta', 'ml', 'te', 'gu', 'id', 'tl', 'vi', 'km', 'es', 'pt', 'ar', 'th', 'zu', 'af', 'am', 'hr', 'el', 'yue'];
// 28 WhatsApp Channels — post manually in this order for each match

// ── REDDIT COMMUNITIES LIST ───────────────────────────────────
const REDDIT_COMMUNITIES = {
  // Language/country subreddits — post in native language
  africa: ['r/Nigeria', 'r/Kenya', 'r/southafrica', 'r/Ethiopia', 'r/Ghana', 'r/Senegal', 'r/Morocco', 'r/African', 'r/africa'],
  asia: ['r/india', 'r/pakistan', 'r/bangladesh', 'r/indonesia', 'r/Philippines', 'r/vietnam', 'r/Thailand', 'r/Malaysia', 'r/korea', 'r/japan', 'r/iran'],
  latam: ['r/mexico', 'r/ecuador', 'r/colombia', 'r/argentina', 'r/brasil', 'r/LatinAmerica'],
  europe: ['r/poland', 'r/croatia', 'r/czech', 'r/greece', 'r/hungary', 'r/ukraine', 'r/sweden', 'r/turkey', 'r/germany', 'r/Netherlands'],
  football: ['r/soccer', 'r/WorldCup', 'r/ussoccer', 'r/MLS'],
  diaspora: ['r/somali', 'r/haitian', 'r/ukrainian', 'r/Desi', 'r/ABCDesis', 'r/britishasians', 'r/NigerianDiaspora']
};

// ── FACEBOOK GROUPS STRATEGY ─────────────────────────────────
const FACEBOOK_GROUP_TARGETS = {
  // These groups already have millions of football fans — join and post valuable content
  africa: [
    'African Football Fan Club', 'Nigeria Football Fans', 'Super Eagles Fans',
    'Bafana Bafana Official', 'Africa Cup of Nations', 'Kenya Football'
  ],
  southAsia: [
    'Football Fans India', 'Pakistan Football', 'Bengali Football Club',
    'Kerala Football', 'Tamil Football'
  ],
  southeastAsia: [
    'Indonesian Football Fan', 'Filipino Football', 'Vietnam Football',
    'Thailand Football', 'Cambodia Football'
  ],
  diaspora: [
    'Somali Football', 'Afghan Football Fans', 'Kurdish Football',
    'Haitian Football'
  ]
};

module.exports = {
  PLATFORMS,
  PLATFORM_PRIORITY,
  WHATSAPP_PRIORITY_LANGS,
  REDDIT_COMMUNITIES,
  FACEBOOK_GROUP_TARGETS,
  calculateTotalAccounts
};
