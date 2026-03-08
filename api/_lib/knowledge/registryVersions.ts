/**
 * Phase 21a – Registry Version Constants
 *
 * Registry versions — increment when any mapping changes.
 * Changes must go through PR Packager → Replay → Merge.
 */

export const REGISTRY_VERSIONS = {
  drug: "21a.1",
  supplement: "21a.1",
  food: "21a.1",
} as const;

export type RegistryType = keyof typeof REGISTRY_VERSIONS;
