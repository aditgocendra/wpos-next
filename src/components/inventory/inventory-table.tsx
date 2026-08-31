"use client";

import * as React from "react";
import {
  ColumnDef,
  PaginationState,
  SortingState,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  BoxesIcon,
  WarehouseIcon,
  FolderTreeIcon,
  SearchIcon,
  ChevronRight,
  TrendingUpIcon,
  TagIcon,
  PackagePlusIcon,
} from "lucide-react";
import type { ProductItem } from "@/services/inventory.service";
import type { CategoryItem } from "@/services/category.service";
import { InventoryFormDialog } from "@/components/inventory/inventory-form-dialog";
import {
  InventoryDetailDialog,
  formatDateTime,
  formatRupiah,
} from "@/components/inventory/inventory-detail-dialog";
import { InventoryDeleteDialog } from "@/components/inventory/inventory-delete-dialog";
import { InventoryAddStockDialog } from "@/components/inventory/inventory-add-stock-dialog";
import { useCategory } from "@/providers/category-provider";

const pageSizeItems = [
  { label: "10", value: "10" },
  { label: "20", value: "20" },
  { label: "50", value: "50" },
  { label: "100", value: "100" },
];

export function InventoryTable() {
  const { categories } = useCategory();
  const [products, setProducts] = React.useState<ProductItem[]>([]);
  const [warehouses, setWarehouses] = React.useState<
    { id: string; name: string; code?: string | null }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] =
    React.useState<string>("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    React.useState<string>("ALL");

  // Dialog States
  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] =
    React.useState<ProductItem | null>(null);

  const [addStockDialogOpen, setAddStockDialogOpen] = React.useState(false);
  const [selectedProductForAddStock, setSelectedProductForAddStock] =
    React.useState<ProductItem | null>(null);

  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] =
    React.useState<ProductItem | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedProductForDelete, setSelectedProductForDelete] =
    React.useState<ProductItem | null>(null);

  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: "createdAt",
      desc: true,
    },
  ]);

  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  const [currentUserRole, setCurrentUserRole] = React.useState<string | null>(null);
  const [userWarehouseId, setUserWarehouseId] = React.useState<string | null>(null);

  // Load warehouses & session once on mount
  React.useEffect(() => {
    async function loadInitialData() {
      try {
        const [whRes, sessionRes] = await Promise.all([
          fetch("/api/warehouses"),
          fetch("/api/auth/session"),
        ]);
        if (whRes.ok) {
          const whData = await whRes.json();
          setWarehouses(whData.warehouses || []);
        }
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData?.user) {
            setCurrentUserRole(sessionData.user.role || null);
            setUserWarehouseId(sessionData.user.warehouseId || null);
            if (
              (sessionData.user.role === "WAREHOUSE_ADMIN" ||
                sessionData.user.role === "CASHIER") &&
              sessionData.user.warehouseId
            ) {
              setSelectedWarehouseFilter(sessionData.user.warehouseId);
            }
          }
        }
      } catch {
        // ignore
      }
    }
    loadInitialData();
  }, []);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(pagination.pageIndex + 1));
      params.set("limit", String(pagination.pageSize));

      if (selectedWarehouseFilter !== "ALL") {
        params.set("warehouseId", selectedWarehouseFilter);
      }
      if (selectedCategoryFilter !== "ALL") {
        params.set("categoryId", selectedCategoryFilter);
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const prodRes = await fetch(`/api/inventory?${params.toString()}`);
      const prodData = await prodRes.json();

      if (!prodRes.ok) {
        throw new Error(prodData.error || "Gagal memuat data produk inventaris");
      }

      const items = prodData.data || prodData.products || [];
      setProducts(items);
      setTotalCount(prodData.meta?.total ?? items.length);
      setTotalPages(prodData.meta?.totalPages ?? 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data"
      );
    } finally {
      setLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, selectedWarehouseFilter, selectedCategoryFilter, searchQuery]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset pageIndex when filter changes
  const handleWarehouseFilterChange = (wh: string) => {
    setSelectedWarehouseFilter(wh);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleCategoryFilterChange = (cat: string) => {
    setSelectedCategoryFilter(cat);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const columns = React.useMemo<ColumnDef<ProductItem>[]>(
    () => [
      {
        header: "Nama Produk",
        accessorKey: "name",
        cell: ({ row }) => {
          const prod = row.original;
          const isExp = row.getIsExpanded();
          return (
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  row.toggleExpanded();
                }}
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                title={isExp ? "Tutup varian" : "Lihat varian produk"}
              >
                <ChevronRight
                  className={cn(
                    "size-4 transition-transform duration-200",
                    isExp && "rotate-90 text-primary"
                  )}
                />
              </Button>

              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BoxesIcon className="size-4" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm leading-tight text-foreground truncate">
                    {prod.name}
                  </p>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 font-normal shrink-0"
                  >
                    {prod.variants.length} SKU
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  SKU Utama:{" "}
                  <span className="font-mono font-medium text-foreground/80">
                    {prod.variants[0]?.sku || "-"}
                  </span>
                </p>
              </div>
            </div>
          );
        },
      },
      {
        header: "Kategori",
        accessorKey: "category",
        cell: ({ row }) => {
          const cat = row.original.category;
          return (
            <div className="flex items-center gap-2">
              <FolderTreeIcon className="size-3.5 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{cat.name}</span>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] font-bold px-1.5 py-0 bg-primary/5 text-primary border-primary/20"
                >
                  {cat.code}
                </Badge>
              </div>
            </div>
          );
        },
      },

      {
        header: "Total Stok",
        accessorKey: "totalStock",
        cell: ({ row }) => {
          const stock = row.original.totalStock;
          const isOutOfStock = stock <= 0;
          const isLowStock = stock > 0 && stock <= 5;

          return (
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{stock}</span>
              <Badge
                className={cn(
                  "text-[10px] px-1.5 py-0 font-normal",
                  isOutOfStock
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : isLowStock
                      ? "bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : "bg-green-600/10 text-green-600 dark:text-green-400 border-green-500/20"
                )}
                variant="outline"
              >
                {isOutOfStock
                  ? "Habis"
                  : isLowStock
                    ? "Stok Rendah"
                    : "Tersedia"}
              </Badge>
            </div>
          );
        },
      },
      {
        header: "HPP (Moving Avg)",
        accessorKey: "avgCostPrice",
        cell: ({ row }) => {
          const avgCost = row.original.avgCostPrice;
          return (
            <div className="flex items-center gap-1.5 font-medium text-xs">
              <TrendingUpIcon className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="font-semibold text-foreground">
                {formatRupiah(avgCost)}
              </span>
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
          const prod = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-green-600 dark:hover:text-green-400"
                title="Tambah Stok"
                onClick={() => {
                  setSelectedProductForAddStock(prod);
                  setAddStockDialogOpen(true);
                }}
              >
                <PackagePlusIcon className="size-4" />
                <span className="sr-only">Tambah Stok</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Lihat Detail"
                onClick={() => {
                  setSelectedProductForDetail(prod);
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
                title="Edit Produk"
                onClick={() => {
                  setSelectedProductForEdit(prod);
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
                title="Hapus Produk"
                onClick={() => {
                  setSelectedProductForDelete(prod);
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
    data: products,
    columns,
    pageCount: totalPages,
    manualPagination: true,
    getRowId: (row) => row.id,
    getRowCanExpand: (row) => Boolean(row.original.variants && row.original.variants.length > 0),
    state: {
      pagination,
      sorting,
      expanded,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BoxesIcon className="size-6 text-primary" />
            <span>Inventory Management</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola inventaris multi-gudang, produk, varian SKU, dan moving average HPP modal.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={fetchData}
            disabled={loading}
            title="Muat ulang data"
          >
            <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
          </Button>

          <Button
            onClick={() => {
              setSelectedProductForEdit(null);
              setFormDialogOpen(true);
            }}
            className="gap-2 shadow-sm"
          >
            <PlusIcon className="size-4" />
            <span>Tambah Produk</span>
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama produk, SKU, kategori..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-background h-9 text-xs"
          />
        </div>


        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse Filter */}
          <Select
            value={selectedWarehouseFilter}
            onValueChange={(val) => {
              if (val) handleWarehouseFilterChange(val);
            }}
            disabled={
              (currentUserRole === "WAREHOUSE_ADMIN" ||
                currentUserRole === "CASHIER") &&
              Boolean(userWarehouseId)
            }
          >
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <WarehouseIcon className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Semua Gudang" />
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

          {/* Category Filter */}
          <Select
            value={selectedCategoryFilter}
            onValueChange={(val) => {
              if (val) handleCategoryFilterChange(val);
            }}
          >
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <FolderTreeIcon className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kategori</SelectItem>
              {categories.map((cat: CategoryItem) => (
                <SelectItem key={cat.id} value={cat.id}>
                  [{cat.code}] {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(searchQuery ||
          selectedWarehouseFilter !== "ALL" ||
          selectedCategoryFilter !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedWarehouseFilter("ALL");
                setSelectedCategoryFilter("ALL");
              }}
              className="text-xs h-9 shrink-0"
            >
              Reset Filter
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
                    <span>Memuat data inventaris produk...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      row.getIsExpanded() && "bg-muted/20 border-b-0"
                    )}
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

                  {/* Expanded Sub-Table for Product Variants */}
                  {row.getIsExpanded() && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-t-0">
                      <TableCell colSpan={columns.length} className="p-0">
                        <div className="px-6 py-3.5 bg-muted/40 border-y space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                              <TagIcon className="size-3.5 text-primary" />
                              <span>
                                Daftar Varian SKU ({row.original.variants.length}{" "}
                                varian)
                              </span>
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {row.original.variants.map((variant) => (
                              <div
                                key={variant.id}
                                className="rounded-lg border bg-card p-3 shadow-2xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold text-xs text-foreground truncate">
                                    {variant.variantName}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[10px] font-bold px-1.5 py-0 bg-primary/5 text-primary border-primary/20"
                                  >
                                    {variant.sku}
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-3 gap-1 text-[11px] pt-1 border-t">
                                  <div>
                                    <p className="text-muted-foreground text-[10px]">
                                      Stok
                                    </p>
                                    <p className="font-bold text-foreground">
                                      {variant.warehouseStocks?.reduce((sum, s) => sum + s.stock, 0) || 0}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-[10px]">
                                      Modal (HPP)
                                    </p>
                                    <p className="font-medium text-foreground">
                                      {formatRupiah(variant.priceCost)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-[10px]">
                                      Harga Jual
                                    </p>
                                    <p className="font-bold text-primary">
                                      {formatRupiah(variant.priceSell)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground text-sm"
                >
                  {searchQuery ||
                    selectedWarehouseFilter !== "ALL" ||
                    selectedCategoryFilter !== "ALL"
                    ? "Tidak ada produk yang sesuai dengan filter pencarian."
                    : 'Belum ada data inventaris produk. Klik tombol "Tambah Produk" untuk mulai mengelola stok.'}
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
              {totalCount}
            </strong>{" "}
            total produk
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

      {/* Dialogs */}
      <InventoryFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        product={selectedProductForEdit}
        categories={categories}
        warehouses={warehouses}
        onSuccess={fetchData}
      />

      <InventoryDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        product={selectedProductForDetail}
        onEdit={(prod) => {
          setSelectedProductForEdit(prod);
          setFormDialogOpen(true);
        }}
      />

      <InventoryAddStockDialog
        open={addStockDialogOpen}
        onOpenChange={setAddStockDialogOpen}
        product={selectedProductForAddStock}
        warehouses={warehouses}
        onSuccess={fetchData}
      />

      <InventoryDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        product={selectedProductForDelete}
        onSuccess={fetchData}
      />
    </div>
  );
}
