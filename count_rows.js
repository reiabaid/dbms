const pool = require('./src/db');

async function getStats() {
    try {
        const tables = [
            'Developer', 'Publisher', 'GameEngine', 'Platform', 
            'Genre', 'Game', 'GameGenre', 'GamePlatformListing', 'DLC'
        ];
        
        console.log('--- DATABASE STATUS REPORT ---');
        let totalRows = 0;
        
        for (const table of tables) {
            const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
            const count = rows[0].count;
            console.log(`${table.padEnd(20)}: ${count} rows`);
            totalRows += count;
        }
        
        console.log('------------------------------');
        console.log(`TOTAL ENTRIES       : ${totalRows}`);
        
        await pool.end();
    } catch (err) {
        console.error('Error fetching stats:', err);
    }
}

getStats();
