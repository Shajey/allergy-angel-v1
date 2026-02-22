/**
 * Phase 15.3x – Vigilance Integration Tests
 *
 * Hits live /api/vigilance on localhost:3000.
 * Verifies determinism, shape, window filtering, pressureSources sorting.
 *
 * Prerequisite: npx vercel dev running on port 3000.
 */

const BASE_URL = "http://localhost:3000";
const PROFILE_ID = "a0000000-0000-0000-0000-000000000001";

async function getVigilance(windowHours?: number): Promise<Record<string, unknown>> {
  const url = new URL("/api/vigilance", BASE_URL);
  url.searchParams.set("profileId", PROFILE_ID);
  if (windowHours !== undefined) {
    url.searchParams.set("windowHours", String(windowHours));
  }

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to reach ${BASE_URL}. Make sure to run: npx vercel dev\n${msg}`
    );
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
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

  {
    // ── A) Determinism test ─────────────────────────────────────────────
    await test("A: two calls → identical JSON", async () => {
      const r1 = await getVigilance();
      const r2 = await getVigilance();
      const j1 = JSON.stringify(r1);
      const j2 = JSON.stringify(r2);
      if (j1 !== j2) {
        throw new Error("Two consecutive calls produced different JSON");
      }
    });

    // ── B) Shape test ────────────────────────────────────────────────────
    await test("B: response shape (vigilanceScore, pressureSources, aggregation.components)", async () => {
      const r = await getVigilance();
      if (typeof r.vigilanceScore !== "number") {
        throw new Error(`vigilanceScore must be number; got ${typeof r.vigilanceScore}`);
      }
      if (!Array.isArray(r.pressureSources)) {
        throw new Error(`pressureSources must be array; got ${typeof r.pressureSources}`);
      }
      const agg = r.aggregation as Record<string, unknown> | undefined;
      if (!agg || !Array.isArray(agg.components)) {
        throw new Error("aggregation.components must be array");
      }
    });

    // ── C) Short window test ─────────────────────────────────────────────
    await test("C: windowHours=1 → empty state (no checks in 1h)", async () => {
      const r = await getVigilance(1);
      if (r.vigilanceScore !== 0) {
        throw new Error(`vigilanceScore expected 0; got ${r.vigilanceScore}`);
      }
      if (r.vigilanceActive !== false) {
        throw new Error(`vigilanceActive expected false; got ${r.vigilanceActive}`);
      }
      const ps = r.pressureSources as unknown[];
      if (ps.length !== 0) {
        throw new Error(`pressureSources expected empty; got ${ps.length} items`);
      }
      const agg = r.aggregation as Record<string, unknown> | undefined;
      const comp = agg?.components as unknown[];
      if (!comp || comp.length !== 0) {
        throw new Error(`aggregation.components expected empty; got ${comp?.length ?? "?"}`);

      }
    });

    // ── D) PressureSources sorted test ──────────────────────────────────
    await test("D: pressureSources sorted (weightedScore desc, count desc, term asc)", async () => {
      const r = await getVigilance();
      const ps = r.pressureSources as Array<{ weightedScore?: number; count?: number; term?: string }>;
      if (!Array.isArray(ps) || ps.length < 2) return;

      for (let i = 1; i < ps.length; i++) {
        const prev = ps[i - 1];
        const curr = ps[i];
        const wsPrev = prev.weightedScore ?? 0;
        const wsCurr = curr.weightedScore ?? 0;
        if (wsCurr > wsPrev) {
          throw new Error(
            `pressureSources not sorted by weightedScore desc: [${i - 1}]=${wsPrev} < [${i}]=${wsCurr}`
          );
        }
        if (wsCurr === wsPrev) {
          const cPrev = prev.count ?? 0;
          const cCurr = curr.count ?? 0;
          if (cCurr > cPrev) {
            throw new Error(
              `pressureSources not sorted by count desc (tie): [${i - 1}]=${cPrev} < [${i}]=${cCurr}`
            );
          }
          if (cCurr === cPrev) {
            const tPrev = prev.term ?? "";
            const tCurr = curr.term ?? "";
            if (tCurr < tPrev) {
              throw new Error(
                `pressureSources not sorted by term asc (tie): [${i - 1}]="${tPrev}" > [${i}]="${tCurr}"`
              );
            }
          }
        }
      }
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Failed: ${msg}`);
  if (msg.includes("fetch") || msg.includes("ECONNREFUSED")) {
    console.error("\nMake sure to run: npx vercel dev");
  }
  process.exit(1);
});
