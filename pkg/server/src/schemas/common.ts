import { Static, TSchema, Type } from '@sinclair/typebox';

export const ErrorResponse = Type.Object({
  error: Type.Optional(Type.String()),
});
export type ErrorResponseType = Static<typeof ErrorResponse>;

export const PaginatedResponse = <T extends TSchema>(type: T) => Type.Object({
  data: type,
  pagination: Type.Object({
    cursor: Type.String(),
    hasNext: Type.Boolean(),
  }),
});
export type PaginatedResponseType<T> = Omit<Static<ReturnType<typeof PaginatedResponse>>, 'data'> & {
  data: T
};
