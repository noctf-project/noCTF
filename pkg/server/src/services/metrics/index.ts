import { FileHandle, open } from 'fs/promises';
import logger from '../../util/logger';
import { KeyValue } from '../../util/types';

/**
 * MetricsService uses the Prometheus exposition format and writes data to a file.
 */
export default class MetricsService {
  private file?: FileHandle;

  constructor(filename?: string) {
    if (!filename) return;
    logger.info(`saving metrics to ${filename}`);
    open(filename, 'a').then((f) => { this.file = f; });
  }

  /**
   * Record metrics to a file using the Prometheus exposition format. If the file doesn't exist
   * this function is a noop.
   * @param measurement
   * @param labels key value pairs
   * @param value value
   */
  public async record(measurement: string, labels: KeyValue<string>, value: (number | string)) {
    if (!this.file) return;
    const ctime = Date.now();
    const labelsString = Object.keys(labels)
      .map((t) => `${t}=${JSON.stringify(labels[t])}`).join(',');
    await this.file.write(`${measurement}{${labelsString}} ${value} ${ctime}\n`);
  }
}
