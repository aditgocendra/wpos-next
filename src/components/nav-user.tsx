"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, LogOutIcon, ShieldIcon } from "lucide-react"
import { signOut } from "next-auth/react"

function formatRoleName(role?: string) {
  if (!role) return ""
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin"
    case "WAREHOUSE_ADMIN":
      return "Warehouse Admin"
    case "CASHIER":
      return "Cashier"
    default:
      return role
  }
}

function getInitials(name?: string) {
  if (!name) return "US"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar?: string
    role?: string
  }
}) {
  const { isMobile } = useSidebar()

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/sign-in" })
  }

  const roleLabel = formatRoleName(user.role)
  const initials = getInitials(user.name)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {roleLabel ? `${roleLabel}` : user.email}
              </span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{user.name}</span>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                    {roleLabel && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium mt-0.5">
                        <ShieldIcon className="size-3" />
                        {roleLabel}
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOutIcon />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

