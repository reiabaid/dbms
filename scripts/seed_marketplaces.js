const db = require('../src/db');

async function seedMarketplaces() {
    try {
        console.log("Populating Cross-Marketplace Data (Epic, Steam, Consoles)...");

        // Get all games
        const [games] = await db.query('SELECT game_id, base_price_usd FROM Game');
        
        // Ensure Platforms exist
        const platforms = ['Steam', 'Epic Games Store', 'PlayStation 5', 'Xbox Series X/S', 'Nintendo Switch'];
        const platformIds = {};
        
        for (const pName of platforms) {
            let [rows] = await db.query('SELECT platform_id FROM Platform WHERE name = ?', [pName]);
            if (rows.length === 0) {
                const [res] = await db.query('INSERT INTO Platform (name, manufacturer) VALUES (?, ?)', [pName, 'Various']);
                platformIds[pName] = res.insertId;
            } else {
                platformIds[pName] = rows[0].platform_id;
            }
        }

        // Clean existing listings
        await db.query('TRUNCATE TABLE GamePlatformListing');

        let insertCount = 0;

        // Assign games to marketplaces
        for (const game of games) {
            const price = parseFloat(game.base_price_usd);
            
            // Everyone is on Steam (base price)
            await db.query('INSERT INTO GamePlatformListing (game_id, platform_id, price_usd, is_exclusive, subscription_included) VALUES (?, ?, ?, 0, 0)', 
                [game.game_id, platformIds['Steam'], price]);
            insertCount++;

            // 40% chance of being on Epic Games Store (sometimes slightly cheaper to compete)
            if (Math.random() > 0.6) {
                const epicPrice = price > 0 ? (price * 0.9).toFixed(2) : 0; // 10% discount on Epic
                await db.query('INSERT INTO GamePlatformListing (game_id, platform_id, price_usd, is_exclusive, subscription_included) VALUES (?, ?, ?, 0, 0)', 
                    [game.game_id, platformIds['Epic Games Store'], epicPrice]);
                insertCount++;
            }

            // 50% chance of being on Xbox
            if (Math.random() > 0.5) {
                const onGamePass = Math.random() > 0.7; // 30% chance it's on Game Pass
                await db.query('INSERT INTO GamePlatformListing (game_id, platform_id, price_usd, is_exclusive, subscription_included) VALUES (?, ?, ?, 0, ?)', 
                    [game.game_id, platformIds['Xbox Series X/S'], price, onGamePass ? 1 : 0]);
                insertCount++;
            }

            // 50% chance of being on PS5
            if (Math.random() > 0.5) {
                const onPsPlus = Math.random() > 0.8; // 20% chance on PS Plus
                await db.query('INSERT INTO GamePlatformListing (game_id, platform_id, price_usd, is_exclusive, subscription_included) VALUES (?, ?, ?, 0, ?)', 
                    [game.game_id, platformIds['PlayStation 5'], price, onPsPlus ? 1 : 0]);
                insertCount++;
            }
            
            // 20% chance of being on Switch (often slightly more expensive due to "Switch Tax")
            if (Math.random() > 0.8) {
                const switchPrice = price > 0 ? (price + 10).toFixed(2) : 0; 
                await db.query('INSERT INTO GamePlatformListing (game_id, platform_id, price_usd, is_exclusive, subscription_included) VALUES (?, ?, ?, 0, 0)', 
                    [game.game_id, platformIds['Nintendo Switch'], switchPrice]);
                insertCount++;
            }
        }

        console.log(`✅ Successfully mapped ${games.length} games across ${insertCount} different marketplace listings!`);
    } catch (error) {
        console.error("Error populating marketplaces:", error);
    } finally {
        await db.end();
    }
}

seedMarketplaces();
