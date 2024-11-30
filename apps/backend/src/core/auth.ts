import { FastifyInstance } from "fastify";
import { Service } from "../types";

export async function AuthPlugin(fastify: Service) {
  const { authService } = fastify.container.cradle;
  fastify.get('/auth/providers', async () => {
    return await authService.getProviders();
  });
  

  fastify.get<{
    Params: { provider: string }
  }>('/auth/oauth/:provider', (request) => {
    const { provider } = request.params;
    return provider;
  });
}