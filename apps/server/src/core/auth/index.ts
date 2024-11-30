import { Service } from "@noctf/services";
import { AuthListMethodsResponse } from "@noctf/api/ts/responses";
import { CONFIG_NAMESPACE, DEFAULT_CONFIG } from "./config";
import { PasswordProvider } from "./password_provider";
import oauth from "./oauth";

export default async function (fastify: Service) {
  fastify.register(oauth);
  const { identityService, configService, databaseService } =
    fastify.container.cradle;
  await configService.register(CONFIG_NAMESPACE, DEFAULT_CONFIG);
  const passwordProvider = new PasswordProvider(configService, databaseService);
  identityService.register(passwordProvider);

  fastify.get<{
    Reply: AuthListMethodsResponse;
  }>("/auth/methods", async () => {
    const methods = await identityService.listMethods();
    return { data: methods };
  });
}
