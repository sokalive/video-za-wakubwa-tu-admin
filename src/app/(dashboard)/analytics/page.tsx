"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ChartCard, TopList } from "@/components/dashboard/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils";

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.analytics.get(),
  });

  const analytics = data?.data;

  return (
    <DashboardShell title="Analytics">
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[380px] rounded-xl" />
            <Skeleton className="h-[380px] rounded-xl" />
          </div>
        </div>
      ) : analytics ? (
        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">Daily Views</TabsTrigger>
            <TabsTrigger value="weekly">Weekly Views</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Views</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="top">Top Content</TabsTrigger>
            <TabsTrigger value="likes">Most Liked</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-6">
            <ChartCard title="Daily Views (0 until view tracking is enabled)" data={analytics.dailyViews} dataKey="views" xKey="date" color="#6366f1" />
          </TabsContent>

          <TabsContent value="weekly" className="mt-6">
            <ChartCard title="Weekly Views" data={analytics.weeklyViews} dataKey="views" xKey="week" type="bar" color="#8b5cf6" />
          </TabsContent>

          <TabsContent value="monthly" className="mt-6">
            <ChartCard title="Monthly Views" data={analytics.monthlyViews} dataKey="views" xKey="month" type="bar" color="#06b6d4" />
          </TabsContent>

          <TabsContent value="revenue" className="mt-6">
            <ChartCard title="Revenue Chart" data={analytics.revenueChart} dataKey="revenue" xKey="date" formatValue={formatCurrency} color="#10b981" />
          </TabsContent>

          <TabsContent value="top" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <TopList
                title="Top Videos"
                items={analytics.topVideos.map((v) => ({
                  id: v.id, name: v.title, primary: v.views, secondary: v.revenue,
                }))}
                primaryLabel="Views"
                secondaryLabel="Revenue"
              />
              <TopList
                title="Top Categories"
                items={analytics.topCategories.map((c) => ({
                  id: c.id, name: c.name, primary: c.views, secondary: c.videoCount,
                }))}
                primaryLabel="Views"
                secondaryLabel="Videos"
              />
            </div>
          </TabsContent>

          <TabsContent value="likes" className="mt-6">
            <TopList
              title="Most Liked Videos"
              items={(analytics.topLikedVideos ?? []).map((v) => ({
                id: v.id,
                name: v.title,
                primary: v.likesCount,
                secondary: v.views,
              }))}
              primaryLabel="Likes"
              secondaryLabel="Views"
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </DashboardShell>
  );
}
