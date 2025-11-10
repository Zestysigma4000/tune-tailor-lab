import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Play, Music2 } from "lucide-react";
import { toast } from "sonner";

interface YouTubeTrack {
  videoId: string;
  title: string;
  artist: string;
  thumbnail?: string;
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
  const [results, setResults] = useState<YouTubeTrack[]>([]);
  const [featuredTracks, setFeaturedTracks] = useState<YouTubeTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    // Load featured/popular tracks on mount
    loadFeaturedTracks();
  }, []);

  const parseYouTubeMusicResponse = (data: any): YouTubeTrack[] => {
    const tracks: YouTubeTrack[] = [];
    const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
    
    if (!contents) return tracks;

    for (const section of contents) {
      const musicShelf = section?.musicShelfRenderer;
      if (!musicShelf?.contents) continue;

      for (const item of musicShelf.contents) {
        const renderer = item?.musicResponsiveListItemRenderer;
        if (!renderer) continue;

        const videoId = renderer?.playlistItemData?.videoId || 
                       renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
        
        if (videoId) {
          tracks.push({
            videoId,
            title: renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '',
            artist: renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '',
            thumbnail: renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url
          });
        }
      }
    }
    return tracks;
  };

  const loadFeaturedTracks = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-music-search`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({ query: 'top hits 2024' })
        }
      );
      const data = await response.json();
      setFeaturedTracks(parseYouTubeMusicResponse(data).slice(0, 20));
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-music-search`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({ query: searchTerm })
        }
      );
      
      const data = await response.json();
      const tracks = parseYouTubeMusicResponse(data);
      setResults(tracks);
      
      if (tracks.length === 0) {
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

  const playTrack = (track: YouTubeTrack) => {
    onPlayTrack({
      id: track.videoId,
      title: track.title,
      artist: track.artist,
      stream_url: `https://www.youtube.com/watch?v=${track.videoId}`,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const renderTracks = (tracks: YouTubeTrack[]) => (
    <div className="space-y-2">
      {tracks.map((track) => (
        <div
          key={track.videoId}
          className="p-4 rounded-lg bg-card hover:bg-accent transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {track.thumbnail ? (
              <img src={track.thumbnail} alt={track.title} className="w-12 h-12 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                <Music2 className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{track.title}</p>
              <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
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
