# Google Drive Share Link Workflow

Videos are stored on **Google Drive**. The admin uploads files manually in Google Drive, then pastes the share link in the admin panel. The link is saved in Supabase as `videos.google_drive_url`.

The public website plays videos using that URL (Google Drive embed).

**No service account or folder env vars are required.**

---

## Admin workflow: add a video

1. **Upload video to Google Drive** (your personal Drive or Shared Drive).
2. Right-click the file → **Share** → set to **Anyone with the link** (Viewer).
3. Copy the share link, e.g.:
   ```
   https://drive.google.com/file/d/FILE_ID/view
   ```
4. Log in to the admin panel → **Videos** → **Add Video**.
5. Fill in:
   - **Video Title**
   - **Description**
   - **Google Drive Share Link** (paste from step 3)
   - **Thumbnail Upload** (optional — goes to Supabase Storage)
   - **Category**
   - **Tags**
   - **VIP / Featured** toggles
6. Click **Save Video**.

The panel validates and normalizes the Drive URL, then stores it in `google_drive_url`.

---

## What the admin panel does NOT do

- Does not upload video bytes to Google Drive
- Does not require `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`
- Does not require `GOOGLE_DRIVE_FOLDER_ID`

---

## Thumbnails and APK

Thumbnails and APK files still use **Supabase Storage** (`media` bucket) via `/api/upload`.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Invalid Google Drive link` | Use a file link like `https://drive.google.com/file/d/FILE_ID/view` |
| Video won't play on website | Set Drive sharing to **Anyone with the link** |
| Thumbnail upload fails | Check Supabase Storage bucket `media` and env vars |

---

## Optional: remove old Vercel env vars

If you previously set service-account upload vars, you can remove them from Vercel (they are unused):

- `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_DRIVE_SHARED_DRIVE_ID`
- `GOOGLE_DRIVE_IMPERSONATE_EMAIL`
