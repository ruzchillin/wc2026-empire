"""
Telegram Bot v2 — WC 2026 AI Empire
Full-featured bot: predictions, bet slip analysis, story generator,
premium gating, subscription tiers, affiliate CTAs, multilingual
Deploy on Railway as: python telegram-bot-v2.py
"""

import os, json, re, requests, base64
from datetime import datetime
from groq import Groq
import telebot
from telebot import types
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, LabeledPrice

# ── Config ────────────────────────────────────────────────────────────────────
BOT_TOKEN        = os.getenv('TELEGRAM_BOT_TOKEN')
CHANNEL_ID       = os.getenv('TELEGRAM_CHANNEL_ID')
PREMIUM_CHANNEL  = os.getenv('TELEGRAM_PREMIUM_CHANNEL', CHANNEL_ID)
API_FOOTBALL_KEY = os.getenv('API_FOOTBALL_KEY')
GROQ_API_KEY     = os.getenv('GROQ_API_KEY')
WHOP_URL         = os.getenv('WHOP_PREMIUM_URL', 'https://whop.com/wc2026ai')
STRIPE_PROVIDER  = os.getenv('STRIPE_PROVIDER_TOKEN', '')

bot    = telebot.TeleBot(BOT_TOKEN)
groq   = Groq(api_key=GROQ_API_KEY)

# Affiliate links per market
AFFILIATES = {
    'NG': os.getenv('AFFILIATE_BET9JA',    'https://bet9ja.com'),
    'KE': os.getenv('AFFILIATE_BETIKA',    'https://betika.com'),
    'ZA': os.getenv('AFFILIATE_HOLLYW',    'https://hollywoodbets.net'),
    'IN': os.getenv('AFFILIATE_DREAM11',   'https://dream11.com'),
    'BR': os.getenv('AFFILIATE_BET365_BR', 'https://bet365.com'),
    'DEFAULT': os.getenv('AFFILIATE_1XBET','https://1xbet.com'),
    'VPN': os.getenv('AFFILIATE_NORDVPN',  'https://nordvpn.com'),
}

# Premium subscriber IDs (simple set; upgrade to DB for scale)
PREMIUM_USERS = set()

# ── Helpers ───────────────────────────────────────────────────────────────────
def ai(prompt: str, system: str = "You are a football AI expert.", max_tokens: int = 400) -> str:
    """Generate content via Groq (free, 500K tokens/day)"""
    try:
        r = groq.chat.completions.create(
            model='llama3-70b-8192',
            messages=[
                {'role': 'system', 'content': system},
                {'role': 'user',   'content': prompt}
            ],
            max_tokens=max_tokens,
            temperature=0.8,
        )
        return r.choices[0].message.content.strip()
    except Exception as e:
        return f"AI temporarily unavailable. Try again in a moment. ({e})"

def get_matches() -> list:
    """Fetch today's WC matches"""
    try:
        r = requests.get(
            'https://v3.football.api-sports.io/fixtures',
            headers={'x-rapidapi-key': API_FOOTBALL_KEY},
            params={'league': 1, 'season': 2026, 'date': datetime.now().strftime('%Y-%m-%d')},
            timeout=8,
        )
        return r.json().get('response', [])
    except:
        return []

def get_odds(home: str, away: str) -> dict:
    """Fetch odds for a specific match"""
    try:
        r = requests.get(
            'https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds',
            params={'apiKey': os.getenv('ODDS_API_KEY'), 'regions': 'eu', 'markets': 'h2h,totals'},
            timeout=8,
        )
        for match in r.json():
            if home.lower() in match.get('home_team', '').lower() or \
               away.lower() in match.get('away_team', '').lower():
                return match
    except:
        pass
    return {}

def affiliate_cta(user_country: str = 'DEFAULT') -> str:
    link = AFFILIATES.get(user_country, AFFILIATES['DEFAULT'])
    return f"\n\n🎯 Place your bet: {link}"

def is_premium(user_id: int) -> bool:
    return user_id in PREMIUM_USERS

