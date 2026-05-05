-- FIX DATA: Fill missing stats, remove duplicates, add subquery view
USE nexusdb;

-- 1. Remove duplicate entries (IDs 15, 16, 17 are copies of 1, 2, 3)
DELETE FROM GameGenre WHERE game_id IN (15, 16, 17);
DELETE FROM GamePlatformListing WHERE game_id IN (15, 16, 17);
DELETE FROM Game WHERE game_id IN (15, 16, 17);

-- 2. Fix Hades (game_id = 3) - missing ALL stats
UPDATE Game SET 
    release_date = '2020-09-17',
    dev_budget_usd = 2000000,
    revenue_est_usd = 80000000,
    metacritic_score = 93,
    user_review_pct = 97.00,
    copies_sold_est = 3000000,
    team_size_at_launch = 20,
    dev_duration_months = 48,
    funding_source = 'SELF_FUNDED',
    monetization_model = 'PREMIUM'
WHERE game_id = 3;

-- 3. Fix The Witcher 3 (game_id = 1) - missing release_date
UPDATE Game SET 
    release_date = '2015-05-19',
    dev_duration_months = 42,
    funding_source = 'PUBLISHER_FUNDED',
    monetization_model = 'PREMIUM_PLUS_DLC'
WHERE game_id = 1;

-- 4. Fix Elden Ring (game_id = 2) - missing release_date
UPDATE Game SET 
    release_date = '2022-02-25',
    dev_duration_months = 60,
    funding_source = 'PUBLISHER_FUNDED',
    monetization_model = 'PREMIUM_PLUS_DLC'
WHERE game_id = 2;

-- 5. Fix Genshin Impact (game_id = 14) - missing stats
UPDATE Game SET 
    dev_budget_usd = 100000000,
    revenue_est_usd = 4000000000,
    metacritic_score = 84,
    user_review_pct = 73.00,
    copies_sold_est = 0,
    team_size_at_launch = 700,
    dev_duration_months = 36,
    funding_source = 'SELF_FUNDED',
    monetization_model = 'F2P_COSMETIC'
WHERE game_id = 14;
