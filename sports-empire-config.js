/**
 * sports-empire-config.js
 * Master configuration extending the WC 2026 stack to every sport
 * Every sport × men + women × every nation × every revenue stream
 * Drop-in extension to affiliate-matrix.js, moment-engine.js, content-multiplier.js
 */

// ═══════════════════════════════════════════════════════════
// SPORTS REGISTRY — every sport with M/W editions
// ═══════════════════════════════════════════════════════════

const SPORTS_REGISTRY = {

  // ── FOOTBALL / SOCCER ───────────────────────────────────
  football_men: {
    name: 'Football (Men)', slug: 'football', gender: 'men',
    globalFans: '5B', primaryLanguages: ['en','es','pt','fr','de','ar','hi','sw','id','ja','ko','zh'],
    majorEvents: ['FIFA World Cup','UEFA Champions League','Premier League','La Liga','Bundesliga','Serie A','Copa América','AFCON','Asian Cup'],
    momentEvents: ['GOAL','RED_CARD','PENALTY','HAT_TRICK','UPSET','VAR','INJURY','ELIMINATION','OWN_GOAL','RECORD'],
    affiliatePrograms: ['draftkings','fanduel','bet365','betway','betmgm','caesars','espnbet','william_hill','paddy_power','unibet'],
    contentAngles: ['predictions','tactics','xG_analysis','ref_analysis','injury_tracker','transfer_rumours','value_bets'],
    peakSeason: 'Aug–Jul (year-round)',
    nextMegaEvent: 'WC 2026 NOW → WC 2030 Morocco/Spain/Portugal',
  },

  football_women: {
    name: "Football (Women's)", slug: 'womens-football', gender: 'women',
    globalFans: '1.2B growing 40%/yr', primaryLanguages: ['en','es','de','fr','pt','sv','nl'],
    majorEvents: ["Women's World Cup 2027","WSL","NWSL","D1 Arkema","Frauen-Bundesliga","UEFA Women's Champions League"],
    momentEvents: ['GOAL','RED_CARD','PENALTY','UPSET','RECORD','MILESTONE'],
    affiliatePrograms: ['bet365','betway','unibet','paddypower','sky_bet'],
    contentAngles: ['player_profiles','career_journeys','equal_pay','tactical_analysis','women_in_sport','fan_community'],
    peakSeason: 'Year-round — WWC 2027 is next mega-event',
    gapStatus: 'TOTAL GAP — no AI women\'s football content exists at scale',
    nextMegaEvent: "Women's World Cup 2027 — Brazil",
  },

  // ── CRICKET ─────────────────────────────────────────────
  cricket_men: {
    name: 'Cricket (Men)', slug: 'cricket', gender: 'men',
    globalFans: '2.5B', primaryLanguages: ['en','hi','bn','ur','ta','si','pa'],
    majorEvents: ['ICC Cricket World Cup','IPL','The Ashes','ICC T20 World Cup','PSL','BBL','The Hundred'],
    momentEvents: ['WICKET','SIX','CENTURY','FIFTY','HATTRICK','RUNOUT','ELIMINATION','RECORD','UPSET'],
    affiliatePrograms: ['dream11','betway_in','bet365_in','parimatch','betfair','1xbet'],
    contentAngles: ['pitch_analysis','player_form','fantasy_lineup','batting_vs_bowling','venue_stats','weather_impact','DRS_analysis'],
    peakSeason: 'Year-round — IPL (Apr–May), WC (Oct–Nov), Tests year-round',
    gapStatus: 'MASSIVE GAP — zero AI cricket prediction tool in Hindi/Bengali/Urdu',
    nextMegaEvent: 'ICC WC 2027 — South Africa',
    keyMarket: 'India alone = $2.4B fantasy sports market',
  },

  cricket_women: {
    name: "Cricket (Women's)", slug: 'womens-cricket', gender: 'women',
    globalFans: '400M growing', primaryLanguages: ['en','hi','au'],
    majorEvents: ["Women's T20 World Cup 2026","Women's Ashes","WBBL","The Hundred Women's"],
    momentEvents: ['WICKET','SIX','CENTURY','UPSET','RECORD'],
    gapStatus: 'Total gap — Women\'s T20 WC 2026 has zero AI preview coverage',
  },

  // ── AMERICAN FOOTBALL ───────────────────────────────────
  nfl: {
    name: 'NFL', slug: 'nfl', gender: 'men',
    globalFans: '180M US + 30M international', primaryLanguages: ['en','es','de','ja'],
    majorEvents: ['Super Bowl','NFL Playoffs','Regular Season (18 weeks)','Pro Bowl'],
    momentEvents: ['TOUCHDOWN','INTERCEPTION','FUMBLE','FIELD_GOAL','SACK','4TH_DOWN_CONVERSION','CHALLENGE'],
    affiliatePrograms: ['draftkings','fanduel','betmgm','caesars','espnbet'],
    contentAngles: ['sgp_guide','fantasy_lineup','injury_report','weather_impact','coaching_tendencies','red_zone_stats'],
    peakSeason: 'Sep–Feb — fills WC 2026 audience post-tournament',
    keyInsight: '47% of NFL viewers are women — massively underserved content',
    superBowl: 'Biggest US single-day betting event — $1.5B+ wagered',
  },

  nfl_women_fans: {
    name: 'NFL (Women Fans Focus)', slug: 'nfl-women-fans', gender: 'women',
    gapStatus: '47% of NFL fans are women. Zero content created for them specifically. The "NFL for women" content slot is completely open.',
    contentAngles: ['team_culture','player_stories','fantasy_for_beginners','NFL_fashion','watch_party','relationship_with_sport'],
  },

  // ── HORSE RACING ────────────────────────────────────────
  horse_racing: {
    name: 'Horse Racing', slug: 'horse-racing', gender: 'mixed',
    globalFans: '500M', primaryLanguages: ['en','fr','ja','ar'],
    majorEvents: ['Cheltenham Festival','Royal Ascot','Grand National','Kentucky Derby','Melbourne Cup','Breeders\' Cup','Dubai World Cup'],
    momentEvents: ['WIN','PLACE','SHOW','SCRATCHED','FALL','RECORD','UPSET','EACH_WAY_WINNER'],
    affiliatePrograms: ['betfair','william_hill','paddy_power','bet365','betway','coral','ladbrokes','tab_australia'],
    contentAngles: ['form_analysis_plain_english','trainer_stats','jockey_stats','going_conditions','draw_bias','course_specialists','each_way_value'],
    frequency: 'Races every 15 minutes globally — moment-engine fires constantly',
    betfairNote: 'Most liquid Betfair exchange market — automated value picks every race',
    gapStatus: 'Zero AI form analysis in plain language. Form guides are written by insiders for insiders.',
    wageredAnnually: '$150B globally',
  },

  // ── TENNIS ──────────────────────────────────────────────
  tennis_men: {
    name: 'ATP Tennis', slug: 'tennis-atp', gender: 'men',
    majorEvents: ['Wimbledon','Roland Garros','US Open','Australian Open','ATP Finals','Davis Cup'],
    affiliatePrograms: ['bet365','betway','unibet','william_hill','stubhub_tickets'],
    momentEvents: ['SET_WIN','BREAK_OF_SERVE','MATCH_WIN','UPSET','RECORD','RETIREMENT'],
    contentAngles: ['surface_stats','head_to_head','serve_stats','physical_fitness','travel_guide'],
  },

  tennis_women: {
    name: 'WTA Tennis', slug: 'tennis-wta', gender: 'women',
    gapStatus: '60% female audience. WTA content is almost entirely ignored by AI tools.',
    contentAngles: ['player_profiles','fashion_sport_crossover','career_stories','match_analysis','travel_guides'],
    keyInsight: 'WTA audience = highest-RPM Pinterest demographic',
  },

  // ── FORMULA 1 ───────────────────────────────────────────
  formula1: {
    name: 'Formula 1', slug: 'f1', gender: 'men',
    globalFans: '900M viewers/season', primaryLanguages: ['en','es','de','it','nl','pt','ja'],
    majorEvents: ['Monaco GP','British GP','Italian GP','Abu Dhabi GP','World Drivers Championship'],
    momentEvents: ['POLE_POSITION','SAFETY_CAR','CRASH','OVERTAKE','PIT_STOP','DNF','CHAMPION','RECORD'],
    affiliatePrograms: ['bet365','betway','william_hill','stubhub','booking_com_travel'],
    contentAngles: ['newcomer_guide','strategy_analysis','constructor_standings','driver_profiles','travel_to_gp'],
    gapStatus: 'Same "newcomer" gap as soccer for Americans — Drive to Survive created millions of fans who need an entry guide',
  },

  f1_academy: {
    name: 'F1 Academy (Women)', slug: 'f1-academy', gender: 'women',
    launched: 2023,
    gapStatus: 'Launched 2023. Growing fast. Zero AI coverage. The female motorsport audience is completely unserved.',
  },

  // ── BASKETBALL ──────────────────────────────────────────
  nba: {
    name: 'NBA', slug: 'nba', gender: 'men',
    globalFans: '2B', primaryLanguages: ['en','es','fr','ph','id','zh','ko','pt'],
    majorEvents: ['NBA Finals','All-Star','Playoffs','Draft'],
    momentEvents: ['DUNK','TRIPLE_DOUBLE','BUZZER_BEATER','ELIMINATION','UPSET','RECORD'],
    affiliatePrograms: ['draftkings','fanduel','betmgm','caesars'],
    geoAngles: { africa: 'Nigeria/Cameroon/Senegal NBA obsession', philippines: '#1 sport 115M people', china_diaspora: 'Legal in AUS/UK/CA' },
  },

  wnba: {
    name: 'WNBA', slug: 'wnba', gender: 'women',
    viewershipGrowth: '+200% since 2022',
    gapStatus: 'Caitlin Clark effect. 200% growth. Zero AI WNBA content exists.',
    contentAngles: ['player_profiles','game_analysis','social_impact','fashion_sport','growing_fanbase'],
  },

  // ── CRICKET COMPANION: KABADDI ──────────────────────────
  kabaddi: {
    name: 'Kabaddi (PKL)', slug: 'kabaddi', gender: 'men',
    market: 'India + South Asia',
    fans: '300M in India',
    gapStatus: 'Pro Kabaddi League has 300M Indian fans. Zero AI content. Dream11 has Kabaddi fantasy.',
    affiliate: 'Dream11 · MPL Sports',
  },

  // ── RUGBY ───────────────────────────────────────────────
  rugby_union: {
    name: 'Rugby Union', slug: 'rugby', gender: 'men',
    majorEvents: ['Rugby World Cup 2027 (AUS)','Six Nations','Rugby Championship','Premiership'],
    primaryMarkets: ['UK','Ireland','France','South Africa','Australia','New Zealand','Argentina','Japan'],
    affiliatePrograms: ['bet365','betway','paddy_power','sportbet_australia'],
  },

  rugby_women: {
    name: "Women's Rugby", slug: 'womens-rugby', gender: 'women',
    majorEvents: ["Women's RWC 2025 (England)","Women's Six Nations","Premier 15s"],
    gapStatus: 'Women\'s RWC 2025 in England. Zero AI coverage. First-mover window NOW.',
  },

  // ── ICE HOCKEY ──────────────────────────────────────────
  nhl: {
    name: 'NHL', slug: 'nhl', gender: 'men',
    primaryMarkets: ['Canada','USA','Czech Republic','Slovakia','Finland','Sweden','Russia diaspora'],
    affiliatePrograms: ['draftkings','fanduel','bet365_ca','sports_interaction'],
  },

  pwhl: {
    name: 'PWHL', slug: 'pwhl', gender: 'women',
    launched: 2024,
    gapStatus: 'Professional Women\'s Hockey League launched Jan 2024. Fastest growing new league in North America. Zero AI coverage.',
  },

  // ── ESPORTS ─────────────────────────────────────────────
  esports: {
    name: 'Esports', slug: 'esports', gender: 'mixed',
    titles: ['CS2','League of Legends','Valorant','Dota 2','PUBG','Rocket League','Overwatch 2','FIFA/EA FC','Call of Duty'],
    momentEvents: ['ROUND_WIN','ELIMINATION','UPSET','MAJOR_WIN','RECORD','CLUTCH'],
    affiliatePrograms: ['betway_esports','unikrn','gg_bet','no_deposit_bonus_sites'],
    demographic: '16–28, digital-native, high disposable income',
    korea: 'LoL is national sport · KakaoTalk bot ready',
    gapStatus: 'No AI match prediction tool at scale for esports. Massive content gap.',
  },

  esports_women: {
    name: "Women's Esports", slug: 'womens-esports', gender: 'women',
    gapStatus: 'Women\'s esports growing 400%+ since 2020. Valorant Game Changers, CS2 Female Circuit — zero AI coverage.',
  },

  // ── CYCLING ─────────────────────────────────────────────
  cycling_men: {
    name: 'Cycling (Men)', slug: 'cycling', gender: 'men',
    majorEvents: ['Tour de France','Giro d\'Italia','Vuelta a España','Paris-Roubaix'],
    primaryMarkets: ['Belgium','Netherlands','France','UK','Colombia','Italy'],
    affiliatePrograms: ['betfair','bet365','winamax'],
  },

  cycling_women: {
    name: "Cycling (Women's)", slug: 'womens-cycling', gender: 'women',
    majorEvents: ["Tour de France Femmes (launched 2022)","La Fleche Wallonne Femmes","Giro Donne"],
    gapStatus: 'Tour de France Femmes launched 2022. Growing fast. Zero AI coverage. Belgium/Netherlands/France audience completely unserved.',
  },

  // ── ATHLETICS ───────────────────────────────────────────
  athletics: {
    name: 'Athletics / Track & Field', slug: 'athletics', gender: 'mixed',
    majorEvents: ['Olympics','World Athletics Championships','Diamond League'],
    keyMarkets: { kenya: 'Long-distance running national identity', ethiopia: 'Marathon dominance', jamaica: 'Sprinting global brand', usa: 'Multi-event dominance' },
    gapStatus: 'Kenya/Ethiopia have massive athletics audiences with zero AI content in Swahili/Amharic.',
  },

  // ── DARTS + SNOOKER ─────────────────────────────────────
  darts: {
    name: 'Darts (PDC)', slug: 'darts', gender: 'mixed',
    primaryMarkets: ['UK','Netherlands','Germany','Belgium'],
    betfairStatus: 'Most active in-play Betfair market per event',
    gapStatus: 'Zero AI darts prediction tool. Walk-on music, form, average checkout % — all predictive data nobody has packaged.',
    womensDarts: 'PDC Women\'s Tour growing fast — Fallon Sherrock created global attention',
  },

  snooker: {
    name: 'Snooker', slug: 'snooker', gender: 'mixed',
    primaryMarkets: ['UK','China','Germany','Australia'],
    chinaAngle: '400M Chinese snooker viewers — Chinese-language content = monopoly',
    gapStatus: 'Zero AI snooker content in Chinese. Ronnie O\'Sullivan has 50M+ Chinese fans.',
  },

  // ── GREYHOUND RACING ────────────────────────────────────
  greyhounds: {
    name: 'Greyhound Racing', slug: 'greyhounds', gender: 'neutral',
    primaryMarkets: ['UK','Ireland','Australia'],
    frequency: 'Every 15 minutes globally',
    betfairStatus: 'Most liquid Betfair exchange market globally',
    gapStatus: 'Automated AI tips every 15 minutes = moment-engine firing constantly. Zero competition for AI greyhound tips.',
  },

};

