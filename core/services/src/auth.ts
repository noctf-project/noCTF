import { AuthMethod } from "@noctf/api/ts/datatypes";
import { AuthProvider } from "@noctf/server-api/auth";

export class AuthService {
  private providers: Map<string, AuthProvider> = new Map();

  constructor() {
  }

  register(provider: AuthProvider) {
    if (this.providers.has(provider.id())) {
      throw new Error(`Provider ${provider.id()} has already been registered`);
    }
    this.providers.set(provider.id(), provider);
  }

  async listMethods(): Promise<AuthMethod[]> {
    const promises = Array.from(this.providers.values())
      .map((provider) => provider.listMethods());
    return (await Promise.all(promises))
      .flatMap((v) => v);
  }
}