# MASTER DEPLOYMENT GUIDE
## WC 2026 AI Empire — Build Everything, Deploy Everything, Run 24/7
## WC starts June 11. Tonight matters.

---

## THE ARCHITECTURE IN ONE SENTENCE

One Railway server runs all automated processes. Vercel hosts all web tools. Both are free to start. Everything talks to each other via your .env file.

---

# PART 1 — TONIGHT (Before First Match)

## STEP 1: CREATE EVERY ACCOUNT (Do this first, in order — 60 minutes)

Do these in order because some need to be set up before others.

### 1A. Infrastructure Accounts

**Railway** (your server — runs all automated code)
→ https://railway.app
→ Sign up with GitHub
→ Free tier: $5 credit. Upgrade to Hobby ($5/month) after first affiliate click.

**Vercel** (your website host — runs all HTML tools)
→ https://vercel.com
→ Sign up with GitHub
→ Free forever for static sites.

**GitHub** (stores your code — Railway and Vercel deploy from here)
→ https://github.com
→ Create account if you don't have one
→ Create a new private repo called `wc2026-ai`

### 1B. AI / Data API Accounts

**Groq** (free AI — generates all your content)
→ https://console.groq.com
→ Sign up → API Keys → Create key
→ Save as: GROQ_API_KEY

**API-Football** (live match data)
→ https://rapidapi.com/api-sports/api/api-football
→ Sign up for RapidAPI → Subscribe to API-Football free plan (100 req/day)
→ Save as: API_FOOTBALL_KEY
→ NOTE: Upgrade to $9.99/month plan IMMEDIATELY after first revenue. Free tier breaks on match day 1.

**The Odds API** (betting odds)
→ https://the-odds-api.com
→ Sign up → Get API key (500 free requests/month)
→ Save as: ODDS_API_KEY

### 1C. Communication Accounts

**Telegram Bot** (your main distribution channel)
→ Open Telegram → Search @BotFather → /newbot
→ Name it: "WC2026 AI" → Username: wc2026ai_bot (or available name)
→ Save the token as: TELEGRAM_BOT_TOKEN
→ Create your first channel: New Channel → "WC 2026 AI Predictions"
→ Add your bot as admin to the channel
→ Save channel username as: TELEGRAM_CHANNEL_ID (format: @yourchannel)

**Beehiiv** (email newsletter)
→ https://beehiiv.com
→ Sign up free → Create publication "WC 2026 AI Intelligence"
→ Settings → API → Generate key
→ Save as: BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID

### 1D. Social Media Accounts (apply for API access today — approval takes 3-7 days)

**Twitter/X Developer** 
→ https://developer.twitter.com
→ Apply for free Basic access
→ Create app → Save: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET

**Facebook Developer** (for posting to Facebook Pages)
→ https://developers.facebook.com
→ Create app → Save: META_ACCESS_TOKEN, META_PAGE_ID

While waiting for approvals: post manually for first 3-7 days.

### 1E. Affiliate Accounts (apply to all, approvals are fast)

**Bet9ja** (Nigeria — highest volume)
→ https://bet9ja.com/affiliates
→ Apply → Save your affiliate link

**Betika** (Kenya)
→ https://betika.com/affiliates

**1xBet** (global — fastest approval)
→ https://1xbet-affiliates.com
→ Apply → instant or 24hr approval

**Betway Africa**
→ https://betwaypartners.com

**SportPesa** (East Africa)
→ https://affiliates.sportpesa.com

**Parimatch**
→ https://partners.parimatch.com

**NordVPN** (your highest-paying non-betting affiliate — $100 CPA)
→ https://affiliates.nordvpn.com

**Booking.com** (travel for fans attending WC)
→ https://partners.booking.com

**Amazon Associates** (merchandise)
→ https://affiliate-program.amazon.com

Save all affiliate links in a file called `affiliate-links.json`.

---

## STEP 2: SET UP YOUR .ENV FILE (10 minutes)

Create a file called `.env` in your project folder. Never commit this to GitHub (add to .gitignore).

