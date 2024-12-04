import { Static, Type } from "@sinclair/typebox";

export const AuthMethod = Type.Object({
  provider: Type.String(),
  name: Type.Optional(Type.String()),
  image_src: Type.Optional(Type.String()),
});
export type AuthMethod = Static<typeof AuthMethod>;

export const AuditLogEntry = Type.Object({
  actor: Type.String(),
  operation: Type.String(),
  entity: Type.String(),
  data: Type.String(),
  created_at: Type.Number(),
});
export type AuditLogEntry = Static<typeof AuditLogEntry>;
