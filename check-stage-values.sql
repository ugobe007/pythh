-- Check what integer values are used for stage
SELECT DISTINCT stage, COUNT(*) as count
FROM startup_uploads
WHERE stage IS NOT NULL
GROUP BY stage
ORDER BY stage;

-- Also check a few sample rows to understand the mapping
SELECT id, name, stage, sectors[1] as first_sector
FROM startup_uploads
WHERE stage IS NOT NULL
LIMIT 10;
