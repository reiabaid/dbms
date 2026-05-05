# Obsyria Game Intelligence System — Code Explained

This document walks through every layer of the project from the ground up.
Each phase builds on the previous one. Read them in order for the clearest mental model.

---

## Phase 1 — Database Design (DDL — Data Definition Language)

### What is DDL?

DDL is the set of SQL statements that *define the structure* of your database.
No actual data is inserted here — you are just laying out the blueprint.
The commands used are `CREATE DATABASE`, `CREATE TABLE`, `ALTER TABLE`.

### How the database is created

```sql
CREATE DATABASE IF NOT EXISTS obsyria;
USE obsyria;
```

`IF NOT EXISTS` makes the script safe to re-run. Without it, running the script a second time would throw an error saying the database already exists.
`USE obsyria` tells MySQL "all following statements apply to this database."

### The 9 tables and why they are split this way

The schema follows normalization principles — specifically 3NF (Third Normal Form).
The idea is: every piece of information lives in exactly one place, and tables are linked by IDs rather than repeating raw values.

**Developer** — who made the game
Columns like `country`, `team_size`, `is_independent`, `parent_company` let you track indie studios vs subsidiaries of large corporations.
`is_independent BOOLEAN DEFAULT TRUE` means unless told otherwise, a developer is assumed to be independent.

**Publisher** — who funded and distributed it
The `tier ENUM('MAJOR', 'MID', 'INDIE_LABEL', 'SELF_PUBLISHED')` is an ENUM, which means MySQL will only accept one of those exact string values. This prevents data like "major", "Major ", or "big publisher" from sneaking in.

**GameEngine** — the technology the game was built with
`license_type ENUM('FREE', 'ROYALTY', 'SUBSCRIPTION', 'PROPRIETARY')` captures Unreal (ROYALTY), Unity (SUBSCRIPTION), Godot (FREE), and custom engines (PROPRIETARY).
`is_open_source BOOLEAN DEFAULT FALSE` defaults to closed source, which is more common.

**Platform** — where the game is sold or played
`platform_type ENUM('PC_STOREFRONT', 'CONSOLE', 'HANDHELD', 'CLOUD')` distinguishes Steam (PC_STOREFRONT) from PlayStation (CONSOLE) from Xbox Cloud (CLOUD).

**Genre** — the most interesting table structurally
```sql
parent_genre_id INT NULL,
FOREIGN KEY (parent_genre_id) REFERENCES Genre(genre_id)
```
This is a *self-referential foreign key* — a genre can point to another genre as its parent.
This lets you model: "Action-RPG" has parent "RPG", which has parent "Role-Playing".
It's a recursive/hierarchical structure within a single table. NULL means it is a top-level genre.

**Game** — the central table everything connects to
This is the largest table, 25+ columns, because a game ties together developer, publisher, engine, budget, revenue, review scores, pricing model, and more.
Key decisions:
- `dev_budget_usd BIGINT` — BIGINT because AAA budgets are in hundreds of millions (too large for INT)
- `base_price_usd DECIMAL(6,2)` — DECIMAL for money because it is exact (floats like 59.999 round weirdly)
- `metacritic_score INT CHECK (metacritic_score BETWEEN 0 AND 100)` — the CHECK constraint is a database-level guard, but the trigger also validates this (explained in Phase 3)
- `esrb_rating ENUM('E', 'E10+', 'T', 'M', 'AO', 'UNRATED')` — restricts to valid ESRB values only

**GameGenre** — a junction/bridge table
```sql
PRIMARY KEY (game_id, genre_id)
```
A game can belong to many genres, and a genre can have many games. This is a many-to-many relationship.
You cannot put genres directly in the Game table because you don't know how many genres a game will have.
The composite primary key (game_id + genre_id together) ensures no duplicate genre assignments per game.
`is_primary BOOLEAN` lets the app know which genre is the main one for display and analytics.

