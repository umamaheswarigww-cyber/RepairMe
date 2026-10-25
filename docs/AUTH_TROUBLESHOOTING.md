# Authentication troubleshooting

- If the Google button says configuration is missing, create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then restart Vite.
- If Google rejects the redirect, add the **Supabase provider callback** URL to Google Cloud. It is different from RepairMe’s own `/auth/callback` URL.
- If OAuth returns but no profile appears, run `supabase/schema.sql` and ensure `/auth/callback` is listed in Supabase Authentication URL Configuration.
- If an existing account opens the unexpected dashboard, inspect its `profiles.role` in Supabase. Roles intentionally persist and cannot be silently changed from the sign-in screen.
- Never add a Supabase service-role secret, Google Client Secret, or OpenRouter key to `VITE_*` variables.
