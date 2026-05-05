-- MASSIVE DATA EXPANSION SCRIPT
USE nexusdb;

-- 1. ADD MORE PUBLISHERS
INSERT IGNORE INTO Publisher (name, country, tier, founded_year) VALUES
('Electronic Arts', 'USA', 'MAJOR', 1982),
('Ubisoft', 'France', 'MAJOR', 1986),
('Nintendo', 'Japan', 'MAJOR', 1889),
('Microsoft Xbox', 'USA', 'MAJOR', 2001),
('Take-Two Interactive', 'USA', 'MAJOR', 1993),
('Bethesda Softworks', 'USA', 'MAJOR', 1986),
('Square Enix', 'Japan', 'MAJOR', 2003),
('Sega', 'Japan', 'MAJOR', 1960),
('Annapurna Interactive', 'USA', 'INDIE_LABEL', 2016),
('Raw Fury', 'Sweden', 'INDIE_LABEL', 2015);

-- 2. ADD MORE ENGINES
INSERT IGNORE INTO GameEngine (name, developer_company, license_type, is_open_source, typical_scale) VALUES
('Source 2', 'Valve', 'PROPRIETARY', FALSE, 'AAA'),
('CryEngine', 'Crytek', 'COMMERCIAL', FALSE, 'AAA'),
('Godot', 'Godot Foundation', 'FREE', TRUE, 'INDIE'),
('id Tech 7', 'id Software', 'PROPRIETARY', FALSE, 'AAA'),
('Creation Engine 2', 'Bethesda', 'PROPRIETARY', FALSE, 'AAA'),
('RE Engine', 'Capcom', 'PROPRIETARY', FALSE, 'AAA'),
('Snowdrop', 'Ubisoft', 'PROPRIETARY', FALSE, 'AAA');

-- 3. ADD MORE DEVELOPERS
INSERT IGNORE INTO Developer (name, country, founded_year, team_size, is_independent, parent_company) VALUES
('Valve', 'USA', 1996, 360, TRUE, NULL),
('Naughty Dog', 'USA', 1984, 500, FALSE, 'Sony Interactive Entertainment'),
('Rockstar North', 'UK', 1987, 800, FALSE, 'Take-Two Interactive'),
('Bethesda Game Studios', 'USA', 2001, 420, FALSE, 'Microsoft Xbox'),
('Larian Studios', 'Belgium', 1996, 450, TRUE, NULL),
('Nintendo EPD', 'Japan', 2015, 800, FALSE, 'Nintendo'),
('Bungie', 'USA', 1991, 900, FALSE, 'Sony Interactive Entertainment'),
('Respawn Entertainment', 'USA', 2010, 450, FALSE, 'Electronic Arts'),
('Supergiant Games', 'USA', 2009, 20, TRUE, NULL),
('Playdead', 'Denmark', 2006, 40, TRUE, NULL),
('Mobius Digital', 'USA', 2015, 15, TRUE, NULL),
('Klei Entertainment', 'Canada', 2005, 65, TRUE, NULL);

-- 4. ADD MORE GAMES (Using Subqueries to dynamically resolve IDs)
INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
SELECT 
    'Grand Theft Auto V', 'https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg', '2013-09-17', 'M', 29.99, 265000000, 8000000000, 190000000, 97,
    (SELECT developer_id FROM Developer WHERE name = 'Rockstar North' LIMIT 1),
    (SELECT publisher_id FROM Publisher WHERE name = 'Take-Two Interactive' LIMIT 1),
    (SELECT engine_id FROM GameEngine WHERE name = 'RAGE' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Game WHERE title = 'Grand Theft Auto V');

INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
SELECT 
    'Baldurs Gate 3', 'https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/header.jpg', '2023-08-03', 'M', 59.99, 100000000, 600000000, 10000000, 96,
    (SELECT developer_id FROM Developer WHERE name = 'Larian Studios' LIMIT 1),
    (SELECT publisher_id FROM Publisher WHERE name = 'Larian Studios' LIMIT 1),
    (SELECT engine_id FROM GameEngine WHERE name = 'Divinity Engine' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Game WHERE title = 'Baldurs Gate 3');

INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
SELECT 
    'The Last of Us Part I', 'https://cdn.cloudflare.steamstatic.com/steam/apps/1888930/header.jpg', '2022-09-02', 'M', 59.99, 50000000, 250000000, 8000000, 89,
    (SELECT developer_id FROM Developer WHERE name = 'Naughty Dog' LIMIT 1),
    (SELECT publisher_id FROM Publisher WHERE name = 'Sony Interactive Entertainment' LIMIT 1),
    (SELECT engine_id FROM GameEngine WHERE name = 'Naughty Dog Engine' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Game WHERE title = 'The Last of Us Part I');

INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
SELECT 
    'Skyrim', 'https://cdn.cloudflare.steamstatic.com/steam/apps/489830/header.jpg', '2011-11-11', 'M', 39.99, 85000000, 1000000000, 30000000, 94,
    (SELECT developer_id FROM Developer WHERE name = 'Bethesda Game Studios' LIMIT 1),
    (SELECT publisher_id FROM Publisher WHERE name = 'Bethesda Softworks' LIMIT 1),
    (SELECT engine_id FROM GameEngine WHERE name = 'Creation Engine' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Game WHERE title = 'Skyrim');

INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
SELECT 
    'Cyberpunk 2077', 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg', '2020-12-10', 'M', 59.99, 316000000, 750000000, 25000000, 86,
    (SELECT developer_id FROM Developer WHERE name = 'CD Projekt Red' LIMIT 1),
    (SELECT publisher_id FROM Publisher WHERE name = 'CD Projekt' LIMIT 1),
    (SELECT engine_id FROM GameEngine WHERE name = 'REDengine 4' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Game WHERE title = 'Cyberpunk 2077');

INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
SELECT 
    'Half-Life: Alyx', 'https://cdn.cloudflare.steamstatic.com/steam/apps/546560/header.jpg', '2020-03-23', 'M', 59.99, 40000000, 150000000, 2500000, 93,
    (SELECT developer_id FROM Developer WHERE name = 'Valve' LIMIT 1),
    (SELECT publisher_id FROM Publisher WHERE name = 'Valve' LIMIT 1),
    (SELECT engine_id FROM GameEngine WHERE name = 'Source 2' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Game WHERE title = 'Half-Life: Alyx');

INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
SELECT 
    'Outer Wilds', 'https://cdn.cloudflare.steamstatic.com/steam/apps/753640/header.jpg', '2019-05-28', 'T', 24.99, 2000000, 15000000, 1000000, 85,
    (SELECT developer_id FROM Developer WHERE name = 'Mobius Digital' LIMIT 1),
    (SELECT publisher_id FROM Publisher WHERE name = 'Annapurna Interactive' LIMIT 1),
    (SELECT engine_id FROM GameEngine WHERE name = 'Unity' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Game WHERE title = 'Outer Wilds');

INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
SELECT 
    'Inside', 'https://cdn.cloudflare.steamstatic.com/steam/apps/304430/header.jpg', '2016-06-29', 'M', 19.99, 3000000, 30000000, 2000000, 93,
    (SELECT developer_id FROM Developer WHERE name = 'Playdead' LIMIT 1),
    (SELECT publisher_id FROM Publisher WHERE name = 'Playdead' LIMIT 1),
    (SELECT engine_id FROM GameEngine WHERE name = 'Unity' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Game WHERE title = 'Inside');

INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
SELECT 
    'Don''t Starve', 'https://cdn.cloudflare.steamstatic.com/steam/apps/219740/header.jpg', '2013-04-23', 'T', 9.99, 500000, 50000000, 5000000, 79,
    (SELECT developer_id FROM Developer WHERE name = 'Klei Entertainment' LIMIT 1),
    (SELECT publisher_id FROM Publisher WHERE name = 'Klei Entertainment' LIMIT 1),
    (SELECT engine_id FROM GameEngine WHERE name = 'Klei Engine' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Game WHERE title = 'Don''t Starve');

INSERT INTO Game (title, cover_image_url, release_date, esrb_rating, base_price_usd, dev_budget_usd, revenue_est_usd, copies_sold_est, metacritic_score, developer_id, publisher_id, engine_id)
SELECT 
    'Apex Legends', 'https://cdn.cloudflare.steamstatic.com/steam/apps/1172470/header.jpg', '2019-02-04', 'T', 0.00, 80000000, 3000000000, 0, 89,
    (SELECT developer_id FROM Developer WHERE name = 'Respawn Entertainment' LIMIT 1),
    (SELECT publisher_id FROM Publisher WHERE name = 'Electronic Arts' LIMIT 1),
    (SELECT engine_id FROM GameEngine WHERE name = 'Source' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Game WHERE title = 'Apex Legends');
