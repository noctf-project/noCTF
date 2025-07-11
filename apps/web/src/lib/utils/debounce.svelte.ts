import { untrack } from "svelte";

/**
 * Creates a debounced state manager for a single value
 */
export function createDebouncedState<T>(
  initialValue: T,
  delay: number = 300,
  onUpdate?: (value: T) => void,
) {
  let value = $state(initialValue);
  let debouncedValue = $state(initialValue);
  let timer: ReturnType<typeof setTimeout> | null = $state(null);

  $effect(() => {
    if (value !== undefined) {
      untrack(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          if (value !== debouncedValue) {
            debouncedValue = value;
            onUpdate?.(value);
          }
          timer = null;
        }, delay);
      });
    }
  });

  return {
    get value() {
      return value;
    },
    set value(newValue: T) {
      value = newValue;
    },
    get debouncedValue() {
      return debouncedValue;
    },
    forceUpdate() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      debouncedValue = value;
      onUpdate?.(value);
    },
    reset(resetValue: T) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      value = resetValue;
      debouncedValue = resetValue;
    },
  };
}

/**
 * Creates a debounced state manager for multiple fields
 */
export function createDebouncedFields<T extends Record<string, unknown>>(
  initialValues: T,
  delay: number = 300,
  onUpdate?: (values: T) => void,
) {
  const values = $state({ ...initialValues });
  const debouncedValues = $state({ ...initialValues });
  const timers: Record<string, ReturnType<typeof setTimeout> | null> = $state(
    {},
  );

  // Create effect for each field
  Object.keys(initialValues).forEach((key) => {
    $effect(() => {
      const currentValue = values[key];
      if (currentValue !== undefined) {
        untrack(() => {
          if (timers[key]) clearTimeout(timers[key]);
          timers[key] = setTimeout(() => {
            if (values[key] !== debouncedValues[key]) {
              (debouncedValues as Record<string, unknown>)[key] = values[key];
              onUpdate?.(debouncedValues);
            }
            timers[key] = null;
          }, delay);
        });
      }
    });
  });

  return {
    get values() {
      return values;
    },
    get debouncedValues() {
      return debouncedValues;
    },
    setValue<K extends keyof T>(key: K, value: T[K]) {
      (values as Record<string, unknown>)[key as string] = value;
    },
    forceUpdate() {
      Object.keys(timers).forEach((key) => {
        if (timers[key]) {
          clearTimeout(timers[key]);
          timers[key] = null;
        }
      });
      Object.assign(debouncedValues, values);
      onUpdate?.(debouncedValues);
    },
    reset(resetValues?: Partial<T>) {
      Object.keys(timers).forEach((key) => {
        if (timers[key]) {
          clearTimeout(timers[key]);
          timers[key] = null;
        }
      });
      if (resetValues) {
        Object.assign(values, resetValues);
        Object.assign(debouncedValues, resetValues);
      } else {
        Object.assign(values, initialValues);
        Object.assign(debouncedValues, initialValues);
      }
    },
  };
}
