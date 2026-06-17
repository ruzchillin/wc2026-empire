# WC2026 Automation — Complete Setup Guide
**Do this once. Then it runs itself for 40 days.**

---

## OVERVIEW — WHAT YOU'RE BUILDING

One unified system that:
- Generates previews for all 104 WC matches (AI-written, 5 languages)
- Detects goals/red cards live → posts reactions in <90 seconds
- Distributes to: WordPress, Beehiiv email, Telegram (5 channels), Discord, Buffer (X/TikTok/Instagram)
- Earns from: affiliate links embedded in every piece of content, newsletter ads, community subscriptions, sportsbook bonuses, platform monetization

**Time to complete this guide: ~3–4 hours**
**Cost to run: $0 (all free tiers)**

---

## PHASE 1 — CONTENT PLATFORM (Day 1)

### 1.1 WordPress site
This is your SEO hub and money site. Everything links back here.

1. Go to https://wordpress.com → Create account → choose a free plan
   - OR use https://railway.app to host WordPress free (more control)
2. Name your site something evergreen: `wc2026picks.com`, `worldcupai.com`, `soccerpicks2026.com`
   - Buy domain at https://namecheap.com (~$10/yr) — worth it for SEO
3. Install plugins (Plugins → Add New → search each):
   - **Yoast SEO** — auto-generates meta tags, sitemaps
   - **Pretty Links** — converts keywords to affiliate links automatically
   - **WP Super Cache** — makes the site fast
4. Create an Application Password:
   - Users → Edit your profile → scroll to Application Passwords → Add New → name it "Automation" → copy the password → paste into `.env` as `WORDPRESS_PASS`
