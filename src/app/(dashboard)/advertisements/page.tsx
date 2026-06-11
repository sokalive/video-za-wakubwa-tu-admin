"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import type { Advertisement } from "@/types";

type AdForm = {
  title: string;
  type: "banner" | "popup";
  placement: "homepage" | "video_page" | "both";
  linkUrl: string;
  isEnabled: boolean;
};

const emptyAd: AdForm = { title: "", type: "banner", placement: "homepage", linkUrl: "", isEnabled: true };

export default function AdvertisementsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyAd);

  const { data, isLoading } = useQuery({
    queryKey: ["ads"],
    queryFn: () => api.ads.list(),
  });

  const createMutation = useMutation({
    mutationFn: (ad: Partial<Advertisement>) => api.ads.create(ad),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads"] });
      setDialogOpen(false);
      setForm(emptyAd);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Advertisement> }) =>
      api.ads.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ads"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.ads.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ads"] }),
  });

  const ads = data?.data || [];

  return (
    <DashboardShell title="Advertisements">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-400">
            <Megaphone className="h-5 w-5" />
            <span>{ads.filter((a) => a.isEnabled).length} active ads</span>
          </div>
          <Button onClick={() => { setForm(emptyAd); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Advertisement
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Placement</TableHead>
                    <TableHead>Impressions</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ads.map((ad) => (
                    <TableRow key={ad.id}>
                      <TableCell className="font-medium text-white">{ad.title}</TableCell>
                      <TableCell><Badge variant="secondary">{ad.type}</Badge></TableCell>
                      <TableCell>{ad.placement.replace("_", " ")}</TableCell>
                      <TableCell>{formatNumber(ad.impressions)}</TableCell>
                      <TableCell>{formatNumber(ad.clicks)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={ad.isEnabled}
                          onCheckedChange={(v) => updateMutation.mutate({ id: ad.id, data: { isEnabled: v } })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => {
                            if (confirm("Delete this ad?")) deleteMutation.mutate(ad.id);
                          }}>
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
          <DialogContent>
            <DialogHeader><DialogTitle>Add Advertisement</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "banner" | "popup" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="banner">Banner</SelectItem>
                      <SelectItem value="popup">Popup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Placement</Label>
                  <Select value={form.placement} onValueChange={(v) => setForm({ ...form, placement: v as "homepage" | "video_page" | "both" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homepage">Homepage</SelectItem>
                      <SelectItem value="video_page">Video Page</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Banner Image</Label>
                <Input type="file" accept="image/*" />
              </div>
              <div className="space-y-2">
                <Label>Link URL</Label>
                <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable Ad</Label>
                <Switch checked={form.isEnabled} onCheckedChange={(v) => setForm({ ...form, isEnabled: v })} />
              </div>
              <Button type="submit" className="w-full">Create Advertisement</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}