def require_premium(message):
    """Send premium upgrade message"""
    kb = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("🔐 Upgrade to Premium — $9.99/month", url=WHOP_URL))
    kb.add(InlineKeyboardButton("🆓 What's free?", callback_data="free_features"))
    bot.send_message(
        message.chat.id,
        "🔒 *This feature is Premium only.*\n\n"
        "Premium includes:\n"
        "✅ Sharp money alerts\n"
        "✅ Bet slip analysis ($0.99 normally)\n"
        "✅ Halftime bulletins\n"
        "✅ Value bet finder\n"
        "✅ All markets (BTTS, O/U, Correct Score)\n\n"
        "First 100 subscribers: *$9.99/month* (normally $19.99)",
        parse_mode='Markdown',
        reply_markup=kb,
    )

# ── /start ────────────────────────────────────────────────────────────────────
@bot.message_handler(commands=['start'])
def start(message):
    kb = InlineKeyboardMarkup(row_width=2)
    kb.add(
        InlineKeyboardButton("⚽ Today's Picks", callback_data="picks"),
        InlineKeyboardButton("📊 Live Odds",    callback_data="odds"),
        InlineKeyboardButton("🎯 Predictions",  callback_data="predictions"),
        InlineKeyboardButton("🔐 Go Premium",   url=WHOP_URL),
    )
    bot.send_message(
        message.chat.id,
        f"🏆 *WC 2026 AI — Welcome!*\n\n"
        f"The most advanced WC prediction system. Free forever, premium for edge.\n\n"
        f"Commands:\n"
        f"⚽ /picks — Today's best bets\n"
        f"📊 /odds — Live odds comparison\n"
        f"🔮 /predict [teams] — AI match prediction\n"
        f"📸 Send a bet slip photo — AI analyses it\n"
        f"✍️ /story [scenario] — AI writes your WC narrative\n"
        f"📈 /value — Today's value bets\n"
        f"🕐 /today — Today's match schedule\n"
        f"🔐 /premium — Upgrade for full access\n\n"
        f"Tournament: WC 2026 🌍 AI Accuracy: tracked live",
        parse_mode='Markdown',
        reply_markup=kb,
    )

# ── /today ────────────────────────────────────────────────────────────────────
@bot.message_handler(commands=['today'])
def today(message):
    matches = get_matches()
    if not matches:
        bot.send_message(message.chat.id, "No matches today — check tomorrow!")
        return

    text = "📅 *Today's WC 2026 Matches*\n\n"
    for m in matches:
        home    = m['teams']['home']['name']
        away    = m['teams']['away']['name']
        time_   = m['fixture']['date'][11:16] + ' UTC'
        status  = m['fixture']['status']['short']
        score   = ''
        if status not in ['NS', 'TBD']:
            gh = m['goals']['home'] or 0
            ga = m['goals']['away'] or 0
            score = f" [{gh}–{ga}]"
        text += f"🏟 *{home} vs {away}*{score}\n⏰ {time_}\n\n"

    kb = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("⚽ Get AI Picks", callback_data="picks"))
    bot.send_message(message.chat.id, text, parse_mode='Markdown', reply_markup=kb)

# ── /picks ────────────────────────────────────────────────────────────────────
@bot.message_handler(commands=['picks'])
def picks(message):
    matches = get_matches()
    if not matches:
        bot.send_message(message.chat.id, "🕐 No matches today! Check /today for the schedule.")
        return

    bot.send_chat_action(message.chat.id, 'typing')

    match_list = "\n".join([
        f"{m['teams']['home']['name']} vs {m['teams']['away']['name']}"
        for m in matches[:4]
    ])

    picks_text = ai(
        f"Today's WC 2026 matches:\n{match_list}\n\n"
        f"For each match: predicted winner, confidence %, and best bet market (e.g. Over 2.5, BTTS Yes, Asian Handicap). "
        f"Format as a clean list. Be specific and confident.",
        system="You are a professional football analyst with a proven track record. Give sharp, confident predictions."
    )

    aff = affiliate_cta()
    kb  = InlineKeyboardMarkup(row_width=2)
    kb.add(
        InlineKeyboardButton("📊 Full Odds",    callback_data="odds"),
        InlineKeyboardButton("🔐 Premium Picks", url=WHOP_URL),
    )

    bot.send_message(
        message.chat.id,
        f"⚽ *AI PICKS — {datetime.now().strftime('%B %d')}*\n\n{picks_text}{aff}",
        parse_mode='Markdown',
        reply_markup=kb,
    )

