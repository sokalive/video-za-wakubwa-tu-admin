"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import type { SiteSettings } from "@/types";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings.get(),
  });

  const [form, setForm] = useState<SiteSettings | null>(null);

  useEffect(() => {
    if (data?.data) setForm(data.data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<SiteSettings>) => api.settings.update(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  if (isLoading || !form) {
    return (
      <DashboardShell title="Settings">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Settings">
      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>VIP Trial Playback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="vip-trial-enabled">Enable global VIP trial default</Label>
              <Switch
                id="vip-trial-enabled"
                checked={form.vipTrial.enabled}
                onCheckedChange={(enabled) =>
                  setForm({ ...form, vipTrial: { ...form.vipTrial, enabled } })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vip-trial-duration">Default trial duration</Label>
              <Input
                id="vip-trial-duration"
                type="number"
                min={0}
                value={form.vipTrial.durationValue}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vipTrial: {
                      ...form.vipTrial,
                      durationValue: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Uses {form.vipTrial.durationUnit}. New VIP uploads inherit this automatically.
              </p>
            </div>
            <Button
              onClick={() =>
                saveMutation.mutate({
                  vipTrial: form.vipTrial,
                })
              }
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save VIP Trial Settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
