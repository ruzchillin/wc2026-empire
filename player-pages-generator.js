/**
 * Player Pages Generator — WC 2026 AI Empire
 *
 * Generates one SEO-optimised page per WC 2026 player.
 * Target queries: "[Player Name] WC 2026", "[Player] World Cup stats", "[Player] WC 2026 goals"
 *
 * These pages spike massively when a player scores or does something notable.
 * Mbappe hat-trick → "Mbappe WC 2026" → 5M searches that day.
 *
 * Each page:
 * - AI-generated player bio + WC 2026 analysis
 * - Live stats (goals, assists, minutes, rating)
 * - Tournament form + next match
 * - Transfer market value (spikes after good WC performance)
 * - Betting markets: Golden Boot odds, team odds
 * - Email capture: "[Player] match alerts"
 * - Social share: "[Player] WC 2026 stats"
 * - Schema: Person + SportsOrganization
 * - Exit intent + Facebook Pixel
 *
 * Output: ./public/players/[player-slug].html
 *
 * Usage:
 *   node player-pages-generator.js all          — generate all 200 players
 *   node player-pages-generator.js top          — generate top 50 (priority)
 *   node player-pages-generator.js "Mbappe"     — generate one player
 *   node player-pages-generator.js update       — update stats for all
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const cron = require('node-cron');

const groq       = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SITE_URL   = process.env.SITE_URL || 'https://wc2026intel.vercel.app';
const OUTPUT_DIR = path.join(__dirname, 'public', 'players');

// ── Master player list ─────────────────────────────────────────────────────────
const WC_PLAYERS = [
  // ── FRANCE ──
  { id:'kylian-mbappe',     name:'Kylian Mbappé',       country:'France',      flag:'🇫🇷', position:'Forward',  age:27, club:'Real Madrid',     marketValue:'180M', tier:1, goldenBootOdds:'4.50', teamSlug:'france' },
  { id:'antoine-griezmann', name:'Antoine Griezmann',   country:'France',      flag:'🇫🇷', position:'Forward',  age:34, club:'Atlético Madrid', marketValue:'22M',  tier:2, goldenBootOdds:'28.0', teamSlug:'france' },
  { id:'olivier-giroud',    name:'Olivier Giroud',      country:'France',      flag:'🇫🇷', position:'Forward',  age:38, club:'LA Galaxy',        marketValue:'3M',   tier:3, goldenBootOdds:'80.0', teamSlug:'france' },
  { id:'ousmane-dembele',   name:'Ousmane Dembélé',     country:'France',      flag:'🇫🇷', position:'Winger',   age:27, club:'PSG',              marketValue:'60M',  tier:2, goldenBootOdds:'35.0', teamSlug:'france' },
  { id:'aurelien-tchouameni', name:'Aurélien Tchouaméni', country:'France',   flag:'🇫🇷', position:'Midfield', age:24, club:'Real Madrid',     marketValue:'80M',  tier:2, goldenBootOdds:'90.0', teamSlug:'france' },

  // ── BRAZIL ──
  { id:'vinicius-jr',       name:'Vinicius Jr',         country:'Brazil',      flag:'🇧🇷', position:'Winger',   age:24, club:'Real Madrid',     marketValue:'180M', tier:1, goldenBootOdds:'5.00', teamSlug:'brazil' },
  { id:'neymar-jr',         name:'Neymar Jr',           country:'Brazil',      flag:'🇧🇷', position:'Forward',  age:33, club:'Al Hilal',         marketValue:'35M',  tier:1, goldenBootOdds:'15.0', teamSlug:'brazil' },
  { id:'rodrygo',           name:'Rodrygo',             country:'Brazil',      flag:'🇧🇷', position:'Forward',  age:24, club:'Real Madrid',     marketValue:'110M', tier:2, goldenBootOdds:'20.0', teamSlug:'brazil' },
  { id:'raphinha',          name:'Raphinha',            country:'Brazil',      flag:'🇧🇷', position:'Winger',   age:27, club:'Barcelona',        marketValue:'80M',  tier:2, goldenBootOdds:'22.0', teamSlug:'brazil' },
  { id:'casemiro',          name:'Casemiro',            country:'Brazil',      flag:'🇧🇷', position:'Midfield', age:33, club:'Manchester Utd',   marketValue:'25M',  tier:2, goldenBootOdds:'150', teamSlug:'brazil' },

  // ── ARGENTINA ──
  { id:'lionel-messi',      name:'Lionel Messi',        country:'Argentina',   flag:'🇦🇷', position:'Forward',  age:37, club:'Inter Miami',      marketValue:'35M',  tier:1, goldenBootOdds:'9.00', teamSlug:'argentina' },
  { id:'lautaro-martinez',  name:'Lautaro Martínez',    country:'Argentina',   flag:'🇦🇷', position:'Forward',  age:27, club:'Inter Milan',      marketValue:'100M', tier:1, goldenBootOdds:'10.0', teamSlug:'argentina' },
  { id:'julian-alvarez',    name:'Julián Álvarez',      country:'Argentina',   flag:'🇦🇷', position:'Forward',  age:24, club:'Atlético Madrid', marketValue:'90M',  tier:2, goldenBootOdds:'14.0', teamSlug:'argentina' },
  { id:'rodrigo-de-paul',   name:'Rodrigo De Paul',     country:'Argentina',   flag:'🇦🇷', position:'Midfield', age:30, club:'Atlético Madrid', marketValue:'40M',  tier:2, goldenBootOdds:'120', teamSlug:'argentina' },

  // ── ENGLAND ──
  { id:'harry-kane',        name:'Harry Kane',          country:'England',     flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', position:'Forward',  age:31, club:'Bayern Munich',   marketValue:'80M',  tier:1, goldenBootOdds:'7.00', teamSlug:'england' },
  { id:'jude-bellingham',   name:'Jude Bellingham',     country:'England',     flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', position:'Midfield', age:22, club:'Real Madrid',     marketValue:'180M', tier:1, goldenBootOdds:'16.0', teamSlug:'england' },
  { id:'bukayo-saka',       name:'Bukayo Saka',         country:'England',     flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', position:'Winger',   age:23, club:'Arsenal',          marketValue:'150M', tier:1, goldenBootOdds:'18.0', teamSlug:'england' },
  { id:'phil-foden',        name:'Phil Foden',          country:'England',     flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', position:'Forward',  age:24, club:'Man City',         marketValue:'150M', tier:1, goldenBootOdds:'20.0', teamSlug:'england' },
  { id:'marcus-rashford',   name:'Marcus Rashford',     country:'England',     flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', position:'Forward',  age:27, club:'Manchester Utd',   marketValue:'55M',  tier:2, goldenBootOdds:'40.0', teamSlug:'england' },

  // ── SPAIN ──
  { id:'lamine-yamal',      name:'Lamine Yamal',        country:'Spain',       flag:'🇪🇸', position:'Winger',   age:18, club:'Barcelona',        marketValue:'180M', tier:1, goldenBootOdds:'11.0', teamSlug:'spain' },
  { id:'pedri',             name:'Pedri',               country:'Spain',       flag:'🇪🇸', position:'Midfield', age:23, club:'Barcelona',        marketValue:'130M', tier:2, goldenBootOdds:'55.0', teamSlug:'spain' },
  { id:'rodri',             name:'Rodri',               country:'Spain',       flag:'🇪🇸', position:'Midfield', age:28, club:'Man City',         marketValue:'120M', tier:2, goldenBootOdds:'50.0', teamSlug:'spain' },
  { id:'ferran-torres',     name:'Ferran Torres',       country:'Spain',       flag:'🇪🇸', position:'Forward',  age:25, club:'Barcelona',        marketValue:'50M',  tier:2, goldenBootOdds:'45.0', teamSlug:'spain' },

  // ── GERMANY ──
  { id:'jamal-musiala',     name:'Jamal Musiala',       country:'Germany',     flag:'🇩🇪', position:'Midfield', age:22, club:'Bayern Munich',   marketValue:'150M', tier:1, goldenBootOdds:'14.0', teamSlug:'germany' },
  { id:'florian-wirtz',     name:'Florian Wirtz',       country:'Germany',     flag:'🇩🇪', position:'Midfield', age:22, club:'Bayer Leverkusen', marketValue:'130M', tier:1, goldenBootOdds:'16.0', teamSlug:'germany' },
  { id:'kai-havertz',       name:'Kai Havertz',         country:'Germany',     flag:'🇩🇪', position:'Forward',  age:26, club:'Arsenal',          marketValue:'75M',  tier:2, goldenBootOdds:'30.0', teamSlug:'germany' },
  { id:'thomas-muller',     name:'Thomas Müller',       country:'Germany',     flag:'🇩🇪', position:'Forward',  age:35, club:'Bayern Munich',   marketValue:'10M',  tier:3, goldenBootOdds:'200', teamSlug:'germany' },

  // ── PORTUGAL ──
  { id:'cristiano-ronaldo', name:'Cristiano Ronaldo',   country:'Portugal',    flag:'🇵🇹', position:'Forward',  age:41, club:'Al Nassr',         marketValue:'15M',  tier:1, goldenBootOdds:'7.00', teamSlug:'portugal' },
  { id:'bruno-fernandes',   name:'Bruno Fernandes',     country:'Portugal',    flag:'🇵🇹', position:'Midfield', age:30, club:'Manchester Utd',   marketValue:'70M',  tier:1, goldenBootOdds:'25.0', teamSlug:'portugal' },
  { id:'rafael-leao',       name:'Rafael Leão',         country:'Portugal',    flag:'🇵🇹', position:'Winger',   age:25, club:'AC Milan',         marketValue:'90M',  tier:2, goldenBootOdds:'28.0', teamSlug:'portugal' },

  // ── NETHERLANDS ──
  { id:'virgil-van-dijk',   name:'Virgil van Dijk',     country:'Netherlands', flag:'🇳🇱', position:'Defender', age:33, club:'Liverpool',        marketValue:'40M',  tier:2, goldenBootOdds:'200', teamSlug:'netherlands' },
  { id:'cody-gakpo',        name:'Cody Gakpo',          country:'Netherlands', flag:'🇳🇱', position:'Forward',  age:25, club:'Liverpool',        marketValue:'70M',  tier:2, goldenBootOdds:'20.0', teamSlug:'netherlands' },
  { id:'memphis-depay',     name:'Memphis Depay',       country:'Netherlands', flag:'🇳🇱', position:'Forward',  age:30, club:'Corinthians',      marketValue:'12M',  tier:2, goldenBootOdds:'40.0', teamSlug:'netherlands' },

  // ── USA ──
  { id:'christian-pulisic', name:'Christian Pulisic',   country:'USA',         flag:'🇺🇸', position:'Winger',   age:26, club:'AC Milan',         marketValue:'50M',  tier:2, goldenBootOdds:'30.0', teamSlug:'usa' },
  { id:'gio-reyna',         name:'Gio Reyna',           country:'USA',         flag:'🇺🇸', position:'Midfield', age:22, club:'Borussia Dortmund', marketValue:'30M', tier:2, goldenBootOdds:'55.0', teamSlug:'usa' },
  { id:'brenden-aaronson',  name:'Brenden Aaronson',    country:'USA',         flag:'🇺🇸', position:'Midfield', age:24, club:'Leeds United',     marketValue:'18M',  tier:3, goldenBootOdds:'120', teamSlug:'usa' },
  { id:'tim-weah',          name:'Tim Weah',            country:'USA',         flag:'🇺🇸', position:'Winger',   age:24, club:'Juventus',         marketValue:'22M',  tier:2, goldenBootOdds:'90.0', teamSlug:'usa' },

  // ── NIGERIA ──
  { id:'victor-osimhen',    name:'Victor Osimhen',      country:'Nigeria',     flag:'🇳🇬', position:'Forward',  age:25, club:'Galatasaray',      marketValue:'80M',  tier:1, goldenBootOdds:'12.0', teamSlug:'nigeria' },
  { id:'alex-iwobi',        name:'Alex Iwobi',          country:'Nigeria',     flag:'🇳🇬', position:'Midfield', age:28, club:'Fulham',           marketValue:'25M',  tier:2, goldenBootOdds:'80.0', teamSlug:'nigeria' },
  { id:'samuel-chukwueze',  name:'Samuel Chukwueze',    country:'Nigeria',     flag:'🇳🇬', position:'Winger',   age:25, club:'AC Milan',         marketValue:'35M',  tier:2, goldenBootOdds:'60.0', teamSlug:'nigeria' },

  // ── MOROCCO ──
  { id:'achraf-hakimi',     name:'Achraf Hakimi',       country:'Morocco',     flag:'🇲🇦', position:'Defender', age:26, club:'PSG',              marketValue:'70M',  tier:2, goldenBootOdds:'90.0', teamSlug:'morocco' },
  { id:'hakim-ziyech',      name:'Hakim Ziyech',        country:'Morocco',     flag:'🇲🇦', position:'Winger',   age:32, club:'Galatasaray',      marketValue:'12M',  tier:2, goldenBootOdds:'70.0', teamSlug:'morocco' },
  { id:'youssef-en-nesyri', name:'Youssef En-Nesyri',   country:'Morocco',     flag:'🇲🇦', position:'Forward',  age:27, club:'Fenerbahce',       marketValue:'35M',  tier:2, goldenBootOdds:'30.0', teamSlug:'morocco' },

  // ── SENEGAL ──
  { id:'sadio-mane',        name:'Sadio Mané',          country:'Senegal',     flag:'🇸🇳', position:'Forward',  age:32, club:'Al Nassr',         marketValue:'25M',  tier:1, goldenBootOdds:'20.0', teamSlug:'senegal' },
  { id:'kalidou-koulibaly', name:'Kalidou Koulibaly',   country:'Senegal',     flag:'🇸🇳', position:'Defender', age:33, club:'Al Hilal',         marketValue:'15M',  tier:2, goldenBootOdds:'200', teamSlug:'senegal' },

  // ── MEXICO ──
  { id:'hirving-lozano',    name:'Hirving Lozano',      country:'Mexico',      flag:'🇲🇽', position:'Winger',   age:29, club:'PSV Eindhoven',   marketValue:'30M',  tier:2, goldenBootOdds:'35.0', teamSlug:'mexico' },
  { id:'raul-jimenez',      name:'Raúl Jiménez',        country:'Mexico',      flag:'🇲🇽', position:'Forward',  age:33, club:'Fulham',           marketValue:'15M',  tier:2, goldenBootOdds:'55.0', teamSlug:'mexico' },

  // ── SOUTH KOREA ──
  { id:'son-heung-min',     name:'Son Heung-min',       country:'South Korea', flag:'🇰🇷', position:'Forward',  age:34, club:'Tottenham',        marketValue:'35M',  tier:1, goldenBootOdds:'22.0', teamSlug:'south-korea' },

  // ── JAPAN ──
  { id:'takumi-minamino',   name:'Takumi Minamino',     country:'Japan',       flag:'🇯🇵', position:'Forward',  age:29, club:'AS Monaco',        marketValue:'18M',  tier:2, goldenBootOdds:'50.0', teamSlug:'japan' },
  { id:'wataru-endo',       name:'Wataru Endo',         country:'Japan',       flag:'🇯🇵', position:'Midfield', age:31, club:'Liverpool',        marketValue:'22M',  tier:2, goldenBootOdds:'150', teamSlug:'japan' },

  // ── COLOMBIA ──
  { id:'luis-diaz',         name:'Luis Díaz',           country:'Colombia',    flag:'🇨🇴', position:'Winger',   age:27, club:'Liverpool',        marketValue:'75M',  tier:2, goldenBootOdds:'25.0', teamSlug:'colombia' },
  { id:'james-rodriguez',   name:'James Rodríguez',     country:'Colombia',    flag:'🇨🇴', position:'Midfield', age:33, club:'Rayo Vallecano',   marketValue:'8M',   tier:2, goldenBootOdds:'60.0', teamSlug:'colombia' },

  // ── URUGUAY ──
  { id:'darwin-nunez',      name:'Darwin Núñez',        country:'Uruguay',     flag:'🇺🇾', position:'Forward',  age:25, club:'Liverpool',        marketValue:'75M',  tier:2, goldenBootOdds:'18.0', teamSlug:'uruguay' },
  { id:'federico-valverde', name:'Federico Valverde',   country:'Uruguay',     flag:'🇺🇾', position:'Midfield', age:26, club:'Real Madrid',     marketValue:'120M', tier:2, goldenBootOdds:'40.0', teamSlug:'uruguay' },

  // ── CANADA ──
  { id:'alphonso-davies',   name:'Alphonso Davies',     country:'Canada',      flag:'🇨🇦', position:'Defender', age:24, club:'Bayern Munich',   marketValue:'70M',  tier:2, goldenBootOdds:'60.0', teamSlug:'canada' },
  { id:'jonathan-david',    name:'Jonathan David',      country:'Canada',      flag:'🇨🇦', position:'Forward',  age:24, club:'Lille',            marketValue:'60M',  tier:2, goldenBootOdds:'20.0', teamSlug:'canada' },

  // ── AUSTRALIA ──
  { id:'mat-ryan',          name:'Mat Ryan',            country:'Australia',   flag:'🇦🇺', position:'Goalkeeper', age:32, club:'Real Sociedad', marketValue:'4M',  tier:3, goldenBootOdds:'500', teamSlug:'australia' },
  { id:'mitchel-duke',      name:'Mitch Duke',          country:'Australia',   flag:'🇦🇺', position:'Forward',  age:33, club:'Urawa Red',        marketValue:'1M',   tier:3, goldenBootOdds:'200', teamSlug:'australia' },

  // ── ITALY ──
  { id:'ciro-immobile',     name:'Ciro Immobile',       country:'Italy',       flag:'🇮🇹', position:'Forward',  age:35, club:'Lazio',            marketValue:'10M',  tier:2, goldenBootOdds:'60.0', teamSlug:'italy' },
  { id:'nicolò-barella',    name:'Nicolò Barella',      country:'Italy',       flag:'🇮🇹', position:'Midfield', age:27, club:'Inter Milan',      marketValue:'90M',  tier:2, goldenBootOdds:'80.0', teamSlug:'italy' },

  // ── CROATIA ──
  { id:'luka-modric',       name:'Luka Modrić',         country:'Croatia',     flag:'🇭🇷', position:'Midfield', age:39, club:'Real Madrid',     marketValue:'8M',   tier:1, goldenBootOdds:'100', teamSlug:'croatia' },
  { id:'ivan-perisic',      name:'Ivan Perišić',        country:'Croatia',     flag:'🇭🇷', position:'Winger',   age:35, club:'Hajduk Split',    marketValue:'4M',   tier:2, goldenBootOdds:'150', teamSlug:'croatia' },

  // ── BELGIUM ──
  { id:'romelu-lukaku',     name:'Romelu Lukaku',       country:'Belgium',     flag:'🇧🇪', position:'Forward',  age:31, club:'Napoli',           marketValue:'30M',  tier:2, goldenBootOdds:'22.0', teamSlug:'belgium' },
  { id:'kevin-de-bruyne',   name:'Kevin De Bruyne',     country:'Belgium',     flag:'🇧🇪', position:'Midfield', age:33, club:'Man City',         marketValue:'35M',  tier:1, goldenBootOdds:'60.0', teamSlug:'belgium' },

  // ── DENMARK ──
  { id:'christian-eriksen', name:'Christian Eriksen',   country:'Denmark',     flag:'🇩🇰', position:'Midfield', age:33, club:'Manchester Utd',   marketValue:'12M',  tier:2, goldenBootOdds:'80.0', teamSlug:'denmark' },
  { id:'rasmus-hojlund',    name:'Rasmus Højlund',      country:'Denmark',     flag:'🇩🇰', position:'Forward',  age:22, club:'Manchester Utd',   marketValue:'70M',  tier:2, goldenBootOdds:'25.0', teamSlug:'denmark' },

  // ── ECUADOR ──
  { id:'enner-valencia',    name:'Enner Valencia',      country:'Ecuador',     flag:'🇪🇨', position:'Forward',  age:35, club:'Internacional',    marketValue:'4M',   tier:2, goldenBootOdds:'100', teamSlug:'ecuador' },

  // ── GHANA ──
  { id:'thomas-partey',     name:'Thomas Partey',       country:'Ghana',       flag:'🇬🇭', position:'Midfield', age:31, club:'Arsenal',          marketValue:'20M',  tier:2, goldenBootOdds:'120', teamSlug:'ghana' },
  { id:'jordan-ayew',       name:'Jordan Ayew',         country:'Ghana',       flag:'🇬🇭', position:'Forward',  age:32, club:'Le Havre',         marketValue:'5M',   tier:3, goldenBootOdds:'150', teamSlug:'ghana' },

  // ── CAMEROON ──
  { id:'vincent-aboubakar', name:'Vincent Aboubakar',   country:'Cameroon',    flag:'🇨🇲', position:'Forward',  age:32, club:'Besiktas',         marketValue:'6M',   tier:2, goldenBootOdds:'80.0', teamSlug:'cameroon' },

  // ── SERBIA ──
  { id:'aleksandar-mitrovic', name:'Aleksandar Mitrović', country:'Serbia',   flag:'🇷🇸', position:'Forward',  age:29, club:'Al Hilal',         marketValue:'35M',  tier:2, goldenBootOdds:'20.0', teamSlug:'serbia' },
  { id:'dusan-vlahovic',    name:'Dušan Vlahović',      country:'Serbia',      flag:'🇷🇸', position:'Forward',  age:24, club:'Juventus',         marketValue:'75M',  tier:2, goldenBootOdds:'22.0', teamSlug:'serbia' },

  // ── SWITZERLAND ──
  { id:'granit-xhaka',      name:'Granit Xhaka',        country:'Switzerland', flag:'🇨🇭', position:'Midfield', age:31, club:'Bayer Leverkusen', marketValue:'20M',  tier:2, goldenBootOdds:'100', teamSlug:'switzerland' },
  { id:'xherdan-shaqiri',   name:'Xherdan Shaqiri',     country:'Switzerland', flag:'🇨🇭', position:'Winger',   age:32, club:'Chicago Fire',     marketValue:'5M',   tier:3, goldenBootOdds:'150', teamSlug:'switzerland' },

  // ── PERU ──
  { id:'andre-carrillo',    name:'André Carrillo',      country:'Peru',        flag:'🇵🇪', position:'Winger',   age:33, club:'Al Qadsiah',       marketValue:'3M',   tier:3, goldenBootOdds:'200', teamSlug:'peru' },

  // ── CHILE ──
  { id:'alexis-sanchez',    name:'Alexis Sánchez',      country:'Chile',       flag:'🇨🇱', position:'Forward',  age:36, club:'Udinese',          marketValue:'3M',   tier:2, goldenBootOdds:'120', teamSlug:'chile' },

  // ── SOUTH AFRICA ──
  { id:'percy-tau',         name:'Percy Tau',           country:'South Africa',flag:'🇿🇦', position:'Winger',   age:30, club:'Al Ahly',          marketValue:'5M',   tier:3, goldenBootOdds:'200', teamSlug:'south-africa' },

  // Add more to reach 200+ ...
];

function slugify(str) {
  return str.toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i').replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[ć]/g, 'c').replace(/[ž]/g, 'z').replace(/[š]/g, 's')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── Generate AI content for player ────────────────────────────────────────────
async function generatePlayerContent(player) {
  const prompt = `Generate a WC 2026 player profile for ${player.name} (${player.flag} ${player.country}, ${player.position}, Age ${player.age}, ${player.club}).

Return ONLY valid JSON:
{
  "headline": "one punchy line about their WC 2026 chances, under 12 words",
  "bio": "2-3 paragraph WC 2026 analysis. Their style, strengths, tournament history, what to expect in 2026. ~200 words.",
  "wcHistory": "one paragraph about their WC history/previous tournaments",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "watchFor": "the one thing to watch for from this player in WC 2026",
  "goldenBootChance": "brief realistic assessment of their Golden Boot chances",
  "transferAngle": "how a strong WC could affect their transfer value or career",
  "prediction": "a specific prediction for their WC 2026 performance (e.g., '4 goals, 2 assists, QF exit')",
  "faq": [
    {"q": "How many goals will ${player.name} score at WC 2026?", "a": "..."},
    {"q": "Is ${player.name} playing for ${player.country} at WC 2026?", "a": "..."},
    {"q": "What is ${player.name}'s best WC performance?", "a": "..."}
  ]
}`;

  try {
    const resp = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: 'Football analyst. Return only valid JSON, no markdown.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 700,
      temperature: 0.7,
    });
    const raw = resp.choices[0].message.content.trim()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(raw);
  } catch (err) {
    return {
      headline: `${player.name} aims to shine at WC 2026`,
      bio: `${player.name} is one of ${player.country}'s most important players heading into WC 2026. The ${player.position} from ${player.club} will be key to his country's chances of going deep in the tournament.`,
      wcHistory: `${player.name} has represented ${player.country} at previous tournaments and brings valuable experience to the squad.`,
      strengths: ['Technical quality', 'Tournament experience', 'Goal threat'],
      watchFor: 'Watch for their movement in the final third',
      goldenBootChance: `${player.goldenBootOdds === '4.50' ? 'One of the clear favourites' : 'An outside chance at the Golden Boot'}`,
      transferAngle: 'A strong WC could significantly increase market value',
      prediction: 'Solid contribution expected in group stage and beyond',
      faq: [
        { q: `Is ${player.name} at WC 2026?`, a: `Yes, ${player.name} is in the ${player.country} squad for WC 2026.` }
      ]
    };
  }
}

// ── Build player HTML page ─────────────────────────────────────────────────────
function buildPlayerPage(player, content) {
  const slug  = player.id;
  const title = `${player.name} WC 2026 — Stats, Goals & Analysis | ${player.country}`;
  const desc  = `${content.headline}. ${player.name} WC 2026 stats, goals, performance analysis and transfer news. ${player.country} ${player.position} at the 2026 World Cup.`;

  const schemaPerson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    "name": player.name,
    "nationality": player.country,
    "jobTitle": `Professional Footballer — ${player.position}`,
    "memberOf": { "@type": "SportsTeam", "name": player.country },
    "url": `${SITE_URL}/players/${slug}.html`
  });

  const schemaFAQ = content.faq ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": content.faq.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  }) : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE_URL}/players/${slug}.html">
<meta property="og:type" content="profile">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="${SITE_URL}/players/${slug}.html">
<!-- Facebook Pixel -->
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${process.env.FACEBOOK_PIXEL_ID || 'PIXEL_ID'}');fbq('track','PageView');</script>
<script type="application/ld+json">${schemaPerson}</script>
${schemaFAQ ? `<script type="application/ld+json">${schemaFAQ}</script>` : ''}
<style>
  :root { --bg:#0a0a0a; --card:#141414; --border:#2a2a2a; --text:#f0f0f0; --muted:#888; --accent:#00ff88; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--text); line-height:1.6; }

  nav { background:#111; border-bottom:1px solid var(--border); padding:12px 20px; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:100; }
  .nav-brand { font-weight:700; color:var(--accent); text-decoration:none; }
  .nav-links a { color:var(--muted); text-decoration:none; margin-left:14px; font-size:0.85rem; }

  .hero { background:linear-gradient(135deg,#0d1f0d,#0a1420); padding:40px 20px; text-align:center; border-bottom:1px solid var(--border); }
  .player-flag { font-size:4rem; margin-bottom:8px; }
  .player-name-h { font-size:2.2rem; font-weight:900; }
  .player-sub { color:var(--muted); margin-top:8px; font-size:0.9rem; }
  .player-meta { display:flex; gap:16px; justify-content:center; flex-wrap:wrap; margin-top:16px; }
  .meta-chip { background:var(--card); border:1px solid var(--border); border-radius:20px; padding:6px 14px; font-size:0.8rem; }

  .live-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; max-width:500px; margin:24px auto 0; }
  .stat-box { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px; text-align:center; }
  .stat-val { font-size:1.8rem; font-weight:900; color:var(--accent); }
  .stat-label { font-size:0.7rem; color:var(--muted); text-transform:uppercase; margin-top:2px; }

  .container { max-width:800px; margin:0 auto; padding:0 20px 80px; }
  h2 { font-size:1.2rem; font-weight:700; margin:28px 0 14px; color:#fff; border-left:3px solid var(--accent); padding-left:12px; }
  p { color:#ccc; margin-bottom:14px; font-size:0.95rem; }

  .strength-list { list-style:none; background:var(--card); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
  .strength-list li { padding:12px 16px; border-bottom:1px solid var(--border); font-size:0.9rem; color:#ccc; }
  .strength-list li:last-child { border-bottom:none; }
  .strength-list li:before { content:'✓ '; color:var(--accent); }

  .highlight-box { background:linear-gradient(135deg,#0d2b1a,#0a1a2e); border:1px solid #2a5a3a; border-radius:12px; padding:20px; margin:20px 0; }
  .highlight-label { font-size:0.75rem; color:#5aaa7a; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
  .highlight-text { font-size:1rem; font-weight:600; }

  .bet-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:20px; margin:24px 0; }
  .bet-card h3 { font-size:1rem; margin-bottom:14px; }
  .odds-badge { display:inline-block; background:#1a2a1a; border:1px solid #2a5a2a; color:var(--accent); border-radius:8px; padding:8px 16px; font-size:1.1rem; font-weight:700; }
  .bet-link { display:block; background:var(--accent); color:#000; text-align:center; padding:12px; border-radius:8px; margin-top:12px; font-weight:700; text-decoration:none; }

  .email-capture { background:linear-gradient(135deg,#1a1a2e,#0d1b35); border:1px solid #2a3a5e; border-radius:12px; padding:24px; margin:28px 0; text-align:center; }
  .email-capture h3 { font-size:1.1rem; margin-bottom:8px; }
  .email-form { display:flex; gap:10px; max-width:400px; margin:10px auto 0; }
  .email-form input { flex:1; background:#1a1a1a; border:1px solid var(--border); border-radius:8px; padding:10px 14px; color:var(--text); }
  .email-form button { background:var(--accent); color:#000; border:none; border-radius:8px; padding:10px 20px; font-weight:700; cursor:pointer; white-space:nowrap; }

  .share-row { display:flex; gap:10px; flex-wrap:wrap; margin:20px 0; }
  .share-btn { flex:1; padding:10px; border-radius:8px; border:none; cursor:pointer; font-weight:600; font-size:0.85rem; text-decoration:none; text-align:center; }
  .share-tw { background:#1DA1F2; color:#fff; }
  .share-wa { background:#25D366; color:#fff; }
  .share-tg { background:#229ED9; color:#fff; }

  .faq-item { border-bottom:1px solid var(--border); padding:14px 0; cursor:pointer; }
  .faq-q { font-weight:600; font-size:0.95rem; }
  .faq-a { font-size:0.9rem; color:#ccc; margin-top:8px; display:none; }
  .faq-item.open .faq-a { display:block; }

  .bottom-nav { position:fixed; bottom:0; left:0; right:0; background:#111; border-top:1px solid var(--border); display:flex; justify-content:space-around; padding:10px 0; z-index:99; }
  .bottom-nav a { color:var(--muted); text-decoration:none; font-size:0.65rem; text-align:center; display:flex; flex-direction:column; gap:2px; }
  .bottom-nav .icon { font-size:1.2rem; }

  /* EXIT INTENT */
  .exit-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:1000; justify-content:center; align-items:center; }
  .exit-overlay.show { display:flex; }
  .exit-modal { background:var(--card); border:1px solid var(--accent); border-radius:16px; padding:32px; max-width:400px; text-align:center; position:relative; }

  @media(max-width:600px) {
    .live-stats { grid-template-columns:repeat(2,1fr); }
    .email-form { flex-direction:column; }
  }
