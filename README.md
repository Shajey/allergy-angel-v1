# CareOS Portal (POC)

CareOS is a concept portal demonstrating a modern, role-aware care experience for patients, caregivers, and clinicians.

This project is a **design and product proof-of-concept**, not a production system.

## What this demonstrates

- A role-based care portal experience:
  - Patient
  - Caregiver
  - Clinician (Login As / support view)
  - Developer (demo mode)
- Clear visual context for “who you are” and “who you’re viewing”
- A shared care surface across documents, care plans, messaging, and timeline
- Modern, calm UI patterns suitable for healthcare use
- How a single portal can support multiple care personas without confusion

## What this is not

- Not connected to real healthcare systems
- Not using real patient data
- Not production-ready authentication or authorization

## Tech stack

- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Deployed on Vercel

## Why this exists

This project exists to explore:
- Product thinking around role-based healthcare portals
- UX clarity in complex care relationships
- Rapid prototyping using modern AI-assisted development tools
---

## About the creator

CareOS is part of **Shajey’s Projects** — a collection of exploratory product and design prototypes.

Shajey Rumi is a product manager focused on:
- healthcare platforms
- multi-persona systems
- clarity in complex workflows
- and the practical application of AI in product development

This project reflects an interest in how care experiences can be:
- more humane
- more intelligible
- and more connected across patients, caregivers, clinicians, and health plans.

More to come.

---

## Allergy Angel – Admin Tools

### Admin Endpoints

Admin endpoints are gated behind `ADMIN_ENABLED=true`. When this env var is not set (or set to anything other than `"true"`), admin routes return **404 Not Found** — this is intentional to keep them hidden in production.

To enable locally, add to `.env.local`:

```
ADMIN_ENABLED=true
```

Then restart the dev server.

### Available Admin Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/admin/unmapped` | GET | Unmapped discovery (Phase 11) |
| `/api/admin/promotion-export` | POST | Promotion export (Phase 12.1) |

### Dev Server Ports

- **Vite** (frontend) runs on `http://localhost:5173`
- **Vercel dev** (API server) runs on `http://localhost:3000`

Admin API calls must go to the **API server** port (3000), not the Vite port.

### Smoke Test

```bash
# Unmapped discovery (replace UUID with your DEFAULT_PROFILE_ID)
curl "http://localhost:3000/api/admin/unmapped?profileId=a0000000-0000-0000-0000-000000000001"

# Promotion export
curl -X POST http://localhost:3000/api/admin/promotion-export \
  -H "Content-Type: application/json" \
  -d '{"profileId":"a0000000-0000-0000-0000-000000000001"}'
```

If you get `{"error":"Not Found"}`, check that `ADMIN_ENABLED=true` is set in `.env.local` and restart `vercel dev`.

### PR Packager (Phase 12.3)

The PR Packager produces a deterministic patch bundle for taxonomy/registry promotions. Output is written to `eval/out/pr-packages/<hash>/` (gitignored). No source files are modified automatically.

```bash
# Dry run (validates inputs, prints proposed changes, writes nothing)
npm run pr:pack -- --export=promo.json --selectTaxonomy=mango --parent=tree_nut --mode=crossReactive --dry-run

# Generate bundle from local export file
npm run pr:pack -- --export=promo.json --selectTaxonomy=mango --selectRegistry=tylenol --parent=tree_nut --mode=crossReactive --bumpTaxonomyVersionTo=10i.3

# Generate bundle from live discovery (requires DB)
npm run pr:pack -- --profileId=a0000000-0000-0000-0000-000000000001 --selectTaxonomy=mango --parent=tree_nut --runReplay --strict
```

Each bundle includes: `manifest.json`, `proposed-taxonomy.json`, `proposed-registry.json`, `patches/*.diff`, and `PACKAGER.md` with apply instructions and a Pressure Evidence section (run `GET /api/vigilance` to capture `pressureSources` for promoted terms).
