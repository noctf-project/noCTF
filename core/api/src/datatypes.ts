import { Static, Type } from "@sinclair/typebox";

export const AuthMethod = Type.Object(
  {
    provider: Type.String(),
    name: Type.Optional(Type.String()),
    image_src: Type.Optional(Type.String()),
  }
);
export type AuthMethod = Static<typeof AuthMethod>;


export const AuthTokenType = Type.Enum(
  {
    Auth: "auth",
    Register: "register",
    Associate: "associate",
  }
);
export type AuthTokenType = Static<typeof AuthTokenType>;

