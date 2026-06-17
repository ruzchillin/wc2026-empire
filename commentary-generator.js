// commentary-generator.js
// Generates AI audio commentary for WC 2026 matches in 40+ languages
// Uses Groq for text + ElevenLabs for audio
// Run: node commentary-generator.js

require('dotenv').config();
const Groq = require('groq-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── LANGUAGE CONFIGS ─────────────────────────────────────────
const LANGUAGES = {
  en: { name: 'English', voice: process.env.ELEVENLABS_VOICE_ID_EN || 'pNInz6obpgDQGcFmaJgB', style: 'Professional football commentary, BBC Sport style' },
  es: { name: 'Spanish', voice: process.env.ELEVENLABS_VOICE_ID_ES || 'EXAVITQu4vr4xnSDxMaL', style: 'Emocionante comentario de fútbol estilo latinoamericano, grita GOOOOL' },
  pt: { name: 'Portuguese', voice: process.env.ELEVENLABS_VOICE_ID_PT || 'ErXwobaYiN019PkySvjV', style: 'Comentário de futebol estilo brasileiro, apaixonado e emocionante' },
  ar: { name: 'Arabic', voice: process.env.ELEVENLABS_VOICE_ID_AR || 'VR6AewLTigWG4xSOukaG', style: 'تعليق كرة قدم عربي احترافي' },
  fr: { name: 'French', voice: 'fr_voice_id', style: 'Commentaire football français professionnel style Canal+' },
  de: { name: 'German', voice: 'de_voice_id', style: 'Professioneller Fußball-Kommentar, sachlich und präzise' },
  hi: { name: 'Hindi', voice: 'hi_voice_id', style: 'हिंदी में जोशीला फुटबॉल कमेंट्री' },
  sw: { name: 'Swahili', voice: 'sw_voice_id', style: 'Maoni ya mchezo wa kandanda kwa Kiswahili' },
  ha: { name: 'Hausa', voice: 'ha_voice_id', style: 'Sharhin wasan kwallon kafa a harshen Hausa' },
  bn: { name: 'Bengali', voice: 'bn_voice_id', style: 'বাংলায় উত্তেজনাপূর্ণ ফুটবল ধারাভাষ্য' },
  id: { name: 'Indonesian', voice: 'id_voice_id', style: 'Komentar sepak bola Indonesia yang bersemangat' },
  tr: { name: 'Turkish', voice: 'tr_voice_id', style: 'Heyecanlı Türk futbol yorumu' },
};

// ── COMMENTARY TYPES ─────────────────────────────────────────
const COMMENTARY_TYPES = {
  pre_match: 'Pre-match build-up (5-10 minutes before kickoff)',
  goal: 'Goal celebration commentary',
  halftime: 'Halftime analysis',
  full_time: 'Full-time match report',
  penalty: 'Penalty shootout commentary',
  red_card: 'Red card incident commentary',
  var_check: 'VAR review commentary',
};

// ── GENERATE TEXT COMMENTARY ─────────────────────────────────
async function generateCommentaryText(type, matchData, langConfig) {
  const { home, away, score, minute, event, venue, tournament_context } = matchData;

  const prompts = {
    pre_match: `You are a professional football commentator. Write a ${langConfig.style} pre-match build-up for:
${home} vs ${away} at ${venue}. WC 2026.
Context: ${tournament_context || 'Group stage match'}
Write 3-4 paragraphs covering: team news, key players to watch, historical head-to-head, tonight's prediction.
Language: ${langConfig.name}. Make it engaging and professional.`,

    goal: `You are a football commentator. Write an exciting goal celebration commentary in ${langConfig.name}.
${event?.scorer} scored for ${event?.team} (${score}) in minute ${minute}.
${langConfig.style}
Write 2-3 sentences of pure excitement. Include the player's name and make it memorable.`,

    halftime: `Write a halftime analysis in ${langConfig.name} for ${langConfig.style}:
${home} ${score} ${away} at halftime.
Key moments: ${event?.key_moments || 'competitive first half'}
Write 2 paragraphs: what happened, what to expect in the second half.`,

    full_time: `Write a full-time match report in ${langConfig.name}:
${home} ${score} ${away} - WC 2026 ${tournament_context}
Match summary: ${event?.summary || 'exciting match'}
Write 3 paragraphs: match summary, player ratings, tournament implications.
Style: ${langConfig.style}`,

    penalty: `Write an intense penalty shootout commentary in ${langConfig.name}.
${home} vs ${away} in penalty shootout after ${score} AET.
Style: ${langConfig.style}
Capture the tension and drama of a WC penalty shootout. 2-3 sentences per kick.`,

    red_card: `Write a red card incident commentary in ${langConfig.name}.
${event?.player} of ${event?.team} was shown a red card in minute ${minute}.
Reason: ${event?.reason || 'professional foul'}
${langConfig.style}
2-3 sentences describing the incident and its impact on the match.`,
  };

  const prompt = prompts[type] || prompts.pre_match;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-70b-8192',
      temperature: 0.8,
      max_tokens: 500,
    });
    return completion.choices[0]?.message?.content || '';
  } catch (err) {
    console.error(`Text generation failed for ${langConfig.name}:`, err.message);
    return null;
  }
}

