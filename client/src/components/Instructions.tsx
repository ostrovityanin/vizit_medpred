export default function Instructions() {
  return (
    <div className="bg-gray-900 rounded-xl p-5 text-sm text-gray-300 border border-gray-700 shadow-lg">
      <h3 className="font-semibold mb-3 text-white text-lg">ИНСТРУКЦИЯ:</h3>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Нажмите "СТАРТ" для начала визита</li>
        <li>Нажмите "СТОП" по окончании визита</li>
        <li>Запись автоматически остановится через 5 минут</li>
      </ol>
      <p className="mt-3 text-sm text-gray-400">Максимальная длительность записи - 5 минут</p>
    </div>
  );
}
