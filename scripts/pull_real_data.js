const db = require('../src/db');

// Known engine mappings for top Steam titles
const ENGINE_MAP = {
    'Counter-Strike': 'Source Engine',
    'Counter-Strike: Global Offensive': 'Source Engine',
    'Counter-Strike 2': 'Source Engine',
    'Counter-Strike: Source': 'Source Engine',
    'Counter-Strike: Condition Zero': 'Source Engine',
    'Half-Life': 'Source Engine',
    'Half-Life 2': 'Source Engine',
    'Half-Life 2: Lost Coast': 'Source Engine',
    'Half-Life 2: Deathmatch': 'Source Engine',
    'Team Fortress 2': 'Source Engine',
    'Dota 2': 'Source Engine',
    'Left 4 Dead 2': 'Source Engine',
    'Portal': 'Source Engine',
    'Portal 2': 'Source Engine',
    'Garry\'s Mod': 'Source Engine',
    'PUBG: BATTLEGROUNDS': 'Unreal Engine 4',
    'Unturned': 'Unity',
    'Rust': 'Unity',
    'Terraria': 'Other',
    'Warframe': 'Other',
    'Path of Exile': 'Other',
    'Elden Ring': 'Unreal Engine 4',
    'Cyberpunk 2077': 'REDengine',
    'The Witcher 3': 'REDengine',
    'Black Myth: Wukong': 'Unreal Engine 5',
    'Baldur\'s Gate 3': 'Divinity Engine',
    'Hades': 'Other',
    'Monster Hunter Wilds': 'RE Engine',
    'Monster Hunter: World': 'RE Engine',
    'Palworld': 'Unreal Engine 5',
    'New World: Aeternum': 'Unreal Engine 4',
    'Call of Duty': 'IW Engine',
    'Destiny 2': 'Other',
    'Apex Legends': 'Source Engine',
    'Rocket League': 'Unreal Engine 3',
    'Grand Theft Auto V': 'RAGE',
    'Red Dead Redemption 2': 'RAGE',
};

// Genre mappings based on SteamSpy tags
const GENRE_KEYWORDS = {
    'Action': ['action', 'shooter', 'fps', 'fighting', 'beat'],
    'RPG': ['rpg', 'role-playing', 'jrpg'],
    'Strategy': ['strategy', 'rts', 'turn-based', 'tower defense'],
    'Open World RPG': ['open world', 'sandbox'],
    'Soulslike': ['souls', 'soulslike', 'difficult'],
    'Indie Action': ['indie'],
};

// Title-based genre map for top Steam games
const TITLE_GENRE_MAP = {
    'counter-strike': 'Action', 'half-life': 'Action', 'team fortress': 'Action',
    'left 4 dead': 'Action', 'portal': 'Action', 'apex legends': 'Action',
    'pubg': 'Action', 'call of duty': 'Action', 'destiny': 'Action',
    'warframe': 'Action', 'payday': 'Action', 'hunt:': 'Action',
    'dota': 'Strategy', 'civilization': 'Strategy', 'total war': 'Strategy',
    'crusader kings': 'Strategy', 'hearts of iron': 'Strategy',
    'elden ring': 'Soulslike', 'dark souls': 'Soulslike',
    'witcher': 'Open World RPG', 'cyberpunk': 'Open World RPG',
    'baldur': 'RPG', 'divinity': 'RPG', 'pathfinder': 'RPG',
    'grand theft auto': 'Open World RPG', 'red dead': 'Open World RPG',
    'black myth': 'Action', 'monster hunter': 'Action',
    'terraria': 'Indie Action', 'stardew': 'Indie Action', 'hades': 'Indie Action',
    'rust': 'Indie Action', 'unturned': 'Indie Action',
    'rocket league': 'Action', 'fifa': 'Action', 'nba': 'Action',
    'new world': 'Open World RPG', 'lost ark': 'RPG', 'path of exile': 'RPG',
    'palworld': 'Open World RPG', 'valheim': 'Open World RPG',
    'warcraft': 'Strategy', 'starcraft': 'Strategy',
};

