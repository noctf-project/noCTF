import { describe, it, expect, vi, afterEach } from "vitest";
import { Paginate, type PaginateOptions } from "./paginator.ts";

describe("Paginate", () => {
  // Mock data for testing
  const mockData = Array.from({ length: 150 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
  }));

  // Mock query function that simulates database query with limit/offset
  const mockQueryFn = vi.fn(
    async (
      query: any,
      { limit, offset }: { limit: number; offset: number },
    ) => {
      return mockData.slice(offset, offset + limit);
    },
  );

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic functionality", () => {
    it("should return first page with default page size", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: 1 },
        mockQueryFn,
      );

      expect(result).toEqual({
        entries: mockData.slice(0, 50),
        page_size: 50,
      });
      expect(mockQueryFn).toHaveBeenCalledWith(
        { filter: "test" },
        { limit: 50, offset: 0 },
      );
    });

    it("should return second page with correct offset", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: 2, page_size: 20 },
        mockQueryFn,
      );

      expect(result).toEqual({
        entries: mockData.slice(20, 40),
        page_size: 20,
      });
      expect(mockQueryFn).toHaveBeenCalledWith(
        { filter: "test" },
        { limit: 20, offset: 20 },
      );
    });

    it("should work with custom page size", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: 1, page_size: 25 },
        mockQueryFn,
      );

      expect(result).toEqual({
        entries: mockData.slice(0, 25),
        page_size: 25,
      });
      expect(mockQueryFn).toHaveBeenCalledWith(
        { filter: "test" },
        { limit: 25, offset: 0 },
      );
    });
  });

  describe("Default values", () => {
    it("should default to page 1 when page is not provided", async () => {
      const result = await Paginate({ filter: "test" }, {}, mockQueryFn);

      expect(mockQueryFn).toHaveBeenCalledWith(
        { filter: "test" },
        { limit: 50, offset: 0 },
      );
    });

    it("should default to page 1 when page is null/undefined", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: undefined },
        mockQueryFn,
      );

      expect(mockQueryFn).toHaveBeenCalledWith(
        { filter: "test" },
        { limit: 50, offset: 0 },
      );
    });

    it("should use default page size when not provided", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: 1 },
        mockQueryFn,
      );

      expect(result.page_size).toBe(50);
    });
  });

  describe("Page size limits", () => {
    it("should enforce max page size limit", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: 1, page_size: 200 }, // Exceeds default max of 100
        mockQueryFn,
      );

      expect(result.page_size).toBe(100);
      expect(mockQueryFn).toHaveBeenCalledWith(
        { filter: "test" },
        { limit: 100, offset: 0 },
      );
    });

    it("should allow page size up to max limit", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: 1, page_size: 100 },
        mockQueryFn,
      );

      expect(result.page_size).toBe(100);
    });
  });

  describe("Custom options", () => {
    it("should use custom max page size", async () => {
      const customOpts: Partial<PaginateOptions> = {
        max_page_size: 200,
      };

      const result = await Paginate(
        { filter: "test" },
        { page: 1, page_size: 150 },
        mockQueryFn,
        customOpts,
      );

      expect(result.page_size).toBe(150);
    });

    it("should use custom default page size", async () => {
      const customOpts: Partial<PaginateOptions> = {
        default_page_size: 25,
      };

      const result = await Paginate(
        { filter: "test" },
        { page: 1 }, // No page_size provided
        mockQueryFn,
        customOpts,
      );

      expect(result.page_size).toBe(25);
    });

    it("should merge custom options with defaults", async () => {
      const customOpts: Partial<PaginateOptions> = {
        max_page_size: 75, // Custom max
        // default_page_size not provided, should use default of 50
      };

      const result = await Paginate(
        { filter: "test" },
        { page: 1, page_size: 80 }, // Exceeds custom max
        mockQueryFn,
        customOpts,
      );

      expect(result.page_size).toBe(75); // Should be limited by custom max
    });

    it("should allow unlimited page size when max_page_size is 0", async () => {
      const customOpts: Partial<PaginateOptions> = {
        max_page_size: 0, // Unlimited
      };

      const result = await Paginate(
        { filter: "test" },
        { page: 1, page_size: 500 }, // Very large page size
        mockQueryFn,
        customOpts,
      );

      expect(result.page_size).toBe(500); // Should allow the large page size
      expect(mockQueryFn).toHaveBeenCalledWith(
        { filter: "test" },
        { limit: 500, offset: 0 },
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle empty results", async () => {
      const emptyQueryFn = vi.fn(async () => []);

      const result = await Paginate(
        { filter: "empty" },
        { page: 1, page_size: 10 },
        emptyQueryFn,
      );

      expect(result).toEqual({
        entries: [],
        page_size: 10,
      });
    });

    it("should handle page beyond available data", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: 100, page_size: 10 }, // Way beyond available data
        mockQueryFn,
      );

      expect(result.entries.length).toBe(0);
      expect(mockQueryFn).toHaveBeenCalledWith(
        { filter: "test" },
        { limit: 10, offset: 990 },
      );
    });

    it("should handle zero page size by using default", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: 1, page_size: 0 },
        mockQueryFn,
      );

      expect(result.page_size).toBe(50); // Should fallback to default
    });

    it("should handle negative page size by using default", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: 1, page_size: -10 },
        mockQueryFn,
      );

      expect(result.page_size).toBe(50); // Should fallback to default
    });

    it("should handle negative page by defaulting to page 1", async () => {
      const result = await Paginate(
        { filter: "test" },
        { page: -5, page_size: 10 },
        mockQueryFn,
      );

      expect(mockQueryFn).toHaveBeenCalledWith(
        { filter: "test" },
        { limit: 10, offset: 0 }, // Should use page 1 (offset 0)
      );
    });
  });
});
