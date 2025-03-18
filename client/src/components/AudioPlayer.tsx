import { useState, useRef, useEffect } from 'react';
import { PlayCircle, PauseCircle } from 'lucide-react';
import { formatSeconds } from '@/lib/timer';

interface AudioPlayerProps {
  audioUrl: string;
}

export default function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    const handleLoadedMetadata = () => {
      setDuration(Math.floor(audio.duration));
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(Math.floor(audio.currentTime));
      setProgress((audio.currentTime / audio.duration) * 100);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
    };
    
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [audioUrl]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="w-full bg-neutral-100 rounded-lg p-3 flex items-center">
      <button 
        className="w-10 h-10 rounded-full bg-tgblue text-white flex items-center justify-center mr-3"
        onClick={togglePlayback}
      >
        {isPlaying ? (
          <PauseCircle className="h-5 w-5" />
        ) : (
          <PlayCircle className="h-5 w-5" />
        )}
      </button>
      <div className="flex-1">
        <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-tgblue"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="text-xs text-neutral-700 mt-1 flex justify-between">
          <span>{formatSeconds(currentTime)}</span>
          <span>{formatSeconds(duration)}</span>
        </div>
      </div>
    </div>
  );
}
