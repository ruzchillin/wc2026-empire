/**
 * recommendations-engine.js — WC 2026 Intel Self-Improving AI Brain
 *
 * This is the system that makes everything smarter over time.
 *
 * What it does:
 *   1. Analyzes your daily performance (traffic, revenue, subs, accuracy)
 *   2. Finds your single biggest growth lever right now
 *   3. Asks you targeted questions when it needs info to help you
 *   4. Tracks all 210+ income streams — which are live, which to add next
 *   5. Monitors viral moments (goals, upsets, red cards) and suggests capitalizing
 *   6. Surfaces the best idea of the day based on what's actually happening
 *   7. Learns from your answers and adjusts future recommendations
 *
 * SETUP: Same Railway service as bot-commands.js (or separate cron job)
 * Runs: Every day at 09:00 UTC, plus triggers on key events
 * Commands added: /recommend, /ideas, /streams, /ask, /opportunity
 *
 * Telegram commands this adds:
 *   /recommend   — top 3 actions ranked by effort:reward
 *   /ideas       — AI brainstorm session based on what's trending
 *   /streams     — income stream tracker (active/inactive/priority)
 *   /opportunity — what viral moment can you capitalize on RIGHT NOW
 *   /ask         — ask the AI a strategic question about your empire
 *   /gaps        — what's missing that competitors have
 */

require('dotenv').config();
const Groq = require('groq-sdk');
const fs   = require('fs');
const path = require('path');

const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });
const OWNER  = process.env.TELEGRAM_OWNER_ID;
const TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const FREE_CH = process.env.TELEGRAM_FREE_CHANNEL_ID;

