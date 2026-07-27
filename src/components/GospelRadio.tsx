import { useState, useRef, useEffect } from "react";
import { Play, Pause, Radio, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

// Rádio Gospel online - você pode trocar por outra URL de streaming
const RADIO_STREAM_URL = "https://stream.zeno.fm/yn65fsaurfhvv";

const GospelRadio = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(RADIO_STREAM_URL);
    audioRef.current.volume = volume;

    // Tenta autoplay
    const playPromise = audioRef.current.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setHasInteracted(true);
        })
        .catch(() => {
          // Autoplay bloqueado - aguarda interação do usuário
          setIsPlaying(false);
        });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setHasInteracted(true);
      });
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (value[0] > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-40 animate-in slide-in-from-bottom duration-500">
      <div className="bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-card p-3 flex items-center gap-3">
        {/* Indicador de rádio */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="h-5 w-5 text-primary" />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-foreground font-body">Rádio Gospel</p>
            <p className="text-[10px] text-muted-foreground font-body">
              {isPlaying ? "Ao vivo" : "Pausado"}
            </p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={togglePlay}
            className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>

          {/* Volume */}
          <div 
            className="relative"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMute}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          
          {showVolume && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-lg p-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
              <Slider
                orientation="vertical"
                value={[volume]}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="h-20"
              />
            </div>
          )}
          </div>
        </div>

        {/* Prompt para interação se autoplay bloqueado */}
        {!hasInteracted && !isPlaying && (
        <p className="text-[10px] text-muted-foreground font-body hidden sm:block animate-in fade-in duration-300">
            Clique ▶ para ouvir
        </p>
        )}
      </div>
    </div>
  );
};

export default GospelRadio;
