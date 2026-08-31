"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import {
  SearchIcon,
  PlusIcon,
  Trash2Icon,
  Loader2Icon,
  WarehouseIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  MinusIcon,
  AlertCircleIcon,
} from "lucide-react";
import type { TransactionData } from "@/services/transaction.service";

interface WarehouseOption {
  id: string;
  name: string;
  code?: string | null;
}

interface ProductVariantOption {
  id: string;
  productId: string;
  variantName: string;
  sku: string;
  stock: number;
  priceSell: number;
}

interface ProductOption {
  id: string;
  name: string;
  warehouseId: string;
  variants: ProductVariantOption[];
}

interface CartItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  price: number;
  quantity: number;
  availableStock: number;
  totalPrice: number;
}

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionData | null;
  onSuccess: () => void;
  warehouses: WarehouseOption[];
  userWarehouseId?: string | null;
  userRole?: string | null;
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
  warehouses,
  userWarehouseId,
  userRole,
}: TransactionFormDialogProps) {
  const isEdit = Boolean(transaction);

  // Form State
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [cartItems, setCartItems] = React.useState<CartItem[]>([]);

  // Product Search State (Async with Debounce)
  const [productSearch, setProductSearch] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");
  const [searchResults, setSearchResults] = React.useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = React.useState<ProductOption | null>(null);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>("");
  const [addQuantity, setAddQuantity] = React.useState<number>(1);

  // Submission State
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(productSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Fetch products asynchronously on debounced search query
  React.useEffect(() => {
    if (!selectedWarehouseId || !debouncedSearch.trim() || selectedProduct) {
      if (!debouncedSearch.trim()) {
        setSearchResults([]);
      }
      return;
    }

    let isMounted = true;
    const fetchSearchResults = async () => {
      setLoadingProducts(true);
      try {
        const res = await fetch(
          `/api/inventory?warehouseId=${selectedWarehouseId}&search=${encodeURIComponent(
            debouncedSearch.trim()
          )}&limit=100`
        );
        const data = await res.json();
        if (isMounted) {
          const items = data.data || data.products || [];
          if (res.ok) {
            setSearchResults(items);
          } else {
            setSearchResults([]);
          }
        }
      } catch {
        if (isMounted) setSearchResults([]);
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    };

    fetchSearchResults();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, selectedWarehouseId, selectedProduct]);

  // Reset or initialize form when opened
  React.useEffect(() => {
    if (open) {
      setError(null);
      setProductSearch("");
      setSearchResults([]);
      setSelectedProduct(null);
      setSelectedVariantId("");
      setAddQuantity(1);

      if (transaction) {
        setSelectedWarehouseId(transaction.warehouseId);
        setNotes(transaction.notes || "");
        setCartItems(
          transaction.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            variantId: it.variantId,
            variantName: it.variantName,
            sku: it.sku,
            price: it.price,
            quantity: it.quantity,
            availableStock: 999, // In edit mode, existing stock is available
            totalPrice: it.totalPrice,
          }))
        );
      } else {
        // Create mode
        const defaultWarehouse =
          (userRole === "CASHIER" && userWarehouseId)
            ? userWarehouseId
            : userWarehouseId || (warehouses.length > 0 ? warehouses[0].id : "");
        setSelectedWarehouseId(defaultWarehouse);
        setNotes("");
        setCartItems([]);
      }
    }
  }, [open, transaction, userWarehouseId, userRole, warehouses]);

  // When selectedProduct changes, select first available variant with stock > 0 by default
  React.useEffect(() => {
    if (selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0) {
      const availableVariant = selectedProduct.variants.find((v) => (v.stock ?? 0) > 0);
      setSelectedVariantId(availableVariant ? availableVariant.id : selectedProduct.variants[0].id);
      setAddQuantity(1);
    } else {
      setSelectedVariantId("");
    }
  }, [selectedProduct]);

  // Selected variant helper
  const selectedVariant = React.useMemo(() => {
    if (!selectedProduct || !selectedVariantId) return null;
    return selectedProduct.variants.find((v) => v.id === selectedVariantId) || null;
  }, [selectedProduct, selectedVariantId]);

  // Total Payment calculation
  const totalAmount = React.useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cartItems]);

  // Add product variant to cart
  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const variant = selectedProduct.variants.find((v) => v.id === selectedVariantId);
    if (!variant) return;

    if (addQuantity <= 0) {
      setError("Jumlah barang harus minimal 1");
      return;
    }

    if ((variant.stock ?? 0) <= 0) {
      setError(
        `Varian ${variant.variantName} sedang habis (Stok 0) dan tidak dapat dipilih`
      );
      return;
    }

    if (!isEdit && (variant.stock ?? 0) < addQuantity) {
      setError(
        `Stok tidak mencukupi untuk varian ${variant.variantName}. Stok tersedia: ${variant.stock ?? 0}`
      );
      return;
    }

    setError(null);

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (it) => it.productId === selectedProduct.id && it.variantId === variant.id
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + addQuantity;
        if (!isEdit && variant.stock < newQty) {
          setError(
            `Total jumlah (${newQty}) melebihi stok tersedia (${variant.stock})`
          );
          return prev;
        }
        updated[existingIndex].quantity = newQty;
        updated[existingIndex].totalPrice = newQty * variant.priceSell;
        return updated;
      }

      return [
        ...prev,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          variantId: variant.id,
          variantName: variant.variantName,
          sku: variant.sku,
          price: variant.priceSell,
          quantity: addQuantity,
          availableStock: variant.stock,
          totalPrice: addQuantity * variant.priceSell,
        },
      ];
    });

    // Reset picker
    setProductSearch("");
    setSelectedProduct(null);
    setSelectedVariantId("");
    setAddQuantity(1);
  };

  // Update item quantity in cart
  const handleUpdateItemQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    setCartItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (!isEdit && item.availableStock && newQty > item.availableStock) {
        setError(`Stok tidak mencukupi (Maksimal: ${item.availableStock})`);
        return prev;
      }
      setError(null);
      item.quantity = newQty;
      item.totalPrice = newQty * item.price;
      return updated;
    });
  };

  // Remove item from cart
  const handleRemoveFromCart = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedWarehouseId) {
      setError("Silakan pilih gudang transaksi");
      return;
    }

    if (cartItems.length === 0) {
      setError("Daftar barang penjualan tidak boleh kosong. Tambahkan produk ke tabel.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        warehouseId: selectedWarehouseId,
        notes: notes.trim() || undefined,
        items: cartItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      };

      const url = isEdit ? `/api/transactions/${transaction?.id}` : "/api/transactions";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan transaksi");
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <ReceiptIcon className="size-5 text-primary" />
            {isEdit ? "Edit Transaksi Penjualan" : "Tambah Transaksi Penjualan"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui item barang atau rincian transaksi penjualan."
              : "Buat transaksi penjualan kasir baru dan potong stok otomatis."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/15 p-3 text-sm text-destructive font-medium">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Warehouse Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <WarehouseIcon className="size-4 text-primary" />
                Lokasi Gudang / Toko <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedWarehouseId}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedWarehouseId(val);
                    setCartItems([]);
                    setSelectedProduct(null);
                    setProductSearch("");
                  }
                }}
                disabled={isEdit || userRole === "CASHIER"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Gudang..." />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name} {wh.code ? `(${wh.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Catatan Transaksi (Opsional)
              </Label>
              <Input
                placeholder="Contoh: Pembayaran Cash / QRIS"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Search Product Section */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <SearchIcon className="size-4 text-primary" />
                Cari Produk (Case Insensitive) <span className="text-destructive">*</span>
              </Label>
              {loadingProducts && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Memuat produk...
                </div>
              )}
            </div>

            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Ketik nama produk untuk mencari..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setSelectedProduct(null);
                }}
                className="pl-9 bg-background"
                disabled={!selectedWarehouseId}
              />

              {/* Autocomplete / Search Dropdown List */}
              {productSearch.trim() && !selectedProduct && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-md divide-y">
                  {loadingProducts ? (
                    <div className="px-4 py-3 text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2Icon className="size-4 animate-spin text-primary" />
                      <span>Mencari produk...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((prod) => (
                      <button
                        type="button"
                        key={prod.id}
                        onClick={() => {
                          setSelectedProduct(prod);
                          setProductSearch(prod.name);
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted/80 flex items-center justify-between transition-colors text-sm"
                      >
                        <span className="font-medium text-foreground">{prod.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {prod.variants.length} Varian
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-center text-muted-foreground">
                      Produk tidak ditemukan
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Variant Selector & Add Controls */}
            {selectedProduct && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-2 border-t">
                <div className="sm:col-span-6 space-y-1.5">
                  <Label className="text-xs font-medium">Pilih Varian</Label>
                  <Select
                    value={selectedVariantId}
                    onValueChange={(val) => {
                      if (val) setSelectedVariantId(val);
                    }}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Pilih Varian" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProduct.variants.map((v) => {
                        const isOutOfStock = (v.stock ?? 0) <= 0;
                        return (
                          <SelectItem
                            key={v.id}
                            value={v.id}
                            disabled={isOutOfStock}
                          >
                            {v.variantName} - Rp {v.priceSell.toLocaleString("id-ID")}{" "}
                            {isOutOfStock ? "(Stok Habis)" : `(Stok: ${v.stock})`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs font-medium">Qty</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                      onClick={() => setAddQuantity((q) => Math.max(1, q - 1))}
                    >
                      <MinusIcon className="size-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={selectedVariant ? selectedVariant.stock : undefined}
                      value={addQuantity}
                      onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-center h-9 bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                      onClick={() => setAddQuantity((q) => q + 1)}
                    >
                      <PlusIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <Button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!selectedVariant || (selectedVariant.stock ?? 0) <= 0}
                    className="w-full gap-2 h-9"
                  >
                    <PlusIcon className="size-4" />
                    Tambah
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Table List of Selected Products (Cart) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <ShoppingCartIcon className="size-4 text-primary" />
                Daftar Produk Dipilih ({cartItems.length} Item)
              </Label>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-xs">
                    <TableHead className="font-semibold">Product Name</TableHead>
                    <TableHead className="font-semibold">Variant</TableHead>
                    <TableHead className="text-right font-semibold">Price</TableHead>
                    <TableHead className="text-center font-semibold w-28">Quantity</TableHead>
                    <TableHead className="text-right font-semibold">Total Price</TableHead>
                    <TableHead className="w-12 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cartItems.length > 0 ? (
                    cartItems.map((item, index) => (
                      <TableRow key={`${item.productId}-${item.variantId}`}>
                        <TableCell className="font-medium text-sm">
                          {item.productName}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="font-normal">
                            {item.variantName}
                          </Badge>
                          {item.sku && item.sku !== "-" && (
                            <span className="block text-[10px] text-muted-foreground mt-0.5">
                              {item.sku}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          Rp {item.price.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleUpdateItemQuantity(index, item.quantity - 1)}
                            >
                              <MinusIcon className="size-3" />
                            </Button>
                            <span className="w-8 text-center font-semibold text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleUpdateItemQuantity(index, item.quantity + 1)}
                            >
                              <PlusIcon className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm tabular-nums text-primary">
                          Rp {item.totalPrice.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveFromCart(index)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground text-sm"
                      >
                        Belum ada produk yang dipilih. Silakan cari produk di atas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Total Bayar Footer */}
            <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/20 mt-3">
              <div className="text-sm font-semibold">Total Bayar</div>
              <div className="text-2xl font-bold text-primary tabular-nums">
                Rp {totalAmount.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading || cartItems.length === 0}>
              {loading ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : isEdit ? (
                "Perbarui Transaksi"
              ) : (
                "Simpan Transaksi"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