</style>
</head>
<body>

<div class="exit-overlay" id="exitOverlay">
  <div class="exit-modal">
    <span style="position:absolute;top:12px;right:16px;cursor:pointer;color:var(--muted)" onclick="document.getElementById('exitOverlay').classList.remove('show')">✕</span>
    <div style="font-size:2.5rem;margin-bottom:8px">${player.flag}</div>
    <h3>Get ${player.name.split(' ').pop()} match alerts</h3>
    <p style="color:var(--muted);font-size:0.85rem;margin:8px 0 16px">Every time ${player.country} play — score, lineups, AI prediction. Free.</p>
    <div class="email-form" style="flex-direction:column">
      <input type="email" id="exitEmail" placeholder="your@email.com" style="margin-bottom:10px">
      <button onclick="submitExit()">Get Alerts →</button>
    </div>
  </div>
</div>

<nav>
  <a href="/" class="nav-brand">⚡ WC 2026 Intel</a>
  <div class="nav-links">
    <a href="/live-scores.html">Live</a>
    <a href="/group-standings.html">Groups</a>
    <a href="/golden-boot-tracker.html">Scorer</a>
  </div>
</nav>

<div class="hero">
  <div class="player-flag">${player.flag}</div>
  <div class="player-name-h">${player.name}</div>
  <div class="player-sub">${player.country} • ${player.position} • ${player.club}</div>
  <div class="player-meta">
    <span class="meta-chip">🎂 Age ${player.age}</span>
    <span class="meta-chip">💰 €${player.marketValue}</span>
    <span class="meta-chip">🏆 WC 2026</span>
  </div>
  <div class="live-stats" id="liveStats">
    <div class="stat-box"><div class="stat-val" id="statGoals">0</div><div class="stat-label">Goals</div></div>
    <div class="stat-box"><div class="stat-val" id="statAssists">0</div><div class="stat-label">Assists</div></div>
    <div class="stat-box"><div class="stat-val" id="statApps">0</div><div class="stat-label">Apps</div></div>
    <div class="stat-box"><div class="stat-val" id="statMins">0</div><div class="stat-label">Mins</div></div>
  </div>
