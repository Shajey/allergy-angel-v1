/**
 * O8.4a — Unit Tests: Allergy Name Sanitizer (Legacy Malformed Values)
 *
 * Tests that sanitizeAllergyName correctly handles:
 *   - Plain strings (pass-through)
 *   - Single serialized JSON objects
 *   - Double-wrapped / nested legacy forms
 *   - Objects with name/displayName
 *
 * All cases must normalize to the same clean label and canonical tag.
 */

import { describe, it, expect } from "vitest";
import {
  sanitizeAllergyName,
  sanitizeAllergyArray,
  assertAllergyIsPlainString,
} from "./sanitizeAllergyName";
import { normalizeToCanonical } from "@api/_lib/inference/clinicalOntology.ts";

describe("sanitizeAllergyName — legacy malformed value handling", () => {
  describe("plain strings (pass-through)", () => {
    it('returns "pollen allergy" unchanged', () => {
      expect(sanitizeAllergyName("pollen allergy")).toBe("pollen allergy");
    });

    it('returns "birch pollen" unchanged', () => {
      expect(sanitizeAllergyName("birch pollen")).toBe("birch pollen");
    });

    it("trims whitespace but preserves content", () => {
      expect(sanitizeAllergyName("  pollen allergy  ")).toBe("pollen allergy");
    });

    it("handles empty string", () => {
      expect(sanitizeAllergyName("")).toBe("");
    });
  });

  describe("single serialized JSON object", () => {
    it('extracts from {"name":"pollen allergy"}', () => {
      const input = '{"name":"pollen allergy"}';
      expect(sanitizeAllergyName(input)).toBe("pollen allergy");
    });

    it('prefers displayName over name when both present', () => {
      const input = '{"name":"pollen allergy","displayName":"birch pollen"}';
      expect(sanitizeAllergyName(input)).toBe("birch pollen");
    });

    it('extracts from {"displayName":"pollen allergy"}', () => {
      const input = '{"displayName":"pollen allergy"}';
      expect(sanitizeAllergyName(input)).toBe("pollen allergy");
    });

    it("handles JSON with extra whitespace", () => {
      const input = '  {"name":"pollen allergy"}  ';
      expect(sanitizeAllergyName(input)).toBe("pollen allergy");
    });
  });

  describe("double-wrapped / nested legacy forms (edge case)", () => {
    it('unwraps double-wrapped JSON (starts with " — doubly stringified via JSON.stringify twice)', () => {
      // O8.4a: The sanitizer now tries JSON.parse on ALL strings (not just {-prefixed),
      // so doubly-stringified values are fully unwrapped regardless of outer character.
      const inner = JSON.stringify({ name: "pollen allergy" });
      const doubleWrapped = JSON.stringify(inner);
      // doubleWrapped starts with '"' not '{'  — but should still unwrap to "pollen allergy"
      const result = sanitizeAllergyName(doubleWrapped);
      expect(result).toBe("pollen allergy");
    });

    it('correctly unwraps single-wrapped JSON (the actual stored corruption case)', () => {
      // Simulate: stored value retrieved from DB is '{"name":"pollen allergy"}' (starts with {)
      const singleWrapped = '{"name":"pollen allergy"}';
      expect(sanitizeAllergyName(singleWrapped)).toBe("pollen allergy");
    });
  });

  describe("objects with name/displayName (non-JSON input)", () => {
    it("extracts from object with name property", () => {
      const input = { name: "pollen allergy" };
      expect(sanitizeAllergyName(input)).toBe("pollen allergy");
    });

    it("extracts from object with displayName property", () => {
      const input = { displayName: "birch pollen" };
      expect(sanitizeAllergyName(input)).toBe("birch pollen");
    });

    it("prefers displayName when object has both", () => {
      const input = { name: "pollen allergy", displayName: "birch pollen" };
      expect(sanitizeAllergyName(input)).toBe("birch pollen");
    });

    it("handles nested object requiring recursion", () => {
      const input = { displayName: { displayName: "pollen allergy" } };
      expect(sanitizeAllergyName(input)).toBe("pollen allergy");
    });
  });

  describe("edge cases", () => {
    it("handles null", () => {
      expect(sanitizeAllergyName(null)).toBe("");
    });

    it("handles undefined", () => {
      expect(sanitizeAllergyName(undefined)).toBe("");
    });

    it("handles numbers", () => {
      expect(sanitizeAllergyName(123)).toBe("123");
    });

    it("handles arrays (converts to string)", () => {
      expect(sanitizeAllergyName(["pollen", "allergy"])).toBe("pollen,allergy");
    });

    it("handles invalid JSON that starts with { (treated as plain string)", () => {
      const invalid = '{invalid json}';
      expect(sanitizeAllergyName(invalid)).toBe('{invalid json}');
    });

    it("handles JSON with missing name/displayName (returns empty — filtered as garbage)", () => {
      // O8.4a: A JSON object with no name/displayName is not a valid allergy string.
      // Return "" so sanitizeAllergyArray filters it out cleanly.
      const input = '{"other":"field"}';
      const result = sanitizeAllergyName(input);
      expect(result).toBe("");
    });
  });
});

