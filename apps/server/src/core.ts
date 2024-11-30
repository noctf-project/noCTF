import { Service } from "@noctf/server-core";

import auth from "@noctf/plugin-auth";
import setup from "@noctf/plugin-setup";

export default async function (fastify: Service) {
  fastify.register(auth);
  fastify.register(setup);
}
