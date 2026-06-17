# Account Setup Checklist — WC 2026 Empire
Do these IN ORDER. Each one you only need ~5 minutes.
Write down what the checklist tells you to save — you'll paste it into .env at the end.

---

## ✅ PHASE 1: INFRASTRUCTURE (Do these first — everything depends on them)

### 1. GitHub (free)
**URL:** https://github.com/signup
- Sign up with any email
- Choose username (something professional like `wc2026intel` or your name)
- **After signup:** Create a new repo called `wc2026-empire`
- Set to **Private**
- Don't initialize with README
- **SAVE:** Your GitHub username

### 2. Railway (free $5 credit → $5/mo after)
**URL:** https://railway.app
- Click "Login" → "Login with GitHub" (uses account you just made)
- This automatically links both accounts
- **After login:** Don't create a project yet — we'll do it via CLI
- **SAVE:** Nothing needed yet — CLI handles it

### 3. Vercel (free forever for static sites)
**URL:** https://vercel.com/signup
- Click "Continue with GitHub"
- **After login:** Don't create a project — CLI handles it
- **SAVE:** Nothing needed yet

### 4. Groq AI (free — 500K tokens/day)
**URL:** https://console.groq.com
- Sign up with any email
- After confirming email: go to **API Keys** in left sidebar
- Click **Create API Key**
- **SAVE:** `GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxx`

---

## ✅ PHASE 2: DATA APIS

### 5. API-Football via RapidAPI (free 100 req/day)
**URL:** https://rapidapi.com/api-sports/api/api-football
- Click "Subscribe to Test" → select **Basic (Free)** plan
- You need a RapidAPI account first if you don't have one
- After subscribing: click **Test Endpoint** → look at the request headers
- **SAVE:** `RAPIDAPI_KEY=xxxxxxxxxxxxxxxxxx` (from the header `X-RapidAPI-Key`)

### 6. The Odds API (free 500 req/month)
**URL:** https://the-odds-api.com
- Click "Get API Key" → enter email
- **SAVE:** `ODDS_API_KEY=xxxxxxxxxxxxxxxxxx`

---

## ✅ PHASE 3: TELEGRAM

### 7. Telegram Bot (free)
**On your phone or Telegram Desktop:**
1. Open Telegram → search `@BotFather`
2. Send `/newbot`
3. Name: `WC 2026 Intel`
4. Username: `wc2026intel_bot` (must end in _bot, pick something available)
5. BotFather gives you a token
- **SAVE:** `TELEGRAM_BOT_TOKEN=1234567890:ABCDxxxxxxxxxxx`