// ═══════════════════════════════════════════════════════════
// EXTENDED LANGUAGE REGISTRY — 28 languages
// ═══════════════════════════════════════════════════════════

const LANGUAGES_EXTENDED = {
  en: { name: 'English', speakers: '1.5B', markets: 'US,UK,AUS,CA,NZ,IN,NG,ZA,PH' },
  es: { name: 'Spanish', speakers: '500M', markets: 'MX,AR,CO,ES,PE,CL,VE,US_Hispanic' },
  pt: { name: 'Portuguese', speakers: '250M', markets: 'BR,PT,MZ,AO' },
  fr: { name: 'French', speakers: '300M', markets: 'FR,CI,SN,CM,CD,BE,CH,CA_Quebec' },
  de: { name: 'German', speakers: '100M', markets: 'DE,AT,CH' },
  ar: { name: 'Arabic', speakers: '300M', markets: 'MA,EG,SA,QA,AE,IQ,DZ' },
  hi: { name: 'Hindi', speakers: '600M', markets: 'IN — cricket + kabaddi MASSIVE gap' },
  bn: { name: 'Bengali', speakers: '230M', markets: 'BD,IN_West_Bengal — cricket' },
  ur: { name: 'Urdu', speakers: '170M', markets: 'PK,IN — cricket + UK diaspora' },
  id: { name: 'Bahasa Indonesia', speakers: '270M', markets: 'ID — football + badminton' },
  ms: { name: 'Malay', speakers: '80M', markets: 'MY,SG,BN' },
  tl: { name: 'Filipino/Tagalog', speakers: '115M', markets: 'PH — basketball #1 sport' },
  ja: { name: 'Japanese', speakers: '125M', markets: 'JP — LINE bot live, baseball' },
  ko: { name: 'Korean', speakers: '77M', markets: 'KR — KakaoTalk live, esports' },
  zh: { name: 'Chinese (Mandarin)', speakers: '1B+', markets: 'CN_diaspora,TW,SG — basketball, snooker' },
  sw: { name: 'Swahili', speakers: '200M', markets: 'KE,TZ,UG — football + athletics' },
  ha: { name: 'Hausa', speakers: '80M', markets: 'NG,NE,GH — West Africa football' },
  yo: { name: 'Yoruba', speakers: '45M', markets: 'NG — Nigeria football Bet9ja' },
  am: { name: 'Amharic', speakers: '60M', markets: 'ET — athletics dominance' },
  tr: { name: 'Turkish', speakers: '85M', markets: 'TR — football + basketball + wrestling' },
  pl: { name: 'Polish', speakers: '45M', markets: 'PL — football + volleyball' },
  nl: { name: 'Dutch', speakers: '28M', markets: 'NL,BE — football + cycling + hockey' },
  sv: { name: 'Swedish', speakers: '10M', markets: 'SE — football + ice hockey + athletics' },
  no: { name: 'Norwegian', speakers: '5.5M', markets: 'NO — football + handball + winter sports + highest RPM' },
  ro: { name: 'Romanian', speakers: '24M', markets: 'RO — football + gymnastics, Betano HQ' },
  vi: { name: 'Vietnamese', speakers: '95M', markets: 'VN — football + badminton' },
  th: { name: 'Thai', speakers: '60M', markets: 'TH — football + Muay Thai' },
  ta: { name: 'Tamil', speakers: '75M', markets: 'IN_Tamil_Nadu,LK — cricket' },
};

