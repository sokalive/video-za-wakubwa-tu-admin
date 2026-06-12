# Google Drive Shared Drive Setup (Required for Production)

Service accounts **cannot upload** to personal **My Drive** folders. Uploads fail with:

```
HTTP 403 — Service Accounts do not have storage quota.
```

Diagnostics will show `storageType: "my_drive"`. Production uploads require a **Shared Drive** (`storageType: "shared_drive"`).

---

## Prerequisites

- **Google Workspace** account (Shared Drives are not available on free personal Gmail-only accounts in the same way)
- Google Cloud project with **Drive API** enabled
- Service account: `video-za-wakubwa-drive@video-za-wakubwa.iam.gserviceaccount.com` (or your project’s email)

---

## Step 1: Create a Shared Drive

1. Open [Google Drive](https://drive.google.com)
2. Left sidebar → **Shared drives** → **New**
3. Name it e.g. `Video Za Wakubwa`
4. Click **Create**

---

## Step 2: Add the service account

1. Open the Shared Drive
2. Click the Shared Drive name → **Manage members**
3. Add the service account email:
   ```
   video-za-wakubwa-drive@video-za-wakubwa.iam.gserviceaccount.com
   ```
4. Role: **Content manager** (or **Manager**)
5. Uncheck “Notify people” → **Send**

---

## Step 3: Create the videos folder

1. Inside the Shared Drive, click **New** → **Folder**
2. Name it e.g. `VZW Videos`
3. Open the folder
4. Copy the folder ID from the URL:
   ```
   https://drive.google.com/drive/folders/FOLDER_ID_HERE
   ```

---

## Step 4: Update Vercel environment variables

On the **admin** Vercel project (`video-za-wakubwa-tu-admin`):

| Variable | Value |
|----------|-------|
| `GOOGLE_DRIVE_FOLDER_ID` | Folder ID from Step 3 (inside Shared Drive) |
| `GOOGLE_DRIVE_SHARED_DRIVE_ID` | Optional — Shared Drive ID if diagnostics show missing `driveId` |

**Redeploy** after changing env vars.

---

## Step 5: Verify

While logged into the admin panel, open:

```
GET /api/drive/diagnostics
```

Confirm:

| Field | Expected |
|-------|----------|
| `folderMetadata.storageType` | `"shared_drive"` |
| `folderMetadata.driveId` | Shared Drive ID (non-null) |
| `folderMetadata.capabilities.canAddChildren` | `true` |
| `requiresSharedDrive` | `false` |
| `uploadReady` | `true` |

Then upload a test video from **Videos → Add Video**.

---

## Optional: Shared Drive ID

If `folderMetadata.driveId` is null but the folder is in a Shared Drive:

1. Open the Shared Drive in Drive
2. URL format: `https://drive.google.com/drive/u/0/folders/DRIVE_ID`
3. Set `GOOGLE_DRIVE_SHARED_DRIVE_ID` to that ID on Vercel

---

## What the code does (already implemented)

- `supportsAllDrives=true` and `supportsTeamDrives=true` on all Drive API calls
- `driveId` query parameter on resumable upload when folder is in a Shared Drive
- Blocks uploads when `storageType=my_drive` with a clear error before upload starts
- Existing folder diagnostics unchanged (`files.get`, `permissions.list`, shortcuts, etc.)

---

## Alternative (Workspace only): impersonation

If you must use a My Drive folder on Google Workspace:

1. Enable domain-wide delegation on the service account
2. Set `GOOGLE_DRIVE_IMPERSONATE_EMAIL` to the folder owner’s Workspace email
3. Grant Drive scope in Admin Console

Shared Drive is simpler and recommended for production.
