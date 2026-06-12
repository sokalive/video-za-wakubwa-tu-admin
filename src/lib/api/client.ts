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
      const query = new URLSearchParams();
      if (params?.search) query.set("search", params.search);
      if (params?.category) query.set("category", params.category);
      if (params?.isVip) query.set("isVip", params.isVip);
      const qs = query.toString();
      return fetchApi<{ success: boolean; data: import("@/types").Video[] }>(
        `/videos${qs ? `?${qs}` : ""}`
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
    create: (plan: Partial<import("@/types").VipPlan>) =>
      fetchApi<{ success: boolean; data: import("@/types").VipPlan }>("/vip-plans", {
        method: "POST",
        body: JSON.stringify(plan),
      }),
    update: (id: string, plan: Partial<import("@/types").VipPlan>) =>
      fetchApi<{ success: boolean; data: import("@/types").VipPlan }>(`/vip-plans/${id}`, {
        method: "PUT",
        body: JSON.stringify(plan),
      }),
  },
  vipTrialSettings: {
    get: () =>
      fetchApi<{ success: boolean; data: import("@/types").VipTrialSettings }>("/vip-trial-settings"),
    update: (settings: Partial<import("@/types").VipTrialSettings>) =>
      fetchApi<{ success: boolean; data: import("@/types").VipTrialSettings }>("/vip-trial-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }),
  },
  sonicpesa: {
    get: () => fetchApi<{ success: boolean; data: import("@/types").SonicpesaSettings }>("/settings/sonicpesa"),
    update: (body: Record<string, unknown>) =>
      fetchApi<{ success: boolean; data: import("@/types").SonicpesaSettings }>("/settings/sonicpesa", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    test: () =>
      fetchApi<{ success: boolean; message: string; httpStatus?: number }>("/settings/sonicpesa/test", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  },
  transactions: {
    list: (status?: string) => {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      return fetchApi<{ success: boolean; data: import("@/types").BillingTransaction[] }>(`/transactions${qs}`);
    },
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
  reports: {
    list: () => fetchApi<{ success: boolean; data: import("@/types").VideoReport[] }>("/reports"),
    dismiss: (id: string) =>
      fetchApi<{ success: boolean }>(`/reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "dismiss" }),
      }),
    delete: (id: string) =>
      fetchApi<{ success: boolean }>(`/reports/${id}`, { method: "DELETE" }),
  },
  likesAnalytics: {
    list: () =>
      fetchApi<{ success: boolean; data: import("@/types").VideoLikeStat[] }>(
        "/likes-analytics"
      ),
  },
  r2: {
    status: () =>
      fetchApi<{
        success: boolean;
        configured: boolean;
        bucketName: string | null;
        publicUrl: string | null;
        reason: string | null;
      }>("/r2/upload/session"),
    uploadVideo: async (
      file: File,
      onProgress?: (percent: number) => void
    ): Promise<{ url: string; objectKey: string }> => {
      const { uploadVideoToR2 } = await import("@/lib/r2-upload");

      const sessionRes = await fetch("/api/r2/upload/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(sessionData.error || "Failed to start R2 upload");
      }

      await uploadVideoToR2(sessionData.uploadUrl, file, (p) => onProgress?.(p.percent));

      return { url: sessionData.publicUrl, objectKey: sessionData.objectKey };
    },
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
};
