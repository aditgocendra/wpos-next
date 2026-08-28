"use client";

import { useId, useMemo, useState } from "react";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  PackageIcon,
} from "lucide-react";
import { format } from "date-fns";
import type { ProductReportItem } from "@/services/report.service";

interface ProductReportTableProps {
  data: ProductReportItem[];
  loading?: boolean;
}

const pageSizeItems = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
];

export function ProductReportTable({ data, loading = false }: ProductReportTableProps) {
  const id = useId();

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "productName",
      desc: false,
    },
  ]);

  const columns = useMemo<ColumnDef<ProductReportItem>[]>(
    () => [
      {
        id: "no",
        header: "No",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.index + 1 + pagination.pageIndex * pagination.pageSize}
          </span>
        ),
        size: 50,
        enableSorting: false,
      },
      {
        header: "Nama Produk",
        accessorKey: "productName",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{row.original.productName}</span>
            <span className="text-xs text-muted-foreground">SKU: {row.original.sku}</span>
          </div>
        ),
      },
      {
        header: "Varian",
        accessorKey: "variantName",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-normal text-xs">
            {row.original.variantName}
          </Badge>
        ),
      },
      {
        header: "Kategori",
        accessorKey: "categoryName",
        cell: ({ row }) => (
          <span className="text-xs font-medium text-muted-foreground">
            {row.original.categoryName}
          </span>
        ),
      },
      {
        header: "Gudang",
        accessorKey: "warehouseName",
        cell: ({ row }) => (
          <span className="text-xs font-medium">{row.original.warehouseName}</span>
        ),
      },
      {
        header: "Qty Terjual",
        accessorKey: "quantitySold",
        cell: ({ row }) => (
          <span className="font-semibold text-primary">
            {row.original.quantitySold.toLocaleString("id-ID")} unit
          </span>
        ),
      },
      {
        header: "Total Penjualan",
        accessorKey: "totalAmount",
        cell: ({ row }) => (
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            Rp {row.original.totalAmount.toLocaleString("id-ID")}
          </span>
        ),
      },
      {
        header: "Penjualan Terakhir",
        accessorKey: "lastSaleDate",
        cell: ({ row }) => {
          const date = row.original.lastSaleDate;
          if (!date) return <span className="text-xs text-muted-foreground">-</span>;
          try {
            return (
              <span className="text-xs text-muted-foreground">
                {format(new Date(date), "dd/MM/yyyy HH:mm")}
              </span>
            );
          } catch {
            return <span className="text-xs text-muted-foreground">-</span>;
          }
        },
      },
    ],
    [pagination.pageIndex, pagination.pageSize]
  );

  const table = useReactTable({
    data,
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
      <div className="rounded-lg border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined }}
                      className="h-11 font-semibold"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          className={cn(
                            header.column.getCanSort() &&
                              "flex h-full cursor-pointer items-center justify-between gap-2 select-none hover:text-foreground"
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
                              <ChevronUpIcon className="shrink-0 opacity-80 size-4 text-primary" aria-hidden="true" />
                            ),
                            desc: (
                              <ChevronDownIcon className="shrink-0 opacity-80 size-4 text-primary" aria-hidden="true" />
                            ),
                          }[header.column.getIsSorted() as string] ?? (
                            <div className="size-4 opacity-30 flex flex-col items-center justify-center">
                              <ChevronUpIcon className="size-3 -mb-1" />
                              <ChevronDownIcon className="size-3" />
                            </div>
                          )}
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
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Memuat data laporan produk...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <PackageIcon className="size-8 opacity-40 text-muted-foreground" />
                    <p className="font-medium text-foreground">Tidak ada data laporan produk</p>
                    <p className="text-xs">Coba sesuaikan rentang tanggal atau filter yang digunakan.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-3">
          <Label htmlFor={id} className="text-xs text-muted-foreground whitespace-nowrap">
            Baris per halaman:
          </Label>
          <Select
            items={pageSizeItems}
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger id={id} className="w-[70px] h-8 text-xs">
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

        <div className="text-muted-foreground flex grow justify-center sm:justify-end text-xs whitespace-nowrap">
          <p aria-live="polite">
            <span className="text-foreground font-medium">
              {table.getRowCount() === 0
                ? 0
                : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
              -
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getRowCount()
              )}
            </span>{" "}
            dari <span className="text-foreground font-medium">{table.getRowCount().toString()}</span> data
          </p>
        </div>

        <div>
          <Pagination>
            <PaginationContent className="gap-1">
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.firstPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Halaman pertama"
                >
                  <ChevronFirstIcon className="size-4" aria-hidden="true" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeftIcon className="size-4" aria-hidden="true" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRightIcon className="size-4" aria-hidden="true" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.lastPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Halaman terakhir"
                >
                  <ChevronLastIcon className="size-4" aria-hidden="true" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}
