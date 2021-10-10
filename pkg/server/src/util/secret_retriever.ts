import chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { SECRETS_DIR, SECRETS_WATCH } from '../config';
import logger from './logger';

type Options<T> = {
  cast?: (str: string) => Promise<T> | T,
  watch?: boolean,
  root?: string
};

// watch a flat directory for secrets
export default class SecretRetriever<T = string> {
  private values: { [name: string]: T } = {};

  private root: string;

  private log = logger.child({ filename: path.basename(__filename) });

  private cast: (str: string) => Promise<T> | T;

  public readonly loaded?: Promise<void>;

  constructor(private qualifier: string, {
    cast = (a: string) => a as unknown as T,
    root = SECRETS_DIR,
    watch = SECRETS_WATCH,
  }: Options<T>) {
    this.root = root;
    this.cast = cast;

    // read in secrets
    const full = path.join(root, qualifier);

    // load in initial
    this.loaded = new Promise<void>((resolve, reject) => {
      fs.readdir(full, (err, files) => {
        if (err) reject(err);
        resolve(Promise.all(
          files.map(async (name) => {
            this.values[name] = await this.readFromFilesystem(name);
          }),
        ) as Promise<unknown> as Promise<void>);
      });
    });

    // create watcher
    if (!watch) {
      return;
    }

    chokidar.watch('.', { cwd: full, ignoreInitial: true })
      .on('add', async (name) => {
        this.log.warn(`adding ${name}`);
        this.values[name] = await this.readFromFilesystem(name);
      })
      .on('change', async (name) => {
        this.log.warn(`reloading ${name}`);
        this.values[name] = await this.readFromFilesystem(name);
      })
      .on('unlink', async (name) => {
        this.log.info(`removing ${name}`);
        delete this.values[name];
      });
  }

  getValue = (name: string): T => this.values[name];

  getAll = (): { [name: string]: T } => ({ ...this.values });

  private async readFromFilesystem(name: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const full = path.join(this.root, this.qualifier, name);
      fs.readFile(full, (err, data) => {
        if (err) return reject(err);
        this.log.info(`reading ${full} from filesystem`);
        return resolve(this.cast(data.toString('utf-8')));
      });
    });
  }
}
