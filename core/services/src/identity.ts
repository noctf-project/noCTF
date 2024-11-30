import { AuthMethod } from "@noctf/api/ts/datatypes";
import { IdentityProvider } from "@noctf/server-api/identity";

export class IdentityService {
  private providers: Map<string, IdentityProvider> = new Map();

  constructor() {}

  register(provider: IdentityProvider) {
    if (this.providers.has(provider.id())) {
      throw new Error(`Provider ${provider.id()} has already been registered`);
    }
    this.providers.set(provider.id(), provider);
  }

  async listMethods(): Promise<AuthMethod[]> {
    const promises = Array.from(this.providers.values()).map((provider) =>
      provider.listMethods(),
    );
    return (await Promise.all(promises)).flatMap((v) => v);
  }
}
