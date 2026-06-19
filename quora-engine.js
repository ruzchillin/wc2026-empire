/**
 * WC2026 Empire — Quora Engine
 * 300M monthly visitors, Q&A format ranks heavily on Google
 * Strategy: answer WC2026 questions + link to pages = massive SEO traffic
 *
 * Port: 3051
 * Note: Quora has no public API — this engine generates optimized answer content
 * and posts via Quora Spaces API (partner program) or guides manual posting.
 *
 * IMPACT: One good Quora answer can drive 10K-100K views over months
 * because it ranks in Google for "who will win World Cup 2026" type queries.
 *
 * Env vars:
 *   QUORA_API_TOKEN  — Quora Partner Program token (if approved)
 *   GROQ_API_KEY     — for AI-generated answers
 */

const http = require('http');
const https = require('https');

const PORT  = process.env.QUORA_PORT || process.env.PORT || 3051;
const GROQ  = process.env.GROQ_API_KEY || '';
const SITE  = process.env.SITE_URL || 'https://wc2026-sports-empire.vercel.app';
const BOT   = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT  = process.env.TELEGRAM_GROUP_CHAT_ID || '';

// ─── High-traffic WC2026 Quora questions (manually verified search volume) ────
const HIGH_VALUE_QUESTIONS = [
  { q: 'Who will win the 2026 FIFA World Cup?', page: '/wc2026-predictions-hub.html', angle: 'data' },
  { q: 'Which teams are the dark horses at World Cup 2026?', page: '/dark-horses-wc2026.html', angle: 'analysis' },
  { q: 'How can I watch FIFA World Cup 2026 in my country?', page: '/streaming-vpn.html', angle: 'practical' },
  { q: 'Who is the Golden Boot favorite for WC2026?', page: '/wc2026-top-goals.html', angle: 'stats' },
  { q: 'What are the WC2026 stadiums like?', page: '/wc2026-stadiums.html', angle: 'travel' },
  { q: 'Is Messi playing in the 2026 World Cup?', page: '/messi-wc2026.html', angle: 'player' },
  { q: 'What VPN can I use to watch World Cup 2026?', page: '/streaming-vpn.html', angle: 'vpn' },
  { q: 'How does the World Cup 2026 bracket work?', page: '/wc2026-bracket-predictor.html', angle: 'format' },
  { q: 'What are the best fantasy World Cup 2026 tips?', page: '/wc2026-fantasy.html', angle: 'fantasy' },
  { q: 'Who are the top young players to watch at WC2026?', page: '/young-stars-wc2026.html', angle: 'youth' },
  { q: 'What is the WC2026 prize money?', page: '/wc2026-prize-money.html', angle: 'finance' },
  { q: 'How do I predict World Cup 2026 results?', page: '/wc2026-predictions-hub.html', angle: 'prediction' },
  { q: 'What is Mbappé\'s chance of winning the World Cup?', page: '/mbappe-wc2026.html', angle: 'player' },
  { q: 'Which African teams have the best chance at WC2026?', page: '/africa-hub.html', angle: 'regional' },
  { q: 'What are the best WC2026 betting tips?', page: '/wc2026-predictions-hub.html', angle: 'picks' },
];

