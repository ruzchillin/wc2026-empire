/**
 * WC 2026 Sports Empire — OG Image Generator
 * ===========================================
 * Generates Open Graph images for social sharing previews.
 * Uses @napi-rs/canvas (pure Node.js, no native deps beyond that package).
 *
 * OUTPUT:
 *   public/og-default.png          — default 1200×630 for all pages
 *   public/og-goal.png             — GOAL event share card
 *   public/og-prediction.png       — prediction game promo
 *
 * USAGE:
 *   node og-image-generator.js
 *   node og-image-generator.js --page=leaderboard   (generate page-specific card)
 *
 * INSTALL:
 *   npm install @napi-rs/canvas
 *
 * HOW OG IMAGES WORK:
 *   When someone shares wc2026live.vercel.app/leaderboard on WhatsApp/Twitter,
 *   those platforms fetch the og:image URL and display it as a preview card.
 *   1200×630px is the standard size. Without it, share previews are blank.
 *   After running this, all 61 pages will show branded WC 2026 cards on share.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(process.cwd(), 'public');
const W = 1200;
const H = 630;

// ─── Color palette ────────────────────────────────────────────────────────────

const COLORS = {
  deepBlue:    '#0a0e27',   // dark navy background
  midBlue:     '#1a2456',   // mid layer
  gold:        '#FFD700',   // WC trophy gold
  lightGold:   '#FFF4A0',
  white:       '#FFFFFF',
  offWhite:    '#E8EAED',
  green:       '#2ECC71',
  red:         '#E74C3C',
  glassBorder: 'rgba(255,215,0,0.3)',
};

// ─── Canvas setup ────────────────────────────────────────────────────────────

let createCanvas, loadImage;
try {
  ({ createCanvas, loadImage } = require('@napi-rs/canvas'));
} catch {
  console.error('[og-image-generator] Missing dependency. Run: npm install @napi-rs/canvas');
  process.exit(1);
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawRoundedRect(ctx, x, y, w, h, r) {
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

function drawBackground(ctx) {
  // Deep navy gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,    COLORS.deepBlue);
  bg.addColorStop(0.5,  COLORS.midBlue);
  bg.addColorStop(1,    '#0d1b3e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Diagonal accent stripe
  const stripe = ctx.createLinearGradient(0, 0, W * 0.6, H);
  stripe.addColorStop(0,   'rgba(255,215,0,0.08)');
  stripe.addColorStop(0.5, 'rgba(255,215,0,0.02)');
  stripe.addColorStop(1,   'rgba(255,215,0,0)');
  ctx.fillStyle = stripe;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W * 0.55, 0);
  ctx.lineTo(W * 0.45, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
}

function drawGoldBorder(ctx) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0,   COLORS.gold);
  grad.addColorStop(0.5, COLORS.lightGold);
  grad.addColorStop(1,   COLORS.gold);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 8, 8, W - 16, H - 16, 16);
  ctx.stroke();
}

function drawTrophyEmoji(ctx, x, y, size = 120) {
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏆', x, y);
}

function drawText(ctx, text, x, y, opts = {}) {
  const { size = 48, color = COLORS.white, align = 'left', weight = 'bold', family = 'sans-serif', shadow = false } = opts;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

// ─── Image generators ─────────────────────────────────────────────────────────

async function generateDefault() {
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  drawBackground(ctx);
  drawGoldBorder(ctx);

  // Trophy
  drawTrophyEmoji(ctx, W * 0.82, H * 0.5, 180);

  // Glow behind trophy
  const glow = ctx.createRadialGradient(W * 0.82, H * 0.5, 0, W * 0.82, H * 0.5, 200);
  glow.addColorStop(0,   'rgba(255,215,0,0.15)');
  glow.addColorStop(1,   'rgba(255,215,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(W * 0.55, 0, W * 0.45, H);

  // "WC 2026" label top
  drawText(ctx, 'WC 2026', 80, 60, { size: 28, color: COLORS.gold, align: 'left' });
  drawText(ctx, 'LIVE', 200, 60, {
    size: 24, color: COLORS.deepBlue, align: 'left',
    weight: 'bold',
  });

  // Gold pill behind LIVE
  ctx.fillStyle = COLORS.gold;
  drawRoundedRect(ctx, 188, 44, 72, 32, 8);
  ctx.fill();
  drawText(ctx, 'LIVE', 224, 60, { size: 22, color: COLORS.deepBlue, align: 'center', weight: 'bold' });

  // Main headline
  drawText(ctx, 'World Cup 2026', 80, 200, {
    size: 88, color: COLORS.white, align: 'left', shadow: true,
  });

  // Gold accent line
  const lineGrad = ctx.createLinearGradient(80, 0, 700, 0);
  lineGrad.addColorStop(0,   COLORS.gold);
  lineGrad.addColorStop(0.7, 'rgba(255,215,0,0.2)');
  lineGrad.addColorStop(1,   'transparent');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(80, 265, 620, 4);

  // Tagline
  drawText(ctx, 'Live scores · AI predictions · Real-time alerts', 80, 330, {
    size: 32, color: COLORS.offWhite, align: 'left', weight: 'normal',
  });

  // Feature pills
  const pills = ['⚡ Instant goal alerts', '🤖 AI match analysis', '📊 Live odds'];
  pills.forEach((pill, i) => {
    const px = 80 + i * 240;
    const py = 430;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    drawRoundedRect(ctx, px, py - 20, 220, 42, 21);
    ctx.fill();
    ctx.strokeStyle = COLORS.glassBorder;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, px, py - 20, 220, 42, 21);
    ctx.stroke();
    drawText(ctx, pill, px + 110, py, { size: 22, color: COLORS.offWhite, align: 'center', weight: 'normal' });
  });

  // URL watermark
  drawText(ctx, 'wc2026live.vercel.app', W / 2, H - 42, {
    size: 24, color: 'rgba(255,255,255,0.35)', align: 'center', weight: 'normal',
  });

  return canvas.toBuffer('image/png');
}

async function generateGoalCard(opts = {}) {
  const { player = 'GOAL!', team = '', minute = '', score = '' } = opts;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  drawBackground(ctx);

  // Red flash overlay for goal excitement
  const flash = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  flash.addColorStop(0,   'rgba(255,50,50,0.15)');
  flash.addColorStop(1,   'rgba(255,50,50,0)');
  ctx.fillStyle = flash;
  ctx.fillRect(0, 0, W, H);

  drawGoldBorder(ctx);

  // GOAL text
  ctx.font = 'bold 200px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = 'rgba(255,215,0,0.5)';
  ctx.shadowBlur = 40;
  ctx.fillText('GOAL!', W / 2, H / 2 - 60);
  ctx.shadowBlur = 0;

  // Player name
  if (player) {
    drawText(ctx, player.toUpperCase(), W / 2, H / 2 + 100, {
      size: 64, color: COLORS.white, align: 'center', shadow: true,
    });
  }

  // Score + minute
  if (score || minute) {
    drawText(ctx, `${score ? score + ' · ' : ''}${minute ? minute + "'" : ''}`, W / 2, H / 2 + 170, {
      size: 42, color: COLORS.offWhite, align: 'center', weight: 'normal',
    });
  }

  drawText(ctx, 'wc2026live.vercel.app', W / 2, H - 42, {
    size: 24, color: 'rgba(255,255,255,0.35)', align: 'center', weight: 'normal',
  });

  return canvas.toBuffer('image/png');
}

async function generatePredictionCard() {
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  drawBackground(ctx);
  drawGoldBorder(ctx);
  drawTrophyEmoji(ctx, W * 0.85, H * 0.45, 160);

  drawText(ctx, 'Predict · Compete · Win', 80, 180, {
    size: 52, color: COLORS.gold, align: 'left',
  });

  drawText(ctx, 'WC 2026 Prediction Game', 80, 270, {
    size: 78, color: COLORS.white, align: 'left', shadow: true,
  });

  const lineGrad = ctx.createLinearGradient(80, 0, 700, 0);
  lineGrad.addColorStop(0, COLORS.gold);
  lineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(80, 325, 580, 4);

  drawText(ctx, 'Pick every match. Earn points. Climb the leaderboard.', 80, 390, {
    size: 30, color: COLORS.offWhite, align: 'left', weight: 'normal',
  });

  drawText(ctx, 'Free to play · 64 matches · Daily prizes', 80, 450, {
    size: 26, color: COLORS.gold, align: 'left', weight: 'normal',
  });

  drawText(ctx, 'wc2026live.vercel.app/prediction-game', W / 2, H - 42, {
    size: 24, color: 'rgba(255,255,255,0.35)', align: 'center', weight: 'normal',
  });

  return canvas.toBuffer('image/png');
}

// ─── PWA Icon generator ───────────────────────────────────────────────────────
// manifest.json references /icons/icon-{72,96,128,144,192,512}.png
// Without these files the PWA install prompt never fires and Add to Home Screen breaks.

async function generatePWAIcons() {
  const ICONS_DIR = path.join(OUTPUT_DIR, 'icons');
  if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

  const SIZES = [72, 96, 128, 144, 192, 512];

  for (const size of SIZES) {
    const canvas = createCanvas(size, size);
    const ctx    = canvas.getContext('2d');

    // Background — dark navy circle (maskable-safe: fill entire square)
    ctx.fillStyle = COLORS.deepBlue;
    ctx.fillRect(0, 0, size, size);

    // Gold circle border
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = Math.max(2, size * 0.04);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - ctx.lineWidth, 0, Math.PI * 2);
    ctx.stroke();

    // Trophy emoji centered
    const emojiSize = Math.floor(size * 0.55);
    ctx.font = `${emojiSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', size / 2, size / 2);

    const buf = canvas.toBuffer('image/png');
    const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
    fs.writeFileSync(outPath, buf);
    console.log(`[og-gen] ✅ public/icons/icon-${size}.png`);
  }

  // Also generate apple-touch-icon (180px, no maskable border)
  const apple = createCanvas(180, 180);
  const actx  = apple.getContext('2d');
  actx.fillStyle = COLORS.deepBlue;
  actx.fillRect(0, 0, 180, 180);
  actx.font = '100px serif';
  actx.textAlign = 'center';
  actx.textBaseline = 'middle';
  actx.fillText('🏆', 90, 90);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'apple-touch-icon.png'), apple.toBuffer('image/png'));
  console.log('[og-gen] ✅ public/apple-touch-icon.png');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const arg = process.argv.find(a => a.startsWith('--page='))?.replace('--page=', '');

  if (!arg || arg === 'default') {
    console.log('[og-gen] Generating og-default.png...');
    const buf = await generateDefault();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'og-default.png'), buf);
    console.log(`[og-gen] ✅ public/og-default.png (${(buf.length / 1024).toFixed(0)}KB)`);
  }

  if (!arg || arg === 'goal') {
    console.log('[og-gen] Generating og-goal.png...');
    const buf = await generateGoalCard({ player: 'Mbappe', minute: '23', score: '1-0' });
    fs.writeFileSync(path.join(OUTPUT_DIR, 'og-goal.png'), buf);
    console.log('[og-gen] ✅ public/og-goal.png');
  }

  if (!arg || arg === 'prediction') {
    console.log('[og-gen] Generating og-prediction.png...');
    const buf = await generatePredictionCard();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'og-prediction.png'), buf);
    console.log('[og-gen] ✅ public/og-prediction.png');
  }

  if (!arg || arg === 'icons') {
    console.log('[og-gen] Generating PWA icons...');
    await generatePWAIcons();
  }

  console.log('\n[og-gen] All images generated.');
  console.log('Run npm run og:images after any branding change.');
}

main().catch(e => { console.error('[og-gen]', e.message); process.exit(1); });
