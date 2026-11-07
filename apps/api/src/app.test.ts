import { errorResponseSchema } from "@careos/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { buildGuidanceDrafts } from "./services/guidanceDrafts";

// None of these reach the database: they stop at routing or validation.
const app = createApp({ demoMode: false });
const missing = "00000000-0000-4000-8000-000000000000";

async function expectError(response: Response, status: number) {
  expect(response.status).toBe(status);
  const text = await response.text();
  expect(errorResponseSchema.parse(JSON.parse(text))).toBeTruthy();
  expect(text).not.toMatch(/\bat .+:\d+:\d+|node_modules|\.ts\b|prisma/i);
}

describe("errors", () => {
  it("returns JSON for an unknown route", async () => {
    await expectError(await app.request("/api/nope"), 404);
  });

  it.each(["../../etc/passwd", "not-a-uuid", "..%2f..%2fetc%2fpasswd"])("rejects the id %s", async (id) => {
    const response = await app.request(`/api/audio/${id}`);
    expect([400, 404]).toContain(response.status);
    expect(errorResponseSchema.safeParse(await response.json()).success).toBe(true);
  });

  it("rejects a malformed patient id", async () => {
    await expectError(await app.request("/api/patients/not-a-uuid"), 400);
  });

  it("rejects an unknown queue filter", async () => {
    await expectError(await app.request("/api/nurse/queue?filter=everyone"), 400);
  });

  it("rejects malformed JSON", async () => {
    const response = await app.request(`/api/check-ins/${missing}/guidance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    await expectError(response, 400);
  });

  it("rejects empty guidance", async () => {
    const response = await app.request(`/api/check-ins/${missing}/guidance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "   " }),
    });
    await expectError(response, 400);
  });

  it("rejects an unknown simulate kind", async () => {
    const response = await app.request("/api/check-ins/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "nonsense" }),
    });
    await expectError(response, 400);
  });

  it("refuses a check-in that isn't multipart", async () => {
    const response = await app.request("/api/check-ins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    await expectError(response, 400);
  });
});

describe("demo mode", () => {
  it("refuses a reset unless DEMO_MODE is on", async () => {
    await expectError(await app.request("/api/demo/reset", { method: "POST" }), 403);
  });
});

describe("CORS", () => {
  it("allows only the configured web origin", async () => {
    const allowed = await app.request("/api/nope", { headers: { origin: "http://localhost:5173" } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const other = await app.request("/api/nope", { headers: { origin: "https://example.com" } });
    expect(other.headers.get("access-control-allow-origin")).not.toBe("https://example.com");
  });
});

describe("guidance drafts", () => {
  it("gives Walter's caregiver the spec's wording", () => {
    const drafts = buildGuidanceDrafts("Sarah Morrison", ["New confusion", "Appetite ↓ 3 wks"]);
    expect(drafts.map((draft) => draft.kind)).toEqual(["detailed", "reassurance", "escalation"]);
    expect(drafts[0]?.body).toBe(
      "Thanks Sarah. New confusion plus lower appetite is worth checking. Can you look for signs of a UTI (fever, burning, going more often) and offer extra fluids? I'll call you today at 4 PM.",
    );
    expect(drafts[2]?.body).toContain("811");
  });

  it("tells the family to call 911 for an emergency", () => {
    expect(buildGuidanceDrafts("Sarah Morrison", ["Emergency terms"])[0]?.body).toContain("911");
  });
});