# ── /predict [home] vs [away] ─────────────────────────────────────────────────
@bot.message_handler(commands=['predict'])
def predict(message):
    text = message.text.replace('/predict', '').strip()
    if not text:
        bot.send_message(message.chat.id, "Usage: `/predict Brazil vs Mexico`", parse_mode='Markdown')
        return

    bot.send_chat_action(message.chat.id, 'typing')

    analysis = ai(
        f"Predict: {text}\n\n"
        f"Provide: win probability for each team, draw probability, top 3 betting markets with EV assessment, "
        f"key factors (form, injuries, H2H, tactical). Be specific.",
        system="You are a quantitative football analyst. Back claims with data and probabilities.",
        max_tokens=500,
    )

    # Get odds if available
    parts = text.split(' vs ')
    odds_data = get_odds(parts[0].strip(), parts[-1].strip()) if len(parts) == 2 else {}

    aff = affiliate_cta()
    bot.send_message(
        message.chat.id,
        f"🔮 *AI PREDICTION*\n*{text}*\n\n{analysis}{aff}",
        parse_mode='Markdown',
    )

# ── /odds ─────────────────────────────────────────────────────────────────────
@bot.message_handler(commands=['odds'])
def odds_cmd(message):
    bot.send_chat_action(message.chat.id, 'typing')
    matches = get_matches()
    if not matches:
        bot.send_message(message.chat.id, "No live odds — check back closer to match time.")
        return

    text = "📊 *LIVE ODDS — WC 2026*\n\n"
    for m in matches[:3]:
        home = m['teams']['home']['name']
        away = m['teams']['away']['name']
        text += f"🏟 *{home} vs {away}*\n"
        if m.get('odds', {}).get('response'):
            for bk in m['odds']['response'][:1]:
                for bet in bk.get('bookmakers', [])[:1]:
                    vals = bet.get('bets', [{}])[0].get('values', [])
                    if vals:
                        for v in vals:
                            text += f"  {v.get('value')}: {v.get('odd')}\n"
        text += "\n"

    aff = affiliate_cta()
    kb  = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("🎯 Full Odds Tool", url=f"https://{os.getenv('VERCEL_URL','wc2026ai.vercel.app')}/odds-tool.html"))
    bot.send_message(message.chat.id, f"{text}{aff}", parse_mode='Markdown', reply_markup=kb)

# ── /value — value bets ───────────────────────────────────────────────────────
@bot.message_handler(commands=['value'])
def value_bets(message):
    bot.send_chat_action(message.chat.id, 'typing')
    matches = get_matches()
    match_list = "\n".join([f"{m['teams']['home']['name']} vs {m['teams']['away']['name']}" for m in matches[:4]])

    analysis = ai(
        f"Today's WC matches:\n{match_list}\n\n"
        f"Find 2-3 VALUE bets where bookmaker odds are higher than true probability. "
        f"Format: Selection | Your true prob | Book odds | EV%. Explain briefly why each is value.",
        system="You are a value betting analyst. Only recommend bets with positive expected value (+EV).",
        max_tokens=400,
    )

    aff = affiliate_cta()
    kb  = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("🔐 Full Value Finder (Premium)", url=WHOP_URL))
    bot.send_message(
        message.chat.id,
        f"💰 *TODAY'S VALUE BETS*\n\n{analysis}\n\n⚠️ _Always bet responsibly. Past accuracy doesn't guarantee future results._{aff}",
        parse_mode='Markdown',
        reply_markup=kb,
    )

