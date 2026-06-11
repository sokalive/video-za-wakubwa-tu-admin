"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { ChartCard, TopList } from "@/components/dashboard/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.dashboard.stats(),
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.analytics.get(),
  });

  const stats = statsData?.data;
  const analytics = analyticsData?.data;

  return (
    <DashboardShell title="Dashboard">
      <div className="space-y-6">
        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <StatsGrid stats={stats} />
        ) : null}

        {analyticsLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[380px] rounded-xl" />
            <Skeleton className="h-[380px] rounded-xl" />
          </div>
        ) : analytics ? (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Daily Views (Last 30 Days)"
                data={analytics.dailyViews}
                dataKey="views"
                xKey="date"
                color="#6366f1"
              />
              <ChartCard
                title="Revenue Chart"
                data={analytics.revenueChart}
                dataKey="revenue"
                xKey="date"
                formatValue={formatCurrency}
                color="#8b5cf6"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <ChartCard
                title="Monthly Views"
                data={analytics.monthlyViews}
                dataKey="views"
                xKey="month"
                type="bar"
                color="#06b6d4"
              />
              <TopList
                title="Top Videos"
                items={analytics.topVideos.map((v) => ({
                  id: v.id,
                  name: v.title,
                  primary: v.views,
                  secondary: v.revenue,
                }))}
                primaryLabel="Views"
                secondaryLabel="Revenue"
                formatPrimary={(v) => v.toLocaleString()}
              />
              <TopList
                title="Top Categories"
                items={analytics.topCategories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  primary: c.views,
                  secondary: c.videoCount,
                }))}
                primaryLabel="Views"
                secondaryLabel="Videos"
              />
            </div>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
