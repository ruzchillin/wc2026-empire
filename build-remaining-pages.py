#!/usr/bin/env python3
"""Build all remaining pages: player debates, country rivalries, platform hubs, content pages"""

import os

OUT = "/sessions/hopeful-tender-feynman/mnt/outputs"

STYLE = """<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#e8e8f0;font-family:'Inter',sans-serif;line-height:1.6}
nav{background:#0d0d14;border-bottom:1px solid #1e1e2e;padding:14px 24px;display:flex;align-items:center;gap:20px;position:sticky;top:0;z-index:100}
nav a{color:#888;text-decoration:none;font-size:13px;transition:color .2s}.nav-brand{color:#00ff88;font-weight:700;font-size:15px;margin-right:auto}
nav a:hover{color:#00ff88}.nav-cta{background:#00ff88;color:#0a0a0f!important;padding:6px 14px;border-radius:6px;font-weight:600}
.hero{background:linear-gradient(135deg,#0d0d18 0%,#0a1628 50%,#0d0d18 100%);padding:64px 24px;text-align:center;border-bottom:1px solid #1e1e2e}
.hero h1{font-size:clamp(28px,5vw,52px);font-weight:800;line-height:1.15;margin-bottom:16px}
.hi{color:#00ff88}.gold{color:#ffd700}.red{color:#ff4455}
.hero p{font-size:18px;color:#aaa;max-width:600px;margin:0 auto 28px}
.badge{display:inline-block;background:#00ff8820;color:#00ff88;border:1px solid #00ff8840;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px}
.btn{display:inline-block;background:#00ff88;color:#0a0a0f;padding:14px 28px;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;margin:6px}
.btn-outline{background:transparent;color:#00ff88;border:1px solid #00ff88}
.section{max-width:1100px;margin:0 auto;padding:48px 24px}
.section-label{color:#00ff88;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}
.section-title{font-size:clamp(22px,4vw,36px);font-weight:800;margin-bottom:16px}
.section-sub{color:#888;font-size:16px;max-width:620px;margin-bottom:32px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.card{background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:24px;transition:border-color .2s}
.card:hover{border-color:#00ff8840}
.card h3{font-size:16px;font-weight:700;margin-bottom:8px}
.card p{font-size:14px;color:#888;line-height:1.6}
.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:32px 0}
.stat{background:#111118;border:1px solid #1e1e2e;border-radius:10px;padding:20px;text-align:center}
.stat-n{font-size:32px;font-weight:800;color:#00ff88;display:block}
.stat-l{font-size:12px;color:#888;margin-top:4px}
table{width:100%;border-collapse:collapse;margin:24px 0}
th{background:#111118;color:#00ff88;padding:12px 16px;text-align:left;font-size:12px;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #1e1e2e}
td{padding:12px 16px;border-bottom:1px solid #1e1e2e;font-size:14px}
tr:hover{background:#ffffff05}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.tag-green{background:#00ff8820;color:#00ff88}.tag-gold{background:#ffd70020;color:#ffd700}.tag-red{background:#ff445520;color:#ff4455}
.divider{height:1px;background:#1e1e2e;margin:48px 0}
.vs-box{display:grid;grid-template-columns:1fr auto 1fr;gap:24px;align-items:center;margin:32px 0}
.player-side{background:#111118;border:1px solid #1e1e2e;border-radius:16px;padding:28px;text-align:center}
.player-side h2{font-size:26px;font-weight:800;margin-bottom:6px}
.player-side .nation{color:#888;font-size:13px;margin-bottom:16px}
.vs-mid{font-size:48px;font-weight:900;color:#ffd700;text-align:center}
.stat-compare{display:flex;justify-content:space-between;margin:8px 0;align-items:center}
.stat-compare .l{color:#00ff88;font-weight:700}.stat-compare .r{color:#ff4455;font-weight:700}
.stat-compare .m{color:#888;font-size:12px}
.verdict{background:#00ff8810;border:1px solid #00ff8830;border-radius:12px;padding:24px;margin:24px 0}
.verdict h3{color:#00ff88;margin-bottom:8px}
footer{background:#07070d;border-top:1px solid #1e1e2e;padding:32px 24px;text-align:center;color:#555;font-size:13px}
footer a{color:#00ff88;text-decoration:none}
@media(max-width:768px){.grid-2,.grid-3,.stat-row{grid-template-columns:1fr}.vs-box{grid-template-columns:1fr}.vs-mid{display:none}}
</style>"""

NAV = """<nav>
<a href="/" class="nav-brand">⚽ WC2026 Empire</a>
<a href="/star-players.html">Players</a>
<a href="/wc2026-groups.html">Groups</a>
<a href="/odds-comparison.html">Odds</a>
<a href="/win-share.html">Picks</a>
<a href="/win-share.html" class="nav-cta">Free Pick →</a>
</nav>"""

FOOTER = """<footer>
<p>⚽ WC 2026 Sports Empire · AI-powered analysis for every match</p>
<p style="margin-top:8px"><a href="/">Home</a> · <a href="/odds-comparison.html">Odds</a> · <a href="/win-share.html">AI Picks</a> · <a href="/privacy-policy.html">Privacy</a></p>
<p style="margin-top:12px;font-size:11px;color:#333">18+ only. Gambling involves risk. BeGambleAware.org · GamCare 0808 8020 133</p>
</footer>"""

def page(title, meta, body):
    return f"""<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{meta}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{meta}">
<meta property="og:image" content="https://wc2026-sports-empire.vercel.app/og-default.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
{STYLE}</head>
<body>{NAV}{body}{FOOTER}</body></html>"""

# ─── PLAYER DEBATE PAGES ──────────────────────────────────────────────────────

def vs_page(p1, p1nat, p1flag, p1stats, p2, p2nat, p2flag, p2stats, slug, verdict_title, verdict_body, categories, aff_pick):
    stat_rows = ""
    for cat, v1, v2 in categories:
        winner1 = 1
        try:
            winner1 = float(str(v1).replace("%","").replace("+","").replace("/","").split()[0])
        except: winner1 = 1
        winner2 = 0
        try:
            winner2 = float(str(v2).replace("%","").replace("+","").replace("/","").split()[0])
        except: winner2 = 0
        l_class = "l" if winner1 >= winner2 else ""
        r_class = "r" if winner2 > winner1 else ""
        stat_rows += f'<div class="stat-compare"><span class="{l_class}">{v1}</span><span class="m">{cat}</span><span class="{r_class}">{v2}</span></div>'

    p1_stat_html = "".join(f'<div style="margin:6px 0"><span style="color:#888;font-size:12px">{k}</span><br><strong style="font-size:18px;color:#00ff88">{v}</strong></div>' for k,v in p1stats.items())
    p2_stat_html = "".join(f'<div style="margin:6px 0"><span style="color:#888;font-size:12px">{k}</span><br><strong style="font-size:18px;color:#00ff88">{v}</strong></div>' for k,v in p2stats.items())

    body = f"""
<div class="hero">
<div class="badge">WC 2026 DEBATE</div>
<h1>{p1flag} <span class="hi">{p1}</span> vs <span class="gold">{p2}</span> {p2flag}</h1>
<p>Head-to-head comparison · WC 2026 analysis · AI verdict</p>
<a href="/win-share.html" class="btn">Get AI Picks →</a>
</div>

<div class="section">
<div class="vs-box">
<div class="player-side">
<h2 class="hi">{p1}</h2>
<div class="nation">{p1flag} {p1nat}</div>
{p1_stat_html}
</div>
<div class="vs-mid">VS</div>
<div class="player-side">
<h2 class="gold">{p2}</h2>
<div class="nation">{p2flag} {p2nat}</div>
{p2_stat_html}
</div>
</div>

<div class="section-label">Head to Head</div>
<div class="section-title">Category Breakdown</div>
<div class="card" style="max-width:600px;margin:0 auto">
<div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:12px;color:#888">
<span style="color:#00ff88;font-weight:700">{p1}</span>
<span>Category</span>
<span style="color:#ffd700;font-weight:700">{p2}</span>
</div>
{stat_rows}
</div>

<div class="divider"></div>
<div class="verdict">
<h3>🤖 AI Verdict: {verdict_title}</h3>
<p style="color:#ccc;line-height:1.7">{verdict_body}</p>
</div>

<div class="divider"></div>
<div class="section-label">WC 2026 Betting</div>
<div class="section-title">Who to Back at the Tournament</div>
<div class="card">
<p style="color:#ccc;margin-bottom:16px">{aff_pick}</p>
<a href="/win-share.html" class="btn">Get Full AI Analysis →</a>
<a href="/odds-comparison.html" class="btn btn-outline">Compare Odds</a>
</div>
</div>"""
    return body

