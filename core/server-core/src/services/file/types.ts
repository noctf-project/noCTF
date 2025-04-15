import type { Readable } from "node:stream";
import { TSchema } from "@sinclair/typebox";

export type ProviderFileMetadata = {
  filename: string;
  mime: string;
  size: number;
};

export interface FileProvider<T extends FileProviderInstance> {
  name: string;
  getInstance(config: any): T | Promise<T>;
  getSchema(): TSchema | null;
}

export interface FileProviderInstance {
  upload(rs: Readable, pm: Omit<ProviderFileMetadata, "size">): Promise<string>;
  delete(ref: string): Promise<void>;
  getURL(ref: string): Promise<string>;
  download(
    ref: string,
    start?: number,
    end?: number,
  ): Promise<[Readable, ProviderFileMetadata]>;
}
