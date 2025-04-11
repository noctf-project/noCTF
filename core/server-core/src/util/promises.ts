export const CreateThenable = <T>(fn: () => Promise<T>): PromiseLike<T> => {
  let promise: Promise<T>;
  return {
    then<U, V>(
      onFulfilled?: (value: T) => U | PromiseLike<U>,
      onRejected?: (value: any) => V | PromiseLike<V>,
    ): Promise<U | V> {
      if (!promise) promise = fn();
      return promise.then(onFulfilled, onRejected);
    },
  };
};
