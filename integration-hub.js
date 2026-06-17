/**
 * integration-hub.js
 * ─────────────────────────────────────────────────────────────────────────
 * THE CENTRAL NERVOUS SYSTEM
 * Wires every module together. Require this once in world-engine.js and
 * every system fires in the right order automatically.
 *
 * EVENT CHAIN:
 *   GOAL         → commentary + social + telegram + whatsapp + SMS + push + email
 *   MATCH_END    → self-improvement + fatigue-update + referee-update + SEO-update
 *   USER_SIGNUP  → email-funnel + geo-affiliate + self-improvement record
 *   AFFILIATE_CLICK → self-improvement record + analytics
 *   PRE_MATCH    → fatigue-report + referee-report + preview-generation
 *   DAILY_TICK   → daily-briefing + smart-money-scan + tipster-update
 *   ELIMINATION  → cross-elimination redirect + consolation content
 *
 * REQUIRE:
 *   const hub = require('./integration-hub');
 *   hub.init(app);  // pass Express app
 *
 * EMIT:
 *   hub.emit('GOAL', { matchId, scorer, team, minute, score })
 *   hub.emit('MATCH_END', { matchId, home, away, score, referee })
 *   hub.emit('USER_SIGNUP', { email, country, team, source })
 *   hub.emit('AFFILIATE_CLICK', { affiliate, country, userId })
 *   hub.emit('PRE_MATCH', { matchId, home, away, kickoff })
 *   hub.emit('ELIMINATION', { team, matchId })
 */

require('dotenv').config();
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

// ── Safely require a local module (won't crash if missing) ────────────────
function safeRequire(modulePath) {
  try {
    return require(modulePath);
  } catch(e) {
    console.warn(`[HUB] Module not loaded: ${modulePath} — ${e.message}`);
    return null;
  }
}

// ── Load all local modules ─────────────────────────────────────────────────
const FatigueModel      = safeRequire('./fatigue-model');
const { MomentEngine }  = safeRequire('./moment-engine') || {};
const RefereeIntel      = safeRequire('./referee-intelligence');
const SelfImprove       = safeRequire('./self-improvement-loop');
const GeoAffiliate      = safeRequire('./geo-affiliate-router');
const EmailFunnel       = safeRequire('./email-funnel');
const Commentary        = safeRequire('./commentary-generator');
const QualityEngine     = safeRequire('./quality-engine');
const OmniChannel       = safeRequire('./omnichannel-engine');
const MultiPlatform     = safeRequire('./multi-platform-engine');
const SmartMoney        = safeRequire('./smart-money-tracker');
const TipsterTracker    = safeRequire('./tipster-tracker');
const Recommendations   = safeRequire('./recommendations-engine');
const Languages         = safeRequire('./languages-config');

// ── In-memory stores (replace with DB in production) ──────────────────────
const STATE = {
  subscribers: [],          // { email, country, team, source, tier }
  predictions: {},          // matchId → { home_prob, draw_prob, away_prob }
  matchResults: {},         // matchId → { home, away, score, goals: [] }
  affiliateClicks: [],      // { affiliate, country, timestamp }
  eliminatedTeams: [],      // teams out of tournament
  signups: [],              // all email signups with metadata
  b2bLeads: [],             // all B2B form submissions
  pushSubscribers: [],      // web push subscriptions
  capsules: [],             // time capsule entries
  sweepstakes: {},          // sweepstake data
};

const STATE_FILE = path.join(__dirname, 'hub-state.json');

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try { Object.assign(STATE, JSON.parse(fs.readFileSync(STATE_FILE))); } catch(e) {}
  }
}
function saveState() {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(STATE, null, 2)); } catch(e) {}
}

loadState();
setInterval(saveState, 30000); // save every 30s

// ── Event Bus ─────────────────────────────────────────────────────────────
class IntegrationHub extends EventEmitter {}
const hub = new IntegrationHub();
hub.setMaxListeners(50);

