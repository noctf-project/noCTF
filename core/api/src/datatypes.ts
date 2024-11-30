import { Type } from "@sinclair/typebox";

export const AuthMethod = Type.Object(
  {
    provider: Type.String(),
    name: Type.Optional(Type.String()),
    image_src: Type.Optional(Type.String()),
  },
  { $id: "AuthMethod" },
);

export default [AuthMethod];