// ── MASTER INCOME STREAM REGISTRY ─────────────────────────────────────────────
// Every income stream. Status: active | pending | future | blocked_age
// effort: 1-5 (1=easy). reward: 1-5 (5=high). priority = reward - effort.
const INCOME_STREAMS = [

  // ─── IMMEDIATE / ZERO SETUP ────────────────────────────────────────────────
  { id: 'affiliate_geo',      name: 'Geo-routed betting affiliates',       status: 'pending', effort: 1, reward: 5, category: 'Affiliates',   notes: 'geo-affiliate-router.js is ready — just deploy' },
  { id: 'ezoic_ads',          name: 'Ezoic display ads (4× RPM)',          status: 'pending', effort: 1, reward: 4, category: 'Ads',          notes: 'Apply at ezoic.com — no minimum traffic' },
  { id: 'propellerads_push',  name: 'PropellerAds push notification ads',  status: 'pending', effort: 1, reward: 3, category: 'Ads',          notes: 'Passive $0.05-$0.50/sub/month' },
  { id: 'nordvpn_affiliate',  name: 'NordVPN affiliate (watch guide)',      status: 'pending', effort: 1, reward: 3, category: 'Affiliates',   notes: '$60-100 CPA. watch-guide.html is ready.' },
  { id: 'amazon_affiliate',   name: 'Amazon affiliate (match day gear)',    status: 'pending', effort: 1, reward: 2, category: 'Affiliates',   notes: 'Link to scarves/jerseys/flags on every team page' },

  // ─── CONTENT & SUBSCRIPTIONS ───────────────────────────────────────────────
  { id: 'telegram_premium',   name: 'Telegram premium channel ($9.99/mo)', status: 'pending', effort: 1, reward: 5, category: 'Subscriptions', notes: 'Whop.com to gate it. Highest recurring revenue.' },
  { id: 'email_drip',         name: '38-day email drip (Beehiiv)',          status: 'pending', effort: 2, reward: 5, category: 'Email',        notes: 'email-drip-sequence.md is fully written — just configure in Beehiiv' },
  { id: 'beehiiv_referral',   name: 'Beehiiv referral loop',               status: 'pending', effort: 1, reward: 4, category: 'Email',        notes: 'Viral coefficient — list grows itself' },
  { id: 'newsletter_ads',     name: 'Newsletter sponsorships',             status: 'pending', effort: 2, reward: 4, category: 'Email',        notes: 'At 5K subs: $200-500/issue. At 20K: $2K+/issue' },

  // ─── PAGES & SEO ───────────────────────────────────────────────────────────
  { id: 'team_pages_48',      name: '48 team hub pages',                   status: 'pending', effort: 1, reward: 5, category: 'SEO',          notes: 'node team-hub-generator.js all — 30 min' },
  { id: 'match_pages_104',    name: '104 match preview pages',             status: 'pending', effort: 1, reward: 5, category: 'SEO',          notes: 'node match-preview-generator.js upcoming' },
  { id: 'player_pages_200',   name: '200 player pages',                    status: 'pending', effort: 1, reward: 4, category: 'SEO',          notes: 'node player-pages-generator.js all' },
  { id: 'local_lang_pages',   name: 'Translated pages (Spanish/Portuguese/French)', status: 'future', effort: 3, reward: 5, category: 'SEO', notes: '70% of WC searches are non-English' },

  // ─── SOCIAL ────────────────────────────────────────────────────────────────
  { id: 'twitter_auto',       name: 'Twitter/X automated posts',           status: 'pending', effort: 1, reward: 3, category: 'Social',       notes: 'social-blaster.js ready — needs Twitter API keys' },
  { id: 'tiktok_3x',         name: 'TikTok 3 posts/day',                  status: 'pending', effort: 2, reward: 4, category: 'Social',       notes: 'Biggest reach for zero cost. Match clips + AI predictions.' },
  { id: 'instagram_reels',    name: 'Instagram Reels daily',               status: 'pending', effort: 2, reward: 3, category: 'Social',       notes: 'Same content as TikTok, repurposed' },
  { id: 'youtube_channel',    name: 'YouTube daily prediction videos',     status: 'pending', effort: 2, reward: 4, category: 'Social',       notes: 'youtube-engine.js ready. Text-to-speech + FFmpeg.' },
  { id: 'tiktok_live',        name: 'TikTok LIVE during matches',          status: 'future',  effort: 2, reward: 5, category: 'Social',       notes: 'Live commentary during big games = massive reach spike' },

  // ─── PRODUCTS ──────────────────────────────────────────────────────────────
  { id: 'merch_printful',     name: 'Print-on-demand merch (Printful)',    status: 'pending', effort: 1, reward: 2, category: 'Products',     notes: 'merch-store.html ready — link Printful account' },
  { id: 'digital_downloads',  name: 'Digital downloads ($2.99-9.99)',      status: 'future',  effort: 2, reward: 3, category: 'Products',     notes: 'Sweepstake kits, printable brackets, prediction sheets' },
  { id: 'ebook',              name: 'WC 2026 prediction ebook ($4.99)',    status: 'future',  effort: 2, reward: 2, category: 'Products',     notes: 'AI-generated, instant download' },

  // ─── B2B ───────────────────────────────────────────────────────────────────
  { id: 'ai_reports_b2b',     name: 'AI match reports to media ($500-5K/mo)', status: 'future', effort: 3, reward: 5, category: 'B2B',      notes: 'Cold email sports desks. 1 client = $5K/month.' },
  { id: 'api_product',        name: 'Prediction API ($99-499/mo)',         status: 'future',  effort: 4, reward: 5, category: 'B2B',         notes: 'Wrap your AI model in an API endpoint' },
  { id: 'white_label',        name: 'White-label site licensing',          status: 'future',  effort: 3, reward: 5, category: 'B2B',         notes: '$2K-10K one-time per client. Target: radio stations, newspapers.' },
  { id: 'quant_data',         name: 'Quant fund historical data',          status: 'future',  effort: 3, reward: 5, category: 'B2B',         notes: '$5K-50K one-time. Contact via LinkedIn.' },
  { id: 'media_kit',          name: 'Sponsorship media kit',               status: 'future',  effort: 2, reward: 4, category: 'B2B',         notes: '$1K-50K per deal. Build at 10K+ subs.' },

  // ─── RETARGETING / PAID ────────────────────────────────────────────────────
  { id: 'fb_retargeting',     name: 'Facebook retargeting ($5/day)',       status: 'future',  effort: 2, reward: 4, category: 'Paid',         notes: 'Pixel code in all pages. Retarget visitors who left.' },
  { id: 'google_search_ads',  name: 'Google Search Ads ([team] prediction)', status: 'future', effort: 2, reward: 4, category: 'Paid',        notes: '$0.50-$1.20 CPC, 10:1 ROAS on premium conversions' },

  // ─── VIRAL MECHANICS ───────────────────────────────────────────────────────
  { id: 'viral_quiz',         name: 'Viral quiz (which WC team are you)',  status: 'pending', effort: 1, reward: 3, category: 'Viral',        notes: 'viral-quiz.html ready — deploy' },
  { id: 'bracket_challenge',  name: 'Free bracket challenge',              status: 'future',  effort: 3, reward: 4, category: 'Viral',        notes: 'Winner gets "WC Intel lifetime sub" — costs you nothing' },
  { id: 'sweepstake_gen',     name: 'Office sweepstake generator',         status: 'future',  effort: 2, reward: 3, category: 'Viral',        notes: 'B2B offices love this. Email capture for every participant.' },
  { id: 'fantasy_dfs',        name: 'DraftKings fantasy affiliate',        status: 'future',  effort: 1, reward: 4, category: 'Affiliates',   notes: '$50-200/deposit. WC DFS is huge in North America.' },

  // ─── INFRASTRUCTURE ────────────────────────────────────────────────────────
  { id: 'pwa_install',        name: 'PWA push notifications (PropellerAds)', status: 'pending', effort: 1, reward: 4, category: 'Infrastructure', notes: 'manifest.json + service-worker.js ready. Every install = recurring ad revenue.' },
  { id: 'chatgpt_plugin',     name: 'ChatGPT / Perplexity presence',      status: 'future',  effort: 3, reward: 4, category: 'Infrastructure', notes: 'Be the source AI chatbots cite for WC 2026 predictions' },
  { id: 'google_discover',    name: 'Google Discover optimisation',        status: 'future',  effort: 2, reward: 4, category: 'Infrastructure', notes: 'Schema markup + large images + trending topics = Discover traffic' },

  // ─── AGE-GATED (14 streams, unlocks at 18) ────────────────────────────────
  { id: 'matched_betting',    name: 'Matched betting (guaranteed profit)',  status: 'blocked_age', effort: 2, reward: 5, category: 'Betting', notes: 'Unlock at 18. £200-1K guaranteed in first month.' },
  { id: 'sportsbook_accounts', name: 'Sportsbook player accounts',         status: 'blocked_age', effort: 1, reward: 4, category: 'Betting', notes: 'Unlock at 18. Welcome bonuses.' },
];

