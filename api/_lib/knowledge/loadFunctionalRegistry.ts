/**
 * Phase 12.2 – Functional Registry Loader
 *
 * Deterministic loader for medication/supplement registry. Production uses in-repo default.
 * Eval/replay can override via FUNCTIONAL_REGISTRY_PATH or explicit path param.
 * No network, no randomness. Sync file read in eval context only.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  FUNCTIONAL_CLASS_REGISTRY,
  type FunctionalClassKey,
  type FunctionalClassEntry,
} from "../inference/functionalClasses.js";

export type LoadedRegistry = Record<string, FunctionalClassEntry>;

/**
 * Load registry from path or env. When no override, returns in-repo default.
 * @param overridePath - explicit file path; overrides FUNCTIONAL_REGISTRY_PATH env
 */
export function loadFunctionalRegistry(overridePath?: string): LoadedRegistry {
  const pathToUse = overridePath ?? process.env.FUNCTIONAL_REGISTRY_PATH;
  if (!pathToUse) {
    return { ...FUNCTIONAL_CLASS_REGISTRY } as LoadedRegistry;
  }

  const absPath = resolve(process.cwd(), pathToUse);
  let raw: string;
  try {
    raw = readFileSync(absPath, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`loadFunctionalRegistry: failed to read ${absPath}: ${msg}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`loadFunctionalRegistry: invalid JSON in ${absPath}: ${msg}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`loadFunctionalRegistry: expected object in ${absPath}`);
  }

  return parsed as LoadedRegistry;
}
