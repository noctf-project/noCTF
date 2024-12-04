import { AuthMethod } from "@noctf/api/datatypes";

export interface IdentityProvider {
  id(): string;
  listMethods(): Promise<AuthMethod[]>;
}

export type UpdateIdentityData = {
  user_id: number;
  provider: string;
  provider_id: string;
  secret_data?: string;
};
