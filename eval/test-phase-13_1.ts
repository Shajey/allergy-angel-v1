/**
 * Phase 13.1 – Vigilance UX Hardening Tests
 *
 * Tests pure helper functions deterministically (no DOM, no React).
 * All time-dependent functions receive nowMs explicitly.
 */

import {
  shouldShowBanner,
  computeExpiresIn,
  nextAckUntil,
  ackStorageKey,
  type AckMap,
} from "../src/lib/vigilanceBannerHelpers.js";

const FIXED_NOW = new Date("2026-02-21T12:00:00.000Z").getTime();
const HOUR_MS = 60 * 60 * 1000;

function runTests(): void {
  let passed = 0;
  let failed = 0;

  // ── 1) shouldShowBanner: null trigger → false ────────────────────────
  if (shouldShowBanner(null, FIXED_NOW, {})) {
    failed++;
    console.error("✗ shouldShowBanner(null trigger) should return false");
  } else {
    passed++;
    console.log("✓ shouldShowBanner returns false for null trigger");
  }

  // ── 2) shouldShowBanner: no ack entry → true ─────────────────────────
  const trigger = { checkId: "chk-001" };
  if (!shouldShowBanner(trigger, FIXED_NOW, {})) {
    failed++;
    console.error("✗ shouldShowBanner should return true when no ack exists");
  } else {
    passed++;
    console.log("✓ shouldShowBanner returns true when no ack exists");
  }

  // ── 3) shouldShowBanner: valid ack → false (banner hidden) ───────────
  const futureAck: AckMap = {
    "chk-001": {
      acknowledgedUntil: new Date(FIXED_NOW + 2 * HOUR_MS).toISOString(),
    },
  };
  if (shouldShowBanner(trigger, FIXED_NOW, futureAck)) {
    failed++;
    console.error("✗ shouldShowBanner should return false when ack is still valid");
  } else {
    passed++;
    console.log("✓ shouldShowBanner returns false when ack is valid");
  }

  // ── 4) shouldShowBanner: expired ack → true (banner reappears) ───────
  const expiredAck: AckMap = {
    "chk-001": {
      acknowledgedUntil: new Date(FIXED_NOW - 1000).toISOString(),
    },
  };
  if (!shouldShowBanner(trigger, FIXED_NOW, expiredAck)) {
    failed++;
    console.error("✗ shouldShowBanner should return true when ack has expired");
  } else {
    passed++;
    console.log("✓ shouldShowBanner returns true when ack has expired");
  }

  // ── 5) shouldShowBanner: different checkId ack → shows new trigger ───
  const otherAck: AckMap = {
    "chk-old": {
      acknowledgedUntil: new Date(FIXED_NOW + 2 * HOUR_MS).toISOString(),
    },
  };
  if (!shouldShowBanner(trigger, FIXED_NOW, otherAck)) {
    failed++;
    console.error("✗ shouldShowBanner should return true for a new checkId even if old one is acked");
  } else {
    passed++;
    console.log("✓ shouldShowBanner returns true for new checkId (different from acked)");
  }

  // ── 6) computeExpiresIn: 6h remaining ────────────────────────────────
  const lastSeenAt6hAgo = new Date(FIXED_NOW - 6 * HOUR_MS).toISOString();
  const expires6h = computeExpiresIn(lastSeenAt6hAgo, FIXED_NOW, 12);
  if (!expires6h || expires6h.hours !== 6 || expires6h.minutes !== 0) {
    failed++;
    console.error(`✗ computeExpiresIn should be {6h 0m}, got ${JSON.stringify(expires6h)}`);
  } else {
    passed++;
    console.log("✓ computeExpiresIn computes 6h remaining correctly");
  }

  // ── 7) computeExpiresIn: partial hours ────────────────────────────────
  const lastSeen90mAgo = new Date(FIXED_NOW - 1.5 * HOUR_MS).toISOString();
  const expires90m = computeExpiresIn(lastSeen90mAgo, FIXED_NOW, 4);
  if (!expires90m || expires90m.hours !== 2 || expires90m.minutes !== 30) {
    failed++;
    console.error(`✗ computeExpiresIn should be {2h 30m}, got ${JSON.stringify(expires90m)}`);
  } else {
    passed++;
    console.log("✓ computeExpiresIn computes partial hours correctly");
  }

  // ── 8) computeExpiresIn: already expired → null ──────────────────────
  const lastSeen13hAgo = new Date(FIXED_NOW - 13 * HOUR_MS).toISOString();
  const expiresNull = computeExpiresIn(lastSeen13hAgo, FIXED_NOW, 12);
  if (expiresNull !== null) {
    failed++;
    console.error(`✗ computeExpiresIn should be null when expired, got ${JSON.stringify(expiresNull)}`);
  } else {
    passed++;
    console.log("✓ computeExpiresIn returns null when already expired");
  }

  // ── 9) nextAckUntil: respects min(windowHours, 12) ───────────────────
  const ackUntil8 = nextAckUntil(FIXED_NOW, 8);
  const expected8 = new Date(FIXED_NOW + 8 * HOUR_MS).toISOString();
  if (ackUntil8 !== expected8) {
    failed++;
    console.error(`✗ nextAckUntil(8) should be ${expected8}, got ${ackUntil8}`);
  } else {
    passed++;
    console.log("✓ nextAckUntil uses windowHours when < 12");
  }

  // ── 10) nextAckUntil: caps at 12h ────────────────────────────────────
  const ackUntil24 = nextAckUntil(FIXED_NOW, 24);
  const expected12 = new Date(FIXED_NOW + 12 * HOUR_MS).toISOString();
  if (ackUntil24 !== expected12) {
    failed++;
    console.error(`✗ nextAckUntil(24) should cap at 12h: ${expected12}, got ${ackUntil24}`);
  } else {
    passed++;
    console.log("✓ nextAckUntil caps at 12h");
  }

  // ── 11) ackStorageKey format ─────────────────────────────────────────
  const key = ackStorageKey("profile-abc");
  if (key !== "AA_VIGILANCE_ACK_v1:profile-abc") {
    failed++;
    console.error(`✗ ackStorageKey should be "AA_VIGILANCE_ACK_v1:profile-abc", got "${key}"`);
  } else {
    passed++;
    console.log("✓ ackStorageKey produces correct format");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