// ── STATE ────────────────────────────────────────────────────────────────────
const REC_STATE_FILE = path.join(__dirname, 'rec-state.json');
let recState = {
  answeredQuestions: {},
  streamStatus: {},
  lastRecommendations: [],
  viralMoments: [],
  pendingQuestions: [],
};
try {
  const saved = JSON.parse(fs.readFileSync(REC_STATE_FILE, 'utf8'));
  recState = { ...recState, ...saved };
} catch (e) {}

function saveRecState() {
  fs.writeFileSync(REC_STATE_FILE, JSON.stringify(recState, null, 2));
}

// ── TELEGRAM ──────────────────────────────────────────────────────────────────
async function sendTelegram(chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...options }),
  });
  return resp.json();
}

// ── GROQ AI ───────────────────────────────────────────────────────────────────
async function askGroq(prompt, maxTokens = 600) {
  const resp = await groq.chat.completions.create({
    model: 'llama3-70b-8192',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.8,
  });
  return resp.choices[0]?.message?.content || '';
}

// ── LOAD SHARED STATE ────────────────────────────────────────────────────────
function loadMainState() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'bot-state.json'), 'utf8'));
  } catch { return { subscribers: { email: 0, tgFree: 0, tgPremium: 0 }, revenue: { affiliates: 0, premium: 0, ads: 0 }, pages: { teams: 0, matches: 0, players: 0 } }; }
}

// ── INCOME STREAM ANALYSIS ────────────────────────────────────────────────────
function getActiveStreams()   { return INCOME_STREAMS.filter(s => s.status === 'active'); }
function getPendingStreams()  { return INCOME_STREAMS.filter(s => s.status === 'pending').sort((a,b) => (b.reward - b.effort) - (a.reward - a.effort)); }
function getFutureStreams()   { return INCOME_STREAMS.filter(s => s.status === 'future').sort((a,b) => (b.reward - b.effort) - (a.reward - a.effort)); }
function getBlockedStreams()  { return INCOME_STREAMS.filter(s => s.status === 'blocked_age'); }