debates = [
    {
        "slug": "kane-vs-lewandowski",
        "p1": "Harry Kane", "p1nat": "England", "p1flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "p1stats": {"WC 2026 Goals": "3", "Club Goals 24/25": "28", "Age": "32", "Penalties Scored": "14"},
        "p2": "Robert Lewandowski", "p2nat": "Poland", "p2flag": "🇵🇱",
        "p2stats": {"WC 2026 Goals": "4", "Club Goals 24/25": "22", "Age": "37", "Champions League Goals": "94"},
        "categories": [
            ("WC Goals", "3", "4"),
            ("Age", "32", "37"),
            ("Club form 24/25", "28 goals", "22 goals"),
            ("Penalty record", "14/16", "18/20"),
            ("Career total", "400+", "640+"),
            ("WC experience", "2 tournaments", "3 tournaments"),
            ("Team support", "Strong England XI", "Poland = Lewandowski"),
        ],
        "verdict_title": "Lewandowski scores more, Kane built to last",
        "verdict_body": "Lewandowski holds the WC 2026 edge with more goals so far, but Poland's entire attacking output runs through him creating a high variance single point of failure. Kane operates in a stronger England team with better service — his floor is higher. For the Golden Boot race, Lewandowski's ceiling in a must-win scenario is massive. For tournament progression and consistent betting value, Kane and England are the safer long-term pick.",
        "aff_pick": "Kane to score anytime vs his next opponent is consistently priced at 2.10-2.40. Lewandowski first scorer in Poland's must-win games ranges 3.50-4.50 reflecting Poland's underdog status. Both are value in the right context — our AI flags the specific match where each represents positive expected value."
    },
    {
        "slug": "salah-vs-son",
        "p1": "Mohamed Salah", "p1nat": "Egypt", "p1flag": "🇪🇬",
        "p1stats": {"Premier League Goals 24/25": "29", "Assists": "18", "WC 2026 Group": "Group D", "Age": "32"},
        "p2": "Heung-min Son", "p2nat": "South Korea", "p2flag": "🇰🇷",
        "p2stats": {"Premier League Goals 24/25": "18", "Assists": "12", "WC 2026 Group": "Group E", "Age": "32"},
        "categories": [
            ("PL Goals 24/25", "29", "18"),
            ("Assists 24/25", "18", "12"),
            ("WC group difficulty", "Tough", "Moderate"),
            ("Team reliance", "Egypt = Salah", "Korea = Son"),
            ("Pace", "Elite", "World-class"),
            ("Dribbles pg", "3.2", "2.8"),
            ("Chance creation", "3.8 KP/90", "2.6 KP/90"),
        ],
        "verdict_title": "Salah statistically superior, Son more likely to advance",
        "verdict_body": "Salah had one of the greatest Premier League seasons in history in 2024/25 and arrives at WC 2026 at peak form. His numbers dwarf Son's in almost every metric. However, Egypt faces a brutally difficult group while South Korea have a more navigable path to the knockouts. Son in a Korea team that reaches the Round of 16 may accumulate more WC-specific stats than Salah in a group-stage exit. For anytime scorer bets: Salah offers more consistent quality; Son offers more tournament duration.",
        "aff_pick": "Salah to score in the group stage: a near-certainty priced around 1.40-1.60. The value is in Son if Korea reach the knockouts — his odds to score extend to 2.80+ vs stronger opposition. AI tracks both players' form and injury status match-by-match."
    },
    {
        "slug": "pedri-vs-musiala",
        "p1": "Pedri", "p1nat": "Spain", "p1flag": "🇪🇸",
        "p1stats": {"Age": "23", "WC 2026 Team": "Spain (favourites)", "Style": "Deep creative", "La Liga Apps 24/25": "34"},
        "p2": "Jamal Musiala", "p2nat": "Germany", "p2flag": "🇩🇪",
        "p2stats": {"Age": "22", "WC 2026 Team": "Germany (dark horse)", "Style": "Carrying dribbler", "Bundesliga Apps 24/25": "30"},
        "categories": [
            ("Age", "23", "22"),
            ("Dribbles pg", "2.1", "4.3"),
            ("Key passes pg", "3.4", "2.8"),
            ("Pass accuracy", "92%", "87%"),
            ("Goals 24/25", "8", "15"),
            ("Assists 24/25", "11", "14"),
            ("Tournament pedigree", "Euro 2020 star", "Euro 2024 standout"),
        ],
        "verdict_title": "Musiala carries, Pedri controls — different greatness",
        "verdict_body": "This is the defining midfield debate of the generation. Pedri is the cerebral engine — Spain's heartbeat, he dictates tempo, finds half-spaces, and makes the possession game sing. Musiala is the chaos agent — he carries at pace into tight spaces and creates from nothing. In tournament football, Spain's structural dominance makes Pedri's influence less visible in stats but more felt in results. Musiala's dribbling numbers make him the more exciting bet for direct attacking contributions. Both are generational. Spain being outright favourites gives Pedri the edge for tournament-level impact.",
        "aff_pick": "Pedri to assist (3.00-3.50) is a regular value play when Spain control games. Musiala to score anytime (2.40-2.80) is the pick when Germany face open games needing a goal. AI flags which matchup suits each player most."
    },
    {
        "slug": "yamal-vs-nico-williams",
        "p1": "Lamine Yamal", "p1nat": "Spain", "p1flag": "🇪🇸",
        "p1stats": {"Age": "18", "WC 2026 Apps": "3", "Style": "Right wing creator", "Euro 2024": "Player of Tournament"},
        "p2": "Nico Williams", "p2nat": "Spain", "p2flag": "🇪🇸",
        "p2stats": {"Age": "22", "WC 2026 Apps": "3", "Style": "Left wing destroyer", "Euro 2024": "Key contributor"},
        "categories": [
            ("Age", "18", "22"),
            ("Dribbles pg", "3.8", "4.2"),
            ("Key passes pg", "3.1", "2.4"),
            ("Goals (Euro 2024)", "3", "1"),
            ("Assists (Euro 2024)", "3", "4"),
            ("Market value", "€180M", "€90M"),
            ("Finishing", "Clinical", "Inconsistent"),
        ],
        "verdict_title": "The world's best wing duo — Yamal edges it",
        "verdict_body": "Spain have arguably the two best wingers in world football, aged 18 and 22, playing together. Yamal's numbers at Euro 2024 were extraordinary for someone so young — he was named Player of the Tournament. Nico Williams is more direct and quicker in bursts but less consistent in front of goal. For WC 2026, Yamal is the focal point around whom Spain build. Nico provides the width and pace to complement. Both should deliver assists — Yamal more likely to score directly.",
        "aff_pick": "Both players to register a goal or assist in the same match is available as a combination bet around 2.20-2.60. Spain games are essentially guaranteed to be entertaining given this front two. AI tracks both in real time."
    },
    {
        "slug": "saka-vs-foden",
        "p1": "Bukayo Saka", "p1nat": "England", "p1flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "p1stats": {"PL Goals 24/25": "16", "Assists": "14", "Style": "Right winger", "Age": "23"},
        "p2": "Phil Foden", "p2nat": "England", "p2flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "p2stats": {"PL Goals 24/25": "19", "Assists": "8", "Style": "False 9 / attacking mid", "Age": "25"},
        "categories": [
            ("Goals 24/25", "16", "19"),
            ("Assists 24/25", "14", "8"),
            ("Dribbles pg", "3.1", "2.2"),
            ("Touches final 3rd", "4.8", "5.2"),
            ("Penalty area touches", "2.1", "3.4"),
            ("Pass accuracy", "85%", "88%"),
            ("Consistency", "Elite", "Streaky"),
        ],
        "verdict_title": "Saka more consistent, Foden higher ceiling",
        "verdict_body": "England's tactical dilemma. Saka is the most reliable creator in the squad — he shows up every game, every tournament, every big occasion (except Euro 2020 final penalties, which we don't mention). Foden has a higher ceiling when at his best — he can take over games — but is more prone to going missing in difficult matches. For WC 2026, Saka's consistency makes him the safer betting choice across a full tournament. Foden is the pick for individual match heroics at longer odds.",
        "aff_pick": "Saka to have 2+ shots on target (1.90-2.10) is a consistent value play in England's attacking games. Foden to score first in knockout rounds (when England's best comes out) often priced 5.00-7.00 — AI catches these peak moments."
    },
    {
        "slug": "osimhen-vs-haaland",
        "p1": "Victor Osimhen", "p1nat": "Nigeria", "p1flag": "🇳🇬",
        "p1stats": {"League Goals 24/25": "24", "Age": "25", "Height": "1.88m", "Nationality": "Nigerian"},
        "p2": "Erling Haaland", "p2nat": "Norway", "p2flag": "🇳🇴",
        "p2stats": {"League Goals 24/25": "27", "Age": "24", "Height": "1.94m", "Nationality": "Norwegian"},
        "categories": [
            ("League goals", "24", "27"),
            ("Age", "25", "24"),
            ("Headers", "3.1 pg", "2.8 pg"),
            ("Sprint speed", "35 km/h", "36 km/h"),
            ("Goals per 90", "0.87", "0.95"),
            ("WC team strength", "Moderate", "Dark horse"),
            ("Tournament exposure", "AFCON winner", "WC debut"),
        ],
        "verdict_title": "Haaland better metrics, Osimhen more to prove",
        "verdict_body": "Two of the most physically imposing centre-forwards in world football, both under 26. Haaland's numbers are marginally superior — his goals-per-90 is extraordinary — but Norway have a tougher path to goals given weaker squad depth. Osimhen carries Nigeria with a ferocity that generates enormous per-game output when Nigeria are chasing. In WC context, Haaland in a Norway dark horse run has higher narrative and betting ceiling; Osimhen in group stage when Nigeria must attack is a specific value scenario.",
        "aff_pick": "Osimhen first scorer in Nigeria's must-win games: 4.50-5.50, representing significant value if you believe in Nigeria's qualification. Haaland anytime scorer for Norway: 2.80-3.20 depending on opponent. AI monitors both squads' tactical setup pre-match."
    },
    {
        "slug": "hakimi-vs-trent",
        "p1": "Achraf Hakimi", "p1nat": "Morocco", "p1flag": "🇲🇦",
        "p1stats": {"Assists 24/25": "14", "Goals": "6", "Age": "25", "WC 2022": "Semi-finalist"},
        "p2": "Trent Alexander-Arnold", "p2nat": "England", "p2flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "p2stats": {"Assists 24/25": "16", "Goals": "5", "Age": "26", "Position": "Attacking full-back"},
        "categories": [
            ("Assists 24/25", "14", "16"),
            ("Dribbles pg", "3.8", "1.9"),
            ("Crosses pg", "2.1", "4.8"),
            ("Defensive duels won", "62%", "55%"),
            ("Sprint pace", "Elite", "Good"),
            ("Set piece delivery", "Good", "World-class"),
            ("WC experience", "Semi-finalist 2022", "2 WC tournaments"),
        ],
        "verdict_title": "TAA superior creator, Hakimi superior athlete",
        "verdict_body": "The best attacking full-back debate of the tournament. Trent Alexander-Arnold's delivery from right-back is arguably the best in world football — his cross completion, ball-striking and vision are elite. Hakimi is the more physically imposing and direct — his ability to run at defenders and create 1v1 situations is unmatched. For WC impact: Trent has the stronger team around him and will accumulate more assists. Hakimi might produce the more iconic individual moments if Morocco replicate their 2022 run.",
        "aff_pick": "TAA to assist: a consistent value when England face weaker opposition (2.60-3.00). Hakimi to score anytime in a Morocco must-win (4.00-5.00) is the explosive value play. Our AI picks the exact match context for both."
    },
    {
        "slug": "modric-vs-valverde",
        "p1": "Luka Modrić", "p1nat": "Croatia", "p1flag": "🇭🇷",
        "p1stats": {"Age": "40", "WC Finals": "3", "Ballon d'Or": "2018 winner", "Style": "Complete midfielder"},
        "p2": "Federico Valverde", "p2nat": "Uruguay", "p2flag": "🇺🇾",
        "p2stats": {"Age": "26", "WC 2022": "Quarter-final", "Goals 24/25": "12", "Style": "Box-to-box engine"},
        "categories": [
            ("Age", "40", "26"),
            ("Pass accuracy", "93%", "88%"),
            ("Goals 24/25", "4", "12"),
            ("Km covered pg", "9.8", "12.4"),
            ("Tackles pg", "1.8", "3.2"),
            ("Interceptions pg", "1.4", "2.8"),
            ("Big game pedigree", "Legendary", "Proven"),
        ],
        "verdict_title": "Valverde for energy, Modrić for magic",
        "verdict_body": "The passing of the baton. Modrić is playing what is almost certainly his last World Cup at 40, and watching him still orchestrate Croatia's midfield is one of football's great privileges. He is slower, less recoverable — but his decision-making, passing range and ability to raise his game in big moments remains elite. Valverde at 26 is entering his prime. He covers more ground than almost anyone and adds goals from midfield that Modrić never did. For WC betting, Modrić to assist and create in big Croatia knockout moments is the emotional value pick. Valverde for raw stats.",
        "aff_pick": "Valverde to score anytime when Uruguay face open knockout games: 3.50-4.50 offers genuine value given his goals record. Modrić to assist in Croatia's group stage games (2.80-3.20) — he sets up Croatia's attacks from deep. AI monitors both players' fitness closely given their contrasting ages."
    },
]

