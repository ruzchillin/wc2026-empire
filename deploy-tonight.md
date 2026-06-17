# DEPLOY TONIGHT — Hour-by-Hour Plan
### Tournament opens June 11. Every hour you delay is revenue lost. Do this now.

---

## WHAT'S ALREADY BUILT (nothing left to code)

| File | What it does | Deploy to |
|---|---|---|
| `odds-tool.html` | Live odds comparison + affiliate buttons, auto-refreshes | Vercel |
| `office-pool.html` | Office pool generator with printable bracket | Vercel |
| `streaming-guide.html` | "How to watch WC 2026" — streaming affiliate page | Vercel |
| `second-screen-app.html` | Live scores + odds + AI picks + affiliate links (PWA) | Vercel |
| `telegram-bot.py` | AI Telegram bot with /picks /odds /today commands | Railway |
| `preview-engine.js` | Auto-generates match previews → posts everywhere | Railway |
| `goal-monitor.js` | Fires goal alerts to all platforms within 90 seconds | Railway |
| `agent-system.py` | 24/7 AI command center you control via Telegram DM | Railway |

**All code is written. Tonight is purely setup and deployment.**

---

## HOUR 1 — ZERO ACCOUNTS NEEDED (do this first, right now)

These deploy in minutes with no accounts or API keys.

### Step 1: Deploy all 4 HTML tools to Vercel (20 min)

1. Go to **vercel.com** → Sign up with GitHub (takes 2 minutes)
2. Create a new GitHub repo called `wc2026`
3. Upload these 4 files to the repo:
   - `odds-tool.html` → rename to `index.html` in an `/odds` folder
   - `office-pool.html` → `/pool` folder
   - `streaming-guide.html` → `/watch` folder  
   - `second-screen-app.html` → `/live` folder
4. Connect the repo to Vercel → Deploy

**Your live URLs will be:**
- `wc2026.vercel.app/odds` — odds tool (earning affiliate clicks immediately)
- `wc2026.vercel.app/pool` — office pool (earning affiliate clicks immediately)
- `wc2026.vercel.app/watch` — streaming guide (earning from "how to watch" searches NOW)
- `wc2026.vercel.app/live` — second screen app

> **Custom domain (optional):** Buy `wc2026picks.com` on Namecheap (~$10). Connect to Vercel in 5 minutes. Looks professional and ranks better on Google.

---

## HOUR 2 — GET FREE API KEYS (30 min, all free)

Sign up for these in parallel in separate browser tabs:

| Service | URL | Free tier | What it powers |
|---|---|---|---|
| Groq | groq.com | Unlimited (free) | All AI content generation |
| API-Football | api-football.com | 100 req/day free | Live scores, match data |
| The Odds API | the-odds-api.com | 500 req/month free | Live betting odds |
| LibreTranslate | libretranslate.com | Free API | Translate to 5 languages |

Once you have keys, add them to your `.env` file (use `.env.example` as template).

Also sign up for:
- **Railway.app** — where your Node.js + Python scripts run 24/7 (free tier)
- **GitHub** — to store and deploy your code (free)
- **Beehiiv** — email newsletter platform (free tier up to 2,500 subscribers)

---

## HOUR 3 — TELEGRAM SETUP (30 min, free)

This is your revenue-generating community AND your personal command center.

1. Open Telegram → search `@BotFather`
2. Send `/newbot` → name it "WC2026 AI Picks Bot" → get your `BOT_TOKEN`
3. Add `BOT_TOKEN` to your `.env` file
4. Create 10 Telegram channels (one per language + premium):
   - @WC2026AIPicks (English)
   - @WC2026Pronosticos (Spanish)
   - @WC2026Palpites (Portuguese)
   - @WC2026Pronos (French)
   - @WC2026Arabic (Arabic)
   - @WC2026Prognosen (German)
   - @WC2026Premium (paid members only)
   - + 3 more for other markets
