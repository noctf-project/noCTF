import { expect, test } from "vitest";
import { Generate, Validate } from "./hash_util.ts";

test('a correct password validates successfully', async () => {
  const digest = await Generate("123456");
  expect(await(Validate("123456", digest)))
    .toBe(true);
  expect(await(Validate("1234567", digest)))
    .toBe(false);
});

test('a static scrypt digest validates successfully', async () => {
  const hash = "$scrypt$N=16384,r=8,p=1$mYpsjTuWJbNT4+KWflCG5Q==$"+
    "nHvbcPbf5f+j9lIAGCApEz2StBnzqQ+cb+bUarYI21gj0Fk2HEiHpZctYPBVQcfpPuzRqlmQtO0CmyFP1pFc0A==";
  expect(await(Validate("123456", hash)))
    .toBe(true);
  expect(await(Validate("1234567", hash)))
    .toBe(false);
});

test('a static scrypt digest with invalid parameters throws an error', async () => {
  const hash = "$scrypt$N=16384,r=8,p=0$mYpsjTuWJbNT4+KWflCG5Q==$"+
    "nHvbcPbf5f+j9lIAGCApEz2StBnzqQ+cb+bUarYI21gj0Fk2HEiHpZctYPBVQcfpPuzRqlmQtO0CmyFP1pFc0A==";
  expect(Validate("123456", hash)).rejects.toThrowError();
});

test('a static scrypt digest with missing parameters throws an error', async () => {
  const hash = "$scrypt$N=16384,r=8$mYpsjTuWJbNT4+KWflCG5Q==$"+
    "nHvbcPbf5f+j9lIAGCApEz2StBnzqQ+cb+bUarYI21gj0Fk2HEiHpZctYPBVQcfpPuzRqlmQtO0CmyFP1pFc0A==";
  expect(Validate("123456", hash)).rejects.toThrowError();
});


test('a invalid digest type throws an error', async () => {
  expect(Validate("123456", "$nonexistent$asdadsasd$")).rejects.toThrowError();
  expect(Validate("123456", "!test!aaa!b")).rejects.toThrowError();
});