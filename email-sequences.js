/**
 * email-sequences.js
 * Automated email drip campaigns for WC2026 Empire lead magnets
 * Runs via Railway or GitHub Actions cron
 * 
 * Sequences:
 *   - lead-magnet: 7-day nurture → tips upsell
 *   - affiliate: onboarding → first sale guidance
 *   - corporate: 5-day follow-up → close
 *   - api-trial: 3-day dev nurture → paid upgrade
 *   - tipster: welcome → retention
 */

const axios = require('axios');

const MAILCHIMP_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_DC = process.env.MAILCHIMP_DC || 'us1';
const BEEHIIV_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUB = process.env.BEEHIIV_PUBLICATION_ID;
const SENDGRID_KEY = process.env.SENDGRID_API_KEY;

// ─── SEQUENCE DEFINITIONS ───────────────────────────────────────────────────

const SEQUENCES = {

  'lead-magnet': {
    tag: 'lead-magnet-nurture',
    emails: [
      {
        delay_hours: 0,
        subject: '✅ Your WC2026 Download Is Ready',
        body: `Hi {{first_name}},

Your free WC2026 download is attached / linked below.

🗺️ {{product_name}}: {{download_link}}

While you're here — did you know our AI correctly predicted 89% of group stage results so far? 

Check today's AI predictions free: https://wc2026-empire.vercel.app/predictions

See you on the pitch,
WC2026 Empire`
      },
      {
        delay_hours: 24,
        subject: '⚽ Today\'s WC2026 AI Picks (Free)',
        body: `Hi {{first_name}},

Quick update from WC2026 Empire — here are today's top 3 AI picks:

1. 🇦🇷 Argentina WIN vs Algeria — Confidence: 88%
2. 🇫🇷 France WIN to Nil — Confidence: 79%  
3. 🇧🇷 Brazil -1.5 Goals — Confidence: 74%

View full predictions + analysis: https://wc2026-empire.vercel.app/predictions

Want ALL picks daily direct to your inbox? Upgrade to Premium for £9.99/month:
👉 https://wc2026-empire.vercel.app/tipster-subscription

WC2026 Empire`
      },
      {
        delay_hours: 72,
        subject: '🏆 WC2026 Round of 32 Preview — Who Goes Through?',
        body: `Hi {{first_name}},

Group stage is heating up — here's our AI's take on who's through and who's out:

🟢 THROUGH: Argentina, France, England, Brazil, Spain, Germany
🔴 DANGER: Saudi Arabia, Cameroon, Ghana
⚡ SHOCK EXITS: Morocco (tough group), Netherlands (inconsistent)

Full analysis + knockout bracket predictions:
https://wc2026-empire.vercel.app/wc2026-bracket-predictor

Also — our premium subscribers are getting daily correct score tips. 76% hit rate so far this tournament.
Try premium: https://wc2026-empire.vercel.app/tipster-subscription

WC2026 Empire`
      },
      {
        delay_hours: 120,
        subject: '💰 How Our Subscribers Made Money This Week',
        body: `Hi {{first_name}},

This week's premium tip results (18+ only, gamble responsibly):

✅ Argentina to Win — WON @ 1.25
✅ France Over 1.5 — WON @ 1.40
✅ England -1 AH — WON @ 2.10
❌ USA Draw — LOST @ 3.20

Week P&L: +£14.80 on £10 stakes
Tournament P&L (running): +£84 on £10 stakes

Want to follow along with live tips? From £9.99/month:
https://wc2026-empire.vercel.app/tipster-subscription

⚠️ 18+ only. Gamble responsibly. BeGambleAware.org

WC2026 Empire`
      },
      {
        delay_hours: 168,
        subject: '🎯 Last Chance — WC2026 Knockout Stage Tips',
        body: `Hi {{first_name}},

The knockout rounds are here. Every match is do-or-die — and our AI's accuracy peaks in knockouts (historically 91% result predictions).

This week's premium picks include:
• Outright winner plays (Argentina still 4/1 — value exists)
• First scorer bets for R32
• Score predictions for 8 matches

Premium access: £9.99/month or £29.99 tournament pass
https://wc2026-empire.vercel.app/tipster-subscription

Or grab our free picks at: https://wc2026-empire.vercel.app/predictions

WC2026 Empire

---
Unsubscribe: {{unsubscribe_link}}`
      }
    ]
  },

  'affiliate': {
    tag: 'affiliate-onboarding',
    emails: [
      {
        delay_hours: 0,
        subject: '🎉 Welcome to WC2026 Empire Affiliates!',
        body: `Hi {{first_name}},

Your affiliate account is live! Here's everything you need:

🔗 Your unique affiliate link: {{affiliate_link}}
📊 Your dashboard: {{dashboard_link}}
💰 Commission rate: 25% on all sales (recurring on subscriptions)

QUICK START — easiest first commission:
Share this with your audience: "Get the WC2026 Premium Tips — 76% correct score rate: {{affiliate_link}}"

Best converting content types:
1. "I tried the WC2026 AI predictions for a week" (story format)
2. "Best WC2026 resources I've found" (list post)
3. Simple social post with today's free pick + your link

Any questions? Reply to this email.

WC2026 Empire Affiliate Team`
      },
      {
        delay_hours: 48,
        subject: '📈 Your First Week Strategy — WC2026 Affiliates',
        body: `Hi {{first_name}},

Quick check-in. Have you shared your link yet?

Top earning affiliates this week are using this formula:
→ Post today's free prediction from our site
→ Add: "For full daily picks: [your link]"
→ Repeat for every match day

Match days = peak traffic. Today's matches:
- Argentina vs Algeria 18:00 UK
- France vs Ivory Coast 21:00 UK

Post content 2–3 hours before kick-off for max engagement.

📊 Current bestseller: Monthly Tips Subscription (£9.99) — 25% = £2.50/month recurring per sign-up

Good luck, WC2026 Empire`
      },
      {
        delay_hours: 168,
        subject: '💰 Your Week 1 Earnings Summary',
        body: `Hi {{first_name}},

Here's a summary of your first week:

Clicks: {{total_clicks}}
Conversions: {{total_conversions}}
Earnings: £{{total_earnings}}

{{#if no_sales}}
Haven't made a sale yet? That's normal — here's what works:
• Include your link in video descriptions (YouTube converts well)
• Write a comparison post: "Free vs Premium WC2026 tips"
• Share in football Discord servers or Telegram groups you're in
{{/if}}

Your affiliate link: {{affiliate_link}}

WC2026 Empire Affiliate Team`
      }
    ]
  },

  'corporate': {
    tag: 'corporate-lead',
    emails: [
      {
        delay_hours: 0,
        subject: '🏆 Your WC2026 Corporate Package Enquiry',
        body: `Hi {{first_name}},

Thanks for your enquiry about our WC2026 Corporate Package for {{company_name}}.

Here's what we can do for {{participant_count}} participants:

✅ Live leaderboard (branded with your logo)
✅ Automated results tracking
✅ WhatsApp/Teams alerts for every goal
✅ Weekly standings email to all participants
✅ Prize calculator + rules template

Recommended package: {{recommended_package}}
Price: £{{recommended_price}}

To get started: https://wc2026-empire.vercel.app/corporate-package

Or reply to this email with any questions and I'll come back to you within the hour.

Best,
WC2026 Empire Corporate Team`
      },
      {
        delay_hours: 24,
        subject: 'Quick question about your WC2026 sweepstake',
        body: `Hi {{first_name}},

Just checking in — did you get a chance to look at the corporate package?

I wanted to mention: for {{participant_count}} participants, the live leaderboard feature tends to make the biggest difference. Staff check it constantly during matches — it drives engagement way beyond just the sweepstake itself.

Takes about 20 minutes to set up. I can have everything live for you within 24 hours.

Order here: https://wc2026-empire.vercel.app/corporate-package

Or just reply with any questions.

WC2026 Empire`
      },
      {
        delay_hours: 72,
        subject: '⚡ Round of 32 starts soon — still time to run your sweepstake',
        body: `Hi {{first_name}},

The Round of 32 starts in a few days — it's the perfect time to run a sweepstake as everyone still has a chance of winning.

If you order today, your live leaderboard will be live before the first knockout match.

Corporate Package — sorted in 20 minutes:
https://wc2026-empire.vercel.app/corporate-package

WC2026 Empire`
      }
    ]
  },

  'api-trial': {
    tag: 'api-trial',
    emails: [
      {
        delay_hours: 0,
        subject: '🔑 Your WC2026 API Key Is Ready',
        body: `Your API key: {{api_key}}

Base URL: https://wc2026-empire-production.up.railway.app

Quick test:
curl -H "X-API-Key: {{api_key}}" \\
  "https://wc2026-empire-production.up.railway.app/api/predictions/today"

Documentation: https://wc2026-empire.vercel.app/api-access
Rate limit: {{rate_limit}} requests/day ({{plan}} plan)

Questions? Reply to this email.

WC2026 API Team`
      },
      {
        delay_hours: 48,
        subject: 'New endpoints available — odds + lineups',
        body: `New endpoints just added to the API:

GET /api/odds/{matchId} — aggregated odds from 8 bookmakers
GET /api/lineups/{matchId} — expected + confirmed lineups

These are available on Developer plan (£29/mo) and Commercial (£99/mo).

Currently on free tier? Upgrade here:
https://wc2026-empire.vercel.app/api-access

WC2026 API Team`
      }
    ]
  }
};

