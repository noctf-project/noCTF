export interface BaseWorker {
  readonly name?: string;
  run(): Promise<void>;
  dispose(): void;
}
