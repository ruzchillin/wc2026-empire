// WC 2026 Chrome Extension — popup.js
// Replace YOUR-API-KEY with your API-Football key (from .env)
const API_KEY = 'YOUR_APIFOOTBALL_KEY';
const WC_LEAGUE_ID = 1; // FIFA World Cup league ID on API-Football
const SEASON = 2026;
const AFF_LINK = 'https://sportsbook.draftkings.com/promos?sport=soccer';

const DEMO_MATCHES = [
  { home: 'Brazil', away: 'Argentina', scoreH: 1, scoreA: 1, status: 'LIVE', minute: 67, id: 1 },
  { home: 'France', away: 'England', scoreH: null, scoreA: null, status: 'NS', kickoff: '21:00 GMT', id: 2 },
  { home: 'Germany', away: 'Spain', scoreH: 2, scoreA: 0, status: 'FT', id: 3 },
];

async function loadData() {
  document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
  
  // Try live API, fall back to demo
  let matches = DEMO_MATCHES;
  
  try {
    const cached = await chrome.storage.local.get(['matches', 'lastFetch']);
    const age = Date.now() - (cached.lastFetch || 0);
    
    if (age < 60000 && cached.matches) {
      matches = cached.matches;
    } else {
      const resp = await fetch(
        `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${WC_LEAGUE_ID}&season=${SEASON}&live=all`,
        { headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.response && data.response.length > 0) {
          matches = data.response.slice(0, 5).map(f => ({
            home: f.teams.home.name,
            away: f.teams.away.name,
            scoreH: f.goals.home,
            scoreA: f.goals.away,
            status: f.fixture.status.short,
            minute: f.fixture.status.elapsed,
            kickoff: new Date(f.fixture.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
            id: f.fixture.id,
          }));
          await chrome.storage.local.set({ matches, lastFetch: Date.now() });
        }
      }
    }
  } catch (e) {
    // use demo data
  }
  
  renderMatches(matches);
}

function renderMatches(matches) {
  const container = document.getElementById('matches-container');
  if (!matches.length) {
    container.innerHTML = '<div class="empty">No live matches right now</div>';
    return;
  }
  
  container.innerHTML = matches.map(m => {
    const isLive = m.status === '1H' || m.status === '2H' || m.status === 'HT' || m.status === 'LIVE';
    const score = m.scoreH !== null ? `${m.scoreH} - ${m.scoreA}` : 'vs';
    const badge = isLive
      ? `<span class="live-badge">LIVE ${m.minute ? m.minute+"'" : ''}</span>`
      : `<span class="upcoming-badge">${m.status === 'FT' ? 'FT' : m.kickoff || 'Soon'}</span>`;
    
    return `
      <div class="match" onclick="window.open('${AFF_LINK}','_blank')">
        <div class="match-teams">
          <span>${m.home}</span>
          <span class="match-score">${score}</span>
          <span>${m.away}</span>
        </div>
        <div class="match-info">
          <span>WC 2026</span>
          ${badge}
        </div>
      </div>
    `;
  }).join('');
  
  // Update odds for first upcoming match
  const upcoming = matches.find(m => m.status === 'NS') || matches[0];
  if (upcoming) {
    document.getElementById('odds-home').textContent = upcoming.home.substring(0, 10);
    document.getElementById('odds-away').textContent = upcoming.away.substring(0, 10);
  }
}

document.addEventListener('DOMContentLoaded', loadData);
