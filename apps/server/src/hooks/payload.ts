import { ApplicationError, BadRequestError } from "@noctf/server-core/errors";
import { Transform } from "node:stream";
import { FastifyReply, FastifyRequest, RequestPayload } from "fastify";
import { createHash, Hash, timingSafeEqual } from "node:crypto";

type AlgoMap = Record<string, { value: Buffer; hash: Hash }>;

declare module "fastify" {
  interface FastifyRequest {
    _parsedDigestHeader?: Record<string, Buffer>;
  }
}

function parsePair(algos: AlgoMap, pair: string) {
  const [algo, value] = pair.split("=", 2);
  if (algo === "sha-256" && !algos["sha-256"]) {
    algos["sha-256"] = {
      value: Buffer.from(value, "base64"),
      hash: createHash("sha256"),
    };
    return "sha-256";
  } else if (algo === "sha-512" && !algos["sha-512"]) {
    algos["sha-512"] = {
      value: Buffer.from(value, "base64"),
      hash: createHash("sha512"),
    };
    return "sha-512";
  }
  throw new BadRequestError("InvalidHeader");
}

export const PayloadDigestPreParsingHook = async (
  request: FastifyRequest,
  _reply: FastifyReply,
  payload: RequestPayload,
) => {
  // sentinel for validation hook
  request._parsedDigestHeader = {};

  const header = request.headers["content-digest"];
  if (!header) return payload;
  if (Array.isArray(header)) throw new BadRequestError("InvalidHeader");

  const algos: AlgoMap = {};
  for (const pair of header.split(",")) {
    try {
      const algo = parsePair(algos, pair);
      request._parsedDigestHeader[algo] = algos[algo].value;
    } catch (e) {
      if (e instanceof ApplicationError) throw e;
      throw new BadRequestError("InvalidHeader");
    }
  }
  if (Object.keys(algos).length === 0) return payload;
  const stream = new Transform({
    transform(chunk, _encoding, callback) {
      for (const algo in algos) {
        algos[algo].hash.update(chunk);
      }
      callback(null, chunk);
    },
  });

  payload.on("end", () => {
    request.digests = {};
    for (const algo in algos) {
      request.digests[algo] = algos[algo].hash.digest();
    }
  });
  payload.pipe(stream);
  return stream;
};

export const PayloadDigestPreValidationHook = async (
  request: FastifyRequest,
) => {
  if (!request._parsedDigestHeader) throw new Error("Route is misconfigured");
  for (const h in request._parsedDigestHeader) {
    const parsed = request._parsedDigestHeader[h];
    const computed = request.digests[h];
    try {
      if (
        computed.length !== parsed.length ||
        !timingSafeEqual(parsed, computed)
      ) {
        throw new BadRequestError("InvalidDigest");
      }
    } catch (e) {
      if (e instanceof ApplicationError) throw e;
      throw new BadRequestError("InvalidDigest");
    }
  }
};
