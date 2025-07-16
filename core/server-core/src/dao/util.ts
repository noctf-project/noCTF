import { SelectQueryBuilder, sql } from "kysely";
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
