"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  WarehouseIcon,
  ArrowLeftRightIcon,
  BoxesIcon,
  UsersIcon,
  LayersIcon,
  RowsIcon,
  ScanBarcodeIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  ClipboardCheckIcon,
} from "lucide-react"

const allNavItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: <LayoutDashboardIcon />,
    roles: ["SUPER_ADMIN", "WAREHOUSE_ADMIN", "CASHIER"],
  },

  {
    title: "Warehouses",
    url: "/warehouse",
    icon: <WarehouseIcon />,
    roles: ["SUPER_ADMIN"],
  },
  {
    title: "Stock Transfers",
    url: "/transfers",
    icon: <ArrowLeftRightIcon />,
    roles: ["SUPER_ADMIN", "WAREHOUSE_ADMIN"],
  },
  {
    title: "Categories",
    url: "/categories",
    icon: <RowsIcon />,
    roles: ["SUPER_ADMIN"],
  },
  {
    title: "Inventory",
    url: "/inventory",
    icon: <BoxesIcon />,
    roles: ["SUPER_ADMIN", "WAREHOUSE_ADMIN"],
  },
  {
    title: "Stock Opname",
    url: "/opname",
    icon: <ClipboardCheckIcon />,
    roles: ["SUPER_ADMIN", "WAREHOUSE_ADMIN"],
  },
  {
    title: "User Management",
    url: "/users",
    icon: <UsersIcon />,
    roles: ["SUPER_ADMIN"],
  },
  {
    title: "Transaction",
    url: "/transaction",
    icon: <ScanBarcodeIcon />,
    roles: ["SUPER_ADMIN", "CASHIER"],
  },
  {
    title: "Report",
    url: "/report",
    icon: <FileSpreadsheetIcon />,
    roles: ["SUPER_ADMIN"],
  },
  {
    title: "Backup",
    url: "/backup",
    icon: <DatabaseIcon />,
    roles: ["SUPER_ADMIN"],
  },

]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()

  const role = session?.user?.role

  const filteredNavItems = React.useMemo(() => {
    if (!role) {
      return allNavItems
    }
    return allNavItems.filter((item) => !item.roles || item.roles.includes(role))
  }, [role])

  const user = React.useMemo(() => {
    return {
      name: session?.user?.name || "Admin User",
      email: session?.user?.email || "admin@wpos.com",
      avatar: (session?.user as { image?: string })?.image || "",
      role: session?.user?.role || "",
    }
  }, [session])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <LayersIcon className="size-5! text-primary" />
              <span className="text-base font-bold tracking-tight">WPOS System</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredNavItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}