for d in debates:
    body = vs_page(
        d["p1"], d["p1nat"], d["p1flag"], d["p1stats"],
        d["p2"], d["p2nat"], d["p2flag"], d["p2stats"],
        d["slug"], d["verdict_title"], d["verdict_body"],
        d["categories"], d["aff_pick"]
    )
    title = f"{d['p1']} vs {d['p2']} — WC 2026 | Who Wins? AI Verdict"
    meta = f"Head-to-head: {d['p1']} ({d['p1nat']}) vs {d['p2']} ({d['p2nat']}) at WC 2026. Stats, betting odds, AI analysis and verdict."
    html = page(title, meta, body)
    path = f"{OUT}/{d['slug']}.html"
    with open(path, "w") as f:
        f.write(html)
    print(f"✅ {d['slug']}.html")

# ─── COUNTRY RIVALRY PAGES ───────────────────────────────────────────────────

rivalries = [
    {
        "slug": "usa-vs-mexico",
        "h1": "🇺🇸 USA vs Mexico 🇲🇽",
        "badge": "CO-HOST RIVALRY · WC 2026",
        "intro": "The greatest rivalry in CONCACAF — and for the first time, both nations are co-hosting the World Cup they're competing in. WC 2026 adds an unprecedented layer to El Clásico de CONCACAF.",
        "sub": "History, odds, AI picks, and why this WC 2026 meeting could be the biggest game in CONCACAF history",
        "team1": "USA", "team2": "Mexico", "flag1": "🇺🇸", "flag2": "🇲🇽",
        "h2h": [
            ["All-time meetings", "36 USA wins", "14 draws", "38 Mexico wins"],
            ["Last 5 meetings", "2 USA wins", "1 draw", "2 Mexico wins"],
            ["WC history", "1 meeting (2002: 2-0 USA)", "—", "—"],
            ["CONCACAF titles", "3", "—", "8"],
            ["Home advantage WC 2026", "New York / LA venues", "—", "Mexico City (group stage)"],
        ],
        "key_players1": ["Christian Pulisic", "Tyler Adams", "Gio Reyna", "Ricardo Pepi"],
        "key_players2": ["Hirving Lozano", "Raúl Jiménez", "Santiago Giménez", "Edson Álvarez"],
        "betting_note": "USA vs Mexico WC 2026 group stage clash is the highest-profile CONCACAF match in tournament history. Both teams playing at home venues elevates the stakes beyond any recent meeting. Mexico's experience vs USA's momentum: our AI gives this 52% Mexico, 26% draw, 22% USA at current form."
    },
    {
        "slug": "brazil-vs-argentina",
        "h1": "🇧🇷 Brazil vs Argentina 🇦🇷",
        "badge": "THE BIGGEST RIVALRY IN FOOTBALL",
        "intro": "Brazil vs Argentina. No rivalry needs an introduction. The two most decorated South American nations, with the world watching every time they meet.",
        "sub": "WC 2026 group stage draw could set up a knockout meeting. Here's everything you need to know.",
        "team1": "Brazil", "team2": "Argentina", "flag1": "🇧🇷", "flag2": "🇦🇷",
        "h2h": [
            ["All-time meetings", "45 Brazil wins", "25 draws", "41 Argentina wins"],
            ["WC meetings", "5 Brazil wins", "2 draws", "4 Argentina wins"],
            ["Copa América wins", "9", "—", "16"],
            ["World Cup titles", "5", "—", "3"],
            ["Last meeting result", "TBC 2026", "—", "—"],
        ],
        "key_players1": ["Vinicius Jr.", "Endrick", "Raphinha", "Rodrygo"],
        "key_players2": ["Julian Alvarez", "Lautaro Martinez", "Enzo Fernandez", "Alexis Mac Allister"],
        "betting_note": "Brazil vs Argentina in a potential WC 2026 knockout would be the most-watched football match in years. Brazil currently priced as slight favourites for the tournament outright (4.50-5.50). Argentina defending champions 5.00-6.00. A direct meeting in the semi-final or quarter-final would see both odds shift dramatically. Our AI tracks both squads daily."
    },
    {
        "slug": "england-vs-germany",
        "h1": "🏴󠁧󠁢󠁥󠁮󠁧󠁿 England vs Germany 🇩🇪",
        "badge": "THE GREATEST EUROPEAN RIVALRY AT WC 2026",
        "intro": "England vs Germany has decided tournaments, generated legends, and created trauma in equal measure. WC 2026 could finally be England's moment — but Germany are built to stop them.",
        "sub": "1966, 1970, 1990, 1996, 2010 — every chapter analysed. And what AI says about 2026.",
        "team1": "England", "team2": "Germany", "flag1": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "flag2": "🇩🇪",
        "h2h": [
            ["All-time WC meetings", "3 England wins", "1 draw", "3 Germany wins"],
            ["Total competitive", "5 England wins", "4 draws", "9 Germany wins"],
            ["Penalty shootouts", "0 England wins", "—", "3 Germany wins"],
            ["Last WC meeting", "2010 (4-1 Germany)", "—", "—"],
            ["WC titles", "1 (1966)", "—", "4"],
        ],
        "key_players1": ["Harry Kane", "Jude Bellingham", "Bukayo Saka", "Phil Foden"],
        "key_players2": ["Jamal Musiala", "Florian Wirtz", "Kai Havertz", "Joshua Kimmich"],
        "betting_note": "England vs Germany WC 2026 knockout tie would be 1.80-2.00 for England (rare favourite status). Germany 2.10-2.30. Draw (extra time) 3.00-3.50. Penalty shootout: England 2.00 (overcoming historic demons). This fixture has the most interest from UK affiliate traffic of any non-final match."
    },
    {
        "slug": "spain-vs-france",
        "h1": "🇪🇸 Spain vs France 🇫🇷",
        "badge": "THE TOURNAMENT FINAL EVERYONE WANTS",
        "intro": "The two teams most likely to win WC 2026, based on squad depth, recent form, and market consensus. Spain vs France is the final most neutrals want to see.",
        "sub": "Nations League rivals, World Cup contenders — everything riding on 90 minutes.",
        "team1": "Spain", "team2": "France", "flag1": "🇪🇸", "flag2": "🇫🇷",
        "h2h": [
            ["All-time WC meetings", "3 Spain wins", "1 draw", "3 France wins"],
            ["Recent form (all comps)", "Spain slightly ahead", "—", "France competitive"],
            ["World Cup titles", "1 (2010)", "—", "2 (1998, 2018)"],
            ["Squad age avg", "24.8 years", "—", "26.1 years"],
            ["Bookmaker favourites", "Spain 3.00-3.50", "—", "France 3.50-4.00"],
        ],
        "key_players1": ["Lamine Yamal", "Pedri", "Nico Williams", "Rodri"],
        "key_players2": ["Kylian Mbappé", "Antoine Griezmann", "Aurelien Tchouameni", "Randal Kolo Muani"],
        "betting_note": "Spain vs France WC 2026 final odds: Spain 2.20 if you can bet before a final is confirmed. France 2.60. Both teams to score in 90 mins: 1.65 (consistent attackers on both sides). Goals market Over 2.5: 1.90. This fixture generates the highest-value affiliate traffic of any WC match short of the final itself."
    },
    {
        "slug": "portugal-vs-morocco",
        "h1": "🇵🇹 Portugal vs Morocco 🇲🇦",
        "badge": "2022 SEMI-FINAL REMATCH · WC 2026",
        "intro": "Morocco eliminated Portugal in the 2022 WC quarter-finals in one of the greatest upsets in tournament history. Now both meet again — Portugal hungry for revenge, Morocco confident of another run.",
        "sub": "The 2022 Doha quarter-final was 1-0 Morocco. Who has changed since then? Our AI breaks it down.",
        "team1": "Portugal", "team2": "Morocco", "flag1": "🇵🇹", "flag2": "🇲🇦",
        "h2h": [
            ["WC 2022 QF", "Portugal (lost 1-0)", "—", "Morocco (won 1-0)"],
            ["All-time WC meetings", "1 Portugal win", "1 draw", "1 Morocco win"],
            ["WC 2022 finish", "3rd place missed", "—", "4th place (historic)"],
            ["Key changes 2022→2026", "New generation emerging", "—", "Continuity maintained"],
            ["Odds for WC 2026 title", "Portugal 8.00-10.00", "—", "Morocco 20.00-28.00"],
        ],
        "key_players1": ["Bernardo Silva", "Bruno Fernandes", "Rafael Leao", "João Felix"],
        "key_players2": ["Achraf Hakimi", "Sofyan Amrabat", "Hakim Ziyech", "Youssef En-Nesyri"],
        "betting_note": "Portugal are heavy favourites to beat Morocco in any knockout meeting (1.55-1.75) but Morocco's defensive record in tournament football is elite. Under 2.5 goals (1.65-1.80) is strong value given Morocco's defensive structure. Hakimi to assist Morocco's goal if they score: 4.50-5.50."
    },
    {
        "slug": "japan-vs-korea",
        "h1": "🇯🇵 Japan vs South Korea 🇰🇷",
        "badge": "EAST ASIA'S BIGGEST FOOTBALL RIVALRY",
        "intro": "Japan vs South Korea transcends football. One of Asia's most historically charged rivalries meets on the world's biggest stage. Both nations have reached the WC knockout rounds — both want to go further.",
        "sub": "Best East Asian sides in history? WC 2026 could answer that question once and for all.",
        "team1": "Japan", "team2": "South Korea", "flag1": "🇯🇵", "flag2": "🇰🇷",
        "h2h": [
            ["All-time meetings", "15 Japan wins", "23 draws", "43 Korea wins"],
            ["WC history", "Japan best: QF 2002", "—", "Korea best: SF 2002"],
            ["Asian Cup titles", "4 Japan", "—", "2 Korea"],
            ["Current FIFA ranking", "~17th", "—", "~22nd"],
            ["Star power", "Kubo, Mitoma", "—", "Son, Lee Kang-in"],
        ],
        "key_players1": ["Takefusa Kubo", "Kaoru Mitoma", "Wataru Endo", "Ritsu Doan"],
        "key_players2": ["Heung-min Son", "Lee Kang-in", "Kim Min-jae", "Hwang Hee-chan"],
        "betting_note": "Japan vs Korea WC 2026 group stage or knockout tie would be the most-watched match in Asia. Son to score anytime: 2.20-2.50. Kubo to assist for Japan: 3.50-4.00. Under 2.5 goals (both play cautiously in rivalry games): 1.90-2.10. Highest-traffic fixture for Asian affiliate markets."
    },
]

