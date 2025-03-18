export default function Instructions() {
  return (
    <div className="bg-neutral-100 rounded-xl p-4 text-sm text-neutral-700">
      <h3 className="font-semibold mb-2">How it works:</h3>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Press "Start Timer" to begin recording audio and timing</li>
        <li>The app will record audio from your microphone</li>
        <li>Press "Stop" when you're finished</li>
        <li>Review your recording and send it to @ostrovityanin</li>
      </ol>
      <div className="mt-3 text-xs text-neutral-600">
        <p>This app requires microphone permission. All data is sent securely via Telegram.</p>
      </div>
    </div>
  );
}
