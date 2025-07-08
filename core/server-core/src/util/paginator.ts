export type PaginateOptions = {
  max_page_size: number;
  default_page_size: number;
};

const DEFAULT_PAGINATE_OPTIONS: PaginateOptions = {
  max_page_size: 100,
  default_page_size: 50,
};

export const Paginate = async <Q, T>(
  query: Q,
  { page_size, page }: { page_size?: number; page?: number },
  queryFn: (
    q: Q,
    limit: { limit: number; offset: number },
  ) => T[] | Promise<T[]>,
  opts: Partial<PaginateOptions> = {},
): Promise<{
  entries: T[];
  page_size: number;
}> => {
  const o = { ...DEFAULT_PAGINATE_OPTIONS, ...opts };
  page = page || 1;
  page_size = page_size =
    o.max_page_size === 0
      ? page_size || o.default_page_size
      : Math.min(o.max_page_size, page_size || o.default_page_size);
  if (page < 0) {
    page = 1;
  }
  if (page_size < 0) {
    page_size = o.default_page_size;
  }
  const entries = await queryFn(query, {
    limit: page_size,
    offset: (page - 1) * page_size,
  });

  return {
    entries,
    page_size,
  };
};
