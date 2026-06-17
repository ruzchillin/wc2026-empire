"""
SMS System — WC 2026 AI Empire
Handles: subscriber management, pre-match predictions, goal alerts, billing
Platform: Africa's Talking (free API, pay-per-SMS)
Markets: Nigeria, Kenya, South Africa, Ghana, Tanzania, Uganda, Ethiopia,
         Morocco, Egypt, India, Bangladesh, Indonesia, Philippines, Brazil, Colombia
"""

import os
import json
import sqlite3
import schedule
import time
import requests
import africastalking
from datetime import datetime, timedelta
from groq import Groq

# ── Init ──────────────────────────────────────────────────────────────────────
africastalking.initialize(
    username=os.getenv('AT_USERNAME', 'sandbox'),
    api_key=os.getenv('AT_API_KEY')
)
sms_service   = africastalking.SMS
groq_client   = Groq(api_key=os.getenv('GROQ_API_KEY'))
DB_PATH       = 'sms_subscribers.db'

# ── Market config ─────────────────────────────────────────────────────────────
MARKETS = {
    'NG': {'name': 'Nigeria',     'lang': 'en',  'price_week': 0.50, 'currency': 'NGN', 'shortcode': os.getenv('AT_SHORTCODE_NG', '1234')},
    'KE': {'name': 'Kenya',       'lang': 'sw',  'price_week': 0.50, 'currency': 'KES', 'shortcode': os.getenv('AT_SHORTCODE_KE', '1234')},
    'ZA': {'name': 'South Africa','lang': 'en',  'price_week': 0.50, 'currency': 'ZAR', 'shortcode': os.getenv('AT_SHORTCODE_ZA', '1234')},
    'GH': {'name': 'Ghana',       'lang': 'en',  'price_week': 0.40, 'currency': 'GHS', 'shortcode': os.getenv('AT_SHORTCODE_GH', '1234')},
    'TZ': {'name': 'Tanzania',    'lang': 'sw',  'price_week': 0.40, 'currency': 'TZS', 'shortcode': os.getenv('AT_SHORTCODE_TZ', '1234')},
    'UG': {'name': 'Uganda',      'lang': 'sw',  'price_week': 0.40, 'currency': 'UGX', 'shortcode': os.getenv('AT_SHORTCODE_UG', '1234')},
    'ET': {'name': 'Ethiopia',    'lang': 'am',  'price_week': 0.30, 'currency': 'ETB', 'shortcode': os.getenv('AT_SHORTCODE_ET', '1234')},
    'MA': {'name': 'Morocco',     'lang': 'ar',  'price_week': 0.30, 'currency': 'MAD', 'shortcode': os.getenv('AT_SHORTCODE_MA', '1234')},
    'EG': {'name': 'Egypt',       'lang': 'ar',  'price_week': 0.30, 'currency': 'EGP', 'shortcode': os.getenv('AT_SHORTCODE_EG', '1234')},
    'IN': {'name': 'India',       'lang': 'hi',  'price_week': 0.20, 'currency': 'INR', 'shortcode': os.getenv('AT_SHORTCODE_IN', '1234')},
    'BD': {'name': 'Bangladesh',  'lang': 'bn',  'price_week': 0.20, 'currency': 'BDT', 'shortcode': os.getenv('AT_SHORTCODE_BD', '1234')},
    'ID': {'name': 'Indonesia',   'lang': 'id',  'price_week': 0.20, 'currency': 'IDR', 'shortcode': os.getenv('AT_SHORTCODE_ID', '1234')},
    'PH': {'name': 'Philippines', 'lang': 'tl',  'price_week': 0.20, 'currency': 'PHP', 'shortcode': os.getenv('AT_SHORTCODE_PH', '1234')},
    'BR': {'name': 'Brazil',      'lang': 'pt',  'price_week': 0.50, 'currency': 'BRL', 'shortcode': os.getenv('AT_SHORTCODE_BR', '1234')},
    'CO': {'name': 'Colombia',    'lang': 'es',  'price_week': 0.40, 'currency': 'COP', 'shortcode': os.getenv('AT_SHORTCODE_CO', '1234')},
}

