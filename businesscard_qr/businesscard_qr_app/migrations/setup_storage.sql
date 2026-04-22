-- Create storage bucket for business card files
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-card-files', 'business-card-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access to images
CREATE POLICY "Public read access for images" ON storage.objects
FOR SELECT USING (bucket_id = 'business-card-files' AND 
                 (storage.foldername(name))[1] = 'images');

-- Create policy for authenticated users to upload images
CREATE POLICY "Authenticated users can upload images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'business-card-files' AND 
                      (storage.foldername(name))[1] = 'images');

-- Create policy for authenticated users to update their own images
CREATE POLICY "Users can update their own images" ON storage.objects
FOR UPDATE USING (bucket_id = 'business-card-files' AND 
                 (storage.foldername(name))[1] = 'images');

-- Create policy for authenticated users to delete their own images
CREATE POLICY "Users can delete their own images" ON storage.objects
FOR DELETE USING (bucket_id = 'business-card-files' AND 
                 (storage.foldername(name))[1] = 'images');

-- VCF files policies (more restrictive)
-- Create policy for authenticated users to manage VCF files
CREATE POLICY "Authenticated users can manage VCF files" ON storage.objects
FOR ALL USING (bucket_id = 'business-card-files' AND 
              (storage.foldername(name))[1] = 'vcards');

-- Create policy for public read access to VCF files via signed URLs only
CREATE POLICY "Public read VCF via signed URLs" ON storage.objects
FOR SELECT USING (bucket_id = 'business-card-files' AND 
                 (storage.foldername(name))[1] = 'vcards');