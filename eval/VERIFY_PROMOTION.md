# Promotion Verification Runbook (Phase 12.4)

After applying a PR package (`npm run pr:apply -- --bundleId=<id>`), verify the promotion before merging.

**Prerequisite:** `npx vercel dev` (or equivalent) running for API verification steps.

---

## 1. Unit Tests

```bash
npm run test:phase-10i
npm run test:phase-13
npm run test:phase-15_3_integration
```

---

## 2. Replay Gate

```bash
npm run replay:validate:ci
```

---

## 3. Real Check Verification (Read-Only)

Supply a real `checkId` via env or flag:

```bash
# Via env
export REAL_CHECK_ID=<your-check-id>
curl -s "http://localhost:3000/api/report/check?checkId=$REAL_CHECK_ID" | jq .

# Or inline
curl -s "http://localhost:3000/api/report/check?checkId=<REAL_CHECK_ID>" | jq .
```

**Confirm:**
- `meta.taxonomyVersion` equals the promoted version (e.g., `10i.3`)
- `verdict.matched` includes a `cross_reactive` match for the promoted term (e.g., mango) if that check contained it

---

## 4. Vigilance Verification (Read-Only)

```bash
curl -s "http://localhost:3000/api/vigilance?profileId=$DEFAULT_PROFILE_ID" | jq .
```

**Confirm:**
- `trigger.taxonomyVersion` matches promoted version
- `trigger.matched` includes the promoted term (e.g., mango)

---

## Summary Checklist

- [ ] Unit tests pass
- [ ] Replay gate passes
- [ ] Real check shows correct taxonomy version
- [ ] Vigilance shows correct taxonomy version and matched term
