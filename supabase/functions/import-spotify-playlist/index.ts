import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spotifyUrl, playlistName } = await req.json();
    console.log('Importing from Spotify URL:', spotifyUrl);

    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Extract Spotify ID from URL
    const playlistMatch = spotifyUrl.match(/playlist\/([a-zA-Z0-9]+)/);
    const trackMatch = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
    
    if (!playlistMatch && !trackMatch) {
      throw new Error('Invalid Spotify URL');
    }

    // Get Spotify access token
    const spotifyClientId = Deno.env.get('SPOTIFY_CLIENT_ID');
    const spotifyClientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
    
    if (!spotifyClientId || !spotifyClientSecret) {
      throw new Error('Spotify credentials not configured');
    }

    console.log('Getting Spotify access token...');
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${spotifyClientId}:${spotifyClientSecret}`)
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Spotify token error:', errorText);
      throw new Error('Failed to get Spotify access token');
    }

    const tokenData = await tokenResponse.json();
    const access_token = tokenData.access_token;

    if (!access_token) {
      throw new Error('No access token received from Spotify');
    }

    let tracks = [];

    if (playlistMatch) {
      // Fetch playlist tracks from Spotify
      const playlistId = playlistMatch[1];
      console.log('Fetching playlist:', playlistId);
      
      const playlistResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}`,
        { headers: { 'Authorization': `Bearer ${access_token}` } }
      );

      if (!playlistResponse.ok) {
        const errorText = await playlistResponse.text();
        console.error('Spotify playlist fetch error:', errorText);
        throw new Error(`Failed to fetch playlist: ${playlistResponse.status}`);
      }

      const playlistData = await playlistResponse.json();
      console.log('Playlist data received:', JSON.stringify(playlistData).substring(0, 200));
      
      if (!playlistData.tracks || !playlistData.tracks.items) {
        console.error('Invalid playlist structure:', playlistData);
        throw new Error('Invalid playlist data from Spotify');
      }

      tracks = playlistData.tracks.items
        .filter((item: any) => item?.track)
        .map((item: any) => ({
          title: item.track.name,
          artist: item.track.artists?.[0]?.name || 'Unknown Artist',
          album: item.track.album?.name,
        }));
    } else if (trackMatch) {
      // Fetch single track from Spotify
      const trackId = trackMatch[1];
      console.log('Fetching track:', trackId);
      
      const trackResponse = await fetch(
        `https://api.spotify.com/v1/tracks/${trackId}`,
        { headers: { 'Authorization': `Bearer ${access_token}` } }
      );

      if (!trackResponse.ok) {
        const errorText = await trackResponse.text();
        console.error('Spotify track fetch error:', errorText);
        throw new Error(`Failed to fetch track: ${trackResponse.status}`);
      }

      const trackData = await trackResponse.json();
      
      if (!trackData.name) {
        throw new Error('Invalid track data from Spotify');
      }

      tracks = [{
        title: trackData.name,
        artist: trackData.artists?.[0]?.name || 'Unknown Artist',
        album: trackData.album?.name,
      }];
    }

    console.log(`Found ${tracks.length} tracks from Spotify`);

    // Search Internet Archive for each track and create database records
    const foundTracks = [];
    
    for (const track of tracks) {
      try {
        console.log(`Searching for: ${track.artist} - ${track.title}`);
        
        // Search Internet Archive with better matching
        const artistQuery = encodeURIComponent(track.artist);
        const titleQuery = encodeURIComponent(track.title);
        const archiveResponse = await fetch(
          `https://archive.org/advancedsearch.php?q=creator:${artistQuery}%20AND%20title:${titleQuery}%20AND%20mediatype:audio&fl=identifier,title,creator,downloads&sort=downloads%20desc&rows=5&output=json`
        );
        
        const archiveData = await archiveResponse.json();
        console.log(`Search results for "${track.artist} - ${track.title}":`, archiveData.response.docs.length);
        
        if (archiveData.response.docs.length > 0) {
          // Find best match by checking title similarity
          let bestMatch = archiveData.response.docs[0];
          const searchTitle = track.title.toLowerCase();
          const searchArtist = track.artist.toLowerCase();
          
          for (const doc of archiveData.response.docs) {
            const docTitle = (doc.title || '').toLowerCase();
            const docCreator = (doc.creator || '').toLowerCase();
            
            if (docTitle.includes(searchTitle) && docCreator.includes(searchArtist)) {
              bestMatch = doc;
              break;
            }
          }
          
          const doc = bestMatch;
          console.log(`Best match: ${doc.title} by ${doc.creator}`);
          
          // Get metadata for the item to find audio file
          const metadataResponse = await fetch(
            `https://archive.org/metadata/${doc.identifier}`
          );
          const metadata = await metadataResponse.json();
          
          // Find first MP3 or other audio file
          const audioFile = metadata.files?.find((f: any) => 
            f.format === 'VBR MP3' || f.format === 'MP3' || f.format === 'Ogg Vorbis'
          );
          
          if (audioFile) {
            const streamUrl = `https://archive.org/download/${doc.identifier}/${encodeURIComponent(audioFile.name)}`;
            
            // Insert or get existing track
            const { data: existingTrack } = await supabaseClient
              .from('tracks')
              .select('id')
              .eq('source_id', doc.identifier)
              .single();
            
            let trackId;
            
            if (existingTrack) {
              trackId = existingTrack.id;
            } else {
              const { data: newTrack, error: trackError } = await supabaseClient
                .from('tracks')
                .insert({
                  title: track.title,
                  artist: track.artist,
                  album: track.album,
                  stream_url: streamUrl,
                  source: 'archive.org',
                  source_id: doc.identifier,
                })
                .select()
                .single();
              
              if (trackError) {
                console.error('Error inserting track:', trackError);
                continue;
              }
              
              trackId = newTrack.id;
            }
            
            foundTracks.push({ trackId, title: track.title, artist: track.artist });
          }
        }
      } catch (error) {
        console.error(`Error processing track ${track.title}:`, error);
      }
    }

    console.log(`Found ${foundTracks.length} tracks on Internet Archive`);

    // Dedupe tracks by trackId
    const uniqueMap = new Map<string, { trackId: string; title: string; artist: string }>();
    for (const t of foundTracks) {
      if (!uniqueMap.has(t.trackId)) uniqueMap.set(t.trackId, t);
    }
    const uniqueFoundTracks = Array.from(uniqueMap.values());

    // Create playlist
    const { data: playlist, error: playlistError } = await supabaseClient
      .from('playlists')
      .insert({
        user_id: user.id,
        name: playlistName || 'Imported from Spotify',
        description: `Imported ${uniqueFoundTracks.length} tracks`,
      })
      .select()
      .single();

    if (playlistError) {
      throw playlistError;
    }

    // Add tracks to playlist
    const playlistTracks = uniqueFoundTracks.map((track, index) => ({
      playlist_id: playlist.id,
      track_id: track.trackId,
      position: index,
    }));

    const { error: insertError } = await supabaseClient
      .from('playlist_tracks')
      .upsert(playlistTracks, { onConflict: 'playlist_id,track_id' });

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        playlist,
        tracksFound: uniqueFoundTracks.length,
        tracksTotal: tracks.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in import-spotify-playlist:', error);
    let errorMessage = 'Unknown error occurred';
    if (error && typeof error === 'object') {
      const e = error as any;
      errorMessage = e.message || e.error || e.hint || e.details || JSON.stringify(e);
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