```bash
# AI
GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=llama3-70b-8192

# Match Data
API_FOOTBALL_KEY=your_rapidapi_key_here
ODDS_API_KEY=your_odds_api_key_here

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=@yourchannel

# Email
BEEHIIV_API_KEY=your_beehiiv_key_here
BEEHIIV_PUBLICATION_ID=your_pub_id_here

# Social (fill as you get approvals)
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=
META_ACCESS_TOKEN=
META_PAGE_ID=

# Affiliate Links (your tracked links)
AFFILIATE_BET9JA=https://bet9ja.com/r/YOURCODE
AFFILIATE_BETIKA=https://betika.com/r/YOURCODE
AFFILIATE_1XBET=https://1xbet.com/r/YOURCODE
AFFILIATE_BETWAY=https://betway.com/r/YOURCODE
AFFILIATE_NORDVPN=https://nordvpn.com/r/YOURCODE
```

---

## STEP 3: PUSH CODE TO GITHUB (15 minutes)

```bash
# In your project folder (where all the /outputs files are)
git init
git add .
git commit -m "Initial deploy — WC 2026 AI system"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/wc2026-ai.git
git push -u origin main
```

---

## STEP 4: DEPLOY TO RAILWAY (20 minutes)

Railway runs all your automated background processes (goal monitor, preview engine, Telegram bot, agent system).

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project (run from your project folder)
railway init
# Select: Empty project
# Name it: wc2026-ai

# Add your .env variables to Railway
railway variables set GROQ_API_KEY=your_key
railway variables set API_FOOTBALL_KEY=your_key
railway variables set TELEGRAM_BOT_TOKEN=your_key
railway variables set TELEGRAM_CHANNEL_ID=@yourchannel
# ... repeat for all .env variables

# Deploy
railway up
```

**Configure which processes run:**
In your Railway project dashboard → Add services:

Service 1: Telegram Bot
```
Start command: python telegram-bot.py
```

Service 2: Goal Monitor
```
Start command: node goal-monitor.js
```

Service 3: Preview Engine
```
Start command: node preview-engine.js
```

Service 4: Agent System (master orchestrator)
```
Start command: python agent-system.py
```

All four run simultaneously on the same Railway project. Total cost: $5/month Hobby plan.

---

## STEP 5: DEPLOY WEB TOOLS TO VERCEL (10 minutes)

Vercel hosts all your HTML tools — the static files that users visit in their browser.

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from your project folder
vercel --prod

# Follow prompts:
# - Link to existing project? No
# - Project name: wc2026-ai-tools
# - Directory: ./
# - Override settings? No
```

This deploys ALL your HTML files instantly:
- `odds-tool.html` → yourproject.vercel.app/odds-tool
- `prediction-game.html` → yourproject.vercel.app/prediction-game
- `arb-scanner.html` → yourproject.vercel.app/arb-scanner
- `office-pool.html` → yourproject.vercel.app/office-pool
- `card-generator.html` → yourproject.vercel.app/card-generator
- `second-screen-app.html` → yourproject.vercel.app/second-screen-app
- `streaming-guide.html` → yourproject.vercel.app/streaming-guide

Every HTML tool is instantly live. Free. No maintenance.

**Custom domain (optional, $10-12/year):**
Buy yourname.com on Namecheap → Add to Vercel → All tools live at yoursite.com/tool-name

---

## STEP 6: DEPLOY PROGRAMMATIC SEO PAGES (5 minutes)

```bash
# Generate all 500+ pages first
node programmatic-seo.js

# This creates a /seo-pages/ folder with 500+ HTML files
# Deploy the whole thing to Vercel
vercel --prod
```

500+ pages live in 5 minutes. Google indexes them within 24-48 hours.
Submit to Google Search Console immediately after:
→ https://search.google.com/search-console
→ Add property → URL prefix → your Vercel URL
→ Sitemaps → Submit sitemap.xml

---

## STEP 7: VERIFY EVERYTHING IS RUNNING (15 minutes)

```bash
# Check Railway logs
railway logs

# You should see:
# [telegram-bot] Bot started, listening for commands
# [goal-monitor] Polling API-Football... next check in 60s
# [preview-engine] Next preview generation: [time]
# [agent-system] Orchestrator running. 6 agents active.
```

Test your Telegram bot:
→ Open Telegram → Search your bot name → /start
→ Should respond with welcome message
→ /picks → Should return today's AI predictions
→ /odds → Should return current odds

