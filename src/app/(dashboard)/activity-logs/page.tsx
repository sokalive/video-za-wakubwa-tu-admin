"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText, Upload, Trash2, Smartphone, User, CreditCard } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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
import { formatDate } from "@/lib/utils";
import { useState, useMemo } from "react";

const actionIcons: Record<string, React.ReactNode> = {
  upload: <Upload className="h-4 w-4 text-green-400" />,
  delete: <Trash2 className="h-4 w-4 text-red-400" />,
  edit: <User className="h-4 w-4 text-blue-400" />,
  update: <Smartphone className="h-4 w-4 text-purple-400" />,
  payment: <CreditCard className="h-4 w-4 text-yellow-400" />,
};

const actionVariant: Record<string, "success" | "destructive" | "secondary" | "default" | "warning"> = {
  upload: "success",
  delete: "destructive",
  edit: "default",
  update: "secondary",
  payment: "warning",
};

export default function ActivityLogsPage() {
  const [filterEntity, setFilterEntity] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: () => api.activityLogs.list(),
  });

  const logs = data?.data || [];

  const filtered = useMemo(() => {
    if (filterEntity === "all") return logs;
    return logs.filter((l) => l.entity === filterEntity);
  }, [logs, filterEntity]);

  return (
    <DashboardShell title="Activity Logs">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-400">
            <ScrollText className="h-5 w-5" />
            <span>{filtered.length} log entries</span>
          </div>
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="video">Video Uploads/Deletions</SelectItem>
              <SelectItem value="apk">APK Updates</SelectItem>
              <SelectItem value="user">User Actions</SelectItem>
              <SelectItem value="payment">Payment Events</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {actionIcons[log.action] || <ScrollText className="h-4 w-4" />}
                          <Badge variant={actionVariant[log.action] || "secondary"}>{log.action}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-white">{log.adminName}</TableCell>
                      <TableCell className="max-w-xs truncate">{log.details}</TableCell>
                      <TableCell><Badge variant="outline">{log.entity}</Badge></TableCell>
                      <TableCell className="text-gray-500">{log.ipAddress}</TableCell>
                      <TableCell>{formatDate(log.createdAt)}</TableCell>
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
