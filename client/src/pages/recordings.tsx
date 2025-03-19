import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DownloadCloud, ArrowLeft, Play, X } from 'lucide-react';
import { Link } from 'wouter';
import FileAudioPlayer from '@/components/FileAudioPlayer';

interface Recording {
  id: number;
  filename: string;
  duration: number;
  timestamp: string;
  targetUsername: string;
  senderUsername?: string | null;
  fileSize?: number | null;
  sent: boolean;
}

export default function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [audioPlayerVisible, setAudioPlayerVisible] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/recordings');
      
      if (!response.ok) {
        throw new Error('Failed to fetch recordings');
      }
      
      const data = await response.json();
      setRecordings(data);
    } catch (error) {
      console.error('Error fetching recordings:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список записей',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };

  const formatDuration = (seconds: number) => {
    // Убедимся, что значение времени не слишком большое
    if (seconds > 24 * 60 * 60) {
      // Если значение выглядит как timestamp, преобразуем его в секунды
      seconds = Math.floor(seconds / 1000);
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const downloadRecording = (id: number) => {
    window.location.href = `/api/recordings/${id}/download`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Назад</span>
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-tgblue">Архив записей</h1>
        </div>
      </header>
      
      {loading ? (
        <div className="text-center py-8">
          <p className="text-neutral-500">Загрузка записей...</p>
        </div>
      ) : recordings.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-xl shadow-sm">
          <p className="text-neutral-500">Записей пока нет</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className="p-4 text-left text-neutral-600 font-medium">Дата</th>
                <th className="p-4 text-left text-neutral-600 font-medium">Отправитель</th>
                <th className="p-4 text-left text-neutral-600 font-medium">Длительность</th>
                <th className="p-4 text-left text-neutral-600 font-medium">Размер</th>
                <th className="p-4 text-left text-neutral-600 font-medium">Статус</th>
                <th className="p-4 text-right text-neutral-600 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {recordings.map((recording) => (
                <tr key={recording.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="p-4 text-neutral-800">{formatDate(recording.timestamp)}</td>
                  <td className="p-4 text-neutral-800">
                    {recording.senderUsername ? 
                      recording.senderUsername : 
                      <span className="text-neutral-400">Нет данных</span>}
                  </td>
                  <td className="p-4 text-neutral-800">{formatDuration(recording.duration)}</td>
                  <td className="p-4 text-neutral-800">{recording.fileSize ? `${Math.round(recording.fileSize / 1024)} KB` : "-"}</td>
                  <td className="p-4">
                    {recording.sent ? (
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Отправлено
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                        Не отправлено
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right flex gap-2 justify-end">
                    <Button 
                      onClick={() => playRecording(recording.id)}
                      variant="outline" 
                      size="sm"
                      className="text-neutral-700"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button 
                      onClick={() => downloadRecording(recording.id)}
                      variant="outline" 
                      size="sm"
                      className="text-neutral-700"
                    >
                      <DownloadCloud className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <h3 className="text-blue-800 font-medium mb-2">Примечание</h3>
        <p className="text-sm text-blue-700">
          Если запись не была отправлена в Telegram, вы можете скачать её здесь.
          Для получения записей через бот @KashMenBot, пользователь @ostrovityanin 
          должен отправить команду /start боту.
        </p>
      </div>
    </div>
  );
}