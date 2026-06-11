"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Crown, Star, ExternalLink, Upload, Film } from "lucide-react";
import Image from "next/image";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
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
import { formatBytes } from "@/lib/drive-upload";
import type { Video } from "@/types";

const emptyVideo = {
  title: "",
  description: "",
  categoryId: "",
  googleDriveUrl: "",
  isVip: false,
  isFeatured: false,
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
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["videos", search, filterVip],
    queryFn: () => api.videos.list({
      search: search || undefined,
      isVip: filterVip !== "all" ? filterVip : undefined,
    }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories.list(),
  });

  const { data: driveStatus } = useQuery({
    queryKey: ["drive", "status"],
    queryFn: () => api.drive.status(),
    staleTime: 60_000,
  });

  const driveConfigured = driveStatus?.configured ?? false;
  const driveConfigReason = driveStatus?.reason ?? null;

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

  const resetForm = () => {
    setForm(emptyVideo);
    setTagInput("");
    setThumbnailFile(null);
    setVideoFile(null);
    setUploadProgress(0);
    setUploadPhase("");
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
      googleDriveUrl: video.googleDriveUrl,
      isVip: video.isVip,
      isFeatured: video.isFeatured,
      tags: video.tags,
    });
    setVideoFile(null);
    setUploadProgress(0);
    setUploadPhase("");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasDriveLink = !!form.googleDriveUrl.trim();
    const hasVideoFile = !!videoFile;

    if (!editingVideo && !hasDriveLink && !hasVideoFile) {
      alert("Upload a video file or paste a Google Drive link.");
      return;
    }

    setUploading(true);
    try {
      const payload: Partial<Video> = { ...form };

      if (videoFile) {
        if (!driveConfigured) {
          throw new Error("Google Drive upload is not configured on the server.");
        }
        setUploadPhase("Uploading video to Google Drive...");
        setUploadProgress(0);
        const { url } = await api.drive.uploadVideo(videoFile, setUploadProgress);
        payload.googleDriveUrl = url;
        setForm((prev) => ({ ...prev, googleDriveUrl: url }));
      }

      if (thumbnailFile) {
        setUploadPhase("Uploading thumbnail...");
        const { url } = await api.upload(thumbnailFile, "thumbnails");
        payload.thumbnailUrl = url;
      }

      setUploadPhase("Saving video...");
      if (editingVideo) {
        await updateMutation.mutateAsync({ id: editingVideo.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setUploading(false);
      setUploadPhase("");
      setUploadProgress(0);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const videos = data?.data || [];
  const categories = categoriesData?.data || [];

  return (
    <DashboardShell title="Videos">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
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
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Video
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Video</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Drive Link</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {video.thumbnailUrl ? (
                            <Image
                              src={video.thumbnailUrl}
                              alt={video.title}
                              width={80}
                              height={45}
                              className="rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-[45px] w-[80px] rounded-lg bg-white/10" />
                          )}
                          <div>
                            <p className="font-medium text-white">{video.title}</p>
                            <p className="text-xs text-gray-500 line-clamp-1">{video.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{video.categoryName}</TableCell>
                      <TableCell>
                        {video.googleDriveUrl ? (
                          <a href={video.googleDriveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                            <ExternalLink className="h-3 w-3" /> Drive
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{formatNumber(video.views)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {video.isVip && <Badge variant="default"><Crown className="h-3 w-3 mr-1" />VIP</Badge>}
                          {video.isFeatured && <Badge variant="warning"><Star className="h-3 w-3 mr-1" />Featured</Badge>}
                          {!video.isVip && !video.isFeatured && <Badge variant="secondary">Free</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(video)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Delete this video?")) deleteMutation.mutate(video.id);
                            }}
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
                  <Film className="h-4 w-4" /> Video File
                </Label>
                <Input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.webm,.mov,.avi,.mkv"
                  disabled={uploading || !driveConfigured}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setVideoFile(file);
                    if (file) setUploadProgress(0);
                  }}
                />
                {videoFile && (
                  <p className="text-xs text-gray-400">
                    Selected: {videoFile.name} ({formatBytes(videoFile.size)})
                  </p>
                )}
                {uploading && uploadPhase.startsWith("Uploading video") && (
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-400">{uploadProgress}% — {uploadPhase}</p>
                  </div>
                )}
                {driveConfigured ? (
                  <p className="text-xs text-green-400/80 flex items-center gap-1">
                    <Upload className="h-3 w-3" /> Uploads go directly to Google Drive (not Vercel/Supabase).
                  </p>
                ) : (
                  <div className="space-y-1 text-xs text-amber-400">
                    <p>{driveConfigReason ?? "Google Drive upload not configured."}</p>
                    {driveStatus?.jsonParseOk && driveStatus?.clientEmail && !driveStatus?.folderIdSet && (
                      <p>Service account OK: {driveStatus.clientEmail}. Add GOOGLE_DRIVE_FOLDER_ID and redeploy.</p>
                    )}
                    {driveStatus?.serviceAccountJsonSet && !driveStatus?.jsonParseOk && (
                      <p>JSON env var is set but failed to parse. Use single-line minified JSON or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Google Drive Video Link (optional if uploading file)</Label>
                <Input
                  value={form.googleDriveUrl}
                  onChange={(e) => setForm({ ...form, googleDriveUrl: e.target.value })}
                  placeholder="https://drive.google.com/file/d/FILE_ID/view"
                  disabled={!!videoFile && !editingVideo}
                />
                <p className="text-xs text-gray-500">
                  Upload a file above, or paste an existing Google Drive share link.
                </p>
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
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>VIP Content</Label>
                <Switch checked={form.isVip} onCheckedChange={(v) => setForm({ ...form, isVip: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Featured</Label>
                <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending || uploading}>
                {uploading
                  ? uploadPhase || "Saving..."
                  : editingVideo
                    ? "Update Video"
                    : "Save Video"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}
