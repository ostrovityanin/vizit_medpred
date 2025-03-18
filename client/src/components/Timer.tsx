import { formatSeconds } from '@/lib/timer';

interface TimerProps {
  time: number;
  isRecording: boolean;
}

export default function Timer({ time, isRecording }: TimerProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-8 mb-6 text-center">
      <div className="text-6xl font-bold tabular-nums mb-4">
        {formatSeconds(time)}
      </div>
      {isRecording && (
        <div className="flex items-center justify-center text-recording font-medium gap-2">
          <span className="inline-block w-3 h-3 bg-recording rounded-full animate-pulse"></span>
          <span>Запись...</span>
        </div>
      )}
    </div>
  );
}
