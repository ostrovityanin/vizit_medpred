export default function Instructions() {
  return (
    <div className="bg-neutral-100 rounded-xl p-4 text-sm text-neutral-700">
      <h3 className="font-semibold mb-2">Как это работает:</h3>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Нажмите "Старт" для начала записи</li>
        <li>Приложение записывает звук с микрофона</li>
        <li>Нажмите "Стоп" когда закончите</li>
        <li>Запись автоматически отправится в @ostrovityanin</li>
      </ol>
      <div className="mt-3 text-xs text-neutral-600">
        <p>Требуется доступ к микрофону. Аудио отправляется через Telegram бот.</p>
      </div>
    </div>
  );
}
