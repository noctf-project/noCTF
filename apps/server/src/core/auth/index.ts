import { Service } from "@noctf/services";
import { AuthListMethodsResponse } from "@noctf/api/ts/responses";
import { CONFIG_NAMESPACE, DEFAULT_CONFIG } from "./config";
import { PasswordAuthProvider } from "./password_provider";
import oauth from "./oauth";

export default async function (fastify: Service) {
  fastify.register(oauth);
  const { authService, configService, databaseService } =
    fastify.container.cradle;
  await configService.register(CONFIG_NAMESPACE, DEFAULT_CONFIG);
  const passwordProvider = new PasswordAuthProvider(
    configService,
    databaseService,
  );
  authService.register(passwordProvider);

  fastify.get<{
    Reply: AuthListMethodsResponse;
  }>("/auth/methods", async () => {
    const methods = await authService.listMethods();
    return { data: methods };
  });
}
