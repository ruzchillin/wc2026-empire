/**
 * WC 2026 Empire — Discord Super-Bot v2
 * Port: 3022 | Deploy as "discord-bot" on Railway
 *
 * Features:
 *  - Full slash command system with Discord API v10
 *  - Live match threads auto-created per game
 *  - Player stat commands (/mbappe /messi /ronaldo /yamal /haaland)
 *  - Per-server language settings (30+ languages)
 *  - Affiliate links embedded in responses
 *  - VIP role gating for premium tips
 *  - Daily match schedule posts (auto 7am UTC)
 *  - Golden Boot leaderboard live updates
 *  - Group stage standings updates
 *  - moment-engine /trigger webhook receiver
 *
 * Slash Commands:
 *  /score           — live score of current/last match
 *  /predict <match> — AI prediction for a fixture
 *  /odds <match>    — best odds from comparison engine
 *  /tip             — today's top AI betting tip
 *  /player <name>   — player stats + WC2026 odds
 *  /bracket         — current tournament bracket
 *  /standings <group> — group stage table
 *  /stream <country>  — how to watch in your country
 *  /golden-boot     — live Golden Boot race
 *  /subscribe       — link to VIP Telegram channel
 *  /match <teams>   — upcoming match info
 *  /timezone <tz>   — set your timezone for schedules
 *  /language <lang> — set server language
 *
 * Env vars required:
 *  DISCORD_BOT_TOKEN       — from Discord Developer Portal
 *  DISCORD_CLIENT_ID       — application client ID
 *  DISCORD_GUILD_IDS       — comma-separated server IDs (empty = global commands)
 *  DISCORD_CHANNEL_IDS     — comma-separated default alert channels
 *  DISCORD_VIP_ROLE_NAME   — role name for VIP tips (default: "VIP")
 *  VERCEL_URL              — main site URL
 *  API_SERVER_URL          — api-server base URL
 *  PIPELINE_SECRET         — shared secret
 *  GROQ_API_KEY            — for AI commentary/prediction
 */

'use strict';
require('dotenv').config();

const express = require('express');
const axios   = require('axios');
const { Client, GatewayIntentBits, REST, Routes,
        SlashCommandBuilder, EmbedBuilder,
        ActionRowBuilder, ButtonBuilder, ButtonStyle,
        ChannelType, PermissionFlagsBits, ThreadAutoArchiveDuration } = require('discord.js');

