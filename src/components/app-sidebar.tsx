"use client"

import * as React from "react"
import Link from "next/link"

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
} from "lucide-react"

const data = {
  user: {
    name: "Admin User",
    email: "admin@wpos.com",
    avatar: "/avatars/admin.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: (
        <LayoutDashboardIcon />
      ),
    },
    {
      title: "Warehouses",
      url: "/warehouses",
      icon: (
        <WarehouseIcon />
      ),
    },
    {
      title: "Stock Transfers",
      url: "/transfers",
      icon: (
        <ArrowLeftRightIcon />
      ),
    },
    {
      title: "Inventory & Categories",
      url: "/categories",
      icon: (
        <BoxesIcon />
      ),
    },
    {
      title: "User Management",
      url: "/users",
      icon: (
        <UsersIcon />
      ),
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
