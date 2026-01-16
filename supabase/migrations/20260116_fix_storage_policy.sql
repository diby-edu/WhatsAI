-- =============================================
-- FIX STORAGE POLICY VULNERABILITY
-- Date: 2026-01-16
-- Issue: Any authenticated user can delete any image
-- =============================================

-- Step 1: Remove the vulnerable policy
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Step 2: Create a secure policy
-- Users can only delete images in their own folder (folder name = user_id)
CREATE POLICY "Users can delete own images" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Verification query (run after migration):
-- SELECT policyname, cmd, qual FROM pg_policies 
-- WHERE tablename = 'objects' AND schemaname = 'storage';
