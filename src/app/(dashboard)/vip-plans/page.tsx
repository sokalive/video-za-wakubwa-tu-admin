"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Check } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils";
import type { VipPlan } from "@/types";
import { useState } from "react";

const planIcons: Record<string, string> = {
  daily: "📅",
  weekly: "📆",
  monthly: "🗓️",
};

export default function VipPlansPage() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<VipPlan | null>(null);
  const [price, setPrice] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["vip-plans"],
    queryFn: () => api.vipPlans.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VipPlan> }) =>
      api.vipPlans.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip-plans"] });
      setEditingPlan(null);
    },
  });

  const plans = data?.data || [];

  return (
    <DashboardShell title="VIP Plans">
      <div className="grid gap-6 md:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))
        ) : (
          plans.map((plan) => (
            <Card key={plan.id} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{planIcons[plan.type]}</span>
                    {plan.name}
                  </CardTitle>
                  <Badge variant={plan.isActive ? "success" : "secondary"}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingPlan?.id === plan.id ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Price (TZS)</Label>
                      <Input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateMutation.mutate({ id: plan.id, data: { price } })}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPlan(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl font-bold text-white">{formatCurrency(plan.price)}</p>
                    <p className="text-sm text-gray-500">{plan.durationDays} day{plan.durationDays > 1 ? "s" : ""}</p>
                  </div>
                )}

                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="h-4 w-4 text-green-400 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={plan.isActive}
                      onCheckedChange={(v) => updateMutation.mutate({ id: plan.id, data: { isActive: v } })}
                    />
                    <span className="text-sm text-gray-400">Active</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingPlan(plan); setPrice(plan.price); }}
                  >
                    Edit Price
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="font-semibold text-white">VIP Plan Management</p>
              <p className="text-sm text-gray-400">Manage daily, weekly, and monthly subscription plans with price control.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
