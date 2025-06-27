import { FastifyRequest } from "fastify";
import { Address6 } from "ip-address";
import { isIPv4 } from "net";

export const GetRouteUserIPKey = (r: FastifyRequest) =>
  `${r.routeOptions.url}:${r.user ? "u" + r.user.id : "i" + NormalizeIPPrefix(r.ip)}`;

export const NormalizeIPPrefix = (ip: string, prefix6 = 56) => {
  if (isIPv4(ip)) {
    return ip;
  }
  return new Address6(`${ip}/${prefix6}`).startAddress().correctForm();
};
