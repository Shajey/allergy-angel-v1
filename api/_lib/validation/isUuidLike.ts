/**
 * UUID format validation (shape only, not version/variant).
 * Accepts any 8-4-4-4-12 hex string, case-insensitive.
 */

const UUID_LIKE_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuidLike(value: string): boolean {
  return UUID_LIKE_REGEX.test(value);
}
