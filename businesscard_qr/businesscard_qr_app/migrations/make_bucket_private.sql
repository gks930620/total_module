-- Make storage bucket private to prevent direct access
-- This will require authenticated access to all files

-- Update bucket to private (this needs to be done via Supabase dashboard or API)
-- SQL command for reference (actual execution via dashboard):
-- UPDATE storage.buckets SET public = false WHERE id = 'business-card';

-- Create storage policies for authenticated access
-- Allow service role to read all files
CREATE POLICY "Service role can read all files" ON storage.objects
FOR SELECT
USING (bucket_id = 'business-card' AND auth.role() = 'service_role');

-- Allow service role to insert/update/delete files
CREATE POLICY "Service role can manage all files" ON storage.objects
FOR ALL
USING (bucket_id = 'business-card' AND auth.role() = 'service_role');

-- Block public access to all files in the bucket
CREATE POLICY "Block public access to business-card bucket" ON storage.objects
FOR SELECT
USING (bucket_id = 'business-card' AND false);

-- Note: After making the bucket private, you need to:
-- 1. Go to Supabase Dashboard > Storage > business-card bucket
-- 2. Click Settings and toggle "Public bucket" to OFF
-- 3. This ensures only authenticated requests can access files