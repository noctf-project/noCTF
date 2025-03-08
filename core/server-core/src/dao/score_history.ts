import { ScoreboardEntry } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";

export class ScoreHistoryDAO {
  constructor(private readonly db: DBType) {}

  add(entries: ScoreboardEntry[]) {}
}
