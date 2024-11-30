import { AuthMethod } from "@noctf/api/ts/datatypes";

export interface IdentityProvider {
  id(): string;
  listMethods(): Promise<AuthMethod[]>;
}

export type AuthSuccessResult = {
  user_id: number;
};

export type AuthRegisterResult = [
  {
    provider: string;
    provider_id: string;
  },
];

export type AuthResult = AuthSuccessResult | AuthRegisterResult;
