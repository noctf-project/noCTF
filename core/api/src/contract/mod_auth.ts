import { RouteDef } from "../types.ts";
import { Type } from "@sinclair/typebox";
import {
  AssociateRequest,
  InitAuthOauthRequest,
  FinishAuthOauthRequest,
  OAuthAuthorizeInternalRequest,
  CreateOAuthTokenRequest,
  InitAuthEmailRequest,
  CreateResetAuthEmailRequest,
  ApplyResetAuthEmailRequest,
  FinishAuthEmailRequest,
  ChangeAuthEmailRequest,
  ChangeAuthPasswordRequest,
  RegisterAuthTokenRequest,
  RegisterAuthRequest,
} from "../requests.ts";
import {
  SuccessResponse,
  OAuthConfigurationResponse,
  InitAuthOauthResponse,
  BaseResponse,
  FinishAuthResponse,
  OAuthAuthorizeInternalResponse,
  CreateOAuthTokenResponse,
  RegisterAuthTokenResponse,
} from "../responses.ts";

export const AssociateIdentity = {
  method: "POST",
  url: "/auth/associate",
  schema: {
    tags: ["auth"],
    body: AssociateRequest,
    response: {
      200: SuccessResponse,
    },
  },
} as const satisfies RouteDef;

export const GetOAuthConfiguration = {
  method: "GET",
  url: "/.well-known/openid-configuration",
  schema: {
    response: {
      200: OAuthConfigurationResponse,
    },
  },
} as const satisfies RouteDef;

export const GetOAuthJWKS = {
  method: "GET",
  url: "/auth/oauth/jwks",
  schema: {
    response: {
      200: Type.Object({
        keys: Type.Array(Type.Any()),
      }),
    },
  },
} as const satisfies RouteDef;

export const InitOAuth = {
  method: "POST",
  url: "/auth/oauth/init",
  schema: {
    tags: ["auth"],
    body: InitAuthOauthRequest,
    response: {
      200: InitAuthOauthResponse,
      404: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const FinishOAuth = {
  method: "POST",
  url: "/auth/oauth/finish",
  schema: {
    tags: ["auth"],
    body: FinishAuthOauthRequest,
    response: {
      200: FinishAuthResponse,
    },
  },
} as const satisfies RouteDef;

export const OAuthAuthorize = {
  method: "GET",
  url: "/auth/oauth/authorize",
  schema: {
    tags: ["auth"],
  },
} as const satisfies RouteDef;

export const OAuthAuthorizeInternal = {
  method: "POST",
  url: "/auth/oauth/authorize_internal",
  schema: {
    tags: ["auth"],
    body: OAuthAuthorizeInternalRequest,
    response: {
      200: OAuthAuthorizeInternalResponse,
    },
  },
} as const satisfies RouteDef;

export const CreateOAuthToken = {
  method: "POST",
  url: "/auth/oauth/token",
  schema: {
    tags: ["auth"],
    body: CreateOAuthTokenRequest,
    response: {
      200: CreateOAuthTokenResponse,
      400: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const InitEmailAuth = {
  method: "POST",
  url: "/auth/email/init",
  schema: {
    tags: ["auth"],
    description:
      "Checks if an email exists, returning a message or registration token if not",
    body: InitAuthEmailRequest,
    response: {
      200: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const VerifyEmailAuth = {
  method: "POST",
  url: "/auth/email/verify",
  schema: {
    tags: ["auth"],
    description:
      "Checks if an email exists, returning a message or registration token if not",
    body: InitAuthEmailRequest,
    response: {
      201: FinishAuthResponse,
      default: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const CreateResetEmail = {
  method: "POST",
  url: "/auth/email/reset",
  schema: {
    tags: ["auth"],
    description: "Reset password",
    body: CreateResetAuthEmailRequest,
    response: {
      default: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const ApplyResetEmail = {
  method: "PUT",
  url: "/auth/email/reset",
  schema: {
    tags: ["auth"],
    description: "Reset password",
    body: ApplyResetAuthEmailRequest,
    response: {
      200: FinishAuthResponse,
    },
  },
} as const satisfies RouteDef;

export const FinishEmailAuth = {
  method: "POST",
  url: "/auth/email/finish",
  schema: {
    tags: ["auth"],
    description: "Log a user in using their email and password",
    body: FinishAuthEmailRequest,
    response: {
      200: FinishAuthResponse,
      default: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const ChangeEmail = {
  method: "POST",
  url: "/auth/email/change",
  schema: {
    tags: ["auth"],
    body: ChangeAuthEmailRequest,
    response: {
      200: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const ChangePassword = {
  method: "POST",
  url: "/auth/password/change",
  schema: {
    tags: ["auth"],
    body: ChangeAuthPasswordRequest,
    response: {
      200: FinishAuthResponse,
    },
  },
} as const satisfies RouteDef;

export const RegisterAuthToken = {
  method: "POST",
  url: "/auth/register/token",
  schema: {
    tags: ["auth"],
    body: RegisterAuthTokenRequest,
    response: {
      200: RegisterAuthTokenResponse,
      default: BaseResponse,
    },
  },
} as const satisfies RouteDef;

export const RegisterAuthFinish = {
  method: "POST",
  url: "/auth/register/finish",
  schema: {
    tags: ["auth"],
    body: RegisterAuthRequest,
    response: {
      200: FinishAuthResponse,
      default: BaseResponse,
    },
  },
} as const satisfies RouteDef;
