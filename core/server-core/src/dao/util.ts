import { RawBuilder, SelectQueryBuilder, sql } from "kysely";
import { partition } from "../util/object.ts";
import { ReferenceExpression } from "kysely";

export const SplitYesNoQuery = <DB, Table extends keyof DB, Selected>(
  query: SelectQueryBuilder<DB, Table, Selected>,
  field: ReferenceExpression<DB, Table>,
  values: string[],
) => {
  const [no, yes] = partition(values, (f) => f.startsWith("!"));

  let q = query;
  if (yes.length) {
    q = query.where(field, "&&", sql.val(yes));
  }
  if (no.length) {
    q = query.where((eb) =>
      eb.not(eb(field, "&&", eb.val(no.map((f) => f.substring(1))))),
    );
  }
  return q;
};

export type UnnestColumnDef<T> = {
  type: string;
  get?: (item: T) => unknown;
  default?: RawBuilder<unknown> | string;
};

export type UnnestColumnsConfig<T> = {
  [K in string]?: UnnestColumnDef<T> | string;
};

export function buildUnnest<T extends Record<string, unknown>>(
  items: T[],
  columns: {
    [K in string]:
      | {
          type: string;
          get?: (item: T) => unknown;
          default?: RawBuilder<unknown> | string;
        }
      | string; // shorthand: just the postgres type e.g. { team_id: "integer" }
  },
  alias: string = "t",
) {
  const colNames = Object.keys(columns);
  const len = items.length;

  const unnestArgs = colNames.map((col) => {
    const conf = columns[col];
    const type = typeof conf === "string" ? conf : conf.type;
    const getter =
      typeof conf === "object" && conf.get
        ? conf.get
        : (item: T) => item[col] ?? null;

    const arr = new Array(len);
    for (let i = 0; i < len; i++) {
      const val = getter(items[i]);
      arr[i] = val === undefined ? null : val;
    }

    return sql`${arr}::${sql.raw(type)}[]`;
  });

  const columnsSql = sql.join(colNames.map((c) => sql.ref(c)));
  const tableAliasSql = sql.raw(`${alias}(${colNames.join(", ")})`);

  // UNNEST($1::type[], $2::type[]) AS alias(col1, col2)
  const source = sql`UNNEST(${sql.join(unnestArgs)}) AS ${tableAliasSql}`;

  const selectColumns = sql.join(
    colNames.map((col) => {
      const conf = columns[col];
      const fallback = typeof conf === "object" ? conf.default : undefined;
      const ref = sql.ref(`${alias}.${col}`);
      if (fallback) {
        const defaultExpr =
          typeof fallback === "string" ? sql.raw(fallback) : fallback;
        return sql`COALESCE(${ref}, ${defaultExpr})`;
      }
      return ref;
    }),
  );

  return {
    columns: columnsSql,
    selectColumns,
    source,
    alias: sql.ref(alias),
    asTable: <A extends string = typeof alias>(customAlias: A = alias as A) =>
      sql`UNNEST(${sql.join(unnestArgs)})`.as<A>(
        sql.raw(`${customAlias}(${colNames.join(", ")})`),
      ),
  };
}