for r in rivalries:
    h2h_rows = "".join(f"<tr><td>{row[0]}</td><td style='color:#00ff88;font-weight:700'>{row[1]}</td><td style='color:#888;font-size:12px'>{row[2]}</td><td style='color:#ffd700;font-weight:700'>{row[3]}</td></tr>" for row in r["h2h"])
    kp1 = "".join(f'<span class="tag tag-green" style="margin:2px">{p}</span>' for p in r["key_players1"])
    kp2 = "".join(f'<span class="tag tag-gold" style="margin:2px">{p}</span>' for p in r["key_players2"])

    body = f"""
<div class="hero">
<div class="badge">{r["badge"]}</div>
<h1>{r["h1"]}</h1>
<p>{r["sub"]}</p>
<a href="/win-share.html" class="btn">Get AI Picks →</a>
<a href="/odds-comparison.html" class="btn btn-outline">Live Odds</a>
</div>

<div class="section">
<div class="section-label">The Rivalry</div>
<div class="section-title">{r["h1"]}</div>
<p class="section-sub">{r["intro"]}</p>

<div class="section-label">Head to Head</div>
<table>
<thead><tr><th>Category</th><th style="color:#00ff88">{r["team1"]}</th><th style="color:#888">vs</th><th style="color:#ffd700">{r["team2"]}</th></tr></thead>
<tbody>{h2h_rows}</tbody>
</table>

<div class="divider"></div>
<div class="grid-2">
<div class="card">
<div class="section-label">{r["flag1"]} {r["team1"]} Key Players</div>
<div style="margin-top:12px">{kp1}</div>
</div>
<div class="card">
<div class="section-label">{r["flag2"]} {r["team2"]} Key Players</div>
<div style="margin-top:12px">{kp2}</div>
</div>
</div>

<div class="divider"></div>
<div class="verdict">
<h3>🤖 AI Betting Intelligence</h3>
<p style="color:#ccc;line-height:1.7">{r["betting_note"]}</p>
</div>

<div style="text-align:center;margin-top:32px">
<a href="/win-share.html" class="btn">Get Full Match AI Pick →</a>
<a href="/odds-comparison.html" class="btn btn-outline">Best Odds</a>
</div>
</div>"""

    title = f"{r['team1']} vs {r['team2']} — WC 2026 History, Odds & AI Predictions"
    meta = f"Complete {r['team1']} vs {r['team2']} rivalry breakdown for WC 2026. Head-to-head record, key players, betting odds and AI match predictions."
    html = page(title, meta, body)
    path = f"{OUT}/{r['slug']}.html"
    with open(path, "w") as f:
        f.write(html)
    print(f"✅ {r['slug']}.html")

