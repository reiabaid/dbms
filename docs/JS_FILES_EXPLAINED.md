# JavaScript Files — Purpose, Flow, and DBMS Connections

This document explains every JS file in the project, what it does, why it exists, and how it connects to the database layer.

There are 9 JS files total, grouped into four roles: configuration, server, frontend, and utility scripts.

---

## How the Files Relate to Each Other

```
.env  (credentials)
  |
src/db.js  (connection pool — shared module)
  |         |          |           |
server.js  execute_  scripts/    src/test-
           setup.js  *.js        connection.js
  |
public/app.js  (runs in browser — talks to server.js via HTTP)
```

Every backend file that touches the database imports `src/db.js`. The frontend never touches MySQL directly — it only talks to `server.js` over HTTP.

---

## 1. src/db.js — The Database Bridge

**What it is:** The single shared module that creates and exports a MySQL connection pool.

**Why it exists:** Every backend file that needs the database imports this one module. Without it, each file would duplicate the connection config, credentials would be scattered everywhere, and you would open a new connection on every query instead of reusing pooled ones.

**The DBMS connection:**

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

- `mysql2/promise` is the MySQL driver for Node.js. It speaks the MySQL wire protocol over TCP to the database server.
- `createPool` keeps up to 10 live connections open at all times. When a query is needed, a free connection is borrowed from the pool, used, and returned — no new TCP handshake overhead.
- `multipleStatements: true` allows sending a whole SQL file (multiple semicolon-separated statements) in one call. This is specifically needed by `execute_setup.js`. It is a deliberate tradeoff — it slightly relaxes a SQL injection protection (multiple statements per call), which is acceptable here because the input is a trusted local file, not user input.
- `ssl: { rejectUnauthorized: false }` enables encrypted transit to the cloud-hosted MySQL (Aiven) without requiring the CA certificate file.
- Credentials come from `.env` via `dotenv`, keeping secrets out of source code.

**DBMS concept link:** A connection pool maps directly to the concept of concurrent database sessions. The database engine (MySQL) handles each connection as an independent session with its own transaction state. The pool ensures the application always has a session ready without the cost of establishing one per request.

---

## 2. src/execute_setup.js — Database Initializer

**What it is:** A one-time run script that reads `sql/setup_db.sql` and executes the entire schema setup against the live database.

**Why it exists:** The database needs tables, indexes, triggers, views, functions, and stored procedures created before any data can be stored. This script automates that. You run it once when setting up a new environment.

**What it does step by step:**

```javascript
const sql = fs.readFileSync(sqlPath, 'utf8');
await db.query(sql);
```

It reads the entire SQL file as a plain string and sends it to MySQL in one call. Because `multipleStatements: true` is set in `db.js`, MySQL processes all the CREATE TABLE, CREATE TRIGGER, CREATE VIEW, etc. statements in sequence as one batch.

After that:
```javascript
const [tables] = await db.query('SHOW TABLES FROM obsyria');
```
This verifies the setup worked by asking MySQL to list all tables it just created.

Finally `db.end()` is called to close all pool connections cleanly, since this is a one-shot script, not a long-running server.

**DBMS concept link:** This script is executing the DDL phase — Data Definition Language. DDL creates the schema: the structure the data will live in. It corresponds to Part 1 of `setup_db.sql` (CREATE TABLE), plus triggers, views, functions, and procedures. The script does not insert data — that is the DML phase handled separately.

**How to run:**
```
node src/execute_setup.js
```

---

## 3. src/test-connection.js — Connection Verifier

**What it is:** A diagnostic script to verify that the credentials in `.env` are correct and the database server is reachable.

**Why it exists:** When setting up a new machine or cloud environment, connectivity is the first thing that can fail. This script gives you a fast check before running anything else.

**What it does:**

```javascript
const connection = await mysql.createConnection(config);
const [rows] = await connection.execute('SELECT 1 + 1 AS solution');
const [tables] = await connection.execute('SHOW TABLES');
await connection.end();
```

Note: It uses `createConnection` (single connection) not `createPool`. This is intentional — it is a one-off test, not a server. It logs the host, port, user, and database name before connecting so you can visually confirm the right `.env` values are being read.

`SELECT 1 + 1` is a trivial query used universally as a database ping — if MySQL can parse and execute arithmetic, the connection is fully functional.

`SHOW TABLES` then confirms the `obsyria` database has been set up (non-zero table count).

**DBMS concept link:** This exercises the physical layer — confirming that the TCP connection, authentication, and SSL handshake with MySQL all succeed. It also touches the information schema indirectly via `SHOW TABLES`, which MySQL resolves by reading its internal `information_schema.tables` catalog.

