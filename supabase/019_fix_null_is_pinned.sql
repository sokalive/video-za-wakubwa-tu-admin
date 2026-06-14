-- Ensure unpinned flag is never NULL (NULL rows vanish from homepage when pin logic runs).
UPDATE videos SET is_pinned = false WHERE is_pinned IS NULL;
UPDATE videos SET pin_order = NULL WHERE is_pinned = false AND pin_order IS NOT NULL;
