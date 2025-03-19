export default function Instructions() {
  return (
    <div className="bg-neutral-100 rounded-xl p-4 text-sm text-neutral-700">
      <h3 className="font-semibold mb-2">Инструкция:</h3>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Нажмите "Старт" для начала визита</li>
        <li>Нажмите "Стоп" по окончании визита</li>
        <li>Запись автоматически остановится через 1 минуту</li>
      </ol>
      <p className="mt-2 text-xs text-neutral-500">Максимальная длительность записи - 1 минута</p>
    </div>
  );
}
