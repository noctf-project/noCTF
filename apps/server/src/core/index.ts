import { Service } from "@noctf/services";

import auth from "./auth";
import setup from "./setup";

export default async function(fastify: Service) {
  fastify.register(auth);
  fastify.register(setup);
}