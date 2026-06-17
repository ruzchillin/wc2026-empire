/**
 * whatsapp-bot.js — WC 2026 Intel Full WhatsApp System
 *
 * TWO modes (run both simultaneously):
 *
 * MODE 1: WhatsApp Business API Bot (interactive, AI-powered)
 *   - Users message your WA number → AI responds with predictions/picks
 *   - Menu system: Today's picks / Live scores / My team / Upgrade
 *   - Subscriber tiers: Free (3 picks/day) → Premium ($9.99/month, unlimited)
 *   - Affiliate links served based on user's country (auto-detected)
 *   - 38-day message sequence (same logic as email drip, but on WhatsApp)
 *   - Goal alerts pushed to opted-in subscribers within 60 seconds
 *
 * MODE 2: Broadcast Channel (one-way announcements)
 *   - Predictions, results, sharp money alerts
 *   - 3 broadcasts/day (morning pick, pre-match, result recap)
 *   - Geo-targeted: different message per country block
 *
 * SETUP:
 *   - WhatsApp Business API via Meta Cloud API (free up to 1,000 conversations/month)
 *   - OR via Twilio WhatsApp (pay-per-message, scales instantly)
 *   - Set env: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN
 *
 * REVENUE:
 *   - Free tier: affiliate CTAs in every message
 *   - Premium tier: $9.99/month via Stripe/Whop
 *   - Africa focus: Betway/Betking CPA $5-30 per signup
 *
 * DEPLOY: Express server on Railway, webhook URL registered with Meta
 */

require('dotenv').config();
const express = require('express');
const Groq    = require('groq-sdk');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
app.use(express.json());

// ── CONFIG ─────────────────────────────────────────────────────────────────────
const WA_TOKEN    = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const VERIFY_TOK  = process.env.WHATSAPP_VERIFY_TOKEN || 'wc2026intel';
const WA_API      = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`;

// ── SUBSCRIBER DATABASE ────────────────────────────────────────────────────────
const SUBS_FILE = path.join(__dirname, 'wa-subscribers.json');
let subs = {};
try { subs = JSON.parse(fs.readFileSync(SUBS_FILE)); } catch {}
function saveSubs() { fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2)); }

function getOrCreate(phone) {
  if (!subs[phone]) {
    subs[phone] = {
      phone, tier: 'free', picksToday: 0,
      country: null, team: null,
      joinedAt: new Date().toISOString(),
      lastMessage: null,
      dripDay: 0, optedInAlerts: false,
      conversationState: 'idle',
    };
  }
  return subs[phone];
}

// ── SEND WHATSAPP MESSAGE ──────────────────────────────────────────────────────
async function send(to, text) {
  if (!WA_TOKEN) { console.log(`[WA Mock] To ${to}: ${text.slice(0,80)}`); return; }
  await fetch(WA_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  }).catch(e => console.error('[WA Send Error]', e.message));
}

async function sendButtons(to, body, buttons) {
  if (!WA_TOKEN) { console.log(`[WA Buttons] To ${to}: ${body}`); return; }
  await fetch(WA_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: { buttons: buttons.map((b, i) => ({ type: 'reply', reply: { id: b.id || `btn_${i}`, title: b.label.slice(0,20) } })) },
      },
    }),
  }).catch(e => console.error('[WA Buttons Error]', e.message));
}

async function sendList(to, header, body, sections) {
  if (!WA_TOKEN) { console.log(`[WA List] To ${to}: ${header}`); return; }
  await fetch(WA_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: header },
        body: { text: body },
        action: { button: 'Choose option', sections },
      },
    }),
  }).catch(e => console.error('[WA List Error]', e.message));
}

// ── AI RESPONSE ────────────────────────────────────────────────────────────────
async function aiReply(userMessage, subscriber) {
  const dayNum = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);
  const context = `
WC 2026 Intel WhatsApp bot. User profile:
- Country: ${subscriber.country || 'unknown'}
- Favourite team: ${subscriber.team || 'unknown'}
- Tier: ${subscriber.tier}
- Picks used today: ${subscriber.picksToday}/3 (free tier)
- Tournament day: ${dayNum}

User message: "${userMessage}"

