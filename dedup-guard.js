/**
 * WC 2026 Sports Empire — Dedup Guard
 * Deploy on Railway.app as service "dedup-guard"
 * Port: 3033
 *
 * Cross-engine event deduplication. Prevents the same goal being posted
 * 3 times because news-monitor, moment-engine, AND commentary all fire.
 *
 * How it works:
 *   1. Any engine that wants to post calls POST /check before posting
 *   2. Dedup guard generates a fingerprint from (eventType + matchId + minute + eventHash)
 *   3. If fingerprint seen within TTL → returns { duplicate: true, skip: true }
 *   4. If new → marks as seen, returns { duplicate: false, proceed: true }
 *   5. TTL defaults to 10 minutes per event (configurable per event type)
 *
 * Alternatively, engines can call POST /trigger and dedup-guard only
 * forwards to moment-engine if the event is fresh.
 *
 * Can also be used as middleware via the npm module export:
 *   const { checkDedup } = require('./dedup-guard');
 *   if (await checkDedup('GOAL', data)) return; // skip duplicate
 *
 * Required env vars:
 *   PIPELINE_SECRET
 *   MOMENT_ENGINE_URL   — to re-dispatch deduplicated events
 *
 * Port: 3033
 */

'use strict';

require('dotenv').config();
const crypto  = require('crypto');
const express = require('express');
const axios   = require('axios');

const PIPELINE_SECRET  = process.env.PIPELINE_SECRET   || '';
const MOMENT_URL       = (process.env.MOMENT_ENGINE_URL || 'http://localhost:3001').replace(/\/$/, '');

// TTL per event type (ms)
const EVENT_TTL = {
  GOAL:         10 * 60 * 1000,  // 10 min (same goal can't repeat in a match)
  PENALTY_GOAL: 10 * 60 * 1000,
  OWN_GOAL:     10 * 60 * 1000,
  HAT_TRICK:    30 * 60 * 1000,  // 30 min (once per match basically)
  RED_CARD:     15 * 60 * 1000,
  YELLOW_CARD:   5 * 60 * 1000,
  MATCH_END:    60 * 60 * 1000,  // 1 hour
  MATCH_START:  60 * 60 * 1000,
  PRE_MATCH:    60 * 60 * 1000,
  UPSET:        60 * 60 * 1000,
  ELIMINATION:  120 * 60 * 1000, // 2 hours
  VAR_REVIEW:    5 * 60 * 1000,
  INJURY:        5 * 60 * 1000,
  BREAKING_NEWS:15 * 60 * 1000,
  RECORD:       60 * 60 * 1000,
  DEFAULT:      10 * 60 * 1000
};

// In-memory cache: fingerprint → { firstSeen, count, sources }
const cache  = new Map();
const stats  = { checked: 0, duplicates: 0, passed: 0 };
let cacheHits = 0;

// ─── Fingerprinting ───────────────────────────────────────────────────────────

function fingerprint(eventType, data) {
  // Build a canonical string from the most identifying fields
  const parts = [
    eventType,
    data.matchId   || data.fixtureId || '',
    data.minute    ? Math.floor(data.minute / 2) * 2 : '', // bucket to 2-min windows
    data.player    || '',
    data.team      || '',
    data.homeTeam  || '',
    data.awayTeam  || '',
    data.homeScore !== undefined ? String(data.homeScore) : '',
    data.awayScore !== undefined ? String(data.awayScore) : ''
  ].join('|').toLowerCase();

  return crypto.createHash('sha256').update(parts).digest('hex').slice(0, 16);
}

// ─── Cache management ─────────────────────────────────────────────────────────

function checkAndMark(eventType, data, source = 'unknown') {
  stats.checked++;
  const fp  = fingerprint(eventType, data);
  const ttl = EVENT_TTL[eventType] || EVENT_TTL.DEFAULT;
  const now = Date.now();

  if (cache.has(fp)) {
    const entry = cache.get(fp);
    if (now - entry.firstSeen < ttl) {
      entry.count++;
      entry.sources.push(source);
      stats.duplicates++;
      cacheHits++;
      return {
        duplicate:  true,
        skip:       true,
        fingerprint: fp,
        firstSeen:  new Date(entry.firstSeen).toISOString(),
        count:      entry.count,
        sources:    entry.sources
      };
    }
    // TTL expired — treat as fresh
    cache.delete(fp);
  }

  cache.set(fp, { firstSeen: now, count: 1, sources: [source], eventType });
  stats.passed++;
  return { duplicate: false, proceed: true, fingerprint: fp };
}