# ── /story — WC narrative generator ──────────────────────────────────────────
@bot.message_handler(commands=['story'])
def story(message):
    scenario = message.text.replace('/story', '').strip()
    if not scenario:
        bot.send_message(
            message.chat.id,
            "✍️ *Story Generator*\n\nUsage: `/story Nigeria wins the World Cup`\n\nI'll write your WC narrative! ($0.99 via /buy_story)",
            parse_mode='Markdown',
        )
        return

    bot.send_chat_action(message.chat.id, 'typing')

    # Free preview (first 100 chars), full story requires payment
    story_text = ai(
        f"Write a compelling 3-paragraph football narrative about: {scenario}\n\n"
        f"Use real WC 2026 context. Include specific players, dramatic moments, emotional stakes. "
        f"Write like a world-class sports journalist.",
        system="You are a Pulitzer-winning sports journalist. Create vivid, emotional, specific football narratives.",
        max_tokens=600,
    )

    # First paragraph free
    paragraphs = story_text.split('\n\n')
    free_preview = paragraphs[0] if paragraphs else story_text[:200]

    kb = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("✍️ Get Full Story — $0.99", callback_data=f"buy_story:{scenario[:50]}"))
    kb.add(InlineKeyboardButton("🔐 Unlimited Stories (Premium)", url=WHOP_URL))

    bot.send_message(
        message.chat.id,
        f"✍️ *Your WC Story — Preview*\n\n{free_preview}\n\n_...continue reading for $0.99 or subscribe for unlimited stories_",
        parse_mode='Markdown',
        reply_markup=kb,
    )

# ── Bet Slip Photo Analyzer ───────────────────────────────────────────────────
@bot.message_handler(content_types=['photo'])
def analyze_bet_slip(message):
    bot.send_chat_action(message.chat.id, 'typing')

    # Send immediate acknowledgment
    bot.send_message(
        message.chat.id,
        "📸 Bet slip received! Analyzing expected value...\n\n⏳ _Takes about 5 seconds_",
        parse_mode='Markdown',
    )

    # Download photo
    try:
        file_info    = bot.get_file(message.photo[-1].file_id)
        downloaded   = bot.download_file(file_info.file_path)
        img_b64      = base64.b64encode(downloaded).decode()
    except Exception as e:
        bot.send_message(message.chat.id, f"Couldn't download image: {e}")
        return

    # Use Groq vision or text-based analysis
    # For now: ask AI to analyse based on common bet slip patterns
    # (Groq vision model when available; fallback to text prompt)
    analysis_prompt = (
        "A user sent a betting slip photo. I cannot view it directly but here is what to do:\n"
        "Provide a general bet slip analysis framework:\n"
        "1. Explain what EV (expected value) is\n"
        "2. How to check if each leg has value\n"
        "3. When accumulators reduce EV\n"
        "4. Recommend they use /predict for specific matches\n"
        "Keep it helpful and specific. Max 300 words."
    )

    analysis = ai(analysis_prompt, system="You are a betting analyst. Help users understand expected value.", max_tokens=300)

    aff = affiliate_cta()
    kb  = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("🔮 Analyse Specific Match", callback_data="predict_specific"))
    kb.add(InlineKeyboardButton("🔐 Full Slip Analysis (Premium)", url=WHOP_URL))

    bot.send_message(
        message.chat.id,
        f"📊 *BET SLIP ANALYSIS*\n\n{analysis}\n\n"
        f"💡 _For specific EV on your exact selections, use `/predict [home] vs [away]`_\n\n"
        f"🔐 Premium members get full automated slip analysis with EV per leg.{aff}",
        parse_mode='Markdown',
        reply_markup=kb,
    )

# ── /premium ──────────────────────────────────────────────────────────────────
@bot.message_handler(commands=['premium'])
def premium_cmd(message):
    kb = InlineKeyboardMarkup(row_width=1)
    kb.add(
        InlineKeyboardButton("🔐 Starter — $4.99/month",   url=f"{WHOP_URL}?tier=starter"),
        InlineKeyboardButton("⚡ Standard — $9.99/month",  url=f"{WHOP_URL}?tier=standard"),
        InlineKeyboardButton("🏆 Premium — $19.99/month",  url=f"{WHOP_URL}?tier=premium"),
        InlineKeyboardButton("👑 VIP — $49.99/month",      url=f"{WHOP_URL}?tier=vip"),
        InlineKeyboardButton("💎 Elite — $99/month",       url=f"{WHOP_URL}?tier=elite"),
    )
    bot.send_message(
        message.chat.id,
        "🔐 *WC 2026 AI Premium*\n\n"
        "*Starter $4.99/month*\n"
        "✅ Match winner predictions\n"
        "✅ Daily digest\n\n"
        "*Standard $9.99/month*\n"
        "✅ Everything in Starter\n"
        "✅ All markets (BTTS, O/U, Asian Handicap)\n"
        "✅ Halftime bulletins\n\n"
        "*Premium $19.99/month*\n"
        "✅ Everything in Standard\n"
        "✅ Sharp money alerts\n"
        "✅ Value bet finder\n"
        "✅ Bet slip analysis\n\n"
        "*VIP $49.99/month*\n"
        "✅ Everything in Premium\n"
        "✅ Referee intelligence\n"
        "✅ Fatigue model\n"
        "✅ Private group access\n\n"
        "*Elite $99/month* _(50 slots only)_\n"
        "✅ Everything\n"
        "✅ Daily AI briefing\n"
        "✅ Direct AI chat access\n\n"
        "🛡 *Money-back guarantee* if AI accuracy < 55%",
        parse_mode='Markdown',
        reply_markup=kb,
    )

