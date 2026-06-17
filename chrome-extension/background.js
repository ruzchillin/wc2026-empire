// WC 2026 Chrome Extension — background service worker
// Fires notifications on goals (when API key is configured)

chrome.runtime.onInstalled.addListener(() => {
  // Set up 5-minute alarm for live score updates during WC
  chrome.alarms.create('liveScores', { periodInMinutes: 5 });
  chrome.storage.local.set({ installed: Date.now(), notificationsEnabled: true });
  console.log('[WC2026] Extension installed — live score polling active');
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'liveScores') {
    await checkForGoals();
  }
});

async function checkForGoals() {
  const { lastGoals = {}, notificationsEnabled } = await chrome.storage.local.get(['lastGoals', 'notificationsEnabled']);
  if (!notificationsEnabled) return;
  
  // In production: fetch from your own API endpoint (not directly from API-Football in background)
  // Your backend polls every 3min and exposes /api/live-goals
  // This avoids API key exposure in the extension
  
  try {
    const resp = await fetch('https://YOUR-DOMAIN.com/api/live-goals');
    if (!resp.ok) return;
    const goals = await resp.json();
    
    goals.forEach(goal => {
      const key = `${goal.matchId}_${goal.scorer}_${goal.minute}`;
      if (!lastGoals[key]) {
        lastGoals[key] = true;
        
        chrome.notifications.create(key, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: `⚽ GOAL — ${goal.team}!`,
          message: `${goal.scorer} scores in the ${goal.minute}' — ${goal.home} ${goal.scoreH}-${goal.scoreA} ${goal.away}`,
          buttons: [{ title: 'Bet now on DraftKings →' }],
          priority: 2,
        });
      }
    });
    
    await chrome.storage.local.set({ lastGoals });
  } catch (e) {}
}

chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
  if (buttonIndex === 0) {
    chrome.tabs.create({ url: 'https://sportsbook.draftkings.com?sport=soccer' });
  }
});