**You're live.** The system is running 24/7.

---

# PART 2 — WEEK 1 BUILD SCHEDULE (June 11-17)

The core system is live. Now build the highest-revenue additions during group stage matches.

## Day 1-2: SMS System ($4M/month ceiling)

```bash
# Install Africa's Talking
pip install africastalking --break-system-packages
```

Create `sms-system.py`:
```python
import africastalking
import schedule
import time
from datetime import datetime

# Initialize
africastalking.initialize(
    username=os.getenv('AT_USERNAME'),
    api_key=os.getenv('AT_API_KEY')
)
sms = africastalking.SMS

def send_prematch_sms(subscribers, match_data, prediction):
    """Send pre-match prediction via SMS (160 chars max)"""
    message = f"{match_data['home']} vs {match_data['away']} {match_data['time']}. AI: {prediction['winner']} {prediction['probability']}%. Best bet: {prediction['top_market']}. Reply STOP to unsub."
    
    response = sms.send(message, subscribers)
    return response

def send_goal_sms(subscribers, goal_data):
    """Send live goal alert"""
    message = f"GOAL! {goal_data['team']} {goal_data['score']} {goal_data['minute']}'. {goal_data['scorer']}. AI win prob now: {goal_data['new_probability']}%."
    sms.send(message, subscribers)

# Subscription management
def subscribe(phone_number, language='en', market='NG'):
    """Add subscriber to database"""
    # Use simple JSON file or SQLite for free storage
    pass

def unsubscribe(phone_number):
    """Handle STOP replies automatically"""
    pass

# Pricing: charge via Africa's Talking payment integration
# $0.50/week = ~$2/month per subscriber
```

Add to Railway: new service → `python sms-system.py`
Add to .env: AT_USERNAME, AT_API_KEY (from africastalking.com — free account)

**Signup page:** Add a simple form to your Vercel site. User enters phone number → added to SMS list.

---

## Day 2-3: Halftime AI Bulletin

Add to `goal-monitor.js`:
```javascript
// Detect 45th minute
if (matchTime === 45 || matchTime === 46) {
  await generateHalftimeBulletin(match);
}

async function generateHalftimeBulletin(match) {
  const firstHalfData = {
    score: match.score,
    xG: match.statistics.xG,
    shots: match.statistics.shots,
    possession: match.statistics.possession,
    cards: match.events.cards
  };
  
  const prompt = `You are a football analyst. Generate a halftime bulletin for ${match.home} vs ${match.away}.
  First half data: ${JSON.stringify(firstHalfData)}
  Current AI probability was: ${match.preProbability}
  
  Update the probability for second half. What changed? What to watch.
  Format: 3 sentences max. Include updated win probabilities.`;
  
  const bulletin = await groq.chat.completions.create({
    model: 'llama3-70b-8192',
    messages: [{ role: 'user', content: prompt }]
  });
  
  // Post to Telegram
  await bot.sendMessage(CHANNEL_ID, `⏸ HALFTIME: ${match.home} ${match.score} ${match.away}\n\n${bulletin.choices[0].message.content}`);
}
```

---

## Day 3-4: Betting Slip Screenshot Analyzer

Add to `telegram-bot.py`:
```python
@bot.message_handler(content_types=['photo'])
def analyze_bet_slip(message):
    """User sends screenshot of bet slip → AI evaluates EV"""
    
    # Get photo
    file_info = bot.get_file(message.photo[-1].file_id)
    downloaded_file = bot.download_file(file_info.file_path)
    
    # Use Groq vision (or parse text from image via pytesseract)
    # Extract: selections, odds, stake
    
    # Calculate EV for each leg
    analysis = calculate_ev(selections)
    
    response = f"📊 BET SLIP ANALYSIS\n\n"
    for leg in analysis:
        ev_emoji = "✅" if leg['ev'] > 0 else "❌"
        response += f"{ev_emoji} {leg['selection']}: {leg['odds']} odds | True prob: {leg['true_prob']}% | EV: {leg['ev']:+.1f}%\n"
    
    response += f"\nOverall accumulator EV: {analysis['total_ev']:+.1f}%"
    
    if analysis['total_ev'] < -5:
        response += "\n\n⚠️ This accumulator has negative expected value. Suggest replacing leg 3."
    
    # Charge $0.99 via Telegram Stars (Telegram's built-in payment)
    bot.reply_to(message, response)

def calculate_ev(selections):
    """Compare user's odds vs AI true probability"""
    results = []
    for sel in selections:
        true_prob = get_ai_probability(sel)  # from your prediction system
        implied_prob = 1 / sel['odds'] * 100
        ev = (true_prob - implied_prob)
        results.append({
            'selection': sel['name'],
            'odds': sel['odds'], 
            'true_prob': true_prob,
            'ev': ev
        })
    return results
```

