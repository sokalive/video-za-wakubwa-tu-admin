"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  data: Record<string, unknown>[];
  dataKey: string;
  xKey: string;
  type?: "area" | "bar";
  formatValue?: (value: number) => string;
  color?: string;
}

export function ChartCard({
  title,
  data,
  dataKey,
  xKey,
  type = "area",
  formatValue = formatNumber,
  color = "#6366f1",
}: ChartCardProps) {
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 shadow-xl">
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-sm font-semibold text-white">{formatValue(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {type === "area" ? (
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey={xKey} stroke="#6b7280" fontSize={12} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  fill={`url(#gradient-${dataKey})`}
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey={xKey} stroke="#6b7280" fontSize={12} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface TopListProps {
  title: string;
  items: { id: string; name: string; primary: number; secondary?: number }[];
  primaryLabel: string;
  secondaryLabel?: string;
  formatPrimary?: (v: number) => string;
}

export function TopList({ title, items, primaryLabel, secondaryLabel, formatPrimary = formatNumber }: TopListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-sm font-bold text-blue-400">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-white">{item.name}</p>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{primaryLabel}: {formatPrimary(item.primary)}</span>
                  {secondaryLabel && item.secondary !== undefined && (
                    <span>{secondaryLabel}: {formatNumber(item.secondary)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
