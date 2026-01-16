import { FileMetadata } from "@noctf/api/datatypes";
import { Readable } from "stream";
import {
  FileProvider,
  FileProviderInstance,
} from "./types.ts";

export class ManualFileProvider implements FileProvider<ManualFileProviderInstance> {
  name = "manual";

  getInstance() {
    return new ManualFileProviderInstance();
  }

  getSchema(): null {
    return null;
  }
}

export class ManualFileProviderInstance implements FileProviderInstance {
  constructor() {}

  async delete(ref: string): Promise<void> {}

  async getURL(ref: string): Promise<string> {
    return ref;
  }

  async download(): Promise<[Readable, Omit<FileMetadata, "url">]> {
    throw new Error("Method not implemented.");
  }
}
