import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DownloadCloud, ArrowLeft, Play, X, FileText } from 'lucide-react';
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
  transcription?: string | null;
  transcriptionCost?: string | null;
  tokensProcessed?: number | null;
  sent: boolean;
}

export default function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [audioPlayerVisible, setAudioPlayerVisible] = useState(false);
  const [transcriptionModalVisible, setTranscriptionModalVisible] = useState(false);
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
  
  const playRecording = (id: number) => {
    const recording = recordings.find(r => r.id === id);
    if (recording) {
      setSelectedRecording(recording);
      setAudioPlayerVisible(true);
    }
  };
  
  const closeAudioPlayer = () => {
    setAudioPlayerVisible(false);
    if (!transcriptionModalVisible) {
      setSelectedRecording(null);
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
        description: 'У этой записи отсутствует распознанный текст',
        variant: 'destructive',
      });
    }
  };
  
  // Закрыть модальное окно с транскрипцией
  const closeTranscriptionModal = () => {
    setTranscriptionModalVisible(false);
    if (!audioPlayerVisible) {
      setSelectedRecording(null);
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
          <h1 className="text-xl font-bold text-tgblue">Архив записей</h1>
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
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <div className="min-w-full">
            <table className="w-full table-auto border-collapse text-sm">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="p-2 text-left text-neutral-600 font-medium">Дата</th>
                  <th className="p-2 text-left text-neutral-600 font-medium">Отправитель</th>
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
                    <td className="p-2 text-neutral-800 whitespace-nowrap">{formatDate(recording.timestamp)}</td>
                    <td className="p-2 text-neutral-800">
                      {recording.senderUsername ? 
                        recording.senderUsername : 
                        <span className="text-neutral-400">Нет данных</span>}
                    </td>
                    <td className="p-2 text-neutral-800 whitespace-nowrap">{formatDuration(recording.duration)}</td>
                    <td className="p-2 text-neutral-800 whitespace-nowrap">{recording.fileSize ? `${Math.round(recording.fileSize / 1024)} KB` : "-"}</td>
                    <td className="p-2">
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
                          title="Скачать запись"
                        >
                          <DownloadCloud className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      
      {/* Модальное окно для аудиоплеера */}
      {audioPlayerVisible && selectedRecording && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4 p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Прослушивание записи</h3>
              <Button variant="ghost" size="sm" onClick={closeAudioPlayer}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <FileAudioPlayer 
              audioUrl={`/api/recordings/${selectedRecording.id}/download`} 
              filename={selectedRecording.filename}
            />
            
            <div className="mt-4 text-sm text-neutral-500">
              <div>Записано: {formatDate(selectedRecording.timestamp)}</div>
              {selectedRecording.senderUsername && (
                <div>Отправитель: {selectedRecording.senderUsername}</div>
              )}
              {selectedRecording.transcriptionCost && (
                <div className="text-green-600">
                  Стоимость распознавания: ${selectedRecording.transcriptionCost}
                  {selectedRecording.tokensProcessed && ` (${selectedRecording.tokensProcessed} токенов)`}
                </div>
              )}
              {selectedRecording.transcription && (
                <div className="flex justify-between items-center mt-2">
                  <div className="text-sm line-clamp-2 italic overflow-hidden text-neutral-600">
                    "{selectedRecording.transcription.substring(0, 150)}
                    {selectedRecording.transcription.length > 150 ? '...' : ''}"
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="ml-2 flex-shrink-0"
                    onClick={() => {
                      closeAudioPlayer();
                      openTranscriptionModal(selectedRecording.id);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    <span>Открыть текст</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно для полного текста транскрипции */}
      {transcriptionModalVisible && selectedRecording && selectedRecording.transcription && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 p-5 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Распознанный текст</h3>
              <Button variant="ghost" size="sm" onClick={closeTranscriptionModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2">
              <div className="text-neutral-800 whitespace-pre-wrap text-sm leading-relaxed bg-neutral-50 p-4 rounded-lg">
                {selectedRecording.transcription?.split('\n').map((line, index) => {
                  // Проверяем, содержит ли строка информацию о говорящем
                  const speakerMatch = line.match(/^([А-Яа-я]+(?:\s[0-9])?|[A-Za-z]+(?:\s[0-9])?):(.+)$/);
                  
                  if (speakerMatch) {
                    const [, speaker, speech] = speakerMatch;
                    return (
                      <div key={index} className="mb-2">
                        <span className="font-semibold text-tgblue">{speaker}:</span>
                        <span>{speech}</span>
                      </div>
                    );
                  } else {
                    return <div key={index} className="mb-2">{line}</div>;
                  }
                })}
              </div>
            </div>
            
            <div className="mt-4 flex justify-between items-center">
              <div className="text-xs text-neutral-500 space-y-1">
                <div>Записано: {formatDate(selectedRecording.timestamp)}</div>
                {selectedRecording.transcriptionCost && (
                  <div className="text-green-600">
                    Стоимость распознавания: ${selectedRecording.transcriptionCost}
                    {selectedRecording.tokensProcessed && ` (${selectedRecording.tokensProcessed} токенов)`}
                  </div>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  closeTranscriptionModal();
                  playRecording(selectedRecording.id);
                }}
              >
                <Play className="h-4 w-4 mr-1" />
                <span>Слушать запись</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}