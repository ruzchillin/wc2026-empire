/**
 * WC2026 Empire — Global Reach Engine
 * Auto-translate + localize + post to every country/language simultaneously
 * Routes content to the right regional platform for each market
 *
 * 20+ languages | 20+ countries | 15+ platforms
 * Runs via GitHub Actions — zero server cost
 *
 * Usage: node global-reach-engine.js --content "Your post here" --event "match_result"
 */

const https = require('https');

// ─── Config ───────────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SITE_URL = process.env.SITE_URL || 'https://wc2026-sports-empire.vercel.app';

// Source content to globalize (from env or args)
const SOURCE_CONTENT = process.env.SOURCE_CONTENT ||
  process.argv[process.argv.indexOf('--content') + 1] ||
  'WC2026 is here — get the best predictions, stats and analysis from around the world!';

const EVENT_TYPE = process.env.EVENT_TYPE ||
  process.argv[process.argv.indexOf('--event') + 1] ||
  'general';

// ─── Market Configuration ──────────────────────────────────────────────────────
const MARKETS = [
  // Tier 1 — Largest fan bases
  {
    id: 'uk',
    country: 'United Kingdom',
    language: 'English',
    langCode: 'en',
    platforms: ['twitter', 'instagram', 'reddit', 'discord'],
    tone: 'witty British football banter',
    affiliates: ['bet365', 'dazn', 'nordvpn'],
    sitePages: ['/index.html', '/win-share.html'],
    timezone: 'Europe/London',
  },
  {
    id: 'usa',
    country: 'United States',
    language: 'English (American)',
    langCode: 'en-us',
    platforms: ['twitter', 'reddit', 'tiktok', 'youtube'],
    tone: 'energetic American sports culture, NFL crossover appeal',
    affiliates: ['fubotv', 'nordvpn', 'expressvpn'],
    sitePages: ['/usa-wc2026.html', '/head-to-head.html'],
    timezone: 'America/New_York',
  },
  {
    id: 'india',
    country: 'India',
    language: 'Hindi',
    langCode: 'hi',
    platforms: ['sharechat', 'telegram', 'instagram', 'youtube'],
    tone: 'enthusiastic, cricket comparison references, Bollywood energy',
    affiliates: ['nordvpn', 'expressvpn'],
    sitePages: ['/india-wc2026-hindi.html', '/cricket-india.html'],
    timezone: 'Asia/Kolkata',
    translate: true,
  },
  {
    id: 'brazil',
    country: 'Brazil',
    language: 'Portuguese (Brazilian)',
    langCode: 'pt-br',
    platforms: ['twitter', 'instagram', 'reddit', 'tiktok'],
    tone: 'passionate samba football culture, jogo bonito references',
    affiliates: ['nordvpn', 'dazn'],
    sitePages: ['/brazil-wc2026.html', '/south-america-hub.html'],
    timezone: 'America/Sao_Paulo',
    translate: true,
  },
  {
    id: 'nigeria',
    country: 'Nigeria',
    language: 'English (Nigerian)',
    langCode: 'en-ng',
    platforms: ['nairaland', 'twitter', 'instagram', 'telegram'],
    tone: 'vibrant Nigerian football passion, Super Eagles pride',
    affiliates: ['nordvpn', 'expressvpn'],
    sitePages: ['/nigeria-wc2026.html', '/africa-hub.html'],
    timezone: 'Africa/Lagos',
  },
  {
    id: 'mexico',
    country: 'Mexico',
    language: 'Spanish (Mexican)',
    langCode: 'es-mx',
    platforms: ['twitter', 'instagram', 'tiktok', 'youtube'],
    tone: 'passionate El Tri culture, hosting pride (co-host), Azteca stadium references',
    affiliates: ['fubotv', 'nordvpn'],
    sitePages: ['/mexico-wc2026.html', '/south-america-hub.html'],
    timezone: 'America/Mexico_City',
    translate: true,
  },
  {
    id: 'france',
    country: 'France',
    language: 'French',
    langCode: 'fr',
    platforms: ['twitter', 'instagram', 'reddit'],
    tone: 'sophisticated French football culture, Les Bleus pride, Mbappé obsession',
    affiliates: ['dazn', 'nordvpn'],
    sitePages: ['/france-wc2026.html', '/mbappe-wc2026.html'],
    timezone: 'Europe/Paris',
    translate: true,
  },
  {
    id: 'spain',
    country: 'Spain',
    language: 'Spanish (Spain)',
    langCode: 'es',
    platforms: ['twitter', 'instagram', 'reddit', 'tiktok'],
    tone: 'tactical Spanish football passion, tiki-taka legacy, Yamal hype',
    affiliates: ['dazn', 'nordvpn'],
    sitePages: ['/spain-wc2026.html', '/yamal-wc2026.html'],
    timezone: 'Europe/Madrid',
    translate: true,
  },
  {
    id: 'korea',
    country: 'South Korea',
    language: 'Korean',
    langCode: 'ko',
    platforms: ['naver', 'twitter', 'kakao'],
    tone: 'enthusiastic K-culture crossover, Son Heung-min pride, organized fan culture',
    affiliates: ['nordvpn', 'expressvpn'],
    sitePages: ['/korea-wc2026.html', '/son-wc2026.html'],
    timezone: 'Asia/Seoul',
    translate: true,
  },
  {
    id: 'japan',
    country: 'Japan',
    language: 'Japanese',
    langCode: 'ja',
    platforms: ['twitter', 'line', 'youtube'],
    tone: 'polite, analytical Japanese football culture, Samurai Blue pride',
    affiliates: ['nordvpn', 'expressvpn', 'dazn'],
    sitePages: ['/japan-wc2026.html', '/asia-hub.html'],
    timezone: 'Asia/Tokyo',
    translate: true,
  },
  {
    id: 'indonesia',
    country: 'Indonesia',
    language: 'Indonesian',
    langCode: 'id',
    platforms: ['twitter', 'instagram', 'tiktok', 'line'],
    tone: 'youthful Indonesian football passion, underdog spirit',
    affiliates: ['nordvpn', 'expressvpn'],
    sitePages: ['/indonesia-wc2026.html', '/asia-hub.html'],
    timezone: 'Asia/Jakarta',
    translate: true,
  },
  {
    id: 'vietnam',
    country: 'Vietnam',
    language: 'Vietnamese',
    langCode: 'vi',
    platforms: ['zalo', 'facebook', 'twitter'],
    tone: 'passionate Vietnamese football fans, Southeast Asian pride',
    affiliates: ['nordvpn'],
    sitePages: ['/vietnam-wc2026.html', '/asia-hub.html'],
    timezone: 'Asia/Ho_Chi_Minh',
    translate: true,
  },
  {
    id: 'saudi',
    country: 'Saudi Arabia / MENA',
    language: 'Arabic',
    langCode: 'ar',
    platforms: ['twitter', 'snapchat', 'instagram', 'tiktok'],
    tone: 'formal Arabic sports coverage, regional pride, hosting energy (Saudi 2034 hype)',
    affiliates: ['nordvpn', 'expressvpn'],
    sitePages: ['/saudi-arabia-wc2026.html'],
    timezone: 'Asia/Riyadh',
    translate: true,
  },
  {
    id: 'germany',
    country: 'Germany',
    language: 'German',
    langCode: 'de',
    platforms: ['twitter', 'instagram', 'reddit', 'youtube'],
    tone: 'analytical German football precision, efficiency culture',
    affiliates: ['dazn', 'nordvpn'],
    sitePages: ['/germany-wc2026.html'],
    timezone: 'Europe/Berlin',
    translate: true,
  },
  {
    id: 'portugal',
    country: 'Portugal',
    language: 'Portuguese (European)',
    langCode: 'pt-pt',
    platforms: ['twitter', 'instagram', 'youtube'],
    tone: 'passionate Portuguese football, Ronaldo legacy, A Seleção pride',
    affiliates: ['dazn', 'nordvpn'],
    sitePages: ['/portugal-wc2026.html', '/ronaldo-wc2026.html'],
    timezone: 'Europe/Lisbon',
    translate: true,
  },
  {
    id: 'china',
    country: 'China (diaspora)',
    language: 'Chinese (Simplified)',
    langCode: 'zh',
    platforms: ['weibo', 'twitter'],
    tone: 'enthusiastic Chinese football fan culture, global diaspora',
    affiliates: ['nordvpn', 'expressvpn'],
    sitePages: ['/china-wc2026.html'],
    timezone: 'Asia/Shanghai',
    translate: true,
  },
  {
    id: 'russia',
    country: 'Russia / CIS',
    language: 'Russian',
    langCode: 'ru',
    platforms: ['vk', 'telegram'],
    tone: 'passionate Russian football culture, traditional European football appreciation',
    affiliates: ['nordvpn', 'expressvpn'],
    sitePages: ['/russia-wc2026.html'],
    timezone: 'Europe/Moscow',
    translate: true,
  },
  {
    id: 'philippines',
    country: 'Philippines',
    language: 'Filipino / English',
    langCode: 'tl',
    platforms: ['facebook', 'twitter', 'viber', 'instagram'],
    tone: 'enthusiastic Filipino football fans, English-leaning, passionate underdog support',
    affiliates: ['nordvpn'],
    sitePages: ['/philippines-wc2026.html', '/asia-hub.html'],
    timezone: 'Asia/Manila',
    translate: true,
  },
  {
    id: 'argentina',
    country: 'Argentina',
    language: 'Spanish (River Plate)',
    langCode: 'es-ar',
    platforms: ['twitter', 'instagram', 'tiktok'],
    tone: 'ultra-passionate Argentine football, World Champions swagger, Messi worship',
    affiliates: ['nordvpn'],
    sitePages: ['/argentina-wc2026.html', '/messi-wc2026.html'],
    timezone: 'America/Buenos_Aires',
    translate: true,
  },
];