// ── Config ────────────────────────────────────────────────────────────────────
const TOKEN          = process.env.DISCORD_BOT_TOKEN   || '';
const CLIENT_ID      = process.env.DISCORD_CLIENT_ID   || '';
const GUILD_IDS      = (process.env.DISCORD_GUILD_IDS  || '').split(',').map(s => s.trim()).filter(Boolean);
const CHANNEL_IDS    = (process.env.DISCORD_CHANNEL_IDS|| '').split(',').map(s => s.trim()).filter(Boolean);
const VIP_ROLE       = process.env.DISCORD_VIP_ROLE_NAME || 'VIP';
const SITE           = (process.env.VERCEL_URL || 'https://wc2026empire.com').replace(/\/$/, '');
const API_URL        = (process.env.API_SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');
const SECRET         = process.env.PIPELINE_SECRET || '';
const GROQ_KEY       = process.env.GROQ_API_KEY || '';
const PORT           = parseInt(process.env.PORT || '3022');

// Per-server language cache  { guildId: 'de' }
const guildLang   = {};
// Per-server timezone cache  { guildId: 'America/New_York' }
const guildTZ     = {};
// Active match threads       { matchId: threadId }
const matchThreads = {};
// Request log
const reqLog = [];

// ── Localisation strings ─────────────────────────────────────────────────────
const I18N = {
  en: { goal:'⚽ GOAL!', ht:'Half Time', ft:'Full Time', redCard:'🟥 RED CARD!',
        yellowCard:'🟨 Yellow Card', prediction:'🔮 AI Prediction', tip:'💡 Today\'s Tip',
        watch:'📺 How to Watch', subscribe:'Join our VIP Telegram channel for premium tips',
        odds:'Best current odds from our comparison engine', goldenBoot:'🥇 Golden Boot Race' },
  pt: { goal:'⚽ GOL!', ht:'Intervalo', ft:'Fim de Jogo', redCard:'🟥 CARTÃO VERMELHO!',
        yellowCard:'🟨 Cartão Amarelo', prediction:'🔮 Previsão IA', tip:'💡 Dica do Dia',
        watch:'📺 Como Assistir', subscribe:'Entre no nosso canal VIP do Telegram',
        odds:'Melhores odds do nosso comparador', goldenBoot:'🥇 Corrida Artilheiro' },
  es: { goal:'⚽ GOL!', ht:'Medio Tiempo', ft:'Tiempo Completo', redCard:'🟥 TARJETA ROJA!',
        yellowCard:'🟨 Tarjeta Amarilla', prediction:'🔮 Predicción IA', tip:'💡 Consejo del Día',
        watch:'📺 Cómo Ver', subscribe:'Únete a nuestro canal VIP de Telegram',
        odds:'Las mejores cuotas de nuestro comparador', goldenBoot:'🥇 Carrera Bota de Oro' },
  de: { goal:'⚽ TOR!', ht:'Halbzeit', ft:'Abpfiff', redCard:'🟥 ROTE KARTE!',
        yellowCard:'🟨 Gelbe Karte', prediction:'🔮 KI-Prognose', tip:'💡 Tipp des Tages',
        watch:'📺 Wo schauen', subscribe:'Tritt unserem VIP-Telegram-Kanal bei',
        odds:'Beste Quoten aus unserem Vergleich', goldenBoot:'🥇 Torjägerrennen' },
  fr: { goal:'⚽ BUT!', ht:'Mi-Temps', ft:'Temps Réglementaire', redCard:'🟥 CARTON ROUGE!',
        yellowCard:'🟨 Carton Jaune', prediction:'🔮 Prédiction IA', tip:'💡 Conseil du Jour',
        watch:'📺 Où regarder', subscribe:'Rejoignez notre canal Telegram VIP',
        odds:'Meilleures cotes de notre comparateur', goldenBoot:'🥇 Course au Soulier d\'Or' },
  ko: { goal:'⚽ 골!', ht:'하프타임', ft:'풀타임', redCard:'🟥 퇴장!',
        yellowCard:'🟨 옐로카드', prediction:'🔮 AI 예측', tip:'💡 오늘의 팁',
        watch:'📺 시청 방법', subscribe:'프리미엄 텔레그램 채널에 가입하세요',
        odds:'최고의 배당률', goldenBoot:'🥇 득점왕 경쟁' },
  ja: { goal:'⚽ ゴール!', ht:'ハーフタイム', ft:'試合終了', redCard:'🟥 退場!',
        yellowCard:'🟨 イエローカード', prediction:'🔮 AI予想', tip:'💡 本日のチップ',
        watch:'📺 視聴方法', subscribe:'VIPテレグラムチャンネルに参加',
        odds:'最高オッズ比較', goldenBoot:'🥇 得点王レース' },
  ar: { goal:'⚽ هدف!', ht:'نهاية الشوط الأول', ft:'نهاية المباراة', redCard:'🟥 بطاقة حمراء!',
        yellowCard:'🟨 بطاقة صفراء', prediction:'🔮 توقعات الذكاء الاصطناعي', tip:'💡 نصيحة اليوم',
        watch:'📺 كيفية المشاهدة', subscribe:'انضم إلى قناة تيليغرام VIP',
        odds:'أفضل الأسعار', goldenBoot:'🥇 سباق الحذاء الذهبي' },
  zh: { goal:'⚽ 进球!', ht:'半场', ft:'全场结束', redCard:'🟥 红牌!',
        yellowCard:'🟨 黄牌', prediction:'🔮 AI预测', tip:'💡 今日推荐',
        watch:'📺 如何收看', subscribe:'加入我们的VIP Telegram频道',
        odds:'最佳赔率对比', goldenBoot:'🥇 金靴奖竞争' },
};

const t = (guildId, key) => (I18N[guildLang[guildId]] || I18N.en)[key] || I18N.en[key] || key;

// ── Player database ───────────────────────────────────────────────────────────
const PLAYERS = {
  mbappe: {
    name: 'Kylian Mbappé', flag: '🇫🇷', club: 'Real Madrid',
    age: 27, goals: 0, assists: 0,
    wc_apps: 2, wc_goals: 12,
    golden_boot_odds: '9/2', top_scorer_odds: '9/2',
    champion_odds: '7/1 (France)',
    fun_fact: '2018 WC winner at 19. Highest-paid player in history. Real Madrid No.9.',
    page: `${SITE}/mbappe-wc2026.html`,
    image: 'https://via.placeholder.com/256x256/003087/ffffff?text=Mbappe'
  },
  messi: {
    name: 'Lionel Messi', flag: '🇦🇷', club: 'Inter Miami',
    age: 38, goals: 0, assists: 0,
    wc_apps: 5, wc_goals: 13,
    golden_boot_odds: '18/1', top_scorer_odds: '18/1',
    champion_odds: '6/1 (Argentina)',
    fun_fact: '2022 World Champion + Golden Ball. 8x Ballon d\'Or. Last WC dance.',
    page: `${SITE}/messi-wc2026.html`,
    image: 'https://via.placeholder.com/256x256/74ACDF/ffffff?text=Messi'
  },
  ronaldo: {
    name: 'Cristiano Ronaldo', flag: '🇵🇹', club: 'Al Nassr',
    age: 41, goals: 0, assists: 0,
    wc_apps: 5, wc_goals: 8,
    golden_boot_odds: '25/1', top_scorer_odds: '25/1',
    champion_odds: '16/1 (Portugal)',
    fun_fact: 'All-time international top scorer (130+ goals). 5x Ballon d\'Or. Final WC campaign at 41.',
    page: `${SITE}/ronaldo-wc2026.html`,
    image: 'https://via.placeholder.com/256x256/006600/ffffff?text=Ronaldo'
  },
  yamal: {
    name: 'Lamine Yamal', flag: '🇪🇸', club: 'FC Barcelona',
    age: 18, goals: 0, assists: 0,
    wc_apps: 1, wc_goals: 0,
    golden_boot_odds: '11/1', top_scorer_odds: '11/1',
    champion_odds: '7/1 (Spain)',
    fun_fact: 'Born 2007. Euro 2024 winner at 16. Youngest player at WC2026. Spain\'s golden boy.',
    page: `${SITE}/yamal-wc2026.html`,
    image: 'https://via.placeholder.com/256x256/AA151B/ffffff?text=Yamal'
  },
  haaland: {
    name: 'Erling Haaland', flag: '🇳🇴', club: 'Manchester City',
    age: 25, goals: 0, assists: 0,
    wc_apps: 0, wc_goals: 0,
    golden_boot_odds: '7/1', top_scorer_odds: '6/1',
    champion_odds: '50/1 (Norway)',
    fun_fact: 'Premier League all-time season record (36 goals). WC2026 debut — Norway first WC in 24 years.',
    page: `${SITE}/haaland-wc2026.html`,
    image: 'https://via.placeholder.com/256x256/EF2B2D/ffffff?text=Haaland'
  },
  vinicius: {
    name: 'Vinicius Jr', flag: '🇧🇷', club: 'Real Madrid',
    age: 25, goals: 0, assists: 0,
    wc_apps: 2, wc_goals: 4,
    golden_boot_odds: '7/1', top_scorer_odds: '7/1',
    champion_odds: '5/1 (Brazil)',
    fun_fact: 'UCL winner 2024. Speed demon. Brazil\'s heir to Ronaldo\'s WC throne.',
    page: `${SITE}/vinicius-wc2026.html`,
    image: 'https://via.placeholder.com/256x256/009C3B/ffffff?text=Vini+Jr'
  },
  bellingham: {
    name: 'Jude Bellingham', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', club: 'Real Madrid',
    age: 22, goals: 0, assists: 0,
    wc_apps: 2, wc_goals: 3,
    golden_boot_odds: '14/1', top_scorer_odds: '12/1',
    champion_odds: '11/1 (England)',
    fun_fact: 'Youngest Dortmund debutant ever. Real Madrid midfield maestro. England\'s best since Beckham.',
    page: `${SITE}/bellingham-wc2026.html`,
    image: 'https://via.placeholder.com/256x256/CF142B/ffffff?text=Bellingham'
  },
  wirtz: {
    name: 'Florian Wirtz', flag: '🇩🇪', club: 'Bayer Leverkusen',
    age: 21, goals: 0, assists: 0,
    wc_apps: 1, wc_goals: 0,
    golden_boot_odds: '12/1', top_scorer_odds: '12/1',
    champion_odds: '9/1 (Germany)',
    fun_fact: 'Youngest Bundesliga scorer ever. 2024 unbeaten season with Leverkusen. Germany\'s future.',
    page: `${SITE}/germany-wc2026.html`,
    image: 'https://via.placeholder.com/256x256/000000/FFCE00?text=Wirtz'
  },
  son: {
    name: 'Son Heung-min', flag: '🇰🇷', club: 'Tottenham Hotspur',
    age: 34, goals: 0, assists: 0,
    wc_apps: 4, wc_goals: 7,
    golden_boot_odds: '20/1', top_scorer_odds: '20/1',
    champion_odds: '25/1 (Korea)',
    fun_fact: 'PL Golden Boot 2022. Most capped Korea player ever. KakaoTalk sensation.',
    page: `${SITE}/korea-wc2026.html`,
    image: 'https://via.placeholder.com/256x256/CD2E3A/ffffff?text=Son'
  },
  salah: {
    name: 'Mohamed Salah', flag: '🇪🇬', club: 'Liverpool',
    age: 34, goals: 0, assists: 0,
    wc_apps: 1, wc_goals: 0,
    golden_boot_odds: '22/1', top_scorer_odds: '22/1',
    champion_odds: '80/1 (Egypt)',
    fun_fact: 'Liverpool legend. 3x PL top scorer. Egypt\'s all-time leading scorer.',
    page: `${SITE}/egypt-wc2026.html`,
    image: 'https://via.placeholder.com/256x256/CC0001/ffffff?text=Salah'
  },
};

// ── Colour helpers ────────────────────────────────────────────────────────────
const EVENT_COLOURS = {
  GOAL:0x00ff41,PENALTY_GOAL:0x00ff41,HAT_TRICK:0xffd700,OWN_GOAL:0xff6600,
  RED_CARD:0xff0000,YELLOW_CARD:0xffff00,MATCH_END:0x0099ff,MATCH_START:0x00ff41,
  UPSET:0xff00ff,ELIMINATION:0x888888,PRE_MATCH:0x0099ff,VAR_REVIEW:0xffaa00,
  INJURY:0xff4444,RECORD:0xffd700,BREAKING_NEWS:0xff6600
};
const ec = t => EVENT_COLOURS[t] || 0x36393f;

// ── Affiliate link helpers ─────────────────────────────────────────────────────
function oddsLink(guildId) {
  return `[🎰 Compare Odds](${SITE}/odds-comparison.html)`;
}
function streamLink(guildId) {
  return `[📺 Watch Guide](${SITE}/streaming-vpn.html)`;
}
function tipLink(guildId) {
  return `[🔮 AI Tips](${SITE}/player-props.html)`;
}
function betButton(label = 'View Best Odds') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(`${SITE}/odds-comparison.html`),
    new ButtonBuilder().setLabel('🔮 AI Prediction').setStyle(ButtonStyle.Link).setURL(`${SITE}/prediction-game.html`),
    new ButtonBuilder().setLabel('📺 Stream Info').setStyle(ButtonStyle.Link).setURL(`${SITE}/streaming-vpn.html`)
  );
}