---

## Day 4-5: WC Story Generator

Add endpoint to `telegram-bot.py`:
```python
@bot.message_handler(commands=['story'])
def generate_story(message):
    """
    User: /story Nigeria wins the World Cup
    AI: Generates dramatic narrative
    """
    prompt_text = message.text.replace('/story ', '')
    
    story_prompt = f"""Write a compelling 3-paragraph football narrative:
    Scenario: {prompt_text}
    Style: Dramatic sports journalism. Specific player names from WC 2026 rosters. 
    Language: {detect_language(message)}
    Make it feel real and emotionally resonant."""
    
    story = groq_generate(story_prompt)
    
    # Charge $0.99 via Telegram payment or send free with premium CTA
    bot.reply_to(message, story + "\n\n🔮 Want more? Subscribe: [your link]")
```

---

## Day 5-7: Heat Map of Smart Money

Create `smart-money-tracker.js`:
```javascript
const axios = require('axios');
const cron = require('node-cron');

let previousOdds = {};

// Poll every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await trackLineMovement();
});

async function trackLineMovement() {
  const response = await axios.get('https://api.the-odds-api.com/v4/sports/soccer_wc/odds', {
    params: {
      apiKey: process.env.ODDS_API_KEY,
      regions: 'eu,uk,au',
      markets: 'h2h',
      bookmakers: 'pinnacle,betfair,bet365'
    }
  });
  
  for (const match of response.data) {
    const matchId = match.id;
    
    for (const bookmaker of match.bookmakers) {
      if (bookmaker.key === 'pinnacle') { // Pinnacle = sharpest book
        const currentOdds = bookmaker.markets[0].outcomes;
        
        if (previousOdds[matchId]) {
          const movement = detectSignificantMovement(previousOdds[matchId], currentOdds);
          
          if (movement.significant) {
            // Sharp money detected
            await sendSharpMoneyAlert(match, movement);
          }
        }
        
        previousOdds[matchId] = currentOdds;
      }
    }
  }
}

async function sendSharpMoneyAlert(match, movement) {
  const alert = `🔴 SHARP MONEY ALERT
  
${match.home_team} vs ${match.away_team}

${movement.outcome} odds moved: ${movement.from} → ${movement.to}
Movement: ${movement.percentage}% in ${movement.timeWindow}
Sharp indicator: ${movement.sharpScore}/10

This pattern historically precedes informed betting.`;

  // Send to premium subscribers only
  await bot.sendMessage(PREMIUM_CHANNEL_ID, alert);
}
```

---

# PART 3 — WEEKS 2-4 BUILD SCHEDULE

## Week 2 (June 18-24): Revenue Infrastructure

### Beehiiv Newsletter Automation
Your email-funnel.js already exists. Make sure it's connected:
```bash
# Test it
node email-funnel.js --test
# Should send a test email to your Beehiiv list
```

Set up automated sequences in Beehiiv:
- Welcome email: immediate on signup
- First prediction: 1 hour after signup
- "How to use your free bet" guide: 24 hours after signup
- Premium upgrade pitch: 72 hours after signup

### Honest Tipster Index (viral acquisition engine)
Create `tipster-tracker.js`:
```javascript
// Scrape public tipster channels
// Twitter accounts, Telegram channels — their predictions are public
// Track: prediction made (timestamp), result, running accuracy

const tipsters = [
  { name: 'TipsterX', twitter: '@tipsterx', telegram: '@tipsterxchannel' },
  // add known tipsters in your target markets
];

// Once per day: check yesterday's picks vs results
// Update accuracy database
// If accuracy < 45%: flag as "potentially misleading"
// If accuracy > 55%: flag as "verified performing"

// Publish daily leaderboard to your website
```