</div>

<div class="container">

  <!-- HEADLINE + BIO -->
  <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;margin:24px 0">
    <div style="font-size:0.75rem;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">🤖 AI Assessment</div>
    <div style="font-size:1.1rem;font-weight:700">${content.headline}</div>
  </div>

  <h2>⚽ WC 2026 Analysis</h2>
  ${content.bio.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('\n  ')}

  <!-- STRENGTHS -->
  <h2>💪 Key Strengths</h2>
  <ul class="strength-list">
    ${content.strengths.map(s => `<li>${s}</li>`).join('\n    ')}
  </ul>

  <!-- WATCH FOR -->
  <div class="highlight-box">
    <div class="highlight-label">👁️ Watch For</div>
    <div class="highlight-text">${content.watchFor}</div>
  </div>

  <!-- WC HISTORY -->
  <h2>📋 Tournament History</h2>
  <p>${content.wcHistory}</p>

  <!-- GOLDEN BOOT BETTING -->
  <div class="bet-card">
    <h3>🥾 Golden Boot Odds — ${player.name}</h3>
    <p style="color:var(--muted);font-size:0.85rem;margin-bottom:12px">${content.goldenBootChance}</p>
    <div>Current odds: <span class="odds-badge">${player.goldenBootOdds}</span></div>
    <a class="bet-link" href="https://www.bet365.com/?affiliate=YOUR_ID" target="_blank" rel="nofollow">
      Bet on ${player.name.split(' ').pop()} to win Golden Boot →
    </a>
    <p style="font-size:0.7rem;color:#555;text-align:center;margin-top:8px">18+ | Gamble Responsibly | T&Cs Apply</p>
  </div>

  <!-- EMAIL CAPTURE -->
  <div class="email-capture">
    <h3>🔔 Get ${player.name.split(' ').pop()} match alerts</h3>
    <p style="color:var(--muted);font-size:0.85rem">Every ${player.country} match — lineups, AI prediction, and score. Free.</p>
    <div class="email-form">
      <input type="email" id="heroEmail" placeholder="your@email.com">
      <button onclick="subscribe('heroEmail')">Get Alerts →</button>
    </div>
  </div>

  <!-- PREDICTION -->
  <div class="highlight-box" style="background:linear-gradient(135deg,#1a0d2e,#0a1420);border-color:#3a2a5e">
    <div class="highlight-label" style="color:#9a7aff">🔮 Our Prediction</div>
    <div class="highlight-text">${content.prediction}</div>
  </div>

  <!-- TRANSFER ANGLE -->
  <h2>💸 Transfer Market Impact</h2>
  <p>${content.transferAngle}</p>

  <!-- SHARE -->
  <div class="share-row">
    <a class="share-btn share-tw" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`${player.name} WC 2026 — ${content.headline} ${SITE_URL}/players/${slug}.html #WC2026`)}" target="_blank">Share on Twitter</a>
    <a class="share-btn share-wa" href="https://wa.me/?text=${encodeURIComponent(`${player.name} at WC 2026 — ${content.headline} ${SITE_URL}/players/${slug}.html`)}" target="_blank">Share on WhatsApp</a>
    <a class="share-btn share-tg" href="https://t.me/share/url?url=${encodeURIComponent(`${SITE_URL}/players/${slug}.html`)}&text=${encodeURIComponent(`${player.name} WC 2026`)}" target="_blank">Share on Telegram</a>
  </div>

  <!-- TEAM HUB LINK -->
  <a href="${SITE_URL}/teams/${player.teamSlug}.html" style="display:block;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;text-decoration:none;color:var(--text);margin:20px 0">
    ${player.flag} Full ${player.country} Team Hub — Squad, Fixtures, Analysis →
  </a>

  <!-- FAQ -->
  ${content.faq && content.faq.length ? `
  <h2>❓ FAQ</h2>
  ${content.faq.map(f => `
  <div class="faq-item">
    <div class="faq-q">${f.q}</div>
    <div class="faq-a">${f.a}</div>
  </div>`).join('\n  ')}
  ` : ''}

  <!-- AFFILIATE -->
  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin:24px 0;text-align:center">
    <div style="font-size:0.75rem;color:var(--muted);margin-bottom:12px">WATCH EVERY ${player.country.toUpperCase()} MATCH</div>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a href="https://nordvpn.com/ref/wc2026intel" target="_blank" rel="nofollow" style="background:#4687FF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.85rem">🔒 NordVPN — Stream Free</a>
      <a href="${SITE_URL}/watch-guide.html" style="background:#333;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.85rem">📺 Watch Guide</a>
    </div>
  </div>

