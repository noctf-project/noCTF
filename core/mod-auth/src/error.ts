import { NotFoundError } from "@noctf/server-core/errors";

export class UserNotFoundError extends NotFoundError {
  constructor(message = "User not found") {
    super(message);
  }
}
