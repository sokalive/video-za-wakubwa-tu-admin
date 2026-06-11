"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, CreditCard, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
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
  const { data, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.payments.list(),
  });

  const payments = data?.data || [];
  const totalRevenue = payments.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.amount, 0);
  const vipPurchases = payments.filter((p) => p.status === "completed");

  const revenueChart = payments
    .filter((p) => p.status === "completed")
    .reduce<{ date: string; revenue: number }[]>((acc, p) => {
      const date = p.createdAt.split("T")[0];
      const existing = acc.find((a) => a.date === date);
      if (existing) existing.revenue += p.amount;
      else acc.push({ date, revenue: p.amount });
      return acc;
    }, []);

  return (
    <DashboardShell title="Payments">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-600/20 flex items-center justify-center"><DollarSign className="h-5 w-5 text-emerald-400" /></div>
            <div><p className="text-sm text-gray-400">Total Revenue</p><p className="text-xl font-bold text-white">{formatCurrency(totalRevenue)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600/20 flex items-center justify-center"><CreditCard className="h-5 w-5 text-blue-400" /></div>
            <div><p className="text-sm text-gray-400">Total Transactions</p><p className="text-xl font-bold text-white">{payments.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-600/20 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-purple-400" /></div>
            <div><p className="text-sm text-gray-400">VIP Purchases</p><p className="text-xl font-bold text-white">{vipPurchases.length}</p></div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history">Payment History</TabsTrigger>
            <TabsTrigger value="vip">VIP Purchases</TabsTrigger>
            <TabsTrigger value="reports">Revenue Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            <Card><CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-white">{p.userName}</TableCell>
                        <TableCell>{p.planName}</TableCell>
                        <TableCell>{formatCurrency(p.amount)}</TableCell>
                        <TableCell>{p.method}</TableCell>
                        <TableCell><Badge variant={statusVariant[p.status]}>{p.status}</Badge></TableCell>
                        <TableCell>{formatDate(p.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="vip" className="mt-4">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vipPurchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-white">{p.userName}</TableCell>
                      <TableCell>{p.planName}</TableCell>
                      <TableCell>{formatCurrency(p.amount)}</TableCell>
                      <TableCell>{formatDate(p.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            {revenueChart.length > 0 && (
              <ChartCard title="Revenue Over Time" data={revenueChart} dataKey="revenue" xKey="date" formatValue={formatCurrency} color="#10b981" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}
