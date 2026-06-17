// quality-engine.js
// High-quality, culturally-aware content generation for 20+ languages
// Replaces simple translation with: AI generation → quality scoring → cultural adaptation
// Used by: preview-engine.js (import and call generateQualityContent)
// ─────────────────────────────────────────────────────────────────────

require('dotenv').config();
const axios = require('axios');
const { LANGUAGES, LANGUAGE_PRIORITY, GROQ_DIRECT_LANGUAGES, LIBRETRANSLATE_SUPPORTED } = require('./languages-config');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const LIBRE_URL = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com/translate';
const LIBRE_KEY = process.env.LIBRETRANSLATE_KEY || '';

// ── Quality thresholds ────────────────────────────────────────
const QUALITY_THRESHOLD = 7.5; // out of 10. Below this = regenerate
const MAX_REGENERATE_ATTEMPTS = 2;

// ── Cultural prompts per language ────────────────────────────
// These inject cultural context into the AI prompt so content
// feels native, not translated. This is the quality differentiator.
const CULTURAL_PROMPTS = {
  en: `Write for a knowledgeable Western football fan. Use tactical terminology freely. Reference club football context (Premier League, Champions League). Be analytical and opinionated.`,

  es: `Escribe para un fan latinoamericano de fútbol. Usa terminología futbolística. Referencia Copa Libertadores, Liga MX, y la historia de las selecciones nacionales. El tono debe ser apasionado y con garra. Menciona jugadores latinoamericanos relevantes.`,

  pt: `Escreve para um brasileiro apaixonado por futebol. Usa gírias brasileiras de futebol (goleada, craque, raça). Referencia o Brasileirão, a CBF, e a história da Seleção. Tono emocional e vibrante.`,

  fr: `Écris pour un fan français de football passionné. Mentionne la Ligue 1, les clubs français, et l'histoire des Bleus. Sois analytique mais avec de la passion. Référence les joueurs africains francophones (Sénégal, Maroc, Cameroun).`,

  ar: `اكتب لمشجع عربي متحمس لكرة القدم. اذكر الدوري السعودي، دوري أبطال آسيا، ومنتخبات المغرب والسعودية. الأسلوب متحمس ومثير. استخدم عبارات كروية عربية.`,

  sw: `Andika kwa shabiki wa Kiafrika wa soka. Tumia lugha ya kawaida ya Kiswahili. Rejelea timu za Afrika (Morocco, Senegal, Cameroon, South Africa, Nigeria). Mtazamo wa umoja wa Afrika. Jina la mchezo: "mpira wa miguu".`,

  ha: `Rubuta wa fan ɗin ƙwallon ƙafa a Najeriya. Yi amfani da Hausa na gari. Ambata Super Eagles da yadda suke da muhimmanci. Yi amfani da kalamai na ƙwallon ƙafa na Hausa. Sautin sha'awa da alfahari.`,

  zu: `Bhala ngolwimi lwe-Zulu lweqiniso. Xoxa ngeBafana Bafana - iqembu eliyisikhonkwane. 2026 ikhetheke kakhulu - iqembu lethu liyabuyela. Isibindi se-Afrika esikhulu. Khuluma ngabantu beNingizimu Afrika.`,

  wo: `Ekri pour un fan sénégalais de football. Lëgël Wolof ak terminologie bi tànn ci yow ci football. Xam-xam ci Lions de Teranga ak Sadio Mané. Pride bi ci Sénégal.`,

  tl: `Sumulat para sa isang passionate na Filipino football fan. Gamitin ang Tagalog na natural at conversational. Banggitin ang mga Filipino player sa Europe. Ang OFW community ay nanonood ng laro nang sama-sama. Football = bonding ng pamilya at komunidad.`,

  vi: `Viết cho fan bóng đá Việt Nam đam mê. Dùng tiếng Việt tự nhiên, không quá trang trọng. Nhắc đến các cầu thủ châu Á. Người Việt hay thức khuya xem bóng đá. Giọng điệu sôi nổi và phân tích.`,

  hi: `Hinglish mein likho - Hindi aur English ka natural mix jo young Indian fans use karte hain. Football ko India ke perspective se dekho. Diaspora connection batao (UK, UAE, USA mein). Passion aur tactical insight dono.`,

  id: `Tulis untuk penggemar sepak bola Indonesia yang antusias. Gunakan Bahasa Indonesia yang natural dan gaul. Sebut pemain-pemain Asia. Indonesia hampir lolos ke WC 2026 - rasa bangga nasional. Gaya penulisan yang seru dan informatif.`,

  th: `เขียนสำหรับแฟนฟุตบอลชาวไทยที่หลงใหล ใช้ภาษาไทยที่เป็นธรรมชาติ กล่าวถึงพรีเมียร์ลีกและเกี่ยวข้องกับทีมชาติ วิเคราะห์เชิงลึกและน่าสนใจ`,

  fa: `برای هواداران فوتبال ایرانی بنویس. فارسی روان و طبیعی استفاده کن. تیم ملی ایران (تیم ملی) و بازیکنان ایرانی در اروپا را ذکر کن. احساس غرور ملی.`,

  ko: `한국 축구팬을 위해 쓰세요. 자연스러운 한국어를 사용하세요. 손흥민과 대한민국 선수들을 언급하세요. 2002년 월드컵 전통을 참고하세요. 분석적이고 열정적인 톤.`,

  ja: `日本のサッカーファン向けに書いてください。自然な日本語を使用してください。サムライブルーと日本人選手（三笘薫など）に言及してください。戦術的な分析を重視してください。`,

  de: `Schreib für einen deutschen Fußballfan. Verwende natürliches Deutsch mit Fußball-Fachbegriffen. Erwähne die Bundesliga, DFB und Die Mannschaft. Analytischer und leidenschaftlicher Ton.`,

  nl: `Schrijf voor een Nederlandse voetbalfan. Gebruik natuurlijk Nederlands met voetbaltermen. Verwijs naar Oranje, de Eredivisie en de totaalvoetbal-traditie. Analytisch en gepassioneerd.`,

  it: `Scrivi per un tifoso italiano di calcio. Usa italiano naturale con terminologia calcistica. Riferimenti alla Serie A e alla storia degli Azzurri. Italia non è qualificata - tono di rimpianto ma ancora appassionato.`,

  tr: `Türk futbol taraftarı için yaz. Doğal Türkçe kullan, futbol terimleri dahil. Süper Lig ve Türk milli takımına değin. Türk taraftarların coşkusu ve tutkusuyla yaz.`,

  zh: `为中国足球迷写作。使用自然的简体中文。提及中国球员在海外的情况。中国未能晋级但球迷依然热情。分析性和充满激情的语气。`,

  uk: `Пиши для українських футбольних уболівальників. Використовуй природну українську мову. Згадай українських гравців у Європі (Мудрик, Зінченко). Футбол як зв'язок з домом для діаспори.`,

  yo: `Kọ fun olufẹ bọọlu afẹsẹgba Nigeria. Lo Yoruba abinibi pẹlu awọn ọrọ bọọlu. Darukọ Super Eagles ati awọn ọmọ Naija ni Yuroopu. Ihamo ati igberaga.`,

  bn: `বাংলাদেশী এবং পশ্চিমবঙ্গের ফুটবল ভক্তদের জন্য লিখুন। প্রাকৃতিক বাংলা ব্যবহার করুন। আর্জেন্টিনা বা ব্রাজিল - এই দুই দলের প্রতি গভীর আবেগ। ফুটবল = উৎসব।`,
};

