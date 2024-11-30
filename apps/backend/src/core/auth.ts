import { Service } from "../types";
import { ProviderInfo } from "@noctf/api/ts/datatypes";

export async function AuthPlugin(fastify: Service) {
  const { authService, databaseService } = fastify.container.cradle;

  const listOAuthProviders = async () => {
    return databaseService
      .selectFrom('core.oauth_provider')
      .where('is_enabled', '=', true)
      .select(['name', 'is_registration_enabled'])
      .execute();
  };

  fastify.get<{Reply: ProviderInfo[]}>('/auth/providers', async () => {
    return await listOAuthProviders()
      .then((providers) => providers.map(({ name, is_registration_enabled }) => ({
        type: 'oauth',
        name,
        is_registration_enabled
      })));
  });
  

  fastify.get<{
    Params: { provider: string }
  }>('/auth/oauth/:provider', (request) => {
    const { provider } = request.params;
    return provider;
  });
}