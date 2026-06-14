"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Upload,
  Film,
  ImageIcon,
  Play,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/client";
import { formatBytes } from "@/lib/r2-upload";
import {
  BULK_UPLOAD_CONCURRENCY,
  titleFromFileName,
  uniqueQueueId,
  validateThumbnailFile,
  validateVideoFile,
} from "@/lib/video-upload-validation";
import {
  computeFileSha256,
  DUPLICATE_MESSAGE,
  resolveUploadThumbnail,
} from "@/lib/video-file-utils";
import type { Video } from "@/types";

type QueueStatus = "pending" | "uploading" | "creating" | "done" | "error" | "skipped";

type QueueItem = {
  id: string;
  file: File;
  title: string;
  customThumbnail: File | null;
  status: QueueStatus;
  progress: number;
  error?: string;
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-blue-500 transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function statusBadge(status: QueueStatus) {
  switch (status) {
    case "done":
      return <Badge variant="success">Done</Badge>;
    case "error":
      return <Badge variant="destructive">Failed</Badge>;
    case "skipped":
      return <Badge variant="secondary">Skipped</Badge>;
    case "uploading":
      return <Badge variant="warning">Uploading</Badge>;
    case "creating":
      return <Badge variant="default">Saving</Badge>;
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}

export default function BulkUploadPage() {
  const queryClient = useQueryClient();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const sharedThumbRef = useRef<HTMLInputElement>(null);

  const [channelName, setChannelName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isVip, setIsVip] = useState<"free" | "vip">("free");
  const [sharedThumbnail, setSharedThumbnail] = useState<File | null>(null);
  const [sharedThumbnailPreview, setSharedThumbnailPreview] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [sharedThumbUrl, setSharedThumbUrl] = useState<string | null>(null);

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories.list(),
  });

  const { data: r2Status } = useQuery({
    queryKey: ["r2", "status"],
    queryFn: () => api.r2.status(),
    staleTime: 60_000,
  });

  const categories = categoriesData?.data ?? [];
  const r2Configured = r2Status?.configured ?? false;

  const stats = useMemo(() => {
    const total = queue.length;
    const done = queue.filter((q) => q.status === "done").length;
    const failed = queue.filter((q) => q.status === "error").length;
    const pending = queue.filter((q) => q.status === "pending").length;
    return { total, done, failed, pending };
  }, [queue]);

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    const newItems: QueueItem[] = [];

    for (const file of incoming) {
      const validationError = validateVideoFile(file);
      newItems.push({
        id: uniqueQueueId(),
        file,
        title: titleFromFileName(file.name),
        customThumbnail: null,
        status: validationError ? "error" : "pending",
        progress: 0,
        error: validationError ?? undefined,
      });
    }

    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (running) return;
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles, running]
  );

  const onSharedThumbnailChange = (file: File | null) => {
    if (!file) {
      setSharedThumbnail(null);
      setSharedThumbnailPreview(null);
      return;
    }
    const err = validateThumbnailFile(file);
    if (err) {
      alert(err);
      return;
    }
    setSharedThumbnail(file);
    setSharedThumbnailPreview(URL.createObjectURL(file));
    setSharedThumbUrl(null);
  };

  const setCustomThumbnail = (id: string, file: File | null) => {
    if (file) {
      const err = validateThumbnailFile(file);
      if (err) {
        alert(err);
        return;
      }
    }
    updateItem(id, { customThumbnail: file });
  };

  const removeItem = (id: string) => {
    if (running) return;
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearQueue = () => {
    if (running) return;
    setQueue([]);
    setSharedThumbUrl(null);
  };

  const processOne = async (
    item: QueueItem,
    settings: {
      channel: string;
      categoryId: string;
      isVip: boolean;
      defaultThumbnailUrl: string;
    }
  ) => {
    if (item.status === "error" && item.error?.includes("Unsupported")) return;

    try {
      updateItem(item.id, { status: "uploading", progress: 0, error: undefined });

      const fileHash = await computeFileSha256(item.file);
      const duplicateCheck = await api.videos.checkDuplicate({
        fileHash,
        fileSize: item.file.size,
        sourceFileName: item.file.name,
      });
      if (duplicateCheck.duplicate) {
        updateItem(item.id, { status: "skipped", error: DUPLICATE_MESSAGE });
        return;
      }

      const { url, objectKey } = await api.r2.uploadVideo(item.file, (percent) => {
        updateItem(item.id, { progress: percent });
      });

      let thumbnailUrl = settings.defaultThumbnailUrl;
      if (item.customThumbnail) {
        const { url: thumbUrl } = await api.upload(item.customThumbnail, "thumbnails");
        thumbnailUrl = thumbUrl;
      } else if (!thumbnailUrl) {
        const generated = await resolveUploadThumbnail(item.file);
        const { url: thumbUrl } = await api.upload(generated, "thumbnails");
        thumbnailUrl = thumbUrl;
      }

      updateItem(item.id, { status: "creating", progress: 100 });

      const payload: Partial<Video> = {
        title: item.title,
        description: "",
        categoryId: settings.categoryId,
        channel: settings.channel,
        thumbnailUrl,
        videoUrl: url,
        r2ObjectKey: objectKey,
        videoStorage: "r2",
        googleDriveUrl: "",
        fileHash,
        fileSize: item.file.size,
        sourceFileName: item.file.name,
        isVip: settings.isVip,
        isFeatured: false,
        autoplay: false,
      };

      await api.videos.create(payload);
      updateItem(item.id, { status: "done", progress: 100 });
    } catch (err) {
      updateItem(item.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  };

  const startUpload = async () => {
    if (!r2Configured) {
      alert(r2Status?.reason ?? "Cloudflare R2 is not configured.");
      return;
    }
    if (!channelName.trim()) {
      alert("Enter a channel name for all videos.");
      return;
    }
    if (!categoryId) {
      alert("Select a category for all videos.");
      return;
    }
    const pending = queue.filter((q) => q.status === "pending");
    if (pending.length === 0) {
      alert("Add at least one valid video to the queue.");
      return;
    }

    setRunning(true);
    try {
      let defaultThumbnailUrl = sharedThumbUrl ?? "";
      if (sharedThumbnail && !defaultThumbnailUrl) {
        const { url } = await api.upload(sharedThumbnail, "thumbnails");
        defaultThumbnailUrl = url;
        setSharedThumbUrl(url);
      }

      const settings = {
        channel: channelName.trim(),
        categoryId,
        isVip: isVip === "vip",
        defaultThumbnailUrl,
      };

      const work = queue.filter((q) => q.status === "pending");

      for (let i = 0; i < work.length; i += BULK_UPLOAD_CONCURRENCY) {
        const batch = work.slice(i, i + BULK_UPLOAD_CONCURRENCY);
        await Promise.all(batch.map((item) => processOne(item, settings)));
      }

      await queryClient.invalidateQueries({ queryKey: ["videos"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setRunning(false);
    }
  };

  return (
    <DashboardShell title="Bulk Upload Studio">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/videos">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Videos
            </Link>
          </Button>
          {stats.total > 0 && (
            <div className="flex flex-wrap gap-2 text-sm text-gray-400">
              <span>{stats.total} in queue</span>
              <span className="text-green-400">{stats.done} done</span>
              {stats.failed > 0 && <span className="text-red-400">{stats.failed} failed</span>}
            </div>
          )}
        </div>

        {!r2Configured && (
          <Card className="border-red-500/30 bg-red-500/10">
            <CardContent className="p-4 flex items-start gap-3 text-sm text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {r2Status?.reason ?? "R2 is not configured. Bulk upload requires Cloudflare R2."}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shared settings (all videos)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="channel">Channel name *</Label>
                <Input
                  id="channel"
                  placeholder="e.g. Wakubwa TV"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  disabled={running}
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={categoryId} onValueChange={setCategoryId} disabled={running}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Access</Label>
                <Select
                  value={isVip}
                  onValueChange={(v) => setIsVip(v as "free" | "vip")}
                  disabled={running}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Shared thumbnail (optional)
                </Label>
                <Input
                  ref={sharedThumbRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={running}
                  onChange={(e) => onSharedThumbnailChange(e.target.files?.[0] ?? null)}
                />
                {sharedThumbnailPreview && (
                  <img
                    src={sharedThumbnailPreview}
                    alt="Shared thumbnail preview"
                    className="h-20 w-36 rounded-lg object-cover ring-1 ring-white/10"
                  />
                )}
                <p className="text-xs text-gray-500">
                  Applied to every video unless overridden per row below.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add video files</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!running) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragOver
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/15 bg-white/[0.02] hover:border-white/25"
                } ${running ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
                onClick={() => !running && videoInputRef.current?.click()}
              >
                <Upload className="mb-3 h-10 w-10 text-gray-500" />
                <p className="font-medium text-white">Drag & drop videos here</p>
                <p className="mt-1 text-sm text-gray-500">or click to browse — MP4, WebM, MOV, AVI, MKV</p>
                <p className="mt-2 text-xs text-gray-600">Max 5 GB per file · 100+ files supported</p>
                <input
                  ref={videoInputRef}
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.webm,.mov,.avi,.mkv"
                  className="hidden"
                  disabled={running}
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {queue.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Upload queue</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearQueue} disabled={running}>
                  Clear
                </Button>
                <Button onClick={startUpload} disabled={running || !r2Configured}>
                  {running ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" /> Start upload ({stats.pending} pending)
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[480px] overflow-y-auto">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Film className="h-5 w-5 shrink-0 text-gray-500 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <Input
                          value={item.title}
                          onChange={(e) => updateItem(item.id, { title: e.target.value })}
                          disabled={running || item.status === "done"}
                          className="h-8 text-sm font-medium"
                        />
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {item.file.name} · {formatBytes(item.file.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(item.status)}
                      {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                      {!running && item.status !== "uploading" && item.status !== "creating" && (
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {(item.status === "uploading" || item.status === "creating" || item.status === "done") && (
                    <ProgressBar value={item.progress} />
                  )}

                  {item.error && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {item.error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs text-gray-500 shrink-0">Custom thumbnail:</Label>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="h-8 max-w-xs text-xs"
                      disabled={running || item.status === "done"}
                      onChange={(e) => setCustomThumbnail(item.id, e.target.files?.[0] ?? null)}
                    />
                    {item.customThumbnail && (
                      <span className="text-xs text-gray-400 truncate max-w-[120px]">
                        {item.customThumbnail.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
