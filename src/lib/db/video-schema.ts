import { supabaseRest } from "@/lib/db/rest";

export type VideoOptionalColumns = {
  vipTrialSeconds: boolean;
  pinColumns: boolean;
  dedupColumns: boolean;
  displayOrder: boolean;
};

let columnCache: { at: number; cols: VideoOptionalColumns } | null = null;
const CACHE_MS = 60_000;

export async function getVideoOptionalColumns(force = false): Promise<VideoOptionalColumns> {
  if (!force && columnCache && Date.now() - columnCache.at < CACHE_MS) {
    return columnCache.cols;
  }

  const [vipProbe, pinProbe, dedupProbe, orderProbe] = await Promise.all([
    supabaseRest<unknown[]>("videos?select=id,vip_trial_seconds&limit=0"),
    supabaseRest<unknown[]>("videos?select=id,is_pinned,pin_order&limit=0"),
    supabaseRest<unknown[]>("videos?select=id,file_hash,file_size,source_file_name&limit=0"),
    supabaseRest<unknown[]>("videos?select=id,display_order&limit=0"),
  ]);

  const cols: VideoOptionalColumns = {
    vipTrialSeconds: !vipProbe.error,
    pinColumns: !pinProbe.error,
    dedupColumns: !dedupProbe.error,
    displayOrder: !orderProbe.error,
  };
  columnCache = { at: Date.now(), cols };
  return cols;
}

export function invalidateVideoColumnCache(): void {
  columnCache = null;
}

export function resolveVipTrialSeconds(row: Record<string, unknown>): number | null {
  if (row.vip_trial_seconds !== null && row.vip_trial_seconds !== undefined) {
    return Number(row.vip_trial_seconds);
  }
  if (!row.trial_enabled) return null;

  const value = Number(row.trial_duration_value ?? 0);
  const unit = String(row.trial_duration_unit ?? "minutes");
  if (unit === "seconds") return value;
  if (unit === "hours") return value * 3600;
  return value * 60;
}

export function prepareVideoWriteRow(
  row: Record<string, unknown>,
  cols: VideoOptionalColumns
): Record<string, unknown> {
  const out = { ...row };

  if (!cols.vipTrialSeconds) {
    const seconds = out.vip_trial_seconds;
    delete out.vip_trial_seconds;
    if (seconds !== null && seconds !== undefined && Number(seconds) > 0) {
      out.trial_enabled = true;
      out.trial_duration_value = Number(seconds);
      out.trial_duration_unit = "seconds";
    }
  }

  if (!cols.pinColumns) {
    delete out.is_pinned;
    delete out.pin_order;
  }

  if (!cols.dedupColumns) {
    delete out.file_hash;
    delete out.file_size;
    delete out.source_file_name;
  }

  if (!cols.displayOrder) {
    delete out.display_order;
  }

  return out;
}

export function prepareVideoUpdateData(
  data: Record<string, unknown>,
  cols: VideoOptionalColumns
): Record<string, unknown> {
  const out = { ...data };

  if (!cols.vipTrialSeconds && out.vip_trial_seconds !== undefined) {
    const seconds = out.vip_trial_seconds;
    delete out.vip_trial_seconds;
    if (seconds !== null && Number(seconds) > 0) {
      out.trial_enabled = true;
      out.trial_duration_value = Number(seconds);
      out.trial_duration_unit = "seconds";
    }
  }

  if (!cols.pinColumns) {
    delete out.is_pinned;
    delete out.pin_order;
  }

  if (!cols.dedupColumns) {
    delete out.file_hash;
    delete out.file_size;
    delete out.source_file_name;
  }

  if (!cols.displayOrder) {
    delete out.display_order;
  }

  return out;
}
