import { File } from "@noctf/schema";
import { DBType } from "../clients/database.ts";
import { NotFoundError } from "../errors.ts";

export type DBFile = {
  id: number;
  filename: string;
  provider: string;
  hash: Buffer;
  size: number; // this will not exceed 2^53 bits or w/e
  ref: string;
  mime: string;
  created_at: Date;
};

export class FileDAO {
  constructor(private readonly db: DBType) {}

  async get(id: number): Promise<DBFile> {
    const result = await this.db
      .selectFrom("file")
      .select([
        "id",
        "created_at",
        "filename",
        "ref",
        "provider",
        "hash",
        "size",
        "mime",
      ])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!result) throw new NotFoundError("File not found");
    return {
      ...result,
      size: parseInt(result.size),
    };
  }

  async delete(id: number): Promise<void> {
    await this.db.deleteFrom("file").where("id", "=", id).executeTakeFirst();
  }

  async create(f: Omit<DBFile, "id" | "created_at">): Promise<DBFile> {
    const v: typeof f = {
      filename: f.filename,
      ref: f.ref,
      provider: f.provider,
      hash: f.hash,
      size: f.size,
      mime: f.mime,
    };
    const result = await this.db
      .insertInto("file")
      .values(v)
      .returning(["id", "created_at"])
      .executeTakeFirstOrThrow();
    return { ...v, id: result.id, created_at: result.created_at };
  }
}
