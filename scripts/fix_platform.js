const db = require('../src/db');
async function run() {
    await db.query("INSERT IGNORE INTO Platform (platform_id, name, platform_type) VALUES (1, 'Steam', 'PC_STOREFRONT')");
    await db.query("INSERT IGNORE INTO GamePlatformListing (game_id, platform_id, price_usd) SELECT game_id, 1, base_price_usd FROM Game");
    console.log('Platforms added');
    await db.end();
}
run();
