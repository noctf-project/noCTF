/* eslint-disable @typescript-eslint/no-explicit-any */
export const FilterNullAndUndefined = (obj: any) =>
  Object.keys(obj).reduce((acc: any, key) => {
    if (obj[key] != null) acc[key] = obj[key];
    return acc;
  }, {});
