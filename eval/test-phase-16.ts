/**
 * Phase 16 – Multi-Profile Foundation
 *
 * Verifies:
 *   1. Migration 006 adds is_primary, updated_at to profiles
 *   2. Profile API: list, create, update (metadata), delete
 *   3. Extract API accepts profile_id in request body
 *
 * Prerequisite for API tests: npx vercel dev running on port 3000.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = "http://localhost:3000";

async function fetchApi(
  path: string,
  opts?: { method?: string; body?: unknown }
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const init: RequestInit = {
    method: opts?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
  };
  if (opts?.body) {
    init.body = JSON.stringify(opts.body);
  }
  return fetch(url, init);
}

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      passed++;
      console.log(`✓ ${name}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${name}\n  ${msg}`);
    }
  }

  // ── 1. Migration file content ─────────────────────────────────────
  await test("1a: migration 006 adds is_primary column", async () => {
    const migrationPath = join(process.cwd(), "docs", "migrations", "006_multi_profile.sql");
    const sql = readFileSync(migrationPath, "utf-8");
    if (!sql.includes("is_primary")) {
      throw new Error("Migration must add is_primary column");
    }
  });

  await test("1b: migration 006 adds updated_at column", async () => {
    const migrationPath = join(process.cwd(), "docs", "migrations", "006_multi_profile.sql");
    const sql = readFileSync(migrationPath, "utf-8");
    if (!sql.includes("updated_at")) {
      throw new Error("Migration must add updated_at column");
    }
  });

  await test("1c: migration 006 creates idx_profiles_is_primary", async () => {
    const migrationPath = join(process.cwd(), "docs", "migrations", "006_multi_profile.sql");
    const sql = readFileSync(migrationPath, "utf-8");
    if (!sql.includes("idx_profiles_is_primary")) {
      throw new Error("Migration must create index on is_primary");
    }
  });

  // ── 2. Profile API (requires server) ──────────────────────────────
  await test("2a: GET /api/profile?action=list returns profiles array", async () => {
    const res = await fetchApi("/api/profile?action=list");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { profiles?: unknown[] };
    if (!Array.isArray(json.profiles)) {
      throw new Error("Response must have profiles array");
    }
  });

  await test("2b: POST /api/profile creates profile with name", async () => {
    const name = `Phase16-Test-${Date.now()}`;
    const res = await fetchApi("/api/profile", {
      method: "POST",
      body: { name },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { profile?: { id?: string; display_name?: string } };
    if (!json.profile?.id || json.profile.display_name !== name) {
      throw new Error("Created profile must have id and display_name");
    }
  });

  await test("2c: PATCH /api/profile?id=... updates display_name", async () => {
    // Create a profile first
    const name = `Phase16-Patch-${Date.now()}`;
    const createRes = await fetchApi("/api/profile", {
      method: "POST",
      body: { name },
    });
    if (!createRes.ok) throw new Error(`Create failed: ${await createRes.text()}`);
    const createJson = (await createRes.json()) as { profile?: { id?: string } };
    const id = createJson.profile?.id;
    if (!id) throw new Error("No profile id from create");

    const newName = `${name}-updated`;
    const patchRes = await fetchApi(`/api/profile?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { display_name: newName },
    });
    if (!patchRes.ok) {
      throw new Error(`PATCH failed: ${await patchRes.text()}`);
    }
    const patchJson = (await patchRes.json()) as { profile?: { display_name?: string } };
    if (patchJson.profile?.display_name !== newName) {
      throw new Error(`Expected display_name ${newName}, got ${patchJson.profile?.display_name}`);
    }
  });

  await test("2d: DELETE /api/profile?id=... returns 200", async () => {
    const name = `Phase16-Delete-${Date.now()}`;
    const createRes = await fetchApi("/api/profile", {
      method: "POST",
      body: { name },
    });
    if (!createRes.ok) throw new Error(`Create failed: ${await createRes.text()}`);
    const createJson = (await createRes.json()) as { profile?: { id?: string } };
    const id = createJson.profile?.id;
    if (!id) throw new Error("No profile id from create");

    const delRes = await fetchApi(`/api/profile?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!delRes.ok) {
      throw new Error(`DELETE failed: ${await delRes.text()}`);
    }
  });

  // ── 3. Extract API with profile_id ─────────────────────────────────
  await test("3a: POST /api/extract with profile_id returns 200", async () => {
    const res = await fetchApi("/api/extract", {
      method: "POST",
      body: {
        rawText: "magnesium with metformin",
        profile_id: "a0000000-0000-0000-0000-000000000001",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { events?: unknown[] };
    if (!Array.isArray(json.events)) {
      throw new Error("Extract response must have events array");
    }
  });

  await test("3b: POST /api/extract without profile_id still works (fallback)", async () => {
    const res = await fetchApi("/api/extract", {
      method: "POST",
      body: { rawText: "vitamin D" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { events?: unknown[] };
    if (!Array.isArray(json.events)) {
      throw new Error("Extract response must have events array");
    }
  });

  // ── Summary ───────────────────────────────────────────────────────
  console.log("\n---");
  console.log(`Phase 16: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
