export type Policy = [string] | ["OR" | "AND", ...(string | Policy)[]];

const REPLACE_REGEX = /\.*[^.]+$/;

/**
 * Preprocess permissions to remove positive permissions that are matched by negative permissions
 * @param permissions Array of permission strings
 * @returns Filtered array with redundant positive permissions removed
 */
export const PreprocessPermissions = (permissions: string[]): string[] => {
  const negative: string[] = [];
  const positive: string[] = [];

  for (const perm of permissions) {
    // short circuit
    if (perm === "!*") return ["!*"];
    if (perm.startsWith("!")) {
      negative.push(perm.substring(1));
    } else {
      positive.push(perm);
    }
  }

  // Sort both arrays for binary search
  negative.sort();
  positive.sort();

  // Filter out positive permissions that match negative patterns
  const filteredPositive = positive.filter((positivePerm) => {
    const exactIdx = BisectLeft(positivePerm, negative);
    if (exactIdx < negative.length && negative[exactIdx] === positivePerm) {
      return false;
    }

    for (const negativePattern of negative) {
      if (negativePattern.endsWith(".*")) {
        const prefix = negativePattern.substring(0, negativePattern.length - 2);
        if (positivePerm.startsWith(prefix)) {
          return false;
        }
      }
    }

    return true;
  });

  // Both arrays are already sorted, just combine them
  return [...negative.map((p) => "!" + p), ...filteredPositive];
};

/**
 * Evaluate a policy expression
 * @param policy
 * @param permissions
 * @param _ttl safeguard to make sure policy won't evaluate forever
 */
export const Evaluate = (policy: Policy, permissions: string[], _ttl = 64) => {
  return RecursiveEvaluation(policy, permissions, EvaluateScalar, _ttl);
};

/**
 * Evaluate which prefixes from the set match the given permissions
 * Removes matching prefixes from the original set and returns them
 * @param prefixes Set of permission prefixes to check (mutated)
 * @param permissions Array of permission strings
 * @returns Array of prefixes that matched and were removed from the set
 */
export const EvaluatePrefixes = (
  prefixes: Set<string>,
  permissions: string[],
): string[] => {
  const matchingPrefixes: string[] = [];

  for (const prefix of prefixes) {
    if (EvaluatePrefixScalar(prefix, permissions)) {
      matchingPrefixes.push(prefix);
      prefixes.delete(prefix);
    }
  }

  return matchingPrefixes;
};

const RecursiveEvaluation = (
  policy: Policy,
  permissions: string[],
  scalar: (expr: string, permissions: string[]) => boolean,
  _ttl = 64,
) => {
  if (_ttl === 0) {
    return false;
  }
  const [op, ...expressions] = policy;

  const evaluate = (expr: string | Policy): boolean => {
    if (Array.isArray(expr)) {
      return RecursiveEvaluation(expr, permissions, scalar, _ttl - 1);
    } else {
      return scalar(expr, permissions);
    }
  };

  if (policy.length === 1) {
    return evaluate(op);
  } else if (op.toUpperCase() === "OR") {
    for (const expr of expressions) {
      if (evaluate(expr)) {
        return true;
      }
    }
    return false;
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
};

/**
 * Evaluate if user has any positive permission matching the given prefix
 * @param prefix The permission prefix to check (e.g., "admin")
 * @param preprocessed Already preprocessed permissions array
 * @returns True if user has any positive permission matching the prefix
 */
const EvaluatePrefixScalar = (
  prefix: string,
  preprocessed: string[],
): boolean => {
  // Check if this prefix is explicitly denied
  const negatedPrefix = "!" + prefix;
  const negatedPrefixIdx = BisectLeft(negatedPrefix, preprocessed);
  if (
    negatedPrefixIdx < preprocessed.length &&
    preprocessed[negatedPrefixIdx] === negatedPrefix
  ) {
    return false;
  }

  // Check if this prefix is denied by wildcard
  const negatedWildcard = "!" + prefix + ".*";
  const negatedWildcardIdx = BisectLeft(negatedWildcard, preprocessed);
  if (
    negatedWildcardIdx < preprocessed.length &&
    preprocessed[negatedWildcardIdx] === negatedWildcard
  ) {
    return false;
  }

  // Check for global wildcard
  const wildcardIdx = BisectLeft("*", preprocessed);
  if (wildcardIdx < preprocessed.length && preprocessed[wildcardIdx] === "*") {
    return true;
  }

  // Check for exact match
  const exactIdx = BisectLeft(prefix, preprocessed);
  if (exactIdx < preprocessed.length && preprocessed[exactIdx] === prefix) {
    return true;
  }

  // Check for prefix matches (prefix.anything)
  const prefixWithDot = prefix + ".";
  const prefixIdx = BisectLeft(prefixWithDot, preprocessed);

  // Check if the permission at this index starts with our prefix
  if (prefixIdx < preprocessed.length) {
    const perm = preprocessed[prefixIdx];
    if (!perm.startsWith("!") && perm.startsWith(prefixWithDot)) {
      return true;
    }
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