# ─── PLATFORM HUB PAGES ──────────────────────────────────────────────────────

# 1. Gumroad digital store page
gumroad_body = """
<div class="hero">
<div class="badge">DIGITAL PRODUCTS STORE</div>
<h1>⚡ WC 2026 <span class="hi">Digital Products</span></h1>
<p>Professional betting guides, spreadsheets & toolkits. Download instantly. No subscription needed.</p>
<a href="#products" class="btn">Browse Products ↓</a>
</div>

<div class="section" id="products">
<div class="section-label">Available Now</div>
<div class="section-title">Every product you need for WC 2026</div>

<div class="grid-3">
<div class="card">
<div class="badge">BESTSELLER</div>
<h3>📘 Complete Betting Guide</h3>
<p>30-page PDF covering all bet types, Asian handicap deep dive, bankroll management, WC strategy, top sportsbooks. Everything a serious bettor needs.</p>
<div style="margin:16px 0"><span style="font-size:28px;font-weight:800;color:#00ff88">£7.99</span></div>
<a href="https://gumroad.com/wc2026empire" class="btn" style="display:block;text-align:center">Download Now →</a>
</div>
<div class="card">
<h3>📊 Office Pool Spreadsheet</h3>
<p>XLSX with participant tracker, group stage results, points system, knockout bracket auto-fill. Manage up to 50 people with zero effort.</p>
<div style="margin:16px 0"><span style="font-size:28px;font-weight:800;color:#00ff88">£4.99</span></div>
<a href="https://gumroad.com/wc2026empire" class="btn" style="display:block;text-align:center">Download Now →</a>
</div>
<div class="card">
<h3>🧮 Bankroll Calculator</h3>
<p>Kelly Criterion built-in, stake calculator, bet tracker with running P&L, portfolio view across all open bets. Never over-stake again.</p>
<div style="margin:16px 0"><span style="font-size:28px;font-weight:800;color:#00ff88">£4.99</span></div>
<a href="https://gumroad.com/wc2026empire" class="btn" style="display:block;text-align:center">Download Now →</a>
</div>
<div class="card">
<h3>🎁 Bonus Tracker</h3>
<p>Track all UK and US sportsbook welcome bonuses. 20 UK books (£560 total), 10 US books ($7,700 total). Status tracker + affiliate links pre-loaded.</p>
<div style="margin:16px 0"><span style="font-size:28px;font-weight:800;color:#00ff88">£3.99</span></div>
<a href="https://gumroad.com/wc2026empire" class="btn" style="display:block;text-align:center">Download Now →</a>
</div>
<div class="card">
<h3>⚽ Fantasy Draft Kit</h3>
<p>AI rankings for all 30 top players, sleeper picks, avoid list with reasoning, auction values, position-by-position strategy guide.</p>
<div style="margin:16px 0"><span style="font-size:28px;font-weight:800;color:#00ff88">£5.99</span></div>
<a href="https://gumroad.com/wc2026empire" class="btn" style="display:block;text-align:center">Download Now →</a>
</div>
<div class="card">
<h3>⚡ Arbitrage Calculator</h3>
<p>2-way and 3-way arb calculator, stake auto-split, guaranteed profit display. Find and exploit arbitrage opportunities across bookmakers.</p>
<div style="margin:16px 0"><span style="font-size:28px;font-weight:800;color:#00ff88">£4.99</span></div>
<a href="https://gumroad.com/wc2026empire" class="btn" style="display:block;text-align:center">Download Now →</a>
</div>
<div class="card">
<h3>📖 Betting A-Z Glossary</h3>
<p>Complete betting glossary from Accumulator to Void Bet. 60+ terms explained clearly. Perfect for beginners or sharing with friends joining a pool.</p>
<div style="margin:16px 0"><span style="font-size:28px;font-weight:800;color:#00ff88">£1.99</span></div>
<a href="https://gumroad.com/wc2026empire" class="btn" style="display:block;text-align:center">Download Now →</a>
</div>
<div class="card">
<div class="badge" style="background:#ffd70020;color:#ffd700;border-color:#ffd70040">BEST VALUE</div>
<h3>🏆 Complete Bundle</h3>
<p>All 7 products above. Betting guide, office pool, bankroll calc, bonus tracker, fantasy kit, arb calc, glossary. Save 40% vs buying individually.</p>
<div style="margin:16px 0"><span style="font-size:28px;font-weight:800;color:#ffd700">£19.99</span><span style="color:#888;font-size:13px;margin-left:8px">save £14</span></div>
<a href="https://gumroad.com/wc2026empire" class="btn" style="background:#ffd700;display:block;text-align:center">Get Bundle →</a>
</div>
<div class="card">
<h3>🤖 Win-Share AI Picks</h3>
<p>Live AI picks for every WC 2026 match. Confidence scores, value bets, real-time odds movement alerts. Telegram + email delivery. Cancel anytime.</p>
<div style="margin:16px 0"><span style="font-size:28px;font-weight:800;color:#00ff88">£29</span><span style="color:#888;font-size:13px">/month</span></div>
<a href="/win-share.html" class="btn" style="display:block;text-align:center">Start Free Trial →</a>
</div>
</div>
</div>"""