**GamePlatformListing** — one row per game-platform combination
`UNIQUE KEY (game_id, platform_id)` prevents the same game from being listed on the same platform twice.
`is_exclusive` captures console exclusivity deals. `subscription_included` tracks Game Pass / PS Plus inclusion.

**DLC** — downloadable content linked to a game
Simple: one game can have many DLC entries. `dlc_type ENUM` categorizes them — story content, cosmetic skins, season passes, etc.

### Alternative design approaches

Instead of ENUMs, you could use separate lookup tables (e.g., a `PublisherTier` table with id and name).
ENUMs are simpler and faster for a fixed small set of values, but they are harder to extend — adding a new tier requires an ALTER TABLE, not just an INSERT.
For a production system with evolving categories, separate lookup tables are usually preferred.

For the self-referential Genre tree, an alternative is a "closure table" pattern which stores all ancestor-descendant pairs explicitly — it makes querying all ancestors of a genre very fast, but adds complexity.

---

## Phase 2 — Indexing

### What is an index?

An index is a separate data structure (usually a B-Tree) that MySQL maintains alongside your table.
Without an index, finding all games with title "Elden Ring" means reading every single row — a full table scan.
With an index on `title`, MySQL jumps directly to the matching rows.

### Why the three indexes were chosen

```sql
CREATE INDEX idx_game_title ON Game(title);
CREATE INDEX idx_release_date ON Game(release_date);
CREATE INDEX idx_metacritic ON Game(metacritic_score);
```

These three columns are the ones most likely to appear in WHERE clauses and ORDER BY clauses.
- Users search for games by title
- Sorting by release date for timeline views
- Filtering/sorting by metacritic score for quality analysis

### The procedure to safely drop indexes before creating

```sql
CREATE PROCEDURE drop_index_if_exists(IN tbl VARCHAR(64), IN idx VARCHAR(64))
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.statistics ...) THEN
        SET @sql = CONCAT('ALTER TABLE `', tbl, '` DROP INDEX `', idx, '`');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END;
```

