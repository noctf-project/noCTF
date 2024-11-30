import { AuthProvider } from "../../../../core/server-api/dist/auth";
import { Service } from "../types";
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

export async function AuthPlugin(fastify: Service) {
  const { authService, databaseService } = fastify.container.cradle;
  
  const emailProvider = new EmailAuthProvider(databaseService);
  authService.register(emailProvider);

  fastify.get<{
    Reply: AuthListMethodsResponse
  }>('/auth/methods', async () => {
    const methods = await authService.listMethods();
    return { data: methods };
  });
}