5. Submit your sitemap to Google Search Console (search "Google Search Console", add your site, submit `yoursite.com/sitemap.xml`)
6. Apply to Google News (https://publishercenter.google.com) — takes 1–2 weeks, massively boosts traffic

### 1.2 Beehiiv newsletter
This is your email list — worth $1–$5 per subscriber per month long-term.

1. Go to https://beehiiv.com → Create account → Create publication
2. Name it: "WC2026 Insider" or "World Cup AI Picks"
3. Enable the Beehiiv Ad Network (Settings → Monetization → Ad Network) — auto-fills ads in every email
4. Get your API key: Settings → API Keys → Create
5. Get your Publication ID: it's in the URL — `app.beehiiv.com/publications/pub_xxxxxxxx`
6. Create a sign-up form embed and put it on your WordPress site

### 1.3 Buffer (social scheduling)
Buffer posts to X, TikTok, Instagram, LinkedIn, Facebook from one API call.

1. Go to https://buffer.com → Create free account
2. Connect: X (Twitter), Instagram, TikTok, Facebook Page
3. Get access token: https://buffer.com/developers/api/oauth
4. Find your profile IDs: `https://api.bufferapp.com/1/profiles.json?access_token=YOUR_TOKEN`
5. Paste all profile IDs comma-separated into `.env` as `BUFFER_PROFILE_IDS`

---

## PHASE 2 — COMMUNITY CHANNELS (Day 1)

### 2.1 Telegram channels (5 languages)
These are your most engaged, most monetizable audience.

1. Open Telegram app → tap pencil icon → New Channel
2. Create 5 channels:
   - `WC2026 AI Picks 🇺🇸` (English)
   - `WC2026 Pronósticos IA 🇪🇸` (Spanish)
   - `WC2026 Palpites IA 🇧🇷` (Portuguese)
   - `WC2026 Pronostics IA 🇫🇷` (French)
   - `WC2026 تحليل ذكاء اصطناعي 🇸🇦` (Arabic)
3. Create your Telegram bot:
   - Message @BotFather → `/newbot` → name it "WC2026 AI Analyst" → username `wc2026ai_bot`
   - Copy the token → paste into `.env` as `TELEGRAM_BOT_TOKEN`
4. Add your bot as admin to each channel
5. Get each channel's ID: forward any message from the channel to @userinfobot → copy the ID (will be negative, like `-1001234567890`)
6. Paste all channel IDs into `.env`

**Monetize Telegram:**
- Pin your affiliate links every match day
- Use Fragment (fragment.com) to buy/sell @usernames once your channel grows
- Telegram Stars: fans can tip you directly

### 2.2 Discord server
1. Go to https://discord.com → Create server → name it "WC2026 AI HQ"
2. Create channels: `#match-predictions`, `#live-alerts`, `#best-odds`, `#general`
3. Create a webhook: Server Settings → Integrations → Webhooks → New Webhook → copy URL → paste into `.env` as `DISCORD_WEBHOOK_URL`
4. Monetize via Whop.com (see Phase 4)

### 2.3 YouTube channel
1. Create a YouTube channel: "WC2026 AI Picks"
2. Enable monetization at 500 subscribers + 3,000 watch hours (new threshold)
3. Use your Groq-generated podcast scripts as YouTube video scripts
4. Enable Super Thanks and Super Chat (live stream donation features)
5. Go live during EVERY match — reaction content + AI analysis

### 2.4 TikTok account
1. Create TikTok account: `@wc2026ai`
2. Apply for TikTok Creator Fund (1,000 followers minimum)
3. Enable TikTok LIVE during matches — receive gifts worth real money
4. Post your Groq-generated captions with match clips

---

## PHASE 3 — API KEYS (Day 1–2)

Complete these in order. Each one takes 5–10 minutes.

### 3.1 API-Football (match data)
1. Go to https://rapidapi.com/api-sports/api/api-football
2. Sign up → Subscribe to free plan
3. Copy "X-RapidAPI-Key" → paste into `.env` as `API_FOOTBALL_KEY`
4. Free: 100 req/day. WC has ~3 matches/day, polling every 60 seconds during matches uses ~90 req. You're fine.

### 3.2 The Odds API (betting data)
1. Go to https://the-odds-api.com
2. Sign up → free plan gives 500 requests/month
3. Copy API key → paste into `.env` as `ODDS_API_KEY`

### 3.3 Groq (AI content generation)
1. Go to https://console.groq.com
2. Sign up → API Keys → Create new key
3. Copy key → paste into `.env` as `GROQ_API_KEY`
4. Free: 14,400 tokens/minute with llama3-70b — unlimited for our use case

### 3.4 Twilio (SMS alerts, optional)
1. Go to https://twilio.com → Sign up → free $15 credit
2. Get a phone number (free with trial)
3. Copy Account SID + Auth Token → paste into `.env`
4. Use: premium subscribers pay $10–29/month for SMS match alerts

---

## PHASE 4 — AFFILIATE PROGRAMS (Day 2–3)

Apply to ALL of these. Approvals take 1–7 days. Do it NOW so you're approved by June 11.

### US Sportsbooks (highest commissions — $50–$200 CPA or 25–40% revenue share)
| Sportsbook | Program URL | Commission |
|---|---|---|
| DraftKings | draftkings.com/affiliates | $50–$200 CPA |
| FanDuel | fanduel.com/affiliates | $50–$150 CPA |
| BetMGM | betmgm.com/affiliates | $50–$200 CPA |
| Caesars | caesarssportsbook.com/affiliates | $150–$250 CPA |
| PointsBet | pointsbet.com/affiliates | $50–$100 CPA |
| BetRivers | betrivers.com/affiliates | $50–$75 CPA |

### International Sportsbooks
| Sportsbook | Program URL | Commission |
|---|---|---|
| bet365 | partners.bet365.com | 20–35% rev share |
| Betano | betano-partners.com | 25–40% rev share |
| bwin | bwin-partners.com | 25–35% rev share |
| William Hill | williamhill-affiliates.com | 20–35% rev share |
| 1xBet | 1xbet-partners.com | 25–40% rev share |
| Betway | betwaypartners.com | 25–30% rev share |

### VPN (highest passive income per click)
| Program | URL | Commission |
|---|---|---|
| NordVPN | affiliates.nordvpn.com | $40–100/sale + 30% renewals |
| ExpressVPN | expressvpn.com/affiliates | $13–36/sale |
| Surfshark | surfshark.com/affiliates | 40% recurring |

NordVPN alone at 2 sales/day = $80–$200/day passive.

### Streaming Services
| Program | URL | Commission |
|---|---|---|
| FuboTV | fubo.tv/affiliates | $20–30/trial |
| Peacock | nbcuniversal.com/affiliates | $5–15/signup |
| Paramount+ | via CJ Affiliate | $5–20/signup |

### Fantasy Sports
| Program | URL | Commission |
|---|---|---|
| Underdog Fantasy | underdogfantasy.com/affiliates | 25% rev share |
| PrizePicks | prizepicks.com/affiliates | 20–30% rev share |
| Sleeper | CJ Affiliate | $10–20 CPA |

**After approval:** Replace every `CAPS_PLACEHOLDER` in your .env file and the odds-tool.html file with your real tracked URLs.

---

## PHASE 5 — DEPLOY THE AUTOMATION (Day 3)

### 5.1 Deploy Node.js scripts to Railway (free)
Railway gives you $5/month free credit — enough for 24/7 Node.js.

1. Go to https://railway.app → Sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
   - If you don't have GitHub: go to github.com → create account → new repo → upload `preview-engine.js`, `goal-monitor.js`, `package.json`
3. In Railway project settings → Variables tab → add every variable from your `.env` file
4. Railway auto-detects Node.js and runs `npm start`
5. Your scripts are now live 24/7 for free

### 5.2 Deploy Telegram bot to Railway (same project or new)
1. In the same Railway project → New Service → add your Python files
2. Add a `Procfile` with content: `web: python telegram-bot.py`
3. Add requirements.txt to the repo
4. All env vars are shared across the project — nothing extra needed
5. Your bot is now answering questions 24/7

### 5.3 Deploy HTML tools to Vercel (free)
The odds-tool.html and office-pool.html are static files — deploy free in 60 seconds.

1. Go to https://vercel.com → Sign up with GitHub
2. New Project → Import your GitHub repo
3. Or: drag-and-drop the HTML files at vercel.com/new
4. Each file gets a free URL like `your-project.vercel.app/odds-tool`
5. Set up custom domain: vercel.com/domains → connect your domain → add DNS records
6. These pages are now public and get indexed by Google

---

## PHASE 6 — PREMIUM COMMUNITY (Day 3–4)

This is where you scale from hundreds to thousands per month.

### 6.1 Whop community
1. Go to https://whop.com → Create account → Create product
2. Create tiers:
   - **Free**: Join Discord + Telegram EN channel
   - **Pro ($9.99/mo)**: All 5 Telegram channels + Telegram bot unlimited + SMS alerts
   - **VIP ($29.99/mo)**: Everything + private Discord + weekly Zoom + matched betting guides
3. Get your plan ID from the Whop dashboard → paste into `.env` as `WHOP_PLAN_ID`
4. Share your Whop link everywhere — Discord, Telegram, bio, YouTube description

### 6.2 Matched betting (risk-free $15K–$80K during the tournament)
This is not gambling — it's extracting free money from sportsbook welcome bonuses.

**How it works:**
1. Sign up to DraftKings → claim "$5 bet gets $200" bonus
2. Place a qualifying bet ($5) on any WC match
3. They give you $200 in free bet credits
4. Use the free bet on a match with near-even odds → convert 70–80% of it to cash
5. Net: ~$140–$160 risk-free from one signup
6. Repeat across 30+ US sportsbooks = $10,000–$20,000+ over the tournament

**Repeat with UK/AU books:**
- bet365, Betway, William Hill, Paddy Power, Betfair, Ladbrokes, Coral, Sky Bet, Unibet, 888sport
- UK books have more generous promotions (deposit match up to £100, etc.)
- Total UK extraction: another £5,000–£15,000

**Tools:**
- OddsMonkey.com or Profit Accumulator (UK) — calculators and tracking
- Or build your own tracker in a spreadsheet

### 6.3 Sports arbitrage (ongoing, market-hour profit)
Beyond welcome bonuses, live arbitrage bets across bookmakers:
- Find the same match where Book A and Book B have odds that guarantee profit regardless of outcome
- Tool: https://www.oddsmatcher.com or RebelBetting
- Potential: 2–10% profit per bet, 5–20 bets/day during WC = $500–5,000/week

---

## PHASE 7 — CONTENT CALENDAR (Ongoing)

### Match day routine (automated — nothing required from you)
- **6:00 AM UTC**: preview-engine.js runs → generates article + 5-language email → posts to WordPress + Beehiiv + Telegram + Discord + Buffer
- **Match time**: goal-monitor.js detects events → reaction in <90 seconds across all platforms
- **Post-match**: Buffer posts scheduled captions + Buffer schedules the next day's previews

### Your only manual tasks
1. **1x per week**: Record a 10-minute YouTube video summarizing the week's matches. Use Groq's podcast script as your script. Upload to YouTube.
2. **1x per match day**: Go live on TikTok/YouTube during the match. React live. Collect gifts/Super Chat.
3. **Ongoing**: Reply to DMs asking about premium. Send them your Whop link.

---

## PHASE 8 — SCALING (Week 2+)

Once base is running, add these layers:

### Content velocity: Substack
1. Create a Substack at substack.com
2. Cross-post every Beehiiv newsletter to Substack (copy-paste, 5 minutes/day)
3. Substack's algorithm surfaces you to new readers for free
4. Enables paid subscriptions ($5–$10/mo) as a second email revenue stream

### Content velocity: Medium
1. Create Medium account
2. Join Medium Partner Program (medium.com/creators)
3. Cross-post every article — Medium pays per read (typically $0.01–$0.10/article read, but viral WC content can earn $100–$500/article)
4. Medium's SEO is powerful — your articles rank alongside established sports sites

### Ad revenue: Google AdSense
1. Apply at https://adsense.google.com
2. Add your site → follow verification steps
3. Once approved, paste the code snippet into WordPress header
4. Payout: $5–$50 RPM (per 1,000 views). At 100K monthly views: $500–$5,000/month.

### Podcast
1. Record audio-only version of your YouTube videos
2. Upload to Spotify for Podcasters (free) — gets distributed to Spotify, Apple, Amazon
3. Monetize via Spotify Audience Network once you hit 100 listeners/episode

### White-label content sales
Once you have a track record of high-quality AI content:
- Contact local sports betting sites, local newspapers, fantasy apps
- Sell them your pre-match analysis articles ($50–$500/article)
- Sell them your translation service ($25–$100/language)
- One deal like this can be worth $5,000–$20,000 for the tournament

---

## QUICK REFERENCE — ALL ACCOUNTS TO CREATE

**Day 1 (required to start):**
- [ ] WordPress.com or Railway-hosted WordPress
- [ ] Beehiiv.com
- [ ] Buffer.com
- [ ] Telegram (5 channels + 1 bot via @BotFather)
- [ ] Discord server
- [ ] RapidAPI / api-football.com
- [ ] console.groq.com
- [ ] the-odds-api.com
- [ ] github.com (to store and deploy code)
- [ ] railway.app (free hosting)
- [ ] vercel.com (free static hosting)

**Day 2 (affiliate applications — apply NOW, approval takes days):**
- [ ] DraftKings Affiliates
- [ ] FanDuel Affiliates
- [ ] BetMGM Affiliates
- [ ] Caesars Affiliates
- [ ] NordVPN Affiliates
- [ ] bet365 Partners
- [ ] FuboTV Affiliates

**Day 3 (premium monetization):**
- [ ] whop.com
- [ ] YouTube channel (monetization application)
- [ ] TikTok Creator account
- [ ] twilio.com (SMS alerts)

**Later:**
- [ ] Substack
- [ ] Medium Partner Program
- [ ] Google AdSense
- [ ] Google Search Console
- [ ] Google News Publisher

---

## TROUBLESHOOTING

**preview-engine.js not running?**
- Check Railway logs → Variables tab → make sure all env vars are set
- Test locally: `cp .env.example .env` → fill in values → `npm install` → `node preview-engine.js`

**Telegram bot not responding?**
- Make sure `TELEGRAM_BOT_TOKEN` is correct
- DM your bot `/start` — if no response, check Railway Python service logs

**No articles posting to WordPress?**
- Verify Application Password (not your login password)
- Test URL: `curl -u username:apppassword https://yoursite.com/wp-json/wp/v2/posts`

**Affiliate links not tracking?**
- Replace ALL placeholder URLs with your actual affiliate URLs
- Use Pretty Links on WordPress to auto-replace keywords → use your affiliate URL as the target

**Goal monitor not detecting events?**
- API-Football free tier sometimes has 5–10 minute data delays
- Acceptable — still faster than most publishers

---

## REVENUE PROJECTION (conservative)

| Source | Month 1 (WC) | Month 2–3 (post-WC) |
|---|---|---|
| Affiliate commissions | $2,000–$15,000 | $500–$3,000 |
| Matched betting bonuses | $5,000–$25,000 | $0 (one-time) |
| Newsletter ads (Beehiiv) | $200–$2,000 | $100–$500 |
| Community subscriptions | $500–$5,000 | $500–$5,000 |
| YouTube/TikTok/platform ads | $100–$1,000 | $100–$500 |
| Live stream gifts/Super Chat | $200–$2,000 | $0 |
| White-label content sales | $0–$5,000 | $500–$2,000 |
| **Total** | **$8,000–$55,000** | **$1,700–$11,000/mo** |

The community (Telegram + Discord + email list) is the permanent asset. Every future WC, Champions League, Euros, Copa America — it keeps growing and earning.

---

*Files in this package: preview-engine.js · goal-monitor.js · odds-tool.html · office-pool.html · telegram-bot.py · package.json · requirements.txt · .env.example · setup-guide.md*
