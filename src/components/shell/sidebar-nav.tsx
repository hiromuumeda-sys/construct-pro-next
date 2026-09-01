"use client";

import {
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  Tags,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "~/lib/utils";

interface NavLink {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  roles?: Array<"admin" | "accounting" | "staff">;
}

interface NavGroup {
  children: NavLink[];
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

type NavEntry = NavLink | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

// 旧app（sidebar.js）と同じ構成：顧客/発注先/工事区分マスタは「マスタ設定」1項目に集約する
const NAV_ITEMS: NavEntry[] = [
  { href: "/reporting", icon: LayoutDashboard, label: "レポーティング" },
  { href: "/projects", icon: FileText, label: "受注一覧" },
  { href: "/orders-list", icon: ClipboardList, label: "工事計画" },
  {
    icon: Settings,
    label: "マスタ設定",
    children: [
      { href: "/customers", icon: Building2, label: "顧客マスタ" },
      { href: "/vendors", icon: Users, label: "発注先マスタ" },
      { href: "/categories", icon: Tags, label: "工事区分マスタ" },
    ],
  },
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

function visibleFor(
  entry: NavEntry,
  role: "admin" | "accounting" | "staff"
): NavEntry | null {
  if (isNavGroup(entry)) {
    const children = entry.children.filter(
      (c) => !c.roles || c.roles.includes(role)
    );
    return children.length ? { ...entry, children } : null;
  }
  return !entry.roles || entry.roles.includes(role) ? entry : null;
}

export function SidebarNav({ role }: { role: string }) {
  const pathname = usePathname();
  const r = role as "admin" | "accounting" | "staff";
  const items = NAV_ITEMS.map((entry) => visibleFor(entry, r)).filter(
    (entry): entry is NavEntry => entry !== null
  );
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {items.map((item) => {
        if (isNavGroup(item)) {
          return (
            <MasterNavGroup group={item} isActive={isActive} key={item.label} />
          );
        }

        const active = isActive(item.href);
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

function MasterNavGroup({
  group,
  isActive,
}: {
  group: NavGroup;
  isActive: (href: string) => boolean;
}) {
  const groupActive = group.children.some((c) => isActive(c.href));
  const [open, setOpen] = useState(groupActive);
  const Icon = group.icon;

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 font-medium text-sm transition-colors",
          groupActive
            ? "bg-secondary/15 text-secondary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="flex items-center gap-3">
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{group.label}</span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 border-muted border-l ps-3">
          {group.children.map((c) => {
            const active = isActive(c.href);
            const ChildIcon = c.icon;
            return (
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 font-medium text-sm transition-colors",
                  active
                    ? "bg-secondary/15 text-secondary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                href={c.href}
                key={c.href}
              >
                <ChildIcon className="size-4 shrink-0" />
                <span className="truncate">{c.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
