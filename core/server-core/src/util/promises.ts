export const CreateThenable = <T>(fn: () => Promise<T>): PromiseLike<T> => {
  let promise: Promise<T>;
  return {
    then<U, V>(
      onFulfilled?: (value: T) => U | PromiseLike<U>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onRejected?: (value: any) => V | PromiseLike<V>,
    ): Promise<U | V> {
      if (!promise) promise = fn();
      return promise.then(onFulfilled, onRejected);
    },
  };
};
