import * as React from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms have
 * passed without a change. Handy for search inputs: the field stays instantly
 * responsive to typing while the (potentially expensive) filtering downstream
 * runs off the settled value.
 */
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
