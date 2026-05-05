const fs = require('fs');
const db = require('./src/db');

// Some realistic-sounding prefixes and suffixes for game titles
const prefixes = ["Shadow of", "Return to", "Age of", "Chronicles of", "Legend of", "World of", "Rise of", "Fall of", "Beyond", "Escape from", "Battle for", "Call of", "Dawn of", "End of", "Ghosts of"];
const nouns = ["the Ancients", "Valor", "the Stars", "Eternity", "Blood", "the Lost", "the Void", "Ruins", "Empires", "Gods", "Darkness", "Light", "the Unknown", "Reckoning", "Justice"];
const prefixes_scifi = ["Neon", "Cyber", "Star", "Astro", "Quantum", "Galactic", "Nova", "Plasma", "Void", "Orbit"];
const suffixes_scifi = ["Protocol", "Command", "Frontier", "Sector", "Syndicate", "Drift", "Pulse", "Nexus", "Core"];

function generateTitle() {
    if (Math.random() > 0.5) {
        return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
    } else {
        return `${prefixes_scifi[Math.floor(Math.random() * prefixes_scifi.length)]} ${suffixes_scifi[Math.floor(Math.random() * suffixes_scifi.length)]}`;
    }
}

async function generateMassiveData() {
    try {
        console.log("Fetching existing metadata...");
        const [devs] = await db.query('SELECT developer_id FROM Developer');
        const [pubs] = await db.query('SELECT publisher_id FROM Publisher');
        const [engines] = await db.query('SELECT engine_id FROM GameEngine');

        if (!devs.length || !pubs.length || !engines.length) {
            console.error("Missing metadata. Please ensure basic developers and publishers exist.");
            return;
        }

        console.log(`Found ${devs.length} Devs, ${pubs.length} Pubs, ${engines.length} Engines.`);
        console.log("Generating 140 new games...");

        let inserted = 0;
        for (let i = 0; i < 140; i++) {
            // Generate random but realistic data
            const isIndie = Math.random() > 0.3; // 70% indie/AA
            
            const title = generateTitle() + (Math.random() > 0.7 ? ` ${Math.floor(Math.random() * 5) + 2}` : '');
            
            // Random dates between 2010 and 2024
            const start = new Date(2010, 0, 1).getTime();
            const end = new Date(2024, 11, 31).getTime();
            const date = new Date(start + Math.random() * (end - start)).toISOString().split('T')[0];

            const budget = isIndie ? Math.floor(Math.random() * 5000000) + 50000 : Math.floor(Math.random() * 200000000) + 20000000;
            
            // Revenue is between 10% to 500% of budget usually, sometimes extreme outliers
            const roiMult = Math.random() * 5; 
            const revenue = Math.floor(budget * roiMult) + (Math.random() > 0.9 ? budget * 10 : 0); // 10% chance of super hit
            
            const score = Math.floor(Math.random() * 40) + 60; // 60 to 99
            
            const devId = devs[Math.floor(Math.random() * devs.length)].developer_id;
            const pubId = pubs[Math.floor(Math.random() * pubs.length)].publisher_id;
            const engineId = engines[Math.floor(Math.random() * engines.length)].engine_id;

            // Pick a random default image
            const images = [
                'https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/header.jpg',
                'https://cdn.cloudflare.steamstatic.com/steam/apps/753640/header.jpg',
                'https://cdn.cloudflare.steamstatic.com/steam/apps/304430/header.jpg',
                'https://cdn.cloudflare.steamstatic.com/steam/apps/219740/header.jpg',
                'https://cdn.cloudflare.steamstatic.com/steam/apps/1172470/header.jpg',
                'https://cdn.cloudflare.steamstatic.com/steam/apps/489830/header.jpg',
                'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg'
            ];
            const image = images[Math.floor(Math.random() * images.length)];

            try {
                await db.query(
                    `INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, metacritic_score, developer_id, publisher_id, engine_id)
                     VALUES (?, ?, ?, 'T', ?, ?, ?, ?, ?, ?, ?)`,
                    [title, image, date, isIndie ? 19.99 : 59.99, budget, revenue, score, devId, pubId, engineId]
                );
                inserted++;
            } catch (err) {
                // Ignore duplicates
            }
        }

        console.log(`✅ Successfully generated and inserted ${inserted} new games!`);
    } catch (error) {
        console.error("Error generating data:", error);
    } finally {
        await db.end();
    }
}

generateMassiveData();