// ── Quality scoring prompt ────────────────────────────────────
async function scoreContentQuality(content, langCode) {
  const lang = LANGUAGES[langCode];
  const prompt = `Rate this football content on a scale of 1-10 and return ONLY a JSON object.
Criteria: cultural authenticity (for ${lang?.name || langCode} speakers), engagement level, accuracy,
natural language (not machine-translated), football knowledge shown.

Content: """${content.substring(0, 500)}"""

Return ONLY: {"score": 8.5, "issues": ["issue1", "issue2"], "strengths": ["strength1"]}`;

  try {
    const res = await groqRequest(prompt, 'en', 200);
    const parsed = JSON.parse(res.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return parsed.score || 7;
  } catch {
    return 7; // default pass if scoring fails
  }
}

// ── Core Groq request ─────────────────────────────────────────
async function groqRequest(prompt, langCode = 'en', maxTokens = 400) {
  const culturalGuide = CULTURAL_PROMPTS[langCode] || CULTURAL_PROMPTS.en;

  const res = await axios.post(GROQ_URL, {
    model: 'llama3-70b-8192',
    messages: [
      {
        role: 'system',
        content: `You are a world-class football analyst creating content for the 2026 FIFA World Cup.
${culturalGuide}
Be concise, engaging, and culturally authentic. Never sound like a translation.`
      },
      { role: 'user', content: prompt }
    ],
    max_tokens: maxTokens,
    temperature: 0.8
  }, {
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }
  });

  return res.data.choices[0].message.content.trim();
}

