// Load and display matches
async function loadMatches() {
    try {
        const response = await fetch('data/matches.json');
        const data = await response.json();

        const container = document.getElementById('matches-container');

        if (!data.matches || data.matches.length === 0) {
            container.innerHTML = '<div class="loading">لا توجد مباريات اليوم</div>';
            return;
        }

        container.innerHTML = '';

        data.matches.forEach(match => {
            const card = createMatchCard(match);
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading matches:', error);
        document.getElementById('matches-container').innerHTML =
            '<div class="loading">خطأ في تحميل المباريات</div>';
    }
}

function createMatchCard(match) {
    const card = document.createElement('a');
    card.className = 'match-row';
    card.href = `watch.html?match=${match.id}`;

    // Time
    // We expect the backend to provide correct GMT time in timestamp
    // Use the explicit label if available (e.g. "17:30 GMT") or format it
    let timeString = match.time_label;

    if (!timeString) {
        const matchDate = new Date(match.timestamp * 1000);
        const formattedTime = matchDate.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
            hour12: false
        });
        timeString = `${formattedTime} GMT`;
    }

    // Status
    let statusText = 'لم تبدأ';
    let statusClass = 'status-upcoming';
    if (match.status === 'LIVE') {
        statusText = '🔴 مباشر';
        statusClass = 'status-live';
    } else if (match.status === 'FT') {
        statusText = 'انتهت';
        statusClass = 'status-finished';
    }

    card.innerHTML = `
        <div class="team">
            <span class="team-name">${match.home.name}</span>
            <img src="${match.home.logo}" alt="${match.home.name}" class="team-logo" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22%3E%3Crect fill=%22%23333%22 width=%2232%22 height=%2232%22/%3E%3C/svg%3E'">
        </div>
        
        <div class="match-center">
            <div class="match-time">${timeString}</div>
            <div class="vs">VS</div>
            <div class="match-status ${statusClass}">${statusText}</div>
        </div>
        
        <div class="team">
            <img src="${match.away.logo}" alt="${match.away.name}" class="team-logo" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22%3E%3Crect fill=%22%23333%22 width=%2232%22 height=%2232%22/%3E%3C/svg%3E'">
            <span class="team-name">${match.away.name}</span>
        </div>
    `;

    return card;
}

// Load matches on page load
loadMatches();

// Refresh every minute
setInterval(loadMatches, 60000);
