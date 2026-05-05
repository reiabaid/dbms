USE nexusdb;

CREATE OR REPLACE VIEW GameIntelligenceSummary AS
SELECT 
    g.game_id, g.title, g.release_date, g.base_price_usd, g.metacritic_score,
    g.user_review_pct, g.revenue_est_usd, g.copies_sold_est, g.award_count,
    g.cover_image_url,
    d.name AS developer_name, d.team_size, 
    p.name AS publisher_name, p.tier AS publisher_tier, 
    e.name AS engine_name, e.typical_scale AS engine_scale
FROM Game g
JOIN Developer d ON g.developer_id = d.developer_id
JOIN Publisher p ON g.publisher_id = p.publisher_id
LEFT JOIN GameEngine e ON g.engine_id = e.engine_id;
