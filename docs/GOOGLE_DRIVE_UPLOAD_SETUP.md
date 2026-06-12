# Video Storage — Cloudflare R2

Video uploads use **Cloudflare R2**, not Google Drive.

See:

- [R2_SETUP.md](./R2_SETUP.md) — bucket, CORS, Vercel env vars
- [R2_MIGRATION.md](./R2_MIGRATION.md) — migrate legacy Google Drive videos

Legacy `google_drive_url` rows continue to play on the website until re-uploaded to R2.
