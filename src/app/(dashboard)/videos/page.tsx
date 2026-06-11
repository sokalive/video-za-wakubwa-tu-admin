"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Crown, Star } from "lucide-react";
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
import type { Video } from "@/types";

const emptyVideo = {
  title: "", description: "", categoryId: "", duration: "", resolution: "1080p",
  isVip: false, isFeatured: false, tags: [] as string[],
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
  const [trailerFile, setTrailerFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const createMutation = useMutation({
    mutationFn: (video: Partial<Video>) => api.videos.create(video),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setDialogOpen(false);
      setForm(emptyVideo);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Video> }) =>
      api.videos.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setDialogOpen(false);
      setEditingVideo(null);
      setForm(emptyVideo);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.videos.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["videos"] }),
  });

  const openCreate = () => {
    setEditingVideo(null);
    setForm(emptyVideo);
    setDialogOpen(true);
  };

  const openEdit = (video: Video) => {
    setEditingVideo(video);
    setForm({
      title: video.title,
      description: video.description,
      categoryId: video.categoryId,
      duration: video.duration,
      resolution: video.resolution,
      isVip: video.isVip,
      isFeatured: video.isFeatured,
      tags: video.tags,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const payload: Partial<Video> = { ...form };
      if (thumbnailFile) {
        const { url } = await api.upload(thumbnailFile, "thumbnails");
        payload.thumbnailUrl = url;
      }
      if (videoFile) {
        const { url } = await api.upload(videoFile, "videos");
        payload.videoUrl = url;
      }
      if (trailerFile) {
        const { url } = await api.upload(trailerFile, "videos");
        payload.trailerUrl = url;
      }
      if (editingVideo) {
        updateMutation.mutate({ id: editingVideo.id, data: payload });
      } else {
        createMutation.mutate(payload);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
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
            <Plus className="h-4 w-4" /> Upload Video
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
                    <TableHead>Duration</TableHead>
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
                          <Image
                            src={video.thumbnailUrl}
                            alt={video.title}
                            width={80}
                            height={45}
                            className="rounded-lg object-cover"
                          />
                          <div>
                            <p className="font-medium text-white">{video.title}</p>
                            <p className="text-xs text-gray-500">{video.resolution}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{video.categoryName}</TableCell>
                      <TableCell>{video.duration}</TableCell>
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
              <DialogTitle>{editingVideo ? "Edit Video" : "Upload Video"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="1:30:00" />
                </div>
                <div className="space-y-2">
                  <Label>Resolution</Label>
                  <Select value={form.resolution} onValueChange={(v) => setForm({ ...form, resolution: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="720p">720p</SelectItem>
                      <SelectItem value="1080p">1080p</SelectItem>
                      <SelectItem value="4K">4K</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Thumbnail Upload</Label>
                <Input type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-2">
                <Label>Video Upload</Label>
                <Input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-2">
                <Label>Trailer Upload</Label>
                <Input type="file" accept="video/*" onChange={(e) => setTrailerFile(e.target.files?.[0] ?? null)} />
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
                {uploading ? "Uploading files..." : editingVideo ? "Update Video" : "Upload Video"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}
