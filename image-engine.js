/**
 * WC 2026 Sports Empire — Image Engine
 * Deploy on Railway.app as service "image-engine"
 *
 * Generates PNG image cards server-side for all social platforms.
 * Uses @napi-rs/canvas (Node.js native Canvas — no browser needed).
 *
 * Card types:
 *   GOAL_CARD        — 1080×1080 square (Instagram/Twitter/Facebook)
 *   SCORE_CARD       — 1080×1080 square (match scoreline)
 *   PREDICTION_CARD  — 1080×1080 square (AI probability bars)
 *   PREVIEW_CARD     — 1080×1080 square (pre-match)
 *   RESULT_CARD      — 1080×1080 square (full time result)
 *   STORY_CARD       — 1080×1920 vertical (Instagram Stories/Snapchat/TikTok)
 *   TWITTER_CARD     — 1200×675 landscape (Twitter/X optimal)
 *   BRACKET_CARD     — 1200×675 landscape (tournament bracket update)
 *
 * All cards are returned as PNG Buffer — caller decides where to save/upload.
 *
 * Required env vars:
 *   PIPELINE_SECRET  — shared inter-service secret
 *
 * Install: npm install @napi-rs/canvas
 *
 * Endpoints:
 *   POST /card/goal        — generate goal card PNG
 *   POST /card/score       — generate score card PNG
 *   POST /card/prediction  — generate AI prediction card PNG
 *   POST /card/preview     — generate match preview card PNG
 *   POST /card/result      — generate full-time result card PNG
 *   POST /card/story       — generate vertical story card PNG
 *   POST /card/twitter     — generate landscape Twitter card PNG
 *   POST /generate         — generate multiple card types at once
 *   GET  /status
 */

'use strict';

require('dotenv').config();
const express = require('express');
const path    = require('path');
const fs      = require('fs');

// Try @napi-rs/canvas, fall back gracefully
let createCanvas, GlobalFonts;
try {
  const napi = require('@napi-rs/canvas');
  createCanvas  = napi.createCanvas;
  GlobalFonts   = napi.GlobalFonts;
  console.log('[ImageEngine] @napi-rs/canvas loaded');
} catch (e) {
  console.warn('[ImageEngine] @napi-rs/canvas not installed — run: npm install @napi-rs/canvas');
  console.warn('[ImageEngine] Image generation will return placeholder responses');
}

