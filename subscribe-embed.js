/**
 * WC 2026 Sports Empire — Subscribe Embed Widget
 * Drop on ANY page with one script tag:
 *   <script src="/subscribe-embed.js" defer></script>
 *
 * What it adds to every page:
 *   1. A floating "🔔 Get Live Alerts" button (bottom-right)
 *   2. On click: slide-up panel with Email + Browser Push subscribe options
 *   3. Optional exit-intent popup (shows once per session if user starts to leave)
 *   4. After subscribe: confirmation + guides user to WhatsApp/Telegram
 *
 * Email endpoint: POST /api/subscribe  { email, source }
 * Push: uses Web Push API with your VAPID key (set window.WC2026_VAPID_KEY)
 *
 * Config (set before script tag, or via window globals):
 *   window.WC2026_VAPID_KEY = '...';       // from web-push.generateVAPIDKeys()
 *   window.WC2026_SUBSCRIBE_URL = '/api/subscribe'; // default
 *   window.WC2026_DISABLE_EXIT_INTENT = false;       // set true to disable popup
 *
 * Tracks conversions via /api/subscriber-click?src=embed&page=...
 */

(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────
  const VAPID_KEY       = window.WC2026_VAPID_KEY       || '';
  const SUBSCRIBE_URL   = window.WC2026_SUBSCRIBE_URL   || '/api/subscribe';
  const DISABLE_EXIT    = window.WC2026_DISABLE_EXIT_INTENT || false;
  const PAGE_SRC        = encodeURIComponent(location.pathname.replace(/\.html$/, ''));

  // Don't show on certain pages
  const EXCLUDED_PAGES = ['/subscribe', '/unsubscribe', '/privacy-policy'];
  if (EXCLUDED_PAGES.some(p => location.pathname.includes(p))) return;

  // ─── State ─────────────────────────────────────────────────────────────────
  const STORAGE_KEY      = 'wc2026_subscribed';
  const EXIT_SHOWN_KEY   = 'wc2026_exit_shown';
  let panelOpen          = false;
  let exitPopupShown     = false;

  function isSubscribed() {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
  }
  function markSubscribed(method) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ method, ts: Date.now() })); } catch {}
  }

  // ─── Styles ────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #wc-sub-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 9998;
      display: flex; align-items: center; gap: 10px;
      background: #76ff03; color: #0a0a0a;
      padding: 12px 20px; border-radius: 32px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 14px; font-weight: 700;
      cursor: pointer; border: none;
      box-shadow: 0 4px 24px rgba(118,255,3,.4);
      transition: all .2s; white-space: nowrap;
    }
    #wc-sub-fab:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(118,255,3,.5); }
    #wc-sub-fab.hidden { opacity:0; pointer-events:none; transform:translateY(10px); }

    #wc-sub-panel {
      position: fixed; bottom: 80px; right: 24px; z-index: 9997;
      width: 320px; background: #111; border: 1px solid #2a2a2a;
      border-radius: 20px; padding: 24px;
      font-family: 'Segoe UI', Arial, sans-serif;
      box-shadow: 0 8px 48px rgba(0,0,0,.6);
      transform: translateY(20px); opacity: 0;
      pointer-events: none;
      transition: all .25s cubic-bezier(.34,1.56,.64,1);
    }
    #wc-sub-panel.open {
      transform: translateY(0); opacity: 1; pointer-events: all;
    }
    #wc-sub-panel .wc-close {
      position: absolute; top: 12px; right: 14px;
      background: transparent; border: none; color: #555;
      font-size: 20px; cursor: pointer; line-height: 1;
    }
    #wc-sub-panel .wc-close:hover { color: #fff; }
    #wc-sub-panel .wc-icon { font-size: 32px; margin-bottom: 6px; }
    #wc-sub-panel h3 { color: #fff; font-size: 17px; margin-bottom: 6px; }
    #wc-sub-panel p  { color: #888; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
    .wc-input {
      width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a;
      border-radius: 10px; padding: 11px 14px; color: #fff; font-size: 14px;
      margin-bottom: 10px; font-family: inherit;
    }
    .wc-input:focus { outline: none; border-color: #76ff03; }
    .wc-input::placeholder { color: #444; }
    .wc-btn {
      width: 100%; padding: 12px; border-radius: 10px; font-size: 14px;
      font-weight: 700; cursor: pointer; border: none; font-family: inherit;
      transition: opacity .15s; margin-bottom: 8px;
    }
    .wc-btn:hover { opacity: .88; }
    .wc-btn-primary { background: #76ff03; color: #0a0a0a; }
    .wc-btn-secondary {
      background: transparent; color: #ccc;
      border: 1px solid #2a2a2a;
    }
    .wc-divider {
      display: flex; align-items: center; gap: 10px;
      color: #333; font-size: 12px; margin: 12px 0;
    }
    .wc-divider::before, .wc-divider::after {
      content:''; flex:1; height:1px; background:#222;
    }
    .wc-push-icon { font-size: 18px; margin-right: 6px; }
    .wc-channels { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .wc-channel-btn {
      flex: 1; min-width: 80px; padding: 8px 4px; border-radius: 10px;
      border: 1px solid #2a2a2a; background: #0d0d0d;
      color: #ccc; font-size: 12px; text-align: center;
      cursor: pointer; text-decoration: none; transition: all .15s;
      font-family: inherit;
    }
    .wc-channel-btn:hover { border-color: #76ff03; color: #76ff03; background: rgba(118,255,3,.06); }
    .wc-channel-btn .icon { font-size: 18px; display: block; margin-bottom: 2px; }
    .wc-success { text-align: center; }
    .wc-success .big { font-size: 40px; margin-bottom: 8px; }
    .wc-success h4 { color: #fff; margin-bottom: 6px; }
    .wc-success p  { color: #888; font-size: 13px; }
    .wc-error-msg { color: #ff5555; font-size: 12px; margin-bottom: 8px; display: none; }

    /* Exit intent overlay */
    #wc-exit-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,.7); display: none;
      align-items: center; justify-content: center;
    }
    #wc-exit-overlay.open { display: flex; }
    .wc-exit-box {
      background: #111; border: 1px solid #2a2a2a; border-radius: 20px;
      padding: 32px; max-width: 400px; width: 90%; text-align: center;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .wc-exit-box .big { font-size: 48px; margin-bottom: 12px; }
    .wc-exit-box h3 { color: #fff; font-size: 20px; margin-bottom: 8px; }
    .wc-exit-box p  { color: #888; font-size: 14px; margin-bottom: 20px; line-height: 1.5; }

    @media (max-width: 400px) {
      #wc-sub-panel { width: calc(100vw - 32px); right: 16px; }
      #wc-sub-fab   { right: 16px; bottom: 16px; font-size: 13px; padding: 10px 16px; }
    }
  `;
  document.head.appendChild(style);

  // ─── FAB button ────────────────────────────────────────────────────────────
  const fab = document.createElement('button');
  fab.id        = 'wc-sub-fab';
  fab.innerHTML = '🔔 Get Live Alerts';
  if (isSubscribed()) fab.innerHTML = '✅ Subscribed';
  fab.addEventListener('click', togglePanel);
  document.body.appendChild(fab);

  // ─── Slide-up panel ────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id    = 'wc-sub-panel';
  panel.innerHTML = `
    <button class="wc-close" id="wc-close-panel">×</button>
    <div id="wc-panel-content">
      ${isSubscribed() ? renderSuccessPanel() : renderSubscribePanel()}
    </div>`;
  document.body.appendChild(panel);

  document.getElementById('wc-close-panel').addEventListener('click', closePanel);

  function renderSubscribePanel() {
    return `
      <div class="wc-icon">⚽</div>
      <h3>Never miss a WC 2026 goal</h3>
      <p>Get instant alerts for goals, results and upsets — free, directly to you.</p>
      <p class="wc-error-msg" id="wc-error-msg">❌ Something went wrong. Try again.</p>
      <input class="wc-input" type="email" id="wc-email-input" placeholder="Your email address">
      <button class="wc-btn wc-btn-primary" id="wc-email-submit">📧 Email me goal alerts</button>
      ${VAPID_KEY || 'serviceWorker' in navigator ? `
        <div class="wc-divider">or</div>
        <button class="wc-btn wc-btn-secondary" id="wc-push-btn">
          <span class="wc-push-icon">🔔</span> Browser push notifications
        </button>` : ''}
      <div class="wc-divider">also available on</div>
      <div class="wc-channels">
        <a class="wc-channel-btn" href="https://t.me/wc2026live" target="_blank" rel="noopener">
          <span class="icon">✈️</span>Telegram
        </a>
        <a class="wc-channel-btn" href="https://wa.me/447700000000?text=WC2026" target="_blank" rel="noopener">
          <span class="icon">💬</span>WhatsApp
        </a>
        <a class="wc-channel-btn" href="/prediction-game.html">
          <span class="icon">🏆</span>Predict
        </a>
      </div>`;
  }

  function renderSuccessPanel() {
    return `
      <div class="wc-success">
        <div class="big">✅</div>
        <h4>You're in!</h4>
        <p>Goal alerts, match results and WC 2026 news — coming your way.</p>
        <div class="wc-channels" style="margin-top:16px">
          <a class="wc-channel-btn" href="https://t.me/wc2026live" target="_blank" rel="noopener">
            <span class="icon">✈️</span>Telegram
          </a>
          <a class="wc-channel-btn" href="/leaderboard.html">
            <span class="icon">🏆</span>Predict
          </a>
        </div>
      </div>`;
  }

  // Wire up email submit
  function wirePanel() {
    const emailBtn = document.getElementById('wc-email-submit');
    const pushBtn  = document.getElementById('wc-push-btn');

    if (emailBtn) {
      emailBtn.addEventListener('click', async () => {
        const email = document.getElementById('wc-email-input').value.trim();
        if (!email || !email.includes('@')) {
          showError('Please enter a valid email address');
          return;
        }
        emailBtn.textContent = 'Subscribing...';
        emailBtn.disabled    = true;
        const ok = await subscribeEmail(email);
        if (ok) {
          markSubscribed('email');
          document.getElementById('wc-panel-content').innerHTML = renderSuccessPanel();
          fab.innerHTML = '✅ Subscribed';
        } else {
          emailBtn.textContent = '📧 Email me goal alerts';
          emailBtn.disabled    = false;
          showError('Something went wrong — try again.');
        }
      });
    }

    if (pushBtn) {
      pushBtn.addEventListener('click', async () => {
        pushBtn.textContent = 'Enabling...';
        pushBtn.disabled    = true;
        const ok = await subscribePush();
        if (ok) {
          markSubscribed('push');
          document.getElementById('wc-panel-content').innerHTML = renderSuccessPanel();
          fab.innerHTML = '✅ Subscribed';
        } else {
          pushBtn.innerHTML = '<span class="wc-push-icon">🔔</span> Browser push notifications';
          pushBtn.disabled  = false;
        }
      });
    }
  }

  wirePanel();

  function showError(msg) {
    const el = document.getElementById('wc-error-msg');
    if (el) { el.textContent = '❌ ' + msg; el.style.display = 'block'; }
  }

  // ─── Email subscribe ────────────────────────────────────────────────────────
  async function subscribeEmail(email) {
    try {
      const res = await fetch(SUBSCRIBE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, source: `embed:${PAGE_SRC}`, timestamp: Date.now() })
      });
      return res.ok;
    } catch {
      // Even if API is down, record locally
      try {
        const pending = JSON.parse(localStorage.getItem('wc2026_pending_subs') || '[]');
        pending.push({ email, source: PAGE_SRC, ts: Date.now() });
        localStorage.setItem('wc2026_pending_subs', JSON.stringify(pending));
      } catch {}
      return true; // optimistic — show success anyway
    }
  }

  // ─── Browser Push subscribe ─────────────────────────────────────────────────
  async function subscribePush() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: VAPID_KEY ? urlBase64ToUint8Array(VAPID_KEY) : undefined
      });

      // Send subscription to backend
      await fetch('/api/push-subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: sub, source: PAGE_SRC })
      }).catch(() => {});

      return true;
    } catch (e) {
      console.warn('[WC2026 Push]', e.message);
      return false;
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
  }

  // ─── Panel toggle ───────────────────────────────────────────────────────────
  function togglePanel() {
    if (panelOpen) closePanel();
    else openPanel();
  }

  function openPanel() {
    panelOpen = true;
    panel.classList.add('open');
    // Track open
    fetch(`/api/subscriber-click?src=embed&page=${PAGE_SRC}`).catch(() => {});
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove('open');
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (panelOpen && !panel.contains(e.target) && e.target !== fab) closePanel();
  });

  // ─── Exit-intent popup ──────────────────────────────────────────────────────
  if (!DISABLE_EXIT && !isSubscribed()) {
    let exitTriggered = false;

    try { exitTriggered = !!sessionStorage.getItem(EXIT_SHOWN_KEY); } catch {}

    if (!exitTriggered) {
      // Desktop: detect mouse leaving viewport at top
      document.addEventListener('mouseleave', (e) => {
        if (e.clientY <= 0 && !exitPopupShown && !isSubscribed()) {
          showExitIntent();
        }
      });

      // Mobile: detect rapid scroll UP (user going to close tab)
      let lastScrollY   = window.scrollY;
      let scrollHistory = [];
      window.addEventListener('scroll', () => {
        const current = window.scrollY;
        scrollHistory.push(current - lastScrollY);
        if (scrollHistory.length > 5) scrollHistory.shift();
        lastScrollY = current;

        // If user scrolled up fast from deep in page
        const avgScroll = scrollHistory.reduce((s, v) => s + v, 0) / scrollHistory.length;
        if (avgScroll < -30 && current > 400 && !exitPopupShown && !isSubscribed()) {
          showExitIntent();
        }
      }, { passive: true });
    }
  }

  function showExitIntent() {
    if (exitPopupShown || isSubscribed()) return;
    exitPopupShown = true;
    try { sessionStorage.setItem(EXIT_SHOWN_KEY, '1'); } catch {}

    const overlay = document.createElement('div');
    overlay.id = 'wc-exit-overlay';
    overlay.innerHTML = `
      <div class="wc-exit-box">
        <div class="big">⚽</div>
        <h3>Wait — WC 2026 starts in days!</h3>
        <p>Don't miss a single goal. Get instant alerts for free — no app needed.</p>
        <input class="wc-input" type="email" id="wc-exit-email" placeholder="Your email address" style="text-align:center">
        <button class="wc-btn wc-btn-primary" id="wc-exit-submit" style="margin-top:6px">🔔 Alert me for free</button>
        <button class="wc-btn wc-btn-secondary" id="wc-exit-close" style="margin-top:6px">No thanks, I'll miss the goals</button>
      </div>`;

    document.body.appendChild(overlay);

    setTimeout(() => overlay.classList.add('open'), 50);

    document.getElementById('wc-exit-close').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    });

    document.getElementById('wc-exit-submit').addEventListener('click', async () => {
      const email = document.getElementById('wc-exit-email').value.trim();
      if (!email || !email.includes('@')) return;
      const btn = document.getElementById('wc-exit-submit');
      btn.textContent = 'Subscribing...';
      btn.disabled    = true;
      const ok = await subscribeEmail(email);
      if (ok) {
        markSubscribed('email-exit-intent');
        overlay.querySelector('.wc-exit-box').innerHTML = `
          <div class="big">🎉</div>
          <h3>You're all set!</h3>
          <p>WC 2026 goal alerts will land in your inbox. Enjoy the tournament!</p>
          <button class="wc-btn wc-btn-secondary" id="wc-exit-done" style="margin-top:12px">Close</button>`;
        fab.innerHTML = '✅ Subscribed';
        document.getElementById('wc-exit-done').addEventListener('click', () => {
          overlay.remove();
        });
      }
    });

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
      }
    });
  }

  // ─── Auto-show hint after 30s on page (if not subscribed) ──────────────────
  if (!isSubscribed()) {
    setTimeout(() => {
      // Pulse the FAB to draw attention
      fab.style.animation = 'wc-pulse 0.5s ease 3';
      const pulseStyle = document.createElement('style');
      pulseStyle.textContent = `
        @keyframes wc-pulse {
          0%   { transform:scale(1); }
          50%  { transform:scale(1.08); }
          100% { transform:scale(1); }
        }`;
      document.head.appendChild(pulseStyle);
      setTimeout(() => { fab.style.animation = ''; }, 1600);
    }, 30000);
  }

}());
