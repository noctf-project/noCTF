/* eslint-disable @typescript-eslint/no-explicit-any */
export const FilterUndefined = (obj: any) =>
  Object.keys(obj).reduce((acc: any, key) => {
    if (obj[key] !== undefined) acc[key] = obj[key];
    return acc;
  }, {});
