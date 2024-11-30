import { ServiceCradle } from "@noctf/services";
import { FastifyInstance } from "fastify";
import { AwilixContainer } from "awilix";

export interface Service extends FastifyInstance {
  container: AwilixContainer<ServiceCradle>
}