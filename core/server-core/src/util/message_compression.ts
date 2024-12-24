import * as zlib from 'node:zlib';
import { Readable, Writable } from 'node:stream';


type SetupFn = (i: Readable, o: Writable) => void;
type Method = {
  encode: SetupFn;
  decode: SetupFn;
}

/**
 * Compression methods. Always add new methods at the end. Existing methods can
 * be changed as long as they are backwards compatible (i.e. same decompressor)
 * 
 * 0: none
 * 1: brotli
 */
const COMPRESSION_THRESHOLD_BYTES = 256;
const METHODS: Method[] = [
  {
    encode: (i, o) => { i.pipe(o) },
    decode: (i, o) => { i.pipe(o) }
  },
  {
    encode: (i, o) => {
      const c = zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MIN_QUALITY
        }
      });
      i.pipe(c).pipe(o);
    },
    decode: (i, o) => {
      const c = zlib.createBrotliDecompress();
      i.pipe(c).pipe(o);
    },
  }
];

const DEFAULT_METHOD = 1;

const DoStream = (chunks: Uint8Array[], i: Uint8Array, setup: SetupFn): Promise<Uint8Array> => {
  const w = new Writable({
    write(chunk: Buffer, _encoding, cb) {
      try {
        chunks.push(chunk);
        cb();
      } catch (e) {
        cb(e);
      }
    }
  });
  return new Promise((resolve, reject) => {
    try {
      setup(Readable.from(Buffer.from(i.buffer, i.byteOffset, i.byteLength)), w);
      w.on('error', (e) => reject(e));
      w.on('finish', () => resolve(Buffer.concat(chunks)));
    } catch (e) {
      return reject(e);
    }
  });
};

export const Compress = (arr: Uint8Array, id=DEFAULT_METHOD): Promise<Uint8Array> => {
  let m = id;
  if (arr.length < COMPRESSION_THRESHOLD_BYTES) {
    m = 0;
  }
  const method = METHODS[m];
  if (!method) {
    throw new Error(`Compression method ${m} does not exist`);
  }
  return DoStream([Uint8Array.from([m])], arr, method.encode);
};

export const Decompress = (arr: Uint8Array): Promise<Uint8Array> => {
  const id = arr[0];
  const method = METHODS[id];
  if (!method) {
    throw new Error(`Compression method does not exist`);
  }

  return DoStream([], arr.slice(1), method.decode);
};