import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip public assets and static files
  if (
    pathname.startsWith("/api/auth") ||
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

  // If user is NOT authenticated, redirect to /sign-in
  if (!token) {
    const signInUrl = new URL("/sign-in", req.url);
    if (pathname !== "/") {
      signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    }
    return NextResponse.redirect(signInUrl);
  }

  const role = token.role;

  // Root path redirect based on role
  if (pathname === "/") {
    if (role === "CASHIER") {
      return NextResponse.redirect(new URL("/pos", req.url));
    }
    return NextResponse.next();
  }

  // RBAC route enforcement
  if (role === "CASHIER") {
    // CASHIER can only access /pos routes
    if (!pathname.startsWith("/pos")) {
      return NextResponse.redirect(new URL("/pos", req.url));
    }
  } else if (role === "WAREHOUSE_ADMIN") {
    // WAREHOUSE_ADMIN can access dashboard (/), /warehouses, /transfers, and /inventory
    const isDashboardRoute = pathname === "/";
    const isWarehouseRoute =
      pathname.startsWith("/warehouse") || pathname.startsWith("/warehouses");
    const isTransferRoute = pathname.startsWith("/transfers");
    const isInventoryRoute = pathname.startsWith("/inventory");
    if (!isDashboardRoute && !isWarehouseRoute && !isTransferRoute && !isInventoryRoute) {
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
