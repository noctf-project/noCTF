import {
  AdminDeleteFile,
  AdminGetFileMetadata,
  AdminUploadFile,
} from "@noctf/api/contract/admin_file";
import { BadRequestError } from "@noctf/server-core/errors";
import { route } from "@noctf/server-core/util/route";
import type { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { fileService } = fastify.container.cradle;

  route(
    fastify,
    AdminGetFileMetadata,
    {
      auth: {
        require: true,
        policy: ["admin.file.get"],
      },
    },
    async (request) => {
      return {
        data: await fileService.getMetadata(request.params.id),
      };
    },
  );

  route(
    fastify,
    AdminDeleteFile,
    {
      auth: {
        require: true,
        policy: ["admin.file.delete"],
      },
    },
    async (request) => {
      await fileService.delete(request.params.id);
      return {};
    },
  );

  route(
    fastify,
    AdminUploadFile,
    {
      auth: {
        require: true,
        policy: ["admin.file.create"],
      },
    },
    async (request, reply) => {
      const data = await request.file();
      if (!data.filename || data.filename.length > 255) {
        throw new BadRequestError("Filename doesn't exist or is too long");
      }
      const filename = data.filename.replace(/[^a-zA-Z0-9_\-. ]/g, "");
      request.raw.on("close", () => {
        if (request.raw.readableAborted) {
          data.file.emit("end");
        }
      });
      data.file.on("limit", () => {
        data.file.emit("end");
      });
      const result = await fileService.upload(filename, data.file);

      if (request.raw.readableAborted) {
        fastify.log.warn({ id: result.id }, "File upload aborted");
        void fileService.delete(result.id).catch(() => {});
        throw new BadRequestError("FileUploadError", "File upload aborted");
      }
      if (data.file.truncated) {
        fastify.log.warn({ id: result.id }, "File upload over limit");
        void fileService.delete(result.id).catch(() => {});
        throw new BadRequestError(
          "FileUploadError",
          "File size exceeded limit",
        );
      }

      return reply.status(201).send({
        data: result,
      });
    },
  );
}
