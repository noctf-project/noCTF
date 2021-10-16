import { FastifyInstance } from 'fastify';
import {
  AuthPermissionsResponse, AuthPermissionsResponseType,
  ErrorResponse, ErrorResponseType,
} from '@noctf/schema/responses';
import services from '../../services';
import UserDAO from '../../models/User';
import RoleDAO from '../../models/Role';
import UserSessionDAO from '../../models/UserSession';

export default async function register(fastify: FastifyInstance) {
  fastify.get<{ Reply: AuthPermissionsResponseType }>(
    '/permissions',
    {
      config: {
        permission: 'auth.self.permission',
      },
      schema: {
        tags: ['auth'],
        response: {
          default: AuthPermissionsResponse,
        },
      },
      handler: async (request, reply) => {
        if (!request.auth) {
          reply.send({
            permissions: [
              await RoleDAO.getPermissionsByID((await RoleDAO.getIDByName('public'))!),
            ],
          });
          return;
        }
        reply.send({
          permissions: await UserDAO.getPermissions(request.auth?.uid),
        });
      },
    },
  );

  fastify.post<{ Reply: ErrorResponseType }>(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        response: {
          default: ErrorResponse,
        },
      },
      config: {
        permission: 'auth.self.session',
      },
      handler: async (request, reply) => {
        if (request.auth) {
          await Promise.all([
            services.authToken.revoke(request.auth.sid),
            UserSessionDAO.revoke(
              request.auth.uid,
              Buffer.from(request.auth.sid).toString('base64url'),
            ),
          ]);
        }
        reply.send({});
      },
    },
  );
}
