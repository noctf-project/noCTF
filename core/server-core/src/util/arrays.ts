/**
 * Generic bisect_left implementation that supports element transformation
 * @param arr - The sorted array to search in
 * @param target - The target value to find insertion point for
 * @param getter - Optional function to transform array elements before comparison
 * @returns The index where target should be inserted (leftmost position)
 */
export function bisectLeft<T, V>(
  arr: T[],
  target: V,
  getter: (item: T) => V = (item: any) => item,
): number {
  let left = 0;
  let right = arr.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (getter(arr[mid]) < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}

/**
 * Generic bisect_right implementation that supports element transformation
 * @param arr - The sorted array to search in
 * @param target - The target value to find insertion point for
 * @param getter - Optional function to transform array elements before comparison
 * @returns The index where target should be inserted (rightmost position)
 */
export function bisectRight<T, V>(
  arr: T[],
  target: V,
  getter: (item: T) => V = (item: any) => item,
): number {
  let left = 0;
  let right = arr.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (getter(arr[mid]) <= target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}

/**
 * Inserts a value into a sorted array at the appropriate position
 * @param arr - The sorted array to insert into
 * @param item - The item to insert
 * @param getter - Optional function to transform array elements before comparison
 * @returns The new array with the inserted item
 */
export function insort<T, V>(
  arr: T[],
  item: T,
  getter: (item: T) => V = (item: any) => item,
): T[] {
  const index = bisectRight(arr, getter(item), getter);
  return [...arr.slice(0, index), item, ...arr.slice(index)];
}
