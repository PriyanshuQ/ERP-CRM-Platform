import { describe, expect, it, vi } from "vitest";
import { healthHandler } from "./app.js";

describe("health endpoint", () => {
  it("reports that the API is running", async () => {
    const response = { json: vi.fn() };

    expect(healthHandler({} as never, response as never)).toBeUndefined();
    expect(response.json).toHaveBeenCalledWith({
      status: "ok",
      service: "erp-crm-api"
    });
  });
});
