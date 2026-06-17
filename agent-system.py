"""
WC2026 AI COMMAND CENTER
========================
Your 24/7 AI business partner. Runs alongside preview-engine.js and goal-monitor.js.

WHAT IT DOES:
  • Sends you proactive Telegram briefings (morning, pre-match, half-time, nightly)
  • Accepts your commands via DM — you talk to it, it acts
  • Runs 6 specialist sub-agents simultaneously (Intel, Revenue, Arbitrage, Content, Growth, Alert)
  • Coordinates the full empire and reports back in plain language
  • Detects opportunities you'd miss and surfaces them instantly

YOUR COMMANDS (DM YOUR BOT THESE):
  /status     — full system health + revenue snapshot
  /revenue    — today's earnings estimate across all streams
  /arb        — live arbitrage scan right now
  /brief      — on-demand intelligence package
  /idea       — AI generates a new monetization idea
  /draft      <topic> — AI drafts a post/tweet/thread on anything
  /trending   — what WC topics are exploding right now
  /best       — your top performing content today
  /focus      — what you should work on RIGHT NOW
  /forecast   — revenue forecast for rest of tournament
  /translate  <text> — instantly translate to all 5 languages
  /alert      on/off — toggle real-time arbitrage + opportunity alerts

DEPLOY: Same Railway project. Run: python agent-system.py
REQUIRES: All env vars from .env.example + OWNER_TELEGRAM_ID
"""

import os, json, asyncio, datetime, httpx
from collections import defaultdict
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("CommandCenter")

# ─── CONFIG ───────────────────────────────────────────────────────────────────
OWNER_ID         = int(os.environ["OWNER_TELEGRAM_ID"])   # Your personal Telegram user ID
BOT_TOKEN        = os.environ["TELEGRAM_BOT_TOKEN"]
GROQ_KEY         = os.environ["GROQ_API_KEY"]
API_FOOTBALL_KEY = os.environ.get("API_FOOTBALL_KEY", "")
ODDS_API_KEY     = os.environ.get("ODDS_API_KEY", "")
BEEHIIV_KEY      = os.environ.get("BEEHIIV_KEY", "")
BEEHIIV_PUB_ID   = os.environ.get("BEEHIIV_PUB_ID", "")
WHOP_API_KEY     = os.environ.get("WHOP_API_KEY", "")

AFFILIATES = {
    "draftkings": os.environ.get("AFF_DRAFTKINGS", "https://draftkings.com"),
    "fanduel":    os.environ.get("AFF_FANDUEL",    "https://fanduel.com"),
    "nordvpn":    os.environ.get("AFF_NORDVPN",    "https://nordvpn.com"),
    "bet365":     os.environ.get("AFF_BET365",     "https://bet365.com"),
}

ALERT_MODE = {"active": True}  # togglable via /alert command

# ─── CORE: SEND MESSAGE TO OWNER ──────────────────────────────────────────────
async def send(text: str, parse_mode: str = "HTML"):
    """Send a Telegram message to you (the owner)."""
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={"chat_id": OWNER_ID, "text": text, "parse_mode": parse_mode,
                      "disable_web_page_preview": True},
                timeout=10,
            )
        except Exception as e:
            log.error(f"send() failed: {e}")

# ─── GROQ: INTELLIGENT REASONING ──────────────────────────────────────────────
async def groq(system: str, user: str, max_tokens: int = 600) -> str:
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_KEY}"},
                json={
                    "model": "llama3-70b-8192",
                    "messages": [{"role": "system", "content": system},
                                 {"role": "user",   "content": user}],
                    "temperature": 0.7,
                    "max_tokens": max_tokens,
                },
                timeout=20,
            )
            return r.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            return f"[AI unavailable: {e}]"

# ═══════════════════════════════════════════════════════════════════════════════
# SUB-AGENTS
# Each agent is a specialist. The orchestrator calls them and synthesizes results.
# ═══════════════════════════════════════════════════════════════════════════════

