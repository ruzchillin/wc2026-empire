// languages-config.js
// Global language configuration for WC 2026 content system
// Used by: preview-engine.js, goal-monitor.js, agent-system.py, quality-engine.js
// ─────────────────────────────────────────────────────────────

const LANGUAGES = {

  // ── TIER 1: NEAR-ZERO COMPETITION ─────────────────────────

  sw: {
    name: 'Swahili',
    nativeName: 'Kiswahili',
    tier: 1,
    speakers: 200_000_000,
    region: 'East Africa',
    countries: ['Kenya', 'Tanzania', 'Uganda', 'Rwanda', 'DR Congo', 'Burundi', 'Mozambique'],
    wcTeams: ['Morocco', 'Cameroon', 'South Africa'],
    platforms: {
      primary: ['Telegram', 'WhatsApp', 'Facebook', 'TikTok'],
      secondary: ['YouTube', 'Twitter/X'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_SW || '',
    contentAngles: [
      'East African pride in African teams',
      'Morocco as continent leaders',
      'Pan-African unity framing',
      '"Afrika inashinda" (Africa wins) narrative'
    ],
    culturalNotes: 'Football is called "mpira wa miguu". Match night in Nairobi/Dar es Salaam = massive shared screens. WhatsApp groups are the primary sharing mechanism.',
    hashtagTemplate: '#MpiraMundo2026 #WC2026 #Afrika',
    goalReaction: '⚽ GOOOOL!',
    competition: 'near-zero',
    monetization: {
      affiliates: ['Bet365', 'Betway Africa', 'Sportybet', 'M-Pesa payment services'],
      adNetworks: ['Google AdSense', 'Propeller Ads'],
      avgCPM: 0.8
    }
  },

  ha: {
    name: 'Hausa',
    nativeName: 'Harshen Hausa',
    tier: 1,
    speakers: 100_000_000,
    region: 'West Africa (Nigeria, Niger, Ghana)',
    countries: ['Nigeria', 'Niger', 'Ghana', 'Chad', 'Cameroon'],
    wcTeams: ['Nigeria', 'Ghana', 'Cameroon'],
    platforms: {
      primary: ['Telegram', 'WhatsApp', 'Facebook', 'TikTok'],
      secondary: ['YouTube'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_HA || '',
    contentAngles: [
      'Super Eagles (Nigeria) coverage — team by team deep dives',
      'Northern Nigeria football culture',
      'African pride narrative',
      'Betting culture is mainstream in northern Nigeria'
    ],
    culturalNotes: 'Football is huge in northern Nigeria. Radio + WhatsApp = primary consumption. Hausa is lingua franca across West Africa.',
    hashtagTemplate: '#WC2026 #SuperEagles #NigeriaFootball',
    goalReaction: '⚽ GOOOOL! Super Eagles!',
    competition: 'near-zero',
    monetization: {
      affiliates: ['Bet9ja', 'Sportybet Nigeria', 'BetKing', 'DraftKings (diaspora)'],
      adNetworks: ['Google AdSense'],
      avgCPM: 0.5
    }
  },

  zu: {
    name: 'Zulu / South African languages',
    nativeName: 'isiZulu / isiXhosa / Sesotho',
    tier: 1,
    speakers: 25_000_000,
    region: 'South Africa',
    countries: ['South Africa'],
    wcTeams: ['South Africa'],
    platforms: {
      primary: ['Telegram', 'WhatsApp', 'TikTok', 'Facebook'],
      secondary: ['YouTube', 'Twitter/X'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_ZU || '',
    contentAngles: [
      'Bafana Bafana — first WC since 2010 — massive national moment',
      '"Ke Yona" (This Is It) — national pride',
      'Host city angle — SA will host some matches',
      'Siya Kolisi crossover (rugby fans converting)'
    ],
    culturalNotes: 'South Africa qualified for first time since they hosted in 2010. This is HUGE national news. Zulu + Xhosa + Sotho + Afrikaans — mix of languages but Zulu is largest.',
    hashtagTemplate: '#BafanaBafana #WC2026 #SouthAfrica',
    goalReaction: '⚽ GOOOAL! Bafana Bafana! 🇿🇦',
    competition: 'near-zero',
    monetization: {
      affiliates: ['Betway SA', 'Hollywoodbets', 'SuperSport streaming', 'Takealot'],
      adNetworks: ['Google AdSense'],
      avgCPM: 1.2
    }
  },

  wo: {
    name: 'Wolof',
    nativeName: 'Wolof',
    tier: 1,
    speakers: 15_000_000,
    region: 'Senegal + French diaspora',
    countries: ['Senegal', 'Gambia', 'France (diaspora)'],
    wcTeams: ['Senegal'],
    platforms: {
      primary: ['Telegram', 'WhatsApp', 'Facebook', 'TikTok'],
      secondary: ['YouTube'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_WO || '',
    contentAngles: [
      'Lions of Teranga — Senegal as Africa\'s best team',
      'Sadio Mane farewell WC narrative',
      'Dakar pride / diaspora pride in France',
      'African champion angle (Senegal won AFCON)'
    ],
    culturalNotes: 'Senegalese diaspora in France and Europe is enormous and digitally active. Football = national identity.',
    hashtagTemplate: '#LionsDeTeranga #Senegal #WC2026',
    goalReaction: '⚽ GOOOOL! Lions de Teranga! 🦁🇸🇳',
    competition: 'near-zero',
    monetization: {
      affiliates: ['Bet365', '1xBet Africa', 'French affiliates (diaspora)'],
      adNetworks: ['Google AdSense'],
      avgCPM: 0.7
    }
  },

  tl: {
    name: 'Tagalog / Filipino',
    nativeName: 'Filipino / Tagalog',
    tier: 1,
    speakers: 120_000_000,
    region: 'Philippines + global OFW diaspora',
    countries: ['Philippines', 'USA', 'Middle East', 'UK', 'Canada', 'Hong Kong', 'Singapore'],
    wcTeams: [],
    platforms: {
      primary: ['Facebook', 'TikTok', 'YouTube', 'Telegram'],
      secondary: ['Twitter/X'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_TL || '',
    contentAngles: [
      'Global football fan coverage — no team loyalty = covers everyone',
      'OFW community bonding through football',
      'Prediction culture — Filipinos love predictions and parlays',
      'Filipino players in Europe spotlight'
    ],
    culturalNotes: 'Filipinos average 9+ hours online daily — highest in the world. Facebook is dominant. OFW (overseas workers) use football as community bonding worldwide.',
    hashtagTemplate: '#WC2026 #PilipinasLaban #Football',
    goalReaction: '⚽ GOOAL! 🔥',
    competition: 'near-zero',
    monetization: {
      affiliates: ['DraftKings (USA diaspora)', 'bet365', 'GCash partnerships', 'food delivery'],
      adNetworks: ['Google AdSense', 'Facebook Audience Network'],
      avgCPM: 1.0
    }
  },

  vi: {
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    tier: 1,
    speakers: 97_000_000,
    region: 'Vietnam',
    countries: ['Vietnam'],
    wcTeams: [],
    platforms: {
      primary: ['Facebook', 'YouTube', 'TikTok', 'Zalo (local)'],
      secondary: ['Telegram'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_VI || '',
    contentAngles: [
      'Vietnamese fans famously watch all night for big tournaments',
      'European leagues are hugely popular — connect WC to club teams',
      'Prediction content extremely popular',
      'Vietnamese digital ad market growing 25% per year'
    ],
    culturalNotes: 'Vietnamese football fans stayed up until 3am for Euro 2020. Facebook is primary. Online gambling/betting is technically restricted but VPN usage is very high.',
    hashtagTemplate: '#WC2026 #BóngĐáThếGiới #Dự_Đoán',
    goalReaction: '⚽ BÀN THẮNG! 🔥',
    competition: 'near-zero',
    monetization: {
      affiliates: ['VPN affiliates (huge demand)', '1xBet Vietnam', 'Shopee affiliate'],
      adNetworks: ['Google AdSense'],
      avgCPM: 0.9
    }
  },

  my: {
    name: 'Burmese',
    nativeName: 'မြန်မာဘာသာ',
    tier: 1,
    speakers: 55_000_000,
    region: 'Myanmar',
    countries: ['Myanmar'],
    wcTeams: [],
    platforms: {
      primary: ['Facebook', 'Telegram', 'TikTok'],
      secondary: ['YouTube'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_MY || '',
    contentAngles: [
      'Football is Myanmar\'s #1 sport by far',
      'Fans follow English Premier League obsessively',
      'WC = national celebration moment'
    ],
    culturalNotes: 'Football is far and away Myanmar\'s most popular sport. No other WC content in Burmese exists.',
    hashtagTemplate: '#WC2026 #ကမ္ဘာ့ဖလား',
    goalReaction: '⚽ ဂိုးဝင်သွားပြီ!',
    competition: 'zero',
    monetization: {
      affiliates: ['VPN affiliates', '1xBet'],
      adNetworks: ['Google AdSense'],
      avgCPM: 0.4
    }
  },

  // ── TIER 2: LOW COMPETITION, MASSIVE AUDIENCE ─────────────

  hi: {
    name: 'Hindi / Hinglish',
    nativeName: 'हिंदी',
    tier: 2,
    speakers: 600_000_000,
    region: 'India + global diaspora',
    countries: ['India', 'USA', 'UK', 'Canada', 'UAE', 'Australia'],
    wcTeams: [],
    platforms: {
      primary: ['YouTube', 'Instagram', 'Facebook', 'Telegram', 'ShareChat'],
      secondary: ['Twitter/X', 'Moj'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_HI || '',
    contentAngles: [
      'India is the world\'s biggest cricket nation pivoting to football',
      'Indian Premier League-style drama framing',
      'Diaspora football communities in UK/USA/UAE',
      'Hinglish (Hindi-English mix) performs best for younger audience'
    ],
    culturalNotes: 'Indian digital advertising market is massive and growing. Hindi content on YouTube earns lower CPMs but volume compensates enormously.',
    hashtagTemplate: '#WorldCup2026 #फीफाविश्वकप #Football',
    goalReaction: '⚽ GOOOOL! क्या गोल है!',
    competition: 'low',
    monetization: {
      affiliates: ['Dream11 (DFS India)', 'MPL', 'Betway India', 'Amazon affiliate (huge market)'],
      adNetworks: ['Google AdSense', 'MX Media'],
      avgCPM: 0.6
    }
  },

  id: {
    name: 'Indonesian / Malay',
    nativeName: 'Bahasa Indonesia / Bahasa Melayu',
    tier: 2,
    speakers: 310_000_000,
    region: 'Indonesia + Malaysia + Brunei',
    countries: ['Indonesia', 'Malaysia', 'Brunei', 'Singapore'],
    wcTeams: [],
    platforms: {
      primary: ['TikTok', 'Instagram', 'YouTube', 'Twitter/X', 'Telegram'],
      secondary: ['Facebook'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_ID || '',
    contentAngles: [
      'Indonesia is football-mad — over 100M viewers expected for big matches',
      'Malay audiences have very high football engagement',
      'Indonesia almost qualified for WC 2026 — huge emotional investment',
      'TikTok Indonesia is one of the largest markets in the world'
    ],
    culturalNotes: 'Indonesia is TikTok\'s largest market outside the USA. Football is #1 sport. Indonesian Twitter (X) is among the world\'s most active.',
    hashtagTemplate: '#PialaDunia2026 #WC2026 #Bola',
    goalReaction: '⚽ GOOOL! Luar Biasa! 🔥',
    competition: 'low',
    monetization: {
      affiliates: ['Sbobet', 'bet365', 'Shopee affiliate', 'Tokopedia'],
      adNetworks: ['Google AdSense'],
      avgCPM: 0.8
    }
  },

  bn: {
    name: 'Bengali',
    nativeName: 'বাংলা',
    tier: 2,
    speakers: 300_000_000,
    region: 'Bangladesh + West Bengal, India',
    countries: ['Bangladesh', 'India (West Bengal)'],
    wcTeams: [],
    platforms: {
      primary: ['Facebook', 'YouTube', 'TikTok', 'Telegram'],
      secondary: ['Twitter/X'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_BN || '',
    contentAngles: [
      'Kolkata is one of Asia\'s oldest football cities — intense tradition',
      'Bangladesh diaspora in UK + Middle East is large',
      'Mohun Bagan / East Bengal rivalry mirrors WC passion',
      'Argentina + Brazil Argentina fanbases are ENORMOUS in Bangladesh'
    ],
    culturalNotes: 'Bangladesh has an insane divide: half are fanatic Argentina fans, half are Brazil fans. This has been going on for 40 years. WC is national holiday.',
    hashtagTemplate: '#WC2026 #ফিফা_বিশ্বকাপ #Football',
    goalReaction: '⚽ গোল! গোল! গোল!',
    competition: 'low',
    monetization: {
      affiliates: ['bet365', '1xBet', 'bKash payment services'],
      adNetworks: ['Google AdSense'],
      avgCPM: 0.5
    }
  },

  th: {
    name: 'Thai',
    nativeName: 'ภาษาไทย',
    tier: 2,
    speakers: 70_000_000,
    region: 'Thailand',
    countries: ['Thailand'],
    wcTeams: [],
    platforms: {
      primary: ['Facebook', 'YouTube', 'TikTok', 'LINE'],
      secondary: ['Twitter/X', 'Telegram'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_TH || '',
    contentAngles: [
      'Thai fans have world\'s highest per-capita football merch spend',
      'Premier League obsession translates to WC',
      'Betting / prediction content is extremely popular',
      'LINE is Thailand\'s primary messaging app — content spreads fast'
    ],
    culturalNotes: 'Thailand has a wildly passionate football culture. Manchester United alone has millions of Thai fans. WC = national conversation.',
    hashtagTemplate: '#WC2026 #ฟุตบอลโลก #ทีมชาติ',
    goalReaction: '⚽ ประตู! เยี่ยม! 🔥',
    competition: 'low',
    monetization: {
      affiliates: ['UFABET', 'SBOBET Thailand', 'True Sports streaming'],
      adNetworks: ['Google AdSense'],
      avgCPM: 1.1
    }
  },

  fa: {
    name: 'Persian / Farsi',
    nativeName: 'فارسی',
    tier: 2,
    speakers: 87_000_000,
    region: 'Iran + diaspora',
    countries: ['Iran', 'Afghanistan', 'Tajikistan', 'USA (diaspora)', 'Germany (diaspora)'],
    wcTeams: ['Iran'],
    platforms: {
      primary: ['Telegram', 'Instagram', 'YouTube'],
      secondary: ['Twitter/X', 'TikTok'],
      avoid: ['Facebook (blocked in Iran, VPN needed)']
    },
    telegramChannel: process.env.TELEGRAM_FA || '',
    contentAngles: [
      'Iran\'s national team (Team Melli) — deep emotional investment',
      'Iranian diaspora in USA/Europe is massive and very online',
      'VPN usage in Iran is near-universal — content still reaches them',
      'Women\'s rights + football politics angle drives diaspora engagement'
    ],
    culturalNotes: 'Telegram is by far the #1 platform in Iran — even with restrictions. Iranian diaspora in Los Angeles, Toronto, Berlin is enormous and digitally active.',
    hashtagTemplate: '#WC2026 #TeamMelli #ایران',
    goalReaction: '⚽ گل! تیم ملی! 🇮🇷',
    competition: 'low',
    monetization: {
      affiliates: ['VPN affiliates (essential product for Iranians)', 'bet365 (diaspora)', 'Western streaming (diaspora)'],
      adNetworks: ['Google AdSense'],
      avgCPM: 0.7
    }
  },

  yo: {
    name: 'Yoruba',
    nativeName: 'Èdè Yorùbá',
    tier: 2,
    speakers: 45_000_000,
    region: 'Nigeria (South-West) + diaspora',
    countries: ['Nigeria', 'Benin', 'Togo', 'UK (diaspora)', 'USA (diaspora)'],
    wcTeams: ['Nigeria'],
    platforms: {
      primary: ['WhatsApp', 'Facebook', 'TikTok', 'Instagram', 'Telegram'],
      secondary: ['Twitter/X', 'YouTube'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_YO || '',
    contentAngles: [
      'Lagos is Africa\'s content capital — Yoruba creators go viral constantly',
      'Super Eagles pride runs deep in Yorubaland',
      'Comedy + football format works extremely well',
      'Nollywood / Afrobeats crossover audience'
    ],
    culturalNotes: 'Yoruba speakers produce and consume enormous amounts of viral content. Football memes and reactions spread extremely fast. Lagos Twitter is global.',
    hashtagTemplate: '#WC2026 #SuperEagles #Lagos',
    goalReaction: '⚽ GOOOAAAL! Àwọn ẹyẹ ìdì! 🦅🇳🇬',
    competition: 'low',
    monetization: {
      affiliates: ['Bet9ja', 'Sportybet', 'Paystack/Flutterwave services'],
      adNetworks: ['Google AdSense'],
      avgCPM: 0.6
    }
  },

  // ── TIER 3: STRONG AUDIENCES, QUALIFIED TEAMS ──────────────

  ko: {
    name: 'Korean',
    nativeName: '한국어',
    tier: 3,
    speakers: 77_000_000,
    region: 'South Korea + global K-diaspora',
    countries: ['South Korea', 'USA', 'China', 'Canada', 'Australia'],
    wcTeams: ['South Korea'],
    platforms: {
      primary: ['Naver Blog', 'KakaoTalk', 'YouTube', 'TikTok', 'Twitter/X'],
      secondary: ['Instagram', 'Telegram'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_KO || '',
    contentAngles: [
      'Red Devils — Korean fans are among the most organized fan culture in the world',
      'Son Heung-min possibly final WC — emotional farewell narrative',
      'Korean WC 2002 nostalgia (4th place) — always referenced',
      'K-content global reach to promote across languages'
    ],
    culturalNotes: 'Korean fan culture is extremely organized. The Red Devils (fan group) mobilizes millions. K-content infrastructure means Korean WC content reaches global K-fans.',
    hashtagTemplate: '#WC2026 #대한민국 #RedDevils',
    goalReaction: '⚽ 골! 대한민국! 🇰🇷🔴',
    competition: 'medium',
    monetization: {
      affiliates: ['DAZN Korea', 'Coupang (Korean Amazon)', 'Kakao shopping'],
      adNetworks: ['Google AdSense', 'Kakao AdFit'],
      avgCPM: 2.5
    }
  },

  ja: {
    name: 'Japanese',
    nativeName: '日本語',
    tier: 3,
    speakers: 125_000_000,
    region: 'Japan',
    countries: ['Japan'],
    wcTeams: ['Japan'],
    platforms: {
      primary: ['YouTube', 'Twitter/X', 'TikTok', 'Instagram'],
      secondary: ['LINE', 'Telegram'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_JA || '',
    contentAngles: [
      'Samurai Blue — Japan always dangerous in WC knockout stages',
      'European league connection — 30+ Japanese players in top leagues',
      'DAZN Japan affiliate is highest-paying streaming affiliate in Asia',
      'Japanese fans obsess over statistics and tactical analysis'
    ],
    culturalNotes: 'Japan has extremely high CPMs. Twitter/X is used more in Japan than almost any other country. Japanese fans love deep tactical content.',
    hashtagTemplate: '#WC2026 #サムライブルー #日本代表',
    goalReaction: '⚽ ゴール！サムライブルー！🇯🇵',
    competition: 'medium',
    monetization: {
      affiliates: ['DAZN Japan ($30-50/signup)', 'Amazon Japan', 'Rakuten'],
      adNetworks: ['Google AdSense'],
      avgCPM: 3.0
    }
  },

  tr: {
    name: 'Turkish',
    nativeName: 'Türkçe',
    tier: 3,
    speakers: 85_000_000,
    region: 'Turkey + 4M in Germany + diaspora',
    countries: ['Turkey', 'Germany', 'Netherlands', 'Belgium', 'Austria'],
    wcTeams: [],
    platforms: {
      primary: ['YouTube', 'Instagram', 'TikTok', 'Twitter/X', 'Telegram'],
      secondary: ['Facebook'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_TR || '',
    contentAngles: [
      'Turkey didn\'t qualify but fans watch obsessively',
      '4M Turkish diaspora in Germany = watches Germany closely',
      'Galatasaray / Fenerbahce fans follow their European players in WC',
      'Turkish football passion is legendary'
    ],
    culturalNotes: 'Turkey has one of the world\'s most passionate football cultures. The diaspora in Germany/Netherlands/Belgium is enormous and football-obsessed.',
    hashtagTemplate: '#WC2026 #Futbol #TürkFutbolu',
    goalReaction: '⚽ GOL! Mükemmel! 🔥',
    competition: 'medium',
    monetization: {
      affiliates: ['bet365', 'Bwin', 'VPN (YouTube is sometimes blocked in TR)'],
      adNetworks: ['Google AdSense'],
      avgCPM: 1.5
    }
  },

  it: {
    name: 'Italian',
    nativeName: 'Italiano',
    tier: 3,
    speakers: 85_000_000,
    region: 'Italy + diaspora',
    countries: ['Italy', 'Argentina (Italian heritage)', 'USA', 'Brazil'],
    wcTeams: [],
    platforms: {
      primary: ['YouTube', 'Instagram', 'TikTok', 'Twitter/X'],
      secondary: ['Telegram', 'Facebook'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_IT || '',
    contentAngles: [
      'Italy didn\'t qualify (again) — massive bitterness = huge engagement',
      '"Azzurri" fans still watch WC obsessively',
      'Italian-heritage populations in Argentina + Brazil + USA',
      'Italian football analysis is globally respected — position as expert voice'
    ],
    culturalNotes: 'Italy missing the WC creates paradoxical engagement — Italian fans watch even more bitterly. High CPMs.',
    hashtagTemplate: '#WC2026 #Calcio #ItaliaFuori',
    goalReaction: '⚽ GOOOL! Che gol! 🔥',
    competition: 'medium',
    monetization: {
      affiliates: ['bet365 Italy', 'Sisal', 'Sky Sport streaming'],
      adNetworks: ['Google AdSense'],
      avgCPM: 2.0
    }
  },

  nl: {
    name: 'Dutch',
    nativeName: 'Nederlands',
    tier: 3,
    speakers: 24_000_000,
    region: 'Netherlands + Belgium (Flemish)',
    countries: ['Netherlands', 'Belgium', 'Suriname', 'Caribbean Netherlands'],
    wcTeams: ['Netherlands'],
    platforms: {
      primary: ['YouTube', 'Instagram', 'TikTok', 'Twitter/X'],
      secondary: ['Telegram', 'Snapchat'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_NL || '',
    contentAngles: [
      'Oranje — Dutch always WC contenders',
      'Total Football legacy — tactical content lands well',
      'Flemish/Belgian audience overlap (they understand Dutch)',
      'Very high CPMs — Netherlands is top 10 ad market per capita'
    ],
    culturalNotes: 'Dutch CPMs are among the highest in Europe. Netherlands almost always reaches knockout stages. Tactical analysis is highly valued.',
    hashtagTemplate: '#WC2026 #Oranje #KNVB',
    goalReaction: '⚽ DOELPUNT! Hup Holland Hup! 🇳🇱🟠',
    competition: 'medium',
    monetization: {
      affiliates: ['bet365', 'Unibet', 'DAZN Netherlands'],
      adNetworks: ['Google AdSense'],
      avgCPM: 3.5
    }
  },

  zh: {
    name: 'Mandarin Chinese (Simplified)',
    nativeName: '中文（简体）',
    tier: 3,
    speakers: 1_000_000_000,
    region: 'China + global Chinese diaspora',
    countries: ['China', 'Singapore', 'Malaysia', 'Taiwan (Traditional)', 'USA', 'UK', 'Australia'],
    wcTeams: [],
    platforms: {
      primary: ['Douyin (TikTok China)', 'WeChat', 'Weibo', 'Bilibili'],
      secondary: ['YouTube (diaspora only)', 'Telegram (diaspora)'],
      avoid: ['Facebook (blocked)', 'Twitter (blocked)']
    },
    telegramChannel: process.env.TELEGRAM_ZH || '',
    contentAngles: [
      'Chinese fans are WC\'s biggest non-participating audience',
      'Douyin WC content generates hundreds of millions of views',
      'Chinese diaspora on YouTube/Telegram uses same simplified Chinese',
      'China\'s football dreams — national conversation for 1.4B people'
    ],
    culturalNotes: 'China\'s failure to qualify is a national wound. Chinese fans watch every WC match. Douyin (Chinese TikTok) is completely separate platform. Diaspora platforms differ from mainland.',
    hashtagTemplate: '#世界杯2026 #WC2026 #足球',
    goalReaction: '⚽ 进球了！太精彩了！🔥',
    competition: 'medium',
    monetization: {
      affiliates: ['VPN affiliates (diaspora)', 'Alibaba/AliExpress', 'Chinese streaming services'],
      adNetworks: ['Google AdSense (diaspora)', 'Baidu (mainland)'],
      avgCPM: 1.8
    }
  },

  de: {
    name: 'German',
    nativeName: 'Deutsch',
    tier: 3,
    speakers: 100_000_000,
    region: 'Germany + Austria + Switzerland',
    countries: ['Germany', 'Austria', 'Switzerland'],
    wcTeams: ['Germany'],
    platforms: {
      primary: ['YouTube', 'Instagram', 'TikTok', 'Twitter/X'],
      secondary: ['Telegram', 'Facebook'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_DE || '',
    contentAngles: [
      'Die Mannschaft — Germany always a WC power',
      'Rebuilding narrative after 2018/2022 disappointments',
      'Turkish diaspora (4M) in Germany follows both Germany AND Turkey',
      'Highest CPMs in Europe'
    ],
    culturalNotes: 'Germany CPMs are among the highest in the world. German football culture is massive. The Turkish diaspora adds another 4M viewers.',
    hashtagTemplate: '#WM2026 #DieManschaft #DFB',
    goalReaction: '⚽ TOOOR! Deutschland! 🇩🇪🦅',
    competition: 'medium',
    monetization: {
      affiliates: ['bet365 DE', 'Bwin', 'DAZN Germany ($15-25/signup)'],
      adNetworks: ['Google AdSense'],
      avgCPM: 4.0
    }
  },

  uk: {
    name: 'Ukrainian',
    nativeName: 'Українська',
    tier: 3,
    speakers: 45_000_000,
    region: 'Ukraine + 6M diaspora in EU',
    countries: ['Ukraine', 'Poland', 'Germany', 'Czech Republic', 'UK'],
    wcTeams: [],
    platforms: {
      primary: ['Telegram', 'YouTube', 'Instagram', 'TikTok'],
      secondary: ['Twitter/X', 'Facebook'],
      avoid: []
    },
    telegramChannel: process.env.TELEGRAM_UK_UA || '',
    contentAngles: [
      'Massive diaspora created since 2022 — 6M Ukrainians now in EU',
      'Football = connection to home for diaspora',
      'Ukrainian players in top European clubs (Mudryk, Zinchenko)',
      'Resilience + pride narrative resonates deeply'
    ],
    culturalNotes: 'Telegram is the dominant platform for Ukrainian diaspora. Very high political and emotional engagement. Football is a symbol of normalcy and national identity.',
    hashtagTemplate: '#WC2026 #Футбол #Україна',
    goalReaction: '⚽ ГОЛ! 🇺🇦',
    competition: 'low',
    monetization: {
      affiliates: ['bet365', 'European affiliates', 'VPN affiliates'],
      adNetworks: ['Google AdSense'],
      avgCPM: 1.0
    }
  },

  // ── ALREADY BUILT (reference) ──────────────────────────────

  en: {
    name: 'English',
    nativeName: 'English',
    tier: 0,
    speakers: 1_500_000_000,
    region: 'Global',
    wcTeams: ['USA', 'England', 'Australia', 'Canada'],
    telegramChannel: process.env.TELEGRAM_EN || '',
    competition: 'high',
    monetization: { avgCPM: 5.0 }
  },
  es: {
    name: 'Spanish',
    nativeName: 'Español',
    tier: 0,
    speakers: 500_000_000,
    region: 'Latin America + Spain',
    wcTeams: ['Mexico', 'Argentina', 'Colombia', 'Spain', 'Chile', 'Ecuador', 'Uruguay'],
    telegramChannel: process.env.TELEGRAM_ES || '',
    competition: 'high',
    monetization: { avgCPM: 2.0 }
  },
  pt: {
    name: 'Portuguese',
    nativeName: 'Português',
    tier: 0,
    speakers: 260_000_000,
    region: 'Brazil + Portugal + Africa',
    wcTeams: ['Brazil', 'Portugal'],
    telegramChannel: process.env.TELEGRAM_PT || '',
    competition: 'high',
    monetization: { avgCPM: 1.5 }
  },
  fr: {
    name: 'French',
    nativeName: 'Français',
    tier: 0,
    speakers: 280_000_000,
    region: 'France + West Africa',
    wcTeams: ['France', 'Morocco', 'Senegal', 'Cameroon'],
    telegramChannel: process.env.TELEGRAM_FR || '',
    competition: 'high',
    monetization: { avgCPM: 2.5 }
  },
  ar: {
    name: 'Arabic',
    nativeName: 'العربية',
    tier: 0,
    speakers: 420_000_000,
    region: 'Middle East + North Africa',
    wcTeams: ['Morocco', 'Saudi Arabia'],
    telegramChannel: process.env.TELEGRAM_AR || '',
    competition: 'medium',
    monetization: { avgCPM: 1.8 }
  }
};

// All languages in priority order (Tier 1 first for content generation)
const LANGUAGE_PRIORITY = [
  // Tier 1 — lowest competition, build immediately
  'sw', 'ha', 'zu', 'wo', 'tl', 'vi', 'my',
  // Tier 2 — low competition, massive audience
  'hi', 'id', 'bn', 'th', 'fa', 'yo',
  // Tier 3 — qualified teams, higher CPMs
  'ko', 'ja', 'de', 'nl', 'it', 'tr', 'zh', 'uk',
  // Already running
  'en', 'es', 'pt', 'fr', 'ar'
];

// Languages supported by LibreTranslate (auto-translate)
const LIBRETRANSLATE_SUPPORTED = ['en', 'es', 'pt', 'fr', 'ar', 'de', 'zh', 'ja', 'ko', 'tr', 'fa', 'hi', 'vi', 'id', 'bn', 'nl', 'it', 'uk'];

// Languages requiring Groq direct generation (better quality, bypasses translation)
const GROQ_DIRECT_LANGUAGES = ['en', 'es', 'pt', 'fr', 'ar', 'de', 'zh', 'ja', 'ko', 'tr', 'fa', 'hi', 'vi', 'id'];

// Languages with no machine translation (human review needed for quality)
const HUMAN_REVIEW_LANGUAGES = ['sw', 'ha', 'zu', 'wo', 'tl', 'yo', 'my', 'bn', 'th', 'uk'];

// Helper: get all Telegram channel IDs
function getAllChannelIds() {
  return LANGUAGE_PRIORITY
    .map(code => LANGUAGES[code]?.telegramChannel)
    .filter(Boolean);
}

// Helper: get channels by tier
function getChannelsByTier(tier) {
  return Object.values(LANGUAGES)
    .filter(l => l.tier === tier && l.telegramChannel)
    .map(l => l.telegramChannel);
}

// Helper: get goal reaction string for a language
function getGoalReaction(langCode, team) {
  const lang = LANGUAGES[langCode];
  if (!lang) return `⚽ GOAL! ${team} scored!`;
  return lang.goalReaction.replace('{team}', team);
}

// Total reach calculation
const TOTAL_REACH = Object.values(LANGUAGES).reduce((sum, l) => sum + (l.speakers || 0), 0);
console.log(`Total addressable audience: ${(TOTAL_REACH / 1_000_000_000).toFixed(1)}B speakers`);

module.exports = {
  LANGUAGES,
  LANGUAGE_PRIORITY,
  LIBRETRANSLATE_SUPPORTED,
  GROQ_DIRECT_LANGUAGES,
  HUMAN_REVIEW_LANGUAGES,
  getAllChannelIds,
  getChannelsByTier,
  getGoalReaction,
  TOTAL_REACH
};