AFFILIATE_LINKS = {
    'NG': os.getenv('AFFILIATE_BET9JA',   'https://bet9ja.com'),
    'KE': os.getenv('AFFILIATE_BETIKA',   'https://betika.com'),
    'ZA': os.getenv('AFFILIATE_HOLLYW',   'https://hollywoodbets.net'),
    'GH': os.getenv('AFFILIATE_BETWAY_GH','https://betway.com.gh'),
    'TZ': os.getenv('AFFILIATE_SPORTPESA','https://sportpesa.co.tz'),
    'UG': os.getenv('AFFILIATE_SPORTPESA','https://sportpesa.co.ug'),
    'ET': os.getenv('AFFILIATE_1XBET',    'https://1xbet.com'),
    'MA': os.getenv('AFFILIATE_1XBET',    'https://1xbet.com'),
    'EG': os.getenv('AFFILIATE_1XBET',    'https://1xbet.com'),
    'IN': os.getenv('AFFILIATE_DREAM11',  'https://dream11.com'),
    'BD': os.getenv('AFFILIATE_1XBET',    'https://1xbet.com'),
    'ID': os.getenv('AFFILIATE_1XBET',    'https://1xbet.com'),
    'PH': os.getenv('AFFILIATE_1XBET',    'https://1xbet.com'),
    'BR': os.getenv('AFFILIATE_BET365_BR','https://bet365.com'),
    'CO': os.getenv('AFFILIATE_BETCRIS',  'https://betcris.com'),
}