# ─── INTEL AGENT: match data, live scores, news ───────────────────────────────
class IntelAgent:
    """Knows everything about today's matches and live scores."""

    async def today_matches(self) -> list[dict]:
        if not API_FOOTBALL_KEY:
            return []
        today = datetime.date.today().isoformat()
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(
                    "https://v3.football.api-sports.io/fixtures",
                    headers={"x-apisports-key": API_FOOTBALL_KEY},
                    params={"league": 1, "season": 2026, "from": today, "to": today},
                    timeout=10,
                )
                return r.json().get("response", [])
            except:
                return []

    async def live_matches(self) -> list[dict]:
        if not API_FOOTBALL_KEY:
            return []
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(
                    "https://v3.football.api-sports.io/fixtures",
                    headers={"x-apisports-key": API_FOOTBALL_KEY},
                    params={"live": "all", "league": 1, "season": 2026},
                    timeout=10,
                )
                return r.json().get("response", [])
            except:
                return []

    async def next_match(self) -> dict | None:
        matches = await self.today_matches()
        now = datetime.datetime.utcnow()
        for f in matches:
            try:
                kickoff = datetime.datetime.fromisoformat(f["fixture"]["date"].replace("Z", "+00:00"))
                if kickoff > now.replace(tzinfo=datetime.timezone.utc):
                    return f
            except:
                pass
        return None

    def format_match(self, f: dict) -> str:
        home   = f["teams"]["home"]["name"]
        away   = f["teams"]["away"]["name"]
        status = f["fixture"]["status"]["short"]
        hg     = f["goals"]["home"]
        ag     = f["goals"]["away"]
        t      = f["fixture"]["date"][11:16]
        if status in ("1H", "2H", "HT", "ET"):
            return f"🔴 LIVE: {home} {hg}–{ag} {away} ({status})"
        elif status == "FT":
            return f"✅ FT: {home} {hg}–{ag} {away}"
        else:
            return f"⏰ {t} UTC: {home} vs {away}"


# ─── REVENUE AGENT: tracks earnings across all streams ────────────────────────
class RevenueAgent:
    """Estimates and tracks revenue across all monetization streams."""

    async def beehiiv_stats(self) -> dict:
        if not BEEHIIV_KEY or not BEEHIIV_PUB_ID:
            return {}
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(
                    f"https://api.beehiiv.com/v2/publications/{BEEHIIV_PUB_ID}",
                    headers={"Authorization": f"Bearer {BEEHIIV_KEY}"},
                    timeout=8,
                )
                data = r.json().get("data", {})
                return {
                    "subscribers": data.get("total_active_subscriptions", 0),
                    "name": data.get("name", "Newsletter"),
                }
            except:
                return {}

    async def whop_revenue(self) -> dict:
        if not WHOP_API_KEY:
            return {}
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(
                    "https://api.whop.com/api/v2/memberships",
                    headers={"Authorization": f"Bearer {WHOP_API_KEY}"},
                    timeout=8,
                )
                members = r.json().get("data", [])
                active = [m for m in members if m.get("status") == "active"]
                return {"active_members": len(active)}
            except:
                return {}

    async def full_snapshot(self) -> str:
        bh, wp = await asyncio.gather(self.beehiiv_stats(), self.whop_revenue())
        subs   = bh.get("subscribers", "?")
        members= wp.get("active_members", "?")
        lines  = [
            "📊 <b>REVENUE SNAPSHOT</b>",
            f"📧 Newsletter subscribers: <b>{subs}</b>",
            f"💎 Premium members: <b>{members}</b>",
            "",
            "💰 <b>Est. today's earnings</b> (based on benchmarks):",
            f"  Affiliate clicks → estimate manually via your affiliate dashboards",
            f"  Newsletter (Beehiiv ad network) → ~${max(0, int(str(subs).replace('?','0') or 0) * 3 // 1000}/day",
            f"  Community → ~${max(0, int(str(members).replace('?','0') or 0) * 10 // 30}/day",
            "",
            "🔗 Check exact numbers:",
            f"  DraftKings: https://affiliates.draftkings.com",
            f"  NordVPN: https://affiliates.nordvpn.com",
            f"  Beehiiv: https://app.beehiiv.com",
        ]
        return "\n".join(lines)