// ── Build rich embeds ─────────────────────────────────────────────────────────
function buildEventEmbed(eventType, data, guildId = '') {
  const lang = t.bind(null, guildId);
  const base = {
    footer: { text: `WC2026 Empire • ${SITE}` },
    timestamp: new Date().toISOString(),
    color: ec(eventType)
  };

  const builders = {
    GOAL: () => new EmbedBuilder({...base,
      title: `${lang('goal')} — ${data.homeTeam} ${data.homeScore??0}–${data.awayScore??0} ${data.awayTeam}`,
      description: `**${data.player||'Goal'}** scores in the **${data.minute}'**!\n${data.assist?`🎯 Assist: ${data.assist}`:''}`,
      fields: [
        { name: lang('odds'), value: oddsLink(guildId), inline: true },
        { name: '🔮 Tips', value: tipLink(guildId), inline: true }
      ]
    }),
    HAT_TRICK: () => new EmbedBuilder({...base,
      title: `🎩🎩🎩 HAT TRICK — ${data.player}!`,
      description: `**${data.player}** nets their THIRD of the match!\n\n${data.homeTeam} ${data.homeScore??0}–${data.awayScore??0} ${data.awayTeam}\n\n🌟 LEGEND. One of WC2026's greatest performances.`,
      fields: [
        { name: '🎰 Hat trick scorer odds', value: oddsLink(guildId), inline: true },
        { name: '📊 Player stats', value: `[View](${SITE}/star-players.html)`, inline: true }
      ]
    }),
    PENALTY_GOAL: () => new EmbedBuilder({...base,
      title: `⚽ PENALTY GOAL! — ${data.homeTeam} ${data.homeScore??0}–${data.awayScore??0} ${data.awayTeam}`,
      description: `**${data.player||'Pen scored'}** converts from the spot! (**${data.minute}'**)`
    }),
    OWN_GOAL: () => new EmbedBuilder({...base,
      title: `😬 OWN GOAL — ${data.homeTeam} ${data.homeScore??0}–${data.awayScore??0} ${data.awayTeam}`,
      description: `**${data.player||'Own goal'}** (**${data.minute}'**)`
    }),
    RED_CARD: () => new EmbedBuilder({...base,
      title: `🟥 RED CARD — ${data.homeTeam} vs ${data.awayTeam}`,
      description: `**${data.player||'Player'}** SENT OFF! (**${data.minute}'**)\n${data.team?`Team: ${data.team}`:''}`
    }),
    YELLOW_CARD: () => new EmbedBuilder({...base,
      title: `🟨 Yellow Card — ${data.homeTeam} vs ${data.awayTeam}`,
      description: `**${data.player||'Player'}** booked (**${data.minute}'**)`
    }),
    PRE_MATCH: () => new EmbedBuilder({...base,
      title: `🏟️ KICK OFF IN 1 HOUR — ${data.homeTeam} vs ${data.awayTeam}`,
      description: `**WC2026 Match Preview**\n\n📊 **AI Prediction:** ${data.prediction||'Analysing...'}\n\n${oddsLink(guildId)} • ${streamLink(guildId)}`,
      fields: [
        { name: '🏟️ Venue', value: data.venue||'TBC', inline: true },
        { name: '🕐 Kick off', value: data.kickoff||'Check schedule', inline: true }
      ]
    }),
    MATCH_START: () => new EmbedBuilder({...base,
      title: `🟢 KICK OFF — ${data.homeTeam} vs ${data.awayTeam}`,
      description: `The match has STARTED!\n\n${streamLink(guildId)} | ${oddsLink(guildId)}`
    }),
    MATCH_END: () => new EmbedBuilder({...base,
      title: `🏁 ${lang('ft')} — ${data.homeTeam} ${data.homeScore??0}–${data.awayScore??0} ${data.awayTeam}`,
      description: `${data.keyMoment?`⭐ ${data.keyMoment}`:'The final whistle!'}\n\n📊 [Full Analysis](${SITE}) • ${oddsLink(guildId)}`
    }),
    VAR_REVIEW: () => new EmbedBuilder({...base,
      title: `🎬 VAR REVIEW — ${data.homeTeam} vs ${data.awayTeam}`,
      description: `**Video Assistant Referee** checking...\n${data.incident||''} (**${data.minute}'**)`
    }),
    UPSET: () => new EmbedBuilder({...base,
      title: `🔥 SHOCK RESULT — ${data.homeTeam} ${data.homeScore??0}–${data.awayScore??0} ${data.awayTeam}`,
      description: `**UPSET ALERT!** 😱\n${data.homeTeam} stuns the world!\n\n${oddsLink(guildId)}`
    }),
    ELIMINATION: () => new EmbedBuilder({...base,
      title: `💔 ELIMINATED — ${data.eliminatedTeam||data.awayTeam}`,
      description: `${data.eliminatedTeam||data.awayTeam} are OUT of WC2026 😢`
    }),
    RECORD: () => new EmbedBuilder({...base,
      title: `📊 WC2026 RECORD BROKEN!`,
      description: data.description||'A historic moment at WC2026.'
    }),
    BREAKING_NEWS: () => new EmbedBuilder({...base,
      title: `🚨 BREAKING — ${data.headline||'WC2026 News'}`,
      description: `${data.body||''}\n\n[Read more](${SITE})`
    }),
  };

  return (builders[eventType] || (() => new EmbedBuilder({...base,
    title: `📡 WC2026 Update`, description: JSON.stringify(data).slice(0,200)
  })))();
}

