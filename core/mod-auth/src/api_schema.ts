import { TypeDate } from "@noctf/api/datatypes";
import { RegisterTokenData } from "@noctf/api/token";
import { Static, Type } from "@sinclair/typebox";

export const RegisterAuthTokenRequest = Type.Object(
  {
    token: Type.String(),
  },
  { additionalProperties: false },
);
export type RegisterAuthTokenRequest = Static<typeof RegisterAuthTokenRequest>;

export const RegisterAuthTokenResponse = Type.Object({
  data: Type.Omit(RegisterTokenData, ["type"]),
});
export type RegisterAuthTokenResponse = Static<
  typeof RegisterAuthTokenResponse
>;
