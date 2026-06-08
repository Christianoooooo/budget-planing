"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tag,
  BarChart2,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Plus,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GERMAN_MONTHS } from "@/lib/constants";
import AddTransactionDialog from "@/components/add-transaction-dialog";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaktionen", icon: ArrowLeftRight },
  { href: "/categories", label: "Kategorien", icon: Tag },
  { href: "/planning", label: "Planung", icon: BarChart2 },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/transactions": "Transaktionen",
    "/categories": "Kategorien",
    "/planning": "Planung",
    "/settings": "Einstellungen",
  };
  return titles[pathname] || "Budget Planer";
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const now = new Date();
  const currentYear = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const currentMonth = parseInt(searchParams.get("month") || String(now.getMonth() + 1));

  function navigateMonth(delta: number) {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(newYear));
    params.set("month", String(newMonth));
    router.push(`${pathname}?${params.toString()}`);
  }

  const showMonthNav = ["/dashboard", "/transactions", "/planning"].includes(pathname);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r bg-card">
        <div className="flex h-16 items-center gap-2 px-4 border-b">
          <span className="text-xl font-bold text-primary">💰</span>
          <span className="font-bold text-lg">Budget Planer</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname === item.href}
            />
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 lg:px-6">
          {/* Mobile menu */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-16 items-center gap-2 px-4 border-b">
                <span className="text-xl font-bold text-primary">💰</span>
                <span className="font-bold text-lg">Budget Planer</span>
              </div>
              <nav className="p-4 space-y-1">
                {NAV_ITEMS.map((item) => (
                  <NavItem
                    key={item.href}
                    {...item}
                    isActive={pathname === item.href}
                    onClick={() => setSheetOpen(false)}
                  />
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <h1 className="font-semibold text-lg flex-1">{getPageTitle(pathname)}</h1>

          {/* Month navigation */}
          {showMonthNav && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {GERMAN_MONTHS[currentMonth - 1]} {currentYear}
              </span>
              <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Theme toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}

          {/* Add transaction */}
          <Button size="sm" onClick={() => setAddTxOpen(true)} className="hidden sm:flex gap-1">
            <Plus className="h-4 w-4" />
            Transaktion
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>

        {/* Bottom nav - mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t bg-background/95 backdrop-blur h-16">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1 text-xs transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="leading-none">
                  {item.label === "Transaktionen" ? "Trans." : item.label === "Einstellungen" ? "Settings" : item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Add Transaction Dialog */}
      <AddTransactionDialog
        open={addTxOpen}
        onOpenChange={setAddTxOpen}
        onSuccess={() => {
          setAddTxOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
