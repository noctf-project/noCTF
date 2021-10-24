import knex from 'knex';

declare module 'knex' {
  namespace Knex {
    interface QueryBuilder {
      paginate(keyColumn: string, args: Readonly<RowSetPaginationArgs>): Knex.QueryBuilder;
    }
  }
}

export type RowSetPaginationArgs = Partial<{
  size: number;
  after: number;
  operator: string;
}>;

export const DEFAULT_PAGINATOR: Readonly<Required<RowSetPaginationArgs>> = Object.freeze({
  size: 25,
  after: 0,
  operator: '>',
});

export default function attachPaginate(queryBuilder: typeof knex.QueryBuilder = knex.QueryBuilder) {
  queryBuilder.extend('paginate', function paginator(keyColumn: string, args: Readonly<RowSetPaginationArgs>) {
    const concreteArgs = {
      size: args.size ?? DEFAULT_PAGINATOR.size,
      after: args.after ?? DEFAULT_PAGINATOR.after,
      operator: args.operator ?? DEFAULT_PAGINATOR.operator,
    };
    return this
      .where(keyColumn, concreteArgs.operator, concreteArgs.after)
      .limit(concreteArgs.size);
  });
}
