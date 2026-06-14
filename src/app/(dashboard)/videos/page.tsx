"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Crown, Star, Pin, ExternalLink, Film, Upload, Layers } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BulkDeleteDialog } from "@/components/admin/bulk-delete-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { formatNumber } from "@/lib/utils";
import { formatBytes } from "@/lib/r2-upload";
import {
  computeFileSha256,
  DUPLICATE_MESSAGE,
  resolveUploadThumbnail,
} from "@/lib/video-file-utils";
import type { TrialDurationUnit, Video, VideoStorage } from "@/types";
import { TRIAL_DURATION_UNITS } from "@/lib/duration";

const THUMBNAIL_PLACEHOLDER = "/video-thumbnail-placeholder.svg";

function VideoThumbnailCell({ video, onEdit }: { video: Video; onEdit: () => void }) {
  const [broken, setBroken] = useState(false);
  const src = video.thumbnailUrl && !broken ? video.thumbnailUrl : THUMBNAIL_PLACEHOLDER;

  return (
    <button
      type="button"
      onClick={onEdit}
      title={`Edit ${video.title}`}
      className="group block shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10 transition hover:ring-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Image
        src={src}
        alt={`${video.title} thumbnail`}
        width={80}
        height={45}
        loading="lazy"
        sizes="80px"
        className="aspect-video h-[45px] w-[64px] object-cover bg-white/5 sm:h-[45px] sm:w-[80px]"
        onError={() => setBroken(true)}
      />
    </button>
  );
}

const emptyVideo = {
  title: "",
  description: "",
  categoryId: "",
  videoUrl: "",
  r2ObjectKey: "",
  videoStorage: "r2" as VideoStorage,
  googleDriveUrl: "",
  isVip: false,
  vipTrialSeconds: null as number | null,
  isFeatured: false,
  isPinned: false,
  pinOrder: null as number | null,
  autoplay: false,
  trialEnabled: false,
  trialDurationValue: 5,
  trialDurationUnit: "minutes" as TrialDurationUnit,
  tags: [] as string[],
};

