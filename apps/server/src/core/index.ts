import { AuthPlugin } from "./auth";
import { Service } from "../types";
import { OAuthPlugin } from "./oauth";

export default async function(fastify: Service) {
  fastify.register(AuthPlugin);
  fastify.register(OAuthPlugin);
}