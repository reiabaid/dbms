const fs = require('fs');
const db = require('./src/db');

async function fetchRealData() {
    try {
        console.log("Fetching REAL data from SteamSpy API...");
        const response = await fetch('https://steamspy.com/api.php?request=top100forever');
        const data = await response.json();
        
        const games = Object.values(data);
        console.log(`Successfully pulled ${games.length} real games from Steam.`);
        console.log("Cleaning old fake data...");
        
        // Wipe all fake games
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('TRUNCATE TABLE GamePlatformListing');
        await db.query('TRUNCATE TABLE GameGenre');
        await db.query('TRUNCATE TABLE Game');
        
        console.log("Inserting REAL games into database...");
        let inserted = 0;
        
        for (const game of games) {
            // 1. Ensure Developer exists
            const devName = game.developer || 'Unknown';
            let [devRows] = await db.query('SELECT developer_id FROM Developer WHERE name = ?', [devName]);
            let devId;
            if (devRows.length === 0) {
                const [devRes] = await db.query('INSERT INTO Developer (name, is_independent) VALUES (?, 1)', [devName]);
                devId = devRes.insertId;
            } else {
                devId = devRows[0].developer_id;
            }

            // 2. Ensure Publisher exists
            const pubName = game.publisher || 'Unknown';
            let [pubRows] = await db.query('SELECT publisher_id FROM Publisher WHERE name = ?', [pubName]);
            let pubId;
            if (pubRows.length === 0) {
                const [pubRes] = await db.query('INSERT INTO Publisher (name, tier) VALUES (?, ?)', [pubName, 'MID']);
                pubId = pubRes.insertId;
            } else {
                pubId = pubRows[0].publisher_id;
            }

            // 3. Insert Game
            const title = game.name;
            const price = (game.initialprice / 100).toFixed(2);
            // SteamSpy gives owners as "50,000,000 .. 100,000,000", take the lower bound
            const copies = parseInt(game.owners.split(' .. ')[0].replace(/,/g, ''));
            const revenue = copies * price;
            
            // SteamSpy gives positive/negative review counts. We can calculate percentage
            const totalReviews = game.positive + game.negative;
            const reviewPct = totalReviews > 0 ? (game.positive / totalReviews) * 100 : 0;
            const metacritic = Math.round(reviewPct); // Approximation for critic score since SteamSpy doesn't provide it
            
            const coverUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`;

            // Default engine to Unity for now just to satisfy FK, we can't easily scrape engine per game via SteamSpy
            let [engineRows] = await db.query('SELECT engine_id FROM GameEngine WHERE name = ? LIMIT 1', ['Unreal Engine 5']);
            const engineId = engineRows[0] ? engineRows[0].engine_id : 1;

            try {
                await db.query(
                    `INSERT INTO Game (title, cover_image_url, base_price_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [title, coverUrl, price, revenue, copies, metacritic, devId, pubId, engineId]
                );
                inserted++;
            } catch(e) {
                console.log("Skipped dup:", title);
            }
        }
        
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log(`✅ Fully populated database with ${inserted} REAL games from Steam!`);
        
    } catch (error) {
        console.error("Error pulling real data:", error);
    } finally {
        await db.end();
    }
}

fetchRealData();
