export class Stopwatch {
  private total = 0;
  private start: number | null = null;

  constructor(started = true) {
    this.start = started ? performance.now() : null;
  }

  elapsed() {
    return (
      (this.start !== null ? performance.now() - this.start : 0) + this.total
    );
  }

  pause() {
    this.total += this.start !== null ? performance.now() - this.start : 0;
    this.start = null;
  }

  isPaused() {
    return !this.start;
  }

  resume() {
    this.start = performance.now();
  }
}
