// corporate-sweepstake-manager.js
// Full managed service backend for corporate WC 2026 sweepstakes
// Handles: company onboarding, team assignment, score tracking, automated updates
// Run: node corporate-sweepstake-manager.js

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'sweepstake-data.json');

// ── DATA STORE ────────────────────────────────────────────────
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { companies: {}, results: {} };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── 48 WC 2026 TEAMS ─────────────────────────────────────────
const WC_TEAMS = [
  { name:'Argentina', flag:'🇦🇷', group:'A', seed:1 },
  { name:'France', flag:'🇫🇷', group:'B', seed:1 },
  { name:'Brazil', flag:'🇧🇷', group:'C', seed:1 },
  { name:'England', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', group:'D', seed:1 },
  { name:'Spain', flag:'🇪🇸', group:'E', seed:1 },
  { name:'Germany', flag:'🇩🇪', group:'F', seed:1 },
  { name:'Netherlands', flag:'🇳🇱', group:'G', seed:1 },
  { name:'Portugal', flag:'🇵🇹', group:'H', seed:1 },
  { name:'Belgium', flag:'🇧🇪', group:'A', seed:2 },
  { name:'USA', flag:'🇺🇸', group:'B', seed:2 },
  { name:'Mexico', flag:'🇲🇽', group:'C', seed:2 },
  { name:'Morocco', flag:'🇲🇦', group:'D', seed:2 },
  { name:'Japan', flag:'🇯🇵', group:'E', seed:2 },
  { name:'South Korea', flag:'🇰🇷', group:'F', seed:2 },
  { name:'Senegal', flag:'🇸🇳', group:'G', seed:2 },
  { name:'Uruguay', flag:'🇺🇾', group:'H', seed:2 },
  { name:'Croatia', flag:'🇭🇷', group:'A', seed:3 },
  { name:'Canada', flag:'🇨🇦', group:'B', seed:3 },
  { name:'Colombia', flag:'🇨🇴', group:'C', seed:3 },
  { name:'Ecuador', flag:'🇪🇨', group:'D', seed:3 },
  { name:'Turkey', flag:'🇹🇷', group:'E', seed:3 },
  { name:'Nigeria', flag:'🇳🇬', group:'F', seed:3 },
  { name:'Switzerland', flag:'🇨🇭', group:'G', seed:3 },
  { name:'Australia', flag:'🇦🇺', group:'H', seed:3 },
  { name:'Chile', flag:'🇨🇱', group:'A', seed:4 },
  { name:'Venezuela', flag:'🇻🇪', group:'B', seed:4 },
  { name:'Paraguay', flag:'🇵🇾', group:'C', seed:4 },
  { name:'Costa Rica', flag:'🇨🇷', group:'D', seed:4 },
  { name:'Saudi Arabia', flag:'🇸🇦', group:'E', seed:4 },
  { name:'South Africa', flag:'🇿🇦', group:'F', seed:4 },
  { name:'Norway', flag:'🇳🇴', group:'G', seed:4 },
  { name:'Indonesia', flag:'🇮🇩', group:'H', seed:4 },
  { name:'Peru', flag:'🇵🇪', group:'I', seed:1 },
  { name:'Serbia', flag:'🇷🇸', group:'I', seed:2 },
  { name:'Denmark', flag:'🇩🇰', group:'J', seed:1 },
  { name:'Iran', flag:'🇮🇷', group:'J', seed:2 },
  { name:'Sweden', flag:'🇸🇪', group:'K', seed:1 },
  { name:'Algeria', flag:'🇩🇿', group:'K', seed:2 },
  { name:'Greece', flag:'🇬🇷', group:'L', seed:1 },
  { name:'Tunisia', flag:'🇹🇳', group:'L', seed:2 },
  { name:'Poland', flag:'🇵🇱', group:'M', seed:1 },
  { name:'Ghana', flag:'🇬🇭', group:'M', seed:2 },
  { name:'Romania', flag:'🇷🇴', group:'N', seed:1 },
  { name:'Cameroon', flag:'🇨🇲', group:'N', seed:2 },
  { name:'Austria', flag:'🇦🇹', group:'O', seed:1 },
  { name:'Egypt', flag:'🇪🇬', group:'O', seed:2 },
  { name:'Scotland', flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', group:'P', seed:1 },
  { name:'Qatar', flag:'🇶🇦', group:'P', seed:2 },
];

// ── SCORING SYSTEM ─────────────────────────────────────────
const POINTS = {
  group_win: 3,     // team wins a group stage match
  round_of_32: 10, // team reaches R32
  round_of_16: 20, // team reaches R16
  quarterfinal: 40,
  semifinal: 80,
  final: 150,
  winner: 300,
};

// ── CREATE SWEEPSTAKE ─────────────────────────────────────────
function createSweepstake(companyName, participants, prizeStructure = null) {
  const id = crypto.randomBytes(6).toString('hex');
  const shuffledTeams = [...WC_TEAMS].sort(() => Math.random() - 0.5);
  const assignments = {};

  // Assign teams round-robin to participants
  participants.forEach((name, i) => {
    const team = shuffledTeams[i % shuffledTeams.length];
    if (!assignments[name]) assignments[name] = [];
    assignments[name].push(team);
  });

  // If more participants than teams, extras get a random team
  if (participants.length > WC_TEAMS.length) {
    const extras = participants.slice(WC_TEAMS.length);
    extras.forEach(name => {
      const team = shuffledTeams[Math.floor(Math.random() * WC_TEAMS.length)];
      if (!assignments[name]) assignments[name] = [];
      assignments[name].push(team);
    });
  }

  const sweepstake = {
    id,
    company: companyName,
    created: new Date().toISOString(),
    participants: assignments,
    scores: Object.fromEntries(participants.map(p => [p, 0])),
    prize: prizeStructure || { first: '£50', second: '£25', third: '£10' },
    status: 'active',
    adminEmail: null,
    shareUrl: `https://wc2026ai.com/sweepstake/${id}`,
  };

  const data = loadData();
  data.companies[id] = sweepstake;
  saveData(data);

  console.log(`✅ Sweepstake created: ${id} for ${companyName} (${participants.length} participants)`);
  return sweepstake;
}

// ── UPDATE SCORES ─────────────────────────────────────────────
function updateScores(sweepstakeId, teamName, event) {
  const data = loadData();
  const sw = data.companies[sweepstakeId];
  if (!sw) return;

  const points = POINTS[event] || 0;

  Object.entries(sw.participants).forEach(([participant, teams]) => {
    if (teams.some(t => t.name === teamName)) {
      sw.scores[participant] = (sw.scores[participant] || 0) + points;
    }
  });

  data.companies[sweepstakeId] = sw;
  saveData(data);
  return sw;
}

// ── LEADERBOARD ───────────────────────────────────────────────
function getLeaderboard(sweepstakeId) {
  const data = loadData();
  const sw = data.companies[sweepstakeId];
  if (!sw) return null;

  return Object.entries(sw.scores)
    .sort(([,a],[,b]) => b - a)
    .map(([name, score], i) => ({
      rank: i + 1,
      name,
      score,
      teams: sw.participants[name]?.map(t => `${t.flag} ${t.name}`).join(', '),
    }));
}

// ── SEND LEADERBOARD EMAIL ────────────────────────────────────
async function sendLeaderboardEmail(sweepstakeId) {
  const data = loadData();
  const sw = data.companies[sweepstakeId];
  if (!sw || !sw.adminEmail) return;

  const lb = getLeaderboard(sweepstakeId);
  const top5 = lb.slice(0, 5);

  const html = `
<h2>🏆 ${sw.company} WC 2026 Sweepstake Update</h2>
<h3>Leaderboard:</h3>
<ol>
${top5.map(p => `<li><strong>${p.name}</strong> — ${p.score} pts (${p.teams})</li>`).join('\n')}
</ol>
<p><a href="${sw.shareUrl}">View full leaderboard →</a></p>
<p style="color:#888;font-size:12px">Powered by WC 2026 AI · wc2026ai.com</p>`;

  if (!process.env.EMAIL_USER) {
    console.log('Email would be sent to:', sw.adminEmail);
    console.log(html);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    from: 'WC 2026 AI <no-reply@wc2026ai.com>',
    to: sw.adminEmail,
    subject: `🏆 ${sw.company} WC 2026 Sweepstake — Latest Standings`,
    html,
  });
}

// ── EXPRESS ROUTES ────────────────────────────────────────────
app.post('/api/sweepstake/create', (req, res) => {
  const { company, participants, prize } = req.body;
  if (!company || !participants?.length) return res.status(400).json({ error: 'Company name and participants required' });
  const sw = createSweepstake(company, participants, prize);
  res.json({ success: true, sweepstake: sw });
});

app.get('/api/sweepstake/:id', (req, res) => {
  const data = loadData();
  const sw = data.companies[req.params.id];
  if (!sw) return res.status(404).json({ error: 'Not found' });
  res.json({ sweepstake: sw, leaderboard: getLeaderboard(req.params.id) });
});

app.post('/api/sweepstake/:id/update', (req, res) => {
  const { teamName, event } = req.body;
  const updated = updateScores(req.params.id, teamName, event);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, leaderboard: getLeaderboard(req.params.id) });
});

