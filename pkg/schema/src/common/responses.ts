import { Static, TSchema, Type } from '@sinclair/typebox';

export const ErrorResponse = Type.Object({
  error: Type.Optional(Type.String()),
});
export type ErrorResponseType = Static<typeof ErrorResponse>;

export const PaginatedResponse = <T extends TSchema>(type: T) => Type.Object({
  page: type, // Our Actual Data
  cursor: Type.Object({
    next: Type.String(),
  }),
});
export type PaginatedResponseType<T> = Omit<Static<ReturnType<typeof PaginatedResponse>>, 'page'> & {
  page: T
};
