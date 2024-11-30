export type Primitive = string | number | boolean | null | undefined;
export type Serializable =
  | Primitive
  | Serializable[]
  | {
      [key: string]: Serializable;
    };

export type UpdateIdentityData = {
  user_id: number;
  provider: string;
  provider_id: string;
  secret_data?: string;
};