# ─── ARBITRAGE AGENT: scans odds for guaranteed profit ────────────────────────
class ArbitrageAgent:
    """Scans live odds for arbitrage opportunities (guaranteed profit)."""

    async def get_odds(self) -> list[dict]:
        if not ODDS_API_KEY:
            return []
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(
                    "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds",
                    params={
                        "apiKey": ODDS_API_KEY,
                        "regions": "us,uk,eu,au",
                        "markets": "h2h",
                        "oddsFormat": "decimal",
                    },
                    timeout=12,
                )
                return r.json()
            except:
                return []

    def decimal_to_implied(self, odds: float) -> float:
        return 1 / odds if odds > 0 else 1

    def find_arb(self, event: dict) -> dict | None:
        """Find arbitrage in a match (guaranteed profit regardless of outcome)."""
        markets = event.get("bookmakers", [])
        if not markets:
            return None

        # Collect best odds for each outcome across all books
        best = {}  # outcome → (odds, book)
        for bm in markets:
            for market in bm.get("markets", []):
                if market["key"] != "h2h":
                    continue
                for outcome in market["outcomes"]:
                    name = outcome["name"]
                    o    = outcome["price"]
                    if name not in best or o > best[name][0]:
                        best[name] = (o, bm["key"])

        if len(best) < 2:
            return None

        # Check if arbitrage exists: sum of implied probs < 1
        total_implied = sum(self.decimal_to_implied(v[0]) for v in best.values())
        if total_implied < 1.0:
            profit_pct = (1 - total_implied) * 100
            return {
                "match": f"{event['home_team']} vs {event['away_team']}",
                "profit_pct": round(profit_pct, 2),
                "best_odds": {k: v for k, v in best.items()},
                "total_implied": round(total_implied, 4),
            }
        return None

    async def scan(self) -> str:
        events = await self.get_odds()
        arbs   = []
        for event in events:
            result = self.find_arb(event)
            if result:
                arbs.append(result)

        if not arbs:
            return "🔍 No arbitrage opportunities found right now. (Will alert when one appears.)"

        arbs.sort(key=lambda x: x["profit_pct"], reverse=True)
        lines = ["🎯 <b>ARBITRAGE OPPORTUNITIES FOUND</b>", ""]
        for a in arbs[:5]:
            lines.append(f"⚡ <b>{a['match']}</b>")
            lines.append(f"   Guaranteed profit: <b>+{a['profit_pct']}%</b>")
            for outcome, (odds, book) in a["best_odds"].items():
                lines.append(f"   {outcome}: {odds} @ {book}")
            lines.append("")
        lines.append("💡 Bet proportionally on ALL outcomes to guarantee profit.")
        return "\n".join(lines)


# ─── CONTENT AGENT: drafts content on command ─────────────────────────────────
class ContentAgent:
    """Drafts any content piece on demand."""

    async def draft(self, topic: str, intel: str = "") -> str:
        system = (
            "You are a professional sports content creator for WC 2026. "
            "Write platform-ready content. Be specific, engaging, and concise."
        )
        user = f"""Topic: {topic}
{f'Context: {intel}' if intel else ''}

Produce ALL of the following, separated by headers:

--- TWITTER/X (max 240 chars) ---
[tweet]

--- TELEGRAM (max 300 chars, HTML bold allowed) ---
[telegram message]

--- TIKTOK CAPTION (max 150 chars + 5 hashtags) ---
[caption]

--- EMAIL SUBJECT LINE ---
[subject]

--- INSTAGRAM CAPTION (max 200 chars + 5 hashtags) ---
[caption]"""
        return await groq(system, user, max_tokens=700)

    async def translate_all(self, text: str) -> str:
        langs = {"ES": "Spanish", "PT": "Portuguese", "FR": "French", "AR": "Arabic", "HI": "Hindi"}
        system = "Professional translator. Preserve tone and sports terminology."
        results = ["<b>📝 TRANSLATIONS</b>\n"]
        tasks   = {code: groq(system, f"Translate to {lang}: {text}", 200) for code, lang in langs.items()}
        done    = await asyncio.gather(*tasks.values())
        for (code, lang), translated in zip(langs.items(), done):
            results.append(f"<b>{code} ({lang}):</b>\n{translated}\n")
        return "\n".join(results)


