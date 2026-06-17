# WC 2026 Empire — Master Setup Guide
## What YOU do vs What CLAUDE does

---

## THE DEAL

**You do:** Create accounts, log in, copy/paste API keys into a .env file  
**Claude does:** Everything else — deploy code, wire systems, fix bugs, update content, monitor health

---

## PHASE 1 — MUST DO FIRST (Day 1, ~2 hours)
*Site cannot go live without these*

### 1. Vercel (hosts all 162 pages — FREE)
- Go to vercel.com → Sign up with GitHub
- Download: `npm install -g vercel` in Terminal
- That's it. Claude runs the deploy command.

### 2. Railway (runs the AI backend — FREE to start)
- Go to railway.app → Sign up with GitHub
- Download: `npm install -g @railway/cli` in Terminal
- That's it. Claude deploys all 53 services.

### 3. Groq (AI brain — FREE, 500K tokens/day)
- Go to console.groq.com → Sign up
- Go to API Keys → Create key → Copy it

### 4. OneSignal (push notifications — FREE up to 10K)
- Go to onesignal.com → Create account
- Create new app → Web → Copy App ID + REST API Key

### 5. Beehiiv (email newsletter — FREE up to 2,500)
- Go to beehiiv.com → Create account
- Settings → Integrations → Copy API Key + Publication ID

### 6. API-Football (live scores — FREE 100/day)
- Go to rapidapi.com → Sign up
- Search "API-Football" → Subscribe to free plan → Copy API Key

### 7. Google (Search Console + Analytics + AdSense)
- search.google.com/search-console → Add your Vercel URL
- analytics.google.com → Create property → Copy Measurement ID
- adsense.google.com → Apply (takes 1-2 weeks to approve)

---

## PHASE 2 — AFFILIATE MONEY (Parent signs up — week 1)
*This is where the actual money comes from*

| Platform | URL | Revenue | Sign-up time |
|----------|-----|---------|-------------|
| bet365 Affiliates | bet365affiliates.com | 30% RevShare | 10 min |
| Sky Bet Affiliates | skybet.com/affiliates | £60-80 CPA | 10 min |
| William Hill Affiliates | williamhillaffiliates.com | £60-80 CPA | 10 min |
| Betfair Affiliates | betfairaffiliates.com | 20-30% RevShare | 10 min |
| Betway Africa | betway.com/affiliates | $50-80 CPA | 10 min |
| SportyBet Nigeria | sportybet.com/affiliates | ₦2000-5000 CPA | 10 min |
| Betcris | betcris.com/affiliates | $60 CPA | 10 min |
| Betano Brasil | betano.com.br/affiliates | R$150-300 CPA | 10 min |
| DraftKings | affiliates.draftkings.com | $100-250 CPA | 15 min |
| FanDuel | fanduelaffiliates.com | $150-250 CPA | 15 min |
| Dream11 | dream11.com/affiliate | ₹500-2000 CPA | 10 min |
| Bet9ja | bet9ja.com/affiliate | ₦5000+ CPA | 10 min |
| Booking.com | partners.booking.com | 4-6% commission | 10 min |
| NordVPN | nordvpn.com/affiliates | 30-40% RevShare | 10 min |
| Skyscanner | skyscanner.net/affiliates | CPA per booking | 10 min |
| viagogo | viagogo.com/affiliates | 7-10% commission | 10 min |

**After each signup:** They give you a unique affiliate link. You paste it into the .env file. Claude updates all 162 pages automatically.

---

## PHASE 3 — SOCIAL MEDIA (Week 1, do in priority order)

### Tier 1 — Do these first (biggest reach)
| Platform | What to create | Download? |
|----------|---------------|-----------|
| Telegram | Create a channel + bot via @BotFather (get bot token) | App |
| Twitter/X | Create account + apply for developer access (free) | App optional |
| YouTube | Create channel | — |
| TikTok | Create account | App |
| Instagram | Create account | App |
| Facebook | Create a Page (not personal account) | App optional |

### Tier 2 — Add when site has traffic
| Platform | Market | Download? |
|----------|--------|-----------|
| Reddit | Create account | — |
| Discord | Create server | App |
| Pinterest | Create business account | — |
| LinkedIn | Create company page | App optional |
| Bluesky | Create account | — |
| Medium | Create account | — |

