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
