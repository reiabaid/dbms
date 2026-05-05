const API_BASE = '/api';

// Navigation
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = link.getAttribute('data-page');
        
        // Update active link
        document.querySelectorAll('nav a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Show/Hide pages
        document.querySelectorAll('.page-content').forEach(page => {
            page.style.display = 'none';
        });
        document.getElementById(pageId).style.display = 'block';

        // Load page specific data
        if (pageId === 'dashboard') loadDashboard();
        if (pageId === 'intelligence') loadIntelligence();
        if (pageId === 'admin') loadMetadata();
        if (pageId === 'classifier') loadMetadata();
    });
});

// Dashboard Data
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/games`);
        const games = await response.json();
        
        // Update Stats
        document.getElementById('stat-total-games').textContent = games.length;
        const avgScore = (games.reduce((acc, g) => acc + (g.metacritic_score || 0), 0) / games.length).toFixed(1);
        document.getElementById('stat-avg-score').textContent = avgScore;

        // Find dominant engine
        const engineCounts = {};
        games.forEach(g => { if (g.engine_name) engineCounts[g.engine_name] = (engineCounts[g.engine_name] || 0) + 1; });
        const topEngine = Object.entries(engineCounts).sort((a,b) => b[1] - a[1])[0];
        document.getElementById('stat-top-engine').textContent = topEngine ? topEngine[0] : '--';
        
        // Render Table
        const tbody = document.querySelector('#games-table tbody');
        tbody.innerHTML = games.map(g => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        ${g.cover_image_url ? `<img src="${g.cover_image_url}" alt="${g.title}" style="width: 80px; height: 38px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">` : '<div style="width: 80px; height: 38px; background: #222; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: #666; border: 1px solid rgba(255,255,255,0.1);">NO COVER</div>'}
                        <strong>${g.title}</strong>
                    </div>
                </td>
                <td>${g.developer_name}</td>
                <td><span class="badge ${getTierClass(g.publisher_tier)}">${g.publisher_name}</span></td>
                <td>${g.release_date ? new Date(g.release_date).getFullYear() : 'TBD'}</td>
                <td>${g.metacritic_score || 'N/A'}</td>
                <td>$${g.revenue_est_usd ? (g.revenue_est_usd / 1000000).toFixed(1) + 'M' : 'N/A'}</td>
                <td><button class="btn-delete" onclick="deleteGame(${g.game_id}, '${g.title.replace(/'/g, "\\'")}')">DELETE</button></td>
            </tr>

        `).join('');
    } catch (err) {
        console.error('Error loading games:', err);
    }
}

