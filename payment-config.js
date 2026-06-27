/**
 * WC2026 Empire — Payment Configuration
 * ======================================
 * Central file for ALL payment links.
 *
 * SETUP INSTRUCTIONS:
 * 1. Stripe: go to stripe.com/dashboard → Products → Payment Links → copy URL
 * 2. Ko-fi: account will be at ko-fi.com/wc2026empire once set up
 * 3. Gumroad: account at ruzlockin.gumroad.com — create products there
 *
 * Replace YOUR_STRIPE_LINK_XXX with real links from your Stripe dashboard.
 * Everything else is already filled in and ready to go.
 */

var PAYMENT = {

  // ── KO-FI ──────────────────────────────────────────────────────────────────
  // Free donations/tips — set up at ko-fi.com (no approval needed, instant)
  kofi: {
    profileUrl:   "https://ko-fi.com/wc2026empire",
    donateUrl:    "https://ko-fi.com/wc2026empire",
    membershipUrl:"https://ko-fi.com/wc2026empire/tiers",
    // Ko-fi widget button (floating support button)
    widgetScript: "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js",
    username:     "wc2026empire"
  },

  // ── GUMROAD PRODUCTS ────────────────────────────────────────────────────────
  // Products at ruzlockin.gumroad.com — must create each product in Gumroad dashboard
  gumroad: {
    storeUrl:         "https://ruzlockin.gumroad.com",
    predictionsUrl:   "https://ruzlockin.gumroad.com/l/wc2026-predictions",    // $9.99
    bracketUrl:       "https://ruzlockin.gumroad.com/l/wc2026-bracket",        // $4.99
    streamingUrl:     "https://ruzlockin.gumroad.com/l/wc2026-streaming",      // $7.99
    fantasyUrl:       "https://ruzlockin.gumroad.com/l/wc2026-fantasy",        // $12.99
    sweepstakeUrl:    "https://ruzlockin.gumroad.com/l/wc2026-sweepstake",     // $4.99
    groupStageUrl:    "https://ruzlockin.gumroad.com/l/wc2026-group-stage",    // $5.99
    goldenBootUrl:    "https://ruzlockin.gumroad.com/l/wc2026-golden-boot",    // $4.99
    statsUrl:         "https://ruzlockin.gumroad.com/l/wc2026-stats-bible",    // $7.99
    fixturesUrl:      "https://ruzlockin.gumroad.com/l/wc2026-fixtures",       // $2.99 (FREE lead magnet)
    bundleUrl:        "https://ruzlockin.gumroad.com/l/wc2026-bundle",         // $34.99
    freeLeadMagnet:   "https://ruzlockin.gumroad.com/l/wc2026-fixtures",       // FREE (email capture)
  },

  // ── STRIPE DIRECT PAYMENT LINKS ─────────────────────────────────────────────
  // Create these in your Stripe dashboard: stripe.com/dashboard → Products → Payment Links
  // Format: https://buy.stripe.com/XXXXXXXXXXXX
  //
  // STEP BY STEP:
  //   1. Go to stripe.com → create account (free)
  //   2. Dashboard → Products → + Add product
  //   3. Create each product below with the price shown
  //   4. Click "Create payment link" → copy the URL → paste here
  //
  stripe: {
    // VIP Newsletter Subscription ($4.99/month recurring)
    vipMembership:    "YOUR_STRIPE_LINK_VIP_4.99_MONTHLY",

    // Premium Bundle (one-time $34.99)
    premiumBundle:    "YOUR_STRIPE_LINK_BUNDLE_34.99",

    // Predictions Pack (one-time $9.99)
    predictionsOne:   "YOUR_STRIPE_LINK_PREDICTIONS_9.99",

    // Streaming Bible (one-time $7.99)
    streamingBible:   "YOUR_STRIPE_LINK_STREAMING_7.99",

    // Fantasy Draft Kit (one-time $12.99)
    fantasyKit:       "YOUR_STRIPE_LINK_FANTASY_12.99",

    // Quick tip donation ($5)
    tip5:             "YOUR_STRIPE_LINK_TIP_5",

    // Quick tip donation ($10)
    tip10:            "YOUR_STRIPE_LINK_TIP_10",
  },

  // ── BEEHIIV ─────────────────────────────────────────────────────────────────
  // Newsletter at wc2026empire.beehiiv.com
  beehiiv: {
    subscribeUrl:  "https://wc2026empire.beehiiv.com/subscribe",
    // Embed ID: get from Beehiiv dashboard → Forms → Embed
    // Replace the ID below after setting up your Beehiiv account
    embedFormId:   "YOUR_BEEHIIV_FORM_ID",  // e.g. "4ab3c1d2-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  },

  // ── DISCORD ─────────────────────────────────────────────────────────────────
  // Create a Discord server, then Server Settings → Invites → Create invite link
  discord: {
    inviteUrl: "https://discord.gg/wc2026empire",  // Update with your real server invite
  },

  // ── HELPER: check if a Stripe link is real (not placeholder) ────────────────
  stripeReady: function(key) {
    return this.stripe[key] && !this.stripe[key].startsWith("YOUR_");
  },

  // ── HELPER: get best payment URL for a product ──────────────────────────────
  // Prefers Stripe (lower fees than Gumroad), falls back to Gumroad
  getBuyUrl: function(product) {
    var map = {
      "bundle":      { stripe: "premiumBundle",  gumroad: "bundleUrl" },
      "predictions": { stripe: "predictionsOne", gumroad: "predictionsUrl" },
      "streaming":   { stripe: "streamingBible", gumroad: "streamingUrl" },
      "fantasy":     { stripe: "fantasyKit",     gumroad: "fantasyUrl" },
    };
    var p = map[product];
    if (!p) return this.gumroad.storeUrl;
    if (this.stripeReady(p.stripe)) return this.stripe[p.stripe];
    return this.gumroad[p.gumroad] || this.gumroad.storeUrl;
  }
};