function guessGenre(game) {
    const title = game.name.toLowerCase();
    for (const [key, genre] of Object.entries(TITLE_GENRE_MAP)) {
        if (title.includes(key)) return genre;
    }
    // Fall back to tags if available
    const tags = Object.keys(game.tags || {}).map(t => t.toLowerCase());
    for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
        if (keywords.some(k => tags.some(t => t.includes(k)))) return genre;
    }
    return 'Action';
}

function guessEngine(title) {
    for (const [key, engine] of Object.entries(ENGINE_MAP)) {
        if (title.toLowerCase().includes(key.toLowerCase())) return engine;
    }
    return 'Unreal Engine 5'; // fallback
}

function estimateBudget(copies, currentPrice, releaseYear) {
    // Budget tiers based on scale — no real data available from SteamSpy
    if (copies >= 50000000) return { budget: 150000000, team: 500 };      // AAA mega
    if (copies >= 20000000) return { budget: 80000000,  team: 300 };      // AAA
    if (copies >= 5000000)  return { budget: 30000000,  team: 150 };      // AA
    if (copies >= 1000000)  return { budget: 8000000,   team: 50  };      // AA indie
    if (currentPrice === 0) return { budget: 20000000,  team: 100 };      // F2P mid
                            return { budget: 1500000,   team: 15  };      // Indie
}

