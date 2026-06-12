"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DollarSign, CreditCard, TrendingUp, RefreshCw, Clock, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["payments", statusFilter],
    queryFn: () =>
      api.payments.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.payments.list({ refresh: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  });

  const payments = data?.data || [];
  const stats = data?.stats;

  const revenueChart = payments
    .filter((p) => p.status === "completed")
    .reduce<{ date: string; revenue: number }[]>((acc, p) => {
      const date = p.createdAt.split("T")[0];
      const existing = acc.find((a) => a.date === date);
      if (existing) existing.revenue += p.amount;
      else acc.push({ date, revenue: p.amount });
      return acc;
    }, [])
    .sort((a, b) => a.date.localeCompare(b.date));

  const filtered =
    statusFilter === "all" ? payments : payments.filter((p) => p.status === statusFilter);

  return (
    <DashboardShell title="Payments">
      <div className="space-y-6">
        <div className="flex justify-end">
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
          <p className="text-xs text-gray-500">Last calculated: {formatDate(stats.recalculatedAt)}</p>
        )}

        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
            <TabsTrigger value="reports">Revenue Chart</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <PaymentTable rows={filtered} loading={isLoading} />
          </TabsContent>
          <TabsContent value="completed" className="mt-4">
            <PaymentTable rows={filtered} loading={isLoading} />
          </TabsContent>
          <TabsContent value="pending" className="mt-4">
            <PaymentTable rows={filtered} loading={isLoading} />
          </TabsContent>
          <TabsContent value="failed" className="mt-4">
            <PaymentTable rows={filtered} loading={isLoading} />
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            {revenueChart.length > 0 ? (
              <ChartCard title="SonicPesa Revenue Over Time" data={revenueChart} dataKey="revenue" xKey="date" formatValue={formatCurrency} color="#10b981" />
            ) : (
              <Card><CardContent className="p-8 text-center text-gray-400">No completed payments yet.</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

function PaymentTable({
  rows,
  loading,
}: {
  rows: import("@/types").BillingTransaction[];
  loading: boolean;
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
            <TableRow key={p.id}>
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
