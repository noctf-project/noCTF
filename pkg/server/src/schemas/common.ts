import { Static, TSchema, Type } from '@sinclair/typebox';

export const ErrorResponse = Type.Object({
  error: Type.Optional(Type.String()),
});
export type ErrorResponseType = Static<typeof ErrorResponse>;

export const PaginatedRequest = Type.Object({
  size: Type.Number({ default: 25, maximum: 50, minimum: 0 }),
  after: Type.Number({ default: 0 }),
});
export type PaginatedRequestType = Static<typeof PaginatedRequest>;

export const PaginatedResponse = <T extends TSchema>(type: T) => Type.Object({
  page: type, // Our Actual Data
  cursor: Type.Object({
    next: Type.String(),
  }),
});
export type PaginatedResponseType<T> = Omit<Static<ReturnType<typeof PaginatedResponse>>, 'page'> & {
  page: T
};