### FAST Channel Submission
Go to:
- **Samsung TV Plus:** https://tv.samsungplus.com/content-submission
- **Roku Channel Store:** https://developer.roku.com/docs/developer-program/publishing/channel-publishing-guide.md
- **Pluto TV:** https://pluto.tv/content-partnership

Submit your channel. Approval: 2-4 weeks. Content: your AI-generated video previews (use text-to-speech + match graphics from card-generator.html).

### Ezoic Application
Once you hit 10,000 monthly visitors (likely within week 1 of WC):
→ https://www.ezoic.com/publisher-monetization/
→ Apply → Connect your Vercel domain
→ Replace Google AdSense with Ezoic
→ Immediately earn 5-10× more from same traffic

---

## Week 3 (June 25 - July 1): Scale Infrastructure

### Programmatic Expansion
Your programmatic-seo.js already generates 500+ pages.
Add these new page types:
```javascript
// Add to programmatic-seo.js

const newPageTypes = [
  // Referee pages
  { template: 'referee', slug: 'referee-[name]-wc-2026-stats' },
  
  // Fatigue pages  
  { template: 'fatigue', slug: '[team]-squad-fatigue-index' },
  
  // Pronunciation pages
  { template: 'pronunciation', slug: 'how-to-pronounce-[player-name]' },
  
  // Diaspora pages
  { template: 'diaspora', slug: '[country]-fans-[host-city]-crowd-advantage' }
];
```

Run `node programmatic-seo.js` → 1,000+ total pages → redeploy to Vercel.

### Africa's Talking Payment Integration
For paid SMS subscriptions:
→ Africa's Talking dashboard → Payments → Enable
→ Integration: users send "JOIN" to your shortcode → auto-charged to their phone bill
→ No credit card. No PayPal. Works on any feature phone.

---

## Week 4-5 (July 2-19): Knockout Stage — Maximum Revenue

By knockout stage:
- Every subscriber has been building for weeks
- Each match is do-or-die → betting volume 3-5× group stage
- Your affiliate links earn maximum CPA per click

### Launch Premium VIP Tier
Add to Telegram bot:
```python
@bot.message_handler(commands=['premium'])
def show_premium(message):
    keyboard = types.InlineKeyboardMarkup()
    keyboard.add(
        types.InlineKeyboardButton("Join Premium — $19.99/month", 
                                   url="https://whop.com/yourproduct")
    )
    bot.send_message(
        message.chat.id,
        "🔐 PREMIUM TIER\n\nTop 3 AI picks daily\n+ Sharp money alerts\n+ Halftime bulletins\n+ Bet slip analysis\n\nMoney-back guarantee if AI accuracy < 55%",
        reply_markup=keyboard
    )
```

Set up Whop.com (free) for payment processing:
→ https://whop.com
→ Create product → Set price → Get link → Add to bot

### Oracle Race Tournament
Add `tournament.html` to Vercel:
- $50 entry fee via Stripe
- Public leaderboard
- "Beat the AI" headline
- Launch by quarterfinal stage

---

# PART 4 — POST-WC EMPIRE BUILD (August onwards)

After the tournament, you have:
- Email list of subscribers
- Verified AI accuracy track record
- Affiliate revenue history
- An audience in 50 languages

Now build the infrastructure that turns this into a year-round business.

## Month 2-3: Platform SaaS
Package your system for other sports:
- NBA (starts October)
- Cricket (year-round)
- Rugby World Cup 2027
- Copa América 2027
- AFCON 2027
- EURO 2028

License the full stack to operators in each sport: $500-$5,000/month.

## Month 3-4: Franchise System
Onboard local operators in top 10 markets:
- Nigeria, Kenya, South Africa
- India, Indonesia, Philippines
- Brazil, Colombia, Mexico
- Morocco, Egypt, Senegal

Each franchise runs their market independently with your technology.
You earn 30% revenue share automatically.

## Month 4-6: Prediction Market Build
For markets where sportsbooks are restricted (India, Indonesia, large parts of Africa):
Build a prediction market using Kalshi/Polymarket model.
Legal in most jurisdictions as a financial product, not gambling.

