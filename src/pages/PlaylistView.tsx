import { Play, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeletePlaylist } from "@/components/PlaylistManager";

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  stream_url: string;
  cover_image: string;
}

interface PlaylistViewProps {
  playlist: { id: string; name: string; description: string } | null;
  tracks: Track[];
  currentTrack: Track | null;
  onPlayTrack: (track: Track, index: number) => void;
  onDeletePlaylist: () => void;
}

export const PlaylistView = ({ 
  playlist, 
  tracks, 
  currentTrack, 
  onPlayTrack,
  onDeletePlaylist 
}: PlaylistViewProps) => {
  if (!playlist) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <Music2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold mb-2">Select a Playlist</h2>
          <p className="text-muted-foreground">Choose a playlist from the sidebar to view its tracks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">{playlist.name}</h1>
          <p className="text-muted-foreground">{playlist.description}</p>
          <p className="text-sm text-muted-foreground mt-2">{tracks.length} songs</p>
        </div>
        <DeletePlaylist
          playlistId={playlist.id}
          playlistName={playlist.name}
          onDelete={onDeletePlaylist}
        />
      </div>

      <div className="space-y-1">
        {tracks.map((track, index) => (
          <button
            key={track.id}
            onClick={() => onPlayTrack(track, index)}
            className={`w-full text-left p-3 rounded-md transition-colors flex items-center gap-4 group ${
              currentTrack?.id === track.id
                ? 'bg-accent'
                : 'hover:bg-accent/50'
            }`}
          >
            <div className="flex-shrink-0 w-8 text-center">
              {currentTrack?.id === track.id ? (
                <div className="text-primary">▶</div>
              ) : (
                <span className="text-muted-foreground group-hover:hidden">{index + 1}</span>
              )}
              <Play className="h-4 w-4 hidden group-hover:block text-foreground mx-auto" />
            </div>
            
            {track.cover_image && (
              <img 
                src={track.cover_image} 
                alt={track.title} 
                className="w-10 h-10 rounded object-cover"
              />
            )}
            
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{track.title}</p>
              <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
            </div>
            
            {track.album && (
              <p className="text-sm text-muted-foreground hidden md:block truncate max-w-xs">
                {track.album}
              </p>
            )}
          </button>
        ))}
        {tracks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No tracks in this playlist
          </div>
        )}
      </div>
    </div>
  );
};
