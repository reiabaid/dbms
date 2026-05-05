-- EXTENDED SEED DATA FOR GAME INTELLIGENCE SYSTEM
USE nexusdb;

-- 1. Additional Developers (Indie & Major)
INSERT INTO Developer (name, country, founded_year, team_size, is_independent, parent_company) VALUES
('Motion Twin', 'France', 2001, 15, TRUE, NULL),
('ConcernedApe', 'USA', 2011, 1, TRUE, NULL),
('Santa Monica Studio', 'USA', 1999, 400, FALSE, 'Sony Interactive Entertainment'),
('Insomniac Games', 'USA', 1994, 520, FALSE, 'Sony Interactive Entertainment'),
('Capcom', 'Japan', 1979, 3000, FALSE, 'Capcom Co., Ltd.'),
('Kojima Productions', 'Japan', 2015, 100, TRUE, NULL),
('Sucker Punch Productions', 'USA', 1997, 160, FALSE, 'Sony Interactive Entertainment'),
('Team Cherry', 'Australia', 2014, 3, TRUE, NULL),
('Mega Crit', 'USA', 2017, 2, TRUE, NULL),
('Subset Games', 'China', 2012, 2, TRUE, NULL);

-- 2. Additional Publishers
INSERT INTO Publisher (name, country, tier, founded_year) VALUES
('Devolver Digital', 'USA', 'INDIE_LABEL', 2009),
('Sony Interactive Entertainment', 'USA', 'MAJOR', 1993),
('Capcom', 'Japan', 'MAJOR', 1979),
('Coffee Stain Publishing', 'Sweden', 'MID', 2010),
('Team17', 'UK', 'INDIE_LABEL', 1990),
('Focus Entertainment', 'France', 'MID', 1996);

-- 3. Additional Engines
INSERT INTO GameEngine (name, developer_company, license_type, is_open_source, typical_scale) VALUES
('Decima', 'Guerrilla Games', 'PROPRIETARY', FALSE, 'AAA'),
('MT Framework', 'Capcom', 'PROPRIETARY', FALSE, 'AA'),
('Frostbite', 'EA DICE', 'PROPRIETARY', FALSE, 'AAA'),
('GameMaker', 'YoYo Games', 'SUBSCRIPTION', FALSE, 'INDIE');

-- 4. Additional Genres (Sub-genres)
INSERT INTO Genre (name, parent_genre_id) VALUES
('Roguelike', 2), -- Parent is Action (ID 2)
('Survival', 2),
('Metroidvania', 2),
('Deckbuilder', 3); -- Parent is Strategy (ID 3)

-- 5. Batch Register Games (using procedure logic manually to avoid procedure failures in script)
-- We will use INSERT statements to ensure it works even if procedure is missing in some environments
-- (Note: In a real MySQL script, CALL would be fine, but we'll stick to DML for transparency)

-- AAA BLOCK
INSERT INTO Game (title, release_date, esrb_rating, developer_id, publisher_id, engine_id, dev_budget_usd, marketing_budget_usd, dev_duration_months, team_size_at_launch, base_price_usd, revenue_est_usd, copies_sold_est, metacritic_score, user_review_pct) VALUES
('God of War Ragnarok', '2022-11-09', 'M', 8, 7, 2, 200000000, 50000000, 48, 400, 69.99, 800000000, 15000000, 94, 9.3),
('Marvels Spider-Man 2', '2023-10-20', 'T', 9, 7, 2, 300000000, 80000000, 60, 500, 69.99, 600000000, 10000000, 90, 9.0),
('Resident Evil 4 Remake', '2023-03-24', 'M', 10, 8, 4, 100000000, 30000000, 36, 300, 59.99, 450000000, 7000000, 93, 9.5),
('Death Stranding', '2019-11-08', 'M', 11, 7, 5, 80000000, 40000000, 40, 100, 49.99, 300000000, 5000000, 82, 8.4),
('Ghost of Tsushima', '2020-07-17', 'M', 12, 7, 2, 60000000, 20000000, 36, 160, 59.99, 500000000, 9700000, 83, 9.1);

-- INDIE BLOCK
INSERT INTO Game (title, release_date, esrb_rating, developer_id, publisher_id, engine_id, dev_budget_usd, team_size_at_launch, base_price_usd, revenue_est_usd, copies_sold_est, metacritic_score, user_review_pct) VALUES
('Dead Cells', '2018-08-07', 'T', 6, 6, 8, 500000, 15, 24.99, 50000000, 5000000, 89, 9.6),
('Stardew Valley', '2016-02-26', 'E10+', 7, 3, 3, 50000, 1, 14.99, 300000000, 20000000, 89, 9.8),
('Hollow Knight', '2017-02-24', 'E10+', 13, 3, 3, 100000, 3, 14.99, 45000000, 3000000, 90, 9.7),
('Slay the Spire', '2019-01-23', 'E', 14, 6, 3, 150000, 2, 24.99, 30000000, 1500000, 89, 9.5),
('Into the Breach', '2018-02-27', 'E', 15, 6, 3, 100000, 2, 14.99, 15000000, 1000000, 90, 9.2);

-- Map Genres (assuming standard IDs from original seed + new ones)
-- Note: IDs might vary, so we use subqueries for safety
INSERT INTO GameGenre (game_id, genre_id, is_primary)
SELECT g.game_id, gn.genre_id, TRUE
FROM Game g, Genre gn
WHERE g.title = 'God of War Ragnarok' AND gn.name = 'Action';

INSERT INTO GameGenre (game_id, genre_id, is_primary)
SELECT g.game_id, gn.genre_id, TRUE
FROM Game g, Genre gn
WHERE g.title = 'Dead Cells' AND gn.name = 'Roguelike';

INSERT INTO GameGenre (game_id, genre_id, is_primary)
SELECT g.game_id, gn.genre_id, TRUE
FROM Game g, Genre gn
WHERE g.title = 'Stardew Valley' AND gn.name = 'RPG';

-- Map Platforms
INSERT INTO GamePlatformListing (game_id, platform_id, price_usd)
SELECT g.game_id, p.platform_id, g.base_price_usd
FROM Game g, Platform p
WHERE g.title = 'God of War Ragnarok' AND p.name = 'PlayStation 5';

INSERT INTO GamePlatformListing (game_id, platform_id, price_usd)
SELECT g.game_id, p.platform_id, g.base_price_usd
FROM Game g, Platform p
WHERE g.title = 'Dead Cells' AND p.name = 'Steam';

-- Add some more free to play for trigger test
INSERT INTO Game (title, release_date, esrb_rating, developer_id, publisher_id, base_price_usd, is_free_to_play) VALUES
('Genshin Impact', '2020-09-28', 'T', 10, 8, 0.00, TRUE);
