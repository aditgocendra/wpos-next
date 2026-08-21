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
import { Button, buttonVariants } from "@/components/ui/button";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserItem } from "@/services/user.service";

interface WarehouseOption {
  id: string;
  name: string;
  code?: string | null;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserItem | null;
  warehouses: WarehouseOption[];
  onSuccess: () => void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  warehouses,
  onSuccess,
}: UserFormDialogProps) {
  const isEditing = !!user;

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<"WAREHOUSE_ADMIN" | "CASHIER">("WAREHOUSE_ADMIN");
  const [warehouseId, setWarehouseId] = React.useState<string>("");
  const [status, setStatus] = React.useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  const [warehouseComboboxOpen, setWarehouseComboboxOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      if (user) {
        setEmail(user.email);
        setPassword("");
        setRole(user.role === "SUPER_ADMIN" ? "WAREHOUSE_ADMIN" : (user.role as "WAREHOUSE_ADMIN" | "CASHIER"));
        setWarehouseId(user.warehouseId || "");
        setStatus(user.status);
      } else {
        setEmail("");
        setPassword("");
        setRole("WAREHOUSE_ADMIN");
        setWarehouseId(warehouses.length > 0 ? warehouses[0].id : "");
        setStatus("ACTIVE");
      }
    }
  }, [open, user, warehouses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!isEditing && !password.trim()) {
      setError("Password is required for new user");
      return;
    }

    setLoading(true);

    try {
      if (isEditing && user) {
        const payload: Record<string, unknown> = {
          email: email.trim(),
          role,
          status,
          warehouseId: role === "WAREHOUSE_ADMIN" ? (warehouseId || null) : null,
        };
        if (password.trim()) {
          payload.password = password.trim();
        }

        const res = await fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to update user");
        }
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password: password.trim(),
            role,
            status,
            warehouseId: role === "WAREHOUSE_ADMIN" ? (warehouseId || null) : null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create user");
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit User" : "Create New User"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update user credentials, role permissions, and assigned warehouse."
                : "Fill in the details below to add a new system user."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="grid gap-3 py-2">
            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="user-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-email"
                type="email"
                placeholder="user@wpos.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <Label htmlFor="user-password">
                Password {isEditing ? "(Leave blank to keep unchanged)" : <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="user-password"
                type="password"
                placeholder={isEditing ? "••••••••" : "Enter password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!isEditing}
                disabled={loading}
              />
            </div>

            {/* Role Select */}
            <div className="space-y-1.5">
              <Label htmlFor="user-role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={role}
                onValueChange={(val) => setRole(val as "WAREHOUSE_ADMIN" | "CASHIER")}
                disabled={loading}
              >
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WAREHOUSE_ADMIN">Warehouse Admin</SelectItem>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse Combobox (Active only for Warehouse Admin) */}
            {role === "WAREHOUSE_ADMIN" && (
              <div className="space-y-1.5">
                <Label htmlFor="user-warehouse">Assigned Warehouse (Optional)</Label>
                {warehouses.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic p-2 border rounded-md">
                    No warehouses created yet. You can assign a warehouse later.
                  </div>
                ) : (
                  <Popover open={warehouseComboboxOpen} onOpenChange={setWarehouseComboboxOpen}>
                    <PopoverTrigger
                      id="user-warehouse"
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-full justify-between font-normal"
                      )}
                      disabled={loading}
                    >
                      {selectedWarehouse
                        ? `${selectedWarehouse.name} (${selectedWarehouse.code || "No Code"})`
                        : "Select warehouse..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search warehouse..." />
                        <CommandList>
                          <CommandEmpty>No warehouse found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                setWarehouseId("");
                                setWarehouseComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  !warehouseId ? "opacity-100" : "opacity-0"
                                )}
                              />
                              No Warehouse (Unassigned)
                            </CommandItem>
                            {warehouses.map((wh) => (
                              <CommandItem
                                key={wh.id}
                                value={wh.name}
                                onSelect={() => {
                                  setWarehouseId(wh.id);
                                  setWarehouseComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    warehouseId === wh.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {wh.name} {wh.code ? `(${wh.code})` : ""}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            {/* Status Select */}
            <div className="space-y-1.5">
              <Label htmlFor="user-status">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as "ACTIVE" | "INACTIVE")}
                disabled={loading}
              >
                <SelectTrigger id="user-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
