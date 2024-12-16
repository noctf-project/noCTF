import { Static, Type, UnsafeOptions } from "@sinclair/typebox";

export const TypeDate = (options: UnsafeOptions = {}) =>
  Type.Unsafe<Date>({
    ...options,
    type: "string",
    format: "datetime",
  });

export const AuthMethod = Type.Object({
  provider: Type.String(),
  name: Type.Optional(Type.String()),
  image_src: Type.Optional(Type.String()),
});
export type AuthMethod = Static<typeof AuthMethod>;

export const AuditLogEntry = Type.Object({
  actor: Type.String(),
  operation: Type.String(),
  entities: Type.Array(Type.String()),
  data: Type.String(),
  created_at: Type.Number(),
});
export type AuditLogEntry = Static<typeof AuditLogEntry>;

export const Team = Type.Object({
  id: Type.Number(),
  name: Type.String({ maxLength: 64 }),
  bio: Type.String({ maxLength: 256 }),
  join_code: Type.String({ maxLength: 256 }),
  flags: Type.Array(Type.String()),
  created_at: TypeDate(),
});
export type Team = Static<typeof Team>;
