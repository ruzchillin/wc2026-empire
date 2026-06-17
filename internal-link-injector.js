/**
 * WC 2026 Sports Empire — Internal Link Injector
 *
 * Problem: 61 HTML pages with ZERO internal links to each other.
 * Google treats isolated pages as low-authority orphans — they rank poorly
 * even for keywords you own. Internal links pass "link juice" across the site,
 * help Google understand your site structure, and keep users on-site longer.
 *
 * What this does:
 *   1. Builds an index of all pages: URL slug → { title, keywords, priority }
 *   2. For each page, finds text mentions of OTHER page topics
 *   3. Wraps first mention of each keyword with an <a href="..."> tag
 *   4. Max 5 internal links per page (more = spammy, Google penalises)
 *   5. Never links a page to itself
 *   6. Never links inside existing <a> tags
 *
 * Usage:
 *   node internal-link-injector.js                    → inject links into ./public/
 *   node internal-link-injector.js --dir ./dist       → custom dir
 *   node internal-link-injector.js --dry-run          → preview changes, don't write
 *   node internal-link-injector.js --report           → show link matrix, exit
 *   node internal-link-injector.js --undo             → restore .backup files
 *
 * Run AFTER page generators (programmatic-seo.js, player-pages-generator.js etc.)
 * and AFTER schema-injector.js
 *
 * Add to build pipeline:
 *   "build-all": "node programmatic-seo.js && ... && node schema-injector.js && node internal-link-injector.js"
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const PUBLIC_DIR = process.argv.includes('--dir')
  ? process.argv[process.argv.indexOf('--dir') + 1]
  : path.join(process.cwd(), 'public');

const DRY_RUN    = process.argv.includes('--dry-run');
const REPORT     = process.argv.includes('--report');
const UNDO       = process.argv.includes('--undo');
const MAX_LINKS_PER_PAGE = 5;

// ─── Page index ───────────────────────────────────────────────────────────────
// Each entry: { slug, url, title, keywords[], priority }
// Keywords = phrases that appear in other pages and should link HERE

const PAGE_INDEX = [
  // Core navigation
  { slug: 'index',              url: '/',                         title: 'WC 2026 Live',             keywords: ['world cup 2026', 'wc 2026', 'wc2026'],                                                         priority: 10 },
  { slug: 'live-scores',        url: '/live-scores',              title: 'Live Scores',               keywords: ['live scores', 'live score', 'real-time scores', 'scores live'],                                priority: 9  },
  { slug: 'group-standings',    url: '/group-standings',          title: 'Group Standings',           keywords: ['group standings', 'group stage', 'group table', 'standings'],                                  priority: 9  },
  { slug: 'bracket',            url: '/bracket',                  title: 'WC 2026 Bracket',           keywords: ['bracket', 'knockout stage', 'knockout rounds', 'tournament bracket'],                          priority: 9  },
  { slug: 'tournament',         url: '/tournament',               title: 'Tournament Overview',       keywords: ['tournament overview', 'tournament schedule', 'wc 2026 schedule'],                              priority: 8  },

  // Prediction / game
  { slug: 'prediction-game',    url: '/prediction-game',          title: 'WC 2026 Prediction Game',  keywords: ['prediction game', 'predict matches', 'make predictions', 'predict scores', 'prediction'],      priority: 8  },
  { slug: 'leaderboard',        url: '/leaderboard',              title: 'Prediction Leaderboard',    keywords: ['leaderboard', 'prediction rankings', 'top predictors', 'who\'s winning the prediction'],       priority: 8  },
  { slug: 'beat-the-ai',        url: '/beat-the-ai',              title: 'Beat the AI',               keywords: ['beat the ai', 'ai predictions', 'vs ai', 'challenge the ai'],                                  priority: 7  },
  { slug: 'what-if-simulator',  url: '/what-if-simulator',        title: 'What If Simulator',         keywords: ['what if', 'what-if simulator', 'alternate history', 'simulate the tournament'],                priority: 6  },
  { slug: 'time-capsule',       url: '/time-capsule',             title: 'WC 2026 Time Capsule',      keywords: ['time capsule', 'record your predictions', 'seal your predictions'],                            priority: 5  },

  // Trackers
  { slug: 'golden-boot-tracker',url: '/golden-boot-tracker',      title: 'Golden Boot Tracker',       keywords: ['golden boot', 'top scorer', 'top scorers', 'goal tally', 'most goals'],                       priority: 8  },
  { slug: 'injury-tracker',     url: '/injury-tracker',           title: 'Injury Tracker',            keywords: ['injury', 'injuries', 'player injury', 'fitness update', 'doubt', 'doubtful'],                  priority: 7  },
  { slug: 'squad-tracker',      url: '/squad-tracker',            title: 'Squad Tracker',             keywords: ['squad', 'squad list', 'squad announcement', 'team squad', '26-man squad'],                     priority: 7  },
  { slug: 'var-tracker',        url: '/var-tracker',              title: 'VAR Tracker',               keywords: ['var', 'var review', 'video assistant referee', 'var decision', 'var controversy'],             priority: 6  },
  { slug: 'panini-tracker',     url: '/panini-tracker',           title: 'Panini Sticker Tracker',    keywords: ['panini', 'sticker album', 'panini stickers', 'swap stickers'],                                 priority: 5  },

  // Viewing / streaming
  { slug: 'watch-guide',        url: '/watch-guide',              title: 'How to Watch WC 2026',      keywords: ['how to watch', 'watch wc 2026', 'stream wc 2026', 'tv schedule', 'broadcast'],                 priority: 8  },
  { slug: 'streaming-guide',    url: '/streaming-guide',          title: 'WC 2026 Streaming Guide',   keywords: ['streaming guide', 'stream for free', 'free streaming', 'watch online', 'vpn'],                 priority: 8  },
  { slug: 'watch-party-calculator', url: '/watch-party-calculator', title: 'Watch Party Calculator',  keywords: ['watch party', 'how many people', 'watch party costs', 'hosting a watch party'],               priority: 6  },
  { slug: 'second-screen-app',  url: '/second-screen-app',        title: 'Second Screen Experience',  keywords: ['second screen', 'second-screen', 'phone while watching', 'stats while you watch'],            priority: 5  },
  { slug: 'noise-meter',        url: '/noise-meter',              title: 'Stadium Noise Meter',       keywords: ['stadium noise', 'atmosphere', 'crowd noise', 'loudest fans'],                                  priority: 4  },

  // Country-specific
  { slug: 'soccerforamericans', url: '/soccerforamericans',       title: 'Soccer for Americans',      keywords: ['soccer for americans', 'american guide', 'guide for americans', 'how does soccer work'],       priority: 7  },
  { slug: 'wc2026espanol',      url: '/wc2026espanol',            title: 'WC 2026 en Español',        keywords: ['en español', 'copa del mundo', 'selección'],                                                   priority: 6  },
  { slug: 'india-wc2026-hindi', url: '/india-wc2026-hindi',       title: 'विश्व कप 2026',              keywords: ['india', 'hindi', 'भारत'],                                                                      priority: 6  },
  { slug: 'nigeria-supereagles',url: '/nigeria-supereagles',      title: 'Nigeria Super Eagles WC 2026', keywords: ['nigeria', 'super eagles', 'nigerian'],                                                     priority: 6  },
  { slug: 'indonesia-wc2026',   url: '/indonesia-wc2026',         title: 'Indonesia WC 2026',         keywords: ['indonesia', 'garuda'],                                                                         priority: 5  },

  // Tools
  { slug: 'odds-comparison',    url: '/odds-comparison',          title: 'Odds Comparison',           keywords: ['odds comparison', 'compare odds', 'best odds', 'betting odds'],                                priority: 7  },
  { slug: 'odds-tool',          url: '/odds-tool',                title: 'Odds Calculator',           keywords: ['odds calculator', 'calculate odds', 'implied probability', 'odds to probability'],            priority: 6  },
  { slug: 'arb-scanner',        url: '/arb-scanner',              title: 'Arbitrage Scanner',         keywords: ['arbitrage', 'arb', 'sure bet', 'risk-free bet', 'arbing'],                                    priority: 6  },
  { slug: 'cashout-calculator', url: '/cashout-calculator',       title: 'Cash Out Calculator',       keywords: ['cash out', 'cashout', 'early cashout', 'cash out value'],                                     priority: 6  },
  { slug: 'micro-betting',      url: '/micro-betting',            title: 'Micro Betting Guide',       keywords: ['micro betting', 'in-play betting', 'live betting', 'bet in-play'],                            priority: 6  },
  { slug: 'same-game-parlay',   url: '/same-game-parlay',         title: 'Same Game Parlay',          keywords: ['same game parlay', 'sgp', 'parlay', 'accumulator'],                                           priority: 6  },
  { slug: 'emotional-hedge',    url: '/emotional-hedge',          title: 'Emotional Hedge Calculator', keywords: ['emotional hedge', 'hedge bet', 'hedging', 'hedge your bet'],                                 priority: 5  },
  { slug: 'freebets2026',       url: '/freebets2026',             title: 'Free Bets WC 2026',         keywords: ['free bets', 'free bet', 'sign-up offer', 'welcome bonus', 'matched betting'],                 priority: 7  },
  { slug: 'wc2026-tax-calculator', url: '/wc2026-tax-calculator', title: 'Betting Tax Calculator',    keywords: ['tax on winnings', 'betting tax', 'gambling tax', 'tax calculator'],                           priority: 5  },
  { slug: 'pnl-tracker',        url: '/pnl-tracker',              title: 'P&L Tracker',               keywords: ['profit and loss', 'pnl', 'track your bets', 'betting tracker', 'bankroll tracker'],          priority: 6  },

  // Social / community
  { slug: 'office-pool',        url: '/office-pool',              title: 'Office Pool Generator',     keywords: ['office pool', 'workplace sweepstake', 'office sweepstake', 'work competition'],               priority: 7  },
  { slug: 'head-to-head',       url: '/head-to-head',             title: 'Head to Head',              keywords: ['head to head', 'h2h', 'head-to-head', 'vs history', 'historical results'],                   priority: 7  },
  { slug: 'viral-quiz',         url: '/viral-quiz',               title: 'WC 2026 Quiz',              keywords: ['quiz', 'football quiz', 'world cup quiz', 'test your knowledge'],                            priority: 6  },
  { slug: 'pub-quiz-generator', url: '/pub-quiz-generator',       title: 'Pub Quiz Generator',        keywords: ['pub quiz', 'quiz night', 'trivia night', 'quiz questions'],                                   priority: 5  },
  { slug: 'drinking-game',      url: '/drinking-game',            title: 'WC 2026 Drinking Game',     keywords: ['drinking game', 'drink every time', 'watch party drinking'],                                  priority: 5  },
  { slug: 'footballer-lookalike', url: '/footballer-lookalike',   title: 'Footballer Lookalike',      keywords: ['lookalike', 'who do you look like', 'footballer twin', 'doppelganger'],                      priority: 4  },

  // B2B / business
  { slug: 'b2b-hub',            url: '/b2b-hub',                  title: 'B2B Partnerships',          keywords: ['b2b', 'business partnership', 'white label', 'partner with us', 'brand partnership'],        priority: 6  },
  { slug: 'bar-intelligence',   url: '/bar-intelligence',         title: 'Bar & Venue Intelligence',  keywords: ['bar', 'pub', 'venue', 'bar owners', 'pubs showing'],                                         priority: 5  },
  { slug: 'merch-store',        url: '/merch-store',              title: 'WC 2026 Merch Store',       keywords: ['merch', 'merchandise', 'shop', 'buy', 't-shirt', 'jersey'],                                  priority: 6  },
  { slug: 'card-generator',     url: '/card-generator',           title: 'WC 2026 Card Generator',    keywords: ['card generator', 'custom card', 'player card', 'create a card'],                             priority: 5  },
  { slug: 'win-share',          url: '/win-share',                title: 'Win Share Stats',           keywords: ['win share', 'contribution stats', 'player contribution', 'statistics'],                      priority: 5  },
  { slug: 'football-iq',        url: '/football-iq',              title: 'Football IQ Test',          keywords: ['football iq', 'football knowledge', 'soccer iq', 'how much do you know'],                   priority: 5  },
  { slug: 'armchair-manager',   url: '/armchair-manager',         title: 'Armchair Manager',          keywords: ['armchair manager', 'pick your team', 'starting xi', 'starting lineup', 'team selection'],    priority: 6  },
  { slug: 'elimination-memorial', url: '/elimination-memorial',   title: 'Elimination Memorial Wall', keywords: ['elimination', 'eliminated', 'knocked out', 'memorial wall'],                                 priority: 5  },

  // Travel / fan experience
  { slug: 'wc2026-city-guides', url: '/wc2026-city-guides',       title: 'WC 2026 City Guides',       keywords: ['city guide', 'travel guide', 'visiting', 'host city', 'dallas', 'miami', 'new york', 'la', 'los angeles', 'chicago', 'houston', 'seattle', 'boston', 'kansas city', 'san francisco', 'guadalajara', 'mexico city', 'monterrey', 'toronto', 'vancouver'], priority: 7 },
  { slug: 'wc2026-fan-zones',   url: '/wc2026-fan-zones',         title: 'Fan Zones',                 keywords: ['fan zone', 'fan fest', 'public viewing', 'fan village'],                                     priority: 6  },
  { slug: 'streaming-guide',    url: '/streaming-guide',          title: 'VPN & Streaming Guide',     keywords: ['vpn', 'vpn guide', 'use a vpn', 'watch from abroad', 'geo-blocked'],                        priority: 7  },

  // Other sports (AdSense/diversification)
  { slug: 'cricket-india',      url: '/cricket-india',            title: 'Cricket & India WC 2026',   keywords: ['cricket', 'ipl', 'test cricket'],                                                            priority: 4  },
  { slug: 'womens-sports-hub',  url: '/womens-sports-hub',        title: 'Women\'s Sports Hub',       keywords: ['women\'s football', 'women\'s world cup', 'wwc', 'lionesses'],                              priority: 5  },
  { slug: 'greyhounds',         url: '/greyhounds',               title: 'Greyhound Racing',          keywords: ['greyhound', 'greyhound racing', 'dog racing'],                                               priority: 3  },
  { slug: 'horse-racing',       url: '/horse-racing',             title: 'Horse Racing Tips',         keywords: ['horse racing', 'horse race', 'racing tips', 'horse tips'],                                   priority: 3  },
  { slug: 'nfl-picks',          url: '/nfl-picks',                title: 'NFL Picks',                 keywords: ['nfl', 'american football picks', 'nfl predictions'],                                         priority: 3  },

  // ─── Star Player Pages (added Task #121) ─────────────────────────────────
  { slug: 'star-players',       url: '/star-players',             title: 'WC 2026 Star Players',      keywords: ['star players', 'best players wc 2026', 'world cup stars', 'wc 2026 players', 'top players'],                                  priority: 9  },
  { slug: 'mbappe-wc2026',      url: '/mbappe-wc2026',            title: 'Mbappé WC 2026',            keywords: ['mbappé', 'mbappe', 'kylian mbappe', 'kylian mbappé', 'mbappé golden boot', 'france wc 2026', 'france captain'],               priority: 9  },
  { slug: 'messi-wc2026',       url: '/messi-wc2026',             title: 'Messi WC 2026',             keywords: ['messi', 'lionel messi', 'messi last dance', 'argentina captain', 'goat', 'messi 2026', 'messi world cup'],                     priority: 9  },
  { slug: 'ronaldo-wc2026',     url: '/ronaldo-wc2026',           title: 'Ronaldo WC 2026',           keywords: ['ronaldo', 'cristiano ronaldo', 'cr7', 'portugal captain', 'ronaldo 2026', 'ronaldo final world cup'],                          priority: 9  },
  { slug: 'yamal-wc2026',       url: '/yamal-wc2026',             title: 'Yamal WC 2026',             keywords: ['yamal', 'lamine yamal', 'spain winger', 'yamal 2026', 'yamal world cup', 'barcelona winger', 'youngest wc player'],            priority: 8  },
  { slug: 'haaland-wc2026',     url: '/haaland-wc2026',           title: 'Haaland WC 2026',           keywords: ['haaland', 'erling haaland', 'norway wc 2026', 'haaland golden boot', 'norwegian striker', 'haaland world cup'],               priority: 8  },
  { slug: 'vinicius-wc2026',    url: '/vinicius-wc2026',          title: 'Vinícius Jr WC 2026',       keywords: ['vinícius', 'vinicius', 'vini jr', 'vinicius jr', 'brazil winger', 'brazil hexa', 'vinicius world cup', 'ballon d\'or'],        priority: 8  },
  { slug: 'bellingham-wc2026',  url: '/bellingham-wc2026',        title: 'Bellingham WC 2026',        keywords: ['bellingham', 'jude bellingham', 'england captain', 'bellingham wc 2026', 'england world cup', 'real madrid england'],          priority: 8  },

  // ─── Player Pages (Wave 2 — Task 124) ─────────────────────────────────────
  { slug: 'kane-wc2026',         url: '/kane-wc2026',              title: 'Harry Kane WC 2026',        keywords: ['kane', 'harry kane', 'england striker', 'three lions captain', 'kane golden boot', 'kane world cup 2026'],                         priority: 8  },
  { slug: 'son-wc2026',          url: '/son-wc2026',               title: 'Son Heung-min WC 2026',     keywords: ['son', 'son heung-min', 'south korea captain', 'korean football', 'son world cup', 'tottenham wc'],                                priority: 8  },
  { slug: 'salah-wc2026',        url: '/salah-wc2026',             title: 'Mohamed Salah WC 2026',     keywords: ['salah', 'mohamed salah', 'egypt world cup', 'mo salah', 'liverpool egypt', 'salah first world cup'],                               priority: 8  },
  { slug: 'musiala-wc2026',      url: '/musiala-wc2026',           title: 'Jamal Musiala WC 2026',     keywords: ['musiala', 'jamal musiala', 'germany wc 2026', 'germany midfielder', 'bayern germany', 'musiala golden boot'],                     priority: 8  },
  { slug: 'wirtz-wc2026',        url: '/wirtz-wc2026',             title: 'Florian Wirtz WC 2026',     keywords: ['wirtz', 'florian wirtz', 'germany playmaker', 'leverkusen wc', 'wirtz golden boot', 'germany best player'],                       priority: 8  },
  { slug: 'saka-wc2026',         url: '/saka-wc2026',              title: 'Bukayo Saka WC 2026',       keywords: ['saka', 'bukayo saka', 'arsenal england', 'england winger', 'saka world cup', 'three lions winger'],                               priority: 8  },
  { slug: 'pedri-wc2026',        url: '/pedri-wc2026',             title: 'Pedri WC 2026',             keywords: ['pedri', 'pedri gonzalez', 'spain midfielder', 'barcelona spain', 'pedri wc 2026', 'spain best player'],                           priority: 8  },
  { slug: 'osimhen-wc2026',      url: '/osimhen-wc2026',           title: 'Victor Osimhen WC 2026',    keywords: ['osimhen', 'victor osimhen', 'nigeria striker', 'super eagles', 'africa striker wc', 'osimhen golden boot'],                       priority: 7  },
  { slug: 'hakimi-wc2026',       url: '/hakimi-wc2026',            title: 'Achraf Hakimi WC 2026',     keywords: ['hakimi', 'achraf hakimi', 'morocco fullback', 'psg morocco', 'mena wc 2026', 'morocco wc 2026 players'],                          priority: 7  },
  { slug: 'lewandowski-wc2026',  url: '/lewandowski-wc2026',       title: 'Lewandowski WC 2026',       keywords: ['lewandowski', 'robert lewandowski', 'poland striker', 'lewy world cup', 'poland wc 2026', 'lewandowski final world cup'],         priority: 7  },

  // ─── Rivalry Pages (high virality) ───────────────────────────────────────
  { slug: 'messi-vs-ronaldo',    url: '/messi-vs-ronaldo',         title: 'Messi vs Ronaldo WC 2026',  keywords: ['messi vs ronaldo', 'goat debate', 'who is better messi or ronaldo', 'messi ronaldo 2026', 'messi or ronaldo world cup'],          priority: 10 },
  { slug: 'mbappe-vs-haaland',   url: '/mbappe-vs-haaland',        title: 'Mbappé vs Haaland',         keywords: ['mbappe vs haaland', 'haaland vs mbappe', 'next generation goat', 'best young player world cup', 'mbappe haaland golden boot'],  priority: 10 },

  // ─── Position Hub Pages ───────────────────────────────────────────────────
  { slug: 'golden-boot-contenders', url: '/golden-boot-contenders', title: 'WC 2026 Golden Boot Contenders', keywords: ['golden boot contenders', 'wc 2026 top scorers', 'world cup 2026 strikers', 'golden boot prediction', 'who wins golden boot'], priority: 9 },
  { slug: 'midfielders-wc2026',  url: '/midfielders-wc2026',       title: 'Best Midfielders WC 2026',  keywords: ['best midfielders world cup 2026', 'wc 2026 midfielders', 'de bruyne world cup', 'best wc midfielder'],                            priority: 8  },
  { slug: 'defenders-wc2026',    url: '/defenders-wc2026',         title: 'Best Defenders WC 2026',    keywords: ['best defenders world cup 2026', 'wc 2026 defenders', 'van dijk world cup', 'hakimi world cup', 'clean sheet bets'],               priority: 8  },

  // ─── New Country Pages (Task 126) ─────────────────────────────────────────
  { slug: 'england-wc2026',      url: '/england-wc2026',           title: 'England WC 2026',           keywords: ['england world cup 2026', 'three lions wc 2026', 'england squad 2026', 'england odds wc', 'england prediction'],                   priority: 9  },
  { slug: 'italy-wc2026',        url: '/italy-wc2026',             title: 'Italia WC 2026',            keywords: ['italy world cup 2026', 'italia mondiale 2026', 'azzurri 2026', 'italy squad wc 2026', 'italy odds'],                             priority: 8  },
  { slug: 'portugal-wc2026',     url: '/portugal-wc2026',          title: 'Portugal WC 2026',          keywords: ['portugal world cup 2026', 'portugal mondiale 2026', 'ronaldo portugal', 'seleccao 2026', 'portugal odds'],                       priority: 8  },
  { slug: 'mexico-wc2026',       url: '/mexico-wc2026',            title: 'México WC 2026',            keywords: ['mexico world cup 2026', 'el tri mundial 2026', 'mexico host nation', 'azteca mundial', 'mexico cuotas'],                         priority: 8  },
  { slug: 'poland-wc2026',       url: '/poland-wc2026',            title: 'Polska WC 2026',            keywords: ['poland world cup 2026', 'polska mundial 2026', 'poland squad', 'lewandowski poland', 'polska kursy'],                            priority: 7  },
  { slug: 'belgium-wc2026',      url: '/belgium-wc2026',           title: 'Belgium WC 2026',           keywords: ['belgium world cup 2026', 'red devils wc 2026', 'de bruyne belgium', 'belgium squad 2026', 'belgium odds'],                      priority: 7  },

  // ─── Player Pages (Wave 3 — Task 127/128) ─────────────────────────────────
  { slug: 'gakpo-wc2026',        url: '/gakpo-wc2026',             title: 'Cody Gakpo WC 2026',        keywords: ['gakpo', 'cody gakpo', 'netherlands striker', 'dutch striker', 'gakpo world cup', 'liverpool netherlands'],                        priority: 8  },
  { slug: 'de-bruyne-wc2026',    url: '/de-bruyne-wc2026',         title: 'Kevin De Bruyne WC 2026',   keywords: ['de bruyne', 'kevin de bruyne', 'kdb world cup', 'belgium captain', 'de bruyne final world cup', 'best midfielder world cup'],     priority: 9  },
  { slug: 'valverde-wc2026',     url: '/valverde-wc2026',          title: 'Federico Valverde WC 2026', keywords: ['valverde', 'federico valverde', 'uruguay midfielder', 'real madrid uruguay', 'valverde world cup', 'uruguay best player'],         priority: 7  },
  { slug: 'griezmann-wc2026',    url: '/griezmann-wc2026',         title: 'Griezmann WC 2026',         keywords: ['griezmann', 'antoine griezmann', 'france veteran', 'atletico madrid france', 'griezmann world cup 2026', 'france squad'],          priority: 7  },

  // ─── Position Hub (Wave 2) ─────────────────────────────────────────────────
  { slug: 'goalkeepers-wc2026',  url: '/goalkeepers-wc2026',       title: 'Best Goalkeepers WC 2026',  keywords: ['best goalkeepers world cup 2026', 'golden glove 2026', 'wc 2026 goalkeepers', 'courtois world cup', 'alisson world cup'],          priority: 8  },

  // ─── Match Pages (auto-generated by match-pages-generator.js) ────────────
  // Individual match pages live at /matches/[slug].html
  // They are auto-scanned by sitemap-generator.js and schema-injector.js
  // Below is a sample of key fixtures for internal link injection:
  { slug: 'wc-2026-final',      url: '/matches/wc-2026-final',   title: 'WC 2026 Final',             keywords: ['wc 2026 final', 'world cup final 2026', 'final match', 'wc final'],                                                            priority: 10 },
  { slug: 'wc2026-semifinal-1', url: '/matches/semi-final-1',    title: 'WC 2026 Semi-Final 1',      keywords: ['semi final 2026', 'wc semi final', 'semifinal world cup'],                                                                      priority: 9  },
  { slug: 'wc2026-semifinal-2', url: '/matches/semi-final-2',    title: 'WC 2026 Semi-Final 2',      keywords: ['second semi final', 'sf2 wc 2026'],                                                                                            priority: 9  },

  // ─── New Country / Streaming Pages (added Tasks #118-119) ────────────────
  { slug: 'streaming-vpn',      url: '/streaming-vpn',           title: 'WC 2026 Streaming & VPN Guide', keywords: ['streaming vpn', 'watch wc 2026 vpn', 'vpn world cup', 'nordvpn world cup', 'expressvpn football', 'how to watch from abroad', 'watch wc 2026 free'], priority: 8 },
  { slug: 'world-hub',          url: '/world-hub',               title: 'WC 2026 World Hub',         keywords: ['world hub', 'world cup by country', 'every country world cup', 'wc 2026 all countries'],                                       priority: 8  },
  { slug: 'traffic-command',    url: '/traffic-command',         title: 'Traffic Strategy',           keywords: ['traffic strategy', 'seo traffic', 'social media traffic'],                                                                     priority: 5  },
  { slug: 'usa-wc2026',         url: '/usa-wc2026',              title: 'USA WC 2026 Hub',            keywords: ['usa world cup 2026', 'united states wc 2026', 'usmnt', 'american soccer 2026'],                                               priority: 7  },
  { slug: 'brazil-wc2026',      url: '/brazil-wc2026',           title: 'Brazil WC 2026 Hub',         keywords: ['brazil world cup 2026', 'brasil copa 2026', 'seleção 2026', 'hexa'],                                                         priority: 7  },
  { slug: 'germany-wc2026',     url: '/germany-wc2026',          title: 'Germany WC 2026 Hub',        keywords: ['germany world cup 2026', 'deutschland wm 2026', 'german national team'],                                                      priority: 7  },
  { slug: 'france-wc2026',      url: '/france-wc2026',           title: 'France WC 2026 Hub',         keywords: ['france world cup 2026', 'les bleus 2026', 'equipe de france'],                                                               priority: 7  },
  { slug: 'spain-wc2026',       url: '/spain-wc2026',            title: 'Spain WC 2026 Hub',          keywords: ['spain world cup 2026', 'españa copa del mundo', 'la roja 2026'],                                                             priority: 7  },
  { slug: 'netherlands-wc2026', url: '/netherlands-wc2026',      title: 'Netherlands WC 2026 Hub',    keywords: ['netherlands world cup', 'oranje 2026', 'dutch world cup', 'holland 2026'],                                                   priority: 7  },
  { slug: 'australia-wc2026',   url: '/australia-wc2026',        title: 'Australia WC 2026 Hub',      keywords: ['australia world cup 2026', 'socceroos 2026', 'australian soccer'],                                                           priority: 6  },

  // ─── Wave 4: Rivalry + New Country Pages ──────────────────────────────────
  { slug: 'mbappe-vs-messi',    url: '/mbappe-vs-messi',        title: 'Mbappé vs Messi — WC 2026',  keywords: ['mbappe vs messi', 'messi vs mbappe', '2022 final rematch', 'france argentina 2026', 'mbappe messi rivalry'],   priority: 10 },
  { slug: 'croatia-wc2026',     url: '/croatia-wc2026',          title: 'Croatia WC 2026',            keywords: ['croatia world cup 2026', 'modric croatia', 'vatreni 2026', 'croatia dark horse', 'croatia wc odds'],            priority: 7  },
  { slug: 'nigeria-wc2026',     url: '/nigeria-wc2026',          title: 'Nigeria WC 2026',            keywords: ['nigeria world cup 2026', 'super eagles 2026', 'osimhen nigeria', 'lookman nigeria'],                            priority: 7  },
  { slug: 'uruguay-wc2026',     url: '/uruguay-wc2026',          title: 'Uruguay WC 2026',            keywords: ['uruguay world cup 2026', 'la celeste 2026', 'valverde uruguay', 'nunez uruguay'],                               priority: 7  },

  // ─── Wave 4: Continental Hubs ─────────────────────────────────────────────
  { slug: 'africa-wc2026',      url: '/africa-wc2026',           title: 'Africa at WC 2026',          keywords: ['africa world cup 2026', 'african teams wc 2026', 'morocco nigeria senegal', 'african nations 2026'],            priority: 9  },
  { slug: 'asia-wc2026',        url: '/asia-wc2026',             title: 'Asia at WC 2026',            keywords: ['asia world cup 2026', 'asian teams wc 2026', 'japan south korea saudi', 'asian nations 2026'],                 priority: 9  },
  { slug: 'south-america-wc2026', url: '/south-america-wc2026',  title: 'South America at WC 2026',   keywords: ['south america world cup 2026', 'conmebol 2026', 'brazil argentina uruguay', 'latin america wc'],               priority: 9  },

  // ─── Wave 4: Special Content Pages ───────────────────────────────────────
  { slug: 'dark-horses-wc2026',      url: '/dark-horses-wc2026',      title: 'WC 2026 Dark Horses',     keywords: ['dark horse world cup 2026', 'wc 2026 longshots', 'best long shot bets', 'underdog world cup 2026'],            priority: 9  },
  { slug: 'wc2026-outright-winner',  url: '/wc2026-outright-winner',  title: 'WC 2026 Outright Winner', keywords: ['who will win world cup 2026', 'wc 2026 outright', 'world cup 2026 winner', 'outright world cup bet'],         priority: 9  },
  { slug: 'wc2026-acca-guide',       url: '/wc2026-acca-guide',       title: 'WC 2026 Acca Guide',      keywords: ['accumulator world cup 2026', 'football accumulator guide', 'build an acca', 'best accas world cup'],          priority: 8  },

  // ─── Wave 4: Young Stars Hub + Player Pages ───────────────────────────────
  { slug: 'young-stars-wc2026', url: '/young-stars-wc2026',      title: 'Young Stars WC 2026',        keywords: ['young stars world cup 2026', 'next generation wc 2026', 'best young players 2026', 'young player award 2026'], priority: 8  },
  { slug: 'endrick-wc2026',     url: '/endrick-wc2026',           title: 'Endrick WC 2026',            keywords: ['endrick', 'endrick world cup', 'brazil teenager world cup', 'real madrid endrick'],                            priority: 8  },
  { slug: 'modric-wc2026',      url: '/modric-wc2026',            title: 'Modrić WC 2026',             keywords: ['modric', 'luka modric', 'modric final world cup', 'croatia captain 2026', 'golden ball 2018'],                priority: 8  },
  { slug: 'foden-wc2026',       url: '/foden-wc2026',             title: 'Phil Foden WC 2026',         keywords: ['foden', 'phil foden', 'foden world cup', 'england man city wc', 'pfa player of the year england'],             priority: 8  },
  { slug: 'nico-williams-wc2026', url: '/nico-williams-wc2026',   title: 'Nico Williams WC 2026',      keywords: ['nico williams', 'nico williams world cup', 'spain winger 2026', 'athletic bilbao spain'],                     priority: 8  },
  { slug: 'england-wc2026',        title: 'England WC 2026',                  keywords: ['england', 'kane', 'bellingham', 'saka', 'foden', 'southgate'],              priority: 9  },
  { slug: 'italy-wc2026',          title: 'Italy WC 2026',                    keywords: ['italy', 'azzurri', 'chiesa', 'barella', 'donnarumma'],                  priority: 7  },
  { slug: 'mexico-wc2026',         title: 'Mexico WC 2026',                   keywords: ['mexico', 'el tri', 'jimenez', 'lozano', 'pulido'],                      priority: 8  },
  { slug: 'poland-wc2026',         title: 'Poland WC 2026',                   keywords: ['poland', 'lewandowski', 'polska', 'szymanski'],                         priority: 7  },
  { slug: 'portugal-wc2026',       title: 'Portugal WC 2026',                 keywords: ['portugal', 'ronaldo', 'felix', 'leao', 'fernandes'],                    priority: 9  },
  { slug: 'messi-vs-ronaldo',      title: 'Messi vs Ronaldo WC 2026',         keywords: ['messi', 'ronaldo', 'goat', 'rivalry', 'argentina', 'portugal'],         priority: 10 },
  { slug: 'mbappe-vs-haaland',     title: 'Mbappé vs Haaland WC 2026',        keywords: ['mbappe', 'haaland', 'norway', 'france', 'rivalry', 'top scorer'],      priority: 10 },
  { slug: 'kane-wc2026',           title: 'Harry Kane WC 2026',               keywords: ['kane', 'harry kane', 'england', 'top scorer', 'golden boot'],           priority: 9  },
  { slug: 'salah-wc2026',          title: 'Mohamed Salah WC 2026',            keywords: ['salah', 'egypt', 'liverpool', 'golden boot', 'africa'],                  priority: 9  },
  { slug: 'saka-wc2026',           title: 'Bukayo Saka WC 2026',              keywords: ['saka', 'arsenal', 'england', 'winger', 'top scorer'],                   priority: 8  },
  { slug: 'musiala-wc2026',        title: 'Jamal Musiala WC 2026',            keywords: ['musiala', 'germany', 'bayern', 'young player'],                         priority: 8  },
  { slug: 'wirtz-wc2026',          title: 'Florian Wirtz WC 2026',            keywords: ['wirtz', 'germany', 'leverkusen', 'young star'],                         priority: 8  },
  { slug: 'pedri-wc2026',          title: 'Pedri WC 2026',                    keywords: ['pedri', 'spain', 'barcelona', 'midfielder'],                            priority: 8  },
  { slug: 'osimhen-wc2026',        title: 'Victor Osimhen WC 2026',           keywords: ['osimhen', 'nigeria', 'striker', 'golden boot', 'africa'],               priority: 8  },
  { slug: 'hakimi-wc2026',         title: 'Achraf Hakimi WC 2026',            keywords: ['hakimi', 'morocco', 'psg', 'wingback'],                                 priority: 8  },
  { slug: 'lewandowski-wc2026',    title: 'Robert Lewandowski WC 2026',       keywords: ['lewandowski', 'poland', 'barcelona', 'striker'],                        priority: 8  },
  { slug: 'son-wc2026',            title: 'Son Heung-min WC 2026',            keywords: ['son', 'korea', 'tottenham', 'asia', 'striker'],                         priority: 8  },
  { slug: 'wc2026-schedule',       title: 'WC 2026 Schedule & Fixtures',      keywords: ['schedule', 'fixtures', 'dates', 'matches', 'kickoff', 'when'],          priority: 10 },
  { slug: 'value-bets-wc2026',     title: 'WC 2026 Value Bets',               keywords: ['value bet', 'edge', 'ai probability', 'overpriced', 'underpriced'],    priority: 9  },
  { slug: 'wc2026-golden-boot-predictions', title: 'WC 2026 Golden Boot Predictions', keywords: ['golden boot', 'top scorer', 'goals', 'mbappe', 'yamal', 'kane'], priority: 10 },
  { slug: 'each-way-guide',        title: 'Each Way Betting Guide',           keywords: ['each way', 'ew', 'place', 'each-way', 'dark horse bet'],                priority: 8  },
];

// ─── HTML parser / modifier ───────────────────────────────────────────────────

/**
 * Simple regex-based internal link injector.
 * We avoid cheerio/jsdom for zero-dependency operation.
 *
 * Approach:
 *   - Extract all <main>, <article>, <section>, or <body> content
 *   - Find text nodes (not inside <a>, <h1-6>, <script>, <style>, <code>)
 *   - Replace first occurrence of each keyword with <a href="..."> link
 *   - Respect MAX_LINKS_PER_PAGE limit
 */

