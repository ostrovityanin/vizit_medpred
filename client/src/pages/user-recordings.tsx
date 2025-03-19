import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Play, X } from 'lucide-react';
import { Link } from 'wouter';
import FileAudioPlayer from '@/components/FileAudioPlayer';
import { isTelegramWebApp } from '@/lib/telegram';
import { formatSeconds } from '@/lib/timer';

interface UserRecording {
  id: number;
  adminRecordingId: number | null;
  username: string;
  duration: number;
  timestamp: string;
  sent: boolean;
}

export default function UserRecordings() {
  const [recordings, setRecordings] = useState<UserRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<UserRecording | null>(null);
  const [audioPlayerVisible, setAudioPlayerVisible] = useState(false);
  const { toast } = useToast();
  
  // Получаем имя пользователя из Telegram WebApp или запрашиваем вручную
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    // Проверяем, запущено ли приложение в Telegram WebApp
    if (isTelegramWebApp() && window.Telegram?.WebApp?.initDataUnsafe?.user?.username) {
      // Получаем имя пользователя из Telegram WebApp
      setUsername(window.Telegram.WebApp.initDataUnsafe.user.username);
      fetchUserRecordings(window.Telegram.WebApp.initDataUnsafe.user.username);
    } else {
      // Если не в Telegram WebApp, запрашиваем имя пользователя вручную
      const userInput = prompt('Введите ваше имя пользователя (без @):');
      if (userInput) {
        setUsername(userInput);
        fetchUserRecordings(userInput);
      }
    }
  }, []);

  const fetchUserRecordings = async (user: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/client/recordings/${user}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recordings');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setRecordings(data.recordings);
      } else {
        toast({
          title: 'Ошибка',
          description: data.message || 'Не удалось загрузить список визитов',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching user recordings:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список ваших визитов',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Воспроизводим аудио
  const playRecording = (id: number) => {
    const recording = recordings.find(r => r.id === id);
    if (recording && recording.adminRecordingId) {
      setSelectedRecording(recording);
      setAudioPlayerVisible(true);
    } else {
      toast({
        title: 'Ошибка',
        description: 'Не удалось найти аудиозапись',
        variant: 'destructive',
      });
    }
  };
  
  // Закрыть модальное окно
  const closeAudioPlayer = () => {
    setAudioPlayerVisible(false);
    setSelectedRecording(null);
  };

  return (
    <div className="w-full mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Назад</span>
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Мои записи</h1>
        </div>
      </header>
      
      {username && <p className="text-neutral-600 mb-4">Записи для пользователя: @{username}</p>}
      
      {loading ? (
        <div className="text-center py-8">
          <p className="text-neutral-500">Загрузка ваших записей...</p>
        </div>
      ) : recordings.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-xl shadow-sm">
          <p className="text-neutral-500">У вас пока нет записей визитов</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-neutral-100">
            {recordings.map((recording) => (
              <div key={recording.id} className="p-4 hover:bg-neutral-50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Визит от {formatDate(recording.timestamp)}</p>
                    <p className="text-sm text-neutral-600">Длительность: {formatSeconds(recording.duration)}</p>
                  </div>
                  <Button 
                    onClick={() => playRecording(recording.id)}
                    variant="outline" 
                    size="sm"
                    className="text-neutral-700"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    <span>Слушать</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модальное окно для аудиоплеера */}
      {audioPlayerVisible && selectedRecording && selectedRecording.adminRecordingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Запись визита</h2>
              <Button variant="ghost" size="sm" onClick={closeAudioPlayer}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-neutral-600 mb-2">
              Дата визита: {formatDate(selectedRecording.timestamp)}
            </p>
            <FileAudioPlayer 
              audioUrl={`/api/recordings/${selectedRecording.adminRecordingId}/download`}
              filename={`Запись визита от ${formatDate(selectedRecording.timestamp)}`}
            />
            <p className="text-center text-sm text-neutral-500 mt-4">
              Длительность: {formatSeconds(selectedRecording.duration)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}