</div>

<div class="bottom-nav">
  <a href="/live-scores.html"><span class="icon">⚽</span>Live</a>
  <a href="/group-standings.html"><span class="icon">📊</span>Groups</a>
  <a href="/golden-boot-tracker.html"><span class="icon">🥾</span>Scorer</a>
  <a href="/watch-guide.html"><span class="icon">📺</span>Watch</a>
  <a href="/viral-quiz.html"><span class="icon">🧠</span>Quiz</a>
</div>

<script>
function subscribe(id) {
  const email = document.getElementById(id).value;
  if (!email || !email.includes('@')) return;
  document.querySelector('.email-capture').innerHTML = '<p style="color:var(--accent);font-weight:700;text-align:center;padding:20px">✅ You\'re in! Alerts set for ${player.country} matches.</p>';
}
function submitExit() {
  subscribe('exitEmail');
  setTimeout(() => document.getElementById('exitOverlay').classList.remove('show'), 1500);
}
document.querySelectorAll('.faq-item').forEach(i => i.addEventListener('click', () => i.classList.toggle('open')));
let exitShown = false;
document.addEventListener('mouseleave', e => {
  if (e.clientY <= 0 && !exitShown) { exitShown = true; document.getElementById('exitOverlay').classList.add('show'); }
});

// Try to load live stats
fetch('/api/player-stats/${player.id}')
  .then(r => r.ok ? r.json() : null)
  .then(d => {
    if (!d) return;
    document.getElementById('statGoals').textContent = d.goals || 0;
    document.getElementById('statAssists').textContent = d.assists || 0;
    document.getElementById('statApps').textContent = d.apps || 0;
    document.getElementById('statMins').textContent = d.minutes || 0;
  }).catch(() => {});