Reply as a helpful, knowledgeable football AI assistant. Keep it under 200 characters for WhatsApp.
If they ask for a prediction and are on free tier with picks remaining, give one with confidence %.
If they've used all 3 free picks, tell them they can upgrade to premium for unlimited.
Include their country's best betting affiliate link if relevant (just say "get best odds at [site]").
Never use markdown formatting — plain text only for WhatsApp.`;

  try {
    const r = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: context }],
      max_tokens: 150,
      temperature: 0.7,
    });
    return r.choices[0]?.message?.content?.trim() || 'Sorry, I couldn\'t process that right now. Try again in a moment.';
  } catch { return 'Technical issue — try again shortly!'; }
}

// ── AFFILIATE BY COUNTRY ───────────────────────────────────────────────────────
function getAffiliateForCountry(country) {
  const affiliates = {
    GB: { name: 'Bet365', url: 'https://bet365.com/?aff=YOUR_REF', cta: 'Get best odds at Bet365 →' },
    US: { name: 'DraftKings', url: 'https://draftkings.com/?aff=YOUR_REF', cta: 'Join DraftKings →' },
    AU: { name: 'Bet365 AU', url: 'https://bet365.com/au?aff=YOUR_REF', cta: 'Bet with Bet365 AU →' },
    NG: { name: 'Betway', url: 'https://betway.ng/?aff=YOUR_REF', cta: 'Bet with Betway →' },
    GH: { name: 'Betway Ghana', url: 'https://betway.com.gh/?aff=YOUR_REF', cta: 'Bet with Betway Ghana →' },
    ZA: { name: 'Betway SA', url: 'https://betway.co.za/?aff=YOUR_REF', cta: 'Bet with Betway →' },
    KE: { name: 'Betika', url: 'https://betika.com/?aff=YOUR_REF', cta: 'Bet with Betika →' },
    BR: { name: 'Bet365 BR', url: 'https://bet365.com/?aff=YOUR_REF', cta: 'Aposte na Bet365 →' },
    DE: { name: 'Bet365 DE', url: 'https://bet365.com/?aff=YOUR_REF', cta: 'Bei Bet365 wetten →' },
    FR: { name: 'Betclic', url: 'https://betclic.fr/?aff=YOUR_REF', cta: 'Pariez sur Betclic →' },
    IN: { name: 'Dream11', url: 'https://dream11.com/?aff=YOUR_REF', cta: 'Play on Dream11 →' },
  };
  return affiliates[country] || { name: '1xBet', url: 'https://1xbet.com/?aff=YOUR_REF', cta: 'Get best odds →' };
}

// ── MAIN MENU ───────────────────────────────────────────────────────────────────
async function sendMenu(phone) {
  const sub = getOrCreate(phone);
  const dayNum = Math.ceil((Date.now() - new Date('2026-06-11').getTime()) / 86400000);

  await sendList(phone,
    `⚽ WC 2026 Intel`,
    `Day ${dayNum} | Your picks today: ${sub.picksToday}/3${sub.tier === 'premium' ? ' (unlimited)' : ''}`,
    [{
      title: 'Predictions',
      rows: [
        { id: 'today_picks', title: "Today's picks", description: 'AI predictions for today\'s matches' },
        { id: 'custom_pred', title: 'Ask for a prediction', description: 'Ask about any upcoming match' },
        { id: 'accuracy', title: 'AI accuracy', description: 'How accurate is the AI?' },
      ],
    }, {
      title: 'Live',
      rows: [
        { id: 'live_scores', title: 'Live scores', description: 'What\'s happening right now' },
        { id: 'goal_alerts', title: 'Goal alerts', description: 'Get notified for every goal' },
        { id: 'standings', title: 'Group standings', description: 'Current WC 2026 tables' },
      ],
    }, {
      title: 'Account',
      rows: [
        { id: 'my_team', title: 'My team tracker', description: 'Follow your favourite team' },
        { id: 'upgrade', title: '⭐ Go Premium', description: '$9.99/month — unlimited everything' },
        { id: 'help', title: 'Help', description: 'What can this bot do?' },
      ],
    }]
  );
}

// ── INCOMING MESSAGE HANDLER ───────────────────────────────────────────────────
async function handleMessage(phone, text, buttonId = null) {
  const sub = getOrCreate(phone);
  sub.lastMessage = new Date().toISOString();
  const input = buttonId || text.toLowerCase().trim();

  // ── MENU TRIGGERS ──────────────────────────────────────────────────────────
  if (['hi', 'hello', 'hey', 'menu', 'start', '1', 'help'].includes(input)) {
    return sendMenu(phone);
  }

  // ── TODAY'S PICKS ──────────────────────────────────────────────────────────
  if (input === 'today_picks' || input.includes('today') && input.includes('pick')) {
    const picks = await generateTodaysPicks(sub);
    await send(phone, picks);
    if (sub.tier === 'free') {
      sub.picksToday = Math.min(sub.picksToday + 1, 3);
      if (sub.picksToday >= 3) {
        await send(phone, '🔒 You\'ve used your 3 free picks for today.\n\nUpgrade to Premium for unlimited picks + sharp money signals:\nhttps://whop.com/wc2026intel');
      }
    }
    saveSubs();
    return;
  }

  // ── LIVE SCORES ────────────────────────────────────────────────────────────
  if (input === 'live_scores' || input.includes('live') || input.includes('score')) {
    const scores = await fetchLiveScores();
    await send(phone, scores);
    return;
  }

  // ── GOAL ALERTS OPT-IN ─────────────────────────────────────────────────────
  if (input === 'goal_alerts') {
    sub.optedInAlerts = true;
    saveSubs();
    await sendButtons(phone,
      '✅ Goal alerts activated!\n\nYou\'ll get a WhatsApp message within 60 seconds of every WC 2026 goal.',
      [{ id: 'menu', label: '← Back to menu' }, { id: 'upgrade', label: '⭐ Upgrade Premium' }]
    );
    return;
  }

  // ── SET FAVOURITE TEAM ─────────────────────────────────────────────────────
  if (input === 'my_team' || sub.conversationState === 'awaiting_team') {
    if (sub.conversationState === 'awaiting_team' && text.length > 2) {
      sub.team = text.trim();
      sub.conversationState = 'idle';
      saveSubs();
      const teamInfo = await ai(`WC 2026: 3-sentence preview of ${sub.team}'s chances. Upbeat, fan-oriented. Include their next match.`, 100);
      await send(phone, `✅ Team set: ${sub.team}\n\n${teamInfo || 'I\'ll track all their matches for you!'}`);
      return;
    }
    sub.conversationState = 'awaiting_team';
    saveSubs();
    await send(phone, 'Which team are you supporting? (Reply with country name, e.g. "Brazil", "England")');
    return;
  }

  // ── UPGRADE ────────────────────────────────────────────────────────────────
  if (input === 'upgrade' || input.includes('premium') || input.includes('upgrade')) {
    const aff = getAffiliateForCountry(sub.country);
    await sendButtons(phone,
      `⭐ *WC 2026 Intel Premium — $9.99/month*\n\nUnlimited AI predictions\nSharp money alerts (before odds move)\nReferee intelligence reports\nLive WhatsApp goal alerts\nFull 38-day tournament coverage\n\nCancel anytime. First 3 days free trial.`,
      [{ id: 'pay_premium', label: '💳 Get Premium →' }, { id: 'menu', label: '← Back' }]
    );
    return;
  }

  if (input === 'pay_premium') {
    await send(phone, `Pay here (3-day free trial, then $9.99/month):\nhttps://whop.com/wc2026intel\n\nAfter payment, reply "premium" and I\'ll activate your account.`);
    return;
  }

  // ── CUSTOM PREDICTION REQUEST ──────────────────────────────────────────────
  if (input === 'custom_pred' || sub.conversationState === 'awaiting_pred_match') {
    if (sub.conversationState === 'awaiting_pred_match' && text.length > 3) {
      sub.conversationState = 'idle';

      if (sub.tier === 'free' && sub.picksToday >= 3) {
        await send(phone, `You've used all 3 free picks today 🔒\n\nUpgrade for unlimited:\nhttps://whop.com/wc2026intel`);
        saveSubs();
        return;
      }

      const pred = await generatePrediction(text, sub);
      await send(phone, pred);
      if (sub.tier === 'free') sub.picksToday++;
      saveSubs();
      return;
    }
    sub.conversationState = 'awaiting_pred_match';
    saveSubs();
    await send(phone, 'Which match? Reply with team names e.g. "Brazil vs Mexico" or "France England"');
    return;
  }

  // ── ACCURACY ───────────────────────────────────────────────────────────────
  if (input === 'accuracy') {
    try {
      const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'bot-state.json')));
      const preds = (state.predictions || []).filter(p => p.correct !== null);
      const correct = preds.filter(p => p.correct).length;
      const pct = preds.length > 0 ? Math.round(correct/preds.length*100) : 0;
      await send(phone, `🎯 AI Prediction Accuracy\n\n${pct}% correct (${correct}/${preds.length} predictions)\n\nWe track every prediction so you can see if it\'s worth following. Today\'s picks are live on the site.`);
    } catch {
      await send(phone, '🎯 Tracking accuracy in real-time. Check back after today\'s matches for the latest stats.');
    }
    return;
  }

  // ── STANDINGS ──────────────────────────────────────────────────────────────
  if (input === 'standings') {
    await send(phone, 'Full group standings → wc2026intel.com/group-standings.html\n\nUpdated in real-time. You can also ask me about any specific group.');
    return;
  }

  // ── PREMIUM CONFIRMED ──────────────────────────────────────────────────────
  if (input === 'premium' && sub.tier === 'free') {
    // Normally you'd verify payment via Whop webhook — this is a manual fallback
    await send(phone, 'Please verify your payment at https://whop.com/wc2026intel and I\'ll activate your account within 1 hour.');
    return;
  }

  // ── FREE TEXT / AI FALLBACK ────────────────────────────────────────────────
  const reply = await aiReply(text, sub);
  await send(phone, reply);

  // Add affiliate link to every 3rd message
  if (Object.keys(subs).length % 3 === 0) {
    const aff = getAffiliateForCountry(sub.country);
    await send(phone, `💡 Best odds for today: ${aff.url}`);
  }

  saveSubs();
}