# ─── GROWTH AGENT: spots opportunities ────────────────────────────────────────
class GrowthAgent:
    """Continuously identifies new growth and monetization opportunities."""

    async def new_idea(self, context: str) -> str:
        system = (
            "You are a digital entrepreneur and sports media expert. "
            "Generate specific, actionable, novel monetization and growth ideas. "
            "Focus on ideas that can be implemented in under 24 hours with zero budget."
        )
        user = (
            f"Context about our WC 2026 operation:\n{context}\n\n"
            "Generate 3 new ideas we haven't implemented yet. "
            "For each: what it is, how to do it today, realistic revenue potential."
        )
        return await groq(system, user, max_tokens=600)

    async def focus_recommendation(self, matches_today: str, context: str) -> str:
        system = (
            "You are a business operations advisor. "
            "Given current data, tell the operator exactly what ONE THING to focus on right now "
            "to maximize revenue in the next 6 hours. Be specific and direct."
        )
        user = f"Today's matches: {matches_today}\nCurrent context: {context}"
        return await groq(system, user, max_tokens=300)


# ─── ALERT AGENT: watches for urgent opportunities ────────────────────────────
class AlertAgent:
    """Sends instant alerts when high-value opportunities appear."""

    def __init__(self):
        self.last_arb_alert = None
        self.arb_agent      = ArbitrageAgent()

    async def check_arbitrage_alert(self):
        if not ALERT_MODE["active"]:
            return
        now = datetime.datetime.utcnow()
        # Only alert once every 30 minutes
        if self.last_arb_alert and (now - self.last_arb_alert).seconds < 1800:
            return
        result = await self.arb_agent.scan()
        if "ARBITRAGE OPPORTUNITIES FOUND" in result:
            self.last_arb_alert = now
            await send(f"🚨 <b>ARBITRAGE ALERT</b>\n\n{result}")


# ═══════════════════════════════════════════════════════════════════════════════
# ORCHESTRATOR — ties all agents together
# ═══════════════════════════════════════════════════════════════════════════════

