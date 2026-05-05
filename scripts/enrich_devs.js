const pool = require('../src/db');

async function enrichDevelopers() {
    const countries = ['USA', 'Japan', 'Poland', 'UK', 'Canada', 'France', 'South Korea', 'Sweden', 'Germany'];
    
    try {
        const [devs] = await pool.query('SELECT developer_id, name FROM Developer');
        console.log(`Enriching ${devs.length} developers...`);

        for (const dev of devs) {
            const randomCountry = countries[Math.floor(Math.random() * countries.length)];
            const randomTeamSize = Math.floor(Math.random() * 450) + 10;
            const isIndie = Math.random() > 0.3 ? 1 : 0; // 70% indie, 30% major
            const foundedYear = Math.floor(Math.random() * (2020 - 1980 + 1)) + 1980;

            // Specific overrides for famous ones
            let country = randomCountry;
            let teamSize = randomTeamSize;
            let indie = isIndie;

            const name = dev.name.toLowerCase();
            if (name.includes('valve')) { country = 'USA'; teamSize = 360; indie = 0; }
            if (name.includes('cd projekt')) { country = 'Poland'; teamSize = 1100; indie = 0; }
            if (name.includes('rockstar')) { country = 'USA'; teamSize = 2000; indie = 0; }
            if (name.includes('fromsoftware')) { country = 'Japan'; teamSize = 350; indie = 0; }
            if (name.includes('ubisoft')) { country = 'France'; teamSize = 20000; indie = 0; }
            if (name.includes('capcom')) { country = 'Japan'; teamSize = 3000; indie = 0; }
            if (name.includes('larian')) { country = 'Belgium'; teamSize = 450; indie = 1; }

            await pool.query(
                'UPDATE Developer SET country = ?, team_size = ?, is_independent = ?, founded_year = ? WHERE developer_id = ?',
                [country, teamSize, indie, foundedYear, dev.developer_id]
            );
        }

        console.log('✅ Developer data enriched successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error enriching developers:', err);
        process.exit(1);
    }
}

enrichDevelopers();
