"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import type { SiteSettings } from "@/types";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings.get(),
  });

  useEffect(() => {
    if (data?.data) setForm(data.data);
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (settings: Partial<SiteSettings>) => api.settings.update(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (isLoading || !form) {
    return (
      <DashboardShell title="Settings">
        <Skeleton className="h-96 rounded-xl" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Settings">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate(form);
        }}
        className="max-w-2xl space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-400" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Website Name</Label>
              <Input value={form.websiteName} onChange={(e) => setForm({ ...form, websiteName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Logo Upload</Label>
              <Input type="file" accept="image/*" />
            </div>
            <div className="space-y-2">
              <Label>Homepage Banner</Label>
              <Input type="file" accept="image/*" />
            </div>
            <div className="space-y-2">
              <Label>Footer Text</Label>
              <Textarea value={form.footerText} onChange={(e) => setForm({ ...form, footerText: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
            {form.socialLinks.map((link, i) => (
              <div key={link.platform} className="space-y-2">
                <Label>{link.platform} URL</Label>
                <Input
                  value={link.url}
                  onChange={(e) => {
                    const updated = [...form.socialLinks];
                    updated[i] = { ...link, url: e.target.value };
                    setForm({ ...form, socialLinks: updated });
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={updateMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saved ? "Saved!" : updateMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </DashboardShell>
  );
}