**Create your channels:**
1. Create a Telegram channel → name it "WC 2026 Free Tips"
2. Add your bot as an admin to that channel
3. Send a message in the channel, then visit:
   `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   Find the chat id (negative number like `-1001234567890`)
- **SAVE:** `TELEGRAM_CHANNEL_ID=-1001234567890`

**Create premium channel:**
1. Create another channel → "WC 2026 Premium" (set to Private)
2. Same process — add bot as admin, get the ID
- **SAVE:** `TELEGRAM_PREMIUM_CHANNEL=-1009876543210`

---

## ✅ PHASE 4: NEWSLETTER

### 8. Beehiiv (free to 2,500 subscribers)
**URL:** https://beehiiv.com
- Sign up → create publication named "WC 2026 Intel"
- After setup: go to **Settings → API** → Generate API key
- Also copy your **Publication ID** (looks like `pub_xxxxxxxx`)
- **SAVE:**
  - `BEEHIIV_API_KEY=xxxxxxxxxx`
  - `BEEHIIV_PUBLICATION_ID=pub_xxxxxxxxxx`

---

## ✅ PHASE 5: AFFILIATE PROGRAMS (apply to all — takes 5 min each, approval takes 1-7 days)

### 9. Bet9ja (Nigeria — biggest market)
**URL:** https://bet9ja.com/affiliate
- Apply as a content creator / tipster site
- They pay: 30% revenue share
- **SAVE:** `BET9JA_AFFILIATE_ID=xxxxxxxxxx` (after approval)

### 10. 1xBet (global — highest paying)
**URL:** https://1xbet-partners.com
- Apply → choose Revenue Share (40-50%)
- They accept sites in any language
- **SAVE:** `XBET_AFFILIATE_ID=xxxxxxxxxx`

### 11. Betika (Kenya)
**URL:** https://betika.com/affiliate or email affiliates@betika.com
- **SAVE:** `BETIKA_AFFILIATE_ID=xxxxxxxxxx`

### 12. Betway Africa
**URL:** https://betwaypartners.com
- **SAVE:** `BETWAY_AFFILIATE_ID=xxxxxxxxxx`

### 13. NordVPN (for privacy-conscious users)
**URL:** https://affiliates.nordvpn.com
- Instant approval, 40% commission
- **SAVE:** `NORDVPN_AFFILIATE_ID=xxxxxxxxxx`

### 14. Amazon Associates (for merch / books)
**URL:** https://affiliate-program.amazon.com
- **SAVE:** `AMAZON_AFFILIATE_ID=xxxxxxxxxx`

### 15. Booking.com (hotel recommendations during WC)
**URL:** https://www.booking.com/affiliate-program/v2/index.html
- **SAVE:** `BOOKING_AFFILIATE_ID=xxxxxxxxxx`

---

## ✅ PHASE 6: MONETIZATION PLATFORMS

### 16. Whop (subscription gating — free)
**URL:** https://whop.com/sell
- Create a seller account
- Create a product called "WC 2026 Premium" → set price to $9.99/month
- Get your product link
- **SAVE:** `WHOP_PRODUCT_LINK=https://whop.com/wc2026-premium/`

### 17. Stripe (for Oracle Race tournament — free until you earn)
**URL:** https://dashboard.stripe.com/register
- Sign up → you can complete verification later
- After confirming email: create a Payment Link for $50
- **SAVE:** `STRIPE_PAYMENT_LINK=https://buy.stripe.com/xxxxxxxxxx`

---

## ✅ PHASE 7: SMS (add after you have $10 revenue)

### 18. Africa's Talking
**URL:** https://africastalking.com
- Sign up → go to **Sandbox** (free testing)
- Get API key from Settings
- **SAVE:**
  - `AFRICASTALKING_USERNAME=sandbox` (then change to your real username)
  - `AFRICASTALKING_API_KEY=xxxxxxxxxx`

---

## DONE? Fill in your .env file

Open the `.env.example` file in your outputs folder.
Copy it to `.env` and paste in every value you saved above.

The file looks like:
```
GROQ_API_KEY=paste_here
RAPIDAPI_KEY=paste_here
ODDS_API_KEY=paste_here
TELEGRAM_BOT_TOKEN=paste_here
TELEGRAM_CHANNEL_ID=paste_here
TELEGRAM_PREMIUM_CHANNEL=paste_here
BEEHIIV_API_KEY=paste_here
BEEHIIV_PUBLICATION_ID=paste_here
...
```

**When your .env is filled in → tell me and I'll run the deployment commands.**

---

## TIME ESTIMATE
| Phase | Accounts | Time |
|-------|----------|------|
| Phase 1 (infra) | GitHub, Railway, Vercel, Groq | 20 min |
| Phase 2 (data) | API-Football, Odds API | 10 min |
| Phase 3 (Telegram) | BotFather + 2 channels | 10 min |
| Phase 4 (newsletter) | Beehiiv | 10 min |
| Phase 5 (affiliates) | 7 programs | 35 min (apply, wait for approval) |
| Phase 6 (monetization) | Whop, Stripe | 15 min |
| **TOTAL** | **17 accounts** | **~1.5 hours** |

After this: ONE command deploys everything. Systems go live. 24/7 automated.
