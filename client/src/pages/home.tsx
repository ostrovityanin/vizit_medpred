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
        title: "Recording started",
        description: "Audio recording and timer are now active",
      });
    } else {
      toast({
        title: "Failed to start recording",
        description: "There was an error starting the audio recording",
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
        title: "Recording completed",
        description: `Recorded ${duration} seconds of audio`,
      });
    } else {
      toast({
        title: "Recording failed",
        description: "Failed to process the recording",
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
        title: "Permission denied",
        description: "Microphone access is required for recording",
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
        title: "No recording to send",
        description: "Please record audio first",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sending recording",
      description: "Sending to @ostrovityanin...",
    });

    const success = await sendAudioToTelegram(audioBlob, 'ostrovityanin');
    
    if (success) {
      toast({
        title: "Recording sent",
        description: "Successfully sent to @ostrovityanin",
      });
      handleDiscardAudio();
    } else {
      toast({
        title: "Failed to send",
        description: "There was an error sending the recording",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 flex flex-col min-h-screen">
      <header className="text-center mb-8">
        <h1 className="text-2xl font-bold text-tgblue">Voice Timer</h1>
        <p className="text-neutral-700 text-sm mt-1">Record audio while timing your activity</p>
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
            <span>Start Timer</span>
          </Button>
        ) : (
          <Button 
            className="bg-recording hover:bg-red-600 text-white font-medium py-3 px-8 rounded-lg flex items-center gap-2"
            onClick={handleStopTimer}
          >
            <StopCircle className="h-5 w-5" />
            <span>Stop</span>
          </Button>
        )}
      </div>

      {recordingCompleted && audioUrl && (
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6 flex flex-col items-center">
          <div className="text-center mb-4">
            <h3 className="font-semibold text-lg">Recording Completed</h3>
            <p className="text-neutral-700 text-sm">Your audio has been processed</p>
          </div>
          
          <AudioPlayer audioUrl={audioUrl} />
          
          <div className="flex gap-3 w-full mt-4">
            <Button 
              variant="outline"
              className="flex-1 border-neutral-300 text-neutral-700 font-medium"
              onClick={handleDiscardAudio}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Discard
            </Button>
            <Button 
              className="flex-1 bg-tgblue hover:bg-tgbluedark text-white font-medium"
              onClick={handleSendAudio}
            >
              <Send className="h-4 w-4 mr-2" />
              Send to @ostrovityanin
            </Button>
          </div>
        </div>
      )}

      {!recordingCompleted && (
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
