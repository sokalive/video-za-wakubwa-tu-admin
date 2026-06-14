"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
}

export function DashboardShell({ children, title }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    closeMobile();
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <div className="fixed inset-0 bg-gradient-to-br from-blue-950/20 via-transparent to-purple-950/20 pointer-events-none" />
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiLz48L2c+PC9nPjwvc3ZnPg==')] pointer-events-none" />

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden touch-manipulation"
          onClick={closeMobile}
        />
      )}

      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />

      <div
        className={cn(
          "relative min-w-0 transition-[padding] duration-300",
          collapsed ? "lg:pl-[72px]" : "lg:pl-64"
        )}
      >
        <Header title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="min-w-0 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
