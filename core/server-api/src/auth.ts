import { AuthMethod } from "@noctf/api/ts/datatypes";

export interface AuthProvider {
  id(): string;
  listMethods(): Promise<AuthMethod[]>;
}