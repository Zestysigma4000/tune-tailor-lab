import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@/components/Auth";
import { ImportDialog } from "@/components/ImportDialog";
import { PlayerBar } from "@/components/PlayerBar";
import { Button } from "@/components/ui/button";
import { Music, LogOut } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  stream_url: string;
  cover_image: string;
}

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchPlaylists();
    }
  }, [user]);

  useEffect(() => {
    if (selectedPlaylist) {
      fetchTracks(selectedPlaylist);
    }
  }, [selectedPlaylist]);

  const fetchPlaylists = async () => {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching playlists:', error);
    } else {
      setPlaylists(data || []);
    }
  };

  const fetchTracks = async (playlistId: string) => {
    const { data, error } = await supabase
      .from('playlist_tracks')
      .select(`
        track_id,
        tracks (
          id,
          title,
          artist,
          album,
          stream_url,
          cover_image
        )
      `)
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching tracks:', error);
    } else {
      const trackList = data?.map((item: any) => item.tracks).filter(Boolean) || [];
      setTracks(trackList);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const playTrack = (track: Track, index: number) => {
    setCurrentTrack(track);
    setCurrentTrackIndex(index);
  };

  const handleNext = () => {
    if (currentTrackIndex < tracks.length - 1) {
      const nextIndex = currentTrackIndex + 1;
      playTrack(tracks[nextIndex], nextIndex);
    }
  };

  const handlePrevious = () => {
    if (currentTrackIndex > 0) {
      const prevIndex = currentTrackIndex - 1;
      playTrack(tracks[prevIndex], prevIndex);
    }
  };

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Music Library</h1>
          </div>
          <div className="flex items-center gap-4">
            <ImportDialog onImportComplete={fetchPlaylists} />
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[300px,1fr] gap-6">
          <aside className="space-y-4">
            <h2 className="text-lg font-semibold">Your Playlists</h2>
            <div className="space-y-2">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => setSelectedPlaylist(playlist.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedPlaylist === playlist.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card hover:bg-accent'
                  }`}
                >
                  <p className="font-medium">{playlist.name}</p>
                  <p className="text-sm opacity-75">{playlist.description}</p>
                </button>
              ))}
              {playlists.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No playlists yet. Import one from Spotify!
                </p>
              )}
            </div>
          </aside>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {selectedPlaylist ? 'Tracks' : 'Select a playlist'}
            </h2>
            <div className="space-y-2">
              {tracks.map((track, index) => (
                <button
                  key={track.id}
                  onClick={() => playTrack(track, index)}
                  className={`w-full text-left p-4 rounded-lg transition-colors ${
                    currentTrack?.id === track.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card hover:bg-accent'
                  }`}
                >
                  <p className="font-medium">{track.title}</p>
                  <p className="text-sm opacity-75">{track.artist}</p>
                  {track.album && <p className="text-xs opacity-60">{track.album}</p>}
                </button>
              ))}
              {tracks.length === 0 && selectedPlaylist && (
                <p className="text-muted-foreground text-sm">No tracks in this playlist</p>
              )}
            </div>
          </div>
        </div>
      </main>

      <PlayerBar
        currentTrack={currentTrack}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />
    </div>
  );
};

export default Index;
