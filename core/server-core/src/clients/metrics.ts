import { join } from "node:path";
import type { WriteStream } from "node:fs";
import { createWriteStream, mkdirSync } from "node:fs";
import type { Logger } from "../types/primitives.ts";
import { performance } from "node:perf_hooks";
import { Delay } from "../util/time.ts";

function strftime(format: string, date = new Date()) {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");

  const map: Record<string, string> = {
    "%Y": date.getFullYear().toString(),
    "%m": pad(date.getMonth() + 1),
    "%d": pad(date.getDate()),
    "%H": pad(date.getHours()),
    "%M": pad(date.getMinutes()),
    "%S": pad(date.getSeconds()),
    "%p": process.pid.toString(),
  };
  return format.replace(/%[YmdHMSp]/g, (match) => map[match] || match);
}

export type MetricLabels = Record<string, string> | [string, string][];
export type Metric = [string, number];

type PerformanceMetricsHistory = {
  ctime: number;
  eventLoopIdleTime: number;
};

const AGGREGATE_FLUSH_INTERVAL = 100;
const PERIODIC_METRICS_INTERVAL = 30000;

export class MetricsClient {
  private readonly logger;
  private readonly pathName;
  private readonly fileNameFormat;
  private readonly flushInterval;
  private fileName: string;
  private series: Map<string, Map<string, [number[], number[]]>> = new Map();
  private aggregateSeries: Map<string, Map<string, number>> = new Map();
  private file: WriteStream;

  private flushing = false;
  private lastFlushAggregate = performance.now();
  private lastFlushToFile = performance.now();

  private periodicMetricsRunning = false;
  private performanceMetricsHistory: PerformanceMetricsHistory | null;

  constructor(
    logger: Logger,
    pathName: string,
    fileNameFormat: string,
    flushInterval = 2000,
  ) {
    this.logger = logger;
    this.pathName = pathName;
    this.fileNameFormat = fileNameFormat;
    this.flushInterval = flushInterval;
    if (!this.pathName || !this.fileNameFormat) {
      if (this.logger)
        this.logger.warn("Metrics emission is not currently configured");
      return;
    }
    mkdirSync(pathName, { recursive: true });
  }

  record(values: Metric[], labels?: MetricLabels, timestamp?: number) {
    if ((!this.pathName && this.pathName !== "") || !this.fileNameFormat)
      return;
    const key = MetricsClient.toKey(labels);
    let series = this.series.get(key);
    if (!series) {
      series = new Map();
      this.series.set(key, series);
    }
    this.addMetrics(
      series,
      values,
      timestamp || timestamp === 0 ? timestamp : Date.now(),
    );
  }

  recordAggregate(values: Metric[], labels?: MetricLabels) {
    if (!this.pathName || !this.fileNameFormat) return;
    // Flush first since we don't want new data to be part of old block
    const now = performance.now();
    if (now > this.lastFlushAggregate + AGGREGATE_FLUSH_INTERVAL) {
      this.flushAggregate(now);
      this.lastFlushAggregate = now;
    }
    const key = MetricsClient.toKey(labels);
    let series = this.aggregateSeries.get(key);
    if (!series) {
      series = new Map();
      this.aggregateSeries.set(key, series);
    }
    this.addMetricsAggregate(series, values);
  }

  /**
   * This function doesn't return normally
   */
  async init() {
    if ((!this.pathName && this.pathName !== "") || !this.fileNameFormat)
      return;
    this.periodicMetricsRunning = true;
    this.performanceMetricsHistory = null;
    while (this.periodicMetricsRunning) {
      this.recordPerformanceMetrics();
      await Delay(PERIODIC_METRICS_INTERVAL);
    }
  }

  async stopPeriodicMetrics() {
    this.periodicMetricsRunning = false;
  }

  private recordPerformanceMetrics() {
    const ctime = performance.now();
    const { idleTime } = performance.nodeTiming;
    if (!this.performanceMetricsHistory) {
      this.performanceMetricsHistory = { eventLoopIdleTime: idleTime, ctime };
      return;
    }
    const { heapUsed } = process.memoryUsage();
    const metrics: Metric[] = [];
    metrics.push(
      [
        "EventLoopIdlePercent",
        (idleTime - this.performanceMetricsHistory.eventLoopIdleTime) /
          (ctime - this.performanceMetricsHistory.ctime),
      ],
      ["HeapUsed", heapUsed],
    );
    this.record(metrics, {
      performance: "nodejs",
    });
    this.performanceMetricsHistory = { eventLoopIdleTime: idleTime, ctime };
  }

  private addMetricsAggregate(series: Map<string, number>, values: Metric[]) {
    for (const [metric, value] of values) {
      series.set(metric, (series.get(metric) || 0) + value);
    }
  }

  private addMetrics(
    series: Map<string, [number[], number[]]>,
    values: Metric[] | MapIterator<Metric>,
    timestamp: number,
  ) {
    for (const [metric, value] of values) {
      let buffer = series.get(metric);
      if (!buffer) {
        buffer = [[], []];
        series.set(metric, buffer);
      }
      buffer[0].push(value);
      buffer[1].push(timestamp);
    }
    const now = performance.now();
    if (now > this.lastFlushToFile + this.flushInterval) {
      void this.flushToFile();
      this.lastFlushToFile = now;
    }
  }

  private static toKey(labels?: MetricLabels) {
    if (!labels) return "[]";
    const parts = Array.isArray(labels)
      ? labels.filter((x) => x[1])
      : Object.keys(labels)
          .filter((x) => labels[x])
          .map((x) => [x, labels[x]]);
    return JSON.stringify(parts.sort().flat());
  }

  private flushAggregate(now: number) {
    const timestamp = Math.floor(Date.now() - now + this.lastFlushAggregate);
    const flushSeries = this.aggregateSeries;
    this.aggregateSeries = new Map();
    for (const [key, metrics] of flushSeries) {
      let series = this.series.get(key);
      if (!series) {
        series = new Map();
        this.series.set(key, series);
      }
      this.addMetrics(series, metrics.entries(), timestamp);
    }
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
        this.file = createWriteStream(join(this.pathName, fileName), {
          flags: "a+",
        });
      } else if (this.fileName !== fileName) {
        this.fileName = fileName;
        await this.file.close();
        this.file = createWriteStream(join(this.pathName, fileName));
      }
      for (const [k, series] of flushSeries) {
        const keys = JSON.parse(k);
        const labels: Record<string, string> = {};
        for (let i = 0; i < keys.length; i += 2) {
          labels[keys[i]] = keys[i + 1];
        }
        for (const [metric, [values, timestamps]] of series) {
          this.file.write(
            JSON.stringify({
              metric: {
                __name__: metric,
                ...labels,
              },
              values,
              timestamps,
            }) + "\n",
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        err,
        "Error flushing metrics, some of them may have been lost.",
      );
    } finally {
      this.flushing = false;
    }
  }
}
