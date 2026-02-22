# Promotion Runbook

Deterministic workflow for promoting new allergen/ingredient knowledge into the taxonomy. No inference changes, no schema changes, human-in-the-loop required.

---

## 1. Start local services

```bash
npx vercel dev
```

API + UI run on **http://localhost:3000**. Do not use `npm run dev` (Vite alone) — that serves only the frontend on 5173; the API routes will not work.

---

## 2. Enable admin tools

Add to `.env.local`:

```
ADMIN_ENABLED=true
```

Restart the server after changing env vars.

---

## 3. Identify candidates

```bash
curl -s "http://localhost:3000/api/admin/unmapped?profileId=$DEFAULT_PROFILE_ID" | jq .
```

Replace `$DEFAULT_PROFILE_ID` with your profile UUID (e.g. `a0000000-0000-0000-0000-000000000001` from `.env.local`).

Returns `{ profileId, windowHours, candidates: [...] }` with unmapped terms and evidence.

---

## 4. Export proposals

```bash
curl -s -X POST "http://localhost:3000/api/admin/promotion-export" \
  -H "Content-Type: application/json" \
  -d '{"profileId":"'$DEFAULT_PROFILE_ID'","mode":"blank"}' | jq . > promo-export.json
```

Blank mode: all proposals `null`, confidence `blank`. Use for human review and manual edits.

---

## 5. Apply promotion (manual)

1. Edit `api/_lib/inference/allergenTaxonomy.ts` (or registry) per your promotion decision.
2. Bump `ALLERGEN_TAXONOMY_VERSION` (e.g. `10i.2` → `10i.3`).
3. Update replay fixtures if needed:
   - `eval/fixtures/replay/knowledge/baseline-taxonomy.json` (pre-promotion)
   - `eval/fixtures/replay/knowledge/candidate-taxonomy.json` (post-promotion)
4. Add/update `eval/fixtures/replay/allowlist.json` with fingerprinted allowances for expected changes.

---

## 6. Replay validate

```bash
npm run replay:validate:ci
```

**Allowlist fingerprints workflow:**

- **Legacy mode**: allowlist is a set of scenario IDs; any change in those scenarios is allowed.
- **Fingerprinted mode**: each scenario specifies expected `riskLevelTo`, `addedMatches`, `removedMatches`, `candidateTaxonomyVersion`. The gate passes only if the actual diff matches the fingerprint.
- Convert to fingerprinted format in `allowlist.json` for stricter regression control.
- Gate must pass before merging taxonomy changes.

---

## 7. Verify UI

- **Vigilance triggers**: Banner appears when recent medium/high risk checks exist. Check `/api/vigilance?profileId=...`.
- **Recent triggers drawer**: "Recent triggers" button in vigilance banner opens the drawer.
- **Download report**: On a check detail page, use "Download report" with the "Include original text" toggle (default OFF for redaction).

---

## 8. Rollback strategy

1. Revert the taxonomy/registry change in git.
2. Rerun `npm run replay:validate:ci` to confirm baseline.
3. Revert allowlist changes if they referenced the rolled-back promotion.

---

## Troubleshooting

### Wrong port (5173 vs 3000)

- **5173**: Vite dev server only — API routes are not available.
- **3000**: `npx vercel dev` — full stack (API + UI). Use this for promotion workflows.

### ADMIN_ENABLED missing

- Admin endpoints (`/api/admin/unmapped`, `/api/admin/promotion-export`) return 404 when `ADMIN_ENABLED` is not `"true"`.
- Add `ADMIN_ENABLED=true` to `.env.local` and restart.

### No checks exist yet

- Run an extraction to create checks: use the extract UI or `POST /api/extract` with sample text.
- Or seed the database with test data.
- Without checks, `/api/history` returns empty; you cannot test report download until at least one check exists.

### Supabase creds missing

- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `.env.local`.
- Without them, API calls that hit the DB will fail with connection errors.
