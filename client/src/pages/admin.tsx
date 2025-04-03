import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DownloadCloud, ArrowLeft, Play, X, FileText, Send, Bell, MessageSquare, AlertCircle, CheckCircle, RefreshCw, Layers, Volume2, ExternalLink, Workflow, Languages } from 'lucide-react';
import { Link } from 'wouter';
import FileAudioPlayer from '@/components/FileAudioPlayer';
import RecordingFragments from '@/components/RecordingFragments';
import { sendAudioViaClientBot, notifyUserAboutRecording, sendMessageViaClientBot } from '@/lib/telegram';
import { apiRequest } from '@/lib/queryClient';

interface AdminRecording {
  id: number;
  filename: string;
  duration: number;
  timestamp: string;
  targetUsername: string;
  senderUsername?: string | null;
  fileSize?: number | null;
  transcription?: string | null;
  transcriptionCost?: string | null;
  tokensProcessed?: number | null;
  sent: boolean;
  status?: 'started' | 'completed' | 'error' | null;
}

// Интерфейс для результатов сравнительной транскрипции
interface ComparisonResult {
  'whisper-1'?: {
    text: string;
    processingTime: number;
    error?: string;
  };
  'gpt-4o-mini-transcribe'?: {
    text: string;
    processingTime: number;
    error?: string;
  };
  'gpt-4o-transcribe'?: {
    text: string;
    processingTime: number;
    error?: string;
  };
  fileSize?: number;
  fileName?: string;
}

