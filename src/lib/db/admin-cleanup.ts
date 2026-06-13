import { supabaseRest } from "./rest";
import { deleteVideo } from "./repository";

type TransactionRow = {
  id: number;
  order_id: string;
  device_id: string | null;
  status: string;
};

export async function deleteTransactionsBulk(ids: number[]) {
  const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => id > 0))];
  if (uniqueIds.length === 0) return { deleted: 0, subscriptionsRemoved: 0, orderIds: [] as string[] };

  const { data, error } = await supabaseRest<TransactionRow[]>(
    `transactions?id=in.(${uniqueIds.join(",")})&select=id,order_id,device_id,status`
  );
  if (error) throw new Error(error);

  const rows = data ?? [];
  let subscriptionsRemoved = 0;

  for (const row of rows) {
    const orderId = String(row.order_id ?? "").trim();
    const deviceId = String(row.device_id ?? "").trim();

    if (orderId) {
      const { error: subErr } = await supabaseRest(
        `device_subscriptions?transaction_id=eq.${encodeURIComponent(orderId)}`,
        { method: "DELETE" }
      );
      if (!subErr) subscriptionsRemoved += 1;
    }

    if (deviceId && row.status === "completed") {
      const { data: remaining } = await supabaseRest<{ id: number }[]>(
        `transactions?device_id=eq.${encodeURIComponent(deviceId)}&status=eq.completed&id=neq.${row.id}&select=id&limit=1`
      );
      if ((remaining?.length ?? 0) === 0) {
        await supabaseRest(`device_subscriptions?device_id=eq.${encodeURIComponent(deviceId)}`, {
          method: "DELETE",
        });
      }
    }
  }

  const { error: delErr } = await supabaseRest(`transactions?id=in.(${uniqueIds.join(",")})`, {
    method: "DELETE",
  });
  if (delErr) throw new Error(delErr);

  return {
    deleted: rows.length,
    subscriptionsRemoved,
    orderIds: rows.map((r) => r.order_id),
  };
}

export async function deleteDevicesBulk(deviceIds: string[]) {
  const unique = [...new Set(deviceIds.map((d) => String(d).trim()).filter(Boolean))];
  if (unique.length === 0) return { deleted: 0 };

  let removed = 0;
  for (const deviceId of unique) {
    await supabaseRest(`device_subscriptions?device_id=eq.${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
    await supabaseRest(`video_view_sessions?device_id=eq.${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
    await supabaseRest(`video_likes?device_id=eq.${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
    await supabaseRest(`transactions?device_id=eq.${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
    removed += 1;
  }

  return { deleted: removed };
}

export async function deleteVideosBulk(
  ids: string[],
  adminId: string,
  adminName: string
) {
  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  for (const id of unique) {
    await deleteVideo(id, adminId, adminName);
  }
  return { deleted: unique.length };
}

export async function resetVideoLikesBulk(videoIds: string[]) {
  const unique = [...new Set(videoIds.map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) return { reset: 0 };

  for (const videoId of unique) {
    await supabaseRest(`video_likes?video_id=eq.${encodeURIComponent(videoId)}`, {
      method: "DELETE",
    });
    await supabaseRest(`videos?id=eq.${encodeURIComponent(videoId)}`, {
      method: "PATCH",
      body: JSON.stringify({ likes_count: 0 }),
    });
  }

  return { reset: unique.length };
}
