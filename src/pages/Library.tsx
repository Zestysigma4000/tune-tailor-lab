import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Play, Music2 } from "lucide-react";
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

const GENRES = [
  { name: "Rock", query: "rock music" },
  { name: "Jazz", query: "jazz music" },
  { name: "Classical", query: "classical music" },
  { name: "Blues", query: "blues music" },
  { name: "Folk", query: "folk music" },
  { name: "Electronic", query: "electronic music" },
  { name: "Hip Hop", query: "hip hop music" },
  { name: "Country", query: "country music" },
];

export const Library = ({ onPlayTrack }: LibraryProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ArchiveTrack[]>([]);
  const [featuredTracks, setFeaturedTracks] = useState<ArchiveTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    // Load featured/popular tracks on mount
    loadFeaturedTracks();
  }, []);

  const loadFeaturedTracks = async () => {
    try {
      const response = await fetch(
        `https://archive.org/advancedsearch.php?q=mediatype:audio&fl=identifier,title,creator,downloads&sort=downloads%20desc&rows=20&output=json`
      );
      const data = await response.json();
      setFeaturedTracks(data.response.docs || []);
    } catch (error) {
      console.error('Failed to load featured tracks:', error);
    }
  };

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setSearching(true);
    setSelectedGenre(null);
    try {
      const encodedQuery = encodeURIComponent(searchTerm);
      const response = await fetch(
        `https://archive.org/advancedsearch.php?q=${encodedQuery}%20AND%20mediatype:audio&fl=identifier,title,creator,downloads&sort=downloads%20desc&rows=30&output=json`
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

  const handleGenreClick = async (genre: { name: string; query: string }) => {
    setSelectedGenre(genre.name);
    setSearchQuery("");
    handleSearch(genre.query);
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

  const renderTracks = (tracks: ArchiveTrack[]) => (
    <div className="space-y-2">
      {tracks.map((track) => (
        <div
          key={track.identifier}
          className="p-4 rounded-lg bg-card hover:bg-accent transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
              <Music2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{track.title}</p>
              <p className="text-sm text-muted-foreground truncate">
                {track.creator || 'Unknown Artist'}
              </p>
              {track.downloads && (
                <p className="text-xs text-muted-foreground">
                  {track.downloads.toLocaleString()} plays
                </p>
              )}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => playTrack(track)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Play className="h-5 w-5" />
          </Button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input
          placeholder="Search songs, artists, albums..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button onClick={() => handleSearch()} disabled={searching}>
          <Search className="h-4 w-4 mr-2" />
          {searching ? "Searching..." : "Search"}
        </Button>
      </div>

      <Tabs defaultValue="featured" className="space-y-4">
        <TabsList>
          <TabsTrigger value="featured">Featured</TabsTrigger>
          <TabsTrigger value="genres">Genres</TabsTrigger>
        </TabsList>

        <TabsContent value="featured" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {selectedGenre ? `${selectedGenre} Music` : results.length > 0 ? 'Search Results' : 'Popular Tracks'}
            </h3>
            {renderTracks(results.length > 0 ? results : featuredTracks)}
            {results.length === 0 && featuredTracks.length === 0 && !searching && (
              <p className="text-center text-muted-foreground py-12">
                Loading featured music...
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="genres" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {GENRES.map((genre) => (
              <button
                key={genre.name}
                onClick={() => handleGenreClick(genre)}
                className="p-6 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 hover:from-primary/30 hover:to-primary/10 transition-all"
              >
                <Music2 className="h-8 w-8 mb-2 text-primary" />
                <p className="font-semibold">{genre.name}</p>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
