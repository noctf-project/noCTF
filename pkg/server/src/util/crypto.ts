import { randomBytes } from 'crypto';

export const asyncRandomBytes = (n: number): Promise<Buffer> => new Promise((resolve, reject) => {
  randomBytes(n, (err, data) => {
    if (err) return reject(err);
    return resolve(data);
  });
});
