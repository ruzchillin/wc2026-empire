/**
 * squeeze-engine.js
 * ─────────────────────────────────────────────────────────────────────────
 * Every conversion multiplier wired into one injectable script.
 * Drop <script src="/squeeze-engine.js"></script> into any page and ALL
 * squeezes activate automatically.
 *
 * SQUEEZES INCLUDED:
 *  1. Exit intent popup  — email capture before they leave
 *  2. Social proof counter — live user count
 *  3. Scarcity ticker — "Only X spots left"
 *  4. Upsell popup — fires after key actions
 *  5. Referral prompt — fires after signup
 *  6. Co-registration — charge brands £0.50-2.00 per signup
 *  7. Push notification prompt — after 30s engagement
 *  8. Cross-sell — based on current page, suggest next tool
 *  9. Retargeting pixel — Facebook + Google
 * 10. Loss aversion copy — auto-inject on CTA buttons
 * 11. Progress bar — "You're 73% set up"
 * 12. Post-action upsell — after prediction/entry
 * 13. Abandonment SMS trigger — capture mobile before they leave
 * 14. Referral unlock mechanic — share to unlock premium feature
 * 15. FOMO countdown — limited-time offer timer
 * 16. "AI was right" upsell — fire after correct prediction resolved
 * 17. Affiliate redirect with geo-routing
 * 18. WhatsApp one-click subscribe CTA
 * 19. Drama alert bar — breaking news banner
 * 20. Streak reminder — "You're on a 3-day streak, don't break it"
 */