function injectLinks(html, currentSlug, pageIndex) {
  // Don't inject into <head>, <script>, <style>, existing <a> tags, headings
  // Strategy: process only the main content area

  // Get candidate pages (not the current page)
  const candidates = pageIndex
    .filter(p => p.slug !== currentSlug)
    .sort((a, b) => b.priority - a.priority);

  let linksAdded   = 0;
  let modifiedHtml = html;

  for (const candidate of candidates) {
    if (linksAdded >= MAX_LINKS_PER_PAGE) break;

    for (const keyword of candidate.keywords) {
      if (linksAdded >= MAX_LINKS_PER_PAGE) break;

      // Skip very short keywords (< 4 chars) to avoid false positives
      if (keyword.length < 4) continue;

      // Build a regex that:
      // - matches the keyword (case insensitive)
      // - is a whole word/phrase
      // - is NOT inside an HTML tag attribute (href="...", alt="...", etc.)
      // - is NOT inside <a>...</a> blocks
      // - is NOT inside <h1-6>...</h1-6> blocks
      // - is NOT inside <script>|<style>|<code> blocks
      // - only matches FIRST occurrence

      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordRegex = new RegExp(`(?<![a-zA-Z0-9-])(${escaped})(?![a-zA-Z0-9-])`, 'i');

      // Temporarily mask protected zones so we don't link inside them
      let masked = modifiedHtml;

      // Mask <script>...</script>
      const scriptMask = [];
      masked = masked.replace(/<script[\s\S]*?<\/script>/gi, (m) => {
        scriptMask.push(m);
        return `\x00SCRIPT${scriptMask.length - 1}\x00`;
      });

      // Mask <style>...</style>
      const styleMask = [];
      masked = masked.replace(/<style[\s\S]*?<\/style>/gi, (m) => {
        styleMask.push(m);
        return `\x00STYLE${styleMask.length - 1}\x00`;
      });

      // Mask <a>...</a>
      const aMask = [];
      masked = masked.replace(/<a[\s\S]*?<\/a>/gi, (m) => {
        aMask.push(m);
        return `\x00ATAG${aMask.length - 1}\x00`;
      });

      // Mask <h1>...<h6>
      const hMask = [];
      masked = masked.replace(/<h[1-6][\s\S]*?<\/h[1-6]>/gi, (m) => {
        hMask.push(m);
        return `\x00HTAG${hMask.length - 1}\x00`;
      });

      // Mask HTML tags themselves (we only want to match visible text)
      const tagMask = [];
      masked = masked.replace(/<[^>]+>/g, (m) => {
        tagMask.push(m);
        return `\x00TAG${tagMask.length - 1}\x00`;
      });

      // Now try to match keyword in visible text
      if (wordRegex.test(masked)) {
        // Replace first match
        masked = masked.replace(wordRegex, (match) => {
          return `<a href="${candidate.url}" title="${candidate.title}">${match}</a>`;
        });
        linksAdded++;
      } else {
        // No match — restore and continue
        masked = restoreMasks(masked, scriptMask, styleMask, aMask, hMask, tagMask);
        modifiedHtml = masked;
        continue;
      }

      // Restore all masked zones
      masked = restoreMasks(masked, scriptMask, styleMask, aMask, hMask, tagMask);
      modifiedHtml = masked;
      break; // Move to next candidate (one keyword per page is enough)
    }
  }

  return { html: modifiedHtml, linksAdded };
}

