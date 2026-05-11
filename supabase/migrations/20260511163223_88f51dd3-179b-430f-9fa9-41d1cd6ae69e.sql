UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[],
    file_size_limit    = 10485760
WHERE id IN ('product-images','marketing-creatives');