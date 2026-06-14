"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { useState } from "react";

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const { data } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.auth.me(),
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.auth.logout();
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between gap-2 border-b border-white/10 bg-[#0f0f1a]/80 backdrop-blur-xl px-3 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0 touch-manipulation"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-base font-semibold text-white sm:text-xl">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-4">
        <div className="hidden md:flex relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input placeholder="Search..." className="w-64 pl-9" />
        </div>

        <Button variant="ghost" size="icon" className="relative touch-manipulation">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-white">{data?.admin?.name || "Admin"}</p>
            <p className="text-xs text-gray-500 capitalize">{data?.admin?.role?.replace("_", " ") || "Administrator"}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-bold text-white">
            {data?.admin?.name?.charAt(0) || "A"}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Logout"
          className="touch-manipulation"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
