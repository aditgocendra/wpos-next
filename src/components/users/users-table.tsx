"use client";

import * as React from "react";
import {
  ColumnDef,
  PaginationState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronFirstIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronLastIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  RefreshCwIcon,
  UserCheckIcon,
  ShieldCheckIcon,
  StoreIcon,
  WarehouseIcon,
} from "lucide-react";
import type { UserItem } from "@/services/user.service";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { UserDeleteDialog } from "@/components/users/user-delete-dialog";

export function formatDateTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

const pageSizeItems = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
];

export function UsersTable() {
  const [users, setUsers] = React.useState<UserItem[]>([]);
  const [warehouses, setWarehouses] = React.useState<
    { id: string; name: string; code?: string | null }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<UserItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState<UserItem | null>(null);

  // Status toggle in progress tracking
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });

  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: "createdAt",
      desc: true,
    },
  ]);

  const fetchUsersAndWarehouses = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load users");
      }
      const data = await res.json();
      setUsers(data.users || []);
      setWarehouses(data.warehouses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUsersAndWarehouses();
  }, [fetchUsersAndWarehouses]);

  const handleToggleStatus = async (user: UserItem, newChecked: boolean) => {
    const targetStatus = newChecked ? "ACTIVE" : "INACTIVE";
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toggleStatus: true,
          status: targetStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      // Optimistic update locally
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: targetStatus } : u))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating status");
    } finally {
      setTogglingId(null);
    }
  };

  const columns = React.useMemo<ColumnDef<UserItem>[]>(
    () => [
      {
        header: "Email",
        accessorKey: "email",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{row.original.email}</span>
            {row.original.name && (
              <span className="text-xs text-muted-foreground">{row.original.name}</span>
            )}
          </div>
        ),
      },
      {
        header: "Password",
        id: "password",
        enableSorting: false,
        cell: () => <span className="font-mono text-muted-foreground tracking-widest">•••••</span>,
      },
      {
        header: "Role",
        accessorKey: "role",
        cell: ({ row }) => {
          const role = row.original.role;
          if (role === "SUPER_ADMIN") {
            return (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-medium">
                <ShieldCheckIcon className="mr-1 h-3 w-3" />
                Super Admin
              </Badge>
            );
          }
          if (role === "WAREHOUSE_ADMIN") {
            return (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-medium">
                <WarehouseIcon className="mr-1 h-3 w-3" />
                Warehouse Admin
              </Badge>
            );
          }
          return (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
              <StoreIcon className="mr-1 h-3 w-3" />
              Cashier
            </Badge>
          );
        },
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          const status = row.original.status;
          const isActive = status === "ACTIVE";
          return (
            <Badge
              variant={isActive ? "default" : "secondary"}
              className={cn(
                isActive
                  ? "bg-green-600/15 text-green-700 hover:bg-green-600/20 dark:bg-green-500/20 dark:text-green-300"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isActive ? "Active" : "Inactive"}
            </Badge>
          );
        },
      },
      {
        header: "Warehouse",
        id: "warehouse",
        cell: ({ row }) => {
          const user = row.original;
          if (!user.warehouse) {
            return <span className="text-muted-foreground">-</span>;
          }
          return (
            <div className="font-medium text-foreground">
              {user.warehouse.name}
              {user.warehouse.code && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  ({user.warehouse.code})
                </span>
              )}
            </div>
          );
        },
      },
      {
        header: "Created At",
        accessorKey: "createdAt",
        cell: ({ row }) => (
          <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        header: "Actions",
        id: "actions",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          const isSuperAdmin = user.role === "SUPER_ADMIN";
          const isToggling = togglingId === user.id;

          return (
            <div className="flex items-center gap-3">
              {/* Disable / Enable Switch */}
              <div
                className="flex items-center gap-1.5"
                title={
                  isSuperAdmin
                    ? "Status Super Admin tidak dapat dinonaktifkan"
                    : `Toggle status (${user.status})`
                }
              >
                <Switch
                  checked={user.status === "ACTIVE"}
                  disabled={isToggling || isSuperAdmin}
                  onCheckedChange={(checked) => handleToggleStatus(user, checked)}
                  aria-label="Toggle user active status"
                />
              </div>

              {/* Edit and Delete buttons hidden for Super Admin */}
              {!isSuperAdmin ? (
                <>
                  {/* Edit Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelectedUser(user);
                      setFormDialogOpen(true);
                    }}
                    title="Edit user"
                  >
                    <PencilIcon className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setUserToDelete(user);
                      setDeleteDialogOpen(true);
                    }}
                    title="Delete user"
                  >
                    <Trash2Icon className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground italic px-1">Protected</span>
              )}
            </div>
          );
        },
      },
    ],
    [togglingId]
  );

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: {
      sorting,
      pagination,
    },
  });

  return (
    <div className="w-full space-y-4">
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage system users, assigned roles, warehouse authorizations, and access status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsersAndWarehouses}
            disabled={loading}
            className="h-9"
          >
            <RefreshCwIcon className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setSelectedUser(null);
              setFormDialogOpen(true);
            }}
            className="h-9 shadow-sm"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Create User
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive font-medium">
          {error}
        </div>
      )}

      {/* Table Section */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                      className="h-11 font-semibold text-foreground/80"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          className={cn(
                            header.column.getCanSort() &&
                              "flex h-full cursor-pointer items-center justify-between gap-2 select-none"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={(e) => {
                            if (header.column.getCanSort() && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              header.column.getToggleSortingHandler()?.(e);
                            }
                          }}
                          tabIndex={header.column.getCanSort() ? 0 : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: (
                              <ChevronUpIcon className="shrink-0 opacity-60" size={16} aria-hidden="true" />
                            ),
                            desc: (
                              <ChevronDownIcon className="shrink-0 opacity-60" size={16} aria-hidden="true" />
                            ),
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCwIcon className="h-5 w-5 animate-spin text-primary" />
                    <span>Loading users...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No users found. Click &quot;Create User&quot; to add your first user.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-3">
          <Label htmlFor="rows-per-page" className="text-sm font-medium">
            Rows per page:
          </Label>
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger id="rows-per-page" className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="p-1">
              {pageSizeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-muted-foreground text-sm whitespace-nowrap">
          {table.getRowCount() > 0 ? (
            <p aria-live="polite">
              <span className="text-foreground font-medium">
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getRowCount()
                )}
              </span>{" "}
              of <span className="text-foreground font-medium">{table.getRowCount().toString()}</span> users
            </p>
          ) : (
            <span>0 users</span>
          )}
        </div>

        <div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.firstPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to first page"
                >
                  <ChevronFirstIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to previous page"
                >
                  <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to next page"
                >
                  <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.lastPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to last page"
                >
                  <ChevronLastIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* Dialogs */}
      <UserFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        user={selectedUser}
        warehouses={warehouses}
        onSuccess={fetchUsersAndWarehouses}
      />

      <UserDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        user={userToDelete}
        onSuccess={fetchUsersAndWarehouses}
      />
    </div>
  );
}
