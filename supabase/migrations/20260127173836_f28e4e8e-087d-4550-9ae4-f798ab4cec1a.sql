-- Create templates bucket for document templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public can read templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'templates');