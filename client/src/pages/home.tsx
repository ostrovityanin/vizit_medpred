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
  const timerRef = useRef(new TimerClass((seconds) => setTimerSeconds(seconds)));
  const { toast } = useToast();

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
    
    const started = audioRecorder.startRecording();
    if (started) {
      timerRef.current.start();
      setIsRecording(true);
      toast({
        title: "Визит начат",
        description: "Таймер активен",
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
      
      // Автоматически отправить аудио на указанный адрес
      await sendRecording(blob);
    } else {
      toast({
        title: "Ошибка",
        description: "Не удалось обработать данные визита",
        variant: "destructive",
      });
    }
  };
  
  // Выделяем логику отправки в отдельную функцию
  const sendRecording = async (blob: Blob) => {
    if (!recipient || recipient.trim() === '') {
      toast({
        title: "Имя получателя не указано",
        description: "Пожалуйста, введите имя получателя перед отправкой",
        variant: "destructive"
      });
      return false;
    }

    toast({
      title: "Отправка данных визита",
      description: `Отправка на ${recipient}...`,
    });

    const success = await sendAudioToRecipient(blob, recipient, senderUsername);
    
    if (success) {
      toast({
        title: "Данные визита отправлены",
        description: `Успешно отправлено на ${recipient}`,
      });
    } else {
      toast({
        title: "Данные визита сохранены",
        description: "Отправка не удалась. Для получения сообщений от бота, получатель должен отправить боту команду /start. Данные сохранены на сервере.",
        duration: 10000,
      });
    }
    
    return success;
  };

  const handleAllowPermission = async () => {
    setShowPermissionModal(false);
    const hasPermission = await audioRecorder.requestPermission();
    
    if (hasPermission) {
      handleStartTimer();
    } else {
      toast({
        title: "Доступ запрещен",
        description: "Для работы таймера требуется доступ к микрофону",
        variant: "destructive",
      });
    }
  };

  const handleCancelPermission = () => {
    setShowPermissionModal(false);
    toast({
      title: "Доступ запрещен",
      description: "Для записи требуется доступ к микрофону",
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
        title: "Нет записи для отправки",
        description: "Сначала запишите аудио",
        variant: "destructive",
      });
      return;
    }

    await sendRecording(audioBlob);
    handleDiscardAudio();
  };
  
  // Отправка только через Telegram

  return (
    <div className="max-w-md mx-auto px-4 py-8 flex flex-col min-h-screen">
      <header className="flex flex-col items-center mb-8">
        <h1 className="text-2xl font-bold text-tgblue mb-2">Таймер визита</h1>
        <div className="flex gap-2 flex-wrap justify-center">
          <Link href="/recordings">
            <Button variant="outline" size="sm" className="text-xs">
              Архив записей
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
            className="bg-tgblue hover:bg-tgbluedark text-white font-medium py-3 px-8 rounded-lg flex items-center gap-2"
            onClick={handleStartTimer}
          >
            <PlayCircle className="h-5 w-5" />
            <span>Старт</span>
          </Button>
        ) : (
          <Button 
            className="bg-recording hover:bg-red-600 text-white font-medium py-3 px-8 rounded-lg flex items-center gap-2"
            onClick={handleStopTimer}
          >
            <StopCircle className="h-5 w-5" />
            <span>Стоп</span>
          </Button>
        )}
      </div>

      {recordingCompleted && audioUrl && (
        <div className="bg-white rounded-2xl shadow-md p-6 mb-4 flex flex-col items-center">
          <div className="text-center mb-2">
            <h3 className="font-semibold text-lg">Запись отправлена</h3>
            <p className="text-sm text-neutral-500">
              Аудио отправлено на {recipient || "получателя"}
            </p>
          </div>
          
          <Button 
            variant="outline"
            className="mt-3 border-neutral-300 text-neutral-700 font-medium"
            onClick={handleDiscardAudio}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Записать новое аудио
          </Button>
        </div>
      )}

      {!isRecording && (
        <div className="bg-white rounded-2xl shadow-md p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium text-neutral-700">Отправка записи:</span>
            <div className="flex items-center">
              <Button 
                variant="default"
                size="sm"
                className="rounded-lg"
                disabled
              >
                <Send className="h-4 w-4 mr-1" /> Telegram
              </Button>
            </div>
          </div>
          
          <div className="mt-2 text-center text-neutral-600">
            <p className="text-sm">Введите имя получателя:</p>
            <input 
              type="text" 
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Например, @username"
              className="mt-2 p-2 w-full border rounded-md"
            />
          </div>
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
