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
  SearchIcon,
  ReceiptIcon,
  WarehouseIcon,
  FilterIcon,
  Loader2Icon,
} from "lucide-react";
import type { TransactionData } from "@/services/transaction.service";
import {
  TransactionDetailDialog,
  formatDateTime,
} from "@/components/transaction/transaction-detail-dialog";
import { TransactionFormDialog } from "@/components/transaction/transaction-form-dialog";
import { TransactionDeleteDialog } from "@/components/transaction/transaction-delete-dialog";

const pageSizeItems = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
];

export function TransactionTable() {
  const [transactions, setTransactions] = React.useState<TransactionData[]>([]);
  const [warehouses, setWarehouses] = React.useState<
    { id: string; name: string; code?: string | null }[]
  >([]);
  const [currentUserRole, setCurrentUserRole] = React.useState<string | null>(null);
  const [userWarehouseId, setUserWarehouseId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = React.useState<string>("ALL");

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
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editTransaction, setEditTransaction] = React.useState<TransactionData | null>(null);
  const [detailTransaction, setDetailTransaction] = React.useState<TransactionData | null>(null);
  const [deleteTransaction, setDeleteTransaction] = React.useState<TransactionData | null>(null);

  // Fetch initial session info and warehouses
  const fetchInitialData = React.useCallback(async () => {
    try {
      const [sessionRes, whRes] = await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/warehouses"),
      ]);

      const sessionData = await sessionRes.json();
      if (sessionData?.user) {
        setCurrentUserRole(sessionData.user.role);
        setUserWarehouseId(sessionData.user.warehouseId || null);
      }

      const whData = await whRes.json();
      if (whData?.warehouses) {
        setWarehouses(whData.warehouses);
      }
    } catch {
      // Ignored
    }
  }, []);

  // Fetch transactions list
  const fetchTransactions = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedWarehouseFilter && selectedWarehouseFilter !== "ALL") {
        params.set("warehouseId", selectedWarehouseFilter);
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat data transaksi");
      }

      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseFilter, searchQuery]);

  React.useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  React.useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";

  // Table Columns Definition
  const columns = React.useMemo<ColumnDef<TransactionData>[]>(
    () => [
      {
        id: "transactionDate",
        header: "Tanggal Transaksi",
        accessorFn: (row) => row.createdAt,
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          const day = date.getDate().toString().padStart(2, "0");
          const month = (date.getMonth() + 1).toString().padStart(2, "0");
          const year = date.getFullYear();
          return <span className="font-medium text-sm">{`${day}/${month}/${year}`}</span>;
        },
        enableSorting: false,
      },
      {
        id: "transactionNumber",
        header: "ID Transaksi",
        accessorKey: "transactionNumber",
        cell: ({ row }) => (
          <div className="font-semibold text-primary font-mono text-sm">
            {row.original.transactionNumber}
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "productName",
        header: "Produk",
        accessorFn: (row) => row.productNames.join(", "),
        cell: ({ row }) => {
          const names = row.original.productNames;
          if (names.length === 0) return <span className="text-muted-foreground">-</span>;
          return (
            <div className="max-w-[200px] truncate text-sm font-medium" title={names.join(", ")}>
              {names.join(", ")}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: "warehouse",
        header: "Warehouse",
        accessorFn: (row) => row.warehouse?.name,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm">
            <WarehouseIcon className="size-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{row.original.warehouse?.name || "-"}</span>
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "totalAmount",
        header: "Total Bayar",
        accessorFn: (row) => row.totalAmount,
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-sm">
            Rp {row.original.totalAmount.toLocaleString("id-ID")}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: "createdAt",
        header: "Created At",
        accessorFn: (row) => row.createdAt,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
        enableSorting: true,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const item = row.original;

          return (
            <div className="flex items-center justify-end gap-1">
              {/* Detail Button */}
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Lihat Detail"
                onClick={() => setDetailTransaction(item)}
              >
                <EyeIcon className="size-4" />
              </Button>

              {/* Edit Button - Super Admin Only */}
              {isSuperAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-primary"
                  title="Edit Transaksi"
                  onClick={() => setEditTransaction(item)}
                >
                  <PencilIcon className="size-4" />
                </Button>
              )}

              {/* Delete Button - Super Admin Only */}
              {isSuperAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  title="Hapus Transaksi"
                  onClick={() => setDeleteTransaction(item)}
                >
                  <Trash2Icon className="size-4" />
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
    data: transactions,
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
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ReceiptIcon className="size-6 text-primary" />
            Transaksi Penjualan (Cashier)
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola transaksi kasir dan pantau riwayat penjualan produk.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTransactions()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            size="sm"
            className="gap-1.5 bg-primary shadow-xs"
          >
            <PlusIcon className="size-4" />
            Tambah Transaksi
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="sm:col-span-8 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari ID transaksi atau nama produk (case insensitive)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          {/* Filter Warehouse */}
          <div className="sm:col-span-4">
            <Select
              value={selectedWarehouseFilter}
              onValueChange={(val) => {
                if (val) setSelectedWarehouseFilter(val);
              }}
            >
              <SelectTrigger className="w-full bg-background">
                <div className="flex items-center gap-2 truncate">
                  <FilterIcon className="size-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Semua Gudang" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Gudang</SelectItem>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name} {wh.code ? `(${wh.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-sm text-destructive font-medium flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchTransactions()}
            className="text-destructive underline hover:bg-destructive/10"
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Main Table - Data Table 10 Pattern */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50 text-xs">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-11 font-semibold text-foreground select-none",
                        header.column.getCanSort() && "cursor-pointer"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: <ChevronUpIcon className="size-3.5 text-primary" />,
                          desc: <ChevronDownIcon className="size-3.5 text-primary" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && transactions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-48 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2Icon className="size-6 animate-spin text-primary" />
                    <span className="text-sm">Memuat data transaksi...</span>
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
                  className="h-36 text-center text-muted-foreground text-sm"
                >
                  Tidak ada transaksi yang ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Baris per halaman:</Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-18">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs">
              Menampilkan {table.getRowModel().rows.length} dari {transactions.length} data
            </span>
          </div>

          <Pagination className="justify-end w-auto mx-0">
            <PaginationContent className="gap-1">
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronFirstIcon className="size-4" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <span className="text-xs px-2 font-medium text-foreground">
                  Halaman {table.getState().pagination.pageIndex + 1} dari{" "}
                  {table.getPageCount() || 1}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronLastIcon className="size-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* Dialog Modals */}
      <TransactionFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={fetchTransactions}
        warehouses={warehouses}
        userWarehouseId={userWarehouseId}
        userRole={currentUserRole}
      />

      <TransactionFormDialog
        open={Boolean(editTransaction)}
        onOpenChange={(open) => !open && setEditTransaction(null)}
        transaction={editTransaction}
        onSuccess={fetchTransactions}
        warehouses={warehouses}
        userWarehouseId={userWarehouseId}
        userRole={currentUserRole}
      />

      <TransactionDetailDialog
        open={Boolean(detailTransaction)}
        onOpenChange={(open) => !open && setDetailTransaction(null)}
        transaction={detailTransaction}
      />

      <TransactionDeleteDialog
        open={Boolean(deleteTransaction)}
        onOpenChange={(open) => !open && setDeleteTransaction(null)}
        transaction={deleteTransaction}
        onSuccess={fetchTransactions}
      />
    </div>
  );
}
