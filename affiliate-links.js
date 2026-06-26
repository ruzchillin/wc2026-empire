/**
 * WC2026 EMPIRE — CENTRAL AFFILIATE LINK MANAGER
 * ================================================
 * Update your IDs here → every link across the entire site updates automatically.
 * This file is loaded by vpn-deals.html, travel.html, tickets.html, and injected
 * into all streaming pages by inject_affiliate_ctaz.py
 *
 * HOW TO UPDATE:
 * 1. Get your affiliate ID from each program (see AFFILIATE_SETUP_GUIDE.md)
 * 2. Replace the YOUR_ID placeholder with your real ID
 * 3. Run the deploy script — all pages update automatically
 */

const AFFILIATE = {

  // ─── VPN PROGRAMS ────────────────────────────────────────────────────────
  // Commission: 40-100% first sale, 30% recurring
  // Network: Impact Radius (impact.com) for all major VPNs

  nordvpn: {
    name: "NordVPN",
    // After approval on Impact: Dashboard → Links → Get link
    // Format: https://go.nordvpn.net/aff_c?offer_id=15&aff_id=YOUR_ID
    url: "https://go.nordvpn.net/aff_c?offer_id=15&aff_id=YOUR_NORDVPN_ID",
    // Fallback direct (use until approved):
    fallback: "https://nordvpn.com/",
    commission: "40% new, 30% renewals",
    cookieDays: 30,
    price: "From $3.39/mo",
    badge: "BEST FOR BBC",
    rating: 4.8,
    highlight: "Undetected by BBC iPlayer 10/10 tests"
  },

  expressvpn: {
    name: "ExpressVPN",
    // After approval: expressvpn.com/affiliates → get tracking link
    // Format: https://www.expressrefer.com/refer-a-friend?referrer_id=YOUR_ID
    url: "https://www.expressvpn.com/order?a_fid=YOUR_EXPRESSVPN_ID",
    fallback: "https://www.expressvpn.com/",
    commission: "$13-$36 per signup (tiered CPA)",
    cookieDays: 30,
    price: "From $6.67/mo",
    badge: "FASTEST SPEEDS",
    rating: 4.7,
    highlight: "190+ countries, fastest download speeds"
  },

  surfshark: {
    name: "Surfshark",
    // After approval on Impact: same as NordVPN flow
    // Format: https://surfshark.com/
    url: "https://surfshark.com/deal/wc2026?coupon=wc2026&transaction_id=YOUR_SURFSHARK_ID",
    fallback: "https://surfshark.com/",
    commission: "40%+ new sales, avg ~60%",
    cookieDays: 30,
    price: "From $2.05/mo",
    badge: "BEST VALUE",
    rating: 4.6,
    highlight: "Unlimited devices, cheapest per month"
  },

  purevpn: {
    name: "PureVPN",
    // After approval: purevpn.com/affiliates
    url: "https://www.purevpn.com/?aff_id=YOUR_PUREVPN_ID",
    fallback: "https://www.purevpn.com/",
    commission: "100% first month, 40% + 35% recurring",
    cookieDays: 30,
    price: "From $2.08/mo",
    badge: "TOP RECURRING",
    rating: 4.4,
    highlight: "Best recurring commission — earn every renewal"
  },

  cyberghost: {
    name: "CyberGhost",
    // After approval: Impact → CyberGhost program
    url: "https://www.cyberghostvpn.com/en_US/?aff_id=YOUR_CYBERGHOST_ID",
    fallback: "https://www.cyberghostvpn.com/",
    commission: "100% first sale CPA",
    cookieDays: 45,
    price: "From $2.03/mo",
    badge: "45-DAY TRIAL",
    rating: 4.5,
    highlight: "Longest money-back guarantee — 45 days"
  },

  // ─── STREAMING SERVICES ───────────────────────────────────────────────────
  // Commission: $30 per lead (fuboTV), CPA (DAZN)

  fubotv: {
    name: "fuboTV",
    // After approval: fubo.tv/stream/affiliate → get Impact link
    url: "https://www.fubo.tv/stream/affiliate/?irclickid=YOUR_FUBOTV_ID",
    fallback: "https://www.fubo.tv/",
    commission: "$30 per qualified lead",
    cookieDays: 30,
    price: "From $79.99/mo",
    badge: "US ONLY",
    highlight: "4K streams, all WC2026 matches in the US"
  },

  dazn: {
    name: "DAZN",
    // After approval: affiliate.dazn.com → get tracking link
    url: "https://www.dazn.com/?irclickid=YOUR_DAZN_ID",
    fallback: "https://www.dazn.com/",
    commission: "CPA per subscriber",
    cookieDays: 30,
    price: "From $19.99/mo",
    badge: "GLOBAL",
    highlight: "Available in 200+ countries"
  },

  // ─── TRAVEL PROGRAMS ──────────────────────────────────────────────────────
  // All managed via Travelpayouts (one signup = access to all below)
  // Sign up: travelpayouts.com → get your Travelpayouts marker ID

  booking: {
    name: "Booking.com",
    // Travelpayouts format: https://tp.media/r?marker=YOUR_MARKER&p=4&s=1&u=https%3A%2F%2Fwww.booking.com
    url: "https://www.booking.com/?aid=YOUR_BOOKING_AID",
    // Via Travelpayouts (preferred):
    travelpayouts: "https://tp.media/r?marker=YOUR_TP_MARKER&p=4&s=1&u=https%3A%2F%2Fwww.booking.com",
    fallback: "https://www.booking.com/",
    commission: "Up to 40% of their commission (~4% of booking)",
    cookieDays: 30
  },

  kayak: {
    name: "Kayak",
    url: "https://tp.media/r?marker=YOUR_TP_MARKER&p=2731&s=1&u=https%3A%2F%2Fwww.kayak.com",
    fallback: "https://www.kayak.com/",
    commission: "Up to 50% revenue share",
    cookieDays: 30
  },

  skyscanner: {
    name: "Skyscanner",
    url: "https://tp.media/r?marker=YOUR_TP_MARKER&p=1&s=1&u=https%3A%2F%2Fwww.skyscanner.com",
    fallback: "https://www.skyscanner.com/",
    commission: "Up to 40%",
    cookieDays: 30
  },

  hotelscom: {
    name: "Hotels.com",
    url: "https://tp.media/r?marker=YOUR_TP_MARKER&p=22&s=1&u=https%3A%2F%2Fwww.hotels.com",
    fallback: "https://www.hotels.com/",
    commission: "6.4% on all hotel bookings",
    cookieDays: 7
  },

  // ─── TICKETS ──────────────────────────────────────────────────────────────
  // Viagogo & StubHub = same company (Viagogo Holdings). Managed via Partnerize.

  viagogo: {
    name: "Viagogo",
    // After approval on Partnerize: get your unique deep-link
    // Format: https://www.viagogo.com/?pcrid=YOUR_PARTNERIZE_ID
    url: "https://www.viagogo.com/?pcrid=YOUR_VIAGOGO_ID",
    fallback: "https://www.viagogo.com/",
    commission: "Commission on ticket sales (check Partnerize dashboard)",
    cookieDays: 30
  },

  stubhub: {
    name: "StubHub",
    url: "https://www.stubhub.com/?pcrid=YOUR_STUBHUB_ID",
    fallback: "https://www.stubhub.com/",
    commission: "Commission on ticket sales (check Partnerize dashboard)",
    cookieDays: 30
  },

  ticketnetwork: {
    name: "TicketNetwork",
    // Direct affiliate: ticketnetwork.com/affiliates → ShareASale program
    url: "https://www.ticketnetwork.com/?aid=YOUR_TN_ID",
    fallback: "https://www.ticketnetwork.com/",
    commission: "6% on all ticket sales",
    cookieDays: 30
  },

  // ─── MERCHANDISE ──────────────────────────────────────────────────────────

  fanatics: {
    name: "Fanatics",
    // After approval on Impact: Dashboard → Fanatics advertiser → get link
    // Format: https://www.fanatics.com/?awc=YOUR_FANATICS_AWC
    url: "https://www.fanatics.com/?awc=YOUR_FANATICS_AWC",
    fallback: "https://www.fanatics.com/soccer-national-teams/fifa-world-cup",
    commission: "Up to 10% on all sales",
    cookieDays: 7
  },

  amazon: {
    name: "Amazon Associates",
    // After approval: associate-tag is your tracking ID
    // Format: https://www.amazon.com/?tag=YOUR_AMAZON_TAG
    url: "https://www.amazon.com/?tag=YOUR_AMAZON_TAG",
    fallback: "https://www.amazon.com/s?k=world+cup+2026",
    commission: "1-10% depending on category (sporting goods: ~3%)",
    cookieDays: 1
  },

  worldsoccershop: {
    name: "WorldSoccerShop",
    // Via ShareASale or CJ Affiliate
    url: "https://www.worldsoccershop.com/shop/tournaments/fifa-world-cup?aff=YOUR_WSS_ID",
    fallback: "https://www.worldsoccershop.com/shop/tournaments/fifa-world-cup",
    commission: "10-15% on all sales",
    cookieDays: 30
  }
};

/**
 * HELPER FUNCTIONS
 * These are used by all pages to get the right link (real if available, fallback otherwise)
 */

function getAffLink(program) {
  const p = AFFILIATE[program];
  if (!p) return "#";
  // Use real link if ID has been filled in, otherwise fallback
  if (p.url && !p.url.includes("YOUR_")) return p.url;
  return p.fallback || "#";
}

function isLive(program) {
  const p = AFFILIATE[program];
  return p && p.url && !p.url.includes("YOUR_");
}

// Export for use in other scripts
if (typeof module !== "undefined") module.exports = { AFFILIATE, getAffLink, isLive };
