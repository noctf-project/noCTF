import { FileParams } from "@noctf/api/params";
import { FastifyInstance } from "fastify";
import { ServeFileHandler } from "../hooks/file.ts";
import { AdminFileMetadataResponse } from "@noctf/api/responses";

export async function routes(fastify: FastifyInstance) {
  const { fileService } = fastify.container.cradle;

  fastify.get<{ Params: FileParams, Reply: AdminFileMetadataResponse }>(
    "/admin/files/:ref/meta",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.file.get"],
        },
        params: FileParams,
        response: {
          200: AdminFileMetadataResponse,
        },
      },
    },
    async (request) => {
      return {
        data: await fileService.getMetadata(request.params.ref)
      };
    },
  );

  fastify.get<{ Params: FileParams }>(
    "/admin/files/:ref",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.file.get"],
        },
        params: FileParams
      },
    },
    async (request, reply) => {
      return ServeFileHandler(request.params.ref, request, reply);
    },
  );

  fastify.delete<{ Params: FileParams }>(
    "/admin/files/:ref",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.file.delete"],
        },
        params: FileParams
      },
    },
    async (request) => {
      await fileService.delete(request.params.ref);
      return {};
    },
  );

  fastify.post<{ Reply: AdminFileMetadataResponse }>(
    "/admin/files",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["admin"],
        auth: {
          require: true,
          policy: ["admin.file.create"],
        },
        response: {
          201: AdminFileMetadataResponse
        }
      },
    },
    async (request, reply) => {
      const data = await request.file();
      const result = await fileService.upload(data.filename, data.file);
      return {
        data: result
      };
    },
  );
}