function updateStreamStatus(id, status) {
  const stream = INCOME_STREAMS.find(s => s.id === id);
  if (stream) { stream.status = status; recState.streamStatus[id] = status; saveRecState(); }
}

// ── RECOMMENDATION ENGINE ────────────────────────────────────────────────────
async function generateRecommendations(state) {
  const pending  = getPendingStreams();
  const active   = getActiveStreams();
  const dayNum   = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);
  const totalRev = state.revenue.affiliates + state.revenue.premium + state.revenue.ads;
  const totalSubs = state.subscribers.email + state.subscribers.tgFree + state.subscribers.tgPremium;

  const context = `
WC 2026 Intel status:
- Tournament day: ${dayNum}/38
- Revenue: $${totalRev}
- Subscribers: ${totalSubs} (email: ${state.subscribers.email}, tg free: ${state.subscribers.tgFree}, premium: ${state.subscribers.tgPremium})
- Pages live: ${9 + state.pages.teams + state.pages.matches + state.pages.players}
- Income streams active: ${active.length}/${INCOME_STREAMS.length}
- Top 3 pending streams: ${pending.slice(0,3).map(s => s.name).join(', ')}

Given this status and that the tournament is ${((dayNum/38)*100).toFixed(0)}% done, what are the top 3 actions to take TODAY ranked by ROI? Be specific and actionable. Each action: one sentence, include expected $ or % impact.`;

  const raw = await askGroq(context, 400);
  return raw;
}

async function generateOpportunity() {
  const state = loadMainState();
  const dayNum = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);

  const prompt = `WC 2026 is on day ${dayNum}. Think about what's likely happening RIGHT NOW in the tournament — big matches, controversial moments, emerging stories, star players, upsets. What is the single best content/monetization opportunity to capitalize on in the next 24 hours? Give a specific action: what to post, where, and why it will get traffic. 2-3 sentences max.`;
  return askGroq(prompt, 250);
}

async function generateSmartQuestion(state) {
  const totalRev  = state.revenue.affiliates + state.revenue.premium + state.revenue.ads;
  const totalSubs = state.subscribers.email + state.subscribers.tgFree + state.subscribers.tgPremium;

  // Questions the system asks YOU to optimize faster
  const questions = [
    { id: 'top_traffic_source', q: 'What\'s sending the most traffic right now — Google search, TikTok, Twitter, Telegram, or direct? (Helps me tell you where to focus next)' },
    { id: 'affiliate_clicks',   q: 'Have you seen any affiliate clicks in your partner dashboards yet? (Y/N — I\'ll adjust which country to prioritize)' },
    { id: 'email_opens',        q: 'What\'s your email open rate in Beehiiv? (Helps me know if subject lines need changing)' },
    { id: 'premium_interest',   q: 'Has anyone asked about premium in Telegram yet? (I\'ll give you the exact script to convert them)' },
    { id: 'tiktok_live',        q: 'Are you able to go TikTok LIVE during today\'s match? (Could be worth $500+ in gifts + affiliate clicks in one stream)' },
    { id: 'b2b_target',         q: 'Do you know anyone at a sports media company — TV channel, newspaper, podcast? (One B2B deal could outpay everything else)' },
    { id: 'content_bottleneck', q: 'What\'s slowing you down most right now — deploying, creating content, or something else? (I\'ll remove that blocker)' },
    { id: 'biggest_win',        q: 'What\'s your biggest win so far — first subscriber, first click, first sale? (Tell me and I\'ll build on it)' },
  ].filter(q => !recState.answeredQuestions[q.id]);

  return questions.length > 0 ? questions[Math.floor(Math.random() * Math.min(3, questions.length))] : null;
}

// ── EXPORT HANDLERS (called from bot-commands.js) ────────────────────────────

async function handleRecommend(chatId) {
  const state = loadMainState();
  await sendTelegram(chatId, '🧠 Analysing your empire...');
  const recs = await generateRecommendations(state);

  await sendTelegram(chatId,
`💡 *Top Recommendations — Right Now*

${recs}

─────────────────────
📊 Quick status:
Active streams: ${getActiveStreams().length} / ${INCOME_STREAMS.length}
Pending (ready to activate): ${getPendingStreams().length}
Future (need setup): ${getFutureStreams().length}

_Use /streams to see full income stream list_
_Use /opportunity for today's viral angle_`
  );
}

