import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
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
  const { toast } = useToast();
  
  // Получаем имя пользователя из Telegram WebApp или запрашиваем вручную
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    // Проверяем, запущено ли приложение в Telegram WebApp
    if (isTelegramWebApp() && window.Telegram?.WebApp?.initDataUnsafe?.user?.username) {
      // Получаем имя пользователя из Telegram WebApp
      const telegramUsername = window.Telegram.WebApp.initDataUnsafe.user.username;
      console.log('Получено имя пользователя из Telegram WebApp:', telegramUsername);
      setUsername(telegramUsername);
      fetchUserRecordings(telegramUsername);
    } else {
      // Получаем имя пользователя из URL, если оно там есть
      const urlParams = new URLSearchParams(window.location.search);
      const usernameFromUrl = urlParams.get('username');
      
      if (usernameFromUrl) {
        console.log('Получено имя пользователя из URL:', usernameFromUrl);
        setUsername(usernameFromUrl);
        fetchUserRecordings(usernameFromUrl);
      } else {
        // Если не в Telegram WebApp и нет имени в URL, показываем форму ввода
        // Форма отображается в JSX, когда username пустой
        console.log('Имя пользователя не найдено, ожидание ввода в форму');
        setLoading(false);
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



  const handleUsernameChange = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formUsername = (document.getElementById('username-input') as HTMLInputElement)?.value;
    if (formUsername) {
      setUsername(formUsername);
      fetchUserRecordings(formUsername);
      
      // Обновляем URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('username', formUsername);
      window.history.replaceState({}, '', newUrl.toString());
    }
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
          <div>
            <h1 className="text-xl font-bold">Мои визиты</h1>
            {username && <p className="text-sm text-neutral-500">Пользователь: {username}</p>}
          </div>
        </div>
      </header>
      
      {!username && !loading && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Введите имя пользователя</h2>
          <form onSubmit={handleUsernameChange} className="flex flex-col gap-3">
            <input
              id="username-input"
              type="text"
              placeholder="Имя пользователя (без @)"
              className="p-2 border border-gray-300 rounded-md"
              required
            />
            <Button type="submit">Показать мои визиты</Button>
          </form>
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-8">
          <p className="text-neutral-500">Загрузка...</p>
        </div>
      ) : username && recordings.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-xl shadow-sm">
          <p className="text-neutral-500">Визитов нет</p>
        </div>
      ) : username && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-neutral-100">
            {recordings.map((recording) => (
              <div key={recording.id} className="p-4 hover:bg-neutral-50">
                <div>
                  <p className="font-medium">Время визита: {formatDate(recording.timestamp)}</p>
                  <p className="text-sm text-neutral-600">Длительность: {formatSeconds(recording.duration)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}