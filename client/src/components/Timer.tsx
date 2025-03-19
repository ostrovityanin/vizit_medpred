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
  
  // Определяем цвет для прогресс-бара в зависимости от оставшегося времени
  let progressBarColor = "bg-tgblue";
  let timeTextColor = "text-neutral-600";
  
  if (remainingTime < 10) {
    // Красный, если осталось менее 10 секунд
    progressBarColor = "bg-red-500";
    timeTextColor = "text-red-600 font-semibold";
  } else if (remainingTime < 20) {
    // Оранжевый, если осталось менее 20 секунд
    progressBarColor = "bg-orange-500";
    timeTextColor = "text-orange-600 font-semibold";
  }
  
  return (
    <div className="bg-white rounded-2xl shadow-md p-8 mb-6 text-center">
      <div className="text-6xl font-bold tabular-nums mb-4">
        {formatSeconds(time)}
      </div>
      
      {isRecording && (
        <>
          <div className="flex items-center justify-center text-tgblue font-medium gap-2 mb-3">
            <span className="flex items-center">
              <span className="relative flex h-3 w-3 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Запись визита
            </span>
          </div>
          
          <div className={`text-sm ${timeTextColor} mb-1 flex items-center justify-center`}>
            {remainingTime > 0 ? (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {remainingTime < 10 ? (
                  <span className="animate-pulse">Автоостановка через: {formatSeconds(remainingTime)}</span>
                ) : (
                  <span>Автоостановка через: {formatSeconds(remainingTime)}</span>
                )}
              </>
            ) : (
              <span className="animate-pulse">Автоостановка сейчас...</span>
            )}
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
            <div 
              className={`${progressBarColor} h-3 rounded-full transition-all duration-1000 ease-linear`} 
              style={{ width: `${remainingPercent}%` }}
            ></div>
          </div>
          
          {remainingTime < 10 && (
            <div className="text-xs text-red-600 mt-2 animate-pulse">
              Запись будет остановлена автоматически!
            </div>
          )}
        </>
      )}
    </div>
  );
}