const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';
const CACHE_DIR = path.join(__dirname, 'image-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

let cardCount = 0;

// ─── Color system ─────────────────────────────────────────────────────────────

const THEMES = {
  goal:       { bg1: '#0a2400', bg2: '#1a4a00', accent: '#76ff03', text: '#ffffff', badge: '#76ff03' },
  score:      { bg1: '#0a0f2c', bg2: '#1a1f4c', accent: '#6366f1', text: '#ffffff', badge: '#6366f1' },
  prediction: { bg1: '#0d1117', bg2: '#161b22', accent: '#58a6ff', text: '#ffffff', badge: '#58a6ff' },
  preview:    { bg1: '#0a0f2c', bg2: '#1c1f3a', accent: '#FFD700', text: '#ffffff', badge: '#FFD700' },
  result:     { bg1: '#1a0028', bg2: '#2d0045', accent: '#ea80fc', text: '#ffffff', badge: '#ea80fc' },
  redcard:    { bg1: '#2a0000', bg2: '#4a0000', accent: '#ff4444', text: '#ffffff', badge: '#ff4444' },
};

// ─── Canvas helper utilities ──────────────────────────────────────────────────

function drawBackground(ctx, w, h, theme) {
  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, theme.bg1);
  grad.addColorStop(1, theme.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle grid pattern overlay
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function drawBadge(ctx, text, x, y, theme) {
  ctx.font = 'bold 28px Arial';
  const metrics = ctx.measureText(text);
  const pw = metrics.width + 40;
  const ph = 44;
  const px = x - pw / 2;
  const py = y - ph / 2;

  ctx.fillStyle = theme.badge;
  roundRect(ctx, px, py, pw, ph, 22);
  ctx.fill();

  ctx.fillStyle = theme.bg1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawDivider(ctx, y, w, color = 'rgba(255,255,255,0.1)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, y);
  ctx.lineTo(w - 60, y);
  ctx.stroke();
}

function drawBrandMark(ctx, w, h) {
  ctx.font = '22px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('WC2026LIVE.COM', w / 2, h - 30);
}

// ─── GOAL CARD (1080×1080) ────────────────────────────────────────────────────

function drawGoalCard({ homeTeam, awayTeam, homeScore, awayScore, minute, player, team }) {
  if (!createCanvas) return null;
  const [W, H] = [1080, 1080];
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const theme  = THEMES.goal;

  drawBackground(ctx, W, H, theme);

  // Top badge
  drawBadge(ctx, '2026 FIFA WORLD CUP', W / 2, 100, theme);

  // GOAL! text
  ctx.font = 'bold 160px Arial';
  ctx.fillStyle = theme.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GOAL!', W / 2, 280);

  // Ball emoji area
  ctx.font = '100px Arial';
  ctx.fillText('⚽', W / 2, 400);

  drawDivider(ctx, 460, W, theme.accent + '40');

  // Score block
  const scoreText = `${homeScore}  —  ${awayScore}`;
  ctx.font = 'bold 130px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(scoreText, W / 2, 580);

  // Team names
  ctx.font = '48px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const teamW = 380;
  ctx.textAlign = 'right';
  ctx.fillText(homeTeam || '', W / 2 - 60, 680);
  ctx.textAlign = 'left';
  ctx.fillText(awayTeam || '', W / 2 + 60, 680);

  drawDivider(ctx, 730, W);

  // Scorer + minute
  ctx.textAlign = 'center';
  if (player) {
    ctx.font = 'bold 52px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText(`⚽ ${player}`, W / 2, 800);
  }
  ctx.font = '38px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`${minute || '?'}' — ${team || ''}`, W / 2, 860);

  drawBrandMark(ctx, W, H);

  cardCount++;
  return canvas.toBuffer('image/png');
}

// ─── PREDICTION CARD (1080×1080) ──────────────────────────────────────────────

function drawPredictionCard({ homeTeam, awayTeam, homeWinPct, drawPct, awayWinPct, keyFactor, predictedScore }) {
  if (!createCanvas) return null;
  const [W, H] = [1080, 1080];
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const theme  = THEMES.prediction;

  drawBackground(ctx, W, H, theme);

  // Header
  drawBadge(ctx, '🤖 AI PREDICTION', W / 2, 100, theme);

  // Match title
  ctx.font = 'bold 56px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${homeTeam} vs ${awayTeam}`, W / 2, 200);

  ctx.font = '34px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('2026 FIFA World Cup', W / 2, 260);

  drawDivider(ctx, 300, W);

  // Probability bars
  const barData = [
    { label: homeTeam, pct: homeWinPct || 0,  color: '#58a6ff' },
    { label: 'Draw',   pct: drawPct    || 0,  color: '#8b949e' },
    { label: awayTeam, pct: awayWinPct || 0,  color: '#f78166' }
  ];

  const barX = 80, barW = W - 160, barH = 64, gap = 90;
  let barY = 360;

  for (const bar of barData) {
    // Label
    ctx.font = '36px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(bar.label, barX, barY - 20);

    // Percentage
    ctx.textAlign = 'right';
    ctx.fillStyle = bar.color;
    ctx.font = 'bold 36px Arial';
    ctx.fillText(`${bar.pct}%`, W - barX, barY - 20);

    // Background track
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();

    // Filled bar
    const fillW = Math.max((bar.pct / 100) * barW, barH);
    ctx.fillStyle = bar.color;
    roundRect(ctx, barX, barY, fillW, barH, barH / 2);
    ctx.fill();

    barY += gap + barH;
  }

  drawDivider(ctx, barY + 20, W);

  // Key factor
  if (keyFactor) {
    ctx.font = '34px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = keyFactor.split(' ');
    let line = '', lines = [];
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (ctx.measureText(test).width > W - 160) { lines.push(line); line = word; }
      else line = test;
    }
    lines.push(line);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, barY + 70 + i * 44));
  }

  if (predictedScore) {
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.fillText(`Predicted: ${predictedScore}`, W / 2, H - 100);
  }

  drawBrandMark(ctx, W, H);
  cardCount++;
  return canvas.toBuffer('image/png');
}

// ─── PREVIEW CARD (1080×1080) ─────────────────────────────────────────────────