</script>
</body>
</html>`;
}

// ── Generate pages ─────────────────────────────────────────────────────────────
async function generatePlayers(players) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let count = 0;
  for (const player of players) {
    const outPath = path.join(OUTPUT_DIR, `${player.id}.html`);
    console.log(`⚙️  ${player.name} (${player.country})`);

    try {
      const content = await generatePlayerContent(player);
      const html    = buildPlayerPage(player, content);
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`   ✅ ${player.id}.html`);
      count++;
      await new Promise(r => setTimeout(r, 1200)); // rate limit
    } catch (err) {
      console.error(`   ❌ ${err.message}`);
    }
  }

  console.log(`\n✅ Generated ${count} player pages → ${OUTPUT_DIR}`);

  // Generate player index
  generatePlayerIndex(players);
}

function generatePlayerIndex(players) {
  const byCountry = {};
  players.forEach(p => {
    if (!byCountry[p.country]) byCountry[p.country] = [];
    byCountry[p.country].push(p);
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WC 2026 Players — All Squads & Stats</title>
<meta name="description" content="WC 2026 player profiles for all 48 nations. Stats, analysis and predictions for every player at the 2026 World Cup.">
<style>
  body{font-family:sans-serif;background:#0a0a0a;color:#f0f0f0;margin:0;padding:20px}
  h1{color:#00ff88;margin-bottom:24px}
  h2{font-size:1.1rem;margin:20px 0 10px;border-left:3px solid #00ff88;padding-left:10px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:24px}
  .player-card{background:#141414;border:1px solid #2a2a2a;border-radius:8px;padding:12px;text-decoration:none;color:#f0f0f0;display:block}
  .player-card:hover{border-color:#00ff88}
  .pc-name{font-weight:700;font-size:0.9rem}
  .pc-info{font-size:0.75rem;color:#888;margin-top:4px}
  .pc-club{font-size:0.75rem;color:#666}
  nav{background:#111;border-bottom:1px solid #2a2a2a;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;margin:-20px -20px 20px;position:sticky;top:0;z-index:100}
  .nav-brand{font-weight:700;color:#00ff88;text-decoration:none}
</style>
</head>
<body>
<nav><a href="/" class="nav-brand">⚡ WC 2026 Intel</a></nav>
<h1>⚽ WC 2026 Players</h1>
${Object.entries(byCountry).map(([country, ps]) => `
<h2>${ps[0].flag} ${country}</h2>
<div class="grid">
${ps.map(p => `  <a class="player-card" href="/players/${p.id}.html">
    <div class="pc-name">${p.name}</div>
    <div class="pc-info">${p.position} • Age ${p.age}</div>
    <div class="pc-club">${p.club}</div>
  </a>`).join('\n')}
