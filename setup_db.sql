-- Nexus Game Intelligence System Setup

-- PART 1: DDL
CREATE DATABASE IF NOT EXISTS nexusdb;
USE nexusdb;

-- TABLE 1: Developer
CREATE TABLE IF NOT EXISTS Developer (
    developer_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(60),
    founded_year YEAR,
    team_size INT,
    is_independent BOOLEAN DEFAULT TRUE,
    parent_company VARCHAR(100)
);

-- TABLE 2: Publisher
CREATE TABLE IF NOT EXISTS Publisher (
    publisher_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(60),
    tier ENUM('MAJOR', 'MID', 'INDIE_LABEL', 'SELF_PUBLISHED'),
    founded_year YEAR
);

-- TABLE 3: GameEngine
CREATE TABLE IF NOT EXISTS GameEngine (
    engine_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL,
    developer_company VARCHAR(80),
    license_type ENUM('FREE', 'ROYALTY', 'SUBSCRIPTION', 'PROPRIETARY'),
    is_open_source BOOLEAN DEFAULT FALSE,
    typical_scale ENUM('HOBBYIST', 'INDIE', 'AA', 'AAA', 'ALL')
);

-- TABLE 4: Platform
CREATE TABLE IF NOT EXISTS Platform (
    platform_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(60) NOT NULL,
    manufacturer VARCHAR(60),
    platform_type ENUM('PC_STOREFRONT', 'CONSOLE', 'HANDHELD', 'CLOUD'),
    launch_year YEAR
);

-- TABLE 5: Genre
CREATE TABLE IF NOT EXISTS Genre (
    genre_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(60) NOT NULL,
    parent_genre_id INT NULL,
    FOREIGN KEY (parent_genre_id) REFERENCES Genre(genre_id)
);

-- TABLE 6: Game
CREATE TABLE IF NOT EXISTS Game (
    game_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(150) NOT NULL,
    release_date DATE,
    esrb_rating ENUM('E', 'E10+', 'T', 'M', 'AO', 'UNRATED'),
    developer_id INT NOT NULL,
    publisher_id INT NOT NULL,
    engine_id INT,
    dev_budget_usd BIGINT,
    marketing_budget_usd BIGINT,
    dev_duration_months INT,
    team_size_at_launch INT,
    base_price_usd DECIMAL(6, 2) DEFAULT 0.00,
    is_free_to_play BOOLEAN DEFAULT FALSE,
    funding_source ENUM('SELF_FUNDED', 'PUBLISHER_FUNDED', 'CROWDFUNDED', 'GRANT', 'MIXED'),
    monetization_model ENUM('PREMIUM', 'F2P_COSMETIC', 'F2P_PAY2WIN', 'PREMIUM_PLUS_DLC', 'SUBSCRIPTION', 'MIXED'),
    early_access BOOLEAN DEFAULT FALSE,
    copies_sold_est INT,
    revenue_est_usd BIGINT,
    peak_ccu INT,
    metacritic_score INT CHECK (metacritic_score BETWEEN 0 AND 100),
    user_review_pct DECIMAL(5, 2),
    total_reviews INT,
    award_count INT DEFAULT 0,
    on_subscription_day1 BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (developer_id) REFERENCES Developer(developer_id),
    FOREIGN KEY (publisher_id) REFERENCES Publisher(publisher_id),
    FOREIGN KEY (engine_id) REFERENCES GameEngine(engine_id)
);

-- TABLE 7: GameGenre
CREATE TABLE IF NOT EXISTS GameGenre (
    game_id INT,
    genre_id INT,
    is_primary BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (game_id, genre_id),
    FOREIGN KEY (game_id) REFERENCES Game(game_id),
    FOREIGN KEY (genre_id) REFERENCES Genre(genre_id)
);

