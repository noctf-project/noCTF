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

export class MetricsClient {
  private readonly logger;
  private readonly pathName;
  private readonly fileNameFormat;
  private readonly flushInterval;
  private fileName: string;
  private buffers: Map<string, [number[], number[]]> = new Map();
  private file: WriteStream;
  private flushing = false;
  private lastFlush = performance.now();

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

  record(name: string, labels: Record<string, string> | [string, string][], value: number, timestamp?: number) {
    if (!this.pathName || !this.fileNameFormat) return;
    let key: string;
    if (Array.isArray(labels)) {
      key = JSON.stringify([name].concat(labels.filter((x) => x[1]).sort().flat()));
    } else {
      const v = Object.keys(labels).filter((x) => labels[x]).map((x) => [x, labels[x]]);
      key = JSON.stringify([name].concat(v.sort().flat()));
    }
    let buffer = this.buffers.get(key);
    if (!buffer) {
      buffer = [[], []];
      this.buffers.set(key, buffer);
    }
    buffer[0].push(value);
    buffer[1].push((timestamp || timestamp === 0) ? timestamp : Date.now());
    const now = performance.now();
    if (now > this.lastFlush + this.flushInterval) {
      void this.flush();
      this.lastFlush = now;
    }
  }

  private async flush() {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    const buffers = this.buffers;
    this.buffers = new Map();

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
      for (const [k, [values, timestamps]] of buffers) {
        const keys = JSON.parse(k);
        const metric: Record<string, string> = {
          '__name__': keys[0]
        };
        for (let i = 1; i < k.length; i += 2) {
          metric[keys[i]] = keys[i+1];
        }
        this.file.write(JSON.stringify({ metric, values, timestamps }) + '\n');
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