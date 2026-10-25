# RepairMe

RepairMe is a two-sided repair platform: customers can describe a device issue, inspect a transparent preliminary estimate, choose a Repair Partner, request a slot, and approve a revised quote. Repair Partners receive requests, record inspection findings, issue itemized quotes, and progress only customer-approved work.

## What works now

- Premium responsive landing page, customer/Repair Partner account choice, and Google OAuth entry point
- Supabase session persistence and durable profile roles when configured
- Development-only Customer and Repair Partner demos that share the same browser-persisted repair request
- Guided device intake with validation, image preview/type/size checks, safety intervention, and structured possible-cause output
- Deterministic, itemized estimate calculation — AI never calculates prices
- Matching, booking, quote, explicit customer approval, repair progress, cancellation, and completion state transitions
- Status event timeline and refresh persistence for the demo workflow
- Supabase schema with RLS policies, protected roles, protected verification status, and a server-enforced transition RPC
- Optional server-side AI diagnosis endpoint (`api/diagnose.js`) with Zod validation and a labelled fallback when AI is unavailable

## Local development

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Configure production services

1. Copy `.env.example` to `.env.local`.
2. Follow [Google OAuth setup](docs/GOOGLE_OAUTH_SETUP.md) and run [the Supabase schema](supabase/schema.sql).
3. Configure server-only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in your deployment only if you want live AI diagnosis.
4. Deploy the Vite app plus `api/diagnose.js` to a Functions-compatible host such as Vercel. The API key must remain server-side.

## Test the product

See the [manual testing checklist](docs/MANUAL_TESTING.md) and [authentication troubleshooting guide](docs/AUTH_TROUBLESHOOTING.md).

## Deliberate limitations

- Demo profiles, slots, distances, and costs are explicitly simulated and only appear in Vite development mode.
- Google credentials, actual partner verification, email/SMS notifications, payment collection, and admin review are not configured by this repository. Do not represent any of these as live until separately provisioned.
- Image analysis depends on the configured server-side model; text diagnosis remains available with a clearly marked deterministic fallback.
