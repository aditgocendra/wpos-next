import { NextResponse } from "next/server";
import { userService } from "@/services/user.service";

export async function GET() {
  try {
    const hasUsers = await userService.hasAnyUser();
    return NextResponse.json({ isInitialized: hasUsers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check setup status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const hasUsers = await userService.hasAnyUser();
    if (hasUsers) {
      return NextResponse.json(
        { error: "Setup already completed. Super Admin exists." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const superAdmin = await userService.createUser({
      name: name?.trim() || "Super Admin",
      email: email.trim().toLowerCase(),
      password,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });

    return NextResponse.json(
      {
        message: "Super Admin account created successfully",
        user: superAdmin,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
