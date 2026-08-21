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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  EyeIcon,
  RefreshCwIcon,
  WarehouseIcon,
  PackageIcon,
  ShieldCheckIcon,
  SearchIcon,
} from "lucide-react";
import type { WarehouseItem, WarehouseAdminUser } from "@/services/warehouse.service";
import { WarehouseFormDialog } from "@/components/warehouse/warehouse-form-dialog";
import { WarehouseDetailDialog } from "@/components/warehouse/warehouse-detail-dialog";
import { WarehouseDeleteDialog } from "@/components/warehouse/warehouse-delete-dialog";

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

export function WarehouseTable() {
  const [warehouses, setWarehouses] = React.useState<WarehouseItem[]>([]);
  const [adminUsers, setAdminUsers] = React.useState<WarehouseAdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Dialog States
  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [selectedWarehouseForEdit, setSelectedWarehouseForEdit] =
    React.useState<WarehouseItem | null>(null);

  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [selectedWarehouseForDetail, setSelectedWarehouseForDetail] =
    React.useState<WarehouseItem | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedWarehouseForDelete, setSelectedWarehouseForDelete] =
    React.useState<WarehouseItem | null>(null);

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

  const fetchWarehouses = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/warehouses");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat data gudang");
      }

      setWarehouses(data.warehouses || []);
      setAdminUsers(data.adminUsers || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  // Filter warehouses based on search query
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return warehouses;
    const q = searchQuery.toLowerCase();
    return warehouses.filter(
      (wh) =>
        wh.name.toLowerCase().includes(q) ||
        (wh.code && wh.code.toLowerCase().includes(q)) ||
        (wh.address && wh.address.toLowerCase().includes(q)) ||
        (wh.adminUser &&
          (wh.adminUser.name?.toLowerCase().includes(q) ||
            wh.adminUser.email.toLowerCase().includes(q)))
    );
  }, [warehouses, searchQuery]);

  const columns = React.useMemo<ColumnDef<WarehouseItem>[]>(
    () => [
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => {
          const wh = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <WarehouseIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight text-foreground truncate">
                  {wh.name}
                </p>
                {wh.address ? (
                  <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                    {wh.address}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    Tidak ada alamat
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        header: "Code",
        accessorKey: "code",
        cell: ({ row }) => {
          const code = row.original.code;
          return code ? (
            <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
              {code}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          );
        },
      },
      {
        header: "Jumlah Produk",
        accessorKey: "productsCount",
        cell: ({ row }) => {
          const count = row.original.productsCount;
          return (
            <div className="flex items-center gap-1.5 font-medium text-sm">
              <PackageIcon className="size-3.5 text-muted-foreground" />
              <span>{count}</span>
            </div>
          );
        },
      },
      {
        header: "Admin Warehouse",
        id: "adminWarehouse",
        cell: ({ row }) => {
          const admin = row.original.adminUser;
          if (!admin) {
            return <span className="text-muted-foreground font-medium">-</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheckIcon className="size-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight truncate">
                  {admin.name || admin.email}
                </p>
                {admin.name && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {admin.email}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        header: "Created At",
        accessorKey: "createdAt",
        cell: ({ row }) => {
          return (
            <span className="text-xs font-mono text-muted-foreground">
              {formatDateTime(row.original.createdAt)}
            </span>
          );
        },
      },
      {
        header: "Actions",
        id: "actions",
        enableSorting: false,
        cell: ({ row }) => {
          const wh = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Lihat Detail"
                onClick={() => {
                  setSelectedWarehouseForDetail(wh);
                  setDetailDialogOpen(true);
                }}
              >
                <EyeIcon className="size-4" />
                <span className="sr-only">Detail</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-primary"
                title="Edit Gudang"
                onClick={() => {
                  setSelectedWarehouseForEdit(wh);
                  setFormDialogOpen(true);
                }}
              >
                <PencilIcon className="size-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                title="Hapus Gudang"
                onClick={() => {
                  setSelectedWarehouseForDelete(wh);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2Icon className="size-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Warehouse Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola daftar gudang, stok produk, dan penugasan admin gudang.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={fetchWarehouses}
            disabled={loading}
            title="Muat ulang data"
          >
            <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
          </Button>

          <Button
            onClick={() => {
              setSelectedWarehouseForEdit(null);
              setFormDialogOpen(true);
            }}
            className="gap-2 shadow-sm"
          >
            <PlusIcon className="size-4" />
            <span>Tambah Gudang</span>
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari gudang (nama, kode, admin)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="text-xs h-9"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Data Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-11 font-semibold text-xs text-muted-foreground uppercase tracking-wider",
                        canSort && "cursor-pointer select-none"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {canSort && (
                          <div className="flex flex-col">
                            {isSorted === "asc" ? (
                              <ChevronUpIcon className="size-3.5 text-foreground" />
                            ) : isSorted === "desc" ? (
                              <ChevronDownIcon className="size-3.5 text-foreground" />
                            ) : (
                              <div className="opacity-0 hover:opacity-50">
                                <ChevronUpIcon className="size-3.5" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground text-sm"
                >
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCwIcon className="size-4 animate-spin text-primary" />
                    <span>Memuat data gudang...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground text-sm"
                >
                  {searchQuery
                    ? "Tidak ada gudang yang sesuai dengan pencarian."
                    : "Belum ada data gudang. Klik tombol \"Tambah Gudang\" untuk membuat gudang baru."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Menampilkan</span>
          <Select
            value={pagination.pageSize.toString()}
            onValueChange={(val) => {
              if (val) table.setPageSize(Number(val));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pagination.pageSize.toString()} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>
            dari{" "}
            <strong className="text-foreground font-semibold">
              {filteredData.length}
            </strong>{" "}
            total gudang
          </span>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 self-center sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            title="Halaman Pertama"
          >
            <ChevronFirstIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            title="Halaman Sebelumnya"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>

          <span className="text-xs px-2 font-medium">
            Halaman {table.getState().pagination.pageIndex + 1} dari{" "}
            {Math.max(table.getPageCount(), 1)}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            title="Halaman Berikutnya"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            title="Halaman Terakhir"
          >
            <ChevronLastIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Dialog Components */}
      <WarehouseFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        warehouse={selectedWarehouseForEdit}
        adminUsers={adminUsers}
        onSuccess={fetchWarehouses}
      />

      <WarehouseDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        warehouse={selectedWarehouseForDetail}
        onEdit={(wh) => {
          setSelectedWarehouseForEdit(wh);
          setFormDialogOpen(true);
        }}
      />

      <WarehouseDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        warehouse={selectedWarehouseForDelete}
        onSuccess={fetchWarehouses}
      />
    </div>
  );
}