export default function VideosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterVip, setFilterVip] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [form, setForm] = useState(emptyVideo);
  const [tagInput, setTagInput] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [savePhase, setSavePhase] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["videos", search, filterVip],
    queryFn: () => api.videos.list({
      search: search || undefined,
      isVip: filterVip !== "all" ? filterVip : undefined,
    }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories.list(),
  });

  const { data: trialSettingsData } = useQuery({
    queryKey: ["vip-trial-settings"],
    queryFn: () => api.vipTrialSettings.get(),
  });

  const globalTrial = trialSettingsData?.data;

  const { data: r2Status } = useQuery({
    queryKey: ["r2", "status"],
    queryFn: () => api.r2.status(),
    staleTime: 60_000,
  });

  const r2Configured = r2Status?.configured ?? false;

  const createMutation = useMutation({
    mutationFn: (video: Partial<Video>) => api.videos.create(video),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Video> }) =>
      api.videos.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setDialogOpen(false);
      setEditingVideo(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.videos.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.videos.bulkDelete(ids),
    onSuccess: () => {
      setSelected(new Set());
      setBulkConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({
      id,
      pinned,
      pinOrder,
    }: {
      id: string;
      pinned: boolean;
      pinOrder?: number;
    }) => api.videos.setPin(id, { pinned, pinOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });

  const resetForm = () => {
    setForm(emptyVideo);
    setTagInput("");
    setThumbnailFile(null);
    setVideoFile(null);
    setSavePhase("");
    setUploadProgress(0);
  };

  const openCreate = () => {
    setEditingVideo(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (video: Video) => {
    setEditingVideo(video);
    setForm({
      title: video.title,
      description: video.description,
      categoryId: video.categoryId,
      videoUrl: video.videoUrl,
      r2ObjectKey: video.r2ObjectKey,
      videoStorage: video.videoStorage,
      googleDriveUrl: video.googleDriveUrl,
      isVip: video.isVip,
      vipTrialSeconds: video.vipTrialSeconds ?? null,
      isFeatured: video.isFeatured,
      isPinned: video.isPinned,
      pinOrder: video.pinOrder,
      autoplay: video.autoplay,
      trialEnabled: video.trialEnabled,
      trialDurationValue: video.trialDurationValue,
      trialDurationUnit: video.trialDurationUnit,
      tags: video.tags,
    });
    setVideoFile(null);
    setThumbnailFile(null);
    setSavePhase("");
    setUploadProgress(0);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasExistingSource = !!(form.videoUrl || form.googleDriveUrl);
    const hasNewVideoFile = !!videoFile;

    if (!editingVideo && !hasNewVideoFile) {
      alert("Select a video file to upload to Cloudflare R2.");
      return;
    }

    if (!editingVideo && !hasNewVideoFile && !hasExistingSource) {
      alert("Upload a video file.");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Video> = { ...form };

      if (videoFile) {
        if (!r2Configured) {
          throw new Error(r2Status?.reason ?? "Cloudflare R2 is not configured on the server.");
        }

        setSavePhase("Checking for duplicates...");
        const fileHash = await computeFileSha256(videoFile);
        const duplicateCheck = await api.videos.checkDuplicate({
          fileHash,
          fileSize: videoFile.size,
        });
        if (duplicateCheck.duplicate) {
          throw new Error(DUPLICATE_MESSAGE);
        }

        setSavePhase("Uploading video to Cloudflare R2...");
        setUploadProgress(0);
        const { url, objectKey } = await api.r2.uploadVideo(videoFile, setUploadProgress);
        payload.videoUrl = url;
        payload.r2ObjectKey = objectKey;
        payload.videoStorage = "r2";
        payload.googleDriveUrl = "";
        payload.fileHash = fileHash;
        payload.fileSize = videoFile.size;
        payload.sourceFileName = videoFile.name;
      } else if (!payload.videoUrl && !payload.googleDriveUrl) {
        throw new Error("Video file or existing video URL is required.");
      }

      if (thumbnailFile) {
        setSavePhase("Uploading thumbnail...");
        const { url } = await api.upload(thumbnailFile, "thumbnails");
        payload.thumbnailUrl = url;
      } else if (videoFile && !payload.thumbnailUrl) {
        setSavePhase("Generating thumbnail...");
        const generated = await resolveUploadThumbnail(videoFile);
        const { url } = await api.upload(generated, "thumbnails");
        payload.thumbnailUrl = url;
      }

      setSavePhase("Saving video...");
      if (editingVideo) {
        await updateMutation.mutateAsync({ id: editingVideo.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
      setSavePhase("");
      setUploadProgress(0);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  const videos = [...(data?.data || [])].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.isPinned && b.isPinned) {
      return (a.pinOrder ?? 9999) - (b.pinOrder ?? 9999);
    }
    return 0;
  });
  const categories = categoriesData?.data || [];
  const allSelected = videos.length > 0 && videos.every((v) => selected.has(v.id));
  const selectedCount = videos.filter((v) => selected.has(v.id)).length;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(videos.map((v) => v.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const playbackLink = (video: Video) =>
    video.videoStorage === "r2" && video.videoUrl ? video.videoUrl : video.googleDriveUrl;

  return (
    <DashboardShell title="Videos">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-1 min-w-0">
            <div className="relative flex-1 min-w-0 max-w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Search videos..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterVip} onValueChange={setFilterVip}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Videos</SelectItem>
                <SelectItem value="true">VIP Only</SelectItem>
                <SelectItem value="false">Free Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {selectedCount > 0 && (
              <Button variant="destructive" size="sm" className="touch-manipulation" onClick={() => setBulkConfirmOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Delete</span> ({selectedCount})
              </Button>
            )}
            <Button variant="outline" size="sm" className="touch-manipulation" asChild>
              <Link href="/videos/bulk-upload">
                <Layers className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Bulk Upload</span>
              </Link>
            </Button>
            <Button size="sm" className="touch-manipulation" onClick={openCreate}>
              <Plus className="h-4 w-4 sm:mr-1" /> Add Video
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-6 text-sm text-red-400">
                Failed to load videos: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : videos.length === 0 ? (
              <div className="p-6 text-sm text-gray-400">
                No videos found. Click &quot;Add Video&quot; to upload your first video.
              </div>
            ) : (
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 w-[72px] bg-[#12121f] sm:w-[88px]">
                      Thumbnail
                    </TableHead>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all videos" />
                    </TableHead>
                    <TableHead className="min-w-[140px]">Video</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="hidden lg:table-cell">Source</TableHead>
                    <TableHead className="hidden sm:table-cell">Views</TableHead>
                    <TableHead className="hidden sm:table-cell">Likes</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell className="sticky left-0 z-10 bg-[#12121f] py-2">
                        <VideoThumbnailCell video={video} onEdit={() => openEdit(video)} />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(video.id)}
                          onCheckedChange={() => toggleOne(video.id)}
                          aria-label={`Select ${video.title}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-white flex items-center gap-2">
                            {video.isPinned && <span title="Pinned">📌</span>}
                            {video.title}
                          </p>
                          <p className="text-xs text-gray-500 line-clamp-1">{video.description}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{video.categoryName}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {playbackLink(video) ? (
                          <a
                            href={playbackLink(video)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {video.videoStorage === "r2" ? "R2" : "Drive"}
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{formatNumber(video.views)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatNumber(video.likesCount)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {video.isPinned && (
                            <Badge variant="default" className="bg-amber-600/90 hover:bg-amber-600/90">
                              📌 Pinned{video.pinOrder != null ? ` #${video.pinOrder}` : ""}
                            </Badge>
                          )}
                          {video.isVip && <Badge variant="default"><Crown className="h-3 w-3 mr-1" />VIP</Badge>}
                          {video.isPinned && (
                            <Badge variant="default">
                              <Pin className="h-3 w-3 mr-1" />
                              Pin #{video.pinOrder ?? "—"}
                            </Badge>
                          )}
                          {video.isFeatured && <Badge variant="warning"><Star className="h-3 w-3 mr-1" />Featured</Badge>}
                          {video.autoplay && <Badge variant="secondary">Autoplay</Badge>}
                          {!video.isVip && !video.isFeatured && !video.autoplay && !video.isPinned && (
                            <Badge variant="secondary">Free</Badge>
                          )}
                        </div>
                        {video.isPinned && (
                          <div className="mt-2 flex items-center gap-2">
                            <Label htmlFor={`pin-order-${video.id}`} className="text-xs text-gray-400 whitespace-nowrap">
                              Order
                            </Label>
                            <Input
                              id={`pin-order-${video.id}`}
                              type="number"
                              min={1}
                              className="h-7 w-16 text-xs"
                              defaultValue={video.pinOrder ?? 1}
                              key={`${video.id}-${video.pinOrder}`}
                              disabled={pinMutation.isPending}
                              onBlur={(e) => {
                                const next = Math.max(1, Number(e.target.value) || 1);
                                if (next !== video.pinOrder) {
                                  pinMutation.mutate({ id: video.id, pinned: true, pinOrder: next });
                                }
                              }}
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 sm:gap-2 flex-wrap">
                          <Button
                            variant={video.isPinned ? "secondary" : "ghost"}
                            size="icon"
                            className="h-9 w-9 touch-manipulation sm:h-8 sm:w-auto sm:px-3"
                            title={video.isPinned ? "Unpin video" : "Pin video"}
                            disabled={pinMutation.isPending}
                            onClick={() =>
                              pinMutation.mutate({
                                id: video.id,
                                pinned: !video.isPinned,
                              })
                            }
                          >
                            <span className="sm:mr-1">📌</span>
                            <span className="hidden sm:inline">{video.isPinned ? "Unpin" : "Pin"}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 touch-manipulation"
                            onClick={() => openEdit(video)}
                            title="Edit video"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 touch-manipulation"
                            onClick={() => {
                              if (confirm("Delete this video?")) deleteMutation.mutate(video.id);
                            }}
                            title="Delete video"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingVideo ? "Edit Video" : "Add Video"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Video Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
                <Label className="flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  {editingVideo ? "Replace Video File (optional)" : "Video File (Cloudflare R2)"}
                </Label>
                <Input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.webm,.mov,.avi,.mkv"
                  disabled={saving || !r2Configured}
                  required={!editingVideo}
                  onChange={(e) => {
                    setVideoFile(e.target.files?.[0] ?? null);
                    if (e.target.files?.[0]) setUploadProgress(0);
                  }}
                />
                {videoFile && (
                  <p className="text-xs text-gray-400">
                    Selected: {videoFile.name} ({formatBytes(videoFile.size)})
                  </p>
                )}
                {editingVideo && !videoFile && (form.videoUrl || form.googleDriveUrl) && (
                  <p className="text-xs text-gray-400">
                    Current: {form.videoStorage === "r2" ? "R2" : "Google Drive (legacy)"} — select a new file to replace
                  </p>
                )}
                {saving && savePhase.startsWith("Uploading video") && (
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-400">{uploadProgress}% — {savePhase}</p>
                  </div>
                )}
                {r2Configured ? (
                  <p className="text-xs text-green-400/80 flex items-center gap-1">
                    <Upload className="h-3 w-3" />
                    Videos upload to Cloudflare R2 ({r2Status?.bucketName})
                  </p>
                ) : (
                  <p className="text-xs text-amber-400">
                    {r2Status?.reason ?? "R2 not configured. Set R2_* env vars on Vercel and redeploy."}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Thumbnail Upload</Label>
                <Input type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add tag" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} />
                  <Button type="button" variant="secondary" onClick={addTag}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="inline-flex"
                      title="Remove tag"
                    >
                      <Badge variant="secondary">{tag} ×</Badge>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>VIP Content</Label>
                <Switch
                  checked={form.isVip}
                  onCheckedChange={(v) => {
                    const next = { ...form, isVip: v };
                    if (v && !editingVideo && globalTrial?.enabled) {
                      next.trialEnabled = true;
                      next.trialDurationValue = globalTrial.durationValue;
                      next.trialDurationUnit = globalTrial.durationUnit;
                    }
                    setForm(next);
                  }}
                />
              </div>
              {form.isVip && (
                <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <Label>Enable Trial</Label>
                    <Switch
                      checked={form.trialEnabled}
                      onCheckedChange={(trialEnabled) => setForm({ ...form, trialEnabled })}
                    />
                  </div>
                  {form.trialEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Trial Duration</Label>
                        <Input
                          type="number"
                          min={1}
                          value={form.trialDurationValue}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              trialDurationValue: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Trial Unit</Label>
                        <Select
                          value={form.trialDurationUnit}
                          onValueChange={(v) =>
                            setForm({ ...form, trialDurationUnit: v as TrialDurationUnit })
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TRIAL_DURATION_UNITS.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit.charAt(0).toUpperCase() + unit.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {!editingVideo && globalTrial?.enabled && (
                    <p className="text-xs text-gray-500">
                      Global trial is on — new VIP videos default to {globalTrial.durationValue}{" "}
                      {globalTrial.durationUnit} unless you override here.
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label>Featured</Label>
                <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} />
              </div>
              <div className="space-y-3 rounded-lg border border-white/10 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Pin to homepage</Label>
                    <p className="text-xs text-gray-500">Pinned videos appear first on the public homepage.</p>
                  </div>
                  <Switch
                    checked={form.isPinned}
                    onCheckedChange={(v) =>
                      setForm({
                        ...form,
                        isPinned: v,
                        pinOrder: v ? form.pinOrder : null,
                      })
                    }
                  />
                </div>
                {form.isPinned && (
                  <div className="space-y-2">
                    <Label>Pin order</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="1 = top"
                      value={form.pinOrder ?? ""}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        setForm({
                          ...form,
                          pinOrder: value ? Number(value) : null,
                        });
                      }}
                    />
                    <p className="text-xs text-gray-500">Lower numbers appear first when multiple videos are pinned.</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label>Autoplay preview on video cards</Label>
                <Switch checked={form.autoplay} onCheckedChange={(v) => setForm({ ...form, autoplay: v })} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending || saving}>
                {saving ? savePhase || "Saving..." : editingVideo ? "Update Video" : "Save Video"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <BulkDeleteDialog
          open={bulkConfirmOpen}
          onOpenChange={setBulkConfirmOpen}
          title="Delete selected videos?"
          description="This will permanently delete {count} video(s) and their storage files where applicable."
          count={selectedCount}
          loading={bulkDeleteMutation.isPending}
          onConfirm={() => bulkDeleteMutation.mutate([...selected])}
        />
      </div>
    </DashboardShell>
  );
}
