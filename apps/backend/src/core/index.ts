import { AuthPlugin } from "./auth";
import { Service } from "../types";

export default async function(fastify: Service) {
  fastify.register(AuthPlugin);
}