This procedure uses *dynamic SQL* — it builds a SQL string at runtime using CONCAT, then PREPAREs and EXECUTEs it.
You need this because you cannot use variables directly in ALTER TABLE statements.
DEALLOCATE PREPARE frees the prepared statement from memory.
The procedure checks `information_schema.statistics` (MySQL's internal catalog of indexes) to see if the index exists before trying to drop it.
After creating the indexes, the procedure itself is dropped — it was a one-time utility.

### What PREPARE / EXECUTE means

PREPARE stmt FROM @sql — parses and compiles the SQL string stored in @sql into a prepared statement named `stmt`.
EXECUTE stmt — runs that compiled statement.
This is the only way to run DDL statements (like ALTER TABLE) with variable table/index names in MySQL stored programs.

### Alternative

MySQL 8.0 supports `CREATE INDEX IF NOT EXISTS` but MySQL 5.x does not.
This procedure is the compatibility-safe workaround for both versions.
You could also just run `DROP INDEX IF EXISTS` on MySQL 8, but this procedure pattern works universally.

---

## Phase 3 — Triggers

### What is a trigger?

A trigger is SQL code that runs automatically when a specific event happens on a table.
Events are: BEFORE INSERT, AFTER INSERT, BEFORE UPDATE, AFTER UPDATE, BEFORE DELETE, AFTER DELETE.
You use `NEW.column` to refer to the incoming row being inserted/updated.

### Trigger 1 — before_game_insert

```sql
CREATE TRIGGER before_game_insert
BEFORE INSERT ON Game
FOR EACH ROW
BEGIN
    IF NEW.base_price_usd = 0 THEN
        SET NEW.is_free_to_play = TRUE;
    END IF;
END;
```

What: If a game is being inserted with price 0, it auto-sets `is_free_to_play = TRUE`.
Why: Prevents inconsistent data where price is 0 but `is_free_to_play` is left as FALSE.
How: `BEFORE INSERT` fires before the row is written, so you can modify `NEW.*` values and they will be what actually gets stored.

### Trigger 2 — validate_metacritic

```sql
CREATE TRIGGER validate_metacritic
BEFORE INSERT ON Game
FOR EACH ROW
BEGIN
    IF NEW.metacritic_score < 0 OR NEW.metacritic_score > 100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Metacritic score must be between 0 and 100';
    END IF;
END;
```

What: Blocks any insert where the metacritic score is outside 0-100.
Why: The column has a CHECK constraint too, but older MySQL versions (pre-8.0.16) did not enforce CHECK constraints. The trigger is the reliable fallback.
How: `SIGNAL SQLSTATE '45000'` is how you raise a custom error in MySQL. SQLSTATE '45000' is the standard code for "unhandled user-defined exception." The transaction is rolled back automatically.

### Trigger 3 — prevent_negative_price

```sql
CREATE TRIGGER prevent_negative_price
BEFORE INSERT ON GamePlatformListing
```

Same pattern — raises an error if `price_usd < 0` on platform listings.
Why: You cannot set a platform price as -5.00 — that is not a real price.

### Trigger 4 — auto_subscription_flag

```sql
CREATE TRIGGER auto_subscription_flag
AFTER INSERT ON GamePlatformListing
FOR EACH ROW
BEGIN
    IF NEW.subscription_included = TRUE THEN
        UPDATE Game SET on_subscription_day1 = TRUE WHERE game_id = NEW.game_id;
    END IF;
END;
```

What: When a platform listing is inserted with `subscription_included = TRUE`, it automatically updates the parent Game record to set `on_subscription_day1 = TRUE`.
Why: The Game table has a field tracking whether the game was on a subscription service from day one. Rather than requiring the application to do a second UPDATE, the trigger handles it automatically.
How: This is AFTER INSERT (not BEFORE) because you do not need to modify the incoming row — you are updating a *different* table.

### Why triggers vs application-level validation

Triggers enforce rules at the database level, regardless of which application or script inserts data.
If someone runs raw SQL directly in a MySQL client, triggers still fire.
Application-level checks alone can be bypassed if multiple apps write to the same database.
The downside: triggers are invisible to application developers who do not read the schema, which can make debugging confusing.

---

## Phase 4 — Views

### What is a view?

A view is a saved SELECT query stored under a name.
When you query a view, MySQL runs the underlying SELECT in real time.
It does not store data itself — it is a virtual table.
`CREATE OR REPLACE VIEW` means: create it fresh if it doesn't exist, or silently replace it if it does.

### GameIntelligenceSummary — the main data view

```sql
CREATE OR REPLACE VIEW GameIntelligenceSummary AS
SELECT g.game_id, g.title, g.release_date, ...
    d.name AS developer_name, d.team_size,
    p.name AS publisher_name, p.tier AS publisher_tier,
    e.name AS engine_name, e.typical_scale AS engine_scale
FROM Game g
JOIN Developer d ON g.developer_id = d.developer_id
JOIN Publisher p ON g.publisher_id = p.publisher_id
LEFT JOIN GameEngine e ON g.engine_id = e.engine_id;
```

Why JOIN vs LEFT JOIN here: Developer and Publisher are required (NOT NULL foreign keys in Game), so INNER JOIN is correct — every game has both. Engine is optional (`engine_id` can be NULL), so LEFT JOIN is used to still return the game row even when no engine is linked.

The server queries this view simply as `SELECT * FROM GameIntelligenceSummary`.
All the joining complexity is hidden inside the view, keeping server code clean.

### GenrePerformance — aggregation view

```sql
GROUP BY gn.name
```

Uses COUNT, AVG across games per genre. `WHERE gg.is_primary = TRUE` means only the main genre of each game counts toward genre stats, preventing games with multiple genres from skewing averages.

### AboveAverageGames — subquery view

```sql
WHERE g.metacritic_score > (
    SELECT AVG(metacritic_score) FROM Game WHERE metacritic_score IS NOT NULL
)
```

This uses a *scalar subquery* inside a WHERE clause.
The inner SELECT runs first and returns a single number (the average score across all games).
The outer WHERE then filters games above that number.
Why `WHERE metacritic_score IS NOT NULL` in the inner query: NULL values are excluded from AVG automatically in SQL, but being explicit is clearer and prevents the subquery from returning NULL if all scores are missing.

### TopDevelopers — correlated subquery view

```sql
WHERE d.developer_id IN (
    SELECT g.developer_id
    FROM Game g
    WHERE g.revenue_est_usd > (
        SELECT AVG(revenue_est_usd) FROM Game WHERE revenue_est_usd IS NOT NULL
    )
)
```

This is a two-level nested subquery.
The innermost SELECT computes average revenue.
The middle SELECT finds all developer IDs whose games beat that average.
The outer WHERE filters Developer rows to only those developer IDs.
This is the difference between a simple subquery and a correlated one — the IN list is computed from the Game table which depends on the Developer context of the outer query.

### Alternative to views

You could skip views entirely and write the full JOIN query in every API endpoint.
That creates duplication — if you need to change how developer_name is joined, you'd fix it in 10 places instead of one view.
For read-heavy reporting, *materialized views* (which actually store the result) are an alternative, but MySQL does not support them natively. PostgreSQL does. In MySQL you'd emulate them with a physical table + event scheduler.

---

## Phase 5 — Scalar Function and GameROI View

### What is a scalar function?

A scalar function takes input parameters and returns a single value (not a result set).
It can be called inside a SELECT like any built-in function (AVG, COUNT, etc.).

### CalculateROI

```sql
CREATE FUNCTION CalculateROI(p_revenue BIGINT, p_budget BIGINT) 
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE v_roi DECIMAL(10,2);
    IF p_budget IS NULL OR p_budget = 0 THEN
        RETURN 0.00;
    END IF;
    SET v_roi = ((p_revenue - p_budget) / p_budget) * 100;
    RETURN v_roi;
END;
```

What: Takes revenue and budget, returns ROI as a percentage.
Formula: `((revenue - budget) / budget) * 100`
Why `DETERMINISTIC`: This keyword tells MySQL the function always returns the same output for the same inputs. MySQL uses this for query optimization and binary logging. If your function reads from a table (non-deterministic), you would not mark it DETERMINISTIC.
Why the NULL/zero guard: Division by zero in MySQL returns NULL (not an error), but a NULL ROI is confusing in the UI. Returning 0.00 explicitly makes the output always clean.

### GameROI view using the function

```sql
CalculateROI(g.revenue_est_usd, g.dev_budget_usd) AS roi_pct
```

The function is called once per row in the SELECT, same as any built-in function.
This is why combining a scalar function with a view is powerful — the ROI logic is defined once in the function, and the view assembles the full data context around it.

### Alternative

You could compute ROI inline in every query:
```sql
((revenue - budget) / budget) * 100 AS roi_pct
```
That works but duplicates the formula everywhere. If the ROI definition ever changes, you'd update every query. The function centralizes that logic.

---

## Phase 6 — Stored Procedures

### What is a stored procedure?

A stored procedure is a named block of SQL + procedural logic stored in the database.
Unlike a function, it can return multiple result sets, execute DML (INSERT/UPDATE/DELETE), and manage transactions.
You call it with `CALL procedureName(args)`.

### ClassifyGameTier — scoring engine

```sql
CREATE PROCEDURE ClassifyGameTier(IN p_game_id INT)
```

This is the most complex procedure. It:
1. Fetches the game's budget, team size, revenue, and publisher tier into local variables using SELECT INTO
2. Scores each dimension (budget, team, publisher, revenue) with IF/ELSEIF chains
3. Adds the scores to get a total
4. Maps the total to a tier: AAA (70+), AA (40+), INDIE (15+), HOBBYIST (below)
5. Returns the result as a SELECT (not a RETURN — procedures return via SELECT, functions via RETURN)

Why score-based: This avoids hard binary rules. A game with a $90M budget but only 5 people (improbable but possible) would score lower than you'd expect for budget alone. The scoring weights each factor.

The SELECT INTO pattern:
```sql
SELECT dev_budget_usd, team_size_at_launch, revenue_est_usd, p.tier 
INTO v_budget, v_team, v_revenue, v_tier
FROM Game g
JOIN Publisher p ON g.publisher_id = p.publisher_id
WHERE g.game_id = p_game_id;
```
This fetches exactly one row from a JOIN and stores the columns directly into declared variables. It only works when the query returns exactly one row.

### RegisterGameComplete — transaction procedure

```sql
DECLARE EXIT HANDLER FOR SQLEXCEPTION 
BEGIN
    ROLLBACK;
    RESIGNAL;
END;

START TRANSACTION;
...
COMMIT;
```

What: Inserts a game, its genre link, and its platform listing as a single atomic operation.
Why transactions: If the genre INSERT succeeds but the platform INSERT fails, you don't want a half-registered game in the database. ROLLBACK undoes everything done since START TRANSACTION.
EXIT HANDLER: When any SQL exception fires, this handler runs automatically — it rolls back and re-raises the exception (RESIGNAL) so the caller can also see it.
LAST_INSERT_ID(): After any INSERT with AUTO_INCREMENT, this returns the ID that was just assigned. Used to get the new game_id to insert into GameGenre and GamePlatformListing.

Developer lookup/create pattern:
```sql
SELECT developer_id INTO v_dev_id FROM Developer WHERE name = p_developer_name LIMIT 1;
IF v_dev_id IS NULL THEN
    INSERT INTO Developer (name) VALUES (p_developer_name);
    SET v_dev_id = LAST_INSERT_ID();
END IF;
```
This implements "find or create" — if the developer exists, use their ID; if not, create them and use the new ID. This happens inside the same transaction so it's atomic.

### GetDeveloperBenchmark — HAVING clause procedure

```sql
HAVING AVG(g.dev_budget_usd) BETWEEN v_avg_budget * 0.5 AND v_avg_budget * 2
```

HAVING is like WHERE but it filters *after* GROUP BY aggregation.
WHERE cannot reference AVG() because it runs before groups are formed.
HAVING runs after groups are formed, so you can filter on aggregate values.

This procedure: finds the target developer's average budget, then returns all developers whose average budget is within 50%-200% of that — essentially "similar-scale studios."

### GetGenreOpportunity — proportional range filtering

```sql
WHERE g.dev_budget_usd BETWEEN p_budget * 0.1 AND p_budget * 10
  AND g.team_size_at_launch BETWEEN p_team_size * 0.2 AND p_team_size * 5
```

Given your budget and team size, this finds genres where comparable games (within an order of magnitude of your resources) have been made. The wider range (0.1 to 10x budget) is intentional — you want context from both smaller and much larger productions in the same genre.

---

## Phase 7 — Database Connection (src/db.js)

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  ssl: { rejectUnauthorized: false }
});
```

### Why a pool and not a single connection

A connection pool maintains multiple open connections to MySQL simultaneously.
When a request comes in, it borrows a connection from the pool, runs the query, and returns the connection.
Without a pool, every API request would open a new connection (slow TCP + auth handshake) and close it when done.
`connectionLimit: 10` means at most 10 simultaneous MySQL connections.
`waitForConnections: true` means new requests wait in queue if all 10 are busy, rather than throwing an error.
`queueLimit: 0` means no limit on the wait queue size.

### Why dotenv

Credentials (host, user, password) are loaded from a `.env` file, not hardcoded.
This keeps secrets out of source code. If you commit to GitHub, `.env` is in `.gitignore` and never exposed.

### multipleStatements: true

This allows the execute_setup.js script to send the entire setup_db.sql file as one string with multiple SQL statements separated by semicolons. Without this, mysql2 would reject multiple statements in one query call for security reasons (prevents certain SQL injection attacks). It's enabled here only for the setup script context.

### ssl: { rejectUnauthorized: false }

This tells the MySQL client to use SSL encryption for the connection, but to skip certificate verification.
This is appropriate when connecting to a hosted MySQL service (like PlanetScale or Railway) that uses self-signed or custom certificates.
In a strict production environment, you would provide the actual CA certificate instead.

### Alternative: single connection vs pool

For scripts that run once (like execute_setup.js), a single connection is fine.
For a web server handling concurrent requests, a pool is essential.
The setup script uses the pool module but calls `db.end()` at the end to close all connections when it finishes.

---

## Phase 8 — Server / API Layer (server.js)

### Framework: Express.js

Express is a minimal Node.js web framework. It handles:
- Routing: matching URL paths to handler functions
- Middleware: functions that process every request (cors, json parsing, static files)

### Middleware stack

```javascript
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
```

cors() — adds Cross-Origin Resource Sharing headers, allowing the browser frontend to call the API even if they are on different ports during development.
express.json() — automatically parses request bodies that have `Content-Type: application/json` into `req.body` as a JavaScript object.
express.static() — serves everything in the `public/` folder as static files. When you visit `http://localhost:3000`, it sends `public/index.html` automatically.