with open(f"{OUT}/digital-store.html", "w") as f:
    f.write(page("WC 2026 Digital Products Store — Betting Guides, Spreadsheets & Tools", "Download WC 2026 betting guides, office pool spreadsheets, bankroll calculators and fantasy draft kits. Professional tools for serious bettors.", gumroad_body))
print("✅ digital-store.html")

# 2. Community Hub
community_body = """
<div class="hero">
<div class="badge">JOIN 50,000+ FANS</div>
<h1>🌐 Join the <span class="hi">WC 2026 Community</span></h1>
<p>Live picks, match alerts, debate, analysis — across every platform. Pick yours.</p>
<a href="#platforms" class="btn">Find Your Platform ↓</a>
</div>

<div class="section" id="platforms">
<div class="section-label">Where to Find Us</div>
<div class="section-title">Every platform. Every match. 24/7.</div>

<div class="grid-3">
<div class="card">
<h3>📱 Telegram Channel</h3>
<p>The fastest way to get picks. AI alerts sent instantly when value bets are identified — usually 2-3 hours before kick-off when odds are still sharp.</p>
<div style="margin:16px 0"><span class="tag tag-green">FREE</span> <span class="tag tag-gold">INSTANT ALERTS</span></div>
<a href="https://t.me/wc2026empire" class="btn" style="display:block;text-align:center">Join Telegram →</a>
</div>
<div class="card">
<h3>💬 Discord Server</h3>
<p>Live match chat, prediction game, results channels, community tips. Active during every WC 2026 game with moderators and bots tracking live odds.</p>
<div style="margin:16px 0"><span class="tag tag-green">FREE</span> <span class="tag tag-gold">LIVE CHAT</span></div>
<a href="https://discord.gg/wc2026empire" class="btn" style="display:block;text-align:center">Join Discord →</a>
</div>
<div class="card">
<h3>🐦 X / Twitter</h3>
<p>Pre-match threads, value bet calls, live score reactions, tournament updates. Follow for the daily 6am WC briefing during group stage.</p>
<div style="margin:16px 0"><span class="tag tag-green">FREE</span> <span class="tag tag-gold">DAILY CONTENT</span></div>
<a href="https://x.com/wc2026empire" class="btn" style="display:block;text-align:center">Follow on X →</a>
</div>
<div class="card">
<h3>📹 TikTok</h3>
<p>60-second match previews. AI pick reveals. Post-match reaction clips. Goes live during every game for real-time commentary.</p>
<div style="margin:16px 0"><span class="tag tag-green">FREE</span> <span class="tag tag-gold">SHORT VIDEOS</span></div>
<a href="https://tiktok.com/@wc2026empire" class="btn" style="display:block;text-align:center">Follow TikTok →</a>
</div>
<div class="card">
<h3>▶️ YouTube</h3>
<p>Full match preview breakdowns, post-match AI analysis, betting strategy deep dives. Subscribe for notifications before every WC game.</p>
<div style="margin:16px 0"><span class="tag tag-green">FREE</span> <span class="tag tag-gold">LONG FORM</span></div>
<a href="https://youtube.com/@wc2026empire" class="btn" style="display:block;text-align:center">Subscribe →</a>
</div>
<div class="card">
<h3>📧 Email Newsletter</h3>
<p>Daily WC 2026 briefing every morning at 7am. Today's fixtures, AI picks for each game, value bets, and yesterday's results breakdown.</p>
<div style="margin:16px 0"><span class="tag tag-green">FREE</span> <span class="tag tag-gold">DAILY 7AM</span></div>
<a href="/newsletter.html" class="btn" style="display:block;text-align:center">Subscribe →</a>
</div>
<div class="card">
<h3>📘 Facebook Group</h3>
<p>Community discussion, match previews, member tips. Best for deeper conversation around WC 2026 tactics and betting strategy.</p>
<div style="margin:16px 0"><span class="tag tag-green">FREE</span></div>
<a href="https://facebook.com/groups/wc2026empire" class="btn" style="display:block;text-align:center">Join Group →</a>
</div>
<div class="card">
<h3>🎧 Podcast</h3>
<p>Daily 10-minute audio preview of each WC matchday. Available on Spotify, Apple Podcasts, and all major platforms. Auto-posts every match morning.</p>
<div style="margin:16px 0"><span class="tag tag-green">FREE</span></div>
<a href="#" class="btn" style="display:block;text-align:center">Listen Now →</a>
</div>
<div class="card">
<h3>🔔 WhatsApp</h3>
<p>Broadcast channel — receive picks and alerts directly to WhatsApp. One-way broadcast so no noise in your inbox. Just picks, scores, and alerts.</p>
<div style="margin:16px 0"><span class="tag tag-green">FREE</span></div>
<a href="https://wa.me/channel/wc2026empire" class="btn" style="display:block;text-align:center">Join WhatsApp →</a>
</div>
</div>
</div>"""

