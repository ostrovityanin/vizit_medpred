import { formatSeconds } from '@/lib/timer';

interface TimerProps {
  time: number;
  isRecording: boolean;
}

export default function Timer({ time, isRecording }: TimerProps) {
  // Рассчитываем оставшееся время до автоматической остановки (60 секунд)
  const MAX_TIME = 60;
  const remainingTime = Math.max(0, MAX_TIME - time);
  const remainingPercent = (remainingTime / MAX_TIME) * 100;
  
  return (
    <div className="bg-white rounded-2xl shadow-md p-8 mb-6 text-center">
      <div className="text-6xl font-bold tabular-nums mb-4">
        {formatSeconds(time)}
      </div>
      
      {isRecording && (
        <>
          <div className="flex items-center justify-center text-tgblue font-medium gap-2 mb-3">
            <span>⏱ Визит идет</span>
          </div>
          
          <div className="text-sm text-neutral-600 mb-1">
            {remainingTime > 0 
              ? `Автоостановка через: ${formatSeconds(remainingTime)}`
              : "Автоостановка сейчас..."}
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-tgblue h-2.5 rounded-full transition-all duration-1000 ease-linear" 
              style={{ width: `${remainingPercent}%` }}
            ></div>
          </div>
        </>
      )}
    </div>
  );
}
