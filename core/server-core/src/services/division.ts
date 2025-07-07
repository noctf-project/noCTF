import { Division } from "@noctf/api/datatypes";
import { LocalCache } from "../util/local_cache.ts";
import { DivisionDAO } from "../dao/division.ts";
import { ServiceCradle } from "../index.ts";
import { AuditParams } from "../types/audit_log.ts";
import { EntityType } from "../types/enums.ts";
import { ForbiddenError, NotFoundError } from "../errors.ts";

type Props = Pick<ServiceCradle, "databaseClient" | "auditLogService">;

export class DivisionService {
  private readonly divisionCache = new LocalCache<number, Division | null>({
    max: 1000,
    ttl: 2000,
  });

  private readonly auditLogService;
  private readonly divisionDAO;

  constructor({ databaseClient, auditLogService }: Props) {
    this.auditLogService = auditLogService;
    this.divisionDAO = new DivisionDAO(databaseClient.get());
  }

  async list() {
    return this.divisionDAO.list();
  }

  async get(id: number, cached = true): Promise<Division | null> {
    if (cached)
      return this.divisionCache.load(
        id,
        async () => (await this.divisionDAO.get(id)) || null,
      );
    return (await this.divisionDAO.get(id)) || null;
  }

  async update(
    id: number,
    v: Parameters<DivisionDAO["update"]>[1],
    { actor, message }: AuditParams = {},
  ) {
    await this.divisionDAO.update(id, v);
    this.divisionCache.delete(id);
    await this.auditLogService.log({
      operation: "division.update",
      actor,
      data: message,
      entities: [`${EntityType.DIVISION}:${id}`],
    });
  }

  async create(
    v: Parameters<DivisionDAO["create"]>[0],
    { actor, message }: AuditParams = {},
  ) {
    const division = await this.divisionDAO.create(v);
    this.divisionCache.delete(division.id);
    await this.auditLogService.log({
      operation: "division.create",
      actor,
      data: message,
      entities: [`${EntityType.DIVISION}:${division.id}`],
    });
    return division;
  }

  async delete(id: number, { actor, message }: AuditParams = {}) {
    await this.divisionDAO.delete(id);
    await this.auditLogService.log({
      operation: "division.delete",
      actor,
      data: message,
      entities: [`${EntityType.DIVISION}:${id}`],
    });
  }

  async validateJoinable(id: number, password?: string) {
    const division = await this.divisionDAO.get(id);
    if (!division) {
      throw new NotFoundError("Division not found");
    }
    if (!division.is_joinable) {
      throw new ForbiddenError("Division is currently not joinable");
    }
    if (division.password && division.password !== password) {
      throw new ForbiddenError(
        password
          ? "Incorrect division password"
          : "Division requires a password",
      );
    }
  }
}