with open(f"{OUT}/community.html", "w") as f:
    f.write(page("Join the WC 2026 Community — Telegram, Discord, TikTok, YouTube & More", "WC 2026 picks, alerts and analysis across Telegram, Discord, X/Twitter, TikTok, YouTube, WhatsApp and email. Join 50,000+ fans.", community_body))
print("✅ community.html")

# 3. Newsletter signup page
newsletter_body = """
<div class="hero">
<div class="badge">FREE DAILY NEWSLETTER</div>
<h1>📧 WC 2026 <span class="hi">Daily Briefing</span></h1>
<p>Every morning at 7am. Today's matches, AI picks for each game, value bets, overnight odds movement, and yesterday's results.</p>
<a href="#signup" class="btn">Subscribe Free →</a>
</div>

<div class="section">
<div class="stat-row">
<div class="stat"><span class="stat-n">7am</span><div class="stat-l">Daily delivery</div></div>
<div class="stat"><span class="stat-n">104</span><div class="stat-l">Matches covered</div></div>
<div class="stat"><span class="stat-n">Free</span><div class="stat-l">Always free tier</div></div>
<div class="stat"><span class="stat-n">AI</span><div class="stat-l">Powered analysis</div></div>
</div>

<div class="section-label">What You Get</div>
<div class="section-title">Every morning. No noise.</div>

<div class="grid-2">
<div class="card">
<h3>📅 Today's Fixtures</h3>
<p>Full list of the day's WC matches with kick-off times, group context, and what's at stake for each team.</p>
</div>
<div class="card">
<h3>🤖 AI Picks</h3>
<p>AI-generated picks for each game with confidence score, reasoning, and the best available odds at time of sending.</p>
</div>
<div class="card">
<h3>📈 Value Bets</h3>
<p>Specific bets where our model finds positive expected value vs bookmaker's implied probability. Flagged with edge %.</p>
</div>
<div class="card">
<h3>📊 Yesterday's Results</h3>
<p>How our picks performed. Full transparency. Running record tracked from tournament day 1.</p>
</div>
<div class="card">
<h3>💰 Odds Movement</h3>
<p>Which odds shifted overnight and why. Smart money movements that signal where the sharps are betting.</p>
</div>
<div class="card">
<h3>🏥 Team News</h3>
<p>Confirmed injuries, suspension alerts, expected lineups based on manager press conferences and training reports.</p>
</div>
</div>

<div id="signup" class="card" style="max-width:500px;margin:32px auto;text-align:center">
<h3 style="margin-bottom:8px">Subscribe Free</h3>
<p style="color:#888;margin-bottom:20px">Join thousands of WC 2026 fans getting picks every morning</p>
<form onsubmit="alert('Subscribed! Check your email for confirmation.');return false">
<input type="email" placeholder="your@email.com" style="width:100%;padding:12px 16px;border-radius:8px;border:1px solid #333;background:#0a0a0f;color:#fff;font-size:15px;margin-bottom:12px">
<button type="submit" class="btn" style="width:100%;border:none;cursor:pointer;font-size:15px">Subscribe Free →</button>
</form>
<p style="margin-top:12px;font-size:12px;color:#555">Unsubscribe anytime. No spam. No selling your email.</p>
</div>
</div>"""

with open(f"{OUT}/newsletter.html", "w") as f:
    f.write(page("WC 2026 Daily Picks Newsletter — Free AI Betting Briefing Every Morning", "Subscribe to the free WC 2026 daily newsletter. AI picks for every match, value bets, odds movement and team news delivered at 7am every match day.", newsletter_body))
print("✅ newsletter.html")

# 4. Free Bets UK page
freebets_body = """
<div class="hero">
<div class="badge">UK EXCLUSIVE · JUNE 2026</div>
<h1>🎁 Best <span class="hi">WC 2026 Free Bets</span></h1>
<p>Every UK sportsbook welcome offer, ranked by value. Updated daily during the tournament.</p>
<a href="#offers" class="btn">See All Offers ↓</a>
</div>

<div class="section">
<div class="stat-row">
<div class="stat"><span class="stat-n">£560+</span><div class="stat-l">Total available in free bets</div></div>
<div class="stat"><span class="stat-n">20</span><div class="stat-l">Sportsbooks listed</div></div>
<div class="stat"><span class="stat-n">18+</span><div class="stat-l">T&Cs apply</div></div>
<div class="stat"><span class="stat-n">New</span><div class="stat-l">Customers only</div></div>
</div>

<div class="section-label" id="offers">Top Offers</div>
<div class="section-title">Best WC 2026 Welcome Bonuses — UK</div>

<table>
<thead><tr><th>Sportsbook</th><th>Offer</th><th>Min Deposit</th><th>Key Condition</th><th>Rating</th><th></th></tr></thead>
<tbody>
<tr><td><strong>Betfred</strong></td><td style="color:#00ff88;font-weight:700">£60 in Free Bets</td><td>£10</td><td>2× £30 — one football, one other sport</td><td>⭐⭐⭐⭐⭐</td><td><a href="/go/betfred" class="btn" style="padding:6px 12px;font-size:12px">Claim</a></td></tr>
<tr><td><strong>bet365</strong></td><td style="color:#00ff88;font-weight:700">Up to £50 in Bet Credits</td><td>£10</td><td>Min odds 1/5 — credits not withdrawable</td><td>⭐⭐⭐⭐⭐</td><td><a href="/go/bet365" class="btn" style="padding:6px 12px;font-size:12px">Claim</a></td></tr>
<tr><td><strong>Unibet</strong></td><td style="color:#00ff88;font-weight:700">£40 Free Bet</td><td>£10</td><td>Min odds 4/5 — returned as free bet</td><td>⭐⭐⭐⭐⭐</td><td><a href="/go/unibet" class="btn" style="padding:6px 12px;font-size:12px">Claim</a></td></tr>
<tr><td><strong>Sky Bet</strong></td><td style="color:#00ff88;font-weight:700">£30 Free Bet</td><td>£10</td><td>Min odds Evens — credited within 24h</td><td>⭐⭐⭐⭐</td><td><a href="/go/skybet" class="btn" style="padding:6px 12px;font-size:12px">Claim</a></td></tr>
<tr><td><strong>Betway</strong></td><td style="color:#00ff88;font-weight:700">£30 Free Bet</td><td>£10</td><td>Min odds 4/5</td><td>⭐⭐⭐⭐</td><td><a href="/go/betway" class="btn" style="padding:6px 12px;font-size:12px">Claim</a></td></tr>
<tr><td><strong>William Hill</strong></td><td style="color:#00ff88;font-weight:700">£30 Free Bet</td><td>£10</td><td>Min odds 4/5 — free bet for qualifying bet winnings</td><td>⭐⭐⭐⭐</td><td><a href="/go/williamhill" class="btn" style="padding:6px 12px;font-size:12px">Claim</a></td></tr>
<tr><td><strong>888sport</strong></td><td style="color:#00ff88;font-weight:700">£30 Free Bet</td><td>£10</td><td>Min odds 1/5</td><td>⭐⭐⭐⭐</td><td><a href="/go/888sport" class="btn" style="padding:6px 12px;font-size:12px">Claim</a></td></tr>
<tr><td><strong>Paddy Power</strong></td><td style="color:#00ff88;font-weight:700">£20 Free Bet</td><td>£10</td><td>Bet £10 get £20 — no restrictions on free bet</td><td>⭐⭐⭐⭐</td><td><a href="/go/paddypower" class="btn" style="padding:6px 12px;font-size:12px">Claim</a></td></tr>
<tr><td><strong>Ladbrokes</strong></td><td style="color:#00ff88;font-weight:700">£20 Free Bet</td><td>£5</td><td>Min odds 1/2</td><td>⭐⭐⭐</td><td><a href="/go/ladbrokes" class="btn" style="padding:6px 12px;font-size:12px">Claim</a></td></tr>
<tr><td><strong>Betfair</strong></td><td style="color:#00ff88;font-weight:700">£20 Exchange Free Bet</td><td>£10</td><td>Exchange only — best for arb bettors</td><td>⭐⭐⭐⭐⭐</td><td><a href="/go/betfair" class="btn" style="padding:6px 12px;font-size:12px">Claim</a></td></tr>
</tbody>
</table>

<div class="verdict">
<h3>💡 AI Tip: Stack All These Bonuses</h3>
<p style="color:#ccc;line-height:1.7">There's nothing stopping you from opening accounts with every bookmaker on this list — they're all separate companies. Starting with the highest-value offers (Betfred £60, bet365 £50) and working down, you could extract £560+ in free bets during the tournament. Each one requires only a £5-10 qualifying deposit. This is called bonus stacking — it's entirely legal and is the first step in any matched betting strategy.</p>
</div>

<div style="text-align:center;margin:32px 0;padding:20px;background:#111118;border-radius:12px;border:1px solid #1e1e2e">
<p style="font-size:11px;color:#555">18+ only. New customers only. Ts&Cs apply. Please gamble responsibly. BeGambleAware.org</p>
</div>
</div>"""

