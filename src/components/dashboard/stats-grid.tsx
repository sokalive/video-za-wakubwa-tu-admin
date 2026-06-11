import {
  Video,
  Crown,
  Film,
  Users,
  Star,
  DollarSign,
  Download,
  Eye,
  LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { DashboardStats } from "@/types";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  gradient: string;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, gradient, subtitle }: StatCardProps) {
  return (
    <Card className="group hover:border-white/20 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${gradient}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatsGridProps {
  stats: DashboardStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const cards: StatCardProps[] = [
    { title: "Total Videos", value: formatNumber(stats.totalVideos), icon: Video, gradient: "bg-gradient-to-br from-blue-600 to-blue-700" },
    { title: "VIP Videos", value: formatNumber(stats.totalVipVideos), icon: Crown, gradient: "bg-gradient-to-br from-purple-600 to-purple-700" },
    { title: "Free Videos", value: formatNumber(stats.totalFreeVideos), icon: Film, gradient: "bg-gradient-to-br from-green-600 to-green-700" },
    { title: "Total Users", value: formatNumber(stats.totalUsers), icon: Users, gradient: "bg-gradient-to-br from-cyan-600 to-cyan-700" },
    { title: "VIP Users", value: formatNumber(stats.totalVipUsers), icon: Star, gradient: "bg-gradient-to-br from-yellow-600 to-orange-600" },
    { title: "Total Revenue", value: formatCurrency(stats.totalRevenue), icon: DollarSign, gradient: "bg-gradient-to-br from-emerald-600 to-emerald-700" },
    { title: "APK Downloads", value: formatNumber(stats.totalApkDownloads), icon: Download, gradient: "bg-gradient-to-br from-indigo-600 to-indigo-700" },
    { title: "Total Views", value: formatNumber(stats.totalViews), icon: Eye, gradient: "bg-gradient-to-br from-pink-600 to-rose-700" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  );
}
