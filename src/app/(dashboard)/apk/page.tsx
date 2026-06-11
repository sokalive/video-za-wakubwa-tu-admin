"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Smartphone, Download, Upload } from "lucide-react";
import Image from "next/image";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { formatNumber, formatDate } from "@/lib/utils";

export default function ApkPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ version: "", releaseNotes: "", forceUpdate: false });
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["apk"],
    queryFn: () => api.apk.get(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.apk.update(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apk"] }),
  });

  const apk = data?.data;

  if (isLoading) {
    return (
      <DashboardShell title="APK Manager">
        <Skeleton className="h-96 rounded-xl" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="APK Manager">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-400" />
              Current Release
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {apk && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-white">v{apk.version}</p>
                    <p className="text-sm text-gray-500">Released {formatDate(apk.createdAt)}</p>
                  </div>
                  <Badge variant={apk.forceUpdate ? "destructive" : "success"}>
                    {apk.forceUpdate ? "Force Update" : "Optional Update"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-white/5 p-4">
                    <p className="text-sm text-gray-400">File Size</p>
                    <p className="text-lg font-semibold text-white">{apk.fileSize}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-4">
                    <p className="text-sm text-gray-400">Downloads</p>
                    <p className="text-lg font-semibold text-white">{formatNumber(apk.downloadCount)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Release Notes</p>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap bg-white/5 rounded-lg p-4">{apk.releaseNotes}</pre>
                </div>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" /> Download APK
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-purple-400" />
              Upload New APK
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setUploading(true);
                try {
                  const payload: Record<string, unknown> = { ...form };
                  if (apkFile) {
                    const { url } = await api.upload(apkFile, "apk");
                    payload.fileUrl = url;
                    payload.fileSize = `${(apkFile.size / (1024 * 1024)).toFixed(1)} MB`;
                  }
                  if (screenshotFiles.length) {
                    const urls = await Promise.all(
                      screenshotFiles.map((f) => api.upload(f, "screenshots").then((r) => r.url))
                    );
                    payload.screenshots = urls;
                  }
                  updateMutation.mutate(payload);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Upload failed");
                } finally {
                  setUploading(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>APK File</Label>
                <Input type="file" accept=".apk" onChange={(e) => setApkFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Input
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="2.5.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Release Notes</Label>
                <Textarea
                  value={form.releaseNotes}
                  onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })}
                  placeholder="What's new in this version..."
                />
              </div>
              <div className="space-y-2">
                <Label>App Screenshots</Label>
                <Input type="file" accept="image/*" multiple onChange={(e) => setScreenshotFiles(Array.from(e.target.files ?? []))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Force Update</Label>
                <Switch
                  checked={form.forceUpdate}
                  onCheckedChange={(v) => setForm({ ...form, forceUpdate: v })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending || uploading}>
                {uploading ? "Uploading..." : updateMutation.isPending ? "Saving..." : "Upload APK"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {apk && apk.screenshots.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>App Screenshots</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {apk.screenshots.map((ss, i) => (
                <Image key={i} src={ss} alt={`Screenshot ${i + 1}`} width={180} height={320} className="rounded-xl object-cover" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}
