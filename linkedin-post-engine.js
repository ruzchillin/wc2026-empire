/**
 * WC 2026 Sports Empire — LinkedIn Post Engine
 * Deploy on Railway.app as service "linkedin-post-engine"
 *
 * LinkedIn has 1B+ members, 3-4x organic reach vs Facebook for professional content.
 * Target audiences on LinkedIn:
 *   - Corporate HR/Event managers → office sweepstake packages
 *   - Sports business professionals → B2B angle
 *   - Marketing managers → sponsorship/brand content
 *   - Football data analysts → AI prediction credibility
 *
 * Uses LinkedIn v2 API (UGC Posts endpoint).
 * Content is professional, data-driven, different from Instagram/Twitter.
 *
 * Required env vars:
 *   LINKEDIN_ACCESS_TOKEN  — OAuth2 token (LinkedIn Developer Portal)
 *   LINKEDIN_PERSON_URN    — urn:li:person:YOUR_ID (from API response)
 *   LINKEDIN_ORG_URN       — urn:li:organization:YOUR_ID (for company page, optional)
 *   VERCEL_URL             — your main site URL
 *   API_SERVER_URL         — for match data
 *   GROQ_API_KEY           — for professional content generation
 *   PIPELINE_SECRET        — shared inter-service secret
 *
 * Get tokens:
 *   1. LinkedIn Developer Portal → Create App
 *   2. Request permissions: w_member_social, r_liteprofile
 *   3. OAuth2 flow → get access_token
 *   4. GET https://api.linkedin.com/v2/me → copy 'id' → urn:li:person:{id}
 *
 * Endpoints:
 *   POST /trigger            — moment-engine webhook
 *   POST /post/match-analysis — professional match analysis post
 *   POST /post/ai-insight    — AI prediction/data insight post
 *   POST /post/sweepstake    — corporate sweepstake promotion
 *   POST /post/custom        — any custom text
 *   GET  /posts              — list of published posts
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const LI_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || '';
const LI_PERSON_URN   = process.env.LINKEDIN_PERSON_URN  || ''; // urn:li:person:xxxxx
const LI_ORG_URN      = process.env.LINKEDIN_ORG_URN     || ''; // urn:li:organization:xxxxx (optional)
const VERCEL_URL      = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const API_SERVER_URL  = process.env.API_SERVER_URL        || 'http://localhost:3001';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET       || '';

const POSTS_FILE = path.join(__dirname, 'linkedin-posts.json');
let postCount    = 0;

// ─── LinkedIn UGC Post API ────────────────────────────────────────────────────

async function linkedInPost(text, { articleUrl = null, articleTitle = null, articleDesc = null } = {}) {
  if (!LI_ACCESS_TOKEN || !LI_PERSON_URN) {
    throw new Error('LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN not configured');
  }

  const authorUrn = LI_ORG_URN || LI_PERSON_URN;

  const body = {
    author:           authorUrn,
    lifecycleState:   'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: articleUrl ? 'ARTICLE' : 'NONE',
        media: articleUrl ? [{
          status:      'READY',
          description: { text: articleDesc || '' },
          originalUrl: articleUrl,
          title:       { text: articleTitle || 'WC 2026 Live' }
        }] : undefined
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  const r = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    body,
    {
      headers: {
        Authorization:          `Bearer ${LI_ACCESS_TOKEN}`,
        'Content-Type':         'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      timeout: 20000
    }
  );

  postCount++;
  const postId = r.headers['x-restli-id'] || r.data?.id;
  console.log(`[LinkedIn] posted: ${postId} — ${text.slice(0, 60)}…`);

  const posts = fs.existsSync(POSTS_FILE) ? JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')) : [];
  posts.unshift({ postId, text: text.slice(0, 200), publishedAt: new Date().toISOString() });
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts.slice(0, 100), null, 2));

  return postId;
}

// ─── Professional content generation ─────────────────────────────────────────

async function generateLinkedInPost(type, data) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

    let prompt;

  if (type === 'MATCH_ANALYSIS') {
    const { homeTeam, awayTeam, kickoff, prediction } = data;
    const predStr = prediction
      ? `Our AI model: ${homeTeam} ${prediction.homeWinPct}% | Draw ${prediction.drawPct}% | ${awayTeam} ${prediction.awayWinPct}%`
      : '';
    prompt = `Write a professional LinkedIn post about the upcoming 2026 FIFA World Cup match: ${homeTeam} vs ${awayTeam}.

Angle: professional sports analytics / business perspective
Tone: intelligent, data-focused, thought-leadership
Include: tactical/strategic insight, what this match means for the tournament
${predStr}
End with: call to action to check AI predictions at ${VERCEL_URL}
Length: 150-200 words
Format: 2-3 short paragraphs, no bullet points, professional but engaging
Add 3-4 relevant hashtags at the end`;
  } else if (type === 'AI_INSIGHT') {
    const { homeTeam, awayTeam, prediction } = data;
    prompt = `Write a LinkedIn post showcasing AI-powered football prediction for WC 2026.
Match: ${homeTeam} vs ${awayTeam}
Data: ${homeTeam} ${prediction.homeWinPct}% | Draw ${prediction.drawPct}% | ${awayTeam} ${prediction.awayWinPct}%
Key factor: ${prediction.keyFactor || 'Tournament form and recent results'}

Angle: how AI/machine learning is transforming sports prediction
Make it credible, professional, interesting for tech and sports business audience
150 words max. End with link: ${VERCEL_URL}/predictions.html
Add hashtags: #AI #MachineLearning #WC2026 #SportsTech`;
  } else if (type === 'SWEEPSTAKE_PROMO') {
    prompt = `Write a professional LinkedIn post promoting a WC 2026 office sweepstake platform.
Product: AI-powered corporate WC2026 sweepstake manager
Benefits: free to set up, auto-updates scores, AI predictions built in, 32 teams, custom prizes
Target: HR managers, event organizers, company social committees
Tone: professional but fun
150 words. Link: ${VERCEL_URL}/sweepstake.html
Hashtags: #WC2026 #OfficePool #Sweepstake #TeamBuilding`;
  } else if (type === 'TOURNAMENT_BRIEFING') {
    const today = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
    prompt = `Write a brief professional LinkedIn WC 2026 tournament briefing for ${today}.
Angle: "5 things to know today" — suitable for busy professionals
Concise, bullet-style, 120 words max
End with: Full coverage at ${VERCEL_URL}
Hashtags: #WC2026 #WorldCup2026 #Football #SportsBusiness`;
  }

  return await groqClient.complete({ engine: 'linkedin-post-engine', eventType, messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0.7 }) || '';
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  // LinkedIn: only post for match end (not every goal — too spammy for professional audience)
  try {
    if (eventType === 'MATCH_END') {
      const { homeTeam, awayTeam, homeScore, awayScore, result } = data;
      const winner = result === 'home_win' ? homeTeam : result === 'away_win' ? awayTeam : null;
      const text = [
        `🏁 WC 2026 Result: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
        winner ? `${winner} advance!` : "Teams share the points.",
        ``,
        `Tournament implications, updated standings, and AI predictions for upcoming matches: ${VERCEL_URL}`,
        ``,
        `#WC2026 #WorldCup2026 #Football #FIFA`
      ].join('\n');
      const postId = await linkedInPost(text);
      return res.json({ ok: true, postId });
    }
    res.json({ ok: true, skipped: true, reason: 'LinkedIn only posts match results' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/match-analysis', auth, async (req, res) => {
  try {
    const text = await generateLinkedInPost('MATCH_ANALYSIS', req.body);
    const postId = await linkedInPost(text, {
      articleUrl:   `${VERCEL_URL}/predictions.html`,
      articleTitle: `WC 2026 AI Predictions — ${req.body.homeTeam} vs ${req.body.awayTeam}`,
      articleDesc:  'AI-powered match analysis and predictions for the 2026 FIFA World Cup'
    });
    res.json({ ok: true, postId, textPreview: text.slice(0, 150) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/ai-insight', auth, async (req, res) => {
  try {
    const text = await generateLinkedInPost('AI_INSIGHT', req.body);
    const postId = await linkedInPost(text);
    res.json({ ok: true, postId, textPreview: text.slice(0, 150) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/sweepstake', auth, async (req, res) => {
  try {
    const text = await generateLinkedInPost('SWEEPSTAKE_PROMO', {});
    const postId = await linkedInPost(text, {
      articleUrl:   `${VERCEL_URL}/sweepstake.html`,
      articleTitle: 'WC 2026 Office Sweepstake — Free AI-Powered Platform',
      articleDesc:  'Set up your office WC 2026 sweepstake in minutes. Auto-scoring, AI predictions, 32 teams.'
    });
    res.json({ ok: true, postId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/briefing', auth, async (req, res) => {
  try {
    const text = await generateLinkedInPost('TOURNAMENT_BRIEFING', {});
    const postId = await linkedInPost(text);
    res.json({ ok: true, postId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/post/custom', auth, async (req, res) => {
  try {
    const { text, articleUrl, articleTitle, articleDesc } = req.body;
    if (!text) return res.status(400).json({ ok: false, error: 'text required' });
    const postId = await linkedInPost(text, { articleUrl, articleTitle, articleDesc });
    res.json({ ok: true, postId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/posts', (req, res) => {
  const posts = fs.existsSync(POSTS_FILE) ? JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')) : [];
  res.json({ ok: true, count: posts.length, posts: posts.slice(0, 20) });
});

app.get('/status', (req, res) => {
  res.json({
    ok:              true,
    service:         'linkedin-post-engine',
    configured:      !!(LI_ACCESS_TOKEN && LI_PERSON_URN),
    personUrn:       LI_PERSON_URN || 'not configured',
    orgUrn:          LI_ORG_URN   || 'not configured (personal profile will be used)',
    postsThisSession: postCount,
    strategy:        'Post match results, AI insights, sweepstake promos, tournament briefings'
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.LINKEDIN_PORT || process.env.PORT || 3015;
  app.listen(PORT, () => console.log(`[LinkedIn Engine] listening on :${PORT}`));

  if (!LI_ACCESS_TOKEN) console.warn('[LinkedIn] LINKEDIN_ACCESS_TOKEN not set — posts will fail');

  // Daily tournament briefing at 08:00 UTC (morning professional audience)
  cron.schedule('0 8 * * *', async () => {
    try {
      const text = await generateLinkedInPost('TOURNAMENT_BRIEFING', {});
      await linkedInPost(text);
      console.log('[LinkedIn] daily briefing posted');
    } catch (e) {
      console.error('[LinkedIn] daily briefing failed:', e.message);
    }
  });

  // Weekly sweepstake promo (Mondays, early morning)
  cron.schedule('0 7 * * 1', async () => {
    try {
      const text = await generateLinkedInPost('SWEEPSTAKE_PROMO', {});
      await linkedInPost(text, {
        articleUrl:   `${VERCEL_URL}/sweepstake.html`,
        articleTitle: 'WC 2026 Corporate Sweepstake — Free',
        articleDesc:  'Free WC 2026 office sweepstake with AI predictions'
      });
      console.log('[LinkedIn] sweepstake post published');
    } catch (e) {
      console.error('[LinkedIn] sweepstake post failed:', e.message);
    }
  });

  console.log(`[LinkedIn Engine] running
  Daily briefing: 08:00 UTC
  Weekly sweepstake: Mondays 07:00 UTC
  Match results: via /trigger
  `);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
