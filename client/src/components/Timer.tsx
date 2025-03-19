import { formatSeconds } from '@/lib/timer';

interface TimerProps {
  time: number;
  isRecording: boolean;
}

export default function Timer({ time, isRecording }: TimerProps) {
  return (
    <div className="bg-gray-900 rounded-2xl shadow-lg p-8 mb-6 text-center border border-gray-800">
      <div className="text-5xl font-medium tabular-nums mb-4 text-gray-400">
        {formatSeconds(time)}
      </div>
      
      {isRecording && (
        <div className="flex items-center justify-center text-red-500 font-medium gap-2 mt-2">
          <span className="flex items-center">
            <span className="relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <span className="text-white text-lg">ЗАПИСЬ</span>
          </span>
        </div>
      )}
    </div>
  );
}
