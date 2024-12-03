// raw types only, do not import any modules
export type Primitive = string | number | boolean | null | undefined;

export type Serializable =
  | Primitive
  | Serializable[]
  | {
      [key: string]: Serializable;
    };

export type SerializableMap = {
  [key: string]: Serializable;
};

export interface LogFn {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  <T extends object>(obj: T, msg?: string, ...args: any[]): void;
  (obj: unknown, msg?: string, ...args: any[]): void;
  (msg: string, ...args: any[]): void;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export interface Logger {
  info: LogFn;
  error: LogFn;
  warn: LogFn;
  debug: LogFn;
  fatal: LogFn;
  trace: LogFn;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  child: (bindings: { [k: string]: any }) => Logger;
}