// ═══════════════════════════════════════════════════════════
// EXTENDED REVENUE STREAMS — 26 categories
// ═══════════════════════════════════════════════════════════

const REVENUE_STREAMS = {
  // TIER 1: Highest CPA
  mortgage_leads: { cpa: '£700', program: 'Habito', angle: 'Every sport fan buys a home' },
  casino_affiliate: { cpa: '£150–300', programs: ['bet365_casino','888casino','betway_casino'], angle: 'Same traffic, 3x the CPA' },
  sports_betting: { cpa: '£65–300', programs: 'All sportsbooks', angle: 'Core product' },
  life_insurance: { cpa: '£200–400', programs: ['comparethemarket','aviva'], angle: 'Male 25-45 demo converts well' },
  fantasy_sports: { cpa: '£80', programs: ['dream11','draftkings_dfs','fanduel_dfs'], angle: 'India: $2.4B market' },

  // TIER 2: Volume × size
  investing: { cpa: '$80–150', programs: ['etoro','trading212','robinhood'], angle: '"invest in the game" crossover' },
  energy_switching: { cpa: '£90', program: 'uswitch', angle: '"stay home watch sport, switch energy"' },
  vpn: { cpa: '£65–100', program: 'nordvpn', angle: 'Stream every sport from anywhere' },
  streaming: { cpa: '$40–60', programs: ['fubotv','dazn','peacock'], angle: 'Every sport has a streaming rights question' },
  sports_travel: { cpa: '4–10%', programs: ['booking_com','skyscanner','stubhub','world_nomads'], angle: 'Every major event = travel need' },

  // TIER 3: Lifestyle
  sports_equipment: { commission: '5–8%', programs: ['nike','adidas','under_armour'], basket: '£50–500' },
  sports_nutrition: { commission: '10–15%', programs: ['myprotein','optimum_nutrition','bulk'], repeat: true },
  wearable_tech: { cpa: '$30–80', programs: ['whoop','garmin','polar'], angle: '"Train like [player]"' },
  food_delivery: { cpa: '£15–45', programs: ['hellofresh','ubereats','gousto'], angle: 'Nation food recipe × every team' },
  language_learning: { cpa: '$25', programs: ['babbel','duolingo'], angle: '"Learn Spanish for WC" or any sport/nation' },
  trading_cards: { commission: '5–10%', programs: ['fanatics','topps','sorare'], angle: 'Collectibles $35B market' },

  // TIER 4: Owned (highest margin)
  saas_subscriptions: { price: '£4.99–199/mo', margin: '95%+', angle: 'P&L tracker, picks, analytics' },
  whop_communities: { price: '$15–400/mo', margin: '90%', angle: 'Sports picks communities' },
  corporate_sweepstakes: { price: '£499/yr', margin: '90%', angle: 'B2B — every HR manager in UK' },
  pod_merchandise: { margin: '30–40%', angle: '48 nations × every sport × every team' },
  digital_products: { price: '£5–99', margin: '100%', angle: 'Guides, ebooks, PDFs' },
  prediction_game_rake: { rake: '10%', angle: 'Every fixture = new pool' },

  // TIER 5: Media
  display_ads: { rpm: '$5–25', scale: 'Scales with traffic, zero effort' },
  newsletter_sponsorships: { price: '£500–5K/issue', angle: 'Per sport newsletter' },
  youtube_ads: { rpm: '$4–12', angle: 'Sports = high RPM, every live = VOD forever' },
  podcast_sponsorships: { cpm: '£20–50', angle: 'Sports podcast demo = premium advertisers' },

  // TIER 6: B2B (highest LTV)
  data_api_licensing: { price: '£10K–500K/yr', buyers: 'Sportsbooks, broadcasters, fantasy platforms' },
  platform_whitelabel: { price: '£50K–500K/yr', buyers: 'National newspapers, sports brands' },
  publisher_saas: { price: '£499–4,999/mo', buyers: '1,000 sports blogs on your infrastructure' },
};