(function() {
  'use strict';

  // ── CONFIG (injected at build time or via window.SQUEEZE_CONFIG) ──────────
  const CFG = window.SQUEEZE_CONFIG || {
    apiBase: '/api',
    fbPixelId: '',          // Set: process.env.FACEBOOK_PIXEL_ID
    gaId: '',               // Set: process.env.GA_MEASUREMENT_ID
    beehiivFormId: '',      // Set: process.env.BEEHIIV_FORM_ID
    whatsappChannel: 'https://whatsapp.com/channel/wc2026intel',
    telegramChannel: 'https://t.me/wc2026intel',
    affiliateDefault: 'https://bet365.com',
    nordvpnUrl: 'https://nordvpn.com/?utm_source=wc2026intel',
    exitDelay: 3000,        // ms before exit intent activates
    upsellDelay: 45000,     // ms before upsell fires
    pushDelay: 30000,       // ms before push prompt
    coregPartners: [        // co-registration partners
      { name: 'WC 2026 Daily', fee: 1.50 },
      { name: 'Football Bets Weekly', fee: 2.00 },
    ],
  };

  // ── UTILITIES ─────────────────────────────────────────────────────────────
  const $ = (s) => document.querySelector(s);
  const storage = {
    get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const onDOMReady = (fn) => document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn);
  const track = (event, data = {}) => {
    fetch(`${CFG.apiBase}/track/event`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ event, data, url: location.href, ts: Date.now() }) }).catch(() => {});
    if (window.fbq) fbq('track', event, data);
    if (window.gtag) gtag('event', event, data);
  };
  const getCountry = () => fetch('/api/affiliate').then(r => r.json()).catch(() => ({ country: 'GB' }));

  // ── 1. SOCIAL PROOF COUNTER ───────────────────────────────────────────────
  function injectSocialProof() {
    const base = Math.floor(Math.random() * 3000) + 9000;
    const count = base + Math.floor(Date.now() / 60000) % 500;
    const el = document.createElement('div');
    el.id = 'sq-social-proof';
    el.style.cssText = 'position:fixed;bottom:20px;left:20px;background:#1a1a2e;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;z-index:9990;box-shadow:0 4px 20px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;animation:slideIn 0.4s ease';
    el.innerHTML = `<span style="color:#00ff88;font-size:16px">●</span> <strong>${count.toLocaleString()}</strong> people using this right now`;
    document.body.appendChild(el);
    // Pulse the number every 30s
    setInterval(() => {
      const live = base + Math.floor(Date.now() / 60000) % 500 + Math.floor(Math.random() * 50) - 25;
      el.querySelector('strong').textContent = live.toLocaleString();
    }, 30000);
  }

  // ── 2. EXIT INTENT POPUP ──────────────────────────────────────────────────
  function initExitIntent() {
    if (storage.get('sq_exit_shown')) return;
    let triggered = false;
    let timeOnPage = 0;
    const timer = setInterval(() => { timeOnPage += 1000; }, 1000);

    document.addEventListener('mouseleave', (e) => {
      if (e.clientY > 20 || triggered || timeOnPage < CFG.exitDelay) return;
      triggered = true;
      clearInterval(timer);
      storage.set('sq_exit_shown', true);
      showModal({
        title: '⚡ Wait — Don\'t Miss This',
        body: `Get free AI predictions for every WC 2026 match.<br><span style="color:#f59e0b;font-size:13px">Join 12,847 fans getting daily picks</span>`,
        input: 'email',
        cta: 'Get Free Predictions',
        onSubmit: (email) => {
          submitEmail(email, 'exit-intent');
          track('ExitIntentCapture');
        },
        footer: '<small style="opacity:0.6">Free forever. No spam. Unsubscribe anytime.</small>',
      });
    });
  }

  // ── 3. SCARCITY TICKER ────────────────────────────────────────────────────
  function injectScarcity() {
    const spots = Math.floor(Math.random() * 30) + 15;
    document.querySelectorAll('[data-scarcity]').forEach(el => {
      el.textContent = `Only ${spots} premium spots remaining`;
    });
    // Also inject near any "Premium" or "Upgrade" buttons
    document.querySelectorAll('button, .cta, [class*="premium"], [class*="upgrade"]').forEach(btn => {
      if (/premium|upgrade|join|start/i.test(btn.textContent)) {
        const ticker = document.createElement('div');
        ticker.style.cssText = 'font-size:11px;color:#ef4444;font-weight:700;text-align:center;margin-top:4px';
        ticker.textContent = `⚡ ${spots} spots left`;
        if (btn.parentNode) btn.parentNode.insertBefore(ticker, btn.nextSibling);
      }
    });
  }

  // ── 4. UPSELL POPUP ───────────────────────────────────────────────────────
  function initUpsell() {
    if (storage.get('sq_upsell_shown')) return;
    setTimeout(() => {
      if (storage.get('sq_email_captured')) {
        // They're already subscribed — show premium upsell
        showModal({
          title: '🔥 Go Premium — WC 2026',
          body: `You're getting free picks. Premium members get:<br>
            <ul style="text-align:left;margin:10px 0;padding-left:20px;font-size:14px">
              <li>AI confidence scores on every match</li>
              <li>Sharp money movement alerts</li>
              <li>Referee tendency reports</li>
              <li>Injury intelligence (30-min advantage)</li>
            </ul>`,
          cta: 'Upgrade for £4.99/month',
          ctaStyle: 'background:linear-gradient(135deg,#f59e0b,#ef4444)',
          onSubmit: () => { window.location.href = '/premium'; track('UpsellClick', { tier: 'premium' }); },
          secondaryCta: 'Maybe later',
          footer: '<small style="opacity:0.6">Cancel anytime. First week free.</small>',
        });
      } else {
        // Not subscribed — email capture upsell
        showModal({
          title: '🏆 Free WC 2026 AI Predictions',
          body: `Our AI correctly predicted <strong>78% of WC 2022 matches</strong>.<br>Get every WC 2026 prediction free — before kickoff.`,
          input: 'email',
          cta: 'Send Me Free Predictions',
          onSubmit: (email) => { submitEmail(email, 'upsell'); track('UpsellEmailCapture'); },
        });
      }
      storage.set('sq_upsell_shown', true);
    }, CFG.upsellDelay);
  }

  // ── 5. REFERRAL PROMPT ────────────────────────────────────────────────────
  function initReferralPrompt() {
    // Fires after signup event
    document.addEventListener('sq:signup', (e) => {
      setTimeout(() => {
        const refCode = `REF-${Math.random().toString(36).substr(2,8).toUpperCase()}`;
        storage.set('sq_ref_code', refCode);
        showModal({
          title: '🎁 Get Premium Free',
          body: `Share with 3 friends and unlock a free premium week.<br>
            <div style="background:#1a1a2e;padding:10px;border-radius:6px;margin:12px 0;font-family:monospace;font-size:16px;letter-spacing:2px">${refCode}</div>`,
          cta: '📲 Share on WhatsApp',
          onSubmit: () => {
            const msg = `I'm using AI predictions for WC 2026 — free picks for every match. Join with my code ${refCode}: https://wc2026intel.com/?ref=${refCode}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            track('ReferralShareWhatsApp');
          },
          secondaryCta: '🐦 Share on Twitter',
          onSecondary: () => {
            const msg = `Getting free AI predictions for every #WC2026 match. Join me: https://wc2026intel.com/?ref=${refCode}`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`, '_blank');
            track('ReferralShareTwitter');
          },
          footer: '<small style="opacity:0.6">3 referrals = 1 free premium week</small>',
        });
      }, 2000);
    });
  }

  // ── 6. CO-REGISTRATION ────────────────────────────────────────────────────
  function coRegisterEmail(email) {
    // When user signs up, silently co-register with partner newsletters
    // Partners pay £0.50-2.00 per co-reg
    CFG.coregPartners.forEach(partner => {
      fetch(`${CFG.apiBase}/coreg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, partner: partner.name, fee: partner.fee, source: location.href }),
      }).catch(() => {});
    });
  }

  // ── 7. PUSH NOTIFICATION PROMPT ───────────────────────────────────────────
  function initPushPrompt() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (storage.get('sq_push_asked')) return;
    setTimeout(() => {
      storage.set('sq_push_asked', true);
      showModal({
        title: '🔔 Instant Goal Alerts',
        body: `Get notified the second a goal is scored — for every WC 2026 match.<br><span style="font-size:13px;opacity:0.7">Works even when this tab is closed</span>`,
        cta: '⚡ Enable Goal Alerts',
        onSubmit: async () => {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            // Register service worker push
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: window.VAPID_PUBLIC_KEY || '' }).catch(() => null);
            if (sub) {
              fetch(`${CFG.apiBase}/push/subscribe`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(sub) }).catch(() => {});
              track('PushSubscribed');
            }
          }
        },
        secondaryCta: 'Maybe later',
      });
    }, CFG.pushDelay);
  }

  // ── 8. CROSS-SELL BAR ─────────────────────────────────────────────────────
  function injectCrossSell() {
    const page = location.pathname.split('/').pop().replace('.html','');
    const crossSells = {
      'prediction-game': { tool: 'arb-scanner', text: '🎯 Also: Find arbitrage bets with our free scanner →' },
      'arb-scanner': { tool: 'odds-comparison', text: '💰 Also: Compare live odds across 30+ bookmakers →' },
      'odds-comparison': { tool: 'prediction-game', text: '🏆 Also: Enter our WC 2026 AI prediction tournament →' },
      'bracket': { tool: 'tournament', text: '💵 Also: Win real money in our Oracle Race (£50 entry) →' },
      'tournament': { tool: 'viral-quiz', text: '🌍 Also: Find out which WC team you are →' },
      'watch-guide': { tool: 'streaming-guide', text: '📺 Also: Full streaming guide for every country →' },
      'injury-tracker': { tool: 'odds-comparison', text: '📊 Also: See how injuries moved the odds →' },
      'referee-db': { tool: 'prediction-game', text: '🧠 Use referee data to sharpen your predictions →' },
      'live-scores': { tool: 'prediction-game', text: '🔮 Also: Predict tonight\'s results and win prizes →' },
    };
    const cs = crossSells[page];
    if (!cs) return;
    const bar = document.createElement('div');
    bar.style.cssText = 'background:#f59e0b;color:#000;padding:10px 20px;text-align:center;font-weight:600;font-size:14px;cursor:pointer;position:sticky;top:0;z-index:9999';
    bar.textContent = cs.text;
    bar.onclick = () => { window.location.href = `/${cs.tool}.html`; track('CrossSellClick', { from: page, to: cs.tool }); };
    document.body.insertBefore(bar, document.body.firstChild);
  }

  // ── 9. RETARGETING PIXELS ─────────────────────────────────────────────────
  function initPixels() {
    // Facebook Pixel
    if (CFG.fbPixelId) {
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', CFG.fbPixelId);
      fbq('track', 'PageView');
    }
    // Google Analytics
    if (CFG.gaId) {
      const s = document.createElement('script');
      s.src = `https://www.googletagmanager.com/gtag/js?id=${CFG.gaId}`;
      s.async = true;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', CFG.gaId);
      window.gtag = gtag;
    }
  }

  // ── 10. LOSS AVERSION CTA REWRITER ───────────────────────────────────────
  function rewriteCTAs() {
    const lossMap = {
      'Subscribe': "Don't miss tonight's AI picks",
      'Sign up': "Don't lose your edge — sign up free",
      'Join': "Join 12,847 fans not missing a pick",
      'Get predictions': "Get predictions before odds change",
      'Enter': "Enter now — spots filling fast",
    };
    document.querySelectorAll('button, .cta, [class*="btn"]').forEach(el => {
      const txt = el.textContent.trim();
      for (const [original, replacement] of Object.entries(lossMap)) {
        if (txt.toLowerCase().includes(original.toLowerCase()) && !el.dataset.sqRewritten) {
          // Don't overwrite — instead add sub-text below button
          const sub = document.createElement('div');
          sub.style.cssText = 'font-size:11px;opacity:0.75;margin-top:3px';
          sub.textContent = replacement;
          el.dataset.sqRewritten = '1';
          if (el.parentNode) el.parentNode.insertBefore(sub, el.nextSibling);
        }
      }
    });
  }

  // ── 11. PROGRESS BAR ─────────────────────────────────────────────────────
  function injectProgressBar() {
    // Only on pages with multi-step flows
    if (!document.querySelector('[data-step]')) return;
    const steps = document.querySelectorAll('[data-step]');
    if (steps.length < 2) return;
    const bar = document.createElement('div');
    bar.style.cssText = 'background:#0f172a;padding:8px 20px;display:flex;align-items:center;gap:12px;font-size:13px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.1)';
    bar.innerHTML = `<div style="flex:1;background:#1e293b;height:6px;border-radius:3px"><div id="sq-progress" style="height:100%;background:linear-gradient(90deg,#f59e0b,#ef4444);border-radius:3px;width:25%;transition:width 0.3s"></div></div><span id="sq-progress-text">Step 1 of ${steps.length}</span>`;
    document.body.insertBefore(bar, document.body.firstChild);
    window.sqUpdateProgress = (step) => {
      document.getElementById('sq-progress').style.width = `${(step/steps.length)*100}%`;
      document.getElementById('sq-progress-text').textContent = `Step ${step} of ${steps.length}`;
    };
  }

  // ── 12. POST-ACTION UPSELL ────────────────────────────────────────────────
  function initPostAction() {
    document.addEventListener('sq:prediction-made', () => {
      setTimeout(() => {
        if (storage.get('sq_post_shown')) return;
        storage.set('sq_post_shown', true);
        showModal({
          title: '🤖 AI Had This at 73% Confidence',
          body: `See the full AI reasoning, confidence scores, and key factors for every match. Premium members also get sharp money alerts 2 hours before kickoff.`,
          cta: 'Unlock Full AI Analysis — £4.99/mo',
          ctaStyle: 'background:linear-gradient(135deg,#6366f1,#8b5cf6)',
          onSubmit: () => { window.location.href = '/premium'; track('PostActionUpsellClick'); },
          secondaryCta: 'No thanks, keep free tier',
          footer: '<small style="opacity:0.6">Join 847 premium members. Cancel anytime.</small>',
        });
      }, 5000);
    });
  }

  // ── 13. ABANDONMENT MOBILE CAPTURE ───────────────────────────────────────
  function initMobileCapture() {
    // On mobile, show WhatsApp CTA before they leave
    if (!/Mobi|Android/i.test(navigator.userAgent)) return;
    if (storage.get('sq_mobile_shown')) return;
    let touchStartY = 0;
    document.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; });
    document.addEventListener('touchend', e => {
      const delta = e.changedTouches[0].clientY - touchStartY;
      if (delta > 100 && window.scrollY < 100) { // Swipe down near top = back gesture
        if (storage.get('sq_mobile_shown')) return;
        storage.set('sq_mobile_shown', true);
        showModal({
          title: '📲 Get Picks on WhatsApp',
          body: `AI predictions direct to your WhatsApp — free for every WC 2026 match. 47,000+ fans already subscribed.`,
          cta: 'Join WhatsApp Channel →',
          onSubmit: () => { window.open(CFG.whatsappChannel, '_blank'); track('WhatsAppCTAMobile'); },
        });
      }
    });
  }

  // ── 14. SHARE-TO-UNLOCK ───────────────────────────────────────────────────
  window.sqShareToUnlock = function(feature) {
    showModal({
      title: `🔓 Unlock: ${feature}`,
      body: `Share this tool with a friend to unlock this feature free — forever.`,
      cta: '📲 Share on WhatsApp',
      onSubmit: () => {
        const msg = `I'm using this free WC 2026 AI tool: ${location.href}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        setTimeout(() => { document.dispatchEvent(new CustomEvent('sq:unlocked', { detail: { feature } })); }, 1500);
        track('ShareToUnlock', { feature });
      },
      secondaryCta: '🐦 Share on Twitter',
      onSecondary: () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Free WC 2026 AI predictions: ${location.href} #WC2026`)}`, '_blank');
        setTimeout(() => { document.dispatchEvent(new CustomEvent('sq:unlocked', { detail: { feature } })); }, 1500);
        track('ShareToUnlockTwitter', { feature });
      },
    });
  };

  // ── 15. FOMO COUNTDOWN ───────────────────────────────────────────────────
  function initCountdowns() {
    document.querySelectorAll('[data-countdown]').forEach(el => {
      const end = new Date(el.dataset.countdown);
      const tick = () => {
        const diff = end - Date.now();
        if (diff <= 0) { el.textContent = 'EXPIRED'; return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${h}h ${m}m ${s}s`;
      };
      tick();
      setInterval(tick, 1000);
    });
    // Auto-inject next-match countdown if none exists
    if (!$('[data-countdown]')) {
      // Find next match from schedule (simplified)
      const nextMatch = new Date();
      nextMatch.setHours(nextMatch.getHours() + Math.floor(Math.random() * 6) + 1);
      document.querySelectorAll('.match-time, [class*="kickoff"], [class*="match"]').forEach(el => {
        if (!el.dataset.countdown) {
          el.dataset.countdown = nextMatch.toISOString();
          initCountdowns();
        }
      });
    }
  }

  // ── 16. DRAMA ALERT BAR ───────────────────────────────────────────────────
  function initDramaBar() {
    fetch(`${CFG.apiBase}/drama-alert`).then(r => r.json()).then(data => {
      if (!data.active) return;
      const bar = document.createElement('div');
      bar.id = 'sq-drama-bar';
      bar.style.cssText = 'background:linear-gradient(90deg,#ef4444,#f59e0b);color:#fff;padding:10px 20px;text-align:center;font-weight:700;font-size:14px;position:sticky;top:0;z-index:10000;animation:pulse 2s infinite';
      bar.innerHTML = `🚨 BREAKING: ${data.headline} <a href="${data.url}" style="color:#fff;margin-left:8px;text-decoration:underline">Read more →</a> <span style="float:right;cursor:pointer" onclick="this.parentNode.remove()">✕</span>`;
      document.body.insertBefore(bar, document.body.firstChild);
    }).catch(() => {});
  }

  // ── 17. GEO AFFILIATE INJECTOR ────────────────────────────────────────────
  async function injectGeoAffiliate() {
    try {
      const { affiliate, country } = await getCountry();
      // Replace all generic affiliate links with geo-correct ones
      document.querySelectorAll('[data-affiliate]').forEach(el => {
        const type = el.dataset.affiliate;
        if (type === 'sportsbook' && affiliate?.url) {
          el.href = affiliate.url;
          if (affiliate.name) el.dataset.affiliateName = affiliate.name;
        }
        if (type === 'vpn') {
          el.href = CFG.nordvpnUrl;
        }
      });
      window.SQ_COUNTRY = country;
      window.SQ_AFFILIATE = affiliate;
    } catch(e) {}
  }

  // ── 18. WHATSAPP ONE-CLICK CTA ────────────────────────────────────────────
  function injectWhatsAppCTA() {
    if (storage.get('sq_wa_joined')) return;
    const fab = document.createElement('div');
    fab.id = 'sq-wa-fab';
    fab.style.cssText = 'position:fixed;bottom:80px;right:20px;background:#25D366;color:#fff;padding:12px 16px;border-radius:50px;font-size:13px;font-weight:700;cursor:pointer;z-index:9991;box-shadow:0 4px 20px rgba(37,211,102,0.4);display:flex;align-items:center;gap:8px';
    fab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg> WC 2026 Picks`;
    fab.onclick = () => {
      window.open(CFG.whatsappChannel, '_blank');
      storage.set('sq_wa_joined', true);
      fab.remove();
      track('WhatsAppFABClick');
    };
    document.body.appendChild(fab);
  }

  // ── 19. STREAK REMINDER ───────────────────────────────────────────────────
  function checkStreak() {
    const streak = storage.get('sq_streak') || { count: 0, lastDate: null };
    const today = new Date().toDateString();
    if (streak.lastDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (streak.lastDate === yesterday.toDateString()) {
        streak.count++;
      } else if (streak.lastDate !== today) {
        streak.count = 1;
      }
      streak.lastDate = today;
      storage.set('sq_streak', streak);
    }
    if (streak.count >= 2) {
      const bar = document.createElement('div');
      bar.style.cssText = 'background:#1e1b4b;color:#a5b4fc;padding:8px 20px;text-align:center;font-size:13px;font-weight:600';
      bar.textContent = `🔥 ${streak.count}-day prediction streak! Keep it going — tomorrow's picks drop at 7am`;
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  // ── 20. AI WAS RIGHT UPSELL (post-match) ─────────────────────────────────
  window.sqFireAIWasRight = function(prediction, actual, confidence) {
    if (prediction === actual && confidence > 65) {
      setTimeout(() => {
        showModal({
          title: `✅ AI Called It (${confidence}% confidence)`,
          body: `The AI predicted this result with ${confidence}% confidence — and was right.<br><br>Premium members got this pick <strong>2 hours before kickoff</strong> with the full reasoning.`,
          cta: 'Upgrade to Premium — £4.99/mo',
          onSubmit: () => { window.location.href = '/premium'; track('AIWasRightUpsell'); },
          secondaryCta: 'Stay on free tier',
        });
      }, 3000);
    }
  };

  // ── MODAL FACTORY ─────────────────────────────────────────────────────────
  function showModal({ title, body, input, cta, ctaStyle = '', onSubmit, secondaryCta, onSecondary, footer }) {
    const existing = document.getElementById('sq-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sq-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease';

    overlay.innerHTML = `
      <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;max-width:440px;width:100%;position:relative;color:#fff">
        <button onclick="document.getElementById('sq-modal-overlay').remove()" style="position:absolute;top:12px;right:12px;background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer">✕</button>
        <h3 style="font-size:22px;font-weight:700;margin:0 0 12px">${title}</h3>
        <p style="color:#94a3b8;line-height:1.6;margin:0 0 20px">${body}</p>
        ${input === 'email' ? `<input id="sq-modal-input" type="email" placeholder="your@email.com" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:#1e293b;color:#fff;font-size:15px;margin-bottom:12px;box-sizing:border-box">` : ''}
        <button id="sq-modal-cta" style="width:100%;padding:14px;border-radius:8px;border:none;font-weight:700;font-size:15px;cursor:pointer;${ctaStyle || 'background:linear-gradient(135deg,#f59e0b,#ef4444);color:#000'}">${cta}</button>
        ${secondaryCta ? `<button id="sq-modal-secondary" style="width:100%;padding:10px;background:none;border:none;color:#64748b;font-size:13px;cursor:pointer;margin-top:8px">${secondaryCta}</button>` : ''}
        ${footer ? `<div style="margin-top:12px;text-align:center;color:#64748b">${footer}</div>` : ''}
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('sq-modal-cta').onclick = () => {
      const val = input ? document.getElementById('sq-modal-input')?.value : null;
      if (input && !val?.includes('@')) return;
      overlay.remove();
      onSubmit(val);
    };

    if (secondaryCta) {
      document.getElementById('sq-modal-secondary').onclick = () => {
        overlay.remove();
        if (onSecondary) onSecondary();
      };
    }
  }

  // ── EMAIL SUBMIT HELPER ───────────────────────────────────────────────────
  function submitEmail(email, source) {
    storage.set('sq_email_captured', true);
    fetch(`${CFG.apiBase}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source, country: window.SQ_COUNTRY }),
    }).catch(() => {});
    coRegisterEmail(email);
    document.dispatchEvent(new CustomEvent('sq:signup', { detail: { email, source } }));
    track('EmailCapture', { source });
  }
  window.sqSubmitEmail = submitEmail;

  // ── CSS ANIMATIONS ────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.85; } }
  `;
  document.head.appendChild(style);

  // ── INIT ALL SQUEEZES ─────────────────────────────────────────────────────
  onDOMReady(() => {
    initPixels();
    injectGeoAffiliate();
    injectSocialProof();
    injectScarcity();
    initExitIntent();
    initUpsell();
    initReferralPrompt();
    initPushPrompt();
    injectCrossSell();
    rewriteCTAs();
    injectProgressBar();
    initPostAction();
    initMobileCapture();
    initCountdowns();
    initDramaBar();
    injectWhatsAppCTA();
    checkStreak();
  });

  // ── EXPOSE PUBLIC API ─────────────────────────────────────────────────────
  window.SQ = {
    submitEmail,
    showModal,
    fireAIWasRight: window.sqFireAIWasRight,
    shareToUnlock: window.sqShareToUnlock,
    updateProgress: window.sqUpdateProgress,
    track,
  };

})();
