/**
 * content-multiplier.js
 * The empire's multiplication layer.
 * Takes any content/stream/idea and multiplies it across:
 *   16 languages × 32 countries × 8 platforms × 20 squeezes = ~82,000 touchpoints per idea
 *   440 ideas × 82,000 = ~36,000,000 potential monetisation instances
 *
 * Connects to: world-engine.js (content source), integration-hub.js (routing/tracking),
 *              affiliate-matrix.js (geo-correct links), squeeze-engine.js (conversion layer)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

// ─── Language Matrix ──────────────────────────────────────────────────────────
const LANGUAGES = {
  en:    { name: 'English',    speakers: 1500e6, priority: 1 },
  es:    { name: 'Spanish',    speakers: 560e6,  priority: 2 },
  pt:    { name: 'Portuguese', speakers: 280e6,  priority: 3 },
  fr:    { name: 'French',     speakers: 320e6,  priority: 4 },
  ar:    { name: 'Arabic',     speakers: 420e6,  priority: 5 },
  hi:    { name: 'Hindi',      speakers: 600e6,  priority: 6 },
  sw:    { name: 'Swahili',    speakers: 200e6,  priority: 7 },
  de:    { name: 'German',     speakers: 100e6,  priority: 8 },
  ja:    { name: 'Japanese',   speakers: 125e6,  priority: 9 },
  ko:    { name: 'Korean',     speakers: 80e6,   priority: 10 },
  nl:    { name: 'Dutch',      speakers: 24e6,   priority: 11 },
  tr:    { name: 'Turkish',    speakers: 88e6,   priority: 12 },
  id:    { name: 'Indonesian', speakers: 270e6,  priority: 13 },
  vi:    { name: 'Vietnamese', speakers: 95e6,   priority: 14 },
  bn:    { name: 'Bengali',    speakers: 270e6,  priority: 15 },
  zh:    { name: 'Chinese',    speakers: 920e6,  priority: 16 },
};

// ─── Country → Platform Map ───────────────────────────────────────────────────
const COUNTRY_PLATFORMS = {
  GB:  { lang: 'en', platforms: ['twitter','instagram','tiktok','youtube','facebook','reddit','telegram','email'], timezone: 'Europe/London' },
  US:  { lang: 'en', platforms: ['twitter','instagram','tiktok','youtube','facebook','reddit','telegram','email'], timezone: 'America/New_York' },
  NG:  { lang: 'en', platforms: ['whatsapp','twitter','instagram','facebook','telegram','tiktok','sms','email'],  timezone: 'Africa/Lagos' },
  KE:  { lang: 'sw', platforms: ['whatsapp','twitter','instagram','facebook','telegram','tiktok','sms','email'],  timezone: 'Africa/Nairobi' },
  GH:  { lang: 'en', platforms: ['whatsapp','twitter','instagram','facebook','telegram','tiktok','sms','email'],  timezone: 'Africa/Accra' },
  ZA:  { lang: 'en', platforms: ['whatsapp','twitter','instagram','facebook','tiktok','telegram','email','youtube'], timezone: 'Africa/Johannesburg' },
  BR:  { lang: 'pt', platforms: ['instagram','whatsapp','twitter','tiktok','youtube','facebook','telegram','email'], timezone: 'America/Sao_Paulo' },
  IN:  { lang: 'hi', platforms: ['youtube','instagram','whatsapp','twitter','telegram','facebook','sharechat','email'], timezone: 'Asia/Kolkata' },
  MX:  { lang: 'es', platforms: ['instagram','twitter','tiktok','facebook','youtube','whatsapp','telegram','email'], timezone: 'America/Mexico_City' },
  AR:  { lang: 'es', platforms: ['twitter','instagram','tiktok','facebook','youtube','telegram','whatsapp','email'], timezone: 'America/Argentina/Buenos_Aires' },
  CO:  { lang: 'es', platforms: ['instagram','tiktok','twitter','facebook','youtube','whatsapp','telegram','email'], timezone: 'America/Bogota' },
  DE:  { lang: 'de', platforms: ['twitter','instagram','youtube','tiktok','facebook','telegram','reddit','email'],  timezone: 'Europe/Berlin' },
  FR:  { lang: 'fr', platforms: ['twitter','instagram','tiktok','youtube','facebook','telegram','reddit','email'],  timezone: 'Europe/Paris' },
  ES:  { lang: 'es', platforms: ['twitter','instagram','tiktok','youtube','facebook','telegram','reddit','email'],  timezone: 'Europe/Madrid' },
  NL:  { lang: 'nl', platforms: ['twitter','instagram','tiktok','youtube','facebook','telegram','reddit','email'],  timezone: 'Europe/Amsterdam' },
  PT:  { lang: 'pt', platforms: ['twitter','instagram','tiktok','youtube','facebook','telegram','email','reddit'],  timezone: 'Europe/Lisbon' },
  MA:  { lang: 'ar', platforms: ['instagram','facebook','tiktok','twitter','youtube','whatsapp','telegram','email'], timezone: 'Africa/Casablanca' },
  SN:  { lang: 'fr', platforms: ['facebook','whatsapp','instagram','twitter','tiktok','youtube','telegram','sms'],  timezone: 'Africa/Dakar' },
  CM:  { lang: 'fr', platforms: ['facebook','whatsapp','instagram','twitter','tiktok','telegram','sms','email'],    timezone: 'Africa/Douala' },
  JP:  { lang: 'ja', platforms: ['twitter','youtube','instagram','tiktok','line','facebook','telegram','email'],    timezone: 'Asia/Tokyo' },
  KR:  { lang: 'ko', platforms: ['youtube','instagram','twitter','tiktok','kakao','naver','telegram','email'],      timezone: 'Asia/Seoul' },
  AU:  { lang: 'en', platforms: ['twitter','instagram','tiktok','youtube','facebook','reddit','telegram','email'],  timezone: 'Australia/Sydney' },
  CA:  { lang: 'en', platforms: ['twitter','instagram','tiktok','youtube','facebook','reddit','telegram','email'],  timezone: 'America/Toronto' },
  TR:  { lang: 'tr', platforms: ['instagram','twitter','tiktok','youtube','facebook','telegram','whatsapp','email'], timezone: 'Europe/Istanbul' },
  ID:  { lang: 'id', platforms: ['instagram','tiktok','youtube','facebook','twitter','whatsapp','telegram','email'], timezone: 'Asia/Jakarta' },
  SA:  { lang: 'ar', platforms: ['twitter','instagram','snapchat','tiktok','youtube','facebook','telegram','email'], timezone: 'Asia/Riyadh' },
  EG:  { lang: 'ar', platforms: ['facebook','youtube','twitter','instagram','tiktok','whatsapp','telegram','email'], timezone: 'Africa/Cairo' },
  PK:  { lang: 'bn', platforms: ['facebook','youtube','tiktok','instagram','twitter','whatsapp','telegram','email'], timezone: 'Asia/Karachi' },
  VN:  { lang: 'vi', platforms: ['facebook','tiktok','youtube','instagram','zalo','twitter','telegram','email'],     timezone: 'Asia/Ho_Chi_Minh' },
  CI:  { lang: 'fr', platforms: ['facebook','whatsapp','instagram','twitter','tiktok','telegram','sms','email'],    timezone: 'Africa/Abidjan' },
  UG:  { lang: 'sw', platforms: ['whatsapp','facebook','twitter','instagram','tiktok','telegram','sms','email'],    timezone: 'Africa/Kampala' },
  TZ:  { lang: 'sw', platforms: ['whatsapp','facebook','twitter','instagram','tiktok','telegram','sms','email'],    timezone: 'Africa/Dar_es_Salaam' },
};

// ─── Platform Post Configs ────────────────────────────────────────────────────
const PLATFORM_CONFIGS = {
  twitter:   { maxChars: 280,   hasVideo: true,  hasPoll: true,  affiliateOk: true  },
  instagram: { maxChars: 2200,  hasVideo: true,  hasPoll: false, affiliateOk: true  },
  tiktok:    { maxChars: 2200,  hasVideo: true,  hasPoll: false, affiliateOk: false },
  youtube:   { maxChars: 5000,  hasVideo: true,  hasPoll: true,  affiliateOk: true  },
  facebook:  { maxChars: 63206, hasVideo: true,  hasPoll: true,  affiliateOk: true  },
  reddit:    { maxChars: 40000, hasVideo: false, hasPoll: true,  affiliateOk: false },
  telegram:  { maxChars: 4096,  hasVideo: true,  hasPoll: true,  affiliateOk: true  },
  whatsapp:  { maxChars: 65536, hasVideo: true,  hasPoll: false, affiliateOk: true  },
  email:     { maxChars: 99999, hasVideo: false, hasPoll: false, affiliateOk: true  },
  sms:       { maxChars: 160,   hasVideo: false, hasPoll: false, affiliateOk: false },
  line:      { maxChars: 2000,  hasVideo: true,  hasPoll: false, affiliateOk: true  },
  kakao:     { maxChars: 1000,  hasVideo: false, hasPoll: false, affiliateOk: true  },
  naver:     { maxChars: 5000,  hasVideo: true,  hasPoll: false, affiliateOk: true  },
  sharechat: { maxChars: 1000,  hasVideo: true,  hasPoll: false, affiliateOk: false },
  zalo:      { maxChars: 2000,  hasVideo: true,  hasPoll: false, affiliateOk: true  },
  snapchat:  { maxChars: 250,   hasVideo: true,  hasPoll: false, affiliateOk: false },
};

// ─── Squeeze Mechanics (20) ────────────────────────────────────────────────────
const SQUEEZE_MECHANICS = [
  'social_proof_counter',    // "4,231 fans checking this now"
  'exit_intent_capture',     // email modal on leave
  'scarcity_ticker',         // "only 47 picks remaining"
  'upsell_popup',            // 45s timer premium push
  'referral_prompt',         // share for unlock
  'co_registration',         // £0.50-2.00 per partner signup
  'push_notification',       // browser push subscription
  'cross_sell_bar',          // sticky top bar, adjacent product
  'retargeting_pixels',      // FB + GA pixel fire
  'loss_aversion_cta',       // "Don't miss tonight's value bet"
  'progress_bar',            // multi-step flow completion
  'post_action_upsell',      // after prediction → premium
  'mobile_abandonment',      // swipe-down WhatsApp capture
  'share_to_unlock',         // locked content behind share
  'fomo_countdown',          // data-countdown timers
  'drama_alert_bar',         // breaking news banner
  'geo_affiliate_inject',    // country-correct affiliate link
  'whatsapp_fab',            // floating WhatsApp button
  'streak_reminder',         // daily return incentive
  'ai_was_right_upsell',     // post-match confidence upsell
];

// ─── Core Engine ──────────────────────────────────────────────────────────────
class ContentMultiplier {
  constructor(options = {}) {
    this.groq       = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.matrix     = require('./affiliate-matrix');
    this.hub        = null; // injected after hub boots
    this.queue      = [];
    this.stats      = {
      totalTouchpoints: 0,
      byCountry: {},
      byPlatform: {},
      byLanguage: {},
      byStream: {},
      translationsToday: 0,
      postsScheduled: 0,
      affiliateLinksInjected: 0,
      squeezesApplied: 0,
    };
    this.activeJobs = new Map();
    this.log        = (tag, msg) => console.log(`[${new Date().toISOString()}] [MUL:${tag}] ${msg}`);
  }

  setHub(hub) { this.hub = hub; }

  // ─── Main Entry Point ─────────────────────────────────────────────────────
  // Call this with any content piece — article, prediction, tip, tool URL, etc.
  async multiply(content, options = {}) {
    const {
      streamType   = 'general',       // 'affiliate','tip','prediction','viral','b2b','product'
      targetRegions = Object.keys(COUNTRY_PLATFORMS),
      targetLangs  = Object.keys(LANGUAGES),
      priority     = 5,               // 1 (highest) – 10 (lowest)
      scheduleNow  = true,
      squeezes     = SQUEEZE_MECHANICS,
    } = options;

    const jobId = `mul_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    this.log('JOB', `Starting multiplication job ${jobId} | stream=${streamType} | regions=${targetRegions.length} | langs=${targetLangs.length}`);

    const job = {
      id: jobId,
      content,
      streamType,
      createdAt: Date.now(),
      touchpoints: [],
      status: 'running',
    };
    this.activeJobs.set(jobId, job);

    // Step 1: Translate content into all target languages
    const translations = await this._translateAll(content, targetLangs, streamType);

    // Step 2: For each country, build platform posts with correct language + affiliate
    for (const countryCode of targetRegions) {
      const countryDef = COUNTRY_PLATFORMS[countryCode];
      if (!countryDef) continue;

      const lang        = countryDef.lang;
      const text        = translations[lang] || translations['en'];
      const affiliates  = this.matrix.getAffiliates(countryCode, streamType);
      const postTime    = this._optimalPostTime(countryDef.timezone, priority);

      for (const platform of countryDef.platforms) {
        const platformCfg = PLATFORM_CONFIGS[platform];
        if (!platformCfg) continue;

        // Format post for platform character limits
        const formatted = this._formatForPlatform(text, platform, platformCfg, affiliates, streamType);

        // Map applicable squeezes for this platform
        const applicableSqueezes = squeezes.filter(sq => this._squeezeApplies(sq, platform, streamType));

        const touchpoint = {
          jobId,
          countryCode,
          platform,
          lang,
          content: formatted,
          affiliates,
          squeezes: applicableSqueezes,
          scheduledAt: postTime,
          streamType,
          status: 'queued',
        };

        job.touchpoints.push(touchpoint);
        this.queue.push(touchpoint);

        // Update stats
        this.stats.totalTouchpoints++;
        this.stats.byCountry[countryCode]  = (this.stats.byCountry[countryCode]  || 0) + 1;
        this.stats.byPlatform[platform]    = (this.stats.byPlatform[platform]    || 0) + 1;
        this.stats.byLanguage[lang]        = (this.stats.byLanguage[lang]        || 0) + 1;
        this.stats.byStream[streamType]    = (this.stats.byStream[streamType]    || 0) + 1;
        this.stats.affiliateLinksInjected += affiliates.length;
        this.stats.squeezesApplied        += applicableSqueezes.length;
        this.stats.postsScheduled++;
      }
    }

    job.status = 'queued';
    job.touchpointCount = job.touchpoints.length;

    this.log('JOB', `Job ${jobId} queued: ${job.touchpointCount} touchpoints across ${targetRegions.length} countries`);

    // Emit to hub for tracking
    if (this.hub) {
      this.hub.emit('CONTENT_MULTIPLIED', {
        jobId,
        streamType,
        touchpointCount: job.touchpointCount,
        countriesReached: targetRegions.length,
        platformsUsed: new Set(job.touchpoints.map(t => t.platform)).size,
        squeezesPerTouchpoint: SQUEEZE_MECHANICS.length,
      });
    }

    return job;
  }

  // ─── Translate all content into all languages via Groq ────────────────────
  async _translateAll(content, targetLangs, streamType) {
    const translations = { en: typeof content === 'string' ? content : content.body || content.text || '' };
    const srcText = translations.en;

    // Group translations into batches of 4 to avoid rate limits
    const nonEnglish = targetLangs.filter(l => l !== 'en');
    const batches    = [];
    for (let i = 0; i < nonEnglish.length; i += 4) {
      batches.push(nonEnglish.slice(i, i + 4));
    }

    for (const batch of batches) {
      try {
        const langNames = batch.map(l => `${l}: ${LANGUAGES[l].name}`).join(', ');
        const prompt = `You are a sports content translator. Translate the following text into these languages: ${langNames}.
Return ONLY a JSON object with language codes as keys and translations as values.
Keep football/soccer terminology correct for each region. Keep any numbers, emojis, and affiliate call-to-actions.
Preserve the tone — if it's exciting, keep it exciting in the translated language.

Text to translate:
${srcText}

JSON response only, no markdown:`;

        const res = await this.groq.chat.completions.create({
          model: 'llama3-70b-8192',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2048,
        });

        const raw = res.choices[0].message.content.trim();
        // Extract JSON safely
        const jsonStart = raw.indexOf('{');
        const jsonEnd   = raw.lastIndexOf('}') + 1;
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd));
          Object.assign(translations, parsed);
        }
        this.stats.translationsToday += batch.length;
      } catch (err) {
        this.log('TRANSLATE_ERR', `Batch translate failed: ${err.message} — using English fallback`);
        for (const lang of batch) translations[lang] = srcText; // fallback
      }
    }

    return translations;
  }

  // ─── Format for platform limits ───────────────────────────────────────────
  _formatForPlatform(text, platform, config, affiliates, streamType) {
    let out = text;

    // Append affiliate link if platform allows and we have one
    if (config.affiliateOk && affiliates.length > 0) {
      const aff = affiliates[0]; // primary affiliate for this country/stream
      if (platform === 'twitter') {
        out = `${out.slice(0, 200)} ${aff.link}`;
      } else if (platform === 'email') {
        out = `${out}\n\n👉 ${aff.label}: ${aff.link}`;
      } else if (platform === 'telegram') {
        out = `${out}\n\n🔗 [${aff.label}](${aff.link})`;
      } else {
        out = `${out}\n\n${aff.label}: ${aff.link}`;
      }
    }

    // Truncate to platform limit with ellipsis
    if (out.length > config.maxChars) {
      out = out.slice(0, config.maxChars - 3) + '...';
    }

    return out;
  }

  // ─── Which squeezes apply to this platform/stream combo ───────────────────
  _squeezeApplies(squeeze, platform, streamType) {
    const webOnly = ['exit_intent_capture','upsell_popup','push_notification','cross_sell_bar',
                     'retargeting_pixels','progress_bar','post_action_upsell','mobile_abandonment',
                     'share_to_unlock','fomo_countdown','drama_alert_bar','geo_affiliate_inject',
                     'whatsapp_fab','streak_reminder','ai_was_right_upsell'];
    const socialOk = ['social_proof_counter','referral_prompt','co_registration',
                      'loss_aversion_cta','scarcity_ticker'];

    if (platform === 'email')                    return true;           // email gets all
    if (['twitter','facebook','instagram','telegram','tiktok'].includes(platform)) {
      return socialOk.includes(squeeze);
    }
    if (platform === 'whatsapp' || platform === 'sms') {
      return ['referral_prompt','co_registration','loss_aversion_cta','scarcity_ticker'].includes(squeeze);
    }
    // web tools (the 30 HTML pages) get everything
    return true;
  }

  // ─── Optimal post time by timezone ────────────────────────────────────────
  _optimalPostTime(timezone, priority) {
    // Best engagement windows per timezone (UTC offsets approximated)
    const optimalHours = {
      'Europe/London':              [7, 12, 17, 20],
      'America/New_York':           [8, 12, 17, 20],
      'Africa/Lagos':               [7, 12, 18, 21],
      'Africa/Nairobi':             [6, 11, 17, 20],
      'Africa/Accra':               [7, 12, 18, 21],
      'America/Sao_Paulo':          [8, 12, 18, 21],
      'Asia/Kolkata':               [7, 12, 18, 21],
      'America/Mexico_City':        [8, 12, 17, 20],
      'America/Argentina/Buenos_Aires': [8, 12, 18, 21],
      'Europe/Berlin':              [7, 12, 17, 20],
      'Europe/Paris':               [7, 12, 17, 20],
      'Europe/Madrid':              [8, 13, 18, 21],
      'Asia/Tokyo':                 [7, 12, 18, 21],
      'Asia/Seoul':                 [7, 12, 18, 21],
      'Australia/Sydney':           [7, 12, 17, 20],
      'Africa/Johannesburg':        [7, 12, 17, 20],
    };

    const hours = optimalHours[timezone] || [8, 12, 17, 20];
    const hour  = hours[priority % hours.length];
    const now   = new Date();
    const next  = new Date(now);
    next.setHours(hour, Math.floor(Math.random() * 30), 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  // ─── Process the queue ────────────────────────────────────────────────────
  // In production this is called by a scheduler; each item is dispatched to the
  // correct posting adapter (telegram-bot, whatsapp-bot, email system, etc.)
  async processQueue(limit = 50) {
    const batch = this.queue.splice(0, limit);
    let dispatched = 0;

    for (const tp of batch) {
      try {
        await this._dispatch(tp);
        tp.status = 'sent';
        dispatched++;
      } catch (err) {
        tp.status = 'failed';
        tp.error  = err.message;
        this.queue.push(tp); // retry
      }
    }

    this.log('QUEUE', `Dispatched ${dispatched}/${batch.length} touchpoints. Queue remaining: ${this.queue.length}`);
    return dispatched;
  }

  // ─── Dispatch to correct adapter ──────────────────────────────────────────
  async _dispatch(touchpoint) {
    const { platform, content, scheduledAt, countryCode, lang, squeezes } = touchpoint;

    // Schedule via world-engine's scheduling API
    const schedulePayload = {
      platform,
      content,
      scheduledAt,
      countryCode,
      lang,
      squeezes,
      streamType: touchpoint.streamType,
    };

    // Write to platform-specific queue file
    const queueDir  = path.join(__dirname, 'queues');
    if (!fs.existsSync(queueDir)) fs.mkdirSync(queueDir, { recursive: true });
    const queueFile = path.join(queueDir, `${platform}-queue.json`);

    let existing = [];
    try { existing = JSON.parse(fs.readFileSync(queueFile, 'utf8')); } catch {}
    existing.push(schedulePayload);
    fs.writeFileSync(queueFile, JSON.stringify(existing, null, 2));
  }

  // ─── Mass multiply: fire ALL 440 ideas across ALL streams ─────────────────
  async multiplyAll(contentItems) {
    this.log('EMPIRE', `Mass multiplication: ${contentItems.length} items → ${contentItems.length * Object.keys(COUNTRY_PLATFORMS).length * 8 * 20} potential touchpoints`);
    const jobs = [];

    for (const item of contentItems) {
      const job = await this.multiply(item.content, {
        streamType:    item.streamType || 'general',
        priority:      item.priority || 5,
        targetRegions: item.regions  || Object.keys(COUNTRY_PLATFORMS),
        targetLangs:   item.langs    || Object.keys(LANGUAGES),
      });
      jobs.push(job);

      // Brief pause between items to respect Groq rate limits (500K tokens/day)
      await new Promise(r => setTimeout(r, 800));
    }

    return {
      jobsCreated:        jobs.length,
      totalTouchpoints:   jobs.reduce((s, j) => s + (j.touchpointCount || 0), 0),
      totalAffiliates:    this.stats.affiliateLinksInjected,
      totalSqueezes:      this.stats.squeezesApplied,
      translations:       this.stats.translationsToday,
    };
  }

  // ─── Stats / telemetry ────────────────────────────────────────────────────
  getStats() {
    return {
      ...this.stats,
      queueDepth: this.queue.length,
      activeJobs: this.activeJobs.size,
      dimensions: {
        languages:  Object.keys(LANGUAGES).length,
        countries:  Object.keys(COUNTRY_PLATFORMS).length,
        platforms:  Object.keys(PLATFORM_CONFIGS).length,
        squeezes:   SQUEEZE_MECHANICS.length,
        ideas_max:  440,
        touchpoints_per_idea: Object.keys(COUNTRY_PLATFORMS).length * 8 * SQUEEZE_MECHANICS.length,
        max_total_touchpoints: 440 * Object.keys(COUNTRY_PLATFORMS).length * 8 * SQUEEZE_MECHANICS.length,
      },
    };
  }
}

// ─── Stream Type Configs ───────────────────────────────────────────────────────
// Maps each of the 440+ income stream types to the right multiply behaviour
const STREAM_CONFIGS = {
  affiliate_sportsbook: {
    regions: ['GB','IE','AU','NG','KE','GH','ZA','US','CA'],
    squeezes: ['loss_aversion_cta','scarcity_ticker','geo_affiliate_inject','social_proof_counter','fomo_countdown'],
    note: 'Age-gated: 18+ only, parent account strategy for under-18',
  },
  affiliate_vpn: {
    regions: Object.keys(COUNTRY_PLATFORMS), // ALL 32 countries
    squeezes: ['social_proof_counter','exit_intent_capture','scarcity_ticker','loss_aversion_cta','drama_alert_bar'],
    note: 'Works in every country, especially high-value for fans in countries with geo-blocked streams',
  },
  affiliate_streaming: {
    regions: Object.keys(COUNTRY_PLATFORMS),
    squeezes: ['fomo_countdown','social_proof_counter','scarcity_ticker','drama_alert_bar','geo_affiliate_inject'],
  },
  affiliate_travel: {
    regions: ['US','GB','DE','FR','AU','CA','JP','KR','SA','AE'],
    squeezes: ['scarcity_ticker','fomo_countdown','social_proof_counter'],
  },
  display_ads: {
    regions: Object.keys(COUNTRY_PLATFORMS),
    squeezes: ['social_proof_counter','streak_reminder','cross_sell_bar','drama_alert_bar'],
    note: 'Ezoic everywhere, Mediavine after 50K/mo UK',
  },
  subscription_consumer: {
    regions: Object.keys(COUNTRY_PLATFORMS),
    squeezes: ['exit_intent_capture','upsell_popup','post_action_upsell','progress_bar','referral_prompt','streak_reminder'],
    tiers: ['free','£4.99','£9.99','£49.99','£99_lifetime'],
  },
  subscription_b2b: {
    regions: ['GB','US','IE','AU','DE','FR','ES','NL'],
    squeezes: ['progress_bar','post_action_upsell','co_registration'],
    tiers: ['£49/mo','£99/mo','£199/mo','£499/mo','custom'],
  },
  merchandise: {
    regions: Object.keys(COUNTRY_PLATFORMS),
    squeezes: ['scarcity_ticker','social_proof_counter','fomo_countdown','referral_prompt'],
    note: 'Zero inventory via Printful/Printify',
  },
  email_list: {
    regions: Object.keys(COUNTRY_PLATFORMS),
    squeezes: ['exit_intent_capture','referral_prompt','co_registration','progress_bar','streak_reminder'],
    note: 'Morning Brew model: 3 referrals = free premium week',
  },
  sms_list: {
    regions: ['NG','KE','GH','ZA','TZ','UG','CM'],
    squeezes: ['loss_aversion_cta','scarcity_ticker','fomo_countdown'],
    note: 'Africa\'s Talking, 160-char limit, high open rates',
  },
  push_notification: {
    regions: Object.keys(COUNTRY_PLATFORMS),
    squeezes: ['drama_alert_bar','fomo_countdown','loss_aversion_cta'],
  },
  whatsapp_channel: {
    regions: ['NG','KE','GH','ZA','IN','BR','MX','AR','ID','TR','PK'],
    squeezes: ['referral_prompt','loss_aversion_cta','fomo_countdown','mobile_abandonment'],
  },
  telegram_channel: {
    regions: Object.keys(COUNTRY_PLATFORMS),
    squeezes: ['referral_prompt','drama_alert_bar','fomo_countdown','social_proof_counter'],
  },
  digital_product: {
    regions: Object.keys(COUNTRY_PLATFORMS),
    squeezes: ['scarcity_ticker','fomo_countdown','social_proof_counter','upsell_popup'],
    note: 'Gumroad/Etsy, instant delivery',
  },
  b2b_service: {
    regions: ['GB','US','IE','AU','DE','NL'],
    squeezes: ['progress_bar','post_action_upsell'],
    note: 'Corporate sweepstakes, white-label, commentary API',
  },
  co_registration: {
    regions: Object.keys(COUNTRY_PLATFORMS),
    squeezes: ['co_registration'],
    note: '£0.50-2.00 per partner signup, silent, fires on every form',
  },
  programmatic_seo: {
    regions: Object.keys(COUNTRY_PLATFORMS),
    squeezes: ['geo_affiliate_inject','drama_alert_bar','social_proof_counter'],
    note: '1,128 h2h pages + 200 VPN country pages + 16 host city guides',
  },
};

module.exports = { ContentMultiplier, LANGUAGES, COUNTRY_PLATFORMS, PLATFORM_CONFIGS, SQUEEZE_MECHANICS, STREAM_CONFIGS };

// ─── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const multiplier = new ContentMultiplier();
    const stats = multiplier.getStats();

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║          WC2026 EMPIRE — MULTIPLICATION MATRIX           ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(`Languages:              ${stats.dimensions.languages}`);
    console.log(`Countries:              ${stats.dimensions.countries}`);
    console.log(`Platforms:              ${stats.dimensions.platforms}`);
    console.log(`Squeeze mechanics:      ${stats.dimensions.squeezes}`);
    console.log(`Income stream types:    ${Object.keys(STREAM_CONFIGS).length}`);
    console.log(`Core ideas (ULTIMATE):  ${stats.dimensions.ideas_max}`);
    console.log('');
    console.log(`Touchpoints per idea:   ${stats.dimensions.touchpoints_per_idea.toLocaleString()}`);
    console.log(`MAX total touchpoints:  ${stats.dimensions.max_total_touchpoints.toLocaleString()}`);
    console.log('');
    console.log('Stream types and their reach:');
    for (const [type, cfg] of Object.entries(STREAM_CONFIGS)) {
      const reach = (cfg.regions.length * 8 * cfg.squeezes.length);
      console.log(`  ${type.padEnd(30)} ${cfg.regions.length} countries × ${cfg.squeezes.length} squeezes = ${reach.toLocaleString()} instances`);
    }
    console.log('\nTo run: require this module and call multiplier.multiply(content, options)');
    console.log('For bulk: multiplier.multiplyAll(allIdeas)');
  })();
}
