import { BadRequestError } from "@noctf/server-core/errors";
import type { FastifyReply, FastifyRequest } from "fastify";

export const ServeFileHandler = async (
  ref: string,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { fileService } = request.server.container.cradle;
  let range: [number, number];
  if (request.headers.range) {
    const matches = request.headers.range.match(/bytes=(\d*)-(\d*)/);
    if (!matches) {
      throw new Error("Invalid Range format");
    }
    const start = matches[1] ? parseInt(matches[1], 10) : null;
    const end = matches[2] ? parseInt(matches[2], 10) : null;

    if (start === null && end === null) {
      throw new BadRequestError("Range must specify at least start or end");
    }
    if (start != null && end != null && start >= end) {
      throw new BadRequestError("Range start cannot be greater than range end");
    }
    range = [start, end];
  }
  const urlOrStream = await (range
    ? fileService.download(ref, range[0], range[1])
    : fileService.download(ref));
  if (typeof urlOrStream === "string") {
    return reply.redirect(urlOrStream, 302);
  }
  const [stream, { mime, size, filename }] = urlOrStream;
  reply.header("content-type", mime);
  reply.header(
    "content-length",
    range ? (range[1] || size - 1) + 1 - (range[0] || 0) : size,
  );
  reply.header(
    "content-disposition",
    `attachment; filename=${JSON.stringify(filename)}`,
  );
  if (range) reply.status(206);
  return stream;
};
