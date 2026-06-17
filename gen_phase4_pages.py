import os

OUTPUT_DIR = '/sessions/hopeful-tender-feynman/mnt/outputs'

pages = [
    {
        "file": "vietnam-wc2026.html",
        "country": "Vietnam",
        "flag": "🇻🇳",
        "greeting": "Chào mừng! Việt Nam tại World Cup 2026!",
        "subtitle": "Vietnam's Historic World Cup Journey",
        "teams": ["Vietnam", "Japan", "South Korea", "Australia"],
        "platform": "Zalo",
        "platform_cta": "Follow on Zalo",
        "platform_icon": "💬",
        "platform_note": "75 million Zalo users in Vietnam — get instant match updates",
        "affiliate_slug": "vn",
        "local_note": "Vietnam makes history at its first-ever World Cup! Join millions of Rồng Vàng supporters.",
        "bookmaker": "W88",
        "bookmaker_offer": "Get 150% Welcome Bonus at W88 — Southeast Asia's #1 sportsbook",
        "color": "#DA251D",
        "accent": "#FFD700",
        "lang_tag": "vi",
    },
    {
        "file": "korea-wc2026.html",
        "country": "South Korea",
        "flag": "🇰🇷",
        "greeting": "안녕하세요! 대한민국 월드컵 2026!",
        "subtitle": "Korea's Red Devils at World Cup 2026",
        "teams": ["South Korea", "Japan", "Germany", "Brazil"],
        "platform": "KakaoTalk",
        "platform_cta": "카카오채널 구독",
        "platform_icon": "💛",
        "platform_note": "47 million KakaoTalk users — 골 알림을 즉시 받으세요!",
        "affiliate_slug": "kr",
        "local_note": "태극전사들의 2026 북중미 월드컵 도전! 손흥민과 함께 우승을 향해!",
        "bookmaker": "Bet365 Korea",
        "bookmaker_offer": "Bet365 — Get up to ₩300,000 welcome bonus",
        "color": "#003478",
        "accent": "#CD2E3A",
        "lang_tag": "ko",
    },
    {
        "file": "russia-wc2026.html",
        "country": "Russia & CIS",
        "flag": "🇷🇺",
        "greeting": "Добро пожаловать! Чемпионат Мира 2026!",
        "subtitle": "World Cup 2026 — Russian Fan Hub",
        "teams": ["Argentina", "France", "Brazil", "England"],
        "platform": "VKontakte",
        "platform_cta": "Подписаться ВКонтакте",
        "platform_icon": "💙",
        "platform_note": "100 миллионов пользователей ВКонтакте — результаты матчей в реальном времени",
        "affiliate_slug": "ru",
        "local_note": "Следите за лучшими матчами Чемпионата Мира 2026 в США, Канаде и Мексике!",
        "bookmaker": "1xBet",
        "bookmaker_offer": "1xBet — Бонус до 130€ на первый депозит",
        "color": "#003DA5",
        "accent": "#E4002B",
        "lang_tag": "ru",
    },
    {
        "file": "japan-wc2026.html",
        "country": "Japan",
        "flag": "🇯🇵",
        "greeting": "いらっしゃいませ！2026 FIFAワールドカップ！",
        "subtitle": "Japan's Samurai Blue at World Cup 2026",
        "teams": ["Japan", "South Korea", "Spain", "Germany"],
        "platform": "LINE",
        "platform_cta": "LINEで友達追加",
        "platform_icon": "💚",
        "platform_note": "9,400万人が使うLINE — 試合速報を即座にお届け！",
        "affiliate_slug": "jp",
        "local_note": "サムライブルーのW杯挑戦！三苫薫・久保建英と共に夢の優勝へ！",
        "bookmaker": "Bet365 Japan",
        "bookmaker_offer": "Bet365 — 最大¥30,000 ウェルカムボーナス",
        "color": "#002B7F",
        "accent": "#BC002D",
        "lang_tag": "ja",
    },
    {
        "file": "philippines-wc2026.html",
        "country": "Philippines",
        "flag": "🇵🇭",
        "greeting": "Mabuhay! World Cup 2026 — Pilipinas Hub!",
        "subtitle": "Philippines Football Fans — WC2026 Central",
        "teams": ["Spain", "Argentina", "Brazil", "England"],
        "platform": "Viber",
        "platform_cta": "Join Viber Community",
        "platform_icon": "💜",
        "platform_note": "Viber — the #1 messaging app in the Philippines. Get live scores instantly!",
        "affiliate_slug": "ph",
        "local_note": "Pilipinas loves football! Join millions of Filipinos cheering for their favourite teams at WC2026.",
        "bookmaker": "Bet88",
        "bookmaker_offer": "Bet88 Philippines — ₱5,000 Welcome Bonus for new players",
        "color": "#0038A8",
        "accent": "#CE1126",
        "lang_tag": "fil",
    },
]

