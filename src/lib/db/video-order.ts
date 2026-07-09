import { getSupabaseAdmin } from "@/lib/db/client";
import { supabaseRest } from "@/lib/db/rest";

export function compareVideoDisplayOrder(
  a: { displayOrder?: number | null; createdAt?: string; id: string },
  b: { displayOrder?: number | null; createdAt?: string; id: string }
): number {
  const ao = a.displayOrder ?? 999_999;
  const bo = b.displayOrder ?? 999_999;
  if (ao !== bo) return ao - bo;
  const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (at !== bt) return at - bt;
  return a.id.localeCompare(b.id);
}

export async function getNextDisplayOrder(): Promise<number> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("videos")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.display_order ?? 0) + 1;
}

export async function reorderVideos(orderedIds: string[]): Promise<{ updated: number }> {
  const unique = [...new Set(orderedIds.map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) throw new Error("orderedIds is required");

  const db = getSupabaseAdmin();
  const { data: existing, error } = await db.from("videos").select("id");
  if (error) throw new Error(error.message);

  const allIds = new Set((existing ?? []).map((r) => r.id));
  for (const id of unique) {
    if (!allIds.has(id)) throw new Error(`Unknown video id: ${id}`);
  }
  if (unique.length !== allIds.size) {
    throw new Error("Reorder must include every video id exactly once");
  }

  const now = new Date().toISOString();
  await Promise.all(
    unique.map((id, index) =>
      supabaseRest(`videos?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ display_order: index + 1, updated_at: now }),
      }).then(({ error: patchErr }) => {
        if (patchErr) throw new Error(patchErr);
      })
    )
  );

  return { updated: unique.length };
}
