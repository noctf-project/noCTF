export interface AuthProvider {
  listProviders(): Promise<string[]>;
}