function drawPreviewCard({ homeTeam, awayTeam, kickoffTime, venue, groupStage }) {
  if (!createCanvas) return null;
  const [W, H] = [1080, 1080];
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const theme  = THEMES.preview;

  drawBackground(ctx, W, H, theme);

  drawBadge(ctx, '2026 FIFA WORLD CUP', W / 2, 100, theme);

  ctx.font = 'bold 46px Arial';
  ctx.fillStyle = theme.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MATCH DAY', W / 2, 200);

  drawDivider(ctx, 240, W, theme.accent + '60');

  // Teams
  ctx.font = 'bold 80px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(homeTeam || 'TBD', W / 2, 370);

  ctx.font = '50px Arial';
  ctx.fillStyle = theme.accent;
  ctx.fillText('VS', W / 2, 470);

  ctx.font = 'bold 80px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(awayTeam || 'TBD', W / 2, 570);

  drawDivider(ctx, 630, W);

  // Kickoff + venue
  if (kickoffTime) {
    ctx.font = '44px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText(`⏰ ${kickoffTime}`, W / 2, 720);
  }
  if (venue) {
    ctx.font = '36px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`📍 ${venue}`, W / 2, 790);
  }
  if (groupStage) {
    ctx.font = '34px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(groupStage, W / 2, 850);
  }

  ctx.font = '40px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('Follow for live goals & AI predictions 👇', W / 2, 930);

  drawBrandMark(ctx, W, H);
  cardCount++;
  return canvas.toBuffer('image/png');
}

// ─── RESULT CARD (1080×1080) ──────────────────────────────────────────────────

function drawResultCard({ homeTeam, awayTeam, homeScore, awayScore, result }) {
  if (!createCanvas) return null;
  const [W, H] = [1080, 1080];
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const theme  = THEMES.result;

  drawBackground(ctx, W, H, theme);
  drawBadge(ctx, '2026 FIFA WORLD CUP', W / 2, 100, theme);

  ctx.font = 'bold 56px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FULL TIME', W / 2, 210);

  drawDivider(ctx, 255, W);

  // Score block
  ctx.font = 'bold 180px Arial';
  ctx.fillStyle = theme.accent;
  ctx.fillText(`${homeScore}  ${awayScore}`, W / 2, 450);

  // Dash between
  ctx.font = 'bold 80px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('—', W / 2, 450);

  // Team names
  ctx.font = '52px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(homeTeam || '', W / 2 - 50, 590);
  ctx.textAlign = 'left';
  ctx.fillText(awayTeam || '', W / 2 + 50, 590);

  drawDivider(ctx, 650, W);

  // Winner or draw
  const winner = result === 'home_win' ? homeTeam : result === 'away_win' ? awayTeam : null;
  ctx.textAlign = 'center';
  if (winner) {
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText(`🏆 ${winner} WIN!`, W / 2, 760);
  } else {
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('🤝 DRAW', W / 2, 760);
  }

  ctx.font = '36px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('Full analysis & next round predictions ↓', W / 2, 870);

  drawBrandMark(ctx, W, H);
  cardCount++;
  return canvas.toBuffer('image/png');
}

// ─── STORY CARD (1080×1920 vertical) ─────────────────────────────────────────

function drawStoryCard({ type = 'goal', homeTeam, awayTeam, homeScore, awayScore, minute, player }) {
  if (!createCanvas) return null;
  const [W, H] = [1080, 1920];
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const theme  = type === 'goal' ? THEMES.goal : type === 'result' ? THEMES.result : THEMES.preview;

  drawBackground(ctx, W, H, theme);

  // Top badge — centered vertically at 1/4 height
  drawBadge(ctx, '2026 FIFA WORLD CUP 🏆', W / 2, 200, theme);

  if (type === 'goal') {
    ctx.font = 'bold 220px Arial';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚽', W / 2, 600);

    ctx.font = 'bold 140px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('GOAL!', W / 2, 800);

    ctx.font = 'bold 140px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText(`${homeScore} — ${awayScore}`, W / 2, 1000);

    ctx.font = '60px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`${homeTeam}  vs  ${awayTeam}`, W / 2, 1120);

    if (player) {
      ctx.font = 'bold 64px Arial';
      ctx.fillStyle = theme.accent;
      ctx.fillText(player, W / 2, 1260);
    }
    ctx.font = '52px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`${minute || '?'}' minute`, W / 2, 1350);
  } else {
    ctx.font = 'bold 100px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(homeTeam || 'TBD', W / 2, 700);
    ctx.font = '80px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText('VS', W / 2, 840);
    ctx.font = 'bold 100px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(awayTeam || 'TBD', W / 2, 980);
  }

  ctx.font = '48px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('WC2026LIVE.COM', W / 2, H - 80);

  cardCount++;
  return canvas.toBuffer('image/png');
}

// ─── TWITTER CARD (1200×675 landscape) ───────────────────────────────────────

function drawTwitterCard({ homeTeam, awayTeam, homeScore, awayScore, type = 'score', title, subtitle }) {
  if (!createCanvas) return null;
  const [W, H] = [1200, 675];
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const theme  = THEMES.score;

  drawBackground(ctx, W, H, theme);

  // Left accent bar
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, 8, H);

  // Badge top-left
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = theme.accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('2026 FIFA WORLD CUP', 40, 40);

  // Main content
  if (homeTeam && awayTeam) {
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scoreStr = homeScore !== undefined ? `${homeScore}  —  ${awayScore}` : 'vs';
    ctx.fillText(scoreStr, W / 2, H / 2 - 20);

    ctx.font = '40px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`${homeTeam}  ·  ${awayTeam}`, W / 2, H / 2 + 70);
  } else if (title) {
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, W / 2, H / 2 - 20);
    if (subtitle) {
      ctx.font = '38px Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(subtitle, W / 2, H / 2 + 60);
    }
  }

  ctx.font = '22px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('WC2026LIVE.COM', W - 30, H - 20);

  cardCount++;
  return canvas.toBuffer('image/png');
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '1mb' }));

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

function sendPNG(res, buffer, filename) {
  if (!buffer) {
    return res.status(503).json({ ok: false, error: '@napi-rs/canvas not installed. Run: npm install @napi-rs/canvas' });
  }
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="${filename || 'card.png'}"`);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.send(buffer);
}

