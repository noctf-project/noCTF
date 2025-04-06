// raw types only, do not import any modules

export type StringOrSet = string | Set<string>;

export type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>;

export type AllNonNullable<T> = {
  [P in keyof T]: NonNullable<T[P] extends boolean | null ? boolean : T[P]>;
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
