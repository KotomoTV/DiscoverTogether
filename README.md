# Crave

A private, mobile-web app for couples. Each partner answers ~55 intimacy
questions on their own phone, the two devices pair via a 4-digit code
that the partners exchange verbally, and the result screen reveals only
the things both partners said yes to — grouped by how enthusiastic the
match is.

- Live: https://kotomotv.github.io/DiscoverTogether/
- Stack: plain HTML/CSS/vanilla JS + Supabase Postgres
- Pairing: SHA-256-hashed 4-digit code, no real-time sync

Live database migrations (when the schema changes) are in
`supabase/fix*.sql`; the canonical fresh-install schema is
`supabase/schema.sql`.

> The repository directory is still named `DiscoverTogether` for
> historical reasons; the live site URL is unchanged. The product is
> now Crave.
