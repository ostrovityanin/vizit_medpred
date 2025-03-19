import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, Volume1, VolumeX } from 'lucide-react';
import { formatSeconds } from '@/lib/timer';

interface FileAudioPlayerProps {
  audioUrl: string;
  filename: string;
}

export default function FileAudioPlayer({ audioUrl, filename }: FileAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    
    setIsPlaying(!isPlaying);
  };
  
  const handleTimeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newVolume = value[0];
    audio.volume = newVolume;
    setVolume(newVolume);
    
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };
  
  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (newMuted) {
      audio.volume = 0;
    } else {
      audio.volume = volume;
    }
  };
  
  return (
    <div className="p-3 border border-neutral-200 rounded-lg">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <div className="text-sm font-medium mb-2 truncate" title={filename}>
        {filename}
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 rounded-full"
          onClick={togglePlay}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        <div className="text-xs text-neutral-500">
          {formatSeconds(Math.floor(currentTime))} / {formatSeconds(Math.floor(duration))}
        </div>
        
        <Button 
          variant="ghost" 
          size="sm"
          className="h-8 w-8 p-0 ml-auto rounded-full"
          onClick={toggleMute}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="h-4 w-4" />
          ) : volume < 0.5 ? (
            <Volume1 className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <div className="mb-2">
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 100}
          step={0.1}
          onValueChange={handleTimeChange}
        />
      </div>
      
      <div className="flex items-center gap-2">
        <VolumeX className="h-3 w-3 text-neutral-400" />
        <Slider
          value={[isMuted ? 0 : volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          className="flex-1"
        />
        <Volume2 className="h-3 w-3 text-neutral-400" />
      </div>
    </div>
  );
}