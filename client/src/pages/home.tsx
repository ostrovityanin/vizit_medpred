import { useState, useEffect, useRef } from 'react';
import Timer from '@/components/Timer';
import AudioPlayer from '@/components/AudioPlayer';
import Instructions from '@/components/Instructions';
import PermissionModal from '@/components/PermissionModal';
import { Button } from '@/components/ui/button';
import { Timer as TimerClass } from '@/lib/timer';
import { audioRecorder } from '@/lib/audioRecorder';
import { sendAudioToTelegram } from '@/lib/telegram';
import { useToast } from '@/hooks/use-toast';
import { PlayCircle, StopCircle, Send, Trash2 } from 'lucide-react';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [recordingCompleted, setRecordingCompleted] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
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
        title: "Запись начата",
        description: "Запись звука и таймер активны",
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
        title: "Запись завершена",
        description: `Записано ${duration} секунд аудио`,
      });
      
      // Автоматически отправить аудио в Telegram
      await sendRecordingToTelegram(blob);
    } else {
      toast({
        title: "Ошибка записи",
        description: "Не удалось обработать запись",
        variant: "destructive",
      });
    }
  };
  
  // Выделяем логику отправки в отдельную функцию
  const sendRecordingToTelegram = async (blob: Blob) => {
    toast({
      title: "Отправка записи",
      description: "Отправка на @ostrovityanin...",
    });

    const success = await sendAudioToTelegram(blob, 'ostrovityanin');
    
    if (success) {
      toast({
        title: "Запись отправлена",
        description: "Успешно отправлено на @ostrovityanin",
      });
    } else {
      toast({
        title: "Ошибка отправки",
        description: "Произошла ошибка при отправке записи",
        variant: "destructive",
      });
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
        description: "Для записи требуется доступ к микрофону",
        variant: "destructive",
      });
    }
  };

  const handleCancelPermission = () => {
    setShowPermissionModal(false);
    toast({
      title: "Permission denied",
      description: "Microphone access is required for recording",
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
      title: "Recording discarded",
      description: "The audio has been discarded",
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

    toast({
      title: "Отправка записи",
      description: "Отправка на @ostrovityanin...",
    });

    const success = await sendAudioToTelegram(audioBlob, 'ostrovityanin');
    
    if (success) {
      toast({
        title: "Запись отправлена",
        description: "Успешно отправлено на @ostrovityanin",
      });
      handleDiscardAudio();
    } else {
      toast({
        title: "Ошибка отправки",
        description: "Произошла ошибка при отправке записи",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 flex flex-col min-h-screen">
      <header className="text-center mb-8">
        <h1 className="text-2xl font-bold text-tgblue">Таймер визита</h1>
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
            <p className="text-sm text-neutral-500">Аудио отправлено на @ostrovityanin</p>
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
