"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThumbsUp, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BulkDeleteDialog } from "@/components/admin/bulk-delete-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["likes-analytics"],
    queryFn: () => api.likesAnalytics.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (videoIds: string[]) => api.likesAnalytics.bulkDelete(videoIds),
    onSuccess: () => {
      setSelected(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["likes-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const stats = data?.data ?? [];
  const loadError = error instanceof Error ? error.message : null;
  const totalLikes = stats.reduce((sum, item) => sum + item.likesCount, 0);
  const allSelected = stats.length > 0 && stats.every((s) => selected.has(s.id));
  const selectedCount = stats.filter((s) => selected.has(s.id)).length;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(stats.map((s) => s.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <DashboardShell title="Likes Analytics">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-400">
            <ThumbsUp className="h-5 w-5" />
            <span>{formatNumber(totalLikes)} total likes across {stats.length} videos</span>
          </div>
          {selectedCount > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Likes ({selectedCount})
            </Button>
          )}
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
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
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
                      <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                        No like data yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={() => toggleOne(item.id)}
                            aria-label={`Select ${item.title}`}
                          />
                        </TableCell>
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

      <BulkDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Clear likes for selected videos?"
        description="This will reset likes to zero and delete all like records for {count} video(s)."
        count={selectedCount}
        loading={deleteMutation.isPending}
        confirmLabel="Clear Likes"
        onConfirm={() => deleteMutation.mutate([...selected])}
      />
    </DashboardShell>
  );
}
