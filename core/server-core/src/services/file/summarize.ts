import { createHash } from "node:crypto";
import { PassThrough, Readable } from "node:stream";

async function getHash(rs: Readable): Promise<string> {
  const hasher = createHash("sha256");
  return new Promise((resolve, reject) => {
    rs.on("error", reject);
    rs.on("data", (c) => hasher.update(c));
    rs.on("end", () => resolve(`sha256:${hasher.digest().toString("hex")}`));
  });
}

async function getSize(rs: Readable): Promise<number> {
  let size = 0;
  return new Promise((resolve, reject) => {
    rs.on("error", reject);
    rs.on("data", (c) => (size += c.length));
    rs.on("end", () => resolve(size));
  });
}

export async function summarizeFile(
  stream: Readable,
): Promise<{ hash: string; size: number }> {
  const sHash = new PassThrough();
  const sSize = new PassThrough();
  stream.pipe(sHash);
  stream.pipe(sSize);
  const [hash, size] = await Promise.all([getHash(sHash), getSize(sSize)]);
  return { hash, size };
}
