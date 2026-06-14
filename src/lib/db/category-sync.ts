import { getSupabaseAdmin } from "@/lib/db/client";

export async function syncAllCategoryVideoCounts(): Promise<number> {
  const db = getSupabaseAdmin();
  const { data: categories, error } = await db.from("categories").select("id");
  if (error) throw new Error(error.message);

  let synced = 0;
  for (const cat of categories ?? []) {
    const { count } = await db
      .from("videos")
      .select("*", { count: "exact", head: true })
      .eq("category_id", cat.id)
      .eq("published", true);
    await db.from("categories").update({ video_count: count ?? 0 }).eq("id", cat.id);
    synced += 1;
  }
  return synced;
}
