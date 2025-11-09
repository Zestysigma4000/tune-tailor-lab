import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const searchYouTubeMusic = async (title: string, artist: string) => {
  try {
    const query = `${title} ${artist}`;
    const searchUrl = `https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30`;
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: { clientName: 'WEB_REMIX', clientVersion: '1.20231122.01.00' }
        },
        query
      })
    });

    const data = await response.json();
    const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
    
    if (!contents) return null;

    for (const section of contents) {
      const musicShelf = section?.musicShelfRenderer;
      if (!musicShelf?.contents) continue;

      for (const item of musicShelf.contents) {
        const renderer = item?.musicResponsiveListItemRenderer;
        if (!renderer) continue;

        const videoId = renderer?.playlistItemData?.videoId || 
                       renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
        
        if (videoId) {
          const titleText = renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || title;
          const artistText = renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || artist;
          
          return {
            videoId,
            title: titleText,
            artist: artistText,
            thumbnail: renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url
          };
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error searching YouTube Music:', error);
    return null;
  }
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
          name: item.track.name,
          artists: item.track.artists,
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
        name: trackData.name,
        artists: trackData.artists,
      }];
    }

    console.log(`Found ${tracks.length} tracks from Spotify`);

    // Search YouTube Music for each track
    const foundTracks = [];
    
    for (const track of tracks) {
      const title = track.name;
      const artist = track.artists[0]?.name || 'Unknown Artist';
      
      console.log(`Searching for: ${title} by ${artist}`);
      const ytTrack = await searchYouTubeMusic(title, artist);
      
      if (ytTrack) {
        const { data: existingTrack } = await supabaseClient
          .from('tracks')
          .select('id')
          .eq('source_id', ytTrack.videoId)
          .single();

        let trackId;
        if (existingTrack) {
          trackId = existingTrack.id;
        } else {
          const { data: newTrack, error: trackError } = await supabaseClient
            .from('tracks')
            .insert({
              title: ytTrack.title,
              artist: ytTrack.artist,
              stream_url: `https://www.youtube.com/watch?v=${ytTrack.videoId}`,
              source_id: ytTrack.videoId,
              source: 'youtube',
              cover_image: ytTrack.thumbnail
            })
            .select()
            .single();

          if (trackError) {
            console.error('Error inserting track:', trackError);
            continue;
          }
          trackId = newTrack.id;
        }
        
        foundTracks.push(trackId);
      }
    }

    console.log(`Found ${foundTracks.length} tracks on YouTube Music`);

    // Create playlist
    const { data: playlist, error: playlistError } = await supabaseClient
      .from('playlists')
      .insert({
        user_id: user.id,
        name: playlistName || 'Imported from Spotify',
        description: `Imported ${foundTracks.length} tracks`,
      })
      .select()
      .single();

    if (playlistError) {
      throw playlistError;
    }

    // Add tracks to playlist
    const playlistTracks = foundTracks.map((trackId, index) => ({
      playlist_id: playlist.id,
      track_id: trackId,
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
        tracksFound: foundTracks.length,
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