function restoreMasks(html, scriptMask, styleMask, aMask, hMask, tagMask) {
  // Restore in reverse order of masking to handle nesting correctly
  html = html.replace(/\x00TAG(\d+)\x00/g, (_, i) => tagMask[i] || '');
  html = html.replace(/\x00HTAG(\d+)\x00/g, (_, i) => hMask[i] || '');
  html = html.replace(/\x00ATAG(\d+)\x00/g, (_, i) => aMask[i] || '');
  html = html.replace(/\x00STYLE(\d+)\x00/g, (_, i) => styleMask[i] || '');
  html = html.replace(/\x00SCRIPT(\d+)\x00/g, (_, i) => scriptMask[i] || '');
  return html;
}

// ─── File operations ──────────────────────────────────────────────────────────

function scanHtmlFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      scanHtmlFiles(fullPath).forEach(f => results.push(f));
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

function fileToSlug(filePath) {
  return path.basename(filePath, '.html').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

// ─── Undo mode ────────────────────────────────────────────────────────────────

function undo(dir) {
  const files = scanHtmlFiles(dir).filter(f => f.endsWith('.html.backup'));
  if (files.length === 0) { console.log('[InternalLinks] No .backup files found'); return; }
  for (const backup of files) {
    const original = backup.replace('.backup', '');
    fs.copyFileSync(backup, original);
    fs.unlinkSync(backup);
    console.log(`[InternalLinks] Restored: ${path.basename(original)}`);
  }
  console.log(`[InternalLinks] Restored ${files.length} files`);
}

// ─── Report mode ─────────────────────────────────────────────────────────────

function report(dir) {
  console.log('\n=== WC 2026 Internal Link Opportunity Report ===\n');
  const files = scanHtmlFiles(dir);
  for (const file of files.slice(0, 30)) {
    const slug    = fileToSlug(file);
    const html    = fs.readFileSync(file, 'utf8');
    const { linksAdded } = injectLinks(html, slug, PAGE_INDEX);
    console.log(`  ${path.basename(file).padEnd(40)} +${linksAdded} internal links available`);
  }
  console.log('\nRun without --report to inject links.\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (UNDO)   { undo(PUBLIC_DIR);   return; }
  if (REPORT) { report(PUBLIC_DIR); return; }

  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(`[InternalLinks] ❌ Directory not found: ${PUBLIC_DIR}`);
    console.error('  Run page generators first: npm run build-all');
    process.exit(1);
  }

  const files = scanHtmlFiles(PUBLIC_DIR);
  console.log(`[InternalLinks] Scanning ${files.length} HTML files in ${PUBLIC_DIR}`);
  if (DRY_RUN) console.log('[InternalLinks] DRY RUN — no files will be written\n');

  let totalLinks = 0;
  let filesModified = 0;

  for (const file of files) {
    const slug = fileToSlug(file);
    const html = fs.readFileSync(file, 'utf8');

    const { html: modifiedHtml, linksAdded } = injectLinks(html, slug, PAGE_INDEX);

    if (linksAdded > 0) {
      if (!DRY_RUN) {
        // Backup original
        fs.writeFileSync(`${file}.backup`, html, 'utf8');
        // Write modified
        fs.writeFileSync(file, modifiedHtml, 'utf8');
      }
      totalLinks   += linksAdded;
      filesModified++;
      console.log(`  ✅ ${path.basename(file).padEnd(45)} +${linksAdded} links${DRY_RUN ? ' (dry)' : ''}`);
    }
  }

  console.log(`\n[InternalLinks] Done.`);
  console.log(`  Files modified: ${filesModified}/${files.length}`);
  console.log(`  Total links injected: ${totalLinks}`);
  if (DRY_RUN) console.log('  (dry run — nothing written)');
  else         console.log(`  Backups saved as .html.backup (run --undo to revert)`);
}

main().catch(e => { console.error('[InternalLinks]', e.message); process.exit(1); });
