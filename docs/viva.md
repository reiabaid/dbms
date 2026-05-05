# GameOn Game Intelligence System — Viva Preparation Guide

> Implementation-focused walkthrough grounded in the actual codebase. Every decision justified from first principles. Every answer tied to real code.

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Data Flow Through the System](#2-data-flow-through-the-system)
3. [Conceptual Layer — ER Model](#3-conceptual-layer--er-model)
4. [Logical Layer — Relational Schema & Normalization](#4-logical-layer--relational-schema--normalization)
5. [Physical Layer — Storage, Indexes, Execution](#5-physical-layer--storage-indexes-execution)
6. [Table Design — Column-by-Column Justification](#6-table-design--column-by-column-justification)
7. [Business Logic in the Database](#7-business-logic-in-the-database)
8. [End-to-End Data Flow](#8-end-to-end-data-flow)
9. [Query Execution & JOIN Internals](#9-query-execution--join-internals)
10. [Transactions & ACID Reliability](#10-transactions--acid-reliability)
11. [Performance & Optimization](#11-performance--optimization)
12. [Backend Integration — Node.js](#12-backend-integration--nodejs)
13. [Frontend Interaction — React](#13-frontend-interaction--react)
14. [Failure & Edge Cases](#14-failure--edge-cases)
15. [Viva Attack Questions — Answered](#15-viva-attack-questions--answered)

---

## 1. System Overview

### The Problem

The $180 billion gaming industry generates data across hundreds of platforms, developers, publishers, and genres — but it is fragmented. A developer asking "what budget do I need for a Soulslike game that performs like Elden Ring?" has no centralized, structured answer. Review scores live on Metacritic. Revenue estimates live on SteamSpy. Developer info lives on LinkedIn. Nothing talks to each other.

**GameOn solves this by being a single, normalized relational intelligence system** where all dimensions of a game — who made it, what engine it uses, what it cost to build, what it earns, how it's reviewed, how it's priced per platform, and what DLC it produces — are stored in one schema with enforced relationships.

### What It Enables

| Business Question | SQL Mechanism |
|---|---|
| What production tier is this game? | Stored Procedure: `ClassifyGameTier` |
| What genre should I target with my team + budget? | Stored Procedure: `GetGenreOpportunity` |
| How does my developer compare to peers? | Stored Procedure: `GetDeveloperBenchmark` |
| What DLC strategy works for this genre + price point? | Stored Procedure: `GetDLCStrategy` |
| What is this game's ROI? | Scalar Function: `CalculateROI` |
| How do publishers rank by revenue and score? | View: `PublisherImpact` |
| Which engine produces the best results? | View: `EngineIntelligence` |

### Architecture at a Glance

```
[React Frontend]
      |
  HTTP/REST
      |
[Node.js / Express API]
      |
 mysql2 connection pool (limit: 10)
      |
[MySQL on Aiven Cloud]  ←  SSL encrypted, cloud-hosted
      |
[obsyria schema]
  ├── 9 Tables  (3NF normalized)
  ├── 3 Indexes (B-Tree: title, release_date, metacritic_score)
  ├── 4 Triggers (automation + integrity)
  ├── 6 Views   (analytical reporting)
  ├── 5 Stored Procedures (business intelligence)
  └── 1 Scalar Function  (ROI)
```

### Tech Stack

| Layer | Technology |
|---|---|
| Database | MySQL 8.0 (hosted on Aiven Cloud) |
| Backend | Node.js with `mysql2/promise` |
| Frontend | React with Vanilla CSS (glassmorphism) |
| Security | SSL/TLS, parameterized queries, `.env` credential isolation |
| Deployment | Aiven cloud MySQL, `npm run setup` for schema bootstrap |

---
### Database Changes and Optimizations

This section summarizes the concrete database schema, integrity rules, stored routines, indexing choices, connection configuration, and performance-focused changes implemented in the repository. The authoritative DDL and migration script is [sql/setup_db.sql](sql/setup_db.sql); the Node.js connection pool is in [src/db.js](src/db.js).

Schema and normalization
- The schema is modeled in 3NF with normalized entities (Developer, Publisher, GameEngine, Platform, Genre, Game, DLC) and bridge tables for many-to-many relationships (`GameGenre`, `GamePlatformListing`). Referential integrity is enforced with foreign keys throughout the schema.
- Data types were chosen for scale and precision: `BIGINT` for revenue and budgets, `DECIMAL(6,2)` for prices, `YEAR` where only year precision is needed. These choices reduce storage overhead while preserving numeric fidelity for financial calculations.

Indexes and query support
- Explicit single-column indexes are created for common predicates: `idx_game_title`, `idx_release_date`, `idx_metacritic`. The repository includes an idempotent helper (`drop_index_if_exists`) so index creation is safe on repeated runs.
- Rationale: these indexes accelerate title lookups, date-range scans, and metacritic-based filters/ordering. For heavier query patterns (e.g., filtering by genre + score or publisher + release_date), the next step is to add composite/covering indexes such as `(genre_id, metacritic_score)` via a supporting bridge table index or `(publisher_id, release_date, metacritic_score)` on `Game` to support extended analytics.

Integrity constraints and triggers
- Triggers enforce domain rules at write time: `before_game_insert` sets `is_free_to_play` when `base_price_usd = 0`, `validate_metacritic` rejects out-of-range scores, `prevent_negative_price` blocks negative listing prices, and `auto_subscription_flag` keeps `Game.on_subscription_day1` in sync when a platform listing is subscription-included. Putting these checks in the database ensures consistent behavior regardless of client or API implementation.

Stored procedures, functions, and transactions
- Business logic exposed as stored procedures: `ClassifyGameTier`, `GetGenreOpportunity`, `GetDeveloperBenchmark`, `GetDLCStrategy` and the atomic `RegisterGameComplete` procedure. `RegisterGameComplete` demonstrates safe transactional patterns: it uses `START TRANSACTION`/`COMMIT`, `LAST_INSERT_ID()` to link subsequent inserts, and an `EXIT HANDLER FOR SQLEXCEPTION` that `ROLLBACK`s and signals a controlled error on failure.
- A deterministic scalar function `CalculateROI` computes ROI for reporting and is wired into the `GameROI` view for easy consumption by analytics queries.

Views and analytical surfaces
- Several read-optimized views (`GameIntelligenceSummary`, `GenrePerformance`, `PublisherImpact`, `EngineIntelligence`, `DLCMonetization`, `PlatformPricing`, `AboveAverageGames`, `GameROI`, `TopDevelopers`) provide pre-joined, business-oriented datasets for the API and frontend. Views simplify queries in the application layer and centralize join logic, but for very large datasets consider materializing critical aggregations or caching them to avoid repeated heavy computation.

Connection pooling and Node.js integration
- `src/db.js` uses `mysql2/promise` and a pool configured with `connectionLimit: 10`, `waitForConnections: true`, `queueLimit: 0`, and `multipleStatements: true`. Pooling reduces connection churn and improves concurrency; `connectionLimit` should be tuned to the app's traffic and the DB server's connection capacity.
- Note: `multipleStatements: true` permits executing multiple SQL statements in one call — convenient for setup scripts but increases exposure to SQL injection if untrusted input is concatenated. Prefer parameterized queries and disable `multipleStatements` in production unless explicitly required.

Performance and optimization recommendations (concrete)
- Use `EXPLAIN` on slow queries returned by the slow-query log and add covering or composite indexes tailored to those patterns (for example, an index on `(genre_id, is_primary)` for frequent primary-genre analytics or `(publisher_id, release_date)` for publisher time-series queries).
- Replace expensive correlated subqueries with window functions or derived-table aggregates where appropriate, and avoid `SELECT *` in hot API endpoints.
- For bulk ingest (seed scripts under `sql/`), use batched `INSERT`s or `LOAD DATA INFILE` to reduce round-trips and log overhead.
- Consider periodic materialized summaries for views that scan large amounts of historical data; MySQL does not have built-in materialized views, but a scheduled table refresh (populated by stored procedures or cron jobs) achieves the same effect.

Safety, migration, and auditability
- The schema and routines in `sql/setup_db.sql` are the source of truth. Apply changes through versioned migration scripts and code review; store migration history in a migrations table or adopt a migration tool (Flyway, Liquibase, or npm-based migration tooling).
- The `drop_index_if_exists` approach makes the setup script idempotent, but long-term index changes should be versioned and executed as controlled migrations to avoid production instability.

Monitoring and next steps
- Add slow query logging and periodic EXPLAIN-based audits for the top N slowest queries. Use performance_schema and information_schema to analyze index usage and to identify unused indexes for removal.
- If the `Game` table grows into the millions of rows, evaluate partitioning by range (e.g., `release_date`) or sharding strategies for horizontal scale.
- Add automated DB integration tests that exercise `RegisterGameComplete`, trigger behavior, and stored procedure outputs to surface regressions early.

Files to review
- Schema and routines: [sql/setup_db.sql](sql/setup_db.sql)
- DB connection pool: [src/db.js](src/db.js)


## 2. Data Flow Through the System

### Insert Flow (Adding a New Game)

```
User fills form in React
        ↓
React calls POST /api/games  (HTTP)
        ↓
Express receives request body
        ↓
Node.js calls: CALL RegisterGameComplete(...)
        ↓
MySQL opens a transaction:
  1. INSERT INTO Game
     → before_game_insert trigger: if price=0, set is_free_to_play=TRUE
     → validate_metacritic trigger: reject score outside 0-100
  2. INSERT INTO GameGenre (bridge table: links game to genre)
  3. INSERT INTO GamePlatformListing
     → prevent_negative_price trigger: reject price < 0
     → auto_subscription_flag trigger: set on_subscription_day1=TRUE if applicable
        ↓
COMMIT (or ROLLBACK + SIGNAL error if any step fails)
        ↓
MySQL returns registered_game_id + 'SUCCESS'
        ↓
Node.js sends JSON response to React
        ↓
React re-renders with updated game list
```

### Query Flow (Fetching Game Intelligence)

```
User selects genre filter in React
        ↓
React calls GET /api/games?genre=RPG
        ↓
Node.js: SELECT * FROM GameIntelligenceSummary WHERE genre_name = ?  [param: 'RPG']
        ↓
mysql2 pool picks an available connection
        ↓
MySQL: parser → optimizer → executor
        ↓
idx_metacritic or idx_game_title B-Tree used if WHERE/ORDER BY matches
        ↓
Result set returned as row objects
        ↓
Node.js sends JSON array
        ↓
React maps array to UI cards
```

---

## 3. Conceptual Layer — ER Model

The ER model is the blueprint before any SQL is written. It asks: what are the real-world things, and how do they relate?

### Why Each Entity Exists

**Developer**
The team that builds a game is a distinct, reusable identity. CD Projekt Red built both Cyberpunk 2077 and The Witcher 3. If developer data (country, team size) lived inside the Game table, you'd repeat "Poland, 1000 employees" for every CDPR game — a normalization violation. Separate entity: one update propagates to all games.

**Publisher**
A publisher signs multiple games. Publisher tier (MAJOR/MID/INDIE_LABEL) is a property of the company, not of any individual game.

**GameEngine**
An engine (Unreal Engine 5, REDengine) is used across many games. Its license type, open-source status, and scale belong to the engine itself. Separating it enables analytics: "Which engine produces the highest average Metacritic score?"

**Platform**
Steam, PS5, Xbox Series X — each is a distinct marketplace. The same game appears on multiple platforms at different prices. Platform metadata belongs to the platform entity, not repeated in every listing.

**Genre**
A genre classifies games. Multiple games share one genre. One game belongs to multiple genres. Genre also has a **recursive relationship** — Open World RPG is a sub-genre of RPG. This hierarchy requires a self-referential FK.

**Game**
The central hub. Every other entity either describes Game (Developer, Publisher, Engine), extends Game (DLC), or connects Game to something else (Platform, Genre). Game is the subject of every business question.

**DLC**
DLC cannot exist without a parent game. Storing DLC inside the Game table would require nullable columns or comma-separated values — both violations of 1NF. Separate entity with FK to Game.

---

### Relationships — Design Rationale

#### 1:N — Developer → Game

One developer makes many games. The FK `developer_id` goes **in the Game table** — the "many" side. This is the fundamental rule of 1:N.

```
Developer (developer_id=2, name="FromSoftware", country="Japan")
Game (game_id=2, title="Elden Ring",  developer_id=2)
Game (game_id=5, title="Dark Souls",  developer_id=2)
```

If you put `game_id` in Developer, one developer could only store one game. You'd have to duplicate developer rows — that's an update anomaly.

#### 1:N — Publisher → Game

Same principle. Both `developer_id` and `publisher_id` are **NOT NULL** in Game — every game must have both a developer and a publisher. This is a hard rule in the actual schema.

#### 1:N — Game → DLC

One game has many DLC packs. FK `game_id` lives in DLC. Witcher 3 has "Blood and Wine" (dlc_id=1) and "Hearts of Stone" (dlc_id=2) — both point to game_id=1.

#### M:N — Game ↔ Genre (via GameGenre bridge table)

A game belongs to multiple genres. A genre contains multiple games. A single FK column cannot model this.

**Solution: Bridge Table**
```sql
GameGenre (game_id, genre_id, is_primary)
PRIMARY KEY (game_id, genre_id)
```

`is_primary` is a **relationship attribute** — it describes the game-genre relationship itself ("is RPG the primary genre for Elden Ring?"), not the game alone or the genre alone. This is why it lives in the bridge table, not in either entity.

#### M:N — Game ↔ Platform (via GamePlatformListing bridge table)

```sql
GamePlatformListing (listing_id, game_id, platform_id, price_usd, is_exclusive, subscription_included, platform_release_date)
UNIQUE (game_id, platform_id)
```

- `price_usd` — Elden Ring on Steam may cost differently than on PS5. Price belongs to the listing, not to the game or platform alone.
- `is_exclusive` — a contractual status between one game and one platform.
- `subscription_included` — whether the game is on Game Pass/PS+ for this listing.

These are all **relationship attributes** — they only have meaning at the intersection.

#### Recursive — Genre → Genre

```sql
Genre (genre_id, name, parent_genre_id → Genre.genre_id)
```

Root genres: RPG, Action, Strategy → `parent_genre_id = NULL`
Sub-genres: Open World RPG, Soulslike → `parent_genre_id = 1` (RPG)

A hierarchical tree in a flat table. Allows unlimited nesting depth without separate tables.

---

## 4. Logical Layer — Relational Schema & Normalization

### Why 3NF?

**1NF — Atomic Values**
Every column holds exactly one value. No arrays, no comma-separated genres. If we stored `genres = "RPG,Action"` in Game, a query like `WHERE genre = 'RPG'` would require `LIKE '%RPG%'` — no index, full scan, brittle. The bridge table GameGenre gives each genre its own row, enabling indexed lookups.

**2NF — Full Key Dependency**
Applies to composite-PK tables. Every non-key column must depend on the **entire** key.

GameGenre `(game_id, genre_id, is_primary)`:
- `is_primary` depends on both `game_id` AND `genre_id` together ✓

Violation (what we avoided): if we stored `game_title` in GameGenre, it would depend only on `game_id`, not on `genre_id` — a partial dependency, violating 2NF.

**3NF — No Transitive Dependencies**
Non-key columns must depend only on the primary key, not on other non-key columns.

Violation example: if `developer_country` were stored in Game, it would depend on `developer_id` (non-key), not on `game_id` (PK). That's the transitive chain: `game_id → developer_id → developer_country`.

The fix is what we did: `developer_country` lives only in Developer. Game stores only `developer_id`. JOIN to get country. When FromSoftware relocates, one update to Developer.country changes the country for every one of their games automatically.

---

## 5. Physical Layer — Storage, Indexes, Execution

### How MySQL InnoDB Stores Data

InnoDB stores every table in a **B+ Tree clustered index** organized by primary key. Each leaf node IS the full row.

For the Game table:
- `game_id = 1` (Witcher 3) → leaf node 1
- `game_id = 2` (Elden Ring) → leaf node 2
- `game_id = 3` (Hades) → leaf node 3

`SELECT * FROM Game WHERE game_id = 2` traverses root → intermediate → leaf in O(log N). For 1 million rows: ~20 comparisons. Without the clustered index: up to 1,000,000 comparisons.

### The Three Secondary Indexes

```sql
CREATE INDEX idx_game_title    ON Game(title);
CREATE INDEX idx_release_date  ON Game(release_date);
CREATE INDEX idx_metacritic    ON Game(metacritic_score);
```

Secondary indexes are separate B-Trees that store `(indexed_value → primary_key_pointer)`.

**idx_game_title**: Title search jumps directly to the matching node. Without it, every search reads every row.

**idx_release_date**: Range queries — "games released after 2020" — find the start position in the B-Tree and scan forward. Only matching rows examined.

**idx_metacritic**: "Top-rated games above 85" — index starts at 85 and reads forward. Without it: full scan of all rows checking each score.

### Full Table Scan Without Index

```sql
SELECT * FROM Game WHERE title = 'Elden Ring';
-- Without idx_game_title:
-- Row 1: "The Witcher 3" → no match
-- Row 2: "Elden Ring"    → MATCH
-- Row 3..N: keep checking
-- All N rows examined. O(N).
```

Performance data from the project benchmarks:

| Dataset | With Index | Without Index | Improvement |
|---|---|---|---|
| 10,000 rows | 12ms | 15ms | 20% |
| 50,000 rows | 45ms | 62ms | 27% |
| 100,000 rows | 110ms | 145ms | 24% |

The gap widens with scale. This is the difference between O(log N) and O(N).

---

## 6. Table Design — Column-by-Column Justification

### Developer

```sql
CREATE TABLE IF NOT EXISTS Developer (
    developer_id   INT PRIMARY KEY AUTO_INCREMENT,
    name           VARCHAR(100) NOT NULL,
    country        VARCHAR(60),
    founded_year   YEAR,
    team_size      INT,
    is_independent BOOLEAN DEFAULT TRUE,
    parent_company VARCHAR(100)
);
```

**developer_id INT AUTO_INCREMENT PRIMARY KEY**
INT: up to ~2.1 billion — no developer will exceed this. AUTO_INCREMENT: DB generates IDs, zero collision risk. PRIMARY KEY: creates the clustered index, enforces uniqueness, cannot be NULL.

**name VARCHAR(100) NOT NULL**
VARCHAR: variable-length — "EA" stores 2 bytes, not 100. CHAR(100) would waste 98 bytes per row. NOT NULL: a nameless developer is meaningless; no application bug can insert one.

**country VARCHAR(60)**
Nullable: some studios are incorporated across multiple countries. NULL means "unknown/multi-national", not "none".

**founded_year YEAR**
MySQL's native 4-digit year type (1901–2155). More efficient than DATE when day/month are irrelevant.

**is_independent BOOLEAN DEFAULT TRUE**
BOOLEAN is TINYINT(1). DEFAULT TRUE: most studios are independent. Studios like Rockstar North (owned by Take-Two) require explicit FALSE.

**parent_company VARCHAR(100)**
Nullable: independent studios have no parent. NULL is semantically correct here.

---

### Publisher

```sql
CREATE TABLE IF NOT EXISTS Publisher (
    publisher_id INT PRIMARY KEY AUTO_INCREMENT,
    name         VARCHAR(100) NOT NULL,
    country      VARCHAR(60),
    tier         ENUM('MAJOR', 'MID', 'INDIE_LABEL', 'SELF_PUBLISHED'),
    founded_year YEAR
);
```

**tier ENUM('MAJOR', 'MID', 'INDIE_LABEL', 'SELF_PUBLISHED')**
ENUM restricts the column to exactly these values. `'SUPERSTAR'` would be rejected by MySQL. Without ENUM, a typo like `'MAYYOR'` inserts silently — every `WHERE tier = 'MAJOR'` query then misses that row.

Why these four tiers?
- MAJOR (EA, Bandai Namco): large marketing budgets, global distribution
- MID (CD Projekt): regional strength, meaningful funding
- INDIE_LABEL (Annapurna Interactive): boutique curation, selective releases
- SELF_PUBLISHED: developer distributes directly; no publisher entity relationship needed

Note: `tier` is nullable in the actual schema (no NOT NULL constraint), unlike `name`.

---

### GameEngine

```sql
CREATE TABLE IF NOT EXISTS GameEngine (
    engine_id         INT PRIMARY KEY AUTO_INCREMENT,
    name              VARCHAR(80) NOT NULL,
    developer_company VARCHAR(80),
    license_type      ENUM('FREE', 'ROYALTY', 'SUBSCRIPTION', 'PROPRIETARY'),
    is_open_source    BOOLEAN DEFAULT FALSE,
    typical_scale     ENUM('HOBBYIST', 'INDIE', 'AA', 'AAA', 'ALL')
);
```

**license_type ENUM**
Four real business models: FREE (Godot), ROYALTY (Unreal — 5% of revenue above $1M), SUBSCRIPTION (Unity — monthly fee), PROPRIETARY (REDengine — internal only). This directly affects ROI calculations: a ROYALTY engine adds costs not captured in dev_budget_usd.

**typical_scale ENUM**
Classifies which production tiers typically use this engine. REDengine is `AAA`. Unreal Engine 5 and Unity are `ALL`. Enables: "Which engines do indie teams use?" → `WHERE typical_scale IN ('INDIE', 'ALL')`.

---

### Platform

```sql
CREATE TABLE IF NOT EXISTS Platform (
    platform_id   INT PRIMARY KEY AUTO_INCREMENT,
    name          VARCHAR(60) NOT NULL,
    manufacturer  VARCHAR(60),
    platform_type ENUM('PC_STOREFRONT', 'CONSOLE', 'HANDHELD', 'CLOUD'),
    launch_year   YEAR
);
```

**platform_type ENUM**
Steam is `PC_STOREFRONT` — not a physical device. PS5 is `CONSOLE`. Nintendo Switch is `HANDHELD`. These are fundamentally different distribution channels with different royalty structures, install bases, and audience demographics. Analytics comparing console vs PC pricing require this distinction. Without it: you'd have to string-match on manufacturer names — brittle and inconsistent.

---

### Genre (Recursive)

```sql
CREATE TABLE IF NOT EXISTS Genre (
    genre_id       INT PRIMARY KEY AUTO_INCREMENT,
    name           VARCHAR(60) NOT NULL,
    parent_genre_id INT NULL,
    FOREIGN KEY (parent_genre_id) REFERENCES Genre(genre_id)
);
```

**parent_genre_id self-referential FK**
Root genres (RPG, Action, Strategy) have `parent_genre_id = NULL`. Sub-genres (Open World RPG, Soulslike) have `parent_genre_id = 1` (RPG's ID), `parent_genre_id = 1` (RPG).

The FK has **no explicit ON DELETE clause** — the default is RESTRICT. You cannot delete a parent genre (like RPG) while sub-genres still reference it. This prevents orphaned sub-genre records without explicitly specifying behavior. To remove RPG, you must first reassign or remove Soulslike and Open World RPG.

Why not ON DELETE CASCADE here? Deleting RPG and cascading would delete Soulslike, then delete all Soulslike game classifications — massive unintended data loss from a category reorganization.

---

### Game — The Hub (24 Columns)

```sql
CREATE TABLE IF NOT EXISTS Game (
    game_id              INT PRIMARY KEY AUTO_INCREMENT,
    title                VARCHAR(150) NOT NULL,
    release_date         DATE,
    esrb_rating          ENUM('E', 'E10+', 'T', 'M', 'AO', 'UNRATED'),
    developer_id         INT NOT NULL,
    publisher_id         INT NOT NULL,
    engine_id            INT,
    dev_budget_usd       BIGINT,
    marketing_budget_usd BIGINT,
    dev_duration_months  INT,
    team_size_at_launch  INT,
    base_price_usd       DECIMAL(6,2) DEFAULT 0.00,
    is_free_to_play      BOOLEAN DEFAULT FALSE,
    funding_source       ENUM('SELF_FUNDED', 'PUBLISHER_FUNDED', 'CROWDFUNDED', 'GRANT', 'MIXED'),
    monetization_model   ENUM('PREMIUM', 'F2P_COSMETIC', 'F2P_PAY2WIN', 'PREMIUM_PLUS_DLC', 'SUBSCRIPTION', 'MIXED'),
    early_access         BOOLEAN DEFAULT FALSE,
    copies_sold_est      INT,
    revenue_est_usd      BIGINT,
    peak_ccu             INT,
    metacritic_score     INT CHECK (metacritic_score BETWEEN 0 AND 100),
    user_review_pct      DECIMAL(5,2),
    total_reviews        INT,
    award_count          INT DEFAULT 0,
    on_subscription_day1 BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (developer_id) REFERENCES Developer(developer_id),
    FOREIGN KEY (publisher_id) REFERENCES Publisher(publisher_id),
    FOREIGN KEY (engine_id)    REFERENCES GameEngine(engine_id)
);
```

**developer_id INT NOT NULL** and **publisher_id INT NOT NULL**
Both are required. The actual schema marks both as NOT NULL — every game must have both a developer and a publisher. The FKs use **default RESTRICT behavior** (no ON DELETE specified). This means:
- You cannot delete a Developer or Publisher that still has Game rows referencing them
- MySQL will reject the delete with a FK constraint error
- You must reassign or remove the games first — this is intentional, preventing silent data loss

**engine_id INT (nullable)**
Engine is optional — some games are built on proprietary in-house tech not worth adding to the system. Also uses default RESTRICT: if a GameEngine row is deleted while games reference it, MySQL rejects the delete.

**dev_budget_usd BIGINT**
BIGINT: up to ~9.2 × 10^18. Grand Theft Auto VI reportedly cost $2 billion. INT (max ~2.1 billion) would overflow for next-generation AAA budgets. Why not DECIMAL? Budgets are reported in whole USD — we don't need cents for figures measured in millions.

**base_price_usd DECIMAL(6,2) DEFAULT 0.00**
DECIMAL: exact numeric storage. Never use FLOAT for money — FLOAT uses binary IEEE 754 floating point, which cannot exactly represent $59.99. `FLOAT(59.99)` might store `59.98999786376953125`. DECIMAL(6,2) stores exactly 59.99. 6 total digits, 2 decimal places → max value $9999.99, which covers all game price points.

**metacritic_score INT CHECK (metacritic_score BETWEEN 0 AND 100)**
CHECK constraint: MySQL rejects any INSERT or UPDATE with score outside 0–100 at the storage level. Without CHECK: a backend bug could insert score=150. Every "top-rated games" query is now corrupted. The `validate_metacritic` trigger also catches this with a human-readable error message — two layers of defense.

**esrb_rating ENUM('E', 'E10+', 'T', 'M', 'AO', 'UNRATED')**
Note: the actual schema uses `'UNRATED'` as the default-pending value, not `'RP'` (Rating Pending). UNRATED means the game hasn't been submitted for rating yet.

**funding_source ENUM('SELF_FUNDED', 'PUBLISHER_FUNDED', 'CROWDFUNDED', 'GRANT', 'MIXED')**
Tracks how the game's development was financed. Affects ROI analysis — crowdfunded games have different financial obligations than publisher-funded ones.

**monetization_model ENUM('PREMIUM', 'F2P_COSMETIC', 'F2P_PAY2WIN', 'PREMIUM_PLUS_DLC', 'SUBSCRIPTION', 'MIXED')**
How the game generates ongoing revenue. PREMIUM = one-time purchase. F2P_COSMETIC = free with cosmetic purchases (ethical F2P, e.g., Fortnite). F2P_PAY2WIN = free with gameplay-affecting purchases. PREMIUM_PLUS_DLC = premium price plus paid expansions. Used by GetDLCStrategy to segment monetization patterns.

**on_subscription_day1 BOOLEAN DEFAULT FALSE**
Automatically set to TRUE by the `auto_subscription_flag` trigger when a GamePlatformListing row is inserted with `subscription_included = TRUE`. Tracks whether a game launched simultaneously on a subscription service — a key industry metric (day-one subscription launches correlate with lower premium sales but higher total player base).

---

### GameGenre — Bridge Table (M:N Resolution)

```sql
CREATE TABLE IF NOT EXISTS GameGenre (
    game_id    INT,
    genre_id   INT,
    is_primary BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (game_id, genre_id),
    FOREIGN KEY (game_id)  REFERENCES Game(game_id),
    FOREIGN KEY (genre_id) REFERENCES Genre(genre_id)
);
```

**Composite PRIMARY KEY (game_id, genre_id)**
The pair must be unique. Elden Ring + RPG can appear exactly once. Inserting it twice raises a duplicate key error. Without this: the same game could be classified in RPG a hundred times, making genre aggregations nonsense.

**Both FKs use default RESTRICT**
Deleting a Game that has GameGenre rows is blocked. Deleting a Genre that has GameGenre rows is blocked. You must clean up the bridge table first. This enforces referential integrity without hidden cascading deletes.

**is_primary BOOLEAN**
Elden Ring is primarily RPG, secondarily Action. This flag identifies the dominant classification. It belongs here — not in Game (Game can't store "which genre is primary" without an extra column per possible genre, which doesn't scale) and not in Genre (Genre doesn't know which game treats it as primary).

---

### GamePlatformListing — Bridge Table (M:N Resolution)

```sql
CREATE TABLE IF NOT EXISTS GamePlatformListing (
    listing_id            INT PRIMARY KEY AUTO_INCREMENT,
    game_id               INT NOT NULL,
    platform_id           INT NOT NULL,
    price_usd             DECIMAL(6,2),
    is_exclusive          BOOLEAN DEFAULT FALSE,
    subscription_included BOOLEAN DEFAULT FALSE,
    platform_release_date DATE,
    UNIQUE KEY (game_id, platform_id),
    FOREIGN KEY (game_id)    REFERENCES Game(game_id),
    FOREIGN KEY (platform_id) REFERENCES Platform(platform_id)
);
```

**Surrogate listing_id + UNIQUE (game_id, platform_id)**
A surrogate `listing_id` PK makes future external references to this row simple (single column). The UNIQUE constraint on `(game_id, platform_id)` still prevents the same game being listed on the same platform twice. Both mechanisms serve different purposes.

**price_usd nullable DECIMAL(6,2)**
Unlike `base_price_usd` in Game, platform listing price is nullable — a listing may be added before pricing is finalized. When populated, DECIMAL ensures exact representation.

**ON DELETE behavior: default RESTRICT**
Deleting a Game blocks deletion if GamePlatformListing rows exist for it. Deleting a Platform blocks deletion if listings reference it. Both require cleanup first — no silent data loss.

---

### DLC

```sql
CREATE TABLE IF NOT EXISTS DLC (
    dlc_id       INT PRIMARY KEY AUTO_INCREMENT,
    game_id      INT NOT NULL,
    title        VARCHAR(150),
    price_usd    DECIMAL(6,2),
    dlc_type     ENUM('STORY', 'COSMETIC', 'SEASON_PASS', 'SOUNDTRACK', 'UTILITY', 'BUNDLE'),
    release_date DATE,
    FOREIGN KEY (game_id) REFERENCES Game(game_id)
);
```

**dlc_type ENUM**
Six distinct business models: STORY (Blood and Wine — adds gameplay hours), COSMETIC (aesthetics only), SEASON_PASS (pre-bundles future content), SOUNDTRACK (sells music), UTILITY (adds features), BUNDLE (packages multiple items). These types are used by `GetDLCStrategy` to segment which DLC models work best for a given genre and price point.

**game_id FK — default RESTRICT**
You cannot delete a game while DLC records reference it. DLC is existentially dependent on its parent game, so this blocks orphaned DLC from ever being created through accidental parent deletion.

---

## 7. Business Logic in the Database

### Why Logic Belongs in the Database

If business logic lives only in Node.js:
1. Every client (mobile app, web app, direct SQL access) must re-implement the same rules
2. Multi-step operations risk partial failure across the network
3. Rules can be bypassed by connecting directly to MySQL

With stored procedures, functions, and triggers:
1. Logic runs centrally, enforced regardless of which client connects
2. Atomic transactions prevent partial state
3. Business rules hold even via direct SQL clients

---

### Stored Procedure 1: ClassifyGameTier

```sql
CALL ClassifyGameTier(p_game_id INT)
```

Scores a game across four dimensions and returns its production tier.

**Why a stored procedure and not a SELECT?**
Classification requires conditional branching — `IF/ELSEIF` chains that accumulate a score. SQL SELECT expressions can't do imperative branching and state accumulation. Procedural SQL is required.

**Scoring System:**

```
budget_score  (0–40):
  >= 100,000,000 → 40  (AAA minimum)
  >= 10,000,000  → 30  (AA range)
  >= 1,000,000   → 15  (funded indie)
  >= 100,000     →  7  (small indie)
  else           →  0  (hobbyist)

team_score    (0–25):
  >= 300 → 25   >= 100 → 20   >= 50 → 14
  >= 15  →  7   >=  3  →  3

publisher_score (0–20):
  MAJOR       → 20
  MID         → 12
  INDIE_LABEL →  5
  else        →  0

revenue_score (0–15):
  >= 500,000,000 → 15   >= 50,000,000 → 12
  >= 5,000,000   →  7   >= 500,000    →  3

Classification:
  total >= 70 → AAA
  total >= 40 → AA
  total >= 15 → INDIE
  else        → HOBBYIST
```

**Elden Ring (game_id=2):**
Budget $200M → 40 + Team 300 → 25 + Bandai Namco MAJOR → 20 + Revenue $1.2B → 15 = **100 → AAA**

**Hades (game_id=3):**
Budget unknown → 0 + Team ~20 → 3 + SELF_PUBLISHED → 0 + Revenue ~$100M → 12 = **15 → INDIE**

**Output:** Returns `tier`, `total_score`, and all four component scores as a result set.

---

### Stored Procedure 2: GetGenreOpportunity

```sql
CALL GetGenreOpportunity(p_budget BIGINT, p_team_size INT)
```

Given your budget and team size, finds which genres produce the highest average revenue among comparable games.

**The filter:**
```sql
WHERE g.dev_budget_usd BETWEEN p_budget * 0.1 AND p_budget * 10
  AND g.team_size_at_launch BETWEEN p_team_size * 0.2 AND p_team_size * 5
```

Creates a "comparable games" bucket: 10× range on budget, 5× range on team size. Wide intentionally — budget alone doesn't determine output quality.

**Output:** Genres ranked by `avg_revenue DESC` — the first result is the genre where comparable teams historically earn the most money.

**Why a procedure?** The ratio math, multi-table join, and grouping logic is complex enough that it shouldn't be duplicated across every API endpoint that needs it.

---

### Stored Procedure 3: GetDeveloperBenchmark

```sql
CALL GetDeveloperBenchmark(p_developer_name VARCHAR(100))
```

Compares a developer's performance against similar-budget studios.

**Internal logic:**
```sql
-- Step 1: calculate the target developer's average budget
SELECT AVG(dev_budget_usd) INTO v_avg_budget
FROM Game g JOIN Developer d ON g.developer_id = d.developer_id
WHERE d.name = p_developer_name;

-- Step 2: find all developers whose avg budget is within 0.5x–2x of that value
SELECT d.name, COUNT(g.game_id), AVG(g.metacritic_score),
       AVG(g.revenue_est_usd), AVG(g.copies_sold_est), AVG(g.user_review_pct)
FROM Developer d JOIN Game g ON d.developer_id = g.developer_id
GROUP BY d.developer_id
HAVING AVG(g.dev_budget_usd) BETWEEN v_avg_budget * 0.5 AND v_avg_budget * 2
ORDER BY avg_score DESC;
```

**Why this matters:** A solo indie developer shouldn't benchmark against Rockstar. This procedure isolates peers by financial scale and ranks them by quality (avg Metacritic). Answers: "Am I outperforming or underperforming my peers?"

**Key SQL concept used:** `HAVING` filters after `GROUP BY`. You cannot use `WHERE` with aggregate functions — `WHERE AVG(...)` is a syntax error. `HAVING` exists precisely for this: filtering aggregated groups.

---

### Stored Procedure 4: GetDLCStrategy

```sql
CALL GetDLCStrategy(p_genre VARCHAR(60), p_base_price DECIMAL(6,2))
```

For a given genre and base price range, analyzes which DLC types work best.

**The query:**
```sql
SELECT d.dlc_type,
       COUNT(d.dlc_id)       AS dlc_count,
       AVG(d.price_usd)      AS avg_dlc_price,
       AVG(g.user_review_pct) AS avg_review_with_dlc
FROM DLC d
JOIN Game g  ON d.game_id = g.game_id
JOIN GameGenre gg ON g.game_id = gg.game_id
JOIN Genre gn ON gg.genre_id = gn.genre_id
WHERE gn.name = p_genre
  AND g.base_price_usd BETWEEN p_base_price * 0.5 AND p_base_price * 2
GROUP BY d.dlc_type
ORDER BY dlc_count DESC;
```

**Output:** DLC types ranked by frequency (`dlc_count DESC`), with average price and average user review score for games that have each DLC type. Tells a developer: "For RPG games priced around $60, STORY DLC is the most common and SEASON_PASS gets the best user review correlation."

**Why four-table join?** DLC → Game → GameGenre → Genre. This chain is necessary because DLC doesn't directly know its genre — the genre belongs to the Game, accessed through the GameGenre bridge.

---

### Stored Procedure 5: RegisterGameComplete (Transactional)

```sql
CALL RegisterGameComplete(p_title, p_developer_id, p_publisher_id,
                          p_genre_id, p_platform_id, p_price)
```

Atomically inserts a complete game record across three tables.

**The transaction block (actual code):**
```sql
DECLARE EXIT HANDLER FOR SQLEXCEPTION
BEGIN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transaction Failed: Game Registration Aborted.';
END;

START TRANSACTION;

    INSERT INTO Game (title, developer_id, publisher_id, base_price_usd)
    VALUES (p_title, p_developer_id, p_publisher_id, p_price);

    SET @new_game_id = LAST_INSERT_ID();

    INSERT INTO GameGenre (game_id, genre_id, is_primary)
    VALUES (@new_game_id, p_genre_id, TRUE);

    INSERT INTO GamePlatformListing (game_id, platform_id, price_usd)
    VALUES (@new_game_id, p_platform_id, p_price);

COMMIT;

SELECT @new_game_id AS registered_game_id, 'SUCCESS' AS status;
```

**Why `LAST_INSERT_ID()`?**
After the Game INSERT with AUTO_INCREMENT, the newly generated `game_id` must be captured immediately for the bridge table inserts. `LAST_INSERT_ID()` returns the ID generated by the most recent INSERT **on this connection**. It is connection-scoped — no race condition possible even with 1000 concurrent insertions.

**What if no transaction was used?**
```
INSERT Game  → succeeds (game_id=5 created)
INSERT GameGenre → fails (genre_id=999 doesn't exist → FK violation)
```
Game row exists but has no genre or platform. Queries on GameIntelligenceSummary show a ghost game. ROLLBACK undoes the Game insert — database returns to its pre-call state.

**EXIT HANDLER vs RESIGNAL:**
The actual code uses `SIGNAL SQLSTATE '45000'` with a custom message after ROLLBACK — the caller receives a clean, human-readable error. The transaction is fully unwound before the error propagates.

---

### Scalar Function: CalculateROI

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

**Formula:** `((revenue - budget) / budget) × 100`

**Examples:**
- Elden Ring: `((1,200,000,000 − 200,000,000) / 200,000,000) × 100 = 500.00%`
- The Witcher 3: `((500,000,000 − 81,000,000) / 81,000,000) × 100 = 517.28%`

**The NULL/zero guard:**
Without it, `p_budget = 0` causes division-by-zero → MySQL error. `p_budget = NULL` causes the entire expression to return NULL — not useful. The guard returns `0.00` as a safe default meaning "ROI not calculable."

**DETERMINISTIC keyword:** Tells MySQL this function always returns the same output for the same inputs — no side effects, no random/time-based behavior. Allows the optimizer to cache calls with identical parameters.

**Why a function and not a procedure?**
Functions return a scalar value usable inline in SELECT:
```sql
SELECT title, CalculateROI(revenue_est_usd, dev_budget_usd) AS roi FROM Game;
```
Procedures cannot be embedded in SELECT expressions.

---

### Triggers — All Four

#### Trigger 1: before_game_insert

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

**Problem it solves:** A developer inserts a game with `base_price_usd = 0` but forgets to set `is_free_to_play = TRUE`. The data is now inconsistent — the game is free but not flagged. The `GetDLCStrategy` procedure and monetization analytics would misclassify it.

**BEFORE vs AFTER:** BEFORE INSERT fires before the row is written, allowing `NEW.column` values to be modified before storage. AFTER INSERT fires after — too late to change the row being inserted.

#### Trigger 2: validate_metacritic

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

Note: the actual code does **not** include a NULL check — `NULL metacritic_score` passes through without error (NULL comparisons in SQL evaluate to UNKNOWN, not TRUE). Only non-NULL out-of-range values are rejected.

**Why a trigger when CHECK constraint exists?** CHECK provides a generic error. The trigger provides a custom message: "Metacritic score must be between 0 and 100". When Node.js catches the SQL error and logs it, the custom message makes diagnosis instant. Defense-in-depth.

**SIGNAL SQLSTATE '45000':** User-defined error that aborts the INSERT and propagates the message to the caller.

#### Trigger 3: prevent_negative_price

```sql
CREATE TRIGGER prevent_negative_price
BEFORE INSERT ON GamePlatformListing
FOR EACH ROW
BEGIN
    IF NEW.price_usd < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Price cannot be negative';
    END IF;
END;
```

MySQL CHECK constraints on DECIMAL columns are valid in MySQL 8.0+, but this trigger provides the explicit error message. A negative price is a sign of data entry error or a backend bug — it must be caught before storage.

#### Trigger 4: auto_subscription_flag

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

**Why AFTER INSERT?** This trigger updates a different table (Game). It doesn't modify the row being inserted — it reacts to a confirmed insertion and propagates a flag. AFTER is correct because we need the GamePlatformListing row to exist first (the UPDATE reads `NEW.game_id`).

**What it prevents:** Having to manually update `Game.on_subscription_day1` every time a subscription-enabled platform listing is added. Any client — direct SQL, API, migration script — triggers this automatically.

---

### Views — All Six

Views are named, pre-written queries. They store no data — they execute the underlying query each time they're selected from.

#### View 1: GameIntelligenceSummary

```sql
SELECT g.game_id, g.title, g.release_date, g.base_price_usd, g.metacritic_score,
       g.user_review_pct, g.revenue_est_usd, g.copies_sold_est, g.award_count,
       d.name AS developer_name, d.team_size,
       p.name AS publisher_name, p.tier AS publisher_tier,
       e.name AS engine_name, e.typical_scale AS engine_scale
FROM Game g
JOIN Developer d ON g.developer_id = d.developer_id
JOIN Publisher p ON g.publisher_id = p.publisher_id
LEFT JOIN GameEngine e ON g.engine_id = e.engine_id;
```

**Why INNER JOIN for Developer and Publisher, but LEFT JOIN for GameEngine?**
Both `developer_id` and `publisher_id` are NOT NULL in Game — every game is guaranteed to have matching rows in both tables. INNER JOIN is safe and slightly faster. `engine_id` is nullable — a game without an engine entry would disappear from INNER JOIN results. LEFT JOIN keeps all games visible even when engine is unspecified.

#### View 2: GenrePerformance

```sql
SELECT gn.name AS genre,
       COUNT(g.game_id) AS game_count,
       AVG(g.revenue_est_usd) AS avg_revenue,
       AVG(g.metacritic_score) AS avg_score,
       AVG(g.user_review_pct) AS avg_user_review,
       AVG(g.base_price_usd) AS avg_price
FROM Genre gn
JOIN GameGenre gg ON gn.genre_id = gg.genre_id
JOIN Game g ON gg.game_id = g.game_id
WHERE gg.is_primary = TRUE
GROUP BY gn.name;
```

`WHERE gg.is_primary = TRUE` — only counts the genre when it's the game's primary classification. Without this filter, Elden Ring would contribute to both RPG and Action counts, skewing both genre averages.

#### View 3: PublisherImpact

```sql
SELECT p.name AS publisher_name, p.tier,
       COUNT(g.game_id) AS total_games,
       AVG(g.revenue_est_usd) AS avg_revenue,
       AVG(g.metacritic_score) AS avg_score,
       AVG(g.copies_sold_est) AS avg_copies
FROM Publisher p
JOIN Game g ON p.publisher_id = g.publisher_id
GROUP BY p.publisher_id;
```

Answers: "Which publisher tier produces the highest average revenue?" or "How does Bandai Namco compare to CD Projekt in average Metacritic score?"

#### View 4: EngineIntelligence

```sql
SELECT e.name AS engine_name, e.license_type, e.typical_scale,
       COUNT(g.game_id) AS game_count,
       AVG(g.base_price_usd) AS avg_price,
       AVG(g.metacritic_score) AS avg_score,
       AVG(g.revenue_est_usd) AS avg_revenue
FROM GameEngine e
JOIN Game g ON e.engine_id = g.engine_id
GROUP BY e.engine_id;
```

Answers: "Do ROYALTY-license engines (Unreal) produce higher-scoring games than PROPRIETARY engines?" Useful for engine adoption decisions.

#### View 5: DLCMonetization

```sql
SELECT g.title, p.tier AS publisher_tier,
       COUNT(d.dlc_id) AS dlc_count,
       SUM(d.price_usd) AS total_dlc_value,
       AVG(d.price_usd) AS avg_dlc_price,
       g.user_review_pct
FROM Game g
JOIN Publisher p ON g.publisher_id = p.publisher_id
LEFT JOIN DLC d ON g.game_id = d.game_id
GROUP BY g.game_id;
```

**Why LEFT JOIN for DLC?** Games with no DLC would disappear from INNER JOIN results. LEFT JOIN keeps all games — games with zero DLC appear with `dlc_count = 0`. This is essential for comparing DLC-heavy vs DLC-free games.

#### View 6: PlatformPricing

```sql
SELECT g.title, pl.name AS platform_name,
       gpl.price_usd, gpl.is_exclusive, gpl.subscription_included
FROM Game g
JOIN GamePlatformListing gpl ON g.game_id = gpl.game_id
JOIN Platform pl ON gpl.platform_id = pl.platform_id;
```

Answers: "What is Elden Ring's price on each platform? Is it exclusive anywhere? Is it on Game Pass?" Three-table join traversing the M:N resolution.

---

## 8. End-to-End Data Flow

### Scenario: Registering Elden Ring via API

**Step 1: React Frontend**
```javascript
const formData = { title: "Elden Ring", developer_id: 2, publisher_id: 2,
                   genre_id: 1, platform_id: 1, price: 59.99 };
await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
});
```

**Step 2: Node.js Express Handler**
```javascript
app.post('/api/games', async (req, res) => {
    const { title, developer_id, publisher_id, genre_id, platform_id, price } = req.body;
    const [result] = await pool.execute(
        'CALL RegisterGameComplete(?, ?, ?, ?, ?, ?)',
        [title, developer_id, publisher_id, genre_id, platform_id, price]
    );
    res.json({ success: true, data: result });
});
```

**Step 3: MySQL Engine Execution**
1. Parses `CALL RegisterGameComplete(...)` — verifies procedure exists, maps parameters
2. `DECLARE EXIT HANDLER` registered — any SQLEXCEPTION triggers ROLLBACK + SIGNAL
3. `START TRANSACTION` — opens a transaction context
4. `INSERT INTO Game (...)` executes:
   - `before_game_insert` BEFORE trigger: checks if `base_price_usd = 0` → sets `is_free_to_play`
   - `validate_metacritic` BEFORE trigger: checks score range
   - Row written to Game B-Tree clustered index
5. `SET @new_game_id = LAST_INSERT_ID()` — captures game_id=2 for this connection
6. `INSERT INTO GameGenre (2, 1, TRUE)` — bridge row created; FK checked against Game and Genre
7. `INSERT INTO GamePlatformListing (2, 1, 59.99)`:
   - `prevent_negative_price` BEFORE trigger: validates price
   - `auto_subscription_flag` AFTER trigger: if subscription_included=TRUE, updates Game
8. `COMMIT` — all changes written to WAL (Write-Ahead Log), visible to other connections
9. Returns `registered_game_id=2, status='SUCCESS'`

**Step 4: Response Chain**
```
MySQL → mysql2 → Node.js → JSON → React → setGames() → re-render
```

---

## 9. Query Execution & JOIN Internals

### How a JOIN Works Physically

MySQL uses three physical join algorithms:

**1. Nested Loop Join (default with indexes)**
```
For each row in outer table A:
    Use index on inner table B to find matching rows
    If match found: include in result set
```
With an index on the join column: O(N × log M). Without index: O(N × M) — catastrophic for large tables.

**2. Hash Join (MySQL 8.0+, large tables without indexes)**
1. Build an in-memory hash table from the smaller table
2. Probe the hash table for each row of the larger table
Useful when indexes don't exist. O(N + M) time but requires memory for the hash table.

**3. Sort-Merge Join**
Both sides sorted on the join key, then merged linearly. Used when both sides are large, pre-sorted, or sorted indexes exist.

### INNER JOIN vs LEFT JOIN — The Real Difference

```sql
-- INNER JOIN: only rows with matches on BOTH sides
SELECT g.title, ge.name AS engine
FROM Game g
INNER JOIN GameEngine ge ON g.engine_id = ge.engine_id;
-- Games with engine_id = NULL DISAPPEAR from results silently.
```

```sql
-- LEFT JOIN: ALL rows from the left table; NULL for unmatched right side
SELECT g.title, ge.name AS engine
FROM Game g
LEFT JOIN GameEngine ge ON g.engine_id = ge.engine_id;
-- Games with engine_id = NULL appear with engine = NULL.
```

**The GameIntelligenceSummary view uses:**
- `JOIN Developer` (INNER) — `developer_id` is NOT NULL, match guaranteed
- `JOIN Publisher` (INNER) — `publisher_id` is NOT NULL, match guaranteed
- `LEFT JOIN GameEngine` — `engine_id` is nullable, games without engines must still appear

**What wrong join type costs you:**
```sql
-- MISTAKE: INNER JOIN on nullable FK
SELECT g.title FROM Game g
INNER JOIN GameEngine ge ON g.engine_id = ge.engine_id;
-- Games built on unregistered/proprietary engines vanish.
-- Dashboard shows fewer games than exist. No error. Silent data loss.
```

### SQL Execution Order

The order you write SQL ≠ the order MySQL executes it:

```
1. FROM + JOIN      → build the full joined row set
2. WHERE            → filter individual rows (before grouping)
3. GROUP BY         → collapse rows into groups
4. HAVING           → filter groups (after aggregation)
5. SELECT           → compute output expressions
6. ORDER BY         → sort the final result
7. LIMIT/OFFSET     → truncate result
```

**WHERE vs HAVING:**
- `WHERE metacritic_score > 80` — filters individual game rows before grouping
- `HAVING AVG(metacritic_score) > 80` — filters genre groups after aggregating

You cannot write `WHERE AVG(metacritic_score) > 80` — MySQL will reject it. Aggregates are computed at step 4, which is after WHERE.

### Cartesian Product (What Happens Without ON Clause)

```sql
SELECT * FROM Game, GameGenre;  -- missing JOIN condition
-- Returns: 3 games × 5 genre mappings = 15 rows
-- Every game paired with every genre mapping — all nonsensical
```

MySQL processes this as a CROSS JOIN. The result is the product of both table sizes. At scale (10,000 games × 50,000 genre mappings), this returns 500 million rows and likely crashes the query.

---

## 10. Transactions & ACID Reliability

### ACID Applied to GameOn

**Atomicity — All or Nothing**

`RegisterGameComplete` inserts three rows across three tables. Either all three commit, or none do.

Failure scenario:
```
START TRANSACTION;
  INSERT Game  → succeeds (game_id=5 generated)
  INSERT GameGenre → FAILS (genre_id=999 → FK violation)
  -- EXIT HANDLER fires:
    ROLLBACK; → Game row with game_id=5 is fully removed
    SIGNAL; → error propagated to Node.js caller
```

The database is exactly as it was before the procedure was called. No ghost game, no dangling bridge records.

**Consistency — Rules Always Enforced**

Before transaction: 2 games, all FKs valid, all constraints satisfied.
After transaction: either 3 games (all rules satisfied) or still 2 games (no partial state).

Consistency constraints in GameOn:
- `metacritic_score CHECK (BETWEEN 0 AND 100)` — no illegal scores persist
- `developer_id NOT NULL` + FK → no game without a real developer
- `publisher_id NOT NULL` + FK → no game without a real publisher
- Triggers → `is_free_to_play` always matches `base_price_usd = 0`

**Isolation — Concurrent Transactions Don't Corrupt Each Other**

Two developers register games simultaneously:
- Connection A: inserts "Cyberpunk 2" → gets game_id=4 via `LAST_INSERT_ID()`
- Connection B: inserts "Dark Souls 4" → gets game_id=5 via `LAST_INSERT_ID()`

`LAST_INSERT_ID()` is **connection-scoped**. Connection A's call returns 4. Connection B's call returns 5. They never see each other's IDs.

MySQL InnoDB default isolation level: **REPEATABLE READ**. Within a transaction, you always see the same snapshot of data. No dirty reads (reading another transaction's uncommitted changes).

**Durability — Committed = Permanent**

Once `COMMIT` executes, MySQL writes the changes to the Write-Ahead Log (WAL) on disk before acknowledging success. If the server crashes immediately after COMMIT, the changes survive. On restart, InnoDB replays the WAL to restore committed state.

### Dirty Read — Explained

- Transaction A: `UPDATE Game SET revenue_est_usd = 2000000000 WHERE game_id = 2` (not yet committed)
- Transaction B: reads Elden Ring's revenue → sees **$1.2B** (last committed value)
- Transaction A: rolls back
- Transaction B never saw the uncommitted $2B — it was never real

InnoDB's REPEATABLE READ prevents this by maintaining version snapshots (MVCC — Multi-Version Concurrency Control). Each transaction reads a consistent snapshot of the data as of its start time.

### Auto-Increment and ROLLBACK

```
START TRANSACTION;
  INSERT INTO Game (...) → game_id=5 allocated
  INSERT INTO GameGenre → FAILS
  ROLLBACK; → game_id=5 row removed
Next INSERT INTO Game → gets game_id=6
```

The auto-increment counter does NOT roll back. This is intentional: rolling back the counter would require a global lock, serializing all inserts — catastrophic for performance. Gaps in the sequence are fine. `game_id` is a surrogate key with no business meaning — requiring gapless sequences is a design error.

---

## 11. Performance & Optimization

### B-Tree Index Internals

A B-Tree (Balanced Tree) maintains sorted order with O(log N) search, insert, and delete.

Properties:
- **Balanced**: every leaf node is at the same depth
- **Ordered**: values sorted left-to-right
- **Self-maintaining**: insertions/deletions trigger automatic rebalancing

For `idx_metacritic ON Game(metacritic_score)`:

```
              [50]
           /        \
        [25]         [75]
       /    \       /    \
    [10,20] [30,40] [60,70] [80,96]
```

Query: `SELECT * FROM Game WHERE metacritic_score > 85`
1. Root [50]: 85 > 50 → right
2. Node [75]: 85 > 75 → right
3. Leaf [80, 96]: 85 falls here → return 96
4. **3 comparisons total.** Full scan: up to N comparisons.

At 1,000,000 rows: B-Tree depth ≈ log₂(1,000,000) ≈ 20 levels. Maximum 20 comparisons.

### EXPLAIN — Reading MySQL's Query Plan

```sql
EXPLAIN SELECT g.title, d.name AS developer
FROM Game g
JOIN Developer d ON g.developer_id = d.developer_id
WHERE g.metacritic_score > 85;
```

| Column | Meaning |
|---|---|
| `type` | `ref` or `range` = index used. `ALL` = full table scan (bad). |
| `key` | Which index MySQL chose. NULL = no index. |
| `rows` | Estimated rows examined. Should be << table size. |
| `Extra` | `Using index` = covering index (very fast). `Using filesort` = ORDER BY not using index. |

**Red flags:**
- `type = ALL` with large `rows` → add an index
- `Extra = Using filesort` → add index on the ORDER BY column
- `key = NULL` → query isn't using any index

**The leading-wildcard problem:**
```sql
EXPLAIN SELECT * FROM Game WHERE title LIKE '%Ring%';
-- type = ALL even with idx_game_title
```
A leading `%` means MySQL can't find where the pattern starts in a sorted B-Tree. The entire index is useless. Solution: use prefix match `LIKE 'Elden%'` (can use the index), or implement full-text search with `MATCH ... AGAINST`.

### Index Trade-offs

**Write cost:** Every INSERT/UPDATE/DELETE on an indexed column must update the B-Tree. Three indexes on Game = three additional tree updates per game insert.

**Space cost:** Each index stores a copy of the indexed column value plus a PK pointer. At 1M rows, `idx_metacritic` ≈ 4 bytes × 1M rows ≈ 4MB — negligible.

**When NOT to index:**
- `is_free_to_play` (BOOLEAN): only 2 distinct values. An index returning 50% of all rows provides no benefit over a full scan, and adds write overhead.
- Columns never used in WHERE, JOIN ON, or ORDER BY.

---

## 12. Backend Integration — Node.js

### Connection Pool Architecture

```javascript
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
module.exports = pool;
```

**Why a pool (not a single connection)?**
A single connection executes one query at a time. 100 simultaneous API requests → 99 wait. A pool of 10 connections lets 10 execute in parallel, 90 queue. Without `connectionLimit`, 1000 concurrent requests create 1000 connections — MySQL's default limit is 151, so this crashes the server.

**`waitForConnections: true`:** When all 10 are busy, new requests queue instead of failing. `queueLimit: 0` = unbounded queue.

**Connection lifecycle:**
1. Request arrives → pool assigns or creates a connection (up to limit)
2. Query executes
3. Connection returned to pool (not closed — reused by next request)
4. No TCP handshake overhead on reuse — significant latency saving

**`ssl: { rejectUnauthorized: false }`:** Aiven Cloud uses a self-signed certificate. This flag tells the TLS layer to accept it. In production with a CA-verified cert, this would be `true`.

**`multipleStatements: true`:** Allows `execute_setup.js` to execute the entire `setup_db.sql` file (400+ statements) in one call. Without this, only the first statement runs.

### Parameterized Queries — SQL Injection Prevention

**The vulnerability:**
```javascript
// NEVER DO THIS
const query = `SELECT * FROM Game WHERE title = '${req.query.title}'`;
```

Attack input: `title = "' OR '1'='1"`
```sql
SELECT * FROM Game WHERE title = '' OR '1'='1'
-- Returns every row. Complete database exposure.
```

Attack input: `title = "'; DROP TABLE Game; --"`
```sql
SELECT * FROM Game WHERE title = ''; DROP TABLE Game; --'
-- Table destroyed.
```

**The correct approach:**
```javascript
const [rows] = await pool.execute(
    'SELECT * FROM Game WHERE title = ?',
    [req.query.title]
);
```

`mysql2` sends the query template and parameter values as separate protocol messages to MySQL. MySQL compiles the template first, then binds the parameter as a data value — not as SQL code. SQL syntax in the parameter value is treated as a literal string, not executable SQL.

```
Query template:  SELECT * FROM Game WHERE title = ?
Parameter value: "' OR '1'='1"
MySQL sees:      A game search for a title that literally is "' OR '1'='1"
Result:          Empty set — no game has that title. No data exposed.
```

### .env — Credential Isolation

```
DB_HOST=multiverse-db-dbms-project01.f.aivencloud.com
DB_PORT=12757
DB_USER=avnadmin
DB_PASS=AVNS_yNSbXZUpBiSKR1C5_xH
DB_NAME=gameondb
```

Why `.env` and not hardcoded?
1. `.gitignore` excludes `.env` — credentials never reach the GitHub repository
2. Each environment (local dev, staging, production) has its own `.env`
3. Credential rotation: change one file, not every hardcoded occurrence
4. `require('dotenv').config()` loads into `process.env` at runtime

### execute_setup.js — Schema Bootstrap

```javascript
const sql = fs.readFileSync('./sql/setup_db.sql', 'utf8');
await db.query(sql);  // executes all 400+ statements as a batch
const [tables] = await db.query('SHOW TABLES FROM obsyria');
console.log('Tables created:', tables.map(t => Object.values(t)[0]));
```

After schema creation, the script verifies by listing created tables — immediate feedback if any CREATE TABLE failed.

---

## 13. Frontend Interaction — React

> The React frontend is planned but not yet implemented. This section describes the intended integration architecture.

### User Actions → SQL Queries

**Genre filter dropdown:**
```
User selects "RPG"
→ React state: { genre: 'RPG' }
→ useEffect: fetch('/api/games?genre=RPG')
→ Node.js: SELECT * FROM GameIntelligenceSummary WHERE genre_name = ?  ['RPG']
→ JSON array returned
→ React renders filtered game cards
```

**Title search:**
```
User types "Elden"
→ 300ms debounce fires
→ fetch('/api/games?search=Elden')
→ Node.js: SELECT * FROM Game WHERE title LIKE ?  ['Elden%']
→ idx_game_title B-Tree prefix scan
→ Matching rows returned
```

**Why debounce?** Typing "Elden Ring" fires one character at a time: E, El, Eld... Without debounce: 10 queries per word. With 300ms debounce: only the final value fires a query, after the user pauses typing.

### State Management Pattern

```javascript
const [games, setGames] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const fetchGames = async (filters) => {
    setLoading(true);
    try {
        const params = new URLSearchParams(filters);
        const res = await fetch(`/api/games?${params}`);
        const data = await res.json();
        setGames(data);
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
};
```

Three states: data, loading, error. Loading state shows a spinner while the query runs. Error state surfaces DB or network failures as a message instead of a blank screen.

### Dynamic Filter → Dynamic SQL (Server Side)

```javascript
let query = 'SELECT * FROM GameIntelligenceSummary WHERE 1=1';
const params = [];

if (filters.genre)    { query += ' AND publisher_tier = ?';    params.push(filters.genre); }
if (filters.minScore) { query += ' AND metacritic_score >= ?'; params.push(filters.minScore); }
if (filters.platform) { query += ' AND platform_name = ?';     params.push(filters.platform); }
if (filters.sortBy)   { query += ` ORDER BY ${whitelist(filters.sortBy)} ${filters.sortDir}`; }
```

`WHERE 1=1` makes every filter appendable as `AND ...` without needing to special-case the first condition.

**Column name injection prevention:** `sortBy` cannot be parameterized (column names are not SQL values). Server must whitelist: `['metacritic_score', 'revenue_est_usd', 'release_date']`. Any other value → reject the request.

---

## 14. Failure & Edge Cases

### Constraint Violation Chain

**Bad Metacritic score:**
```sql
INSERT INTO Game (title, developer_id, publisher_id, metacritic_score) VALUES ('Test', 1, 1, 150);
```
1. BEFORE INSERT: `validate_metacritic` fires → 150 > 100 → SIGNAL '45000'
2. INSERT aborted. Zero rows written.
3. CHECK constraint would independently catch it if trigger didn't exist.
4. `pool.execute()` throws; Express `catch` block fires.
5. API returns `400 Bad Request` with message "Metacritic score must be between 0 and 100".
6. React displays error toast.

**Non-existent FK:**
```sql
INSERT INTO Game (title, developer_id, publisher_id) VALUES ('Ghost', 999, 1);
-- developer_id=999 doesn't exist
```
1. MySQL checks FK constraint before writing
2. No row with developer_id=999 in Developer → FK violation error
3. Insert aborted, error returned to Node.js

### Foreign Key Delete Failures

**Delete a Developer that has games:**
```sql
DELETE FROM Developer WHERE developer_id = 2;  -- FromSoftware, owns Elden Ring
```
1. Game has rows where `developer_id = 2`
2. FK on `Game.developer_id` uses default RESTRICT behavior
3. MySQL refuses: "Cannot delete or update a parent row: a foreign key constraint fails"
4. You must reassign or delete Elden Ring (and all other FromSoftware games) first

**Delete a Genre that has sub-genres:**
```sql
DELETE FROM Genre WHERE genre_id = 1;  -- RPG, parent of Soulslike
```
1. Genre has rows where `parent_genre_id = 1` (Soulslike, Open World RPG)
2. FK on `Genre.parent_genre_id` uses default RESTRICT
3. MySQL refuses
4. You must reassign or delete sub-genres first

**Delete a Platform with active listings:**
```sql
DELETE FROM Platform WHERE platform_id = 1;  -- Steam
```
1. GamePlatformListing has rows with `platform_id = 1`
2. FK on `GamePlatformListing.platform_id` uses default RESTRICT
3. MySQL refuses

### Concurrent Updates

**Two admins update Elden Ring's revenue simultaneously:**
```
Connection A: UPDATE Game SET revenue_est_usd = 1300000000 WHERE game_id = 2;
Connection B: UPDATE Game SET revenue_est_usd = 1250000000 WHERE game_id = 2;
```
InnoDB uses row-level locking. Connection A acquires a write lock on game_id=2. Connection B waits until A commits. The final value is whichever committed last — deterministic, no corruption.

**Two simultaneous RegisterGameComplete calls:**
Both read `LAST_INSERT_ID()` after their inserts. Because `LAST_INSERT_ID()` is connection-scoped, Connection A gets its ID and Connection B gets its own — they never overlap.

### Connection Drop Mid-Transaction

```javascript
try {
    const [result] = await pool.execute('CALL RegisterGameComplete(...)');
} catch (err) {
    // err.code = 'ECONNRESET' or 'PROTOCOL_CONNECTION_LOST'
    res.status(503).json({ error: 'Database temporarily unavailable' });
}
```

If the TCP connection drops while a transaction is open:
- InnoDB detects the disconnected session
- Any uncommitted transaction is automatically rolled back
- The pool creates a new connection on the next request
- No partial data ever committed

---

## 15. Viva Attack Questions — Answered

**Q: Why not use NoSQL (MongoDB) for this system?**
A: GameOn's data is highly structured with fixed relationships between well-defined entities. NoSQL has no FK enforcement, no cross-collection transactions (without MongoDB 4.0+ multi-document transactions), and no JOIN operations. Genres would have to be embedded inside Game documents, making genre-level analytics (GenrePerformance view, GetGenreOpportunity procedure) impossible without scanning every game document. Relational DB is the correct tool for structured, relational, analytically-queried data.

---

**Q: What is a candidate key? Give an example from GameOn.**
A: A candidate key is any minimal set of columns that uniquely identifies every row. In GamePlatformListing, `(game_id, platform_id)` is a candidate key — the UNIQUE constraint enforces it. `listing_id` is also a candidate key (chosen as PK). Both could serve as the primary key; we chose `listing_id` as the surrogate PK for simpler external references.

---

**Q: What is the difference between DELETE and TRUNCATE?**
A: DELETE is DML — removes rows one at a time, fires all row-level triggers, respects FK constraints, can be rolled back inside a transaction. TRUNCATE is DDL — drops and recreates the table, bypasses row-level triggers, ignores FK constraints in most contexts, and is not reliably rollback-safe in MySQL. For GameOn: `DELETE FROM Game` would fire `before_game_insert`, cascade validation triggers, and be blocked by RESTRICT FKs. `TRUNCATE Game` would bypass all of this — dangerous in a production system with FK relationships.

---

**Q: What is a dirty read? Is GameOn affected?**
A: A dirty read is when Transaction B reads data written by Transaction A before A has committed — B sees data that may still be rolled back. InnoDB's REPEATABLE READ isolation level prevents dirty reads using MVCC (Multi-Version Concurrency Control). Every transaction reads a snapshot of committed data from its start time. GameOn's transactions are fully protected from dirty reads.

---

**Q: Why are both developer_id and publisher_id NOT NULL in Game?**
A: Every game must have both a developer (the team that built it) and a publisher (the entity that distributes it). Even self-published games have a publisher — the SELF_PUBLISHED publisher record represents that case. Allowing either to be NULL would permit inserting games without a traceable origin or publisher relationship, breaking ClassifyGameTier (which reads publisher tier for scoring) and PublisherImpact analytics.

---

**Q: Explain ON DELETE behavior for all FKs in GameOn.**
A: All FK constraints in the actual `setup_db.sql` use the **default behavior: RESTRICT** (no explicit ON DELETE clause specified). This means:
- Cannot delete a Developer while games reference it
- Cannot delete a Publisher while games reference it
- Cannot delete a GameEngine while games reference it
- Cannot delete a Genre while sub-genres or GameGenre records reference it
- Cannot delete a Game while GameGenre, GamePlatformListing, or DLC records reference it
- Cannot delete a Platform while GamePlatformListing records reference it

All parent rows are protected from deletion until their children are cleaned up first. This is the most conservative and safe referential integrity strategy.

---

**Q: How does `LAST_INSERT_ID()` work and why doesn't it have race conditions?**
A: `LAST_INSERT_ID()` returns the auto-incremented ID generated by the **most recent INSERT in the current connection**. It is stored in the connection's own internal state by the InnoDB engine immediately after each auto-increment insert. It is not a global variable — it's per-connection. Even with 1000 simultaneous inserts across 1000 connections, each connection's `LAST_INSERT_ID()` call returns only that connection's generated ID. No locking is required for this operation.

---

**Q: Why is an index on `is_free_to_play` useless?**
A: B-Tree indexes are efficient when indexed columns have high cardinality (many distinct values). A BOOLEAN has exactly two values (TRUE/FALSE). An index scan that returns ~50% of all rows offers no advantage over a full table scan — the overhead of traversing the index plus fetching the rows actually makes it slower. MySQL's query optimizer would ignore such an index and perform a full scan anyway.

---

**Q: What happens to the AUTO_INCREMENT counter after a ROLLBACK?**
A: AUTO_INCREMENT does NOT roll back. If game_id=5 is generated by an INSERT that is then rolled back, the counter stays at 5 — the next successful INSERT gets game_id=6. This is intentional: rolling back the counter would require a global counter lock that serializes all concurrent inserts, destroying concurrency. Surrogate keys are meaningless identifiers — gaps in the sequence are harmless and expected.

---

**Q: What is 2NF? Give a specific violation example from GameOn.**
A: 2NF requires every non-key column in a composite-PK table to depend on the entire primary key, not just part of it. Violation scenario: if we added `game_title VARCHAR(150)` to GameGenre `(game_id, genre_id, is_primary, game_title)` — `game_title` depends only on `game_id`, not on `genre_id`. That's a partial dependency — 2NF violation. Fix: `game_title` belongs only in Game. GameGenre stores only data about the game-genre relationship itself.

---

**Q: Why DECIMAL(6,2) for price and not FLOAT?**
A: FLOAT uses binary IEEE 754 representation, which cannot exactly represent most decimal fractions. `$59.99` as FLOAT may store as `59.98999786376953125`. When multiplied by 50,000,000 copies sold, the floating-point error becomes significant. DECIMAL stores exact decimal digits. `DECIMAL(6,2)` stores $59.99 exactly as the decimal value 59.99. For financial values, exact representation is non-negotiable.

---

**Q: What is MVCC and how does InnoDB use it?**
A: Multi-Version Concurrency Control. Instead of locking rows during reads, InnoDB maintains multiple versions of each row — one for each active transaction's snapshot. When Transaction A reads a row that Transaction B is updating, A sees the pre-update committed version. B's changes are invisible to A until B commits. This allows reads and writes to run concurrently without blocking each other, while still preventing dirty reads. In GameOn: two simultaneous reads of Elden Ring's revenue never block each other, even if a third transaction is updating it.

---

**Q: Explain the difference between a stored procedure and a scalar function. When do you use each?**
A: A stored procedure is called with `CALL` and can return zero, one, or multiple result sets, perform DML operations, use transactions, and has no return value. A scalar function is called inline in SQL expressions, returns exactly one value, cannot modify data (in MySQL), and can be used in SELECT, WHERE, ORDER BY. In GameOn: `ClassifyGameTier` is a procedure because it returns a result set with multiple columns (tier, scores) and requires conditional branching. `CalculateROI` is a function because it returns a single DECIMAL value that can be embedded directly in `SELECT title, CalculateROI(revenue, budget) AS roi FROM Game`.

---

**Q: The GenrePerformance view uses `WHERE gg.is_primary = TRUE`. What would happen without this filter?**
A: Elden Ring is classified as both RPG (primary) and Action (secondary). Without the filter, Elden Ring's revenue, score, and copies would be counted toward BOTH the RPG group and the Action group. Both genre averages would include Elden Ring's $1.2B revenue. Every genre analytics query would overcount popular multi-genre games. The filter ensures each game contributes to exactly one genre's statistics — its primary genre — giving accurate, non-duplicated aggregate data.

---

**Q: What is the `DETERMINISTIC` keyword on CalculateROI and why does it matter?**
A: DETERMINISTIC declares that the function always returns the same output for the same input parameters — no side effects, no reads from database tables, no random or time-based behavior. MySQL uses this hint to optimize: if the same arguments appear multiple times in a query, the optimizer can cache the result instead of recalculating. It also affects binary log replication — DETERMINISTIC functions are safe to replicate. Without it, MySQL may refuse to create the function or log warnings in replication environments.

---

**Q: Walk me through what happens when you run `npm run setup`.**
A:
1. `package.json` script executes `node src/execute_setup.js`
2. `execute_setup.js` calls `require('dotenv').config()` — loads DB credentials from `.env`
3. `fs.readFileSync('./sql/setup_db.sql', 'utf8')` — reads the entire 400-line SQL file into memory
4. `db.query(sql)` executes the file via the `mysql2` pool with `multipleStatements: true`
5. MySQL executes: CREATE DATABASE → USE → 9 × CREATE TABLE → 3 × CREATE INDEX → 4 × CREATE TRIGGER → 6 × CREATE VIEW → 5 × CREATE PROCEDURE → 1 × CREATE FUNCTION — in sequence
6. `SHOW TABLES FROM obsyria` verifies the result — logs created table names
7. Pool connection closed with `db.end()`

The entire schema — tables, indexes, triggers, views, procedures, function — is deployed in one idempotent operation. `IF NOT EXISTS` / `DROP IF EXISTS` guards allow re-running without errors.

---

*Every answer here is grounded in the actual `setup_db.sql`, `db.js`, `execute_setup.js`, and `seed_data.sql` of the GameOn project. If a viva question asks "show me in the code" — you can open the file and point directly to the line.*
