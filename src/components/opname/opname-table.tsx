"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
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
  Trash2Icon,
  EyeIcon,
  RefreshCwIcon,
  SearchIcon,
  WarehouseIcon,
  FilterIcon,
  RotateCcwIcon,
  ClipboardCheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { OpnameDeleteDialog } from "./opname-delete-dialog";
import type { StockOpnameStatus } from "@/generated/prisma/client";

interface WarehouseOption {
  id: string;
  name: string;
  code: string | null;
}

interface OpnameItem {
  id: string;
  opnameNumber: string;
  warehouseId: string;
  warehouse: { id: string; name: string; code: string | null };
  status: StockOpnameStatus;
  notes: string | null;
  createdById: string;
  createdBy: { id: string; name: string | null; email: string };
  updatedBy: { id: string; name: string | null; email: string } | null;
  _count: { items: number };
  createdAt: string;
  updatedAt: string;
}

export function OpnameTable() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const [data, setData] = React.useState<OpnameItem[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [totalItems, setTotalItems] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);

  // Filters state
  const [search, setSearch] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");
  const [selectedWarehouse, setSelectedWarehouse] = React.useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");

  // Pagination & Sorting state
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean;
    opname: OpnameItem | null;
    loading: boolean;
  }>({
    open: false,
    opname: null,
    loading: false,
  });

  // Fetch warehouses for Super Admin filter
  const fetchWarehouses = React.useCallback(async () => {
    try {
      const res = await fetch("/api/warehouses");
      if (res.ok) {
        const json = await res.json();
        setWarehouses(json.warehouses || json.data || []);
      }
    } catch {
      // Ignore warehouse fetch error in filter
    }
  }, []);

  // Fetch opname data
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.pageIndex + 1));
      params.set("limit", String(pagination.pageSize));

      if (search) params.set("search", search);
      if (selectedWarehouse && selectedWarehouse !== "ALL") {
        params.set("warehouseId", selectedWarehouse);
      }
      if (selectedStatus && selectedStatus !== "ALL") {
        params.set("status", selectedStatus);
      }

      const res = await fetch(`/api/opname?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat data stock opname");
      }

      setData(json.data || []);
      setTotalItems(json.meta?.total || 0);
      setTotalPages(json.meta?.totalPages || 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, search, selectedWarehouse, selectedStatus]);

  React.useEffect(() => {
    if (isSuperAdmin) {
      fetchWarehouses();
    }
  }, [isSuperAdmin, fetchWarehouses]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearch("");
    setSearchInput("");
    setSelectedWarehouse("ALL");
    setSelectedStatus("ALL");
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Delete Opname draft
  const handleDeleteConfirm = async () => {
    if (!deleteDialog.opname) return;

    setDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/opname/${deleteDialog.opname.id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal menghapus draft stock opname");
      }

      toast.success("Draft stock opname berhasil dihapus");
      setDeleteDialog({ open: false, opname: null, loading: false });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: StockOpnameStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
            Selesai (Completed)
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground border-border/60">
            Dibatalkan
          </Badge>
        );
      case "DRAFT":
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
            Draft
          </Badge>
        );
    }
  };

  // Define Table Columns
  const columns = React.useMemo<ColumnDef<OpnameItem>[]>(
    () => [
      {
        accessorKey: "opnameNumber",
        header: "Nomor Opname",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground tracking-tight">
              {row.original.opnameNumber}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(row.original.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "warehouse.name",
        header: "Gudang",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <WarehouseIcon className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {row.original.warehouse?.name || "-"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => renderStatusBadge(row.original.status),
      },
      {
        accessorKey: "_count.items",
        header: "Total Item",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-xs">
            {row.original._count?.items || 0} Varian
          </Badge>
        ),
      },
      {
        accessorKey: "createdBy.name",
        header: "Pencatat",
        cell: ({ row }) => (
          <div className="flex flex-col text-xs">
            <span className="font-medium text-foreground">
              {row.original.createdBy?.name || "User"}
            </span>
            <span className="text-muted-foreground">
              {row.original.createdBy?.email}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "notes",
        header: "Catatan",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[180px]">
            {row.original.notes || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => {
          const item = row.original;
          const isDraft = item.status === "DRAFT";

          return (
            <div className="flex items-center gap-1.5">
              <Link href={`/opname/${item.id}`}>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Lihat Detail Opname"
                >
                  <EyeIcon className="size-4 text-primary" />
                </Button>
              </Link>

              {isDraft && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    setDeleteDialog({
                      open: true,
                      opname: item,
                      loading: false,
                    })
                  }
                  title="Hapus Draft"
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2Icon className="size-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      pagination,
      sorting,
    },
    pageCount: totalPages,
    manualPagination: true,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      {/* Header & Action Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheckIcon className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Stock Opname
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Audit perhitungan fisik dan penyesuaian stok inventaris per gudang
          </p>
        </div>

        <Link href="/opname/create">
          <Button className="gap-2 shrink-0">
            <PlusIcon className="size-4" />
            <span>Buat Stock Opname</span>
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FilterIcon className="size-4 text-primary" />
            <span>Filter Data</span>
          </div>

          {(search || selectedWarehouse !== "ALL" || selectedStatus !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcwIcon className="size-3.5" />
              Reset Filter
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="space-y-1.5">
            <Label className="text-xs font-medium">Cari Opname</Label>
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Nomor opname, catatan..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </form>

          {/* Warehouse Filter (Only for Super Admin) */}
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Gudang</Label>
              <Select
                value={selectedWarehouse}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedWarehouse(val);
                    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Semua Gudang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Gudang</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Status</Label>
            <Select
              value={selectedStatus}
              onValueChange={(val) => {
                if (val) {
                  setSelectedStatus(val);
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                }
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="COMPLETED">Selesai (Completed)</SelectItem>
                <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Refresh Action */}
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="h-9 w-full gap-2 text-xs"
            >
              <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
              <span>Segarkan Data</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-semibold">
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 select-none",
                          header.column.getCanSort() && "cursor-pointer"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() === "asc" && (
                          <ChevronUpIcon className="size-3.5" />
                        )}
                        {header.column.getIsSorted() === "desc" && (
                          <ChevronDownIcon className="size-3.5" />
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCwIcon className="size-5 animate-spin text-primary" />
                    <span className="text-xs">Memuat data stock opname...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <ClipboardCheckIcon className="size-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-foreground">
                      Belum ada data stock opname
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Klik tombol &quot;Buat Stock Opname&quot; untuk memulai audit stok barang fisik.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-xs py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Baris per halaman:</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(val) =>
                setPagination((prev) => ({
                  ...prev,
                  pageSize: Number(val),
                  pageIndex: 0,
                }))
              }
            >
              <SelectTrigger className="h-8 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>
              Menampilkan {data.length > 0 ? pagination.pageIndex * pagination.pageSize + 1 : 0} -{" "}
              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalItems)} dari {totalItems} data
            </span>
          </div>

          <Pagination className="w-auto">
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronFirstIcon className="size-3.5" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeftIcon className="size-3.5" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 text-xs font-medium">
                  Halaman {pagination.pageIndex + 1} dari {Math.max(1, totalPages)}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRightIcon className="size-3.5" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => table.setPageIndex(totalPages - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronLastIcon className="size-3.5" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* Delete Dialog */}
      <OpnameDeleteDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        opnameNumber={deleteDialog.opname?.opnameNumber || ""}
        onConfirm={handleDeleteConfirm}
        loading={deleteDialog.loading}
      />
    </div>
  );
}