describe("sanitizeAllergyArray — batch processing", () => {
  it("sanitizes mixed array of plain and JSON strings", () => {
    const mixed = [
      "plain string",
      '{"name":"json object"}',
      "  whitespace padded  ",
      '',
    ];
    expect(sanitizeAllergyArray(mixed)).toEqual([
      "plain string",
      "json object",
      "whitespace padded",
    ]);
  });

  it("filters out JSON without name/displayName (garbage removal)", () => {
    // O8.4a: JSON objects without name/displayName are not valid allergy strings.
    // sanitizeAllergyName returns "" for them → sanitizeAllergyArray filters them out.
    const mixed = [
      "valid",
      '{"other":"field"}', // no name/displayName - filtered out as garbage
      '{"name":"also valid"}',
    ];
    const result = sanitizeAllergyArray(mixed);
    expect(result).toContain("valid");
    expect(result).toContain("also valid");
    expect(result).not.toContain('{"other":"field"}');
    expect(result.length).toBe(2); // garbage entry removed
  });

  it("handles empty array", () => {
    expect(sanitizeAllergyArray([])).toEqual([]);
  });
});

describe("assertAllergyIsPlainString — pre-persistence validation", () => {
  it("passes for plain string", () => {
    expect(() => assertAllergyIsPlainString("pollen allergy")).not.toThrow();
  });

  it("throws for JSON-like string starting with {", () => {
    expect(() => assertAllergyIsPlainString('{"name":"bad"}')).toThrow(
      /Storage contract violation/
    );
  });

  it("throws for JSON-like string starting with [", () => {
    expect(() => assertAllergyIsPlainString('["bad"]')).toThrow(
      /Storage contract violation/
    );
  });

  it("includes context in error message when provided", () => {
    expect(() =>
      assertAllergyIsPlainString('{"name":"bad"}', "PATCH known_allergies")
    ).toThrow(/PATCH known_allergies/);
  });
});

  describe("sanitization + ontology normalization (integration)", () => {
    it('all legacy forms of "pollen allergy" normalize to same canonical tag', () => {
      const cases = [
        "pollen allergy",
        '{"name":"pollen allergy"}',
        '{"displayName":"pollen allergy"}',
        '{"name":"pollen allergy","displayName":"pollen allergy"}',
      ];

      for (const input of cases) {
        const sanitized = sanitizeAllergyName(input);
        const canonical = normalizeToCanonical(sanitized);
        expect(canonical).toContain("pollen_cross_reactive");
      }
    });

    it('all legacy forms of "birch pollen" normalize to same canonical tag', () => {
      const cases = [
        "birch pollen",
        '{"name":"birch pollen"}',
        '{"displayName":"birch pollen"}',
        '{"name":"birch pollen","displayName":"birch pollen"}',
      ];

      for (const input of cases) {
        const sanitized = sanitizeAllergyName(input);
        const canonical = normalizeToCanonical(sanitized);
        expect(canonical).toContain("pollen_cross_reactive");
      }
    });

    it("correctly handles the single-wrapped JSON (the actual bug case)", () => {
      // This is the actual bug case: JSON-stringified object stored in text[] column
      const singleWrapped = '{"displayName": "pollen allergy"}';
      const sanitized = sanitizeAllergyName(singleWrapped);
      expect(sanitized).toBe("pollen allergy");
      const canonical = normalizeToCanonical(sanitized);
      expect(canonical).toContain("pollen_cross_reactive");
    });
  });