// ─── Platform Posting Stubs ────────────────────────────────────────────────────
// These call the respective engine microservices (Railway) or use direct APIs
const PLATFORM_HANDLERS = {
  twitter: async (content, market) => {
    const url = `${process.env.TWITTER_ENGINE_URL || 'http://localhost:3028'}/post`;
    console.log(`  [Twitter/${market.id}] Would post: ${content.slice(0, 60)}...`);
    // In production: POST to twitter-engine.js
  },
  instagram: async (content, market) => {
    console.log(`  [Instagram/${market.id}] Would post: ${content.slice(0, 60)}...`);
  },
  telegram: async (content, market) => {
    // Use Telegram directly — we have the API
    const chatId = process.env[`TELEGRAM_CHAT_${market.id.toUpperCase()}`] || CHANNEL_ID;
    if (BOT_TOKEN && chatId) {
      // Would send to market-specific Telegram channels
      console.log(`  [Telegram/${market.id}] Would post to ${chatId}`);
    }
  },
  reddit: async (content, market) => {
    console.log(`  [Reddit/${market.id}] Would post to r/worldcup, r/soccer`);
  },
  nairaland: async (content, market) => {
    console.log(`  [Nairaland/${market.id}] Would post to Sports section`);
  },
  weibo: async (content, market) => {
    console.log(`  [Weibo/${market.id}] Would post: ${content.slice(0, 60)}...`);
  },
  vk: async (content, market) => {
    console.log(`  [VK/${market.id}] Would post: ${content.slice(0, 60)}...`);
  },
  naver: async (content, market) => {
    console.log(`  [Naver/${market.id}] Would post to Naver Blog`);
  },
  line: async (content, market) => {
    console.log(`  [LINE/${market.id}] Would broadcast to LINE channel`);
  },
  zalo: async (content, market) => {
    console.log(`  [Zalo/${market.id}] Would post to Zalo OA`);
  },
  kakao: async (content, market) => {
    console.log(`  [KakaoTalk/${market.id}] Would post to KakaoTalk channel`);
  },
  tiktok: async (content, market) => {
    console.log(`  [TikTok/${market.id}] Would upload video/text content`);
  },
  youtube: async (content, market) => {
    console.log(`  [YouTube/${market.id}] Would post community post or description`);
  },
  discord: async (content, market) => {
    console.log(`  [Discord/${market.id}] Would post to sports channels`);
  },
  snapchat: async (content, market) => {
    console.log(`  [Snapchat/${market.id}] Would post to Snapchat Story (Gulf market)`);
  },
  viber: async (content, market) => {
    console.log(`  [Viber/${market.id}] Would broadcast to Viber community`);
  },
  facebook: async (content, market) => {
    console.log(`  [Facebook/${market.id}] Would post to Facebook Page`);
  },
  sharechat: async (content, market) => {
    console.log(`  [ShareChat/${market.id}] Would post India regional content`);
  },
};