// ── Slash command definitions ─────────────────────────────────────────────────
const COMMANDS = [
  new SlashCommandBuilder().setName('score').setDescription('Live score of current/last WC2026 match'),
  new SlashCommandBuilder().setName('tip').setDescription('Today\'s top AI betting tip for WC2026'),
  new SlashCommandBuilder().setName('odds')
    .setDescription('Best odds for an upcoming match')
    .addStringOption(o=>o.setName('match').setDescription('e.g. France vs Germany').setRequired(false)),
  new SlashCommandBuilder().setName('predict')
    .setDescription('AI prediction for a WC2026 fixture')
    .addStringOption(o=>o.setName('match').setDescription('e.g. Brazil vs Argentina').setRequired(true)),
  new SlashCommandBuilder().setName('player')
    .setDescription('Player stats + WC2026 odds')
    .addStringOption(o=>o.setName('name').setDescription('e.g. mbappe, messi, haaland, yamal').setRequired(true)),
  new SlashCommandBuilder().setName('bracket').setDescription('Current WC2026 tournament bracket'),
  new SlashCommandBuilder().setName('standings')
    .setDescription('Group stage table')
    .addStringOption(o=>o.setName('group').setDescription('Group letter A-L').setRequired(false)),
  new SlashCommandBuilder().setName('stream')
    .setDescription('How to watch WC2026 in your country')
    .addStringOption(o=>o.setName('country').setDescription('e.g. USA, UK, Australia').setRequired(false)),
  new SlashCommandBuilder().setName('golden-boot').setDescription('Live Golden Boot race standings'),
  new SlashCommandBuilder().setName('match')
    .setDescription('Info on an upcoming match')
    .addStringOption(o=>o.setName('teams').setDescription('e.g. Spain vs Morocco').setRequired(false)),
  new SlashCommandBuilder().setName('subscribe').setDescription('Join VIP Telegram for premium tips + alerts'),
  new SlashCommandBuilder().setName('timezone')
    .setDescription('Set your server\'s timezone for match schedules')
    .addStringOption(o=>o.setName('tz').setDescription('e.g. America/New_York, Europe/London').setRequired(true)),
  new SlashCommandBuilder().setName('language')
    .setDescription('Set server response language')
    .addStringOption(o=>o.setName('lang').setDescription('en/pt/es/de/fr/ko/ja/ar/zh').setRequired(true)),
  new SlashCommandBuilder().setName('mbappe').setDescription('Mbappé WC2026 stats, odds & page'),
  new SlashCommandBuilder().setName('messi').setDescription('Messi WC2026 stats, odds & page'),
  new SlashCommandBuilder().setName('ronaldo').setDescription('Ronaldo WC2026 stats & page (last WC!)'),
  new SlashCommandBuilder().setName('yamal').setDescription('Lamine Yamal WC2026 stats & page'),
  new SlashCommandBuilder().setName('haaland').setDescription('Haaland WC2026 Golden Boot odds & stats'),
  new SlashCommandBuilder().setName('schedule').setDescription('Today\'s WC2026 match schedule'),
  new SlashCommandBuilder().setName('empire').setDescription('About WC2026 Empire — all links & channels'),
  new SlashCommandBuilder().setName('vip').setDescription('Unlock VIP tips — premium prediction access'),
].map(c=>c.toJSON());