// DELETE Operation (DML DELETE - Rubric Requirement)
async function deleteGame(gameId, title) {
    if (!confirm(`DELETE "${title}" from the database? This will remove all associated records (genres, platforms, DLCs).`)) return;
    try {
        const res = await fetch(`${API_BASE}/games/${gameId}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.status === 'DELETED') {
            loadDashboard(); // Refresh table
        }
    } catch (err) {
        alert('Delete failed: ' + err.message);
    }
}

// Intelligence Data
async function loadIntelligence() {
    try {
        // ROI Analysis (CalculateROI Scalar Function)
        const roiRes = await fetch(`${API_BASE}/roi`);
        const roiData = await roiRes.json();
        const roiBody = document.querySelector('#roi-table tbody');
        roiBody.innerHTML = roiData.map(r => `
            <tr>
                <td>${r.title}</td>
                <td>${r.developer_name}</td>
                <td>$${(r.budget / 1000000).toFixed(1)}M</td>
                <td>$${(r.revenue / 1000000).toFixed(1)}M</td>
                <td style="color: ${r.roi_pct > 0 ? '#4f4' : '#f44'}; font-weight: 700;">${r.roi_pct > 0 ? '+' : ''}${parseFloat(r.roi_pct).toFixed(0)}%</td>
                <td>${r.metacritic_score || 'N/A'}</td>
            </tr>
        `).join('');

        // Above Average (Subquery)
        const aboveRes = await fetch(`${API_BASE}/above-average`);
        const aboveData = await aboveRes.json();
        const aboveBody = document.querySelector('#above-avg-table tbody');
        aboveBody.innerHTML = aboveData.map(a => `
            <tr>
                <td>${a.title}</td>
                <td>${a.developer_name}</td>
                <td><strong>${a.metacritic_score}</strong></td>
                <td>$${a.revenue_est_usd ? (a.revenue_est_usd / 1000000).toFixed(1) + 'M' : 'N/A'}</td>
            </tr>
        `).join('');

        // Engine Analysis
        const engineRes = await fetch(`${API_BASE}/engines`);
        const engines = await engineRes.json();
        const engineBody = document.querySelector('#engine-table tbody');
        engineBody.innerHTML = engines.map(e => `
            <tr>
                <td>${e.engine_name}</td>
                <td><span class="badge">${e.license_type}</span></td>
                <td>${e.game_count}</td>
                <td>${Math.round(e.avg_score)}</td>
                <td>$${(e.avg_revenue / 1000000).toFixed(1)}M</td>
            </tr>
        `).join('');

        // Genre Performance
        const genreRes = await fetch(`${API_BASE}/genres`);
        const genres = await genreRes.json();
        const genreBody = document.querySelector('#genre-table tbody');
        genreBody.innerHTML = genres.map(g => `
            <tr>
                <td>${g.genre}</td>
                <td>${g.game_count}</td>
                <td>$${(g.avg_revenue / 1000000).toFixed(1)}M</td>
                <td>${Math.round(g.avg_score)}</td>
            </tr>
        `).join('');

        // Publisher Impact
        const pubRes = await fetch(`${API_BASE}/publishers`);
        const publishers = await pubRes.json();
        const pubBody = document.querySelector('#publisher-table tbody');
        pubBody.innerHTML = publishers.map(p => `
            <tr>
                <td>${p.publisher_name}</td>
                <td><span class="badge ${getTierClass(p.tier)}">${p.tier}</span></td>
                <td>${p.total_games}</td>
                <td>${Math.round(p.avg_score || 0)}</td>
                <td>$${p.avg_revenue ? (p.avg_revenue / 1000000).toFixed(1) + 'M' : 'N/A'}</td>
            </tr>
        `).join('');

        // Platform Marketplace Comparison
        const platRes = await fetch(`${API_BASE}/platforms`);
        const platforms = await platRes.json();
        const platBody = document.querySelector('#platform-table tbody');
        platBody.innerHTML = platforms.map(p => `
            <tr>
                <td>${p.title}</td>
                <td><strong>${p.platform_name}</strong></td>
                <td>$${parseFloat(p.price_usd).toFixed(2)}</td>
                <td>${p.is_exclusive ? 'YES' : 'NO'}</td>
                <td>${p.subscription_included ? 'YES' : 'NO'}</td>
            </tr>
        `).join('');

        // === MARKET INSIGHTS (Computed from data) ===
        // Indie vs AAA ROI comparison
        const indieGames = roiData.filter(r => r.budget < 10000000);
        const aaaGames = roiData.filter(r => r.budget >= 100000000);
        const avgIndieROI = indieGames.length ? (indieGames.reduce((a,r) => a + parseFloat(r.roi_pct), 0) / indieGames.length).toFixed(0) : 0;
        const avgAaaROI = aaaGames.length ? (aaaGames.reduce((a,r) => a + parseFloat(r.roi_pct), 0) / aaaGames.length).toFixed(0) : 0;
        
        document.getElementById('insight-indie-roi').textContent = `+${avgIndieROI}%`;
        document.getElementById('insight-aaa-roi').textContent = `+${avgAaaROI}%`;
        
        // Best genre by score
        const topGenre = genres.sort((a,b) => b.avg_score - a.avg_score)[0];
        document.getElementById('insight-top-genre').textContent = topGenre ? topGenre.genre : '--';
        document.getElementById('insight-top-genre-score').textContent = topGenre ? Math.round(topGenre.avg_score) + '/100' : '--';

        // Most games on which platform
        const platformCounts = {};
        platforms.forEach(p => { platformCounts[p.platform_name] = (platformCounts[p.platform_name] || 0) + 1; });
        const topPlatform = Object.entries(platformCounts).sort((a,b) => b[1] - a[1])[0];
        document.getElementById('insight-top-platform').textContent = topPlatform ? topPlatform[0] : '--';
        document.getElementById('insight-platform-count').textContent = topPlatform ? topPlatform[1] + ' titles' : '--';

    } catch (err) {
        console.error('Error loading intelligence:', err);
    }
}

// Metadata for Forms
async function loadMetadata() {
    try {
        const res = await fetch(`${API_BASE}/metadata`);
        const data = await res.json();
        
        const populate = (id, list, valField, textField) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="">Select...</option>' + 
                list.map(i => `<option value="${i[valField]}">${i[textField]}</option>`).join('');
        };

        populate('reg-dev', data.developers, 'developer_id', 'name');
        populate('reg-pub', data.publishers, 'publisher_id', 'name');
        populate('reg-genre', data.genres, 'genre_id', 'name');
        populate('reg-platform', data.platforms, 'platform_id', 'name');

        // For classifier
        const gameRes = await fetch(`${API_BASE}/games`);
        const games = await gameRes.json();
        populate('select-game-classify', games, 'game_id', 'title');
    } catch (err) {
        console.error('Error loading metadata:', err);
    }
}

// Stored Procedure: Classifier
async function classifyGame() {
    const gameId = document.getElementById('select-game-classify').value;
    if (!gameId) return alert('Select a game first');

    try {
        // Fetch Classification
        const classRes = await fetch(`${API_BASE}/classify/${gameId}`);
        const result = await classRes.json();
        
        // Fetch Game Details for ROI and Summary
        const gamesRes = await fetch(`${API_BASE}/games`);
        const allGames = await gamesRes.json();
        const game = allGames.find(g => g.game_id == gameId);

        document.getElementById('classify-result').style.display = 'block';
        document.getElementById('res-tier').textContent = result.tier; // Revert to technical (AAA, AA, etc)
        document.getElementById('res-tier').className = 'stat-value ' + getTierClass(result.tier);
        
        // ROI Calculation
        const revenue = game.revenue_est_usd || 0;
        const budget = result.budget_score > 0 ? (result.budget_score * 5000000) : 100000;
        const roi = revenue > 0 ? (((revenue - budget) / budget) * 100).toFixed(1) : 0;
        
        document.getElementById('res-score').textContent = roi > 0 ? `+${roi}%` : 'N/A';
        document.getElementById('res-score').style.color = roi > 0 ? '#00ff00' : '#ff4444';

        // Technical Summary
        let summary = `Unit <strong>${game.title}</strong> is categorized under <strong>${result.tier}</strong> scale operations. `;
        
        if (result.tier === 'AAA') {
            summary += `This classification is driven by a massive labor force of ${game.team_size}+ developers and high capital expenditure. `;
        } else if (result.tier === 'AA') {
            summary += `It occupies the mid-market segment with optimized production costs and professional publishing support. `;
        } else {
            summary += `It represents a lean independent production, characterized by small-scale resource allocation and high agility. `;
        }

        if (roi > 100) {
            summary += `The <strong>Financial Yield</strong> indicates an alpha-tier success with an ROI exceeding 100%. `;
        } else if (roi > 0) {
            summary += `The asset is currently profitable, maintaining a positive return on initial development investment. `;
        } else {
            summary += `Financial metrics suggest the asset is either pre-revenue or prioritized artistic reach over immediate ROI. `;
        }

        summary += `<br><br><strong>Registry Data:</strong> Developed by ${game.developer_name} | Published by ${game.publisher_name}.`;

        document.getElementById('res-summary').innerHTML = summary;

    } catch (err) {
        console.error(err);
        alert('Error executing classification');
    }
}

// Stored Procedure: Register
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        title: document.getElementById('reg-title').value,
        price: document.getElementById('reg-price').value,
        developer_id: document.getElementById('reg-dev').value,
        publisher_id: document.getElementById('reg-pub').value,
        genre_id: document.getElementById('reg-genre').value,
        platform_id: document.getElementById('reg-platform').value
    };

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.status === 'SUCCESS') {
            alert('Game Registered Successfully! ID: ' + result.registered_game_id);
            e.target.reset();
            loadDashboard();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (err) {
        alert('Transaction Failed: ' + err.message);
    }
});

// Helpers
function getTierClass(tier) {
    if (!tier) return '';
    if (tier.includes('MAJOR') || tier === 'AAA') return 'badge-aaa';
    if (tier.includes('MID') || tier === 'AA') return 'badge-aa';
    return 'badge-indie';
}

// Init
loadDashboard();

// Search Filter Logic
document.getElementById('search-input')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#games-table tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(term)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});
