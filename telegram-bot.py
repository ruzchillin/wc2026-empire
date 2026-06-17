"""
WC2026 Telegram AI Picks Bot
============================
Followers DM your bot any soccer question.
Bot queries Groq with live match data and replies instantly.

Free tier:  3 questions/day per user
Premium:    Unlimited (gate via Whop membership check)

DEPLOY: Railway.app — pip install -r requirements.txt, set env vars, run.
RUN:    python telegram-bot.py
"""

import os, json, datetime, asyncio
from collections import defaultdict
import httpx
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters

# ─── CONFIG ──────────────────────────────────────────────────────────────────
BOT_TOKEN        = os.environ["TELEGRAM_BOT_TOKEN"]
GROQ_KEY         = os.environ["GROQ_API_KEY"]
API_FOOTBALL_KEY = os.environ.get("API_FOOTBALL_KEY", "")
WHOP_API_KEY     = os.environ.get("WHOP_API_KEY", "")          # optional premium gating
PREMIUM_PLAN_ID  = os.environ.get("WHOP_PLAN_ID", "")          # your Whop plan ID

AFFILIATES = {
    "draftkings": os.environ.get("AFF_DRAFTKINGS", "https://draftkings.com"),
    "fanduel":    os.environ.get("AFF_FANDUEL",    "https://fanduel.com"),
    "betmgm":     os.environ.get("AFF_BETMGM",     "https://betmgm.com"),
    "nordvpn":    os.environ.get("AFF_NORDVPN",    "https://nordvpn.com"),
    "bet365":     os.environ.get("AFF_BET365",     "https://bet365.com"),
}

FREE_QUESTIONS_PER_DAY = 3
UPGRADE_LINK = os.environ.get("WHOP_UPGRADE_LINK", "https://whop.com/your-community")

# ─── RATE LIMITING (in-memory, resets daily) ─────────────────────────────────
user_questions = defaultdict(lambda: {"count": 0, "date": None})

def can_ask(user_id: int) -> bool:
    today = datetime.date.today().isoformat()
    u = user_questions[user_id]
    if u["date"] != today:
        u["count"] = 0
        u["date"]  = today
    return u["count"] < FREE_QUESTIONS_PER_DAY

def increment(user_id: int):
    user_questions[user_id]["count"] += 1

def remaining(user_id: int) -> int:
    today = datetime.date.today().isoformat()
    u = user_questions[user_id]
    if u["date"] != today:
        return FREE_QUESTIONS_PER_DAY
    return max(0, FREE_QUESTIONS_PER_DAY - u["count"])

# ─── PREMIUM CHECK (optional Whop integration) ────────────────────────────────
async def is_premium(user_id: int) -> bool:
    if not WHOP_API_KEY or not PREMIUM_PLAN_ID:
        return False
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"https://api.whop.com/api/v2/memberships",
                headers={"Authorization": f"Bearer {WHOP_API_KEY}"},
                params={"plan_id": PREMIUM_PLAN_ID, "telegram_id": str(user_id)},
                timeout=5,
            )
            data = r.json()
            return any(m.get("status") == "active" for m in data.get("data", []))
    except Exception:
        return False

# ─── FETCH LIVE MATCH CONTEXT ─────────────────────────────────────────────────
async def get_match_context() -> str:
    if not API_FOOTBALL_KEY:
        return "No live match data available."
    today = datetime.date.today().isoformat()
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://v3.football.api-sports.io/fixtures",
                headers={"x-apisports-key": API_FOOTBALL_KEY},
                params={"league": 1, "season": 2026, "from": today, "to": today},
                timeout=8,
            )
            fixtures = r.json().get("response", [])
            if not fixtures:
                return "No WC matches today."
            lines = []
            for f in fixtures[:5]:
                home   = f["teams"]["home"]["name"]
                away   = f["teams"]["away"]["name"]
                status = f["fixture"]["status"]["short"]
                hg     = f["goals"]["home"]
                ag     = f["goals"]["away"]
                t      = f["fixture"]["date"][:16].replace("T", " ")
                if status in ("1H", "2H", "HT"):
                    lines.append(f"LIVE: {home} {hg}–{ag} {away} ({status})")
                else:
                    lines.append(f"Upcoming: {home} vs {away} at {t} UTC")
            return "\n".join(lines)
    except Exception:
        return "Match data temporarily unavailable."

# ─── GROQ AI RESPONSE ────────────────────────────────────────────────────────
async def ask_groq(user_message: str, match_context: str) -> str:
    system = (
        "You are a professional soccer analyst covering the 2026 FIFA World Cup. "
        "Give confident, specific, useful answers. Keep responses under 300 words. "
        "Use plain text — no markdown headers, no bullet lists unless asked. "
        "If asked for a betting pick, give a clear recommendation with brief reasoning."
    )
    user_prompt = (
        f"Current WC match data:\n{match_context}\n\n"
        f"User question: {user_message}"
    )
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "llama3-70b-8192",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user",   "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens":  400,
                },
                timeout=15,
            )
            return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"Sorry, I couldn't process that right now. Try again in a moment. ({e})"