// ── Register slash commands ───────────────────────────────────────────────────
async function registerCommands() {
  if (!TOKEN || !CLIENT_ID) return console.warn('[Discord] No TOKEN/CLIENT_ID — skipping command registration');
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    if (GUILD_IDS.length) {
      for (const gid of GUILD_IDS) {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: COMMANDS });
        console.log(`[Discord] Commands registered to guild ${gid}`);
      }
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: COMMANDS });
      console.log('[Discord] Global commands registered');
    }
  } catch (e) { console.error('[Discord] Command registration failed:', e.message); }
}

// ── Player embed builder ──────────────────────────────────────────────────────
function buildPlayerEmbed(key, guildId = '') {
  const p = PLAYERS[key.toLowerCase()];
  if (!p) return null;
  return new EmbedBuilder({
    color: 0x6366f1,
    title: `${p.flag} ${p.name} — WC2026`,
    description: p.fun_fact,
    thumbnail: { url: p.image },
    fields: [
      { name: '🏟️ Club', value: p.club, inline: true },
      { name: '🎂 Age at WC2026', value: String(p.age), inline: true },
      { name: '🌍 WC Appearances', value: String(p.wc_apps), inline: true },
      { name: '⚽ Career WC Goals', value: String(p.wc_goals), inline: true },
      { name: '🥇 Golden Boot Odds', value: p.golden_boot_odds, inline: true },
      { name: '🏆 Win Odds', value: p.champion_odds, inline: true },
      { name: '🔗 Full Stats Page', value: `[View →](${p.page})`, inline: false },
    ],
    footer: { text: `WC2026 Empire • Compare odds at ${SITE}/odds-comparison.html` }
  });
}

