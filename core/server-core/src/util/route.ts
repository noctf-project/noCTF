import { RouteDef } from "@noctf/api/types";
import { Static, TSchema } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { RequestConfig } from "../types/fastify.ts";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Options<T> = T extends (arg1: infer U, ...args: any[]) => any ? U : never;

export function route<
  Def extends RouteDef,
  SchemaDef extends RouteSchema<Def>,
  Instance extends FastifyInstance,
>(
  fastify: Instance,
  def: Def,
  config: RequestConfig<SchemaDef>,
  handler: Options<typeof fastify.route<SchemaDef>>["handler"],
) {
  return fastify.route<SchemaDef>({
    method: def.method,
    url: def.url,
    schema: { ...def.schema, security: [{ bearer: [] }] },
    config,
    handler,
  });
}