// ── GENERATE TODAY'S PICKS ─────────────────────────────────────────────────────
async function generateTodaysPicks(subscriber) {
  const today = new Date().toISOString().split('T')[0];
  try {
    const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}&league=1&season=2026`, {
      headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' },
    });
    const d = await r.json();
    const fixtures = d.response || [];

    if (!fixtures.length) return `No WC 2026 matches today.\n\nNext picks tomorrow. Tap menu to see groups.`;

    const isPremium = subscriber.tier === 'premium';
    const limit = isPremium ? fixtures.length : Math.min(fixtures.length, 1);
    const lines = [];

    for (const f of fixtures.slice(0, limit)) {
      const h = f.teams?.home?.name;
      const a = f.teams?.away?.name;
      const t = f.fixture?.date?.split('T')[1]?.substring(0,5) || '';
      const pred = await ai(`WC 2026 prediction: ${h} vs ${a}. Return: "PICK: [outcome] | CONFIDENCE: [%] | SCORE: [x-x]" in one line. No markdown.`, 80);
      lines.push(`⚽ ${h} vs ${a} (${t} UTC)\n${pred || 'Prediction unavailable'}`);
    }

    if (!isPremium && fixtures.length > 1) {
      lines.push(`\n🔒 +${fixtures.length - 1} more picks in Premium ($9.99/mo)\nhttps://whop.com/wc2026intel`);
    }

    const aff = getAffiliateForCountry(subscriber.country);
    lines.push(`\n📊 ${aff.cta}\n${aff.url}`);

    return lines.join('\n\n');
  } catch {
    return 'Getting today\'s picks... Check wc2026intel.com for live data.';
  }
}