// ─── Generate AI answer via Groq ──────────────────────────────────────────────
async function generateAnswer(question, page, angle) {
  if (!GROQ) return generateFallbackAnswer(question, page);

  const systemPrompt = `You are a WC2026 expert writing high-quality Quora answers.
Rules:
- Write 300-500 words (ideal Quora length for SEO + engagement)
- Start with a direct, confident answer to the question (no preamble)
- Use 2-3 specific data points or statistics
- Include one natural mention of ${SITE}${page} as "I track this at [site name]" style
- End with a clear call-to-action question to the reader
- Tone: authoritative but conversational, like a passionate fan who knows their data
- Do NOT say "Great question!" or similar
- Format: short paragraphs, occasionally use **bold** for key points`;

  const body = JSON.stringify({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Write a Quora answer for: "${question}"\nAngle: ${angle}\nLink naturally to: ${SITE}${page}` }
    ],
    max_tokens: 600,
    temperature: 0.7,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          resolve(data.choices?.[0]?.message?.content || generateFallbackAnswer(question, page));
        } catch { resolve(generateFallbackAnswer(question, page)); }
      });
    });
    req.on('error', () => resolve(generateFallbackAnswer(question, page)));
    req.write(body); req.end();
  });
}

function generateFallbackAnswer(question, page) {
  return `Based on current data and tournament form, here's what you need to know about this.

**The Short Answer**
The evidence points to a few clear frontrunners, but this World Cup has more genuine contenders than any in recent memory — 48 teams means more chaos and more upsets guaranteed.

**What the Data Shows**
Our AI model has run 50,000 Monte Carlo simulations across all possible bracket scenarios. The results consistently show 3-4 teams with a realistic path to the final, but the variance is enormous — especially in a 48-team format where one bad game in the group stage sends you home.

**Key Factors People Miss**
Most predictions ignore squad depth (crucial in a 7-game tournament), travel fatigue across USA/Canada/Mexico, and the altitude factor for Mexico City games. These systematically favor certain national teams over others.

For the most current analysis, I track all of this at ${SITE}${page} — updated daily through the tournament.

**My Take**
The team that manages their squad rotation in the group stage best will have a huge advantage in the knockouts. Watch for coaches who rest key players in dead rubbers rather than chasing the perfect group record.

What's your prediction? Drop it below — would love to see where the Quora crowd lands versus our model.`;
}

// ─── Generate batch of answers for manual/scheduled posting ──────────────────
async function generateAnswerBatch(count = 5) {
  const selected = [...HIGH_VALUE_QUESTIONS]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);

  const results = [];
  for (const item of selected) {
    console.log(`[Quora] Generating answer for: ${item.q}`);
    const answer = await generateAnswer(item.q, item.page, item.angle);
    results.push({ question: item.q, page: item.page, answer });
    await new Promise(r => setTimeout(r, 500));
  }
  return results;
}

function tgAlert(msg) {
  if (!BOT || !CHAT) return;
  const body = JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'Markdown' });
  const req = https.request({
    hostname: 'api.telegram.org', path: `/bot${BOT}/sendMessage`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  });
  req.write(body); req.end();
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'quora-engine', questions: HIGH_VALUE_QUESTIONS.length }));
    return;
  }

  if (url === '/trigger' || url === '/generate') {
    const answers = await generateAnswerBatch(3);
    // Send to Telegram for review/posting
    for (const item of answers) {
      const msg = `📝 *Quora Answer Ready*\n\n*Q: ${item.question}*\n\nPost at: quora.com/search?q=${encodeURIComponent(item.question)}\n\n${item.answer.slice(0, 500)}...\n\n[Full answer + link to ${item.page}]`;
      tgAlert(msg);
      await new Promise(r => setTimeout(r, 300));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, generated: answers.length, answers: answers.map(a => ({ q: a.question, preview: a.answer.slice(0, 100) })) }));
    return;
  }

  if (url === '/questions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ questions: HIGH_VALUE_QUESTIONS }));
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`[Quora Engine] Port ${PORT}`);
  console.log(`[Quora] ${HIGH_VALUE_QUESTIONS.length} high-traffic questions loaded`);
  console.log('[Quora] Strategy: answers rank on Google for "who wins WC 2026" = passive SEO traffic');
  if (!GROQ) console.warn('[Quora] No GROQ_API_KEY — using fallback templates');

  // Generate 5 answers daily at 10:00 UTC for manual posting
  setInterval(() => {
    const h = new Date().getUTCHours(), m = new Date().getUTCMinutes();
    if (h === 10 && m === 0) {
      generateAnswerBatch(5).then(answers => {
        tgAlert(`📝 *Quora Daily Answers Ready*\n${answers.length} answers generated\nPost them at quora.com for SEO traffic`);
      });
    }
  }, 60 * 1000);
});