# ── Database ──────────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS subscribers (
        phone       TEXT PRIMARY KEY,
        country     TEXT NOT NULL,
        language    TEXT NOT NULL,
        active      INTEGER DEFAULT 1,
        subscribed  TEXT DEFAULT CURRENT_TIMESTAMP,
        expires     TEXT,
        team        TEXT DEFAULT '',
        paid_weeks  INTEGER DEFAULT 0
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS messages_sent (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        phone       TEXT,
        message     TEXT,
        type        TEXT,
        sent_at     TEXT DEFAULT CURRENT_TIMESTAMP,
        cost        REAL DEFAULT 0
    )''')
    conn.commit()
    conn.close()
    print("✅ Database initialised")

def subscribe(phone: str, country: str):
    """Add a new subscriber"""
    market = MARKETS.get(country, MARKETS['NG'])
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    expires = (datetime.now() + timedelta(days=7)).isoformat()
    c.execute(
        'INSERT OR REPLACE INTO subscribers (phone, country, language, expires) VALUES (?,?,?,?)',
        (phone, country, market['lang'], expires)
    )
    conn.commit()
    conn.close()
    # Welcome message
    welcome = build_welcome(country, market['lang'])
    send_sms([phone], welcome)
    print(f"✅ Subscribed: {phone} ({country})")

def unsubscribe(phone: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('UPDATE subscribers SET active=0 WHERE phone=?', (phone,))
    conn.commit()
    conn.close()
    send_sms([phone], "You have been unsubscribed. Reply JOIN to resubscribe anytime.")
    print(f"❌ Unsubscribed: {phone}")

def get_active_subscribers(country: str = None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    if country:
        c.execute('SELECT phone, country, language FROM subscribers WHERE active=1 AND country=?', (country,))
    else:
        c.execute('SELECT phone, country, language FROM subscribers WHERE active=1')
    rows = c.fetchall()
    conn.close()
    return rows

def get_subscriber_count():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT country, COUNT(*) FROM subscribers WHERE active=1 GROUP BY country')
    rows = c.fetchall()
    conn.close()
    return {r[0]: r[1] for r in rows}

# ── SMS sender ────────────────────────────────────────────────────────────────
def send_sms(recipients: list, message: str, msg_type: str = 'general'):
    """Send SMS via Africa's Talking. Max 160 chars per segment."""
    if not recipients:
        return
    # Trim to 160 chars (1 SMS = 1 charge)
    message = message[:160]
    try:
        response = sms_service.send(message, recipients)
        # Log
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        for phone in recipients:
            c.execute('INSERT INTO messages_sent (phone, message, type) VALUES (?,?,?)',
                      (phone, message, msg_type))
        conn.commit()
        conn.close()
        print(f"📱 SMS sent to {len(recipients)} recipients")
        return response
    except Exception as e:
        print(f"❌ SMS error: {e}")

def send_to_country(country: str, message: str, msg_type: str = 'broadcast'):
    """Broadcast to all active subscribers in a country"""
    subs = get_active_subscribers(country)
    phones = [s[0] for s in subs]
    if phones:
        send_sms(phones, message, msg_type)

# ── AI content generation ─────────────────────────────────────────────────────
LANG_PROMPTS = {
    'en': "Reply in clear English. Max 140 characters.",
    'sw': "Jibu kwa Kiswahili. Maneno 140 au chini.",
    'ha': "Amsa da Hausa. Haruffa 140 ko ƙasa.",
    'yo': "Dahun ni Yoruba. Ọrọ 140 tabi kere.",
    'am': "በአማርኛ ይመልሱ። ቢበዛ 140 ፊደሎች።",
    'ar': "أجب بالعربية. 140 حرفاً كحد أقصى.",
    'hi': "हिंदी में जवाब दें। अधिकतम 140 अक्षर।",
    'bn': "বাংলায় উত্তর দিন। সর্বোচ্চ ১৪০ অক্ষর।",
    'id': "Jawab dalam Bahasa Indonesia. Maks 140 karakter.",
    'tl': "Sumagot sa Filipino. Max 140 karakter.",
    'pt': "Responda em Português. Máx 140 caracteres.",
    'es': "Responde en Español. Máx 140 caracteres.",
}

def generate_sms_content(prompt: str, language: str = 'en') -> str:
    """Generate SMS-length content via Groq"""
    lang_instruction = LANG_PROMPTS.get(language, LANG_PROMPTS['en'])
    try:
        resp = groq_client.chat.completions.create(
            model='llama3-70b-8192',
            messages=[
                {'role': 'system', 'content': f'You are a football AI assistant sending SMS alerts. {lang_instruction} Include ONLY the prediction message. No intro. No sign-off.'},
                {'role': 'user', 'content': prompt}
            ],
            max_tokens=60,
            temperature=0.7
        )
        return resp.choices[0].message.content.strip()[:155]
    except Exception as e:
        print(f"❌ Groq error: {e}")
        return ""

def build_welcome(country: str, language: str) -> str:
    prompts = {
        'en': f"Welcome to WC2026 AI! You'll get match predictions, goal alerts & value bets. Text STOP to unsub.",
        'sw': f"Karibu WC2026 AI! Utapata utabiri wa mechi, arifa za magoli. Andika STOP kujiondoa.",
        'ha': f"Barka da zuwa WC2026 AI! Za ka sami hasashen wasanni. Rubuta STOP don ficewa.",
        'ar': f"مرحباً بك في WC2026 AI! ستتلقى تنبؤات المباريات وتنبيهات الأهداف. أرسل STOP للإلغاء.",
        'hi': f"WC2026 AI में स्वागत! मैच भविष्यवाणी और गोल अलर्ट मिलेंगे। STOP लिखें रद्द करने के लिए।",
        'pt': f"Bem-vindo ao WC2026 AI! Previsões de jogos e alertas de gols. Envie STOP para sair.",
    }
    return prompts.get(language, prompts['en'])

# ── Match data ────────────────────────────────────────────────────────────────
def get_todays_matches():
    """Fetch today's WC matches from API-Football"""
    try:
        resp = requests.get(
            'https://v3.football.api-sports.io/fixtures',
            headers={'x-rapidapi-key': os.getenv('API_FOOTBALL_KEY')},
            params={'league': 1, 'season': 2026, 'date': datetime.now().strftime('%Y-%m-%d')}
        )
        return resp.json().get('response', [])
    except Exception as e:
        print(f"❌ API-Football error: {e}")
        return []

def get_ai_prediction(home: str, away: str, language: str) -> str:
    """Generate AI match prediction"""
    prompt = f"WC 2026 match: {home} vs {away}. Give win probability for {home} and top betting market in 1 sentence."
    return generate_sms_content(prompt, language)

# ── Scheduled broadcasts ──────────────────────────────────────────────────────
def send_prematch_alerts():
    """Send pre-match predictions 2 hours before kickoff"""
    matches = get_todays_matches()
    now = datetime.now()

    for match in matches:
        kickoff = datetime.fromisoformat(match['fixture']['date'].replace('Z', '+00:00'))
        # Send 2 hours before
        if timedelta(hours=1, minutes=45) < (kickoff - now) < timedelta(hours=2, minutes=15):
            home = match['teams']['home']['name']
            away = match['teams']['away']['name']
            time_str = kickoff.strftime('%H:%M')

            counts = get_subscriber_count()
            print(f"📱 Broadcasting pre-match: {home} vs {away} to {sum(counts.values())} subscribers")

            for country, market in MARKETS.items():
                subs = get_active_subscribers(country)
                if not subs:
                    continue

                lang = market['lang']
                prediction = get_ai_prediction(home, away, lang)
                aff_link = AFFILIATE_LINKS.get(country, '')

                # Format: under 160 chars
                msg = f"{home} v {away} {time_str}. {prediction} Bet: {aff_link}"
                msg = msg[:160]

                phones = [s[0] for s in subs]
                send_sms(phones, msg, 'prematch')

def send_goal_alert(home: str, away: str, scorer: str, minute: int,
                    home_score: int, away_score: int, new_prob: int):
    """Send goal alert to all subscribers immediately"""
    counts = get_subscriber_count()
    total = sum(counts.values())
    print(f"⚽ Goal alert: {home} {home_score}-{away_score} {away} | Broadcasting to {total}")

    for country, market in MARKETS.items():
        subs = get_active_subscribers(country)
        if not subs:
            continue

        lang = market['lang']

        # Language-specific goal alert
        templates = {
            'en': f"GOAL! {home} {home_score}-{away_score} {away} {minute}'. {scorer}. AI: {home if home_score > away_score else away} now {new_prob}% to win.",
            'sw': f"GOLI! {home} {home_score}-{away_score} {away} {minute}'. {scorer}. AI: {new_prob}% kushinda.",
            'ha': f"KWAL! {home} {home_score}-{away_score} {away} {minute}'. {scorer}. AI: {new_prob}% nasara.",
            'ar': f"هدف! {home} {home_score}-{away_score} {away} {minute}'. {scorer}. AI: {new_prob}% للفوز.",
            'hi': f"गोल! {home} {home_score}-{away_score} {away} {minute}'. {scorer}. AI: {new_prob}% जीत।",
            'pt': f"GOL! {home} {home_score}-{away_score} {away} {minute}'. {scorer}. AI: {new_prob}% de vitória.",
        }

        msg = templates.get(lang, templates['en'])[:160]
        phones = [s[0] for s in subs]
        send_sms(phones, msg, 'goal_alert')

def send_daily_digest():
    """Morning digest — yesterday's results + today's matches"""
    matches = get_todays_matches()
    if not matches:
        return

    match_preview = " | ".join([
        f"{m['teams']['home']['name'][:3]} v {m['teams']['away']['name'][:3]}"
        for m in matches[:3]
    ])

    for country, market in MARKETS.items():
        subs = get_active_subscribers(country)
        if not subs:
            continue

        lang = market['lang']
        prompt = f"Today's WC matches: {match_preview}. Give the best bet of the day in 1 sentence."
        tip = generate_sms_content(prompt, lang)
        aff = AFFILIATE_LINKS.get(country, '')

        msg = f"WC AI Daily: {tip} {aff}"[:160]
        phones = [s[0] for s in subs]
        send_sms(phones, msg, 'daily_digest')

# ── Incoming SMS handler (webhook endpoint) ───────────────────────────────────
def handle_incoming_sms(phone: str, message: str, country: str):
    """Process replies: JOIN, STOP, TEAM, HELP"""
    msg = message.strip().upper()

    if msg in ['JOIN', 'START', 'SUBSCRIBE', 'YES']:
        subscribe(phone, country)
    elif msg in ['STOP', 'UNSUBSCRIBE', 'QUIT', 'END', 'CANCEL']:
        unsubscribe(phone)
    elif msg.startswith('TEAM '):
        team = message[5:].strip()
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('UPDATE subscribers SET team=? WHERE phone=?', (team, phone))
        conn.commit()
        conn.close()
        send_sms([phone], f"Team set to {team}. You'll get custom alerts for their matches!")
    elif msg == 'HELP':
        send_sms([phone], "WC2026 AI: Reply STOP to unsub, TEAM [name] to follow a team, STATS for accuracy record.")
    elif msg == 'STATS':
        send_sms([phone], "AI accuracy WC2026: tracking live. Check wc2026ai.com for full record.")
    else:
        # AI response for any other query
        response = generate_sms_content(f"User asks: {message}", 'en')
        if response:
            send_sms([phone], response)

# ── Web endpoint for Africa's Talking callback ────────────────────────────────
# Deploy this alongside your main app on Railway
# Africa's Talking will POST to this URL when someone texts your shortcode
from flask import Flask, request, jsonify
app = Flask(__name__)

@app.route('/sms/incoming', methods=['POST'])
def incoming_sms():
    """Africa's Talking POST callback for incoming SMS"""
    phone   = request.form.get('from', '')
    message = request.form.get('text', '')
    to      = request.form.get('to', '')  # your shortcode

    # Detect country from shortcode
    country = 'NG'  # default; enhance with phone prefix detection
    for code, market in MARKETS.items():
        if to == market.get('shortcode'):
            country = code
            break

    handle_incoming_sms(phone, message, country)
    return jsonify({'status': 'ok'})

@app.route('/sms/delivery', methods=['POST'])
def delivery_report():
    """Delivery report callback"""
    status = request.form.get('status')
    phone  = request.form.get('phoneNumber')
    print(f"📨 Delivery [{status}]: {phone}")
    return jsonify({'status': 'ok'})

@app.route('/sms/stats', methods=['GET'])
def stats():
    """Simple stats endpoint"""
    counts = get_subscriber_count()
    return jsonify({'subscribers': counts, 'total': sum(counts.values())})

# ── Scheduler ─────────────────────────────────────────────────────────────────
def start_scheduler():
    schedule.every().day.at("07:00").do(send_daily_digest)
    schedule.every(30).minutes.do(send_prematch_alerts)

    print("📅 SMS scheduler running")
    while True:
        schedule.run_pending()
        time.sleep(60)

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    import threading
    # Run Flask in background thread, scheduler in main thread
    flask_thread = threading.Thread(
        target=lambda: app.run(host='0.0.0.0', port=int(os.getenv('SMS_PORT', 5001)))
    )
    flask_thread.daemon = True
    flask_thread.start()
    print("🚀 SMS System online — Flask on :5001, scheduler running")
    start_scheduler()
