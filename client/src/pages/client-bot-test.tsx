import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getUserRecordings } from '@/lib/telegram';
import { Link } from 'wouter';
import { ArrowLeft, Search } from 'lucide-react';

interface Recording {
  id: number;
  filename: string;
  duration: number;
  timestamp: string;
  targetUsername: string;
  senderUsername?: string | null;
  sent: boolean;
}

export default function ClientBotTest() {
  const [username, setUsername] = useState('');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Форматируем дату/время
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru');
    } catch (e) {
      return dateString;
    }
  };

  // Форматируем продолжительность в секундах
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const fetchUserRecordings = async () => {
    if (!username.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите имя пользователя",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const userRecordings = await getUserRecordings(username);
      console.log('Получены записи для пользователя:', userRecordings);
      setRecordings(userRecordings);
      
      toast({
        title: "Успешно",
        description: `Найдено ${userRecordings.length} записей для пользователя @${username}`,
      });
    } catch (error) {
      console.error('Ошибка при получении записей:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось получить записи пользователя",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Тест клиент-бота</h1>
      </header>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Получение записей пользователя</h2>
        
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Имя пользователя (без @)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="flex-1"
          />
          <Button onClick={fetchUserRecordings} disabled={loading}>
            {loading ? 'Загрузка...' : 'Получить записи'}
            {!loading && <Search className="ml-2 h-4 w-4" />}
          </Button>
        </div>

        <div className="mt-4">
          <h3 className="font-medium mb-2">Параметры запроса:</h3>
          <pre className="bg-gray-100 p-3 rounded text-sm">
            GET /api/client/recordings/{username || 'username'}
          </pre>
        </div>
      </div>

      {recordings.length > 0 ? (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-medium mb-4">Найдено {recordings.length} записей</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-3 border">ID</th>
                  <th className="text-left p-3 border">Дата</th>
                  <th className="text-left p-3 border">Длительность</th>
                  <th className="text-left p-3 border">Отправитель</th>
                  <th className="text-left p-3 border">Получатель</th>
                  <th className="text-left p-3 border">Статус</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((recording) => (
                  <tr key={recording.id} className="hover:bg-gray-50">
                    <td className="p-3 border">{recording.id}</td>
                    <td className="p-3 border">{formatDate(recording.timestamp)}</td>
                    <td className="p-3 border">{formatDuration(recording.duration)}</td>
                    <td className="p-3 border">{recording.senderUsername || 'Не указан'}</td>
                    <td className="p-3 border">{recording.targetUsername}</td>
                    <td className="p-3 border">
                      {recording.sent ? 
                        <span className="text-green-600">Отправлено</span> : 
                        <span className="text-yellow-600">Не отправлено</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6">
            <h3 className="font-medium mb-2">Данные ответа:</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-60">
              {JSON.stringify({success: true, recordings}, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 rounded-xl p-8 text-center">
          <p className="text-gray-500">
            {loading ? 'Загрузка записей...' : 'Нет данных для отображения. Введите имя пользователя и нажмите "Получить записи".'}
          </p>
        </div>
      )}
    </div>
  );
}