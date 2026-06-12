# Cloudflare R2 Setup

Videos are uploaded from the admin panel to **Cloudflare R2** and streamed on the public website via HTML5 `<video>`.

---

## Step 1: Create R2 bucket

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**
2. Name: e.g. `vzw-videos`
3. Location: choose nearest region

---

## Step 2: Enable public access (playback)

**Option A — R2.dev subdomain (quickest)**

1. Bucket → **Settings** → **Public access** → **Allow Access**
2. Copy the public URL, e.g. `https://pub-xxxxxxxx.r2.dev`

**Option B — Custom domain (production)**

1. Bucket → **Settings** → **Custom Domains** → connect e.g. `videos.yourdomain.com`
2. Use `https://videos.yourdomain.com` as `R2_PUBLIC_URL`

---

## Step 3: Create API token

1. R2 → **Manage R2 API Tokens** → **Create API token**
2. Permissions: **Object Read & Write** on your bucket
3. Save **Access Key ID** and **Secret Access Key**

Find **Account ID** on the R2 overview page (right sidebar).

---

## Step 4: CORS (required for admin browser upload)

Bucket → **Settings** → **CORS policy**:

```json
[
  {
    "AllowedOrigins": [
      "https://video-za-wakubwa-tu-admin.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Step 5: Vercel env vars (admin project)

| Variable | Example |
|----------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | API token access key |
| `R2_SECRET_ACCESS_KEY` | API token secret |
| `R2_BUCKET_NAME` | `vzw-videos` |
| `R2_PUBLIC_URL` | `https://pub-xxxxxxxx.r2.dev` |

Redeploy after saving.

---

## Step 6: Verify

1. Log in to admin → **Videos** → **Add Video**
2. Select a video file → upload progress should reach 100%
3. Save → `video_url` in Supabase should be the R2 public URL
4. Open video on public website → HTML5 player streams from R2

---

## Migration from Google Drive

See [R2_MIGRATION.md](./R2_MIGRATION.md).
