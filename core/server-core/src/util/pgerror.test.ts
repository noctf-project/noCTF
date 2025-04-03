import { describe, expect, it } from "vitest";
import { PostgresErrorCode, TryPGConstraintError } from "./pgerror.ts";
import pg from "pg";
import { mockDeep } from "vitest-mock-extended";

class FakeError extends Error {}

describe(TryPGConstraintError, () => {
  it("Test non-existent error code", () => {
    const e = mockDeep<pg.DatabaseError>();
    e.code = "1";
    e.constraint = "hello";
    const derived = TryPGConstraintError(e, {});
    expect(derived).toBeFalsy();
  });

  it("Test defined error code and constraint", () => {
    const e = mockDeep<pg.DatabaseError>();
    e.message = "lol";
    e.code = PostgresErrorCode.Duplicate;
    e.constraint = "hello_key";
    const derived = TryPGConstraintError(e, {
      [PostgresErrorCode.Duplicate]: {
        hello_key: (e) => new FakeError(e.message),
      },
    });
    expect(derived).to.eql(new FakeError("lol"));
  });

  it("Test not-exists constraint", () => {
    const e = mockDeep<pg.DatabaseError>();
    e.message = "lol";
    e.code = PostgresErrorCode.Duplicate;
    e.constraint = "hello_key";
    const derived = TryPGConstraintError(e, {
      [PostgresErrorCode.Duplicate]: {
        lol: (e) => new FakeError(e.message),
      },
    });
    expect(derived).toBeFalsy();
  });

  it("Test default constraint", () => {
    const e = mockDeep<pg.DatabaseError>();
    e.message = "lol";
    e.code = PostgresErrorCode.Duplicate;
    e.constraint = "hello_key";
    const derived = TryPGConstraintError(e, {
      [PostgresErrorCode.Duplicate]: {
        default: (e) => new FakeError(e.message),
      },
    });
    expect(derived).to.eql(new FakeError("lol"));
  });
});
