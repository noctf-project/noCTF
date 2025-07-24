import { SetupConfig } from "@noctf/api/config";
import { IdParams } from "@noctf/api/params";
import { SessionQuery } from "@noctf/api/query";
import {
  AdminQueryUsersRequest,
  AdminRevokeSessionsRequest,
  AdminUpdateUserRequest,
} from "@noctf/api/requests";
import {
  AdminListUsersResponse,
  AdminResetPasswordResponse,
  BaseResponse,
  ListSessionsResponse,
} from "@noctf/api/responses";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@noctf/server-core/errors";
import { ActorType, EntityType } from "@noctf/server-core/types/enums";
import { OffsetPaginate } from "@noctf/server-core/util/paginator";
import { Policy } from "@noctf/server-core/util/policy";
import { FastifyInstance } from "fastify";

export const PAGE_SIZE = 60;

const PRIVILEGED_POLICY: Policy = ["admin.policy.manage"];

export async function routes(fastify: FastifyInstance) {
  const {
    userService,
    policyService,
    identityService,
    configService,
    tokenService,
    auditLogService,
  } = fastify.container.cradle;

  fastify.post<{ Reply: AdminListUsersResponse; Body: AdminQueryUsersRequest }>(
    "/admin/users/query",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.user.get"],
        },
        body: AdminQueryUsersRequest,
        response: {
          200: AdminListUsersResponse,
        },
      },
    },
    async (request) => {
      const canViewIdentity = await policyService.evaluate(request.user.id, [
        "admin.identity.get",
      ]);

      const { page, page_size, ...query } = request.body;
      const [{ entries, page_size: actual_page_size }, total] =
        await Promise.all([
          OffsetPaginate(query, { page, page_size }, (q, l) =>
            userService.listSummary(q, l),
          ),
          query.ids && query.ids.length ? 0 : userService.getCount(query),
        ]);
      const identities = await identityService.listProvidersForUser(
        entries.map((x) => x.id),
      );
      const idMap = new Map<
        number,
        AdminListUsersResponse["data"]["entries"][number]["identities"]
      >();
      for (const id of identities) {
        let matched = idMap.get(id.user_id);
        if (!matched) {
          matched = [];
          idMap.set(id.user_id, matched);
        }
        matched.push(canViewIdentity ? id : { ...id, provider_id: "<hidden>" });
      }

      return {
        data: {
          entries: entries.map((e) => ({
            ...e,
            identities: idMap.get(e.id) || [],
          })),
          page_size: actual_page_size,
          total: total || entries.length,
        },
      };
    },
  );

  fastify.put<{
    Body: AdminUpdateUserRequest;
    Params: IdParams;
    Reply: BaseResponse;
  }>(
    "/admin/users/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.user.update"],
        },
        body: AdminUpdateUserRequest,
        params: IdParams,
        response: {
          200: BaseResponse,
        },
      },
    },
    async (request) => {
      const ex = await userService.get(request.params.id);
      if (!ex) throw new NotFoundError("User not found");
      const { name, bio, country, flags, roles } = request.body;

      const sFlags = new Set(flags);
      const sRoles = new Set(roles);

      const changed = [
        name !== ex.name && "name",
        bio !== ex.bio && "bio",
        country !== undefined && country !== ex.country && "country",
        sRoles.symmetricDifference(new Set(ex.roles)).size > 0 && "roles",
        sFlags.symmetricDifference(new Set(ex.flags)).size > 0 && "flags",
      ].filter((x) => x);

      if (changed.length === 0) return {};
      if (changed.includes("roles")) {
        const allowed = await policyService.evaluate(
          request.user.id,
          PRIVILEGED_POLICY,
        );
        if (!allowed) throw new ForbiddenError("Not allowed to update roles");
      }

      if (changed.includes("name")) {
        const id = await userService.getIdForName(name);
        if (id && id !== request.user.id)
          throw new ConflictError("A user already exists with this name");
      }

      await userService.update(
        request.params.id,
        {
          name,
          bio,
          country,
          flags: [...sFlags],
          roles: [...sRoles],
        },
        {
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          message: `Properties ${changed.join(", ")} were updated by admin`,
        },
      );
      return {};
    },
  );

  fastify.delete<{
    Reply: BaseResponse;
    Params: IdParams;
  }>(
    "/admin/users/:id",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        response: {
          200: BaseResponse,
        },
        params: IdParams,
        auth: {
          require: true,
          policy: ["admin.user.delete"],
        },
      },
    },
    async (request) => {
      if (request.user.id === request.params.id)
        throw new BadRequestError("You cannot delete yourself");
      const [me, test] = await Promise.all([
        policyService.evaluate(request.user.id, PRIVILEGED_POLICY),
        policyService.evaluate(request.params.id, PRIVILEGED_POLICY),
      ]);
      if (test && !me)
        throw new ForbiddenError(
          "Not allowed to delete a user with higher privilege",
        );
      await userService.delete(request.params.id, {
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        message: "User deleted by admin",
      });
      return {};
    },
  );

  fastify.get<{
    Querystring: SessionQuery;
    Params: IdParams;
    Reply: ListSessionsResponse;
  }>(
    "/admin/users/:id/sessions",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.session.get"],
        },
        params: IdParams,
        querystring: SessionQuery,
        response: {
          200: ListSessionsResponse,
        },
      },
    },
    async (request) => {
      const page = request.query.page || 1;
      const page_size = request.query.page_size ?? PAGE_SIZE;
      const [entries, total] = await Promise.all([
        identityService.listSessionsForUser(
          request.params.id,
          request.query.active,
          {
            limit: page_size,
            offset: (page - 1) * page_size,
          },
        ),
        identityService.countSessionsForUser(
          request.params.id,
          request.query.active,
        ),
      ]);
      return {
        data: {
          page_size,
          total,
          entries,
        },
      };
    },
  );

  fastify.post<{
    Params: IdParams;
    Body: AdminRevokeSessionsRequest;
    Reply: BaseResponse;
  }>(
    "/admin/users/:id/sessions/revoke",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.session.revoke"],
        },
        params: IdParams,
        body: AdminRevokeSessionsRequest,
        response: {
          200: BaseResponse,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { app_id } = request.body;
      const [me, test] = await Promise.all([
        policyService.evaluate(request.user.id, PRIVILEGED_POLICY),
        policyService.evaluate(request.params.id, PRIVILEGED_POLICY),
      ]);
      if (test && !me)
        throw new ForbiddenError(
          "Not allowed to revoke sessions for a user with higher privilege",
        );
      await Promise.all([
        identityService.revokeUserSessions(
          request.params.id,
          request.body.app_id,
        ),
        auditLogService.log({
          operation: "session.revoke",
          actor: {
            type: ActorType.USER,
            id: request.user.id,
          },
          data: `Admin revoked all user sessions for ${app_id ? "app " + app_id : "website"}`,
        }),
      ]);
      return {};
    },
  );

  fastify.post<{
    Params: IdParams;
    Reply: AdminResetPasswordResponse;
  }>(
    "/admin/users/:id/reset_password",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["AND", "admin.user.update", "admin.identity.update"],
        },
        params: IdParams,
        response: {
          200: AdminResetPasswordResponse,
        },
      },
    },
    async (request) => {
      if (request.user.id === request.params.id) {
        throw new ForbiddenError(
          "You may not reset your own password using the Admin API",
        );
      }
      const [me, test] = await Promise.all([
        policyService.evaluate(request.user.id, PRIVILEGED_POLICY),
        policyService.evaluate(request.params.id, PRIVILEGED_POLICY),
      ]);
      if (test && !me)
        throw new ForbiddenError(
          "Not allowed to reset password for a user with higher privilege",
        );
      const user = await userService.get(request.params.id);
      if (!user) {
        throw new NotFoundError("User does not exist");
      }
      const config = await configService.get(SetupConfig);
      const token = await tokenService.create("reset_password", {
        user_id: request.params.id,
        created_at: new Date(),
      });
      await auditLogService.log({
        operation: "user.reset_password.init",
        actor: {
          type: ActorType.USER,
          id: request.user.id,
        },
        data: "Admin generated reset password link",
        entities: [`${EntityType.USER}:${request.params.id}`],
      });
      return {
        data: `${config.value.root_url}/auth/reset?token=${token}`.replace(
          /([^:])(\/\/+)/g,
          "$1/",
        ),
      };
    },
  );
}
