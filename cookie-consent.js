/**
 * WC 2026 Sports Empire — Cookie Consent Banner
 * GDPR (EU/UK) + CCPA (California) compliant.
 *
 * Add to ALL pages with a single script tag:
 *   <script src="/cookie-consent.js" defer></script>
 *
 * What it does:
 *   - Shows a consent banner on first visit
 *   - Stores consent in localStorage (NO cookies until consent given)
 *   - On accept: fires window.dispatchEvent('cookieConsentGranted') so
 *     Google Analytics / AdSense / other scripts can initialize
 *   - On decline: only essential cookies allowed
 *   - Provides a "Cookie Settings" link to revisit choice
 *   - Consent expires after 365 days (re-asks annually)
 *
 * Privacy policy link: /privacy-policy
 *
 * This is required for:
 *   - Google AdSense approval
 *   - UK ICO compliance
 *   - EU GDPR compliance
 *   - CCPA compliance (California)
 */

(function () {
  'use strict';

  const STORAGE_KEY  = 'wc2026_cookie_consent';
  const VERSION      = '1.0'; // bump to re-ask all users
  const EXPIRE_DAYS  = 365;

  // ─── Consent storage ────────────────────────────────────────────────────────

  function getConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj.version !== VERSION) return null; // policy changed → re-ask
      if (Date.now() > obj.expires) return null; // expired → re-ask
      return obj;
    } catch { return null; }
  }

  function saveConsent(analytics, marketing) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version:   VERSION,
        analytics,
        marketing,
        timestamp: Date.now(),
        expires:   Date.now() + EXPIRE_DAYS * 24 * 60 * 60 * 1000
      }));
    } catch { /* localStorage not available */ }
  }

  // ─── Actions on consent ────────────────────────────────────────────────────

  function onConsentGranted(analytics, marketing) {
    // Fire event so analytics/ads scripts can initialize
    window.dispatchEvent(new CustomEvent('cookieConsentGranted', {
      detail: { analytics, marketing }
    }));

    // Initialize Google Analytics if analytics accepted
    if (analytics && window.WC2026_GA_ID) {
      initGA(window.WC2026_GA_ID);
    }

    // Signal to AdSense that consent was given
    if (marketing && window.adsbygoogle) {
      window.adsbygoogle.pauseAdRequests = 0;
    }
  }

  function initGA(gId) {
    if (document.querySelector(`script[src*="gtag"]`)) return; // already loaded
    const s = document.createElement('script');
    s.async = true;
    s.src   = `https://www.googletagmanager.com/gtag/js?id=${gId}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', gId, { anonymize_ip: true });
  }

  // ─── Banner HTML ────────────────────────────────────────────────────────────

  function createBanner() {
    const banner = document.createElement('div');
    banner.id    = 'wc2026-cookie-banner';

    banner.innerHTML = `
      <div class="wc2026-cb-overlay">
        <div class="wc2026-cb-box">
          <div class="wc2026-cb-icon">🍪</div>
          <h3 class="wc2026-cb-title">We use cookies</h3>
          <p class="wc2026-cb-text">
            We use cookies to give you live WC 2026 scores, personalised content,
            and to keep our site running for free with advertising.
            <a href="/privacy-policy" class="wc2026-cb-link" target="_blank">Privacy Policy</a>
          </p>
          <div class="wc2026-cb-options">
            <label class="wc2026-cb-check">
              <input type="checkbox" id="wc2026-analytics" checked>
              <span>Analytics (helps us improve)</span>
            </label>
            <label class="wc2026-cb-check">
              <input type="checkbox" id="wc2026-marketing" checked>
              <span>Personalised ads</span>
            </label>
          </div>
          <div class="wc2026-cb-buttons">
            <button class="wc2026-cb-btn wc2026-cb-accept" id="wc2026-accept-all">Accept All</button>
            <button class="wc2026-cb-btn wc2026-cb-save"   id="wc2026-save-prefs">Save Preferences</button>
            <button class="wc2026-cb-btn wc2026-cb-reject" id="wc2026-reject-all">Reject All</button>
          </div>
          <p class="wc2026-cb-note">
            Essential cookies (live scores, session) are always on.
          </p>
        </div>
      </div>`;

    // Styles
    const style = document.createElement('style');
    style.textContent = `
      #wc2026-cookie-banner { position:fixed; inset:0; z-index:99999; display:flex; align-items:flex-end; justify-content:center; padding:20px; pointer-events:none; }
      .wc2026-cb-overlay    { pointer-events:all; width:100%; max-width:560px; }
      .wc2026-cb-box        { background:#111; border:1px solid #2a2a2a; border-radius:16px; padding:24px; box-shadow:0 -4px 40px rgba(0,0,0,.6); animation:wc2026-slide-up .3s ease; }
      @keyframes wc2026-slide-up { from { transform:translateY(20px); opacity:0; } to { transform:translateY(0); opacity:1; } }
      .wc2026-cb-icon       { font-size:28px; margin-bottom:8px; }
      .wc2026-cb-title      { color:#fff; font-size:18px; font-weight:700; margin:0 0 8px; font-family:'Segoe UI',Arial,sans-serif; }
      .wc2026-cb-text       { color:#aaa; font-size:14px; line-height:1.5; margin:0 0 16px; font-family:'Segoe UI',Arial,sans-serif; }
      .wc2026-cb-link       { color:#76ff03; text-decoration:none; }
      .wc2026-cb-link:hover { text-decoration:underline; }
      .wc2026-cb-options    { margin-bottom:16px; }
      .wc2026-cb-check      { display:flex; align-items:center; gap:10px; color:#ccc; font-size:14px; cursor:pointer; margin-bottom:8px; font-family:'Segoe UI',Arial,sans-serif; }
      .wc2026-cb-check input{ width:18px; height:18px; accent-color:#76ff03; cursor:pointer; }
      .wc2026-cb-buttons    { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
      .wc2026-cb-btn        { flex:1; min-width:100px; padding:10px 16px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; font-family:'Segoe UI',Arial,sans-serif; transition:opacity .15s; }
      .wc2026-cb-btn:hover  { opacity:.85; }
      .wc2026-cb-accept     { background:#76ff03; color:#0a0a0a; }
      .wc2026-cb-save       { background:#2a2a2a; color:#fff; border:1px solid #444; }
      .wc2026-cb-reject     { background:#1a1a1a; color:#888; border:1px solid #333; }
      .wc2026-cb-note       { color:#555; font-size:12px; margin:0; font-family:'Segoe UI',Arial,sans-serif; }

      @media (max-width:480px) {
        .wc2026-cb-buttons { flex-direction:column; }
        .wc2026-cb-btn     { width:100%; }
      }`;

    document.head.appendChild(style);
    document.body.appendChild(banner);
    return banner;
  }

  function removeBanner(banner) {
    if (banner) {
      banner.style.opacity    = '0';
      banner.style.transition = 'opacity .2s';
      setTimeout(() => banner.remove(), 200);
    }
  }

  // ─── Cookie Settings link ─────────────────────────────────────────────────

  function addSettingsLink() {
    // Add a small "Cookie Settings" link to the footer (if footer exists)
    const footer = document.querySelector('footer, #footer, .footer');
    if (!footer) return;

    const link = document.createElement('a');
    link.id          = 'wc2026-cookie-settings';
    link.href        = '#';
    link.textContent = 'Cookie Settings';
    link.style.cssText = 'color:#555;font-size:12px;text-decoration:none;margin-left:16px;font-family:\'Segoe UI\',Arial,sans-serif;';

    link.addEventListener('click', (e) => {
      e.preventDefault();
      // Clear consent to force banner to show again
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      init();
    });

    footer.appendChild(link);
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    const existing = getConsent();

    if (existing) {
      // Consent already given — fire event immediately on page load
      onConsentGranted(existing.analytics, existing.marketing);
      addSettingsLink();
      return;
    }

    // No consent yet — show banner
    const banner = createBanner();

    document.getElementById('wc2026-accept-all').addEventListener('click', () => {
      saveConsent(true, true);
      onConsentGranted(true, true);
      removeBanner(banner);
      addSettingsLink();
    });

    document.getElementById('wc2026-save-prefs').addEventListener('click', () => {
      const analytics = document.getElementById('wc2026-analytics').checked;
      const marketing = document.getElementById('wc2026-marketing').checked;
      saveConsent(analytics, marketing);
      onConsentGranted(analytics, marketing);
      removeBanner(banner);
      addSettingsLink();
    });

    document.getElementById('wc2026-reject-all').addEventListener('click', () => {
      saveConsent(false, false);
      removeBanner(banner);
      addSettingsLink();
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API for manual control
  window.WC2026CookieConsent = {
    getConsent,
    reset: () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} }
  };

}());
