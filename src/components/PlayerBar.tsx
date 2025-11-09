import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface Track {
  id: string;
  title: string;
  artist: string;
  stream_url: string;
  cover_image?: string;
}

interface PlayerBarProps {
  currentTrack: Track | null;
  onNext: () => void;
  onPrevious: () => void;
}

export const PlayerBar = ({ currentTrack, onNext, onPrevious }: PlayerBarProps) => {
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isReady, setIsReady] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setIsReady(true);
    };

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentTrack || !isReady) return;

    const videoId = currentTrack.stream_url.split('v=')[1]?.split('&')[0];
    if (!videoId) return;

    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      playerRef.current.playVideo();
    } else {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId,
        playerVars: { autoplay: 1 },
        events: {
          onReady: (event: any) => {
            event.target.playVideo();
            setIsPlaying(true);
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setDuration(event.target.getDuration());
              
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                setCurrentTime(event.target.getCurrentTime());
              }, 100);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              if (intervalRef.current) clearInterval(intervalRef.current);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              onNext();
            }
          }
        }
      });
    }
  }, [currentTrack, isReady]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (value: number[]) => {
    if (playerRef.current) {
      playerRef.current.seekTo(value[0], true);
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
      <div id="youtube-player" style={{ display: 'none' }}></div>
      
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{currentTrack.title}</p>
            <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={onPrevious}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={togglePlay}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onNext}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center gap-2 w-32">
            <Volume2 className="h-4 w-4" />
            <Slider
              value={[volume]}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
