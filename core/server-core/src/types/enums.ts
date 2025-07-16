export enum UserFlag {
  VALID_EMAIL = "valid_email",
  BLOCKED = "blocked",
  HIDDEN = "hidden",
}

export enum UserRole {
  ADMIN = "admin",
  ACTIVE = "active",
  HAS_TEAM = "has_team",
  BLOCKED = "blocked",
}

export enum TeamFlag {
  BLOCKED = "blocked",
  HIDDEN = "hidden",
  FROZEN = "frozen",
}

export enum ActorType {
  USER = "user",
  SYSTEM = "sys",
  TEAM = "team",
  ANONYMOUS = "anonymous",
}

export enum EntityType {
  TEAM_TAG = "team_tag",
  POLICY = "policy",
  ANNOUNCEMENT = "announcement",
  DIVISION = "division",
  USER = "user",
  ROLE = "role",
  TEAM = "team",
}
