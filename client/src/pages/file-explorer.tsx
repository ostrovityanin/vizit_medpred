import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, RefreshCcw, Send, PlayCircle, XCircle, Play, Pause } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { formatSeconds } from '@/lib/timer';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import FileAudioPlayer from '@/components/FileAudioPlayer';

interface Recording {
  id: number;
  filename: string;
  duration: number;
  timestamp: string;
  targetUsername: string;
  sent: boolean;
}

interface FileInfo {
  filename: string;
  size: number;
  created: string;
  modified: string;
  fullPath: string;
  recording: Recording | null;
  inDatabase: boolean;
}

export default function FileExplorer() {
  const { toast } = useToast();
  const [selectedAudioFile, setSelectedAudioFile] = useState<{id: number, filename: string} | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Запрос информации о файлах
  const { 
    data: filesData, 
    isLoading: isLoadingFiles,
    refetch: refetchFiles
  } = useQuery({
    queryKey: ['/api/files'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  // Запрос информации о боте
  const { 
    data: botInfoData, 
    isLoading: isLoadingBotInfo,
    refetch: refetchBotInfo
  } = useQuery({
    queryKey: ['/api/telegram/bot-info'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  // Запрос обновлений бота
  const { 
    data: updatesData, 
    isLoading: isLoadingUpdates,
    refetch: refetchUpdates
  } = useQuery({
    queryKey: ['/api/telegram/updates'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const handleRefreshAll = () => {
    refetchFiles();
    refetchBotInfo();
    refetchUpdates();

    toast({
      title: "Обновление данных",
      description: "Данные успешно обновлены",
    });
  };

  const handleDownloadFile = (fileId: number) => {
    window.open(`/api/recordings/${fileId}/download`, '_blank');
  };

  const handlePlayFile = (fileId: number, filename: string) => {
    console.log("Playing file:", fileId, filename);
    setSelectedAudioFile({ id: fileId, filename });

    // Попробуем воспроизвести напрямую через API
    const audio = new Audio(`/api/recordings/${fileId}/download`);
    audio.play().catch(err => console.error("Error playing audio:", err));
  };

  const handleClosePlayer = () => {
    setSelectedAudioFile(null);
  };

  const handleSendFile = async (fileId: number) => {
    try {
      const response = await fetch(`/api/recordings/${fileId}/send`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Успех",
          description: data.message || "Файл успешно отправлен",
        });
        refetchFiles(); // Обновляем список после отправки
      } else {
        toast({
          title: "Ошибка",
          description: data.message || "Не удалось отправить файл",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error sending file:', error);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при отправке файла",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Аудио плеер */}
      {selectedAudioFile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 shadow-lg z-50">
          <div className="max-w-4xl mx-auto flex items-center">
            <div className="flex-1">
              <FileAudioPlayer 
                audioUrl={`/api/recordings/${selectedAudioFile.id}/download`}
                filename={selectedAudioFile.filename}
              />
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleClosePlayer}
              className="ml-2"
            >
              <XCircle className="h-5 w-5 text-neutral-500" />
            </Button>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span>Назад</span>
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-tgblue">Файловый менеджер</h1>
        <Button variant="outline" size="sm" onClick={handleRefreshAll}>
          <RefreshCcw className="h-4 w-4 mr-1" />
          <span>Обновить</span>
        </Button>
      </header>

      {/* Информация о боте */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Информация о Telegram боте</h2>

        {isLoadingBotInfo ? (
          <p className="text-neutral-500">Загрузка информации...</p>
        ) : botInfoData?.success ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-neutral-500">ID бота:</p>
              <p className="font-medium">{botInfoData.botInfo.id}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Имя бота:</p>
              <p className="font-medium">{botInfoData.botInfo.first_name}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Имя пользователя:</p>
              <p className="font-medium">@{botInfoData.botInfo.username}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Может отправлять сообщения в группы:</p>
              <p className="font-medium">{botInfoData.botInfo.can_join_groups ? 'Да' : 'Нет'}</p>
            </div>
          </div>
        ) : (
          <p className="text-red-500">Не удалось получить информацию о боте</p>
        )}
      </div>

      {/* Обновления бота */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Последние обновления бота</h2>

        {isLoadingUpdates ? (
          <p className="text-neutral-500">Загрузка обновлений...</p>
        ) : updatesData?.success ? (
          updatesData.updates.length > 0 ? (
            <div className="space-y-4">
              {updatesData.updates.map((update: any, index: number) => (
                <div key={index} className="border border-neutral-200 rounded-lg p-3">
                  <p className="text-sm text-neutral-500">Тип: {Object.keys(update).find(key => key !== 'update_id')}</p>
                  <p className="text-sm text-neutral-500">ID обновления: {update.update_id}</p>
                  {update.message && (
                    <div className="mt-2">
                      <p className="text-sm">От: {update.message.from.first_name} ({update.message.from.id})</p>
                      {update.message.text && <p className="font-medium mt-1">"{update.message.text}"</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500">Нет новых обновлений</p>
          )
        ) : (
          <p className="text-red-500">Не удалось получить обновления бота</p>
        )}
      </div>

      {/* Список файлов */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-medium mb-4">Файлы на сервере</h2>

        {isLoadingFiles ? (
          <p className="text-neutral-500">Загрузка файлов...</p>
        ) : filesData?.success ? (
          filesData.files.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-2 px-3 text-sm font-medium text-neutral-500">Файл</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-neutral-500">Размер</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-neutral-500">Создан</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-neutral-500">Пользователь</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-neutral-500">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filesData.files.map((file: FileInfo, index: number) => (
                    <tr key={index} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-3 px-3">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center space-x-2">
                            {file.recording && (
                              <div className="flex items-center">
                                {selectedAudioFile?.id === file.recording.id ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      audioElement?.pause();
                                      setSelectedAudioFile(null);
                                      setAudioElement(null);
                                    }}
                                  >
                                    <Pause className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const audio = new Audio(`/api/recordings/${file.recording.id}/download`);
                                      audio.play();
                                      setAudioElement(audio);
                                      setSelectedAudioFile({ id: file.recording.id, filename: file.filename });
                                    }}
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                )}
                                <span className="text-sm ml-2">{formatSeconds(file.recording.duration)}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-neutral-600">{file.filename}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm">{formatFileSize(file.size)}</td>
                      <td className="py-3 px-3 text-sm">{formatDate(file.created)}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">@{file.recording?.targetUsername || '-'}</span>
                          <span className="text-xs text-neutral-500">
                            {!file.inDatabase ? (
                              "Нет в базе данных"
                            ) : file.recording?.sent ? (
                              "Отправлено"
                            ) : (
                              "В ожидании"
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        <div className="flex space-x-2">
                          {file.recording && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDownloadFile(file.recording!.id)}
                                title="Скачать"
                              >
                                <Download className="h-3 w-3" />
                              </Button>

                              {!file.recording.sent && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleSendFile(file.recording!.id)}
                                  title="Отправить"
                                >
                                  <Send className="h-3 w-3" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-neutral-500">Нет загруженных файлов</p>
          )
        ) : (
          <p className="text-red-500">Не удалось получить список файлов</p>
        )}
      </div>
    </div>
  );
}