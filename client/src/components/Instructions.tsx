export default function Instructions() {
  return (
    <div className="bg-neutral-100 rounded-xl p-4 text-sm text-neutral-700">
      <h3 className="font-semibold mb-2">Инструкция:</h3>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Нажмите "Старт" для начала визита</li>
        <li>Нажмите "Стоп" по окончании визита</li>
      </ol>
      
      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-1">Важно!</h4>
        <p className="text-xs text-blue-700">
          Для получения сообщений от бота, получатель должен 
          найти бот "@MedPredRuBot" и отправить ему команду /start
        </p>
      </div>
      
      <div className="mt-3 text-xs text-neutral-600">
        <p>Требуется доступ к микрофону.</p>
      </div>
    </div>
  );
}
