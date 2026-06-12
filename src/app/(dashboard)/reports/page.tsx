"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Trash2, CheckCircle2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

const reasonLabels: Record<string, string> = {
  inappropriate: "Inappropriate content",
  copyright: "Copyright violation",
  spam: "Spam / ads",
  broken: "Broken video",
  other: "Other",
};

export default function ReportsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["video-reports"],
    queryFn: () => api.reports.list(),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.reports.dismiss(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["video-reports"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.reports.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["video-reports"] }),
  });

  const reports = data?.data ?? [];
  const loadError = error instanceof Error ? error.message : null;

  return (
    <DashboardShell title="Video Reports">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-gray-400">
          <Flag className="h-5 w-5" />
          <span>{reports.length} report(s)</span>
        </div>

        {loadError?.includes("video_reports") && (
          <Card className="border-yellow-500/30 bg-yellow-500/10">
            <CardContent className="p-4 text-sm text-yellow-200">
              The <code>video_reports</code> table is missing. Run{" "}
              <code>supabase/player_features.sql</code> in the Supabase SQL Editor.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Video</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                        No reports yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{report.videoTitle}</p>
                            <p className="text-xs text-gray-500">{report.videoId}</p>
                            {report.details && (
                              <p className="mt-1 max-w-xs truncate text-xs text-gray-400">
                                {report.details}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {reasonLabels[report.reason] ?? report.reason}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs text-gray-400">
                          {report.deviceId || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              report.status === "pending"
                                ? "warning"
                                : report.status === "dismissed"
                                  ? "secondary"
                                  : "default"
                            }
                          >
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(report.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {report.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => dismissMutation.mutate(report.id)}
                                disabled={dismissMutation.isPending}
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Dismiss
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteMutation.mutate(report.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
