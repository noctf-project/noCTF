import { GetLocalFile } from "@noctf/api/contract/file";
import { BadRequestError } from "@noctf/server-core/errors";
import type { LocalFileProviderInstance } from "@noctf/server-core/services/file/local";
import { route } from "@noctf/server-core/util/route";
import { FastifyInstance } from "fastify";

export async function routes(fastify: FastifyInstance) {
  const { fileService } = fastify.container.cradle;

  route(fastify, GetLocalFile, {}, async (request, reply) => {
    let range: [number, number];
    if (request.headers.range) {
      const matches = request.headers.range.match(/bytes=(\d*)-(\d*)/);
      if (!matches) {
        throw new BadRequestError("InvalidRangeError", "Invalid Range format");
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

    const provider = (await fileService.getInstance(
      "local",
    )) as LocalFileProviderInstance;
    provider.checkSignature(
      request.params.ref,
      request.query.iat,
      request.query.sig,
    );
    const [stream, metadata] = await provider.download(
      request.params.ref,
      range?.[0],
      range?.[1],
    );
    reply.header("content-type", metadata.mime);
    reply.header(
      "content-length",
      range
        ? (range[1] || metadata.size - 1) + 1 - (range[0] || 0)
        : metadata.size,
    );
    reply.header(
      "content-disposition",
      `attachment; filename=${JSON.stringify(metadata.filename)}`,
    );
    reply.header("cache-control", "max-age=86400");
    if (range) reply.status(206);
    return stream;
  });
}
