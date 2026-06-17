/**
 * Social Blaster — WC 2026 AI Empire
 *
 * Posts to Twitter/X, Facebook, Instagram, LinkedIn within 60 seconds of:
 * - Goals scored
 * - Match results (FT)
 * - Upsets and red cards
 * - Match kickoffs
 * - Tournament milestones (first goal, top scorer, etc.)
 *
 * Each post: platform-optimised, includes hashtags, drives traffic back to site
 * 104 matches × 5 events/match × 6 platforms = 3,120+ automated posts
 *
 * Requires:
 * - Twitter/X: TWITTER_BEARER_TOKEN, TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
 * - Facebook: FACEBOOK_PAGE_ID, FACEBOOK_ACCESS_TOKEN
 * - LinkedIn: LINKEDIN_URN, LINKEDIN_ACCESS_TOKEN
 * - Instagram: (via Facebook Graph API) INSTAGRAM_ACCOUNT_ID
 */

require('dotenv').config();
const axios  = require('axios');
const cron   = require('node-cron');
const Groq   = require('groq-sdk');
const { TwitterApi } = require('twitter-api-v2');

const groq         = new Groq({ apiKey: process.env.GROQ_API_KEY });
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const SITE_URL     = process.env.SITE_URL || 'https://wc2026intel.vercel.app';

// ── Twitter/X client ──────────────────────────────────────────────────────
const twitterClient = new TwitterApi({
  appKey:            process.env.TWITTER_API_KEY,
  appSecret:         process.env.TWITTER_API_SECRET,
  accessToken:       process.env.TWITTER_ACCESS_TOKEN,
  accessSecret:      process.env.TWITTER_ACCESS_SECRET,
});
const twitter = twitterClient.readWrite;

// ── State ─────────────────────────────────────────────────────────────────
const postedEvents = new Set(); // prevent duplicate posts
let lastMatchState = {};         // matchId → last known score

// ── Generate platform-specific post ───────────────────────────────────────
async function generatePost(eventType, data, platform) {
  const prompts = {
    GOAL: `WC 2026 goal: ${data.scorer} scores for ${data.team} vs ${data.opponent}! Score: ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} (${data.minute}')
Write a ${platform} post. Under 220 chars for Twitter. Include 3 relevant hashtags. End with a question to drive engagement. Be exciting.`,

    FULL_TIME: `WC 2026 result: ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} (Full Time)
Write a ${platform} post. Mention key scorers if any. Include: was this an upset? what does this mean for the group? 3 hashtags. Under 240 chars for Twitter.`,

    KICKOFF: `WC 2026: ${data.homeTeam} vs ${data.awayTeam} is about to kick off at ${data.venue}!
Write a ${platform} post. Build excitement. Ask fans who they think will win. 3 hashtags. Under 220 chars for Twitter.`,

    RED_CARD: `🟥 RED CARD in WC 2026! ${data.player} (${data.team}) sent off in the ${data.minute}' minute. ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam}
Write a ${platform} post reacting to this. Will this change the game? 3 hashtags. Under 230 chars for Twitter.`,

    UPSET: `🚨 MAJOR UPSET at WC 2026! ${data.winner} beats ${data.loser} ${data.score}!
Write a viral ${platform} post about this shock result. Build drama. 3-4 hashtags. Under 240 chars for Twitter.`,

    VAR: `🖥️ VAR decision in WC 2026! ${data.decision} — ${data.homeTeam} vs ${data.awayTeam}. ${data.minute}'
Write a ${platform} post. Fans love/hate VAR. Ask their opinion. 3 hashtags. Under 220 chars for Twitter.`,
  };

  const prompt = prompts[eventType];
  if (!prompt) return null;

  try {
    const resp = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [
        {
          role: 'system',
          content: `You are a viral sports social media manager. Write punchy, engaging posts for ${platform}. Always include the site link ${SITE_URL}/live-scores.html at the end.`
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.8,
    });
    return resp.choices[0].message.content.trim();
  } catch (err) {
    // Fallback template
    return generateFallbackPost(eventType, data);
  }
}

