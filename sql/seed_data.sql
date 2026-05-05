-- OBSYRIA GAME INTELLIGENCE SYSTEM - SEED DATA
USE obsyria;

-- 1. Developers
INSERT INTO Developer (name, country, founded_year, team_size, is_independent, parent_company) VALUES
('CD Projekt Red', 'Poland', 1994, 1000, FALSE, 'CD Projekt'),
('FromSoftware', 'Japan', 1986, 350, FALSE, 'Kadokawa'),
('Supergiant Games', 'USA', 2009, 20, TRUE, NULL),
('Larian Studios', 'Belgium', 1996, 450, TRUE, NULL),
('Rockstar North', 'UK', 1987, 650, FALSE, 'Take-Two');

-- 2. Publishers
INSERT INTO Publisher (name, country, tier, founded_year) VALUES
('CD Projekt', 'Poland', 'MID', 1994),
('Bandai Namco', 'Japan', 'MAJOR', 1955),
('Self-Published', 'Global', 'SELF_PUBLISHED', 2024),
('Electronic Arts', 'USA', 'MAJOR', 1982),
('Annapurna Interactive', 'USA', 'INDIE_LABEL', 2016);

-- 3. Engines
INSERT INTO GameEngine (name, developer_company, license_type, is_open_source, typical_scale) VALUES
('REDengine', 'CD Projekt Red', 'PROPRIETARY', FALSE, 'AAA'),
('Unreal Engine 5', 'Epic Games', 'ROYALTY', FALSE, 'ALL'),
('Unity', 'Unity Technologies', 'SUBSCRIPTION', FALSE, 'ALL'),
('RE Engine', 'Capcom', 'PROPRIETARY', FALSE, 'AAA');

-- 4. Platforms
INSERT INTO Platform (name, manufacturer, platform_type, launch_year) VALUES
('Steam', 'Valve', 'PC_STOREFRONT', 2003),
('PlayStation 5', 'Sony', 'CONSOLE', 2020),
('Xbox Series X', 'Microsoft', 'CONSOLE', 2020),
('Nintendo Switch', 'Nintendo', 'HANDHELD', 2017);

-- 5. Genres
INSERT INTO Genre (name, parent_genre_id) VALUES
('RPG', NULL),
('Action', NULL),
('Strategy', NULL);

INSERT INTO Genre (name, parent_genre_id) VALUES
('Open World RPG', 1),
('Soulslike', 1),
('Indie Action', 2);

-- 6. Games (Using the Transactional Procedure for 1-3, then manual)
CALL RegisterGameComplete('The Witcher 3', 1, 1, 4, 1, 59.99);
CALL RegisterGameComplete('Elden Ring', 2, 2, 5, 2, 59.99);
CALL RegisterGameComplete('Hades', 3, 3, 6, 1, 24.99);

-- Update detailed stats for seeded games
UPDATE Game SET 
    dev_budget_usd = 81000000, 
    revenue_est_usd = 500000000, 
    metacritic_score = 93, 
    user_review_pct = 97.00,
    copies_sold_est = 50000000,
    team_size_at_launch = 250
WHERE title = 'The Witcher 3';

UPDATE Game SET 
    dev_budget_usd = 200000000, 
    revenue_est_usd = 1200000000, 
    metacritic_score = 96, 
    user_review_pct = 92.00,
    copies_sold_est = 25000000,
    team_size_at_launch = 300
WHERE title = 'Elden Ring';

-- 7. Platform Listings (Additional)
INSERT INTO GamePlatformListing (game_id, platform_id, price_usd, is_exclusive) VALUES
(1, 2, 59.99, FALSE), -- Witcher 3 on PS5
(2, 1, 59.99, FALSE); -- Elden Ring on Steam

-- 8. DLCs
INSERT INTO DLC (game_id, title, price_usd, dlc_type, release_date) VALUES
(1, 'Blood and Wine', 19.99, 'STORY', '2016-05-31'),
(1, 'Hearts of Stone', 9.99, 'STORY', '2015-10-13'),
(2, 'Shadow of the Erdtree', 39.99, 'STORY', '2024-06-21');
