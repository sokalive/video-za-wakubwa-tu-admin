# Supabase Production Setup Guide

**Project:** Video Za Wakubwa Tu  
**Admin:** https://video-za-wakubwa-tu-admin.vercel.app  
**Website:** https://video-za-wakubwa-tu.vercel.app  
**GitHub Admin:** https://github.com/sokalive/video-za-wakubwa-tu-admin  
**GitHub Website:** https://github.com/sokalive/video-za-wakubwa-tu  

---

## Architecture (do not change)

| Component | Technology |
|-----------|------------|
| Video files | **Google Drive** (link stored in DB) |
| Database | **Supabase PostgreSQL** (shared) |
| Thumbnails / APK | **Supabase Storage** (`media` bucket) |
| Admin auth | JWT session + bcrypt (`admins` table) |
| Sync | Both apps read/write same Supabase DB |

---

## Part 1 — Create Supabase Project (empty → ready)

### Step 1: Create project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Choose organization → enter:
   - **Name:** `video-za-wakubwa-tu`
   - **Database password:** (save this securely)
   - **Region:** closest to your users (e.g. `East US` or `EU West`)
4. Click **Create new project** — wait ~2 minutes

### Step 2: Run database schema

1. In Supabase Dashboard → **SQL Editor** → **New query**
2. Copy entire contents of `supabase/schema.sql` from admin repo
3. Click **Run**
4. Confirm success (no errors)

### Step 3: Run Google Drive migration (if schema was run before this column existed)

1. New query → copy `supabase/migrations/002_google_drive.sql`
2. Click **Run**

### Step 4: Create storage bucket

1. SQL Editor → copy `supabase/storage.sql`
2. Click **Run**
3. Verify: **Storage** → bucket `media` exists, marked **Public**

### Step 5: Get API keys

1. **Project Settings** (gear icon) → **API**
2. Copy and save:

| Key | Where to find | Used by |
|-----|---------------|---------|
| **Project URL** | `Project URL` | Both projects |
| **anon public** | `Project API keys` → `anon` `public` | Website |
| **service_role** | `Project API keys` → `service_role` `secret` | Admin only |

> **Never** expose `service_role` on the website or in client-side code.

---

## Part 2 — Environment Variables

### Admin Vercel project (`video-za-wakubwa-tu-admin`)

**Where to add:** [Vercel Dashboard](https://vercel.com) → **video-za-wakubwa-tu-admin** → **Settings** → **Environment Variables**

Add each variable for **Production**, **Preview**, and **Development**:

| Variable | Value | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role key) | Yes |
| `JWT_SECRET` | Random 32+ char string | Yes |
| `NEXT_PUBLIC_PUBLIC_WEBSITE_URL` | `https://video-za-wakubwa-tu.vercel.app` | Optional |
| `NEXT_PUBLIC_PUBLIC_API_URL` | `https://video-za-wakubwa-tu.vercel.app/api` | Optional |

**Do NOT add to website:** `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`

---

### Website Vercel project (`video-za-wakubwa-tu`)

**Where to add:** [Vercel Dashboard](https://vercel.com) → **video-za-wakubwa-tu** → **Settings** → **Environment Variables**

| Variable | Value | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same Project URL as admin | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon public key) | Yes |

**Do NOT add to website:** `SUPABASE_SERVICE_ROLE_KEY` (security risk)

---

### Local development (optional)

**Admin** — create `.env.local` in admin repo root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=your-local-jwt-secret
ADMIN_EMAIL=waziriissa37@gmail.com
ADMIN_PASSWORD=your-password
```

**Website** — create `.env.local` in website repo root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Part 3 — Seed Database

From admin repo root (with env vars set):

```bash
# Full seed: admin account, categories, VIP plans, sample videos, APK, settings
npm run seed

# Optional: add a test video with Google Drive link
npm run seed:test-video
```

**Default admin after seed:**
- Email: `waziriissa37@gmail.com`
- Password: value of `ADMIN_PASSWORD` env var (or seed default)

---

## Part 4 — Redeploy Vercel

After adding env vars, redeploy **both** projects:

```bash
# Admin
cd video-za-wakubwa-tu-admin
vercel --prod