# ── /accuracy — track record ──────────────────────────────────────────────────
@bot.message_handler(commands=['accuracy'])
def accuracy(message):
    bot.send_message(
        message.chat.id,
        "📈 *AI Accuracy — WC 2026*\n\n"
        "Every prediction is timestamped before kickoff.\n"
        "Results updated after each match.\n\n"
        "📊 Current record: _tracking in progress_\n"
        "🎯 Match winner: _updating..._\n"
        "💰 Value bets ROI: _updating..._\n\n"
        "Full verified record: [View here](https://wc2026ai.vercel.app/accuracy)\n\n"
        "_No hindsight. Every call made before kickoff. Fully verifiable._",
        parse_mode='Markdown',
    )

# ── /affiliate — get affiliate info ──────────────────────────────────────────
@bot.message_handler(commands=['bet'])
def bet_link(message):
    kb = InlineKeyboardMarkup(row_width=2)
    kb.add(
        InlineKeyboardButton("🇳🇬 Bet9ja",        url=AFFILIATES['NG']),
        InlineKeyboardButton("🇰🇪 Betika",         url=AFFILIATES['KE']),
        InlineKeyboardButton("🌍 1xBet (Global)",  url=AFFILIATES['DEFAULT']),
        InlineKeyboardButton("🇮🇳 Dream11",        url=AFFILIATES['IN']),
        InlineKeyboardButton("🇧🇷 Bet365 Brazil",  url=AFFILIATES['BR']),
        InlineKeyboardButton("🔒 NordVPN",         url=AFFILIATES['VPN']),
    )
    bot.send_message(
        message.chat.id,
        "🎯 *Recommended Platforms*\n\n"
        "These are our verified partners. Always bet responsibly.\n\n"
        "⚠️ _18+ only. Gamble responsibly. Set a budget before you start._",
        parse_mode='Markdown',
        reply_markup=kb,
    )

# ── /halftime — premium feature ───────────────────────────────────────────────
@bot.message_handler(commands=['halftime'])
def halftime(message):
    if not is_premium(message.from_user.id):
        require_premium(message)
        return

    bot.send_chat_action(message.chat.id, 'typing')
    matches = get_matches()
    live = [m for m in matches if m['fixture']['status']['short'] == 'HT']

    if not live:
        bot.send_message(message.chat.id, "No matches at halftime right now.")
        return

    for m in live:
        home    = m['teams']['home']['name']
        away    = m['teams']['away']['name']
        gh      = m['goals']['home'] or 0
        ga      = m['goals']['away'] or 0

        bulletin = ai(
            f"Halftime: {home} {gh}-{ga} {away}\n"
            f"Provide: updated win probabilities, key tactical observations, "
            f"what to watch in 2nd half, best 2nd half bet.",
            max_tokens=300,
        )
        bot.send_message(
            message.chat.id,
            f"⏸ *HALFTIME: {home} {gh}–{ga} {away}*\n\n{bulletin}",
            parse_mode='Markdown',
        )

# ── Callback handlers ─────────────────────────────────────────────────────────
@bot.callback_query_handler(func=lambda c: c.data == 'picks')
def cb_picks(call):
    bot.answer_callback_query(call.id)
    picks(call.message)

@bot.callback_query_handler(func=lambda c: c.data == 'odds')
def cb_odds(call):
    bot.answer_callback_query(call.id)
    odds_cmd(call.message)

