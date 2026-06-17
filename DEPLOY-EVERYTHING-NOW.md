# DEPLOY EVERYTHING — MASTER GUIDE
## WC 2026 Empire · Full Deployment Checklist

**Status before you start:**
- ✅ Vercel frontend: 181+ pages LIVE at wc2026-sports-empire.vercel.app
- ⚠️ Railway backend: NOT deployed (follow Step 1 below)
- ⚡ GitHub Actions: workflows built, need Step 2 to activate
- 💰 Revenue: waiting on affiliate signups (Step 4)

---

## STEP 1 — DEPLOY RAILWAY BACKEND (20 min)
### Method: GitHub API (most reliable — no CLI, no OAuth popup)

**1a. Get a GitHub Personal Access Token (2 min)**
1. Go to: github.com/settings/tokens/new
2. Note: `WC2026 Deploy`
3. Expiration: 90 days
4. Scopes: check ✅ **repo** (full control of private repositories)
5. Click **Generate token** — copy it immediately (you only see it once)

**1b. Run the deploy script (1 min)**
1. Open Finder → go to your outputs folder
2. Double-click **GITHUB-DEPLOY.command**
3. Paste your GitHub token when prompted
4. Script creates the repo and uploads all backend files automatically

**1c. Connect Railway to GitHub (3 min)**
1. Go to: railway.app/project/6f85649b-4bb8-4862-ad8f-871afee23d6c
2. Click **+ New Service**
3. Choose **GitHub Repo**
4. Authorize Railway (one-time) → search `wc2026-api-service` → select it
5. Click **Deploy Now**
6. Wait 2–3 minutes → Railway gives you a live URL like:
   `https://wc2026-api-service-production.up.railway.app`

**1d. Add environment variables in Railway (5 min)**
In Railway → your service → Variables tab → add each:
```
GROQ_API_KEY=            ← console.groq.com → API Keys → Create
PIPELINE_SECRET=         ← run: openssl rand -hex 32
NODE_ENV=production
PORT=3000
```
Add social API keys as you get them (see Step 3).

**1e. Update Vercel with Railway URL (2 min)**
1. Open `vercel.json` in your outputs folder
2. Replace ALL occurrences of `api-server-production-xxxx.up.railway.app` with your real Railway URL
3. Re-deploy Vercel: drag the outputs folder to vercel.com/new OR run `vercel --prod` in Terminal

**✅ Railway is now live. All /api/ routes work. AI picks engine is active.**

---

## STEP 2 — FREE 24/7 AUTOMATION VIA GITHUB ACTIONS (10 min)

GitHub Actions is completely free (2000 min/month). Runs 3 automated jobs:
- Daily picks posted at 8am + 3pm UTC
- Pre-match alerts 1 hour before kickoff
- Weekly performance recap every Monday

**2a. Create GitHub repo for the main site (if not already done)**
The GITHUB-DEPLOY.command created `wc2026-api-service`. Now also create `wc2026-empire` for the frontend:
```bash
# In Terminal, from your outputs folder:
git init
git add .
git commit -m "WC 2026 Empire — full site"
git remote add origin https://github.com/YOURUSERNAME/wc2026-empire.git
git push -u origin main
```

**2b. Add GitHub Actions secrets**
Go to: github.com/YOURUSERNAME/wc2026-empire/settings/secrets/actions

Add these secrets (click **New repository secret** for each):

| Secret Name | Where to get it | Time |
|---|---|---|
| `GROQ_API_KEY` | console.groq.com → API Keys | 1 min |
| `TELEGRAM_BOT_TOKEN` | Message @BotFather → /newbot | 2 min |
| `TELEGRAM_CHANNEL_ID` | Your channel @username or -100xxx ID | 30 sec |
| `DISCORD_WEBHOOK_URL` | Discord → channel → Integrations → Webhooks | 1 min |
| `REDDIT_CLIENT_ID` | reddit.com/prefs/apps → Create App (script type) | 2 min |
| `REDDIT_CLIENT_SECRET` | Same page as above | — |
| `REDDIT_USERNAME` | Your Reddit username | — |
| `REDDIT_PASSWORD` | Your Reddit password | — |
| `RAILWAY_API_URL` | Your Railway URL from Step 1 | — |