app.post('/card/goal', auth, (req, res) => {
  try { sendPNG(res, drawGoalCard(req.body), 'goal.png'); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/card/prediction', auth, (req, res) => {
  try { sendPNG(res, drawPredictionCard(req.body), 'prediction.png'); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/card/preview', auth, (req, res) => {
  try { sendPNG(res, drawPreviewCard(req.body), 'preview.png'); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/card/result', auth, (req, res) => {
  try { sendPNG(res, drawResultCard(req.body), 'result.png'); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/card/story', auth, (req, res) => {
  try { sendPNG(res, drawStoryCard(req.body), 'story.png'); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/card/twitter', auth, (req, res) => {
  try { sendPNG(res, drawTwitterCard(req.body), 'twitter.png'); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Generate all card types at once — returns JSON with base64-encoded PNGs
app.post('/generate', auth, (req, res) => {
  const data = req.body;
  try {
    const cards = {};
    const types = data.types || ['goal', 'story', 'twitter'];

    if (types.includes('goal') && data.homeScore !== undefined) {
      const buf = drawGoalCard(data);
      if (buf) cards.goal = buf.toString('base64');
    }
    if (types.includes('prediction') && data.homeWinPct !== undefined) {
      const buf = drawPredictionCard(data);
      if (buf) cards.prediction = buf.toString('base64');
    }
    if (types.includes('preview')) {
      const buf = drawPreviewCard(data);
      if (buf) cards.preview = buf.toString('base64');
    }
    if (types.includes('result') && data.result) {
      const buf = drawResultCard(data);
      if (buf) cards.result = buf.toString('base64');
    }
    if (types.includes('story')) {
      const buf = drawStoryCard(data);
      if (buf) cards.story = buf.toString('base64');
    }
    if (types.includes('twitter')) {
      const buf = drawTwitterCard(data);
      if (buf) cards.twitter = buf.toString('base64');
    }

    res.json({ ok: true, cards, encoding: 'base64', totalGenerated: Object.keys(cards).length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/status', (req, res) => {
  res.json({
    ok:          true,
    service:     'image-engine',
    canvasReady: !!createCanvas,
    cardCount,
    cardTypes:   ['goal', 'prediction', 'preview', 'result', 'story', 'twitter'],
    sizes:       {
      square:  '1080×1080 (Instagram/Twitter/Facebook)',
      story:   '1080×1920 (Instagram Stories/TikTok/Snapchat)',
      twitter: '1200×675 (Twitter/X landscape)'
    },
    installNote: createCanvas ? null : 'Run: npm install @napi-rs/canvas'
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const PORT = process.env.IMAGE_PORT || process.env.PORT || 3016;
  app.listen(PORT, () => console.log(`[Image Engine] listening on :${PORT}`));

  if (!createCanvas) {
    console.warn('[ImageEngine] ⚠️  Run: npm install @napi-rs/canvas');
  } else {
    // Warm-up test
    const testBuf = drawGoalCard({ homeTeam: 'Brazil', awayTeam: 'Argentina', homeScore: 1, awayScore: 0, minute: 45, player: 'Vinicius Jr', team: 'Brazil' });
    console.log(`[Image Engine] ✅ canvas ready — test card: ${testBuf ? Math.round(testBuf.length / 1024) + 'KB' : 'failed'}`);
  }

  console.log(`[Image Engine] running on :${PORT}`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });

// Export drawing functions for use by other engines
module.exports = { drawGoalCard, drawPredictionCard, drawPreviewCard, drawResultCard, drawStoryCard, drawTwitterCard };
