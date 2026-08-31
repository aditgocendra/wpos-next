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
  FolderTreeIcon,
  PackageIcon,
  SearchIcon,
  LayersIcon,
} from "lucide-react";
import type { CategoryItem } from "@/services/category.service";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { CategoryDetailDialog, formatDateTime } from "@/components/categories/category-detail-dialog";
import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog";

import { useCategory } from "@/providers/category-provider";

const pageSizeItems = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
];

export function CategoryTable() {
  const { categories, isLoading: loading, error, refreshCategories: fetchCategories } = useCategory();
  const [searchQuery, setSearchQuery] = React.useState("");

  // Dialog States
  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] =
    React.useState<CategoryItem | null>(null);

  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [selectedCategoryForDetail, setSelectedCategoryForDetail] =
    React.useState<CategoryItem | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedCategoryForDelete, setSelectedCategoryForDelete] =
    React.useState<CategoryItem | null>(null);

  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });

  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: "fullPath",
      desc: false, // Sort ascending by default: Root (level 0) -> Subkategori (level 1 -> 2...)
    },
  ]);

  // Filter categories based on search query
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        cat.code.toLowerCase().includes(q) ||
        cat.fullPath.toLowerCase().includes(q) ||
        (cat.parent && cat.parent.name.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  const columns = React.useMemo<ColumnDef<CategoryItem>[]>(
    () => [
      {
        header: "Nama Kategori",
        accessorKey: "name",
        cell: ({ row }) => {
          const cat = row.original;
          return (
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  cat.level === 0
                    ? "bg-primary/10 text-primary"
                    : cat.level === 1
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                )}
              >
                <FolderTreeIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm leading-tight text-foreground truncate">
                    {cat.name}
                  </p>
                  {cat.level > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground"
                    >
                      Lvl {cat.level}
                    </Badge>
                  )}
                </div>
                {cat.parent ? (
                  <p className="text-xs text-muted-foreground truncate max-w-[260px] flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-muted-foreground/70">Parent:</span>
                    <span className="font-medium text-foreground/80">
                      {cat.parent.name}
                    </span>
                    <span className="font-mono text-[10px]">[{cat.parent.code}]</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic mt-0.5">
                    Kategori Utama (Root)
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
          return (
            <Badge
              variant="outline"
              className="font-mono text-xs font-bold tracking-widest px-2.5 py-0.5 bg-primary/5 text-primary border-primary/20 shadow-2xs"
            >
              {code}
            </Badge>
          );
        },
      },
      {
        header: "Hierarki Path",
        accessorKey: "fullPath",
        sortingFn: (rowA, rowB) => {
          const levelA = rowA.original.level;
          const levelB = rowB.original.level;
          if (levelA !== levelB) {
            return levelA - levelB;
          }
          return rowA.original.fullPath.localeCompare(rowB.original.fullPath);
        },
        cell: ({ row }) => {
          const cat = row.original;
          const pathSegments = cat.fullPath.split(" > ");
          return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[300px]">
              <LayersIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
              <div className="flex items-center gap-1 flex-1 min-w-0 truncate" title={cat.fullPath}>
                {pathSegments.map((segment, idx, arr) => (
                  <React.Fragment key={idx}>
                    <span
                      className={
                        idx === arr.length - 1
                          ? "font-semibold text-foreground truncate"
                          : "text-muted-foreground/80 truncate"
                      }
                    >
                      {segment}
                    </span>
                    {idx < arr.length - 1 && (
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">
                        &gt;
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 shrink-0 font-mono font-medium ml-1.5 border-muted-foreground/30"
              >
                {cat.level === 0 ? "1 level" : `${cat.level + 1} level`}
              </Badge>
            </div>
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
          const cat = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Lihat Detail"
                onClick={() => {
                  setSelectedCategoryForDetail(cat);
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
                title="Edit Kategori"
                onClick={() => {
                  setSelectedCategoryForEdit(cat);
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
                title="Hapus Kategori"
                onClick={() => {
                  setSelectedCategoryForDelete(cat);
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Categories Management</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola kategori bertingkat (multi-level) dan kode 3 huruf untuk penomoran SKU produk.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={fetchCategories}
            disabled={loading}
            title="Muat ulang data"
          >
            <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
          </Button>

          <Button
            onClick={() => {
              setSelectedCategoryForEdit(null);
              setFormDialogOpen(true);
            }}
            className="gap-2 shadow-sm"
          >
            <PlusIcon className="size-4" />
            <span>Tambah Kategori</span>
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari kategori (nama, kode 3 huruf, parent)..."
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
                    <span>Memuat data kategori...</span>
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
                    ? "Tidak ada kategori yang sesuai dengan pencarian."
                    : "Belum ada data kategori. Klik tombol \"Tambah Kategori\" untuk membuat kategori baru."}
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
            total kategori
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
      <CategoryFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        category={selectedCategoryForEdit}
        categories={categories}
        onSuccess={fetchCategories}
      />

      <CategoryDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        category={selectedCategoryForDetail}
        onEdit={(cat) => {
          setSelectedCategoryForEdit(cat);
          setFormDialogOpen(true);
        }}
      />

      <CategoryDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        category={selectedCategoryForDelete}
        onSuccess={fetchCategories}
      />
    </div>
  );
}
