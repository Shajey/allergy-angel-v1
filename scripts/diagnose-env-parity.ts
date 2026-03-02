#!/usr/bin/env tsx
/**
 * Phase 0.9 – Env Parity & End-to-End Diagnostics Harness
 *
 * Validates Allergy Angel behaves consistently across:
 *   1) npm run dev (Vite on 5173, API proxied to Vercel dev)
 *   2) npx vercel dev (Vercel serverless emulation on 3000)
 *   3) Production (https://allergy-angel.vercel.app)
 *
 * Diagnoses: vigilanceActive: false / empty pressureSources when risk expected.
 * Root causes: no recent checks? checks saved but risk none? profile allergies
 * not persisted? env drift between DBs? endpoint misroutes?
 *
 * Usage:
 *   npm run diagnose:env
 *
 * Prerequisites:
 *   - Terminal A: npm run dev -- --port 5173
 *   - Terminal B: npx vercel dev (port 3000)
 *
 * Optional env vars:
 *   VITE_URL        – Vite dev base (default: http://localhost:5173)
 *   VERCEL_DEV_URL – Vercel dev base (default: http://localhost:3000)
 *   PROD_URL       – Production base (default: https://allergy-angel.vercel.app)
 *   PROFILE_ID     – Override profile UUID (default: from .env.local DEFAULT_PROFILE_ID)
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── Config ────────────────────────────────────────────────────────────────

const VITE_URL = process.env.VITE_URL ?? "http://localhost:5173";
const VERCEL_DEV_URL = process.env.VERCEL_DEV_URL ?? "http://localhost:3000";
const PROD_URL = process.env.PROD_URL ?? "https://allergy-angel.vercel.app";

function loadProfileId(): string {
  const override = process.env.PROFILE_ID;
  if (override) return override;
  const envPath = resolve(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    const m = content.match(/^DEFAULT_PROFILE_ID=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "a0000000-0000-0000-0000-000000000001";
}

const PROFILE_ID = loadProfileId();
const WINDOW_HOURS = 12;

// ── Types ────────────────────────────────────────────────────────────────

interface ProbeResult {
  label: string;
  baseUrl: string;
  reachable: boolean;
  profile?: { id: string; known_allergies: string[] };
  vigilance?: {
    vigilanceActive: boolean;
    vigilanceScore: number;
    pressureSources: unknown[];
    trigger: unknown;
  };
  history?: { checks: Array<{ id: string; verdict?: { riskLevel?: string }; created_at: string }> };
  error?: string;
}

// ── Fetch helpers ──────────────────────────────────────────────────────────

async function fetchJson<T>(
  baseUrl: string,
  path: string,
  opts?: { timeout?: number }
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeout ?? 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    let data: T | undefined;
    try {
      data = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      // non-JSON response
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: (data as { error?: string })?.error ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      error: msg.includes("fetch") || msg.includes("ECONNREFUSED") ? `Unreachable: ${msg}` : msg,
    };
  }
}

// ── Probe one environment ─────────────────────────────────────────────────

async function probeEnv(label: string, baseUrl: string): Promise<ProbeResult> {
  const result: ProbeResult = { label, baseUrl, reachable: false };

  // 1) Profile
  const profileRes = await fetchJson<{ profile?: { id: string; known_allergies?: string[] } }>(
    baseUrl,
    "/api/profile"
  );
  if (!profileRes.ok) {
    result.error = profileRes.error ?? `Profile: ${profileRes.status}`;
    return result;
  }
  const profile = profileRes.data?.profile;
  if (!profile?.id) {
    result.error = "Profile missing or no id";
    return result;
  }
  result.reachable = true;
  result.profile = {
    id: profile.id,
    known_allergies: profile.known_allergies ?? [],
  };

  // 2) Vigilance (use profile id from profile API to match app behavior)
  const vigRes = await fetchJson<{
    vigilanceActive?: boolean;
    vigilanceScore?: number;
    pressureSources?: unknown[];
    trigger?: unknown;
  }>(baseUrl, `/api/vigilance?profileId=${encodeURIComponent(profile.id)}&windowHours=${WINDOW_HOURS}`);
  if (!vigRes.ok) {
    result.error = (result.error ? result.error + "; " : "") + `Vigilance: ${vigRes.error}`;
    return result;
  }
  result.vigilance = {
    vigilanceActive: vigRes.data?.vigilanceActive ?? false,
    vigilanceScore: vigRes.data?.vigilanceScore ?? 0,
    pressureSources: vigRes.data?.pressureSources ?? [],
    trigger: vigRes.data?.trigger ?? null,
  };

  // 3) History (to diagnose "no checks" vs "checks but no risk")
  const histRes = await fetchJson<{
    checks?: Array<{ id: string; verdict?: { riskLevel?: string }; created_at: string }>;
  }>(baseUrl, `/api/history?profileId=${encodeURIComponent(profile.id)}&limit=20`);
  if (histRes.ok && histRes.data?.checks) {
    result.history = { checks: histRes.data.checks };
  }

  return result;
}

// ── Diagnosis ─────────────────────────────────────────────────────────────

function diagnoseVigilanceInactive(r: ProbeResult): string[] {
  const diag: string[] = [];
  if (!r.vigilance || r.vigilance.vigilanceActive) return diag;

  const checks = r.history?.checks ?? [];
  const windowMs = WINDOW_HOURS * 60 * 60 * 1000;
  const since = new Date(Date.now() - windowMs).toISOString();

  const recentChecks = checks.filter((c) => c.created_at >= since);
  const riskChecks = recentChecks.filter(
    (c) => c.verdict?.riskLevel === "medium" || c.verdict?.riskLevel === "high"
  );

  if (checks.length === 0) {
    diag.push("→ No checks in DB (run a check via /api/extract to create one)");
  } else if (recentChecks.length === 0) {
    diag.push(`→ No checks in last ${WINDOW_HOURS}h window (oldest: ${checks[0]?.created_at ?? "?"})`);
  } else if (riskChecks.length === 0) {
    diag.push(
      `→ ${recentChecks.length} check(s) in window but all verdict.riskLevel !== medium|high`
    );
    const levels = [...new Set(recentChecks.map((c) => c.verdict?.riskLevel ?? "none"))];
    diag.push(`  Verdict levels seen: ${levels.join(", ")}`);
  } else {
    diag.push(
      `→ ${riskChecks.length} risk check(s) exist but vigilanceActive=false (possible computation bug)`
    );
  }

  if (r.profile && r.profile.known_allergies.length === 0) {
    diag.push("→ Profile has no known_allergies (risk detection needs allergens)");
  }

  return diag;
}

// ── Report ────────────────────────────────────────────────────────────────

function printReport(results: ProbeResult[]): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  Phase 0.9 – Env Parity & End-to-End Diagnostics                 ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");
  console.log(`Profile ID: ${PROFILE_ID}`);
  console.log(`Window: ${WINDOW_HOURS}h\n`);

  for (const r of results) {
    const ok = r.reachable && !r.error;
    if (ok) passed++;
    else failed++;

    const status = ok ? "PASS" : "FAIL";
    const icon = ok ? "✓" : "✗";
    console.log(`\n${icon} ${r.label} (${r.baseUrl}) — ${status}`);
    if (r.error) {
      console.log(`  Error: ${r.error}`);
    }
    if (r.profile) {
      console.log(`  Profile: id=${r.profile.id} allergies=${r.profile.known_allergies.length}`);
    }
    if (r.vigilance) {
      console.log(
        `  Vigilance: active=${r.vigilance.vigilanceActive} score=${r.vigilance.vigilanceScore} pressureSources=${r.vigilance.pressureSources.length}`
      );
      if (!r.vigilance.vigilanceActive && r.vigilance.pressureSources.length === 0) {
        const diag = diagnoseVigilanceInactive(r);
        if (diag.length > 0) {
          console.log("  Diagnosis:");
          diag.forEach((d) => console.log(`    ${d}`));
        }
      }
    }
    if (r.history) {
      console.log(`  History: ${r.history.checks.length} checks`);
    }
  }

  // Cross-env parity
  console.log("\n──────────────────────────────────────────────────────────────────");
  const reachable = results.filter((r) => r.reachable);
  if (reachable.length >= 2) {
    const profileIds = [...new Set(reachable.map((r) => r.profile?.id).filter(Boolean))];
    const vigStates = reachable.map((r) => r.vigilance?.vigilanceActive);
    const allSameProfile = profileIds.length === 1;
    const allSameVigilance = vigStates.every((v) => v === vigStates[0]);

    if (!allSameProfile) {
      failed++;
      console.log("✗ PARITY: Different profile IDs across envs (env drift?)");
      reachable.forEach((r) => console.log(`  ${r.label}: ${r.profile?.id}`));
    } else if (!allSameVigilance) {
      failed++;
      console.log("✗ PARITY: Different vigilanceActive across envs (different DBs?)");
      reachable.forEach((r) =>
        console.log(`  ${r.label}: vigilanceActive=${r.vigilance?.vigilanceActive}`)
      );
    } else {
      console.log("✓ PARITY: Same profile ID and vigilance state across reachable envs");
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const targets = [
    { label: "Vite dev (5173)", url: VITE_URL },
    { label: "Vercel dev (3000)", url: VERCEL_DEV_URL },
    { label: "Production", url: PROD_URL },
  ];

  const results: ProbeResult[] = [];
  for (const t of targets) {
    results.push(await probeEnv(t.label, t.url));
  }

  const { passed, failed } = printReport(results);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