function pruneExpired() {
  const now = Date.now();
  let pruned = 0;
  for (const [fp, entry] of cache.entries()) {
    const ttl = EVENT_TTL[entry.eventType] || EVENT_TTL.DEFAULT;
    if (now - entry.firstSeen > ttl * 2) {
      cache.delete(fp);
      pruned++;
    }
  }
  if (pruned > 0) console.log(`[DedupGuard] pruned ${pruned} expired entries`);
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers['x-pipeline-secret'] || req.headers['x-admin-token'];
  if (PIPELINE_SECRET && token !== PIPELINE_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

// Check if event is a duplicate (read-only, does NOT mark)
app.post('/peek', auth, (req, res) => {
  const { eventType, source, ...data } = req.body;
  if (!eventType) return res.status(400).json({ ok: false, error: 'eventType required' });

  const fp  = fingerprint(eventType, data);
  const ttl = EVENT_TTL[eventType] || EVENT_TTL.DEFAULT;
  const now = Date.now();

  if (cache.has(fp)) {
    const entry = cache.get(fp);
    if (now - entry.firstSeen < ttl) {
      return res.json({ duplicate: true, skip: true, fingerprint: fp, firstSeen: new Date(entry.firstSeen).toISOString(), count: entry.count });
    }
  }
  res.json({ duplicate: false, proceed: true, fingerprint: fp });
});

// Check + mark in one call (idempotent — use this for actual dedup)
app.post('/check', auth, (req, res) => {
  const { eventType, source = 'unknown', ...data } = req.body;
  if (!eventType) return res.status(400).json({ ok: false, error: 'eventType required' });
  const result = checkAndMark(eventType, data, source);
  res.json(result);
});

// Force-mark an event as seen (for manual dedup or replay prevention)
app.post('/mark', auth, (req, res) => {
  const { eventType, source = 'manual', ...data } = req.body;
  if (!eventType) return res.status(400).json({ ok: false, error: 'eventType required' });
  const fp  = fingerprint(eventType, data);
  cache.set(fp, { firstSeen: Date.now(), count: 1, sources: [source], eventType });
  res.json({ ok: true, fingerprint: fp });
});

// Clear a specific event from the cache (force re-broadcast)
app.delete('/clear', auth, (req, res) => {
  const { eventType, ...data } = req.body;
  if (!eventType) return res.status(400).json({ ok: false, error: 'eventType required' });
  const fp      = fingerprint(eventType, data);
  const existed = cache.has(fp);
  cache.delete(fp);
  res.json({ ok: true, fingerprint: fp, existed });
});

// Clear all cache (use carefully — allows all events to re-fire)
app.post('/clear-all', auth, (req, res) => {
  const size = cache.size;
  cache.clear();
  res.json({ ok: true, cleared: size });
});

// Get cache state
app.get('/cache', auth, (req, res) => {
  const entries = [...cache.entries()].map(([fp, e]) => ({
    fingerprint: fp, eventType: e.eventType, count: e.count,
    firstSeen: new Date(e.firstSeen).toISOString(), sources: e.sources
  }));
  res.json({ ok: true, size: cache.size, entries: entries.slice(0, 100) });
});

app.get('/stats', (req, res) => {
  res.json({ ok: true, stats, cacheSize: cache.size });
});

app.get('/status', (req, res) => {
  res.json({ ok: true, service: 'dedup-guard', stats, cacheSize: cache.size });
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function boot() {
  const PORT = process.env.DEDUP_PORT || process.env.PORT || 3033;
  app.listen(PORT, () => console.log(`[Dedup Guard] listening on :${PORT}`));

  // Prune expired entries every 5 minutes
  setInterval(pruneExpired, 5 * 60 * 1000);

  console.log(`[Dedup Guard] running on :${PORT}`);
  console.log(`[Dedup Guard] Usage: POST /check { eventType, matchId, minute, player, ... }`);
}

boot().catch(e => { console.error('[Boot]', e); process.exit(1); });

// Export for use as a module by other engines
module.exports = {
  fingerprint,
  checkAndMark,
  EVENT_TTL
};
