"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MonthPickerProps {
  value?: string; // Format "YYYY-MM"
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const MONTHS = [
  { index: 0, label: "Januari", short: "Jan" },
  { index: 1, label: "Februari", short: "Feb" },
  { index: 2, label: "Maret", short: "Mar" },
  { index: 3, label: "April", short: "Apr" },
  { index: 4, label: "Mei", short: "Mei" },
  { index: 5, label: "Juni", short: "Jun" },
  { index: 6, label: "Juli", short: "Jul" },
  { index: 7, label: "Agustus", short: "Agu" },
  { index: 8, label: "September", short: "Sep" },
  { index: 9, label: "Oktober", short: "Okt" },
  { index: 10, label: "November", short: "Nov" },
  { index: 11, label: "Desember", short: "Des" },
];

export function MonthPicker({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Pilih Bulan",
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse current year & month from value or default to today
  const parsed = React.useMemo(() => {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-");
      return {
        year: parseInt(y, 10),
        month: parseInt(m, 10) - 1, // 0-based
      };
    }
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth(),
    };
  }, [value]);

  const [displayYear, setDisplayYear] = React.useState<number>(parsed.year);

  // Sync displayYear when value changes
  React.useEffect(() => {
    setDisplayYear(parsed.year);
  }, [parsed.year]);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const formattedDisplay = React.useMemo(() => {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
    const [y, m] = value.split("-");
    const mIdx = parseInt(m, 10) - 1;
    const monthObj = MONTHS[mIdx];
    return monthObj ? `${monthObj.label} ${y}` : value;
  }, [value]);

  const handleSelectMonth = (monthIndex: number) => {
    const nextVal = `${displayYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    onChange?.(nextVal);
    setOpen(false);
  };

  const handleSetCurrentMonth = () => {
    const nextVal = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    setDisplayYear(currentYear);
    onChange?.(nextVal);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal h-9 text-sm px-3 bg-background",
              !value && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate">
          {formattedDisplay || placeholder}
        </span>
        <ChevronDownIcon className="ml-auto h-4 w-4 opacity-50 shrink-0" />
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3 z-50 shadow-md" align="start">
        {/* Year Navigation Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setDisplayYear((prev) => prev - 1)}
            aria-label="Tahun Sebelumnya"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {displayYear}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setDisplayYear((prev) => prev + 1)}
            aria-label="Tahun Berikutnya"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* 12-Month Grid (3 cols x 4 rows) */}
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {MONTHS.map((m) => {
            const isSelected =
              value &&
              parsed.year === displayYear &&
              parsed.month === m.index;

            const isCurrent =
              currentYear === displayYear &&
              currentMonth === m.index;

            return (
              <Button
                key={m.index}
                variant={isSelected ? "default" : isCurrent ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 text-xs font-medium px-1 rounded-md transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/90"
                    : isCurrent
                    ? "font-semibold border border-primary/30"
                    : "hover:bg-accent text-foreground"
                )}
                onClick={() => handleSelectMonth(m.index)}
              >
                {m.short}
              </Button>
            );
          })}
        </div>

        {/* Footer Quick Action */}
        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={handleSetCurrentMonth}
          >
            Bulan Ini
          </Button>
          {value && (
            <span className="text-[11px] text-muted-foreground font-mono">
              {value}
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