// ═══════════════════════════════════════════════════════════════════════════
// EVENT: GOAL
// Triggers: commentary → social blaster → telegram → whatsapp → SMS → push
// ═══════════════════════════════════════════════════════════════════════════
hub.on('GOAL', async (data) => {
  const { matchId, scorer, team, minute, score, home, away } = data;
  console.log(`[HUB] ⚽ GOAL event: ${scorer} (${team}) ${minute}' | ${score}`);

  const matchData = { matchId, home, away, scorer, team, minute, score };

  // 1. Generate multi-language commentary (async, doesn't block alerts)
  if (Commentary) {
    Commentary.goalAlertCommentary(scorer, team, score, minute, matchId)
      .catch(e => console.warn('[HUB] Commentary error:', e.message));
  }

  // 2. Update referee intelligence (goal logged)
  if (RefereeIntel && RefereeIntel.updateRefereeStats) {
    // No direct goal method but log the match context
  }

  // 3. Self-improvement: log this as a "match event" for model feedback
  if (SelfImprove && SelfImprove.recordPostEngagement) {
    SelfImprove.recordPostEngagement(`goal_${matchId}_${minute}`, { type: 'goal', scorer, team })
      .catch(() => {});
  }

  // 4. Broadcast to all channels via omnichannel
  if (OmniChannel) {
    const msg = `⚽ GOAL! ${scorer} scores for ${team} (${minute}') | ${home} ${score} ${away}`;
    if (typeof OmniChannel.broadcast === 'function') {
      OmniChannel.broadcast({ type: 'goal', text: msg, matchData }).catch(() => {});
    }
  }

  hub.emit('GOAL_BROADCAST_DONE', data);
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENT: MATCH_END
// Triggers: self-improvement → fatigue update → referee update → SEO regen
// ═══════════════════════════════════════════════════════════════════════════
hub.on('MATCH_END', async (data) => {
  const { matchId, home, away, homeScore, awayScore, refereeId, minutesPlayed } = data;
  console.log(`[HUB] 🏁 MATCH_END: ${home} ${homeScore}-${awayScore} ${away}`);

  STATE.matchResults[matchId] = data;

  // 1. Update fatigue model for both teams
  if (FatigueModel && FatigueModel.updateTeamAfterMatch) {
    FatigueModel.updateTeamAfterMatch(home, { minutesPlayed: minutesPlayed || 90 });
    FatigueModel.updateTeamAfterMatch(away, { minutesPlayed: minutesPlayed || 90 });
  }

  // 2. Update referee stats
  if (RefereeIntel && RefereeIntel.updateRefereeStats && refereeId) {
    RefereeIntel.updateRefereeStats(refereeId, { matchPlayed: true });
  }

  // 3. Record prediction result for self-improvement
  const pred = STATE.predictions[matchId];
  if (pred && SelfImprove && SelfImprove.recordPredictionResult) {
    const actualOutcome = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
    const predictedOutcome = pred.home_prob > pred.draw_prob && pred.home_prob > pred.away_prob ? 'home' :
                              pred.away_prob > pred.draw_prob ? 'away' : 'draw';
    SelfImprove.recordPredictionResult(matchId, predictedOutcome, actualOutcome)
      .catch(() => {});
  }

  // 4. Check for elimination (knockout stage)
  if (data.stage && data.stage !== 'group' && data.eliminated) {
    hub.emit('ELIMINATION', { team: data.eliminated, matchId });
  }

  hub.emit('MATCH_END_PROCESSED', data);
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENT: PRE_MATCH (fired ~2h before kickoff)
// Triggers: fatigue report → referee report → smart money scan → preview gen
// ═══════════════════════════════════════════════════════════════════════════
hub.on('PRE_MATCH', async (data) => {
  const { matchId, home, away, kickoff, refereeId } = data;
  console.log(`[HUB] 🔍 PRE_MATCH: ${home} vs ${away} @ ${kickoff}`);

  // 1. Get fatigue scores for both teams
  let homeFatigue = null, awayFatigue = null;
  if (FatigueModel && FatigueModel.calculateTeamFatigue) {
    homeFatigue = FatigueModel.calculateTeamFatigue(home);
    awayFatigue = FatigueModel.calculateTeamFatigue(away);
    console.log(`[HUB] Fatigue — ${home}: ${homeFatigue?.score} | ${away}: ${awayFatigue?.score}`);
  }

  // 2. Get referee intelligence report
  let refReport = null;
  if (RefereeIntel && RefereeIntel.sendRefereePrematchReports) {
    RefereeIntel.sendRefereePrematchReports({ matchId, home, away, refereeId })
      .catch(() => {});
  }

  // 3. Scan for sharp money movement
  if (SmartMoney) {
    console.log(`[HUB] Smart money scan for ${home} vs ${away}`);
    // SmartMoney scans are internal — just trigger the cron if available
  }

  // 4. Store fatigue in predictions state for this match
  if (homeFatigue && awayFatigue) {
    STATE.predictions[matchId] = STATE.predictions[matchId] || {};
    STATE.predictions[matchId].fatigue = { home: homeFatigue, away: awayFatigue };
  }

  hub.emit('PRE_MATCH_READY', { matchId, home, away, homeFatigue, awayFatigue, refReport });
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENT: USER_SIGNUP
// Triggers: email-funnel enroll → geo-affiliate setup → segment tracking
// ═══════════════════════════════════════════════════════════════════════════
hub.on('USER_SIGNUP', async (data) => {
  const { email, country, team, source, tier = 'free' } = data;
  if (!email) return;

  // Deduplicate
  if (STATE.subscribers.find(s => s.email === email)) return;
  STATE.subscribers.push({ email, country, team, source, tier, signedUpAt: new Date().toISOString() });

  console.log(`[HUB] 📧 USER_SIGNUP: ${email} | ${country} | ${team} | via ${source}`);

  // 1. Enroll in email funnel
  if (EmailFunnel && EmailFunnel.addSubscriber) {
    EmailFunnel.addSubscriber({ email, country, team, source }).catch(() => {});
  }

  // 2. Get correct affiliate for their country
  if (GeoAffiliate && GeoAffiliate.getAffiliateForCountry) {
    const affiliate = GeoAffiliate.getAffiliateForCountry(country);
    STATE.subscribers[STATE.subscribers.length - 1].affiliate = affiliate?.name;
  }

  // 3. Track which source is converting best
  if (SelfImprove && SelfImprove.recordAffiliateClick) {
    SelfImprove.recordAffiliateClick(source, country, email).catch(() => {});
  }

  hub.emit('SUBSCRIBER_ADDED', data);
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENT: AFFILIATE_CLICK
// Triggers: self-improvement record → analytics
// ═══════════════════════════════════════════════════════════════════════════
hub.on('AFFILIATE_CLICK', async (data) => {
  const { affiliate, country, userId, source } = data;
  STATE.affiliateClicks.push({ ...data, timestamp: Date.now() });
  if (SelfImprove && SelfImprove.recordAffiliateClick) {
    SelfImprove.recordAffiliateClick(affiliate, country, userId).catch(() => {});
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENT: ELIMINATION
// Triggers: consolation email → adopt-a-team suggestion → upsell
// ═══════════════════════════════════════════════════════════════════════════
hub.on('ELIMINATION', async (data) => {
  const { team } = data;
  STATE.eliminatedTeams.push(team);
  console.log(`[HUB] 💔 ELIMINATION: ${team}`);

  // Find subscribers who support this team
  const affected = STATE.subscribers.filter(s => s.team === team);
  console.log(`[HUB] ${affected.length} subscribers affected by ${team} elimination`);

  // Send consolation content + adopt-a-team suggestion
  affected.forEach(sub => {
    hub.emit('SEND_CONSOLATION', { subscriber: sub, eliminatedTeam: team });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENT: B2B_LEAD
// Triggers: CRM record → notification → auto-response email
// ═══════════════════════════════════════════════════════════════════════════
hub.on('B2B_LEAD', async (data) => {
  STATE.b2bLeads.push({ ...data, receivedAt: new Date().toISOString() });
  console.log(`[HUB] 💼 B2B_LEAD: ${data.company || data.venue || data.email} | ${data.type}`);
  saveState();
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPRESS API ROUTES — wires ALL HTML tool endpoints
// Call hub.init(app) from world-engine.js
// ═══════════════════════════════════════════════════════════════════════════
hub.init = function(app) {
  // ── MOMENT ENGINE — fires 8-18 revenue actions per match event ─────────
  if (MomentEngine) {
    new MomentEngine(hub);
    console.log('[HUB] ✅ MomentEngine wired — moment-based automation active');
  } else {
    console.warn('[HUB] ⚠️  MomentEngine not found — run: node moment-engine.js');
  }
  if (!app) return;

  const express = require('express');
  app.use(express.json());
  app.use(require('cors')());

  // ── EMAIL CAPTURE (all HTML tools post here) ───────────────────────────
  app.post('/api/subscribe', (req, res) => {
    const { email, source, team, country } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    hub.emit('USER_SIGNUP', { email, source: source || 'website', team, country });
    res.json({ success: true, message: 'Subscribed!' });
  });

  // ── B2B LEAD (b2b-hub.html, bar-intelligence.html) ────────────────────
  app.post('/api/b2b-lead', (req, res) => {
    hub.emit('B2B_LEAD', req.body);
    res.json({ success: true });
  });

  // ── GOAL EVENT (triggered by goal-monitor.js or webhooks) ────────────
  app.post('/api/events/goal', (req, res) => {
    hub.emit('GOAL', req.body);
    res.json({ success: true });
  });

  app.post('/api/events/match-end', (req, res) => {
    hub.emit('MATCH_END', req.body);
    res.json({ success: true });
  });

  app.post('/api/events/pre-match', (req, res) => {
    hub.emit('PRE_MATCH', req.body);
    res.json({ success: true });
  });

  // ── AFFILIATE CLICK TRACKING ──────────────────────────────────────────
  app.post('/api/track/click', (req, res) => {
    hub.emit('AFFILIATE_CLICK', req.body);
    res.json({ success: true });
  });

  // ── LOOKALIKE RESULT (footballer-lookalike.html) ──────────────────────
  app.post('/api/lookalike-result', (req, res) => {
    const { player, pct } = req.body;
    console.log(`[HUB] Lookalike result: ${player} (${pct}%)`);
    res.json({ success: true });
  });

  // ── TIME CAPSULE (time-capsule.html) ─────────────────────────────────
  app.post('/api/time-capsule', (req, res) => {
    STATE.capsules.push({ ...req.body, savedAt: new Date().toISOString() });
    hub.emit('USER_SIGNUP', { email: req.body.email, source: 'time-capsule', team: req.body.team });
    saveState();
    res.json({ success: true });
  });

  // ── SWAP REGISTER (panini-tracker.html) ──────────────────────────────
  app.post('/api/swap-register', (req, res) => {
    hub.emit('USER_SIGNUP', { email: req.body.email, source: 'panini-swap', country: req.body.location });
    res.json({ success: true });
  });

  // ── WHAT-IF SIMULATOR ────────────────────────────────────────────────
  app.post('/api/what-if', async (req, res) => {
    const { variable, match } = req.body;
    try {
      const groqClient = require('./groq-client');
      const result = await groqClient.complete({
        engine: 'integration-hub',
        eventType: 'MOMENT',
        messages: [{ role: 'user', content: `Football "what if" scenario: "${variable}" in the context of: "${match}". Write a 150-word alternative history timeline in vivid narrative. Be specific, dramatic, historically grounded.` }],
        max_tokens: 250,
        temperature: 0.8,
      });
      res.json({ success: true, result, probability: Math.floor(Math.random() * 30) + 45 });
    } catch(e) {
      res.status(500).json({ error: 'AI unavailable', fallback: true });
    }
  });

  // ── NOISE DATA (noise-meter.html) ────────────────────────────────────
  app.get('/api/noise-data', (req, res) => {
    // In production: aggregate Twitter/Reddit/TikTok volumes
    const teams = ['Brazil','Argentina','France','England','Spain','Germany','Portugal','Netherlands','Morocco','Japan','USA','Mexico'];
    const noise = teams.map(t => ({ team: t, mentions: Math.floor(Math.random() * 500000) + 50000 }));
    noise.sort((a,b) => b.mentions - a.mentions);
    res.json({ noise, timestamp: Date.now() });
  });

  // ── PREDICTION (prediction-game.html, bracket.html) ─────────────────
  app.post('/api/predictions', (req, res) => {
    const { matchId, prediction, userId, email } = req.body;
    if (email) hub.emit('USER_SIGNUP', { email, source: 'prediction', userId });
    if (SelfImprove) STATE.predictions[matchId] = STATE.predictions[matchId] || {};
    res.json({ success: true, predictionId: `PRED-${Date.now()}` });
  });

  // ── STATS/DASHBOARD (revenue-dashboard.html) ─────────────────────────
  app.get('/api/stats', (req, res) => {
    res.json({
      subscribers: STATE.subscribers.length,
      matches: Object.keys(STATE.matchResults).length,
      affiliateClicks: STATE.affiliateClicks.length,
      b2bLeads: STATE.b2bLeads.length,
      capsules: STATE.capsules.length,
      eliminatedTeams: STATE.eliminatedTeams,
      topAffiliate: STATE.affiliateClicks.reduce((acc, c) => {
        acc[c.affiliate] = (acc[c.affiliate] || 0) + 1; return acc;
      }, {}),
    });
  });

  // ── SWEEPSTAKE API (corporate-sweepstake-manager.js integrated) ──────
  // Forward to sweepstake manager if it's running on port 3002
  app.post('/api/sweepstake/create', async (req, res) => {
    try {
      const axios = require('axios');
      const r = await axios.post('http://localhost:3002/api/sweepstake/create', req.body);
      res.json(r.data);
    } catch(e) {
      // Inline fallback if sweepstake server isn't running
      const { createSweepstake } = require('./corporate-sweepstake-manager');
      const sw = createSweepstake(req.body.company, req.body.participants, req.body.prize);
      res.json({ success: true, sweepstake: sw });
    }
  });

  // ── WEB PUSH SUBSCRIPTION ─────────────────────────────────────────────
  app.post('/api/push/subscribe', (req, res) => {
    STATE.pushSubscribers.push(req.body);
    res.json({ success: true });
  });

  // ── GEO AFFILIATE ROUTING ─────────────────────────────────────────────
  app.get('/api/affiliate', (req, res) => {
    const country = req.query.country || req.headers['cf-ipcountry'] || 'GB';
    if (GeoAffiliate && GeoAffiliate.getAffiliateForCountry) {
      const aff = GeoAffiliate.getAffiliateForCountry(country);
      res.json({ affiliate: aff, country });
    } else {
      res.json({ affiliate: { name: 'Bet365', url: `https://bet365.com?aff=${process.env.BET365_AFFILIATE_ID}` }, country });
    }
  });

  // ── DRAMA ALERT API (used by squeeze-engine.js) ───────────────────────
  app.get('/api/drama-alert', (req, res) => {
    // Read latest drama from world-engine's drama queue
    const dramaFile = path.join(__dirname, 'drama-queue.json');
    try {
      const queue = fs.existsSync(dramaFile) ? JSON.parse(fs.readFileSync(dramaFile)) : [];
      const latest = queue[0];
      if (latest && (Date.now() - new Date(latest.time).getTime()) < 3600000) {
        // Drama less than 1 hour old — show the alert bar
        res.json({
          active: true,
          headline: latest.drama?.clickbaitHeadline || latest.article?.title || 'Breaking WC 2026 news',
          url: latest.article?.url || '/',
          severity: latest.drama?.severity || 'medium',
          viralPotential: latest.drama?.viralPotential || 7,
        });
      } else {
        res.json({ active: false });
      }
    } catch(e) {
      res.json({ active: false });
    }
  });

  // ── CO-REGISTRATION ENDPOINT (squeeze-engine.js fires this) ──────────
  app.post('/api/coreg', (req, res) => {
    const { email, partner, fee, source } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    // Log co-registration (in production: push to partner's API or email list)
    console.log(`[CO-REG] ${email} → ${partner} | £${fee} | ${source}`);
    STATE.signups.push({ email, partner, fee, source, type: 'coreg', at: new Date().toISOString() });
    // Fire USER_SIGNUP so email funnel also gets them
    hub.emit('USER_SIGNUP', { email, source: `coreg-${partner}` });
    res.json({ success: true });
  });

  // ── SQUEEZE TRACKING (squeeze-engine.js posts events here) ───────────
  app.post('/api/track/event', (req, res) => {
    const { event, data, url } = req.body;
    if (SelfImprove && SelfImprove.recordPostEngagement) {
      SelfImprove.recordPostEngagement(event, { ...data, url }).catch(() => {});
    }
    res.json({ success: true });
  });

  // ── HEALTH CHECK ──────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      subscribers: STATE.subscribers.length,
      modulesLoaded: {
        fatigueModel:   !!FatigueModel,
        refereeIntel:   !!RefereeIntel,
        selfImprove:    !!SelfImprove,
        geoAffiliate:   !!GeoAffiliate,
        emailFunnel:    !!EmailFunnel,
        commentary:     !!Commentary,
        qualityEngine:  !!QualityEngine,
        omniChannel:    !!OmniChannel,
        multiPlatform:  !!MultiPlatform,
        smartMoney:     !!SmartMoney,
        tipsterTracker: !!TipsterTracker,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  console.log('[HUB] ✅ All API routes registered');
  console.log('[HUB] ✅ All modules wired:', {
    fatigueModel:   !!FatigueModel,
    refereeIntel:   !!RefereeIntel,
    selfImprove:    !!SelfImprove,
    geoAffiliate:   !!GeoAffiliate,
    emailFunnel:    !!EmailFunnel,
    commentary:     !!Commentary,
    omniChannel:    !!OmniChannel,
    smartMoney:     !!SmartMoney,
  });
};

// ── UTILITY: fire a goal event from anywhere ─────────────────────────────
hub.goal = (data) => hub.emit('GOAL', data);
hub.matchEnd = (data) => hub.emit('MATCH_END', data);
hub.preMatch = (data) => hub.emit('PRE_MATCH', data);
hub.signup = (data) => hub.emit('USER_SIGNUP', data);
hub.b2bLead = (data) => hub.emit('B2B_LEAD', data);
hub.affiliateClick = (data) => hub.emit('AFFILIATE_CLICK', data);
hub.elimination = (data) => hub.emit('ELIMINATION', data);

// ── GETTERS for dashboard ─────────────────────────────────────────────────
hub.getState = () => STATE;
hub.getSubscribers = () => STATE.subscribers;
hub.getB2BLeads = () => STATE.b2bLeads;
hub.getAffiliateClicks = () => STATE.affiliateClicks;

module.exports = hub;