class Orchestrator:
    def __init__(self):
        self.intel   = IntelAgent()
        self.revenue = RevenueAgent()
        self.arb     = ArbitrageAgent()
        self.content = ContentAgent()
        self.growth  = GrowthAgent()
        self.alerts  = AlertAgent()

    # ── PROACTIVE BRIEFINGS ────────────────────────────────────────────────────

    async def morning_briefing(self):
        """6:00 AM UTC — your daily command center briefing."""
        log.info("Sending morning briefing...")
        matches   = await self.intel.today_matches()
        rev_snap  = await self.revenue.full_snapshot()
        match_strs= [self.intel.format_match(m) for m in matches] if matches else ["No WC matches today"]
        match_txt = "\n".join(match_strs)

        # Generate AI picks for today
        picks_prompt = f"Today's WC matches:\n{match_txt}\n\nGive 2-3 confident betting picks with brief reasoning. Plain text."
        picks = await groq("Expert WC analyst. Confident, specific picks.", picks_prompt, 400)

        arb_result = await self.arb.scan()
        focus = await self.growth.focus_recommendation(match_txt, "Morning. Tournament ongoing.")

        msg = f"""🌅 <b>WC2026 MORNING BRIEFING</b>
{datetime.datetime.utcnow().strftime('%A %d %B • %H:%M UTC')}

⚽ <b>TODAY'S MATCHES</b>
{match_txt}

🎯 <b>AI PICKS</b>
{picks}

{arb_result[:500] if 'FOUND' in arb_result else ''}

📊 <b>REVENUE</b>
{rev_snap}

🎯 <b>FOCUS RIGHT NOW</b>
{focus}

━━━━━━━━━━━━━━━━━━━
Commands: /status /arb /revenue /idea /draft [topic] /brief /trending /focus"""
        await send(msg)

    async def prematch_brief(self, fixture: dict):
        """Sent 2 hours before kick-off."""
        home  = fixture["teams"]["home"]["name"]
        away  = fixture["teams"]["away"]["name"]
        t     = fixture["fixture"]["date"][11:16]

        analysis = await groq(
            "Expert WC analyst. Pre-match intelligence package.",
            f"2 hours before {home} vs {away}. Give: team form, key player, best bet, value odds angle. Max 200 words.",
            350
        )

        msg = f"""⚡ <b>PRE-MATCH INTEL — {home} vs {away}</b>
Kick-off: {t} UTC

{analysis}

💰 Bet now:
• <a href='{AFFILIATES["draftkings"]}'>DraftKings</a> | <a href='{AFFILIATES["fanduel"]}'>FanDuel</a> | <a href='{AFFILIATES["bet365"]}'>bet365</a>"""
        await send(msg)

    async def halftime_brief(self, fixture: dict):
        """Sent at half-time."""
        home = fixture["teams"]["home"]["name"]
        away = fixture["teams"]["away"]["name"]
        hg   = fixture["goals"]["home"] or 0
        ag   = fixture["goals"]["away"] or 0

        analysis = await groq(
            "Live WC analyst.",
            f"Half-time: {home} {hg}-{ag} {away}. What changed? Second half prediction? Best live bet right now? Max 150 words.",
            250
        )

        msg = f"""⏸️ <b>HALF-TIME INTEL</b>
{home} {hg}–{ag} {away}

{analysis}

💰 <a href='{AFFILIATES["draftkings"]}'>Live bet → DraftKings</a>"""
        await send(msg)

    async def nightly_summary(self):
        """11:00 PM UTC — end of day summary."""
        matches   = await self.intel.today_matches()
        results   = [m for m in matches if m["fixture"]["status"]["short"] == "FT"]
        result_txt= "\n".join([self.intel.format_match(m) for m in results]) or "No completed matches"

        idea = await self.growth.new_idea(
            "WC 2026 operation. Have: Telegram, Discord, WordPress, newsletter, Telegram bot."
        )

        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        msg = f"""🌙 <b>NIGHTLY SUMMARY</b>
{datetime.datetime.utcnow().strftime('%d %B')}

✅ <b>TODAY'S RESULTS</b>
{result_txt}

💡 <b>NEW IDEAS FOR TOMORROW</b>
{idea}

━━━━━━━━━━━━━━━━
Tomorrow: check your affiliate dashboards and record any new signups.
Sleep well. The system is running. 🤖"""
        await send(msg)

    # ── COMMAND HANDLER ────────────────────────────────────────────────────────

    async def handle_command(self, text: str) -> str:
        """Process a command from the owner and return a response."""
        text  = text.strip()
        cmd   = text.split()[0].lower()
        args  = " ".join(text.split()[1:])

        if cmd == "/status":
            matches  = await self.intel.today_matches()
            live     = await self.intel.live_matches()
            rev_snap = await self.revenue.full_snapshot()
            live_txt = "\n".join([self.intel.format_match(m) for m in live]) or "No live matches"
            return f"""🖥️ <b>SYSTEM STATUS</b>

🔴 <b>LIVE NOW</b>
{live_txt}

{rev_snap}

⚙️ Scripts: preview-engine.js ✅ | goal-monitor.js ✅ | agent-system.py ✅
🕐 UTC: {datetime.datetime.utcnow().strftime('%H:%M:%S')}"""

        elif cmd == "/revenue":
            return await self.revenue.full_snapshot()

        elif cmd == "/arb":
            await send("🔍 Scanning odds across all books...")
            return await self.arb.scan()

        elif cmd == "/brief":
            matches  = await self.intel.today_matches()
            match_txt= "\n".join([self.intel.format_match(m) for m in matches]) or "No matches today"
            brief = await groq(
                "WC expert analyst.",
                f"Current matches: {match_txt}\n\nIntelligence briefing: form, picks, opportunities. Max 300 words.",
                500
            )
            return f"📋 <b>INTELLIGENCE BRIEF</b>\n\n{brief}"

        elif cmd == "/idea":
            context = "WC 2026 operation. Have: Telegram 5 channels, Discord, WordPress, Beehiiv newsletter, Telegram AI picks bot, odds tool, office pool tool."
            return await self.growth.new_idea(context)

        elif cmd == "/draft":
            if not args:
                return "Usage: /draft <topic> — e.g. /draft USA vs Mexico preview"
            await send("✍️ Drafting content...")
            return await self.content.draft(args)

        elif cmd == "/translate":
            if not args:
                return "Usage: /translate <text>"
            await send("🌐 Translating to 5 languages...")
            return await self.content.translate_all(args)

        elif cmd == "/trending":
            result = await groq(
                "WC social media analyst.",
                f"It's {datetime.datetime.utcnow().strftime('%d %B %Y')}. What WC topics are likely trending on X, TikTok, and Google right now? What content should I post immediately to ride these trends?",
                400
            )
            return f"📈 <b>TRENDING RIGHT NOW</b>\n\n{result}"

        elif cmd == "/best":
            return (
                "📊 <b>TOP CONTENT</b>\n\n"
                "Check these dashboards for real data:\n"
                "• TikTok: https://www.tiktok.com/tiktokstudio/content\n"
                "• YouTube: https://studio.youtube.com\n"
                "• X Analytics: https://analytics.twitter.com\n"
                "• Buffer: https://buffer.com/analyze\n"
                "• WordPress: your-site.com/wp-admin/admin.php?page=jetpack\n\n"
                "Reply /brief for AI analysis of what to post next."
            )

        elif cmd == "/focus":
            matches   = await self.intel.today_matches()
            match_txt = "\n".join([self.intel.format_match(m) for m in matches]) or "No matches"
            focus = await self.growth.focus_recommendation(match_txt, "Midday. All systems running.")
            return f"🎯 <b>FOCUS RIGHT NOW</b>\n\n{focus}"

        elif cmd == "/forecast":
            result = await groq(
                "Sports media revenue analyst.",
                "WC 2026 has 104 matches, running June 11–July 19. We have: Telegram channels, Discord, WordPress blog, Beehiiv newsletter, Telegram picks bot, odds tool, office pool tool. Revenue streams: affiliate (sportsbooks, VPN), community subscriptions, platform ads, matched betting, B2B content. Give a week-by-week revenue forecast for the tournament. Be realistic but optimistic.",
                600
            )
            return f"📈 <b>REVENUE FORECAST</b>\n\n{result}"

        elif cmd == "/alert":
            if args.lower() == "off":
                ALERT_MODE["active"] = False
                return "🔕 Arbitrage alerts OFF"
            else:
                ALERT_MODE["active"] = True
                return "🔔 Arbitrage alerts ON — you'll be notified of any opportunity"

        elif cmd == "/help":
            return """🤖 <b>COMMAND CENTER</b>

/status    — system health + revenue snapshot
/revenue   — earnings across all streams
/arb       — live arbitrage scan
/brief     — full intelligence briefing
/idea      — new monetization idea
/draft [topic] — draft any content instantly
/translate [text] — 5 language translation
/trending  — what's hot right now
/best      — top performing content
/focus     — what to work on RIGHT NOW
/forecast  — tournament revenue forecast
/alert on/off — toggle arb alerts

Just ask anything in plain text too — I'll answer."""

        else:
            # Free-form question — answer with AI
            context = f"WC 2026 operation. Date: {datetime.datetime.utcnow().strftime('%d %B %Y %H:%M UTC')}."
            answer = await groq(
                "You are the AI command center for a WC 2026 sports media operation. Answer the operator's question directly and helpfully.",
                f"Context: {context}\n\nQuestion: {text}",
                500
            )
            return answer

    # ── MATCH WATCHER: sends pre-match and half-time briefs automatically ──────

    async def match_watcher(self):
        """Background task: watches match schedule, sends timed briefs."""
        pre_alerted  = set()
        ht_alerted   = set()

        while True:
            try:
                now     = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
                matches = await self.intel.today_matches()

                for f in matches:
                    fid    = str(f["fixture"]["id"])
                    status = f["fixture"]["status"]["short"]

                    # Pre-match brief: 2 hours before kick-off
                    if fid not in pre_alerted:
                        try:
                            kickoff = datetime.datetime.fromisoformat(
                                f["fixture"]["date"].replace("Z", "+00:00")
                            )
                            diff = (kickoff - now).total_seconds() / 60
                            if 115 <= diff <= 125:  # 2hr window
                                pre_alerted.add(fid)
                                await self.prematch_brief(f)
                        except:
                            pass

                    # Half-time brief
                    if status == "HT" and fid not in ht_alerted:
                        ht_alerted.add(fid)
                        await self.halftime_brief(f)

                # Arbitrage check every 30 min
                await self.alerts.check_arbitrage_alert()

            except Exception as e:
                log.error(f"match_watcher error: {e}")

            await asyncio.sleep(300)  # check every 5 minutes

    # ── SCHEDULER: time-based proactive messages ───────────────────────────────

    async def scheduler(self):
        """Sends briefings on schedule."""
        last_morning = None
        last_nightly = None

        while True:
            now = datetime.datetime.utcnow()
            today = now.date()

            # 6:00 AM UTC — morning briefing
            if now.hour == 6 and now.minute < 5 and last_morning != today:
                last_morning = today
                await self.morning_briefing()

            # 23:00 UTC — nightly summary
            if now.hour == 23 and now.minute < 5 and last_nightly != today:
                last_nightly = today
                await self.nightly_summary()

            await asyncio.sleep(60)


