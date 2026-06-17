// languages-extended.js
// ADDENDUM to languages-config.js — 30+ additional languages
// Covers every remaining significant football audience globally
// Merge with LANGUAGES object in languages-config.js
// Total combined reach: ~6B+ speakers
// ─────────────────────────────────────────────────────────────

const LANGUAGES_EXTENDED = {

  // ══════════════════════════════════════════════════════════
  // AFRICA — ADDITIONAL (complement to Swahili/Hausa/Zulu/Wolof/Twi/Yoruba)
  // ══════════════════════════════════════════════════════════

  am: {
    name: 'Amharic',
    nativeName: 'አማርኛ',
    tier: 1,
    speakers: 57_000_000,
    region: 'Ethiopia + Eritrea + diaspora',
    countries: ['Ethiopia', 'Eritrea', 'USA (diaspora)', 'Israel (diaspora)'],
    wcTeams: [],
    platforms: { primary: ['Telegram', 'Facebook', 'YouTube', 'TikTok'], secondary: ['Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_AM || '',
    whatsappChannel: process.env.WHATSAPP_AM || '',
    contentAngles: [
      'Ethiopia has a passionate football culture with zero WC content in Amharic',
      'Pan-African angle — support all African teams collectively',
      'Ethiopian diaspora in USA (Minnesota, DC) is digitally active',
      'Fast-growing digital economy — 60M+ mobile users'
    ],
    culturalNote: 'Football is called "ኳስ" (kwas). Telegram dominates in Ethiopia. Pan-African unity messaging resonates strongly.',
    hashtag: '#WC2026 #ዓለም_ዋንጫ #ኳስ',
    goalReaction: '⚽ ጎል! አፍሪካ ያሸንፋል! 🌍',
    competition: 'zero',
    monetization: { affiliates: ['bet365', '1xBet Africa', 'VPN affiliates'], avgCPM: 0.4 }
  },

  ig: {
    name: 'Igbo',
    nativeName: 'Igbo',
    tier: 1,
    speakers: 45_000_000,
    region: 'Nigeria (South-East) + diaspora',
    countries: ['Nigeria', 'UK (diaspora)', 'USA (diaspora)'],
    wcTeams: ['Nigeria'],
    platforms: { primary: ['WhatsApp', 'Facebook', 'Instagram', 'TikTok', 'Telegram'], secondary: ['Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_IG || '',
    whatsappChannel: process.env.WHATSAPP_IG || '',
    contentAngles: [
      'Super Eagles passion — Igbo communities produce many Nigeria internationals',
      'London + Houston Igbo diaspora is enormous and football-obsessed',
      'Comedy + football format goes viral instantly in Igbo communities',
      'Business-oriented culture appreciates DFS/prediction monetization'
    ],
    culturalNote: 'Igbo communities have very strong WhatsApp group culture. Content spreads through "Igbo Landing" networks in diaspora.',
    hashtag: '#WC2026 #SuperEagles #IgboNation',
    goalReaction: '⚽ GOOOAL! Super Eagles! 🦅🇳🇬',
    competition: 'near-zero',
    monetization: { affiliates: ['Bet9ja', 'Sportybet', 'Binance (crypto popular in Nigeria)'], avgCPM: 0.6 }
  },

  so: {
    name: 'Somali',
    nativeName: 'Soomaali',
    tier: 1,
    speakers: 22_000_000,
    region: 'Somalia + Kenya + Ethiopia + massive diaspora',
    countries: ['Somalia', 'Kenya', 'Ethiopia', 'UK', 'USA (Minnesota)', 'Canada', 'Norway', 'Sweden', 'Netherlands'],
    wcTeams: [],
    platforms: { primary: ['Telegram', 'Facebook', 'TikTok', 'YouTube'], secondary: ['Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_SO || '',
    whatsappChannel: process.env.WHATSAPP_SO || '',
    contentAngles: [
      'Somali diaspora in UK (Cardiff, London), USA (Minneapolis/Saint Paul), Canada — 2M+ very online people',
      'Football = community identity for diaspora worldwide',
      'Minneapolis-Saint Paul has the largest Somali diaspora outside East Africa',
      'Zero WC content exists in Somali language anywhere'
    ],
    culturalNote: 'The Somali diaspora is among the most football-passionate globally. UK Somali community follows Premier League obsessively and transfers that energy to WC.',
    hashtag: '#WC2026 #Football #Soomaali',
    goalReaction: '⚽ GOL! GOL! GOL! 🔥',
    competition: 'zero',
    monetization: { affiliates: ['bet365 UK (diaspora)', 'VPN affiliates', 'Western Union (remittance connection)'], avgCPM: 0.8 }
  },

  ln: {
    name: 'Lingala',
    nativeName: 'Lingála',
    tier: 2,
    speakers: 45_000_000,
    region: 'DR Congo + Republic of Congo + Angola',
    countries: ['DR Congo', 'Republic of Congo', 'Angola', 'Belgium (diaspora)', 'France (diaspora)'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'WhatsApp', 'YouTube', 'TikTok'], secondary: ['Telegram'] },
    telegramChannel: process.env.TELEGRAM_LN || '',
    whatsappChannel: process.env.WHATSAPP_LN || '',
    contentAngles: [
      'Congo has a massive football culture — TP Mazembe is one of Africa\'s biggest clubs',
      'DR Congo regularly produces top players for European leagues',
      'Belgian/French Congolese diaspora is digitally very active',
      'Lingala music + football crossover creates viral content opportunities'
    ],
    culturalNote: 'Lingala is the language of Kinshasa\'s streets and Congolese music globally. Football + Lingala content crosses over well with Afrobeat/Congolese music audience.',
    hashtag: '#WC2026 #Football #Congo',
    goalReaction: '⚽ MBUTA GOL! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['1xBet Africa', 'bet365', 'Orange Money affiliates'], avgCPM: 0.4 }
  },

  om: {
    name: 'Oromo',
    nativeName: 'Afaan Oromoo',
    tier: 2,
    speakers: 40_000_000,
    region: 'Ethiopia (Oromia region)',
    countries: ['Ethiopia', 'USA (diaspora)'],
    wcTeams: [],
    platforms: { primary: ['Telegram', 'Facebook', 'YouTube'], secondary: ['TikTok'] },
    telegramChannel: process.env.TELEGRAM_OM || '',
    whatsappChannel: process.env.WHATSAPP_OM || '',
    contentAngles: ['40M speakers, zero WC sports content in Oromo language', 'Ethiopia\'s largest ethnic group'],
    culturalNote: 'Completely untapped. Oromo-language content is extremely rare on any topic.',
    hashtag: '#WC2026 #Kubbaa #Oromia',
    goalReaction: '⚽ Goooolii! 🔥',
    competition: 'zero',
    monetization: { affiliates: ['bet365', '1xBet'], avgCPM: 0.3 }
  },

  ber: {
    name: 'Amazigh / Berber (Tamazight)',
    nativeName: 'ⵜⴰⵎⴰⵣⵉⵖⵜ',
    tier: 1,
    speakers: 30_000_000,
    region: 'Morocco + Algeria + Libya + diaspora in France/Belgium/Netherlands',
    countries: ['Morocco', 'Algeria', 'Libya', 'France', 'Belgium', 'Netherlands'],
    wcTeams: ['Morocco'],
    platforms: { primary: ['YouTube', 'TikTok', 'Facebook', 'Instagram', 'Telegram'], secondary: ['Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_BER || '',
    whatsappChannel: process.env.WHATSAPP_BER || '',
    contentAngles: [
      'Morocco in WC 2026 — Amazigh pride is ENORMOUS (Ait-Nouri, Mazraoui, Aguerd are Amazigh)',
      'Atlas Lions = Imazighen lions — identity angle',
      'European North African diaspora (France/Belgium/Netherlands) = 3M+ very online people',
      'Morocco\'s 2022 semi-final run created unprecedented Amazigh football content demand'
    ],
    culturalNote: 'The Amazigh identity revival means Tamazight content is deeply meaningful. Morocco\'s WC success created massive demand. Many Atlas Lions players publicly identify as Amazigh.',
    hashtag: '#WC2026 #AtlasLions #Amazigh #Maroc',
    goalReaction: '⚽ AGOOOOAL! Atlas Lions! 🦁🇲🇦⵿',
    competition: 'zero',
    monetization: { affiliates: ['bet365', 'Unibet (French diaspora)', 'VPN affiliates'], avgCPM: 1.2 }
  },

  af: {
    name: 'Afrikaans',
    nativeName: 'Afrikaans',
    tier: 1,
    speakers: 7_000_000,
    region: 'South Africa + Namibia',
    countries: ['South Africa', 'Namibia', 'Netherlands (diaspora)'],
    wcTeams: ['South Africa'],
    platforms: { primary: ['Facebook', 'Instagram', 'YouTube', 'Twitter/X'], secondary: ['Telegram', 'TikTok'] },
    telegramChannel: process.env.TELEGRAM_AF || '',
    whatsappChannel: process.env.WHATSAPP_AF || '',
    contentAngles: [
      'South Africa qualified — Bafana Bafana first WC since 2010 they hosted',
      'Afrikaans-speaking SA communities are very digitally active',
      'High CPM — South Africa ad market is strong',
      'Cross-promote with English and Zulu SA channels'
    ],
    culturalNote: 'Afrikaans speakers in SA tend to have high disposable income and very high digital engagement. Sports betting is mainstream and high-value.',
    hashtag: '#WC2026 #BafanaBafana #Suid-Afrika',
    goalReaction: '⚽ DOELPUNT! Bafana Bafana! 🇿🇦',
    competition: 'near-zero',
    monetization: { affiliates: ['Betway SA', 'Hollywoodbets', 'SuperSport streaming ($$$)'], avgCPM: 2.5 }
  },

  ki: {
    name: 'Kinyarwanda',
    nativeName: 'Ikinyarwanda',
    tier: 2,
    speakers: 12_000_000,
    region: 'Rwanda + Uganda + DR Congo',
    countries: ['Rwanda', 'Uganda', 'DR Congo'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'Twitter/X', 'YouTube', 'Telegram'], secondary: ['TikTok'] },
    telegramChannel: process.env.TELEGRAM_KI || '',
    whatsappChannel: process.env.WHATSAPP_KI || '',
    contentAngles: ['Rwanda has a rapidly growing tech/digital economy', 'Football is the #1 sport', 'Zero WC content in Kinyarwanda'],
    culturalNote: 'Rwanda\'s "Silicon Valley of Africa" reputation means growing digital ad market.',
    hashtag: '#WC2026 #Umupira #Rwanda',
    goalReaction: '⚽ GOOOLI! 🔥',
    competition: 'zero',
    monetization: { affiliates: ['bet365', 'Sportybet'], avgCPM: 0.4 }
  },

  // ══════════════════════════════════════════════════════════
  // EUROPE — ADDITIONAL
  // ══════════════════════════════════════════════════════════

  pl: {
    name: 'Polish',
    nativeName: 'Polski',
    tier: 2,
    speakers: 45_000_000,
    region: 'Poland + 2M in UK + diaspora in USA/Canada/Germany',
    countries: ['Poland', 'UK', 'USA', 'Canada', 'Germany', 'Ireland'],
    wcTeams: ['Poland'],
    platforms: { primary: ['YouTube', 'TikTok', 'Instagram', 'Twitter/X', 'Facebook'], secondary: ['Telegram', 'Wykop (Polish Reddit)'] },
    telegramChannel: process.env.TELEGRAM_PL || '',
    whatsappChannel: process.env.WHATSAPP_PL || '',
    contentAngles: [
      'Poland qualified — Lewandowski\'s potentially final World Cup',
      '2M Poles in UK = massive diaspora audience that consumes English-adjacent content',
      'Polish YouTube football scene is well-developed — compete with quality, not quantity',
      'Wykop.pl (Polish Reddit) has huge football community'
    ],
    culturalNote: 'Poles have an intense football culture. Lewandowski is treated like royalty. Polish diaspora in UK is enormously active online.',
    hashtag: '#MŚ2026 #Polska #Lewandowski',
    goalReaction: '⚽ GOL! Polska! 🇵🇱⚪🔴',
    competition: 'medium',
    monetization: { affiliates: ['Fortuna (PL)', 'bet365', 'STS', 'DAZN Poland'], avgCPM: 1.8 }
  },

  ro: {
    name: 'Romanian',
    nativeName: 'Română',
    tier: 2,
    speakers: 24_000_000,
    region: 'Romania + Moldova + 3M diaspora in Western Europe',
    countries: ['Romania', 'Moldova', 'Italy', 'Spain', 'UK', 'Germany', 'France'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'YouTube', 'TikTok', 'Instagram'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_RO || '',
    whatsappChannel: process.env.WHATSAPP_RO || '',
    contentAngles: [
      '3M Romanians in Western Europe are passionate football fans',
      'Romania didn\'t qualify but fans watch obsessively',
      'Romanian YouTube football community is very engaged',
      'Hagi nostalgia angle + current Romanian players in European leagues'
    ],
    culturalNote: 'Romanian diaspora in Italy/Spain is enormous. These fans follow their adopted country\'s WC team as well as neutrally watching all games.',
    hashtag: '#WC2026 #Fotbal #Romania',
    goalReaction: '⚽ GOL! Fotbal de calitate! 🔥',
    competition: 'low',
    monetization: { affiliates: ['bet365', 'Unibet', 'Superbet Romania'], avgCPM: 1.0 }
  },

  cs: {
    name: 'Czech',
    nativeName: 'Čeština',
    tier: 2,
    speakers: 10_000_000,
    region: 'Czech Republic + Slovakia (mutual intelligibility)',
    countries: ['Czech Republic', 'Slovakia'],
    wcTeams: ['Czech Republic'],
    platforms: { primary: ['YouTube', 'Facebook', 'Instagram', 'TikTok'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_CS || '',
    whatsappChannel: process.env.WHATSAPP_CS || '',
    contentAngles: [
      'Czech Republic qualified — strong fan culture',
      'Mutually intelligible with Slovak — doubles the effective audience',
      'Czech football history — Euro 1996 final, Euro 2004 contenders'
    ],
    culturalNote: 'Czech + Slovak together = 15M people. Both countries have strong football cultures and decent digital ad CPMs.',
    hashtag: '#WC2026 #Fotbal #Česko',
    goalReaction: '⚽ GÓL! Česko! 🇨🇿',
    competition: 'medium',
    monetization: { affiliates: ['Tipsport', 'Fortuna', 'bet365'], avgCPM: 1.5 }
  },

  hr: {
    name: 'Croatian / Serbian / Bosnian',
    nativeName: 'Hrvatski / Srpski / Bosanski',
    tier: 2,
    speakers: 18_000_000,
    region: 'Balkans + large diaspora in Germany/Austria/USA/Australia',
    countries: ['Croatia', 'Serbia', 'Bosnia', 'Montenegro', 'Slovenia', 'Germany (diaspora)', 'Austria (diaspora)', 'USA', 'Australia'],
    wcTeams: ['Croatia', 'Serbia'],
    platforms: { primary: ['YouTube', 'Facebook', 'Instagram', 'TikTok'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_HR || '',
    whatsappChannel: process.env.WHATSAPP_HR || '',
    contentAngles: [
      'Croatia is always a WC contender — 2018 finalists, 2022 semi-finalists',
      'Modric possibly last World Cup — huge emotional narrative',
      'Serbia also qualified — Balkan rivalry adds engagement',
      'Croatian diaspora in Germany/Austria/Australia = millions of passionate fans'
    ],
    culturalNote: 'Croatian, Serbian, and Bosnian are mutually intelligible. One channel reaches all three. Croatian diaspora is among the most passionate football diasporas globally.',
    hashtag: '#WC2026 #Hrvatska #Srbija #Vatreni',
    goalReaction: '⚽ GOOOL! Vatreni! 🇭🇷🔥',
    competition: 'medium',
    monetization: { affiliates: ['Meridianbet', 'bet365', 'ADMIRAL (Balkans)'], avgCPM: 1.2 }
  },

  el: {
    name: 'Greek',
    nativeName: 'Ελληνικά',
    tier: 2,
    speakers: 13_000_000,
    region: 'Greece + Cyprus + diaspora in Australia/USA/UK/Germany',
    countries: ['Greece', 'Cyprus', 'Australia', 'USA', 'UK', 'Germany'],
    wcTeams: [],
    platforms: { primary: ['YouTube', 'Facebook', 'Instagram', 'TikTok'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_EL || '',
    whatsappChannel: process.env.WHATSAPP_EL || '',
    contentAngles: [
      'Greek diaspora in Australia (Melbourne) is the 3rd-largest Greek population in the world',
      'Greece didn\'t qualify but fans are passionate and watch everything',
      'Euro 2004 victory still defines Greek football identity',
      'Greek-Australians + Greek-Americans = large digitally active communities'
    ],
    culturalNote: 'The Greek diaspora in Australia and USA is enormous and extremely football-passionate. High CPMs in Australia.',
    hashtag: '#WC2026 #Ποδόσφαιρο #Ελλάδα',
    goalReaction: '⚽ ΓΚΟΛ! Τι ωραίο! 🔥',
    competition: 'medium',
    monetization: { affiliates: ['bet365', 'Novibet (GR)', 'Stoiximan'], avgCPM: 2.0 }
  },

  hu: {
    name: 'Hungarian',
    nativeName: 'Magyar',
    tier: 2,
    speakers: 14_000_000,
    region: 'Hungary + Romanian + Slovak Hungarian minorities + diaspora',
    countries: ['Hungary', 'Romania (Transylvania)', 'Slovakia', 'UK (diaspora)'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'YouTube', 'Instagram', 'TikTok'], secondary: ['Telegram'] },
    telegramChannel: process.env.TELEGRAM_HU || '',
    whatsappChannel: process.env.WHATSAPP_HU || '',
    contentAngles: ['Hungary didn\'t qualify but has passionate football history (1954 Golden Team)', 'Puskás legacy — Hungarian football obsession', 'UK Hungarian diaspora growing fast post-2010'],
    culturalNote: 'Hungary has deep football passion despite recent struggles. The Puskás Award keeps Hungarian football globally visible.',
    hashtag: '#WC2026 #Futball #Magyarország',
    goalReaction: '⚽ GÓL! Bravo! 🔥',
    competition: 'low',
    monetization: { affiliates: ['bet365', 'Tippmix (HU)'], avgCPM: 1.2 }
  },

  sv: {
    name: 'Swedish / Nordic',
    nativeName: 'Svenska',
    tier: 2,
    speakers: 10_000_000,
    region: 'Sweden + Norwegian/Danish crossover',
    countries: ['Sweden', 'Norway', 'Denmark (adjacent)'],
    wcTeams: [],
    platforms: { primary: ['YouTube', 'Instagram', 'TikTok', 'Twitter/X'], secondary: ['Telegram'] },
    telegramChannel: process.env.TELEGRAM_SV || '',
    whatsappChannel: process.env.WHATSAPP_SV || '',
    contentAngles: [
      'Zlatan Ibrahimovic legacy still defines Swedish football',
      'Sweden didn\'t qualify but Swedes watch everything',
      'Highest CPMs in the world — Scandinavian digital ad market',
      'Norwegian and Danish audiences understand Swedish — effectively 20M+ reach'
    ],
    culturalNote: 'Scandinavian CPMs are the highest globally ($5-8 for Sweden). Smaller audience but premium monetization.',
    hashtag: '#WC2026 #Fotboll #Sverige',
    goalReaction: '⚽ MÅL! Underbart! 🇸🇪',
    competition: 'medium',
    monetization: { affiliates: ['bet365', 'Unibet (Swedish)', 'DraftKings EU'], avgCPM: 5.5 }
  },

  ca: {
    name: 'Catalan',
    nativeName: 'Català',
    tier: 2,
    speakers: 10_000_000,
    region: 'Catalonia (Spain) + Valencia + Balearic Islands',
    countries: ['Spain'],
    wcTeams: ['Spain'],
    platforms: { primary: ['Instagram', 'YouTube', 'TikTok', 'Twitter/X', 'Facebook'], secondary: ['Telegram'] },
    telegramChannel: process.env.TELEGRAM_CA || '',
    whatsappChannel: process.env.WHATSAPP_CA || '',
    contentAngles: [
      'FC Barcelona is the world\'s most-followed club — Catalan = football prestige',
      'Spain qualified — Catalan players in national team (Gavi, Pedri, Yamal all Barça)',
      'Catalan identity + football is deeply entwined',
      'Content in Catalan signals cultural respect = massive loyalty'
    ],
    culturalNote: 'Creating Catalan-language WC content is a strong cultural statement that builds deep loyalty. Catalan speakers are highly educated and have high incomes — premium CPMs.',
    hashtag: '#MónFutbol2026 #WC2026 #Barça #Espanya',
    goalReaction: '⚽ GOL! Quin gol! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['bet365', 'Codere España', 'Betway España'], avgCPM: 3.5 }
  },

  sq: {
    name: 'Albanian',
    nativeName: 'Shqip',
    tier: 2,
    speakers: 7_500_000,
    region: 'Albania + Kosovo + North Macedonia + diaspora in Italy/Germany/Switzerland',
    countries: ['Albania', 'Kosovo', 'North Macedonia', 'Italy', 'Germany', 'Switzerland', 'UK'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'Instagram', 'YouTube', 'TikTok'], secondary: ['Telegram'] },
    telegramChannel: process.env.TELEGRAM_SQ || '',
    whatsappChannel: process.env.WHATSAPP_SQ || '',
    contentAngles: [
      'Albanians + Kosovars have huge diaspora in Switzerland, Germany, Italy — all football-mad',
      'Albanian players in Swiss and German leagues are prominent',
      'Kosovo independence + Albania combined = strong national pride angle',
      'Swiss and German Albanians have high disposable income'
    ],
    culturalNote: 'Albanian diaspora in Switzerland is massive (200K+). Swiss Albanians have contributed many players to the Swiss national team. Football = national pride.',
    hashtag: '#WC2026 #Futboll #Shqipëria',
    goalReaction: '⚽ GOL! Shqipëria! 🦅🇦🇱',
    competition: 'near-zero',
    monetization: { affiliates: ['bet365', 'Unibet CH (diaspora)'], avgCPM: 1.5 }
  },

  // ══════════════════════════════════════════════════════════
  // SOUTH ASIA — ADDITIONAL (massive diaspora markets)
  // ══════════════════════════════════════════════════════════

  ur: {
    name: 'Urdu',
    nativeName: 'اردو',
    tier: 1,
    speakers: 230_000_000,
    region: 'Pakistan + India (Urdu speakers) + 2M in UK + massive diaspora globally',
    countries: ['Pakistan', 'India', 'UK', 'UAE', 'Saudi Arabia', 'USA', 'Canada'],
    wcTeams: [],
    platforms: { primary: ['YouTube', 'Facebook', 'WhatsApp', 'TikTok', 'Instagram'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_UR || '',
    whatsappChannel: process.env.WHATSAPP_UR || '',
    contentAngles: [
      'UK Pakistani community is enormously football-passionate — Premier League, then WC',
      '2M Pakistanis in UK = high-CPM audience with intense football engagement',
      'Cricket is #1 but WC creates football fever even in Pakistan',
      'UAE/Saudi Pakistani workers = large, affluent, football-watching diaspora'
    ],
    culturalNote: 'UK Pakistanis are among the most passionate Premier League fans. Many support specific PL clubs, and that passion transfers to WC. WhatsApp groups are key distribution.',
    hashtag: '#WC2026 #فٹبال #Pakistan',
    goalReaction: '⚽ گول! کیا شاندار! 🔥',
    competition: 'low',
    monetization: { affiliates: ['bet365 UK (diaspora)', 'DraftKings (USA diaspora)', 'VPN affiliates'], avgCPM: 1.5 }
  },

  pa: {
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ / پنجابی',
    tier: 2,
    speakers: 100_000_000,
    region: 'Punjab (India + Pakistan) + UK + Canada + USA diaspora',
    countries: ['India (Punjab)', 'Pakistan (Punjab)', 'UK', 'Canada', 'USA'],
    wcTeams: [],
    platforms: { primary: ['YouTube', 'Facebook', 'Instagram', 'TikTok', 'WhatsApp'], secondary: ['Telegram'] },
    telegramChannel: process.env.TELEGRAM_PA || '',
    whatsappChannel: process.env.WHATSAPP_PA || '',
    contentAngles: [
      'Brampton + Surrey + Birmingham have enormous Punjabi communities — premium CPMs',
      'Punjabi YouTube is one of the fastest-growing language verticals on the platform',
      'Football is rapidly growing in Punjab as cricket viewership fragments',
      'Bhangra + football crossover content goes viral naturally'
    ],
    culturalNote: 'Canadian Punjabi community (Brampton, Surrey) is enormous and extremely digitally active. UK Punjabi community in Birmingham/Wolverhampton is similarly large. High disposable income.',
    hashtag: '#WC2026 #ਫੁੱਟਬਾਲ #Punjabi',
    goalReaction: '⚽ ਗੋਲ! ਕੀ ਸ਼ਾਨਦਾਰ! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['bet365 CA/UK (diaspora)', 'DraftKings Canada', 'Amazon CA/UK'], avgCPM: 2.5 }
  },

  ta: {
    name: 'Tamil',
    nativeName: 'தமிழ்',
    tier: 2,
    speakers: 80_000_000,
    region: 'Tamil Nadu (India) + Sri Lanka + Singapore + UK + Canada + Malaysia + UAE',
    countries: ['India', 'Sri Lanka', 'Singapore', 'UK', 'Canada', 'Malaysia', 'UAE', 'South Africa'],
    wcTeams: [],
    platforms: { primary: ['YouTube', 'Facebook', 'Instagram', 'TikTok', 'WhatsApp'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_TA || '',
    whatsappChannel: process.env.WHATSAPP_TA || '',
    contentAngles: [
      'Tamil diaspora in UK (Wembley area), Canada (Scarborough), Singapore is huge and wealthy',
      'Tamil YouTube is one of the fastest-growing language verticals globally',
      'Chennai has a rapidly growing football culture',
      'Sri Lankan Tamil diaspora + Indian Tamil = enormous combined audience'
    ],
    culturalNote: 'Tamil is one of the world\'s oldest languages and has intense cultural pride. Tamil YouTube creators get millions of views. Very high CPMs in Singapore and UK.',
    hashtag: '#WC2026 #கால்பந்து #Tamil',
    goalReaction: '⚽ கோல்! அருமை! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['bet365 UK/SG', 'Dream11 India', 'Amazon IN/UK'], avgCPM: 2.0 }
  },

  gu: {
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    tier: 2,
    speakers: 60_000_000,
    region: 'Gujarat (India) + UK + USA + East Africa diaspora',
    countries: ['India', 'UK', 'USA', 'Kenya', 'Uganda', 'South Africa', 'Canada'],
    wcTeams: [],
    platforms: { primary: ['WhatsApp', 'YouTube', 'Facebook', 'Instagram'], secondary: ['Telegram', 'TikTok'] },
    telegramChannel: process.env.TELEGRAM_GU || '',
    whatsappChannel: process.env.WHATSAPP_GU || '',
    contentAngles: [
      'Leicester, Harrow, Wembley have the largest Gujarati communities outside India',
      'UK Gujarati community has very high average income — premium CPMs',
      'Football is growing rapidly in Gujarat as a secondary sport',
      'WhatsApp is the dominant platform for Gujarati community communication'
    ],
    culturalNote: 'Gujarati communities in UK and USA are among the wealthiest diaspora groups. Very high CPMs. WhatsApp groups are the primary communication channel.',
    hashtag: '#WC2026 #ફૂટબૉલ #Gujarati',
    goalReaction: '⚽ ગોલ! અદ્ભુત! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['bet365 UK', 'Amazon UK', 'DraftKings USA (diaspora)'], avgCPM: 3.0 }
  },

  mr: {
    name: 'Marathi',
    nativeName: 'मराठी',
    tier: 2,
    speakers: 95_000_000,
    region: 'Maharashtra (India) — includes Mumbai',
    countries: ['India (Maharashtra)'],
    wcTeams: [],
    platforms: { primary: ['YouTube', 'Facebook', 'Instagram', 'TikTok', 'WhatsApp'], secondary: ['Telegram'] },
    telegramChannel: process.env.TELEGRAM_MR || '',
    whatsappChannel: process.env.WHATSAPP_MR || '',
    contentAngles: ['Mumbai is India\'s most football-aware city', '95M speakers, essentially zero WC content in Marathi', 'Growing middle class with strong digital engagement'],
    culturalNote: 'Mumbai is India\'s most cosmopolitan city. Maharashtra has growing football culture, especially in Mumbai.',
    hashtag: '#WC2026 #फुटबॉल #Marathi',
    goalReaction: '⚽ गोल! अप्रतिम! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['Dream11', 'bet365 India', 'Amazon IN'], avgCPM: 0.7 }
  },

  te: {
    name: 'Telugu',
    nativeName: 'తెలుగు',
    tier: 2,
    speakers: 85_000_000,
    region: 'Andhra Pradesh + Telangana (India) + USA diaspora',
    countries: ['India', 'USA (Silicon Valley + New Jersey)'],
    wcTeams: [],
    platforms: { primary: ['YouTube', 'Facebook', 'Instagram', 'TikTok', 'WhatsApp'], secondary: ['Telegram'] },
    telegramChannel: process.env.TELEGRAM_TE || '',
    whatsappChannel: process.env.WHATSAPP_TE || '',
    contentAngles: ['Telugu YouTube is massive — billions of views/month', 'Telugu-American tech diaspora (high income) in Silicon Valley/NJ', 'Football growing fast in Hyderabad'],
    culturalNote: 'Telugu YouTube community is one of the most active in India. Telugu diaspora in USA is highly educated and wealthy.',
    hashtag: '#WC2026 #ఫుట్‌బాల్ #Telugu',
    goalReaction: '⚽ గోల్! అద్భుతం! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['Dream11', 'Amazon US/IN', 'DraftKings (USA diaspora)'], avgCPM: 1.8 }
  },

  ml: {
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    tier: 1,
    speakers: 38_000_000,
    region: 'Kerala (India) + 3M in Gulf + 500K in UK + diaspora globally',
    countries: ['India (Kerala)', 'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'UK', 'USA', 'Canada'],
    wcTeams: [],
    platforms: { primary: ['YouTube', 'Facebook', 'WhatsApp', 'Instagram', 'TikTok'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_ML || '',
    whatsappChannel: process.env.WHATSAPP_ML || '',
    contentAngles: [
      'Kerala has the highest football passion of any Indian state — it is the "God\'s Own Country of football"',
      'Kerala has ISL (Indian Super League) clubs and a deep football culture since 1970s',
      '3M Malayalis in Gulf states (UAE/Qatar/Saudi) watch WC with huge intensity — they\'re physically near the region',
      'YouTube Malayalam is one of India\'s fastest growing language channels',
      'Malayali fans in Qatar actually ATTENDED 2022 WC — direct connection'
    ],
    culturalNote: 'Kerala is unique in India — football is genuinely the #1 sport, surpassing cricket in many districts. The Gulf Malayali diaspora watched WC 2022 in person. This is the most football-literate Indian language audience.',
    hashtag: '#WC2026 #ഫുട്ബോൾ #Kerala #Malappuram',
    goalReaction: '⚽ ഗോൾ! അടിപൊളി! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['bet365 Gulf', 'Dream11 India', 'Gulf streaming services'], avgCPM: 1.2 }
  },

  ne: {
    name: 'Nepali',
    nativeName: 'नेपाली',
    tier: 2,
    speakers: 30_000_000,
    region: 'Nepal + Indian Himalayas + 500K in UK + diaspora globally',
    countries: ['Nepal', 'India (Sikkim/Darjeeling/Northeast)', 'UK', 'USA', 'Australia', 'Hong Kong', 'Malaysia'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'YouTube', 'TikTok', 'Instagram'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_NE || '',
    whatsappChannel: process.env.WHATSAPP_NE || '',
    contentAngles: ['Football is Nepal\'s #1 sport', 'UK Nepali community (Gurkha veterans + new diaspora)', 'Zero WC content in Nepali language'],
    culturalNote: 'Football is genuinely Nepal\'s most popular sport, beating cricket. Almost no quality WC content exists in Nepali.',
    hashtag: '#WC2026 #फुटबल #Nepal',
    goalReaction: '⚽ गोल! अद्भुत! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['bet365', '1xBet', 'VPN affiliates'], avgCPM: 0.5 }
  },

  si: {
    name: 'Sinhala',
    nativeName: 'සිංහල',
    tier: 2,
    speakers: 16_000_000,
    region: 'Sri Lanka + diaspora in UK/Canada/Australia',
    countries: ['Sri Lanka', 'UK', 'Canada', 'Australia'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'YouTube', 'Instagram', 'WhatsApp'], secondary: ['Telegram', 'TikTok'] },
    telegramChannel: process.env.TELEGRAM_SI || '',
    whatsappChannel: process.env.WHATSAPP_SI || '',
    contentAngles: ['Football growing in Sri Lanka as cricket alternative', 'UK/Australian Sinhalese diaspora', 'Zero WC content in Sinhala'],
    culturalNote: 'Sri Lanka traditionally cricket-dominated but WC creates football interest.',
    hashtag: '#WC2026 #පාපන්දු #SriLanka',
    goalReaction: '⚽ ගෝල්! 🔥',
    competition: 'zero',
    monetization: { affiliates: ['bet365', '1xBet'], avgCPM: 0.6 }
  },

  // ══════════════════════════════════════════════════════════
  // EAST / SOUTHEAST ASIA — ADDITIONAL
  // ══════════════════════════════════════════════════════════

  yue: {
    name: 'Cantonese',
    nativeName: '廣東話',
    tier: 2,
    speakers: 80_000_000,
    region: 'Hong Kong + Guangdong (China) + global diaspora',
    countries: ['Hong Kong', 'Macau', 'China (Guangdong)', 'UK (London Chinatown)', 'Canada (Vancouver/Toronto)', 'USA', 'Australia', 'Malaysia', 'Singapore'],
    wcTeams: [],
    platforms: { primary: ['YouTube', 'Facebook', 'WhatsApp', 'Instagram', 'TikTok'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_YUE || '',
    whatsappChannel: process.env.WHATSAPP_YUE || '',
    contentAngles: [
      'Hong Kong is one of Asia\'s most football-passionate cities',
      'Cantonese diaspora in UK/Canada/Australia is enormous and wealthy',
      'Separate from Mandarin — Cantonese speakers prefer Cantonese content',
      'Vancouver/Toronto Chinese communities are massive and football-watching'
    ],
    culturalNote: 'Cantonese and Mandarin are NOT mutually intelligible in spoken form. Cantonese diaspora strongly prefers Cantonese content. Very high CPMs in HK/UK/Canada/Australia.',
    hashtag: '#WC2026 #世界盃 #Cantonese #HK',
    goalReaction: '⚽ 入波喇! 正! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['bet365 HK', 'Ladbrokes Australia', 'DraftKings Canada (diaspora)'], avgCPM: 3.5 }
  },

  km: {
    name: 'Khmer',
    nativeName: 'ភាសាខ្មែរ',
    tier: 2,
    speakers: 17_000_000,
    region: 'Cambodia + diaspora in USA/Australia/France',
    countries: ['Cambodia', 'USA', 'Australia', 'France'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'YouTube', 'TikTok'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_KM || '',
    whatsappChannel: process.env.WHATSAPP_KM || '',
    contentAngles: ['Football is #1 sport in Cambodia', 'Cambodian-Americans and Cambodian-Australians are diaspora audiences', 'Zero quality WC content in Khmer'],
    culturalNote: 'Facebook is absolutely dominant in Cambodia. Football is the clear #1 sport.',
    hashtag: '#WC2026 #បាល់ទាត់ #Cambodia',
    goalReaction: '⚽ បង្គោល! ល្អណាស់! 🔥',
    competition: 'zero',
    monetization: { affiliates: ['1xBet', 'bet365', 'VPN affiliates'], avgCPM: 0.5 }
  },

  ku: {
    name: 'Kurdish (Kurmanji)',
    nativeName: 'Kurdî',
    tier: 2,
    speakers: 30_000_000,
    region: 'Turkey + Iraq + Syria + Iran + diaspora in Germany/Sweden/UK',
    countries: ['Turkey', 'Iraq', 'Syria', 'Iran', 'Germany', 'Sweden', 'UK', 'Netherlands'],
    wcTeams: [],
    platforms: { primary: ['YouTube', 'Facebook', 'Instagram', 'TikTok', 'Telegram'], secondary: ['Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_KU || '',
    whatsappChannel: process.env.WHATSAPP_KU || '',
    contentAngles: [
      'Kurdish diaspora in Germany/Sweden is enormous (500K+ each)',
      'Football = rare space free of political tension for Kurdish identity',
      'Kurdish players in European leagues (several in Bundesliga)',
      'Zero quality Kurdish WC content exists anywhere'
    ],
    culturalNote: 'Kurdish diaspora in Europe is massive and passionate about football. It\'s one of the few topics that unites Kurds across political divides.',
    hashtag: '#WC2026 #Futbol #Kurdistan',
    goalReaction: '⚽ GOL! Bijî! 🔥',
    competition: 'zero',
    monetization: { affiliates: ['bet365 DE/SE (diaspora)', 'VPN affiliates (important in Turkey/Iran)'], avgCPM: 1.5 }
  },

  uz: {
    name: 'Uzbek / Central Asian',
    nativeName: "O'zbek",
    tier: 2,
    speakers: 50_000_000,
    region: 'Uzbekistan + Kazakhstan + Kyrgyzstan + Tajikistan + Russia diaspora',
    countries: ['Uzbekistan', 'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Russia (diaspora)'],
    wcTeams: [],
    platforms: { primary: ['Telegram', 'YouTube', 'TikTok', 'Instagram'], secondary: ['Facebook', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_UZ || '',
    whatsappChannel: process.env.WHATSAPP_UZ || '',
    contentAngles: [
      'Uzbekistan has a booming football culture — ranked increasingly well in Asia',
      'Telegram is the #1 platform across all Central Asian countries',
      'Central Asian migrant workers in Russia (5M+) watch WC passionately',
      'Zero quality Central Asian WC content exists'
    ],
    culturalNote: 'Telegram dominates across Central Asia — even more than in the West. Uzbek and Kazakh are both Turkic and have partial mutual intelligibility.',
    hashtag: '#WC2026 #Futbol #Uzbekistan #CentralAsia',
    goalReaction: '⚽ GOL! Ajoyib! 🔥',
    competition: 'zero',
    monetization: { affiliates: ['1xBet (huge in CentralAsia)', 'VPN affiliates', 'bet365'], avgCPM: 0.5 }
  },

  // ══════════════════════════════════════════════════════════
  // AMERICAS — ADDITIONAL
  // ══════════════════════════════════════════════════════════

  ht: {
    name: 'Haitian Creole',
    nativeName: 'Kreyòl ayisyen',
    tier: 2,
    speakers: 12_000_000,
    region: 'Haiti + 1.5M in USA (Florida, New York) + 500K in Canada (Montreal)',
    countries: ['Haiti', 'USA', 'Canada', 'France'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'YouTube', 'TikTok', 'Instagram', 'WhatsApp'], secondary: ['Telegram', 'Twitter/X'] },
    telegramChannel: process.env.TELEGRAM_HT || '',
    whatsappChannel: process.env.WHATSAPP_HT || '',
    contentAngles: [
      'Haitian diaspora in Miami, New York, Montreal is enormous and digitally active',
      'Football (soccer) is huge in Haiti — historical tradition',
      'Florida Haitians are high-income — premium CPMs for US-based ads',
      'Zero quality WC content in Haitian Creole'
    ],
    culturalNote: 'Haiti is the most football-passionate Caribbean nation. Miami/NY/Montreal Haitian communities are very tight-knit and social media active. High-CPM US market.',
    hashtag: '#WC2026 #Foutbol #Haiti',
    goalReaction: '⚽ GOOOOL! Bèl kout! 🔥',
    competition: 'zero',
    monetization: { affiliates: ['DraftKings (USA diaspora)', 'FanDuel', 'FuboTV USA'], avgCPM: 2.5 }
  },

  jam: {
    name: 'Jamaican Patois / Caribbean Creole',
    nativeName: 'Jamaican Patois',
    tier: 2,
    speakers: 3_000_000,
    region: 'Jamaica + 1M UK (London) + 600K USA + 350K Canada',
    countries: ['Jamaica', 'UK', 'USA', 'Canada', 'Trinidad', 'Barbados', 'Guyana'],
    wcTeams: [],
    platforms: { primary: ['Instagram', 'TikTok', 'YouTube', 'Twitter/X', 'Facebook'], secondary: ['Telegram', 'WhatsApp'] },
    telegramChannel: process.env.TELEGRAM_JAM || '',
    whatsappChannel: process.env.WHATSAPP_JAM || '',
    contentAngles: [
      'Jamaica + Caribbean diaspora in UK/USA/Canada is enormously digitally active',
      'TikTok Caribbean football content goes massively viral',
      'Jamaican Reggae Boyz have qualified before — always in contention',
      'UK Black Caribbean audience = huge premium demographic for sportsbook affiliates'
    ],
    culturalNote: 'Jamaican Patois content on social media goes viral way beyond just Jamaican speakers. UK Black British community consumes this content. Very high energy, very shareable.',
    hashtag: '#WC2026 #ReggaeBoyz #Jamaica #Football',
    goalReaction: '⚽ GOOOAL! Big up di Reggae Boyz! 🇯🇲🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['bet365 UK', 'Ladbrokes UK', 'DraftKings USA (diaspora)'], avgCPM: 2.5 }
  },

  qu: {
    name: 'Quechua',
    nativeName: "Runasimi",
    tier: 2,
    speakers: 8_000_000,
    region: 'Peru + Bolivia + Ecuador + Colombia (Andes)',
    countries: ['Peru', 'Bolivia', 'Ecuador', 'Colombia', 'Argentina (northwest)'],
    wcTeams: ['Ecuador'],
    platforms: { primary: ['Facebook', 'WhatsApp', 'YouTube', 'TikTok'], secondary: ['Telegram'] },
    telegramChannel: process.env.TELEGRAM_QU || '',
    whatsappChannel: process.env.WHATSAPP_QU || '',
    contentAngles: [
      'Ecuador qualified — Andean nations follow La Tri intensely',
      'Cultural pride + football = deep identity connection',
      'Bolivia + Peru follow Ecuador closely (neighborly interest)',
      'ZERO WC content exists in Quechua — total first mover advantage'
    ],
    culturalNote: 'Creating Quechua WC content is a profound cultural statement. Indigenous pride + football is an extremely powerful combination in the Andes.',
    hashtag: '#WC2026 #PampaPichqa #Ecuador #Quechua',
    goalReaction: '⚽ GOOOL! Wiñan! 🎉🇪🇨',
    competition: 'zero',
    monetization: { affiliates: ['bet365 LATAM', '1xBet LATAM', 'Betano Ecuador'], avgCPM: 0.6 }
  },

  // ══════════════════════════════════════════════════════════
  // ADDITIONAL HIGH-VALUE LANGUAGES
  // ══════════════════════════════════════════════════════════

  ps: {
    name: 'Pashto',
    nativeName: 'پښتو',
    tier: 2,
    speakers: 50_000_000,
    region: 'Afghanistan + Pakistan (Khyber Pakhtunkhwa) + diaspora in UK/USA',
    countries: ['Afghanistan', 'Pakistan', 'UK', 'USA', 'Germany', 'Australia'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'YouTube', 'WhatsApp', 'TikTok'], secondary: ['Telegram'] },
    telegramChannel: process.env.TELEGRAM_PS || '',
    whatsappChannel: process.env.WHATSAPP_PS || '',
    contentAngles: ['Afghan/Pashtun diaspora in UK/USA is football-mad', 'Football = neutral unifying topic', 'Afghan diaspora growing fast globally after 2021'],
    culturalNote: 'Pashto diaspora in UK/Germany/USA is growing. Football is the sport that unites across political divides.',
    hashtag: '#WC2026 #فوتبال #Pashto',
    goalReaction: '⚽ گول! ښکلی! 🔥',
    competition: 'zero',
    monetization: { affiliates: ['bet365 UK/DE (diaspora)', 'VPN affiliates'], avgCPM: 1.0 }
  },

  mk: {
    name: 'Macedonian',
    nativeName: 'Македонски',
    tier: 3,
    speakers: 2_000_000,
    region: 'North Macedonia + diaspora in Australia/Canada/Germany',
    countries: ['North Macedonia', 'Australia', 'Canada', 'Germany'],
    wcTeams: [],
    platforms: { primary: ['Facebook', 'YouTube', 'Instagram'], secondary: ['Telegram', 'TikTok'] },
    telegramChannel: process.env.TELEGRAM_MK || '',
    whatsappChannel: process.env.WHATSAPP_MK || '',
    contentAngles: ['Small but passionate audience', 'Australian Macedonian diaspora is surprisingly large and digitally active', 'Elias Petros / Ezgjan Alioski — prominent players keep interest high'],
    culturalNote: 'Macedonian diaspora in Australia (Melbourne) is large relative to national population.',
    hashtag: '#WC2026 #Фудбал #Македонија',
    goalReaction: '⚽ ГОЛ! Браво! 🔥',
    competition: 'near-zero',
    monetization: { affiliates: ['Unibet AU (diaspora)', 'bet365'], avgCPM: 1.5 }
  }
};

// ── COMBINED PRIORITY LIST (all languages, all tiers) ────────
const ALL_LANGUAGE_CODES = [
  // Tier 1 — lowest competition first
  'sw', 'ha', 'zu', 'wo', 'tl', 'vi', 'my', 'am', 'ig', 'so', 'ber', 'af', 'ml',
  // Tier 2 — low competition, massive
  'hi', 'id', 'bn', 'th', 'fa', 'yo', 'ln', 'ur', 'pa', 'ta', 'gu', 'mr', 'te', 'ne',
  'pl', 'ro', 'cs', 'hr', 'el', 'hu', 'sv', 'ca', 'sq', 'yue', 'km', 'ku', 'uz', 'ht', 'jam', 'qu', 'ps', 'ki', 'si', 'om',
  // Tier 3 — qualified teams, higher CPMs
  'ko', 'ja', 'de', 'nl', 'it', 'tr', 'zh', 'uk', 'mk',
  // Tier 0 — already running
  'en', 'es', 'pt', 'fr', 'ar'
];

// Total unique speakers across all languages (rough, accounting for bilingualism)
const ESTIMATED_TOTAL_REACH_BILLION = 5.8;

console.log(`[languages-extended] ${Object.keys(LANGUAGES_EXTENDED).length} additional languages loaded`);
console.log(`[languages-extended] Combined with languages-config.js: ~${ALL_LANGUAGE_CODES.length} total languages`);
console.log(`[languages-extended] Estimated total reach: ~${ESTIMATED_TOTAL_REACH_BILLION}B speakers`);

module.exports = {
  LANGUAGES_EXTENDED,
  ALL_LANGUAGE_CODES,
  ESTIMATED_TOTAL_REACH_BILLION
};