// ── GENERATE AUDIO (ELEVENLABS) ───────────────────────────────
async function generateAudio(text, voiceId, outputPath) {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.log('⚠️  No ElevenLabs API key — skipping audio generation');
    return null;
  }

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
      }
    );

    fs.writeFileSync(outputPath, response.data);
    console.log(`✅ Audio saved: ${outputPath}`);
    return outputPath;
  } catch (err) {
    console.error(`Audio generation failed:`, err.message);
    return null;
  }
}

// ── COMMENTARY PACKAGE: one match, all languages ─────────────
async function generateMatchCommentaryPackage(matchData, type = 'pre_match', languages = ['en', 'es', 'pt', 'ar']) {
  const outputDir = path.join(__dirname, 'commentary', matchData.matchId || 'match');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const results = {};

  for (const lang of languages) {
    const langConfig = LANGUAGES[lang];
    if (!langConfig) { console.log(`Unknown language: ${lang}`); continue; }

    console.log(`Generating ${langConfig.name} commentary...`);

    // Generate text
    const text = await generateCommentaryText(type, matchData, langConfig);
    if (!text) continue;

    // Save text
    const textPath = path.join(outputDir, `${type}_${lang}.txt`);
    fs.writeFileSync(textPath, text);

    // Generate audio
    const audioPath = path.join(outputDir, `${type}_${lang}.mp3`);
    const audioFile = await generateAudio(text, langConfig.voice, audioPath);

    results[lang] = { text, textPath, audioPath: audioFile };

    // Delay to avoid rate limits
    await new Promise(r => setTimeout(r, 1500));
  }

  // Generate index file
  const indexPath = path.join(outputDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify({
    matchData,
    type,
    generated: new Date().toISOString(),
    languages: Object.keys(results),
    files: Object.entries(results).map(([lang, files]) => ({
      lang,
      language: LANGUAGES[lang]?.name,
      text: files.textPath,
      audio: files.audioPath,
    }))
  }, null, 2));

  console.log(`\n✅ Commentary package complete: ${outputDir}`);
  console.log(`   Languages: ${Object.keys(results).join(', ')}`);
  return results;
}

// ── AUTOMATED GOAL ALERT ─────────────────────────────────────
async function goalAlertCommentary(scorer, team, score, minute, matchId) {
  console.log(`⚽ GOAL ALERT: ${scorer} (${team}) - ${score} - ${minute}'`);
  return generateMatchCommentaryPackage(
    { matchId, home: 'Home', away: 'Away', score, minute, event: { scorer, team } },
    'goal',
    ['en', 'es', 'pt', 'ar', 'fr']
  );
}

// ── MAIN ─────────────────────────────────────────────────────
// Example usage when run directly
if (require.main === module) {
  const exampleMatch = {
    matchId: 'WC2026_test',
    home: 'France',
    away: 'Morocco',
    score: '0-0',
    minute: 0,
    venue: 'MetLife Stadium, New Jersey',
    tournament_context: 'Round of 16',
  };

  console.log('🎙️  WC 2026 Commentary Generator');
  console.log('Generating pre-match commentary in EN, ES, PT, AR...\n');

  generateMatchCommentaryPackage(exampleMatch, 'pre_match', ['en', 'es', 'pt', 'ar'])
    .then(() => console.log('\n🏁 Done. Check /commentary/ folder.'))
    .catch(console.error);
}

module.exports = { generateMatchCommentaryPackage, goalAlertCommentary, generateCommentaryText };
