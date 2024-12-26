/* eslint-disable @typescript-eslint/no-explicit-any */
export const get = (obj: any, path: string, defaultValue?: any) => {
  const travel = (regexp: RegExp) =>
    String.prototype.split
      .call(path, regexp)
      .filter(Boolean)
      .reduce(
        (res: any, key: string) =>
          res !== null && res !== undefined ? res[key] : res,
        obj,
      );
  const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
  return result === undefined || result === obj ? defaultValue : result;
};

export const partition = <T>(arr: T[], x: (t: T) => boolean) => {
  const truthy: T[] = [];
  const falsey: T[] = [];
  arr.forEach((a) => (x(a) ? truthy.push(a) : falsey.push(a)));
  return [truthy, falsey];
};
