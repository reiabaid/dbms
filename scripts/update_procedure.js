const pool = require('../src/db');
const fs = require('fs');

async function updateProcedure() {
    const sql = `
DROP PROCEDURE IF EXISTS RegisterGameComplete;
CREATE PROCEDURE RegisterGameComplete(
    IN p_title VARCHAR(150),
    IN p_developer_name VARCHAR(100),
    IN p_publisher_id INT,
    IN p_genre_id INT,
    IN p_platform_id INT,
    IN p_price DECIMAL(6,2)
)
BEGIN
    DECLARE v_dev_id INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Check if developer exists, if not create
    SELECT developer_id INTO v_dev_id FROM Developer WHERE name = p_developer_name LIMIT 1;

    IF v_dev_id IS NULL THEN
        INSERT INTO Developer (name) VALUES (p_developer_name);
        SET v_dev_id = LAST_INSERT_ID();
    END IF;

    INSERT INTO Game (title, developer_id, publisher_id, base_price_usd)
    VALUES (p_title, v_dev_id, p_publisher_id, p_price);

    SET @new_game_id = LAST_INSERT_ID();

    INSERT INTO GameGenre (game_id, genre_id, is_primary)
    VALUES (@new_game_id, p_genre_id, TRUE);

    INSERT INTO GamePlatformListing (game_id, platform_id, price_usd)
    VALUES (@new_game_id, p_platform_id, p_price);

    COMMIT;

    SELECT @new_game_id AS registered_game_id, 'SUCCESS' AS status;
END;
    `;

    try {
        await pool.query(sql);
        console.log('Procedure updated successfully');
        process.exit(0);
    } catch (err) {
        console.error('Error updating procedure:', err);
        process.exit(1);
    }
}

updateProcedure();
