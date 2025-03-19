import { useState, useEffect, useRef } from 'react';
import Timer from '@/components/Timer';
import Instructions from '@/components/Instructions';
import PermissionModal from '@/components/PermissionModal';
import { Button } from '@/components/ui/button';
import { Timer as TimerClass } from '@/lib/timer';
import { audioRecorder } from '@/lib/audioRecorder';
import { sendAudioToRecipient } from '@/lib/telegram';
import { useToast } from '@/hooks/use-toast';
import { PlayCircle, StopCircle, Send, Trash2 } from 'lucide-react';
import { Link } from 'wouter';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [recordingCompleted, setRecordingCompleted] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [recipient, setRecipient] = useState('');
  const [senderUsername, setSenderUsername] = useState<string>("Пользователь");
  
  // Получаем информацию о пользователе из Telegram WebApp
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const webAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
      if (webAppUser) {
        const username = webAppUser.username || 
                        (webAppUser.first_name ? 
                          `${webAppUser.first_name}${webAppUser.last_name ? ' ' + webAppUser.last_name : ''}` : 
                          "Пользователь");
        setSenderUsername(username);
      }
    }
  }, []);
  const MAX_RECORDING_TIME = 900; // Максимальное время записи в секундах (15 минут)
  const { toast } = useToast();
  
  // Функция для остановки записи, которую можно безопасно вызывать из useRef колбэка
  const stopRecordingRef = useRef<() => Promise<void>>();
  
  // Теперь используем только setTimeout, так что таймер не будет автоматически останавливать запись
  const timerRef = useRef(new TimerClass((seconds) => {
    setTimerSeconds(seconds);
  }));

  // Автоматическая остановка записи через 1 минуту
  useEffect(() => {
    let autoStopTimerId: number | null = null;
    
    // Только когда запись активна, устанавливаем таймер автоостановки
    if (isRecording) {
      console.log('Установлен таймер автоостановки на 10 минут');
      
      // Устанавливаем таймер на автоматическую остановку через 10 минут
      autoStopTimerId = window.setTimeout(async () => {
        console.log('Сработал таймер автоостановки');
        
        // Проверяем, что запись все еще идет
        if (isRecording) {
          const duration = timerRef.current.stop();
          setIsRecording(false);
          
          const blob = await audioRecorder.stopRecording();
          if (blob) {
            setAudioBlob(blob);
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            setRecordingCompleted(true);
            
            toast({
              title: "Автоматическая остановка",
              description: `Достигнут максимальный лимит времени (10 минут)`,
            });
            
            // Сохраняем данные
            await sendRecording(blob);
          }
        }
      }, MAX_RECORDING_TIME * 1000); // Переводим секунды в миллисекунды
      
      // Для отладки - создаем ссылку на функцию остановки
      stopRecordingRef.current = async () => {
        console.log('Вызвана stopRecordingRef.current()');
        if (autoStopTimerId) {
          clearTimeout(autoStopTimerId);
        }
      };
    } else {
      // Если запись не активна и существует таймер, очищаем его
      if (autoStopTimerId) {
        clearTimeout(autoStopTimerId);
      }
      // Очищаем ссылку на функцию остановки
      stopRecordingRef.current = undefined;
    }
    
    // Очистка при размонтировании
    return () => {
      if (autoStopTimerId) {
        clearTimeout(autoStopTimerId);
      }
    };
  }, [isRecording]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      audioRecorder.cleanup();
    };
  }, [audioUrl]);

  const handleStartTimer = async () => {
    const hasPermission = await audioRecorder.requestPermission();
    
    if (!hasPermission) {
      setShowPermissionModal(true);
      return;
    }

    // Генерируем уникальный ID сессии для фрагментированной записи
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Сохраняем ID сессии для последующей отправки фрагментов
    localStorage.setItem('recordingSessionId', sessionId);
    
    // Используем фрагментированную запись с 30-секундными фрагментами
    const started = audioRecorder.startFragmentedRecording(
      // Callback для сохранения фрагментов
      (fragment) => {
        console.log(`Сохранен фрагмент #${fragment.index}, размер: ${fragment.blob.size} байт, sessionId: ${sessionId}`);
        
        // Уведомление при сохранении каждого 30-секундного фрагмента (только для каждого 10-го фрагмента)
        if (fragment.index > 0 && fragment.index % 10 === 0) {
          const minutesRecorded = Math.round(fragment.index * 30 / 60);
          toast({
            title: "Автоматическое сохранение",
            description: `Фрагмент ${fragment.index}: сохранено ${minutesRecorded} минут записи`,
            duration: 3000,
          });
          
          console.log(`Запись продолжается: сохранен фрагмент #${fragment.index} (${minutesRecorded} минут)`);
        }
      },
      30000, // 30 секунд - размер фрагмента
      sessionId  // Передаем ID сессии для связывания фрагментов
    );
    
    if (started) {
      // Логируем событие начала записи
      try {
        // Создаем запись со статусом "started"
        const startResponse = await fetch('/api/recordings/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetUsername: 'archive',
            senderUsername: senderUsername,
            sessionId: sessionId, // Передаем ID сессии на сервер
          }),
        });
        
        if (startResponse.ok) {
          const data = await startResponse.json();
          console.log('Создана запись со статусом started:', data);
          
          // Сохраняем ID записи для последующего обновления
          localStorage.setItem('currentRecordingId', String(data.recordingId));
        } else {
          console.error('Ошибка при создании записи со статусом started:', await startResponse.text());
        }
        
        // Получаем ID записи, если он был сохранен выше
        const recordingId = localStorage.getItem('currentRecordingId');
        
        // Логируем событие в системе и передаем ID записи для предотвращения дублирования
        await fetch('/api/events/recording-start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: senderUsername,
            timestamp: new Date().toISOString(),
            recordingId: recordingId ? parseInt(recordingId, 10) : undefined, // Передаем ID записи, если он доступен
            sessionId: sessionId // Добавляем ID сессии
          }),
        });
      } catch (error) {
        console.error('Ошибка при логировании начала записи:', error);
      }
      
      timerRef.current.start();
      setIsRecording(true);
      toast({
        title: "Визит начат",
        description: "Таймер активен с защитой от потери данных",
      });
    } else {
      toast({
        title: "Ошибка запуска",
        description: "Произошла ошибка при запуске записи",
        variant: "destructive",
      });
    }
  };

  const handleStopTimer = async () => {
    const duration = timerRef.current.stop();
    setIsRecording(false);
    
    const blob = await audioRecorder.stopRecording();
    if (blob) {
      setAudioBlob(blob);
      // Create object URL for audio playback
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setRecordingCompleted(true);
      
      toast({
        title: "Визит завершен",
        description: `Продолжительность визита: ${duration} секунд`,
      });
      
      // Сохраняем данные
      await sendRecording(blob);
    } else {
      toast({
        title: "Ошибка",
        description: "Не удалось обработать данные визита",
        variant: "destructive",
      });
    }
  };
  
  // Функция для сохранения данных визита
  const sendRecording = async (blob: Blob) => {
    try {
      // Получаем ID ранее созданной записи, если она была создана при старте
      const recordingId = localStorage.getItem('currentRecordingId');
      
      // Получаем ID сессии, если он был сохранен при старте записи
      const sessionId = localStorage.getItem('recordingSessionId');
      
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');
      formData.append('duration', String(timerRef.current.getTime()));
      formData.append('timestamp', new Date().toISOString());
      formData.append('targetUsername', 'archive');  // Используем фиксированное значение
      formData.append('senderUsername', senderUsername);
      
      // Добавляем ID сессии для объединения фрагментов
      if (sessionId) {
        formData.append('sessionId', sessionId);
        console.log(`Добавляем ID сессии для объединения фрагментов: ${sessionId}`);
      }
      
      // Добавляем ID существующей записи, если она есть
      if (recordingId) {
        formData.append('recordingId', recordingId);
        console.log(`Добавляем к записи со статусом started (ID: ${recordingId})`);
      }

      const response = await fetch('/api/recordings', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error('Ошибка сохранения визита:', await response.text());
        
        // Если произошла ошибка и у нас есть recordingId, обновляем статус на "error"
        if (recordingId) {
          try {
            await fetch(`/api/recordings/${recordingId}/status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status: 'error',
                errorMessage: 'Ошибка при сохранении финальной записи'
              }),
            });
            console.log(`Запись ${recordingId} помечена как ошибочная`);
          } catch (statusError) {
            console.error('Ошибка при обновлении статуса:', statusError);
          }
        }
        
        return false;
      }

      const recording = await response.json();
      console.log('Визит успешно сохранен:', recording);
      
      // Очищаем ID текущей записи
      localStorage.removeItem('currentRecordingId');
      
      return true;
    } catch (error) {
      console.error('Ошибка при сохранении визита:', error);
      
      // Если есть ID записи и произошла ошибка, обновляем статус
      const recordingId = localStorage.getItem('currentRecordingId');
      if (recordingId) {
        try {
          await fetch(`/api/recordings/${recordingId}/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'error',
              errorMessage: 'Исключение при сохранении финальной записи'
            }),
          });
          console.log(`Запись ${recordingId} помечена как ошибочная после исключения`);
        } catch (statusError) {
          console.error('Ошибка при обновлении статуса:', statusError);
        }
      }
      
      return false;
    }
  };

  const handleAllowPermission = async () => {
    setShowPermissionModal(false);
    const hasPermission = await audioRecorder.requestPermission();
    
    if (hasPermission) {
      handleStartTimer();
    } else {
      toast({
        title: "Доступ запрещен",
        description: "Для работы таймера требуется доступ к устройству",
        variant: "destructive",
      });
    }
  };

  const handleCancelPermission = () => {
    setShowPermissionModal(false);
    toast({
      title: "Доступ запрещен",
      description: "Для работы таймера требуется доступ к устройству",
    });
  };

  const handleDiscardAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingCompleted(false);
    timerRef.current.reset();
    
    toast({
      title: "Данные визита удалены",
      description: "Информация о визите была удалена",
    });
  };

  const handleSendAudio = async () => {
    if (!audioBlob) {
      toast({
        title: "Нет данных визита",
        description: "Сначала запустите таймер и запишите визит",
        variant: "destructive",
      });
      return;
    }

    await sendRecording(audioBlob);
    handleDiscardAudio();
  };
  
  // Отправка только через Telegram

  return (
    <div className="max-w-md mx-auto px-4 py-8 flex flex-col min-h-screen bg-gray-800">
      <header className="flex flex-col items-center mb-6">
        <h1 className="text-3xl font-bold text-white mb-3">ТАЙМЕР ВИЗИТА</h1>
        <div className="flex gap-2 flex-wrap justify-center">
          <Link href={`/user-recordings${senderUsername ? `?username=${encodeURIComponent(senderUsername)}` : ''}`}>
            <Button variant="outline" size="sm" className="text-xs bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
              Мои визиты
            </Button>
          </Link>
        </div>
      </header>

      <Timer
        time={timerSeconds}
        isRecording={isRecording}
      />

      <div className="flex justify-center gap-4 mb-8">
        {!isRecording ? (
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-10 rounded-lg flex items-center gap-2"
            onClick={handleStartTimer}
          >
            <PlayCircle className="h-6 w-6" />
            <span className="text-lg">СТАРТ</span>
          </Button>
        ) : (
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-10 rounded-lg flex items-center gap-2"
            onClick={handleStopTimer}
          >
            <StopCircle className="h-6 w-6" />
            <span className="text-lg">СТОП</span>
          </Button>
        )}
      </div>

      {recordingCompleted && audioUrl && (
        <div className="bg-gray-900 rounded-2xl shadow-lg p-6 mb-4 flex flex-col items-center border border-gray-700">
          <div className="text-center mb-2">
            <h3 className="font-semibold text-lg text-white">Визит зафиксирован</h3>
          </div>
          
          <Button 
            variant="outline"
            className="mt-3 border-gray-600 text-gray-300 font-medium hover:bg-gray-700"
            onClick={handleDiscardAudio}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Записать новый визит
          </Button>
        </div>
      )}
      
      {!recordingCompleted && !isRecording && (
        <Instructions />
      )}

      <PermissionModal 
        isOpen={showPermissionModal}
        onAllow={handleAllowPermission}
        onCancel={handleCancelPermission}
      />
    </div>
  );
}