-- TABLE 8: GamePlatformListing
CREATE TABLE IF NOT EXISTS GamePlatformListing (
    listing_id INT PRIMARY KEY AUTO_INCREMENT,
    game_id INT NOT NULL,
    platform_id INT NOT NULL,
    price_usd DECIMAL(6, 2),
    is_exclusive BOOLEAN DEFAULT FALSE,
    subscription_included BOOLEAN DEFAULT FALSE,
    platform_release_date DATE,
    UNIQUE KEY (game_id, platform_id),
    FOREIGN KEY (game_id) REFERENCES Game(game_id),
    FOREIGN KEY (platform_id) REFERENCES Platform(platform_id)
);

-- TABLE 9: DLC
CREATE TABLE IF NOT EXISTS DLC (
    dlc_id INT PRIMARY KEY AUTO_INCREMENT,
    game_id INT NOT NULL,
    title VARCHAR(150),
    price_usd DECIMAL(6, 2),
    dlc_type ENUM('STORY', 'COSMETIC', 'SEASON_PASS', 'SOUNDTRACK', 'UTILITY', 'BUNDLE'),
    release_date DATE,
    FOREIGN KEY (game_id) REFERENCES Game(game_id)
);

-- PART 2: TRIGGERS
DROP TRIGGER IF EXISTS before_game_insert;
CREATE TRIGGER before_game_insert
BEFORE INSERT ON Game
FOR EACH ROW
BEGIN
    IF NEW.base_price_usd = 0 THEN
        SET NEW.is_free_to_play = TRUE;
    END IF;
END;

DROP TRIGGER IF EXISTS validate_metacritic;
CREATE TRIGGER validate_metacritic
BEFORE INSERT ON Game
FOR EACH ROW
BEGIN
    IF NEW.metacritic_score < 0 OR NEW.metacritic_score > 100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Metacritic score must be between 0 and 100';
    END IF;
END;

DROP TRIGGER IF EXISTS prevent_negative_price;
CREATE TRIGGER prevent_negative_price
BEFORE INSERT ON GamePlatformListing
FOR EACH ROW
BEGIN
    IF NEW.price_usd < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Price cannot be negative';
    END IF;
END;

DROP TRIGGER IF EXISTS auto_subscription_flag;
CREATE TRIGGER auto_subscription_flag
AFTER INSERT ON GamePlatformListing
FOR EACH ROW
BEGIN
    IF NEW.subscription_included = TRUE THEN
        UPDATE Game SET on_subscription_day1 = TRUE WHERE game_id = NEW.game_id;
    END IF;
END;

-- PART 3: VIEWS
CREATE OR REPLACE VIEW GameIntelligenceSummary AS
SELECT 
    g.game_id, g.title, g.release_date, g.base_price_usd, g.metacritic_score,
    g.user_review_pct, g.revenue_est_usd, g.copies_sold_est, g.award_count,
    d.name AS developer_name, d.team_size, 
    p.name AS publisher_name, p.tier AS publisher_tier, 
    e.name AS engine_name, e.typical_scale AS engine_scale
FROM Game g
JOIN Developer d ON g.developer_id = d.developer_id
JOIN Publisher p ON g.publisher_id = p.publisher_id
LEFT JOIN GameEngine e ON g.engine_id = e.engine_id;

CREATE OR REPLACE VIEW GenrePerformance AS
SELECT 
    gn.name AS genre, 
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

CREATE OR REPLACE VIEW PublisherImpact AS
SELECT 
    p.name AS publisher_name, 
    p.tier, 
    COUNT(g.game_id) AS total_games, 
    AVG(g.revenue_est_usd) AS avg_revenue, 
    AVG(g.metacritic_score) AS avg_score, 
    AVG(g.copies_sold_est) AS avg_copies
FROM Publisher p
JOIN Game g ON p.publisher_id = g.publisher_id
GROUP BY p.publisher_id;

