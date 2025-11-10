import { Music, Home, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Playlist {
  id: string;
  name: string;
  description: string;
}

interface SidebarProps {
  playlists: Playlist[];
  selectedPlaylist: string | null;
  onSelectPlaylist: (id: string) => void;
  onCreatePlaylist: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar = ({ 
  playlists, 
  selectedPlaylist, 
  onSelectPlaylist, 
  onCreatePlaylist,
  activeTab,
  onTabChange 
}: SidebarProps) => {
  return (
    <div className="w-64 bg-sidebar-background border-r border-sidebar-border h-full flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <Music className="h-8 w-8 text-sidebar-primary" />
          <h1 className="text-2xl font-bold text-sidebar-foreground">Music</h1>
        </div>
        
        <nav className="space-y-2">
          <Button
            variant={activeTab === "library" ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => onTabChange("library")}
          >
            <Home className="h-5 w-5 mr-3" />
            Home
          </Button>
          <Button
            variant={activeTab === "search" ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => onTabChange("search")}
          >
            <Search className="h-5 w-5 mr-3" />
            Search
          </Button>
        </nav>
      </div>

      <div className="flex-1 px-4 pb-4">
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-sm font-semibold text-sidebar-foreground">Your Playlists</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onCreatePlaylist}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="space-y-1">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => {
                  onSelectPlaylist(playlist.id);
                  onTabChange("playlists");
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedPlaylist === playlist.id && activeTab === "playlists"
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <p className="font-medium truncate">{playlist.name}</p>
              </button>
            ))}
            {playlists.length === 0 && (
              <p className="text-xs text-sidebar-foreground/60 px-3 py-2">
                No playlists yet
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
