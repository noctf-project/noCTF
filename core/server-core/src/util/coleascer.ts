import type { Primitive } from "@noctf/api/types";

export class Coleascer<T> {
  private readonly map = new Map<Primitive, Promise<T>>();

  get(key: Primitive): Promise<T> | null;
  get(key: Primitive, handler: () => Promise<T>): Promise<T>;
  get(key: Primitive, handler?: () => Promise<T>): Promise<T> | null {
    let promise = this.map.get(key);
    if (!promise) {
      if (!handler) return null;
      promise = handler().finally(() => this.map.delete(key));
      promise.catch(() => {});
      this.map.set(key, promise);
    }
    return promise as Promise<T>;
  }

  put(key: Primitive, promise: Promise<T>) {
    if (this.map.has(key)) throw new Error("Promise already exists for key");
    promise.catch(() => {});
    this.map.set(
      key,
      promise.finally(() => this.map.delete(key)),
    );
  }

  delete(key: Primitive) {
    this.map.delete(key);
  }
}
