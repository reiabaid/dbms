-- ADD COVER ART TO GAMES (Also demonstrates ALTER TABLE - DDL)
USE nexusdb;

ALTER TABLE Game ADD COLUMN cover_image_url VARCHAR(500) NULL;

-- Steam CDN header images (publicly accessible, no API key needed)
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/292030/header.jpg' WHERE title = 'The Witcher 3';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg' WHERE title = 'Elden Ring';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg' WHERE title = 'Hades';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/2322010/header.jpg' WHERE title = 'God of War Ragnarok';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/2564960/header.jpg' WHERE title = 'Marvels Spider-Man 2';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/2050650/header.jpg' WHERE title = 'Resident Evil 4 Remake';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1190460/header.jpg' WHERE title = 'Death Stranding';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/2215430/header.jpg' WHERE title = 'Ghost of Tsushima';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/588650/header.jpg' WHERE title = 'Dead Cells';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/header.jpg' WHERE title = 'Stardew Valley';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/header.jpg' WHERE title = 'Hollow Knight';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/646570/header.jpg' WHERE title = 'Slay the Spire';
UPDATE Game SET cover_image_url = 'https://cdn.cloudflare.steamstatic.com/steam/apps/590380/header.jpg' WHERE title = 'Into the Breach';
UPDATE Game SET cover_image_url = 'https://upload-os-bbs.mihoyo.com/upload/2020/09/28/7340912/a4dbe4a67ef1d5b5a5879e36e4e950f1_3840x2160.jpg' WHERE title = 'Genshin Impact';
