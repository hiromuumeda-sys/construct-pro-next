"use client";

import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  Tags,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  roles?: Array<"admin" | "accounting" | "staff">;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/reporting", icon: LayoutDashboard, label: "レポーティング" },
  { href: "/projects", icon: FileText, label: "受注一覧" },
  { href: "/orders-list", icon: ClipboardList, label: "工事計画" },
  { href: "/customers", icon: Building2, label: "顧客マスタ" },
  { href: "/vendors", icon: Users, label: "発注先マスタ" },
  { href: "/categories", icon: Tags, label: "工事区分マスタ" },
  { href: "/receipts", icon: BarChart3, label: "売上・入金管理" },
  { href: "/payment", icon: CreditCard, label: "支払管理" },
  {
    href: "/history",
    icon: History,
    label: "履歴詳細",
    roles: ["admin", "accounting"],
  },
  {
    href: "/invite",
    icon: UserPlus,
    label: "アカウント発行",
    roles: ["admin"],
  },
];

export function SidebarNav({ role }: { role: string }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) =>
      !item.roles ||
      item.roles.includes(role as "admin" | "accounting" | "staff")
  );

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname?.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 font-medium text-sm transition-colors",
              active
                ? "bg-secondary/15 text-secondary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            href={item.href}
            key={item.href}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
