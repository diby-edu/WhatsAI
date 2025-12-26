-- =============================================
-- Storage Policies for 'images' bucket
-- Run this in Supabase SQL Editor
-- =============================================

-- Allow authenticated users to upload images
CREATE POLICY "Allow authenticated uploads" ON storage.objects
    FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'images');

-- Allow authenticated users to update their own images
CREATE POLICY "Allow authenticated updates" ON storage.objects
    FOR UPDATE 
    TO authenticated 
    USING (bucket_id = 'images');

-- Allow public read access to images
CREATE POLICY "Allow public read" ON storage.objects
    FOR SELECT 
    TO public 
    USING (bucket_id = 'images');

-- Allow authenticated users to delete their images
CREATE POLICY "Allow authenticated deletes" ON storage.objects
    FOR DELETE 
    TO authenticated 
    USING (bucket_id = 'images');