// ─── Core Functions ────────────────────────────────────────────────────────────
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

async function translateContent(text, targetLang, marketContext) {
  if (!GROQ_API_KEY) {
    console.log(`[${targetLang}] No Groq key — skipping translation`);
    return null;
  }

  const result = await httpsPost(
    'api.groq.com',
    '/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a professional sports content translator. Translate naturally — not literally.
Preserve energy, excitement, and cultural relevance.
Target audience: ${marketContext.country} football fans.
Adapt any cultural references to resonate locally.
Return ONLY the translated text, nothing else.`
        },
        {
          role: 'user',
          content: `Translate to ${marketContext.language}: "${text}"`
        }
      ],
      max_tokens: 300,
      temperature: 0.6,
    },
    { Authorization: `Bearer ${GROQ_API_KEY}` }
  );

  return result?.choices?.[0]?.message?.content?.trim() || null;
}

async function localizeContent(text, market) {
  if (!GROQ_API_KEY) return text;

  const result = await httpsPost(
    'api.groq.com',
    '/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a cultural localization expert for WC2026 content.
Adapt content for ${market.country} audiences with ${market.tone}.
Add relevant local references. Mention local site page if relevant: ${SITE_URL}${market.sitePages[0]}
Keep the same length. Return ONLY the adapted content.`
        },
        { role: 'user', content: text }
      ],
      max_tokens: 300,
      temperature: 0.7,
    },
    { Authorization: `Bearer ${GROQ_API_KEY}` }
  );

  return result?.choices?.[0]?.message?.content?.trim() || text;
}