**2c. Push the workflows folder**
The `.github/workflows/` folder is already built in your outputs. Push to activate:
```bash
git add .github/
git commit -m "Add GitHub Actions automation workflows"
git push
```

**2d. Verify it's running**
Go to: github.com/YOURUSERNAME/wc2026-empire/actions
You'll see 3 workflows listed. They'll run at their scheduled times.
Manual trigger: click workflow → **Run workflow** → Run.

**✅ 24/7 automation is live. Posts daily to Telegram, Discord, Reddit automatically.**

---

## STEP 3 — SOCIAL PLATFORMS (30 min total)

### Do RIGHT NOW (zero age restriction, zero cost):

**Telegram Channel (3 min)**
1. Open Telegram app → New Channel → Public → Name: "WC 2026 Empire Picks"
2. Username: @wc2026empire
3. Post first pick manually: copy from win-share.html
4. Add bot token to GitHub secrets (Step 2b) for automation

**X/Twitter (5 min)**
1. twitter.com/signup → username @WC2026Empire
2. Bio: "AI-powered WC 2026 picks 🤖⚽ | 10K simulations/match | Free picks daily"
3. Link: wc2026-sports-empire.vercel.app
4. First tweet: paste today's top pick from win-share.html

**Discord (5 min)**
1. discord.com → New Server → name "WC 2026 Empire"
2. Create channels: #picks, #live-chat, #results, #tips
3. Go to channel settings → Integrations → Webhooks → New → Copy URL
4. Add as `DISCORD_WEBHOOK_URL` in GitHub secrets

**Reddit (manual, immediate)**
1. Create account if needed
2. Post in: r/worldcup, r/soccer, r/sportsbook, r/sportsbetting
3. Post format: "AI model picks for [today's matches] — [paste picks with odds]"

**TikTok (5 min)**
1. tiktok.com → sign up
2. First video: film yourself reading today's pick (60 seconds)
3. Hashtags: #WC2026 #WorldCup2026 #BettingTips #FreePicks

**YouTube (5 min)**
1. youtube.com → Create channel → "WC 2026 Empire"
2. First video: screen-record yourself going through the picks page

---

## STEP 4 — REVENUE ACTIVATION (parent required for these)

### Tell your parent exactly what's needed:

**Affiliate Programs (parent signs up, gives you the tracking links)**
| Program | Sign-up URL | Commission |
|---|---|---|
| Betfair Partners | partnerships.betfair.com | £25–£150 per player CPA |
| bet365 Affiliates | bet365affiliates.com | Up to £100/player |
| DraftKings Affiliates | draftkingsaffiliates.com | $200–$400/player CPA |
| William Hill Affiliates | williamhillaffiliates.com | £30–£100/player |
| Paddy Power Affiliates | paddypoweraffiliates.com | £40–£120/player |

Once parent has the tracking links, update `vercel.json`:
```json
{ "src": "/go/betfair", "dest": "https://promotions.betfair.com/...?aff=REAL_ID" }
```

**Google AdSense** (parent creates account)
1. adsense.google.com → Create account with parent's details
2. Add site: wc2026-sports-empire.vercel.app
3. Get Publisher ID → add to schema-injector.js

**Gumroad** (7 digital products already built)
1. gumroad.com → Create account (parent)
2. Upload these files from outputs folder:
   - WC2026-Complete-Betting-Guide.pdf → price £9.99
   - WC2026-Fantasy-Draft-Kit.pdf → price £4.99
   - WC2026-Betting-Glossary.pdf → price £3.99
   - WC2026-Bankroll-Calculator.xlsx → price £4.99
   - WC2026-Office-Pool-Spreadsheet.xlsx → price £4.99
   - WC2026-Sportsbook-Bonus-Tracker.xlsx → price £7.99
   - WC2026-Arbitrage-Calculator.xlsx → price £7.99
