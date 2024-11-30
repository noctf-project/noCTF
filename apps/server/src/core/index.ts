import { Service } from "@noctf/services";

import auth from "./auth/index.ts";
import setup from "./setup/index.ts";

export default async function (fastify: Service) {
  fastify.register(auth);
  fastify.register(setup);
}
