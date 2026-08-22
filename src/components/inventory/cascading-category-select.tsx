"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FolderTreeIcon, LayersIcon, CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import type { CategoryItem } from "@/services/category.service";

interface CascadingCategorySelectProps {
  categories: CategoryItem[];
  value: string; // leaf category id
  onChange: (leafCategoryId: string, category: CategoryItem | null) => void;
  disabled?: boolean;
}

export function CascadingCategorySelect({
  categories,
  value,
  onChange,
  disabled = false,
}: CascadingCategorySelectProps) {
  // Build lookup maps
  const categoryMap = React.useMemo(() => {
    return new Map<string, CategoryItem>(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Root categories
  const rootCategories = React.useMemo(() => {
    return categories
      .filter((c) => !c.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  // Helper to get children of any category ID
  const getChildrenOf = React.useCallback(
    (parentId: string) => {
      return categories
        .filter((c) => c.parentId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [categories]
  );

  // Helper to trace full ancestor path from a leaf ID up to root
  const getAncestorPath = React.useCallback(
    (targetId: string): string[] => {
      const path: string[] = [];
      let current = categoryMap.get(targetId);
      const visited = new Set<string>();

      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        path.unshift(current.id);
        if (!current.parentId) break;
        current = categoryMap.get(current.parentId);
      }
      return path;
    },
    [categoryMap]
  );

  // Current selected chain (e.g. [rootId, subId1, subId2])
  const [selectedChain, setSelectedChain] = React.useState<string[]>([]);

  // Sync state when incoming `value` prop changes
  React.useEffect(() => {
    if (value && categoryMap.has(value)) {
      const path = getAncestorPath(value);
      setSelectedChain(path);
    } else if (!value) {
      if (selectedChain.length === 0 && rootCategories.length > 0) {
        // Start unselected or with empty
        setSelectedChain([]);
      }
    }
  }, [value, categoryMap, getAncestorPath]);

  // Determine active levels to render
  const levels = React.useMemo(() => {
    const list: {
      levelIndex: number;
      label: string;
      options: CategoryItem[];
      selectedValue: string;
    }[] = [];

    // Level 0: Root categories
    const level0Selected = selectedChain[0] || "";
    list.push({
      levelIndex: 0,
      label: "Kategori Utama",
      options: rootCategories,
      selectedValue: level0Selected,
    });

    // Subsequent levels
    for (let i = 0; i < selectedChain.length; i++) {
      const currentSelectedId = selectedChain[i];
      if (!currentSelectedId) break;

      const children = getChildrenOf(currentSelectedId);
      if (children.length > 0) {
        const nextSelected = selectedChain[i + 1] || "";
        list.push({
          levelIndex: i + 1,
          label: i === 0 ? "Subkategori" : `Subkategori Level ${i + 1}`,
          options: children,
          selectedValue: nextSelected,
        });
      }
    }

    return list;
  }, [selectedChain, rootCategories, getChildrenOf]);

  // Check if current terminal selection is a valid leaf (has no children)
  const terminalCategory = React.useMemo(() => {
    if (selectedChain.length === 0) return null;
    const lastId = selectedChain[selectedChain.length - 1];
    return categoryMap.get(lastId) || null;
  }, [selectedChain, categoryMap]);

  const isLeafSelected = React.useMemo(() => {
    if (!terminalCategory) return false;
    const children = getChildrenOf(terminalCategory.id);
    return children.length === 0;
  }, [terminalCategory, getChildrenOf]);

  // Handler when user selects an item at a specific level
  const handleSelectLevel = (levelIndex: number, newId: string) => {
    const newChain = selectedChain.slice(0, levelIndex);
    newChain.push(newId);

    // Auto-traverse if children exist or leave for user to pick
    setSelectedChain(newChain);

    const selectedCat = categoryMap.get(newId) || null;
    const children = getChildrenOf(newId);

    if (children.length === 0) {
      // Leaf reached!
      onChange(newId, selectedCat);
    } else {
      // Incomplete parent selected
      onChange("", null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Dynamic Cascading Select Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {levels.map((level) => (
          <div key={level.levelIndex} className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              {level.levelIndex === 0 ? (
                <FolderTreeIcon className="size-3.5 text-primary" />
              ) : (
                <LayersIcon className="size-3.5 text-blue-500" />
              )}
              <span>{level.label}</span>
              <span className="text-destructive">*</span>
            </Label>
            <Select
              value={level.selectedValue}
              onValueChange={(val) => {
                if (val) handleSelectLevel(level.levelIndex, val);
              }}
              disabled={disabled}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue
                  placeholder={`Pilih ${level.label.toLowerCase()}`}
                />
              </SelectTrigger>
              <SelectContent>
                {level.options.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] font-bold px-1.5 py-0 bg-primary/5 text-primary border-primary/20"
                      >
                        {cat.code}
                      </Badge>
                      <span>{cat.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* Status & Breadcrumb Box */}
      {selectedChain.length > 0 && terminalCategory && (
        <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
          {isLeafSelected ? (
            <div className="flex items-center justify-between flex-wrap gap-2 text-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="font-semibold text-green-700 dark:text-green-300">
                  Subkategori Terpilih (Leaf):
                </span>
                <span className="font-bold text-foreground">
                  {terminalCategory.fullPath}
                </span>
              </div>
              <Badge
                variant="outline"
                className="font-mono text-[11px] font-bold px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
              >
                Kode: {terminalCategory.code}
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span>
                Kategori <strong>&quot;{terminalCategory.name}&quot;</strong> masih memiliki subkategori. Harap pilih subkategori berikutnya di atas.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