# Website
cd video-za-wakubwa-tu
vercel --prod
```

Or in Vercel Dashboard → **Deployments** → latest → **Redeploy**

---

## Part 5 — Verification Workflow

### Automated check

```bash
cd video-za-wakubwa-tu-admin
# Set env vars first, then:
npm run verify
```

### Manual test workflow

#### A. Admin login

1. Open https://video-za-wakubwa-tu-admin.vercel.app/login
2. Enter admin email + password
3. **Expected:** Redirect to dashboard with stat cards

#### B. Add category

1. Sidebar → **Categories** → **Add Category**
2. Name: `Test Category`, Slug: `test-category`
3. **Expected:** Category appears in list

#### C. Add video (Google Drive)

1. Upload video to **Google Drive**
2. Right-click file → **Share** → **General access: Anyone with the link**
3. Copy link (format: `https://drive.google.com/file/d/FILE_ID/view`)
4. Admin → **Videos** → **Add Video**
5. Fill in:
   - Title, Description
   - **Google Drive Video Link** (paste link)
   - Thumbnail (upload image file)
   - Category, Tags
   - VIP / Featured toggles
6. Click **Save Video**
7. **Expected:** Video appears in admin table with Drive link

#### D. Thumbnail upload

1. When saving video, attach thumbnail image
2. **Expected:** Thumbnail uploads to Supabase Storage (`media/thumbnails/...`)
3. Thumbnail visible in admin video list

#### E. Website sync (automatic)

1. Open https://video-za-wakubwa-tu.vercel.app
2. **Expected:** New video appears on homepage (may take a few seconds)
3. Or check API: `https://video-za-wakubwa-tu.vercel.app/api/videos`
4. Click video → **Expected:**
   - Thumbnail displays
   - Play button loads Google Drive iframe
   - VIP videos show paywall unless VIP unlocked

#### F. Google Drive playback

1. On video page, click Play
2. **Expected:** Google Drive embed plays in iframe
3. If blank: ensure Drive file sharing is **Anyone with the link**

#### G. APK upload (unchanged)

1. Admin → **APK Manager**
2. Upload `.apk` file, set version + release notes
3. **Expected:** Website `/apk` page shows new version

---

## Part 6 — Database Structure Reference

```
admins              → Admin login (bcrypt password_hash)
categories          → Video categories
videos              → Metadata + google_drive_url + thumbnail_url
vip_plans           → Subscription plans
apk_releases        → APK version info
users               → End users
payments            → Payment history
advertisements      → Ads
site_settings       → Site config
activity_logs       → Admin audit trail
storage.media       → Thumbnails, APK, screenshots (NOT videos)
```

### Key `videos` columns

| Column | Purpose |
|--------|---------|
| `google_drive_url` | Google Drive share link |
| `thumbnail_url` | Supabase Storage public URL |
| `is_vip` | VIP paywall on website |
| `is_featured` | Featured on homepage |
| `published` | Visible on website (must be `true`) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Admin login fails | Run `npm run seed`, check `JWT_SECRET` + Supabase env vars on Vercel |
| "Database not configured" | Add Supabase env vars to Vercel, redeploy |
| Website shows 0 videos | Add `NEXT_PUBLIC_SUPABASE_*` to **website** Vercel project, redeploy |
| Thumbnail upload fails | Run `supabase/storage.sql`, ensure `media` bucket is public |
| Video doesn't play | Set Google Drive file to "Anyone with the link" |
| Invalid Google Drive link | Use format `https://drive.google.com/file/d/ID/view` |
| Admin works, website empty | Website missing anon key — add to website Vercel only |

---

## Production Readiness Checklist

- [ ] Supabase project created
- [ ] `schema.sql` executed
- [ ] `storage.sql` executed (`media` bucket public)
- [ ] Admin Vercel env vars set (4 variables)
- [ ] Website Vercel env vars set (2 variables)
- [ ] Both projects redeployed
- [ ] `npm run seed` completed
- [ ] Admin login works
- [ ] Video + thumbnail created via admin
- [ ] Video appears on website automatically
- [ ] Google Drive playback works
- [ ] `npm run verify` passes

---

## Quick Reference — File Locations

| File | Purpose |
|------|---------|
| `supabase/schema.sql` | Full database schema |
| `supabase/migrations/002_google_drive.sql` | Google Drive column migration |
| `supabase/storage.sql` | Storage bucket setup |
| `scripts/seed.mjs` | Seed admin + initial data |
| `scripts/seed-test-video.mjs` | Seed test Google Drive video |
| `scripts/verify-production.mjs` | Automated production checks |
| `.env.example` | Env var template |