export default function AdminPanel() {
  const [recordings, setRecordings] = useState<AdminRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<AdminRecording | null>(null);
  const [audioPlayerVisible, setAudioPlayerVisible] = useState(false);
  const [transcriptionModalVisible, setTranscriptionModalVisible] = useState(false);
  const [fragmentsModalVisible, setFragmentsModalVisible] = useState(false);
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/recordings');
      
      if (!response.ok) {
        throw new Error('Failed to fetch recordings');
      }
      
      const data = await response.json();
      setRecordings(data);
    } catch (error) {
      console.error('Error fetching recordings:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список визитов',
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
  
  const playRecording = (id: number) => {
    const recording = recordings.find(r => r.id === id);
    if (recording) {
      setSelectedRecording(recording);
      setAudioPlayerVisible(true);
    }
  };
  
  const closeAudioPlayer = () => {
    setAudioPlayerVisible(false);
    if (!transcriptionModalVisible && !fragmentsModalVisible) {
      setSelectedRecording(null);
    }
  };
  
  // Отправить аудиозапись через клиентский бот
  const sendViaClientBot = async (id: number) => {
    try {
      const recording = recordings.find(r => r.id === id);
      if (!recording) {
        throw new Error('Запись не найдена');
      }
      
      // Запрашиваем у пользователя имя получателя
      const username = prompt('Введите имя пользователя получателя (без @):', recording.targetUsername);
      if (!username) return;
      
      const success = await sendAudioViaClientBot(id, username);
      
      if (success) {
        toast({
          title: 'Успешно',
          description: `Аудио визита отправлено пользователю @${username} через клиентский бот`,
          variant: 'default',
        });
        
        // Обновляем список записей
        fetchRecordings();
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось отправить аудио визита через клиентский бот',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending via client bot:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить аудио визита через клиентский бот',
        variant: 'destructive',
      });
    }
  };
  
  // Отправить уведомление о записи через клиентский бот
  const sendNotificationViaClientBot = async (id: number) => {
    try {
      const recording = recordings.find(r => r.id === id);
      if (!recording) {
        throw new Error('Запись не найдена');
      }
      
      // Запрашиваем у пользователя имя получателя
      const username = prompt('Введите имя пользователя получателя (без @):', recording.targetUsername);
      if (!username) return;
      
      const success = await notifyUserAboutRecording(id, username);
      
      if (success) {
        toast({
          title: 'Успешно',
          description: `Уведомление о визите отправлено пользователю @${username}`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось отправить уведомление через клиентский бот',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending notification via client bot:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить уведомление через клиентский бот',
        variant: 'destructive',
      });
    }
  };
  
  // Обновление статуса записи
  const updateRecordingStatus = async (id: number, status: 'started' | 'completed' | 'error') => {
    try {
      // Получаем ID сессии из localStorage, если он есть
      const sessionId = localStorage.getItem('recordingSessionId');
      
      const response = await fetch(`/api/recordings/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status,
          sessionId // Добавляем ID сессии для автоматического объединения фрагментов
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Сервер вернул ошибку: ${errorText}`);
      }
      
      const updatedRecording = await response.json();
      
      // Обновляем запись в локальном состоянии
      setRecordings(prevRecordings => 
        prevRecordings.map(recording => 
          recording.id === id ? { ...recording, status } : recording
        )
      );
      
      // Показываем уведомление об успешном обновлении
      const statusMessages = {
        started: 'В процессе',
        completed: 'Завершена',
        error: 'Ошибка'
      };
      
      toast({
        title: 'Статус записи обновлен',
        description: `Запись #${id} теперь имеет статус: ${statusMessages[status]}`,
        variant: 'default',
      });
      
    } catch (error) {
      console.error('Ошибка обновления статуса записи:', error);
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось обновить статус записи',
        variant: 'destructive',
      });
    }
  };

  // Отправить сообщение с выдержкой из транскрипции
  const sendTranscriptViaClientBot = async (id: number) => {
    try {
      const recording = recordings.find(r => r.id === id);
      if (!recording) {
        throw new Error('Запись не найдена');
      }
      
      if (!recording.transcription) {
        toast({
          title: 'Ошибка',
          description: 'У этого визита отсутствует распознанный текст',
          variant: 'destructive',
        });
        return;
      }
      
      // Запрашиваем у пользователя имя получателя
      const username = prompt('Введите имя пользователя получателя (без @):', recording.targetUsername);
      if (!username) return;
      
      // Формируем сообщение с выдержкой из транскрипции
      const messageText = `📝 <b>Текст визита от ${formatDate(recording.timestamp)}</b>\n\n${recording.transcription.substring(0, 1000)}${recording.transcription.length > 1000 ? '...' : ''}`;
      
      const success = await sendMessageViaClientBot(username, messageText);
      
      if (success) {
        toast({
          title: 'Успешно',
          description: `Текст визита отправлен пользователю @${username}`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось отправить текст через клиентский бот',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending transcript via client bot:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить текст через клиентский бот',
        variant: 'destructive',
      });
    }
  };
  
  // Открыть модальное окно с транскрипцией
  const openTranscriptionModal = (id: number) => {
    const recording = recordings.find(r => r.id === id);
    if (recording && recording.transcription) {
      setSelectedRecording(recording);
      setTranscriptionModalVisible(true);
    } else {
      toast({
        title: 'Текст не найден',
        description: 'У этого визита отсутствует распознанный текст',
        variant: 'destructive',
      });
    }
  };
  
  // Закрыть модальное окно с транскрипцией
  const closeTranscriptionModal = () => {
    setTranscriptionModalVisible(false);
    if (!audioPlayerVisible && !fragmentsModalVisible) {
      setSelectedRecording(null);
    }
  };
  
  // Открыть модальное окно с фрагментами
  const openFragmentsModal = (id: number) => {
    const recording = recordings.find(r => r.id === id);
    if (recording) {
      setSelectedRecording(recording);
      setFragmentsModalVisible(true);
    }
  };
  
  // Закрыть модальное окно с фрагментами
  const closeFragmentsModal = () => {
    setFragmentsModalVisible(false);
    if (!audioPlayerVisible && !transcriptionModalVisible && !comparisonModalVisible) {
      setSelectedRecording(null);
    }
  };
  
  // Открыть модальное окно сравнительной транскрипции
  const runComparisonTranscription = async (id: number) => {
    try {
      const recording = recordings.find(r => r.id === id);
      if (!recording) {
        throw new Error('Запись не найдена');
      }
      
      // Проверяем, есть ли файл
      if (!recording.filename) {
        toast({
          title: 'Ошибка',
          description: 'У этого визита отсутствует аудиофайл',
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedRecording(recording);
      setComparisonLoading(true);
      setComparisonResult(null);
      setComparisonModalVisible(true);
      
      toast({
        title: 'Сравнительный анализ',
        description: 'Запущена сравнительная транскрипция. Это может занять некоторое время...',
        variant: 'default',
      });
      
      // Отправляем запрос на сравнительную транскрипцию
      const response = await fetch(`/api/admin/recordings/${id}/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'ru', // По умолчанию используем русский язык
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Сервер вернул ошибку: ${errorText}`);
      }
      
      const result = await response.json();
      setComparisonResult(result);
      
      toast({
        title: 'Сравнение завершено',
        description: 'Результаты сравнительной транскрипции получены',
        variant: 'default',
      });
    } catch (error) {
      console.error('Ошибка при сравнительной транскрипции:', error);
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось выполнить сравнительную транскрипцию',
        variant: 'destructive',
      });
    } finally {
      setComparisonLoading(false);
    }
  };
  
  // Закрыть модальное окно сравнительной транскрипции
  const closeComparisonModal = () => {
    setComparisonModalVisible(false);
    setComparisonResult(null);
    if (!audioPlayerVisible && !transcriptionModalVisible && !fragmentsModalVisible) {
      setSelectedRecording(null);
    }
  };
  
  // Форматирование времени выполнения
  const formatTimePerformance = (seconds: number) => {
    return `${seconds.toFixed(2)} сек`;
  };
  
  // Принудительно завершить запись и объединить фрагменты
  const manuallyCompleteRecording = async (id: number) => {
    try {
      if (!confirm('Вы уверены, что хотите принудительно завершить запись и обработать её фрагменты? Это вручную запустит процесс объединения и распознавания аудио.')) {
        return;
      }
      
      toast({
        title: 'Обработка...',
        description: 'Запущена обработка фрагментов записи. Это может занять некоторое время.',
        variant: 'default',
      });
      
      // Обновляем статус на "completed"
      await fetch(`/api/recordings/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'completed',
          forceProcess: true // Специальный флаг для принудительной обработки
        })
      });
      
      // Обновляем список записей
      fetchRecordings();
      
      toast({
        title: 'Запрос на обработку успешно отправлен',
        description: 'Обработка записи запущена. Обновите список через некоторое время, чтобы увидеть результаты.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error completing recording:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось запустить обработку записи',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="w-full mx-auto px-2 py-4">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Назад</span>
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-tgblue">Админ-панель</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Link href="/zepp-os-docs">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" />
              <span>Документация Zepp OS</span>
            </Button>
          </Link>
          <Link href="/replit-guide">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" />
              <span>Доступ к проектам</span>
            </Button>
          </Link>
        </div>
      </header>
      
      {loading ? (
        <div className="text-center py-8">
          <p className="text-neutral-500">Загрузка данных визитов...</p>
        </div>
      ) : recordings.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-xl shadow-sm">
          <p className="text-neutral-500">Данных визитов пока нет</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <div className="min-w-full">
            <table className="w-full table-auto border-collapse text-sm">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="p-2 text-left text-neutral-600 font-medium">ID</th>
                  <th className="p-2 text-left text-neutral-600 font-medium">Дата</th>
                  <th className="p-2 text-left text-neutral-600 font-medium">Отправитель</th>
                  <th className="p-2 text-left text-neutral-600 font-medium">Получатель</th>
                  <th className="p-2 text-left text-neutral-600 font-medium">Длительность</th>
                  <th className="p-2 text-left text-neutral-600 font-medium">Размер</th>
                  <th className="p-2 text-left text-neutral-600 font-medium">Статус</th>
                  <th className="p-2 text-left text-neutral-600 font-medium">Стоимость</th>
                  <th className="p-2 text-left text-neutral-600 font-medium">Распознанный текст</th>
                  <th className="p-2 text-right text-neutral-600 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((recording) => (
                  <tr key={recording.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="p-2 text-neutral-800">{recording.id}</td>
                    <td className="p-2 text-neutral-800 whitespace-nowrap">{formatDate(recording.timestamp)}</td>
                    <td className="p-2 text-neutral-800">
                      {recording.senderUsername ? 
                        recording.senderUsername : 
                        <span className="text-neutral-400">Нет данных</span>}
                    </td>
                    <td className="p-2 text-neutral-800">{recording.targetUsername}</td>
                    <td className="p-2 text-neutral-800 whitespace-nowrap">{formatDuration(recording.duration)}</td>
                    <td className="p-2 text-neutral-800 whitespace-nowrap">{recording.fileSize ? `${Math.round(recording.fileSize / 1024)} KB` : "-"}</td>
                    <td className="p-2">
                      <div className="flex flex-col gap-1">
                        {/* Статус отправки */}
                        {recording.sent ? (
                          <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Отправлено
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                            Не отправлено
                          </span>
                        )}
                        
                        {/* Статус записи */}
                        {recording.status && (
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                            recording.status === 'started' 
                              ? 'bg-blue-100 text-blue-800' 
                              : recording.status === 'completed' 
                                ? 'bg-green-100 text-green-800' 
                                : recording.status === 'error' 
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}>
                            {recording.status === 'started' && 'В процессе'}
                            {recording.status === 'completed' && 'Завершено'}
                            {recording.status === 'error' && 'Ошибка'}
                            {!['started', 'completed', 'error'].includes(recording.status) && recording.status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 text-neutral-600">
                      {recording.transcriptionCost ? (
                        <div className="text-sm whitespace-nowrap text-green-600">
                          ${recording.transcriptionCost}
                        </div>
                      ) : (
                        <div className="text-neutral-400 text-sm">-</div>
                      )}
                    </td>
                    <td className="p-2 text-neutral-600">
                      {recording.transcription ? (
                        <div className="text-sm italic max-w-xs truncate">
                          "{recording.transcription}"
                        </div>
                      ) : (
                        <div className="text-neutral-400 text-sm">Нет текста</div>
                      )}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <div className="flex gap-1 justify-end">
                        {/* Базовые действия */}
                        <Button 
                          onClick={() => playRecording(recording.id)}
                          variant="outline" 
                          size="sm"
                          className="text-neutral-700"
                          title="Воспроизвести"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        {recording.transcription && (
                          <Button 
                            onClick={() => openTranscriptionModal(recording.id)}
                            variant="outline" 
                            size="sm"
                            className="text-neutral-700"
                            title="Показать текст"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          onClick={() => downloadRecording(recording.id)}
                          variant="outline" 
                          size="sm"
                          className="text-neutral-700"
                          title="Скачать данные визита"
                        >
                          <DownloadCloud className="h-4 w-4" />
                        </Button>
                        
                        {/* Кнопки управления статусом */}
                        <Button 
                          onClick={() => updateRecordingStatus(recording.id, 'started')}
                          variant="outline" 
                          size="sm"
                          className="text-blue-700 border-blue-200 hover:bg-blue-50"
                          title="Отметить как 'В процессе'"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button 
                          onClick={() => updateRecordingStatus(recording.id, 'completed')}
                          variant="outline" 
                          size="sm"
                          className="text-green-700 border-green-200 hover:bg-green-50"
                          title="Отметить как 'Завершено'"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button 
                          onClick={() => updateRecordingStatus(recording.id, 'error')}
                          variant="outline" 
                          size="sm"
                          className="text-red-700 border-red-200 hover:bg-red-50"
                          title="Отметить как 'Ошибка'"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </Button>
                        
                        {/* Кнопки для клиентского бота */}
                        <Button 
                          onClick={() => sendViaClientBot(recording.id)}
                          variant="outline" 
                          size="sm"
                          className="text-blue-700 border-blue-200 hover:bg-blue-50"
                          title="Отправить через клиентский бот"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button 
                          onClick={() => sendNotificationViaClientBot(recording.id)}
                          variant="outline" 
                          size="sm"
                          className="text-amber-700 border-amber-200 hover:bg-amber-50"
                          title="Отправить уведомление через клиентский бот"
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                        {recording.transcription && (
                          <Button 
                            onClick={() => sendTranscriptViaClientBot(recording.id)}
                            variant="outline" 
                            size="sm"
                            className="text-green-700 border-green-200 hover:bg-green-50"
                            title="Отправить текст через клиентский бот"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                        {/* Кнопка просмотра фрагментов */}
                        <Button 
                          onClick={() => openFragmentsModal(recording.id)}
                          variant="outline" 
                          size="sm"
                          className="text-violet-700 border-violet-200 hover:bg-violet-50"
                          title="Просмотреть фрагменты записи"
                        >
                          <Layers className="h-4 w-4" />
                        </Button>
                        
                        {/* Кнопка сравнительной транскрипции */}
                        <Button 
                          onClick={() => runComparisonTranscription(recording.id)}
                          variant="outline" 
                          size="sm"
                          className="text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                          title="Сравнительная транскрипция с разными моделями"
                        >
                          <Languages className="h-4 w-4" />
                        </Button>
                        
                        {/* Кнопка принудительного завершения записи */}
                        {recording.status === 'started' && (
                          <Button 
                            onClick={() => manuallyCompleteRecording(recording.id)}
                            variant="outline" 
                            size="sm"
                            className="text-teal-700 border-teal-200 hover:bg-teal-50"
                            title="Принудительно завершить и обработать запись"
                          >
                            <Volume2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Модальное окно для аудиоплеера */}
      {audioPlayerVisible && selectedRecording && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Аудиозапись визита</h2>
              <Button variant="ghost" size="sm" onClick={closeAudioPlayer}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <FileAudioPlayer 
              audioUrl={`/api/recordings/${selectedRecording.id}/download`}
              filename={selectedRecording.filename}
            />
          </div>
        </div>
      )}
      
      {/* Модальное окно для текста транскрипции */}
      {transcriptionModalVisible && selectedRecording && selectedRecording.transcription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4 max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Распознанный текст визита</h2>
              <Button variant="ghost" size="sm" onClick={closeTranscriptionModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="prose max-w-none">
              <p className="text-sm text-neutral-500 mb-2">
                Дата визита: {formatDate(selectedRecording.timestamp)}
              </p>
              <p className="text-sm text-neutral-500 mb-4">
                Стоимость распознавания: {selectedRecording.transcriptionCost ? `$${selectedRecording.transcriptionCost}` : 'Нет данных'}
                {selectedRecording.tokensProcessed && ` (${selectedRecording.tokensProcessed} токенов)`}
              </p>
              <div className="p-4 bg-neutral-50 rounded border border-neutral-200 whitespace-pre-wrap text-neutral-700">
                {selectedRecording.transcription}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно для просмотра фрагментов */}
      {fragmentsModalVisible && selectedRecording && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-4 max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Фрагменты записи #{selectedRecording.id}</h2>
              <Button variant="ghost" size="sm" onClick={closeFragmentsModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <RecordingFragments recordingId={selectedRecording.id} />
          </div>
        </div>
      )}
      
      {/* Модальное окно для сравнительной транскрипции */}
      {comparisonModalVisible && selectedRecording && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl p-4 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Сравнительная транскрипция визита #{selectedRecording.id}</h2>
              <Button variant="ghost" size="sm" onClick={closeComparisonModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {comparisonLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                <p className="text-neutral-600">Выполняется сравнительный анализ транскрипции...</p>
                <p className="text-neutral-500 text-sm mt-2">Это может занять около 5-10 секунд</p>
              </div>
            ) : (
              <div>
                {comparisonResult ? (
                  <div className="space-y-6">
                    <p className="text-sm text-neutral-500">
                      Файл: {comparisonResult.fileName || 'Не указан'} 
                      {comparisonResult.fileSize && ` (${Math.round(comparisonResult.fileSize / 1024)} KB)`}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Whisper-1 */}
                      <div className="border rounded-lg p-4 bg-neutral-50">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium text-neutral-800">whisper-1</h3>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            {comparisonResult['whisper-1']?.processingTime ? 
                              formatTimePerformance(comparisonResult['whisper-1'].processingTime) : 
                              '-'}
                          </span>
                        </div>
                        {comparisonResult['whisper-1']?.error ? (
                          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                            Ошибка: {comparisonResult['whisper-1'].error}
                          </div>
                        ) : (
                          <div className="p-3 bg-white border border-neutral-200 rounded h-64 overflow-y-auto text-sm whitespace-pre-wrap">
                            {comparisonResult['whisper-1']?.text || 'Нет данных'}
                          </div>
                        )}
                        <div className="mt-2 text-neutral-500 text-xs">
                          Базовая модель, оптимальная по стоимости
                        </div>
                      </div>
                      
                      {/* gpt-4o-mini-transcribe */}
                      <div className="border rounded-lg p-4 bg-neutral-50">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium text-neutral-800">gpt-4o-mini-transcribe</h3>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {comparisonResult['gpt-4o-mini-transcribe']?.processingTime ? 
                              formatTimePerformance(comparisonResult['gpt-4o-mini-transcribe'].processingTime) : 
                              '-'}
                          </span>
                        </div>
                        {comparisonResult['gpt-4o-mini-transcribe']?.error ? (
                          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                            Ошибка: {comparisonResult['gpt-4o-mini-transcribe'].error}
                          </div>
                        ) : (
                          <div className="p-3 bg-white border border-neutral-200 rounded h-64 overflow-y-auto text-sm whitespace-pre-wrap">
                            {comparisonResult['gpt-4o-mini-transcribe']?.text || 'Нет данных'}
                          </div>
                        )}
                        <div className="mt-2 text-neutral-500 text-xs">
                          Быстрая модель, оптимальная для русского языка
                        </div>
                      </div>
                      
                      {/* gpt-4o-transcribe */}
                      <div className="border rounded-lg p-4 bg-neutral-50">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium text-neutral-800">gpt-4o-transcribe</h3>
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                            {comparisonResult['gpt-4o-transcribe']?.processingTime ? 
                              formatTimePerformance(comparisonResult['gpt-4o-transcribe'].processingTime) : 
                              '-'}
                          </span>
                        </div>
                        {comparisonResult['gpt-4o-transcribe']?.error ? (
                          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                            Ошибка: {comparisonResult['gpt-4o-transcribe'].error}
                          </div>
                        ) : (
                          <div className="p-3 bg-white border border-neutral-200 rounded h-64 overflow-y-auto text-sm whitespace-pre-wrap">
                            {comparisonResult['gpt-4o-transcribe']?.text || 'Нет данных'}
                          </div>
                        )}
                        <div className="mt-2 text-neutral-500 text-xs">
                          Самая точная модель для сложных случаев
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded p-4 text-blue-800 text-sm mt-4">
                      <h4 className="font-medium mb-1">Рекомендации по выбору модели:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        <li>
                          <strong>whisper-1</strong>: хорошо работает с английским языком, наименьшая стоимость
                        </li>
                        <li>
                          <strong>gpt-4o-mini-transcribe</strong>: оптимальный выбор для русского языка по соотношению скорость/качество
                        </li>
                        <li>
                          <strong>gpt-4o-transcribe</strong>: лучшее качество для сложных случаев, шумных записей, акцентов
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-neutral-500">Нет результатов сравнительной транскрипции</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}