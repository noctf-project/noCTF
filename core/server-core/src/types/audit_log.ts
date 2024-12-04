// Common audit log operations
export enum AuditLogOperation {
  UserCreate = "user.create",
  UserUpdate = "user.update",
  UserDelete = "user.delete",
  UserPasswordSet = "user.password.set",

  ConfigUpdate = "config.update",

  ChallengeCreate = "challenge.create",
  ChallengeUpdate = "challenge.update",
  ChallengeDelete = "challenge.delete",

  TeamCreate = "team.create",
  TeamUpdate = "team.update",
  TeamDelete = "team.delete",
  TeamJoin = "team.join",
  TeamFreeze = "team.freeze",
}
