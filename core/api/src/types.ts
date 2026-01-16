import { TSchema } from "@sinclair/typebox";

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

export enum CaptchaHTTPMethod {
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

export interface RouteDef {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  schema: {
    tags?: string[];
    description?: string;
    body?: TSchema;
    querystring?: TSchema;
    params?: TSchema;
    headers?: TSchema;
    response: {
      [statusCode: number]: TSchema;
    };
  };
}
