import { join } from "node:path";
import { createWriteStream, mkdirSync, WriteStream } from "node:fs";
import { Logger } from "../types/primitives.ts";

function strftime(format: string, date = new Date()) {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  
  const map: Record<string, string> = {
    '%Y': date.getFullYear().toString(),      
    '%m': pad(date.getMonth() + 1),
    '%d': pad(date.getDate()),     
    '%H': pad(date.getHours()),    
    '%M': pad(date.getMinutes()),  
    '%S': pad(date.getSeconds()),
    '%p': process.pid.toString() 
  };
  return format.replace(/%[YmdHMSp]/g, match => map[match] || match);
};

export type MetricLabels = Record<string, string> | [string, string][];
export type Metric = [string, number];

export class MetricsClient {
  private readonly logger;
  private readonly pathName;
  private readonly fileNameFormat;
  private readonly flushInterval;
  private fileName: string;
  private series: Map<string, Map<string, [number[], number[]]>> = new Map();
  private file: WriteStream;
  private flushing = false;
  private lastFlushToFile = performance.now();

  constructor(logger: Logger, pathName: string, fileNameFormat: string, flushInterval=2000) {
    this.logger = logger;
    this.pathName = pathName;
    this.fileNameFormat = fileNameFormat;
    this.flushInterval = flushInterval;
    if (!this.pathName || !this.fileNameFormat) {
      if (this.logger) this.logger.warn("Metrics emission is not currently configured");
      return;
    }
    mkdirSync(pathName, { recursive: true });
  }

  record(values: Metric[], labels?: MetricLabels, timestamp?: number) {
    if (!this.pathName || !this.fileNameFormat) return;
    const key = MetricsClient.toKey(labels);
    this.addMetrics(key, values, timestamp);

    const now = performance.now();
    if (now > this.lastFlushToFile + this.flushInterval) {
      void this.flushToFile();
      this.lastFlushToFile = now;
    }
  }

  private addMetrics(key: string, values: Metric[], timestamp?: number) {
    let series = this.series.get(key);
    if (!series) {
      series = new Map();
      this.series.set(key, series);
    }
    for (const [metric, value] of values) {
      let buffer = series.get(metric);
      if (!buffer) {
        buffer = [[], []];
        series.set(metric, buffer);
      }
      buffer[0].push(value);
      buffer[1].push((timestamp || timestamp === 0) ? timestamp : Date.now());
    }
  }

  private static toKey(labels?: MetricLabels) {
    if (!labels) return '[]';
    const parts = Array.isArray(labels)
      ? labels.filter((x) => x[1])
      : Object.keys(labels).filter((x) => labels[x]);
    return JSON.stringify(parts.sort().flat());
  }

  private async flushToFile() {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    const flushSeries = this.series;
    this.series = new Map();

    try {
      const fileName = strftime(this.fileNameFormat);
      if (!this.fileName) {
        this.fileName = fileName;
        this.file = createWriteStream(join(this.pathName, fileName), { flags: 'a+' });
      } else if (this.fileName !== fileName) {
        this.fileName = fileName;
        await this.file.close();
        this.file = createWriteStream(join(this.pathName, fileName));
      }
      for (const [k, series] of flushSeries) {
        const keys = JSON.parse(k);
        const labels: Record<string, string> = {};
        for (let i = 0; i < keys.length; i += 2) {
          labels[keys[i]] = keys[i+1];
        }
        for (const [metric, [values, timestamps]] of series) {
          this.file.write(JSON.stringify({
            metric:{
              __name__: metric,
              ...labels
            },
            values,
            timestamps
          }) + '\n');
        }
      }
    } catch (e) {
      this.logger.warn(
        { stack: e.stack },
        "Error flushing metrics, some of them may have been lost."
      );
    } finally {
      this.flushing = false;
    }
  }
}