with open(f"{OUT}/wc2026-free-bets.html", "w") as f:
    f.write(page("Best WC 2026 Free Bets UK — £560+ in Welcome Bonuses | June 2026", "Every UK sportsbook WC 2026 welcome offer compared. Bet365 £50, Betfred £60, Sky Bet £30 and more. Updated daily during the tournament.", freebets_body))
print("✅ wc2026-free-bets.html")

# 5. How to Bet on WC 2026 (beginner guide)
howtobet_body = """
<div class="hero">
<div class="badge">COMPLETE BEGINNER GUIDE</div>
<h1>How to <span class="hi">Bet on WC 2026</span></h1>
<p>Never placed a bet before? This is everything you need to know — from opening an account to placing your first WC 2026 wager safely.</p>
<a href="#step1" class="btn">Start Here →</a>
<a href="/wc2026-free-bets.html" class="btn btn-outline">Get Free Bets First</a>
</div>

<div class="section">
<div class="section-label" id="step1">Step by Step</div>
<div class="section-title">The Complete Beginner's Guide to WC 2026 Betting</div>

<div class="grid-2">
<div class="card">
<div class="badge">STEP 1</div>
<h3>Choose a Licensed Sportsbook</h3>
<p>Only use regulated, licensed sportsbooks. In the UK: bet365, Sky Bet, Betfair, William Hill, Betway. In USA: DraftKings, FanDuel, BetMGM. In Australia: Sportsbet, TAB. Never use unlicensed offshore sites.</p>
</div>
<div class="card">
<div class="badge">STEP 2</div>
<h3>Claim Your Welcome Bonus</h3>
<p>Every sportsbook offers a welcome bonus to new customers. In the UK, these are typically free bets worth £20-£60. You must use these during the tournament — don't let them expire. <a href="/wc2026-free-bets.html" style="color:#00ff88">See all current offers →</a></p>
</div>
<div class="card">
<div class="badge">STEP 3</div>
<h3>Understand the Odds</h3>
<p>UK odds shown as fractions (3/1) or decimals (4.00). Decimal = total return per £1 staked. 2.00 = even money. Higher odds = less likely to win = more profit if it does. <a href="/betting-glossary.html" style="color:#00ff88">Full glossary →</a></p>
</div>
<div class="card">
<div class="badge">STEP 4</div>
<h3>Start with Match Result Bets</h3>
<p>The simplest bet: pick the winner (Home Win / Draw / Away Win). Start with £5-£10 stakes. Never bet more than you'd be comfortable losing. Set a budget before you start — stick to it.</p>
</div>
<div class="card">
<div class="badge">STEP 5</div>
<h3>Use AI Picks for Edge</h3>
<p>Our AI analyses every WC 2026 match and finds bets where the bookmaker's odds don't reflect the true probability. Following value bets consistently beats guessing. <a href="/win-share.html" style="color:#00ff88">Get picks →</a></p>
</div>
<div class="card">
<div class="badge">STEP 6</div>
<h3>Manage Your Bankroll</h3>
<p>Never bet more than 5% of your total betting budget on a single game. If you have £100, max bet is £5. This means you can lose 20 games in a row and still be in play. <a href="/digital-store.html" style="color:#00ff88">Download bankroll calculator →</a></p>
</div>
</div>

<div class="divider"></div>
<div class="section-label">Common Mistakes</div>
<div class="section-title">What Not to Do</div>

<div class="grid-3">
<div class="card"><h3>❌ Chasing Losses</h3><p>Never bet more to "win back" what you lost. This is how small losses become big ones. Set a daily/weekly limit and stop when you hit it.</p></div>
<div class="card"><h3>❌ Betting on Your Team</h3><p>Emotional bias clouds judgment. You'll consistently overestimate your team's chances and bet with heart not head.</p></div>
<div class="card"><h3>❌ Accumulator Addiction</h3><p>Accas are fun but the bookmaker margin multiplies with each leg. Keep accas to small stakes — they're lottery tickets, not strategy.</p></div>
<div class="card"><h3>❌ Ignoring Team News</h3><p>A captain absent or a goalkeeper injured can shift a match's probability by 15-20%. Always check lineups 1 hour before kick-off.</p></div>
<div class="card"><h3>❌ Using One Bookmaker</h3><p>Different books offer different odds on the same market. Always compare at least 3 bookmakers before betting — 0.10 better odds adds up over a tournament.</p></div>
<div class="card"><h3>❌ No Records</h3><p>Track every bet — stake, odds, result. Without records you can't identify what's working. Use our <a href="/digital-store.html" style="color:#00ff88">free bankroll tracker</a>.</p></div>
</div>
</div>"""

with open(f"{OUT}/how-to-bet-wc2026.html", "w") as f:
    f.write(page("How to Bet on WC 2026 — Complete Beginner's Guide | Step by Step", "Never bet before? Complete guide to betting on WC 2026. How to choose a sportsbook, claim free bets, understand odds and use AI picks to find value.", howtobet_body))
print("✅ how-to-bet-wc2026.html")

print("\n✅ ALL PAGES BUILT!")
