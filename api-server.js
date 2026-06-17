'use strict';
// WC2026 API Server - minimal express-only build (no external middleware)
const express = require('express');
const https = require('https');

const PORT = process.env.PORT || 3001;
const app = express();

// Parse JSON bodies
app.use(express.json());

// CORS - manual (no cors package needed)
app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

// Fallback data
var PICKS = [
  { id:'p1', match:'Argentina vs France', pick:'Argentina ML', odds:'+145', confidence:72, tip:'Messi motivated at home WC', badge:'HOT' },
  { id:'p2', match:'England vs Germany', pick:'Both Teams to Score', odds:'-115', confidence:68, tip:'Both high-scoring attacks', badge:'VALUE' },
  { id:'p3', match:'Brazil vs Spain', pick:'Under 2.5 Goals', odds:'+105', confidence:65, tip:'Defensive midfields dominate', badge:'SAFE' },
  { id:'p4', match:'Morocco vs Portugal', pick:'Morocco +1.5', odds:'-130', confidence:70, tip:'Morocco excellent at home', badge:'SAFE' },
  { id:'p5', match:'USA vs Mexico', pick:'USA ML', odds:'+120', confidence:63, tip:'USA strong at home WC 2026', badge:'VALUE' }
];
var SCORERS = [
  { rank:1, player:'Kylian Mbappe', team:'France', goals:4, assists:2 },
  { rank:2, player:'Harry Kane', team:'England', goals:3, assists:1 },
  { rank:3, player:'Vinicius Jr', team:'Brazil', goals:3, assists:3 },
  { rank:4, player:'Pedri', team:'Spain', goals:2, assists:4 },
  { rank:5, player:'Erling Haaland', team:'Norway', goals:2, assists:1 }
];
var MATCHES = [
  { id:'m1', home:'Argentina', away:'France', homeScore:null, awayScore:null, status:'upcoming', time:'2026-07-19T18:00:00Z' },
  { id:'m2', home:'England', away:'Germany', homeScore:null, awayScore:null, status:'upcoming', time:'2026-07-15T15:00:00Z' },
  { id:'m3', home:'Brazil', away:'Spain', homeScore:2, awayScore:1, status:'FT', time:'2026-07-12T20:00:00Z' },
  { id:'m4', home:'Morocco', away:'Portugal', homeScore:1, awayScore:1, status:'FT', time:'2026-07-12T17:00:00Z' }
];

