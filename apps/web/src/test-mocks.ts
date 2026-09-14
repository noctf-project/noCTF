import { vi } from "vitest";

export const goto = vi.fn();
export const invalidate = vi.fn();
export const invalidateAll = vi.fn();
export const beforeNavigate = vi.fn();
export const afterNavigate = vi.fn();

export const browser = true;
export const dev = true;
export const building = false;
export const version = "test";

export const base = "";
export const assets = "";
