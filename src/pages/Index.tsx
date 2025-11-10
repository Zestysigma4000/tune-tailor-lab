import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@/components/Auth";
import { ImportDialog } from "@/components/ImportDialog";
import { PlayerBar } from "@/components/PlayerBar";
import { Library } from "@/pages/Library";
import { PlaylistView } from "@/pages/PlaylistView";
import { Sidebar } from "@/components/Sidebar";
import { PlaylistManager } from "@/components/PlaylistManager";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState("library");
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);

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

  const selectedPlaylistData = playlists.find(p => p.id === selectedPlaylist);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        playlists={playlists}
        selectedPlaylist={selectedPlaylist}
        onSelectPlaylist={setSelectedPlaylist}
        onCreatePlaylist={() => setShowPlaylistDialog(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="px-8 py-4 flex items-center justify-between">
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <ImportDialog onImportComplete={fetchPlaylists} />
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-6 pb-32">
          {activeTab === "library" && (
            <Library onPlayTrack={(track) => {
              setCurrentTrack(track as any);
              setCurrentTrackIndex(0);
            }} />
          )}
          
          {activeTab === "playlists" && (
            <PlaylistView
              playlist={selectedPlaylistData || null}
              tracks={tracks}
              currentTrack={currentTrack}
              onPlayTrack={playTrack}
              onDeletePlaylist={() => {
                setSelectedPlaylist(null);
                fetchPlaylists();
              }}
            />
          )}
          
          {activeTab === "search" && (
            <Library onPlayTrack={(track) => {
              setCurrentTrack(track as any);
              setCurrentTrackIndex(0);
            }} />
          )}
        </main>

        <PlayerBar
          currentTrack={currentTrack}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      </div>

      <PlaylistManager 
        onPlaylistsChange={fetchPlaylists} 
        open={showPlaylistDialog}
        onOpenChange={setShowPlaylistDialog}
      />
    </div>
  );
};

export default Index;
