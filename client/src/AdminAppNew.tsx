import React, { useState, useEffect } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Clock,
  Calendar,
  User,
  FileAudio,
  MessageSquare,
  BarChart,
  RefreshCw,
  ListFilter,
  FileText,
  Trash2,
  Home as HomeIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { formatDistance } from 'date-fns';

// Типы данных
interface Recording {
  id: number;
  filename: string;
  duration: number;
  timestamp: string;
  targetUsername: string;
  senderUsername: string;
  fileSize: number;
  transcription: string | null;
  status: 'started' | 'completed' | 'error';
  fragmentsCount: number;
  canMergeFragments: boolean;
  fileExists: boolean;
}

interface RecordingFragment {
  id: number;
  recordingId: number;
  sessionId: string;
  fragmentIndex: number;
  filename: string;
  duration: number;
  timestamp: string;
}

interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  currentRecordingId: number | null;
  currentFragmentId: number | null;
}

interface DiarizationSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
  whisperText?: string;
  gpt4oMiniText?: string;
  gpt4oText?: string;
}

interface ComparativeTranscription {
  segments: DiarizationSegment[];
  whisper?: string;
  gpt4oMini?: string;
  gpt4o?: string;
  originalAudio?: string;
  processingTime?: number;
}

// Компонент аудиоплеера
const AudioPlayer: React.FC<{
  recordingId: number;
  fragmentId?: number;
  onEnded?: () => void;
}> = ({ recordingId, fragmentId, onEnded }) => {
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.5,
    muted: false,
    currentRecordingId: null,
    currentFragmentId: null
  });
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Создаем аудиоэлемент при монтировании компонента
  useEffect(() => {
    const audio = new Audio();
    audio.volume = playerState.volume;
    audio.muted = playerState.muted;
    
    // Добавляем обработчики событий
    audio.addEventListener('timeupdate', () => {
      setPlayerState(prev => ({
        ...prev,
        currentTime: audio.currentTime
      }));
    });
    
    audio.addEventListener('loadedmetadata', () => {
      setPlayerState(prev => ({
        ...prev,
        duration: audio.duration
      }));
    });
    
    audio.addEventListener('ended', () => {
      setPlayerState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: 0
      }));
      
      if (onEnded) {
        onEnded();
      }
    });
    
    setAudioElement(audio);
    
    return () => {
      // Очистка при размонтировании
      audio.pause();
      audio.src = '';
      audio.removeEventListener('timeupdate', () => {});
      audio.removeEventListener('loadedmetadata', () => {});
      audio.removeEventListener('ended', () => {});
    };
  }, [onEnded]);
  
  // Обновляем источник аудио при изменении recordingId или fragmentId
  useEffect(() => {
    if (audioElement) {
      // Формируем URL в зависимости от того, играем мы запись целиком или фрагмент
      let audioUrl;
      
      if (fragmentId) {
        audioUrl = `/api/admin/recordings/${recordingId}/fragments/${fragmentId}/audio`;
        setPlayerState(prev => ({
          ...prev,
          currentRecordingId: recordingId,
          currentFragmentId: fragmentId
        }));
      } else {
        audioUrl = `/api/admin/recordings/${recordingId}/audio`;
        setPlayerState(prev => ({
          ...prev,
          currentRecordingId: recordingId,
          currentFragmentId: null
        }));
      }
      
      // Если источник изменился, обновляем его
      if (audioElement.src !== audioUrl) {
        audioElement.src = audioUrl;
        audioElement.load();
        setPlayerState(prev => ({
          ...prev,
          isPlaying: false,
          currentTime: 0,
          duration: 0
        }));
      }
    }
  }, [recordingId, fragmentId, audioElement]);
  
  // Обновляем состояние проигрывания
  useEffect(() => {
    if (audioElement) {
      if (playerState.isPlaying) {
        audioElement.play().catch(error => {
          console.error('Ошибка при воспроизведении аудио:', error);
          setPlayerState(prev => ({
            ...prev,
            isPlaying: false
          }));
        });
      } else {
        audioElement.pause();
      }
    }
  }, [playerState.isPlaying, audioElement]);
  
  // Обновляем громкость и беззвучный режим
  useEffect(() => {
    if (audioElement) {
      audioElement.volume = playerState.volume;
      audioElement.muted = playerState.muted;
    }
  }, [playerState.volume, playerState.muted, audioElement]);
  
  // Обработчики управления плеером
  const togglePlay = () => {
    setPlayerState(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying
    }));
  };
  
  const toggleMute = () => {
    setPlayerState(prev => ({
      ...prev,
      muted: !prev.muted
    }));
  };
  
  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setPlayerState(prev => ({
      ...prev,
      volume: newVolume,
      muted: newVolume === 0
    }));
  };
  
  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    if (audioElement) {
      audioElement.currentTime = newTime;
      setPlayerState(prev => ({
        ...prev,
        currentTime: newTime
      }));
    }
  };
  
  // Форматирование времени
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  return (
    <div className="flex flex-col gap-2 w-full bg-muted/20 p-3 rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={togglePlay}
            aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
          >
            {playerState.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {formatTime(playerState.currentTime)}
            </span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">
              {formatTime(playerState.duration)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-label={playerState.muted ? 'Unmute' : 'Mute'}
          >
            {playerState.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={playerState.volume}
            onChange={handleVolumeChange}
            className="w-20"
            aria-label="Volume"
          />
        </div>
      </div>
      
      <div className="w-full">
        <input
          type="range"
          min="0"
          max={playerState.duration || 100}
          step="0.01"
          value={playerState.currentTime}
          onChange={handleSeek}
          className="w-full"
          aria-label="Seek"
        />
      </div>
      
      <div className="text-xs text-muted-foreground">
        {fragmentId ? `Воспроизведение фрагмента #${fragmentId}` : `Запись #${recordingId}`}
      </div>
    </div>
  );
};

// Компонент списка записей
const RecordingsList: React.FC = () => {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { toast } = useToast();
  
  const {
    data,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['/api/admin/recordings', page, pageSize],
    queryFn: async () => {
      const response = await fetch(`/api/admin/recordings?limit=${pageSize}&offset=${(page - 1) * pageSize}`);
      if (!response.ok) {
        throw new Error('Ошибка при загрузке записей');
      }
      return response.json();
    }
  });
  
  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту запись?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/recordings/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Ошибка при удалении записи');
      }
      
      toast({
        title: 'Успешно',
        description: 'Запись успешно удалена',
        variant: 'default'
      });
      
      refetch();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось удалить запись',
        variant: 'destructive'
      });
    }
  };
  
  if (isLoading) {
    return <div className="flex justify-center p-6">Загрузка записей...</div>;
  }
  
  if (isError) {
    return <div className="flex justify-center p-6 text-destructive">Ошибка при загрузке записей</div>;
  }
  
  // Проверяем формат ответа - если это массив, используем его напрямую
  // иначе ищем свойство recordings
  let recordings: Recording[] = Array.isArray(data) ? data : data?.recordings || [];
  
  // Сортируем записи по timestamp в обратном порядке (новые сверху)
  recordings = [...recordings].sort((a, b) => {
    const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return dateB - dateA; // Обратный порядок - новые сверху
  });
  
  const totalRecordings = Array.isArray(data) ? recordings.length : data?.total || recordings.length;
  const totalPages = Math.ceil(totalRecordings / pageSize);
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Список записей ({totalRecordings})</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-64">Информация</TableHead>
              <TableHead className="w-24">Статус</TableHead>
              <TableHead className="w-28">Аудио</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recordings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Записи не найдены
                </TableCell>
              </TableRow>
            ) : (
              recordings.map(recording => (
                <TableRow key={recording.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">#{recording.id}</span>
                        <span className="text-sm">
                          {recording.timestamp 
                            ? format(new Date(recording.timestamp), 'dd.MM.yyyy HH:mm')
                            : 'Нет даты'}
                        </span>
                      </div>
                      <div className="flex flex-col text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">От: {recording.senderUsername || 'Неизвестно'}</span>
                          <span className="text-muted-foreground">Кому: {recording.targetUsername || 'Неизвестно'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>
                            <Clock className="h-3 w-3 inline mr-1" />
                            {recording.duration 
                              ? `${Math.floor(recording.duration / 60)}:${String(Math.floor(recording.duration % 60)).padStart(2, '0')}`
                              : '0:00'}
                          </span>
                          <span>
                            <FileAudio className="h-3 w-3 inline mr-1" />
                            {recording.fileSize 
                              ? `${(recording.fileSize / 1024).toFixed(1)} KB`
                              : '0 KB'}
                          </span>
                          <span>
                            <span className="mr-1">Фраг.:</span>
                            {recording.fragmentsCount || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      recording.status === 'completed' ? 'default' : 
                      recording.status === 'started' ? 'secondary' : 
                      'destructive'
                    }>
                      {recording.status === 'completed' ? 'Завершена' : 
                       recording.status === 'started' ? 'Начата' : 
                       'Ошибка'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {recording.fileExists ? (
                      <div className="flex items-center">
                        {/* Кнопка для воспроизведения аудио */}
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                          onClick={() => {
                            const url = `/api/admin/recordings/${recording.id}/audio`;
                            const audio = new Audio(url);
                            audio.play().catch(err => {
                              console.error("Ошибка воспроизведения:", err);
                            });
                          }}
                        >
                          <Play className="h-4 w-4 mr-1" /> Слушать
                        </Button>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Нет аудио</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        asChild
                      >
                        <Link href={`/admin-new?recordingId=${recording.id}`}>
                          <FileAudio className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(recording.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
            disabled={page === 1}
          >
            Назад
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <Button
                key={pageNum}
                variant={pageNum === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPage(pageNum)}
              >
                {pageNum}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
            disabled={page === totalPages}
          >
            Вперед
          </Button>
        </div>
      )}
    </div>
  );
};

// Компонент детальной информации о записи
const RecordingDetail: React.FC<{ id: number }> = ({ id }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('info');
  const [playingFragmentId, setPlayingFragmentId] = useState<number | null>(null);
  const [comparativeData, setComparativeData] = useState<ComparativeTranscription | null>(null);
  const [comparativeLoading, setComparativeLoading] = useState(false);
  
  const {
    data: recording,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['/api/admin/recordings', id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/recordings/${id}`);
      if (!response.ok) {
        throw new Error('Ошибка при загрузке записи');
      }
      return response.json();
    }
  });
  
  const {
    data: playerFragments,
    isLoading: isLoadingFragments
  } = useQuery({
    queryKey: ['/api/admin/recordings', id, 'player-fragments'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/recordings/${id}/player-fragments`);
      if (!response.ok) {
        throw new Error('Ошибка при загрузке фрагментов для плеера');
      }
      return response.json();
    },
    enabled: !!recording
  });
  
  const handleMergeFragments = async (sessionId?: string) => {
    try {
      const response = await fetch(`/api/admin/recordings/${id}/merge-fragments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          forceProcess: true
        })
      });
      
      if (!response.ok) {
        throw new Error('Ошибка при объединении фрагментов');
      }
      
      toast({
        title: 'Успешно',
        description: 'Фрагменты успешно объединены',
        variant: 'default'
      });
      
      refetch();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось объединить фрагменты',
        variant: 'destructive'
      });
    }
  };
  
  const handlePlayFragment = (fragmentId: number) => {
    setPlayingFragmentId(fragmentId);
  };
  
  // Загрузка сравнительных данных диаризации
  const loadComparativeData = async () => {
    try {
      setComparativeLoading(true);
      const response = await fetch(`/api/diarize/compare/recording/${id}`);
      
      if (!response.ok) {
        throw new Error('Ошибка при загрузке сравнительных данных диаризации');
      }
      
      const data = await response.json();
      setComparativeData(data);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось загрузить сравнительные данные диаризации',
        variant: 'destructive'
      });
    } finally {
      setComparativeLoading(false);
    }
  };
  
  // Загружаем сравнительные данные при монтировании компонента
  useEffect(() => {
    if (recording && activeTab === 'transcription') {
      loadComparativeData();
    }
  }, [recording, activeTab]);
  
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'started':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };
  
  // Форматирование времени для отображения временных меток
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  if (isLoading) {
    return <div className="flex justify-center p-6">Загрузка информации о записи...</div>;
  }
  
  if (isError || !recording) {
    return <div className="flex justify-center p-6 text-destructive">Ошибка при загрузке информации о записи</div>;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin-new">
              Назад к списку
            </Link>
          </Button>
          <h2 className="text-xl font-semibold">Запись #{id}</h2>
          <Badge variant={
            recording.status === 'completed' ? 'default' : 
            recording.status === 'started' ? 'secondary' : 
            'destructive'
          }>
            {recording.status === 'completed' ? 'Завершена' : 
             recording.status === 'started' ? 'Начата' : 
             'Ошибка'}
          </Badge>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info">Информация</TabsTrigger>
          <TabsTrigger value="player">Плеер</TabsTrigger>
          <TabsTrigger value="fragments">Фрагменты ({recording.fragments?.length || 0})</TabsTrigger>
          <TabsTrigger value="transcription">Транскрипция</TabsTrigger>
        </TabsList>
        
        <TabsContent value="info" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Основная информация</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Дата:</span>
                  <span>
                    {recording.timestamp 
                      ? format(new Date(recording.timestamp), 'dd.MM.yyyy HH:mm:ss')
                      : 'Не указана'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Длительность:</span>
                  <span>
                    {recording.duration 
                      ? `${Math.floor(recording.duration / 60)}:${String(Math.floor(recording.duration % 60)).padStart(2, '0')}`
                      : '0:00'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Отправитель:</span>
                  <span>{recording.senderUsername || 'Неизвестно'}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Получатель:</span>
                  <span>{recording.targetUsername || 'Неизвестно'}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Файл</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileAudio className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Имя файла:</span>
                  <span>{recording.filename || 'Файл отсутствует'}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <FileAudio className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Размер:</span>
                  <span>
                    {recording.fileSize 
                      ? `${(recording.fileSize / 1024).toFixed(1)} KB`
                      : '0 KB'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <FileAudio className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Статус файла:</span>
                  <span className={recording.fileExists ? 'text-green-500' : 'text-red-500'}>
                    {recording.fileExists ? 'Файл существует' : 'Файл отсутствует'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <FileAudio className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Фрагменты:</span>
                  <span>
                    {recording.fragments?.length || 0} фрагментов
                    {recording.canMergeFragments && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onClick={() => handleMergeFragments()}
                      >
                        Объединить
                      </Button>
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="player" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Аудиоплеер</CardTitle>
              <CardDescription>
                {recording.fileExists 
                  ? 'Воспроизведение аудиозаписи'
                  : 'Файл записи отсутствует'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recording.fileExists ? (
                <AudioPlayer recordingId={id} />
              ) : (
                <div className="p-4 text-center text-muted-foreground bg-muted/20 rounded-md">
                  Файл записи отсутствует.
                  {recording.canMergeFragments && (
                    <div className="mt-2">
                      <Button
                        variant="default"
                        onClick={() => handleMergeFragments()}
                      >
                        Объединить фрагменты
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {playerFragments && playerFragments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Фрагменты для воспроизведения</CardTitle>
                <CardDescription>
                  Доступно {playerFragments.length} фрагментов
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {playerFragments.map((fragment: any) => (
                    <div 
                      key={fragment.id}
                      className={`p-2 rounded-md flex items-center justify-between ${
                        playingFragmentId === fragment.id ? 'bg-primary/10' : 'bg-muted/20'
                      }`}
                    >
                      <div>
                        <span className="font-medium">Фрагмент #{fragment.index}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {fragment.duration 
                            ? `${Math.floor(fragment.duration / 60)}:${String(Math.floor(fragment.duration % 60)).padStart(2, '0')}`
                            : '0:00'}
                        </span>
                        <span className={`text-xs ml-2 ${fragment.exists ? 'text-green-500' : 'text-red-500'}`}>
                          {fragment.exists ? 'Доступен' : 'Недоступен'}
                        </span>
                      </div>
                      
                      {fragment.exists && (
                        <Button
                          variant={playingFragmentId === fragment.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handlePlayFragment(fragment.id)}
                        >
                          {playingFragmentId === fragment.id ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                          {playingFragmentId === fragment.id ? 'Пауза' : 'Воспроизвести'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                {playingFragmentId && (
                  <div className="mt-4">
                    <AudioPlayer 
                      recordingId={id} 
                      fragmentId={playingFragmentId}
                      onEnded={() => setPlayingFragmentId(null)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="fragments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Фрагменты записи</CardTitle>
              <CardDescription>
                {recording.fragments?.length 
                  ? `Всего ${recording.fragments.length} фрагментов`
                  : 'Фрагменты отсутствуют'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recording.fragments && recording.fragments.length > 0 ? (
                <div className="space-y-4">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Сессия</TableHead>
                          <TableHead>Индекс</TableHead>
                          <TableHead>Длительность</TableHead>
                          <TableHead>Имя файла</TableHead>
                          <TableHead>Дата</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recording.fragments.map((fragment: RecordingFragment) => (
                          <TableRow key={fragment.id}>
                            <TableCell>{fragment.id}</TableCell>
                            <TableCell>
                              <span className="font-mono text-xs">{fragment.sessionId.slice(0, 8)}...</span>
                            </TableCell>
                            <TableCell>{fragment.fragmentIndex}</TableCell>
                            <TableCell>
                              {fragment.duration 
                                ? `${Math.floor(fragment.duration / 60)}:${String(Math.floor(fragment.duration % 60)).padStart(2, '0')}`
                                : '0:00'}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs">{fragment.filename}</span>
                            </TableCell>
                            <TableCell>
                              {fragment.timestamp 
                                ? format(new Date(fragment.timestamp), 'dd.MM.yyyy HH:mm')
                                : 'Нет даты'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  
                  {recording.canMergeFragments && recording.sessionGroups && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Объединение фрагментов по сессиям:</h4>
                      {Object.entries(recording.sessionGroups).map(([sessionId, fragments]) => (
                        <div
                          key={sessionId}
                          className="flex items-center justify-between p-2 bg-muted/20 rounded-md"
                        >
                          <div>
                            <span className="font-mono text-xs">{sessionId.slice(0, 8)}...</span>
                            <span className="ml-2 text-sm text-muted-foreground">
                              {(fragments as RecordingFragment[]).length} фрагментов
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMergeFragments(sessionId)}
                          >
                            Объединить сессию
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground bg-muted/20 rounded-md">
                  Фрагменты отсутствуют
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="transcription" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Обычная транскрипция</CardTitle>
              <CardDescription>
                {recording.transcription 
                  ? 'Базовый результат распознавания речи'
                  : 'Базовая транскрипция отсутствует'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recording.transcription ? (
                <div className="whitespace-pre-wrap bg-muted/20 p-4 rounded-md max-h-[400px] overflow-auto">
                  {recording.transcription}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground bg-muted/20 rounded-md">
                  Транскрипция отсутствует
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/diarize/compare/recording/${id}`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ 
                        language: 'ru',
                        minSpeakers: 1,
                        maxSpeakers: 4 
                      })
                    });
                    
                    if (!response.ok) {
                      throw new Error('Ошибка при выполнении сравнительной транскрипции');
                    }
                    
                    toast({
                      title: 'Задача запущена',
                      description: 'Запущена сравнительная транскрипция. Это может занять некоторое время.',
                      variant: 'default'
                    });
                    
                    // Через 10 секунд обновляем данные
                    setTimeout(() => {
                      loadComparativeData();
                    }, 10000);
                  } catch (error) {
                    toast({
                      title: 'Ошибка',
                      description: error instanceof Error ? error.message : 'Не удалось запустить сравнительную транскрипцию',
                      variant: 'destructive'
                    });
                  }
                }}
              >
                Запустить сравнительную транскрипцию
              </Button>
            </CardFooter>
          </Card>
          
          {/* Раздел сравнительной транскрипции */}
          <Card>
            <CardHeader>
              <CardTitle>Сравнительная транскрипция</CardTitle>
              <CardDescription>
                Сравнение результатов работы разных моделей распознавания
              </CardDescription>
            </CardHeader>
            <CardContent>
              {comparativeLoading ? (
                <div className="flex justify-center items-center p-6">
                  <div className="animate-spin mr-2">⚙️</div>
                  <span>Загрузка сравнительных данных...</span>
                </div>
              ) : comparativeData && comparativeData.segments && comparativeData.segments.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                    <div className="p-2 bg-blue-100 rounded-md text-center">
                      <span className="text-xs font-medium">Whisper</span>
                    </div>
                    <div className="p-2 bg-green-100 rounded-md text-center">
                      <span className="text-xs font-medium">GPT-4o Mini</span>
                    </div>
                    <div className="p-2 bg-purple-100 rounded-md text-center">
                      <span className="text-xs font-medium">GPT-4o</span>
                    </div>
                  </div>
                  
                  {/* Полные транскрипции от разных моделей */}
                  <Accordion type="single" collapsible className="mb-4">
                    <AccordionItem value="full-transcriptions">
                      <AccordionTrigger>Полные транскрипции от разных моделей</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-blue-50 p-3 rounded-md">
                            <div className="text-xs font-medium mb-1">Whisper:</div>
                            <div className="whitespace-pre-wrap text-sm">{comparativeData.whisper || "Нет данных"}</div>
                          </div>
                          
                          <div className="bg-green-50 p-3 rounded-md">
                            <div className="text-xs font-medium mb-1">GPT-4o Mini:</div>
                            <div className="whitespace-pre-wrap text-sm">{comparativeData.gpt4oMini || "Нет данных"}</div>
                          </div>
                          
                          <div className="bg-purple-50 p-3 rounded-md">
                            <div className="text-xs font-medium mb-1">GPT-4o:</div>
                            <div className="whitespace-pre-wrap text-sm">{comparativeData.gpt4o || "Нет данных"}</div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  {/* Сегменты диаризации и результаты транскрипции разными моделями */}
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {comparativeData.segments.map((segment, index) => (
                        <div key={index} className="border rounded-md p-3">
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-sm font-medium">
                              Спикер: {segment.speaker}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatTime(segment.start)} - {formatTime(segment.end)}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="bg-blue-50 p-2 rounded-md">
                              <div className="whitespace-pre-wrap text-sm">
                                {segment.whisperText || segment.text || "Нет данных"}
                              </div>
                            </div>
                            
                            <div className="bg-green-50 p-2 rounded-md">
                              <div className="whitespace-pre-wrap text-sm">
                                {segment.gpt4oMiniText || "Нет данных"}
                              </div>
                            </div>
                            
                            <div className="bg-purple-50 p-2 rounded-md">
                              <div className="whitespace-pre-wrap text-sm">
                                {segment.gpt4oText || "Нет данных"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  {/* Информация о времени обработки */}
                  {comparativeData.processingTime && (
                    <div className="text-xs text-muted-foreground text-right mt-2">
                      Время обработки: {(comparativeData.processingTime / 1000).toFixed(2)} сек
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground bg-muted/20 rounded-md">
                  Сравнительные данные отсутствуют.
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={loadComparativeData}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Проверить наличие данных
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Компонент статистики
const DashboardStats: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats');
      if (!response.ok) {
        throw new Error('Ошибка при загрузке статистики');
      }
      return response.json();
    }
  });
  
  if (isLoading) {
    return <div className="flex justify-center p-6">Загрузка статистики...</div>;
  }
  
  if (isError || !data) {
    return <div className="flex justify-center p-6 text-destructive">Ошибка при загрузке статистики</div>;
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Панель управления</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Всего записей</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.recordings.total}</div>
            <p className="text-xs text-muted-foreground">
              Завершенных: {data.recordings.completed}, Начатых: {data.recordings.started}, С ошибками: {data.recordings.error}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Общая длительность</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(data.recordings.totalDuration / 60)} мин.
            </div>
            <p className="text-xs text-muted-foreground">
              {data.recordings.totalDuration.toFixed(1)} сек.
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Всего фрагментов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.fragments.total}</div>
            <p className="text-xs text-muted-foreground">
              Уникальных сессий: {data.fragments.uniqueSessions}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Объем хранилища</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data.storage.recordingsSize / (1024 * 1024)).toFixed(2)} МБ
            </div>
            <p className="text-xs text-muted-foreground">
              Записи: {(data.storage.recordingsSize / 1024).toFixed(1)} КБ
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Транскрипция</CardTitle>
            <CardDescription>Информация о транскрипции записей</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Всего записей с транскрипцией:</span>
                <span className="font-medium">{data.recordings.withTranscription} из {data.recordings.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Общая стоимость:</span>
                <span className="font-medium">${data.transcription.totalCost.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span>Всего токенов обработано:</span>
                <span className="font-medium">{data.transcription.totalTokens.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Инструменты для управления системой</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" asChild>
                <Link href="/admin-new">
                  <FileAudio className="h-4 w-4 mr-2" />
                  Записи
                </Link>
              </Button>
              
              <Button variant="outline" asChild>
                <Link href="/admin">
                  <BarChart className="h-4 w-4 mr-2" />
                  Статистика
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Главный компонент админ-панели
const AdminAppNew: React.FC = () => {
  const [location, setLocation] = useLocation();
  
  // Если мы находимся на корневом маршруте /, перенаправляем на /admin-new
  useEffect(() => {
    if (location === '/') {
      setLocation('/admin-new');
    }
  }, [location, setLocation]);
  
  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <header className="mb-6 space-y-2">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Админ-панель</h1>
          <nav className="flex gap-2">
            <Button variant={location === '/admin-new' || location === '/admin' ? 'default' : 'outline'} asChild>
              <Link href="/admin-new">
                <BarChart className="h-4 w-4 mr-2" />
                Панель управления
              </Link>
            </Button>
            <Button variant={location.includes('/admin-new/') ? 'default' : 'outline'} asChild>
              <Link href="/admin-new">
                <FileAudio className="h-4 w-4 mr-2" />
                Записи
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin-new">
                <HomeIcon className="h-4 w-4 mr-2" />
                Главная страница
              </Link>
            </Button>
          </nav>
        </div>
        <Separator />
      </header>
      
      <main>
        <Switch>
          <Route path="/admin-new" component={RecordingsList} />
          <Route path="/admin" component={DashboardStats} />
          <Route path="/admin-new/:id">
            {(params) => <RecordingDetail id={parseInt(params.id, 10)} />}
          </Route>
        </Switch>
      </main>
    </div>
  );
};

export default AdminAppNew;