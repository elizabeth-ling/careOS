import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, ApiResponseError, ApiUnreachableError } from "./api";
import { connection } from "./connection";

function respond(status: number, body: string, contentType = "application/json") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status, headers: { "content-type": contentType } })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  connection.markReachable();
});

describe("api client", () => {
  it("parses a valid response with the shared schema", async () => {
    respond(200, JSON.stringify({ status: "ok", database: "ok", aiMode: "simulated", demoMode: true }));
    await expect(api.health()).resolves.toMatchObject({ status: "ok" });
    expect(connection.isReachable()).toBe(true);
  });

  it("rejects a response that doesn't match the schema", async () => {
    respond(200, JSON.stringify({ status: "nope" }));
    await expect(api.health()).rejects.toBeInstanceOf(ApiResponseError);
  });

  it("surfaces the API's { error } message", async () => {
    respond(404, JSON.stringify({ error: "Patient not found." }));
    const error = await api.patient("00000000-0000-4000-8000-000000000000").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("Patient not found.");
    expect(connection.isReachable()).toBe(true);
  });

  it("treats a network failure as unreachable, and recovers on the next success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(api.health()).rejects.toBeInstanceOf(ApiUnreachableError);
    expect(connection.isReachable()).toBe(false);

    respond(200, JSON.stringify({ status: "ok", database: "ok", aiMode: "simulated", demoMode: true }));
    await api.health();
    expect(connection.isReachable()).toBe(true);
  });

  it("treats the dev proxy's non-JSON 500 as unreachable", async () => {
    respond(500, "", "text/plain");
    await expect(api.health()).rejects.toBeInstanceOf(ApiUnreachableError);
    expect(connection.isReachable()).toBe(false);
  });

  it("validates request bodies before sending", () => {
    expect(() => api.sendGuidance("00000000-0000-4000-8000-000000000000", { body: "   " })).toThrow();
  });
});