**How to run:**
```
node src/test-connection.js
```

---

## 4. server.js — The API Server (Express)

**What it is:** The Node.js web server. It is the only file that runs continuously. Everything else either runs once or runs in the browser.

**Why it exists:** The browser cannot connect to MySQL directly — browsers do not have MySQL drivers and should not have database credentials. `server.js` sits between the browser and the database. The browser sends HTTP requests to it; it queries MySQL and sends JSON back.

**DBMS interaction — every endpoint maps to a SQL object:**

```
GET  /api/games              → SELECT * FROM GameIntelligenceSummary   (View)
GET  /api/genres             → SELECT * FROM GenrePerformance           (View)
GET  /api/publishers         → SELECT * FROM PublisherImpact            (View)
GET  /api/engines            → SELECT * FROM EngineIntelligence         (View)
GET  /api/platforms          → SELECT * FROM PlatformPricing            (View)
GET  /api/roi                → SELECT * FROM GameROI                    (View + Scalar Function)
GET  /api/above-average      → SELECT * FROM AboveAverageGames          (View + Subquery)
GET  /api/top-developers     → SELECT * FROM TopDevelopers              (View + Correlated Subquery)
GET  /api/classify/:id       → CALL ClassifyGameTier(?)                 (Stored Procedure)
GET  /api/developer-benchmark/:name → CALL GetDeveloperBenchmark(?)    (Stored Procedure + HAVING)
POST /api/register           → CALL RegisterGameComplete(...)           (Stored Procedure + Transaction)
GET  /api/metadata           → SELECT from Developer, Publisher, Genre, Platform (Base tables)
DELETE /api/games/:id        → DELETE from child tables then Game       (DML DELETE)
```

**The query pattern used throughout:**

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

`pool.query()` borrows a connection from the pool, sends the SQL, gets results, and returns the connection. The result is `[rows, fields]` — we destructure `rows` (the actual data) and discard `fields` (column metadata).

**Parameterized queries prevent SQL injection:**

```javascript
pool.query('CALL ClassifyGameTier(?)', [req.params.id])
pool.query('DELETE FROM GameGenre WHERE game_id = ?', [req.params.id])
```

The `?` placeholder is never concatenated as a string. The mysql2 driver sends the SQL and values separately; MySQL parses the template before applying the value. A malicious `id` like `1; DROP TABLE Game` cannot break out of the parameter slot.

**The DELETE endpoint — referential integrity enforced in code:**

```javascript
await pool.query('DELETE FROM GameGenre WHERE game_id = ?', [id]);
await pool.query('DELETE FROM GamePlatformListing WHERE game_id = ?', [id]);
await pool.query('DELETE FROM DLC WHERE game_id = ?', [id]);
await pool.query('DELETE FROM Game WHERE game_id = ?', [id]);
```

MySQL enforces foreign key constraints — you cannot delete a Game row while child rows in GameGenre, GamePlatformListing, or DLC still reference it. The server deletes children first (in order), then the parent. An alternative would be `ON DELETE CASCADE` in the schema, but explicit ordering gives clearer control.

**Stored procedure results:**

```javascript
const [rows] = await pool.query('CALL ClassifyGameTier(?)', [id]);
res.json(rows[0][0]);
```

When MySQL executes a CALL, it returns an array of result sets (one per SELECT inside the procedure). `rows[0]` is the first result set (an array of rows). `rows[0][0]` is the first row of that result set — which for `ClassifyGameTier` is the single classification row.

**DBMS concept link:** `server.js` is the application layer that bridges HTTP (stateless, text-based) to SQL (stateful, connection-based). It maps REST verbs (GET, POST, DELETE) to SQL operations (SELECT, CALL, DELETE). Every query goes through the connection pool maintained by `src/db.js`.

**How to run:**
```
node server.js
```
Starts on port 3000 (or `process.env.PORT`).

---

## 5. public/app.js — Frontend Application

**What it is:** The JavaScript that runs inside the browser. It handles navigation, fetches data from `server.js`, renders HTML dynamically, and draws charts.

**Why it exists:** The `public/` folder is served as static files by Express. When a user opens `http://localhost:3000`, they get `index.html`, which loads `app.js`. From that point, `app.js` is running inside the browser — not on the server.

**It has zero direct DBMS contact.** It only talks to `server.js` over HTTP using `fetch()`.

**Key functions and what they trigger in the DBMS:**