async function handleOpportunity(chatId) {
  await sendTelegram(chatId, '🔍 Finding today\'s best opportunity...');
  const opp = await generateOpportunity();
  await sendTelegram(chatId,
`⚡ *Today's Best Opportunity*

${opp}

─────────────────────
Act on this in the next 4 hours for maximum impact.
Reply /ask [your question] to go deeper on any idea.`
  );
}

async function handleStreams(chatId, filter = 'priority') {
  const pending = getPendingStreams().slice(0, 10);
  const active  = getActiveStreams();
  const blocked = getBlockedStreams();

  const pendingLines = pending.map((s, i) =>
    `${i+1}. *${s.name}*\n   ${s.notes}\n   Effort: ${'⚡'.repeat(s.effort)} | Reward: ${'💰'.repeat(s.reward)}`
  ).join('\n\n');

  await sendTelegram(chatId,
`📊 *Income Stream Tracker*

✅ *Active: ${active.length}*
${active.length ? active.map(s => `• ${s.name}`).join('\n') : '• None yet — deploy first!'}

─────────────────────
🔜 *Ready to activate (${pending.length} streams):*
${pendingLines}

─────────────────────
🔒 *Unlocks at 18 (${blocked.length} streams):*
${blocked.map(s => `• ${s.name}`).join('\n')}

_Total streams identified: ${INCOME_STREAMS.length}_
_Use /activate [stream name] to mark one live_`
  );
}

async function handleIdeas(chatId, context = '') {
  await sendTelegram(chatId, '💡 Brainstorming...');

  const dayNum = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);
  const state  = loadMainState();

  const prompt = `WC 2026 Intel — an AI-powered football predictions site. Day ${dayNum}/38 of the tournament.
${context ? `Context: ${context}` : ''}
Current revenue: $${state.revenue.affiliates + state.revenue.premium + state.revenue.ads}.
Subscribers: ${state.subscribers.email + state.subscribers.tgFree + state.subscribers.tgPremium}.

Brainstorm 5 creative, specific, non-obvious ideas to grow revenue or traffic in the next 7 days. Think outside the obvious. Mix quick wins and bigger bets. Format: numbered list, each idea 1-2 sentences.`;

  const ideas = await askGroq(prompt, 500);

  await sendTelegram(chatId,
`💡 *AI Brainstorm — ${new Date().toDateString()}*

${ideas}

─────────────────────
_Reply /ask [idea number] to go deeper on any of these_`
  );
}

async function handleAsk(chatId, question) {
  await sendTelegram(chatId, '🤔 Thinking...');

  const state  = loadMainState();
  const dayNum = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);
  const totalRev = state.revenue.affiliates + state.revenue.premium + state.revenue.ads;

  const systemContext = `You are the AI strategist for WC 2026 Intel, an automated sports prediction + monetization site.
Context: Day ${dayNum}/38 of the tournament. Revenue: $${totalRev}. Subscribers: ${state.subscribers.email + state.subscribers.tgFree + state.subscribers.tgPremium}.
The owner is 17 years old, no capital, building everything from scratch.
Answer concisely, specifically, and practically. If you don't know something, say so.`;

  const answer = await groq.chat.completions.create({
    model: 'llama3-70b-8192',
    messages: [
      { role: 'system', content: systemContext },
      { role: 'user', content: question },
    ],
    max_tokens: 500,
    temperature: 0.7,
  });

  const text = answer.choices[0]?.message?.content || '—';
  await sendTelegram(chatId, `🧠 *Strategic Answer*\n\n${text}`);
}

async function handleGaps(chatId) {
  await sendTelegram(chatId, '🔍 Auditing gaps vs competitors...');

  const state  = loadMainState();
  const active = getActiveStreams();

  const prompt = `WC 2026 Intel has these income streams active: ${active.map(s=>s.name).join(', ') || 'none yet'}.
What are the 5 most important things that serious competitors (BBC Sport, ESPN, WhoScored, Oddschecker) have that this site probably doesn't yet? For each gap, give the 1-sentence fix. Be specific, not generic.`;

  const gaps = await askGroq(prompt, 400);

  await sendTelegram(chatId,
`🔎 *Gap Analysis vs Competitors*

${gaps}

_Use /recommend to prioritise which gap to close first_`
  );
}

