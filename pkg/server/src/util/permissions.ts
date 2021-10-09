export const evaluateSingle = (parent: string, child: string) => (parent.endsWith('*')
  ? child.startsWith(parent.slice(0, parent.length - 1))
  : parent === child);

export const evaluate = (permission: string, permissions: string[]) => (
  permissions.find((p) => (p.endsWith('*')
    ? permission.startsWith(p.slice(0, p.length - 1))
    : p === permission))
);