// ═══════════════════════════════════════════════════════════
// NATION-SPORT MATRIX — primary sport per nation
// ═══════════════════════════════════════════════════════════

const NATION_SPORT_MATRIX = {
  IN: { primary: 'cricket', secondary: ['kabaddi','hockey_field','badminton','wrestling'], population: '1.4B', languageStack: ['hi','bn','ur','ta'], affiliateRoute: 'dream11_fantasy' },
  ID: { primary: 'football', secondary: ['badminton','basketball'], population: '275M', languageStack: ['id'], affiliateRoute: '1xbet_sea' },
  PH: { primary: 'basketball', secondary: ['football','boxing'], population: '115M', languageStack: ['tl','en'], affiliateRoute: 'bet365_ph' },
  NG: { primary: 'football', secondary: ['boxing','athletics','basketball'], population: '220M', languageStack: ['en','yo','ha'], affiliateRoute: 'bet9ja' },
  KE: { primary: 'athletics', secondary: ['football','rugby_7s'], population: '55M', languageStack: ['sw','en'], affiliateRoute: 'sportpesa' },
  ZA: { primary: 'rugby', secondary: ['cricket','football'], population: '60M', languageStack: ['en'], affiliateRoute: 'betway_za' },
  BR: { primary: 'football', secondary: ['volleyball','mma','basketball','athletics'], population: '215M', languageStack: ['pt'], affiliateRoute: 'betano_br' },
  JP: { primary: 'baseball', secondary: ['football','sumo','rugby'], population: '125M', languageStack: ['ja'], affiliateRoute: 'line_bot_live' },
  KR: { primary: 'esports', secondary: ['football','baseball','short_track'], population: '52M', languageStack: ['ko'], affiliateRoute: 'kakao_bot_live' },
  AU: { primary: 'afl', secondary: ['cricket','nrl','horse_racing','swimming'], population: '26M', languageStack: ['en'], affiliateRoute: 'sportsbet_au' },
  NO: { primary: 'football', secondary: ['handball','winter_sports','athletics'], population: '5.5M', languageStack: ['no'], affiliateRoute: 'unibet_no', rpm: 'HIGHEST IN WORLD' },
  BE: { primary: 'football', secondary: ['cycling','tennis','hockey_field'], population: '11.5M', languageStack: ['nl','fr'], affiliateRoute: 'unibet_be' },
  DK: { primary: 'football', secondary: ['handball','cycling','badminton'], population: '6M', languageStack: ['da'], affiliateRoute: 'unibet_dk' },
  ET: { primary: 'athletics', secondary: ['football'], population: '125M', languageStack: ['am'], affiliateRoute: 'melbet_eth', gap: 'TOTAL — Amharic AI athletics content = monopoly' },
};

