/**
 * merchandise-engine.js
 * Printful + Redbubble auto-product generation
 *
 * On UPSET / ELIMINATION / HAT_TRICK events:
 *   - Auto-generates product text/design brief
 *   - Creates product on Printful (if API configured) 
 *   - Posts buy links to social channels via telegram-engine
 *   - Every eliminated team gets a "Remember When..." shirt
 *   - Every hat-trick gets a player tribute mug/tee
 *
 * Zero inventory. Orders are printed and shipped by Printful.
 * You earn margin on each sale automatically.
 *
 * Required env:
 *   PRINTFUL_API_KEY     — from printful.com/dashboard/store/api
 *   PRINTFUL_STORE_ID    — your Printful store ID
 *   REDBUBBLE_ARTIST_URL — your Redbubble shop URL (for manual uploads)
 *
 * Port: 3044
 */
'use strict';
require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const groqClient = require('./groq-client');

const PRINTFUL_KEY   = process.env.PRINTFUL_API_KEY   || '';
const STORE_ID       = process.env.PRINTFUL_STORE_ID  || '';
const PIPELINE_SECRET = process.env.PIPELINE_SECRET   || '';
const PORT           = process.env.MERCH_ENGINE_PORT || process.env.PORT || 3044;
const SITE_URL       = process.env.SITE_URL || 'https://wc2026picks.com';
const TELEGRAM_URL   = process.env.TELEGRAM_ENGINE_URL || 'http://localhost:3029';

const PRINTFUL_API = 'https://api.printful.com';
const productLog   = [];

const app = express();
app.use(express.json());
function auth(req, res, next) {
  if (req.method === 'GET') return next();
  const t = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && t !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
app.use(auth);

// ─── Product text generation ──────────────────────────────────────────────────
async function generateProductCopy(eventType, payload) {
  const { homeTeam, awayTeam, player, homeScore, awayScore } = payload;

  const prompts = {
    ELIMINATION: `WC 2026: ${payload.team || awayTeam} just got eliminated. Write:
1. T-shirt slogan (max 8 words, funny/nostalgic)
2. Product title (max 60 chars)
3. Product description (max 150 chars)
Format as JSON: {"slogan":"...","title":"...","description":"..."}`,

    HAT_TRICK: `${player||'Player'} just scored a hat-trick at WC 2026 (${homeTeam} vs ${awayTeam}). Write:
1. T-shirt slogan celebrating this (max 8 words)
2. Product title (max 60 chars)  
3. Product description (max 150 chars)
Format as JSON: {"slogan":"...","title":"...","description":"..."}`,

    UPSET: `SHOCK: ${homeTeam} beat ${awayTeam} ${homeScore}-${awayScore} at WC 2026. Write:
1. Commemorative shirt slogan (max 8 words)
2. Product title (max 60 chars)
3. Product description (max 150 chars)
Format as JSON: {"slogan":"...","title":"...","description":"..."}`,
  };

  const prompt = prompts[eventType];
  if (!prompt) return null;

  try {
    const raw = await groqClient.complete({
      engine: 'merchandise-engine', eventType,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200, temperature: 0.85,
      response_format: { type: 'json_object' },
    });
    return JSON.parse(raw);
  } catch {
    const defaults = {
      ELIMINATION: { slogan: `${payload.team||awayTeam}: Gone But Not Forgotten`, title: `${payload.team||awayTeam} WC 2026 Elimination Tee`, description: `Commemorate ${payload.team||awayTeam}'s WC 2026 journey` },
      HAT_TRICK:   { slogan: `${player||'Legend'} Hat-Trick Hero WC 2026`, title: `${player||'Hat-Trick'} WC 2026 Hat-Trick Tee`, description: `Celebrate the magic moment at WC 2026` },
      UPSET:       { slogan: `${homeTeam} Shocked The World`, title: `${homeTeam} vs ${awayTeam} WC 2026 Upset Tee`, description: `The day ${homeTeam} shocked everyone` },
    };
    return defaults[eventType] || null;
  }
}

async function createPrintfulProduct(copy, eventType) {
  if (!PRINTFUL_KEY || !STORE_ID) {
    return { mock: true, message: 'Printful not configured — set PRINTFUL_API_KEY + PRINTFUL_STORE_ID', copy };
  }

  // Create a simple text-based product
  const product = {
    sync_product: {
      name: copy.title,
      thumbnail: `${SITE_URL}/og-default.png`,
    },
    sync_variants: [
      // Unisex t-shirt — Printful variant ID 1 = Gildan 64000
      { variant_id: 4011, retail_price: '24.99', files: [{ type: 'front', url: `${SITE_URL}/og-default.png` }] },
      { variant_id: 4012, retail_price: '24.99', files: [{ type: 'front', url: `${SITE_URL}/og-default.png` }] },
      { variant_id: 4013, retail_price: '24.99', files: [{ type: 'front', url: `${SITE_URL}/og-default.png` }] },
    ],
  };

  const res = await axios.post(`${PRINTFUL_API}/store/products`,
    product,
    { headers: { Authorization: `Bearer ${PRINTFUL_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  return res.data.result;
}

async function announceMerch(copy, eventType, payload) {
  try {
    const msg = `🛍️ NEW MERCH JUST DROPPED!\n\n"${copy.slogan}"\n\n${copy.description}\n\n👕 Get it: ${SITE_URL}/merch\n\nLimited WC 2026 collectible — grab it before the tournament ends!`;
    await axios.post(`${TELEGRAM_URL}/broadcast`,
      { message: msg, channels: ['main'] },
      { headers: { 'x-pipeline-secret': PIPELINE_SECRET }, timeout: 8000 }
    );
  } catch(e) {
    console.warn('[Merch] Telegram announce failed:', e.message);
  }
}

app.post('/trigger', async (req, res) => {
  const { eventType, ...payload } = req.body || {};
  const MERCH_EVENTS = ['ELIMINATION', 'HAT_TRICK', 'UPSET'];
  if (!MERCH_EVENTS.includes(eventType)) {
    return res.json({ ok: true, service: 'merchandise-engine', action: 'skipped' });
  }

  try {
    const copy = await generateProductCopy(eventType, payload);
    if (!copy) return res.json({ ok: true, action: 'no copy generated' });

    const product = await createPrintfulProduct(copy, eventType);
    await announceMerch(copy, eventType, payload);

    productLog.unshift({ eventType, title: copy.title, slogan: copy.slogan, product, timestamp: new Date().toISOString() });
    if (productLog.length > 50) productLog.length = 50;

    console.log(`[Merch] Product created: ${copy.title}`);
    res.json({ ok: true, service: 'merchandise-engine', copy, product });
  } catch(e) {
    console.error('[Merch] failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/products', (req, res) => res.json({ ok: true, products: productLog }));
app.get('/status',   (req, res) => res.json({ ok: true, service: 'merchandise-engine', configured: !!PRINTFUL_KEY, productsCreated: productLog.length, events: ['ELIMINATION','HAT_TRICK','UPSET'] }));
app.get('/health',   (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[Merchandise Engine] listening on :${PORT}`);
  if (!PRINTFUL_KEY) console.warn('[Merch] PRINTFUL_API_KEY not set — set up at printful.com (free to join)');
});