// Routes
app.get('/health', function(req, res) {
  res.json({ ok:true, service:'wc2026-api', uptime:process.uptime(), version:'2.1.0' });
});
app.get('/api/status', function(req, res) {
  res.json({ ok:true, tournament:'FIFA World Cup 2026', phase:'Group Stage', teamsRemaining:48, timestamp:Date.now() });
});
app.get('/api/picks', function(req, res) {
  res.json({ ok:true, source:'curated', count:PICKS.length, picks:PICKS, generated:new Date().toISOString() });
});
app.get('/api/scorers', function(req, res) {
  res.json({ ok:true, source:'curated', scorers:SCORERS, updated:new Date().toISOString() });
});
app.get('/api/scores', function(req, res) {
  res.json({ ok:true, source:'fallback', matches:MATCHES, updated:new Date().toISOString() });
});
app.get('/api/predict', function(req, res) {
  var matchStr = req.query.match || 'Argentina vs France';
  var teams = matchStr.split(' vs ');
  var home = teams[0] || 'Argentina', away = teams[1] || 'France';
  var seed = home.charCodeAt(0) + away.charCodeAt(0);
  var homeWin = 30 + (seed % 25), awayWin = 30 + ((seed * 3) % 20), draw = 100 - homeWin - awayWin;
  res.json({ ok:true, match:home + ' vs ' + away, prediction:{ homeWin:homeWin, draw:draw, awayWin:awayWin }, confidence:65, method:'algorithmic' });
});
app.get('/api/odds', function(req, res) {
  res.json({ ok:true, source:'fallback', note:'Add THE_ODDS_API_KEY env var for live odds', odds:[
    { match:'Argentina vs France', home:'+145', draw:'+220', away:'+180' },
    { match:'England vs Germany', home:'+160', draw:'+230', away:'+170' }
  ] });
});
app.get('/api/props/today', function(req, res) {
  res.json({ ok:true, props:[
    { player:'Harry Kane', prop:'Anytime Scorer', odds:'-110', match:'England vs Germany' },
    { player:'Kylian Mbappe', prop:'First Scorer', odds:'+250', match:'Argentina vs France' }
  ], date:new Date().toISOString().split('T')[0] });
});
app.get('/api/leaderboard', function(req, res) {
  res.json({ ok:true, leaderboard:[
    { rank:1, username:'PuntingPro99', points:2340, streak:7 },
    { rank:2, username:'WC2026Wizard', points:2180, streak:5 },
    { rank:3, username:'BettingBrain', points:1990, streak:3 }
  ] });
});
app.post('/api/subscribe', function(req, res) {
  var email = (req.body && req.body.email) || '';
  if (!email || !email.includes('@')) { return res.status(400).json({ ok:false, error:'Valid email required' }); }
  console.log('Subscribe:', email);
  res.json({ ok:true, message:'Subscribed successfully', email:email });
});
app.post('/api/push-subscribe', function(req, res) {
  res.json({ ok:true, message:'Push subscription recorded' });
});
app.post('/api/chat', function(req, res) {
  var msg = (req.body && req.body.message) || '';
  var GROQ = process.env.GROQ_API_KEY;
  if (GROQ) {
    var body = JSON.stringify({ model:'llama3-8b-8192', messages:[
      { role:'system', content:'You are a FIFA World Cup 2026 expert. Give concise betting and match analysis.' },
      { role:'user', content:msg }
    ], max_tokens:300 });
    var options = { hostname:'api.groq.com', path:'/openai/v1/chat/completions', method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + GROQ, 'Content-Length':Buffer.byteLength(body) } };
    var reqG = https.request(options, function(rG) {
      var data = ''; rG.on('data', function(d) { data += d; });
      rG.on('end', function() {
        try {
          var j = JSON.parse(data);
          return res.json({ ok:true, source:'groq', reply:j.choices[0].message.content });
        } catch(e) { fallbackChat(res, msg); }
      });
    });
    reqG.on('error', function() { fallbackChat(res, msg); });
    reqG.write(body); reqG.end(); return;
  }
  fallbackChat(res, msg);
});
function fallbackChat(res, msg) {
  var replies = [
    'WC 2026 features 48 teams across USA, Canada, and Mexico. Biggest tournament ever!',
    'Top favorites: Argentina, France, Brazil, England, Spain. All have excellent squads.',
    'Morocco are huge value at long odds - they proved in 2022 they can go all the way.',
    'Golden Boot battle: Mbappe vs Kane vs Vinicius Jr - any could top the charts.',
    'Group stage = 80 matches. Massive betting opportunity from June 11 to July 19.'
  ];
  res.json({ ok:true, source:'fallback', reply:replies[Math.abs(msg.length) % replies.length] });
}
app.get('/go/:dest', function(req, res) {
  var LINKS = { bet365:'https://www.bet365.com', betfair:'https://www.betfair.com',
    draftkings:'https://www.draftkings.com', betmgm:'https://sports.betmgm.com',
    fanduel:'https://www.fanduel.com' };
  var dest = LINKS[req.params.dest] || 'https://wc2026-empire.vercel.app';
  res.redirect(302, dest);
});
app.use(function(req, res) {
  res.status(404).json({ ok:false, error:'Not found', path:req.path });
});

app.listen(PORT, function() {
  console.log('WC2026 API running on port ' + PORT);
});