CREATE OR REPLACE VIEW EngineIntelligence AS
SELECT 
    e.name AS engine_name, 
    e.license_type, 
    e.typical_scale, 
    COUNT(g.game_id) AS game_count, 
    AVG(g.base_price_usd) AS avg_price, 
    AVG(g.metacritic_score) AS avg_score, 
    AVG(g.revenue_est_usd) AS avg_revenue
FROM GameEngine e
JOIN Game g ON e.engine_id = g.engine_id
GROUP BY e.engine_id;

CREATE OR REPLACE VIEW DLCMonetization AS
SELECT 
    g.title, 
    p.tier AS publisher_tier, 
    COUNT(d.dlc_id) AS dlc_count, 
    SUM(d.price_usd) AS total_dlc_value, 
    AVG(d.price_usd) AS avg_dlc_price, 
    g.user_review_pct
FROM Game g
JOIN Publisher p ON g.publisher_id = p.publisher_id
LEFT JOIN DLC d ON g.game_id = d.game_id
GROUP BY g.game_id;

CREATE OR REPLACE VIEW PlatformPricing AS
SELECT 
    g.title, 
    pl.name AS platform_name, 
    gpl.price_usd, 
    gpl.is_exclusive, 
    gpl.subscription_included
FROM Game g
JOIN GamePlatformListing gpl ON g.game_id = gpl.game_id
JOIN Platform pl ON gpl.platform_id = pl.platform_id;

-- PART 4: STORED PROCEDURES
DROP PROCEDURE IF EXISTS ClassifyGameTier;
CREATE PROCEDURE ClassifyGameTier(IN p_game_id INT)
BEGIN
    DECLARE v_budget BIGINT;
    DECLARE v_team INT;
    DECLARE v_revenue BIGINT;
    DECLARE v_tier VARCHAR(20);
    DECLARE v_score_budget INT DEFAULT 0;
    DECLARE v_score_team INT DEFAULT 0;
    DECLARE v_score_pub INT DEFAULT 0;
    DECLARE v_score_rev INT DEFAULT 0;
    DECLARE v_total_score INT DEFAULT 0;
    DECLARE v_final_tier VARCHAR(20);

    SELECT dev_budget_usd, team_size_at_launch, revenue_est_usd, p.tier 
    INTO v_budget, v_team, v_revenue, v_tier
    FROM Game g
    JOIN Publisher p ON g.publisher_id = p.publisher_id
    WHERE g.game_id = p_game_id;

    -- Score Budget
    IF v_budget >= 100000000 THEN SET v_score_budget = 40;
    ELSEIF v_budget >= 10000000 THEN SET v_score_budget = 30;
    ELSEIF v_budget >= 1000000 THEN SET v_score_budget = 15;
    ELSEIF v_budget >= 100000 THEN SET v_score_budget = 7;
    END IF;

    -- Score Team
    IF v_team >= 300 THEN SET v_score_team = 25;
    ELSEIF v_team >= 100 THEN SET v_score_team = 20;
    ELSEIF v_team >= 50 THEN SET v_score_team = 14;
    ELSEIF v_team >= 15 THEN SET v_score_team = 7;
    ELSEIF v_team >= 3 THEN SET v_score_team = 3;
    END IF;

    -- Score Publisher
    IF v_tier = 'MAJOR' THEN SET v_score_pub = 20;
    ELSEIF v_tier = 'MID' THEN SET v_score_pub = 12;
    ELSEIF v_tier = 'INDIE_LABEL' THEN SET v_score_pub = 5;
    END IF;

    -- Score Revenue
    IF v_revenue >= 500000000 THEN SET v_score_rev = 15;
    ELSEIF v_revenue >= 50000000 THEN SET v_score_rev = 12;
    ELSEIF v_revenue >= 5000000 THEN SET v_score_rev = 7;
    ELSEIF v_revenue >= 500000 THEN SET v_score_rev = 3;
    END IF;

    SET v_total_score = v_score_budget + v_score_team + v_score_pub + v_score_rev;

    IF v_total_score >= 70 THEN SET v_final_tier = 'AAA';
    ELSEIF v_total_score >= 40 THEN SET v_final_tier = 'AA';
    ELSEIF v_total_score >= 15 THEN SET v_final_tier = 'INDIE';
    ELSE SET v_final_tier = 'HOBBYIST';
    END IF;

    SELECT v_final_tier AS tier, v_total_score AS total_score, 
           v_score_budget AS budget_score, v_score_team AS team_score, 
           v_score_pub AS publisher_score, v_score_rev AS revenue_score;
