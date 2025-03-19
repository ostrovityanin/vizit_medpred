import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, Download } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { formatSeconds } from '@/lib/timer';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';

interface Recording {
  id: number;
  filename: string;
  duration: number;
  timestamp: string;
  targetUsername: string;
  sent: boolean;
}

export default function AudioBrowser() {
  const { toast } = useToast();
  const [currentAudio, setCurrentAudio] = useState<{ id: number, isPlaying: boolean } | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // Получаем список записей
  const { data: recordings, isLoading } = useQuery({
    queryKey: ['/api/recordings'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };

  const togglePlay = (id: number) => {
    if (currentAudio && currentAudio.id === id) {
      // Уже играет этот аудиофайл - остановим или продолжим
      if (currentAudio.isPlaying) {
        audioElement?.pause();
        setCurrentAudio({ id, isPlaying: false });
      } else {
        audioElement?.play();
        setCurrentAudio({ id, isPlaying: true });
      }
    } else {
      // Новый аудиофайл
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
      
      const newAudio = new Audio(`/api/recordings/${id}/download`);
      setAudioElement(newAudio);
      
      newAudio.onended = () => {
        setCurrentAudio(null);
      };
      
      newAudio.oncanplay = () => {
        newAudio.play().catch(err => console.error("Error playing:", err));
        setCurrentAudio({ id, isPlaying: true });
      };
      
      newAudio.onerror = () => {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить аудиофайл",
          variant: "destructive",
        });
        setCurrentAudio(null);
      };
    }
  };

  const handleDownload = (id: number) => {
    window.open(`/api/recordings/${id}/download`, '_blank');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span>Назад</span>
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-tgblue">Аудио браузер</h1>
      </header>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-medium mb-4">Записи</h2>
        
        {isLoading ? (
          <p className="text-neutral-500">Загрузка записей...</p>
        ) : recordings && recordings.length > 0 ? (
          <div className="space-y-3">
            {recordings.map((recording: Recording) => (
              <div 
                key={recording.id} 
                className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{recording.filename}</p>
                    <p className="text-sm text-neutral-500">
                      Пользователь: {recording.targetUsername}
                    </p>
                    <p className="text-sm text-neutral-500">
                      Создан: {formatDate(recording.timestamp)}
                    </p>
                    <p className="text-sm text-neutral-500">
                      Длительность: {formatSeconds(recording.duration)}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => togglePlay(recording.id)}
                      className="h-8 w-8 p-0 rounded-full"
                    >
                      {currentAudio && currentAudio.id === recording.id && currentAudio.isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(recording.id)}
                      className="h-8 w-8 p-0 rounded-full"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {currentAudio && currentAudio.id === recording.id && (
                  <div className="mt-3 h-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-tgblue animate-pulse"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-500">Нет записей</p>
        )}
      </div>
    </div>
  );
}