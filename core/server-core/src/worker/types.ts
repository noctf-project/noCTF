export interface BaseWorker {
  run(): Promise<void>;
  dispose(): void;
}