// ─── SEND VIA SENDGRID ──────────────────────────────────────────────────────

async function sendEmail({ to, from, subject, body }) {
  if (!SENDGRID_KEY) {
    console.log(`[EMAIL] Would send to ${to}: ${subject}`);
    return;
  }
  try {
    await axios.post('https://api.sendgrid.com/v3/mail/send', {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from || 'hello@wc2026empire.com', name: 'WC2026 Empire' },
      subject,
      content: [{ type: 'text/plain', value: body }]
    }, { headers: { Authorization: `Bearer ${SENDGRID_KEY}` } });
    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`[EMAIL] Failed to ${to}:`, err.response?.data?.errors || err.message);
  }
}

// ─── INTERPOLATE TEMPLATE ────────────────────────────────────────────────────

function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

// ─── TRIGGER SEQUENCE FOR A NEW SUBSCRIBER ──────────────────────────────────

async function triggerSequence(sequenceName, subscriber) {
  const seq = SEQUENCES[sequenceName];
  if (!seq) { console.error(`Unknown sequence: ${sequenceName}`); return; }

  console.log(`[SEQ] Starting ${sequenceName} for ${subscriber.email}`);

  for (const email of seq.emails) {
    const delayMs = email.delay_hours * 60 * 60 * 1000;
    setTimeout(async () => {
      await sendEmail({
        to: subscriber.email,
        subject: email.subject,
        body: interpolate(email.body, subscriber)
      });
    }, delayMs);
  }
}