### The async/await + pool.query pattern

```javascript
app.get('/api/games', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM GameIntelligenceSummary');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

`pool.query()` returns a Promise. Awaiting it pauses this function until MySQL responds.
The result is an array: `[rows, fields]`. We only need the data, so we destructure out `rows` with `const [rows]`.
`res.json(rows)` serializes the array of row objects to JSON and sends it as the HTTP response.
The try/catch means any MySQL error is caught and returned as a 500 response with the error message, rather than crashing the server.

### Calling stored procedures

```javascript
const [rows] = await pool.query('CALL ClassifyGameTier(?)', [req.params.id]);
res.json(rows[0][0]);
```

The `?` placeholder is a parameterized query — mysql2 safely escapes `req.params.id` before embedding it in the SQL. This prevents SQL injection.
When MySQL executes a CALL, it returns `rows` as an array of result sets. For a procedure that does one SELECT, `rows[0]` is that result set, and `rows[0][0]` is the first (and only) row.

### The DELETE endpoint — referential integrity

```javascript
app.delete('/api/games/:id', async (req, res) => {
    await pool.query('DELETE FROM GameGenre WHERE game_id = ?', [req.params.id]);
    await pool.query('DELETE FROM GamePlatformListing WHERE game_id = ?', [req.params.id]);
    await pool.query('DELETE FROM DLC WHERE game_id = ?', [req.params.id]);
    await pool.query('DELETE FROM Game WHERE game_id = ?', [req.params.id]);
    res.json({ status: 'DELETED', game_id: req.params.id });
});
```

Why delete child tables first: Foreign keys prevent you from deleting a Game row if GameGenre, GamePlatformListing, or DLC rows still reference it. You must remove the children before the parent.
Alternative: You could define the foreign keys with `ON DELETE CASCADE`, which would automatically delete all child rows when the parent Game is deleted. That would reduce this to one query. The manual approach gives you more explicit control and visibility.

### The POST /api/register endpoint

```javascript
const { title, developer_name, publisher_id, genre_id, platform_id, price } = req.body;
const [rows] = await pool.query('CALL RegisterGameComplete(?, ?, ?, ?, ?, ?)', 
    [title, developer_name, publisher_id, genre_id, platform_id, price]);