5. Get each channel's ID (forward a message to @userinfobot)
6. Add all channel IDs to `.env`

**Deploy telegram-bot.py to Railway:**
1. Railway.app → New Project → Deploy from GitHub
2. Set env vars from your `.env` file
3. It runs 24/7 for free

---

## HOUR 4 — SOCIAL ACCOUNTS (45 min)

Create these accounts now. First-mover handles matter.

**TikTok (5 accounts — one per language):**
- @wc2026ai (English)
- @wc2026ia (Spanish)
- @wc2026ia_pt (Portuguese)
- @wc2026_fr (French)
- @wc2026_ar (Arabic)

**YouTube (5 channels):**
Use 5 separate Gmail accounts. Each channel = same brand, different language.

**X/Twitter (5 accounts):**
- @WC2026Picks / @WC2026Pronos / @WC2026Palpites / @WC2026Pronosticos / @WC2026Arabic

**Instagram (5 accounts):** Same handles as X.

> You don't need followers to start posting. The algorithm rewards new accounts during viral events. WC 2026 is a viral event starting tomorrow.

**Buffer setup:**
- buffer.com → free plan → connect all social accounts
- Add `BUFFER_TOKEN` and profile IDs to `.env`
- preview-engine.js will auto-schedule posts through Buffer

---

## HOUR 5 — PREVIEW ENGINE + GOAL MONITOR (30 min)

This is the core automation — it runs while you sleep.

1. Push all Node.js files to your GitHub repo:
   - `preview-engine.js`
   - `goal-monitor.js`
   - `package.json`
2. Railway → New Project → Deploy from GitHub repo
3. Set all env vars from `.env`
4. Start command: `node preview-engine.js`
5. Create second Railway service for goal-monitor: `node goal-monitor.js`

**Test it works:**
- preview-engine.js runs at 6am + 12pm UTC → generates match previews → posts to Telegram + WordPress + Beehiiv + Buffer
- goal-monitor.js polls every 60 seconds → fires within 90s of every goal

---

## HOUR 6 — AFFILIATE APPLICATIONS (45 min, run in parallel)

Apply to ALL of these tonight. Some approve instantly, others in 24–48 hours.

**Sportsbook affiliates (highest value):**
| Program | URL | Commission |
|---|---|---|
| DraftKings | draftkings.com/affiliates | $25–200/player |
| FanDuel | fanduel.com/affiliates | $25–200/player |
| BetMGM | betmgm.com/affiliates | $25–150/player |
| Caesars | caesarssportsbook.com/affiliates | $25–150/player |
| bet365 | partners.bet365.com | 20–30% rev share |
| Betano | betano.com/affiliates | 25–40% rev share |

**Non-betting affiliates (apply same night):**
| Program | URL | Commission |
|---|---|---|
| FuboTV | fubo.tv/affiliates | $20–40/signup |
| NordVPN | nordvpn.com/affiliates | $30–100/signup |
| ExpressVPN | expressvpn.com/affiliates | $13–36/signup |
| StubHub | stubhub.com/affiliates | 3–9% per ticket |
| World Nomads | worldnomads.com/affiliates | 10% per policy |
| Booking.com | booking.com/affiliates | 4–6% per booking |
| Airalo (eSIM) | airalo.com/affiliates | $3–5/purchase |
| Peacock | peacocktv.com/partners | $10–20/signup |
| DoorDash | doordash.com/affiliates | $15–20/new order |
| Underdog Fantasy | underdogfantasy.com/affiliates | $25/signup |

Once approved, replace the `#` placeholder links in `.env.example` with your real tracking links. preview-engine.js automatically uses them.

---

## HOUR 7 — AGENT SYSTEM + PERSONAL COMMAND CENTER (30 min)

Deploy agent-system.py to Railway:

1. Add `requirements.txt` to GitHub repo
2. Railway → New Service → Deploy from repo
3. Start command: `python agent-system.py`
4. Set env var: `OWNER_TELEGRAM_ID` = your personal Telegram user ID (get from @userinfobot)