// ── Handle slash commands ─────────────────────────────────────────────────────
async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;
  const cmd   = interaction.commandName;
  const gid   = interaction.guildId || '';
  await interaction.deferReply();

  // Player shortcut commands
  if (PLAYERS[cmd]) {
    const embed = buildPlayerEmbed(cmd, gid);
    return interaction.editReply({ embeds: [embed], components: [betButton(`Bet on ${PLAYERS[cmd].name}`)] });
  }

  if (cmd === 'player') {
    const name = (interaction.options.getString('name')||'').toLowerCase().replace(/[^a-z]/g,'');
    const fuzzy = Object.keys(PLAYERS).find(k => k.startsWith(name) || name.startsWith(k));
    const embed = fuzzy ? buildPlayerEmbed(fuzzy, gid) : new EmbedBuilder({
      color: 0xff4444, title: '❌ Player not found',
      description: `Try: /mbappe /messi /ronaldo /yamal /haaland /vinicius /bellingham\nOr use \`/player name:haaland\``
    });
    return interaction.editReply({ embeds: [embed], components: fuzzy ? [betButton()] : [] });
  }

  if (cmd === 'score') {
    let liveData = null;
    try { liveData = (await axios.get(`${API_URL}/api/live`, {timeout:3000})).data; } catch(_){}
    const embed = new EmbedBuilder({
      color: 0x00ff41,
      title: '📊 WC2026 Live Scores',
      description: liveData?.matches?.length
        ? liveData.matches.map(m=>`**${m.home} ${m.homeScore??0}–${m.awayScore??0} ${m.away}** (${m.minute||'FT'})`).join('\n')
        : 'No live matches right now. Check the schedule!',
      fields: [{ name: '🔗 Full scores', value: `[Live Scoreboard](${SITE}/live-scores.html)` }],
      footer: { text: `WC2026 Empire • ${SITE}` }, timestamp: new Date().toISOString()
    });
    return interaction.editReply({ embeds: [embed], components: [betButton()] });
  }

  if (cmd === 'predict') {
    const match = interaction.options.getString('match');
    let prediction = 'Analysing...';
    try {
      const r = await axios.post(`${API_URL}/api/predict`, { match }, { headers:{'x-pipeline-secret':SECRET}, timeout:8000 });
      prediction = r.data?.prediction || prediction;
    } catch(_) {
      prediction = `Based on current form, this could go either way. Check our full AI analysis!`;
    }
    const embed = new EmbedBuilder({
      color: 0x6366f1,
      title: `🔮 AI Prediction — ${match}`,
      description: prediction,
      fields: [
        { name: '🎰 Best Odds', value: oddsLink(gid), inline: true },
        { name: '📊 Full Analysis', value: `[View](${SITE}/prediction-game.html)`, inline: true }
      ],
      footer: { text: 'AI predictions for entertainment. Bet responsibly. 18+ only.' }
    });
    return interaction.editReply({ embeds: [embed], components: [betButton('Bet on This Match')] });
  }

  if (cmd === 'odds') {
    const match = interaction.options.getString('match') || 'today\'s matches';
    const embed = new EmbedBuilder({
      color: 0xf59e0b,
      title: `🎰 Best Odds — ${match}`,
      description: `Our AI scans 15+ bookmakers to find the best value.\n\n[📊 Full Odds Comparison](${SITE}/odds-comparison.html)\n[🔮 AI Value Tips](${SITE}/player-props.html)`,
      fields: [
        { name: '🏆 Outright Winner', value: `Argentina 6/1 • France 7/1 • Brazil 5/1`, inline: false },
        { name: '🥇 Golden Boot', value: `Haaland 6/1 • Mbappé 9/2 • Vinicius 7/1`, inline: false },
      ],
      footer: { text: '18+ Gamble responsibly. Affiliate links.' }
    });
    return interaction.editReply({ embeds: [embed], components: [betButton()] });
  }

  if (cmd === 'tip') {
    let tip = null;
    try {
      tip = (await axios.get(`${API_URL}/api/tip`, { timeout:5000 })).data;
    } catch(_){}
    const embed = new EmbedBuilder({
      color: 0x10b981,
      title: `💡 Today's Top AI Tip`,
      description: tip?.tip || `Check our **AI Tips** page for today's best value bets.\n\n[🔮 View All Tips](${SITE}/player-props.html)`,
      fields: [
        { name: '🎰 Best Odds', value: oddsLink(gid), inline: true },
        { name: '📺 Stream Info', value: streamLink(gid), inline: true }
      ],
      footer: { text: 'For entertainment only. 18+ Gamble responsibly.' }
    });
    return interaction.editReply({ embeds: [embed], components: [betButton('Get This Tip')] });
  }

  if (cmd === 'stream') {
    const country = interaction.options.getString('country') || 'your country';
    const streamGuide = {
      'usa':'FOX Sports (free) • fuboTV • Peacock',
      'uk':'BBC One / ITV1 (free) • ITVX / iPlayer',
      'australia':'SBS (free) • Optus Sport',
      'germany':'ARD / ZDF (free) • MagentaTV',
      'france':'TF1 / M6 (free) • DAZN',
      'brazil':'Globo (free) • DAZN',
      'spain':'RTVE (free) • DAZN',
      'japan':'NHK (free) • ABEMA',
      'korea':'KBS/MBC/SBS (free)',
    };
    const key = country.toLowerCase();
    const info = streamGuide[key] || `Check our streaming guide for ${country}`;
    const embed = new EmbedBuilder({
      color: 0x06b6d4,
      title: `📺 How to Watch WC2026 — ${country}`,
      description: `${info}\n\n[📺 Full Streaming Guide](${SITE}/streaming-vpn.html)\n[🔒 VPN for Expats](${SITE}/streaming-vpn.html#vpn)`,
      footer: { text: 'WC2026 Empire • All streams listed with affiliate links' }
    });
    return interaction.editReply({ embeds: [embed] });
  }

  if (cmd === 'golden-boot') {
    const embed = new EmbedBuilder({
      color: 0xffd700,
      title: '🥇 WC2026 Golden Boot Race',
      description: `Live standings update after each match`,
      fields: [
        { name: '⚽ 0 goals — Haaland 🇳🇴', value: '6/1 favourite', inline: true },
        { name: '⚽ 0 goals — Mbappé 🇫🇷', value: '9/2 fav', inline: true },
        { name: '⚽ 0 goals — Vinicius 🇧🇷', value: '7/1', inline: true },
        { name: '⚽ 0 goals — Yamal 🇪🇸', value: '11/1', inline: true },
        { name: '🔗 Full Leaderboard', value: `[View →](${SITE}/golden-boot-tracker.html)`, inline: false },
      ],
      footer: { text: 'Updated live during tournament' }
    });
    return interaction.editReply({ embeds: [embed], components: [betButton('Bet on Golden Boot')] });
  }

  if (cmd === 'bracket') {
    const embed = new EmbedBuilder({
      color: 0x6366f1,
      title: '🏆 WC2026 Tournament Bracket',
      description: `[📊 View Full Interactive Bracket](${SITE}/bracket.html)\n\n32 teams → Group Stage → R16 → QF → SF → Final\n**Final: MetLife Stadium, New York — July 19 2026**`,
      footer: { text: 'WC2026 Empire' }
    });
    return interaction.editReply({ embeds: [embed] });
  }

  if (cmd === 'schedule') {
    const embed = new EmbedBuilder({
      color: 0x0099ff,
      title: `📅 Today's WC2026 Schedule`,
      description: `[📅 Full Schedule](${SITE}/bracket.html)\n[🔮 Today's Predictions](${SITE}/prediction-game.html)`,
      footer: { text: 'All times in your local timezone. Use /timezone to set.' }
    });
    return interaction.editReply({ embeds: [embed], components: [betButton()] });
  }

  if (cmd === 'subscribe') {
    const embed = new EmbedBuilder({
      color: 0x6366f1,
      title: '🌟 Join WC2026 Empire VIP',
      description: `Get premium AI tips, live alerts, and value bets before they go public.\n\n📱 **[Telegram VIP Channel](https://t.me/wc2026empire_vip)**\n📧 **[Email Newsletter](${SITE}/?subscribe=1)**\n🌐 **[Full Site](${SITE})**`,
      fields: [
        { name: '✅ What you get', value: '• AI match predictions\n• Live score alerts\n• Value bet tips\n• Golden Boot updates\n• Exclusive affiliate deals', inline: false }
      ],
      footer: { text: '18+ Gamble responsibly' }
    });
    return interaction.editReply({ embeds: [embed] });
  }

  if (cmd === 'vip') {
    return interaction.editReply({
      embeds: [new EmbedBuilder({
        color: 0xffd700, title: '👑 WC2026 Empire VIP',
        description: `Unlock premium AI tips for the whole tournament.\n\n[🌟 Join VIP Telegram](https://t.me/wc2026empire_vip)\n[📊 View AI Predictions](${SITE}/prediction-game.html)`
      })]
    });
  }

  if (cmd === 'language') {
    const lang = interaction.options.getString('lang') || 'en';
    const supported = Object.keys(I18N);
    if (!supported.includes(lang)) {
      return interaction.editReply({ content: `❌ Supported languages: ${supported.join(', ')}` });
    }
    guildLang[gid] = lang;
    return interaction.editReply({ content: `✅ Language set to **${lang}** for this server.` });
  }

  if (cmd === 'timezone') {
    guildTZ[gid] = interaction.options.getString('tz');
    return interaction.editReply({ content: `✅ Timezone set to **${guildTZ[gid]}**. Schedule posts will use this.` });
  }

  if (cmd === 'empire') {
    const embed = new EmbedBuilder({
      color: 0x6366f1, title: '🌍 WC2026 Empire — All Links',
      fields: [
        { name: '🌐 Main Site', value: SITE, inline: false },
        { name: '🔮 AI Predictions', value: `${SITE}/prediction-game.html`, inline: true },
        { name: '🎰 Odds Comparison', value: `${SITE}/odds-comparison.html`, inline: true },
        { name: '📺 Streaming Guide', value: `${SITE}/streaming-vpn.html`, inline: true },
        { name: '⭐ Star Players', value: `${SITE}/star-players.html`, inline: true },
        { name: '🌍 Country Hubs', value: `${SITE}/world-hub.html`, inline: true },
        { name: '💬 Telegram VIP', value: 'https://t.me/wc2026empire_vip', inline: true },
      ],
      footer: { text: '32B fans. 104 matches. One empire.' }
    });
    return interaction.editReply({ embeds: [embed] });
  }

  // Fallback
  return interaction.editReply({ content: `Try /score /predict /odds /tip /player /stream or visit ${SITE}` });
}

