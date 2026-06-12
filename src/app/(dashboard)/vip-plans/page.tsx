"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Check, Plus, Pencil } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils";
import { PLAN_DURATION_UNITS } from "@/lib/duration";
import type { PlanDurationUnit, VipPlan } from "@/types";

const emptyPlan = {
  name: "",
  price: 0,
  durationValue: 1,
  durationUnit: "days" as PlanDurationUnit,
  features: [] as string[],
  isActive: true,
  popular: false,
  currency: "TZS",
};

export default function VipPlansPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<VipPlan | null>(null);
  const [form, setForm] = useState(emptyPlan);
  const [featureInput, setFeatureInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vip-plans"],
    queryFn: () => api.vipPlans.list(),
  });

  const seedMutation = useMutation({
    mutationFn: () =>
      fetch("/api/vip-plans/seed", { method: "POST" }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Seed failed");
        return data;
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vip-plans"] }),
  });

  const createMutation = useMutation({
    mutationFn: () => api.vipPlans.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip-plans"] });
      setDialogOpen(false);
      setEditingPlan(null);
      setForm(emptyPlan);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.vipPlans.update(editingPlan!.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip-plans"] });
      setDialogOpen(false);
      setEditingPlan(null);
      setForm(emptyPlan);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.vipPlans.update(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vip-plans"] }),
  });

  const plans = data?.data || [];

  const openCreate = () => {
    setEditingPlan(null);
    setForm(emptyPlan);
    setFeatureInput("");
    setDialogOpen(true);
  };

  const openEdit = (plan: VipPlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      price: plan.price,
      durationValue: plan.durationValue,
      durationUnit: plan.durationUnit,
      features: [...plan.features],
      isActive: plan.isActive,
      popular: plan.popular,
      currency: plan.currency,
    });
    setFeatureInput("");
    setDialogOpen(true);
  };

  const addFeature = () => {
    const value = featureInput.trim();
    if (!value || form.features.includes(value)) return;
    setForm({ ...form, features: [...form.features, value] });
    setFeatureInput("");
  };

  const removeFeature = (feature: string) => {
    setForm({ ...form, features: form.features.filter((f) => f !== feature) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editingPlan) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <DashboardShell title="VIP Plans">
      <div className="mb-6 flex justify-between gap-4">
        <p className="text-sm text-gray-400">
          Create unlimited subscription plans. Existing 1 Day / 1 Week / 1 Month plans remain editable.
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Create New Plan
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))
        ) : plans.length === 0 ? (
          <Card className="md:col-span-3">
            <CardContent className="p-6 space-y-4 text-sm text-gray-400">
              <p>No VIP plans found.</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={openCreate}><Plus className="h-4 w-4" /> Create New Plan</Button>
                <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                  {seedMutation.isPending ? "Seeding..." : "Seed Default Plans"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          plans.map((plan) => (
            <Card key={plan.id} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600" />
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="flex gap-1">
                    {plan.popular && <Badge variant="warning">Popular</Badge>}
                    <Badge variant={plan.isActive ? "success" : "secondary"}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-bold text-white">{formatCurrency(plan.price)}</p>
                  <p className="text-sm text-gray-500">{plan.durationLabel}</p>
                </div>

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
                      onCheckedChange={(v) => toggleActiveMutation.mutate({ id: plan.id, isActive: v })}
                    />
                    <span className="text-sm text-gray-400">Active</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
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
              <p className="text-sm text-gray-400">
                Plans sync to the public website payment modal via /api/vip-plans.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit VIP Plan" : "Create New Plan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Price (TZS)</Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration Value</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.durationValue}
                  onChange={(e) =>
                    setForm({ ...form, durationValue: Math.max(1, Number(e.target.value) || 1) })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Duration Unit</Label>
                <Select
                  value={form.durationUnit}
                  onValueChange={(v) => setForm({ ...form, durationUnit: v as PlanDurationUnit })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_DURATION_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit.charAt(0).toUpperCase() + unit.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Features</Label>
              <div className="flex gap-2">
                <Input
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  placeholder="Add feature"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                />
                <Button type="button" variant="secondary" onClick={addFeature}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.features.map((feature) => (
                  <button key={feature} type="button" onClick={() => removeFeature(feature)}>
                    <Badge variant="secondary">{feature} ×</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Mark as popular</Label>
              <Switch checked={form.popular} onCheckedChange={(v) => setForm({ ...form, popular: v })} />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
