export const Delay = (timeoutMillis: number) =>
  new Promise((resolve) => setTimeout(resolve, timeoutMillis));
