import type { Primitive } from "@noctf/api/types";

export class Coleascer<T> {
  private readonly map = new Map<Primitive, Promise<T>>();

  get(key: Primitive, handler: () => Promise<T>): Promise<T> {
    let promise = this.map.get(key);
    if (!promise) {
      promise = handler().finally(() => this.map.delete(key));
      this.map.set(key, promise);
    }
    return promise as Promise<T>;
  }

  delete(key: Primitive) {
    this.map.delete(key);
  }
}
