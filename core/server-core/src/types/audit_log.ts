import type { ActorType } from "./enums.ts";

export type AuditLogActor = {
  type: ActorType;
  id?: string | number;
};

export type AuditParams = {
  actor?: AuditLogActor;
  message?: string;
};
