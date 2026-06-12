# Google Drive → Cloudflare R2 Migration Plan

## Architecture

```
Admin uploads video file
  → POST /api/r2/upload/session (presigned PUT URL)
  → Browser PUT → Cloudflare R2
  → POST /api/videos (stores video_url + r2_object_key, video_storage=r2)

Website watch page
  → Reads video_url (R2) first
  → Falls back to google_drive_url (legacy iframe) during migration
  → HTML5 player for R2; Drive embed only for unmigrated rows
```

## Database columns

| Column | Purpose |
|--------|---------|
| `video_url` | Public R2 URL for playback |
| `r2_object_key` | Object key in bucket |
| `video_storage` | `r2` or `google_drive` |
| `google_drive_url` | **Preserved** for existing videos |

Run migration SQL: `supabase/migrations/003_r2_video_storage.sql`

## Phase 1 — Infrastructure (no content change)

1. Create R2 bucket + public URL + CORS
2. Set Vercel env vars on admin
3. Run SQL migration on Supabase
4. Deploy admin + website

**Existing videos keep playing** via `google_drive_url` fallback.

## Phase 2 — New videos on R2

All new uploads through admin use R2 only. No Google Drive links required.

## Phase 3 — Migrate existing videos (per video)

For each legacy video:

1. Download from Google Drive (admin manual or script)
2. Re-upload via admin **Add Video** flow, or use admin edit with new file
3. Or bulk script:
   - Download file from Drive
   - Upload to R2 with same key pattern `videos/{id}-{filename}`
   - `UPDATE videos SET video_url = '...', r2_object_key = '...', video_storage = 'r2' WHERE id = '...'`

4. Verify playback on website
5. Optionally clear `google_drive_url` after verification

## Phase 4 — Decommission Drive

When all rows have `video_storage = 'r2'`:

- Remove `google_drive_url` fallback from website player (optional cleanup)
- Remove legacy Drive docs

## Rollback

If R2 fails, unmigrated rows still use `google_drive_url`. Do not delete Drive links until R2 playback is verified per video.
