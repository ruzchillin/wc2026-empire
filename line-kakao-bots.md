# LINE & KakaoTalk Bot Setup — WC 2026

## Why these matter
- LINE: 84M users in Japan. Japan qualified for WC 2026. Zero English/WC football bots competing.
- KakaoTalk: 45M users in South Korea. South Korea at WC. Kakao has built-in payments (KakaoPay).
- Both platforms have official bot APIs with rich card messages, push notifications, and link sharing.

---

## LINE Bot Setup (Japan — 84M users)

### Step 1: Create LINE Developer account
1. Go to https://developers.line.biz
2. Create a provider → Create a Messaging API channel
3. Name: "WC 2026 Japan" / "ワールドカップ2026"
4. Channel type: Messaging API

### Step 2: Get credentials
- Channel access token (long-lived) → add to .env as LINE_ACCESS_TOKEN
- Channel secret → add to .env as LINE_CHANNEL_SECRET
- Set webhook URL: https://YOUR-DOMAIN.com/webhook/line

### Step 3: Deploy webhook (add to integration-hub.js)
```javascript
// In integration-hub.js hub.init():
const line = require('@line/bot-sdk');
const lineClient = new line.Client({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

app.post('/webhook/line', line.middleware({ channelSecret: process.env.LINE_CHANNEL_SECRET }), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.toLowerCase();
      let reply = '';
      if (text.includes('japan') || text.includes('日本')) {
        reply = '🇯🇵 Japan WC 2026 latest: [view predictions] https://YOUR-DOMAIN.com/prediction-game.html\n\n🎰 Free bet bonus: https://bet365.com [ref link]';
      } else if (text.includes('score') || text.includes('スコア')) {
        reply = '⚽ Live WC 2026 scores: https://YOUR-DOMAIN.com/live-scores.html';
      } else {
        reply = '⚽ WC 2026 AI\n\nCommands:\n「Japan」→ Japan analysis\n「score」→ Live scores\n「predict」→ Match predictions\n「bet」→ Free bet offers\n\nhttps://YOUR-DOMAIN.com';
      }
      await lineClient.replyMessage(event.replyToken, { type: 'text', text: reply });
    }
  }
  res.json({ success: true });
});
```

### Step 4: Push notifications on goals (fire from moment-engine.js)
```javascript
// In moment-engine.js onGoal():
if (process.env.LINE_ACCESS_TOKEN && eventData.team === 'Japan') {
  const lineClient = require('../line-client'); // singleton
  // Push to all subscribers stored in line-subscribers.json
  const subs = JSON.parse(fs.readFileSync('./line-subscribers.json', 'utf8') || '[]');
  for (const userId of subs.slice(0, 500)) { // LINE free tier: 500 push/mo
    await lineClient.pushMessage(userId, {
      type: 'text',
      text: `⚽ GOAL! ${eventData.scorer} scores for Japan! ${eventData.minute}' — bet on the next goal: [link]`
    });
  }
}
```

### LINE Rich Menu (optional — high conversion)
Create a persistent bottom menu with buttons:
- ⚽ Live Scores → YOUR-DOMAIN.com/live-scores.html
- 🔮 Predictions → YOUR-DOMAIN.com/prediction-game.html
- 🎰 Free Bets → freebets2026.com (affiliate)
- 📊 Japan Stats → YOUR-DOMAIN.com/team/japan

---

## KakaoTalk Bot Setup (South Korea — 45M users)

### Step 1: KakaoTalk Developers
1. Go to https://developers.kakao.com
2. Create application → Add Kakao Login + KakaoTalk Messaging platforms
3. Enable "KakaoTalk Channel" (비즈니스 채널)

### Step 2: Get credentials
- REST API Key → .env as KAKAO_API_KEY
- Admin key → .env as KAKAO_ADMIN_KEY

### Step 3: Channel messaging
```javascript
// Send template message to KakaoTalk followers
async function sendKakaoAlert(templateId, receivers, templateArgs) {
  const resp = await fetch('https://kapi.kakao.com/v1/api/talk/friends/message/send', {
    method: 'POST',
    headers: {
      'Authorization': `KakaoAK ${process.env.KAKAO_ADMIN_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      receiver_uuids: JSON.stringify(receivers),
      template_id: templateId,
      template_args: JSON.stringify(templateArgs),
    }),
  });
  return resp.json();
}
```

### Step 4: KakaoPay integration (unique to Kakao)
KakaoPay allows direct payment inside chat — no redirect needed.
Use for: £9.99 tip subscription, match prediction premium access.
```javascript
// KakaoPay payment initiation
async function initiateKakaoPay(orderId, amount, itemName, userId) {
  const resp = await fetch('https://kapi.kakao.com/v1/payment/ready', {
    method: 'POST',
    headers: { 'Authorization': `KakaoAK ${process.env.KAKAO_ADMIN_KEY}` },
    body: new URLSearchParams({
      cid: 'TC0ONETIME',
      partner_order_id: orderId,
      partner_user_id: userId,
      item_name: itemName,
      quantity: 1,
      total_amount: amount,
      vat_amount: 0,
      tax_free_amount: 0,
      approval_url: 'https://YOUR-DOMAIN.com/kakao/success',
      fail_url: 'https://YOUR-DOMAIN.com/kakao/fail',
      cancel_url: 'https://YOUR-DOMAIN.com/kakao/cancel',
    }),
  });
  return resp.json(); // returns { next_redirect_app_url } — send this to user
}
```

---

## Deployment priority
1. LINE bot: deploy webhook endpoint first, costs nothing
2. Wire goal notifications from moment-engine.js
3. KakaoPay subscription: highest priority — payments inside Kakao = zero friction
4. Add LINE_ACCESS_TOKEN and KAKAO_ADMIN_KEY to Railway .env

## Revenue potential
- LINE: Japan fans × affiliate signups × bet365 £65 CPA = significant
- KakaoPay: £9.99/mo Korea tier × frictionless Kakao payment = highest conversion rate of any platform