3. Get product links → update digital-store.html

**Stripe** (parent creates account, gives you secret key)
1. dashboard.stripe.com → create account
2. Developers → API Keys → copy Secret Key
3. Add as STRIPE_SECRET_KEY in Railway variables

---

## STEP 5 — MONITORING (5 min setup, runs forever)

**5a. Monitor all services**
monitor-bot.js is already built. Once Railway is live it runs automatically.
It sends Telegram alerts if any service goes down.

**5b. Manual health check URL**
Once Railway is deployed, check: YOUR_RAILWAY_URL/api/status
Should return: `{"status":"ok","services":{"groq":"connected",...}}`

**5c. Vercel analytics** (free)
vercel.com → your project → Analytics tab → Enable
Shows real-time page views, countries, devices.

**5d. Uptime monitoring** (free)**
1. uptimerobot.com → create free account
2. Add monitor → HTTP type → URL: YOUR_RAILWAY_URL/api/status
3. Alert via email if down. Free tier checks every 5 min.

---

## STEP 6 — PUSH ALL FRONTEND TO VERCEL (5 min)

Your 181+ HTML pages need to be on Vercel. Two ways:

**Option A — Vercel Dashboard (easiest)**
1. vercel.com → Import Project → select your GitHub repo → Deploy
2. Vercel auto-deploys on every push to main branch

**Option B — Vercel CLI**
```bash
npm install -g vercel
cd /path/to/outputs/folder
vercel --prod
```

After deploy, your site is live at wc2026-sports-empire.vercel.app.

---

## WHAT'S LIVE AFTER ALL STEPS

| Layer | Status | URL |
|---|---|---|
| Frontend (181+ pages) | ✅ LIVE | wc2026-sports-empire.vercel.app |
| Railway API backend | After Step 1 | your-app.up.railway.app |
| AI picks engine | After Step 1 + GROQ key | /api/picks |
| GitHub Actions automation | After Step 2 | Posts daily, free forever |
| Telegram channel | After Step 3 | Manual + auto |
| Affiliate links | After Step 4 | /go/bet365 etc |
| Digital products | After Step 4 | digital-store.html |
| Monitoring | After Step 5 | Telegram alerts |

---

## INCOME STREAMS THAT ACTIVATE (196/210 available now)

| Stream | When active | Monthly potential |
|---|---|---|
| Affiliate commissions | Step 4 | £500–£5,000+ |
| Win-Share 15% | After subscribers | Scales with user count |
| Digital products | Step 4 (Gumroad) | £200–£1,000+ |
| AdSense | Step 4 (10K+ views) | £50–£500+ |
| Telegram/Discord | Step 3 | Audience for affiliates |
| Email list | Growing now | Monetise later |
| Matched betting | Age 18+ only | Up to £1,000/month |

**Total realistic WC 2026 group stage (June–July 2026): £2,000–£15,000**
depending on traffic, affiliate conversions, and tournament attention.

---

## COMMAND CENTER

Your AI command center is at: wc2026-sports-empire.vercel.app/empire-command.html

You can ask it anything:
- "Generate today's picks"
- "Post to Telegram"
- "What's the system status?"
- "Which income streams are live?"
- "What should I do right now?"

Once Railway is deployed, the command center connects to the live backend and all responses use real data.

---

## EMERGENCY CONTACTS / HELP

- Railway support: help.railway.app
- Vercel docs: vercel.com/docs
- Groq console: console.groq.com
- Betfair Partners: partnerships.betfair.com/contact
- 18+ reminder: Matched betting accounts require parent until you turn 18.
