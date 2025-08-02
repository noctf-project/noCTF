# Policies

Policies in noCTF allow administrators to define fine-grained **RBAC (Role-Based Access Control)**
permissions for users. These are flexible permission structures that determine what actions users
can or cannot perform in the system.

## Permissions Required

Only users with the `admin.policy.manage` permission can **create, edit, or delete** policies.

Treat this as a **superuser-level** permission, it allows full control over access rules across the
platform as well as as promoting and demoting users.

## What is a Policy?

A **Policy** is a set of access rules that applies to **users** based on their roles. Each policy
includes:

- **Name** - A human-readable identifier.
- **Description** - Notes about what the policy does.
- **Match Roles** - Roles that activate (match) the policy.
- **Omit Roles** - Roles that exclude a user from matching the policy. Omit roles take precedence
  over match roles.
- **Permissions** - A newline-separated list of allowed or denied permissions.
- **Is Public** - A boolean flag that matches unauthenticated users.
- **Enabled** - Whether a policy is currently enabled.


## Defining Permissions

Permissions in noCTF are expressed as **FQDN-style strings**, and only support wildcards at the end.

Examples:
- `admin.user.*` → matches `admin.user.get`, `admin.user.update`, etc.
- `!admin.user.delete` → explicitly denies the `delete` action, even if other actions are allowed.

Combined Example:

```text
admin.user.*
!admin.user.delete
```

This allows a user to view and update users but **not** delete them. Currently the list of
permissions is not fully documented. Please consult the codebase to find out what permissions are
required for each API call.

## Pseudo Roles

In addition to regular roles, noCTF includes built-in **pseudo roles**:

| Pseudo Role | Condition |
| ----------- | --------- |
| `active`    | User has a `valid_email` flag or email verification is disabled, and is not `blocked` |
| `has_team`  | User belongs to a team |
| `blocked`   | User has a `blocked` flag |

Use these in your match/omit rules for more dynamic and context-aware access control.


## Example Policy

**Name**: user_manager

**Description**: Allows a user with the role to manage user accounts, except deletion and viewing
  identity information

**Match Roles**: `organiser`

**Permissions**:
```text
admin.user.*
!admin.user.delete
```
