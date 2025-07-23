import type { Middleware } from "openapi-fetch";
import {
  paginateEntries,
  filterTeams,
  filterUsers,
  getDivisionFilePath,
} from "./utils";
import { STATIC_EXPORT_CONFIG, STATIC_ROUTES, STATIC_FILES } from "./config";
import type {
  TeamsQueryRequest,
  TeamsQueryResponse,
  UsersQueryRequest,
  UsersQueryResponse,
  ScoreboardResponse,
  ChallengeSolves,
  ChallengeDetailsResponse,
  AnnouncementsResponse,
  ChallengesResponse,
  DivisionsResponse,
  TeamTagsResponse,
  SiteConfigResponse,
  UserStatsResponse,
  ChallengeStatsResponse,
  ChallengeSolvesResponse,
  Team,
  ScoreboardEntry,
} from "./types";

export const IS_STATIC_EXPORT = STATIC_EXPORT_CONFIG.enabled;

class StaticExportHandler {
  private cache = new Map<string, unknown>();
  private baseUrl = STATIC_EXPORT_CONFIG.baseUrl;
  private teamsMap = new Map<number, Team>();
  private scoreboardMap = new Map<number, ScoreboardEntry>();
  private taggedScoreboardsCache = new Map<string, ScoreboardResponse>();
  private setupPromise: Promise<void> | null = null;

  constructor() {
    this.ensureSetup();
  }

  async ensureSetup() {
    if (this.setupPromise) return this.setupPromise;

    this.setupPromise = this.setup();

    try {
      await this.setupPromise;
    } catch (err) {
      this.setupPromise = null;
      throw err;
    }
  }

  private async setup() {
    const teamsData = await this.loadStaticFile<TeamsQueryResponse>(
      STATIC_FILES.TEAMS,
    );
    if (!teamsData?.data?.entries) {
      throw new Error("Teams data not available in static export");
    }
    this.teamsMap = new Map(teamsData.data.entries.map((val) => [val.id, val]));

    // TODO: handle multiple divisions
    const scoreboard = await this.loadStaticFile<ScoreboardResponse>(
      getDivisionFilePath("1", STATIC_FILES.SCOREBOARD),
    );
    if (!scoreboard) {
      throw new Error("Scoreboard data not available in static export");
    }
    this.scoreboardMap = new Map(
      scoreboard.data.entries.map((val) => [val.team_id, val]),
    );
  }

  async loadStaticFile<T = unknown>(path: string): Promise<T | null> {
    if (this.cache.has(path)) {
      return this.cache.get(path) as T;
    }

    try {
      const response = await fetch(`${this.baseUrl}/${path}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Static file not found: ${this.baseUrl}/${path}`);
          return null;
        }
        throw new Error(
          `Failed to load ${path}: ${response.status} ${response.statusText}`,
        );
      }
      const data = (await response.json()) as T;

      this.cache.set(path, data);