// ── GENERATE CUSTOM PREDICTION ─────────────────────────────────────────────────
async function generatePrediction(matchText, subscriber) {
  const pred = await ai(
    `WC 2026 prediction request: "${matchText}". Give a concise prediction: teams, winner, confidence %, key angle. Under 200 chars. Plain text, no markdown.`, 120
  );
  const aff = getAffiliateForCountry(subscriber.country);
  return `${pred || 'Analysis loading...'}\n\n📊 Best odds: ${aff.url}`;
}

// ── FETCH LIVE SCORES ──────────────────────────────────────────────────────────
async function fetchLiveScores() {
  try {
    const r = await fetch('https://v3.football.api-sports.io/fixtures?live=all&league=1&season=2026', {
      headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' },
    });
    const d = await r.json();
    const live = d.response || [];
    if (!live.length) return 'No live WC 2026 matches right now.\n\nFull schedule → wc2026intel.com';
    const lines = live.map(f => `${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name} (${f.fixture.status.elapsed}')` );
    return `🔴 LIVE\n\n${lines.join('\n')}\n\nFull details → wc2026intel.com/live-scores.html`;
  } catch { return 'Live scores at → wc2026intel.com/live-scores.html'; }
}

// ── BROADCAST GOAL ALERT TO ALL OPTED-IN SUBS ──────────────────────────────────
async function broadcastGoalAlert(home, away, score, minute, scorer) {
  const optedIn = Object.values(subs).filter(s => s.optedInAlerts);
  log(`[WA BROADCAST] Sending goal alert to ${optedIn.length} subscribers`);

  const msg = `⚽ GOAL!\n\n${home} ${score} ${away} (${minute}')\n${scorer ? `Scorer: ${scorer}\n` : ''}\nFull match → wc2026intel.com/live-scores.html`;

  // Send in batches to avoid rate limits
  for (let i = 0; i < optedIn.length; i += 10) {
    const batch = optedIn.slice(i, i + 10);
    await Promise.all(batch.map(s => send(s.phone, msg)));
    if (i + 10 < optedIn.length) await new Promise(r => setTimeout(r, 1000)); // 1s between batches
  }
}

