import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ImportDialog = ({ onImportComplete }: { onImportComplete: () => void }) => {
  const [open, setOpen] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!spotifyUrl) {
      toast.error("Please enter a Spotify URL");
      return;
    }

    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-spotify-playlist', {
        body: { spotifyUrl, playlistName: playlistName || undefined }
      });

      if (error) throw error;

      toast.success(`Imported ${data.tracksFound} of ${data.tracksTotal} tracks`);
      setOpen(false);
      setSpotifyUrl("");
      setPlaylistName("");
      onImportComplete();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || "Failed to import playlist");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Import from Spotify
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Spotify</DialogTitle>
          <DialogDescription>
            Paste a Spotify playlist or track share link to import songs from Internet Archive's free music library.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="spotify-url">Spotify Share Link</Label>
            <Input
              id="spotify-url"
              placeholder="https://open.spotify.com/playlist/..."
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="playlist-name">Playlist Name (optional)</Label>
            <Input
              id="playlist-name"
              placeholder="My Imported Playlist"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
            />
          </div>
          <Button onClick={handleImport} disabled={importing} className="w-full">
            {importing ? "Importing..." : "Import Playlist"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