---

# PART 5 — THE FULL AUTOMATION ARCHITECTURE

When everything is running, this is the complete picture:

```
EVERY 60 SECONDS:
└── goal-monitor.js polls API-Football
    ├── Goal detected → generates AI reaction in 50 languages → posts to all Telegram channels
    ├── 45th minute → generates halftime bulletin → posts to premium channel
    └── Full time → generates match report → posts to all platforms + email list

EVERY 3 HOURS (pre-match):
└── preview-engine.js
    ├── Generates match preview in 50 languages
    ├── Posts to Telegram channels
    ├── Posts to all social platforms (when API access approved)
    └── Queues email newsletter

EVERY 5 MINUTES (during match):
└── smart-money-tracker.js polls odds across 50+ books
    ├── Detects line movement > 3% → sends sharp money alert to premium subscribers
    └── Updates odds dashboard on Vercel

EVERY 24 HOURS:
└── programmatic-seo.js regenerates dynamic pages with updated stats
└── tipster-tracker.js updates honesty index
└── agent-system.py sends daily digest to email list via Beehiiv

ON USER ACTIONS:
└── telegram-bot.py responds to:
    ├── /picks → today's AI predictions
    ├── /odds → live odds comparison  
    ├── /today → match schedule
    ├── [photo] → bet slip analysis ($0.99)
    ├── /story → narrative generator ($0.99)
    └── /premium → upgrade CTA

STATIC (always on, Vercel):
└── odds-tool.html — live odds comparison
└── arb-scanner.html — arbitrage calculator
└── prediction-game.html — prediction competition
└── office-pool.html — office pool generator
└── second-screen-app.html — mobile PWA
└── streaming-guide.html — affiliate streaming guide
└── 1,000+ SEO pages — capturing long-tail search traffic

SMS (triggered by match events):
└── sms-system.py
    ├── Pre-match: 2 hours before kickoff → prediction SMS to subscribers
    ├── Goal: within 60 seconds → alert SMS
    └── Full time: match result + next match preview SMS
```

**Total infrastructure cost to run all of this:**
| Service | Cost |
|---------|------|
| Railway Hobby | $5/month |
| API-Football paid | $9.99/month |
| Vercel | Free |
| Groq | Free (500K tokens/day) |
| Beehiiv | Free (up to 2,500 subscribers) |
| Africa's Talking | Free ($0.01/SMS — covered by subscription fee) |
| The Odds API | Free (500 req/month) |
| **Total** | **~$15/month** |

**Revenue needed to cover infrastructure: $15.**
**Revenue the system generates from day 1: potentially thousands of dollars.**

---

# PART 6 — WHAT TO DO RIGHT NOW

In order. Tonight.

1. ✅ Create Railway account (5 min)
2. ✅ Create Vercel account (5 min)  
3. ✅ Create GitHub account + repo (10 min)
4. ✅ Create Groq account + get API key (5 min)
5. ✅ Create API-Football account on RapidAPI (5 min)
6. ✅ Create Telegram bot via BotFather + create channel (10 min)
7. ✅ Create Beehiiv newsletter (10 min)
8. ✅ Apply to 5 affiliate programs (20 min)
9. ✅ Fill in .env file with all keys (10 min)
10. ✅ Push code to GitHub (15 min)
11. ✅ Deploy to Railway (20 min)
12. ✅ Deploy to Vercel (10 min)
13. ✅ Test Telegram bot with /picks command (5 min)
14. ✅ Submit sitemap to Google Search Console (5 min)
15. ✅ Apply to Twitter and Meta developer accounts (10 min)

**Total: ~2.5 hours. The system runs for the entire 38-day tournament with zero further intervention.**

---

# THE ONE THING

You don't need to build everything before the first match.

You need to build the **core automated system** (goal monitor + preview engine + Telegram bot + SEO pages) and deploy it tonight. That system starts earning from match 1.

Then you build everything else **while the tournament is running**, adding revenue streams week by week, each one running autonomously after it's built.

By the final (July 19), you'll have 15-20 automated systems all running simultaneously, all earning in parallel, none of them requiring you to be awake.

**The tournament is the runway. Use all of it.**