// ─── Main Global Reach Function ────────────────────────────────────────────────
async function globalReach(sourceContent, eventType = 'general', targetMarkets = null) {
  const markets = targetMarkets
    ? MARKETS.filter(m => targetMarkets.includes(m.id))
    : MARKETS;

  console.log(`\n🌍 Global Reach Engine Starting`);
  console.log(`📝 Content: "${sourceContent.slice(0, 80)}..."`);
  console.log(`⚡ Event: ${eventType}`);
  console.log(`🗺️  Markets: ${markets.length}\n`);

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const market of markets) {
    console.log(`\n[${market.country.toUpperCase()}] Processing...`);

    try {
      let localContent = sourceContent;

      // Step 1: Localize (cultural adaptation)
      localContent = await localizeContent(localContent, market);
      await new Promise(r => setTimeout(r, 300)); // Rate limit

      // Step 2: Translate (if not English-based market)
      if (market.translate && market.langCode !== 'en' && market.langCode !== 'en-us' && market.langCode !== 'en-ng') {
        const translated = await translateContent(localContent, market.language, market);
        if (translated) {
          localContent = translated;
          await new Promise(r => setTimeout(r, 300)); // Rate limit
        }
      }

      // Step 3: Add market-specific CTA + site link
      const sitePage = market.sitePages[0];
      const cta = `\n🔗 ${SITE_URL}${sitePage}`;
      const finalContent = localContent + cta;

      // Step 4: Post to each platform for this market
      for (const platform of market.platforms) {
        const handler = PLATFORM_HANDLERS[platform];
        if (handler) {
          try {
            await handler(finalContent, market);
            successCount++;
          } catch (e) {
            console.log(`  ⚠ ${platform} failed: ${e.message}`);
            errorCount++;
          }
        }
      }

      results.push({
        market: market.id,
        country: market.country,
        platforms: market.platforms.length,
        contentPreview: localContent.slice(0, 80),
      });

      console.log(`  ✓ ${market.country}: ${market.platforms.length} platforms queued`);

    } catch (err) {
      console.error(`  ✗ ${market.country} failed:`, err.message);
      errorCount++;
    }
  }

  // ─── Final Report ────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`🌍 GLOBAL REACH COMPLETE`);
  console.log(`Countries reached: ${results.length}`);
  console.log(`Platform posts: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`${'─'.repeat(50)}\n`);

  return { results, successCount, errorCount };
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
async function main() {
  await globalReach(SOURCE_CONTENT, EVENT_TYPE);
}

main().catch(err => {
  console.error('Global Reach Engine error:', err);
  process.exit(1);
});

module.exports = { globalReach, MARKETS, translateContent };
