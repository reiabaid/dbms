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
        window.currentGamesData = games;
        renderGamesTable(games);
    } catch (err) {
        console.error('Error loading games:', err);
    }
}

let sortDirection = {};
function renderGamesTable(games) {
    const tbody = document.querySelector('#games-table tbody');
    if (!tbody) return;
    tbody.innerHTML = games.map(g => `
        <tr onclick="showGameDetails(${g.game_id})" style="cursor: pointer;">
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
            <td><button class="btn-delete" onclick="event.stopPropagation(); deleteGame(${g.game_id}, '${g.title.replace(/'/g, "\\'")}')">DELETE</button></td>
        </tr>
    `).join('');
}

window.sortGames = function(column) {
    if (!window.currentGamesData) return;
    sortDirection[column] = !sortDirection[column];
    const isAsc = sortDirection[column];
    
    window.currentGamesData.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'string') return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return isAsc ? valA - valB : valB - valA;
    });
    renderGamesTable(window.currentGamesData);
};

// DELETE Operation (DML DELETE - Rubric Requirement)
async function deleteGame(gameId, title) {
    if (!confirm(`DELETE "${title}" from the database? This will remove all associated records (genres, platforms, DLCs).`)) return;
    try {
        const res = await fetch(`${API_BASE}/games/${gameId}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.status === 'DELETED') {
            globalRefresh(); 
        }
    } catch (err) {
        alert('Delete failed: ' + err.message);
    }
}

// Intelligence Data
window.intelligenceData = {};

let chartInstances = {};
function initChart(id, type, labels, data, label, isCurrency = false, isHorizontal = false) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstances[id]) chartInstances[id].destroy();
    
    Chart.defaults.color = '#888';
    Chart.defaults.font.family = 'Inter';
    
    // Monochrome & Emerald palette to match the dark/glass theme
    const colors = [
        'rgba(255, 255, 255, 0.9)',    // Pure White
        'rgba(16, 185, 129, 0.8)',     // Emerald (Matches ROI positive)
        'rgba(161, 161, 170, 0.8)',    // Light Grey
        'rgba(113, 113, 122, 0.8)',    // Mid Grey
        'rgba(20, 184, 166, 0.8)',     // Teal (Secondary Accent)
        'rgba(228, 228, 231, 0.8)',    // Silver
        'rgba(82, 82, 91, 0.8)',       // Dark Grey
        'rgba(52, 211, 153, 0.8)'      // Soft Emerald
    ];
    
    const bgColors = data.map((_, i) => colors[i % colors.length]);
    
    chartInstances[id] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: bgColors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: isHorizontal ? 'y' : 'x',
            plugins: {
                legend: { display: type === 'doughnut', position: 'right' },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            let val = ctx.raw;
                            if (isCurrency) return '$' + val.toFixed(1) + 'M';
                            return val;
                        }
                    }
                }
            },
            scales: type === 'doughnut' ? {} : {
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

async function loadIntelligence() {
    try {
        // ROI Analysis (CalculateROI Scalar Function)
        const roiRes = await fetch(`${API_BASE}/roi`);
        window.intelligenceData.roi = await roiRes.json();
        const roiBody = document.querySelector('#roi-table tbody');
        if (roiBody) {
            roiBody.innerHTML = window.intelligenceData.roi.slice(0, 10).map(r => `
                <tr>
                    <td>${r.title}</td>
                    <td>${r.developer_name}</td>
                    <td>$${(r.budget / 1000000).toFixed(1)}M</td>
                    <td>$${(r.revenue / 1000000).toFixed(1)}M</td>
                    <td style="color: ${r.roi_pct > 0 ? '#4f4' : (r.roi_pct < 0 ? '#f44' : '#888')}; font-weight: 700;">${r.roi_pct > 0 ? '+' : ''}${parseFloat(r.roi_pct).toFixed(0)}%</td>
                </tr>
            `).join('');
        }

        // Top Developers (Correlated Subquery)
        const topDevRes = await fetch(`${API_BASE}/top-developers`);
        window.intelligenceData['top-developers'] = await topDevRes.json();
        const topDevBody = document.querySelector('#top-dev-table tbody');
        if (topDevBody) {
            topDevBody.innerHTML = window.intelligenceData['top-developers'].slice(0, 10).map(d => `
                <tr>
                    <td>${d.name}</td>
                    <td>${d.country || 'N/A'}</td>
                    <td>${d.team_size || 'N/A'}</td>
                    <td>${d.is_independent ? 'YES' : 'NO'}</td>
                </tr>
            `).join('');
        }

        // Engine Analysis
        const engineRes = await fetch(`${API_BASE}/engines`);
        window.intelligenceData.engine = await engineRes.json();
        initChart('engineChart', 'doughnut', window.intelligenceData.engine.map(e => e.engine_name), window.intelligenceData.engine.map(e => e.game_count), 'Games per Engine');

        // Genre Performance
        const genreRes = await fetch(`${API_BASE}/genres`);
        window.intelligenceData.genre = await genreRes.json();
        initChart('genreChart', 'bar', window.intelligenceData.genre.map(g => g.genre), window.intelligenceData.genre.map(g => g.avg_revenue / 1000000), 'Avg Revenue (Millions USD)', true);

        // Publisher Impact
        const pubRes = await fetch(`${API_BASE}/publishers`);
        window.intelligenceData.publisher = await pubRes.json();
        initChart('publisherChart', 'bar', window.intelligenceData.publisher.slice(0, 8).map(p => p.publisher_name), window.intelligenceData.publisher.slice(0, 8).map(p => p.avg_score), 'Avg Critic Rating', false, true);

        // Platform Marketplace Comparison
        const platRes = await fetch(`${API_BASE}/platforms`);
        window.intelligenceData.platforms = await platRes.json();

        // === MARKET INSIGHTS (Computed from data) ===
        // Indie vs AAA ROI comparison
        const indieGames = window.intelligenceData.roi.filter(r => r.budget < 50000000);
        const aaaGames = window.intelligenceData.roi.filter(r => r.budget >= 100000000);
        const avgIndieROI = indieGames.length ? (indieGames.reduce((a,r) => a + parseFloat(r.roi_pct), 0) / indieGames.length).toFixed(0) : 0;
        const avgAaaROI = aaaGames.length ? (aaaGames.reduce((a,r) => a + parseFloat(r.roi_pct), 0) / aaaGames.length).toFixed(0) : 0;
        
        document.getElementById('insight-indie-roi').textContent = `+${avgIndieROI}%`;
        document.getElementById('insight-aaa-roi').textContent = `+${avgAaaROI}%`;
        
        // Best genre by score
        const topGenre = window.intelligenceData.genre.sort((a,b) => b.avg_score - a.avg_score)[0];
        document.getElementById('insight-top-genre').textContent = topGenre ? topGenre.genre : '--';
        document.getElementById('insight-top-genre-score').textContent = topGenre ? Math.round(topGenre.avg_score) + '/100' : '--';

        // Most games on which platform
        const platformCounts = {};
        window.intelligenceData.platforms.forEach(p => { platformCounts[p.platform_name] = (platformCounts[p.platform_name] || 0) + 1; });
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
        
        const populate = (id, list, valField, textField, isDatalist = false) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (isDatalist) {
                el.innerHTML = list.map(i => `<option value="${i[textField]}">`).join('');
            } else {
                el.innerHTML = '<option value="">Select...</option>' + 
                    list.map(i => `<option value="${i[valField]}">${i[textField]}</option>`).join('');
            }
        };

        populate('dev-list', data.developers, 'developer_id', 'name', true);
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
        const budget = game.dev_budget_usd || (result.budget_score > 0 ? (result.budget_score * 5000000) : 100000);
        const roi = budget > 0 ? (((revenue - budget) / budget) * 100).toFixed(1) : 0;
        
        const sign = roi > 0 ? '+' : '';
        document.getElementById('res-score').textContent = `${sign}${roi}%`;
        document.getElementById('res-score').style.color = roi > 0 ? '#4f4' : (roi < 0 ? '#f44' : '#888');

        // Technical Summary
        let summary = `Unit <strong>${game.title}</strong> is categorized under <strong>${result.tier}</strong> scale operations. `;
        
        if (result.tier === 'AAA') {
            summary += `This classification is driven by a massive labor force of ${game.team_size_at_launch || 100}+ developers and high capital expenditure. `;
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
        developer_name: document.getElementById('reg-dev').value,
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
            globalRefresh();
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

// Global Sync
async function globalRefresh() {
    loadDashboard();
    if (document.getElementById('intelligence').style.display !== 'none') loadIntelligence();
    if (document.getElementById('admin').style.display !== 'none') loadMetadata();
}

// Aliases for inline HTML handlers
window.loadGames = loadDashboard;

// Column sort for the games table
let sortState = { key: null, asc: true };
window.sortGames = function(key) {
    if (sortState.key === key) {
        sortState.asc = !sortState.asc;
    } else {
        sortState.key = key;
        sortState.asc = true;
    }
    const sorted = [...(window.currentGamesData || [])].sort((a, b) => {
        const av = a[key] ?? '';
        const bv = b[key] ?? '';
        if (av < bv) return sortState.asc ? -1 : 1;
        if (av > bv) return sortState.asc ? 1 : -1;
        return 0;
    });
    window.currentGamesData = sorted;
    const tbody = document.querySelector('#games-table tbody');
    tbody.innerHTML = sorted.map(g => `
        <tr onclick="showGameDetails(${g.game_id})" style="cursor: pointer;">
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
            <td><button class="btn-delete" onclick="event.stopPropagation(); deleteGame(${g.game_id}, '${g.title.replace(/'/g, "\\'")}')">DELETE</button></td>
        </tr>
    `).join('');
};

// Init
loadDashboard();

// Search Filter Logic (Main Dashboard)
document.getElementById('search-input')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#games-table tbody tr');
    
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
});

// Universal Table Search Helper
function setupTableSearch(inputId, tableBodySelector) {
    document.getElementById(inputId)?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.querySelectorAll(`${tableBodySelector} tr`);
        rows.forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
    });
}

setupTableSearch('roi-search-input', '#roi-table tbody');
setupTableSearch('top-dev-search-input', '#top-dev-table tbody');
setupTableSearch('modal-search-input', '#data-modal-body');

window.showGameDetails = function(gameId) {
    const game = window.currentGamesData?.find(g => g.game_id === gameId);
    if (!game) return;
    document.getElementById('modal-title').textContent = game.title;
    document.getElementById('modal-dev-pub').textContent = `${game.developer_name} / ${game.publisher_name}`;
    document.getElementById('modal-id').textContent = game.game_id;
    document.getElementById('modal-engine').textContent = game.engine_name || 'Unknown';
    document.getElementById('modal-year').textContent = game.release_date ? new Date(game.release_date).getFullYear() : 'N/A';
    document.getElementById('modal-meta').textContent = game.metacritic_score || 'N/A';
    document.getElementById('modal-copies').textContent = game.copies_sold_est ? (game.copies_sold_est / 1000000).toFixed(1) + 'M' : 'N/A';
    document.getElementById('modal-price').textContent = game.base_price_usd ? '$' + parseFloat(game.base_price_usd).toFixed(2) : 'Free';
    document.getElementById('modal-revenue').textContent = game.revenue_est_usd ? '$' + (game.revenue_est_usd / 1000000).toFixed(1) + 'M' : 'N/A';
    document.getElementById('modal-pub-tier').textContent = game.publisher_tier || 'N/A';
    document.getElementById('game-modal').style.display = 'flex';
};

window.openDataModal = function(title, type) {
    document.getElementById('data-modal-title').textContent = title;
    
    const searchInput = document.getElementById('modal-search-input');
    if (searchInput) searchInput.value = '';
    
    const thead = document.getElementById('data-modal-head');
    const tbody = document.getElementById('data-modal-body');
    const data = window.intelligenceData[type];
    
    if (!data || data.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td style="text-align: center; color: #888;">No data available</td></tr>';
        document.getElementById('data-modal').style.display = 'flex';
        return;
    }

    // Generate Headers dynamically based on the JSON keys returned from the API
    const keys = Object.keys(data[0]);
    thead.innerHTML = `<tr>${keys.map(k => `<th>${k.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}</tr>`;

    // Generate Body dynamically
    tbody.innerHTML = data.map(row => `
        <tr>${keys.map(k => {
            let val = row[k];
            if (val === null || val === undefined) return '<td style="color: #666;">N/A</td>';
            // Format currency if key suggests money
            if ((k.includes('revenue') || k.includes('price') || k.includes('budget')) && !isNaN(val)) {
                return `<td>$${parseFloat(val).toLocaleString()}</td>`;
            }
            // Format percentages if key suggests ratio/pct
            if (k.includes('pct') && !isNaN(val)) {
                return `<td>${parseFloat(val).toFixed(1)}%</td>`;
            }
            return `<td>${val}</td>`;
        }).join('')}</tr>
    `).join('');

    document.getElementById('data-modal').style.display = 'flex';
};
