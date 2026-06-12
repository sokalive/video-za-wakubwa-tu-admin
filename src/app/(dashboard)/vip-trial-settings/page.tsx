"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Timer } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { TRIAL_DURATION_UNITS } from "@/lib/duration";
import type { TrialDurationUnit, VipTrialSettings } from "@/types";

const defaultSettings: VipTrialSettings = {
  enabled: false,
  durationValue: 5,
  durationUnit: "minutes",
};

export default function VipTrialSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<VipTrialSettings>(defaultSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["vip-trial-settings"],
    queryFn: () => api.vipTrialSettings.get(),
  });

  useEffect(() => {
    if (data?.data) setForm(data.data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.vipTrialSettings.update(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vip-trial-settings"] }),
  });

  return (
    <DashboardShell title="VIP Trial Settings">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-yellow-400" />
            Global VIP Trial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
                <div>
                  <Label>Enable global trial mode</Label>
                  <p className="text-xs text-gray-500 mt-1">
                    New VIP uploads automatically receive this trial duration.
                  </p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(enabled) => setForm({ ...form, enabled })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trial duration</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.durationValue}
                    onChange={(e) =>
                      setForm({ ...form, durationValue: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trial unit</Label>
                  <Select
                    value={form.durationUnit}
                    onValueChange={(v) => setForm({ ...form, durationUnit: v as TrialDurationUnit })}
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

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Trial Settings"}
              </Button>

              {saveMutation.isSuccess && (
                <p className="text-sm text-green-400">Trial settings saved.</p>
              )}
              {saveMutation.isError && (
                <p className="text-sm text-red-400">
                  {saveMutation.error instanceof Error ? saveMutation.error.message : "Save failed"}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
