# Google OAuth and Supabase setup

RepairMe uses Supabase Authentication for the real sign-in path. Development demo accounts are available only while Vite runs in development mode; they are never an alternative to Google OAuth in a production build.

## 1. Create and configure Supabase

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/schema.sql`](../supabase/schema.sql) in full.
3. In **Project Settings → API**, copy the project URL and the publishable/anon key.
4. Create `.env.local` from `.env.example`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. These two values are intentionally browser-visible public configuration values. Do not add a service-role key.

## 2. Configure Google

1. In Google Cloud Console, configure the OAuth consent screen and create a **Web application** OAuth client.
2. In Supabase, open **Authentication → Providers → Google**, enable it, and paste the Google Client ID and Client Secret there. Do not put either value in this repository or in `.env.local`.
3. Copy the exact Supabase provider callback URL shown in that Google provider panel (normally `https://<project-ref>.supabase.co/auth/v1/callback`) into Google Cloud as an authorized redirect URI. This is not the same as RepairMe’s `/auth/callback` route.
4. In **Authentication → URL Configuration**, add `http://localhost:5173/auth/callback` and your production URL followed by `/auth/callback` as redirect URLs. Set the appropriate site URL.
5. Restart the Vite server and test sign-in.

## 3. Configure optional AI diagnosis with OpenRouter

Create an OpenRouter key in your OpenRouter account, then set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` only in the deployment’s server-side environment. `OPENROUTER_MODEL` must be the exact identifier of a vision-capable model actually enabled for your account. The browser never receives this key. When the API is unavailable, RepairMe labels its deterministic response as a **sample fallback**, not as a new AI diagnosis.

For local work you may put these variables in the root `.env.local` file. For Vercel, place them in **Project → Settings → Environment Variables** for the environments where the AI endpoint should run. Do not prefix either key with `VITE_`.

## Troubleshooting

- **“Google sign-in is not configured”**: Check both Vite Supabase variables and restart the dev server. Variables without the `VITE_` prefix are not available to a Vite browser app.
- **Google sends users to an error page**: The Supabase provider callback URL must exactly match a redirect URI in Google Cloud. Check for a missing project ref or a trailing path mismatch.
- **Returned to the homepage, but no dashboard**: Add the application `/auth/callback` URL under Supabase Authentication URL Configuration, then re-run the SQL schema. Browser console errors that mention `profiles` usually mean the schema or RLS policies have not been applied.
- **A new account gets the wrong role**: New users receive the selected role only at first registration. Existing users retain their stored role by design. Do not edit the role column through the browser.
- **A request does not save**: Verify the caller is signed in, the request belongs to that customer, and the `transition_repair_request` function was created by the schema.
