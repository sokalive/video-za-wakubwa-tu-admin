"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Crown, UserCheck, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BulkDeleteDialog } from "@/components/admin/bulk-delete-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterVip, setFilterVip] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["users", search, filterVip, filterActive],
    queryFn: () =>
      api.users.list({
        search: search || undefined,
        isVip: filterVip,
        isActive: filterActive,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (deviceIds: string[]) => api.users.bulkDelete(deviceIds),
    onSuccess: () => {
      setSelected(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const users = data?.data || [];
  const stats = data?.stats ?? { total: users.length, vip: 0, active: 0, paying: 0 };

  const allSelected = users.length > 0 && users.every((u) => selected.has(u.id));
  const selectedCount = users.filter((u) => selected.has(u.id)).length;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const subscriptionBadge = (status?: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "pending":
        return <Badge variant="warning">Pending</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge variant="secondary">None</Badge>;
    }
  };

  return (
    <DashboardShell title="Users">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600/20 flex items-center justify-center"><Search className="h-5 w-5 text-blue-400" /></div>
            <div><p className="text-sm text-gray-400">Total Devices</p><p className="text-xl font-bold text-white">{stats.total}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-600/20 flex items-center justify-center"><UserCheck className="h-5 w-5 text-emerald-400" /></div>
            <div><p className="text-sm text-gray-400">Paying Users</p><p className="text-xl font-bold text-white">{stats.paying ?? 0}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-600/20 flex items-center justify-center"><Crown className="h-5 w-5 text-yellow-400" /></div>
            <div><p className="text-sm text-gray-400">Active VIP</p><p className="text-xl font-bold text-white">{stats.vip}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-600/20 flex items-center justify-center"><UserCheck className="h-5 w-5 text-green-400" /></div>
            <div><p className="text-sm text-gray-400">Active (30d)</p><p className="text-xl font-bold text-white">{stats.active}</p></div>
          </CardContent></Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input placeholder="Search phone or device ID..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterVip} onValueChange={setFilterVip}>
            <SelectTrigger className="w-36"><SelectValue placeholder="VIP filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="true">VIP</SelectItem>
              <SelectItem value="false">Free</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Activity filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {selectedCount > 0 && (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete ({selectedCount})
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : isError ? (
              <div className="p-8 text-center text-red-400">
                Failed to load users: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No devices match the current filters.
                {(filterVip !== "all" || filterActive !== "all" || search) && (
                  <p className="mt-2 text-sm">Try clearing filters — stats show {stats.total} total device(s).</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all users" />
                    </TableHead>
                    <TableHead>Device / User</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>VIP</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>VIP Expires</TableHead>
                    <TableHead>Payments</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(user.id)}
                          onCheckedChange={() => toggleOne(user.id)}
                          aria-label={`Select ${user.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">{user.name}</p>
                          <p className="text-xs text-gray-500 font-mono truncate max-w-[180px]" title={user.email}>
                            {user.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{user.phone || "—"}</TableCell>
                      <TableCell>
                        {user.isVip ? (
                          <Badge variant="default"><Crown className="h-3 w-3 mr-1" />VIP</Badge>
                        ) : (
                          <Badge variant="secondary">Free</Badge>
                        )}
                      </TableCell>
                      <TableCell>{subscriptionBadge(user.subscriptionStatus)}</TableCell>
                      <TableCell>{user.vipExpiresAt ? formatDate(user.vipExpiresAt) : "—"}</TableCell>
                      <TableCell>{user.transactionCount ?? 0}</TableCell>
                      <TableCell>{formatCurrency(user.totalSpent)}</TableCell>
                      <TableCell>{formatDate(user.lastActive)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <BulkDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete selected devices?"
        description="This will permanently delete {count} device(s) and remove their subscriptions, view sessions, likes, and payment records."
        count={selectedCount}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate([...selected])}
      />
    </DashboardShell>
  );
}
