/**
 * email-funnel.js
 *
 * Email capture + lead funnel system for all WC 2026 tools.
 * Every Vercel tool (odds-tool, prediction-game, arb-scanner, streaming-guide, second-screen-app)
 * captures emails into Beehiiv and triggers an automated welcome sequence.
 *
 * Revenue model:
 * - Beehiiv newsletter: $3-5 CPM ad revenue (free tier, auto-served ads)
 * - Upgrade to Beehiiv paid: higher CPM + paid boosts
 * - Email list = owned asset (no algorithm, no deplatforming)
 * - 10K subscribers = $3K-8K/mo in ad revenue alone
 * - Plus: promote affiliate links, premium subscription, arb scanner
 *
 * Usage:
 *   const funnel = require('./email-funnel');
 *   await funnel.subscribe(email, source, language);
 *   await funnel.triggerWelcomeSequence(email, language);
 */

const https = require('https');

// ── CONFIG ───────────────────────────────────────────────────────
const CONFIG = {
  beehiiv: {
    apiKey: process.env.BEEHIIV_API_KEY,          // From app.beehiiv.com → Settings → API
    publicationId: process.env.BEEHIIV_PUB_ID,    // pub_xxxxxxxxx
    formId: process.env.BEEHIIV_FORM_ID,          // For iframe embeds
  },
  telegram: process.env.TELEGRAM_BOT_TOKEN,
  ownerChatId: process.env.OWNER_TELEGRAM_ID,
  welcome: {
    en: {
      subject: '⚽ You\'re in — WC 2026 AI Picks starts June 11',
      preview: 'Here\'s your first free prediction...',
    },
    es: {
      subject: '⚽ Bienvenido — Predicciones IA Copa del Mundo 2026',
      preview: 'Tu primera predicción gratis...',
    },
    pt: {
      subject: '⚽ Bem-vindo — Palpites IA Copa do Mundo 2026',
      preview: 'Sua primeira previsão grátis...',
    },
    fr: {
      subject: '⚽ Bienvenue — Pronostics IA Coupe du Monde 2026',
      preview: 'Votre premier pronostic gratuit...',
    },
    ar: {
      subject: '⚽ مرحباً — توقعات الذكاء الاصطناعي لكأس العالم 2026',
      preview: 'توقعك الأول مجاناً...',
    },
    sw: {
      subject: '⚽ Karibu — Utabiri wa AI Kombe la Dunia 2026',
      preview: 'Utabiri wako wa kwanza bure...',
    },
    hi: {
      subject: '⚽ स्वागत है — FIFA विश्व कप 2026 AI भविष्यवाणियां',
      preview: 'आपकी पहली मुफ्त भविष्यवाणी...',
    },
  }
};

// ── BEEHIIV SUBSCRIBER MANAGEMENT ────────────────────────────────

/**
 * Subscribe an email to Beehiiv
 * Source: which tool captured this lead ('odds_tool', 'prediction_game', 'arb_scanner', etc.)
 */
