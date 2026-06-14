"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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
  Timer,
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/categories", label: "Categories", icon: FolderOpen },
  { href: "/vip-plans", label: "VIP Plans", icon: Crown },
  { href: "/vip-trial-settings", label: "VIP Trial Settings", icon: Timer },
  { href: "/sonicpesa", label: "SonicPesa Settings", icon: Zap },
  { href: "/users", label: "Users", icon: Users },
  { href: "/subscriptions", label: "VIP Subscriptions", icon: Crown },
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

export interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
  collapsed,
  onCollapsedChange,
}: SidebarProps) {
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (!mobileOpen) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0]?.clientX ?? 0;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0]?.clientX ?? 0;
      if (touchStartX.current - endX > 60) onMobileClose();
    };

    const el = asideRef.current;
    el?.addEventListener("touchstart", onTouchStart, { passive: true });
    el?.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el?.removeEventListener("touchstart", onTouchStart);
      el?.removeEventListener("touchend", onTouchEnd);
    };
  }, [mobileOpen, onMobileClose]);

  const showLabels = mobileOpen || !collapsed;

  return (
    <aside
      ref={asideRef}
      id="admin-sidebar"
      className={cn(
        "fixed left-0 top-0 z-50 flex h-[100dvh] flex-col border-r border-white/10 bg-[#0f0f1a]/98 backdrop-blur-xl",
        "w-[min(100vw,280px)] transition-transform duration-300 ease-out",
        "max-lg:-translate-x-full max-lg:shadow-2xl",
        mobileOpen && "max-lg:translate-x-0",
        "lg:translate-x-0 lg:transition-[width]",
        collapsed ? "lg:w-[72px]" : "lg:w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between gap-3 border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
            <Play className="h-5 w-5 text-white" fill="white" />
          </div>
          {showLabels && (
            <div className="min-w-0 overflow-hidden lg:hidden">
              <p className="truncate text-sm font-bold text-white">VZW Admin</p>
              <p className="truncate text-xs text-gray-500">Menu</p>
            </div>
          )}
          {showLabels && (
            <div className="hidden min-w-0 overflow-hidden lg:block">
              <p className="truncate text-sm font-bold text-white">VZW Admin</p>
              <p className="truncate text-xs text-gray-500">Video Za Wakubwa Tu</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0 touch-manipulation"
          onClick={onMobileClose}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3 touch-pan-y">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all touch-manipulation",
                isActive
                  ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30"
                  : "text-gray-400 hover:bg-white/5 hover:text-white active:bg-white/10"
              )}
              title={!showLabels ? item.label : undefined}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-blue-400")} />
              {showLabels && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        className="hidden lg:flex h-12 items-center justify-center border-t border-white/10 text-gray-400 hover:bg-white/5 hover:text-white transition-colors touch-manipulation"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>
    </aside>
  );
}