**From this moment on, you control everything via Telegram DM:**
- `/status` — what's running, what's earning
- `/revenue` — today's Beehiiv + Whop numbers
- `/arb` — any arbitrage opportunities right now
- `/brief` — full pre-match intelligence package
- `/draft Home Team Away Team` — instant AI content draft
- `/idea` — new monetization idea from GrowthAgent
- `/focus` — what to spend the next hour on

The agent also DMs you automatically:
- 6:00 AM UTC: morning briefing with today's matches
- 2 hours before each match: pre-match intel
- Half-time: live analysis + angles
- 11:00 PM UTC: nightly revenue summary

---

## HOUR 8 — BEEHIIV + COMMUNITY (30 min)

1. **Beehiiv** (beehiiv.com):
   - Create 3 publications: WC2026 Insider (EN), WC2026 ES, WC2026 PT
   - Enable the Beehiiv ad network immediately — it starts serving ads to your newsletter automatically
   - Add `BEEHIIV_API_KEY` and `BEEHIIV_PUB_ID` to `.env`

2. **Whop** (whop.com):
   - Create a product: "WC2026 Premium" at $19.99/month
   - Benefits: exclusive picks channel on Telegram, direct AI bot access, daily email
   - Add `WHOP_API_KEY` to `.env`
   - telegram-bot.py checks Whop automatically for premium gating

3. **Discord**:
   - Create your main server: "WC2026 AI"
   - Channels: #picks, #live-alerts, #odds, #community, #premium
   - Add `DISCORD_WEBHOOK_URL` to `.env`

---

## WHAT'S LIVE BY MIDNIGHT TONIGHT

If you execute this plan tonight, by the time the first match kicks off tomorrow at 3pm ET:

✅ 4 Vercel tools live and indexed (odds, pool, streaming guide, second screen)  
✅ 10 Telegram channels active with your bot running  
✅ 5 TikTok + 5 YouTube + 5 X + 5 Instagram accounts created  
✅ preview-engine.js running on Railway → auto-posting content 24/7  
✅ goal-monitor.js running → <90 second goal alerts to all platforms  
✅ agent-system.py running → briefing you automatically via Telegram  
✅ Beehiiv newsletters live with ad network active  
✅ Whop premium community accepting subscribers  
✅ 15+ affiliate applications submitted  

**Revenue starts from the first goal tomorrow afternoon.**

---

## IF YOU ONLY HAVE 2 HOURS TONIGHT

Do ONLY these — highest immediate revenue:

1. Deploy `streaming-guide.html` to Vercel (people searching "how to watch WC 2026" RIGHT NOW)
2. Deploy `odds-tool.html` to Vercel
3. Create 3 Telegram channels (EN, ES, PT) and invite everyone you know
4. Apply to DraftKings + FanDuel affiliates (instant approval, highest CPA)
5. Apply to FuboTV + NordVPN affiliates
6. Post your Telegram link on Reddit (r/worldcup, r/soccer) and Twitter

This alone starts generating affiliate clicks before the opening whistle.

---

## COMPUTER USE — UNLOCK THE FULL SETUP

For the complex account configurations (WordPress, Buffer, Beehiiv internal settings, Whop product setup, social account bios + first posts), enable Computer Use:

**Settings → Desktop app → Computer use → Toggle ON**

Once enabled: you log into each account, I take over and configure everything inside — bio, settings, first post, affiliate links, automation connections. Every account done correctly in minutes instead of hours.

---

## TOMORROW'S FIRST MATCH SCHEDULE

| Time ET | Match | Watch |
|---|---|---|
| 3:00 PM | Mexico vs South Africa | Fox |
| 9:00 PM | South Korea vs Czechia | Fox |

Post your first AI preview to all channels by **noon tomorrow** (2 hours before Mexico vs South Africa). preview-engine.js does this automatically if deployed.

**The tournament starts in less than 24 hours. Start with Hour 1 right now.**
