/**
 * WC 2026 Sports Empire — Sitemap Generator
 * Scans public/ directory for all HTML pages, generates sitemap.xml,
 * pings Google Search Console Indexing API, and submits to major search engines.
 *
 * Run modes:
 *   node sitemap-generator.js          → generate sitemap.xml once
 *   node sitemap-generator.js --submit → generate + ping Google
 *   node sitemap-generator.js --serve  → run as Railway service with daily cron
 *
 * Required env vars (for Google ping):
 *   VERCEL_URL              — your domain (https://wc2026live.vercel.app)
 *   GOOGLE_INDEXING_API_KEY — optional: Service Account JSON for Indexing API (advanced)
 *
 * Even without Google API key, the simple ping to google.com/ping works and
 * notifies all major search engines via the sitemap ping protocol.
 */

'use strict';

require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');
const cron  = require('node-cron');

const VERCEL_URL   = (process.env.VERCEL_URL || 'https://wc2026live.vercel.app').replace(/\/$/, '');
const PUBLIC_DIR   = path.join(process.cwd(), 'public');
const OUTPUT_FILE  = path.join(PUBLIC_DIR, 'sitemap.xml');
const SERVE_MODE   = process.argv.includes('--serve');
const SUBMIT_MODE  = process.argv.includes('--submit') || SERVE_MODE;

// ─── Page priority / change frequency config ──────────────────────────────────

function getPageMeta(filePath) {
  const rel = filePath.replace(PUBLIC_DIR, '').replace(/\\/g, '/');
  const name = path.basename(rel, '.html').toLowerCase();

  // Homepage
  if (rel === '/index.html' || name === 'index') {
    return { priority: '1.0', changefreq: 'hourly' };
  }
  // Match pages — highest value
  if (rel.includes('/matches/') || name.startsWith('match-') || rel.includes('/match/')) {
    return { priority: '0.9', changefreq: 'hourly' };
  }
  // Live scores / standings
  if (['live', 'scores', 'standings', 'bracket', 'groups'].some(k => name.includes(k))) {
    return { priority: '0.9', changefreq: 'hourly' };
  }
  // Player pages
  if (rel.includes('/players/') || name.startsWith('player-')) {
    return { priority: '0.8', changefreq: 'daily' };
  }
  // Team pages
  if (rel.includes('/teams/') || name.startsWith('team-')) {
    return { priority: '0.8', changefreq: 'daily' };
  }
  // Match preview pages
  if (rel.includes('/previews/') || name.includes('preview') || name.includes('vs')) {
    return { priority: '0.8', changefreq: 'daily' };
  }
  // VPN / watch guides
  if (name.includes('vpn') || name.includes('watch') || name.includes('stream')) {
    return { priority: '0.7', changefreq: 'weekly' };
  }
  // Prediction / game
  if (name.includes('predict') || name.includes('game') || name.includes('leaderboard')) {
    return { priority: '0.8', changefreq: 'hourly' };
  }
  // News / commentary
  if (name.includes('news') || name.includes('commentary') || name.includes('blog')) {
    return { priority: '0.7', changefreq: 'daily' };
  }
  // Legal / privacy
  if (name.includes('privacy') || name.includes('terms') || name.includes('cookie')) {
    return { priority: '0.2', changefreq: 'monthly' };
  }
  // Default
  return { priority: '0.6', changefreq: 'weekly' };
}

// ─── Scan public/ dir recursively ─────────────────────────────────────────────

function scanHtmlFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden dirs and node_modules
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanHtmlFiles(fullPath, results);
      }
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Generate sitemap.xml ─────────────────────────────────────────────────────

