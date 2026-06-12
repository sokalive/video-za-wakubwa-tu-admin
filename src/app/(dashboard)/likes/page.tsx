"use client";

import { useQuery } from "@tanstack/react-query";
import { ThumbsUp } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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
import { formatNumber } from "@/lib/utils";

export default function LikesAnalyticsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["likes-analytics"],
    queryFn: () => api.likesAnalytics.list(),
  });

  const stats = data?.data ?? [];
  const loadError = error instanceof Error ? error.message : null;
  const totalLikes = stats.reduce((sum, item) => sum + item.likesCount, 0);

  return (
    <DashboardShell title="Likes Analytics">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-gray-400">
          <ThumbsUp className="h-5 w-5" />
          <span>{formatNumber(totalLikes)} total likes across {stats.length} videos</span>
        </div>

        {loadError?.includes("likes_count") && (
          <Card className="border-yellow-500/30 bg-yellow-500/10">
            <CardContent className="p-4 text-sm text-yellow-200">
              The <code>likes_count</code> column is missing. Run{" "}
              <code>supabase/player_features.sql</code> in the Supabase SQL Editor.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Video</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-gray-500">
                        No like data yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-gray-500">{index + 1}</TableCell>
                        <TableCell>
                          <p className="font-medium text-white">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.id}</p>
                        </TableCell>
                        <TableCell>{item.categoryName || "—"}</TableCell>
                        <TableCell className="text-right font-bold text-blue-400">
                          {formatNumber(item.likesCount)}
                        </TableCell>
                        <TableCell className="text-right text-gray-400">
                          {formatNumber(item.views)}
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
