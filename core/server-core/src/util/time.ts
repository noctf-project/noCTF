export const Delay = (timeoutMillis: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, timeoutMillis);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };

    signal?.addEventListener("abort", onAbort);
  });

export const IsTimeBetweenSeconds = (
  time: number | Date,
  start_s?: number,
  end_s?: number,
) => {
  const ctime =
    typeof time === "number" ? time : Math.floor(time.getTime() / 1000);
  if (typeof start_s === "number" && ctime < start_s) {
    return false;
  }
  if (typeof end_s === "number" && ctime > end_s) {
    return false;
  }
  return true;
};