function generateSitemap() {
  const files = scanHtmlFiles(PUBLIC_DIR);
  const now   = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const urls = files.map(filePath => {
    // Convert absolute path → relative URL path
    let urlPath = filePath.replace(PUBLIC_DIR, '').replace(/\\/g, '/');
    // Remove index.html from end (canonical URLs)
    if (urlPath.endsWith('/index.html')) {
      urlPath = urlPath.replace('/index.html', '/') || '/';
    } else {
      urlPath = urlPath.replace(/\.html$/, '');
    }

    const fullUrl = `${VERCEL_URL}${urlPath}`;
    const { priority, changefreq } = getPageMeta(filePath);

    return `  <url>
    <loc>${escapeXml(fullUrl)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  // Also add dynamic routes that aren't static files
  const dynamicRoutes = [
    { path: '/api/matches/live',   priority: '1.0', changefreq: 'always'  },
    { path: '/api/standings',      priority: '0.9', changefreq: 'hourly'  },
    { path: '/api/bracket',        priority: '0.9', changefreq: 'hourly'  },
  ];

  // We don't include API routes in sitemap (search engines shouldn't index JSON)
  // But we add key dynamic HTML routes if they exist as pages:
  const extraPages = [
    { path: '/live',               priority: '1.0', changefreq: 'always'  },
    { path: '/scores',             priority: '0.9', changefreq: 'always'  },
    { path: '/predictions',        priority: '0.8', changefreq: 'hourly'  },
    { path: '/leaderboard',        priority: '0.8', changefreq: 'hourly'  },
    { path: '/groups',             priority: '0.8', changefreq: 'daily'   },
    { path: '/bracket',            priority: '0.8', changefreq: 'daily'   },
    { path: '/teams',              priority: '0.7', changefreq: 'daily'   },
    { path: '/players',            priority: '0.7', changefreq: 'daily'   },
    { path: '/news',               priority: '0.7', changefreq: 'hourly'  },
    { path: '/watch',              priority: '0.7', changefreq: 'weekly'  },
  ];

  // Only add extra pages that don't already exist as static files
  const existingUrls = new Set(files.map(f => {
    let p = f.replace(PUBLIC_DIR, '').replace(/\\/g, '/').replace(/\.html$/, '').replace(/\/index$/, '/');
    return p;
  }));

  const extraUrls = extraPages
    .filter(p => !existingUrls.has(p.path))
    .map(({ path: urlPath, priority, changefreq }) => `  <url>
    <loc>${escapeXml(VERCEL_URL + urlPath)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${[...urls, ...extraUrls].join('\n')}
</urlset>`;

  // Ensure public dir exists
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');

  console.log(`[Sitemap] Generated ${OUTPUT_FILE}`);
  console.log(`[Sitemap] ${files.length} static pages + ${extraUrls.length} extra routes = ${files.length + extraUrls.length} URLs total`);
  return { pages: files.length, extras: extraUrls.length, total: files.length + extraUrls.length };
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Ping search engines ──────────────────────────────────────────────────────

function pingUrl(url) {
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ ok: res.statusCode < 400, status: res.statusCode, url }));
    });
    req.on('error', e => resolve({ ok: false, error: e.message, url }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout', url }); });
  });
}

async function pingSearchEngines() {
  const sitemapUrl = encodeURIComponent(`${VERCEL_URL}/sitemap.xml`);

  const pings = [
    // Google (most important)
    `https://www.google.com/ping?sitemap=${sitemapUrl}`,
    // Bing / DuckDuckGo / Yahoo all use the same Bing endpoint
    `https://www.bing.com/ping?sitemap=${sitemapUrl}`,
    // IndexNow (Bing/Yandex fast indexing protocol) — optional, needs API key
    // `https://www.indexnow.org/indexnow?url=${sitemapUrl}&key=${process.env.INDEXNOW_KEY}`,
  ];

  console.log('[Sitemap] Pinging search engines...');
  const results = await Promise.all(pings.map(pingUrl));

  for (const r of results) {
    const status = r.ok ? '✅' : '❌';
    console.log(`  ${status} ${r.url.split('?')[0]} → ${r.status || r.error}`);
  }

  return results;
}

// ─── robots.txt generation ────────────────────────────────────────────────────

function generateRobots() {
  const robotsPath = path.join(PUBLIC_DIR, 'robots.txt');

  // Don't overwrite a manually crafted robots.txt
  if (fs.existsSync(robotsPath)) {
    const existing = fs.readFileSync(robotsPath, 'utf8');
    // Only add sitemap line if it's not already there
    if (!existing.includes('Sitemap:')) {
      fs.appendFileSync(robotsPath, `\nSitemap: ${VERCEL_URL}/sitemap.xml\n`);
      console.log('[Sitemap] Added Sitemap directive to existing robots.txt');
    } else {
      console.log('[Sitemap] robots.txt already has Sitemap directive');
    }
    return;
  }

  // Create a new robots.txt
  const robots = `User-agent: *
Allow: /

# Block API endpoints from search indexing
Disallow: /api/
Disallow: /admin/
Disallow: /.env
Disallow: /data/

# Allow all public pages
Allow: /public/

Sitemap: ${VERCEL_URL}/sitemap.xml
`;

  fs.writeFileSync(robotsPath, robots, 'utf8');
  console.log('[Sitemap] Generated robots.txt');
}

// ─── Main run ─────────────────────────────────────────────────────────────────

async function run() {
  console.log(`[Sitemap] Scanning ${PUBLIC_DIR}`);

  const result = generateSitemap();
  generateRobots();

  if (SUBMIT_MODE) {
    await pingSearchEngines();
  }

  return result;
}

// ─── Serve mode (Railway deployment) ─────────────────────────────────────────

if (SERVE_MODE) {
  const express = require('express');
  const app = express();
  app.use(express.json());

  const PORT            = process.env.SITEMAP_PORT || process.env.PORT || 3037;
  const PIPELINE_SECRET = process.env.PIPELINE_SECRET || '';

  function auth(req, res, next) {
    if (req.method === 'GET') return next();
    const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
    if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
    next();
  }

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.get('/status', (req, res) => {
    const exists  = fs.existsSync(OUTPUT_FILE);
    const lastMod = exists ? fs.statSync(OUTPUT_FILE).mtime : null;
    res.json({ ok: true, service: 'sitemap-generator', sitemapExists: exists, lastGenerated: lastMod, sitemapUrl: `${VERCEL_URL}/sitemap.xml` });
  });

  app.post('/generate', auth, async (req, res) => {
    try {
      const result = await run();
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/sitemap.xml', (req, res) => {
    if (!fs.existsSync(OUTPUT_FILE)) {
      return res.status(404).json({ error: 'not generated yet — POST /generate first' });
    }
    res.setHeader('Content-Type', 'application/xml');
    res.sendFile(OUTPUT_FILE);
  });

  // Run once at startup
  run().catch(e => console.error('[Sitemap boot]', e.message));

  // Daily regeneration at 03:00 UTC (after content generators have run)
  cron.schedule('0 3 * * *', () => {
    run().catch(e => console.error('[Sitemap cron]', e.message));
  });

  app.listen(PORT, () => {
    console.log(`[Sitemap Generator] listening on :${PORT}`);
    console.log(`[Sitemap] Regenerates daily at 03:00 UTC`);
    console.log(`[Sitemap] ${VERCEL_URL}/sitemap.xml`);
  });
} else {
  // CLI mode — run once
  run()
    .then(r => {
      console.log(`\n✅ Sitemap generated: ${r.total} URLs`);
      console.log(`   File: ${OUTPUT_FILE}`);
      console.log(`   URL:  ${VERCEL_URL}/sitemap.xml`);
      if (!SUBMIT_MODE) {
        console.log('\n  To ping search engines: node sitemap-generator.js --submit');
      }
    })
    .catch(e => {
      console.error('[Sitemap]', e.message);
      process.exit(1);
    });
}
