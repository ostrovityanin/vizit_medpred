export default function Instructions() {
  return (
    <div className="bg-gray-900 rounded-xl p-5 text-sm text-gray-300 border border-gray-700 shadow-lg">
      <h3 className="font-semibold mb-3 text-white text-lg">ИНСТРУКЦИЯ:</h3>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Нажмите "СТАРТ" для начала визита</li>
        <li>Нажмите "СТОП" по окончании визита</li>
      </ol>
      <p className="mt-3 text-sm text-gray-400">Окно приложения можно свернуть - таймер все равно будет работать</p>
      <p className="mt-2 text-sm text-gray-400">Максимальный лимит времени: 10 минут</p>
      <div className="mt-4 border-t border-gray-700 pt-3">
        <p className="text-xs text-gray-400 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Защита от потери данных: аудио сохраняется кусками по 1 минуте
        </p>
      </div>
    </div>
  );
}