`loadDashboard()` — calls `GET /api/games`, which queries the `GameIntelligenceSummary` view (a JOIN of Game + Developer + Publisher + GameEngine). Renders the result as a table. Computes stat cards (total games, average score, top engine) entirely from the returned JSON without another round-trip.

`loadIntelligence()` — fires multiple parallel fetches to `/api/roi`, `/api/top-developers`, `/api/engines`, `/api/genres`, `/api/publishers`, `/api/platforms`. Each hits a different view in the database. Results are passed to Chart.js for visualisation and rendered into data tables.

`classifyGame()` — calls `GET /api/classify/:id`, which triggers `CALL ClassifyGameTier(id)` in MySQL. The returned tier and score breakdown are rendered in the UI with color coding. ROI is recalculated client-side from the game's budget/revenue fields returned by a second fetch to `/api/games`.

`register-form submit handler` — collects form values (title, price, developer, publisher, genre, platform) and POSTs JSON to `/api/register`. The server calls `CALL RegisterGameComplete(...)`, which runs a full database transaction. Success or failure is reported back to the UI.

`deleteGame()` — sends `DELETE /api/games/:id`, which cascades four DELETE statements in the server. Calls `loadDashboard()` on success to refresh the table.

**The search filter — client-side, no DBMS involvement:**

```javascript
rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
});
```

Filtering happens on already-loaded DOM rows — no new SQL query fires on each keystroke. This works because the full dataset is already in the browser. For very large datasets this would need to be moved to server-side SQL with `WHERE title LIKE ?`.

**DBMS concept link:** `app.js` represents the presentation layer. It consumes the API, which consumes views and stored procedures, which are built on top of normalized tables. The separation means the browser never knows the schema — it just sees JSON arrays.

---

## 6. scripts/fix_platform.js — Platform Bootstrapper

**What it is:** A one-off repair script that inserts a baseline Steam platform record and links all existing games to it.

**Why it exists:** If games were seeded before a Steam platform row existed in the Platform table, they would have no platform listing. This script patches that gap without re-seeding everything.

**What it does:**

```javascript
await db.query("INSERT IGNORE INTO Platform (platform_id, name, platform_type) VALUES (1, 'Steam', 'PC_STOREFRONT')");
await db.query("INSERT IGNORE INTO GamePlatformListing (game_id, platform_id, price_usd) SELECT game_id, 1, base_price_usd FROM Game");
```

`INSERT IGNORE` skips the insert silently if a row with the same primary key already exists — safe to re-run.

The second query uses a `SELECT` inside an `INSERT` — it generates one platform listing row per game in the Game table, using each game's own base price. This is a single-query bulk insert.

**DBMS concept link:** This touches two tables with a foreign key relationship — GamePlatformListing references both Game and Platform. The INSERT order matters: Platform must exist before GamePlatformListing can reference it. The script respects this by inserting Platform first.

**How to run:**
```
node scripts/fix_platform.js
```

---

## 7. scripts/pull_real_data.js — Steam Data Seeder

**What it is:** A data pipeline that pulls the top 100 Steam games from the SteamSpy public API and loads them into the database.

**Why it exists:** The database needs realistic data to be useful for analysis. Rather than making up numbers, this script fetches real ownership counts, review scores, and prices from SteamSpy and derives estimates for budget, team size, and revenue.

**The pipeline in order:**

1. Fetch top 100 games from `steamspy.com/api.php?request=top100forever`
2. For each game, fetch the release date from the Steam store API (10 at a time using a concurrency limiter)
3. Bulk INSERT developers into Developer table (INSERT IGNORE — skip duplicates)
4. Bulk INSERT publishers into Publisher table
5. Ensure engine records exist in GameEngine
6. `TRUNCATE` the Game, GameGenre, and GamePlatformListing tables (wipe old data) with foreign key checks disabled
7. Bulk INSERT all 100 games into Game with estimated budget, team size, revenue, and cover image URL
8. Assign a genre to each game using title keyword matching and INSERT into GameGenre

**The TRUNCATE with FK bypass:**

```javascript
await db.query('SET FOREIGN_KEY_CHECKS = 0');
await db.query('TRUNCATE TABLE GamePlatformListing');
await db.query('TRUNCATE TABLE GameGenre');
await db.query('TRUNCATE TABLE Game');
await db.query('SET FOREIGN_KEY_CHECKS = 1');
```

`TRUNCATE` is faster than `DELETE FROM` for clearing all rows — it drops and recreates the table's data pages. But it cannot run while foreign key checks are active, so they are temporarily disabled, then re-enabled.