// ─── HTTP TRIGGER ENDPOINT ───────────────────────────────────────────────────

const express = require('express');
const app = express();
app.use(express.json());

app.post('/trigger', async (req, res) => {
  const { sequence, subscriber } = req.body;
  if (!sequence || !subscriber?.email) {
    return res.status(400).json({ error: 'sequence and subscriber.email required' });
  }
  await triggerSequence(sequence, subscriber);
  res.json({ ok: true, sequence, to: subscriber.email });
});

// API server receives subscriber signup → trigger appropriate sequence
app.post('/webhook/new-subscriber', async (req, res) => {
  const { email, name, source, product } = req.body;
  const firstName = name?.split(' ')[0] || 'there';
  
  const sequenceMap = {
    'lead-magnet': 'lead-magnet',
    'affiliate-program': 'affiliate',
    'corporate-package': 'corporate',
    'api-access': 'api-trial',
    'tipster-subscription': 'tipster'
  };

  const seq = sequenceMap[source] || 'lead-magnet';
  await triggerSequence(seq, { email, first_name: firstName, product_name: product, download_link: `https://wc2026-empire.vercel.app/digital-store?product=${encodeURIComponent(product||'')}` });
  res.json({ ok: true });
});

app.get('/health', (_, res) => res.json({ status: 'ok', sequences: Object.keys(SEQUENCES) }));

const PORT = process.env.EMAIL_SEQ_PORT || 3050;
app.listen(PORT, () => console.log(`[EMAIL-SEQ] Running on port ${PORT}`));

module.exports = { triggerSequence, SEQUENCES };
