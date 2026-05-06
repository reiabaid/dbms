const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---

// 1. Intelligence Views
app.get('/api/games', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM GameIntelligenceSummary');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/genres', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM GenrePerformance');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/publishers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM PublisherImpact');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/engines', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM EngineIntelligence');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/platforms', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM PlatformPricing');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Stored Procedures
app.get('/api/classify/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('CALL ClassifyGameTier(?)', [req.params.id]);
        res.json(rows[0][0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/register', async (req, res) => {
    const { title, developer_name, publisher_id, genre_id, platform_id, price } = req.body;
    try {
        const [rows] = await pool.query('CALL RegisterGameComplete(?, ?, ?, ?, ?, ?)', 
            [title, developer_name, publisher_id, genre_id, platform_id, price]);
        res.json(rows[0][0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Metadata for Forms
app.get('/api/metadata', async (req, res) => {
    try {
        const [developers] = await pool.query('SELECT developer_id, name FROM Developer ORDER BY name');
        const [publishers] = await pool.query('SELECT publisher_id, name FROM Publisher ORDER BY name');
        const [genres] = await pool.query('SELECT genre_id, name FROM Genre ORDER BY name');
        const [platforms] = await pool.query('SELECT platform_id, name FROM Platform ORDER BY name');
        res.json({ developers, publishers, genres, platforms });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. RUBRIC: Subquery View - Games above average score
app.get('/api/above-average', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM AboveAverageGames');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. RUBRIC: CalculateROI Scalar Function via View
app.get('/api/roi', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM GameROI');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. RUBRIC: Correlated Subquery - Top Developers
app.get('/api/top-developers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM TopDevelopers');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. RUBRIC: DELETE Operation (DML)
app.delete('/api/games/:id', async (req, res) => {
    try {
        // Must delete from child tables first (referential integrity)
        await pool.query('DELETE FROM GameGenre WHERE game_id = ?', [req.params.id]);
        await pool.query('DELETE FROM GamePlatformListing WHERE game_id = ?', [req.params.id]);
        await pool.query('DELETE FROM DLC WHERE game_id = ?', [req.params.id]);
        await pool.query('DELETE FROM Game WHERE game_id = ?', [req.params.id]);
        res.json({ status: 'DELETED', game_id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. RUBRIC: HAVING clause - Developer Benchmark (Stored Procedure)
app.get('/api/developer-benchmark/:name', async (req, res) => {
    try {
        const [rows] = await pool.query('CALL GetDeveloperBenchmark(?)', [req.params.name]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Game Intelligence Server running at http://localhost:${PORT}`);
});
