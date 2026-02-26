-- Restrict avatar bucket to authenticated users only.
-- Unauthenticated visitors cannot enumerate or access user avatar files.
-- The app only displays avatars to logged-in users, so this has no functional impact.

-- Make the bucket private (disables unauthenticated CDN access)
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Replace the public SELECT policy with an authenticated-only policy
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated users can view avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