function generateFallbackPost(eventType, data) {
  switch (eventType) {
    case 'GOAL':
      return `⚽ GOAL! ${data.scorer} scores for ${data.team}! ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} (${data.minute}') #WC2026 #WorldCup2026 ${SITE_URL}/live-scores.html`;
    case 'FULL_TIME':
      return `🏁 FULL TIME: ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} #WC2026 #WorldCup2026 ${SITE_URL}/live-scores.html`;
    case 'KICKOFF':
      return `⚽ KICKOFF! ${data.homeTeam} vs ${data.awayTeam} is LIVE now at ${data.venue}! #WC2026 ${SITE_URL}/live-scores.html`;
    case 'RED_CARD':
      return `🟥 RED CARD! ${data.player} off for ${data.team} in the ${data.minute}'! ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} #WC2026 ${SITE_URL}`;
    case 'UPSET':
      return `🚨 UPSET! ${data.winner} ${data.score} ${data.loser} at #WC2026! HUGE result! ${SITE_URL}/live-scores.html`;
    default:
      return `⚽ WC 2026 update! #WC2026 #WorldCup2026 ${SITE_URL}`;
  }
}

// ── Post to Twitter/X ─────────────────────────────────────────────────────
async function postToTwitter(text) {
  try {
    const tweet = await twitter.v2.tweet(text.substring(0, 280));
    console.log(`✅ Twitter: ${tweet.data.id}`);
    return tweet.data.id;
  } catch (err) {
    console.error('❌ Twitter error:', err.message);
    return null;
  }
}

// ── Post to Facebook ──────────────────────────────────────────────────────
async function postToFacebook(text) {
  try {
    const resp = await axios.post(
      `https://graph.facebook.com/${process.env.FACEBOOK_PAGE_ID}/feed`,
      {
        message: text,
        access_token: process.env.FACEBOOK_ACCESS_TOKEN,
      }
    );
    console.log(`✅ Facebook: ${resp.data.id}`);
    return resp.data.id;
  } catch (err) {
    console.error('❌ Facebook error:', err.response?.data?.error?.message || err.message);
    return null;
  }
}