END;

DROP PROCEDURE IF EXISTS GetGenreOpportunity;
CREATE PROCEDURE GetGenreOpportunity(IN p_budget BIGINT, IN p_team_size INT)
BEGIN
    SELECT gn.name AS genre, 
           COUNT(g.game_id) AS game_count, 
           AVG(g.revenue_est_usd) AS avg_revenue, 
           AVG(g.metacritic_score) AS avg_score, 
           AVG(g.copies_sold_est) AS avg_copies
    FROM Genre gn
    JOIN GameGenre gg ON gn.genre_id = gg.genre_id
    JOIN Game g ON gg.game_id = g.game_id
    WHERE g.dev_budget_usd BETWEEN p_budget * 0.1 AND p_budget * 10
      AND g.team_size_at_launch BETWEEN p_team_size * 0.2 AND p_team_size * 5
    GROUP BY gn.name
    ORDER BY avg_revenue DESC;
END;

DROP PROCEDURE IF EXISTS GetDeveloperBenchmark;
CREATE PROCEDURE GetDeveloperBenchmark(IN p_developer_name VARCHAR(100))
BEGIN
    DECLARE v_avg_budget BIGINT;
    
    SELECT AVG(dev_budget_usd) INTO v_avg_budget 
    FROM Game g
    JOIN Developer d ON g.developer_id = d.developer_id
    WHERE d.name = p_developer_name;

    SELECT d.name AS developer_name, 
           COUNT(g.game_id) AS total_games, 
           AVG(g.metacritic_score) AS avg_score, 
           AVG(g.revenue_est_usd) AS avg_revenue, 
           AVG(g.copies_sold_est) AS avg_copies, 
           AVG(g.user_review_pct) AS avg_user_review
    FROM Developer d
    JOIN Game g ON d.developer_id = g.developer_id
    GROUP BY d.developer_id
    HAVING AVG(g.dev_budget_usd) BETWEEN v_avg_budget * 0.5 AND v_avg_budget * 2
    ORDER BY avg_score DESC;
END;

DROP PROCEDURE IF EXISTS GetDLCStrategy;
CREATE PROCEDURE GetDLCStrategy(IN p_genre VARCHAR(60), IN p_base_price DECIMAL(6,2))
BEGIN
    SELECT d.dlc_type, 
           COUNT(d.dlc_id) AS dlc_count, 
           AVG(d.price_usd) AS avg_dlc_price, 
           AVG(g.user_review_pct) AS avg_review_with_dlc
    FROM DLC d
    JOIN Game g ON d.game_id = g.game_id
    JOIN GameGenre gg ON g.game_id = gg.game_id
    JOIN Genre gn ON gg.genre_id = gn.genre_id
    WHERE gn.name = p_genre 
      AND g.base_price_usd BETWEEN p_base_price * 0.5 AND p_base_price * 2
    GROUP BY d.dlc_type
    ORDER BY dlc_count DESC;
END;

-- PROCEDURE 5: RegisterGameComplete (Atomic Transaction)
DROP PROCEDURE IF EXISTS RegisterGameComplete;
CREATE PROCEDURE RegisterGameComplete(
    IN p_title VARCHAR(150),
    IN p_developer_id INT,
    IN p_publisher_id INT,
    IN p_genre_id INT,
    IN p_platform_id INT,
    IN p_price DECIMAL(6,2)
)
BEGIN
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
END;