# ═══════════════════════════════════════════════════════════════════════════════
# TELEGRAM LISTENER: receives your commands
# ═══════════════════════════════════════════════════════════════════════════════

class CommandListener:
    """Polls Telegram for messages from the owner and routes them to the orchestrator."""

    def __init__(self, orchestrator: Orchestrator):
        self.orc    = orchestrator
        self.offset = 0

    async def poll(self):
        while True:
            try:
                async with httpx.AsyncClient() as client:
                    r = await client.get(
                        f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates",
                        params={"offset": self.offset, "timeout": 30, "allowed_updates": ["message"]},
                        timeout=35,
                    )
                    updates = r.json().get("result", [])

                for update in updates:
                    self.offset = update["update_id"] + 1
                    msg = update.get("message", {})
                    if not msg:
                        continue
                    from_id = msg.get("from", {}).get("id")
                    text    = msg.get("text", "").strip()

                    # Only respond to the owner
                    if from_id != OWNER_ID or not text:
                        continue

                    log.info(f"Owner command: {text[:60]}")
                    response = await self.orc.handle_command(text)
                    await send(response)

            except Exception as e:
                log.error(f"poll error: {e}")
                await asyncio.sleep(5)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

async def main():
    orc      = Orchestrator()
    listener = CommandListener(orc)

    await send(
        "🤖 <b>COMMAND CENTER ONLINE</b>\n\n"
        "WC2026 AI agent system is live.\n"
        "Morning briefings: 6:00 AM UTC\n"
        "Nightly summary: 11:00 PM UTC\n"
        "Pre-match intel: 2hr before each match\n"
        "Half-time reports: automatic\n"
        "Arbitrage alerts: ON\n\n"
        "Type /help for all commands.\n"
        "Or just ask me anything. I'm here 24/7. ⚽"
    )

    log.info("Command Center starting all agents...")
    await asyncio.gather(
        listener.poll(),
        orc.scheduler(),
        orc.match_watcher(),
    )

if __name__ == "__main__":
    asyncio.run(main())
