import { TypeDate } from "@noctf/api/datatypes";
import { Static, Type } from "@sinclair/typebox";

export const RegisterTokenData = Type.Object({
  identity: Type.Array(
    Type.Object({
      provider: Type.String(),
      provider_id: Type.String(),
      secret_data: Type.Optional(Type.String()),
    }),
  ),
  flags: Type.Optional(Type.Array(Type.String())),
  roles: Type.Optional(Type.Array(Type.String())),
});
export type RegisterTokenData = Static<typeof RegisterTokenData>;

export const AssociateTokenData = Type.Composite([
  RegisterTokenData,
  Type.Object({
    user_id: Type.Integer(),
  }),
]);
export type AssociateTokenData = Static<typeof AssociateTokenData>;

export const ResetPasswordTokenData = Type.Object({
  user_id: Type.Integer(),
  created_at: TypeDate,
});
export type ResetPasswordTokenData = Static<typeof ResetPasswordTokenData>;