// ── LibreTranslate fallback ───────────────────────────────────
async function translateText(text, targetLang) {
  if (!LIBRETRANSLATE_SUPPORTED.includes(targetLang)) return null;

  try {
    const res = await axios.post(LIBRE_URL, {
      q: text,
      source: 'en',
      target: targetLang,
      api_key: LIBRE_KEY
    });
    return res.data.translatedText;
  } catch {
    return null;
  }
}

// ── Main: generate quality content for one language ───────────
async function generateQualityContent(matchData, langCode, contentType = 'preview') {
  const lang = LANGUAGES[langCode];
  if (!lang) throw new Error(`Unknown language: ${langCode}`);

  const { home, away, homeFlag, awayFlag, datetime, venue, odds } = matchData;

  // Build the core prompt based on content type
  let corePrompt;

  if (contentType === 'preview') {
    corePrompt = `Write a compelling match preview for ${home} vs ${away} at ${venue} on ${datetime}.
${odds ? `Current odds: ${home} ${odds.home} | Draw ${odds.draw} | ${away} ${odds.away}` : ''}
Cover: key players, tactics, prediction, atmosphere. Max 180 words. Language: ${lang.nativeName || langCode}.
${CULTURAL_PROMPTS[langCode] || ''}`;
  } else if (contentType === 'goal') {
    const { scorer, team, minute, score } = matchData;
    corePrompt = `Write an explosive, real-time goal reaction post.
${team} scored in minute ${minute}! Scorer: ${scorer}. Score: ${score}.
Match: ${home} vs ${away}.
Maximum energy, maximum excitement. 3-4 sentences. Language: ${lang.nativeName || langCode}.
${CULTURAL_PROMPTS[langCode] || ''}`;
  } else if (contentType === 'halftime') {
    corePrompt = `Write a halftime analysis. Match: ${home} vs ${away}. Score: ${matchData.score}.
Key moments so far: ${matchData.highlights || 'none yet'}.
What needs to change in the second half? 150 words max. Language: ${lang.nativeName || langCode}.
${CULTURAL_PROMPTS[langCode] || ''}`;
  } else if (contentType === 'fulltime') {
    corePrompt = `Write a full-time reaction and analysis. ${home} ${matchData.score} ${away}.
${matchData.highlights ? `Key moments: ${matchData.highlights}` : ''}
What does this result mean? Who were the standout players? Implications for the tournament?
150 words. Language: ${lang.nativeName || langCode}.
${CULTURAL_PROMPTS[langCode] || ''}`;
  } else if (contentType === 'telegram_caption') {
    corePrompt = `Write a short, punchy Telegram message for ${home} vs ${away} on ${datetime}.
Include: kickoff time, one key insight, prediction with emoji. Max 80 words.
Language: ${lang.nativeName || langCode}. Must feel native, not translated.
${CULTURAL_PROMPTS[langCode] || ''}`;
  } else if (contentType === 'tiktok_hook') {
    corePrompt = `Write a TikTok video hook (first 3 seconds) for ${home} vs ${away}.
It must make people stop scrolling. Start with a shocking stat, bold prediction, or controversial take.
One sentence, maximum 15 words. Language: ${lang.nativeName || langCode}.
${CULTURAL_PROMPTS[langCode] || ''}`;
  }

  // Try direct Groq generation first
  let content = '';
  let attempts = 0;
  let score = 0;

  while (attempts < MAX_REGENERATE_ATTEMPTS && score < QUALITY_THRESHOLD) {
    attempts++;

    if (GROQ_DIRECT_LANGUAGES.includes(langCode)) {
      // Direct generation in the target language (higher quality)
      content = await groqRequest(corePrompt, langCode);
    } else {
      // Generate in English, then translate (fallback for rare languages)
      const englishContent = await groqRequest(corePrompt, 'en');
      const translated = await translateText(englishContent, langCode);
      content = translated || englishContent;
    }

    // Score quality (skip for simple content types to save API calls)
    if (contentType === 'preview' || contentType === 'halftime') {
      score = await scoreContentQuality(content, langCode);
      if (score < QUALITY_THRESHOLD && attempts < MAX_REGENERATE_ATTEMPTS) {
        console.log(`[Quality] ${langCode} scored ${score}/10, regenerating...`);
      }
    } else {
      score = 8; // trust quick content types
    }
  }

  return {
    content,
    langCode,
    language: lang.nativeName || lang.name,
    quality_score: score,
    type: contentType,
    hashtags: lang.hashtagTemplate || '#WC2026',
    telegramChannel: lang.telegramChannel
  };
}