# ─── AFFILIATE FOOTER ─────────────────────────────────────────────────────────
def affiliate_footer(lang: str = "en") -> str:
    if lang in ("es", "pt"):
        return f"\n\n💰 <a href='{AFFILIATES['bet365']}'>Mejores cuotas en bet365</a> | 📺 <a href='{AFFILIATES['nordvpn']}'>Ver en vivo — NordVPN</a>"
    return f"\n\n💰 <a href='{AFFILIATES['draftkings']}'>DraftKings — Bet $5, get $200</a> | 📺 <a href='{AFFILIATES['nordvpn']}'>Watch live — NordVPN</a>"

# ─── BOT COMMANDS ────────────────────────────────────────────────────────────
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    name = update.effective_user.first_name or "there"
    text = (
        f"Hey {name}! ⚽ I'm your WC 2026 AI analyst.\n\n"
        f"Ask me anything:\n"
        f"• Who will win tonight?\n"
        f"• What's the best bet for USA vs Mexico?\n"
        f"• How is Brazil looking this tournament?\n\n"
        f"Free plan: {FREE_QUESTIONS_PER_DAY} questions/day.\n"
        f"Upgrade for unlimited: {UPGRADE_LINK}\n\n"
        f"Commands: /picks /today /odds /help"
    )
    await update.message.reply_text(text)

async def cmd_today(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    ctx_text = await get_match_context()
    await update.message.reply_text(f"⚽ Today's WC matches:\n\n{ctx_text}")

async def cmd_picks(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    match_ctx = await get_match_context()
    answer = await ask_groq("What are the best picks for today's World Cup matches? Give me 2-3 specific bets with reasoning.", match_ctx)
    footer = affiliate_footer()
    await update.message.reply_html(f"🎯 <b>Today's AI Picks</b>\n\n{answer}{footer}")

async def cmd_odds(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    keyboard = [[
        InlineKeyboardButton("DraftKings — Bet $5 Get $200 →", url=AFFILIATES["draftkings"]),
    ],[
        InlineKeyboardButton("FanDuel — $200 Bonus →", url=AFFILIATES["fanduel"]),
    ],[
        InlineKeyboardButton("BetMGM — $1,500 Insurance →", url=AFFILIATES["betmgm"]),
    ],[
        InlineKeyboardButton("📺 Watch live — NordVPN →", url=AFFILIATES["nordvpn"]),
    ]]
    await update.message.reply_text(
        "💰 Best books for WC 2026:\n\nAll links below are verified. Click to claim your bonus:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Commands:\n"
        "/today — today's matches\n"
        "/picks — AI picks for today's games\n"
        "/odds  — best sportsbook bonuses\n\n"
        "Or just ask me anything in plain text!\n"
        f"Upgrade to unlimited: {UPGRADE_LINK}"
    )

# ─── MESSAGE HANDLER (main Q&A) ───────────────────────────────────────────────
async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text    = update.message.text.strip()
    if not text:
        return

    # Check premium or rate limit
    premium = await is_premium(user_id)
    if not premium and not can_ask(user_id):
        keyboard = [[InlineKeyboardButton("Upgrade — Unlimited Questions →", url=UPGRADE_LINK)]]
        await update.message.reply_text(
            f"You've used your {FREE_QUESTIONS_PER_DAY} free questions for today.\n\n"
            f"Upgrade for unlimited AI picks, live odds alerts, and premium analysis:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return

    # Show "typing" indicator
    await ctx.bot.send_chat_action(update.effective_chat.id, "typing")

    # Get context + generate answer
    match_ctx = await get_match_context()
    answer    = await ask_groq(text, match_ctx)
    footer    = affiliate_footer()

    if not premium:
        increment(user_id)
        left = remaining(user_id)
        quota = f"\n\n<i>({left} free question{'s' if left != 1 else ''} remaining today — <a href='{UPGRADE_LINK}'>upgrade for unlimited</a>)</i>"
    else:
        quota = "\n\n<i>(Premium member ⭐)</i>"

    await update.message.reply_html(answer + footer + quota)

# ─── MAIN ────────────────────────────────────────────────────────────────────
def main():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("today", cmd_today))
    app.add_handler(CommandHandler("picks", cmd_picks))
    app.add_handler(CommandHandler("odds",  cmd_odds))
    app.add_handler(CommandHandler("help",  cmd_help))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("⚽ WC2026 Telegram Bot running...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