async function getSteamReleaseDate(appid) {
    try {
        const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=release_date`);
        const json = await res.json();
        const releaseStr = json?.[appid]?.data?.release_date?.date;
        if (!releaseStr) return null;
        const parsed = new Date(releaseStr);
        if (isNaN(parsed.getTime())) return null;
        return parsed.toISOString().split('T')[0];
    } catch { return null; }
}

async function withConcurrency(items, limit, fn) {
    const results = [];
    let i = 0;
    async function worker() {
        while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx], idx); }
    }
    await Promise.all(Array.from({ length: limit }, worker));
    return results;
}

async function fetchRealData() {
    try {
        console.log("Fetching REAL data from SteamSpy API...");
        const response = await fetch('https://steamspy.com/api.php?request=top100forever');
        const data = await response.json();
        const games = Object.values(data);
        console.log(`Pulled ${games.length} games. Fetching release dates...`);

        const releaseDates = await withConcurrency(games, 10, async (game) => ({
            appid: game.appid, date: await getSteamReleaseDate(game.appid)
        }));
        const dateMap = Object.fromEntries(releaseDates.map(r => [r.appid, r.date]));
        console.log(`Got release dates for ${releaseDates.filter(r => r.date).length}/100 games.`);

        // --- Bulk upsert developers ---
        const devNames = [...new Set(games.map(g => g.developer || 'Unknown'))];
        await db.query(`INSERT IGNORE INTO Developer (name, is_independent) VALUES ${devNames.map(() => '(?, 1)').join(',')}`, devNames);
        const [devRows] = await db.query(`SELECT developer_id, name FROM Developer WHERE name IN (${devNames.map(() => '?').join(',')})`, devNames);
        const devMap = Object.fromEntries(devRows.map(r => [r.name, r.developer_id]));

        // --- Bulk upsert publishers ---
        const pubNames = [...new Set(games.map(g => g.publisher || 'Unknown'))];
        await db.query(`INSERT IGNORE INTO Publisher (name, tier) VALUES ${pubNames.map(() => "(?, 'MID')").join(',')}`, pubNames);
        const [pubRows] = await db.query(`SELECT publisher_id, name FROM Publisher WHERE name IN (${pubNames.map(() => '?').join(',')})`, pubNames);
        const pubMap = Object.fromEntries(pubRows.map(r => [r.name, r.publisher_id]));

        // --- Ensure all needed engines exist ---
        const engineNames = [...new Set(Object.values(ENGINE_MAP))];
        await db.query(`INSERT IGNORE INTO GameEngine (name, license_type, typical_scale) VALUES ${engineNames.map(() => "(?,'PROPRIETARY','ALL')").join(',')}`, engineNames);
        const [engRows] = await db.query(`SELECT engine_id, name FROM GameEngine`);
        const engMap = Object.fromEntries(engRows.map(r => [r.name, r.engine_id]));

        // --- Ensure genres exist ---
        const [genreRows] = await db.query(`SELECT genre_id, name FROM Genre`);
        const genreMap = Object.fromEntries(genreRows.map(r => [r.name, r.genre_id]));

        // --- Wipe old game data ---
        console.log("Cleaning old data...");
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('TRUNCATE TABLE GamePlatformListing');
        await db.query('TRUNCATE TABLE GameGenre');
        await db.query('TRUNCATE TABLE Game');
        await db.query('SET FOREIGN_KEY_CHECKS = 1');

        // --- Batch insert games ---
        console.log("Inserting all games...");
        const gameRows = [], gameValues = [];

        for (const game of games) {
            const currentPrice = game.initialprice / 100;
            const ownerParts = game.owners.split(' .. ');
            const copies = Math.floor((parseInt(ownerParts[0].replace(/,/g, '')) + parseInt(ownerParts[1].replace(/,/g, ''))) / 2);
            const releaseDate = dateMap[game.appid] || null;
            const releaseYear = releaseDate ? parseInt(releaseDate.slice(0, 4)) : 2015;

            let revenue;
            if (currentPrice === 0) {
                if (copies >= 100000000)     revenue = Math.floor(copies * 8);
                else if (copies >= 20000000) revenue = Math.floor(copies * 4);
                else                         revenue = Math.floor(copies * 1.5);
            } else if (currentPrice < 5 && releaseYear < 2010) {
                revenue = Math.floor(copies * 0.3 * 8);
            } else {
                revenue = Math.floor(copies * currentPrice * 0.8);
            }

            const { budget, team } = estimateBudget(copies, currentPrice, releaseYear);
            const totalReviews = game.positive + game.negative;
            const metacritic = totalReviews > 0 ? Math.min(100, Math.round((game.positive / totalReviews) * 100)) : null;
            const coverUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`;
            const engineName = guessEngine(game.name);
            const engineId = engMap[engineName] || engMap['Unreal Engine 5'];

            gameRows.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            gameValues.push(
                game.name, coverUrl, currentPrice.toFixed(2), revenue, copies, metacritic,
                devMap[game.developer || 'Unknown'], pubMap[game.publisher || 'Unknown'],
                engineId, releaseDate, budget, team
            );
        }

        await db.query(
            `INSERT IGNORE INTO Game (title, cover_image_url, base_price_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id, release_date, dev_budget_usd, team_size_at_launch) VALUES ${gameRows.join(',')}`,
            gameValues
        );

        // --- Assign genres to all games ---
        console.log("Assigning genres...");
        const [insertedGames] = await db.query(`SELECT game_id, title FROM Game`);
        const gameIdMap = Object.fromEntries(insertedGames.map(g => [g.title, g.game_id]));

        const genreInsertRows = [], genreInsertValues = [];
        for (const game of games) {
            const gameId = gameIdMap[game.name];
            const genreName = guessGenre(game);
            const genreId = genreMap[genreName] || genreMap['Action'];
            if (gameId && genreId) {
                genreInsertRows.push('(?, ?, 1)');
                genreInsertValues.push(gameId, genreId);
            }
        }
        if (genreInsertRows.length) {
            await db.query(`INSERT IGNORE INTO GameGenre (game_id, genre_id, is_primary) VALUES ${genreInsertRows.join(',')}`, genreInsertValues);
        }

        console.log(`✅ Done! 100 games with budgets, engines, genres, and release dates.`);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await db.end();
    }
}

fetchRealData();
