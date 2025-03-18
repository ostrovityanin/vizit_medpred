type TimerCallback = (seconds: number) => void;

export class Timer {
  private seconds: number = 0;
  private intervalId: number | null = null;
  private onUpdate: TimerCallback | null = null;

  constructor(onUpdate?: TimerCallback) {
    this.onUpdate = onUpdate || null;
  }

  start() {
    if (this.intervalId) return;
    
    this.seconds = 0;
    if (this.onUpdate) this.onUpdate(this.seconds);
    
    this.intervalId = window.setInterval(() => {
      this.seconds++;
      if (this.onUpdate) this.onUpdate(this.seconds);
    }, 1000);
  }

  stop(): number {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    return this.seconds;
  }

  reset() {
    this.stop();
    this.seconds = 0;
    if (this.onUpdate) this.onUpdate(this.seconds);
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  getTime(): number {
    return this.seconds;
  }

  formatTime(): string {
    const mins = Math.floor(this.seconds / 60).toString().padStart(2, '0');
    const secs = (this.seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }
}

export function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}
