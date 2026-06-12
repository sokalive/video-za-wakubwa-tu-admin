const API_BASE = "/api";

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "An error occurred");
  }

  return data;
}

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      fetchApi<{ success: boolean; admin: { name: string; email: string; role: string } }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify(credentials) }
      ),
    logout: () => fetchApi<{ success: boolean }>("/auth/logout", { method: "POST" }),
    me: () => fetchApi<{ success: boolean; admin: { name: string; email: string; role: string } }>("/auth/me"),
  },
  dashboard: {
    stats: () => fetchApi<{ success: boolean; data: import("@/types").DashboardStats }>("/dashboard/stats"),
  },
  analytics: {
    get: () => fetchApi<{ success: boolean; data: import("@/types").AnalyticsData }>("/analytics"),
  },
  videos: {
    list: (params?: { search?: string; category?: string; isVip?: string }) => {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return fetchApi<{ success: boolean; data: import("@/types").Video[] }>(
        `/videos${query ? `?${query}` : ""}`
      );
    },
    create: (video: Partial<import("@/types").Video>) =>
      fetchApi<{ success: boolean; data: import("@/types").Video }>("/videos", {
        method: "POST",
        body: JSON.stringify(video),
      }),
    update: (id: string, video: Partial<import("@/types").Video>) =>
      fetchApi<{ success: boolean; data: import("@/types").Video }>(`/videos/${id}`, {
        method: "PUT",
        body: JSON.stringify(video),
      }),
    delete: (id: string) =>
      fetchApi<{ success: boolean }>(`/videos/${id}`, { method: "DELETE" }),
  },
  categories: {
    list: () => fetchApi<{ success: boolean; data: import("@/types").Category[] }>("/categories"),
    create: (category: Partial<import("@/types").Category>) =>
      fetchApi<{ success: boolean; data: import("@/types").Category }>("/categories", {
        method: "POST",
        body: JSON.stringify(category),
      }),
    update: (id: string, category: Partial<import("@/types").Category>) =>
      fetchApi<{ success: boolean; data: import("@/types").Category }>(`/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(category),
      }),
    delete: (id: string) =>
      fetchApi<{ success: boolean }>(`/categories/${id}`, { method: "DELETE" }),
  },
  vipPlans: {
    list: () => fetchApi<{ success: boolean; data: import("@/types").VipPlan[] }>("/vip-plans"),
    update: (id: string, plan: Partial<import("@/types").VipPlan>) =>
      fetchApi<{ success: boolean; data: import("@/types").VipPlan }>(`/vip-plans/${id}`, {
        method: "PUT",
        body: JSON.stringify(plan),
      }),
  },
  users: {
    list: (params?: { search?: string; isVip?: string; isActive?: string }) => {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return fetchApi<{ success: boolean; data: import("@/types").User[]; stats: { total: number; vip: number; active: number } }>(
        `/users${query ? `?${query}` : ""}`
      );
    },
  },
  payments: {
    list: () => fetchApi<{ success: boolean; data: import("@/types").Payment[] }>("/payments"),
  },
  apk: {
    get: () => fetchApi<{ success: boolean; data: import("@/types").ApkRelease }>("/apk"),
    update: (data: Partial<import("@/types").ApkRelease>) =>
      fetchApi<{ success: boolean; data: import("@/types").ApkRelease }>("/apk", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
  ads: {
    list: () => fetchApi<{ success: boolean; data: import("@/types").Advertisement[] }>("/advertisements"),
    create: (ad: Partial<import("@/types").Advertisement>) =>
      fetchApi<{ success: boolean; data: import("@/types").Advertisement }>("/advertisements", {
        method: "POST",
        body: JSON.stringify(ad),
      }),
    update: (id: string, ad: Partial<import("@/types").Advertisement>) =>
      fetchApi<{ success: boolean; data: import("@/types").Advertisement }>(`/advertisements/${id}`, {
        method: "PUT",
        body: JSON.stringify(ad),
      }),
    delete: (id: string) =>
      fetchApi<{ success: boolean }>(`/advertisements/${id}`, { method: "DELETE" }),
  },
  settings: {
    get: () => fetchApi<{ success: boolean; data: import("@/types").SiteSettings }>("/settings"),
    update: (data: Partial<import("@/types").SiteSettings>) =>
      fetchApi<{ success: boolean; data: import("@/types").SiteSettings }>("/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
  admins: {
    list: () => fetchApi<{ success: boolean; data: import("@/types").Admin[] }>("/admins"),
  },
  activityLogs: {
    list: () => fetchApi<{ success: boolean; data: import("@/types").ActivityLog[] }>("/activity-logs"),
  },
  upload: async (file: File, folder: "thumbnails" | "apk" | "screenshots") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data as { success: boolean; url: string };
  },
  drive: {
    status: () =>
      fetchApi<{
        success: boolean;
        configured: boolean;
        serviceAccountJsonSet: boolean;
        folderIdSet: boolean;
        jsonParseOk: boolean;
        clientEmail: string | null;
        folderId: string | null;
        rawFolderIdLength: number;
        reason: string | null;
        folderAccessible?: boolean;
        folderName?: string | null;
        folderProbe?: {
          ok: boolean;
          folderId: string;
          serviceAccountEmail: string;
          folderName: string | null;
          fixHint: string | null;
          error: string | null;
        } | null;
        maxBytes: number;
      }>("/drive/upload/session"),
    diagnostics: () =>
      fetchApi<{
        success: boolean;
        config: {
          folderId: string | null;
          clientEmail: string | null;
          rawFolderIdLength: number;
        };
        folderProbe: {
          ok: boolean;
          folderId: string;
          serviceAccountEmail: string;
          folderName: string | null;
          httpStatus: number | null;
          isSharedDrive: boolean;
          canAddChildren: boolean | null;
          error: string | null;
          fixHint: string | null;
        } | null;
        uploadReady: boolean;
      }>("/drive/diagnostics"),
    uploadVideo: async (
      file: File,
      onProgress?: (percent: number) => void
    ): Promise<{ url: string; fileId: string }> => {
      const { uploadVideoToDriveResumable } = await import("@/lib/drive-upload");

      const sessionRes = await fetch("/api/drive/upload/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          uploadOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(sessionData.error || "Failed to start Google Drive upload");
      }

      const fileId = await uploadVideoToDriveResumable(sessionData.uploadUrl, file, (p) =>
        onProgress?.(p.percent)
      );

      const finalizeRes = await fetch("/api/drive/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) {
        throw new Error(finalizeData.error || "Failed to finalize Google Drive upload");
      }

      return { url: finalizeData.url, fileId: finalizeData.fileId };
    },
  },
};