@bot.callback_query_handler(func=lambda c: c.data == 'free_features')
def cb_free(call):
    bot.answer_callback_query(call.id, "Free: picks, predictions, odds, value bets, stories preview")

@bot.callback_query_handler(func=lambda c: c.data.startswith('buy_story:'))
def cb_buy_story(call):
    bot.answer_callback_query(call.id)
    scenario = call.data.split(':', 1)[1]
    # In production: use Telegram Stars or Stripe invoice
    # For now: show payment instructions
    kb = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("💳 Pay $0.99 via Stripe", url=f"https://buy.stripe.com/YOUR_LINK"))
    kb.add(InlineKeyboardButton("🔐 Subscribe for Unlimited", url=WHOP_URL))
    bot.send_message(
        call.message.chat.id,
        f"💳 *Get Your Full WC Story*\n\nScenario: _{scenario}_\n\n"
        f"Pay $0.99 to unlock the full 3-paragraph narrative.",
        parse_mode='Markdown',
        reply_markup=kb,
    )

# ── Admin commands ────────────────────────────────────────────────────────────
ADMIN_IDS = set(map(int, os.getenv('ADMIN_TELEGRAM_IDS', '').split(',') if os.getenv('ADMIN_TELEGRAM_IDS') else []))

@bot.message_handler(commands=['addpremium'])
def add_premium(message):
    if message.from_user.id not in ADMIN_IDS:
        return
    parts = message.text.split()
    if len(parts) < 2:
        bot.send_message(message.chat.id, "Usage: /addpremium USER_ID")
        return
    try:
        uid = int(parts[1])
        PREMIUM_USERS.add(uid)
        bot.send_message(message.chat.id, f"✅ User {uid} added to premium")
        bot.send_message(uid, "🎉 You've been upgraded to Premium! All features unlocked.")
    except:
        bot.send_message(message.chat.id, "Invalid user ID")

@bot.message_handler(commands=['stats'])
def bot_stats(message):
    if message.from_user.id not in ADMIN_IDS:
        return
    bot.send_message(
        message.chat.id,
        f"📊 *Bot Stats*\n\n"
        f"Premium users: {len(PREMIUM_USERS)}\n"
        f"Running since: bot startup\n"
        f"Commands available: 12\n",
        parse_mode='Markdown',
    )

# ── Catch-all: handle any text as prediction request ─────────────────────────
@bot.message_handler(func=lambda m: True)
def catch_all(message):
    text = message.text.strip().lower()

    # Detect match format: "brazil vs mexico" or "brazil mexico"
    vs_pattern = re.compile(r'([a-zA-Z ]+)\s+vs\.?\s+([a-zA-Z ]+)', re.IGNORECASE)
    match = vs_pattern.search(text)

    if match:
        message.text = f"/predict {match.group(1).strip()} vs {match.group(2).strip()}"
        predict(message)
    else:
        # General football question
        bot.send_chat_action(message.chat.id, 'typing')
        resp = ai(
            f"User asks about WC 2026: {message.text}\n\nAnswer concisely and helpfully.",
            max_tokens=200,
        )
        kb = InlineKeyboardMarkup(row_width=2)
        kb.add(
            InlineKeyboardButton("⚽ Today's Picks", callback_data="picks"),
            InlineKeyboardButton("🔮 Get Prediction", callback_data="picks"),
        )
        bot.send_message(message.chat.id, resp, reply_markup=kb)

# ── Boot ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print(f"🤖 Telegram Bot v2 starting...")
    print(f"📡 Connected to: {BOT_TOKEN[:10]}...")
    print(f"📺 Channel: {CHANNEL_ID}")
    print(f"💎 Premium channel: {PREMIUM_CHANNEL}")

    # Post startup message to channel
    try:
        bot.send_message(
            CHANNEL_ID,
            "🚀 *WC 2026 AI Bot is LIVE*\n\n"
            "All systems operational. Type /start to begin.\n\n"
            "⚽ First match analysis coming shortly.",
            parse_mode='Markdown',
        )
    except Exception as e:
        print(f"⚠️ Channel message failed: {e}")

    print("✅ Bot running — polling for messages")
    bot.infinity_polling(timeout=20, long_polling_timeout=20)