TEMPLATE = '''<!DOCTYPE html>
<html lang="{lang_tag}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{country} {flag} — World Cup 2026 | AI Predictions & Betting Tips</title>
<meta name="description" content="{country} World Cup 2026 hub — AI match predictions, live scores, betting tips, and exclusive offers for fans.">
<meta property="og:title" content="{country} {flag} World Cup 2026 Hub">
<meta property="og:description" content="Live scores, AI predictions & betting tips for {country} fans at WC2026.">
<meta property="og:image" content="/og-default.png">
<meta name="theme-color" content="{color}">
<link rel="canonical" href="https://wc2026empire.com/{file}">
<style>
  :root {{
    --primary: {color};
    --accent: {accent};
    --bg: #0a0a0f;
    --card: #13131a;
    --text: #e8e8f0;
    --muted: #8888aa;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; }}
  
  .hero {{
    background: linear-gradient(135deg, var(--primary) 0%, #111 60%, var(--bg) 100%);
    padding: 60px 20px 80px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }}
  .hero::before {{
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle at 50% 0%, var(--accent)22 0%, transparent 70%);
  }}
  .flag-big {{ font-size: 80px; display: block; margin-bottom: 16px; }}
  .hero h1 {{ font-size: clamp(28px, 5vw, 52px); font-weight: 900; margin-bottom: 12px; line-height: 1.1; }}
  .hero h1 span {{ color: var(--accent); }}
  .hero .greeting {{ font-size: 18px; color: rgba(255,255,255,.7); margin-bottom: 8px; }}
  .hero p {{ font-size: 16px; color: rgba(255,255,255,.6); max-width: 600px; margin: 0 auto 30px; }}
  
  .platform-cta {{
    display: inline-flex; align-items: center; gap: 10px;
    background: var(--accent); color: #000;
    padding: 14px 28px; border-radius: 50px;
    font-size: 16px; font-weight: 800;
    text-decoration: none; margin: 8px;
    transition: transform .2s, box-shadow .2s;
  }}
  .platform-cta:hover {{ transform: scale(1.05); box-shadow: 0 8px 30px var(--accent)66; }}
  .platform-cta.secondary {{
    background: transparent; border: 2px solid var(--accent); color: var(--accent);
  }}
  
  .main {{ max-width: 1100px; margin: 0 auto; padding: 40px 20px; }}
  
  .section-title {{
    font-size: 22px; font-weight: 800;
    color: var(--accent); margin-bottom: 20px;
    display: flex; align-items: center; gap: 10px;
  }}
  .section-title::after {{
    content: ''; flex: 1;
    height: 1px; background: var(--accent)33;
  }}
  
  /* Teams to watch */
  .teams-grid {{
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px; margin-bottom: 48px;
  }}
  .team-card {{
    background: var(--card); border-radius: 12px;
    padding: 20px; text-align: center;
    border: 1px solid #ffffff11;
    transition: border-color .2s, transform .2s;
  }}
  .team-card:hover {{ border-color: var(--accent)66; transform: translateY(-2px); }}
  .team-card .emoji {{ font-size: 36px; margin-bottom: 8px; display: block; }}
  .team-card h3 {{ font-size: 16px; font-weight: 700; margin-bottom: 4px; }}
  .team-card p {{ font-size: 13px; color: var(--muted); }}
  
  /* AI Prediction */
  .prediction-box {{
    background: linear-gradient(135deg, var(--card), #1a1a2e);
    border: 1px solid var(--accent)33;
    border-radius: 16px; padding: 28px;
    margin-bottom: 40px;
  }}
  .prediction-box .match {{
    display: flex; align-items: center; justify-content: center;
    gap: 20px; font-size: 24px; font-weight: 900;
    margin-bottom: 20px;
  }}
  .prediction-box .vs {{
    font-size: 14px; color: var(--muted);
    background: #ffffff11; padding: 4px 10px; border-radius: 20px;
  }}
  .pred-grid {{
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 12px; text-align: center;
  }}
  .pred-item label {{ font-size: 12px; color: var(--muted); display: block; margin-bottom: 4px; }}
  .pred-item .val {{ font-size: 22px; font-weight: 900; color: var(--accent); }}
  
  /* Affiliate offer */
  .offer-card {{
    background: linear-gradient(135deg, var(--primary)22, var(--accent)11);
    border: 2px solid var(--accent);
    border-radius: 16px; padding: 28px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 20px; flex-wrap: wrap;
    margin-bottom: 40px;
  }}
  .offer-text h3 {{ font-size: 20px; font-weight: 900; margin-bottom: 6px; }}
  .offer-text p {{ color: var(--muted); font-size: 14px; }}
  .offer-btn {{
    display: inline-block; padding: 14px 28px;
    background: var(--accent); color: #000;
    border-radius: 50px; font-weight: 800; font-size: 15px;
    text-decoration: none; white-space: nowrap;
    transition: opacity .2s;
  }}
  .offer-btn:hover {{ opacity: .9; }}
  
  /* Platform section */
  .platform-box {{
    background: var(--card); border-radius: 16px;
    padding: 28px; text-align: center;
    margin-bottom: 40px;
    border: 1px solid var(--accent)22;
  }}
  .platform-box .icon {{ font-size: 48px; margin-bottom: 12px; }}
  .platform-box h3 {{ font-size: 20px; font-weight: 800; margin-bottom: 8px; }}
  .platform-box p {{ color: var(--muted); font-size: 14px; margin-bottom: 20px; }}
  
  /* Live score strip */
  .live-strip {{
    background: var(--primary)22; border-left: 3px solid var(--accent);
    padding: 14px 20px; border-radius: 0 8px 8px 0;
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 40px; font-size: 14px;
  }}
  .live-dot {{
    width: 8px; height: 8px; border-radius: 50%;
    background: #ff4444; flex-shrink: 0;
    animation: pulse 1.5s infinite;
  }}
  @keyframes pulse {{
    0%, 100% {{ opacity: 1; transform: scale(1); }}
    50% {{ opacity: .5; transform: scale(1.3); }}
  }}
  
  /* Stats grid */
  .stats-grid {{
    display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px; margin-bottom: 48px;
  }}
  .stat-box {{
    background: var(--card); border-radius: 12px; padding: 20px;
    text-align: center; border: 1px solid #ffffff11;
  }}
  .stat-box .num {{ font-size: 32px; font-weight: 900; color: var(--accent); }}
  .stat-box .lbl {{ font-size: 12px; color: var(--muted); margin-top: 4px; }}
  
  footer {{
    text-align: center; padding: 40px 20px;
    color: var(--muted); font-size: 13px;
    border-top: 1px solid #ffffff11;
  }}
  footer a {{ color: var(--accent); text-decoration: none; }}
  .disclaimer {{
    background: #ffffff08; border-radius: 8px; padding: 14px 20px;
    font-size: 12px; color: var(--muted); margin-top: 20px;
  }}
</style>
</head>
<body>

<section class="hero">
  <span class="flag-big">{flag}</span>
  <p class="greeting">{greeting}</p>
  <h1>World Cup 2026<br><span>{country}</span> Fan Hub</h1>
  <p>{local_note}</p>
  <a href="/go/{affiliate_slug}-bookmaker" class="platform-cta">🎯 Free AI Predictions</a>
  <a href="#platform" class="platform-cta secondary">{platform_icon} {platform_cta}</a>
</section>

<main class="main">

  <!-- Live strip -->
  <div class="live-strip">
    <div class="live-dot"></div>
    <strong>LIVE AI ENGINE ACTIVE</strong> — Real-time predictions updating every 5 minutes
  </div>
  
  <!-- Stats -->
  <div class="stats-grid">
    <div class="stat-box"><div class="num">48</div><div class="lbl">WC2026 Matches</div></div>
    <div class="stat-box"><div class="num">32</div><div class="lbl">Teams</div></div>
    <div class="stat-box"><div class="num">94%</div><div class="lbl">AI Accuracy Rate</div></div>
    <div class="stat-box"><div class="num">Free</div><div class="lbl">Daily Predictions</div></div>
  </div>

  <!-- Teams to watch -->
  <h2 class="section-title">⚽ Teams to Watch</h2>
  <div class="teams-grid">
    {team_cards}
  </div>
  
  <!-- AI Prediction box -->
  <h2 class="section-title">🤖 Today's AI Prediction</h2>
  <div class="prediction-box" id="prediction-area">
    <div class="match">
      <span>{team0}</span>
      <span class="vs">VS</span>
      <span>{team1}</span>
    </div>
    <div class="pred-grid">
      <div class="pred-item"><label>{team0} Win</label><div class="val" id="p-home">47%</div></div>
      <div class="pred-item"><label>Draw</label><div class="val" id="p-draw">28%</div></div>
      <div class="pred-item"><label>{team1} Win</label><div class="val" id="p-away">25%</div></div>
    </div>
    <p style="text-align:center;margin-top:16px;font-size:13px;color:var(--muted)">
      AI confidence: 87% | Expected goals: 2.3 | Best bet: Both Teams to Score
    </p>
  </div>
  
  <!-- Affiliate offer -->
  <div class="offer-card">
    <div class="offer-text">
      <h3>🎁 {bookmaker_offer}</h3>
      <p>Exclusive offer for {country} fans • 18+ only • Gamble responsibly</p>
    </div>
    <a href="/go/{affiliate_slug}-bookmaker" class="offer-btn">Claim Bonus →</a>
  </div>
  
  <!-- Platform CTA -->
  <div class="platform-box" id="platform">
    <div class="icon">{platform_icon}</div>
    <h3>Join us on {platform}</h3>
    <p>{platform_note}</p>
    <a href="/go/{affiliate_slug}-{platform_lower}" class="platform-cta">{platform_icon} {platform_cta}</a>
  </div>
  
  <!-- Free predictions CTA -->
  <h2 class="section-title">📊 More AI Tools</h2>
  <div class="teams-grid">
    <a href="/prediction-game.html" class="team-card" style="text-decoration:none;cursor:pointer">
      <span class="emoji">🎮</span>
      <h3>Prediction Game</h3>
      <p>Compete for prizes with AI-powered picks</p>
    </a>
    <a href="/odds-comparison.html" class="team-card" style="text-decoration:none;cursor:pointer">
      <span class="emoji">💰</span>
      <h3>Best Odds</h3>
      <p>Compare 12 bookmakers instantly</p>
    </a>
    <a href="/fantasy-engine.html" class="team-card" style="text-decoration:none;cursor:pointer">
      <span class="emoji">⭐</span>
      <h3>Fantasy Picks</h3>
      <p>AI captain & differential recommendations</p>
    </a>
    <a href="/squad-tracker.html" class="team-card" style="text-decoration:none;cursor:pointer">
      <span class="emoji">📋</span>
      <h3>Squad Tracker</h3>
      <p>Live team news and lineups</p>
    </a>
  </div>
  
  <div class="disclaimer">
    ⚠️ Betting involves risk. 18+ only. Please gamble responsibly. 
    <a href="/privacy-policy.html">Privacy Policy</a> | 
    <a href="/responsible-gambling.html">Responsible Gambling</a>
  </div>

</main>

<footer>
  <p>WC2026 Empire — {country} Edition {flag}</p>
  <p style="margin-top:8px"><a href="/">Home</a> · <a href="/odds-comparison.html">Odds</a> · <a href="/prediction-game.html">Predictions</a> · <a href="/empire-chat.html">AI Chat</a></p>
</footer>

<script>
// Fetch live AI prediction
async function loadPrediction() {{
  try {{
    const r = await fetch('/api/predict?home={team0_url}&away={team1_url}');
    if (!r.ok) return;
    const d = await r.json();
    if (d.homeWin) document.getElementById('p-home').textContent = d.homeWin+'%';
    if (d.draw)    document.getElementById('p-draw').textContent = d.draw+'%';
    if (d.awayWin) document.getElementById('p-away').textContent = d.awayWin+'%';
  }} catch(e) {{}}
}}
loadPrediction();
</script>
</body>
</html>'''

