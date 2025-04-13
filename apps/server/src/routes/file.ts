import { FileParams } from "@noctf/api/params";
import { GetFileQuery } from "@noctf/api/query";
import { BadRequestError } from "@noctf/server-core/errors";
import { LocalFileProvider } from "@noctf/server-core/services/file";
import { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { fileService } = fastify.container.cradle;

  fastify.get<{ Params: FileParams; Querystring: GetFileQuery }>(
    "/files/:ref",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["challenge"],
        auth: {
          policy: ["challenge.get"],
        },
        params: FileParams,
        querystring: GetFileQuery,
      },
    },
    async (request, reply) => {
      let range: [number, number];
      if (request.headers.range) {
        const matches = request.headers.range.match(/bytes=(\d*)-(\d*)/);
        if (!matches) {
          throw new Error("Invalid Range format");
        }
        const start = matches[1] ? parseInt(matches[1], 10) : null;
        const end = matches[2] ? parseInt(matches[2], 10) : null;

        if (start === null && end === null) {
          throw new BadRequestError(
            "InvalidRangeError",
            "Range must specify at least start or end",
          );
        }
        if (start != null && end != null && start >= end) {
          throw new BadRequestError(
            "InvalidRangeError",
            "Range start cannot be greater than range end",
          );
        }
        range = [start, end];
      }
      const provider = fileService.getProvider("local") as LocalFileProvider;
      const [stream, { mime, size, filename }] = await provider.download(
        request.params.ref,
        range?.[0],
        range?.[1],
        request.query,
      );
      reply.header("content-type", mime);
      reply.header(
        "content-length",
        range ? (range[1] || size - 1) + 1 - (range[0] || 0) : size,
      );
      reply.header(
        "content-disposition",
        `attachment; filename=${JSON.stringify(filename)}`,
      );
      reply.header("cache-control", "max-age=86400");
      if (range) reply.status(206);
      return stream;
    },
  );
}