### Tier 3 — Regional (only if targeting that market)
| Platform | Market | Download? |
|----------|--------|-----------|
| Snapchat | Gulf/Saudi | App |
| ShareChat | India | App |
| Nairaland | Nigeria | — |
| Naver | Korea | — |
| KakaoTalk | Korea | App |
| Zalo | Vietnam | App |
| VK | Russia/CIS | — |
| Weibo | China | — |
| LINE | Japan/SE Asia | App |
| Viber | Philippines/Balkans | App |

---

## PHASE 4 — PAYMENT (When prediction game is live)
- Stripe: stripe.com → Create account → Get Secret Key + Webhook Secret

---

## THE .ENV FILE — HOW IT WORKS

Everything feeds into one file. You fill it in, Claude deploys.

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
API_FOOTBALL_KEY=xxxxxxxxxxxxx
ONESIGNAL_APP_ID=xxxxxxxxxxxxx
ONESIGNAL_REST_KEY=xxxxxxxxxxxxx
BEEHIIV_API_KEY=xxxxxxxxxxxxx
TELEGRAM_BOT_TOKEN=xxxxxxxxxxxxx
TWITTER_BEARER_TOKEN=xxxxxxxxxxxxx
BET365_AFFILIATE_ID=xxxxxxxxxxxxx
SKYBBET_AFFILIATE_ID=xxxxxxxxxxxxx
... (all 80+ keys)
```

**You paste each key in. Claude does the rest.**

---

## HOW THE 24/7 SYSTEM WORKS

```
REAL WORLD EVENT (goal scored, red card, elimination)
         ↓
API-Football detects it (polling every 60 seconds)
         ↓
moment-engine.js fires (the brain — Railway service)
         ↓
Sends to ALL channels simultaneously:
  → Twitter post
  → Telegram channel message  
  → TikTok/Instagram reel script
  → Email newsletter trigger
  → Push notification to all subscribers
  → Reddit post
  → YouTube short script
  → 30+ other platforms
         ↓
affiliate-tracker.js logs every click
         ↓
analytics-aggregator.js updates your dashboard
```

**This runs 24/7 on Railway with zero input from you.**

---

## THE COMMAND CENTER

You have 3 ways to control everything:

### 1. Telegram Bot (easiest — from your phone)
Message your bot:
- `/status` → see if all 53 services are running
- `/revenue` → today's earnings + clicks
- `/trigger goal "Mbappe scores 90th min"` → manual post to all platforms
- `/pause twitter` → stop any platform instantly
- `/stats` → subscriber counts, traffic, top pages

### 2. Admin Dashboard (admin-dashboard.html)
Visual war room in your browser:
- Live status of all 53 Railway services (green/red)
- Revenue counter updating live
- Subscriber growth graph
- Click map by country
- One-click trigger for any event

### 3. AI Chat Interface (ai-command-center.html / empire-chat.html)
Type anything in plain English:
- "Write a post about France's injury news and post to Twitter"
- "Which page is making the most money today?"
- "Why is the Nigeria page traffic low?"
- "Generate content for tonight's Spain vs Germany game"

---

## HEALTH MONITORING (24/7 automatic)

monitor-bot.js runs on Railway and checks every 5 minutes:
- Pings all 53 services
- If any service is down → immediate Telegram alert to you
- Auto-restart attempted
- If not fixed in 10 min → escalation alert

You wake up to either:
- ✅ "All 53 services healthy" (most mornings)
- ⚠️ "Service X down — restarting" (rare, auto-fixed)
- 🚨 "Manual attention needed" (very rare)

---

## BACKUP SYSTEM

- All code lives on Railway + GitHub (automatic)
- All HTML pages live on Vercel (automatic CDN backup across 50+ locations)
- groq-fallback-templates.js: if Groq AI is down, pre-written content fires automatically
- dedup-guard.js: prevents duplicate posts across all platforms
- groq-budget-guard.js: prevents AI cost overruns

---

## REALISTIC TIMELINE

| Day | What happens |
|-----|-------------|
| Day 1 | Vercel + Railway deployed. Site live. 0 visitors. |
| Day 3-7 | Google indexes pages. First organic traffic. |
| Week 2 | Affiliate programs approved. Links go live. |
| Week 2-3 | Social automation posting. First followers. |
| Month 1 | First affiliate clicks. First revenue. |
| Month 2-3 | SEO compound effect. Traffic growing. |
| Tournament (Jun-Jul 2026) | Peak traffic. Every goal = money. |

