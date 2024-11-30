export type Primitive = string | number | boolean | null | undefined;
export type Serializable =
  | Primitive
  | Serializable[]
  | {
      [key: string]: Serializable;
    };
export type SerializableMap = {
  [key: string]: Serializable;
};

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