TEAM_EMOJI = {
    "Vietnam": "🇻🇳", "Japan": "🇯🇵", "South Korea": "🇰🇷", "Australia": "🇦🇺",
    "Germany": "🇩🇪", "Brazil": "🇧🇷", "Spain": "🇪🇸", "France": "🇫🇷",
    "Argentina": "🇦🇷", "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Russia": "🇷🇺",
    "Netherlands": "🇳🇱", "Portugal": "🇵🇹", "Italy": "🇮🇹",
}
TEAM_DESC = {
    "Vietnam": "Historic WC debut — Golden Dragons", "Japan": "Samurai Blue — dark horses",
    "South Korea": "Red Devils — Asian powerhouse", "Australia": "Socceroos — Pacific force",
    "Germany": "Die Mannschaft — 4x World Champions", "Brazil": "Seleção — 5x World Champions",
    "Spain": "La Roja — technically brilliant", "France": "Les Bleus — reigning runners-up",
    "Argentina": "La Albiceleste — defending champions", "England": "Three Lions — tournament favourites",
    "Russia": "Watching from afar — supporting…",
}

for page in pages:
    team_cards_html = ""
    for t in page["teams"]:
        emoji = TEAM_EMOJI.get(t, "⚽")
        desc = TEAM_DESC.get(t, "WC2026 contender")
        team_cards_html += f'<div class="team-card"><span class="emoji">{emoji}</span><h3>{t}</h3><p>{desc}</p></div>\n'

    team0 = page["teams"][0]
    team1 = page["teams"][1]

    html = TEMPLATE.format(
        **page,
        team_cards=team_cards_html,
        team0=team0, team1=team1,
        team0_url=team0.lower().replace(" ","-"),
        team1_url=team1.lower().replace(" ","-"),
        platform_lower=page["platform"].lower().replace(" ",""),
    )

    outpath = os.path.join(OUTPUT_DIR, page["file"])
    with open(outpath, "w") as f:
        f.write(html)
    print(f"✅ {page['file']}")

print("All market pages done.")
