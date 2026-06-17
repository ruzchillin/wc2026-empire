/**
 * pinterest-automation.js
 * WC 2026 Pinterest content auto-generator
 * 48 teams × 8 content types = 384 pin descriptions ready to schedule
 * Female football audience is fastest growing demographic — $15-25 RPM on Pinterest
 * Usage: node pinterest-automation.js > pinterest-pins.json
 */

const TEAMS = [
  { name: 'Brazil', flag: '🇧🇷', food: 'pão de queijo, brigadeiros, feijoada', style: 'yellow & green', player: 'Vinicius Jr.', region: 'LatAm' },
  { name: 'Argentina', flag: '🇦🇷', food: 'empanadas, asado, medialunas', style: 'light blue & white', player: 'Lautaro Martinez', region: 'LatAm' },
  { name: 'France', flag: '🇫🇷', food: 'croissants, crêpes, coq au vin', style: 'blue, white & red', player: 'Kylian Mbappé', region: 'Europe' },
  { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', food: 'fish & chips, pie, sausage rolls', style: 'white & red', player: 'Jude Bellingham', region: 'UK' },
  { name: 'Germany', flag: '🇩🇪', food: 'bratwurst, pretzels, schnitzel', style: 'white & black', player: 'Florian Wirtz', region: 'Europe' },
  { name: 'Spain', flag: '🇪🇸', food: 'paella, tapas, tortilla española', style: 'red & yellow', player: 'Pedri', region: 'Europe' },
  { name: 'Portugal', flag: '🇵🇹', food: 'pastéis de nata, bacalhau, bifanas', style: 'red & green', player: 'Cristiano Ronaldo', region: 'Europe' },
  { name: 'Netherlands', flag: '🇳🇱', food: 'stroopwafels, bitterballen, herring', style: 'orange', player: 'Virgil van Dijk', region: 'Europe' },
  { name: 'Belgium', flag: '🇧🇪', food: 'waffles, frites, moules', style: 'red, black & yellow', player: 'Kevin De Bruyne', region: 'Europe' },
  { name: 'USA', flag: '🇺🇸', food: 'hot dogs, nachos, sliders', style: 'red, white & blue', player: 'Christian Pulisic', region: 'Americas' },
  { name: 'Mexico', flag: '🇲🇽', food: 'tacos, guacamole, enchiladas', style: 'green, white & red', player: 'Hirving Lozano', region: 'LatAm' },
  { name: 'Japan', flag: '🇯🇵', food: 'sushi, ramen, takoyaki', style: 'blue & white', player: 'Takefusa Kubo', region: 'Asia' },
  { name: 'South Korea', flag: '🇰🇷', food: 'bibimbap, Korean fried chicken, tteokbokki', style: 'red & white', player: 'Son Heung-min', region: 'Asia' },
  { name: 'Morocco', flag: '🇲🇦', food: 'tagine, couscous, pastilla', style: 'red & green', player: 'Achraf Hakimi', region: 'Africa' },
  { name: 'Senegal', flag: '🇸🇳', food: 'thiéboudienne, yassa, mafé', style: 'green, yellow & red', player: 'Sadio Mané', region: 'Africa' },
  { name: 'Nigeria', flag: '🇳🇬', food: 'jollof rice, suya, puff-puff', style: 'green & white', player: 'Victor Osimhen', region: 'Africa' },
  { name: 'Australia', flag: '🇦🇺', food: 'meat pie, vegemite toast, pavlova', style: 'green & gold', player: 'Mathew Ryan', region: 'Oceania' },
  { name: 'Canada', flag: '🇨🇦', food: 'poutine, butter tarts, beaver tails', style: 'red & white', player: 'Alphonso Davies', region: 'Americas' },
  { name: 'Colombia', flag: '🇨🇴', food: 'bandeja paisa, arepas, sancocho', style: 'yellow, blue & red', player: 'Luis Díaz', region: 'LatAm' },
  { name: 'Turkey', flag: '🇹🇷', food: 'kebab, baklava, börek', style: 'red & white', player: 'Hakan Çalhanoğlu', region: 'Europe' },
  { name: 'Ghana', flag: '🇬🇭', food: 'jollof rice, fufu, kelewele', style: 'red, gold & green', player: 'Thomas Partey', region: 'Africa' },
  { name: 'Poland', flag: '🇵🇱', food: 'pierogi, bigos, żurek', style: 'white & red', player: 'Robert Lewandowski', region: 'Europe' },
  { name: 'Switzerland', flag: '🇨🇭', food: 'fondue, raclette, rösti', style: 'red & white', player: 'Granit Xhaka', region: 'Europe' },
  { name: 'Denmark', flag: '🇩🇰', food: 'smørrebrød, æbleskiver, rugbrød', style: 'red & white', player: 'Christian Eriksen', region: 'Europe' },
  { name: 'Ukraine', flag: '🇺🇦', food: 'borscht, varenyky, syrniki', style: 'blue & yellow', player: 'Mykhailo Mudryk', region: 'Europe' },
  { name: 'Ecuador', flag: '🇪🇨', food: 'ceviche, llapingachos, hornado', style: 'yellow, blue & red', player: 'Moisés Caicedo', region: 'LatAm' },
  { name: 'Saudi Arabia', flag: '🇸🇦', food: 'kabsa, mandi, jareesh', style: 'green & white', player: 'Salem Al-Dawsari', region: 'Asia' },
  { name: 'Cameroon', flag: '🇨🇲', food: 'ndolé, poulet DG, plantains', style: 'green, red & yellow', player: 'André-Frank Zambo Anguissa', region: 'Africa' },
  { name: 'Serbia', flag: '🇷🇸', food: 'ćevapi, sarma, kajmak', style: 'red, blue & white', player: 'Dušan Vlahović', region: 'Europe' },
  { name: 'Iran', flag: '🇮🇷', food: 'ghormeh sabzi, kebab, joojeh', style: 'green, white & red', player: 'Mehdi Taremi', region: 'Asia' },
  { name: 'Peru', flag: '🇵🇪', food: 'ceviche, lomo saltado, ají de gallina', style: 'red & white', player: 'Gianluca Lapadula', region: 'LatAm' },
  { name: 'Chile', flag: '🇨🇱', food: 'empanadas, asado, cazuela', style: 'red & white', player: 'Alexis Sánchez', region: 'LatAm' },
  { name: 'Tunisia', flag: '🇹🇳', food: 'brik, couscous, harissa', style: 'red & white', player: 'Youssef Msakni', region: 'Africa' },
  { name: 'South Africa', flag: '🇿🇦', food: 'braai, biltong, bunny chow', style: 'green, gold & black', player: 'Percy Tau', region: 'Africa' },
  { name: 'Croatia', flag: '🇭🇷', food: 'peka, black risotto, burek', style: 'red & white checkers', player: 'Luka Modrić', region: 'Europe' },
  { name: 'Venezuela', flag: '🇻🇪', food: 'pabellón criollo, arepas, cachapas', style: 'yellow, blue & red', player: 'Jhon Durán', region: 'LatAm' },
  { name: 'El Salvador', flag: '🇸🇻', food: 'pupusas, yuca frita, tamales', style: 'blue & white', player: 'Joshua Pérez', region: 'Americas' },
  { name: 'Panama', flag: '🇵🇦', food: 'sancocho, ropa vieja, carimanolas', style: 'red & blue', player: 'Rolando Blackburn', region: 'Americas' },
  { name: 'Honduras', flag: '🇭🇳', food: 'baleadas, sopa de res, tamales', style: 'blue & white', player: 'Alberth Elis', region: 'Americas' },
  { name: 'Uzbekistan', flag: '🇺🇿', food: 'plov, samsa, lagman', style: 'blue & white', player: 'Eldor Shomurodov', region: 'Asia' },
  { name: 'China', flag: '🇨🇳', food: 'dumplings, Peking duck, hot pot', style: 'red & yellow', player: 'Wu Lei', region: 'Asia' },
  { name: 'Qatar', flag: '🇶🇦', food: 'machboos, harees, luqaimat', style: 'maroon & white', player: 'Almoez Ali', region: 'Asia' },
  { name: 'Oman', flag: '🇴🇲', food: 'shuwa, harees, mashuai', style: 'red, white & green', player: 'Muhsen Al-Ghassani', region: 'Asia' },
  { name: 'New Zealand', flag: '🇳🇿', food: 'hangi, lamb chops, pavlova', style: 'white & black', player: 'Chris Wood', region: 'Oceania' },
  { name: 'DR Congo', flag: '🇨🇩', food: 'poulet à la moambe, fufu, pondu', style: 'blue, red & yellow', player: 'Cédric Bakambu', region: 'Africa' },
  { name: 'Côte d\'Ivoire', flag: '🇨🇮', food: 'attieke, kedjenou, alloco', style: 'orange, white & green', player: 'Franck Kessié', region: 'Africa' },
  { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁷󠁿', food: 'haggis, Irn-Bru, deep-fried Mars bar', style: 'dark blue & white', player: 'Andy Robertson', region: 'UK' },
  { name: 'Austria', flag: '🇦🇹', food: 'schnitzel, strudel, sachertorte', style: 'red & white', player: 'Marcel Sabitzer', region: 'Europe' },
];

const CONTENT_TYPES = [
  {
    type: 'watch_party_food',
    titleTemplate: (t) => `${t.flag} ${t.name} Watch Party Food Ideas — WC 2026`,
    descTemplate: (t) => `Host the ultimate ${t.name} watch party! 🍽️ Serve authentic ${t.food} while cheering for the ${t.flag} squad. Your guests will love these traditional flavors. Click to get the full watch party guide with recipes, drink pairings, and decoration ideas! #WorldCup2026 #${t.name}WC #WatchParty #WorldCupFood #FootballFood #WC2026`,
    board: 'WC 2026 Watch Party Food',
    affiliate: 'HelloFresh | Uber Eats | Amazon (kitchen supplies)',
  },
  {
    type: 'fan_fashion',
    titleTemplate: (t) => `${t.name} Football Fan Outfit Ideas — WC 2026 Style`,
    descTemplate: (t) => `Style your ${t.name} match day look! ⚽✨ Rock the ${t.style} in style — jersey, accessories, and game-day glam. From stadium to living room, here's how to wear your support beautifully. Shop the official kits + fan accessories. #FootballFashion #WC2026 #${t.name}Fashion #WorldCup #MatchDayStyle #FootballGirls`,
    board: 'WC 2026 Fan Fashion',
    affiliate: 'Amazon | StubHub | Nike | Adidas',
  },
  {
    type: 'player_aesthetic',
    titleTemplate: (t) => `${t.player} — WC 2026 Stats, Story & Style`,
    descTemplate: (t) => `Everything you need to know about ${t.player} at WC 2026 🌟 Goals, assists, career moments — plus the best photos. Who else is obsessed? Save this for match day! #${t.player.replace(/\s/g,'').replace('.', '')} #WC2026 #${t.name}Football #WorldCupPlayers #FootballStars`,
    board: 'WC 2026 Player Profiles',
    affiliate: 'Player merch | DraftKings betting props',
  },
  {
    type: 'decoration_guide',
    titleTemplate: (t) => `${t.name} WC 2026 Party Decoration Ideas`,
    descTemplate: (t) => `Transform your home into a ${t.flag} ${t.name} match day HQ! 🎉 DIY decorations in ${t.style} — balloons, banners, tablerunners and more. Budget-friendly ideas for every space. Save for your next WC watch party! #WC2026Decor #WorldCup2026 #PartyDecor #WatchParty #${t.name}Party #FootballParty`,
    board: 'WC 2026 Party Decorations',
    affiliate: 'Amazon party supplies | Etsy',
  },
  {
    type: 'fun_facts',
    titleTemplate: (t) => `${t.name} at WC 2026 — 10 Facts You Need to Know`,
    descTemplate: (t) => `Did you know ${t.name} has NEVER done this at a World Cup? 🤯 Fascinating stats, history, and predictions for ${t.flag} in WC 2026. Save this to impress your friends during the match! #${t.name}WorldCup #WC2026Facts #WorldCupHistory #FootballFacts #WC2026`,
    board: 'WC 2026 Team Facts',
    affiliate: 'WC guide ebook | newsletter signup',
  },
  {
    type: 'betting_guide',
    titleTemplate: (t) => `${t.name} WC 2026 Betting Odds + Predictions`,
    descTemplate: (t) => `Should you back ${t.flag} ${t.name} at WC 2026? Our AI model has the predictions 🔮 Current odds, xG data, and value bets — everything in one place. Link in bio for the full analysis + free bet offers! #${t.name}WC #WC2026Betting #WorldCupOdds #FootballPredictions`,
    board: 'WC 2026 Predictions & Odds',
    affiliate: 'DraftKings | Bet365 | FanDuel',
  },
  {
    type: 'cultural_guide',
    titleTemplate: (t) => `Travel to ${t.name} for WC 2026? Your Culture Guide`,
    descTemplate: (t) => `${t.flag} Supporting ${t.name} from their homeland or following them to the US? Here's everything about ${t.name} football culture — chants, traditions, and local fan experience. WC 2026 travel tips included! #${t.name}Travel #WC2026Travel #WorldCup2026 #FootballCulture`,
    board: 'WC 2026 Travel Guides',
    affiliate: 'Booking.com | Skyscanner | Airalo eSIM | World Nomads',
  },
  {
    type: 'quiz_teaser',
    titleTemplate: (t) => `How Well Do You Know ${t.name} Football? Take the Quiz`,
    descTemplate: (t) => `Think you're a ${t.name} expert? 🏆 Test your knowledge of ${t.flag} ${t.name} at World Cups — goals, upsets, legendary players. Click the link to test yourself! Share your score. #${t.name}Football #WC2026Quiz #WorldCupTrivia #FootballQuiz`,
    board: 'WC 2026 Quizzes & Games',
    affiliate: 'Email capture | Whop community signup',
  },
];

// Generate all pins
function generateAllPins() {
  const pins = [];
  
  for (const team of TEAMS) {
    for (const contentType of CONTENT_TYPES) {
      pins.push({
        title: contentType.titleTemplate(team),
        description: contentType.descTemplate(team),
        board: contentType.board,
        affiliate_angle: contentType.affiliate,
        team: team.name,
        flag: team.flag,
        region: team.region,
        content_type: contentType.type,
        optimal_time: getOptimalPinTime(team.region),
        hashtag_count: (contentType.descTemplate(team).match(/#/g) || []).length,
        match_day_boost: true, // Pin 2h before each team's match
      });
    }
  }
  
  return pins;
}

function getOptimalPinTime(region) {
  const times = {
    'Americas': '6pm–9pm ET',
    'LatAm': '5pm–8pm ET',
    'Europe': '8am–11am ET (when they wake up)',
    'Asia': '7am–9am ET (their evening)',
    'Africa': '10am–12pm ET (their late afternoon)',
    'UK': '9am–11am ET',
    'Oceania': '4am–6am ET (their evening)',
  };
  return times[region] || '12pm–3pm ET';
}

// Schedule: which pins to post this week based on upcoming matches
function getThisWeekSchedule(matchSchedule) {
  // matchSchedule = [{ team1: 'Brazil', team2: 'France', date: '2026-06-14' }]
  const scheduled = [];
  
  for (const match of matchSchedule) {
    const matchDate = new Date(match.date);
    const threeDaysBefore = new Date(matchDate);
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
    
    // Pre-match pins: food + facts (3 days before)
    scheduled.push({ date: threeDaysBefore.toISOString().split('T')[0], team: match.team1, type: 'watch_party_food', note: 'Pre-match build-up' });
    scheduled.push({ date: threeDaysBefore.toISOString().split('T')[0], team: match.team2, type: 'fun_facts', note: 'Pre-match build-up' });
    
    // Match day: fashion + betting guide
    scheduled.push({ date: match.date, team: match.team1, type: 'fan_fashion', note: 'MATCH DAY — post 2h before kick-off' });
    scheduled.push({ date: match.date, team: match.team2, type: 'betting_guide', note: 'MATCH DAY — post 2h before kick-off' });
    
    // Post-match: cultural guide + player aesthetic
    const nextDay = new Date(matchDate);
    nextDay.setDate(nextDay.getDate() + 1);
    scheduled.push({ date: nextDay.toISOString().split('T')[0], team: match.team1, type: 'player_aesthetic', note: 'Post-match reaction traffic' });
    scheduled.push({ date: nextDay.toISOString().split('T')[0], team: match.team2, type: 'cultural_guide', note: 'Post-match exploration' });
  }
  
  return scheduled;
}

// Revenue estimate
function estimateRevenue(followers, avgMonthlyViews) {
  const rpmRange = { low: 15, high: 25 }; // Pinterest ad RPM for sports/food content
  const ctrToAffiliates = 0.008; // 0.8% of views click affiliate links
  const avgCPA = 45; // HelloFresh + Uber Eats mix
  
  return {
    monthly_ad_revenue_low: (avgMonthlyViews / 1000) * rpmRange.low,
    monthly_ad_revenue_high: (avgMonthlyViews / 1000) * rpmRange.high,
    monthly_affiliate_revenue: avgMonthlyViews * ctrToAffiliates * avgCPA,
    note: 'These are conservative estimates. WC 2026 content RPM is higher during June–July.',
  };
}

// Main output
const allPins = generateAllPins();

// Example WC 2026 match schedule (first week)
const exampleMatches = [
  { team1: 'USA', team2: 'Mexico', date: '2026-06-14' },
  { team1: 'Brazil', team2: 'Colombia', date: '2026-06-15' },
  { team1: 'England', team2: 'Poland', date: '2026-06-16' },
  { team1: 'France', team2: 'Morocco', date: '2026-06-17' },
  { team1: 'Argentina', team2: 'Nigeria', date: '2026-06-18' },
  { team1: 'Germany', team2: 'Japan', date: '2026-06-19' },
];

const weekSchedule = getThisWeekSchedule(exampleMatches);
const revenueEstimate = estimateRevenue(50000, 500000);

const output = {
  meta: {
    total_pins_generated: allPins.length,
    teams: TEAMS.length,
    content_types: CONTENT_TYPES.length,
    boards_needed: [...new Set(CONTENT_TYPES.map(c => c.board))],
    note: 'Post 3–8 pins per day. Consistency > volume. Use Tailwind for scheduling.',
    tool_recommendation: 'Tailwind App (tailwindapp.com) — bulk schedule 400 pins at once',
  },
  revenue_estimate: revenueEstimate,
  this_week_schedule: weekSchedule,
  sample_pins: allPins.slice(0, 16),
  all_boards: [
    'WC 2026 Watch Party Food',
    'WC 2026 Fan Fashion', 
    'WC 2026 Player Profiles',
    'WC 2026 Party Decorations',
    'WC 2026 Team Facts',
    'WC 2026 Predictions & Odds',
    'WC 2026 Travel Guides',
    'WC 2026 Quizzes & Games',
  ],
  // Full pins available via: allPins (384 total)
};

console.log(JSON.stringify(output, null, 2));

// Also export for use in other scripts
if (typeof module !== 'undefined') {
  module.exports = { generateAllPins, getThisWeekSchedule, estimateRevenue, TEAMS, CONTENT_TYPES };
}
