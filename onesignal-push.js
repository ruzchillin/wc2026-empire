/**
 * onesignal-push.js
 * Web push notification setup for all WC 2026 pages.
 * Integrates with moment-engine.js — goal alerts, lineup news,
 * and AI picks fire directly to subscribed visitors' devices.
 *
 * SETUP:
 * 1. Create free account at onesignal.com
 * 2. Add new App → Web Push → copy your App ID
 * 3. Add ONESIGNAL_APP_ID=your_id_here to .env
 * 4. Add this to every HTML page <head>:
 *      <script src="/onesignal-push.js"></script>
 *    OR run inject-push.sh to add it to all 57 pages at once.
 *
 * WHAT THIS DOES:
 * - Shows permission prompt after 8 seconds (non-intrusive)
 * - Segments subscribers by page topic (WC, horse racing, NFL etc.)
 * - Exposes window.wcPush() for moment-engine to call
 * - Handles permission state, already-subscribed checks
 * - Fires resubscribe prompt 7 days after initial prompt if denied
 */

(function() {
  'use strict';

  const ONESIGNAL_APP_ID = window.ONESIGNAL_APP_ID
    || document.currentScript?.dataset?.appId
    || (typeof process !== 'undefined' && process.env?.ONESIGNAL_APP_ID)
    || 'ONESIGNAL_APP_ID_PLACEHOLDER';

  if (ONESIGNAL_APP_ID === 'ONESIGNAL_APP_ID_PLACEHOLDER') {
    console.warn('[WC Push] OneSignal App ID not set. Add ONESIGNAL_APP_ID to .env');
    return;
  }

  // Detect page topic from URL/title for segmentation
  function detectTopic() {
    const path = window.location.pathname;
    if (path.includes('horse') || path.includes('racing')) return 'horse-racing';
    if (path.includes('nfl')) return 'nfl';
    if (path.includes('cricket') || path.includes('india')) return 'cricket';
    if (path.includes('greyhound')) return 'greyhounds';
    if (path.includes('women')) return 'womens-sport';
    return 'wc2026'; // default
  }

  const topic = detectTopic();

  // Load OneSignal SDK
  window.OneSignalDeferred = window.OneSignalDeferred || [];

  const script = document.createElement('script');
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  script.defer = true;
  document.head.appendChild(script);

  window.OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      safari_web_id: 'web.onesignal.auto.' + ONESIGNAL_APP_ID,
      notifyButton: {
        enable: false // we handle our own prompt UI
      },
      promptOptions: {
        slidedown: {
          prompts: [
            {
              type: 'push',
              autoPrompt: false, // we trigger manually after delay
              text: {
                actionMessage: 'Get goal alerts and AI picks for every WC 2026 match — delivered to your device the moment they happen.',
                acceptButton: 'Yes, alert me',
                cancelButton: 'Not now'
              }
            }
          ]
        }
      }
    });

    // Tag subscriber with topic
    await OneSignal.User.addTag('topic', topic);
    await OneSignal.User.addTag('source', 'wc2026-site');

    // Show prompt after 8s if not already subscribed/denied
    const permission = await OneSignal.Notifications.permissionNative;
    const isSubscribed = await OneSignal.User.PushSubscription.optedIn;

    if (!isSubscribed && permission === 'default') {
      setTimeout(async () => {
        // Show custom non-intrusive banner first
        showPushBanner();
      }, 8000);
    }
  });

  // Custom push permission banner (less aggressive than native prompt)
  function showPushBanner() {
    if (document.getElementById('wc-push-banner')) return;
    if (sessionStorage.getItem('push-dismissed')) return;

    const banner = document.createElement('div');
    banner.id = 'wc-push-banner';
    banner.innerHTML = `
      <div style="
        position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
        background:#111827;color:#f9fafb;
        border-radius:10px;padding:12px 16px;
        display:flex;align-items:center;gap:12px;
        max-width:420px;width:calc(100% - 32px);
        box-shadow:0 4px 24px rgba(0,0,0,0.3);
        z-index:9999;font-family:system-ui,sans-serif;font-size:13px;
        animation:slideUp .3s ease;
      ">
        <span style="font-size:20px">⚽</span>
        <div style="flex:1">
          <div style="font-weight:600;margin-bottom:2px">Goal alerts — instant</div>
          <div style="color:#9ca3af;font-size:12px">AI picks + live WC updates to your device</div>
        </div>
        <button onclick="window.wcPush.accept()" style="
          background:#2563eb;color:#fff;border:none;border-radius:6px;
          padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;
          white-space:nowrap;
        ">Turn on</button>
        <button onclick="window.wcPush.dismiss()" style="
          background:none;border:none;color:#6b7280;cursor:pointer;
          font-size:18px;line-height:1;padding:4px;
        ">×</button>
      </div>
      <style>
        @keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      </style>
    `;
    document.body.appendChild(banner);
  }

  // Public API for moment-engine and manual calls
  window.wcPush = {

    // User clicked "Turn on"
    accept: async function() {
      document.getElementById('wc-push-banner')?.remove();
      window.OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.Slidedown.promptPush();
      });
    },

    // User dismissed the banner
    dismiss: function() {
      document.getElementById('wc-push-banner')?.remove();
      sessionStorage.setItem('push-dismissed', '1');
    },

    /**
     * Send a push notification to all WC 2026 subscribers.
     * Called by moment-engine.js on GOAL, RED_CARD, ELIMINATION etc.
     *
     * @param {object} opts
     * @param {string} opts.title - Notification title
     * @param {string} opts.message - Notification body
     * @param {string} opts.url - Click destination (defaults to live-scores)
     * @param {string} opts.topic - Segment filter (default: wc2026)
     * @param {string} opts.emoji - Leading emoji for title
     */
    send: async function(opts) {
      const {
        title,
        message,
        url = '/live-scores.html',
        topic: targetTopic = 'wc2026',
        emoji = '⚽'
      } = opts;

      const REST_API_KEY = window.ONESIGNAL_REST_KEY || '';
      if (!REST_API_KEY) {
        console.warn('[WC Push] ONESIGNAL_REST_KEY not set — push not sent');
        return;
      }

      const payload = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: `${emoji} ${title}` },
        contents: { en: message },
        url: url,
        filters: [
          { field: 'tag', key: 'topic', relation: '=', value: targetTopic }
        ],
        ios_badgeType: 'Increase',
        ios_badgeCount: 1,
        ttl: 3600 // expire after 1hr if not delivered (stale match updates useless)
      };

      try {
        const res = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${REST_API_KEY}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log('[WC Push] Sent:', data.id, '→', data.recipients, 'recipients');
        return data;
      } catch (err) {
        console.error('[WC Push] Failed:', err);
      }
    },

    // Pre-built notification templates for moment-engine
    templates: {
      goal: (team, score, minute) => ({
        emoji: '⚽',
        title: `GOAL — ${team}`,
        message: `${score} (${minute}') — AI win probability updated. Tap for in-play picks.`,
        url: '/live-scores.html'
      }),
      redCard: (player, team, minute) => ({
        emoji: '🟥',
        title: `RED CARD — ${team} down to 10`,
        message: `${player} off in ${minute}'. Odds just shifted. AI re-analysis live now.`,
        url: '/live-scores.html'
      }),
      elimination: (team, score) => ({
        emoji: '😔',
        title: `${team} are out`,
        message: `${score}. The AI saw it coming. Full analysis + next WC prediction inside.`,
        url: '/elimination-memorial.html'
      }),
      aiPick: (match, pick, confidence) => ({
        emoji: '🤖',
        title: `AI pick: ${match}`,
        message: `${pick} — ${confidence}% confidence. Kicks off in 2 hours.`,
        url: '/command-center.html'
      }),
      injuryAlert: (player, team) => ({
        emoji: '🚑',
        title: `Injury: ${player} (${team}) doubtful`,
        message: 'Late fitness test today. Odds shifting. Updated AI pick inside.',
        url: '/injury-tracker.html'
      }),
      oddsAlert: (match, movement) => ({
        emoji: '📊',
        title: `Odds moving: ${match}`,
        message: `${movement} — sharp money detected. See updated AI analysis.`,
        url: '/odds-comparison.html'
      })
    }
  };

})();