      return data;
    } catch (error) {
      console.error(`Error loading static file ${path}:`, error);
      throw error;
    }
  }

  async handleTeamsQuery(body: TeamsQueryRequest): Promise<TeamsQueryResponse> {
    const teamsData = await this.loadStaticFile<TeamsQueryResponse>(
      STATIC_FILES.TEAMS,
    );
    if (!teamsData?.data?.entries) {
      throw new Error("Teams data not available in static export");
    }

    const {
      page = 1,
      page_size = STATIC_EXPORT_CONFIG.defaultPageSize,
      name,
      division_id,
      ids,
    } = body;

    if (ids) {
      await this.ensureSetup();
      return {
        data: {
          entries: ids.map((id) => this.teamsMap.get(id)!),
          page_size: page_size,
          total: teamsData.data.total,
        },
      };
    }

    const limitedPageSize = Math.min(
      page_size,
      STATIC_EXPORT_CONFIG.maxPageSize,
    );

    const filteredEntries = filterTeams(teamsData.data.entries, {
      name,
      division_id,
      ids,
    });

    const paginatedResult = paginateEntries(filteredEntries, {
      page,
      page_size: limitedPageSize,
    });

    return { data: paginatedResult };
  }

  async handleUsersQuery(body: UsersQueryRequest): Promise<UsersQueryResponse> {
    const usersData = await this.loadStaticFile<UsersQueryResponse>(
      STATIC_FILES.USERS,
    );
    if (!usersData?.data?.entries) {
      throw new Error("Users data not available in static export");
    }

    const {
      page = 1,
      page_size = STATIC_EXPORT_CONFIG.defaultPageSize,
      name,
      ids,
    } = body;

    const limitedPageSize = Math.min(
      page_size,
      STATIC_EXPORT_CONFIG.maxPageSize,
    );

    const filteredEntries = filterUsers(usersData.data.entries, {
      name,
      ids,
    });

    const paginatedResult = paginateEntries(filteredEntries, {
      page,
      page_size: limitedPageSize,
    });

    return { data: paginatedResult };
  }

  private computeTaggedScoreboard(
    baseScoreboard: ScoreboardResponse,
    tags: number[],
  ): ScoreboardResponse {
    const tagSet = new Set(tags);

    const filteredEntries = baseScoreboard.data.entries.filter((entry) =>
      entry.tag_ids.some((tagId) => tagSet.has(tagId)),
    );

    const sortedEntries = filteredEntries.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return (
        new Date(a.last_solve).getTime() - new Date(b.last_solve).getTime()
      );
    });

    const rankedEntries = sortedEntries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    return {
      data: {
        entries: rankedEntries,
        page_size: baseScoreboard.data.page_size,
        total: rankedEntries.length,
      },
    };
  }

  async handleScoreboardQuery(
    divisionId: string,
    params: URLSearchParams,
  ): Promise<ScoreboardResponse> {
    const tagsParam = params.getAll("tags");

    const page = Math.max(1, parseInt(params.get("page") || "1", 10));
    const pageSize = Math.min(
      Math.max(
        1,
        parseInt(
          params.get("page_size") ||
            STATIC_EXPORT_CONFIG.defaultPageSize.toString(),
          10,
        ),
      ),
      STATIC_EXPORT_CONFIG.maxPageSize,
    );

    let baseScoreboard: ScoreboardResponse;

    if (tagsParam.length) {
      const tags = tagsParam
        .map((v) => parseInt(v))
        .filter((v) => !isNaN(v))
        .sort((a, b) => a - b);
      const tagKey = `${divisionId}:${tags.join(",")}`;

      if (this.taggedScoreboardsCache.has(tagKey)) {
        baseScoreboard = this.taggedScoreboardsCache.get(tagKey)!;
      } else {
        const mainScoreboard = await this.loadStaticFile<ScoreboardResponse>(
          getDivisionFilePath(divisionId, STATIC_FILES.SCOREBOARD),
        );
        if (!mainScoreboard) {
          throw new Error(
            `Scoreboard not available for division ${divisionId}`,
          );
        }

        baseScoreboard = this.computeTaggedScoreboard(mainScoreboard, tags);

        this.taggedScoreboardsCache.set(tagKey, baseScoreboard);
      }
    } else {
      const scoreboard = await this.loadStaticFile<ScoreboardResponse>(
        getDivisionFilePath(divisionId, STATIC_FILES.SCOREBOARD),
      );
      if (!scoreboard) {
        throw new Error(`Scoreboard not available for division ${divisionId}`);
      }
      baseScoreboard = scoreboard;
    }

    const allEntries = baseScoreboard.data.entries;
    const totalEntries = allEntries.length;

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedEntries = allEntries.slice(startIndex, endIndex);

    return {
      data: {
        entries: paginatedEntries,
        page_size: pageSize,
        total: totalEntries,
      },
    };
  }

  async handleScoreboardTeamQuery(
    teamId: string,
    _params: URLSearchParams,
  ): Promise<{ data: ScoreboardEntry }> {
    await this.ensureSetup();
    // TODO: should get division id from team data
    return { data: this.scoreboardMap.get(parseInt(teamId))! };
  }

  async handleChallengeDetails(
    challengeId: string,
  ): Promise<ChallengeDetailsResponse> {
    const challengeDetails = await this.loadStaticFile<
      ChallengeDetailsResponse[]
    >(STATIC_FILES.CHALLENGE_DETAILS);
    if (!challengeDetails || !Array.isArray(challengeDetails)) {
      throw new Error("Challenge details not available in static export");
    }

    const challenge = challengeDetails.find(
      (c) => c.data?.id === parseInt(challengeId),
    );
    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found in static export`);
    }

    return challenge;
  }

  async handleChallengeSolves(
    challengeId: string,
    divisionId: string,
  ): Promise<ChallengeSolvesResponse> {
    const challengeSolves = await this.loadStaticFile<ChallengeSolves>(
      getDivisionFilePath(divisionId, STATIC_FILES.CHALLENGE_SOLVES),
    );
    if (!challengeSolves) {
      throw new Error(
        `Challenge solves not available for division ${divisionId}`,
      );
    }

    const solves = challengeSolves[challengeId];
    if (!solves) {
      throw new Error(
        `No solves found for challenge ${challengeId} in division ${divisionId}`,
      );
    }

    return solves;
  }

  async handleChallengeStats(
    divisionId: string,
  ): Promise<ChallengeStatsResponse> {
    const stats = await this.loadStaticFile<ChallengeStatsResponse>(
      getDivisionFilePath(divisionId, STATIC_FILES.CHALLENGE_STATS),
    );
    if (!stats) {
      throw new Error(
        `Challenge stats not available for division ${divisionId}`,
      );
    }
    return stats;
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toLowerCase();

    try {
      const body: unknown = JSON.parse((await request.text()) || "{}");

      let result: unknown = null;

      if (path === STATIC_ROUTES.TEAMS_QUERY && method === "post") {
        result = await this.handleTeamsQuery(body as TeamsQueryRequest);
      } else if (path === STATIC_ROUTES.USERS_QUERY && method === "post") {
        result = await this.handleUsersQuery(body as UsersQueryRequest);
      } else if (
        path.match(STATIC_ROUTES.SCOREBOARD_DIVISION) &&
        method === "get"
      ) {
        const match = path.match(STATIC_ROUTES.SCOREBOARD_DIVISION);
        if (match?.[1]) {
          result = await this.handleScoreboardQuery(match[1], url.searchParams);
        }
      } else if (
        path.match(STATIC_ROUTES.SCOREBOARD_TEAM) &&
        method === "get"
      ) {
        const match = path.match(STATIC_ROUTES.SCOREBOARD_TEAM);
        if (match?.[1]) {
          result = await this.handleScoreboardTeamQuery(
            match[1],
            url.searchParams,
          );
        }
      } else if (path === STATIC_ROUTES.ANNOUNCEMENTS && method === "get") {
        result = await this.loadStaticFile<AnnouncementsResponse>(
          STATIC_FILES.ANNOUNCEMENTS,
        );
      } else if (path === STATIC_ROUTES.CHALLENGES && method === "get") {
        result = await this.loadStaticFile<ChallengesResponse>(
          STATIC_FILES.CHALLENGES,
        );
      } else if (path === STATIC_ROUTES.DIVISIONS && method === "get") {
        result = await this.loadStaticFile<DivisionsResponse>(
          STATIC_FILES.DIVISIONS,
        );
      } else if (path === STATIC_ROUTES.TEAM_TAGS && method === "get") {
        result = await this.loadStaticFile<TeamTagsResponse>(
          STATIC_FILES.TEAM_TAGS,
        );
      } else if (path === STATIC_ROUTES.SITE_CONFIG && method === "get") {
        result = await this.loadStaticFile<SiteConfigResponse>(
          STATIC_FILES.SITE_CONFIG,
        );
      } else if (path === STATIC_ROUTES.USER_STATS && method === "get") {
        result = await this.loadStaticFile<UserStatsResponse>(
          STATIC_FILES.USER_STATS,
        );
      } else if (path === STATIC_ROUTES.CHALLENGE_STATS && method === "get") {
        const divisionId = url.searchParams.get("division_id");
        if (divisionId) {
          result = await this.handleChallengeStats(divisionId);
        } else {
          throw new Error(
            "division_id parameter is required for challenge stats",
          );
        }
      } else if (
        path.match(STATIC_ROUTES.CHALLENGE_DETAILS) &&
        method === "get"
      ) {
        const match = path.match(STATIC_ROUTES.CHALLENGE_DETAILS);
        if (match?.[1]) {
          result = await this.handleChallengeDetails(match[1]);
        }
      } else if (
        path.match(STATIC_ROUTES.CHALLENGE_SOLVES) &&
        method === "get"
      ) {
        const match = path.match(STATIC_ROUTES.CHALLENGE_SOLVES);
        const challengeId = match?.[1];
        const divisionId = url.searchParams.get("division_id") || "1";
        if (challengeId && divisionId) {
          result = await this.handleChallengeSolves(challengeId, divisionId);
        } else {
          throw new Error(
            "Both challenge ID and division_id are required for challenge solves",
          );
        }
      } else {
        throw new Error(`Unsupported route: ${method.toUpperCase()} ${path}`);
      }

      if (result === null) {
        throw new Error(
          `No data returned for route: ${method.toUpperCase()} ${path}`,
        );
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, immutable",
        },
      });
    } catch (error) {
      console.error(
        `Static export error for ${method.toUpperCase()} ${path}:`,
        error,
      );

      return new Response(
        JSON.stringify({
          error: "Static export error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load static data",
          path,
          method: method.toUpperCase(),
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  }
}

const staticHandler = new StaticExportHandler();

export const staticExportMiddleware: Middleware = {
  async onRequest({ request }) {
    if (!IS_STATIC_EXPORT) {
      console.warn("Static export is disabled but middleware was called");
      return request;
    }

    return await staticHandler.handleRequest(request);
  },
};
