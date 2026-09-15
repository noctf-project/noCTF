type Waiter = {
  resolve: (acquired: boolean) => void;
  signal: AbortSignal;
  onAbort: () => void;
};

/** A mutex whose queued acquisitions can be cancelled without consuming a slot. */
export class AbortableMutex {
  private locked = false;
  private readonly waiters: Waiter[] = [];
  private readonly idleWaiters: Array<() => void> = [];

  async acquire(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return false;
    if (!this.locked) {
      this.locked = true;
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const waiter: Waiter = {
        resolve,
        signal,
        onAbort: () => {
          const index = this.waiters.indexOf(waiter);
          if (index !== -1) this.waiters.splice(index, 1);
          resolve(false);
        },
      };
      this.waiters.push(waiter);
      signal.addEventListener("abort", waiter.onAbort, { once: true });
    });
  }

  release(): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.signal.removeEventListener("abort", waiter.onAbort);
      waiter.resolve(true);
      return;
    }

    this.locked = false;
    this.idleWaiters.splice(0).forEach((resolve) => resolve());
  }

  async idle(): Promise<void> {
    if (!this.locked) return;
    return new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }
}