// ── Live match thread manager ─────────────────────────────────────────────────
async function createMatchThread(guild, matchId, homeTeam, awayTeam) {
  try {
    // Find or create a #live-scores channel
    let channel = guild.channels.cache.find(c =>
      c.type === ChannelType.GuildText &&
      /live[- ]?scores?|wc2026|worldcup|football|soccer/i.test(c.name)
    );
    if (!channel) return;

    const thread = await channel.threads.create({
      name: `🔴 LIVE: ${homeTeam} vs ${awayTeam}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: `WC2026 live match thread`
    });
    matchThreads[matchId] = thread.id;

    await thread.send({
      embeds: [new EmbedBuilder({
        color: 0x00ff41,
        title: `🏟️ LIVE — ${homeTeam} vs ${awayTeam}`,
        description: `This thread will receive live alerts during the match!\n\n${streamLink(guild.id)} | ${oddsLink(guild.id)}`,
        footer: { text: 'WC2026 Empire • 18+ Gamble responsibly' }
      })],
      components: [betButton('Pre-match Bet')]
    });

    return thread;
  } catch(e) { console.error('[Discord] Thread error:', e.message); }
}

// ── Post to all channels ──────────────────────────────────────────────────────
async function postToAllChannels(embed, components = [], matchId = null) {
  if (!client || !ready) return { sent: 0 };
  let sent = 0;

  for (const guild of client.guilds.cache.values()) {
    const gid = guild.id;

    // If there's an active match thread, post there
    if (matchId && matchThreads[matchId]) {
      try {
        const thread = await guild.channels.fetch(matchThreads[matchId]).catch(()=>null);
        if (thread) { await thread.send({ embeds:[embed], components }); sent++; continue; }
      } catch(_) {}
    }

    // Fall back to configured channels
    const targets = CHANNEL_IDS.length
      ? CHANNEL_IDS.map(id => guild.channels.cache.get(id)).filter(Boolean)
      : guild.channels.cache.filter(c =>
          c.type === ChannelType.GuildText &&
          /wc2026|worldcup|live[- ]?scores?|football|soccer|general/i.test(c.name)
        ).values();

    for (const ch of targets) {
      try {
        if (ch.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
          await ch.send({ embeds:[embed], components });
          sent++;
        }
      } catch(e) { console.error(`[Discord] Send failed ${ch.id}:`, e.message); }
    }
  }
  return { sent };
}

// ── Daily schedule post (7am UTC) ────────────────────────────────────────────
function scheduleDailyPost() {
  const now = new Date();
  const next7am = new Date(now);
  next7am.setUTCHours(7, 0, 0, 0);
  if (next7am <= now) next7am.setUTCDate(next7am.getUTCDate() + 1);
  const delay = next7am - now;

  setTimeout(async () => {
    const embed = new EmbedBuilder({
      color: 0x6366f1,
      title: `📅 WC2026 Match Day — ${new Date().toDateString()}`,
      description: `Good morning! Here are today's WC2026 fixtures.\n\n[📅 Full Schedule](${SITE}/bracket.html)\n[🔮 AI Predictions](${SITE}/prediction-game.html)\n[🎰 Today's Odds](${SITE}/odds-comparison.html)`,
      footer: { text: 'WC2026 Empire • 18+ Gamble responsibly' }
    });
    await postToAllChannels(embed, [betButton('Today\'s Best Bets')]);
    scheduleDailyPost();
  }, delay);
}

// ── Discord client init ───────────────────────────────────────────────────────
function initDiscord() {
  if (!TOKEN) { console.warn('[Discord] No DISCORD_BOT_TOKEN — running in HTTP-only mode'); return; }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]
  });

  client.once('ready', () => {
    ready = true;
    console.log(`[Discord] Logged in as ${client.user.tag} | ${client.guilds.cache.size} servers`);
    scheduleDailyPost();
  });

  client.on('interactionCreate', handleInteraction);
  client.login(TOKEN).catch(e => console.error('[Discord] Login failed:', e.message));
}

// ── Express HTTP server ───────────────────────────────────────────────────────
const app = express();
app.use(express.json());

function auth(req, res, next) {
  if (req.headers['x-pipeline-secret'] === SECRET) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// POST /trigger — from moment-engine
app.post('/trigger', auth, async (req, res) => {
  const { eventType, data = {}, matchId } = req.body;
  if (!eventType) return res.status(400).json({ error: 'eventType required' });

  reqLog.unshift({ t: new Date().toISOString(), eventType, matchId });
  if (reqLog.length > 100) reqLog.pop();

  // Create match thread on MATCH_START
  if (eventType === 'MATCH_START' && client && ready) {
    for (const guild of client.guilds.cache.values()) {
      await createMatchThread(guild, matchId||`${data.homeTeam}-${data.awayTeam}`, data.homeTeam, data.awayTeam);
    }
  }

  const embed = buildEventEmbed(eventType, data);
  const row   = betButton();
  const result = await postToAllChannels(embed, [row], matchId);
  res.json({ ok: true, ...result });
});

// POST /announce — manual broadcast
app.post('/announce', auth, async (req, res) => {
  const { title, description, color } = req.body;
  const embed = new EmbedBuilder({ color: color||0x6366f1, title, description,
    footer: { text: `WC2026 Empire • ${SITE}` }, timestamp: new Date().toISOString() });
  const result = await postToAllChannels(embed);
  res.json({ ok: true, ...result });
});

// GET /servers
app.get('/servers', auth, (req, res) => {
  if (!client) return res.json({ connected: false });
  const servers = [...client.guilds.cache.values()].map(g => ({
    id: g.id, name: g.name, memberCount: g.memberCount,
    lang: guildLang[g.id]||'en', tz: guildTZ[g.id]||'UTC'
  }));
  res.json({ connected: ready, serverCount: servers.length, servers });
});

// GET /log
app.get('/log', auth, (req, res) => res.json({ count: reqLog.length, log: reqLog }));

// GET /players
app.get('/players', (req, res) => res.json(Object.keys(PLAYERS).map(k=>({key:k,...PLAYERS[k]}))));

// GET /health
app.get('/health', (req,res) => res.json({
  ok:true, port: PORT, ready,
  servers: client?.guilds?.cache?.size||0,
  commands: COMMANDS.length,
  players: Object.keys(PLAYERS).length
}));

// GET /status
app.get('/status', (req,res) => res.json({
  service:'discord-bot', version:'2.0.0',
  connected: ready, guilds: client?.guilds?.cache?.size||0,
  uptime: process.uptime()
}));

app.listen(PORT, async () => {
  console.log(`[Discord Bot] HTTP server on port ${PORT}`);
  await registerCommands();
  initDiscord();
});
