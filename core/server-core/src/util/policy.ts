export type Policy = [string] | ["OR" | "AND", ...(string | Policy)[]];

const MODIFIERS_SET = new Set("abcdefghijklmnopqrstuvwxyz");

/**
 * Evaluate a policy expression
 * @param policy
 * @param permissions
 * @param _ttl safeguard to make sure policy won't evaluate forever
 */
export const Evaluate = (policy: Policy, permissions: string[], _ttl = 64) => {
  if (_ttl === 0) {
    return false;
  }
  const permissionsMap = new Map(
    permissions.map((p) => {
      const [base, modifiers] = p.split(":");
      return [base, new Set(modifiers)];
    }),
  );
  const [op, ...expressions] = policy;
  const evaluate = (expr: string | Policy) =>
    (Array.isArray(expr) && Evaluate(expr, permissions, _ttl - 1)) ||
    (typeof expr === "string" && EvaluateScalar(expr, permissionsMap));
  if (policy.length === 1) {
    return EvaluateScalar(op, permissionsMap);
  } else if (op.toUpperCase() === "OR") {
    if (!expressions.length) return true;
    for (const expr of expressions) {
      if (evaluate(expr)) {
        return true;
      }
    }
  } else if (op.toUpperCase() === "AND") {
    let count = 0;
    for (const expr of expressions) {
      if (evaluate(expr)) {
        count += 1;
      } else {
        return false;
      }
    }
    return count === expressions.length;
  } else {
    throw new Error("Invalid policy expression");
  }
  return false;
};

/**
 * Evaluates a scalar policy (e.g., "admin.user.get") against a set of permissions
 * (e.g., ["admin.user", "!admin", "admin.challenges"]).
 *
 * Evaluation process:
 * 1. Check for the negation of the longest matching prefix (e.g., "!admin.user.get").
 *    - If a match is found, return `false`.
 * 2. If no negation is found, check for the positive case (e.g., "admin.user.get").
 *    - If a match is found, return `true`.
 * 3. Gradually shorten the prefix (e.g., "admin.user", "admin") and repeat the above checks.
 * 4. Stop the evaluation when an empty prefix ("") is reached.
 *
 * @param policy A string representing the policy to evaluate.
 * @param permissions An array of strings representing the available permissions.
 */
const EvaluateScalar = (
  policy: string,
  permissions: Map<string, Set<string>>,
) => {
  const [basePolicy, modifiers] = policy.split(":");

  let currentPolicy = basePolicy;
  const modifierSet = modifiers ? new Set(modifiers) : MODIFIERS_SET;

  const check = (p: string) => {
    const neg = permissions.get(`!${p}`);
    const pos = permissions.get(p);
    if (neg && !pos) {
      return false;
    } else if (pos && !neg) {
      return pos.size === 0 || modifierSet.isSubsetOf(pos);
    } else if (pos && neg) {
      const pSet = pos.size > 0 ? pos : MODIFIERS_SET;
      const nSet = neg.size > 0 ? neg : MODIFIERS_SET;
      return modifierSet.isSubsetOf(pSet.difference(nSet));
    }
    return null;
  };

  while (currentPolicy) {
    const result = check(currentPolicy);
    if (result !== null) {
      return result;
    }
    const lastDotIndex = currentPolicy.lastIndexOf(".");
    currentPolicy =
      lastDotIndex !== -1 ? currentPolicy.slice(0, lastDotIndex) : "";
  }
  return !!check("");
};
