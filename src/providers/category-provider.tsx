"use client";

import * as React from "react";
import type { CategoryItem } from "@/services/category.service";

interface CategoryContextValue {
  categories: CategoryItem[];
  isLoading: boolean;
  error: string | null;
  refreshCategories: () => Promise<void>;
}

const CategoryContext = React.createContext<CategoryContextValue | undefined>(
  undefined
);

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = React.useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const refreshCategories = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/categories");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat daftar kategori");
      }

      setCategories(data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan memuat kategori");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  const value = React.useMemo(
    () => ({
      categories,
      isLoading,
      error,
      refreshCategories,
    }),
    [categories, isLoading, error, refreshCategories]
  );

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategory(): CategoryContextValue {
  const context = React.useContext(CategoryContext);
  if (!context) {
    throw new Error("useCategory must be used within a CategoryProvider");
  }
  return context;
}
