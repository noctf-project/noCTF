import * as argon2 from 'argon2';

export const verify = async (digest: string, password: string): Promise<boolean | string> => (
  argon2.verify(digest, password)
);

export const hash = async (password: string): Promise<string> => argon2.hash(password);
