import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient, ErrorReply } from "redis";
import { mockDeep } from "vitest-mock-extended";
import { RedisClientFactory } from "./redis.ts";

afterEach(() => vi.restoreAllMocks());

describe(RedisClientFactory, () => {
  it.each([false, true])(
    "reloads a cached script after NOSCRIPT (buffers: %s)",
    async (returnBuffers) => {
      const client = mockDeep<ReturnType<typeof createClient>>();
      const factory = new RedisClientFactory("redis://unused");
      vi.spyOn(factory, "getClient").mockResolvedValue(client);
      client.scriptLoad.mockResolvedValue("sha");
      const options = createClient().commandOptions({ returnBuffers: true });
      client.commandOptions.mockReturnValue(options);
      const result = "value";
      client.evalSha.mockResolvedValue(result);

      expect(
        await factory.executeScript(
          "return ARGV[1]",
          ["key"],
          ["value"],
          returnBuffers,
        ),
      ).toEqual(result);
      client.evalSha.mockRejectedValueOnce(
        new ErrorReply("NOSCRIPT No matching script. Please use EVAL."),
      );
      expect(
        await factory.executeScript(
          "return ARGV[1]",
          ["key"],
          ["value"],
          returnBuffers,
        ),
      ).toEqual(result);
      expect(client.scriptLoad).toHaveBeenCalledTimes(2);
      expect(client.scriptLoad).toHaveBeenLastCalledWith("return ARGV[1]");
      const args = ["sha", { keys: ["key"], arguments: ["value"] }];
      expect(client.evalSha).toHaveBeenLastCalledWith(
        ...(returnBuffers ? [options, ...args] : args),
      );

      await factory.executeScript(
        "return ARGV[1]",
        ["key"],
        ["value"],
        returnBuffers,
      );
      expect(client.scriptLoad).toHaveBeenCalledTimes(2);
    },
  );

  it("does not retry other Redis errors or retry NOSCRIPT indefinitely", async () => {
    const client = mockDeep<ReturnType<typeof createClient>>();
    const factory = new RedisClientFactory("redis://unused");
    vi.spyOn(factory, "getClient").mockResolvedValue(client);
    client.scriptLoad.mockResolvedValue("sha");
    const error = new ErrorReply("ERR script failed");
    client.evalSha.mockRejectedValue(error);
    await expect(factory.executeScript("return 1", [], [])).rejects.toBe(error);
    expect(client.scriptLoad).toHaveBeenCalledTimes(1);
    expect(client.evalSha).toHaveBeenCalledTimes(1);

    const missing = new ErrorReply("NOSCRIPT No matching script");
    client.evalSha.mockRejectedValue(missing);
    await expect(factory.executeScript("return 1", [], [])).rejects.toBe(
      missing,
    );
    expect(client.scriptLoad).toHaveBeenCalledTimes(2);
    expect(client.evalSha).toHaveBeenCalledTimes(3);
  });
});
