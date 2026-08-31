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
  CheckCircle2Icon,
  XCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  ArrowRightLeftIcon,
  WarehouseIcon,
  FilterIcon,
  Loader2Icon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import type { StockTransferData } from "@/services/transfer.service";
import {
  TransferDetailDialog,
  formatDateTime,
  getStatusBadge,
} from "@/components/transfer/transfer-detail-dialog";
import { TransferFormDialog } from "@/components/transfer/transfer-form-dialog";
import { TransferDeleteDialog } from "@/components/transfer/transfer-delete-dialog";
import { TransferApproveDialog } from "@/components/transfer/transfer-approve-dialog";
import { TransferRejectDialog } from "@/components/transfer/transfer-reject-dialog";

const pageSizeItems = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
];

export function TransferTable() {
  const [transfers, setTransfers] = React.useState<StockTransferData[]>([]);
  const [warehouses, setWarehouses] = React.useState<
    { id: string; name: string; code?: string | null }[]
  >([]);
  const [currentUserRole, setCurrentUserRole] = React.useState<string | null>(
    null
  );
  const [userWarehouseId, setUserWarehouseId] = React.useState<string | null>(
    null
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] =
    React.useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] =
    React.useState<string>("ALL");

  // Table State
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

  // Dialog States
  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [selectedTransferForEdit, setSelectedTransferForEdit] =
    React.useState<StockTransferData | null>(null);

  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [selectedTransferForDetail, setSelectedTransferForDetail] =
    React.useState<StockTransferData | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedTransferForDelete, setSelectedTransferForDelete] =
    React.useState<StockTransferData | null>(null);

  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);
  const [selectedTransferForApprove, setSelectedTransferForApprove] =
    React.useState<StockTransferData | null>(null);

  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [selectedTransferForReject, setSelectedTransferForReject] =
    React.useState<StockTransferData | null>(null);

  // Fetch Current User Session
  React.useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            setCurrentUserRole(data.user.role || null);
            setUserWarehouseId(data.user.warehouseId || null);
            if (data.user.role === "WAREHOUSE_ADMIN" && data.user.warehouseId) {
              setSelectedWarehouseFilter(data.user.warehouseId);
            }
          }
        }
      } catch {
        // Fallback or ignore
      }
    }
    fetchSession();
  }, []);

  // Fetch Warehouses
  const fetchWarehouses = React.useCallback(async () => {
    try {
      const res = await fetch("/api/warehouses");
      const data = await res.json();
      if (res.ok && data.warehouses) {
        setWarehouses(data.warehouses);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Fetch Transfers
  const fetchTransfers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedWarehouseFilter !== "ALL") {
        params.append("warehouseId", selectedWarehouseFilter);
      }
      if (selectedStatusFilter !== "ALL") {
        params.append("status", selectedStatusFilter);
      }
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      const res = await fetch(`/api/transfers?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat data transfer");
      }

      setTransfers(data.transfers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseFilter, selectedStatusFilter, searchQuery]);

  React.useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  React.useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";

  // Define Table Columns
  const columns = React.useMemo<ColumnDef<StockTransferData>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.productNames.join(", "),
        header: "Nama Produk",
        cell: ({ row }) => {
          const names = row.original.productNames;
          const itemsCount = row.original.items.length;
          return (
            <div className="space-y-1">
              <div className="font-medium text-foreground">
                {names[0] || "Produk"}
              </div>
              {names.length > 1 && (
                <div className="text-xs text-muted-foreground">
                  +{names.length - 1} produk lain ({itemsCount} varian)
                </div>
              )}
              <div className="text-[11px] font-mono text-muted-foreground">
                {row.original.transferNumber}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: "totalQuantity",
        accessorKey: "totalQuantity",
        header: "Jumlah Produk",
        cell: ({ row }) => (
          <div className="font-bold text-foreground">
            {row.original.totalQuantity}{" "}
            <span className="text-xs font-normal text-muted-foreground">unit</span>
          </div>
        ),
        enableSorting: true,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.status),
        enableSorting: true,
      },
      {
        id: "sourceWarehouse",
        accessorFn: (row) => row.sourceWarehouse?.name,
        header: "Warehouse Asal",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-medium text-sm">
            <WarehouseIcon className="size-3.5 text-amber-500 shrink-0" />
            <span>{row.original.sourceWarehouse?.name}</span>
          </div>
        ),
        enableSorting: true,
      },
      {
        id: "destinationWarehouse",
        accessorFn: (row) => row.destinationWarehouse?.name,
        header: "Warehouse Tujuan",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-medium text-sm">
            <WarehouseIcon className="size-3.5 text-emerald-500 shrink-0" />
            <span>{row.original.destinationWarehouse?.name}</span>
          </div>
        ),
        enableSorting: true,
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Created At",
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground font-mono">
            {formatDateTime(row.original.createdAt)}
          </div>
        ),
        enableSorting: true,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const t = row.original;
          const isPending = t.status === "PENDING";

          return (
            <div className="flex items-center justify-end gap-1.5">
              {/* Tombol Detail */}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setSelectedTransferForDetail(t);
                  setDetailDialogOpen(true);
                }}
                title="Lihat Detail"
                className="hover:bg-primary/10 hover:text-primary"
              >
                <EyeIcon className="size-3.5" />
              </Button>

              {/* Tombol Edit (Hanya jika PENDING) */}
              {isPending && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setSelectedTransferForEdit(t);
                    setFormDialogOpen(true);
                  }}
                  title="Edit Transfer"
                  className="hover:bg-amber-500/10 hover:text-amber-600"
                >
                  <PencilIcon className="size-3.5" />
                </Button>
              )}

              {/* Tombol Approve (Hanya jika PENDING) */}
              {isPending && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setSelectedTransferForApprove(t);
                    setApproveDialogOpen(true);
                  }}
                  title="Approve / Eksekusi Transfer"
                  className="hover:bg-green-500/10 text-green-600 dark:text-green-400"
                >
                  <CheckCircle2Icon className="size-3.5" />
                </Button>
              )}

              {/* Tombol Reject (Hanya jika PENDING) */}
              {isPending && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setSelectedTransferForReject(t);
                    setRejectDialogOpen(true);
                  }}
                  title="Reject / Batalkan Transfer"
                  className="hover:bg-destructive/10 text-destructive"
                >
                  <XCircleIcon className="size-3.5" />
                </Button>
              )}

              {/* Tombol Delete: Muncul jika Super Admin (semua status termasuk TRANSFERED) */}
              {isSuperAdmin && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setSelectedTransferForDelete(t);
                    setDeleteDialogOpen(true);
                  }}
                  title="Hapus Transfer (Super Admin)"
                  className="hover:bg-destructive/10 text-destructive"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [isSuperAdmin]
  );

  const table = useReactTable({
    data: transfers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: {
      sorting,
      pagination,
    },
  });

  return (
    <div className="w-full space-y-4">
      {/* Header Bar: Title, Search, Filter, Create Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ArrowRightLeftIcon className="size-6 text-primary" />
            Stock Transfer Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola permintaan dan pemindahan stok antar cabang gudang secara atomik dan terintegrasi
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <Button
            onClick={() => {
              setSelectedTransferForEdit(null);
              setFormDialogOpen(true);
            }}
            className="gap-1.5 shadow-xs"
          >
            <PlusIcon className="size-4" />
            Create Stock Transfer
          </Button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari nomor transfer, produk atau SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 text-xs h-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Hapus pencarian"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>

          {/* Filter Warehouse */}
          <div className="w-full sm:w-48">
            <Select
              value={selectedWarehouseFilter}
              onValueChange={(val) => {
                if (val) setSelectedWarehouseFilter(val);
              }}
              disabled={currentUserRole === "WAREHOUSE_ADMIN" && Boolean(userWarehouseId)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Semua Gudang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">
                  Semua Gudang
                </SelectItem>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id} className="text-xs">
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Status */}
          <div className="w-full sm:w-44">
            <Select
              value={selectedStatusFilter}
              onValueChange={(val) => {
                if (val) setSelectedStatusFilter(val);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">
                  Semua Status
                </SelectItem>
                <SelectItem value="PENDING" className="text-xs">
                  PENDING
                </SelectItem>
                <SelectItem value="IN_TRANSIT" className="text-xs">
                  IN TRANSIT
                </SelectItem>
                <SelectItem value="TRANSFERED" className="text-xs">
                  TRANSFERED
                </SelectItem>
                <SelectItem value="CANCELLED" className="text-xs">
                  CANCELLED
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filter Button */}
          {(searchQuery ||
            selectedWarehouseFilter !== "ALL" ||
            selectedStatusFilter !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedWarehouseFilter("ALL");
                setSelectedStatusFilter("ALL");
              }}
              className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              <RotateCcwIcon className="size-3.5" />
              Reset Filter
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchTransfers}
          disabled={loading}
          className="h-9 gap-1.5 text-xs shrink-0 self-end md:self-auto"
        >
          <RefreshCwIcon
            className={cn("size-3.5", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {/* Main Data Table (data-table-10 pattern) */}
      <div className="rounded-md border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent bg-muted/40">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                      className="h-11 text-xs font-semibold"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          className={cn(
                            header.column.getCanSort() &&
                              "flex h-full cursor-pointer items-center justify-between gap-2 select-none"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={(e) => {
                            if (
                              header.column.getCanSort() &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              e.preventDefault();
                              header.column.getToggleSortingHandler()?.(e);
                            }
                          }}
                          tabIndex={header.column.getCanSort() ? 0 : undefined}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: (
                              <ChevronUpIcon
                                className="shrink-0 opacity-60"
                                size={14}
                                aria-hidden="true"
                              />
                            ),
                            desc: (
                              <ChevronDownIcon
                                className="shrink-0 opacity-60"
                                size={14}
                                aria-hidden="true"
                              />
                            ),
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
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
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2Icon className="size-6 animate-spin text-primary" />
                    <span>Memuat data transfer stok...</span>
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
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5 py-4">
                    <ArrowRightLeftIcon className="size-8 text-muted-foreground/40 mb-1" />
                    <span className="font-medium text-foreground">
                      {searchQuery ||
                      selectedWarehouseFilter !== "ALL" ||
                      selectedStatusFilter !== "ALL"
                        ? "Tidak ada data transfer stok yang cocok dengan filter pencarian"
                        : "Tidak ada data transfer stok"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {searchQuery ||
                      selectedWarehouseFilter !== "ALL" ||
                      selectedStatusFilter !== "ALL" ? (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedWarehouseFilter("ALL");
                            setSelectedStatusFilter("ALL");
                          }}
                          className="h-auto p-0 text-xs text-primary underline"
                        >
                          Reset semua filter dan pencarian
                        </Button>
                      ) : (
                        "Buat draf transfer stok baru untuk memulai pemindahan barang."
                      )}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls (data-table-10 pattern) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1 py-2">
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Baris per halaman
          </Label>
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="w-18 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="p-1">
              {pageSizeItems.map((item) => (
                <SelectItem key={item.value} value={item.value} className="text-xs">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground whitespace-nowrap">
          Menampilkan{" "}
          <span className="font-semibold text-foreground">
            {transfers.length === 0
              ? 0
              : table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                1}
            -
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              table.getRowCount()
            )}
          </span>{" "}
          dari{" "}
          <span className="font-semibold text-foreground">
            {table.getRowCount()}
          </span>{" "}
          data transfer
        </div>

        <div>
          <Pagination>
            <PaginationContent className="gap-1">
              <PaginationItem>
                <Button
                  size="icon-xs"
                  variant="outline"
                  className="size-8"
                  onClick={() => table.firstPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Halaman pertama"
                >
                  <ChevronFirstIcon className="size-3.5" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  size="icon-xs"
                  variant="outline"
                  className="size-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeftIcon className="size-3.5" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  size="icon-xs"
                  variant="outline"
                  className="size-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRightIcon className="size-3.5" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  size="icon-xs"
                  variant="outline"
                  className="size-8"
                  onClick={() => table.lastPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Halaman terakhir"
                >
                  <ChevronLastIcon className="size-3.5" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* Dialogs */}
      <TransferFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        transfer={selectedTransferForEdit}
        warehouses={warehouses}
        onSuccess={fetchTransfers}
        userRole={currentUserRole}
        userWarehouseId={userWarehouseId}
      />

      <TransferDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        transfer={selectedTransferForDetail}
      />

      <TransferDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        transfer={selectedTransferForDelete}
        onSuccess={fetchTransfers}
      />

      <TransferApproveDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        transfer={selectedTransferForApprove}
        onSuccess={fetchTransfers}
      />

      <TransferRejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        transfer={selectedTransferForReject}
        onSuccess={fetchTransfers}
      />
    </div>
  );
}
