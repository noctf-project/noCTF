import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const AuthzServerClientConfig = Type.Object({
  client_id: Type.String(),
  client_secret: Type.String(),
  redirect_uris: Type.Array(Type.String()),
});
export type AuthzServerClientConfig = Static<typeof AuthzServerClientConfig>;

export const AuthzServerConfig = Type.Object(
  {
    clients: Type.Array(AuthzServerClientConfig, {
      title: "List of OAuth 2.0 client configurations",
    }),
  },
  { $id: "plugin.authz_server", additionalProperties: false },
);
export type AuthzServerConfig = Static<typeof AuthzServerConfig>;
