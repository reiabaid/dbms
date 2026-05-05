USE nexusdb;

-- 1. Fix Revenue for Free to Play games (Assume $15 per player in microtransactions)
UPDATE Game 
SET revenue_est_usd = copies_sold_est * 15 
WHERE base_price_usd = 0;

-- 2. Fix missing Budgets based on copies sold (to categorize as AAA vs AA vs Indie)
-- Massive AAA hits (10M+ copies)
UPDATE Game 
SET dev_budget_usd = 100000000, 
    team_size_at_launch = 400
WHERE copies_sold_est >= 10000000 AND dev_budget_usd IS NULL;

-- AA hits (2M - 10M copies)
UPDATE Game 
SET dev_budget_usd = 20000000, 
    team_size_at_launch = 100
WHERE copies_sold_est >= 2000000 AND copies_sold_est < 10000000 AND dev_budget_usd IS NULL;

-- Indie / Small hits (< 2M copies)
UPDATE Game 
SET dev_budget_usd = 2000000, 
    team_size_at_launch = 15
WHERE copies_sold_est < 2000000 AND dev_budget_usd IS NULL;

-- 3. Add random release dates to recent years so they don't default to 1970
UPDATE Game 
SET release_date = DATE_ADD('2013-01-01', INTERVAL FLOOR(RAND() * 3650) DAY)
WHERE release_date IS NULL OR release_date = '1970-01-01';
