import { Static, Type } from '@sinclair/typebox';
import { AuthAuthorizeResponseTypeEnum } from './datatypes';

export const AuthAuthorizeQuery = Type.Object({
  response_type: Type.Enum(AuthAuthorizeResponseTypeEnum),
  client_id: Type.String({
    pattern: '[a-zA-Z0-9_-]+',
    minLength: 4,
    maxLength: 48,
  }),
  redirect_uri: Type.String({ format: 'uri' }),
  scope: Type.String({
    pattern: '[a-z0-9-_]+',
  }),
  state: Type.String(),
});
export type AuthAuthorizeQueryType = Static<typeof AuthAuthorizeQuery>;
