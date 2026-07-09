import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSupabaseAdmin } from "@/lib/db/client";
import { getR2Config, getPublicObjectUrl } from "@/lib/r2-client";
import { getS3Client } from "@/lib/r2-list";
import { syncAllCategoryVideoCounts } from "@/lib/db/category-sync";
import { getCatalogAuditReport } from "@/lib/db/catalog-audit";
import { getVideoOptionalColumns, prepareVideoWriteRow } from "@/lib/db/video-schema";
import { getNextDisplayOrder } from "@/lib/db/video-order";
import { supabaseRest } from "@/lib/db/rest";

export type UploadAuditReport = {
  auditedAt: string;
  bulkUploadStudio: {
    note: string;
    activityLogUploads: number;
    activityLogDeletes: number;
    clientQueueNotPersisted: true;
  };
  database: {
    totalSaved: number;
    published: number;
    unpublished: number;
    unpublishedEligible: number;
    missingPlaybackSource: number;
    withR2ObjectKey: number;
  };
  r2: {
    configured: boolean;
    totalVideoObjects: number;
    matchedInDatabase: number;
    orphanObjects: number;
    orphanKeys: string[];
  };
  inferredOutcomes: {
    successfulDbCreates: number;
    skippedAsDuplicates: null;
    failedUploads: null;
    stuckInQueue: null;
    r2WithoutDbRecord: number;
    dbUnpublishedWithSource: number;
    hiddenFromWebsite: number;
  };
  comparison: {
    r2VideoObjects: number;
    databaseVideos: number;
    websiteVisible: number | null;
    gapR2MinusDb: number;
  };
};

type VideoRow = {
  id: string;
  title: string;
  published: boolean | null;
  video_url: string | null;
  r2_object_key: string | null;
  google_drive_url: string | null;
  category_id: string | null;
};

async function listR2VideoKeys(): Promise<{ key: string; size: number }[]> {
  const config = getR2Config();
  if (!config) return [];

  const client = getS3Client(config);
  const out: { key: string; size: number }[] = [];
  let token: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: "videos/",
        ContinuationToken: token,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) out.push({ key: obj.Key, size: obj.Size ?? 0 });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  return out;
}

function titleFromObjectKey(key: string): string {
  const base = key.split("/").pop() ?? key;
  return base.replace(/^\d+-[a-z0-9]+-/, "").replace(/\.[^.]+$/, "").replace(/_/g, " ").trim() || base;
}

