"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Video,
  FolderOpen,
  Crown,
  Users,
  CreditCard,
  Smartphone,
  Megaphone,
  BarChart3,
  Flag,
  ThumbsUp,
  Settings,
  Shield,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/categories", label: "Categories", icon: FolderOpen },
  { href: "/vip-plans", label: "VIP Plans", icon: Crown },
  { href: "/users", label: "Users", icon: Users },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/apk", label: "APK Manager", icon: Smartphone },
  { href: "/advertisements", label: "Advertisements", icon: Megaphone },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/likes", label: "Likes", icon: ThumbsUp },
  { href: "/reports", label: "Reports", icon: Flag },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admins", label: "Admins", icon: Shield },
  { href: "/activity-logs", label: "Activity Logs", icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/10 bg-[#0f0f1a]/95 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
          <Play className="h-5 w-5 text-white" fill="white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="truncate text-sm font-bold text-white">VZW Admin</p>
            <p className="truncate text-xs text-gray-500">Video Za Wakubwa Tu</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-blue-400")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-12 items-center justify-center border-t border-white/10 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>
    </aside>
  );
}
