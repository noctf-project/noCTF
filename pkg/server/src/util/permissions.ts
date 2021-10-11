/**
 * Check if two permissions are equivalent
 * @param parent parent permission (can have wildcards)
 * @param child child permission (does not have wildcards)
 * @returns boolean
 */
export const checkEquivalent = (parent: string, child: string) => (parent.endsWith('*')
  ? child.startsWith(parent.slice(0, parent.length - 1))
  : parent === child);

/**
 * Evaluate a permissions set
 * It will first check for deny based permissions (based on sort order), and then check allow
 * @param permission permission to match against
 * @param permissions list of permissions to match with
 */
export const evaluate = (permission: string, permissions: string[]): [
  boolean, string | undefined,
] => {
  const found = permissions.find((p) => {
    const x = p.replace(/^!/, '');
    return (x.endsWith('*')
      ? permission.startsWith(x.slice(0, x.length - 1))
      : x === permission);
  });
  return [!!found && found.startsWith('!'), found];
};

/**
 * Validate that a permission string is valid
 * @param permission permission string
 * @returns whether permission is valid
 */
export const validate = (permission: string) => (
  /^(!)?([a-z_]+|\*)(\.([a-z_]+|\*))*$/.test(permission)
);