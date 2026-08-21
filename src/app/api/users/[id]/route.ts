import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userService } from "@/services/user.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    if (body.toggleStatus) {
      const updatedUser = await userService.toggleUserStatus(id, body.status);
      return NextResponse.json({ user: updatedUser });
    }

    const updatedUser = await userService.updateUser(id, {
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
      warehouseId: body.warehouseId,
      status: body.status,
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("not found")
      ? 404
      : message.includes("already registered")
      ? 409
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    await userService.deleteUser(id, session.user.id);

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("Cannot delete") ? 400 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}
