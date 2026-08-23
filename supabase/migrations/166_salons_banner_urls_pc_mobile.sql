ALTER TABLE salons ADD COLUMN IF NOT EXISTS banner_urls_pc text[];
ALTER TABLE salons ADD COLUMN IF NOT EXISTS banner_urls_mobile text[];

UPDATE salons SET banner_urls_pc = banner_urls, banner_urls_mobile = banner_urls
WHERE banner_urls IS NOT NULL AND banner_urls_pc IS NULL;