// ── Batch: generate for ALL languages ────────────────────────
async function generateAllLanguages(matchData, contentType = 'preview', tiers = [1, 2, 3, 0]) {
  console.log(`\n[QualityEngine] Generating ${contentType} for ${LANGUAGE_PRIORITY.length} languages...`);

  // Filter by tier
  const langs = LANGUAGE_PRIORITY.filter(code => {
    const lang = LANGUAGES[code];
    return lang && tiers.includes(lang.tier);
  });

  // Process in batches of 5 to avoid rate limits
  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < langs.length; i += BATCH_SIZE) {
    const batch = langs.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(langCode => generateQualityContent(matchData, langCode, contentType))
    );

    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        const lang = LANGUAGES[batch[idx]];
        console.log(`  ✅ ${lang?.name || batch[idx]}: ${result.value.quality_score?.toFixed(1) || 'ok'}/10`);
      } else {
        console.log(`  ❌ ${batch[idx]}: ${result.reason?.message || 'failed'}`);
      }
    });

    // Rate limit pause between batches
    if (i + BATCH_SIZE < langs.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  return results;
}

// ── Format for platform ───────────────────────────────────────
function formatForTelegram(contentResult, matchData) {
  const { content, hashtags, language } = contentResult;
  const { homeFlag, awayFlag, home, away, datetime } = matchData;

  return `${homeFlag} ${home} vs ${away} ${awayFlag}
⏰ ${datetime}

${content}

${hashtags}`;
}

function formatForTwitter(contentResult, matchData) {
  // Twitter: 280 char limit
  const { content, hashtags } = contentResult;
  const base = `${matchData.homeFlag} ${matchData.home} vs ${matchData.away} ${matchData.awayFlag}\n\n`;
  const tags = `\n\n${hashtags}`;
  const maxContent = 280 - base.length - tags.length;
  const truncated = content.length > maxContent ? content.substring(0, maxContent - 3) + '...' : content;
  return `${base}${truncated}${tags}`;
}

function formatForBeehiiv(contentResult, matchData) {
  // Full newsletter paragraph
  const { content, language } = contentResult;
  const { homeFlag, awayFlag, home, away, datetime, venue } = matchData;

  return {
    subject: `${homeFlag} ${home} vs ${away} ${awayFlag} — Match Preview`,
    content: `<h2>${homeFlag} ${home} vs ${away} ${awayFlag}</h2>
<p><strong>${datetime}</strong> · ${venue}</p>
<p>${content}</p>`
  };
}

// ── TikTok content package ────────────────────────────────────
async function generateTikTokPackage(matchData, langCode) {
  const [hook, caption, hashtags] = await Promise.all([
    generateQualityContent(matchData, langCode, 'tiktok_hook'),
    generateQualityContent(matchData, langCode, 'telegram_caption'),
    Promise.resolve(LANGUAGES[langCode]?.hashtagTemplate || '#WC2026')
  ]);

  return {
    hook: hook.content,           // First 3 seconds of video (text overlay)
    caption: caption.content,     // TikTok caption
    hashtags,
    description: `Hook: "${hook.content}"\n\nCaption: ${caption.content}\n\nHashtags: ${hashtags}`
  };
}

// ── Export ────────────────────────────────────────────────────
module.exports = {
  generateQualityContent,
  generateAllLanguages,
  formatForTelegram,
  formatForTwitter,
  formatForBeehiiv,
  generateTikTokPackage,
  scoreContentQuality,
  QUALITY_THRESHOLD
};

// ── Standalone test ───────────────────────────────────────────
if (require.main === module) {
  const testMatch = {
    home: 'Mexico',
    away: 'South Africa',
    homeFlag: '🇲🇽',
    awayFlag: '🇿🇦',
    datetime: 'June 11, 2026 · 3:00 PM ET',
    venue: 'AT&T Stadium, Dallas',
    odds: { home: '-130', draw: '+260', away: '+380' }
  };

  // Test a few key languages
  const testLangs = ['en', 'sw', 'ha', 'hi', 'id', 'tl'];

  console.log('Testing quality engine...\n');
  Promise.allSettled(
    testLangs.map(lang => generateQualityContent(testMatch, lang, 'preview'))
  ).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        console.log(`\n── ${r.value.language} (quality: ${r.value.quality_score?.toFixed(1)}/10) ──`);
        console.log(r.value.content.substring(0, 200) + '...\n');
      } else {
        console.log(`\n── ${testLangs[i]} FAILED ──`);
        console.log(r.reason?.message);
      }
    });
  });
}
