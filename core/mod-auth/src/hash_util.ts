import type { BinaryLike, ScryptOptions } from "node:crypto";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptPromise = promisify<
  BinaryLike,
  BinaryLike,
  number,
  ScryptOptions,
  Buffer
>(scrypt);

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS: ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
};

const SCryptValidator = async (password: string, parts: string[]) => {
  const [optionsStr, saltStr, keyStr] = parts;
  let N: number, r: number, p: number;

  for (const [k, v] of optionsStr.split(",").map((opt) => opt.split("="))) {
    const numVal = parseInt(v);
    if (isNaN(numVal) || !Number.isInteger(numVal) || numVal <= 0) {
      throw new Error(
        `invalid value for parameter ${k} passed to scrypt validator`,
      );
    }

    if (k === "N") {
      N = numVal;
    } else if (k === "r") {
      r = numVal;
    } else if (k === "p") {
      p = numVal;
    } else {
      throw new Error(`unrecognized parameter ${k} passed to scrypt validator`);
    }
  }
  if (!N || !r || !p) {
    throw new Error("Not all required scrypt parameters were present");
  }
  const salt = Buffer.from(saltStr, "base64");
  const key = Buffer.from(keyStr, "base64");

  const derived = await scryptPromise(password, salt, key.length, {
    N,
    r,
    p,
    maxmem: SCRYPT_OPTIONS.maxmem,
  });
  return timingSafeEqual(key, derived);
};

const VALIDATORS: Record<
  string,
  (password: string, parts: string[]) => Promise<boolean>
> = {
  scrypt: SCryptValidator,
};

export const Generate = async (password: string) => {
  const { N, r, p } = SCRYPT_OPTIONS;
  const salt = randomBytes(16);
  const key = await scryptPromise(
    password,
    salt,
    SCRYPT_KEYLEN,
    SCRYPT_OPTIONS,
  );
  return `$scrypt$N=${N},r=${r},p=${p}$${salt.toString("base64")}$${key.toString("base64")}`;
};

export const Validate = async (password: string, digest: string) => {
  const parts = digest.split("$");
  if (parts.length < 3 || !VALIDATORS[parts[1]]) {
    throw new Error("Invalid digest format");
  }
  return VALIDATORS[parts[1]](password, parts.slice(2));
};