// ═══════════════════════════════════════════════════════════
// CONTENT MULTIPLIER — calculate total instances
// ═══════════════════════════════════════════════════════════

function calculateTotalInstances() {
  const sportCategories = Object.keys(SPORTS_REGISTRY).length; // 25+ and growing
  const genderMultiplier = 2; // men + women for each
  const nations = Object.keys(NATION_SPORT_MATRIX).length;
  const languages = Object.keys(LANGUAGES_EXTENDED).length;
  const platforms = 16; // web, email, TG, WA, LINE, Kakao, Discord, YT, TikTok, IG, Pinterest, Snap, Reddit, LinkedIn, Apple News, Chrome
  const revenueStreams = Object.keys(REVENUE_STREAMS).length;
  const eventsPerYear = 365 * 8; // avg 8 significant events per day across all sports globally

  return {
    sportCategories,
    genderMultiplier,
    sportNationCombos: sportCategories * genderMultiplier * nations,
    localisedUnits: sportCategories * genderMultiplier * nations * languages,
    distributionTouchpoints: sportCategories * genderMultiplier * nations * languages * platforms,
    annualMonetisationInstances: sportCategories * genderMultiplier * nations * languages * platforms * revenueStreams * eventsPerYear,
    note: 'This number is the true scale of what can be built. Each instance = one automated revenue action.',
  };
}

console.log('Sports Empire Config loaded');
console.log('Scale:', calculateTotalInstances());

module.exports = { SPORTS_REGISTRY, LANGUAGES_EXTENDED, REVENUE_STREAMS, NATION_SPORT_MATRIX, calculateTotalInstances };
