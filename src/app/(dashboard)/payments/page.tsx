"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DollarSign, CreditCard, TrendingUp, RefreshCw, Clock, XCircle, Trash2, RotateCcw } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BulkDeleteDialog } from "@/components/admin/bulk-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "@/components/dashboard/charts";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  completed: "success",
  pending: "warning",
  failed: "destructive",
  refunded: "secondary",
};

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["payments", statusFilter],
    queryFn: () =>
      api.payments.list({
        status: statusFilter !== "all" && statusFilter !== "reports" ? statusFilter : undefined,
      }),
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.payments.list({ refresh: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.payments.bulkDelete(ids),
    onSuccess: () => {
      setSelected(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const resetRevenueMutation = useMutation({
    mutationFn: () => api.payments.resetRevenue(),
    onSuccess: (result) => {
      setResetError(null);
      setResetConfirmOpen(false);
      queryClient.setQueriesData<{ success: boolean; data: typeof payments; stats?: typeof stats }>(
        { queryKey: ["payments"] },
        (old) => (old ? { ...old, stats: result.stats } : old)
      );
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: (err: Error) => {
      setResetError(err.message || "Revenue reset failed");
    },
  });

  const payments = data?.data || [];
  const stats = data?.stats;

  const filtered = useMemo(
    () =>
      statusFilter === "all" || statusFilter === "reports"
        ? payments
        : payments.filter((p) => p.status === statusFilter),
    [payments, statusFilter]
  );

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const selectedCount = filtered.filter((p) => selected.has(p.id)).length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const revenueResetAt = stats?.revenueResetAt ? new Date(stats.revenueResetAt).getTime() : null;

  const revenueChart = payments
    .filter((p) => {
      if (p.status !== "completed") return false;
      if (!revenueResetAt) return true;
      return new Date(p.createdAt).getTime() >= revenueResetAt;
    })
    .reduce<{ date: string; revenue: number }[]>((acc, p) => {
      const date = p.createdAt.split("T")[0];
      const existing = acc.find((a) => a.date === date);
      if (existing) existing.revenue += p.amount;
      else acc.push({ date, revenue: p.amount });
      return acc;
    }, [])
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <DashboardShell title="Payments">
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between gap-3">
          {selectedCount > 0 && statusFilter !== "reports" ? (
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedCount})
            </Button>
          ) : (
            <div />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setResetError(null);
              setResetConfirmOpen(true);
            }}
            disabled={resetRevenueMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Anza Hesabu Upya
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Recalculate Revenue
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-600/20 flex items-center justify-center"><DollarSign className="h-5 w-5 text-emerald-400" /></div>
            <div><p className="text-sm text-gray-400">Total Revenue</p><p className="text-xl font-bold text-white">{formatCurrency(stats?.totalRevenue ?? 0)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600/20 flex items-center justify-center"><CreditCard className="h-5 w-5 text-blue-400" /></div>
            <div><p className="text-sm text-gray-400">All Transactions</p><p className="text-xl font-bold text-white">{stats?.totalTransactions ?? payments.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-600/20 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-purple-400" /></div>
            <div><p className="text-sm text-gray-400">Completed</p><p className="text-xl font-bold text-white">{stats?.completedCount ?? 0}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-600/20 flex items-center justify-center"><Clock className="h-5 w-5 text-yellow-400" /></div>
            <div><p className="text-sm text-gray-400">Pending</p><p className="text-xl font-bold text-white">{stats?.pendingCount ?? 0}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-600/20 flex items-center justify-center"><XCircle className="h-5 w-5 text-red-400" /></div>
            <div><p className="text-sm text-gray-400">Failed</p><p className="text-xl font-bold text-white">{stats?.failedCount ?? 0}</p></div>
          </CardContent></Card>
        </div>

        {stats?.recalculatedAt && (
          <p className="text-xs text-gray-500">
            Last calculated: {formatDate(stats.recalculatedAt)}
            {stats.revenueResetAt && (
              <> · Revenue baseline: {formatDate(stats.revenueResetAt)} (UTC)</>
            )}
          </p>
        )}

        <Tabs
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setSelected(new Set());
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
            <TabsTrigger value="reports">Revenue Chart</TabsTrigger>
          </TabsList>

          {["all", "completed", "pending", "failed"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <PaymentTable
                rows={filtered}
                loading={isLoading}
                selected={selected}
                allSelected={allSelected}
                onToggleAll={toggleAll}
                onToggleOne={toggleOne}
              />
            </TabsContent>
          ))}

          <TabsContent value="reports" className="mt-4">
            {revenueChart.length > 0 ? (
              <ChartCard title="SonicPesa Revenue Over Time" data={revenueChart} dataKey="revenue" xKey="date" formatValue={formatCurrency} color="#10b981" />
            ) : (
              <Card><CardContent className="p-8 text-center text-gray-400">No completed payments yet.</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BulkDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete selected payments?"
        description="This will permanently delete {count} payment record(s). Linked VIP subscriptions created by those payments will also be removed."
        count={selectedCount}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate([...selected])}
      />

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anza Hesabu Upya</DialogTitle>
            <DialogDescription>
              Hii itaanzisha hesabu ya mapato kutoka sifuri kwa onyesho la sasa. Rekodi zote za malipo
              zinabaki kwenye mfumo — hakuna malipo yanayofutwa au kubadilishwa.
            </DialogDescription>
          </DialogHeader>
          {resetError && (
            <p className="text-sm text-red-400" role="alert">
              {resetError}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>
              Ghairi
            </Button>
            <Button
              onClick={() => resetRevenueMutation.mutate()}
              disabled={resetRevenueMutation.isPending}
            >
              {resetRevenueMutation.isPending ? "Inasubiri..." : "Anza kutoka 0"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function PaymentTable({
  rows,
  loading,
  selected,
  allSelected,
  onToggleAll,
  onToggleOne,
}: {
  rows: import("@/types").BillingTransaction[];
  loading: boolean;
  selected: Set<number>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: number) => void;
}) {
  if (loading) {
    return (
      <Card><CardContent className="p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
      </CardContent></Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-gray-400">No SonicPesa transactions found.</CardContent></Card>
    );
  }

  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={onToggleAll} aria-label="Select all payments" />
            </TableHead>
            <TableHead>Phone / Device</TableHead>
            <TableHead>Order ID</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => onToggleOne(p.id)}
                  aria-label={`Select payment ${p.orderId}`}
                />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-white">{p.phone || "—"}</p>
                  <p className="text-xs text-gray-500 truncate max-w-[140px]">{p.deviceId || "—"}</p>
                </div>
              </TableCell>
              <TableCell className="text-xs font-mono">{p.orderId}</TableCell>
              <TableCell>{p.planName || p.planId || "—"}</TableCell>
              <TableCell>{formatCurrency(p.amount)}</TableCell>
              <TableCell>{p.paymentProvider || "sonicpesa"}</TableCell>
              <TableCell><Badge variant={statusVariant[p.status] ?? "secondary"}>{p.status}</Badge></TableCell>
              <TableCell>{formatDate(p.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
