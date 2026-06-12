# Google Drive Video Upload Setup

Videos are stored on **Google Drive** (not Vercel or Supabase Storage). The admin panel uploads files directly to Google Drive using a **service account** and saves the shareable link in Supabase.

## Architecture

```
Admin selects video file
    → POST /api/drive/upload/session (creates resumable upload URL)
    → Browser uploads bytes directly to Google Drive (large files supported)
    → POST /api/drive/upload/finalize (sets public link permission)
    → Share URL saved in Supabase videos.google_drive_url
    → Public website plays video via Google Drive embed
```

Thumbnails and APK files still use **Supabase Storage** (`media` bucket).

---

## Step 1: Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Enable **Google Drive API**:
   - APIs & Services → Library → search "Google Drive API" → Enable

---

## Step 2: Service Account

1. APIs & Services → **Credentials**
2. Create Credentials → **Service account**
3. Name: `vzw-video-uploader` (any name)
4. Skip optional role grants → Done
5. Click the service account → **Keys** tab → Add Key → **Create new key** → JSON
6. Save the downloaded JSON file securely

Note the service account email, e.g.:
```
vzw-video-uploader@your-project.iam.gserviceaccount.com
```

---

## Step 3: Google Drive Folder

1. In [Google Drive](https://drive.google.com), create a folder e.g. `VZW Videos`
2. Right-click folder → **Share**
3. Add the **service account email** with **Editor** access
4. Copy the **Folder ID** from the URL:
   ```
   https://drive.google.com/drive/folders/FOLDER_ID_HERE
   ```

---

## Step 4: Vercel Environment Variables

Add these to the **admin** Vercel project (`video-za-wakubwa-tu-admin`):

| Variable | Required | Value |
|----------|----------|-------|
| `GOOGLE_DRIVE_FOLDER_ID` | **Yes** | Folder ID from Step 3 (uploads fail without this) |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` | **Yes** | Entire JSON key file as one line |
| `GOOGLE_DRIVE_IMPERSONATE_EMAIL` | No | Workspace user to impersonate (domain-wide delegation) when My Drive sharing is insufficient |
| `NEXT_PUBLIC_APP_URL` | Recommended | Admin panel URL (e.g. `https://video-za-wakubwa-tu-admin.vercel.app`) — binds Google resumable-upload CORS for browser PUT requests |

**Both variables are required.** Setting only the service account JSON is not enough — the panel checks for `GOOGLE_DRIVE_FOLDER_ID` at runtime.

### Formatting the JSON for Vercel

Minify the JSON to a single line (no line breaks). Example structure:

```json
{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

**Important:** Keep `\n` inside `private_key` — do not replace with real newlines in Vercel UI.

### Local development (.env.local)

```env
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

---

## Step 5: Deploy

1. Push latest admin code to GitHub
2. Redeploy on Vercel (env vars require redeploy)
3. Log in to admin → **Videos** → **Add Video**
4. Select a video file → fill title, category, thumbnail → **Save Video**

---

## Verify Upload Works

1. While logged in, open: `GET /api/drive/diagnostics`
2. Confirm `uploadReady: true` and `folderMetadata.capabilities.canAddChildren: true`
3. Response includes: folder `name`, `mimeType`, `owners`, `capabilities`, `permissions`, `driveId`, `shortcutDetails`, `accessibleSharedFolders`, `uploadSessionTrace`
4. Admin → Videos → Add Video → select `.mp4` file
2. Progress bar should show upload percentage
3. After save, **Drive Link** column shows the Google Drive URL
4. Open public website → video should appear and play

Check status via API (while logged in):
```
GET /api/drive/upload/session
→ { "configured": true, "serviceAccountEmail": "..." }
```

---

## Supported Formats

- MP4, WebM, MOV, AVI, MKV, MPEG
- Max file size: **5 GB** per upload (configurable in code)

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Google Drive upload is not configured` | Check GET `/api/drive/upload/session` while logged in — response includes `reason`, `folderIdSet`, `jsonParseOk` |
| `GOOGLE_DRIVE_FOLDER_ID is not set` | Add folder ID from Drive URL to Vercel **and redeploy** |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is set but invalid JSON` | Use minified single-line JSON, or `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64`, or split `GOOGLE_DRIVE_CLIENT_EMAIL` + `GOOGLE_DRIVE_PRIVATE_KEY` |
| `Insufficient permissions` / `404 File not found` on folder ID | Open `/api/drive/diagnostics`. If `folderMetadata` is null, compare `accessibleSharedFolders` IDs with `GOOGLE_DRIVE_FOLDER_ID`. Share folder with **exact** `clientEmail` as **Editor**. If ID is a shortcut, code resolves `shortcutDetails.targetId` automatically. |
| Upload UI green but upload fails | Check `uploadSessionTrace` in diagnostics — Shared Drive uploads require `driveId` query param (handled automatically when `folderMetadata.driveId` is set). |
| My Drive shared folder still 404 | Personal Gmail folders often block service-account uploads even when shared. **Move folder to a Shared Drive** or set `GOOGLE_DRIVE_IMPERSONATE_EMAIL` to the folder owner's Google Workspace email (requires domain-wide delegation). |
| `Invalid credentials` | Check JSON is valid single-line string; private_key has `\n` |
| `Failed to fetch` at 0% progress | Browser PUT to Google blocked by CORS. The server must pass your admin panel `Origin` when creating the resumable session (handled automatically). Set `NEXT_PUBLIC_APP_URL=https://your-admin.vercel.app` on Vercel if origin detection fails. |
| Video won't play on website | File must be shared "anyone with link" — finalize step handles this |
| `storageQuotaExceeded` | Service accounts have no personal quota — upload to a **Shared Drive** or folder owned by a user account that shared Editor access |

### Shared Drive (recommended for production)

For unlimited storage, use a **Shared Drive** (Google Workspace):

1. Create Shared Drive in Google Drive
2. Add service account as **Content manager**
3. Create `VZW Videos` folder inside Shared Drive
4. Use that folder's ID as `GOOGLE_DRIVE_FOLDER_ID`

---

## Security Notes

- Service account JSON is **server-only** — never expose in client code or website
- Only authenticated admins can call `/api/drive/upload/*`
- Video bytes never pass through Vercel servers (resumable direct upload)
