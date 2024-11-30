import { AuthService } from "./auth";
import { DatabaseService } from "./database";

export interface ServiceCradle {
  authService: AuthService;
  databaseService: DatabaseService;
}