import type { paths } from "@noctf/openapi-spec";
import type { PathResponse } from "$lib/api/types";

// Team types
export type Team = PathResponse<"/teams/query", "post">["data"]["entries"][number];
export type TeamsQueryRequest = NonNullable<paths["/teams/query"]["post"]["requestBody"]>["content"]["application/json"];
export type TeamsQueryResponse = PathResponse<"/teams/query", "post">;

// User types
export type User = PathResponse<"/users/query", "post">["data"]["entries"][number];
export type UsersQueryRequest = NonNullable<paths["/users/query"]["post"]["requestBody"]>["content"]["application/json"];
export type UsersQueryResponse = PathResponse<"/users/query", "post">;

// Scoreboard types
export type ScoreboardResponse = PathResponse<"/scoreboard/divisions/{id}", "get">;
export type ScoreboardApiResponse = ScoreboardResponse["data"];
export type ScoreboardEntry = ScoreboardResponse["data"]["entries"][number];

// Challenge types
export type ChallengesResponse = PathResponse<"/challenges", "get">;
export type Challenge = ChallengesResponse["data"]["challenges"][number];
export type ChallengeDetailsResponse = PathResponse<"/challenges/{id}", "get">;
export type ChallengeSolvesResponse = PathResponse<"/challenges/{id}/solves", "get">;

// Other response types
export type AnnouncementsResponse = PathResponse<"/announcements", "get">;
export type Announcement = AnnouncementsResponse["data"]["entries"][number];

export type DivisionsResponse = PathResponse<"/divisions", "get">;
export type Division = DivisionsResponse["data"][number];

export type TeamTagsResponse = PathResponse<"/team_tags", "get">;
export type TeamTag = TeamTagsResponse["data"]["tags"][number];

export type SiteConfigResponse = PathResponse<"/site/config", "get">;
export type UserStatsResponse = PathResponse<"/stats/users", "get">;
export type ChallengeStatsResponse = PathResponse<"/stats/challenges", "get">;

// Pagination and filtering interfaces
export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface TeamFilterParams extends PaginationParams {
  name?: string;
  division_id?: number;
  ids?: number[];
}

export interface UserFilterParams extends PaginationParams {
  name?: string;
  ids?: number[];
}

// Generic paginated response
export interface PaginatedResponse<T> {
  data: {
    entries: T[];
    total: number;
    page: number;
    page_size: number;
  };
}

// Tagged scoreboards structure
export interface TaggedScoreboards {
  [tagKey: string]: ScoreboardResponse;
}

// Challenge solves structure (keyed by challenge ID)
export interface ChallengeSolves {
  [challengeId: string]: ChallengeSolvesResponse;
}