async function subscribe(email, source = 'unknown', language = 'en', metadata = {}) {
  if (!CONFIG.beehiiv.apiKey || !CONFIG.beehiiv.publicationId) {
    console.warn('Beehiiv not configured. Set BEEHIIV_API_KEY and BEEHIIV_PUB_ID in .env');
    return { success: false, reason: 'not_configured' };
  }

  const body = JSON.stringify({
    email,
    reactivate_existing: false,
    send_welcome_email: false, // We send custom welcome via Telegram/email
    utm_source: source,
    utm_medium: 'web',
    utm_campaign: 'wc2026',
    custom_fields: [
      { name: 'language', value: language },
      { name: 'source_tool', value: source },
      { name: 'signup_date', value: new Date().toISOString() },
      ...Object.entries(metadata).map(([name, value]) => ({ name, value: String(value) }))
    ]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.beehiiv.com',
      path: `/v2/publications/${CONFIG.beehiiv.publicationId}/subscriptions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.beehiiv.apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✅ Subscribed: ${email} (source: ${source}, lang: ${language})`);
          notifyOwner(`📧 New subscriber!\n${email}\nSource: ${source} | Lang: ${language}`);
          resolve({ success: true, data: parsed });
        } else {
          console.error(`Beehiiv error: ${res.statusCode}`, parsed);
          resolve({ success: false, status: res.statusCode, data: parsed });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

/**
 * Get subscriber count (for social proof on tool pages)
 */
async function getSubscriberCount() {
  if (!CONFIG.beehiiv.apiKey || !CONFIG.beehiiv.publicationId) return null;

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.beehiiv.com',
      path: `/v2/publications/${CONFIG.beehiiv.publicationId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${CONFIG.beehiiv.apiKey}` }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        resolve(parsed.data?.stats?.total_active_subscriptions || null);
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

// ── LEAD MAGNETS (what you offer in exchange for email) ───────────
const LEAD_MAGNETS = {
  odds_tool: {
    en: { headline: 'Get the AI pick before every match', cta: 'Send me free picks →', value: 'Free AI prediction for every WC 2026 match, delivered 2h before kickoff.' },
    es: { headline: 'Recibe el pronóstico IA antes de cada partido', cta: 'Envíame pronósticos gratis →', value: 'Predicción IA gratis para cada partido del Mundial 2026, 2 horas antes del pitido inicial.' },
    pt: { headline: 'Receba o palpite da IA antes de cada jogo', cta: 'Me enviar palpites grátis →', value: 'Palpite IA grátis para cada jogo da Copa 2026, entregue 2h antes do apito inicial.' },
  },
  arb_scanner: {
    en: { headline: 'Free arb alert tomorrow', cta: 'Get my free arb alert →', value: 'We\'ll email you 1 free arbitrage opportunity tomorrow. No credit card needed.' },
  },
  prediction_game: {
    en: { headline: 'See the AI\'s predictions before submitting yours', cta: 'Get AI predictions →', value: 'Free: our AI pick + confidence level for every match, to your inbox before kickoff.' },
  },
  streaming_guide: {
    en: { headline: 'Never miss a goal — get instant alerts', cta: 'Send me goal alerts →', value: 'Real-time goal alerts + match reminders so you never miss a kick of WC 2026.' },
  },
  second_screen: {
    en: { headline: 'Get match insights straight to your inbox', cta: 'Get match day emails →', value: 'Pre-match AI analysis + halftime insights + full-time reaction for every game.' },
  }
};

/**
 * Generate the email capture HTML snippet to embed in any Vercel tool
 * Usage: insert this HTML into any tool page
 */
function generateEmailCaptureHTML(source = 'tool', language = 'en', toolName = 'wc2026') {
  const magnet = LEAD_MAGNETS[source]?.[language] || LEAD_MAGNETS[source]?.en || LEAD_MAGNETS.odds_tool.en;

  return `
<!-- ── EMAIL CAPTURE WIDGET (paste anywhere) ── -->
<div style="background:#111827;border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:20px;margin:20px 0;text-align:center;" id="email-capture-${source}">
  <div style="font-size:18px;font-weight:800;margin-bottom:6px;color:#f1f5f9;">${magnet.headline}</div>
  <p style="font-size:13px;color:#94a3b8;margin-bottom:14px;">${magnet.value}</p>
  <div style="display:flex;gap:8px;max-width:400px;margin:0 auto;">
    <input type="email" id="cap-email-${source}" placeholder="your@email.com"
      style="flex:1;padding:10px 14px;background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:14px;outline:none;">
    <button onclick="captureEmail('${source}', '${language}')"
      style="padding:10px 18px;background:#6366f1;color:white;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap;">
      ${magnet.cta}
    </button>
  </div>
  <p style="font-size:11px;color:#475569;margin-top:8px;">No spam. Unsubscribe any time. 2 emails/week max.</p>
  <div id="cap-success-${source}" style="display:none;color:#10b981;font-weight:700;margin-top:10px;">✅ You're in! Check your email for your first prediction.</div>
</div>

<script>
async function captureEmail(source, lang) {
  const email = document.getElementById('cap-email-' + source).value.trim();
  if (!email || !email.includes('@')) { alert('Please enter a valid email address'); return; }

  // POST to your Railway/Vercel API endpoint
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source, language: lang })
    });
    if (res.ok) {
      document.getElementById('cap-email-' + source).style.display = 'none';
      document.querySelector('#email-capture-' + source + ' button').style.display = 'none';
      document.getElementById('cap-success-' + source).style.display = 'block';
      // Track in localStorage to stop showing capture widget
      localStorage.setItem('wc2026_subscribed', '1');
    }
  } catch (e) {
    // Fallback: redirect to Beehiiv form if API fails
    window.open('https://your-publication.beehiiv.com/subscribe?email=' + encodeURIComponent(email), '_blank');
  }
}
// Hide widget if already subscribed
if (localStorage.getItem('wc2026_subscribed')) {
  const el = document.getElementById('email-capture-${source}');
  if (el) el.style.display = 'none';
}
</script>
<!-- ── END EMAIL CAPTURE ── -->`;
}

/**
 * API endpoint handler for Railway/Express
 * Add to your Express app: app.post('/api/subscribe', handleSubscribeEndpoint)
 */
async function handleSubscribeEndpoint(req, res) {
  const { email, source, language } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const result = await subscribe(email, source || 'api', language || 'en');

  if (result.success) {
    // Send welcome message via Telegram bot if user has Telegram (optional)
    // await sendWelcomeTelegram(email, language);
    res.json({ success: true, message: 'Subscribed!' });
  } else if (result.data?.errors?.[0]?.message?.includes('already exists')) {
    res.json({ success: true, message: 'Already subscribed!' });
  } else {
    res.status(500).json({ error: 'Subscription failed', detail: result });
  }
}

// ── REFERRAL SYSTEM ─────────────────────────────────────────────

/**
 * Generate referral link for a subscriber
 * Beehiiv has built-in referral program — this creates the tracking URL
 */
function generateReferralLink(subscriberEmail, publicationDomain) {
  const encoded = Buffer.from(subscriberEmail).toString('base64');
  return `https://${publicationDomain}/subscribe?ref=${encoded}`;
}

/**
 * Generate referral CTA email HTML block
 * Insert into every newsletter email to grow list exponentially
 */
function generateReferralCTA(publicationDomain = 'wc2026picks.beehiiv.com') {
  return `
<!-- Referral section — add to every newsletter -->
<div style="background:#1e293b;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
  <h3 style="color:#f1f5f9;font-size:16px;font-weight:800;margin-bottom:8px;">Share & earn rewards</h3>
  <p style="color:#94a3b8;font-size:13px;margin-bottom:12px;">
    Refer friends and unlock premium picks:
  </p>
  <p style="color:#f1f5f9;font-size:13px;margin-bottom:8px;">
    🎁 <strong>3 referrals</strong> → Free premium month ($9.99 value)<br>
    🏆 <strong>10 referrals</strong> → Free arb scanner access ($99 value)<br>
    💰 <strong>25 referrals</strong> → Cash prize (paid via PayPal)
  </p>
  <a href="https://${publicationDomain}/subscribe?ref={{subscriber.referral_code}}"
     style="display:inline-block;background:#6366f1;color:white;padding:10px 24px;border-radius:8px;font-weight:700;text-decoration:none;font-size:14px;">
    Share your referral link →
  </a>
  <p style="font-size:11px;color:#475569;margin-top:8px;">Your referral link: https://${publicationDomain}/subscribe?ref={{subscriber.referral_code}}</p>
</div>`;
}

// ── OWNER NOTIFICATION ────────────────────────────────────────────
function notifyOwner(message) {
  if (!CONFIG.telegram || !CONFIG.ownerChatId) return;

  const body = JSON.stringify({
    chat_id: CONFIG.ownerChatId,
    text: message,
    parse_mode: 'HTML'
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${CONFIG.telegram}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };

  const req = https.request(options);
  req.write(body);
  req.end();
}

// ── DAILY SUBSCRIBER REPORT ──────────────────────────────────────
async function sendDailyReport() {
  const count = await getSubscriberCount();
  if (!count) return;

  const estimatedRevenue = (count / 1000) * 4.0; // $4 CPM estimate
  await notifyOwner(
    `📊 <b>Daily Email Report</b>\n\n` +
    `Total subscribers: <b>${count.toLocaleString()}</b>\n` +
    `Est. monthly ad revenue: <b>$${Math.round(estimatedRevenue * 30).toLocaleString()}</b>\n\n` +
    `Keep promoting the tools! Every signup = $0.10-0.50/mo recurring.`
  );
}

// ── EXPORTS ──────────────────────────────────────────────────────
module.exports = {
  subscribe,
  getSubscriberCount,
  generateEmailCaptureHTML,
  handleSubscribeEndpoint,
  generateReferralLink,
  generateReferralCTA,
  sendDailyReport,
  LEAD_MAGNETS,
  CONFIG
};

// ── CLI USAGE ────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === 'snippet') {
    // Generate HTML snippets for all tools
    const tools = ['odds_tool', 'arb_scanner', 'prediction_game', 'streaming_guide', 'second_screen'];
    tools.forEach(tool => {
      const filename = `./email-capture-${tool}.html`;
      fs.writeFileSync(filename, generateEmailCaptureHTML(tool, 'en'));
      console.log(`✅ Written: ${filename}`);
    });
    console.log('\nPaste these snippets into your Vercel tool HTML files.');
  } else if (args[0] === 'report') {
    sendDailyReport().then(() => console.log('Report sent to Telegram'));
  } else {
    console.log('Usage:');
    console.log('  node email-funnel.js snippet  — generate HTML snippets for each tool');
    console.log('  node email-funnel.js report   — send daily subscriber report to Telegram');
  }
}

const fs = require('fs');
