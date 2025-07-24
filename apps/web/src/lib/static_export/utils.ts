import type {
  PaginationParams,
  TeamFilterParams,
  UserFilterParams,
  Team,
  User,
} from "./types";

export function paginateEntries<T>(
  entries: T[],
  { page = 1, page_size = 60 }: PaginationParams,
): { entries: T[]; total: number; page: number; page_size: number } {
  const total = entries.length;
  const startIndex = (page - 1) * page_size;
  const paginatedEntries = entries.slice(startIndex, startIndex + page_size);

  return {
    entries: paginatedEntries,
    total,
    page,
    page_size,
  };
}

export function filterTeams(
  entries: Team[],
  { name, division_id, ids }: Omit<TeamFilterParams, "page" | "page_size">,
): Team[] {
  let filtered = entries;

  if (ids && Array.isArray(ids)) {
    filtered = filtered.filter((entry) => ids.includes(entry.id));
  }

  if (division_id !== undefined) {
    filtered = filtered.filter((entry) => entry.division_id === division_id);
  }

  if (name) {
    const searchTerm = name.toLowerCase();
    filtered = filtered.filter((entry) =>
      entry.name.toLowerCase().includes(searchTerm),
    );
  }

  return filtered;
}

export function filterUsers(
  entries: User[],
  { name, ids }: Omit<UserFilterParams, "page" | "page_size">,
): User[] {
  let filtered = entries;
  if (ids && Array.isArray(ids)) {
    filtered = filtered.filter((entry) => ids.includes(entry.id));
  }

  if (name) {
    const searchTerm = name.toLowerCase();
    filtered = filtered.filter((entry) =>
      entry.name.toLowerCase().includes(searchTerm),
    );
  }

  return filtered;
}

export function getDivisionFilePath(
  divisionId: string,
  filename: string,
): string {
  return `division:${divisionId}/${filename}`;
}
