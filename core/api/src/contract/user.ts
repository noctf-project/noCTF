import { QueryUsersRequest, UpdateUserRequest } from "../requests.ts";
import {
  BaseResponse,
  ListUserIdentitiesResponse,
  ListUsersResponse,
  MeUserResponse,
} from "../responses.ts";
import { RouteDef } from "../types.ts";

export const GetMe = {
  method: "GET",
  url: "/user/me",
  schema: {
    tags: ["user"],
    response: {
      200: MeUserResponse,
    },
  },
} as const satisfies RouteDef;

export const GetMeIdentities = {
  method: "GET",
  url: "/user/me/identities",
  schema: {
    tags: ["auth"],
    response: {
      200: ListUserIdentitiesResponse,
    },
  },
} as const satisfies RouteDef;

export const UpdateMe = {
  method: "PUT",
  url: "/user/me",
  schema: {
    tags: ["user"],
    body: UpdateUserRequest,
    response: {
      200: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const QueryUsers = {
  method: "POST",
  url: "/users/query",
  schema: {
    tags: ["user"],
    body: QueryUsersRequest,
    response: {
      200: ListUsersResponse,
    },
  },
} as const satisfies RouteDef;
