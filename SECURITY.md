# Security Policy

## Supported versions

Box is pre-1.0. Only the latest release receives security fixes.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

- Email **me@pixeler.ir** with a description, reproduction steps and the
  affected version or commit.
- You can expect an acknowledgement within 72 hours.
- Once a fix is ready we will publish a patched release and credit you in the
  changelog, unless you prefer to stay anonymous.

## Scope

Box is local-first: notes, tasks and focus history live in the browser or
app profile (IndexedDB). Optional cloud sync stores a single encrypted-at-rest
JSON document per user in Supabase, protected by row level security.

Reports we care about most:

- unauthorised access to another user's synced data,
- injection or script execution through imported notes, pasted HTML, or
  bookmark metadata fetched from third-party pages,
- privilege escalation in the Electron shell (context isolation / preload
  bridge escapes),
- leaked credentials or secrets in the repository or published artifacts.

## Local secrets

Never commit `.env` or signing material. The build reads only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment; the anon
key is a public client key and must never be replaced with a service role key.
