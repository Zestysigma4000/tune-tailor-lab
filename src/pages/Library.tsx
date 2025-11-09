import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Play } from "lucide-react";
import { toast } from "sonner";

interface ArchiveTrack {
  identifier: string;
  title: string;
  creator: string;
  downloads?: number;
}

interface LibraryProps {
  onPlayTrack: (track: { id: string; title: string; artist: string; stream_url: string }) => void;
}

export const Library = ({ onPlayTrack }: LibraryProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ArchiveTrack[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setSearching(true);
    try {
      const query = encodeURIComponent(searchQuery);
      const response = await fetch(
        `https://archive.org/advancedsearch.php?q=${query}%20AND%20mediatype:audio&fl=identifier,title,creator,downloads&sort=downloads%20desc&rows=20&output=json`
      );
      
      const data = await response.json();
      setResults(data.response.docs || []);
      
      if (data.response.docs.length === 0) {
        toast.info("No results found");
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error("Failed to search");
    } finally {
      setSearching(false);
    }
  };

  const playTrack = async (track: ArchiveTrack) => {
    try {
      // Fetch metadata to get audio file
      const metadataResponse = await fetch(
        `https://archive.org/metadata/${track.identifier}`
      );
      const metadata = await metadataResponse.json();
      
      // Find first MP3 or audio file
      const audioFile = metadata.files?.find((f: any) => 
        f.format === 'VBR MP3' || f.format === 'MP3' || f.format === 'Ogg Vorbis'
      );
      
      if (audioFile) {
        const streamUrl = `https://archive.org/download/${track.identifier}/${encodeURIComponent(audioFile.name)}`;
        
        onPlayTrack({
          id: track.identifier,
          title: track.title,
          artist: track.creator || 'Unknown Artist',
          stream_url: streamUrl,
        });
        
        toast.success(`Playing: ${track.title}`);
      } else {
        toast.error("No audio file found for this track");
      }
    } catch (error) {
      console.error('Play error:', error);
      toast.error("Failed to play track");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input
          placeholder="Search for music..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={searching}>
          <Search className="h-4 w-4 mr-2" />
          {searching ? "Searching..." : "Search"}
        </Button>
      </div>

      <div className="space-y-2">
        {results.map((track) => (
          <div
            key={track.identifier}
            className="p-4 rounded-lg bg-card hover:bg-accent transition-colors flex items-center justify-between"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{track.title}</p>
              <p className="text-sm text-muted-foreground truncate">
                {track.creator || 'Unknown Artist'}
              </p>
              {track.downloads && (
                <p className="text-xs text-muted-foreground">
                  {track.downloads.toLocaleString()} downloads
                </p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => playTrack(track)}
            >
              <Play className="h-4 w-4" />
            </Button>
          </div>
        ))}
        
        {results.length === 0 && !searching && (
          <p className="text-center text-muted-foreground py-12">
            Search for music from Internet Archive's free library
          </p>
        )}
      </div>
    </div>
  );
};
