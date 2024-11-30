import { AuthMethod } from "@noctf/api/ts/datatypes";

export interface IdentityProvider {
  id(): string;
  listMethods(): Promise<AuthMethod[]>;
}
