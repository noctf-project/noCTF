export interface StaticExportConfig {
  enabled: boolean;
  baseUrl: string;
  defaultPageSize: number;
  maxPageSize: number;
}

export const STATIC_EXPORT_CONFIG: StaticExportConfig = {
  enabled: !!import.meta.env.VITE_IS_STATIC_EXPORT || true,
  baseUrl: "/export",
  defaultPageSize: 60,
  maxPageSize: 1000,
};

export const STATIC_ROUTES = {
  // Query endpoints (POST)
  TEAMS_QUERY: "/teams/query",
  USERS_QUERY: "/users/query",

  // GET endpoints
  ANNOUNCEMENTS: "/announcements",
  CHALLENGES: "/challenges",
  DIVISIONS: "/divisions",
  TEAM_TAGS: "/team_tags",
  SITE_CONFIG: "/site/config",
  USER_STATS: "/stats/users",

  // Parameterized endpoints
  SCOREBOARD_DIVISION: /^\/scoreboard\/divisions\/(\d+)$/,
  SCOREBOARD_TEAM: /^\/scoreboard\/teams\/(\d+)$/,
  CHALLENGE_DETAILS: /^\/challenges\/(\d+)$/,
  CHALLENGE_SOLVES: /^\/challenges\/(\d+)\/solves$/,
  CHALLENGE_STATS: "/stats/challenges",
} as const;

export const STATIC_FILES = {
  ANNOUNCEMENTS: "announcements.json",
  CHALLENGES: "challenges.json",
  CHALLENGE_DETAILS: "challenge_details.json",
  DIVISIONS: "divisions.json",
  TEAM_TAGS: "team_tags.json",
  TEAMS: "teams.json",
  USERS: "users.json",
  SITE_CONFIG: "site_config.json",
  USER_STATS: "user_stats.json",

  // Division-specific files
  SCOREBOARD: "scoreboard.json",
  TAGGED_SCOREBOARDS: "tagged_scoreboards.json",
  CHALLENGE_SOLVES: "challenge_solves.json",
  CHALLENGE_STATS: "challenge_stats.json",
} as const;
