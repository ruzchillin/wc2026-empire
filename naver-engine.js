/**
 * WC 2026 Sports Empire — Naver Engine (Korea)
 * Deploy on Railway.app as service "naver-engine"
 *
 * Posts to Naver Blog (Korea's dominant search/blog platform, 35M MAU).
 * Korea is in WC2026 Group stage — massive domestic audience.
 * Naver Blog posts rank extremely well in Korean search (Naver = 70% Korea search share).
 *
 * Content strategy:
 *   - Korean match previews + AI analysis
 *   - KNT (Korean national team) specific updates
 *   - Tournament bracket + standings in Korean
 *
 * Required env vars:
 *   NAVER_CLIENT_ID      — from developers.naver.com -> Application
 *   NAVER_CLIENT_SECRET  — from developers.naver.com -> Application
 *   NAVER_ACCESS_TOKEN   — OAuth2 token (via Naver Login API)
 *   NAVER_BLOG_ID        — your Naver blog ID (e.g. wc2026live)
 *   GROQ_API_KEY         — for Korean content generation
 *   API_SERVER_URL       — for match data
 *   PIPELINE_SECRET      — shared inter-service secret
 *
 * Naver Blog API docs: https://developers.naver.com/docs/blog/post/
 *
 * Alternative (no API): Engine also generates HTML files of Korean blog posts
 * that can be manually copy-pasted to Naver Blog editor.
 *
 * Endpoints:
 *   POST /trigger            — moment-engine webhook
 *   POST /blog/post          — publish a blog post
 *   POST /blog/preview       — generate match preview (Korean)
 *   GET  /posts              — list published posts
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const express = require('express');
const cron    = require('node-cron');

const NAVER_CLIENT_ID     = process.env.NAVER_CLIENT_ID     || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const NAVER_ACCESS_TOKEN  = process.env.NAVER_ACCESS_TOKEN  || '';
const NAVER_BLOG_ID       = process.env.NAVER_BLOG_ID       || '';
const API_SERVER_URL      = process.env.API_SERVER_URL      || 'http://localhost:3001';
const PIPELINE_SECRET     = process.env.PIPELINE_SECRET     || '';

const POSTS_FILE = path.join(__dirname, 'naver-posts.json');
const POSTS_DIR  = path.join(__dirname, 'naver-posts');
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

// ─── Korean content generation via Groq ───────────────────────────────────────

async function generateKoreanContent(type, data) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

  
  let prompt;
  let subject;

  if (type === 'MATCH_PREVIEW') {
    const { homeTeam, awayTeam, kickoff, venue, prediction } = data;
    const timeKST = new Date(kickoff);
    timeKST.setHours(timeKST.getHours() + 9); // UTC+9
    const kstStr = `${timeKST.getHours()}:${String(timeKST.getMinutes()).padStart(2,'0')} KST`;
    const predStr = prediction ? `AI 예측: ${homeTeam} 승리 ${prediction.homeWinPct}%, 무승부 ${prediction.drawPct}%, ${awayTeam} 승리 ${prediction.awayWinPct}%` : '';
    subject = `[2026 월드컵] ${homeTeam} vs ${awayTeam} — 프리뷰 및 예측`;
    prompt = `2026 FIFA 월드컵 경기 프리뷰를 한국어로 작성해주세요.

경기: ${homeTeam} vs ${awayTeam}
킥오프: ${kstStr}
경기장: ${venue || 'TBD'}
${predStr}

내용 구성:
1. 경기 소개 및 대진 맥락 (2-3문장)
2. 주요 선수 소개 (각 팀 1-2명)
3. 전술 분석 (2-3문장)
4. AI 예측 및 예상 스코어
5. 결론

네이버 블로그 스타일로 자연스럽고 흥미롭게 작성해주세요.
300-400자 내외. 마크다운 사용 금지.`;
  } else if (type === 'GOAL_ALERT') {
    const { homeTeam, awayTeam, homeScore, awayScore, minute, player } = data;
    subject = `⚽ 골! ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} (${minute}분)`;
    prompt = `2026 월드컵 골 알림 뉴스를 한국어로 작성해주세요.
골 정보: ${player || '선수'} 득점 — ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} (${minute}분)
150자 내외 속보 스타일로 작성해주세요.`;
  } else if (type === 'MATCH_RESULT') {
    const { homeTeam, awayTeam, homeScore, awayScore, result } = data;
    const winner = result === 'home_win' ? homeTeam : result === 'away_win' ? awayTeam : null;
    subject = `[결과] ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} — 2026 월드컵`;
    prompt = `2026 FIFA 월드컵 경기 결과 리포트를 한국어로 작성해주세요.
결과: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}. ${winner ? `${winner} 승리.` : '무승부.'}
200-250자 경기 보고서 스타일. 토너먼트에서의 의미도 언급해주세요.`;
  }

  const content = await groqClient.complete({ engine: 'naver-engine', eventType, messages: [{ role: 'user', content: prompt }], max_tokens: 600, temperature: 0.7 }) || '';
  return { subject, content };
}

// ─── Naver Blog API ───────────────────────────────────────────────────────────

async function publishToNaverBlog(subject, content, tags = []) {
  if (!NAVER_ACCESS_TOKEN || !NAVER_BLOG_ID) {
    console.log('[Naver] API not configured — saving as file');
    return null;
  }

  const r = await axios.post(
    'https://openapi.naver.com/blog/writePost.json',
    new URLSearchParams({
      blogId:   NAVER_BLOG_ID,
      title:    subject,
      contents: content,
      tag:      tags.join(','),
      publicYn: 'Y'
    }).toString(),
    {
      headers: {
        Authorization:  `Bearer ${NAVER_ACCESS_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      timeout: 20000
    }
  );

  console.log(`[Naver Blog] published: ${r.data?.result?.logNo}`);
  return r.data?.result?.logNo;
}

function savePost(type, subject, content, metadata) {
  const filename = `naver-${type.toLowerCase()}-${Date.now()}.html`;
  const filepath = path.join(POSTS_DIR, filename);

  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body>
<h1>${subject}</h1>
<div style="font-size:18px;line-height:1.8;font-family:sans-serif;white-space:pre-wrap;">${content}</div>
<footer style="margin-top:40px;color:#999;font-size:14px;">WC 2026 Live | 2026 FIFA 월드컵</footer>
</body>
</html>`;

  fs.writeFileSync(filepath, html, 'utf8');

  const posts = fs.existsSync(POSTS_FILE)
    ? JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'))
    : [];
  posts.unshift({ type, subject, filename, metadata, createdAt: new Date().toISOString() });
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts.slice(0, 100), null, 2));

  return filepath;
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/posts', express.static(POSTS_DIR));

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

async function publishPost(type, data) {
  const { subject, content } = await generateKoreanContent(type, data);
  const tags = ['2026월드컵', '월드컵2026', '축구', 'WC2026', data.homeTeam, data.awayTeam].filter(Boolean);

  const naverId = await publishToNaverBlog(subject, content, tags).catch(e => {
    console.error('[Naver Blog]', e.message);
    return null;
  });
  const filepath = savePost(type, subject, content, data);

  return { subject, naverId, filepath };
}

app.post('/trigger', auth, async (req, res) => {
  const { eventType, ...data } = req.body;
  try {
    let type;
    if (['GOAL', 'PENALTY_GOAL', 'OWN_GOAL'].includes(eventType)) type = 'GOAL_ALERT';
    else if (eventType === 'MATCH_END') type = 'MATCH_RESULT';
    else return res.json({ ok: true, skipped: true });

    const result = await publishPost(type, data);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/blog/preview', auth, async (req, res) => {
  try {
    const result = await publishPost('MATCH_PREVIEW', req.body);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/blog/post', auth, async (req, res) => {
  try {
    const { type, data } = req.body;
    const result = await publishPost(type, data);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/posts', (req, res) => {
  const posts = fs.existsSync(POSTS_FILE)
    ? JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'))
    : [];
  res.json({ ok: true, count: posts.length, posts: posts.slice(0, 20) });
});

app.get('/status', (req, res) => {
  res.json({
    ok:            true,
    service:       'naver-engine',
    blogId:        NAVER_BLOG_ID || 'not configured',
    apiConfigured: !!(NAVER_ACCESS_TOKEN && NAVER_BLOG_ID),
    market:        'Korea (KR)',
    language:      '한국어 (Korean)',
    searchShare:   'Naver = 70% of Korean web search'
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.NAVER_PORT || process.env.PORT || 3011;
  app.listen(PORT, () => console.log(`[Naver Engine] listening on :${PORT}`));

  if (!NAVER_ACCESS_TOKEN) {
    console.warn('[Naver] API not configured — posts will be saved as HTML files');
  }

  // Daily Korean previews at 07:00 UTC (16:00 KST — peak Korean browsing)
  cron.schedule('0 7 * * *', async () => {
    try {
      const r = await axios.get(`${API_SERVER_URL}/api/v1/matches/today`, { timeout: 15000 });
      const matches = r.data?.matches || r.data?.response || [];
      for (const m of matches) {
        const homeTeam = m.teams?.home?.name || m.homeTeam;
        const awayTeam = m.teams?.away?.name || m.awayTeam;
        if (!homeTeam || !awayTeam) continue;
        await publishPost('MATCH_PREVIEW', {
          homeTeam, awayTeam,
          kickoff: m.fixture?.date,
          venue:   m.fixture?.venue?.name
        });
        await new Promise(r => setTimeout(r, 8000));
      }
    } catch (e) {
      console.error('[Naver] daily preview failed:', e.message);
    }
  });

  console.log('[Naver Engine] running — Korean market (KR)');
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });
