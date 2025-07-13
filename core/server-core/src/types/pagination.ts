import { Primitive } from "@noctf/api/types";

export type PaginationCursor = Record<string, Primitive | Date | BigInt>;

export type LimitCursorEncoded = {
  limit?: number;
  next?: string;
};

export type LimitCursorDecoded = {
  limit?: number;
  next?: PaginationCursor;
};
