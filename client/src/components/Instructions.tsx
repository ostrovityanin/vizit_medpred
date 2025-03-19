export default function Instructions() {
  return (
    <div className="bg-gray-900 rounded-xl p-5 text-sm text-gray-300 border border-gray-700 shadow-lg">
      <h3 className="font-semibold mb-3 text-white text-lg">ИНСТРУКЦИЯ:</h3>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Нажмите "СТАРТ" для начала визита</li>
        <li>Нажмите "СТОП" по окончании визита</li>
      </ol>
      <p className="mt-3 text-sm text-gray-400">Окно приложения можно свернуть - таймер все равно будет работать</p>
    </div>
  );
}
