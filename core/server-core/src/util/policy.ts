export type Policy = [string] | ["OR" | "AND", ...(string | Policy)[]];

const REPLACE_REGEX = /\.*[^.]+$/;
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
  const [op, ...expressions] = policy;
  const sortedPermissions = [...permissions].sort();
  const evaluate = (expr: string | Policy) =>
    (Array.isArray(expr) && Evaluate(expr, permissions, _ttl - 1)) ||
    (typeof expr === "string" && EvaluateScalar(expr, sortedPermissions));
  if (policy.length === 1) {
    return EvaluateScalar(op, sortedPermissions);
  } else if (op.toUpperCase() === "OR") {
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

const EvaluateScalar = (permission: string, policy: string[]) => {
  // search for denials first
  let p = permission;
  let allowed = false;
  while (p !== "") {
    const n = "!" + p;
    if (PredicateMatches(n, policy, true)) {
      return false;
    }
    if (PredicateMatches(p, policy, false)) {
      allowed = true;
    }
    p = p.replace(REPLACE_REGEX, "");
  }

  return (
    !PredicateMatches("", policy, true) &&
    (allowed || PredicateMatches("", policy, false))
  );
};

const PredicateMatches = (p: string, policy: string[], neg: boolean) => {
  if (policy.length === 0) return neg;
  const pidx = BisectLeft(p, policy);
  let pp = policy[pidx];
  if (!pp) pp = policy[pidx - 1];
  return (
    pp === p ||
    (!neg && pp === "*") ||
    (neg && pp === "!*") ||
    (pp.endsWith(".*") && p.startsWith(pp.substring(0, pp.length - 2)))
  );
};

const BisectLeft = (target: string, array: string[]) => {
  let left = 0;
  let right = array.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);

    if (array[mid] < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
};
