function trimSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.codePointAt(start) === 47) {
    start++;
  }
  while (end > start && value.codePointAt(end - 1) === 47) {
    end--;
  }
  return value.slice(start, end);
}

export function generatePath(base: string) {
  return function (path: string): `/${string}` {
    const cleanBase = trimSlashes(base);
    const cleanPath = trimSlashes(path);
    return `/${[cleanBase, cleanPath].filter(Boolean).join("/")}`;
  };
}
