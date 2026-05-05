-- RUBRIC GAP FIXES: Subqueries, CalculateROI usage, HAVING visibility
USE nexusdb;

-- =============================================================
-- GAP FIX 1: VIEW USING SUBQUERY (Rubric #4 - Subqueries)
-- "Games performing above the average Metacritic score"
-- =============================================================
CREATE OR REPLACE VIEW AboveAverageGames AS
SELECT 
    g.game_id,
    g.title,
    d.name AS developer_name,
    g.metacritic_score,
    g.revenue_est_usd,
    g.base_price_usd
FROM Game g
JOIN Developer d ON g.developer_id = d.developer_id
WHERE g.metacritic_score > (
    SELECT AVG(metacritic_score) FROM Game WHERE metacritic_score IS NOT NULL
)
ORDER BY g.metacritic_score DESC;

-- =============================================================
-- GAP FIX 2: VIEW USING CalculateROI SCALAR FUNCTION (Rubric #4)
-- "Return on Investment for every game with budget data"
-- =============================================================
CREATE OR REPLACE VIEW GameROI AS
SELECT 
    g.game_id,
    g.title,
    d.name AS developer_name,
    g.dev_budget_usd AS budget,
    g.revenue_est_usd AS revenue,
    CalculateROI(g.revenue_est_usd, g.dev_budget_usd) AS roi_pct,
    g.metacritic_score,
    g.team_size_at_launch
FROM Game g
JOIN Developer d ON g.developer_id = d.developer_id
WHERE g.dev_budget_usd IS NOT NULL AND g.dev_budget_usd > 0
ORDER BY roi_pct DESC;

-- =============================================================
-- GAP FIX 3: SUBQUERY WITH IN (Correlated subquery)
-- "Developers who have at least one game above average revenue"
-- =============================================================
CREATE OR REPLACE VIEW TopDevelopers AS
SELECT 
    d.developer_id,
    d.name,
    d.country,
    d.team_size,
    d.is_independent
FROM Developer d
WHERE d.developer_id IN (
    SELECT g.developer_id 
    FROM Game g 
    WHERE g.revenue_est_usd > (
        SELECT AVG(revenue_est_usd) FROM Game WHERE revenue_est_usd IS NOT NULL
    )
);