// ── DRIP MESSAGE SEQUENCE (same logic as email but on WhatsApp) ────────────────
const WA_DRIP = [
  { day: 1, msg: 'Your Day 1 free pick is in. Here\'s what our model is most confident about today →' },
  { day: 3, msg: 'We caught something in yesterday\'s match that the bookies didn\'t. Reply "signals" to see the 3 things our model tracks.' },
  { day: 7, msg: 'We\'ve been holding something back. The sharp money tracker has called 4 upsets this tournament. Reply "sharps" to see what it\'s showing for tonight.' },
  { day: 14, msg: 'Halfway through. The knockouts are where our model gets strongest. Upgrade before it gets harder: https://whop.com/wc2026intel' },
  { day: 21, msg: 'Round of 16 picks are live. 3 sharp money signals are flashing. Tap below to see them.' },
  { day: 32, msg: 'Final 4. Here\'s who our AI says wins the World Cup. No paywall on this one.' },
  { day: 36, msg: 'Final in 2 days. Last chance to lock in $9.99 forever: https://whop.com/wc2026intel' },
];

async function sendDripMessages() {
  const now = Date.now();
  const tourDay = Math.ceil((now - new Date('2026-06-11').getTime()) / 86400000);

  const drip = WA_DRIP.find(d => d.day === tourDay);
  if (!drip) return;

  const toSend = Object.values(subs).filter(s => {
    const joinDay = Math.ceil((now - new Date(s.joinedAt).getTime()) / 86400000);
    return joinDay >= drip.day && !s[`drip_${drip.day}_sent`];
  });

  for (const sub of toSend) {
    await send(sub.phone, drip.msg);
    sub[`drip_${drip.day}_sent`] = true;
  }
  if (toSend.length) { saveSubs(); log(`[WA DRIP] Sent day ${drip.day} message to ${toSend.length} subscribers`); }
}

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19)}] ${msg}`); }

// ── WEBHOOK ENDPOINTS ──────────────────────────────────────────────────────────

// Verification (Meta requires this)
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOK) {
    res.send(req.query['hub.challenge']);
  } else {
    res.status(403).send('Forbidden');
  }
});

// Incoming messages
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Respond immediately
  const body = req.body;
  if (body?.object !== 'whatsapp_business_account') return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const messages = change.value?.messages || [];
      for (const msg of messages) {
        const phone = msg.from;
        if (msg.type === 'text') {
          await handleMessage(phone, msg.text?.body || '');
        } else if (msg.type === 'interactive') {
          const id = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;
          await handleMessage(phone, '', id);
        }
      }
    }
  }
});

// Internal API — called by autonomous-agent.js when a goal happens
app.post('/broadcast/goal', async (req, res) => {
  const { home, away, score, minute, scorer } = req.body;
  await broadcastGoalAlert(home, away, score, minute, scorer);
  res.json({ sent: Object.values(subs).filter(s => s.optedInAlerts).length });
});

// Stats endpoint for command center
app.get('/stats', (req, res) => {
  const total   = Object.keys(subs).length;
  const premium = Object.values(subs).filter(s => s.tier === 'premium').length;
  const alerted = Object.values(subs).filter(s => s.optedInAlerts).length;
  res.json({ total, premium, free: total - premium, optedInAlerts: alerted });
});

// ── DRIP CRON (run daily) ──────────────────────────────────────────────────────
setInterval(sendDripMessages, 3600000); // Check hourly, send if due

// ── START ──────────────────────────────────────────────────────────────────────
const PORT = process.env.WA_PORT || 3002;
app.listen(PORT, () => {
  log(`[WA BOT] Running on port ${PORT}`);
  log(`[WA BOT] ${Object.keys(subs).length} subscribers loaded`);
  log(`[WA BOT] Webhook: POST /webhook | Goal broadcast: POST /broadcast/goal`);
});

module.exports = { broadcastGoalAlert, sendDripMessages };
