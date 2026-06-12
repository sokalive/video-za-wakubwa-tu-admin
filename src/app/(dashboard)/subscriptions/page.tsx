"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Plus, Minus, Trash2, Power, PowerOff } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [deviceId, setDeviceId] = useState("");
  const [days, setDays] = useState("1");
  const [planId, setPlanId] = useState("plan-daily");

  const { data, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => api.subscriptions.list(),
  });

  const { data: plansData } = useQuery({
    queryKey: ["vip-plans"],
    queryFn: () => api.vipPlans.list(),
  });

  const mutation = useMutation({
    mutationFn: api.subscriptions.manage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const subs = data?.data ?? [];
  const plans = plansData?.data ?? [];

  const run = (action: "extend" | "reduce" | "remove" | "activate" | "deactivate", targetDeviceId: string) => {
    mutation.mutate({
      deviceId: targetDeviceId,
      action,
      days: Number(days) || 1,
      planId: action === "activate" ? planId : undefined,
    });
  };

  return (
    <DashboardShell title="VIP Subscriptions">
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-sm text-gray-400">Manually activate a device subscription</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Device ID"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="flex-1"
              />
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-24"
                title="Days for extend/reduce"
              />
              <Button
                disabled={!deviceId.trim() || mutation.isPending}
                onClick={() => run("activate", deviceId.trim())}
              >
                <Power className="h-4 w-4 mr-2" /> Activate
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : subs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No device subscriptions yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Spent</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => (
                    <TableRow key={s.deviceId}>
                      <TableCell className="font-mono text-xs max-w-[160px] truncate">{s.deviceId}</TableCell>
                      <TableCell>{s.phone || "—"}</TableCell>
                      <TableCell>
                        {s.active ? (
                          <Badge variant="default"><Crown className="h-3 w-3 mr-1" />Active</Badge>
                        ) : (
                          <Badge variant="secondary">{s.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(s.expiresAt)}</TableCell>
                      <TableCell>{formatCurrency(s.totalSpent)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => run("extend", s.deviceId)} disabled={mutation.isPending}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => run("reduce", s.deviceId)} disabled={mutation.isPending}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => run("deactivate", s.deviceId)} disabled={mutation.isPending}>
                            <PowerOff className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => run("remove", s.deviceId)} disabled={mutation.isPending}>
                            <Trash2 className="h-3 w-3" />
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
      </div>
    </DashboardShell>
  );
}
