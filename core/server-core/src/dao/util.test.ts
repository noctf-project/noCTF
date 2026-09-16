import { describe, it, expect } from "vitest";
import { buildUnnest, SplitYesNoQuery } from "./util.ts";
import { Kysely, PostgresDialect, sql } from "kysely";

describe("buildUnnest", () => {
  const db = new Kysely<unknown>({
    dialect: new PostgresDialect({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pool: {} as any,
    }),
  });

  it("builds unnest SQL with shorthand types and default getters", () => {
    const items = [
      { id: 1, name: "item1" },
      { id: 2, name: "item2" },
    ];

    const unnest = buildUnnest(items, {
      id: "integer",
      name: "text",
    });

    const compiledSource = unnest.source.compile(db);
    expect(compiledSource.sql).toContain("UNNEST");
    expect(compiledSource.sql).toContain("::integer[]");
    expect(compiledSource.sql).toContain("::text[]");
    expect(compiledSource.sql).toContain("AS t(id, name)");
    expect(compiledSource.parameters).toEqual([
      [1, 2],
      ["item1", "item2"],
    ]);

    const compiledColumns = unnest.columns.compile(db);
    expect(compiledColumns.sql).toBe('"id", "name"');

    const compiledSelect = unnest.selectColumns.compile(db);
    expect(compiledSelect.sql).toBe('"t"."id", "t"."name"');
  });

  it("handles custom getters and default sql for COALESCE in selectColumns", () => {
    const items = [
      { id: 1, custom: "val1", opt: undefined },
      { id: 2, custom: "val2", opt: "custom-opt" },
    ];

    const unnest = buildUnnest(
      items,
      {
        id: "integer",
        custom: {
          type: "text",
          get: (item) => item.custom.toUpperCase(),
        },
        opt: {
          type: "text",
          default: sql`'default_val'`,
        },
      },
      "custom_alias",
    );

    const compiledSource = unnest.source.compile(db);
    expect(compiledSource.sql).toContain("AS custom_alias(id, custom, opt)");
    expect(compiledSource.parameters).toEqual([
      [1, 2],
      ["VAL1", "VAL2"],
      [null, "custom-opt"],
    ]);

    const compiledSelect = unnest.selectColumns.compile(db);
    expect(compiledSelect.sql).toBe(
      '"custom_alias"."id", "custom_alias"."custom", COALESCE("custom_alias"."opt", \'default_val\')',
    );
  });

  it("provides asTable for Kysely updateTable .from() clause", () => {
    const items = [{ id: 1, flag: true }];
    const unnest = buildUnnest(
      items,
      {
        id: "integer",
        flag: "boolean",
      },
      "v",
    );

    const query = db.selectFrom(unnest.asTable("v")).selectAll();
    const compiled = query.compile();

    expect(compiled.sql).toContain("UNNEST");
    expect(compiled.sql).toContain("as v(id, flag)");
    expect(compiled.parameters).toEqual([[1], [true]]);
  });
});

describe("SplitYesNoQuery", () => {
  it("partitions query into positive and negative conditions", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereCalls: any[] = [];
    const mockQuery = {
      where: (...args: unknown[]) => {
        whereCalls.push(args);
        return mockQuery;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    SplitYesNoQuery(mockQuery, "flags" as never, ["admin", "!banned"]);
    expect(whereCalls).toHaveLength(2);

    // Positive check uses &&
    expect(whereCalls[0][0]).toBe("flags");
    expect(whereCalls[0][1]).toBe("&&");
    // Negative check has callback
    expect(typeof whereCalls[1][0]).toBe("function");
  });
});
