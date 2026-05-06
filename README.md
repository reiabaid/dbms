# Obsyria — Game Intelligence System

A web-based database intelligence platform for analysing game industry data. Built with Node.js, Express, and MySQL hosted on Aiven Cloud.

---

## What It Does

Obsyria is a relational database system built around the gaming industry. It stores and connects data across games, developers, publishers, game engines, platforms, genres, and DLC in a fully normalized schema.

The system lets you:
- Browse the full game inventory with developer, publisher, engine, release year, critic score, and revenue data
- Analyse genre performance, publisher impact, engine deployment, and platform pricing through aggregated views
- Calculate and compare ROI across games using a scalar SQL function
- Classify any game into a production tier (AAA, AA, Indie, Hobbyist) using a weighted scoring procedure
- Register new games atomically — one transaction writes to Developer, Game, GameGenre, and GamePlatformListing
- Delete games with full cascading removal of all linked records

---

## Database Schema

9 tables in 3NF — Developer, Publisher, GameEngine, Platform, Genre, Game, GameGenre, GamePlatformListing, DLC.

Key database objects built on top of the schema:

**Indexes** — B-Tree indexes on `title`, `release_date`, `metacritic_score` for query performance.

**Triggers** — 4 triggers handle automatic flag setting (free-to-play detection, subscription flag), price validation, and metacritic score validation on insert.

**Views** — 8 views including `GameIntelligenceSummary`, `GameROI`, `GenrePerformance`, `TopDevelopers` (correlated subquery), `AboveAverageGames` (scalar subquery).

**Scalar Function** — `CalculateROI(revenue, budget)` returns ROI percentage. Embedded inside the `GameROI` view.

**Stored Procedures** — 5 procedures: `ClassifyGameTier`, `RegisterGameComplete` (with transaction), `GetDeveloperBenchmark` (HAVING clause), `GetGenreOpportunity`, `GetDLCStrategy`.

---

## Tech Stack

- **Backend** — Node.js, Express
- **Database** — MySQL on Aiven Cloud
- **Frontend** — Vanilla JS, Chart.js
- **Driver** — mysql2

---

## Project Structure

```
obsyria/
├── server.js                 # Express API server
├── src/
│   ├── db.js                 # Connection pool
│   ├── execute_setup.js      # Runs setup_db.sql against the DB
│   └── test-connection.js    # Verifies DB connectivity
├── sql/
│   ├── setup_db.sql          # Tables, indexes, triggers, views, procedures
│   └── seed_data.sql         # Sample data
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── scripts/
│   ├── pull_real_data.js     # Seeds 100 games from SteamSpy API
│   ├── seed_marketplaces.js  # Populates platform listings
│   ├── fix_platform.js       # One-time platform repair utility
│   └── update_procedure.js  # Patches RegisterGameComplete procedure
├── docs/                     # Documentation and viva prep
└── .env                      # DB credentials (not committed)
```

---

## Environment Variables

Create a `.env` file in the project root:

```
DB_HOST=your-aiven-host
DB_PORT=your-port
DB_USER=your-user
DB_PASS=your-password
DB_NAME=obsyria
```

---

## Setup

```bash
npm install
npm test              # verify DB connection
npm run setup         # create schema, views, triggers, procedures
npm run seed          # insert sample data
npm start             # start server at http://localhost:3000
```

To seed with real Steam data instead of sample data:

```bash
node scripts/pull_real_data.js
node scripts/seed_marketplaces.js
```

---

## API Routes

```
GET    /api/games                    GameIntelligenceSummary view
GET    /api/genres                   GenrePerformance view
GET    /api/publishers               PublisherImpact view
GET    /api/engines                  EngineIntelligence view
GET    /api/platforms                PlatformPricing view
GET    /api/roi                      GameROI view (CalculateROI function)
GET    /api/top-developers           TopDevelopers view (correlated subquery)
GET    /api/above-average            AboveAverageGames view (scalar subquery)
GET    /api/classify/:id             CALL ClassifyGameTier(?)
GET    /api/developer-benchmark/:name  CALL GetDeveloperBenchmark(?)
GET    /api/metadata                 Dropdown data for forms
POST   /api/register                 CALL RegisterGameComplete(?)
DELETE /api/games/:id                Cascading delete
```