async function fetchWebsiteVisibleCount(): Promise<number | null> {
  const websiteUrl = (process.env.WEBSITE_URL || "https://video-za-wakubwa-tu.vercel.app").replace(/\/$/, "");
  try {
    const res = await fetch(`${websiteUrl}/api/videos?limit=1`, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { totalItems?: number; data?: unknown[] };
    return json.totalItems ?? json.data?.length ?? null;
  } catch {
    return null;
  }
}

export async function getUploadAuditReport(): Promise<UploadAuditReport> {
  const db = getSupabaseAdmin();

  const [{ data: videos, error: videoErr }, { data: logs }, r2Objects, websiteVisible] = await Promise.all([
    db.from("videos").select("id, title, published, video_url, r2_object_key, google_drive_url, category_id"),
    db.from("activity_logs").select("action, entity_type").eq("entity_type", "video"),
    listR2VideoKeys(),
    fetchWebsiteVisibleCount(),
  ]);

  if (videoErr) throw new Error(videoErr.message);

  const rows = (videos ?? []) as VideoRow[];
  const uploadLogs = (logs ?? []).filter((l) => l.action === "upload");
  const deleteLogs = (logs ?? []).filter((l) => l.action === "delete");

  const dbR2Keys = new Set(rows.map((v) => String(v.r2_object_key ?? "").trim()).filter(Boolean));
  const dbVideoUrls = new Set(rows.map((v) => String(v.video_url ?? "").trim()).filter(Boolean));

  const orphanObjects = r2Objects.filter((o) => !dbR2Keys.has(o.key));
  const unpublished = rows.filter((v) => v.published === false);
  const unpublishedEligible = unpublished.filter(
    (v) => String(v.video_url ?? "").trim() || String(v.google_drive_url ?? "").trim()
  );
  const missingSource = rows.filter(
    (v) => !String(v.video_url ?? "").trim() && !String(v.google_drive_url ?? "").trim()
  );

  const matchedInDatabase = r2Objects.filter((o) => dbR2Keys.has(o.key)).length;

  return {
    auditedAt: new Date().toISOString(),
    bulkUploadStudio: {
      note: "Bulk Upload queue (selected/skipped/failed/pending) lives in the browser only and is not stored server-side.",
      activityLogUploads: uploadLogs.length,
      activityLogDeletes: deleteLogs.length,
      clientQueueNotPersisted: true,
    },
    database: {
      totalSaved: rows.length,
      published: rows.filter((v) => v.published !== false).length,
      unpublished: unpublished.length,
      unpublishedEligible: unpublishedEligible.length,
      missingPlaybackSource: missingSource.length,
      withR2ObjectKey: dbR2Keys.size,
    },
    r2: {
      configured: getR2Config() !== null,
      totalVideoObjects: r2Objects.length,
      matchedInDatabase: matchedInDatabase,
      orphanObjects: orphanObjects.length,
      orphanKeys: orphanObjects.slice(0, 50).map((o) => o.key),
    },
    inferredOutcomes: {
      successfulDbCreates: uploadLogs.length,
      skippedAsDuplicates: null,
      failedUploads: null,
      stuckInQueue: null,
      r2WithoutDbRecord: orphanObjects.filter((o) => !dbVideoUrls.has(getPublicObjectUrl(o.key))).length,
      dbUnpublishedWithSource: unpublishedEligible.length,
      hiddenFromWebsite: unpublishedEligible.length,
    },
    comparison: {
      r2VideoObjects: r2Objects.length,
      databaseVideos: rows.length,
      websiteVisible,
      gapR2MinusDb: r2Objects.length - rows.length,
    },
  };
}

export async function repairUploadAudit(): Promise<{
  createdFromR2: number;
  published: number;
  categoryCountsSynced: number;
  audit: UploadAuditReport;
  catalog: Awaited<ReturnType<typeof getCatalogAuditReport>>;
}> {
  const db = getSupabaseAdmin();
  const r2Objects = await listR2VideoKeys();
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured.");

  const { data: videos } = await db
    .from("videos")
    .select("id, published, video_url, r2_object_key, google_drive_url, category_id");
  const rows = (videos ?? []) as VideoRow[];

  const dbR2Keys = new Set(rows.map((v) => String(v.r2_object_key ?? "").trim()).filter(Boolean));
  const dbVideoUrls = new Set(rows.map((v) => String(v.video_url ?? "").trim()).filter(Boolean));
  const orphanObjects = r2Objects.filter((o) => !dbR2Keys.has(o.key));

  const { data: categories } = await db.from("categories").select("id, name").order("name").limit(1);
  const defaultCategory = categories?.[0];
  if (!defaultCategory && orphanObjects.length > 0) {
    throw new Error("No categories found — cannot create videos from orphan R2 objects.");
  }

  const cols = await getVideoOptionalColumns(true);
  let createdFromR2 = 0;
  let nextDisplayOrder = cols.displayOrder ? await getNextDisplayOrder() : null;

  for (const orphan of orphanObjects) {
    const videoUrl = getPublicObjectUrl(orphan.key);
    if (dbVideoUrls.has(videoUrl)) continue;

    const id = `vid-repair-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const row = {
      id,
      title: titleFromObjectKey(orphan.key),
      description: "Recovered from R2 during upload audit.",
      category_id: defaultCategory!.id,
      category_name: defaultCategory!.name,
      thumbnail_url: "",
      video_url: videoUrl,
      r2_object_key: orphan.key,
      video_storage: "r2",
      google_drive_url: "",
      duration: "0:00",
      resolution: "1080p",
      is_vip: false,
      is_featured: false,
      is_pinned: false,
      pin_order: null,
      autoplay: false,
      tags: [],
      views: 0,
      likes_count: 0,
      trial_enabled: false,
      trial_duration_value: 0,
      trial_duration_unit: "minutes",
      channel: "VZW",
      published: true,
      file_size: orphan.size || null,
      source_file_name: orphan.key.split("/").pop() ?? null,
      ...(nextDisplayOrder != null ? { display_order: nextDisplayOrder++ } : {}),
    };

    const payload = prepareVideoWriteRow(row, cols);
    const { error } = await supabaseRest("videos", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
    if (error) throw new Error(`Failed to create video for ${orphan.key}: ${error}`);
    createdFromR2 += 1;
    dbR2Keys.add(orphan.key);
    dbVideoUrls.add(videoUrl);
  }

  const unpublishedEligible = rows.filter(
    (v) =>
      v.published === false &&
      (String(v.video_url ?? "").trim() || String(v.google_drive_url ?? "").trim())
  );

  let published = 0;
  if (unpublishedEligible.length > 0) {
    const { error: pubErr } = await db
      .from("videos")
      .update({ published: true })
      .in(
        "id",
        unpublishedEligible.map((v) => v.id)
      );
    if (pubErr) throw new Error(pubErr.message);
    published = unpublishedEligible.length;
  }

  const categoryCountsSynced = await syncAllCategoryVideoCounts();

  const audit = await getUploadAuditReport();
  const catalog = await getCatalogAuditReport();

  return { createdFromR2, published, categoryCountsSynced, audit, catalog };
}
