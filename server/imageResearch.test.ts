import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("imageResearch.analyze", () => {
  const caller = appRouter.createCaller({
    user: undefined,
    req: {} as any,
    res: {} as any,
  });

  it("rejects an empty image payload before calling the model", async () => {
    await expect(caller.imageResearch.analyze({ imageData: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an oversized image payload", async () => {
    await expect(caller.imageResearch.analyze({ imageData: "data:image/png;base64," + "a".repeat(8_000_000) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
