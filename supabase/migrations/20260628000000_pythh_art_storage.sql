-- Public bucket for daily Signal Art rasters (Gemini / Imagen output)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pythh-art',
  'pythh-art',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS pythh_art_public_read ON storage.objects;
CREATE POLICY pythh_art_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'pythh-art');

DROP POLICY IF EXISTS pythh_art_service_write ON storage.objects;
CREATE POLICY pythh_art_service_write ON storage.objects
  FOR ALL USING (bucket_id = 'pythh-art') WITH CHECK (bucket_id = 'pythh-art');
