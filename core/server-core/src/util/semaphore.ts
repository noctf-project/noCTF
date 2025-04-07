export class Semaphore {
  private count = 0;
  private readonly waiting: Array<() => void> = [];
  private signals: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  /**
   * Releases a token
   */
  async release() {
    if (this.count === 0) {
      throw new Error("Invalid state, count cannot be less than 0");
    }
    if (this.waiting.length > 0) {
      const Resolve = this.waiting.shift();
      if (Resolve) {
        Resolve();
      }
    } else {
      this.count--;
      if (this.count === 0) {
        for (const Signal of this.signals) {
          Signal();
        }
        this.signals = [];
      }
    }
  }

  /**
   * Returns a promise that awaits when semaphore is empty
   * @returns Promise
   */
  async signal() {
    if (this.count === 0) {
      return;
    }
    return new Promise<void>((resolve) => {
      this.signals.push(resolve);
    });
  }

  /**
   * Acquires a token.
   * @returns Returns a promise that awaits whn there is a free slot
   */
  async acquire() {
    if (this.count < this.limit) {
      this.count++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }
}

/**
 * Run jobs in parallel with a limit. We do not guarantee order in the returned results.
 * @param limit job limit
 * @param supplier supplier
 * @param items items
 * @param voided whether to return void
 * @returns
 */
export async function RunInParallelWithLimit<I, O>(
  items: Iterable<I>,
  limit: number,
  supplier: (input: I, index: number) => Promise<O>,
): Promise<PromiseSettledResult<O>[]> {
  const sem = new Semaphore(limit);
  const outputs: PromiseSettledResult<O>[] = [];
  let count = 0;
  for (const item of items) {
    await sem.acquire();
    const i = count++;
    void supplier(item, i)
      .then((value) => (outputs[i] = { status: "fulfilled", value }))
      .catch((e) => (outputs[i] = { status: "rejected", reason: e }))
      .finally(() => sem.release());
  }
  await sem.signal();

  return outputs;
}
