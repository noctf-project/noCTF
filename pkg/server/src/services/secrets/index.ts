import path from 'path';
import fs from 'fs';
import { server } from '../../server';

export const QUALIFIER_TOKEN_SIGNATURE = 'token-signature';

export default class SecretsService {
  private cache: { [key: string]: [number, string] } = {};

  constructor(private root: string, private watch: boolean) {
  }

  getSecret(qualifier: string, key: string, newerThan = 0): Promise<[number, string] | null> {
    const fullPath = path.join(qualifier, key);
    return this.getForPath(fullPath, newerThan);
  }

  async getForPath(fullPath: string, newerThan = 0): Promise<[number, string] | null> {
    try {
      if (!this.cache[fullPath]) {
        this.cache[fullPath] = [Date.now(), await this.retrieveFromFilesystem(fullPath)];
        if (this.watch) {
          server.log.info(`creating watcher for secret ${fullPath}`);
          this.createWatcher(
            fullPath,
            async () => {
              this.cache[fullPath] = [Date.now(), await this.retrieveFromFilesystem(fullPath)];
            },
          );
        }
      }
      if (newerThan >= this.cache[fullPath][0]) return null;
      return this.cache[fullPath];
    } catch (e) {
      return null;
    }
  }

  private createWatcher(fullPath: string, fn: () => void): void {
    fs.watch(path.join(this.root, fullPath), (event) => {
      if (event === 'change') {
        server.log.info(`reloading secret ${fullPath}`);
        fn();
      }
    });
  }

  private async retrieveFromFilesystem(fullPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(path.join(this.root, fullPath), (err, data) => {
        if (err) return reject(err);
        return resolve(data.toString('utf-8'));
      });
    });
  }
}
