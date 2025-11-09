-- Add UPDATE policy for playlist_tracks to allow upsert operations
DROP POLICY IF EXISTS "Users can update tracks in their playlists" ON public.playlist_tracks;

CREATE POLICY "Users can update tracks in their playlists"
ON public.playlist_tracks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
  )
);