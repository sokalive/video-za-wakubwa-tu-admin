import { getSupabaseAdmin } from "@/lib/db/client";

export type CatalogAuditVideo = {
  id: string;
  title: string;
  published: boolean;
  isPinned: boolean | null;
  isVip: boolean;
  homepageVisible: boolean;
};

export type CatalogAuditReport = {
  supabaseHost: string;
  totalVideos: number;
  publishedVideos: number;
  unpublishedVideos: number;
  vipVideos: number;
  standardVideos: number;
  publishedVip: number;
  publishedStandard: number;
  missingPlaybackSource: number;
  duplicateFileHashes: number;
  homepageEligible: number;
  websiteVisible: number;
  pinnedVideos: number;
  nullIsPinnedRows: number;
  videos: CatalogAuditVideo[];
  auditedAt: string;
};

export async function getCatalogAuditReport(): Promise<CatalogAuditReport> {
  const db = getSupabaseAdmin();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let supabaseHost = "";
  try {
    supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : "";
  } catch {
    supabaseHost = "invalid";
  }

  const { data: rows, error } = await db
    .from("videos")
    .select("id, title, published, is_vip, is_pinned, video_url, google_drive_url, file_hash");

  if (error) throw new Error(error.message);

  const videos = rows ?? [];
  const hashGroups = new Map<string, number>();

  let publishedVideos = 0;
  let unpublishedVideos = 0;
  let vipVideos = 0;
  let standardVideos = 0;
  let publishedVip = 0;
  let publishedStandard = 0;
  let missingPlaybackSource = 0;
  let homepageEligible = 0;
  let pinnedVideos = 0;
  let nullIsPinnedRows = 0;
  const videosOut: CatalogAuditVideo[] = [];

  for (const row of videos) {
    const published = row.published !== false;
    const isVip = Boolean(row.is_vip);
    const isPinned =
      row.is_pinned === null || row.is_pinned === undefined
        ? null
        : Boolean(row.is_pinned);
    const hasSource =
      String(row.video_url ?? "").trim() !== "" ||
      String(row.google_drive_url ?? "").trim() !== "";

    if (isPinned === null) nullIsPinnedRows += 1;
    if (isPinned === true) pinnedVideos += 1;

    videosOut.push({
      id: String(row.id),
      title: String(row.title ?? ""),
      published,
      isPinned,
      isVip,
      homepageVisible: published && hasSource,
    });

    if (published) publishedVideos += 1;
    else unpublishedVideos += 1;

    if (isVip) vipVideos += 1;
    else standardVideos += 1;

    if (published && isVip) publishedVip += 1;
    if (published && !isVip) publishedStandard += 1;

    if (!hasSource) missingPlaybackSource += 1;
    if (published && hasSource) homepageEligible += 1;

    const hash = String(row.file_hash ?? "").trim();
    if (hash) hashGroups.set(hash, (hashGroups.get(hash) ?? 0) + 1);
  }

  let duplicateFileHashes = 0;
  for (const count of hashGroups.values()) {
    if (count > 1) duplicateFileHashes += count - 1;
  }

  return {
    supabaseHost,
    totalVideos: videos.length,
    publishedVideos,
    unpublishedVideos,
    vipVideos,
    standardVideos,
    publishedVip,
    publishedStandard,
    missingPlaybackSource,
    duplicateFileHashes,
    homepageEligible,
    websiteVisible: publishedVideos,
    pinnedVideos,
    nullIsPinnedRows,
    videos: videosOut.sort((a, b) => a.id.localeCompare(b.id)),
    auditedAt: new Date().toISOString(),
  };
}

export async function fixNullIsPinnedFlags(): Promise<{ updated: number }> {
  const db = getSupabaseAdmin();
  const { data: rows, error } = await db.from("videos").select("id").is("is_pinned", null);
  if (error) throw new Error(error.message);
  if (!rows?.length) return { updated: 0 };

  const { error: updateError } = await db.from("videos").update({ is_pinned: false }).is("is_pinned", null);
  if (updateError) throw new Error(updateError.message);
  return { updated: rows.length };
}

export async function publishAllEligibleVideos(): Promise<{ updated: number }> {
  const db = getSupabaseAdmin();
  const { data: rows, error } = await db
    .from("videos")
    .select("id, published, video_url, google_drive_url");

  if (error) throw new Error(error.message);

  const toPublish = (rows ?? []).filter((row) => {
    if (row.published !== false) return false;
    return (
      String(row.video_url ?? "").trim() !== "" ||
      String(row.google_drive_url ?? "").trim() !== ""
    );
  });

  if (toPublish.length === 0) return { updated: 0 };

  const { error: updateError } = await db
    .from("videos")
    .update({ published: true })
    .in(
      "id",
      toPublish.map((row) => row.id)
    );

  if (updateError) throw new Error(updateError.message);
  return { updated: toPublish.length };
}