**DBMS concept link:** This script performs bulk DML (INSERT) across multiple related tables in dependency order (Developer and Publisher before Game, Game before GameGenre). It also uses `INSERT IGNORE` (a MySQL extension to standard SQL) which maps to the concept of upsert — insert if not conflicting, skip otherwise. The cover image URL it inserts (`cdn.cloudflare.steamstatic.com/steam/apps/...`) is stored in `Game.cover_image_url` and displayed in `app.js`.

**How to run:**
```
node scripts/pull_real_data.js
```

---

## 8. scripts/seed_marketplaces.js — Platform Listing Generator

**What it is:** A script that creates realistic cross-platform marketplace listings for every game in the database.

**Why it exists:** After `pull_real_data.js` loads games, they have no platform listings yet (or only Steam from `fix_platform.js`). This script creates a realistic spread: every game on Steam, a random 40% on Epic, 50% on Xbox, 50% on PS5, and 20% on Switch — with platform-specific pricing adjustments.

**What it does:**

```javascript
const epicPrice = price > 0 ? (price * 0.9).toFixed(2) : 0;   // 10% cheaper on Epic
const switchPrice = price > 0 ? (price + 10).toFixed(2) : 0;  // Switch Tax
const onGamePass = Math.random() > 0.7;                         // 30% chance Game Pass
```

The price variations and subscription flags make the `PlatformPricing` view and platform analysis in the frontend meaningful. Without them, every platform would show the same price.

It uses `TRUNCATE TABLE GamePlatformListing` at the start to wipe any previous listings before regenerating — safe to re-run.

**DBMS concept link:** This script populates the `GamePlatformListing` junction table, which has a composite UNIQUE KEY `(game_id, platform_id)`. It also triggers the `auto_subscription_flag` AFTER INSERT trigger in MySQL — when a listing with `subscription_included = 1` is inserted, MySQL automatically updates `Game.on_subscription_day1 = TRUE` for that game. The script does not call that trigger directly; MySQL fires it automatically after every INSERT into `GamePlatformListing`.

**How to run:**
```
node scripts/seed_marketplaces.js
```

---

## 9. scripts/update_procedure.js — Procedure Patcher

**What it is:** A targeted script that drops and recreates the `RegisterGameComplete` stored procedure in the live database.

**Why it exists:** When the procedure definition needs to change (logic update, new parameter, bug fix), you do not need to re-run the entire `setup_db.sql`. This script patches just the procedure without touching tables, indexes, views, or triggers.

**What it does:**

```javascript
const sql = `
DROP PROCEDURE IF EXISTS RegisterGameComplete;
CREATE PROCEDURE RegisterGameComplete(...) ...
`;
await pool.query(sql);
```

The full SQL for the procedure is embedded as a template literal string in the JS file. `DROP PROCEDURE IF EXISTS` ensures a clean slate before recreating. `multipleStatements: true` in the pool config allows both statements in one call.

**DBMS concept link:** This is a DDL operation on a stored procedure. It corresponds to using `CREATE OR REPLACE PROCEDURE` (MySQL uses DROP + CREATE since it does not support OR REPLACE for procedures). The procedure itself encapsulates a multi-table transaction — checking/creating a developer, inserting a game, linking its genre and platform listing — all within `START TRANSACTION ... COMMIT`.

**How to run:**
```
node scripts/update_procedure.js
```

---

## Recommended Run Order (First-Time Setup)

```
1. node src/test-connection.js       — verify DB credentials work
2. node src/execute_setup.js         — create all tables, views, triggers, procedures
3. node scripts/pull_real_data.js    — seed 100 real games from SteamSpy
4. node scripts/seed_marketplaces.js — add cross-platform listings
5. node server.js                    — start the web server
```

`fix_platform.js` and `update_procedure.js` are repair tools — run only when specifically needed.

---

## DBMS Concept Map Across All Files

```
src/db.js               → Connection Pool (Physical Layer)
src/test-connection.js  → Connectivity + SHOW TABLES (Catalog / Info Schema)
src/execute_setup.js    → DDL execution (Schema creation)
server.js               → Views, Stored Procedures, DML DELETE via HTTP API
public/app.js           → Presentation layer (no direct DBMS contact)
scripts/fix_platform.js → DML INSERT with INSERT...SELECT
scripts/pull_real_data.js → Bulk DML INSERT, TRUNCATE, FK bypass
scripts/seed_marketplaces.js → DML INSERT, triggers fired automatically
scripts/update_procedure.js → DDL on stored procedure (DROP + CREATE)
```
