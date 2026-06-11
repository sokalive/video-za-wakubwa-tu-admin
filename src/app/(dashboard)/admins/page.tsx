"use client";

import { useQuery } from "@tanstack/react-query";
import { Shield, Mail } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

const roleVariant: Record<string, "default" | "success" | "warning"> = {
  super_admin: "default",
  admin: "success",
  moderator: "warning",
};

export default function AdminsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: () => api.admins.list(),
  });

  const admins = data?.data || [];

  return (
    <DashboardShell title="Admins">
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Administrator Management</p>
              <p className="text-sm text-gray-400">{admins.length} administrators registered</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-bold text-white">
                            {admin.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-white">{admin.name}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Mail className="h-3 w-3" />{admin.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleVariant[admin.role]}>
                          {admin.role.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{admin.lastLogin ? formatDate(admin.lastLogin) : "Never"}</TableCell>
                      <TableCell>{formatDate(admin.createdAt)}</TableCell>
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
