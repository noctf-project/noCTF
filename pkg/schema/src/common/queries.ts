import { Type, Static } from '@sinclair/typebox';

export const PaginatedRequest = Type.Object({
  size: Type.Number({ default: 25, maximum: 50, minimum: 0 }),
  after: Type.Number({ default: 0 }),
});
export type PaginatedRequestType = Static<typeof PaginatedRequest>;
