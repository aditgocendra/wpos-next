import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip public assets and static files
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname === "/setup" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "wpos-development-secret-key-super-secure-change-in-prod",
  });

  const isAuthPage = pathname === "/sign-in" || pathname === "/login";

  // If user is authenticated and visits auth pages, redirect to role dashboard
  if (isAuthPage) {
    if (token) {
      if (token.role === "CASHIER") {
        return NextResponse.redirect(new URL("/pos", req.url));
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // If user is NOT authenticated, redirect to /sign-in (or return 401 JSON for API)
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan masuk terlebih dahulu" },
        { status: 401 }
      );
    }
    const signInUrl = new URL("/sign-in", req.url);
    if (pathname !== "/") {
      signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    }
    return NextResponse.redirect(signInUrl);
  }

  const role = token.role;

  // Handle API route RBAC without HTML redirects
  if (pathname.startsWith("/api/")) {
    if (role === "CASHIER") {
      const isAllowedApi =
        pathname.startsWith("/api/transactions") ||
        pathname.startsWith("/api/inventory") ||
        pathname.startsWith("/api/warehouses");
      if (!isAllowedApi) {
        return NextResponse.json(
          { error: "Forbidden: Akses ditolak untuk role Cashier" },
          { status: 403 }
        );
      }
    } else if (role === "WAREHOUSE_ADMIN") {
      const isAllowedApi =
        pathname.startsWith("/api/warehouses") ||
        pathname.startsWith("/api/transfers") ||
        pathname.startsWith("/api/inventory") ||
        pathname.startsWith("/api/categories") ||
        pathname.startsWith("/api/opname");
      if (!isAllowedApi) {
        return NextResponse.json(
          { error: "Forbidden: Akses ditolak untuk role Warehouse Admin" },
          { status: 403 }
        );
      }
    }
    return NextResponse.next();
  }

  // Root path allowed for all authenticated roles (SUPER_ADMIN, WAREHOUSE_ADMIN, CASHIER)
  if (pathname === "/") {
    return NextResponse.next();
  }

  // RBAC page route enforcement
  if (role === "CASHIER") {
    // CASHIER can access dashboard (/), /pos, and /transaction(s)
    const isAllowed =
      pathname.startsWith("/pos") ||
      pathname.startsWith("/transaction") ||
      pathname.startsWith("/transactions");
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  } else if (role === "WAREHOUSE_ADMIN") {
    // WAREHOUSE_ADMIN can access dashboard (/), /transfers, /inventory, and /opname (warehouses & categories management are hidden)
    const isTransferRoute =
      pathname.startsWith("/transfers") || pathname.startsWith("/transfer");
    const isInventoryRoute = pathname.startsWith("/inventory");
    const isOpnameRoute = pathname.startsWith("/opname");
    if (!isTransferRoute && !isInventoryRoute && !isOpnameRoute) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  } else if (role === "SUPER_ADMIN") {
    // SUPER_ADMIN has full access to all routes
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
