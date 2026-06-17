/**
 * income-activator.js — Activate Every Income Stream
 *
 * Run this file and it tells you EXACTLY what to do to activate each stream.
 * As you complete each one, run: node income-activator.js activate [id]
 * It tracks which are live, which are next, and how much each is worth.
 *
 * USAGE:
 *   node income-activator.js            → show full status + next actions
 *   node income-activator.js next       → show only the highest-priority pending stream
 *   node income-activator.js activate [id]  → mark stream as live
 *   node income-activator.js revenue    → show estimated monthly revenue from active streams
 *   node income-activator.js all        → show every stream with full details
 *
 * Each stream has:
 *   - Exact steps to activate (no guesswork)
 *   - Time to activate (realistic)
 *   - Monthly revenue estimate (conservative)
 *   - Revenue ceiling (if things go well)
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

// ── STATUS FILE ────────────────────────────────────────────────────────────────
const STATUS_FILE = path.join(__dirname, 'stream-status.json');
let streamStatus = {};
try { streamStatus = JSON.parse(fs.readFileSync(STATUS_FILE)); } catch {}
function saveStatus() { fs.writeFileSync(STATUS_FILE, JSON.stringify(streamStatus, null, 2)); }
function isActive(id) { return streamStatus[id] === 'active'; }
function activate(id) { streamStatus[id] = 'active'; saveStatus(); }

// ── INCOME STREAM MASTER LIST ──────────────────────────────────────────────────
const STREAMS = [

  // ══════════════════════════════════════════════════════════════════════
  //  TIER 1: DO THESE FIRST — HIGH REWARD, LOW EFFORT, ALREADY BUILT
  // ══════════════════════════════════════════════════════════════════════

  {
    id: 'deploy_vercel',
    name: 'Deploy site to Vercel',
    category: 'Infrastructure',
    timeToActivate: '30 min',
    monthlyMin: 0, monthlyMax: 0, // prerequisite
    isPrerequisite: true,
    steps: [
      '1. Create GitHub account: github.com/signup',
      '2. Create new repo: github.com/new → name: wc2026intel → Public → Create',
      '3. In terminal: git init && git add . && git commit -m "initial" && git push',
      '4. Create Vercel account: vercel.com/signup → Log in with GitHub',
      '5. Import repo → Deploy → Done. Your site is live.',
      '6. Note your URL (e.g. wc2026intel.vercel.app)',
    ],
  },

  {
    id: 'deploy_railway',
    name: 'Deploy bots to Railway',
    category: 'Infrastructure',
    timeToActivate: '20 min',
    monthlyMin: 0, monthlyMax: 0,
    isPrerequisite: true,
    steps: [
      '1. Create Railway account: railway.app → Sign up with GitHub',
      '2. New Project → Deploy from GitHub → select wc2026intel',
      '3. Railway auto-detects railway.json and creates 4 services',
      '4. Add environment variables: Settings → Variables → paste your .env',
      '5. Deploy. All bots go live.',
    ],
  },

  {
    id: 'telegram_channel',
    name: 'Telegram free channel',
    category: 'Subscriptions',
    timeToActivate: '10 min',
    monthlyMin: 0, monthlyMax: 500, // Lead gen for premium
    steps: [
      '1. Open Telegram → New Channel → Name: "WC 2026 Intel" → Public',
      '2. Username: @wc2026intel (or closest available)',
      '3. Copy channel username → add to .env as TELEGRAM_FREE_CHANNEL_ID',
      '4. Create your Telegram bot: search @BotFather → /newbot',
      '5. Name: WC 2026 Intel Bot → username: wc2026intelbot',
      '6. Copy token → add to .env as TELEGRAM_BOT_TOKEN',
      '7. Add bot as admin of your channel',
      '8. Find your own Telegram user ID: search @userinfobot → send /start',
      '9. Add to .env as TELEGRAM_OWNER_ID',
    ],
  },

  {
    id: 'groq_api',
    name: 'Groq AI (free 500K tokens/day)',
    category: 'Infrastructure',
    timeToActivate: '5 min',
    monthlyMin: 0, monthlyMax: 0,
    isPrerequisite: true,
    steps: [
      '1. Go to: console.groq.com',
      '2. Sign up with Google',
      '3. API Keys → Create API Key → Copy it',
      '4. Add to .env: GROQ_API_KEY=gsk_xxx',
    ],
  },

  {
    id: 'api_football',
    name: 'API-Football (live match data)',
    category: 'Infrastructure',
    timeToActivate: '5 min',
    monthlyMin: 0, monthlyMax: 0,
    isPrerequisite: true,
    steps: [
      '1. Go to: rapidapi.com/api-sports/api/api-football',
      '2. Sign up → Subscribe to FREE plan (100 req/day)',
      '3. Copy API key → add to .env as RAPIDAPI_KEY',
    ],
  },

  {
    id: 'geo_affiliates',
    name: 'Geo-routed betting affiliates (40+ countries)',
    category: 'Affiliates',
    timeToActivate: '2 hours',
    monthlyMin: 500, monthlyMax: 20000,
    notes: 'Highest single revenue source. UK/US/AU/NG are best CPA countries.',
    steps: [
      '--- UK/IE: Bet365 ---',
      '1. affiliate.bet365.com → Sign up as affiliate → Apply for sports',
      '2. Get tracking URL → update geo-affiliate-router.js AFFILIATES.GB.url',
      '',
      '--- USA: DraftKings ---',
      '1. draftkings.com/affiliates → Sign up',
      '2. WC 2026 is huge for DFS in USA. $50-200 CPA.',
      '3. Get link → update AFFILIATES.US.url',
      '',
      '--- Australia: Bet365 AU ---',
      '1. Same affiliate portal, Australian market link',
      '2. $100+ AUD CPA typical',
      '',
      '--- Nigeria: Betway Africa ---',
      '1. partners.betway.com → Apply for African markets',
      '2. Betking also strong in Nigeria: partners.betking.com',
      '',
      '--- Brazil: Sportingbet / Bet365 BR ---',
      '1. brazil.bet365.com has affiliate program',
      '2. Massive WC market — Brazilians bet heavily',
      '',
      '--- All others: Use 1xBet or Bet365 international ---',
      '1. partners.1xbet.com → One affiliate covers 50+ countries',
      '2. 25-40% revenue share available',
    ],
  },

  {
    id: 'ezoic_ads',
    name: 'Ezoic display ads (4× AdSense RPM)',
    category: 'Display Ads',
    timeToActivate: '1 week (approval)',
    monthlyMin: 200, monthlyMax: 15000,
    notes: 'Apply immediately — approval takes 3-7 days. $15-45 RPM vs AdSense $3-8.',
    steps: [
      '1. Go to: ezoic.com → Sign up',
      '2. Add your Vercel domain',
      '3. Verify site ownership (add DNS TXT record or HTML file)',
      '4. Install Ezoic script on all pages (one line in <head>)',
      '5. Wait 3-7 days for approval',
      '6. Once approved: Ezoic auto-places ads, optimises layout for max revenue',
      '7. Revenue starts immediately after approval',
    ],
  },

  {
    id: 'beehiiv_email',
    name: 'Beehiiv email list + 38-day drip',
    category: 'Email',
    timeToActivate: '1 hour',
    monthlyMin: 100, monthlyMax: 10000,
    steps: [
      '1. Create Beehiiv account: beehiiv.com → Sign up',
      '2. Create publication: "WC 2026 Intel"',
      '3. Settings → API Keys → create key → add to .env as BEEHIIV_API_KEY',
      '4. Settings → Publication → copy Publication ID → add to .env as BEEHIIV_PUBLICATION_ID',
      '5. Automations → New Automation → Trigger: New Subscriber',
      '6. Add each email from email-drip-sequence.md with the specified delays',
      '7. Enable automation → it runs forever automatically',
      '8. Add email signup form HTML from Beehiiv to all pages (already coded in page templates)',
    ],
  },

  {
    id: 'premium_telegram',
    name: 'Premium Telegram ($9.99/month)',
    category: 'Subscriptions',
    timeToActivate: '30 min',
    monthlyMin: 100, monthlyMax: 50000,
    notes: '10 subscribers = $100/month. 100 = $1K. 1,000 = $10K. Recurring.',
    steps: [
      '1. Create Whop account: whop.com → Sign up',
      '2. Create a product: "WC 2026 Intel Premium" → $9.99/month',
      '3. Connect your Telegram premium channel to the Whop product',
      '4. Whop automatically grants/revokes access based on payment',
      '5. Get your Whop checkout URL → use as premium CTA everywhere',
      '6. Add to .env: TELEGRAM_PREMIUM_CHANNEL_ID, WHOP_API_KEY',
      '7. Update all CTAs in pages and emails to point to Whop checkout',
    ],
  },

  {
    id: 'propellerads',
    name: 'PropellerAds push notification ads',
    category: 'Push Ads',
    timeToActivate: '2 hours',
    monthlyMin: 50, monthlyMax: 2000,
    notes: 'Passive income. Every visitor who opts in = $0.05-0.50/month forever.',
    steps: [
      '1. Create PropellerAds account: propellerads.com → Publishers',
      '2. Add your site → Verify ownership',
      '3. Create Push Notification zone → copy the code snippet',
      '4. Add to all HTML pages in <head> (or via GTM)',
      '5. Visitors see "Allow notifications?" → 20-40% opt in',
      '6. PropellerAds serves ads to opted-in users → you earn per impression',
      '7. Connect your bank account / PayPal for payouts',
    ],
  },

  {
    id: 'nordvpn_affiliate',
    name: 'NordVPN affiliate (watch guide page)',
    category: 'Affiliates',
    timeToActivate: '20 min',
    monthlyMin: 50, monthlyMax: 3000,
    notes: '$60-100 per signup. Every visitor in a restricted country = potential sale.',
    steps: [
      '1. Apply: affiliates.nordvpn.com',
      '2. Once approved (instant for most), get your tracking URL',
      '3. Replace placeholder NordVPN links in watch-guide.html with your affiliate URL',
      '4. Watch-guide.html already exists and has NordVPN CTAs built in',
    ],
  },

  {
    id: 'printful_merch',
    name: 'Printful print-on-demand merch',
    category: 'Products',
    timeToActivate: '1 hour',
    monthlyMin: 50, monthlyMax: 2000,
    steps: [
      '1. Create Printful account: printful.com → Sign up',
      '2. Create products: jerseys, scarves, flags, mugs, phone cases',
      '3. Connect to Shopify or use Printful\'s hosted storefront',
      '4. Get product URLs → update merch-store.html product links',
      '5. Printful handles printing, shipping, returns — zero work from you',
      '6. Profit margin: typically 20-40% of sale price',
    ],
  },

  {
    id: 'google_search_console',
    name: 'Google Search Console + Bing Webmaster',
    category: 'SEO',
    timeToActivate: '15 min',
    monthlyMin: 0, monthlyMax: 0, // Multiplier, not direct revenue
    isPrerequisite: true,
    notes: '15-minute setup = 30% more organic traffic within 2 weeks.',
    steps: [
      '--- Google ---',
      '1. search.google.com/search-console → Add property → your Vercel URL',
      '2. Verify via HTML file (download, add to /public, redeploy)',
      '3. Sitemaps → Submit: [your-url]/sitemap.xml',
      '',
      '--- Bing (30% of searches) ---',
      '1. bing.com/webmasters → Add site → verify',
      '2. Sitemaps → submit same sitemap URL',
      '',
      '--- Generate sitemap ---',
      '3. Add to vercel.json: route /sitemap.xml to a generated file listing all your pages',
    ],
  },

  {
    id: 'social_twitter',
    name: 'Twitter/X automated posting',
    category: 'Social',
    timeToActivate: '30 min',
    monthlyMin: 0, monthlyMax: 2000, // leads to affiliate + sub conversions
    steps: [
      '1. Apply for Twitter API v2: developer.twitter.com → Create project',
      '2. Get: API Key, API Secret, Access Token, Access Token Secret',
      '3. Add all 4 to .env',
      '4. social-blaster.js and omnichannel-engine.js will auto-post',
      '5. Goal alerts, match results, predictions → all go to Twitter within 60 seconds',
    ],
  },

  {
    id: 'facebook_page',
    name: 'Facebook Page + automated posting',
    category: 'Social',
    timeToActivate: '30 min',
    monthlyMin: 0, monthlyMax: 3000,
    steps: [
      '1. Create Facebook Page: facebook.com/pages/create → Sports → "WC 2026 Intel"',
      '2. Meta for Developers: developers.facebook.com → Create App → Business',
      '3. Add Facebook Login product → get Page Access Token',
      '4. Get your Page ID (in Page About section)',
      '5. Add to .env: FB_PAGE_ID, FB_ACCESS_TOKEN',
      '6. omnichannel-engine.js will auto-post to the page',
    ],
  },

  {
    id: 'youtube_channel',
    name: 'YouTube channel + auto-upload',
    category: 'Social',
    timeToActivate: '2 hours',
    monthlyMin: 100, monthlyMax: 10000,
    steps: [
      '1. Create YouTube channel: youtube.com → Create channel → "WC 2026 Intel"',
      '2. Google Cloud Console: console.cloud.google.com → Enable YouTube Data API v3',
      '3. Create OAuth 2.0 credentials → download credentials.json',
      '4. Run youtube-engine.js for first time → it opens browser to authorize',
      '5. After auth: node youtube-engine.js — generates and uploads one video',
      '6. Schedule: cron job runs daily → new video every match day',
      '7. At 1,000 subscribers: monetization eligibility',
    ],
  },

  {
    id: 'reddit_community',
    name: 'Reddit posting + community building',
    category: 'Social',
    timeToActivate: '30 min',
    monthlyMin: 50, monthlyMax: 5000,
    steps: [
      '1. Create Reddit account (new account — separate from personal)',
      '2. Apply for Reddit API: reddit.com/prefs/apps → Create app → Script',
      '3. Get: client_id, client_secret, username, password',
      '4. Use PRAW for OAuth → get access token → add to .env',
      '5. omnichannel-engine.js auto-posts to r/soccer, r/worldcup, r/FootballBetting',
      '6. IMPORTANT: Don\'t spam. Post analysis, not just picks. Add value.',
      '7. Top comment = subtle CTA: "Full predictions at [your site]"',
    ],
  },

  {
    id: 'discord_server',
    name: 'Discord server + webhook posting',
    category: 'Social',
    timeToActivate: '20 min',
    monthlyMin: 0, monthlyMax: 2000,
    steps: [
      '1. Create Discord server: discord.com → + button → Create My Own → For a club/community',
      '2. Create channels: #predictions, #live-scores, #golden-boot, #premium',
      '3. Server Settings → Integrations → Webhooks → New Webhook → copy URL',
      '4. Add to .env: DISCORD_WEBHOOK_URL',
      '5. All events now auto-post to #predictions channel',
      '6. Join existing r/worldcup Discord and r/soccer Discord — post there too',
    ],
  },

  {
    id: 'google_analytics',
    name: 'Google Analytics 4',
    category: 'Analytics',
    timeToActivate: '20 min',
    monthlyMin: 0, monthlyMax: 0,
    isPrerequisite: true,
    notes: 'Required to understand what\'s working. Self-improvement loop needs this data.',
    steps: [
      '1. analytics.google.com → Create account → Create property',
      '2. Get Measurement ID (G-XXXXXXXX)',
      '3. Add to all HTML pages in <head>:',
      '   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX"></script>',
      '   <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-XXXXXXXX");</script>',
      '4. Already templated in match-preview-generator.js — just fill in your ID',
    ],
  },

  {
    id: 'facebook_pixel',
    name: 'Facebook Pixel + retargeting',
    category: 'Retargeting',
    timeToActivate: '30 min + $5/day budget',
    monthlyMin: 200, monthlyMax: 5000,
    notes: 'Retarget everyone who visited but didn\'t subscribe. 5× ROI typical.',
    steps: [
      '1. business.facebook.com → Events Manager → Create Pixel',
      '2. Copy Pixel ID → already in match-preview-generator.js template (replace YOUR_PIXEL_ID)',
      '3. Create Custom Audiences: people who visited /matches/* but didn\'t subscribe',
      '4. Create retargeting campaign: $5/day → show them "Get Free WC Picks" ad',
      '5. Run during knockout stages for maximum ROI',
    ],
  },

  {
    id: 'medium_publishing',
    name: 'Medium auto-published articles',
    category: 'Content',
    timeToActivate: '10 min',
    monthlyMin: 20, monthlyMax: 500,
    notes: 'Each article = backlink to your site + Medium Partner Program revenue.',
    steps: [
      '1. Create Medium account: medium.com → Sign up',
      '2. Settings → Security → Integration tokens → Get token',
      '3. Profile page URL contains your user ID (medium.com/@username)',
      '4. Add to .env: MEDIUM_INTEGRATION_TOKEN, MEDIUM_USER_ID',
      '5. Apply for Medium Partner Program (needs 100 followers first)',
      '6. omnichannel-engine.js auto-publishes match analysis articles',
    ],
  },

  {
    id: 'affiliate_amazon',
    name: 'Amazon affiliate (match day gear)',
    category: 'Affiliates',
    timeToActivate: '15 min',
    monthlyMin: 20, monthlyMax: 500,
    steps: [
      '1. affiliate-program.amazon.com → Join',
      '2. Create links for: official team jerseys, TV sets, scarves, flags, vuvuzelas',
      '3. Add to team hub pages: "Official [Team] merchandise →" with affiliate links',
      '4. Also add to match preview pages and watch guide',
    ],
  },

  {
    id: 'the_odds_api',
    name: 'The Odds API (live odds data)',
    category: 'Infrastructure',
    timeToActivate: '5 min',
    monthlyMin: 0, monthlyMax: 0,
    isPrerequisite: true,
    steps: [
      '1. the-odds-api.com → Sign up → Free plan: 500 requests/month',
      '2. Copy API key → add to .env as THE_ODDS_API_KEY',
      '3. Used by bot-commands.js for /odds command and geo-affiliate-router.js',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  TIER 2: ADD THESE IN WEEK 2
  // ══════════════════════════════════════════════════════════════════════

  {
    id: 'whop_premium',
    name: 'Whop.com premium gating ($9.99/mo)',
    category: 'Subscriptions',
    timeToActivate: '45 min',
    monthlyMin: 100, monthlyMax: 50000,
    steps: [
      '1. whop.com → Sign up as seller',
      '2. Create product → Subscription → $9.99/month',
      '3. Add benefit: Telegram Group Access → paste premium channel invite link',
      '4. Whop automatically grants access on payment, revokes on cancellation',
      '5. Get checkout URL → replace all [Premium →] CTAs with this URL',
      '6. Get Whop webhook secret → add to .env for subscription tracking',
    ],
  },

  {
    id: 'web_push_vapid',
    name: 'Web push notifications (VAPID)',
    category: 'Push',
    timeToActivate: '1 hour',
    monthlyMin: 50, monthlyMax: 3000,
    steps: [
      '1. Generate VAPID keys: npx web-push generate-vapid-keys',
      '2. Add to .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CONTACT_EMAIL',
      '3. service-worker.js is already built — handles push events',
      '4. Add push subscribe prompt to all pages (already in live-scores.html)',
      '5. Store subscriptions in push-subscriptions.json on Railway',
      '6. autonomous-agent.js uses webPush.post() to send goal alerts',
    ],
  },

  {
    id: 'tiktok_content',
    name: 'TikTok content (3 posts/day)',
    category: 'Social',
    timeToActivate: '30 min setup + 10 min/day',
    monthlyMin: 0, monthlyMax: 10000,
    notes: 'TikTok can\'t be fully automated (no official API for posting). But scripts are generated.',
    steps: [
      '1. Create TikTok account: @wc2026intel',
      '2. Each day: check content-queue.json — TikTok scripts are pre-written by omnichannel-engine.js',
      '3. Record using TikTok\'s teleprompter feature (read the script)',
      '4. OR: Screen record your live-scores.html during a live match — instant content',
      '5. Use TikTok Creator Marketplace to monetize at 10K+ followers',
      '6. TikTok LIVE during big matches = gifting revenue (no follower minimum)',
    ],
  },

  {
    id: 'google_news',
    name: 'Google News publisher approval',
    category: 'SEO',
    timeToActivate: '30 min (approval 1-4 weeks)',
    monthlyMin: 0, monthlyMax: 0,
    notes: '2-5× traffic multiplier once approved. Apply on Day 1.',
    steps: [
      '1. news.google.com/publisher-center → Sign in → Add publication',
      '2. Domain: your Vercel URL',
      '3. Publication name: "WC 2026 Intel"',
      '4. Content type: Sports',
      '5. Verify ownership via Google Search Console (already set up)',
      '6. Submit for review — Google checks: regular publishing, author names, original content',
      '7. match-preview-generator.js already adds author bylines and timestamps',
    ],
  },

  {
    id: 'cloudflare',
    name: 'Cloudflare CDN + custom domain',
    category: 'Infrastructure',
    timeToActivate: '1 hour',
    monthlyMin: 0, monthlyMax: 0,
    notes: '2-3× faster site load = higher conversion + better SEO ranking.',
    steps: [
      '1. Buy domain: wc2026intel.com (~$12/year on Namecheap)',
      '2. Create Cloudflare account: cloudflare.com → Add site',
      '3. Change nameservers at your registrar to Cloudflare\'s',
      '4. In Vercel: add custom domain → point to Cloudflare',
      '5. Cloudflare: enable "Always Use HTTPS", "Auto Minify", "Brotli compression"',
      '6. geo-affiliate-router.js uses Cloudflare header cf_country for instant geo-detection',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  TIER 3: SCALE PLAYS (WEEK 3-4, KNOCKOUTS)
  // ══════════════════════════════════════════════════════════════════════

  {
    id: 'b2b_media_outreach',
    name: 'B2B media licensing outreach',
    category: 'B2B',
    timeToActivate: '2 hours',
    monthlyMin: 2000, monthlyMax: 50000,
    notes: 'One deal outpays everything else. Target: radio stations, newspapers, betting sites.',
    steps: [
      '1. Build media kit: "[Your site] delivers AI match predictions to [X] subscribers"',
      '2. Include: prediction accuracy %, audience size, sample content',
      '3. Find contacts on LinkedIn: "sports editor [newspaper]", "digital director [broadcaster]"',
      '4. Email pitch: "We generate AI prediction content for WC 2026 — interested in white-labelling for your audience?"',
      '5. Price: $500-5K/month for content license, $2K-10K one-time for white-label setup',
      '6. Targets: local newspapers (UK, Nigeria, Brazil, Australia), betting comparison sites, radio stations',
    ],
  },

  {
    id: 'google_search_ads',
    name: 'Google Search Ads (ROAS positive)',
    category: 'Paid',
    timeToActivate: '1 hour + $50 budget',
    monthlyMin: 500, monthlyMax: 10000,
    notes: 'Bid on "[Team] prediction" keywords. CPC $0.50-1.20. Convert to $9.99/month subscriber.',
    steps: [
      '1. ads.google.com → Create account → New campaign → Search',
      '2. Keywords: "[team name] prediction", "[team] vs [team] tips", "WC 2026 picks"',
      '3. Bid: $0.50-1.00 max CPC to start',
      '4. Landing page: your match preview pages (already built)',
      '5. Conversion goal: email signup',
      '6. Start with $10/day → pause if no conversions in 100 clicks → adjust landing page',
      '7. At 1% conversion rate: $1 CPC × 100 clicks = $100 for 1 premium subscriber = positive ROAS',
    ],
  },

  {
    id: 'sweepstake_generator',
    name: 'Office sweepstake generator (viral)',
    category: 'Viral',
    timeToActivate: '2 hours',
    monthlyMin: 100, monthlyMax: 3000,
    notes: 'Every workplace in every country is running a sweepstake. Be their tool.',
    steps: [
      '1. Build sweepstake.html (or add to existing pages):',
      '   - Input: number of people in sweep',
      '   - Button: "Generate Random Draw"',
      '   - Output: PDF/printable with each person\'s team assigned randomly',
      '2. Email capture before download: "Enter email to get match updates for your team"',
      '3. Share it to r/worldcup, r/soccer on match day 1',
      '4. LinkedIn post targeting HR/office managers',
      '5. It goes viral on its own — offices share it with colleagues',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  TIER 4: POST-WC / LONG-TERM
  // ══════════════════════════════════════════════════════════════════════

  {
    id: 'lifetime_deal',
    name: 'Lifetime access deal ($149)',
    category: 'One-time',
    timeToActivate: '30 min',
    monthlyMin: 0, monthlyMax: 50000, // one-time surge
    notes: 'Launch at Day 35 — "closes at final whistle". Urgency converts fence-sitters.',
    steps: [
      '1. Create Whop product: Lifetime Access → $149 one-time',
      '2. Email blast Day 35: "Last 3 days at this price — then doubles"',
      '3. Telegram announcement: same',
      '4. Price does double to $299 after WC (for next tournament)',
      '5. At 100 buyers: $14,900 one-time. At 500: $74,500.',
    ],
  },

  {
    id: 'api_product',
    name: 'Prediction API ($99-499/month)',
    category: 'B2B',
    timeToActivate: '1 day',
    monthlyMin: 0, monthlyMax: 20000,
    notes: 'Wrap your AI model. Developers and betting sites will pay for programmatic access.',
    steps: [
      '1. Create API endpoint in Railway: GET /api/v1/prediction?home=Brazil&away=Mexico',
      '2. Returns: {prediction, confidence, score, btts, over25, keyAngle}',
      '3. Create API key system (UUID per customer)',
      '4. Price tiers: $99/month (100 req/day), $299/month (1000 req/day), $499/month (unlimited)',
      '5. List on RapidAPI marketplace for discovery',
      '6. Cold email betting comparison sites (Oddschecker, OddsPortal) with free trial',
    ],
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// CLI INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

function getStatus() {
  const active   = STREAMS.filter(s => isActive(s.id));
  const prereqs  = STREAMS.filter(s => s.isPrerequisite && !isActive(s.id));
  const pending  = STREAMS.filter(s => !s.isPrerequisite && !isActive(s.id));
  const totalMinRev = active.reduce((sum, s) => sum + (s.monthlyMin || 0), 0);
  const totalMaxRev = active.reduce((sum, s) => sum + (s.monthlyMax || 0), 0);
  return { active, prereqs, pending, totalMinRev, totalMaxRev };
}

function printStatus() {
  const { active, prereqs, pending, totalMinRev, totalMaxRev } = getStatus();

  console.log('\n⚡ WC 2026 INTEL — INCOME STREAM STATUS\n');
  console.log(`Active: ${active.length} / ${STREAMS.length} streams`);
  console.log(`Est. monthly revenue: $${totalMinRev.toLocaleString()} – $${totalMaxRev.toLocaleString()}\n`);

  if (prereqs.length) {
    console.log('🔴 PREREQUISITES (do these first):');
    prereqs.forEach(s => console.log(`  [ ] ${s.name} (${s.timeToActivate})`));
    console.log();
  }

  if (active.length) {
    console.log('✅ ACTIVE STREAMS:');
    active.forEach(s => console.log(`  [✓] ${s.name} — $${s.monthlyMin}-${s.monthlyMax}/month`));
    console.log();
  }

  const t1 = pending.filter((_, i) => i < 8);
  console.log('📋 NEXT TO ACTIVATE (sorted by priority):');
  t1.forEach(s => console.log(`  [ ] ${s.name} — $${s.monthlyMin}-${s.monthlyMax}/mo — ${s.timeToActivate}`));
  console.log(`\n  + ${pending.length - t1.length} more. Run: node income-activator.js all\n`);

  console.log('COMMANDS:');
  console.log('  node income-activator.js next        → show next stream to activate + steps');
  console.log('  node income-activator.js show [id]   → show activation steps for one stream');
  console.log('  node income-activator.js activate [id] → mark stream as live');
  console.log('  node income-activator.js revenue     → revenue breakdown from active streams\n');
}

function printNext() {
  const { prereqs, pending } = getStatus();
  const next = prereqs.length ? prereqs[0] : pending[0];
  if (!next) { console.log('🏆 All streams active!'); return; }

  console.log(`\n⚡ NEXT: ${next.name}`);
  console.log(`Time: ${next.timeToActivate} | Revenue: $${next.monthlyMin}-${next.monthlyMax}/month`);
  if (next.notes) console.log(`Note: ${next.notes}`);
  console.log('\nSteps:');
  next.steps.forEach(s => s ? console.log(`  ${s}`) : console.log());
  console.log(`\nWhen done: node income-activator.js activate ${next.id}\n`);
}

function printStream(id) {
  const stream = STREAMS.find(s => s.id === id);
  if (!stream) { console.log(`Stream "${id}" not found. Run: node income-activator.js all`); return; }

  console.log(`\n⚡ ${stream.name} [${isActive(stream.id) ? 'ACTIVE' : 'PENDING'}]`);
  console.log(`Category: ${stream.category} | Time: ${stream.timeToActivate} | Revenue: $${stream.monthlyMin}-${stream.monthlyMax}/month`);
  if (stream.notes) console.log(`Note: ${stream.notes}`);
  console.log('\nActivation steps:');
  stream.steps.forEach(s => s ? console.log(`  ${s}`) : console.log());
  console.log();
}

function printRevenue() {
  const { active, totalMinRev, totalMaxRev } = getStatus();
  console.log('\n💰 REVENUE FROM ACTIVE STREAMS\n');
  active.forEach(s => {
    if (s.monthlyMin > 0) console.log(`  ${s.name}: $${s.monthlyMin}-${s.monthlyMax}/month`);
  });
  console.log(`\n  TOTAL: $${totalMinRev.toLocaleString()} – $${totalMaxRev.toLocaleString()}/month\n`);
}

function printAll() {
  console.log('\n⚡ ALL INCOME STREAMS\n');
  const byCategory = {};
  STREAMS.forEach(s => {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push(s);
  });
  Object.entries(byCategory).forEach(([cat, streams]) => {
    console.log(`\n${cat}:`);
    streams.forEach(s => {
      const status = isActive(s.id) ? '✅' : s.isPrerequisite ? '🔴' : '⬜';
      console.log(`  ${status} ${s.name} — $${s.monthlyMin}-${s.monthlyMax}/mo — ${s.timeToActivate}`);
    });
  });
  console.log();
}

// ── RUN CLI ────────────────────────────────────────────────────────────────────
const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'next':
    printNext();
    break;
  case 'activate':
    if (args[0]) { activate(args[0]); console.log(`✅ Marked as active: ${args[0]}`); printStatus(); }
    else console.log('Usage: node income-activator.js activate [stream-id]');
    break;
  case 'show':
    if (args[0]) printStream(args[0]);
    else console.log('Usage: node income-activator.js show [stream-id]');
    break;
  case 'revenue':
    printRevenue();
    break;
  case 'all':
    printAll();
    break;
  default:
    printStatus();
}

module.exports = { STREAMS, activate, isActive, getStatus };
