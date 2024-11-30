import fastify from 'fastify';
import { DATABASE_URL, HOST, PORT } from './config';
import core from './core';
import { Service } from './types';
import { asFunction, createContainer, Lifetime } from 'awilix';
import { AuthService } from '@noctf/services/auth';
import { DatabaseService } from '@noctf/services/database';

const server: Service = fastify({
  logger: true
}) as unknown as Service;

server.register(async () => {
  server.container = createContainer();
  server.container.register({
    authService: asFunction(() => new AuthService(), { lifetime: Lifetime.SINGLETON }),
    databaseService: asFunction(() => new DatabaseService(DATABASE_URL), { lifetime: Lifetime.SINGLETON }),
  });
});

server.get('/ping', async (request, reply) => {
  return 'pong\n';
});

server.register(core, { prefix: "/api" });

server.listen({
  port: PORT,
  host: HOST
}, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  server.log.info(`Server listening at ${address}`);
})