import { AuthProvider } from "@noctf/server-api/auth";
import { Service } from "@noctf/services";
import { AuthListMethodsResponse } from "@noctf/api/ts/responses";
import { AuthMethod } from "@noctf/api/ts/datatypes";
import { DatabaseService } from "@noctf/services/database";

export class EmailAuthProvider implements AuthProvider {
  constructor(private databaseService: DatabaseService) {
  }

  id(): string {
    return 'email';
  }

  async listMethods(): Promise<AuthMethod[]> {
    return [
      {
        provider: 'email'
      }
    ];
  }
}

export default async function(fastify: Service) {
  const { authService, databaseService, configService } = fastify.container.cradle;

  await configService.register("core.auth", {
    enablePassword: true,
    enableOauth: true,
    validateEmail: false
  });
  
  const emailProvider = new EmailAuthProvider(databaseService);
  authService.register(emailProvider);

  fastify.get<{
    Reply: AuthListMethodsResponse
  }>('/auth/methods', async () => {
    const methods = await authService.listMethods();
    return { data: methods };
  });
}