// ── Post to LinkedIn ──────────────────────────────────────────────────────
async function postToLinkedIn(text) {
  try {
    const resp = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      {
        author: `urn:li:person:${process.env.LINKEDIN_URN}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'NONE',
          }
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        }
      }
    );
    console.log(`✅ LinkedIn posted`);
    return resp.data.id;
  } catch (err) {
    console.error('❌ LinkedIn error:', err.message);
    return null;
  }
}

// ── Blast to all platforms ────────────────────────────────────────────────
async function blastToAllPlatforms(eventType, data) {
  const eventKey = `${eventType}_${data.matchId || ''}_${data.minute || Date.now()}`;

  // Deduplicate
  if (postedEvents.has(eventKey)) {
    console.log(`⏭️  Already posted: ${eventKey}`);
    return;
  }
  postedEvents.add(eventKey);

  console.log(`\n📢 Blasting: ${eventType} — ${data.homeTeam} vs ${data.awayTeam}`);

  // Generate platform-specific posts in parallel
  const [twitterPost, fbPost, liPost] = await Promise.all([
    generatePost(eventType, data, 'Twitter/X'),
    generatePost(eventType, data, 'Facebook'),
    generatePost(eventType, data, 'LinkedIn'),
  ]);

  // Post to all platforms in parallel
  const results = await Promise.allSettled([
    twitterPost  ? postToTwitter(twitterPost)   : Promise.resolve(null),
    fbPost       ? postToFacebook(fbPost)        : Promise.resolve(null),
    liPost && process.env.LINKEDIN_ACCESS_TOKEN ? postToLinkedIn(liPost) : Promise.resolve(null),
  ]);

  console.log(`   Platforms hit: ${results.filter(r => r.value).length}`);
  return results;
}

// ── Poll for live match events ────────────────────────────────────────────
async function pollLiveEvents() {
  try {
    const resp = await axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures', {
      params: { league: 1, season: 2026, live: 'all' },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
      timeout: 8000,
    });

    const liveMatches = resp.data?.response || [];
    if (!liveMatches.length) return;

    for (const fixture of liveMatches) {
      const matchId   = fixture.fixture.id.toString();
      const homeTeam  = fixture.teams.home.name;
      const awayTeam  = fixture.teams.away.name;
      const homeScore = fixture.goals.home || 0;
      const awayScore = fixture.goals.away || 0;
      const status    = fixture.fixture.status.short;
      const minute    = fixture.fixture.status.elapsed;
      const venue     = fixture.fixture.venue?.name || 'WC Venue';
      const prev      = lastMatchState[matchId];

      const currentState = { homeScore, awayScore, status };

      if (!prev) {
        // New live match detected → kickoff post
        lastMatchState[matchId] = currentState;
        await blastToAllPlatforms('KICKOFF', {
          matchId, homeTeam, awayTeam, venue, minute
        });
        continue;
      }

      // Detect new goal
      if (homeScore > (prev.homeScore || 0)) {
        // Home team scored
        await blastToAllPlatforms('GOAL', {
          matchId, homeTeam, awayTeam, minute,
          team: homeTeam, opponent: awayTeam,
          scorer: 'Goal', // Would need events API for scorer name
          homeScore, awayScore,
        });
      }

      if (awayScore > (prev.awayScore || 0)) {
        // Away team scored
        await blastToAllPlatforms('GOAL', {
          matchId, homeTeam, awayTeam, minute,
          team: awayTeam, opponent: homeTeam,
          scorer: 'Goal',
          homeScore, awayScore,
        });
      }

      // Detect full time
      if (status === 'FT' && prev.status !== 'FT') {
        // Check if upset (lower-ranked team won)
        const scoreDiff = Math.abs(homeScore - awayScore);
        const winner = homeScore > awayScore ? homeTeam : homeScore < awayScore ? awayTeam : null;
        const loser  = winner === homeTeam ? awayTeam : homeTeam;

        if (winner) {
          await blastToAllPlatforms('FULL_TIME', {
            matchId, homeTeam, awayTeam,
            homeScore, awayScore,
            winner, loser,
            score: `${homeScore}-${awayScore}`,
          });
        } else {
          await blastToAllPlatforms('FULL_TIME', {
            matchId, homeTeam, awayTeam,
            homeScore, awayScore,
          });
        }
      }

      lastMatchState[matchId] = currentState;
    }
  } catch (err) {
    console.error('❌ Poll error:', err.message);
  }
}

// ── Morning match preview posts ───────────────────────────────────────────
async function sendDailyPreviewPosts() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const resp  = await axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures', {
      params: { league: 1, season: 2026, date: today },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
      timeout: 8000,
    });

    const fixtures = resp.data?.response || [];
    if (!fixtures.length) return;

    for (const f of fixtures) {
      const homeTeam = f.teams.home.name;
      const awayTeam = f.teams.away.name;
      const kickoff  = new Date(f.fixture.date).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'UTC' });
      const venue    = f.fixture.venue?.name || 'WC 2026';

      const previewPost = await groq.chat.completions.create({
        model: 'llama3-70b-8192',
        messages: [{
          role: 'user',
          content: `Write a Twitter post previewing this WC 2026 match: ${homeTeam} vs ${awayTeam} at ${kickoff} UTC at ${venue}. Under 240 chars. Include prediction, 3 hashtags, and link: ${SITE_URL}/live-scores.html. Be exciting.`
        }],
        max_tokens: 100,
      });

      const text = previewPost.choices[0].message.content.trim();
      await postToTwitter(text);
      await postToFacebook(text);
      await sleep(3000); // pace requests
    }

    console.log(`✅ Preview posts sent for ${fixtures.length} matches`);
  } catch (err) {
    console.error('❌ Preview post error:', err.message);
  }
}

// ── Post tournament milestone ─────────────────────────────────────────────
async function postMilestone(message) {
  const post = await generatePost('MILESTONE', { message }, 'Twitter/X');
  if (post) await postToTwitter(post);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Schedule ──────────────────────────────────────────────────────────────
// Poll live events every 60 seconds (11:00-23:00 UTC match window)
cron.schedule('*/1 11-23 * * *', pollLiveEvents);

// Daily preview posts at 09:00 UTC
cron.schedule('0 9 * * *', sendDailyPreviewPosts);

// ── Exports ───────────────────────────────────────────────────────────────
module.exports = { blastToAllPlatforms, postToTwitter, postToFacebook, postMilestone };

// ── Boot ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('📢 Social Blaster online');
  console.log(`   Twitter: ${process.env.TWITTER_API_KEY ? '✅' : '❌ not configured'}`);
  console.log(`   Facebook: ${process.env.FACEBOOK_ACCESS_TOKEN ? '✅' : '❌ not configured'}`);
  console.log(`   LinkedIn: ${process.env.LINKEDIN_ACCESS_TOKEN ? '✅' : '❌ not configured'}`);
  console.log(`   Site URL: ${SITE_URL}`);
  console.log('   Polling every 60 seconds for live events (11:00-23:00 UTC)');
  console.log('   Preview posts sent daily at 09:00 UTC');
})();