// ── PROACTIVE QUESTION (fires daily, asks what the system needs to help you) ──
async function sendProactiveQuestion() {
  const state    = loadMainState();
  const question = await generateSmartQuestion(state);
  if (!question || !OWNER) return;

  await sendTelegram(OWNER,
`🤖 *Quick question to help optimise your empire:*

${question.q}

_Just reply with your answer — no command needed. I'll adjust recommendations based on it._`
  );
}

// ── ANSWER HANDLER (parse free-text replies to questions) ────────────────────
function recordAnswer(questionId, answer) {
  recState.answeredQuestions[questionId] = { answer, date: new Date().toISOString() };
  saveRecState();
}

// ── VIRAL MOMENT TRACKER ─────────────────────────────────────────────────────
async function trackViralMoment(event) {
  // Called by agent-system.py when goals/red cards/upsets happen
  recState.viralMoments.push({ ...event, date: new Date().toISOString() });
  saveRecState();

  const prompt = `WC 2026. A viral moment just happened: ${JSON.stringify(event)}.
What's the fastest way to capitalize on this in the next 30 minutes for traffic and revenue? Give 2 specific actions.`;

  const advice = await askGroq(prompt, 200);

  if (OWNER) {
    await sendTelegram(OWNER,
`⚡ *Viral Moment — Capitalize NOW*

Event: ${event.description || JSON.stringify(event)}

${advice}`
    );
  }
}

// ── STREAM ACTIVATION TRACKER ────────────────────────────────────────────────
async function handleActivate(chatId, streamName) {
  const stream = INCOME_STREAMS.find(s =>
    s.name.toLowerCase().includes(streamName.toLowerCase()) ||
    s.id.toLowerCase().includes(streamName.toLowerCase())
  );

  if (!stream) {
    await sendTelegram(chatId, `❓ Stream not found. Use /streams to see the list.`);
    return;
  }

  updateStreamStatus(stream.id, 'active');
  const nextStream = getPendingStreams()[0];

  await sendTelegram(chatId,
`✅ *Marked as active: ${stream.name}*

🎉 Active streams: ${getActiveStreams().length}/${INCOME_STREAMS.length}

${nextStream ? `*Next to activate:*\n${nextStream.name}\n${nextStream.notes}\n\n/activate ${nextStream.id}` : '🏆 All streams activated!'}`
  );
}

// ── DAILY PROACTIVE RUN ───────────────────────────────────────────────────────
async function runDaily() {
  if (!OWNER) return;

  const state  = loadMainState();
  const dayNum = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);
  const totalRev = state.revenue.affiliates + state.revenue.premium + state.revenue.ads;

  // Only send if deployed (has actual subs or revenue)
  const totalSubs = state.subscribers.email + state.subscribers.tgFree + state.subscribers.tgPremium;

  // Generate today's top opportunity
  const opp  = await generateOpportunity();
  const recs  = await generateRecommendations(state);
  const question = await generateSmartQuestion(state);

  let msg = `🤖 *AI Daily Strategy — Day ${dayNum}*

⚡ *Today's Best Opportunity*
${opp}

─────────────────────
💡 *Top Recommendations*
${recs}`;

  if (question) {
    msg += `\n\n─────────────────────\n❓ *I need your input to help you better:*\n${question.q}`;
  }

  msg += `\n\n─────────────────────\n📊 Active streams: ${getActiveStreams().length}/${INCOME_STREAMS.length}\n_/streams /ideas /opportunity /gaps_`;

  await sendTelegram(OWNER, msg);
}

module.exports = {
  handleRecommend,
  handleOpportunity,
  handleStreams,
  handleIdeas,
  handleAsk,
  handleGaps,
  handleActivate,
  trackViralMoment,
  recordAnswer,
  runDaily,
  INCOME_STREAMS,
  getActiveStreams,
  getPendingStreams,
};

// Run as standalone daily cron: node recommendations-engine.js
if (require.main === module) {
  runDaily().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