res.json(rows[0][0]);
```

Destructures the JSON body into named variables, passes them all as parameterized arguments to the stored procedure. The procedure handles the transaction internally.

---

## Phase 9 — Frontend (public/app.js)

### Architecture: Single Page Application (SPA) without a framework

The entire frontend is in one HTML page. Navigation works by showing/hiding `div` elements, not by loading new pages.

```javascript
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = link.getAttribute('data-page');
        document.querySelectorAll('.page-content').forEach(page => {
            page.style.display = 'none';
        });
        document.getElementById(pageId).style.display = 'block';
        if (pageId === 'dashboard') loadDashboard();
        if (pageId === 'intelligence') loadIntelligence();
    });
});
```

`e.preventDefault()` stops the browser from following the anchor href.
Data-attributes (`data-page`) act as a mapping from each nav link to which div to show.
Data is loaded fresh from the API each time you switch to a page — no local caching.

### The fetch pattern

```javascript
const response = await fetch(`${API_BASE}/games`);
const games = await response.json();
```

`fetch()` makes an HTTP GET request (default method) and returns a Promise.
`.json()` also returns a Promise — it reads the response body and parses it as JSON.
Both are awaited sequentially because the second depends on the first.

### Dynamic table rendering

```javascript
tbody.innerHTML = games.map(g => `
    <tr onclick="showGameDetails(${g.game_id})" style="cursor: pointer;">
        <td>${g.title}</td>
        ...
    </tr>
`).join('');
```

`games.map(...)` transforms each game object into an HTML string for a table row.
`.join('')` concatenates all rows into one big string with no separator.
That string is then set as the innerHTML of the tbody element, replacing whatever was there before.
This is a simple approach for small datasets. For large datasets you'd use a virtual DOM library (React, Vue) to avoid re-rendering everything on every refresh.

Note: `${g.title}` embedded directly in innerHTML is safe here only because the data comes from your own database (not raw user input). If user-submitted text could contain `<script>` tags, you would need to escape it first.

### Chart initialization

```javascript
function initChart(id, type, labels, data, label, isCurrency, isHorizontal) {
    if (chartInstances[id]) chartInstances[id].destroy();
    chartInstances[id] = new Chart(ctx, { ... });
}
```

Chart.js is used for all charts (bar, doughnut).
`chartInstances` is a module-level object that stores every chart by its canvas ID.
Before creating a new chart, it destroys any existing one on that canvas — otherwise Chart.js draws on top of the old chart and you get visual artifacts.

### Search filter (client-side)

```javascript
document.getElementById('search-input')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#games-table tbody tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
});
```

The `?.` is optional chaining — it only calls addEventListener if the element exists, rather than crashing if it doesn't.
Filtering is purely client-side: it hides/shows `<tr>` elements based on whether the row's full text content includes the search term.
This is fast for small datasets because no server request is made.
For large datasets (tens of thousands of rows), you would send the search term to the server and filter in SQL using `WHERE title LIKE ?`.

### The `window.currentGamesData` pattern

```javascript
window.currentGamesData = games;
```

Games data is stored on the global `window` object so that the `showGameDetails()` function (called from inline onclick) can access it.
This is a common pattern when you need onclick handlers in innerHTML-generated strings to access JavaScript data, since closures do not work well there.

---

## Summary — How It All Flows Together

1. You run `node src/execute_setup.js` — it reads setup_db.sql and runs all DDL, triggers, views, functions, and procedures against MySQL.

2. You run `node server.js` — Express starts listening on port 3000. It holds an open connection pool to MySQL.

3. Your browser opens `http://localhost:3000` — Express serves `public/index.html` from the static folder.

4. The browser loads `public/app.js` and calls `loadDashboard()` immediately.

5. `loadDashboard()` calls `fetch('/api/games')` — that hits the Express route which runs `SELECT * FROM GameIntelligenceSummary` and returns JSON.

6. The browser renders the JSON as table rows with dynamic HTML.

7. When you click "Classify" on a game, the browser calls `fetch('/api/classify/42')` — Express calls `CALL ClassifyGameTier(42)` — the stored procedure scores the game and returns a tier — Express sends the result back — the browser displays it.

8. When you submit the register form, the browser POSTs JSON to `/api/register` — Express calls `CALL RegisterGameComplete(...)` — the procedure runs a transaction inserting into Game, GameGenre, and GamePlatformListing atomically — success or rollback propagates back to the browser.

Every layer has one job: SQL defines and validates data, views simplify reads, procedures encapsulate logic, Express translates HTTP to SQL, and the browser fetches and renders.
