import { FileParams } from "@noctf/api/params";
import { FastifyInstance } from "fastify";
import { ServeFileHandler } from "../hooks/file.ts";

export async function routes(fastify: FastifyInstance) {
  const { fileService } = fastify.container.cradle;

  fastify.get<{ Params: FileParams }>(
    "/admin/files/download/:ref",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.file.get"],
        },
      },
    },
    async (request, reply) => {
      return ServeFileHandler(request.params.ref, request, reply);
    },
  );
}