</div>`).join('\n')}
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html, 'utf8');
  console.log('✅ Player index written');
}

// Cron: update player stats daily at 02:00 UTC
cron.schedule('0 2 * * *', () => {
  console.log('⏰ Scheduled: updating player stats');
  generatePlayers(WC_PLAYERS.filter(p => p.tier === 1)); // update top players daily
});

// ── CLI ────────────────────────────────────────────────────────────────────────
async function main() {
  const [,, cmd, arg] = process.argv;

  if (cmd === 'all') {
    await generatePlayers(WC_PLAYERS);
  } else if (cmd === 'top') {
    await generatePlayers(WC_PLAYERS.filter(p => p.tier === 1));
  } else if (cmd && !['all','top','update'].includes(cmd)) {
    const player = WC_PLAYERS.find(p =>
      p.name.toLowerCase().includes(cmd.toLowerCase()) ||
      p.id.includes(cmd.toLowerCase())
    );
    if (player) await generatePlayers([player]);
    else console.error(`Player not found: ${cmd}`);
  } else {
    console.log(`
⚽ Player Pages Generator — WC 2026 Intel

Usage:
  node player-pages-generator.js top           Generate top 15 tier-1 players (fastest)
  node player-pages-generator.js all           Generate all ${WC_PLAYERS.length} players
  node player-pages-generator.js "Mbappe"      Generate one player by name

Pages saved to: ./public/players/
Each page targets: "[Player Name] WC 2026" searches
    `);
  }
}

main().catch(console.error);
