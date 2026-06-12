"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Crown, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [filterVip, setFilterVip] = useState("all");
  const [filterActive, setFilterActive] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["users", search, filterVip, filterActive],
    queryFn: () => api.users.list({
      search: search || undefined,
      isVip: filterVip !== "all" ? filterVip : undefined,
      isActive: filterActive !== "all" ? filterActive : undefined,
    }),
  });

  const users = data?.data || [];
  const stats = data?.stats ?? { total: users.length, vip: 0, active: 0 };

  return (
    <DashboardShell title="Users">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600/20 flex items-center justify-center"><Search className="h-5 w-5 text-blue-400" /></div>
            <div><p className="text-sm text-gray-400">Total Devices</p><p className="text-xl font-bold text-white">{stats.total}</p></div>
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
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="true">VIP</SelectItem>
              <SelectItem value="false">Free</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No devices found. Users appear after website visits or payments.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device / User</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>VIP</TableHead>
                    <TableHead>VIP Expires</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>First Seen</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">{user.name}</p>
                          <p className="text-xs text-gray-500 font-mono truncate max-w-[180px]">{user.email}</p>
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
                      <TableCell>{user.vipExpiresAt ? formatDate(user.vipExpiresAt) : "—"}</TableCell>
                      <TableCell>{formatCurrency(user.totalSpent)}</TableCell>
                      <TableCell>{formatDate(user.joinedAt)}</TableCell>
                      <TableCell>{formatDate(user.lastActive)}</TableCell>
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
