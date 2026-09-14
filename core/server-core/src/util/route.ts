import { RouteDef } from "@noctf/api/types";
import { Static, TSchema } from "@sinclair/typebox";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { RequestConfig, UserRequestPayload } from "../types/fastify.ts";

export type RouteSchema<T extends RouteDef> = {
  Body: T["schema"]["body"] extends TSchema
    ? Static<T["schema"]["body"]>
    : never;
  Querystring: T["schema"]["querystring"] extends TSchema
    ? Static<T["schema"]["querystring"]>
    : never;
  Params: T["schema"]["params"] extends TSchema
    ? Static<T["schema"]["params"]>
    : never;
  Reply: T["schema"]["response"] extends TSchema
    ? {
        [K in keyof T["schema"]["response"] & number as `${K}`]: Static<
          T["schema"]["response"][K]
        >;
      }[`${keyof T["schema"]["response"] & number}`]
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any;
};

export type AuthenticatedRequest<SchemaDef extends RouteSchema<RouteDef>> =
  FastifyRequest<SchemaDef> & {
    user: UserRequestPayload;
  };

export type RequestForConfig<
  SchemaDef extends RouteSchema<RouteDef>,
  Config extends RequestConfig<SchemaDef>,
> = Config extends { auth: { require: true } }
  ? AuthenticatedRequest<SchemaDef>
  : FastifyRequest<SchemaDef>;

export type RouteHandler<
  SchemaDef extends RouteSchema<RouteDef>,
  Config extends RequestConfig<SchemaDef>,
> = (
  this: FastifyInstance,
  request: RequestForConfig<SchemaDef, Config>,
  reply: FastifyReply<SchemaDef>,
) => Promise<unknown> | unknown;

export function route<
  Def extends RouteDef,
  SchemaDef extends RouteSchema<Def>,
  Config extends RequestConfig<SchemaDef>,
  Instance extends FastifyInstance,
>(
  fastify: Instance,
  def: Def,
  config: Config,
  handler:
    | RouteHandler<SchemaDef, Config>
    | {
        handler: RouteHandler<SchemaDef, Config>;
        [key: string]: unknown;
      },
) {
  if (typeof handler === "function") {
    return fastify.route<SchemaDef>({
      method: def.method,
      url: def.url,
      schema: { ...def.schema, security: [{ bearer: [] }] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: config as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: handler as any,
    });
  }
  return fastify.route<SchemaDef>({
    method: def.method,
    url: def.url,
    schema: { ...def.schema, security: [{ bearer: [] }] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: config as any,
    ...handler,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: handler.handler as any,
  });
}