app.get('/api/sweepstake/:id/leaderboard', (req, res) => {
  const lb = getLeaderboard(req.params.id);
  if (!lb) return res.status(404).json({ error: 'Not found' });
  res.json({ leaderboard: lb });
});

// Public sweepstake page
app.get('/sweepstake/:id', (req, res) => {
  const data = loadData();
  const sw = data.companies[req.params.id];
  if (!sw) return res.send('<h1>Sweepstake not found</h1>');
  const lb = getLeaderboard(req.params.id);
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${sw.company} WC 2026 Sweepstake</title>
<style>body{font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;max-width:600px;margin:0 auto;padding:24px}
h1{color:#ffd700;margin-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{padding:10px;text-align:left;border-bottom:1px solid #2a2a2a}th{color:#ffd700}
tr:first-child td{color:#ffd700;font-weight:700}</style></head>
<body><h1>🏆 ${sw.company}</h1><p style="color:#aaa">WC 2026 Office Sweepstake</p>
<table><tr><th>Rank</th><th>Participant</th><th>Teams</th><th>Points</th></tr>
${lb.map(p => `<tr><td>${p.rank}</td><td>${p.name}</td><td style="font-size:0.85rem">${p.teams}</td><td><strong>${p.score}</strong></td></tr>`).join('')}
</table><p style="margin-top:24px;color:#666;font-size:0.85rem">Powered by <a href="/" style="color:#ffd700">WC 2026 AI</a></p></body></html>`);
});

const PORT = process.env.SWEEPSTAKE_PORT || 3002;
app.listen(PORT, () => {
  console.log(`🏆 Corporate Sweepstake Manager running on port ${PORT}`);
  console.log(`📊 API: POST /api/sweepstake/create`);
  console.log(`📊 API: GET  /api/sweepstake/:id`);
});

// Demo: create a test sweepstake when run directly
if (require.main === module) {
  const testSw = createSweepstake('Acme Corp Ltd', [
    'Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince',
    'Edward Norton', 'Fiona Green', 'George Washington', 'Hannah Montana',
    'Ivan Drago', 'Jennifer Lopez', 'Kevin Hart', 'Lisa Simpson'
  ]);
  console.log('\n📋 Demo sweepstake created:');
  console.log('Share URL:', testSw.shareUrl);
  console.log('View leaderboard:', `http://localhost:${PORT}/sweepstake/${testSw.id}`);
}

module.exports = { createSweepstake, updateScores, getLeaderboard };
